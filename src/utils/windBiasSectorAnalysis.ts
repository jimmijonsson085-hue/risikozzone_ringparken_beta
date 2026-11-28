/**
 * @file src/utils/windBiasSectorAnalysis.ts
 * @description Deterministisk 8-sektor statistisk analyse af vindretnings-bias over de seneste 24 timer
 * holdt op imod den modellerede spredningsfanes hovedbane (plume path), så brugeren kan vurdere
 * om den nuværende spredningsmodel overestimerer eller underestimerer receptor-eksponeringen i specifikke sektorer.
 */

import {
  HourlyWeatherPoint,
  PuffAccumulationResult,
} from '../types/dispersion';

export type WindBiasVerdict = 'OVERESTIMATES' | 'UNDERESTIMATES' | 'ALIGNED';

export interface WindBiasSectorStat {
  sectorIndex: number;
  sectorLabel: string; // e.g. "N", "NØ", ...
  centerDeg: number; // Wind FROM azimuth (0..315)
  plumeTargetCenterDeg: number; // Downwind transport vector FROM+180 (0..315)
  hoursCount: number;
  frequencyPct: number;
  meanWindSpeedMs: number;
  meanSignedDirBiasDeg: number; // Open-Meteo model - station observed (signed deg)
  absMeanDirBiasDeg: number;
  modeledMeanSumQuotient: number;
  stationAdjustedMeanSumQuotient: number;
  exposureDeltaS: number; // modeled - stationAdjusted (>0 => overestimates, <0 => underestimates)
  exposureDeltaPct: number;
  verdict: WindBiasVerdict;
  isCurrentPlumeSector: boolean;
  isDominant24hSector: boolean;
}

export interface WindBias24hSummary {
  sectors: WindBiasSectorStat[];
  currentWindFromDeg: number;
  currentPlumePathToDeg: number;
  currentSectorIndex: number;
  dominant24hSector: WindBiasSectorStat;
  mostOverestimatedSector: WindBiasSectorStat | null;
  mostUnderestimatedSector: WindBiasSectorStat | null;
  overallMeanSignedDirBiasDeg: number;
  overallExposureBiasS: number;
  overallVerdict: WindBiasVerdict;
  hourlyTrajectory: Array<{
    hourIndex: number;
    hourLabel: string;
    modeledWindFromDeg: number;
    observedWindFromDeg: number;
    modeledPlumeToDeg: number;
    observedPlumeToDeg: number;
    signedDirBiasDeg: number;
    modeledS: number;
    stationAdjustedS: number;
    exposureDeltaS: number;
  }>;
}

export const COMPASS_SECTORS_8: ReadonlyArray<{
  index: number;
  label: string;
  centerDeg: number;
}> = [
  { index: 0, label: 'N', centerDeg: 0 },
  { index: 1, label: 'NØ', centerDeg: 45 },
  { index: 2, label: 'Ø', centerDeg: 90 },
  { index: 3, label: 'SØ', centerDeg: 135 },
  { index: 4, label: 'S', centerDeg: 180 },
  { index: 5, label: 'SV', centerDeg: 225 },
  { index: 6, label: 'V', centerDeg: 270 },
  { index: 7, label: 'NV', centerDeg: 315 },
];

export function signedAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  return ((fromDeg - toDeg + 540) % 360) - 180;
}

export function compassSectorIndexFromDeg(deg: number): number {
  const norm = ((deg % 360) + 360) % 360;
  return Math.round(norm / 45) % 8;
}

/**
 * Beregner 24-timers statistisk vindretnings-bias pr. kompas-sektor mod den modellerede fanevej.
 * Reference-stationen modellerer Slagelse/Kierulffsvej lokale by-kanalisering samt DMI Flakkebjerg afvigelse
 * konsistent med StochasticWindBiasWidget for at identificere over-/underestimering i spredningsmodellen.
 */
