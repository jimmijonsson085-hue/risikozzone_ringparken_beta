import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AcousticDustWarningService,
  evaluateAcuteWindDustRisk,
  shouldResetAcousticWarningHysteresis,
} from '../../services/acousticDustWarningService';
import { computeGustMachineImpulseStatistics } from '../gustNoiseStatistics';
import {
  computeLatest6hGustMetrics,
  computeWindDirectionalNoiseCells,
} from '../../components/WindDirectionalNoiseHeatmapLayer';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
  RINGPARKEN_MASTER_BUILDINGS,
} from '../../data/ringparkenData';
import { buildAutonomousReceptorMeshNetwork } from '../../services/autonomousReceptorMeshService';
import { runDispersionSimulation } from '../../services/dispersionEngine';
import { evaluateSimultaneousAlgedonicDispatch } from '../../services/myceliumSimulationEngine';
import { HourlyWeatherPoint } from '../../types/dispersion';

function makeWeatherHour(
  hourIndex: number,
  windSpeed10m: number,
  windGusts10m: number,
  windDirection10m = 250
): HourlyWeatherPoint {
  return {
    isoTime: `2026-04-14T${String(hourIndex).padStart(2, '0')}:00:00Z`,
    hourIndex,
    hourLabel: `${String(hourIndex).padStart(2, '0')}:00`,
    temperature2m: 11.2,
    relativeHumidity2m: 66,
    precipitation: 0,
    cloudCover: 35,
    windSpeed10m,
    windDirection10m,
    windGusts10m,
    soilMoisture0To7cm: 0.21,
    directRadiation: 360,
    weatherCode: 2,
    pasquillClass: windSpeed10m > 8 ? 'D' : 'C',
    hadRecentFreezeThaw: false,
  };
}

describe('Web Audio API acoustic dust dispersion warning service (Item 4)', () => {
  it('triggers acute risk strictly when S > 0.8 AND windSpeed > 10.0 m/s', () => {
    const nominalBoundaryS = evaluateAcuteWindDustRisk({
      sumQuotientS: 0.8,
      windSpeedMs: 12.5,
    });
    assert.equal(nominalBoundaryS.isAcuteRisk, false);
    assert.equal(nominalBoundaryS.severityLevel, 'NOMINAL');

    const nominalBoundaryWind = evaluateAcuteWindDustRisk({
      sumQuotientS: 0.95,
      windSpeedMs: 10.0,
    });
    assert.equal(nominalBoundaryWind.isAcuteRisk, false);

    const acute = evaluateAcuteWindDustRisk({
      sumQuotientS: 0.85,
      windSpeedMs: 10.4,
    });
    assert.equal(acute.isAcuteRisk, true);
    assert.equal(acute.severityLevel, 'ACUTE_OVER_08');
    assert.deepEqual(acute.toneFrequenciesHz, [587.33, 880.0]);

    const critical = evaluateAcuteWindDustRisk({
      sumQuotientS: 1.12,
      windSpeedMs: 13.0,
    });
    assert.equal(critical.isAcuteRisk, true);
    assert.equal(critical.severityLevel, 'CRITICAL_OVER_1');
    assert.deepEqual(critical.toneFrequenciesHz, [659.25, 987.77]);
  });

  it('enforces hysteresis reset and state-key deduplication / cooldown', () => {
    assert.equal(
      shouldResetAcousticWarningHysteresis({ sumQuotientS: 0.72, windSpeedMs: 11.0 }),
      true
    );
    assert.equal(
      shouldResetAcousticWarningHysteresis({ sumQuotientS: 0.9, windSpeedMs: 9.0 }),
      true
    );
    assert.equal(
      shouldResetAcousticWarningHysteresis({ sumQuotientS: 0.85, windSpeedMs: 10.5 }),
      false
    );

    const svc = new AcousticDustWarningService(5000);
    assert.equal(svc.shouldTriggerForStateKey('12-rec1-live', 10000), true);
    assert.equal(svc.shouldTriggerForStateKey('12-rec1-live', 20000), false);
    assert.equal(svc.shouldTriggerForStateKey('13-rec1-live', 20000), true);
    svc.resetHysteresis();
    assert.equal(svc.shouldTriggerForStateKey('13-rec1-live', 20000), true);
  });
});

describe('Gust vs machine impulse-noise statistical correlation engine (Item 5)', () => {
  it('computes positive Pearson r, R², slope, and ranks hazardous weather scenarios', () => {
    const hours = Array.from({ length: 24 }, (_, idx) => {
      // Stronger gusts during midday demolition hours (10..15)
      const isPeak = idx >= 11 && idx <= 14;
      const wind = isPeak ? 11.5 : 4.8 + (idx % 3);
      const gust = isPeak ? 17.6 : 7.0 + (idx % 3) * 1.1;
      return makeWeatherHour(idx, wind, gust);
    });

    const stats = computeGustMachineImpulseStatistics({
      weatherHours: hours,
      machineLwaDb: 116,
      impulsePenaltyDb: 16,
      gustHazardThresholdMs: 12.0,
      impulseHazardThresholdDb: 78.0,
    });

    assert.equal(stats.sampleCount, 24);
    assert.ok(stats.pearsonR > 0.5, `Expected strong positive r, got ${stats.pearsonR}`);
    assert.ok(stats.rSquared > 0.25);
    assert.ok(stats.slopeDbPerMs > 0);
    assert.ok(stats.hazardousScenarioCount >= 4);
    assert.ok(stats.criticalScenarioCount >= 4);
    assert.equal(stats.hazardousScenariosSorted[0].hazardLevel, 'KRITISK');
    assert.ok(stats.hazardousScenariosSorted[0].windGustMs >= 17.0);
  });
});

