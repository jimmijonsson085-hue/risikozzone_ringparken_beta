/**
 * @file src/utils/rollingGustDustDepositionCorrelation.ts
 * @description Rullende statistisk korrelationsmotor mellem Open-Meteo vindstød (>10 m/s)
 * og kumulativ respirabel støv-deposition (µg/m²) til identifikation af risikofyldte vejrhændelser.
 */

import { HourlyReceptorPuffDose, HourlyWeatherPoint } from '../types/dispersion';

export type GustDustWeatherEventRisk =
  | 'CRITICAL'
  | 'HIGH_RISK'
  | 'WATCH'
  | 'NOMINAL';

export interface RollingGustDustPoint {
  slotIndex: number;
  hourIndex: number;
  hourLabel: string;
  shortHour: string;
  isoTime: string;
  windSpeedMs: number;
  windGustMs: number;
  windDirectionDeg: number;
  precipitationMm: number;
  relativeHumidityPct: number;
  isHighGustOver10Ms: boolean;
  hourlyDustUgM2: number;
  cumulativeDustUgM2: number;
  rollingCorrelationR: number;
  rollingStrengthLabelDa: 'STÆRK' | 'MODERAT' | 'SVAG';
  windowLabel: string;
  windowMaxGustMs: number;
  windowHighGustHours: number;
  windowDustGainUgM2: number;
  isHighRiskWeatherEvent: boolean;
  riskSeverity: GustDustWeatherEventRisk;
  riskReasonDa: string;
}

export interface RollingGustDustCorrelationSummary {
  windowSpanHours: 4 | 6 | 8;
  gustThresholdMs: number;
  sampleCount: number;
  highGustHoursCount: number;
  totalCumulativeDustUgM2: number;
  currentRollingR: number;
  peakRollingR: number;
  meanHourlyDustDuringHighGustUgM2: number;
  meanHourlyDustDuringCalmUgM2: number;
  dustResuspensionMultiplier: number;
  highRiskEventCount: number;
  criticalEventCount: number;
  points: RollingGustDustPoint[];
  identifiedRiskEvents: RollingGustDustPoint[];
}

export interface ComputeRollingGustDustParams {
  weatherHours: HourlyWeatherPoint[];
  hourlyReceptorProfile?: HourlyReceptorPuffDose[];
  windowSpanHours?: 4 | 6 | 8;
  gustThresholdMs?: number;
  useLiveOpenMeteoSeries?: boolean;
}

function computePearsonR(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  if (denom < 1e-7) return 0;
  return Number(Math.max(-1, Math.min(1, num / denom)).toFixed(3));
}

function computeOpenMeteoRespirableDustUgM2(hr: HourlyWeatherPoint, hourIndex: number): number {
  const windSpeedMs = hr.windSpeed10m ?? 4.5;
  const windGustMs = Math.max(windSpeedMs, hr.windGusts10m || windSpeedMs * 1.32);
  const precip = hr.precipitation ?? 0;
  const rh = hr.relativeHumidity2m ?? 70;
  const isWorkWindow = hourIndex >= 7 && hourIndex <= 17;

  // Threshold friction velocity & wind-gust resuspension power law above 6 m/s (strong jump >10 m/s)
  const baseMechanicalDust = isWorkWindow ? 3.2 : 0.7;
  const gustShear = Math.max(0, windGustMs - 5.2);
  const highGustJump = windGustMs > 10.0 ? Math.pow(windGustMs - 10.0, 1.35) * 1.85 : 0;
  const drynessFactor = Math.max(0.55, Math.min(1.45, 1.35 - (rh / 100) * 0.65));
  const rainWashoutFactor = precip >= 1.0 ? 0.22 : precip >= 0.2 ? 0.45 : 1.0;

  return Number(
    Math.max(
      0.3,
      (baseMechanicalDust + gustShear * 1.15 + highGustJump) * drynessFactor * rainWashoutFactor
    ).toFixed(1)
  );
}

/**
 * Beregner den rullende korrelation mellem Open-Meteo vindstød (>10 m/s)
 * og den kumulative respirable støv-deposition (µg/m²) over et valgt tidsvindue.
 */
