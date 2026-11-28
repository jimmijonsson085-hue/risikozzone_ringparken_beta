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

export type OperationalRiskTier = 'STOP_WORK' | 'HIGH_RISK' | 'CAUTION' | 'SAFE';

export interface HighWindGustEventPoint {
  hourIndex: number;
  hourLabel: string;
  windSpeedMs: number;
  windGustMs: number;
  windDirectionDeg: number;
  pasquillClass: string;
  isHighWindGustEvent: boolean; // windGustMs > 10.0 m/s
  gustSeverityTier: 'EXTREME_GUST' | 'HIGH_GUST' | 'MODERATE_WIND';
  machineLwaDb: number;
  peakImpulseLafmaxDb: number;
  baselineCalmImpulseDb: number;
  gustAmplificationDb: number;
  laeqDb: number;
  isWorkWindow: boolean;
  exceeds85DbLimit: boolean;
  operationalRiskLevel: OperationalRiskTier;
  scenarioLabelDa: string;
}

export interface OperationalScenarioEvaluation {
  modeId: string;
  shortLabel: string;
  label: string;
  lwaDb: number;
  impulsePenaltyDb: number;
  peakImpulseDuringHighGustDb: number;
  meanImpulseDuringHighGustDb: number;
  meanImpulseCalmDb: number;
  gustDeltaDb: number;
  highGustExceedanceHours: number;
  worstHourIndex: number;
  worstHourLabel: string;
  worstGustMs: number;
  riskTier: OperationalRiskTier;
  mitigationRecommendationDa: string;
}

export interface HighWindGustImpulseAnalysis {
  highGustThresholdMs: number; // 10.0 m/s
  impulsePeakLimitDb: number; // 85.0 dB(A)
  sampleCount: number;
  highGustHoursCount: number;
  calmHoursCount: number;
  overallPearsonR: number;
  overallRSquared: number;
  highGustSubgroupPearsonR: number;
  highGustSubgroupRSquared: number;
  highGustSlopeDbPerMs: number;
  highGustInterceptDb: number;
  meanImpulseHighGustDb: number;
  meanImpulseCalmDb: number;
  meanAmplificationDeltaDb: number;
  peakImpulseHighGustDb: number;
  peakGustMs: number;
  peakHighGustHourIndex: number;
  peakHighGustHourLabel: string;
  highRiskEventCount: number;
  stopWorkEventCount: number;
  significanceLabelDa: string;
  points: HighWindGustEventPoint[];
  highGustPointsSorted: HighWindGustEventPoint[];
  operationalScenarios: OperationalScenarioEvaluation[];
}

export interface MachineryProfileInput {
  modeId: string;
  shortLabel: string;
  label: string;
  lwaDb: number;
  impulsePenaltyDb: number;
}

export const DEFAULT_DEMOLITION_MACHINERY_PROFILES: MachineryProfileInput[] = [
  {
    modeId: 'hydraulisk_betonknusning',
    shortLabel: 'Betonknusning (118 dB)',
    label: 'Tung Hydraulisk Betonknusning & Pulverisering',
    lwaDb: 118.0,
    impulsePenaltyDb: 14.5,
  },
  {
    modeId: 'klipning_hammer',
    shortLabel: 'Mejselhammer (114.5 dB)',
    label: 'Hydraulisk Mejselhammer & Stål-/Kanal-klipning',
    lwaDb: 114.5,
    impulsePenaltyDb: 16.0,
  },
  {
    modeId: 'facade_tag_nedtagning',
    shortLabel: 'Tag/Facade (111 dB)',
    label: 'Mekanisk Tag-/Facadenedbrydning & Teleskoplæsser',
    lwaDb: 111.0,
    impulsePenaltyDb: 11.5,
  },
  {
    modeId: 'sortering_laesning',
    shortLabel: 'Læsning/Grab (108 dB)',
    label: 'Sorteringsgrab, Containerlæsning & Kørsel',
    lwaDb: 108.0,
    impulsePenaltyDb: 10.5,
  },
  {
    modeId: 'manuel_sanering',
    shortLabel: 'Sanering (96 dB)',
    label: 'Indvendig Miljøsanering & Undertryksventilator',
    lwaDb: 96.0,
    impulsePenaltyDb: 7.5,
  },
  {
    modeId: 'standby',
    shortLabel: 'Standby (74 dB)',
    label: 'Standby / Pause (Kun Passiv Vind-Resuspension)',
    lwaDb: 74.0,
    impulsePenaltyDb: 4.0,
  },
];

