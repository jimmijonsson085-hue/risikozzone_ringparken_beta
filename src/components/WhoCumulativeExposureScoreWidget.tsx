import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckSquare,
  Download,
  Info,
  Layers,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingUp,
  Wind,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  HourlyWeatherPoint,
  PuffAccumulationResult,
  Receptor24hCumulativeSummary,
  ReceptorExposureResult,
} from '../types/dispersion';

interface WhoCumulativeExposureScoreWidgetProps {
  puff24h: PuffAccumulationResult;
  receptorExposures: ReceptorExposureResult[];
  selectedReceptorId: string;
  onSelectReceptor: (receptorId: string) => void;
  selectedHourIndex: number;
  onSelectHour: (hourIndex: number) => void;
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
}

type ChartMode = 'cumulative_score' | 'hourly_pm_who' | 'receptor_comparison';

/**
 * WHO Global Air Quality Guidelines (2021) Reference Thresholds:
 * - PM2.5 24-hour AQG level: 15 µg/m³ (Annual: 5 µg/m³)
 *   Interim Targets (24h): IT-4 = 25, IT-3 = 37.5, IT-2 = 50, IT-1 = 75 µg/m³
 * - PM10 24-hour AQG level: 45 µg/m³ (Annual: 15 µg/m³)
 *   Interim Targets (24h): IT-4 = 50, IT-3 = 75, IT-2 = 100, IT-1 = 150 µg/m³
 */
const WHO_PM25_24H_AQG = 15.0; // µg/m³
const WHO_PM25_IT4 = 25.0;
const WHO_PM25_IT3 = 37.5;
const WHO_PM25_IT2 = 50.0;
const WHO_PM25_IT1 = 75.0;

const WHO_PM10_24H_AQG = 45.0; // µg/m³
const WHO_PM10_IT3 = 75.0;
const WHO_PM10_IT1 = 150.0;

// Colorblind-safe & high-contrast receptor line palette
const RECEPTOR_PALETTE = [
  '#14b8a6', // Teal
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#38bdf8', // Sky
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#fb923c', // Orange
  '#818cf8', // Indigo
];

export interface ReceptorWhoHourlyPoint {
  hourIndex: number;
  hourLabel: string;
  pm25UgM3: number;
  pm10UgM3: number;
  whoHourlyIndex: number;
  hourlyScoreIncrement: number;
  cumulativeScore: number;
  runningMeanPm25: number;
  runningMeanPm10: number;
  sumQuotient: number;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionFromDeg: number;
  plumeDirectionToDeg: number;
}

export interface BreachWeatherForecastSnapshot {
  hourIndex: number;
  hourLabel: string;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionFromDeg: number;
  plumeDirectionToDeg: number;
  pm25AtBreachUgM3: number;
  pm10AtBreachUgM3: number;
  cumulativeScoreAtBreach: number;
}

export interface ReceptorWhoProfile {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  shortName: string;
  address: string;
  color: string;
  distanceMeters: number;
  nearestSourceName: string;
  hourly: ReceptorWhoHourlyPoint[];
  scoreAtSelectedHour: number;
  score24hTotal: number;
  dailyBudgetRatio24h: number; // score24hTotal / 25.0 (WHO daily recommendation budget)
  mean24hPm25UgM3: number;
  peakPm25UgM3: number;
  mean24hPm10UgM3: number;
  peakPm10UgM3: number;
  pm25WhoRatio: number; // mean24hPm25 / 15 µg/m³
  pm10WhoRatio: number; // mean24hPm10 / 45 µg/m³
  hoursExceedingWhoPm25: number;
  hoursExceedingWhoPm10: number;
  airQPlusRelativeRisk: number; // RR based on WHO AirQ+ linear-log beta coefficient
  excessRiskPct: number;
  whoTierLabel: string;
  whoTierSeverity: 'safe' | 'moderate' | 'elevated' | 'critical';
  // Early breach before end of day based on 24h weather forecast
  whoAqgBreachHourIndex: number | null;
  whoAqgBreachHourLabel: string | null;
  whoIt3BreachHourIndex: number | null;
  whoIt3BreachHourLabel: string | null;
  whoIt1BreachHourIndex: number | null;
  whoIt1BreachHourLabel: string | null;
  exceedsWhoDailyBeforeEndOfDay: boolean;
  hoursBeforeEndOfDayAtBreach: number;
  isAlreadyBreachedAtSelectedHour: boolean;
  hoursUntilBreachFromSelectedHour: number;
  breachWeatherForecast: BreachWeatherForecastSnapshot | null;
}

function classifyWhoScore(score24h: number, meanPm25: number): {
  label: string;
  severity: 'safe' | 'moderate' | 'elevated' | 'critical';
} {
  if (score24h >= 75 || meanPm25 >= WHO_PM25_IT1) {
    return {
      label: 'Kritisk Overskridelse (> WHO IT-1)',
      severity: 'critical',
    };
  }
  if (score24h >= 50 || meanPm25 >= WHO_PM25_IT3) {
    return {
      label: 'Høj Sundhedsrisiko (> WHO IT-3)',
      severity: 'elevated',
    };
  }
  if (score24h >= 25 || meanPm25 > WHO_PM25_24H_AQG) {
    return {
      label: 'Overskrider WHO AQG (Moderat / IT-4)',
      severity: 'moderate',
    };
  }
  return {
    label: 'Overholder WHO 2021 AQG (<15 µg/m³)',
    severity: 'safe',
  };
}

