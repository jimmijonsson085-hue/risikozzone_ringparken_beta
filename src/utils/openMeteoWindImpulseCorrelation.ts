/**
 * @file src/utils/openMeteoWindImpulseCorrelation.ts
 * @description Deterministisk korrelationsmotor for sammenhængen mellem Open-Meteo vindhastighed (m/s)
 * og impulsstøj (dB(A)) over de seneste 24 timer.
 */

import { AlgedonicObservation, HourlyWeatherPoint } from '../types/dispersion';
import { computeInterpolatedRefractionFrame } from '../services/acousticRefractionMath';
import { degreesToCompass } from '../services/weatherService';

export interface OpenMeteoWindImpulsePoint {
  slotIndex: number; // 0..23 chronological order across trailing 24h
  hourIndex: number; // 0..23 clock hour
  hourLabel: string;
  isoTime: string;
  shortDateTimeLabel: string;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
  windCompass: string;
  pasquillClass: string;
  windRefractionDb: number;
  thermalRefractionDb: number;
  impulseDb: number; // Estimated + observed peak impulse L_AFmax dB(A)
  laeqDb: number;
  recordedImpulseObsCount: number;
  exceeds85Db: boolean;
  isHighWindOver10Ms: boolean;
}

export interface OpenMeteoWindImpulseCorrelationSummary {
  sampleCount: number;
  pearsonR: number;
  rSquared: number;
  slopeDbPerMs: number;
  interceptDb: number;
  tStatistic: number;
  significanceLabelDa: string;
  meanWindSpeedMs: number;
  minWindSpeedMs: number;
  maxWindSpeedMs: number;
  meanImpulseDb: number;
  minImpulseDb: number;
  maxImpulseDb: number;
  peakSlotIndex: number;
  peakHourIndex: number;
  peakHourLabel: string;
  hoursExceeding85Db: number;
  hoursOver10MsWind: number;
  points: OpenMeteoWindImpulsePoint[];
}

export interface ComputeOpenMeteoWindImpulseParams {
  weatherHours: HourlyWeatherPoint[];
  observations?: AlgedonicObservation[];
  machineLwaDb: number;
  impulsePenaltyDb?: number;
  distanceMeters?: number;
  activeSourcesCount?: number;
  ignoreWorkScheduleAttenuation?: boolean;
}

/**
 * Beregner 24-timers korrelationsdata mellem Open-Meteo vindhastighed (m/s)
 * og impulsstøj (dB(A)) inklusive Pearsons r, R², regressionshældning og t-værdi.
 */