function computePearsonStats(xs: number[], ys: number[]): {
  r: number;
  rSquared: number;
  slope: number;
  intercept: number;
} {
  const n = xs.length;
  if (n < 2) {
    const meanY = n === 1 ? ys[0] : 0;
    return { r: 0, rSquared: 0, slope: 0, intercept: Number(meanY.toFixed(1)) };
  }
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
  const r = denom > 1e-9 ? Number(Math.max(-1, Math.min(1, sumXY / denom)).toFixed(3)) : 0;
  const rSquared = Number((r * r).toFixed(3));
  const slope = sumXX > 1e-9 ? Number((sumXY / sumXX).toFixed(2)) : 0;
  const intercept = Number((meanY - slope * meanX).toFixed(1));
  return { r, rSquared, slope, intercept };
}

function evaluateHourlyImpulseForMachine(params: {
  hr: HourlyWeatherPoint;
  idx: number;
  machineLwaDb: number;
  impulsePenaltyDb: number;
  distanceMeters: number;
  activeSourcesCount: number;
}): HighWindGustEventPoint {
  const { hr, idx, machineLwaDb, impulsePenaltyDb, distanceMeters, activeSourcesCount } = params;
  const hourIndex = hr.hourIndex ?? idx;
  const hourLabel = hr.hourLabel || `${String(hourIndex).padStart(2, '0')}:00`;
  const windSpeedMs = Number((hr.windSpeed10m ?? 0).toFixed(1));
  const windGustMs = Number(
    Math.max(windSpeedMs, hr.windGusts10m || windSpeedMs * 1.32).toFixed(1)
  );
  const isHighWindGustEvent = windGustMs > 10.0;
  const gustSeverityTier: HighWindGustEventPoint['gustSeverityTier'] =
    windGustMs > 15.0 ? 'EXTREME_GUST' : windGustMs > 10.0 ? 'HIGH_GUST' : 'MODERATE_WIND';

  const aDivDb = 20 * Math.log10(Math.max(15, distanceMeters)) + 11.0;
  const aAtmGroundDb = Math.min(6.0, 1.1 + distanceMeters * 0.013);
  const multiSourceBonusDb = activeSourcesCount > 1 ? Math.min(3.5, 10 * Math.log10(activeSourcesCount) * 0.55) : 0;

  const isWorkWindow = hourIndex >= 7 && hourIndex < 18;
  const isEvening = hourIndex >= 18 && hourIndex < 22;
  const scheduleAttenuationDb = isWorkWindow ? 0 : isEvening ? -10.5 : -15.0;

  const thermalRefrDb =
    hr.pasquillClass === 'F'
      ? 2.2
      : hr.pasquillClass === 'E'
      ? 1.2
      : hr.pasquillClass === 'A'
      ? -0.6
      : 0;

  // Baseline calm impulse without >10 m/s gust refraction
  const moderateWindRefrDb = Math.min(2.1, Math.max(0, (Math.min(windGustMs, 10.0) - 5.5) * 0.42));
  const baselineCalmLaeqDb =
    machineLwaDb +
    multiSourceBonusDb -
    aDivDb -
    aAtmGroundDb +
    scheduleAttenuationDb +
    thermalRefrDb +
    moderateWindRefrDb * 0.65;
  const baselineCalmImpulseDb = Number(
    Math.max(43, baselineCalmLaeqDb + impulsePenaltyDb * 0.52).toFixed(1)
  );

  // Additional high-wind gust (>10 m/s) acoustic wave bending & barrier-skip amplification
  const excessGustMs = Math.max(0, windGustMs - 10.0);
  const gustSpreadMs = Math.max(0, windGustMs - windSpeedMs);
  const highGustRefractionBonusDb = isHighWindGustEvent
    ? Math.min(
        8.6,
        excessGustMs * 0.72 + Math.max(0, gustSpreadMs - 2.0) * 0.34 + Math.max(0, windSpeedMs - 9.0) * 0.35
      )
    : 0;

  const laeqDb = Number(
    Math.max(40, baselineCalmLaeqDb + highGustRefractionBonusDb * 0.74).toFixed(1)
  );
  const peakImpulseLafmaxDb = Number(
    Math.max(
      43,
      baselineCalmImpulseDb + highGustRefractionBonusDb
    ).toFixed(1)
  );
  const gustAmplificationDb = Number(
    Math.max(0, peakImpulseLafmaxDb - baselineCalmImpulseDb).toFixed(1)
  );

  const exceeds85DbLimit = peakImpulseLafmaxDb >= 85.0;
  let operationalRiskLevel: OperationalRiskTier = 'SAFE';
  if (isHighWindGustEvent && peakImpulseLafmaxDb >= 85.0) {
    operationalRiskLevel = 'STOP_WORK';
  } else if (
    (isHighWindGustEvent && peakImpulseLafmaxDb >= 79.0) ||
    peakImpulseLafmaxDb >= 85.0
  ) {
    operationalRiskLevel = 'HIGH_RISK';
  } else if (isHighWindGustEvent || peakImpulseLafmaxDb >= 74.0) {
    operationalRiskLevel = 'CAUTION';
  }

  const scenarioLabelDa =
    operationalRiskLevel === 'STOP_WORK'
      ? `STOP-ARBEJDE: Vindstød ${windGustMs.toFixed(1)} m/s (>10) løfter impulsstøj til ${peakImpulseLafmaxDb.toFixed(1)} dB(A) ≥ 85 dB`
      : operationalRiskLevel === 'HIGH_RISK'
      ? `Høj driftsrisiko: Vindstød ${windGustMs.toFixed(1)} m/s + impuls ${peakImpulseLafmaxDb.toFixed(1)} dB(A)`
      : operationalRiskLevel === 'CAUTION'
      ? `Skærpet opmærksomhed: ${windGustMs.toFixed(1)} m/s vindstød · ${peakImpulseLafmaxDb.toFixed(1)} dB(A)`
      : `Sikker drift: ${windGustMs.toFixed(1)} m/s · ${peakImpulseLafmaxDb.toFixed(1)} dB(A)`;

  return {
    hourIndex,
    hourLabel,
    windSpeedMs,
    windGustMs,
    windDirectionDeg: Math.round(hr.windDirection10m ?? 240),
    pasquillClass: hr.pasquillClass || 'D',
    isHighWindGustEvent,
    gustSeverityTier,
    machineLwaDb,
    peakImpulseLafmaxDb,
    baselineCalmImpulseDb,
    gustAmplificationDb,
    laeqDb,
    isWorkWindow,
    exceeds85DbLimit,
    operationalRiskLevel,
    scenarioLabelDa,
  };
}

