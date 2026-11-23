import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BUILDING_CATEGORY_METADATA,
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
  RINGPARKEN_MASTER_BUILDINGS,
} from '../../data/ringparkenData';
import { computeSelectedNeighborGustNoiseAppendixData } from '../../services/selectedNoiseEventsPdfService';
import { buildWeeklyCategoryExceedanceAndTrends } from '../../services/complianceAuditWeeklyPdfService';
import { HourlyWeatherPoint } from '../../types/dispersion';
import { computeHighWindNeighborNoisePulseTargets } from '../neighborNoisePulse';
import {
  NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
  NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB,
  createInitialNoiseHysteresisState,
  evaluateNoiseComplianceHysteresisStep,
  formatDurationMmSs,
} from '../noiseComplianceHysteresis';

function makeWeatherHour(
  hourIndex: number,
  windSpeed10m: number,
  windGusts10m: number,
  windDirection10m = 245
): HourlyWeatherPoint {
  return {
    isoTime: `2026-04-14T${String(hourIndex).padStart(2, '0')}:00:00Z`,
    hourIndex,
    hourLabel: `${String(hourIndex).padStart(2, '0')}:00`,
    temperature2m: 11.5,
    relativeHumidity2m: 62,
    precipitation: 0,
    cloudCover: 30,
    windSpeed10m,
    windDirection10m,
    windGusts10m,
    soilMoisture0To7cm: 0.2,
    directRadiation: 350,
    weatherCode: 1,
    pasquillClass: windSpeed10m > 8 ? 'D' : 'C',
    hadRecentFreezeThaw: false,
  };
}

describe('Teknisk bilag til miljøtilsyn: Vindstød × Maskinstøj for valgte naboblokke (Item 1)', () => {
  it('filtrerer strikt på valgte naboblokke og beregner Pearson r, R² og hældning', () => {
    const picked = INITIAL_RECEPTOR_ZONES.filter(
      (r) => r.category === 'residential_block'
    ).slice(0, 2);
    assert.ok(picked.length >= 2);

    const weatherHours = Array.from({ length: 24 }, (_, idx) => {
      const ws = idx >= 7 && idx <= 17 ? 5 + (idx % 7) * 1.4 : 3.5;
      const wg = Number((ws * 1.45).toFixed(1));
      return makeWeatherHour(idx, ws, wg, 245);
    });

    const dataset = computeSelectedNeighborGustNoiseAppendixData({
      dateIso: '2026-04-14',
      hourLabel: '12:00',
      weatherHours,
      currentWeather: weatherHours[12],
      sources: INITIAL_DEMOLITION_SOURCES,
      selectedReceptors: picked,
      effectiveLwaDb: 114,
      machineProfileLabel: 'Aktiv Nedrivningsdrift (K1)',
    });

    assert.equal(dataset.rows.length, picked.length);
    for (const row of dataset.rows) {
      assert.ok(picked.some((p) => p.id === row.receptorId));
      assert.ok(Number.isFinite(row.pearsonR));
      assert.ok(row.rSquared >= 0 && row.rSquared <= 1);
      assert.ok(Number.isFinite(row.slopeDbPerMs));
      assert.ok(row.peak24hLafmaxDb >= row.currentLafmaxDb);
      assert.match(row.complianceStatusDa, /KRITISK|OVERSKRIDELSE|OVERHOLDELSE/);
    }
    assert.equal(dataset.reportSha256.length, 64);
  });
});

