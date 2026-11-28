import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyAcousticWeighting,
  computeCMinusAOffsetDb,
  getWeightedNoiseLabels,
} from '../acousticWeighting';
import {
  PSS_RESPIRABLE_DUST_1H_THRESHOLD_UG_M3,
  RollingDustHazardAudioService,
  evaluateRolling1hRespirableDust,
} from '../../services/rollingDustHazardAlertService';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
} from '../../data/ringparkenData';
import { HourlyWeatherPoint } from '../../types/dispersion';

function make24hWeather(overrides: Partial<HourlyWeatherPoint> = {}): HourlyWeatherPoint[] {
  return Array.from({ length: 24 }, (_, hourIndex) => ({
    isoTime: `2026-11-27T${String(hourIndex).padStart(2, '0')}:00:00Z`,
    hourIndex,
    hourLabel: `${String(hourIndex).padStart(2, '0')}:00`,
    temperature2m: 9.5,
    relativeHumidity2m: 58,
    precipitation: 0,
    cloudCover: 35,
    windSpeed10m: 8.8,
    windDirection10m: 245,
    windGusts10m: 13.4,
    soilMoisture0To7cm: 0.18,
    directRadiation: 220,
    weatherCode: 1,
    pasquillClass: 'D',
    hadRecentFreezeThaw: false,
    ...overrides,
  }));
}

describe('Acoustic Frequency Weighting dB(A) vs dB(C)', () => {
  it('keeps canonical dB(A) values unchanged in A-weighting mode and applies IEC 61672-1 Δ(C-A) in C-weighting mode', () => {
    const canonicalDbA = 78.4;
    assert.equal(applyAcousticWeighting(canonicalDbA, 'A', { isImpulse: true, windGustMs: 14 }), 78.4);

    const cLowFreq = applyAcousticWeighting(canonicalDbA, 'C', {
      dominantFreqHz: 125,
      isImpulse: true,
      windGustMs: 14,
    });
    const cHighFreq = applyAcousticWeighting(canonicalDbA, 'C', {
      dominantFreqHz: 2500,
      isImpulse: true,
      windGustMs: 14,
    });

    assert.ok(cLowFreq > canonicalDbA, `Expected dB(C) (${cLowFreq}) > dB(A) (${canonicalDbA})`);
    assert.ok(
      cLowFreq > cHighFreq,
      `Expected low-freq Δ(C-A) (${cLowFreq}) > high-freq Δ(C-A) (${cHighFreq})`
    );
    assert.ok(computeCMinusAOffsetDb({ dominantFreqHz: 63, windGustMs: 18 }) <= 8.6);
    assert.ok(computeCMinusAOffsetDb({ dominantFreqHz: 4000, windGustMs: 2 }) >= 1.5);
  });

  it('returns compliant acoustic labels for both dB(A) and dB(C) standards', () => {
    const labelsA = getWeightedNoiseLabels('A');
    const labelsC = getWeightedNoiseLabels('C');

    assert.equal(labelsA.unit, 'dB(A)');
    assert.equal(labelsA.leqLabel, 'L_Aeq');
    assert.equal(labelsA.lmaxLabel, 'L_AFmax');
    assert.equal(labelsA.lwaLabel, 'L_WA');

    assert.equal(labelsC.unit, 'dB(C)');
    assert.equal(labelsC.leqLabel, 'L_Ceq');
    assert.equal(labelsC.lmaxLabel, 'L_CFmax');
    assert.equal(labelsC.lwaLabel, 'L_WC');
  });
});

describe('1-Hour Rolling Average Respirable Dust Hazard Alert System', () => {
  it('computes 6x10-min rolling sub-slots and triggers CRITICAL alert above PSS 100 µg/m³ threshold', () => {
    const hours = make24hWeather({ windSpeed10m: 11.2, windGusts10m: 15.8, precipitation: 0 });
    const evalResult = evaluateRolling1hRespirableDust({
      weatherHours: hours,
      selectedHourIndex: 13,
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      simulatedExceedanceBoostUgM3: 115,
    });

    assert.equal(evalResult.thresholdUgM3, PSS_RESPIRABLE_DUST_1H_THRESHOLD_UG_M3);
    assert.equal(evalResult.subSlots.length, 6);
    assert.ok(
      evalResult.rolling1hAverageUgM3 > PSS_RESPIRABLE_DUST_1H_THRESHOLD_UG_M3,
      `Expected 1h rolling avg > 100 µg/m³, got ${evalResult.rolling1hAverageUgM3}`
    );
    assert.equal(evalResult.isThresholdExceeded, true);
    assert.equal(evalResult.severity, 'CRITICAL');
    assert.ok(evalResult.exceedanceUgM3 > 0);
  });

  it('remains NOMINAL with zero exceedance when active sources are disabled and suppresses dust sharply under heavy rain', () => {
    const dryHours = make24hWeather({ precipitation: 0, windSpeed10m: 6.5, windGusts10m: 9.8 });
    const disabledSources = INITIAL_DEMOLITION_SOURCES.map((s) => ({ ...s, active: false }));

    const evalNoSources = evaluateRolling1hRespirableDust({
      weatherHours: dryHours,
      selectedHourIndex: 13,
      sources: disabledSources,
      receptors: INITIAL_RECEPTOR_ZONES,
    });

    assert.equal(evalNoSources.rolling1hAverageUgM3, 0);
    assert.equal(evalNoSources.isThresholdExceeded, false);
    assert.equal(evalNoSources.severity, 'NOMINAL');

    // Community receptor (AFD-32) dry vs. heavy rain (15 mm/t)
    const communityReceptors = INITIAL_RECEPTOR_ZONES.filter((r) => r.code === 'AFD-32');
    const evalDryCommunity = evaluateRolling1hRespirableDust({
      weatherHours: dryHours,
      selectedHourIndex: 13,
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: communityReceptors,
      precipitationOverrideMm: 0,
    });
    const evalHeavyRainCommunity = evaluateRolling1hRespirableDust({
      weatherHours: dryHours,
      selectedHourIndex: 13,
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: communityReceptors,
      precipitationOverrideMm: 15,
    });

    assert.ok(
      evalHeavyRainCommunity.rolling1hAverageUgM3 < evalDryCommunity.rolling1hAverageUgM3 * 0.65,
      `Expected heavy rain (${evalHeavyRainCommunity.rolling1hAverageUgM3}) to sharply suppress dry dust (${evalDryCommunity.rolling1hAverageUgM3})`
    );
    assert.equal(evalHeavyRainCommunity.isThresholdExceeded, false);
    assert.ok(evalHeavyRainCommunity.rolling1hAverageUgM3 < PSS_RESPIRABLE_DUST_1H_THRESHOLD_UG_M3);
  });

  it('enforces audio hysteresis dedup and resets cleanly when dust falls below hysteresis threshold', () => {
    const audioService = new RollingDustHazardAudioService(0);
    assert.equal(audioService.shouldTriggerForStateKey('2026-11-27|13|rec-1|live', 1000), true);
    assert.equal(audioService.shouldTriggerForStateKey('2026-11-27|13|rec-1|live', 2000), false);
    audioService.resetHysteresis();
    assert.equal(audioService.shouldTriggerForStateKey('2026-11-27|13|rec-1|live', 3000), true);
  });
});