export function computeRollingGustCumulativeDustCorrelation(
  params: ComputeRollingGustDustParams
): RollingGustDustCorrelationSummary {
  const {
    weatherHours,
    hourlyReceptorProfile,
    windowSpanHours = 6,
    gustThresholdMs = 10.0,
    useLiveOpenMeteoSeries = false,
  } = params;

  const hours = weatherHours.slice(0, 24);
  if (hours.length === 0) {
    return {
      windowSpanHours,
      gustThresholdMs,
      sampleCount: 0,
      highGustHoursCount: 0,
      totalCumulativeDustUgM2: 0,
      currentRollingR: 0,
      peakRollingR: 0,
      meanHourlyDustDuringHighGustUgM2: 0,
      meanHourlyDustDuringCalmUgM2: 0,
      dustResuspensionMultiplier: 1,
      highRiskEventCount: 0,
      criticalEventCount: 0,
      points: [],
      identifiedRiskEvents: [],
    };
  }

  let runningCumulativeDust = 0;
  const rawEntries = hours.map((hr, slotIdx) => {
    const hourIndex = hr.hourIndex ?? slotIdx;
    const hourLabel = hr.hourLabel || `${String(hourIndex).padStart(2, '0')}:00`;
    const windSpeedMs = Number((hr.windSpeed10m ?? 0).toFixed(1));
    const windGustMs = Number(
      Math.max(windSpeedMs, hr.windGusts10m || windSpeedMs * 1.32).toFixed(1)
    );
    const isHighGustOver10Ms = windGustMs > gustThresholdMs;

    const profileMatch = !useLiveOpenMeteoSeries
      ? hourlyReceptorProfile?.find((p) => p.hourIndex === hourIndex)
      : undefined;
    const hourlyDustUgM2 =
      profileMatch && typeof profileMatch.depositedDustUgM2 === 'number'
        ? Number(profileMatch.depositedDustUgM2.toFixed(1))
        : computeOpenMeteoRespirableDustUgM2(hr, hourIndex);

    runningCumulativeDust = Number((runningCumulativeDust + hourlyDustUgM2).toFixed(1));

    return {
      slotIndex: slotIdx,
      hourIndex,
      hourLabel,
      shortHour: String(hourIndex).padStart(2, '0'),
      isoTime: hr.isoTime || hourLabel,
      windSpeedMs,
      windGustMs,
      windDirectionDeg: Math.round(hr.windDirection10m ?? 240),
      precipitationMm: Number((hr.precipitation ?? 0).toFixed(1)),
      relativeHumidityPct: Math.round(hr.relativeHumidity2m ?? 70),
      isHighGustOver10Ms,
      hourlyDustUgM2,
      cumulativeDustUgM2: runningCumulativeDust,
    };
  });

  const points: RollingGustDustPoint[] = rawEntries.map((entry, idx) => {
    const startIdx = Math.max(0, idx - windowSpanHours + 1);
    const windowSlice = rawEntries.slice(startIdx, idx + 1);

    // Ensure at least 2 points when available for rolling window at idx === 0
    const corrSlice =
      windowSlice.length >= 2
        ? windowSlice
        : rawEntries.slice(0, Math.min(2, rawEntries.length));

    const rollingCorrelationR = computePearsonR(
      corrSlice.map((w) => w.windGustMs),
      corrSlice.map((w) => w.cumulativeDustUgM2)
    );

    const absR = Math.abs(rollingCorrelationR);
    const rollingStrengthLabelDa: RollingGustDustPoint['rollingStrengthLabelDa'] =
      absR >= 0.7 ? 'STÆRK' : absR >= 0.4 ? 'MODERAT' : 'SVAG';

    const firstLbl = corrSlice[0]?.hourLabel ?? entry.hourLabel;
    const lastLbl = corrSlice[corrSlice.length - 1]?.hourLabel ?? entry.hourLabel;
    const windowMaxGustMs = Number(
      Math.max(...corrSlice.map((w) => w.windGustMs)).toFixed(1)
    );
    const windowHighGustHours = corrSlice.filter((w) => w.isHighGustOver10Ms).length;
    const windowDustGainUgM2 = Number(
      corrSlice.reduce((sum, w) => sum + w.hourlyDustUgM2, 0).toFixed(1)
    );

    let riskSeverity: GustDustWeatherEventRisk = 'NOMINAL';
    if (
      entry.isHighGustOver10Ms &&
      rollingCorrelationR >= 0.6 &&
      (entry.hourlyDustUgM2 >= 8.0 || windowDustGainUgM2 >= 40.0)
    ) {
      riskSeverity = 'CRITICAL';
    } else if (
      entry.isHighGustOver10Ms &&
      (rollingCorrelationR >= 0.35 || entry.cumulativeDustUgM2 >= 65.0)
    ) {
      riskSeverity = 'HIGH_RISK';
    } else if (entry.isHighGustOver10Ms || rollingCorrelationR >= 0.7) {
      riskSeverity = 'WATCH';
    }

    const isHighRiskWeatherEvent =
      riskSeverity === 'CRITICAL' || riskSeverity === 'HIGH_RISK';

    const riskReasonDa =
      riskSeverity === 'CRITICAL'
        ? `Kritisk hændelse: Vindstød ${entry.windGustMs.toFixed(
            1
          )} m/s (>10) · r=${rollingCorrelationR.toFixed(
            2
          )} driver kumulativ støv til ${entry.cumulativeDustUgM2.toFixed(1)} µg/m²`
        : riskSeverity === 'HIGH_RISK'
        ? `Højrisiko vejrhændelse: Stød ${entry.windGustMs.toFixed(
            1
          )} m/s øger støvdeposition (+${entry.hourlyDustUgM2.toFixed(1)} µg/m²/t)`
        : riskSeverity === 'WATCH'
        ? `Observation: Forhøjet stød/korrelation (${entry.windGustMs.toFixed(
            1
          )} m/s · r=${rollingCorrelationR.toFixed(2)})`
        : `Normal spredning (${entry.windGustMs.toFixed(1)} m/s · ${entry.cumulativeDustUgM2.toFixed(
            1
          )} µg/m²)`;

    return {
      ...entry,
      rollingCorrelationR,
      rollingStrengthLabelDa,
      windowLabel: `${firstLbl}–${lastLbl}`,
      windowMaxGustMs,
      windowHighGustHours,
      windowDustGainUgM2,
      isHighRiskWeatherEvent,
      riskSeverity,
      riskReasonDa,
    };
  });

  const highGustEntries = points.filter((p) => p.isHighGustOver10Ms);
  const calmEntries = points.filter((p) => !p.isHighGustOver10Ms);

  const meanHourlyDustDuringHighGustUgM2 =
    highGustEntries.length > 0
      ? Number(
          (
            highGustEntries.reduce((s, p) => s + p.hourlyDustUgM2, 0) /
            highGustEntries.length
          ).toFixed(1)
        )
      : 0;
  const meanHourlyDustDuringCalmUgM2 =
    calmEntries.length > 0
      ? Number(
          (
            calmEntries.reduce((s, p) => s + p.hourlyDustUgM2, 0) / calmEntries.length
          ).toFixed(1)
        )
      : 0;

  const dustResuspensionMultiplier =
    meanHourlyDustDuringCalmUgM2 > 0.1 && meanHourlyDustDuringHighGustUgM2 > 0
      ? Number(
          (meanHourlyDustDuringHighGustUgM2 / meanHourlyDustDuringCalmUgM2).toFixed(2)
        )
      : 1.0;

  const identifiedRiskEvents = [...points]
    .filter((p) => p.isHighRiskWeatherEvent)
    .sort((a, b) => {
      const rank = (r: GustDustWeatherEventRisk) => (r === 'CRITICAL' ? 2 : 1);
      const rDiff = rank(b.riskSeverity) - rank(a.riskSeverity);
      if (rDiff !== 0) return rDiff;
      return b.windGustMs + b.hourlyDustUgM2 * 0.4 - (a.windGustMs + a.hourlyDustUgM2 * 0.4);
    });

  const lastPt = points[points.length - 1];
  const peakRollingR =
    points.length > 0
      ? Number(Math.max(...points.map((p) => p.rollingCorrelationR)).toFixed(3))
      : 0;

  return {
    windowSpanHours,
    gustThresholdMs,
    sampleCount: points.length,
    highGustHoursCount: highGustEntries.length,
    totalCumulativeDustUgM2: lastPt?.cumulativeDustUgM2 ?? 0,
    currentRollingR: lastPt?.rollingCorrelationR ?? 0,
    peakRollingR,
    meanHourlyDustDuringHighGustUgM2,
    meanHourlyDustDuringCalmUgM2,
    dustResuspensionMultiplier,
    highRiskEventCount: identifiedRiskEvents.length,
    criticalEventCount: points.filter((p) => p.riskSeverity === 'CRITICAL').length,
    points,
    identifiedRiskEvents,
  };
}