describe('2D-kort visuel puls ved maskinstøj > 85 dB(A) under højvind (Item 2)', () => {
  it('returnerer tom liste ved roligt vejr eller maskin-L_WA <= 85 dB(A)', () => {
    const calmTargets = computeHighWindNeighborNoisePulseTargets({
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: makeWeatherHour(12, 6.0, 9.0, 245),
      machineNoiseOutputDb: 118,
    });
    assert.equal(calmTargets.length, 0);

    const quietMachineTargets = computeHighWindNeighborNoisePulseTargets({
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: makeWeatherHour(12, 13.5, 19.0, 245),
      machineNoiseOutputDb: 84.5,
    });
    assert.equal(quietMachineTargets.length, 0);
  });

  it('aktiverer naboblok-puls med >85 dB(A) under højvindsscenarier (v > 10 m/s eller stød > 12 m/s)', () => {
    const targets = computeHighWindNeighborNoisePulseTargets({
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: makeWeatherHour(12, 13.5, 19.5, 245),
      machineNoiseOutputDb: 118.5,
    });

    assert.ok(targets.length > 0);
    for (const t of targets) {
      assert.ok(t.estimatedLafmaxDb > 85.0);
      assert.ok(t.pulseDurationSec >= 0.75 && t.pulseDurationSec <= 1.55);
      assert.ok(t.severity === 'critical' || t.severity === 'extreme');
    }
  });
});

describe('NoiseComplianceLogPanel 15-minutters støjalarm-hysterese (Item 3)', () => {
  it('låser alarm ved første >55 dB(A), dæmper fluktuationer og nulstiller først efter 15 min overholdelse', () => {
    const t0 = 1_700_000_000_000;
    let state = createInitialNoiseHysteresisState('rec-blok-2', t0);
    assert.equal(state.phase, 'MONITORING_IDLE');

    // 1. Overskridelse -> udløser én notifikation og låser alarm
    const step1 = evaluateNoiseComplianceHysteresisStep(state, {
      currentMaxDb: 62.4,
      nowMs: t0,
      hourLabel: '09:00',
      receptorId: 'rec-blok-2',
      receptorCode: 'AFD23-B2',
      thresholdDb: NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB,
      complianceResetMs: NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
    });
    assert.equal(step1.shouldEmitAlarmNotification, true);
    assert.equal(step1.nextState.phase, 'ALARM_LATCHED');
    state = step1.nextState;

    // 2. Fluktuerende ny stigning -> undertrykkes uden ny notifikation
    const step2 = evaluateNoiseComplianceHysteresisStep(state, {
      currentMaxDb: 66.0,
      nowMs: t0 + 60_000,
      hourLabel: '09:01',
      receptorId: 'rec-blok-2',
      receptorCode: 'AFD23-B2',
    });
    assert.equal(step2.shouldEmitAlarmNotification, false);
    assert.equal(step2.wasSuppressedFluctuation, true);
    assert.equal(step2.nextState.suppressedFluctuationCount, 1);
    state = step2.nextState;

    // 3. Støj falder til <= 55 dB -> starter 15 min overholdelsestimer
    const step3 = evaluateNoiseComplianceHysteresisStep(state, {
      currentMaxDb: 53.5,
      nowMs: t0 + 120_000,
      hourLabel: '09:02',
      receptorId: 'rec-blok-2',
      receptorCode: 'AFD23-B2',
    });
    assert.equal(step3.nextState.phase, 'COMPLIANCE_RECOVERY');
    assert.equal(step3.shouldEmitAlarmNotification, false);
    state = step3.nextState;

    // 4. Støj stiger igen efter kun 10 min (< 15 min) -> genlåses uden ny notifikation
    const step4 = evaluateNoiseComplianceHysteresisStep(state, {
      currentMaxDb: 58.2,
      nowMs: t0 + 120_000 + 10 * 60_000,
      hourLabel: '09:12',
      receptorId: 'rec-blok-2',
      receptorCode: 'AFD23-B2',
    });
    assert.equal(step4.nextState.phase, 'ALARM_LATCHED');
    assert.equal(step4.shouldEmitAlarmNotification, false);
    assert.equal(step4.wasSuppressedFluctuation, true);
    assert.equal(step4.nextState.suppressedFluctuationCount, 2);
    state = step4.nextState;

    // 5. Falder under <= 55 dB igen og holder sig der i hele 15 minutter -> nulstilles!
    const recoveryStartMs = t0 + 800_000;
    const step5 = evaluateNoiseComplianceHysteresisStep(state, {
      currentMaxDb: 51.0,
      nowMs: recoveryStartMs,
      hourLabel: '09:14',
      receptorId: 'rec-blok-2',
      receptorCode: 'AFD23-B2',
    });
    assert.equal(step5.nextState.phase, 'COMPLIANCE_RECOVERY');
    state = step5.nextState;

    // Efter 14:59 (ikke nok)
    const step5b = evaluateNoiseComplianceHysteresisStep(state, {
      currentMaxDb: 51.0,
      nowMs: recoveryStartMs + NOISE_HYSTERESIS_RESET_COMPLIANCE_MS - 1_000,
      hourLabel: '09:28',
      receptorId: 'rec-blok-2',
      receptorCode: 'AFD23-B2',
    });
    assert.equal(step5b.nextState.phase, 'COMPLIANCE_RECOVERY');
    assert.equal(step5b.wasResetAfter15MinCompliance, false);
    assert.equal(formatDurationMmSs(step5b.complianceRemainingMs), '00:01');
    state = step5b.nextState;

    // Efter præcis 15:00 -> nulstillet til MONITORING_IDLE
    const step6 = evaluateNoiseComplianceHysteresisStep(state, {
      currentMaxDb: 51.0,
      nowMs: recoveryStartMs + NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
      hourLabel: '09:29',
      receptorId: 'rec-blok-2',
      receptorCode: 'AFD23-B2',
    });
    assert.equal(step6.wasResetAfter15MinCompliance, true);
    assert.equal(step6.nextState.phase, 'MONITORING_IDLE');
    assert.equal(step6.nextState.resetCount, 1);
    state = step6.nextState;

    // 6. Næste overskridelse efter nulstilling må udløse en frisk notifikation
    const step7 = evaluateNoiseComplianceHysteresisStep(state, {
      currentMaxDb: 59.0,
      nowMs: recoveryStartMs + NOISE_HYSTERESIS_RESET_COMPLIANCE_MS + 60_000,
      hourLabel: '09:30',
      receptorId: 'rec-blok-2',
      receptorCode: 'AFD23-B2',
    });
    assert.equal(step7.shouldEmitAlarmNotification, true);
    assert.equal(step7.nextState.phase, 'ALARM_LATCHED');
  });
});