/**
 * Isolerer og analyserer den statistiske korrelation mellem kraftige vindstød (>10 m/s)
 * og spids-impulsstøj (dB(A)) fra nedrivningsmaskiner samt højrisiko driftsscenarier.
 */
export function computeHighWindGustImpulseAnalysis(params: {
  weatherHours: HourlyWeatherPoint[];
  machineLwaDb: number;
  impulsePenaltyDb?: number;
  distanceMeters?: number;
  activeSourcesCount?: number;
  machineryProfiles?: MachineryProfileInput[];
}): HighWindGustImpulseAnalysis {
  const {
    weatherHours,
    machineLwaDb,
    impulsePenaltyDb = 14.5,
    distanceMeters = 45,
    activeSourcesCount = 1,
    machineryProfiles = DEFAULT_DEMOLITION_MACHINERY_PROFILES,
  } = params;

  const hours = weatherHours.slice(0, 24);
  if (hours.length === 0) {
    return {
      highGustThresholdMs: 10.0,
      impulsePeakLimitDb: 85.0,
      sampleCount: 0,
      highGustHoursCount: 0,
      calmHoursCount: 0,
      overallPearsonR: 0,
      overallRSquared: 0,
      highGustSubgroupPearsonR: 0,
      highGustSubgroupRSquared: 0,
      highGustSlopeDbPerMs: 0,
      highGustInterceptDb: 0,
      meanImpulseHighGustDb: 0,
      meanImpulseCalmDb: 0,
      meanAmplificationDeltaDb: 0,
      peakImpulseHighGustDb: 0,
      peakGustMs: 0,
      peakHighGustHourIndex: 0,
      peakHighGustHourLabel: '00:00',
      highRiskEventCount: 0,
      stopWorkEventCount: 0,
      significanceLabelDa: 'Ingen vejrdata tilgængelig',
      points: [],
      highGustPointsSorted: [],
      operationalScenarios: [],
    };
  }

  const points = hours.map((hr, idx) =>
    evaluateHourlyImpulseForMachine({
      hr,
      idx,
      machineLwaDb,
      impulsePenaltyDb,
      distanceMeters,
      activeSourcesCount,
    })
  );

  const highGustPoints = points.filter((p) => p.isHighWindGustEvent);
  const calmPoints = points.filter((p) => !p.isHighWindGustEvent);

  const overallStats = computePearsonStats(
    points.map((p) => p.windGustMs),
    points.map((p) => p.peakImpulseLafmaxDb)
  );
  const highGustStats = computePearsonStats(
    highGustPoints.map((p) => p.windGustMs),
    highGustPoints.map((p) => p.peakImpulseLafmaxDb)
  );

  const meanImpulseHighGustDb =
    highGustPoints.length > 0
      ? Number(
          (
            highGustPoints.reduce((acc, p) => acc + p.peakImpulseLafmaxDb, 0) /
            highGustPoints.length
          ).toFixed(1)
        )
      : 0;
  const meanImpulseCalmDb =
    calmPoints.length > 0
      ? Number(
          (
            calmPoints.reduce((acc, p) => acc + p.peakImpulseLafmaxDb, 0) / calmPoints.length
          ).toFixed(1)
        )
      : 0;
  const meanAmplificationDeltaDb =
    highGustPoints.length > 0
      ? Number(
          (
            highGustPoints.reduce((acc, p) => acc + p.gustAmplificationDb, 0) /
            highGustPoints.length
          ).toFixed(1)
        )
      : 0;

  const highGustPointsSorted = [...highGustPoints].sort(
    (a, b) =>
      b.peakImpulseLafmaxDb + b.windGustMs * 0.9 - (a.peakImpulseLafmaxDb + a.windGustMs * 0.9)
  );
  const peakHighGustPoint = highGustPointsSorted[0] ?? points[0];

  const stopWorkEventCount = points.filter(
    (p) => p.operationalRiskLevel === 'STOP_WORK'
  ).length;
  const highRiskEventCount = points.filter(
    (p) =>
      p.operationalRiskLevel === 'STOP_WORK' || p.operationalRiskLevel === 'HIGH_RISK'
  ).length;

  const effectiveCorr = highGustPoints.length >= 3 ? highGustStats.r : overallStats.r;
  const significanceLabelDa =
    highGustPoints.length === 0
      ? 'Ingen vindstød >10 m/s i dette døgn'
      : effectiveCorr >= 0.72
      ? 'Stærk positiv kobling (>10 m/s vindstød øger impulsstøj)'
      : effectiveCorr >= 0.45
      ? 'Moderat til stærk kobling under højvind'
      : 'Vindstød bidrager primært sammen med dagdriftsvindue (07–18)';

  const operationalScenarios: OperationalScenarioEvaluation[] = machineryProfiles.map((prof) => {
    const modePts = hours.map((hr, idx) =>
      evaluateHourlyImpulseForMachine({
        hr,
        idx,
        machineLwaDb: prof.lwaDb,
        impulsePenaltyDb: prof.impulsePenaltyDb,
        distanceMeters,
        activeSourcesCount,
      })
    );
    const modeHigh = modePts.filter((p) => p.isHighWindGustEvent);
    const modeCalm = modePts.filter((p) => !p.isHighWindGustEvent);
    const refHigh = modeHigh.length > 0 ? modeHigh : modePts;
    const worst = [...refHigh].sort(
      (a, b) => b.peakImpulseLafmaxDb - a.peakImpulseLafmaxDb
    )[0];

    const meanHigh = Number(
      (refHigh.reduce((a, p) => a + p.peakImpulseLafmaxDb, 0) / refHigh.length).toFixed(1)
    );
    const meanCalm =
      modeCalm.length > 0
        ? Number(
            (modeCalm.reduce((a, p) => a + p.peakImpulseLafmaxDb, 0) / modeCalm.length).toFixed(1)
          )
        : meanHigh;
    const gustDeltaDb = Number(
      (
        refHigh.reduce((a, p) => a + p.gustAmplificationDb, 0) / refHigh.length
      ).toFixed(1)
    );
    const highGustExceedanceHours = modeHigh.filter((p) => p.peakImpulseLafmaxDb >= 85.0).length;

    let riskTier: OperationalRiskTier = 'SAFE';
    if (highGustExceedanceHours > 0 || (modeHigh.length > 0 && worst.peakImpulseLafmaxDb >= 85.0)) {
      riskTier = 'STOP_WORK';
    } else if (modeHigh.length > 0 && worst.peakImpulseLafmaxDb >= 79.0) {
      riskTier = 'HIGH_RISK';
    } else if (worst.peakImpulseLafmaxDb >= 74.0 || modeHigh.length > 0) {
      riskTier = 'CAUTION';
    }

    const mitigationRecommendationDa =
      riskTier === 'STOP_WORK'
        ? `Indstil ${prof.shortLabel.split(' ')[0]} ved stød >10 m/s · skift til sanering/indvendig drift`
        : riskTier === 'HIGH_RISK'
        ? `Opsæt mobil støjskærm + reducer slagfrekvens i ${worst.hourLabel}`
        : riskTier === 'CAUTION'
        ? `Tilladt med løbende L_AFmax-kontrol ved stød >10 m/s`
        : `Overholder grænseværdi selv under aktuelle vindstød`;

    return {
      modeId: prof.modeId,
      shortLabel: prof.shortLabel,
      label: prof.label,
      lwaDb: prof.lwaDb,
      impulsePenaltyDb: prof.impulsePenaltyDb,
      peakImpulseDuringHighGustDb: worst.peakImpulseLafmaxDb,
      meanImpulseDuringHighGustDb: meanHigh,
      meanImpulseCalmDb: meanCalm,
      gustDeltaDb,
      highGustExceedanceHours,
      worstHourIndex: worst.hourIndex,
      worstHourLabel: worst.hourLabel,
      worstGustMs: worst.windGustMs,
      riskTier,
      mitigationRecommendationDa,
    };
  });

  return {
    highGustThresholdMs: 10.0,
    impulsePeakLimitDb: 85.0,
    sampleCount: points.length,
    highGustHoursCount: highGustPoints.length,
    calmHoursCount: calmPoints.length,
    overallPearsonR: overallStats.r,
    overallRSquared: overallStats.rSquared,
    highGustSubgroupPearsonR: highGustStats.r,
    highGustSubgroupRSquared: highGustStats.rSquared,
    highGustSlopeDbPerMs: highGustStats.slope,
    highGustInterceptDb: highGustStats.intercept,
    meanImpulseHighGustDb,
    meanImpulseCalmDb,
    meanAmplificationDeltaDb,
    peakImpulseHighGustDb: peakHighGustPoint.peakImpulseLafmaxDb,
    peakGustMs: Number(Math.max(...points.map((p) => p.windGustMs)).toFixed(1)),
    peakHighGustHourIndex: peakHighGustPoint.hourIndex,
    peakHighGustHourLabel: peakHighGustPoint.hourLabel,
    highRiskEventCount,
    stopWorkEventCount,
    significanceLabelDa,
    points,
    highGustPointsSorted,
    operationalScenarios,
  };
}

