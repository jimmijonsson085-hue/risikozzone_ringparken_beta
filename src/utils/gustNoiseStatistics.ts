/**
 * @file src/utils/gustNoiseStatistics.ts
 * @description Deterministisk statistisk korrelationsmotor mellem vindstød (gusts)
 * og maskinstøj (impulsstøj L_AFmax) til hurtig identifikation af støj-farlige vejrscenarier.
 */

import { HourlyWeatherPoint } from '../types/dispersion';

export interface GustImpulseDataPoint {
  hourIndex: number;
  hourLabel: string;
  windSpeedMs: number;
  windGustMs: number;
  windDirectionDeg: number;
  impulseLafmaxDb: number;
  laeqDb: number;
  gustRefractionPenaltyDb: number;
  excessAboveThresholdDb: number;
  hazardLevel: 'KRITISK' | 'HØJ RISIKO' | 'MODERAT' | 'NORMAL';
  isHazardousScenario: boolean;
  scenarioDescriptionDa: string;
}

export interface GustNoiseStatisticalSummary {
  sampleCount: number;
  pearsonR: number;
  rSquared: number;
  slopeDbPerMs: number;
  interceptDb: number;
  tStatistic: number;
  significanceLabelDa: string;
  meanGustMs: number;
  maxGustMs: number;
  meanImpulseDb: number;
  maxImpulseDb: number;
  hazardousScenarioCount: number;
  criticalScenarioCount: number;
  points: GustImpulseDataPoint[];
  hazardousScenariosSorted: GustImpulseDataPoint[];
}

export interface ComputeGustMachineImpulseStatsParams {
  weatherHours: HourlyWeatherPoint[];
  machineLwaDb: number;
  impulsePenaltyDb: number;
  gustHazardThresholdMs?: number;
  impulseHazardThresholdDb?: number;
  distanceMeters?: number;
}

/**
 * Beregner Pearson r, R², lineær regressionshældning (dB pr. m/s vindstød),
 * t-statistik samt klassificering af støj-farlige vejrscenarier på tværs af døgnet.
 */