describe('ComplianceAuditPanel uge-overskridelser pr. bygningskategori & S-kvotient tendenser (Item 4)', () => {
  it('beregner 7-døgns uge-overskridelser for alle 5 bygningskategorier og top receptor S-tendenser', () => {
    const dataset = buildWeeklyCategoryExceedanceAndTrends({
      dateIso: '2026-04-14',
      buildings: RINGPARKEN_MASTER_BUILDINGS,
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      puff24h: null,
    });

    const expectedCategories = Object.keys(BUILDING_CATEGORY_METADATA);
    assert.equal(dataset.categorySummaries.length, expectedCategories.length);
    for (const catKey of expectedCategories) {
      const found = dataset.categorySummaries.find((c) => c.category === catKey);
      assert.ok(found, `Forventede uge-opgørelse for bygningskategori ${catKey}`);
      assert.ok(found.daysWithSOver1 >= 0 && found.daysWithSOver1 <= 7);
      assert.ok(Number.isFinite(found.peakSumQuotientS));
    }

    assert.ok(dataset.topReceptorTrends.length >= 1 && dataset.topReceptorTrends.length <= 4);
    for (const trend of dataset.topReceptorTrends) {
      assert.equal(trend.daily7DayPeakS.length, 7);
      assert.equal(trend.hourly24hS.length, 24);
      assert.ok(trend.peakSumQuotientS >= 0);
    }
    assert.equal(dataset.reportSha256.length, 64);
  });
});