export function buildReceptorWhoProfile(
  rec: Receptor24hCumulativeSummary,
  idx: number,
  selectedHourIndex: number,
  includeIarcToxicityWeighting = true,
  includeUrbanBackground = true
): ReceptorWhoProfile {
  const baseBgPm25 = includeUrbanBackground ? 9.2 : 0;
  const baseBgPm10 = includeUrbanBackground ? 16.5 : 0;
  const color = RECEPTOR_PALETTE[idx % RECEPTOR_PALETTE.length];
  const shortName = rec.receptorName.split('(')[0].trim();

  let cumulativeScore = 0;
  let sumPm25 = 0;
  let sumPm10 = 0;
  let peakPm25 = 0;
  let peakPm10 = 0;
  let hoursExceedingWhoPm25 = 0;
  let hoursExceedingWhoPm10 = 0;

  let whoAqgBreachHourIndex: number | null = null;
  let whoIt3BreachHourIndex: number | null = null;
  let whoIt1BreachHourIndex: number | null = null;

  const hourly: ReceptorWhoHourlyPoint[] = rec.hourlyProfile.map((h) => {
    const plumePm25 = h.sumQuotient * 18.4 + h.depositedDustUgM2 * 0.42;
    const plumePm10 = h.sumQuotient * 42.0 + h.depositedDustUgM2 * 1.15;

    const pm25UgM3 = Number((baseBgPm25 + plumePm25).toFixed(1));
    const pm10UgM3 = Number((baseBgPm10 + plumePm10).toFixed(1));

    if (pm25UgM3 > WHO_PM25_24H_AQG) hoursExceedingWhoPm25 += 1;
    if (pm10UgM3 > WHO_PM10_24H_AQG) hoursExceedingWhoPm10 += 1;

    sumPm25 += pm25UgM3;
    sumPm10 += pm10UgM3;
    if (pm25UgM3 > peakPm25) peakPm25 = pm25UgM3;
    if (pm10UgM3 > peakPm10) peakPm10 = pm10UgM3;

    const pm25Norm = pm25UgM3 / WHO_PM25_24H_AQG;
    const pm10Norm = pm10UgM3 / WHO_PM10_24H_AQG;

    const iarcToxicityFactor = includeIarcToxicityWeighting
      ? 1 +
        Math.min(
          1.4,
          h.sumQuotient * 0.48 +
            (h.depositedAsbestosFibersM2 > 0
              ? Math.min(0.45, h.depositedAsbestosFibersM2 / 900)
              : 0)
        )
      : 1.0;

    const whoHourlyIndex =
      (0.65 * pm25Norm + 0.35 * pm10Norm) * iarcToxicityFactor;

    const hourlyScoreIncrement = Number(
      ((whoHourlyIndex * 25.0) / 24.0).toFixed(2)
    );
    cumulativeScore = Number(
      (cumulativeScore + hourlyScoreIncrement).toFixed(2)
    );

    if (whoAqgBreachHourIndex === null && cumulativeScore >= 25.0) {
      whoAqgBreachHourIndex = h.hourIndex;
    }
    if (whoIt3BreachHourIndex === null && cumulativeScore >= 50.0) {
      whoIt3BreachHourIndex = h.hourIndex;
    }
    if (whoIt1BreachHourIndex === null && cumulativeScore >= 75.0) {
      whoIt1BreachHourIndex = h.hourIndex;
    }

    const countSoFar = h.hourIndex + 1;
    return {
      hourIndex: h.hourIndex,
      hourLabel: h.hourLabel,
      pm25UgM3,
      pm10UgM3,
      whoHourlyIndex: Number(whoHourlyIndex.toFixed(2)),
      hourlyScoreIncrement,
      cumulativeScore,
      runningMeanPm25: Number((sumPm25 / countSoFar).toFixed(1)),
      runningMeanPm10: Number((sumPm10 / countSoFar).toFixed(1)),
      sumQuotient: Number(h.sumQuotient.toFixed(2)),
      windSpeedMs: h.windSpeedMs,
      windGustsMs: h.windGustsMs,
      windDirectionFromDeg: h.windDirectionFromDeg,
      plumeDirectionToDeg: h.plumeDirectionToDeg,
    };
  });

  const mean24hPm25UgM3 = Number((sumPm25 / 24).toFixed(1));
  const mean24hPm10UgM3 = Number((sumPm10 / 24).toFixed(1));
  const scoreAtSelectedHour =
    hourly[selectedHourIndex]?.cumulativeScore ?? cumulativeScore;

  const deltaAboveAnnualWho = Math.max(0, mean24hPm25UgM3 - 5.0);
  const effectiveBeta = includeIarcToxicityWeighting ? 0.0024 : 0.0015;
  const airQPlusRelativeRisk = Number(
    Math.exp(effectiveBeta * deltaAboveAnnualWho).toFixed(3)
  );
  const excessRiskPct = Number(
    ((airQPlusRelativeRisk - 1) * 100).toFixed(1)
  );

  const tier = classifyWhoScore(cumulativeScore, mean24hPm25UgM3);

  const whoAqgBreachHourLabel =
    whoAqgBreachHourIndex !== null
      ? `${String(whoAqgBreachHourIndex).padStart(2, '0')}:00`
      : null;
  const whoIt3BreachHourLabel =
    whoIt3BreachHourIndex !== null
      ? `${String(whoIt3BreachHourIndex).padStart(2, '0')}:00`
      : null;
  const whoIt1BreachHourLabel =
    whoIt1BreachHourIndex !== null
      ? `${String(whoIt1BreachHourIndex).padStart(2, '0')}:00`
      : null;

  const exceedsWhoDailyBeforeEndOfDay =
    whoAqgBreachHourIndex !== null &&
    (whoAqgBreachHourIndex < 23 || cumulativeScore > 25.0);
  const hoursBeforeEndOfDayAtBreach =
    whoAqgBreachHourIndex !== null ? 23 - whoAqgBreachHourIndex : 0;
  const isAlreadyBreachedAtSelectedHour =
    whoAqgBreachHourIndex !== null && selectedHourIndex >= whoAqgBreachHourIndex;
  const hoursUntilBreachFromSelectedHour =
    whoAqgBreachHourIndex !== null
      ? Math.max(0, whoAqgBreachHourIndex - selectedHourIndex)
      : 0;

  const breachPoint =
    whoAqgBreachHourIndex !== null ? hourly[whoAqgBreachHourIndex] : null;
  const breachWeatherForecast: BreachWeatherForecastSnapshot | null =
    breachPoint
      ? {
          hourIndex: breachPoint.hourIndex,
          hourLabel: breachPoint.hourLabel,
          windSpeedMs: breachPoint.windSpeedMs,
          windGustsMs: breachPoint.windGustsMs,
          windDirectionFromDeg: breachPoint.windDirectionFromDeg,
          plumeDirectionToDeg: breachPoint.plumeDirectionToDeg,
          pm25AtBreachUgM3: breachPoint.pm25UgM3,
          pm10AtBreachUgM3: breachPoint.pm10UgM3,
          cumulativeScoreAtBreach: breachPoint.cumulativeScore,
        }
      : null;

  return {
    receptorId: rec.receptorId,
    receptorCode: rec.receptorCode,
    receptorName: rec.receptorName,
    shortName,
    address: rec.address,
    color,
    distanceMeters: rec.distanceToNearestSourceMeters,
    nearestSourceName: rec.nearestSourceName,
    hourly,
    scoreAtSelectedHour,
    score24hTotal: cumulativeScore,
    dailyBudgetRatio24h: Number((cumulativeScore / 25.0).toFixed(2)),
    mean24hPm25UgM3,
    peakPm25UgM3: Number(peakPm25.toFixed(1)),
    mean24hPm10UgM3,
    peakPm10UgM3: Number(peakPm10.toFixed(1)),
    pm25WhoRatio: Number((mean24hPm25UgM3 / WHO_PM25_24H_AQG).toFixed(2)),
    pm10WhoRatio: Number((mean24hPm10UgM3 / WHO_PM10_24H_AQG).toFixed(2)),
    hoursExceedingWhoPm25,
    hoursExceedingWhoPm10,
    airQPlusRelativeRisk,
    excessRiskPct,
    whoTierLabel: tier.label,
    whoTierSeverity: tier.severity,
    whoAqgBreachHourIndex,
    whoAqgBreachHourLabel,
    whoIt3BreachHourIndex,
    whoIt3BreachHourLabel,
    whoIt1BreachHourIndex,
    whoIt1BreachHourLabel,
    exceedsWhoDailyBeforeEndOfDay,
    hoursBeforeEndOfDayAtBreach,
    isAlreadyBreachedAtSelectedHour,
    hoursUntilBreachFromSelectedHour,
    breachWeatherForecast,
  };
}