describe('6h wind-gust directional noise heatmap layer for selected blocks & sources (Item 7)', () => {
  const hours = Array.from({ length: 24 }, (_, idx) => {
    const baseWind = idx >= 8 && idx <= 13 ? 9.5 + (idx - 8) * 0.4 : 4.2;
    const gust = idx >= 8 && idx <= 13 ? 13.5 + (idx - 8) * 0.9 : 6.0;
    return makeWeatherHour(idx, baseWind, gust, 250);
  });

  it('extracts the exact latest 6-hour gust window ending at selectedHourIndex', () => {
    const summary = computeLatest6hGustMetrics(hours, 13, hours[13]);
    assert.equal(summary.windowHours.length, 6);
    assert.deepEqual(
      summary.windowHours.map((h) => h.hourIndex),
      [8, 9, 10, 11, 12, 13]
    );
    assert.equal(summary.windowLabel, '08:00–13:00');
    assert.equal(summary.peakWindGustMs, 18.0);
    assert.ok(summary.meanWindGustMs > 15.0);
  });

  it('filters heatmap cells strictly by selectedNeighborBlockIds and active source nodes', () => {
    const targetBlocks = [
      INITIAL_RECEPTOR_ZONES[0].id,
      INITIAL_RECEPTOR_ZONES[1].id,
    ];
    const twoActiveSources = INITIAL_DEMOLITION_SOURCES.map((s, idx) => ({
      ...s,
      active: idx < 2,
    }));
    const oneActiveSource = INITIAL_DEMOLITION_SOURCES.map((s, idx) => ({
      ...s,
      active: idx === 0,
    }));

    const summary = computeLatest6hGustMetrics(hours, 13, hours[13]);
    const cellsTwo = computeWindDirectionalNoiseCells({
      sources: twoActiveSources,
      receptors: INITIAL_RECEPTOR_ZONES,
      selectedNeighborBlockIds: targetBlocks,
      windFromDeg: summary.dominantWindFromDeg,
      windSpeedMs: summary.meanWindSpeedMs,
      windGustMs: summary.peakWindGustMs,
      latest6hWeatherHours: summary.windowHours,
      baseMachineLwaDb: 114,
    });

    assert.equal(cellsTwo.length, 2);
    assert.ok(cellsTwo.every((c) => targetBlocks.includes(c.receptor.id)));
    assert.ok(cellsTwo.every((c) => c.activeSourceCount === 2));
    assert.ok(cellsTwo.every((c) => c.gust6hPeakMs === 18.0));

    const cellsOne = computeWindDirectionalNoiseCells({
      sources: oneActiveSource,
      receptors: INITIAL_RECEPTOR_ZONES,
      selectedNeighborBlockIds: targetBlocks,
      windFromDeg: summary.dominantWindFromDeg,
      windSpeedMs: summary.meanWindSpeedMs,
      windGustMs: summary.peakWindGustMs,
      latest6hWeatherHours: summary.windowHours,
      baseMachineLwaDb: 114,
    });

    assert.equal(cellsOne.length, 2);
    assert.ok(cellsOne.every((c) => c.activeSourceCount === 1));
    // Cumulative sound energy across 2 active sources should be >= 1 source
    const sumEnergyTwo = cellsTwo.reduce((acc, c) => acc + c.laeqDb, 0);
    const sumEnergyOne = cellsOne.reduce((acc, c) => acc + c.laeqDb, 0);
    assert.ok(sumEnergyTwo >= sumEnergyOne);
  });
});

describe('System B Mycelium simultaneous S1+S3 emergency-brake telemetry (Item 6)', () => {
  it('produces atomic T0->T1 dispatch with < 15 ms latency, ZKP hash, and locked valves', () => {
    const hours24 = Array.from({ length: 24 }, (_, idx) =>
      makeWeatherHour(idx, 12.2, 17.5, 245)
    );
    const weather = hours24[12];
    const activeSources = INITIAL_DEMOLITION_SOURCES.map((s, idx) => ({
      ...s,
      active: idx < 2,
    }));
    const sim = runDispersionSimulation(
      '2026-04-14',
      12,
      hours24,
      activeSources,
      INITIAL_RECEPTOR_ZONES
    );
    const mesh = buildAutonomousReceptorMeshNetwork({
      receptors: INITIAL_RECEPTOR_ZONES,
      sources: activeSources,
      receptorExposures: sim.receptorExposures,
      observations: [],
      currentWeather: weather,
    });

    const dispatch = evaluateSimultaneousAlgedonicDispatch({
      sources: activeSources,
      receptors: INITIAL_RECEPTOR_ZONES,
      buildings: RINGPARKEN_MASTER_BUILDINGS,
      receptorExposures: sim.receptorExposures,
      mesh,
      currentWeather: weather,
      maxSiteSumQuotient: 1.35,
      machineNoiseOutputDb: 114,
      cavVentilationModeLabelDa: 'Centralt CAV-Udsug (Undertryk)',
      manualScenarioOverride: 'asbestos_plume_cav_vacuum',
      acknowledged: false,
      acknowledgedAtIso: null,
      existingT0EpochMs: 1776168000000,
    });

    assert.equal(dispatch.active, true);
    assert.equal(dispatch.bureaucraticDelayDeltaTMs, 0);
    assert.ok(dispatch.latencyMs >= 4 && dispatch.latencyMs < 15);
    assert.ok(dispatch.gate1Validation.zkpRightToOpacityHash.startsWith('0x'));
    assert.deepEqual(dispatch.system3State.lockedValveCodes, ['V-VEST', 'V-MIDT']);
    assert.ok(dispatch.triggers.activeTriggerReasonsDa.length >= 1);
  });
});
