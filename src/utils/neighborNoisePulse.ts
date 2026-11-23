/**
 * @file src/utils/neighborNoisePulse.ts
 * @description Deterministisk beregning af hvilke naboblokke på 2D-kortet der skal
 * modtage visuel 'puls'-advarsel, når maskinstøjen overstiger 85 dB(A) under højvindsscenarier.
 */

import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
} from '../types/dispersion';

export const NEIGHBOR_PULSE_NOISE_THRESHOLD_DB = 85.0;
export const HIGH_WIND_SPEED_TRIGGER_MS = 10.0;
export const HIGH_WIND_GUST_TRIGGER_MS = 12.0;

export interface HighWindNeighborPulseTarget {
  receptor: ReceptorZone;
  estimatedLafmaxDb: number;
  dominantSourceCode: string;
  dominantSourceName: string;
  distanceMeters: number;
  windSpeedMs: number;
  windGustMs: number;
  pulseDurationSec: number;
  severity: 'extreme' | 'critical';
}

export interface ComputeHighWindNeighborPulseInput {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  currentWeather: HourlyWeatherPoint;
  machineNoiseOutputDb?: number;
}

export function isHighWindWeatherScenario(weather: HourlyWeatherPoint): boolean {
  return (
    (weather.windSpeed10m ?? 0) > HIGH_WIND_SPEED_TRIGGER_MS ||
    (weather.windGusts10m ?? 0) > HIGH_WIND_GUST_TRIGGER_MS
  );
}

/**
 * Evaluerer om maskinstøjen ved berørte naboblokke overstiger 85 dB(A) under højvind
 * (v_10m > 10 m/s eller vindstød > 12 m/s), og returnerer blokkene til visuel 2D-puls.
 */
export function computeHighWindNeighborNoisePulseTargets(
  input: ComputeHighWindNeighborPulseInput
): HighWindNeighborPulseTarget[] {
  const { sources, receptors, currentWeather, machineNoiseOutputDb = 114 } = input;

  if (!isHighWindWeatherScenario(currentWeather)) {
    return [];
  }

  const activeSources = sources.filter((s) => s.active);
  if (activeSources.length === 0) {
    return [];
  }

  // Hvis brugeren eller maskinkataloget sætter maskinstøj <= 85 dB L_WA, kan ingen receptor overskride 85 dB(A)
  if (machineNoiseOutputDb <= NEIGHBOR_PULSE_NOISE_THRESHOLD_DB) {
    return [];
  }

  const sensitiveReceptors = receptors.filter(
    (r) =>
      r.category === 'residential_block' ||
      r.category === 'custom_receptor' ||
      /skole|børnehave|daginst/i.test(r.name)
  );
  const candidateReceptors =
    sensitiveReceptors.length > 0 ? sensitiveReceptors : receptors;

  const windSpeedMs = currentWeather.windSpeed10m ?? 0;
  const windGustMs = Math.max(
    windSpeedMs,
    currentWeather.windGusts10m || windSpeedMs * 1.32
  );
  const downwindDeg = ((currentWeather.windDirection10m ?? 250) + 180) % 360;
  const gustBonusDb = Math.max(0, (windGustMs - 8.0) * 0.45);
  const effectiveBaseLwa = Math.max(85, machineNoiseOutputDb);

  const results: HighWindNeighborPulseTarget[] = [];

  for (const rec of candidateReceptors) {
    let bestLafmax = -Infinity;
    let bestSrc = activeSources[0];
    let bestDistM = 60;

    for (const src of activeSources) {
      const dLatM = (rec.center.lat - src.position.lat) * 111320;
      const dLngM = (rec.center.lng - src.position.lng) * 63180;
      const distM = Math.max(12, Math.hypot(dLatM, dLngM));
      if (distM > 260) continue;

      const bearingDeg = ((Math.atan2(dLngM, dLatM) * 180) / Math.PI + 360) % 360;
      const angleDiff = Math.abs(((bearingDeg - downwindDeg + 540) % 360) - 180);
      const downwindCos = Math.cos((angleDiff * Math.PI) / 180);

      // L_WA kilde + impuls-tillæg (hydraulisk nedbrydning ~14.5 dB) minus geometrisk spredning + vindrefraktion
      const srcLwa =
        typeof src.baseSoundPowerLwaDb === 'number'
          ? Math.max(effectiveBaseLwa, src.baseSoundPowerLwaDb)
          : effectiveBaseLwa;
      const aDivDb = 20 * Math.log10(distM) + 11.0;
      const windRefractionDb =
        downwindCos >= 0
          ? downwindCos * (3.2 + gustBonusDb)
          : downwindCos * 2.4;
      const impulseAllowanceDb = 14.5;
      const lafmaxDb = Number(
        (srcLwa - aDivDb + impulseAllowanceDb + windRefractionDb).toFixed(1)
      );

      if (lafmaxDb > bestLafmax) {
        bestLafmax = lafmaxDb;
        bestSrc = src;
        bestDistM = Math.round(distM);
      }
    }

    if (bestLafmax > NEIGHBOR_PULSE_NOISE_THRESHOLD_DB) {
      const excessDb = bestLafmax - NEIGHBOR_PULSE_NOISE_THRESHOLD_DB;
      const pulseDurationSec = Number(
        Math.max(0.75, 1.55 - Math.min(0.8, excessDb * 0.05)).toFixed(2)
      );
      results.push({
        receptor: rec,
        estimatedLafmaxDb: bestLafmax,
        dominantSourceCode: bestSrc.code,
        dominantSourceName: bestSrc.name,
        distanceMeters: bestDistM,
        windSpeedMs: Number(windSpeedMs.toFixed(1)),
        windGustMs: Number(windGustMs.toFixed(1)),
        pulseDurationSec,
        severity: bestLafmax >= 92 ? 'extreme' : 'critical',
      });
    }
  }

  return results.sort((a, b) => b.estimatedLafmaxDb - a.estimatedLafmaxDb);
}
