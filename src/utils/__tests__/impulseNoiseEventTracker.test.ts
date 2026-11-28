import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INITIAL_RECEPTOR_ZONES } from '../../data/ringparkenData';
import { HourlyWeatherPoint, ReceptorExposureResult } from '../../types/dispersion';
import {
  IMPULSE_85DB_MIN_DURATION_MS,
  IMPULSE_85DB_THRESHOLD_DB,
  createInitialImpulse85DbTrackerState,
  createSignedImpulse85DbEventAndObservation,
  evaluateImpulse85DbStep,
} from '../impulseNoiseEventTracker';

function makeWeather(): HourlyWeatherPoint {
  return {
    isoTime: '2026-04-15T12:00:00Z',
    hourIndex: 12,
    hourLabel: '12:00',
    temperature2m: 11.5,
    relativeHumidity2m: 60,
    precipitation: 0,
    cloudCover: 30,
    windSpeed10m: 11.4,
    windDirection10m: 245,
    windGusts10m: 15.6,
    soilMoisture0To7cm: 0.2,
    directRadiation: 350,
    weatherCode: 1,
    pasquillClass: 'D',
    hadRecentFreezeThaw: false,
  };
}

function makeReceptorExposure(): ReceptorExposureResult {
  const rec = INITIAL_RECEPTOR_ZONES[0];
  return {
    receptorId: rec.id,
    receptorName: rec.name,
    receptorCode: rec.code,
    address: rec.address,
    category: rec.category,
    position: rec.center,
    distanceFromNearestSourceMeters: 42,
    dominantSourceName: 'K1: Blok 1 Nedrivning',
    sumQuotient: 1.38,
    riskLevel: 'red',
    hydrologicalRunoffActive: false,
    substances: [],
  };
}

describe('impulseNoiseEventTracker (>85 dB(A) >5 min automatic log & SHA-256 evidence)', () => {
  it('resets timer below 85 dB(A) and triggers exactly once after >5 minutes sustained exceedance', () => {
    const receptorId = 'rec-1';
    let state = createInitialImpulse85DbTrackerState(receptorId);

    // Below threshold does not start timer
    const below = evaluateImpulse85DbStep(state, {
      receptorId,
      currentLafmaxDb: IMPULSE_85DB_THRESHOLD_DB,
      nowMs: 1_000,
      dateIso: '2026-04-15',
      hourIndex: 12,
    });
    assert.equal(below.isExceeding85, false);
    assert.equal(below.shouldAutoRecord, false);
    state = below.nextState;

    // Exceeding 85 dB starts timer at t=10_000
    const start = evaluateImpulse85DbStep(state, {
      receptorId,
      currentLafmaxDb: 87.4,
      nowMs: 10_000,
      dateIso: '2026-04-15',
      hourIndex: 12,
    });
    assert.equal(start.isExceeding85, true);
    assert.equal(start.elapsedMs, 0);
    assert.equal(start.shouldAutoRecord, false);
    state = start.nextState;

    // 4 minutes in -> still waiting
    const mid = evaluateImpulse85DbStep(state, {
      receptorId,
      currentLafmaxDb: 91.2,
      nowMs: 10_000 + 240_000,
      dateIso: '2026-04-15',
      hourIndex: 12,
    });
    assert.equal(mid.shouldAutoRecord, false);
    assert.equal(mid.nextState.peakLafmaxDb, 91.2);
    state = mid.nextState;

    // Past 5 minutes -> auto records once
    const trigger = evaluateImpulse85DbStep(state, {
      receptorId,
      currentLafmaxDb: 89.5,
      nowMs: 10_000 + IMPULSE_85DB_MIN_DURATION_MS + 1000,
      dateIso: '2026-04-15',
      hourIndex: 12,
    });
    assert.equal(trigger.shouldAutoRecord, true);
    assert.equal(trigger.nextState.peakLafmaxDb, 91.2);
    state = trigger.nextState;

    // Subsequent tick in same cycle does not duplicate
    const repeat = evaluateImpulse85DbStep(state, {
      receptorId,
      currentLafmaxDb: 90.0,
      nowMs: 10_000 + IMPULSE_85DB_MIN_DURATION_MS + 5000,
      dateIso: '2026-04-15',
      hourIndex: 12,
    });
    assert.equal(repeat.shouldAutoRecord, false);
  });

  it('creates a SHA-256 signed Impulse85DbNoiseEvent and linked AlgedonicObservation', async () => {
    const { event, observation } = await createSignedImpulse85DbEventAndObservation({
      eventNumber: 1,
      dateIso: '2026-04-15',
      weather: makeWeather(),
      receptorExposure: makeReceptorExposure(),
      receptorAddress: 'Ringparken 14, 4200 Slagelse',
      laeqDb: 82.4,
      peakLafmaxDb: 91.6,
      durationSeconds: 318,
      dominantSourceName: 'K1: Blok 1 Nedrivning',
      distanceMeters: 42,
    });

    assert.equal(event.eventCode, 'NOISE-85DB-01');
    assert.equal(event.linkedToEvidenceLog, true);
    assert.match(event.sha256Signature, /^[a-f0-9]{64}$/i);
    assert.equal(observation.code, 'NOISE-85DB-01');
    assert.equal(observation.sha256Signature, event.sha256Signature);
    assert.ok(observation.description.includes('91.6 dB(A)'));
  });
});