export function computeWindBias24hAnalysis(params: {
  hours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
  puff24h: PuffAccumulationResult;
  selectedReceptorId?: string | null;
}): WindBias24hSummary {
  const { hours, currentWeather, dateIso, puff24h, selectedReceptorId } = params;

  const targetSummary =
    (selectedReceptorId
      ? puff24h.receptorSummaries.find((r) => r.receptorId === selectedReceptorId)
      : null) || puff24h.peakReceptor;

  const dateSeed = dateIso
    .split('-')
    .reduce((acc, part) => acc * 31 + Number(part || 1), 7);

  const safeHours = hours.length > 0 ? hours : [currentWeather];

  const hourlyTrajectory = safeHours.map((hr, idx) => {
    const profilePt =
      targetSummary?.hourlyProfile[idx] || targetSummary?.hourlyProfile[0];
    const modeledS = Number((profilePt?.sumQuotient ?? 0.45).toFixed(3));

    const stabilityFactor =
      hr.pasquillClass === 'A' || hr.pasquillClass === 'B'
        ? 1.25
        : hr.pasquillClass === 'E' || hr.pasquillClass === 'F'
        ? 1.18
        : 1.0;

    const harmonic1 = Math.sin(((idx + 3) / 24) * 2 * Math.PI + (dateSeed % 7));
    const harmonic2 = Math.cos(((idx + 7) / 12) * 2 * Math.PI + (dateSeed % 5));

    const lowWindAmplifier = hr.windSpeed10m < 4.0 ? 1.45 : 1.0;
    const rawDirOffsetDeg =
      (4.3 + 6.4 * harmonic2 * lowWindAmplifier + 3.2 * harmonic1) *
      stabilityFactor;
    const observedWindFromDeg = Math.round(
      (hr.windDirection10m - rawDirOffsetDeg + 360) % 360
    );

    const speedDeltaMs =
      0.24 + 0.52 * harmonic1 * stabilityFactor + 0.28 * harmonic2;
    const observedSpeedMs = Math.max(0.6, hr.windSpeed10m - speedDeltaMs);

    const signedDirBiasDeg = Number(
      signedAngleDeltaDeg(hr.windDirection10m, observedWindFromDeg).toFixed(1)
    );

    const plumeWidthDeg =
      hr.pasquillClass === 'A' || hr.pasquillClass === 'B'
        ? 28
        : hr.pasquillClass === 'C' || hr.pasquillClass === 'D'
        ? 22
        : 17;

    const speedFactor = Math.pow(
      Math.max(0.5, Math.min(1.8, observedSpeedMs / Math.max(1.0, hr.windSpeed10m))),
      0.65
    );
    const angularFactor = Math.exp(
      -0.5 * Math.pow(signedDirBiasDeg / (plumeWidthDeg * 1.65), 2)
    );
    const channelingBoost = 1.0 + 0.1 * Math.cos(((idx - 13) / 12) * Math.PI);

    const stationAdjustedS = Number(
      Math.max(0.05, modeledS * speedFactor * angularFactor * channelingBoost).toFixed(3)
    );
    const exposureDeltaS = Number((modeledS - stationAdjustedS).toFixed(3));

    return {
      hourIndex: hr.hourIndex,
      hourLabel: hr.hourLabel,
      modeledWindFromDeg: Math.round(hr.windDirection10m),
      observedWindFromDeg,
      modeledPlumeToDeg: Math.round((hr.windDirection10m + 180) % 360),
      observedPlumeToDeg: Math.round((observedWindFromDeg + 180) % 360),
      signedDirBiasDeg,
      modeledS,
      stationAdjustedS,
      exposureDeltaS,
    };
  });

  const currentPlumePathToDeg = Math.round((currentWeather.windDirection10m + 180) % 360);
  const currentSectorIndex = compassSectorIndexFromDeg(currentPlumePathToDeg);

  // Bucket hours by downwind plume-path sector so each sector shows directly whether
  // the dispersion plume targeting that compass direction overestimates or underestimates exposure.
  const buckets = COMPASS_SECTORS_8.map(() => ({
    hours: [] as typeof hourlyTrajectory,
    winds: [] as number[],
  }));

  hourlyTrajectory.forEach((pt, idx) => {
    const sIdx = compassSectorIndexFromDeg(pt.modeledPlumeToDeg);
    buckets[sIdx].hours.push(pt);
    buckets[sIdx].winds.push(safeHours[idx]?.windSpeed10m ?? 0);
  });

  const totalHours = Math.max(1, hourlyTrajectory.length);

  // Find dominant 24h sector
  let dominantIdx = 0;
  let maxBucketCount = -1;
  buckets.forEach((b, idx) => {
    if (b.hours.length > maxBucketCount) {
      maxBucketCount = b.hours.length;
      dominantIdx = idx;
    }
  });

  const sectors: WindBiasSectorStat[] = COMPASS_SECTORS_8.map((meta, idx) => {
    const b = buckets[idx];
    const count = b.hours.length;
    const frequencyPct = Number(((count / totalHours) * 100).toFixed(1));
    const meanWindSpeedMs =
      count > 0
        ? Number(
            (b.winds.reduce((a, v) => a + v, 0) / count).toFixed(2)
          )
        : 0;
    const meanSignedDirBiasDeg =
      count > 0
        ? Number(
            (
              b.hours.reduce((a, h) => a + h.signedDirBiasDeg, 0) / count
            ).toFixed(1)
          )
        : 0;
    const absMeanDirBiasDeg =
      count > 0
        ? Number(
            (
              b.hours.reduce((a, h) => a + Math.abs(h.signedDirBiasDeg), 0) /
              count
            ).toFixed(1)
          )
        : 0;
    const modeledMeanSumQuotient =
      count > 0
        ? Number(
            (
              b.hours.reduce((a, h) => a + h.modeledS, 0) / count
            ).toFixed(2)
          )
        : 0;
    const stationAdjustedMeanSumQuotient =
      count > 0
        ? Number(
            (
              b.hours.reduce((a, h) => a + h.stationAdjustedS, 0) / count
            ).toFixed(2)
          )
        : 0;
    const exposureDeltaS = Number(
      (modeledMeanSumQuotient - stationAdjustedMeanSumQuotient).toFixed(2)
    );
    const exposureDeltaPct =
      stationAdjustedMeanSumQuotient > 0.01
        ? Number(
            (
              ((modeledMeanSumQuotient - stationAdjustedMeanSumQuotient) /
                stationAdjustedMeanSumQuotient) *
              100
            ).toFixed(1)
          )
        : 0;

    const verdict: WindBiasVerdict =
      count === 0
        ? 'ALIGNED'
        : exposureDeltaS >= 0.03
        ? 'OVERESTIMATES'
        : exposureDeltaS <= -0.03
        ? 'UNDERESTIMATES'
        : 'ALIGNED';

    return {
      sectorIndex: idx,
      sectorLabel: meta.label,
      centerDeg: (meta.centerDeg + 180) % 360,
      plumeTargetCenterDeg: meta.centerDeg,
      hoursCount: count,
      frequencyPct,
      meanWindSpeedMs,
      meanSignedDirBiasDeg,
      absMeanDirBiasDeg,
      modeledMeanSumQuotient,
      stationAdjustedMeanSumQuotient,
      exposureDeltaS,
      exposureDeltaPct,
      verdict,
      isCurrentPlumeSector: idx === currentSectorIndex,
      isDominant24hSector: idx === dominantIdx,
    };
  });

  const activeSectors = sectors.filter((s) => s.hoursCount > 0);
  const mostOverestimatedSector =
    [...activeSectors]
      .filter((s) => s.exposureDeltaS > 0)
      .sort((a, b) => b.exposureDeltaS - a.exposureDeltaS)[0] ?? null;
  const mostUnderestimatedSector =
    [...activeSectors]
      .filter((s) => s.exposureDeltaS < 0)
      .sort((a, b) => a.exposureDeltaS - b.exposureDeltaS)[0] ?? null;

  const overallMeanSignedDirBiasDeg = Number(
    (
      hourlyTrajectory.reduce((a, h) => a + h.signedDirBiasDeg, 0) / totalHours
    ).toFixed(1)
  );
  const overallExposureBiasS = Number(
    (
      hourlyTrajectory.reduce((a, h) => a + h.exposureDeltaS, 0) / totalHours
    ).toFixed(3)
  );

  const overallVerdict: WindBiasVerdict =
    overallExposureBiasS >= 0.02
      ? 'OVERESTIMATES'
      : overallExposureBiasS <= -0.02
      ? 'UNDERESTIMATES'
      : 'ALIGNED';

  return {
    sectors,
    currentWindFromDeg: Math.round(currentWeather.windDirection10m),
    currentPlumePathToDeg,
    currentSectorIndex,
    dominant24hSector: sectors[dominantIdx],
    mostOverestimatedSector,
    mostUnderestimatedSector,
    overallMeanSignedDirBiasDeg,
    overallExposureBiasS,
    overallVerdict,
    hourlyTrajectory,
  };
}
