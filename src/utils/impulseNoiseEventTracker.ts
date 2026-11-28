/**
 * @file src/utils/impulseNoiseEventTracker.ts
 * @description Automatisk detektion af vedvarende impulsstøj > 85 dB(A) i over 5 minutter (>300 s)
 * til direkte logning i Støj-Hændelsesloggen og kryptografisk SHA-256 bevisførelse.
 */

import {
  AlgedonicObservation,
  HourlyWeatherPoint,
  PlumeCorroborationResult,
  ReceptorExposureResult,
  ReporterRole,
} from '../types/dispersion';
import { computeForensicSha256Hash } from '../services/dispersionEngine';

export const IMPULSE_85DB_THRESHOLD_DB = 85.0;
export const IMPULSE_85DB_MIN_DURATION_MS = 5 * 60 * 1000; // 5 minutter = 300.000 ms

export interface Impulse85DbTrackerState {
  receptorId: string;
  startedAtMs: number | null;
  peakLafmaxDb: number;
  lastSampleAtMs: number | null;
  recordedCycleKeys: string[];
}

export interface Impulse85DbNoiseEvent {
  id: string;
  eventCode: string;
  loggedAtIso: string;
  dateIso: string;
  hourIndex: number;
  hourLabel: string;
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  receptorAddress: string;
  peakLafmaxDb: number;
  laeqDb: number;
  durationSeconds: number;
  dominantSourceName: string;
  distanceMeters: number;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
  sumQuotient: number;
  sha256Signature: string;
  linkedToEvidenceLog: boolean;
}

export function createInitialImpulse85DbTrackerState(
  receptorId: string
): Impulse85DbTrackerState {
  return {
    receptorId,
    startedAtMs: null,
    peakLafmaxDb: 0,
    lastSampleAtMs: null,
    recordedCycleKeys: [],
  };
}

export function evaluateImpulse85DbStep(
  prev: Impulse85DbTrackerState,
  input: {
    receptorId: string;
    currentLafmaxDb: number;
    nowMs: number;
    dateIso: string;
    hourIndex: number;
    thresholdDb?: number;
    requiredDurationMs?: number;
  }
): {
  nextState: Impulse85DbTrackerState;
  elapsedMs: number;
  remainingMs: number;
  isExceeding85: boolean;
  shouldAutoRecord: boolean;
  cycleKey: string | null;
} {
  const threshold = input.thresholdDb ?? IMPULSE_85DB_THRESHOLD_DB;
  const requiredMs = input.requiredDurationMs ?? IMPULSE_85DB_MIN_DURATION_MS;
  const isExceeding85 = input.currentLafmaxDb > threshold;

  const baseState: Impulse85DbTrackerState =
    prev.receptorId === input.receptorId
      ? prev
      : createInitialImpulse85DbTrackerState(input.receptorId);

  if (!isExceeding85) {
    return {
      nextState: {
        ...baseState,
        startedAtMs: null,
        peakLafmaxDb: 0,
        lastSampleAtMs: input.nowMs,
      },
      elapsedMs: 0,
      remainingMs: requiredMs,
      isExceeding85: false,
      shouldAutoRecord: false,
      cycleKey: null,
    };
  }

  const startedAtMs = baseState.startedAtMs ?? input.nowMs;
  const elapsedMs = Math.max(0, input.nowMs - startedAtMs);
  const remainingMs = Math.max(0, requiredMs - elapsedMs);
  const peakLafmaxDb = Number(
    Math.max(baseState.peakLafmaxDb, input.currentLafmaxDb).toFixed(1)
  );
  const cycleKey = `${input.dateIso}-h${input.hourIndex}-${input.receptorId}-${startedAtMs}`;
  const alreadyRecorded = baseState.recordedCycleKeys.includes(cycleKey);
  const shouldAutoRecord = elapsedMs >= requiredMs && !alreadyRecorded;

  return {
    nextState: {
      receptorId: input.receptorId,
      startedAtMs,
      peakLafmaxDb,
      lastSampleAtMs: input.nowMs,
      recordedCycleKeys: shouldAutoRecord
        ? [...baseState.recordedCycleKeys, cycleKey]
        : baseState.recordedCycleKeys,
    },
    elapsedMs,
    remainingMs,
    isExceeding85: true,
    shouldAutoRecord,
    cycleKey,
  };
}