export const WhoCumulativeExposureScoreWidget: React.FC<
  WhoCumulativeExposureScoreWidgetProps
> = ({
  puff24h,
  receptorExposures,
  selectedReceptorId,
  onSelectReceptor,
  selectedHourIndex,
  onSelectHour,
  currentWeather,
  dateIso,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('cumulative_score');
  const [includeIarcToxicityWeighting, setIncludeIarcToxicityWeighting] =
    useState<boolean>(true);
  const [includeUrbanBackground, setIncludeUrbanBackground] =
    useState<boolean>(true);

  const [checkedReceptorIds, setCheckedReceptorIds] = useState<string[]>(() => {
    const initialIds = puff24h.receptorSummaries
      .slice(0, 4)
      .map((r) => r.receptorId);
    if (selectedReceptorId && !initialIds.includes(selectedReceptorId)) {
      initialIds.push(selectedReceptorId);
    }
    return initialIds;
  });

  const effectiveSelectedIds = useMemo(() => {
    const set = new Set(checkedReceptorIds);
    if (selectedReceptorId) {
      set.add(selectedReceptorId);
    }
    return Array.from(set);
  }, [checkedReceptorIds, selectedReceptorId]);

  const toggleReceptorSelection = (recId: string) => {
    setCheckedReceptorIds((prev) => {
      if (prev.includes(recId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== recId);
      }
      return [...prev, recId];
    });
  };

  const handleSelectAllReceptors = () => {
    setCheckedReceptorIds(puff24h.receptorSummaries.map((r) => r.receptorId));
  };

  const handleSelectTop3Receptors = () => {
    const sorted = [...puff24h.receptorSummaries]
      .sort((a, b) => b.cumulativeSumDose - a.cumulativeSumDose)
      .slice(0, 3)
      .map((r) => r.receptorId);
    setCheckedReceptorIds(sorted);
  };

  const handleSelectOnlyActiveReceptor = () => {
    if (selectedReceptorId) {
      setCheckedReceptorIds([selectedReceptorId]);
    }
  };

  const receptorWhoProfiles: ReceptorWhoProfile[] = useMemo(() => {
    return puff24h.receptorSummaries.map((rec, idx) =>
      buildReceptorWhoProfile(
        rec,
        idx,
        selectedHourIndex,
        includeIarcToxicityWeighting,
        includeUrbanBackground
      )
    );
  }, [
    puff24h.receptorSummaries,
    includeIarcToxicityWeighting,
    includeUrbanBackground,
    selectedHourIndex,
  ]);

  const activeReceptorProfile = useMemo(() => {
    return (
      receptorWhoProfiles.find((r) => r.receptorId === selectedReceptorId) ||
      receptorWhoProfiles[0]
    );
  }, [receptorWhoProfiles, selectedReceptorId]);

  const selectedReceptorProfiles = useMemo(() => {
    return receptorWhoProfiles.filter((r) =>
      effectiveSelectedIds.includes(r.receptorId)
    );
  }, [receptorWhoProfiles, effectiveSelectedIds]);

  const breachingSelectedProfiles = useMemo(() => {
    return selectedReceptorProfiles.filter(
      (r) => r.exceedsWhoDailyBeforeEndOfDay
    );
  }, [selectedReceptorProfiles]);

  // Multi-series hourly chart dataset (00:00 .. 23:00)
  const hourlyMultiReceptorChartData = useMemo(() => {
    return Array.from({ length: 24 }, (_, hourIdx) => {
      const hourLabel = `${String(hourIdx).padStart(2, '0')}:00`;
      const row: Record<string, any> = {
        hourIndex: hourIdx,
        hourLabel,
        whoAqgScoreTrajectory: Number((((hourIdx + 1) / 24) * 25).toFixed(1)),
        whoPm25Limit: WHO_PM25_24H_AQG,
        whoPm10Limit: WHO_PM10_24H_AQG,
      };

      receptorWhoProfiles.forEach((prof) => {
        const pt = prof.hourly[hourIdx];
        if (pt) {
          row[`score_${prof.receptorId}`] = pt.cumulativeScore;
          row[`pm25_${prof.receptorId}`] = pt.pm25UgM3;
          row[`pm10_${prof.receptorId}`] = pt.pm10UgM3;
          row[`incr_${prof.receptorId}`] = pt.hourlyScoreIncrement;
        }
      });

      // Also attach active receptor's direct PM2.5 / PM10 for the hourly_pm_who chart
      if (activeReceptorProfile) {
        const activePt = activeReceptorProfile.hourly[hourIdx];
        row.activePm25 = activePt?.pm25UgM3 ?? 0;
        row.activePm10 = activePt?.pm10UgM3 ?? 0;
        row.activeRunningMeanPm25 = activePt?.runningMeanPm25 ?? 0;
        row.activeCumulativeScore = activePt?.cumulativeScore ?? 0;
      }

      return row;
    });
  }, [receptorWhoProfiles, activeReceptorProfile]);

  // Export CSV handler
  const handleDownloadWhoCsv = () => {
    const headers = [
      'Dato',
      'Receptor_Kode',
      'Receptor_Navn',
      'Adresse',
      'Afstand_Kilde_m',
      'KES_WHO_Ved_Valgt_Time',
      'KES_WHO_24t_Total',
      'PM25_24t_Middel_ug_m3',
      'PM25_Peak_ug_m3',
      'PM25_WHO_AQG_Ratio',
      'PM10_24t_Middel_ug_m3',
      'PM10_Peak_ug_m3',
      'PM10_WHO_AQG_Ratio',
      'Timer_Over_WHO_PM25_15ug',
      'WHO_AirQ_Relativ_Risiko_RR',
      'Overrisiko_Pct',
      'WHO_Klassifikation',
    ];

    const rows = receptorWhoProfiles.map((r) => [
      dateIso,
      r.receptorCode,
      `"${r.receptorName}"`,
      `"${r.address}"`,
      r.distanceMeters,
      r.scoreAtSelectedHour,
      r.score24hTotal,
      r.mean24hPm25UgM3,
      r.peakPm25UgM3,
      r.pm25WhoRatio,
      r.mean24hPm10UgM3,
      r.peakPm10UgM3,
      r.pm10WhoRatio,
      r.hoursExceedingWhoPm25,
      r.airQPlusRelativeRisk,
      r.excessRiskPct,
      `"${r.whoTierLabel}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `WHO_Kumulativ_Eksponeringsscore_Ringparken_${dateIso}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!activeReceptorProfile) return null;

  return (
    <div className="p-3.5 bg-slate-900/90 border border-teal-500/40 rounded-md space-y-3.5">
      {/* Header & Regulatory Context */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300 font-mono">
              WHO Kumulativ Eksponeringsscore (AirQ+ / WHO AQG 2021)
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Beregner den akkumulerede partikeleksponeringsscore (
            <strong className="text-white font-mono">KES_WHO</strong>) for valgte
            receptorer baseret på{' '}
            <strong className="text-teal-200">
              WHO Global Air Quality Guidelines (2021)
            </strong>{' '}
            for luftbårne partikler (
            <span className="font-mono text-amber-300">
              PM2.5 24t AQG = 15 µg/m³
            </span>{' '}
            ·{' '}
            <span className="font-mono text-cyan-300">
              PM10 24t AQG = 45 µg/m³
            </span>
            ) kombineret med IARC Gruppe 1 karcinogen støvvægtning.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadWhoCsv}
            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-teal-300 border border-teal-500/40 text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Download WHO Kumulativ Eksponeringsscore som CSV-bevisbilag"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Eksport</span>
          </button>
        </div>
      </div>

      {/* VISUAL FORECAST WARNING: CUMULATIVE DUST SCORE EXCEEDS WHO DAILY RECOMMENDATION BEFORE END OF DAY */}
      {activeReceptorProfile.exceedsWhoDailyBeforeEndOfDay ? (
        <div
          className={`p-3 rounded-md border space-y-2.5 ${
            activeReceptorProfile.score24hTotal >= 50
              ? 'bg-rose-950/45 border-rose-500/60'
              : 'bg-amber-950/45 border-amber-500/60'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <ShieldAlert
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  activeReceptorProfile.score24hTotal >= 50
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              />
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-white">
                  <span>
                    {activeReceptorProfile.isAlreadyBreachedAtSelectedHour
                      ? `AKUT ADVARSEL: WHO's Daglige Anbefaling Overskredet kl. ${activeReceptorProfile.whoAqgBreachHourLabel}`
                      : `VEJRUDSIGTS-ADVARSEL: WHO's Daglige Anbefaling Overskrides Før Dagens Afslutning (kl. ${activeReceptorProfile.whoAqgBreachHourLabel})`}
                  </span>
                  <span className="text-[11px] font-normal text-rose-200">
                    · {activeReceptorProfile.hoursBeforeEndOfDayAtBreach} timer før
                    døgnets afslutning
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  Baseret på døgnets vejrudsigt ({dateIso}) opbruger{' '}
                  <strong className="text-white">
                    {activeReceptorProfile.shortName}
                  </strong>{' '}
                  100% af WHO&apos;s anbefalede daglige støvbudget (
                  <span className="font-mono text-amber-200">
                    KES_WHO = 25,0 pt · 15 µg/m³ PM2.5
                  </span>
                  ) allerede kl.{' '}
                  <strong className="font-mono text-rose-300">
                    {activeReceptorProfile.whoAqgBreachHourLabel}
                  </strong>
                  {activeReceptorProfile.isAlreadyBreachedAtSelectedHour ? (
                    <span>
                      {' '}
                      (allerede overskredet ved valgt time{' '}
                      <span className="font-mono">
                        {currentWeather.hourLabel}
                      </span>{' '}
                      med{' '}
                      <span className="font-mono font-bold text-rose-300">
                        {activeReceptorProfile.scoreAtSelectedHour.toFixed(1)} pt
                      </span>
                      ).
                    </span>
                  ) : (
                    <span>
                      {' '}
                      (indtræffer om{' '}
                      <strong className="font-mono text-amber-300">
                        {
                          activeReceptorProfile.hoursUntilBreachFromSelectedHour
                        }{' '}
                        timer
                      </strong>{' '}
                      fra valgt time {currentWeather.hourLabel}).
                    </span>
                  )}{' '}
                  Ved dagens afslutning (kl. 23:00) prognosticerer modellen en
                  kumulativ score på{' '}
                  <strong className="font-mono text-rose-300">
                    {activeReceptorProfile.score24hTotal.toFixed(1)} pt (
                    {activeReceptorProfile.dailyBudgetRatio24h}× WHO&apos;s
                    døgngrænse)
                  </strong>
                  .
                </p>
              </div>
            </div>

            {activeReceptorProfile.whoAqgBreachHourIndex !== null && (
              <button
                type="button"
                onClick={() =>
                  onSelectHour(activeReceptorProfile.whoAqgBreachHourIndex!)
                }
                className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-mono text-[11px] font-bold transition-colors whitespace-nowrap shrink-0"
                title="Synkronisér tidslinjen til tidspunktet hvor WHO's døgngrænse overskrides"
              >
                Spring til kl. {activeReceptorProfile.whoAqgBreachHourLabel}
              </button>
            )}
          </div>

          {/* 24-Hour Segmented Forecast Timeline Bar showing exact hour of daily WHO budget exhaustion */}
          <div className="p-2 rounded bg-slate-950/90 border border-slate-800/90 space-y-1.5 font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <span>
                24-Timers Prognose-Tidslinje for WHO Døgnbudget (00:00 → 23:00):
              </span>
              <span className="tabular-nums text-amber-300">
                Grænsebrud kl. {activeReceptorProfile.whoAqgBreachHourLabel}
                {activeReceptorProfile.whoIt3BreachHourLabel
                  ? ` · IT-3 (50 pt) kl. ${activeReceptorProfile.whoIt3BreachHourLabel}`
                  : ''}
                {activeReceptorProfile.whoIt1BreachHourLabel
                  ? ` · IT-1 Kritisk (75 pt) kl. ${activeReceptorProfile.whoIt1BreachHourLabel}`
                  : ''}
              </span>
            </div>

            <div className="grid grid-cols-24 gap-0.5 h-3.5 rounded overflow-hidden bg-slate-900 p-0.5">
              {activeReceptorProfile.hourly.map((pt) => {
                const isBreachHour =
                  pt.hourIndex === activeReceptorProfile.whoAqgBreachHourIndex;
                const isCurrentHour = pt.hourIndex === selectedHourIndex;
                const cellColor =
                  pt.cumulativeScore >= 75
                    ? 'bg-rose-500'
                    : pt.cumulativeScore >= 50
                    ? 'bg-amber-500'
                    : pt.cumulativeScore >= 25
                    ? 'bg-orange-400'
                    : 'bg-emerald-500/75';
                return (
                  <button
                    key={pt.hourIndex}
                    type="button"
                    onClick={() => onSelectHour(pt.hourIndex)}
                    title={`${pt.hourLabel} · KES_WHO: ${pt.cumulativeScore.toFixed(1)} pt · PM2.5: ${pt.pm25UgM3} µg/m³ · Vind: ${pt.windSpeedMs} m/s`}
                    className={`h-full rounded-xs transition-opacity hover:opacity-100 ${cellColor} ${
                      isBreachHour || isCurrentHour
                        ? 'ring-1 ring-white opacity-100'
                        : 'opacity-85'
                    }`}
                  />
                );
              })}
            </div>

            {activeReceptorProfile.breachWeatherForecast && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-0.5">
                <div>
                  <span className="text-slate-300 font-semibold">
                    Meteorologisk årsag kl.{' '}
                    {activeReceptorProfile.breachWeatherForecast.hourLabel}:
                  </span>{' '}
                  Vind{' '}
                  <span className="text-white tabular-nums">
                    {activeReceptorProfile.breachWeatherForecast.windSpeedMs}{' '}
                    m/s
                  </span>{' '}
                  (stød{' '}
                  <span className="text-amber-300 tabular-nums">
                    {activeReceptorProfile.breachWeatherForecast.windGustsMs}{' '}
                    m/s
                  </span>
                  ) fra{' '}
                  <span className="text-cyan-300 tabular-nums">
                    {
                      activeReceptorProfile.breachWeatherForecast
                        .windDirectionFromDeg
                    }
                    °
                  </span>{' '}
                  → PM2.5:{' '}
                  <span className="text-rose-300 font-bold tabular-nums">
                    {
                      activeReceptorProfile.breachWeatherForecast
                        .pm25AtBreachUgM3
                    }{' '}
                    µg/m³
                  </span>
                </div>
                <div className="text-slate-400">
                  Kilde: {activeReceptorProfile.nearestSourceName} (
                  {activeReceptorProfile.distanceMeters} m)
                </div>
              </div>
            )}
          </div>

          {/* Multi-receptor breach overview when multiple selected receptors exceed before end of day */}
          {breachingSelectedProfiles.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-mono">
              <span className="text-slate-300">
                Øvrige valgte receptorer over WHO døgngrænse før kl. 23:59 (
                {breachingSelectedProfiles.length} af{' '}
                {selectedReceptorProfiles.length}):
              </span>
              {breachingSelectedProfiles.map((prof) => (
                <button
                  key={prof.receptorId}
                  type="button"
                  onClick={() => {
                    onSelectReceptor(prof.receptorId);
                    if (prof.whoAqgBreachHourIndex !== null) {
                      onSelectHour(prof.whoAqgBreachHourIndex);
                    }
                  }}
                  className={`px-2 py-0.5 rounded border transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    prof.receptorId === activeReceptorProfile.receptorId
                      ? 'bg-rose-500/25 border-rose-400 text-white font-bold'
                      : 'bg-slate-950/90 border-slate-700 text-slate-300 hover:border-rose-400/60 hover:text-white'
                  }`}
                >
                  {prof.shortName}: kl. {prof.whoAqgBreachHourLabel} (
                  {prof.score24hTotal.toFixed(1)} pt)
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-2.5 rounded-md bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs font-mono text-emerald-200">
          <span>
            PROGNOSESTATUS: {activeReceptorProfile.shortName} overholder
            WHO&apos;s daglige anbefaling (&lt; 25,0 pt) frem til døgnets
            afslutning kl. 23:59 ({activeReceptorProfile.score24hTotal.toFixed(1)}{' '}
            pt).
          </span>
        </div>
      )}

      {/* Top KPI Summary Strip for Active Receptor */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
          <div className="text-[11px] text-slate-400 uppercase truncate">
            KES_WHO ({currentWeather.hourLabel} / 24t)
          </div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span
              className={`text-lg font-bold ${
                activeReceptorProfile.score24hTotal >= 75
                  ? 'text-rose-400'
                  : activeReceptorProfile.score24hTotal >= 50
                  ? 'text-amber-400'
                  : activeReceptorProfile.score24hTotal >= 25
                  ? 'text-yellow-300'
                  : 'text-emerald-400'
              }`}
            >
              {activeReceptorProfile.scoreAtSelectedHour.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">
              / {activeReceptorProfile.score24hTotal.toFixed(1)} pt
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            WHO 24t AQG tærskel = 25,0 pt
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
          <div className="text-[11px] text-slate-400 uppercase truncate">
            PM2.5 Døgnmiddel (WHO ≤ 15)
          </div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span
              className={`text-lg font-bold ${
                activeReceptorProfile.mean24hPm25UgM3 > WHO_PM25_24H_AQG
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}
            >
              {activeReceptorProfile.mean24hPm25UgM3}
            </span>
            <span className="text-[11px] text-slate-400">µg/m³</span>
          </div>
          <div className="text-[11px] text-amber-300 truncate tabular-nums">
            {activeReceptorProfile.pm25WhoRatio}× WHO AQG · Peak:{' '}
            {activeReceptorProfile.peakPm25UgM3} µg/m³
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
          <div className="text-[11px] text-slate-400 uppercase truncate">
            PM10 Døgnmiddel (WHO ≤ 45)
          </div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span
              className={`text-lg font-bold ${
                activeReceptorProfile.mean24hPm10UgM3 > WHO_PM10_24H_AQG
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {activeReceptorProfile.mean24hPm10UgM3}
            </span>
            <span className="text-[11px] text-slate-400">µg/m³</span>
          </div>
          <div className="text-[11px] text-cyan-300 truncate tabular-nums">
            {activeReceptorProfile.pm10WhoRatio}× WHO AQG ·{' '}
            {activeReceptorProfile.hoursExceedingWhoPm25}t &gt; AQG
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
          <div className="text-[11px] text-slate-400 uppercase truncate">
            WHO AirQ+ Relativ Risiko (RR)
          </div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-lg font-bold text-rose-300">
              {activeReceptorProfile.airQPlusRelativeRisk.toFixed(3)}
            </span>
            <span className="text-[11px] text-rose-400 font-semibold">
              (+{activeReceptorProfile.excessRiskPct}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-300 truncate">
            {activeReceptorProfile.shortName}
          </div>
        </div>
      </div>

      {/* Multi-Receptor Selector & Model Calibration Controls */}
      <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-md space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-mono font-semibold text-slate-300 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-teal-400" />
            <span>
              Vælg Receptorer til Kumulativ Graf-Sammenligning (
              {selectedReceptorProfiles.length} af {receptorWhoProfiles.length}{' '}
              valgt):
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleSelectTop3Receptors}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono transition-colors whitespace-nowrap shrink-0"
            >
              Top 3 Mest Eksponerede
            </button>
            <button
              type="button"
              onClick={handleSelectAllReceptors}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono transition-colors whitespace-nowrap shrink-0"
            >
              Vælg Alle ({receptorWhoProfiles.length})
            </button>
            <button
              type="button"
              onClick={handleSelectOnlyActiveReceptor}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono transition-colors whitespace-nowrap shrink-0"
            >
              Kun Aktiv Receptor
            </button>
          </div>
        </div>

        {/* Receptor Toggle Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {receptorWhoProfiles.map((prof) => {
            const isChecked = effectiveSelectedIds.includes(prof.receptorId);
            const isPrimaryActive = prof.receptorId === selectedReceptorId;
            return (
              <div
                key={prof.receptorId}
                className={`p-1.5 rounded border flex items-center justify-between gap-1.5 text-[11px] font-mono transition-colors ${
                  isPrimaryActive
                    ? 'bg-teal-950/50 border-teal-400 text-white'
                    : isChecked
                    ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                    : 'bg-slate-950/50 border-slate-800/80 text-slate-500'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleReceptorSelection(prof.receptorId)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                  title="Til/fravælg receptor i den interaktive graf"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0 border border-white/20"
                    style={{
                      backgroundColor: isChecked ? prof.color : 'transparent',
                    }}
                  />
                  <span className="truncate font-semibold">{prof.shortName}</span>
                </button>

                <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  <span
                    className={`text-[11px] font-bold ${
                      prof.score24hTotal >= 75
                        ? 'text-rose-400'
                        : prof.score24hTotal >= 50
                        ? 'text-amber-400'
                        : prof.score24hTotal >= 25
                        ? 'text-yellow-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {prof.score24hTotal.toFixed(1)} pt
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectReceptor(prof.receptorId)}
                    className={`px-1.5 py-0.5 rounded text-[11px] uppercase transition-colors whitespace-nowrap shrink-0 ${
                      isPrimaryActive
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                    title="Sæt som primær aktiv receptor i Bio-Toks panelet"
                  >
                    {isPrimaryActive ? 'Aktiv' : 'Fokus'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Calibration Parameter Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={includeIarcToxicityWeighting}
                onChange={(e) =>
                  setIncludeIarcToxicityWeighting(e.target.checked)
                }
                className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0"
              />
              <span>
                Inkludér IARC Gr. 1 Toksicitets-vægtning (Asbest/Kvarts/Tungmetal)
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={includeUrbanBackground}
                onChange={(e) => setIncludeUrbanBackground(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-0"
              />
              <span>
                Inkludér Regional Baggrundskoncentration (Slagelse By: 9,2 µg/m³
                PM2.5)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Interactive Chart Mode Switcher */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setChartMode('cumulative_score')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'cumulative_score'
                  ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1. Kumulativ Eksponeringsscore (00:00–23:00)
            </button>
            <button
              type="button"
              onClick={() => setChartMode('hourly_pm_who')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'hourly_pm_who'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2. PM2.5 &amp; PM10 vs. WHO 2021 Grænser
            </button>
            <button
              type="button"
              onClick={() => setChartMode('receptor_comparison')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'receptor_comparison'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3. Receptor-Sammenligning &amp; Interim Targets
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Klik på et tidspunkt i grafen for at synkronisere simulationstimen (
            {currentWeather.hourLabel})
          </span>
        </div>

        {/* CHART 1: CUMULATIVE EXPOSURE SCORE TRAJECTORIES FOR SELECTED RECEPTORS */}
        {chartMode === 'cumulative_score' && (
          <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-md space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-slate-300 font-semibold">
                Udvikling i Kumulativ Eksponeringsscore (KES_WHO) over 24 timer
              </span>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="text-emerald-400">
                  ── WHO AQG 24t Budget (25 pt)
                </span>
                <span className="text-amber-400">
                  ── WHO IT-3 Tærskel (50 pt)
                </span>
                <span className="text-rose-400">
                  ── WHO IT-1 Kritisk (75 pt)
                </span>
              </div>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={hourlyMultiReceptorChartData}
                  margin={{ top: 10, right: 18, left: 0, bottom: 5 }}
                  onClick={(state: any) => {
                    if (
                      state &&
                      typeof state.activeTooltipIndex === 'number' &&
                      state.activeTooltipIndex >= 0 &&
                      state.activeTooltipIndex < 24
                    ) {
                      onSelectHour(state.activeTooltipIndex);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="hourLabel"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                    label={{
                      value: 'Kumulativ Score (KES_WHO)',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        fill: '#94a3b8',
                        fontSize: 10,
                        fontFamily: 'monospace',
                      },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#f8fafc',
                    }}
                    formatter={(value: any, name: any) => {
                      const label = String(name ?? '');
                      if (label === 'WHO AQG Reference-spor (Max 25 pt)') {
                        return [`${Number(value).toFixed(1)} pt`, label];
                      }
                      return [`${Number(value).toFixed(2)} pt`, label];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                  />

                  {/* WHO Threshold Reference Lines */}
                  <ReferenceLine
                    y={25}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: 'WHO 2021 24t AQG (25 pt)',
                      position: 'insideTopRight',
                      fill: '#10b981',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={50}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: 'WHO Interim Target 3 (50 pt)',
                      position: 'insideTopRight',
                      fill: '#f59e0b',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={75}
                    stroke="#f43f5e"
                    strokeDasharray="4 4"
                    label={{
                      value: 'WHO Interim Target 1 Kritisk (75 pt)',
                      position: 'insideTopRight',
                      fill: '#f43f5e',
                      fontSize: 10,
                    }}
                  />

                  {/* Active Hour Vertical Indicator */}
                  <ReferenceLine
                    x={`${String(selectedHourIndex).padStart(2, '0')}:00`}
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    label={{
                      value: `Aktiv (${currentWeather.hourLabel})`,
                      position: 'top',
                      fill: '#38bdf8',
                      fontSize: 10,
                    }}
                  />

                  {/* Forecast WHO Daily Limit Breach Hour Vertical Marker */}
                  {activeReceptorProfile.exceedsWhoDailyBeforeEndOfDay &&
                    activeReceptorProfile.whoAqgBreachHourLabel && (
                      <ReferenceLine
                        x={activeReceptorProfile.whoAqgBreachHourLabel}
                        stroke="#fb7185"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        label={{
                          value: `WHO Grænse Brudt (${activeReceptorProfile.whoAqgBreachHourLabel})`,
                          position: 'insideBottomRight',
                          fill: '#fb7185',
                          fontSize: 10,
                        }}
                      />
                    )}

                  {/* Linear WHO 24h Safe Budget Reference Trajectory */}
                  <Line
                    type="monotone"
                    dataKey="whoAqgScoreTrajectory"
                    name="WHO AQG Reference-spor (Max 25 pt)"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />

                  {/* Selected Receptor Cumulative Curves */}
                  {selectedReceptorProfiles.map((prof) => {
                    const isPrimary = prof.receptorId === selectedReceptorId;
                    return (
                      <Line
                        key={prof.receptorId}
                        type="monotone"
                        dataKey={`score_${prof.receptorId}`}
                        name={`${prof.shortName} (${prof.score24hTotal.toFixed(1)} pt)`}
                        stroke={prof.color}
                        strokeWidth={isPrimary ? 3 : 1.8}
                        dot={
                          isPrimary ? { r: 2.5, fill: prof.color } : false
                        }
                        activeDot={{ r: 5 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CHART 2: HOURLY PM2.5 & PM10 CONCENTRATIONS VS WHO 2021 AQG FOR ACTIVE RECEPTOR */}
        {chartMode === 'hourly_pm_who' && (
          <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-md space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-slate-300 font-semibold">
                Time-for-time PM2.5 &amp; PM10 (µg/m³) ved{' '}
                <strong className="text-teal-300">
                  {activeReceptorProfile.shortName}
                </strong>{' '}
                mod WHO 2021 AQG
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-emerald-400">
                  ── WHO PM2.5 24t AQG (15 µg/m³)
                </span>
                <span className="text-cyan-400">
                  ── WHO PM10 24t AQG (45 µg/m³)
                </span>
              </div>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={hourlyMultiReceptorChartData}
                  margin={{ top: 10, right: 18, left: 0, bottom: 5 }}
                  onClick={(state: any) => {
                    if (
                      state &&
                      typeof state.activeTooltipIndex === 'number' &&
                      state.activeTooltipIndex >= 0 &&
                      state.activeTooltipIndex < 24
                    ) {
                      onSelectHour(state.activeTooltipIndex);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="hourLabel"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                    label={{
                      value: 'Koncentration (µg/m³)',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        fill: '#94a3b8',
                        fontSize: 10,
                        fontFamily: 'monospace',
                      },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#f8fafc',
                    }}
                    formatter={(value: any, name: any) => [
                      `${Number(value).toFixed(1)} µg/m³`,
                      String(name ?? ''),
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                  />

                  <ReferenceLine
                    y={WHO_PM25_24H_AQG}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: 'WHO PM2.5 AQG (15 µg/m³)',
                      position: 'insideTopRight',
                      fill: '#10b981',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={WHO_PM25_IT3}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{
                      value: 'WHO PM2.5 IT-3 (37,5 µg/m³)',
                      position: 'insideTopRight',
                      fill: '#f59e0b',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={WHO_PM10_24H_AQG}
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    label={{
                      value: 'WHO PM10 AQG (45 µg/m³)',
                      position: 'insideTopLeft',
                      fill: '#38bdf8',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    x={`${String(selectedHourIndex).padStart(2, '0')}:00`}
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                  />

                  <Area
                    type="monotone"
                    dataKey="activePm10"
                    name="PM10 Inhalerbar Fraktion (µg/m³)"
                    fill="#38bdf8"
                    fillOpacity={0.16}
                    stroke="#38bdf8"
                    strokeWidth={1.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="activePm25"
                    name="PM2.5 Respirabel Finfraktion (µg/m³)"
                    fill="#f43f5e"
                    fillOpacity={0.28}
                    stroke="#f43f5e"
                    strokeWidth={2.4}
                  />
                  <Line
                    type="monotone"
                    dataKey="activeRunningMeanPm25"
                    name="Løbende Døgnmiddel PM2.5 (µg/m³)"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CHART 3: RECEPTOR BAR COMPARISON AGAINST WHO INTERIM TARGETS */}
        {chartMode === 'receptor_comparison' && (
          <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-md space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-slate-300 font-semibold">
                Sammenligning af 24-Timers Kumulativ WHO Eksponeringsscore pr.
                Receptor
              </span>
              <span className="text-[11px] text-slate-400">
                Klik på en søjle for at vælge receptoren i Bio-Toks
              </span>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={receptorWhoProfiles}
                  margin={{ top: 10, right: 18, left: 0, bottom: 24 }}
                  onClick={(state: any) => {
                    if (
                      state &&
                      state.activePayload &&
                      state.activePayload[0]?.payload?.receptorId
                    ) {
                      onSelectReceptor(
                        state.activePayload[0].payload.receptorId
                      );
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="shortName"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                    angle={-15}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                  />
                  <ReferenceLine
                    y={25}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: 'WHO 24t AQG (25 pt)',
                      position: 'insideTopRight',
                      fill: '#10b981',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={50}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: 'WHO IT-3 (50 pt)',
                      position: 'insideTopRight',
                      fill: '#f59e0b',
                      fontSize: 10,
                    }}
                  />
                  <Bar
                    dataKey="score24hTotal"
                    name="Kumulativ WHO Eksponeringsscore (24t)"
                    radius={[3, 3, 0, 0]}
                  >
                    {receptorWhoProfiles.map((entry) => (
                      <Cell
                        key={entry.receptorId}
                        fill={
                          entry.receptorId === selectedReceptorId
                            ? '#14b8a6'
                            : entry.score24hTotal >= 75
                            ? '#f43f5e'
                            : entry.score24hTotal >= 50
                            ? '#f59e0b'
                            : '#38bdf8'
                        }
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="mean24hPm25UgM3"
                    name="24t Middel PM2.5 (µg/m³)"
                    fill="#fbbf24"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Receptor WHO AirQ+ & AQG Table */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase text-slate-400 font-semibold">
          <span>
            WHO AirQ+ Toksikologisk Eksponerings-Matrix (Valgte Receptorer)
          </span>
          <span>
            Reference: WHO AQG 2021 (PM2.5 = 15 µg/m³ · PM10 = 45 µg/m³)
          </span>
        </div>

        <div className="overflow-x-auto rounded border border-slate-800 bg-slate-950/90">
          <table className="w-full text-left border-collapse font-mono text-[11px] tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] text-slate-400 uppercase">
                <th className="py-2 px-2.5">Receptor</th>
                <th className="py-2 px-2 text-right">
                  KES_WHO ({currentWeather.hourLabel})
                </th>
                <th className="py-2 px-2 text-right">KES_WHO (24t)</th>
                <th className="py-2 px-2 text-right">PM2.5 Middel</th>
                <th className="py-2 px-2 text-right">PM10 Middel</th>
                <th className="py-2 px-2 text-right">Timer &gt; AQG</th>
                <th className="py-2 px-2 text-right">AirQ+ RR</th>
                <th className="py-2 px-2.5">WHO Vurdering</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {selectedReceptorProfiles.map((prof) => {
                const isSelected = prof.receptorId === selectedReceptorId;
                return (
                  <tr
                    key={prof.receptorId}
                    onClick={() => onSelectReceptor(prof.receptorId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-teal-950/40 text-white'
                        : 'hover:bg-slate-900/70 text-slate-300'
                    }`}
                  >
                    <td className="py-2 px-2.5 font-semibold flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: prof.color }}
                      />
                      <span className="truncate max-w-[160px]">
                        {prof.shortName}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-teal-300">
                      {prof.scoreAtSelectedHour.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-white">
                      {prof.score24hTotal.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span
                        className={
                          prof.mean24hPm25UgM3 > WHO_PM25_24H_AQG
                            ? 'text-rose-300 font-bold'
                            : 'text-emerald-300'
                        }
                      >
                        {prof.mean24hPm25UgM3} µg/m³
                      </span>{' '}
                      <span className="text-[11px] text-slate-400">
                        ({prof.pm25WhoRatio}×)
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span
                        className={
                          prof.mean24hPm10UgM3 > WHO_PM10_24H_AQG
                            ? 'text-amber-300 font-bold'
                            : 'text-slate-300'
                        }
                      >
                        {prof.mean24hPm10UgM3} µg/m³
                      </span>{' '}
                      <span className="text-[11px] text-slate-400">
                        ({prof.pm10WhoRatio}×)
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-amber-300">
                      {prof.hoursExceedingWhoPm25} / 24t
                    </td>
                    <td className="py-2 px-2 text-right text-rose-300 font-semibold">
                      {prof.airQPlusRelativeRisk.toFixed(3)} (+
                      {prof.excessRiskPct}%)
                    </td>
                    <td className="py-2 px-2.5 text-[11px]">
                      <span
                        className={
                          prof.whoTierSeverity === 'critical'
                            ? 'text-rose-400 font-bold'
                            : prof.whoTierSeverity === 'elevated'
                            ? 'text-amber-300 font-semibold'
                            : prof.whoTierSeverity === 'moderate'
                            ? 'text-yellow-300'
                            : 'text-emerald-400'
                        }
                      >
                        {prof.whoTierLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodological Note */}
      <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800/90 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2">
        <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white font-mono">
            Videnskabelig Beregningsmetode (WHO AQG 2021 &amp; IARC):
          </strong>{' '}
          Scoren normaliserer timekoncentrationen af respirable partikler (
          <span className="font-mono text-slate-200">
            PM2.5 / 15 µg/m³ · vægt 65%
          </span>
          ) og inhalerbare partikler (
          <span className="font-mono text-slate-200">
            PM10 / 45 µg/m³ · vægt 35%
          </span>
          ) skaleret så et fuldt døgn på præcis WHO&apos;s anbefalede
          grænseværdi giver{' '}
          <span className="font-mono text-emerald-300">KES_WHO = 25,0 pt</span>.
          Når IARC Gruppe 1 støvvægtning er aktiveret, indregnes det synergistiske
          bidrag fra krystallinsk kvarts (NLRP3-inflammasom aktivering) og
          asbestfibre i den kumulative belastning.
        </div>
      </div>
    </div>
  );
};
