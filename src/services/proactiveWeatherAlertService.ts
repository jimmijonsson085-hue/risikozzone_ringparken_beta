import { HourlyWeatherPoint } from '../types/dispersion';

export type ProactiveWeatherDeviationKind =
  | 'WIND_SPEED_DEVIATION'
  | 'WIND_GUST_DEVIATION'
  | 'HUMIDITY_DEVIATION';

export type ProactiveWeatherAlertPriority = 'HIGH' | 'CRITICAL';

export interface ProactiveWeather24hAverages {
  avgWindSpeed10m: number;
  avgWindGusts10m: number;
  avgRelativeHumidity2m: number;
  avgPrecipitationMmH: number;
  sampleCount: number;
}

export interface ProactiveWeatherDeviations {
  deltaWindMs: number;
  deltaWindPct: number;
  deltaGustsMs: number;
  deltaGustsPct: number;
  deltaHumidityPctPts: number;
  deltaHumidityPct: number;
}

export interface ProactiveWeatherAlert {
  id: string;
  dedupKey: string;
  kind: ProactiveWeatherDeviationKind;
  priority: ProactiveWeatherAlertPriority;
  title: string;
  message: string;
  metricLabel: string;
  currentValueFormatted: string;
  average24hFormatted: string;
  deltaFormatted: string;
  operationalGuidance: string;
  hourIndex: number;
  hourLabel: string;
  dateIso: string;
  createdAtIso: string;
}

export interface ProactiveWeatherEvaluation {
  averages24h: ProactiveWeather24hAverages;
  deviations: ProactiveWeatherDeviations;
  activeAlerts: ProactiveWeatherAlert[];
  hasHighPriorityDeviation: boolean;
}

/**
 * Evaluates current meteorological telemetry (`windSpeed10m`, `windGusts10m`, `relativeHumidity2m`)
 * against the 24-hour rolling dataset averages and returns high-priority proactive alerts when
 * significant environmental deviations occur.
 */