export async function createSignedImpulse85DbEventAndObservation(params: {
  eventNumber: number;
  dateIso: string;
  weather: HourlyWeatherPoint;
  receptorExposure: ReceptorExposureResult;
  receptorAddress: string;
  laeqDb: number;
  peakLafmaxDb: number;
  durationSeconds: number;
  dominantSourceName: string;
  distanceMeters: number;
  corroboration?: PlumeCorroborationResult;
  reporterRole?: ReporterRole;
}): Promise<{
  event: Impulse85DbNoiseEvent;
  observation: AlgedonicObservation;
}> {
  const loggedAtIso = new Date().toISOString();
  const code = `NOISE-85DB-${String(params.eventNumber).padStart(2, '0')}`;
  const durationMinutes = (params.durationSeconds / 60).toFixed(1);

  const canonicalPayload = {
    code,
    dateIso: params.dateIso,
    hourIndex: params.weather.hourIndex,
    hourLabel: params.weather.hourLabel,
    receptorId: params.receptorExposure.receptorId,
    receptorCode: params.receptorExposure.receptorCode,
    peakLafmaxDb: params.peakLafmaxDb,
    laeqDb: params.laeqDb,
    durationSeconds: params.durationSeconds,
    dominantSourceName: params.dominantSourceName,
    distanceMeters: params.distanceMeters,
    windSpeed10m: params.weather.windSpeed10m,
    windGusts10m: params.weather.windGusts10m,
    windDirection10m: params.weather.windDirection10m,
    sumQuotient: params.receptorExposure.sumQuotient,
    loggedAtIso,
  };

  const sha256Signature = await computeForensicSha256Hash(canonicalPayload);

  const event: Impulse85DbNoiseEvent = {
    id: `imp85-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
    eventCode: code,
    loggedAtIso,
    dateIso: params.dateIso,
    hourIndex: params.weather.hourIndex,
    hourLabel: params.weather.hourLabel,
    receptorId: params.receptorExposure.receptorId,
    receptorCode: params.receptorExposure.receptorCode,
    receptorName: params.receptorExposure.receptorName,
    receptorAddress: params.receptorAddress,
    peakLafmaxDb: params.peakLafmaxDb,
    laeqDb: params.laeqDb,
    durationSeconds: params.durationSeconds,
    dominantSourceName: params.dominantSourceName,
    distanceMeters: params.distanceMeters,
    windSpeedMs: params.weather.windSpeed10m,
    windGustsMs: params.weather.windGusts10m,
    windDirectionDeg: params.weather.windDirection10m,
    sumQuotient: params.receptorExposure.sumQuotient,
    sha256Signature,
    linkedToEvidenceLog: true,
  };

  const defaultCorroboration: PlumeCorroborationResult = params.corroboration ?? {
    isInsideMathematicalPlume: params.receptorExposure.sumQuotient >= 0.5,
    matchedZoneLevel:
      params.receptorExposure.riskLevel === 'safe'
        ? 'outside'
        : params.receptorExposure.riskLevel,
    zoneLabel: `${params.receptorExposure.receptorCode} Akustisk & Partikulær Zone`,
    calculatedSumQuotient: params.receptorExposure.sumQuotient,
    nearestSourceId: 'auto-noise-source',
    nearestSourceName: params.dominantSourceName,
    distanceFromSourceMeters: params.distanceMeters,
    bearingFromSourceDeg: (params.weather.windDirection10m + 180) % 360,
    plumeDirectionDeg: (params.weather.windDirection10m + 180) % 360,
    angularDeviationDeg: 0,
    corroborationSummary: `Automatisk detekteret impulsstøj-overskridelse (${params.peakLafmaxDb.toFixed(
      1
    )} dB(A) > 85,0 dB(A) i ${durationMinutes} min.) ved ${params.receptorExposure.receptorName}.`,
    violatedRegulations: [
      'Miljøstyrelsens Vejl. nr. 5/1984 (Støjgrænser & +5 dB impulstillæg)',
      'Arbejdstilsynets Bekendtgørelse om støj (85 dB(A) grænseværdi)',
      'Miljøbeskyttelsesloven § 42 (Påbud om afværgeforanstaltninger)',
    ],
  };

  const observation: AlgedonicObservation = {
    id: `obs-noise85-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
    code,
    createdAtIso: loggedAtIso,
    observedDateIso: params.dateIso,
    observedHourIndex: params.weather.hourIndex,
    observedHourLabel: params.weather.hourLabel,
    observedTimestampIso: params.weather.isoTime,
    position: params.receptorExposure.position,
    locationLabel: `${params.receptorExposure.receptorCode} · ${params.receptorExposure.receptorName}`,
    reporterRole: params.reporterRole ?? 'Arbejdsmiljørepræsentant (AMR)',
    reporterIdentifier: 'Automatisk Støj-Hændelseslog (>85 dB(A) >5 min)',
    observationType: `Automatisk Støj-Hændelse (>85 dB(A) i ${durationMinutes} min.)`,
    description: `[AUTO STØJ-HÆNDELSESLOG · >85 dB(A) >5 MIN] Vedvarende maskin-impulsstøj målt til spids L_AFmax=${params.peakLafmaxDb.toFixed(
      1
    )} dB(A) (L_Aeq=${params.laeqDb.toFixed(1)} dB(A)) i ${durationMinutes} minutter (${
      params.durationSeconds
    } sek.) ved ${params.receptorExposure.receptorName} (${params.receptorAddress}). Dominerende kilde: ${
      params.dominantSourceName
    } (${params.distanceMeters} m). Vind: ${params.weather.windSpeed10m.toFixed(
      1
    )} m/s (stød ${params.weather.windGusts10m.toFixed(1)} m/s fra ${
      params.weather.windDirection10m
    }°). SHA-256: ${sha256Signature}.`,
    weatherSnapshot: params.weather,
    plumeCorroboration: defaultCorroboration,
    sha256Signature,
  };

  return { event, observation };
}