export function computeOpenMeteoWindImpulseCorrelation(
  params: ComputeOpenMeteoWindImpulseParams
): OpenMeteoWindImpulseCorrelationSummary {
  const {
    weatherHours,
    observations = [],
    machineLwaDb,
    impulsePenaltyDb = 14.5,
    distanceMeters = 45,
    activeSourcesCount = 1,
    ignoreWorkScheduleAttenuation = false,
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
      significanceLabelDa: 'Ingen Open-Meteo data tilgængelig',
      meanWindSpeedMs: 0,
      minWindSpeedMs: 0,
      maxWindSpeedMs: 0,
      meanImpulseDb: 0,
      minImpulseDb: 0,
      maxImpulseDb: 0,
      peakSlotIndex: 0,
      peakHourIndex: 0,
      peakHourLabel: '00:00',
      hoursExceeding85Db: 0,
      hoursOver10MsWind: 0,
      points: [],
    };
  }

  const aDivDb = 20 * Math.log10(Math.max(15, distanceMeters)) + 11.0;
  const aAtmGroundDb = Math.min(6.0, 0.9 + distanceMeters * 0.013);
  const multiSourceBonusDb =
    activeSourcesCount > 1
      ? Math.min(3.5, 10 * Math.log10(activeSourcesCount) * 0.55)
      : 0;

  const points: OpenMeteoWindImpulsePoint[] = hours.map((hr, slotIdx) => {
    const hourIndex = hr.hourIndex ?? slotIdx;
    const hourLabel = hr.hourLabel || `${String(hourIndex).padStart(2, '0')}:00`;
    const datePart = hr.isoTime && hr.isoTime.length >= 10 ? hr.isoTime.slice(5, 10) : '';
    const shortDateTimeLabel = datePart ? `${datePart} ${hourLabel}` : hourLabel;

    const frame = computeInterpolatedRefractionFrame({
      hours,
      fallbackWeather: hr,
      loopProgress: slotIdx,
      isPlayingLoop: false,
    });

    const windSpeedMs = Number((hr.windSpeed10m ?? 0).toFixed(1));
    const windGustsMs = Number(
      Math.max(windSpeedMs, hr.windGusts10m || windSpeedMs * 1.35).toFixed(1)
    );
    const windDirectionDeg = Math.round(hr.windDirection10m ?? 240);
    const windCompass = degreesToCompass(windDirectionDeg);

    const isWorkWindow = hourIndex >= 7 && hourIndex < 18;
    const isEvening = hourIndex >= 18 && hourIndex < 22;
    const scheduleAttenuationDb = ignoreWorkScheduleAttenuation
      ? 0
      : isWorkWindow
      ? 0
      : isEvening
      ? -10.5
      : -15.0;

    // Wind refraction + wind-speed-induced impulse barrier degradation
    const windRefractionDb = Number(
      (
        frame.downwindWindRefractionDb * 0.72 +
        Math.max(0, windSpeedMs - 4.0) * 0.42
      ).toFixed(1)
    );
    const thermalRefractionDb = frame.thermalSpec.thermalRefractionDb;

    const laeqDb = Number(
      Math.max(
        40,
        machineLwaDb +
          multiSourceBonusDb -
          aDivDb -
          aAtmGroundDb +
          scheduleAttenuationDb +
          windRefractionDb * 0.75 +
          thermalRefractionDb * 0.65 +
          frame.rainSplashBonusDb
      ).toFixed(1)
    );

    const matchingNoiseObs = observations.filter(
      (o) =>
        o.observedHourIndex === hourIndex &&
        (Boolean(o.audioEvidence) ||
          /støj|db|impuls|mejsel|hammer|klage/i.test(
            `${o.observationType} ${o.description}`
          ))
    );
    const maxObsDb = matchingNoiseObs.reduce((best, o) => {
      const analysis = o.audioEvidence?.analysis;
      if (!analysis) return best;
      const est =
        analysis.estimatedSourceLwaDb -
        aDivDb -
        aAtmGroundDb +
        (analysis.crestFactorDb ?? 8) * 0.45 +
        (analysis.statutoryPenaltyDb ?? 0) * 0.4;
      return Math.max(best, est);
    }, 0);

    const modeledImpulseDb =
      laeqDb + impulsePenaltyDb * 0.52 + windRefractionDb * 0.35;
    const impulseDb = Number(
      Math.max(43, maxObsDb > 0 ? Math.max(modeledImpulseDb, maxObsDb) : modeledImpulseDb).toFixed(1)
    );

    return {
      slotIndex: slotIdx,
      hourIndex,
      hourLabel,
      isoTime: hr.isoTime || hourLabel,
      shortDateTimeLabel,
      windSpeedMs,
      windGustsMs,
      windDirectionDeg,
      windCompass,
      pasquillClass: hr.pasquillClass || 'D',
      windRefractionDb,
      thermalRefractionDb,
      impulseDb,
      laeqDb,
      recordedImpulseObsCount: matchingNoiseObs.length,
      exceeds85Db: impulseDb >= 85.0,
      isHighWindOver10Ms: windSpeedMs > 10.0,
    };
  });

  const n = points.length;
  const xs = points.map((p) => p.windSpeedMs);
  const ys = points.map((p) => p.impulseDb);

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
      ? 'Signifikant positiv korrelation (p < 0,01)'
      : absT >= 2.07 && pearsonR > 0
      ? 'Signifikant positiv korrelation (p < 0,05)'
      : pearsonR >= 0.35
      ? 'Moderat positiv vind-impuls sammenhæng'
      : 'Kombineret af vindhastighed og driftsvindue (07–18)';

  const peakPoint = [...points].sort((a, b) => b.impulseDb - a.impulseDb)[0] ?? points[0];

  return {
    sampleCount: n,
    pearsonR,
    rSquared,
    slopeDbPerMs,
    interceptDb,
    tStatistic,
    significanceLabelDa,
    meanWindSpeedMs: Number(meanX.toFixed(1)),
    minWindSpeedMs: Number(Math.min(...xs).toFixed(1)),
    maxWindSpeedMs: Number(Math.max(...xs).toFixed(1)),
    meanImpulseDb: Number(meanY.toFixed(1)),
    minImpulseDb: Number(Math.min(...ys).toFixed(1)),
    maxImpulseDb: Number(Math.max(...ys).toFixed(1)),
    peakSlotIndex: peakPoint.slotIndex,
    peakHourIndex: peakPoint.hourIndex,
    peakHourLabel: peakPoint.hourLabel,
    hoursExceeding85Db: points.filter((p) => p.exceeds85Db).length,
    hoursOver10MsWind: points.filter((p) => p.isHighWindOver10Ms).length,
    points,
  };
}