export function computeGustMachineImpulseStatistics(
  params: ComputeGustMachineImpulseStatsParams
): GustNoiseStatisticalSummary {
  const {
    weatherHours,
    machineLwaDb,
    impulsePenaltyDb,
    gustHazardThresholdMs = 12.0,
    impulseHazardThresholdDb = 80.0,
    distanceMeters = 45,
  } = params;

  const hours = weatherHours.slice(0, 24);
  if (hours.length === 0) {
    return {
      sampleCount: 0,
      pearsonR: 0,
      rSquared: 0,
      slopeDbPerMs: 0,
      interceptDb: 0,
      tStatistic: 0,
      significanceLabelDa: 'Utilstrækkelige data',
      meanGustMs: 0,
      maxGustMs: 0,
      meanImpulseDb: 0,
      maxImpulseDb: 0,
      hazardousScenarioCount: 0,
      criticalScenarioCount: 0,
      points: [],
      hazardousScenariosSorted: [],
    };
  }

  const aDivDb = 20 * Math.log10(Math.max(15, distanceMeters)) + 11.0;
  const aAtmGroundDb = Math.min(5.0, 1.2 + distanceMeters * 0.012);

  const rawPoints: GustImpulseDataPoint[] = hours.map((hr, idx) => {
    const hourIndex = hr.hourIndex ?? idx;
    const hourLabel = hr.hourLabel || `${String(hourIndex).padStart(2, '0')}:00`;
    const windSpeedMs = Number((hr.windSpeed10m ?? 0).toFixed(1));
    const windGustMs = Number(
      Math.max(windSpeedMs, hr.windGusts10m || windSpeedMs * 1.32).toFixed(1)
    );

    const isWorkWindow = hourIndex >= 7 && hourIndex < 18;
    const isEvening = hourIndex >= 18 && hourIndex < 22;

    // Vindstøds-induceret refraktion og barriere-forringelse under impulsstøj
    const gustSpreadMs = Math.max(0, windGustMs - windSpeedMs);
    const gustRefractionPenaltyDb = Number(
      Math.min(
        8.8,
        Math.max(0, (windGustMs - 6.5) * 0.56 + gustSpreadMs * 0.28 + Math.max(0, windSpeedMs - 10) * 0.45)
      ).toFixed(1)
    );

    const scheduleAttenuationDb = isWorkWindow ? 0 : isEvening ? -11.5 : -16.0;
    const laeqDb = Number(
      Math.max(
        38,
        machineLwaDb - aDivDb - aAtmGroundDb + scheduleAttenuationDb + gustRefractionPenaltyDb * 0.72
      ).toFixed(1)
    );
    const impulseLafmaxDb = Number(
      Math.max(
        43,
        laeqDb + impulsePenaltyDb * 0.52 + gustRefractionPenaltyDb * 0.48
      ).toFixed(1)
    );

    const excessAboveThresholdDb = Number(
      (impulseLafmaxDb - impulseHazardThresholdDb).toFixed(1)
    );
    const isHighGust = windGustMs >= gustHazardThresholdMs;
    const isHighNoise = impulseLafmaxDb >= impulseHazardThresholdDb;

    let hazardLevel: GustImpulseDataPoint['hazardLevel'] = 'NORMAL';
    if (isHighGust && isHighNoise) {
      hazardLevel = 'KRITISK';
    } else if (
      (isHighGust && impulseLafmaxDb >= impulseHazardThresholdDb - 4) ||
      (isHighNoise && windGustMs >= gustHazardThresholdMs - 2)
    ) {
      hazardLevel = 'HØJ RISIKO';
    } else if (isHighGust || isHighNoise) {
      hazardLevel = 'MODERAT';
    }

    const isHazardousScenario =
      hazardLevel === 'KRITISK' || hazardLevel === 'HØJ RISIKO';

    const scenarioDescriptionDa =
      hazardLevel === 'KRITISK'
        ? `Vindstød ${windGustMs.toFixed(1)} m/s (>= ${gustHazardThresholdMs.toFixed(
            1
          )}) + impuls ${impulseLafmaxDb.toFixed(1)} dB(A)`
        : hazardLevel === 'HØJ RISIKO'
        ? `Skærpet støj-vind kobling (${windGustMs.toFixed(1)} m/s · ${impulseLafmaxDb.toFixed(
            1
          )} dB(A))`
        : hazardLevel === 'MODERAT'
        ? `Enkelt-tærskel nærmer sig (${windGustMs.toFixed(1)} m/s · ${impulseLafmaxDb.toFixed(
            1
          )} dB(A))`
        : `Normal spredning (${windGustMs.toFixed(1)} m/s · ${impulseLafmaxDb.toFixed(1)} dB(A))`;

    return {
      hourIndex,
      hourLabel,
      windSpeedMs,
      windGustMs,
      windDirectionDeg: Math.round(hr.windDirection10m ?? 240),
      impulseLafmaxDb,
      laeqDb,
      gustRefractionPenaltyDb,
      excessAboveThresholdDb,
      hazardLevel,
      isHazardousScenario,
      scenarioDescriptionDa,
    };
  });

  const n = rawPoints.length;
  const xs = rawPoints.map((p) => p.windGustMs);
  const ys = rawPoints.map((p) => p.impulseLafmaxDb);

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sumXY += dx * dy;
    sumXX += dx * dx;
    sumYY += dy * dy;
  }

  const denom = Math.sqrt(sumXX * sumYY);
  const pearsonR =
    denom > 1e-9 ? Number(Math.max(-1, Math.min(1, sumXY / denom)).toFixed(3)) : 0;
  const rSquared = Number((pearsonR * pearsonR).toFixed(3));
  const slopeDbPerMs = sumXX > 1e-9 ? Number((sumXY / sumXX).toFixed(2)) : 0;
  const interceptDb = Number((meanY - slopeDbPerMs * meanX).toFixed(1));

  const tStatistic =
    n > 2 && Math.abs(pearsonR) < 0.9999
      ? Number(
          (
            (pearsonR * Math.sqrt(n - 2)) /
            Math.sqrt(Math.max(1e-9, 1 - pearsonR * pearsonR))
          ).toFixed(2)
        )
      : pearsonR === 0
      ? 0
      : 99.9;

  const absT = Math.abs(tStatistic);
  const significanceLabelDa =
    absT >= 2.82 && pearsonR > 0
      ? 'Meget stærk positiv sammenhæng (p < 0,01)'
      : absT >= 2.07 && pearsonR > 0
      ? 'Statistisk signifikant (p < 0,05)'
      : Math.abs(pearsonR) >= 0.35
      ? 'Moderat vindstøds-påvirkning'
      : 'Svag lineær sammenhæng';

  const hazardousScenariosSorted = [...rawPoints]
    .filter((p) => p.isHazardousScenario)
    .sort(
      (a, b) =>
        b.impulseLafmaxDb + b.windGustMs * 1.4 - (a.impulseLafmaxDb + a.windGustMs * 1.4)
    );

  return {
    sampleCount: n,
    pearsonR,
    rSquared,
    slopeDbPerMs,
    interceptDb,
    tStatistic,
    significanceLabelDa,
    meanGustMs: Number(meanX.toFixed(1)),
    maxGustMs: Number(Math.max(...xs).toFixed(1)),
    meanImpulseDb: Number(meanY.toFixed(1)),
    maxImpulseDb: Number(Math.max(...ys).toFixed(1)),
    hazardousScenarioCount: hazardousScenariosSorted.length,
    criticalScenarioCount: rawPoints.filter((p) => p.hazardLevel === 'KRITISK').length,
    points: rawPoints,
    hazardousScenariosSorted,
  };
}
