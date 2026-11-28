import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectHighFrequencyNoiseSpikes } from '../highFrequencyNoiseSpikeDetector';
import { INITIAL_DEMOLITION_SOURCES } from '../../data/ringparkenData';
import { HourlyWeatherPoint } from '../../types/dispersion';

function makeWeatherHour(windGusts10m = 13.5): HourlyWeatherPoint {
  return {
    isoTime: '2026-11-27T13:00:00Z',
    hourIndex: 13,
    hourLabel: '13:00',
    temperature2m: 9.8,
    relativeHumidity2m: 72,
    precipitation: 0,
    cloudCover: 45,
    windSpeed10m: 9.2,
    windDirection10m: 245,
    windGusts10m,
    soilMoisture0To7cm: 0.22,
    directRadiation: 240,
    weatherCode: 2,
    pasquillClass: 'D',
    hadRecentFreezeThaw: false,
  };
}

describe('High-Frequency Noise Spike Detector (>95 dB transient machinery operations)', () => {
  it('detects >95 dB(A) transient spikes with high-frequency spectral peaks during hydraulic hammer & steel shear operations', () => {
    const res = detectHighFrequencyNoiseSpikes({
      sources: INITIAL_DEMOLITION_SOURCES,
      currentWeather: makeWeatherHour(14.2),
      manualMachineNoiseOutputDb: 118.0,
      isManualMachineNoiseOverrideActive: true,
      operationMode: 'hydraulic_hammer_burst',
      bandFilter: 'high_freq_1khz_plus',
      distanceMeters: 15,
    });

    assert.equal(res.thresholdDb, 95.0);
    assert.equal(res.totalSamples, 120);
    assert.ok(res.spikeCount >= 5, `Expected multiple >95 dB transient spikes, got ${res.spikeCount}`);
    assert.ok(res.maxTransientPeakDb > 95.0);
    assert.ok(res.maxExcessAbove95Db > 0);
    assert.ok(res.dominantSpikeFreqHz >= 1000, `Expected >=1000 Hz spike frequency, got ${res.dominantSpikeFreqHz}`);
    assert.equal(res.octaveBandSpectrum.length, 8);
    assert.ok(res.detectedSpikes.every((sp) => sp.peakDb > 95.0 && sp.dominantFreqHz >= 1000));
  });

  it('reports zero >95 dB spikes during low-transient indoor sanitation operations', () => {
    const res = detectHighFrequencyNoiseSpikes({
      sources: INITIAL_DEMOLITION_SOURCES,
      currentWeather: makeWeatherHour(5.0),
      manualMachineNoiseOutputDb: 96.0,
      isManualMachineNoiseOverrideActive: true,
      operationMode: 'indoor_sanitation_low',
      distanceMeters: 18,
    });

    assert.equal(res.spikeCount, 0);
    assert.equal(res.detectedSpikes.length, 0);
    assert.ok(res.maxTransientPeakDb <= 95.0);
  });
});