export function evaluateProactiveWeatherDeviations(params: {
  currentWeather: HourlyWeatherPoint;
  weatherHours: HourlyWeatherPoint[];
  dateIso: string;
}): ProactiveWeatherEvaluation {
  const { currentWeather, weatherHours, dateIso } = params;
  const hours = weatherHours.length > 0 ? weatherHours : [currentWeather];
  const n = hours.length;

  const sum = hours.reduce(
    (acc, hr) => {
      acc.wind += hr.windSpeed10m;
      acc.gusts += hr.windGusts10m;
      acc.humidity += hr.relativeHumidity2m;
      acc.precip += hr.precipitation;
      return acc;
    },
    { wind: 0, gusts: 0, humidity: 0, precip: 0 }
  );

  const avgWindSpeed10m = Number((sum.wind / n).toFixed(2));
  const avgWindGusts10m = Number((sum.gusts / n).toFixed(2));
  const avgRelativeHumidity2m = Number((sum.humidity / n).toFixed(1));
  const avgPrecipitationMmH = Number((sum.precip / n).toFixed(2));

  const deltaWindMs = Number((currentWeather.windSpeed10m - avgWindSpeed10m).toFixed(2));
  const deltaWindPct =
    avgWindSpeed10m > 0.1
      ? Number(((deltaWindMs / avgWindSpeed10m) * 100).toFixed(0))
      : 0;

  const deltaGustsMs = Number((currentWeather.windGusts10m - avgWindGusts10m).toFixed(2));
  const deltaGustsPct =
    avgWindGusts10m > 0.1
      ? Number(((deltaGustsMs / avgWindGusts10m) * 100).toFixed(0))
      : 0;

  const deltaHumidityPctPts = Number(
    (currentWeather.relativeHumidity2m - avgRelativeHumidity2m).toFixed(1)
  );
  const deltaHumidityPct =
    avgRelativeHumidity2m > 1
      ? Number(((deltaHumidityPctPts / avgRelativeHumidity2m) * 100).toFixed(0))
      : 0;

  const activeAlerts: ProactiveWeatherAlert[] = [];
  const nowIso = new Date().toISOString();

  // 1. Significant Wind Speed Deviation (10m)
  const windSignificantlyElevated =
    (deltaWindMs >= 2.8 && currentWeather.windSpeed10m >= 6.5) ||
    (currentWeather.windSpeed10m > avgWindSpeed10m * 1.35 && currentWeather.windSpeed10m >= 7.0) ||
    currentWeather.windSpeed10m > 10.0;

  if (windSignificantlyElevated) {
    const isCritical = currentWeather.windSpeed10m > 10.0 || deltaWindMs >= 4.5;
    activeAlerts.push({
      id: `pwa-wind-${dateIso}-${currentWeather.hourIndex}`,
      dedupKey: `${dateIso}|${currentWeather.hourIndex}|WIND_SPEED_DEVIATION`,
      kind: 'WIND_SPEED_DEVIATION',
      priority: isCritical ? 'CRITICAL' : 'HIGH',
      title: isCritical
        ? 'Kritisk Vindafvigelse fra 24t Gennemsnit'
        : 'Markant Vindstigning over 24t Gennemsnit',
      message: `Middelvinden (10m) er steget til ${currentWeather.windSpeed10m.toFixed(1)} m/s, hvilket overstiger døgnets 24t-gennemsnit (${avgWindSpeed10m.toFixed(1)} m/s) med +${deltaWindMs.toFixed(1)} m/s (+${Math.max(0, deltaWindPct)}%).`,
      metricLabel: 'Middelvind (10m)',
      currentValueFormatted: `${currentWeather.windSpeed10m.toFixed(1)} m/s`,
      average24hFormatted: `${avgWindSpeed10m.toFixed(1)} m/s`,
      deltaFormatted: `+${deltaWindMs.toFixed(1)} m/s (+${Math.max(0, deltaWindPct)}%)`,
      operationalGuidance:
        currentWeather.windSpeed10m > 10.0
          ? 'Stop straks støvende nedrivning jf. PSS-vindgrænse (>10 m/s) og aktivér vandtåge-dæmpning mod nærliggende beboelse.'
          : 'Forhøjet faneudbredelse og akustisk refraktion mod læ-receptorer — skærp støvbinding og følg S-kvotienten.',
      hourIndex: currentWeather.hourIndex,
      hourLabel: currentWeather.hourLabel,
      dateIso,
      createdAtIso: nowIso,
    });
  }

  // 2. Significant Wind Gust Spike Deviation
  const gustSignificantlyElevated =
    (deltaGustsMs >= 4.0 && currentWeather.windGusts10m >= 11.0) ||
    (currentWeather.windGusts10m > avgWindGusts10m * 1.35 && currentWeather.windGusts10m >= 12.0) ||
    currentWeather.windGusts10m >= 16.0;

  if (gustSignificantlyElevated) {
    const isCritical = currentWeather.windGusts10m >= 15.0 || deltaGustsMs >= 6.5;
    activeAlerts.push({
      id: `pwa-gust-${dateIso}-${currentWeather.hourIndex}`,
      dedupKey: `${dateIso}|${currentWeather.hourIndex}|WIND_GUST_DEVIATION`,
      kind: 'WIND_GUST_DEVIATION',
      priority: isCritical ? 'CRITICAL' : 'HIGH',
      title: isCritical
        ? 'Kritisk Vindstøds-Peak over 24t Gennemsnit'
        : 'Markant Vindstøds-Afvigelse detekteret',
      message: `Vindstød (10m) når ${currentWeather.windGusts10m.toFixed(1)} m/s — en afvigelse på +${deltaGustsMs.toFixed(1)} m/s (+${Math.max(0, deltaGustsPct)}%) over døgnets 24t-gennemsnit (${avgWindGusts10m.toFixed(1)} m/s).`,
      metricLabel: 'Vindstød (10m)',
      currentValueFormatted: `${currentWeather.windGusts10m.toFixed(1)} m/s`,
      average24hFormatted: `${avgWindGusts10m.toFixed(1)} m/s`,
      deltaFormatted: `+${deltaGustsMs.toFixed(1)} m/s (+${Math.max(0, deltaGustsPct)}%)`,
      operationalGuidance:
        'Kraftige vindstød river deponeret asbest- og tungmetalstøv op fra uforseglede grubeområder (resuspension). Kontrollér afdækninger og kranstop.',
      hourIndex: currentWeather.hourIndex,
      hourLabel: currentWeather.hourLabel,
      dateIso,
      createdAtIso: nowIso,
    });
  }

  // 3. Significant Relative Humidity Deviation (either extreme dry resuspension or high-RH inversion/trapping)
  const isDrySpike = deltaHumidityPctPts <= -14 && currentWeather.relativeHumidity2m <= 55;
  const isHumidTrappingSpike =
    deltaHumidityPctPts >= 14 && currentWeather.relativeHumidity2m >= 84;

  if (isDrySpike || isHumidTrappingSpike) {
    const absDelta = Math.abs(deltaHumidityPctPts);
    const isCritical = absDelta >= 22 || currentWeather.relativeHumidity2m <= 35;
    activeAlerts.push({
      id: `pwa-rh-${dateIso}-${currentWeather.hourIndex}`,
      dedupKey: `${dateIso}|${currentWeather.hourIndex}|HUMIDITY_DEVIATION`,
      kind: 'HUMIDITY_DEVIATION',
      priority: isCritical ? 'CRITICAL' : 'HIGH',
      title: isDrySpike
        ? 'Markant Fald i Luftfugtighed (Resuspensions-Risiko)'
        : 'Høj Luftfugtigheds-Afvigelse (Aerosol-Inversion)',
      message: isDrySpike
        ? `Relativ luftfugtighed er faldet til ${currentWeather.relativeHumidity2m.toFixed(0)}%, hvilket er ${deltaHumidityPctPts.toFixed(1)} procentpoint under 24t-gennemsnittet (${avgRelativeHumidity2m.toFixed(1)}%).`
        : `Relativ luftfugtighed er steget til ${currentWeather.relativeHumidity2m.toFixed(0)}%, hvilket er +${deltaHumidityPctPts.toFixed(1)} procentpoint over 24t-gennemsnittet (${avgRelativeHumidity2m.toFixed(1)}%).`,
      metricLabel: 'Luftfugtighed (2m)',
      currentValueFormatted: `${currentWeather.relativeHumidity2m.toFixed(0)}%`,
      average24hFormatted: `${avgRelativeHumidity2m.toFixed(1)}%`,
      deltaFormatted: `${deltaHumidityPctPts >= 0 ? '+' : ''}${deltaHumidityPctPts.toFixed(1)} %-pt (${deltaHumidityPct >= 0 ? '+' : ''}${deltaHumidityPct}%)`,
      operationalGuidance: isDrySpike
        ? 'Tør luft øger elektrostatisk frigivelse af asbestfibre og kvartsstøv markant. Øg frekvensen af befugtning og overfladeforsegling.'
        : 'Høj fugtighed og kondensrisiko holder fine aerosoler og kloak-/skimmeldampe tættere på terræn omkring beboede blokke.',
      hourIndex: currentWeather.hourIndex,
      hourLabel: currentWeather.hourLabel,
      dateIso,
      createdAtIso: nowIso,
    });
  }

  return {
    averages24h: {
      avgWindSpeed10m,
      avgWindGusts10m,
      avgRelativeHumidity2m,
      avgPrecipitationMmH,
      sampleCount: n,
    },
    deviations: {
      deltaWindMs,
      deltaWindPct,
      deltaGustsMs,
      deltaGustsPct,
      deltaHumidityPctPts,
      deltaHumidityPct,
    },
    activeAlerts,
    hasHighPriorityDeviation: activeAlerts.length > 0,
  };
}
