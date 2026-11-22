import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CloudRain,
  Compass,
  FastForward,
  History,
  Layers,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  Sun,
  TrendingUp,
  Wind,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DemolitionSourceNode,
  ReceptorZone,
  WeatherDataset,
} from '../types/dispersion';
import {
  Next7DayForecastDay,
  buildLastWeekPredictedVsActualWeatherPairs,
  degreesToCompass,
  fetchNext7DaysForecastForSlagelse,
  formatDanishShortDate,
  shiftDateIsoByDays,
} from '../services/weatherService';
import { runDispersionSimulation } from '../services/dispersionEngine';

export interface TimeTravelRecordedEvent {
  id: string;
  recordedAtRealIso: string;
  simulatedDateIso: string;
  simulatedHourIndex: number;
  simulatedHourLabel: string;
  isMidnightDateRollover: boolean;
  previousDateIso?: string;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
  plumeDirectionDeg: number;
  precipitationMm: number;
  maxSumQuotient: number;
  worstReceptorCode: string;
  worstReceptorName: string;
  worstReceptorAddress: string;
  legalStatusLabel: string;
  noteDa: string;
}

interface PredictionVsActualAndForecastWidgetProps {
  todayIso: string;
  selectedDateIso: string;
  selectedHourIndex: number;
  isPlaying: boolean;
  isContinuousRecordingToToday: boolean;
  playbackTargetEndDateIso: string;
  midnightRolloverCount: number;
  recordedTimelineEvents: TimeTravelRecordedEvent[];
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  onStartTimeTravelToToday: (startDateIso: string, startHourIndex?: number) => void;
  onStartNextWeekForecastPlayback: (forecastDays: Next7DayForecastDay[]) => void;
  onStopTimeTravelRecording: () => void;
  onClearRecordedEvents: () => void;
  onSelectDateAndHour: (
    dateIso: string,
    hourIndex: number,
    customDataset?: WeatherDataset
  ) => void;
  onLogRecordedEventAsAlgedonic?: (entry: TimeTravelRecordedEvent) => void;
  autoSaveEvidenceOnTimeTravel?: boolean;
  onToggleAutoSaveEvidence?: () => void;
  autoSavedEvidenceCount?: number;
  compact?: boolean;
}

type WidgetSubTab = 'last_week_comparison' | 'next_week_forecast' | 'time_travel_recorder';

export const PredictionVsActualAndForecastWidget: React.FC<
  PredictionVsActualAndForecastWidgetProps
> = ({
  todayIso,
  selectedDateIso,
  selectedHourIndex,
  isPlaying,
  isContinuousRecordingToToday,
  playbackTargetEndDateIso,
  midnightRolloverCount,
  recordedTimelineEvents,
  sources,
  receptors,
  onStartTimeTravelToToday,
  onStartNextWeekForecastPlayback,
  onStopTimeTravelRecording,
  onClearRecordedEvents,
  onSelectDateAndHour,
  onLogRecordedEventAsAlgedonic,
  autoSaveEvidenceOnTimeTravel = true,
  onToggleAutoSaveEvidence,
  autoSavedEvidenceCount = 0,
  compact = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<WidgetSubTab>('last_week_comparison');
  const [selectedTestDayIdx, setSelectedTestDayIdx] = useState<number>(2); // Day 3 (offset -5) with critical gale anomaly selected by default
  const [chartGranularity, setChartGranularity] = useState<'7days' | '24hours'>('7days');
  const [testRunTimestamp, setTestRunTimestamp] = useState<string>(() =>
    new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Next 7 Days Weather Forecast State
  const [next7DaysForecast, setNext7DaysForecast] = useState<Next7DayForecastDay[]>([]);
  const [isLoadingForecast, setIsLoadingForecast] = useState<boolean>(false);
  const [selectedForecastDayIdx, setSelectedForecastDayIdx] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingForecast(true);
    fetchNext7DaysForecastForSlagelse(todayIso)
      .then((days) => {
        if (!cancelled) {
          setNext7DaysForecast(days);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingForecast(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [todayIso]);

  // Pre-populated 7-day test from LAST WEEK (executed automatically on startup so a full comparison is ready from start)
  const lastWeekComparisonData = useMemo(() => {
    const pairs = buildLastWeekPredictedVsActualWeatherPairs(todayIso);

    const dailyComparisons = pairs.map((pair) => {
      // Run full 24h dispersion simulation for Predicted weather vs Actual weather event
      const predSim = runDispersionSimulation(
        pair.dateIso,
        13,
        pair.predictedDataset.hours,
        sources,
        receptors
      );
      const actualSim = runDispersionSimulation(
        pair.dateIso,
        13,
        pair.actualDataset.hours,
        sources,
        receptors
      );

      // Hourly comparison across all 24 hours of this day
      const hourlyComparison = Array.from({ length: 24 }, (_, h) => {
        const predHrSim = runDispersionSimulation(
          pair.dateIso,
          h,
          pair.predictedDataset.hours,
          sources,
          receptors
        );
        const actualHrSim = runDispersionSimulation(
          pair.dateIso,
          h,
          pair.actualDataset.hours,
          sources,
          receptors
        );
        const predW = pair.predictedDataset.hours[h];
        const actualW = pair.actualDataset.hours[h];
        const deltaS = Number(
          (actualHrSim.maxSiteSumQuotient - predHrSim.maxSiteSumQuotient).toFixed(2)
        );
        const deltaWindMs = Number((actualW.windSpeed10m - predW.windSpeed10m).toFixed(1));

        return {
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          predWindMs: predW.windSpeed10m,
          actualWindMs: actualW.windSpeed10m,
          actualGustsMs: actualW.windGusts10m,
          deltaWindMs,
          predDirDeg: predW.windDirection10m,
          actualDirDeg: actualW.windDirection10m,
          predPrecipMm: predW.precipitation,
          actualPrecipMm: actualW.precipitation,
          predS: Number(predHrSim.maxSiteSumQuotient.toFixed(2)),
          actualS: Number(actualHrSim.maxSiteSumQuotient.toFixed(2)),
          deltaS,
          predWorstReceptorCode: predHrSim.worstExposedReceptor.receptorCode,
          actualWorstReceptorCode: actualHrSim.worstExposedReceptor.receptorCode,
          actualWorstReceptorName: actualHrSim.worstExposedReceptor.receptorName,
        };
      });

      const predPeakS = Number(Math.max(...hourlyComparison.map((x) => x.predS)).toFixed(2));
      const actualPeakS = Number(Math.max(...hourlyComparison.map((x) => x.actualS)).toFixed(2));
      const deltaPeakS = Number((actualPeakS - predPeakS).toFixed(2));

      const predCumulativeDose = Number(
        hourlyComparison.reduce((acc, x) => acc + x.predS, 0).toFixed(2)
      );
      const actualCumulativeDose = Number(
        hourlyComparison.reduce((acc, x) => acc + x.actualS, 0).toFixed(2)
      );
      const deltaDosePct =
        predCumulativeDose > 0
          ? Math.round(((actualCumulativeDose - predCumulativeDose) / predCumulativeDose) * 100)
          : 0;

      const predViolationHours = hourlyComparison.filter((x) => x.predS >= 1.0).length;
      const actualViolationHours = hourlyComparison.filter((x) => x.actualS >= 1.0).length;

      const predMeanWind = Number(
        (hourlyComparison.reduce((a, x) => a + x.predWindMs, 0) / 24).toFixed(1)
      );
      const actualMeanWind = Number(
        (hourlyComparison.reduce((a, x) => a + x.actualWindMs, 0) / 24).toFixed(1)
      );
      const actualMaxWind = Number(
        Math.max(...hourlyComparison.map((x) => x.actualWindMs)).toFixed(1)
      );

      const predTotalRain = Number(
        hourlyComparison.reduce((a, x) => a + x.predPrecipMm, 0).toFixed(1)
      );
      const actualTotalRain = Number(
        hourlyComparison.reduce((a, x) => a + x.actualPrecipMm, 0).toFixed(1)
      );

      return {
        ...pair,
        labelWithWeekday: `${pair.weekdayNameDa.slice(0, 3)} ${pair.dayLabelShort}`,
        predPeakS,
        actualPeakS,
        deltaPeakS,
        predCumulativeDose,
        actualCumulativeDose,
        deltaDosePct,
        predViolationHours,
        actualViolationHours,
        predMeanWind,
        actualMeanWind,
        actualMaxWind,
        predTotalRain,
        actualTotalRain,
        predPeakReceptor: predSim.puff24h.peakReceptor,
        actualPeakReceptor: actualSim.puff24h.peakReceptor,
        receptorShifted:
          predSim.puff24h.peakReceptor.receptorId !== actualSim.puff24h.peakReceptor.receptorId,
        hourlyComparison,
      };
    });

    const totalPredDose7d = Number(
      dailyComparisons.reduce((a, d) => a + d.predCumulativeDose, 0).toFixed(1)
    );
    const totalActualDose7d = Number(
      dailyComparisons.reduce((a, d) => a + d.actualCumulativeDose, 0).toFixed(1)
    );
    const totalDoseDiffPct =
      totalPredDose7d > 0
        ? Math.round(((totalActualDose7d - totalPredDose7d) / totalPredDose7d) * 100)
        : 0;

    const totalPredViolationHrs = dailyComparisons.reduce(
      (a, d) => a + d.predViolationHours,
      0
    );
    const totalActualViolationHrs = dailyComparisons.reduce(
      (a, d) => a + d.actualViolationHours,
      0
    );

    const all168Hours = dailyComparisons.flatMap((d) => d.hourlyComparison);
    const mseS =
      all168Hours.reduce((acc, h) => acc + Math.pow(h.actualS - h.predS, 2), 0) /
      Math.max(1, all168Hours.length);
    const rmseS = Number(Math.sqrt(mseS).toFixed(2));

    const maxAnomalyDay = [...dailyComparisons].sort(
      (a, b) => Math.abs(b.deltaPeakS) - Math.abs(a.deltaPeakS)
    )[0];

    return {
      startDateIso: dailyComparisons[0]?.dateIso || shiftDateIsoByDays(todayIso, -7),
      endDateIso:
        dailyComparisons[dailyComparisons.length - 1]?.dateIso ||
        shiftDateIsoByDays(todayIso, -1),
      dailyComparisons,
      totalPredDose7d,
      totalActualDose7d,
      totalDoseDiffPct,
      totalPredViolationHrs,
      totalActualViolationHrs,
      rmseS,
      maxAnomalyDay,
    };
  }, [todayIso, sources, receptors]);

  // Simulate dispersion impact for the Next 7 Days Forecast
  const nextWeekSimulatedDays = useMemo(() => {
    return next7DaysForecast.map((fDay) => {
      const sim = runDispersionSimulation(
        fDay.dateIso,
        13,
        fDay.dataset.hours,
        sources,
        receptors
      );
      const violationHoursCount = sim.puff24h.peakReceptor.hourlyProfile.filter(
        (hp) => hp.sumQuotient >= 1.0
      ).length;

      return {
        ...fDay,
        labelShort: `${fDay.weekdayNameDa.slice(0, 3)} ${fDay.dayLabelShort}`,
        peakSumQuotient: Number(sim.puff24h.peakReceptor.peakSumQuotient.toFixed(2)),
        peakHourLabel: sim.puff24h.peakReceptor.peakHourLabel,
        peakHourIndex: sim.puff24h.peakReceptor.peakHourIndex,
        cumulativeDose24h: Number(sim.puff24h.peakReceptor.cumulativeSumDose.toFixed(2)),
        peakReceptorName: sim.puff24h.peakReceptor.receptorName,
        peakReceptorCode: sim.puff24h.peakReceptor.receptorCode,
        peakReceptorAddress: sim.puff24h.peakReceptor.address,
        violationHoursCount,
      };
    });
  }, [next7DaysForecast, sources, receptors]);

  const activeTestDay =
    lastWeekComparisonData.dailyComparisons[
      Math.min(
        Math.max(0, selectedTestDayIdx),
        lastWeekComparisonData.dailyComparisons.length - 1
      )
    ] || lastWeekComparisonData.dailyComparisons[0];

  const activeForecastDay =
    nextWeekSimulatedDays[
      Math.min(Math.max(0, selectedForecastDayIdx), Math.max(0, nextWeekSimulatedDays.length - 1))
    ];

  return (
    <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-md space-y-3 text-xs">
      {/* Header & Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
            <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              PRÆDIKTION VS. VIRKELIGT VEJRHÆNDELSESFORLØB · NÆSTE UGES VEJRUDSIGT · TIDSREJSE (KL. 00:00 DATO-SKIFT)
            </span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Spredningseffekt-Verifikation (Sidste Uges Test fra Start) &amp; 7-Dages Vejrudsigt-Simulering
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Sidste Uges Test Kørt fra Start (kl. {testRunTimestamp})</span>
          </span>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-md font-mono text-[11px]">
        <button
          type="button"
          onClick={() => setActiveSubTab('last_week_comparison')}
          className={`px-2.5 py-1.5 rounded font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeSubTab === 'last_week_comparison'
              ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Scale className="w-3.5 h-3.5 shrink-0" />
          <span>1. Prædiktion vs. Virkelighed (Sidste Uge)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('next_week_forecast')}
          className={`px-2.5 py-1.5 rounded font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeSubTab === 'next_week_forecast'
              ? 'bg-cyan-400 text-slate-950 font-bold shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-slate-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span>2. Simulér Næste Uges Vejrudsigt (+7d)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('time_travel_recorder')}
          className={`px-2.5 py-1.5 rounded font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeSubTab === 'time_travel_recorder'
              ? 'bg-fuchsia-400 text-slate-950 font-bold shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span>
            3. Tidsrejse &amp; Kl. 00:00 Log ({recordedTimelineEvents.length})
          </span>
        </button>
      </div>

      {/* =====================================================================
          SUB-TAB 1: PRÆDIKTION KONTRA VIRKELIGT VEJRHÆNDELSESFORLØB (SIDSTE UGE)
          ===================================================================== */}
      {activeSubTab === 'last_week_comparison' && activeTestDay && (
        <div className="space-y-3">
          {/* Top Action & Explanation Banner */}
          <div className="p-2.5 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-amber-400 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5 max-w-2xl">
              <div className="text-[11px] font-mono font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  PRE-EKSEKVERET 7-DAGES TEST FRA SIDSTE UGE ({lastWeekComparisonData.startDateIso} →{' '}
                  {lastWeekComparisonData.endDateIso} · 168 Timer)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Sammenligner 7-dages vejrudsigten (prædiktion før hændelsen) med det virkelige målte
                vejrhændelsesforløb i Slagelse og kvantificerer præcist, hvordan vindstød, vinddreje og
                nedbørsafvigelser ændrede spredningseffekten (Sumkvotient <strong className="text-white">S</strong>) ved
                receptorerne i Ringparken.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTestRunTimestamp(
                    new Date().toLocaleTimeString('da-DK', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  );
                }}
                className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-200 border border-amber-500/40 font-mono text-[11px] font-semibold flex items-center gap-1"
                title="Genkør 168-timers test-sammenligning fra sidste uge med aktuelle aktive kildenoder"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Genkør Sidste Uges Test</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onStartTimeTravelToToday(lastWeekComparisonData.startDateIso, 0)
                }
                className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-sm"
                title="Start tidsrejse-afspilning fra sidste uge med automatisk dato-skift kl. 00:00 og kontinuerlig registrering helt frem til dags dato"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Afspil Sidste Uge → Dags Dato (Skift ved 00:00)</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 font-mono">
            <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
              <div className="text-[11px] text-slate-400 uppercase">
                7-Dages Kumulativ Dosis (ΣS·t)
              </div>
              <div className="text-sm font-extrabold text-white flex items-baseline gap-1.5">
                <span className="text-cyan-300">{lastWeekComparisonData.totalPredDose7d}</span>
                <span className="text-slate-500 text-xs">vs.</span>
                <span className="text-rose-400">{lastWeekComparisonData.totalActualDose7d}</span>
              </div>
              <div className="text-[11px] text-amber-300 font-semibold">
                Virkelig effekt: {lastWeekComparisonData.totalDoseDiffPct >= 0 ? '+' : ''}
                {lastWeekComparisonData.totalDoseDiffPct}% ift. prædiktion
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
              <div className="text-[11px] text-slate-400 uppercase">
                Timer m. Grænseoverskridelse (S ≥ 1,0)
              </div>
              <div className="text-sm font-extrabold text-white">
                Præd: <span className="text-cyan-300">{lastWeekComparisonData.totalPredViolationHrs}t</span> · Virkelig:{' '}
                <span className="text-rose-400">{lastWeekComparisonData.totalActualViolationHrs}t</span>
              </div>
              <div className="text-[11px] text-rose-300">
                +{lastWeekComparisonData.totalActualViolationHrs - lastWeekComparisonData.totalPredViolationHrs} uvarslede
                ulovlige eksponeringstimer
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
              <div className="text-[11px] text-slate-400 uppercase">
                Største Hændelses-Afvigelse (ΔS_max)
              </div>
              <div className="text-sm font-extrabold text-rose-400">
                {lastWeekComparisonData.maxAnomalyDay?.deltaPeakS >= 0 ? '+' : ''}
                {lastWeekComparisonData.maxAnomalyDay?.deltaPeakS.toFixed(2)} S (
                {lastWeekComparisonData.maxAnomalyDay?.dayLabelShort})
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                Vind {lastWeekComparisonData.maxAnomalyDay?.actualMaxWind} m/s mod Rødtjørnevej 2
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
              <div className="text-[11px] text-slate-400 uppercase">
                Spredningsmodel RMSE (168 Timer)
              </div>
              <div className="text-sm font-extrabold text-emerald-300">
                RMSE = ±{lastWeekComparisonData.rmseS} S
              </div>
              <div className="text-[11px] text-slate-400">
                Retsmedicinsk korrigeret med faktisk Slagelse-vejr
              </div>
            </div>
          </div>

          {/* Chart Granularity Switcher: 7-Day Overview vs 24-Hour Drilldown for Selected Test Day */}
          <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-[11px] font-bold text-white">
                  {chartGranularity === '7days'
                    ? 'Grafisk Sammenligning: Prædikteret vs. Virkelig Spids-Sumkvotient S (Sidste Uge · 7 Dage)'
                    : `24-Timers Time-for-Time Sammenligning for ${activeTestDay.weekdayNameDa} ${activeTestDay.dateIso}`}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setChartGranularity('7days')}
                  className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                    chartGranularity === '7days'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  7-Dages Forløb (Sidste Uge)
                </button>
                <button
                  type="button"
                  onClick={() => setChartGranularity('24hours')}
                  className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                    chartGranularity === '24hours'
                      ? 'bg-cyan-400 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  24t Detalje ({activeTestDay.dayLabelShort})
                </button>
              </div>
            </div>

            <div className={compact ? 'h-48 w-full' : 'h-56 w-full'}>
              <ResponsiveContainer width="100%" height="100%">
                {chartGranularity === '7days' ? (
                  <ComposedChart
                    data={lastWeekComparisonData.dailyComparisons}
                    margin={{ top: 8, right: 12, left: -14, bottom: 2 }}
                    onClick={(st) => {
                      if (st && typeof st.activeTooltipIndex === 'number') {
                        const idx = st.activeTooltipIndex;
                        setSelectedTestDayIdx(idx);
                        const clickedDay = lastWeekComparisonData.dailyComparisons[idx];
                        if (clickedDay) {
                          onSelectDateAndHour(clickedDay.dateIso, 13, clickedDay.actualDataset);
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="labelWithWeekday"
                      stroke="#94a3b8"
                      tick={{ fontSize: 10, fontFamily: 'monospace' }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fontSize: 10, fontFamily: 'monospace' }}
                      label={{
                        value: 'Sumkvotient S',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#94a3b8',
                        fontSize: 10,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        `${Number(value ?? 0).toFixed(2)}`,
                        String(name ?? ''),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    <ReferenceLine
                      y={1.0}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{
                        value: 'BEK 613 Grænse (S=1,0)',
                        fill: '#fda4af',
                        fontSize: 9,
                        position: 'insideTopRight',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="actualPeakS"
                      name="Virkeligt Vejrforløb (Max S)"
                      fill="#f43f5e"
                      fillOpacity={0.22}
                      stroke="#f43f5e"
                      strokeWidth={2.2}
                    />
                    <Line
                      type="monotone"
                      dataKey="predPeakS"
                      name="Prædiktion / Vejrudsigt (Max S)"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={{ r: 3, fill: '#22d3ee' }}
                    />
                    <Bar
                      dataKey="deltaPeakS"
                      name="Δ Spredningseffekt (Virkelig − Præd.)"
                      fill="#f59e0b"
                      barSize={18}
                    />
                  </ComposedChart>
                ) : (
                  <ComposedChart
                    data={activeTestDay.hourlyComparison}
                    margin={{ top: 8, right: 12, left: -14, bottom: 2 }}
                    onClick={(st) => {
                      if (st && typeof st.activeTooltipIndex === 'number') {
                        const hr = st.activeTooltipIndex;
                        onSelectDateAndHour(
                          activeTestDay.dateIso,
                          hr,
                          activeTestDay.actualDataset
                        );
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
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        `${Number(value ?? 0).toFixed(2)}`,
                        String(name ?? ''),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                    <ReferenceLine y={1.0} stroke="#f43f5e" strokeDasharray="4 4" />
                    <Area
                      type="monotone"
                      dataKey="actualS"
                      name="Virkeligt Vejrforløb S(t)"
                      fill="#f43f5e"
                      fillOpacity={0.22}
                      stroke="#f43f5e"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="predS"
                      name="Prædikteret S(t)"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={false}
                    />
                    <Bar
                      dataKey="deltaS"
                      name="ΔS Påvirkning (Virkelig − Præd.)"
                      fill="#f59e0b"
                      barSize={10}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Selected Day Forensic Cause & Dispersion Effect Card */}
          <div className="p-2.5 rounded bg-slate-950 border border-amber-500/40 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
              <span className="text-xs font-bold text-amber-300 inline-flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Fokus-Analyse ({activeTestDay.weekdayNameDa} {activeTestDay.dateIso}):{' '}
                  {activeTestDay.eventAnomalyHeadline}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onSelectDateAndHour(
                      activeTestDay.dateIso,
                      13,
                      activeTestDay.predictedDataset
                    )
                  }
                  className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-500/50 text-[11px] font-mono font-semibold"
                >
                  Vis Prædiktion på Kort
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSelectDateAndHour(
                      activeTestDay.dateIso,
                      13,
                      activeTestDay.actualDataset
                    )
                  }
                  className="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-500/50 text-[11px] font-mono font-semibold"
                >
                  Vis Virkeligt Forløb på Kort
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {activeTestDay.meteorologicalCauseDa}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400">Vind (Præd. vs. Virkelig):</span>{' '}
                <strong className="text-cyan-300">{activeTestDay.predMeanWind} m/s</strong> →{' '}
                <strong className="text-rose-300">
                  {activeTestDay.actualMeanWind} m/s (max {activeTestDay.actualMaxWind} m/s)
                </strong>
              </div>
              <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400">Spids-Sumkvotient S:</span>{' '}
                <strong className="text-cyan-300">S={activeTestDay.predPeakS.toFixed(2)}</strong> →{' '}
                <strong className="text-rose-400">S={activeTestDay.actualPeakS.toFixed(2)}</strong> (
                <span className="text-amber-300">
                  {activeTestDay.deltaPeakS >= 0 ? '+' : ''}
                  {activeTestDay.deltaPeakS.toFixed(2)}
                </span>
                )
              </div>
              <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800 truncate">
                <span className="text-slate-400">Ramt Receptor:</span>{' '}
                <strong className="text-white">
                  {activeTestDay.actualPeakReceptor.receptorCode} (
                  {activeTestDay.actualPeakReceptor.address.split(',')[0]})
                </strong>
              </div>
            </div>
          </div>

          {/* 7-Day Table for Last Week's Test */}
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left border-collapse font-mono text-[11px]">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-1.5 px-2">Dato (Sidste Uge)</th>
                  <th className="py-1.5 px-2">Præd. Vind / Regn</th>
                  <th className="py-1.5 px-2">Virkelig Vind / Regn</th>
                  <th className="py-1.5 px-2">Præd. S_max</th>
                  <th className="py-1.5 px-2">Virkelig S_max</th>
                  <th className="py-1.5 px-2">Δ Effekt</th>
                  <th className="py-1.5 px-2">Faktisk Ramt Receptor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {lastWeekComparisonData.dailyComparisons.map((day, idx) => {
                  const isSel = idx === selectedTestDayIdx;
                  return (
                    <tr
                      key={day.dateIso}
                      onClick={() => {
                        setSelectedTestDayIdx(idx);
                        onSelectDateAndHour(day.dateIso, 13, day.actualDataset);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-amber-950/35 text-white'
                          : 'bg-slate-950/50 hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <td className="py-1.5 px-2 font-bold text-white whitespace-nowrap">
                        {day.weekdayNameDa.slice(0, 3)} {day.dateIso}
                      </td>
                      <td className="py-1.5 px-2 text-cyan-300 whitespace-nowrap">
                        {day.predMeanWind} m/s · {day.predTotalRain} mm
                      </td>
                      <td className="py-1.5 px-2 text-rose-200 whitespace-nowrap">
                        {day.actualMeanWind} m/s (max {day.actualMaxWind}) · {day.actualTotalRain} mm
                      </td>
                      <td className="py-1.5 px-2 text-cyan-300 font-semibold">
                        {day.predPeakS.toFixed(2)}
                      </td>
                      <td
                        className={`py-1.5 px-2 font-bold ${
                          day.actualPeakS >= 1.0 ? 'text-rose-400' : 'text-amber-300'
                        }`}
                      >
                        {day.actualPeakS.toFixed(2)}
                      </td>
                      <td
                        className={`py-1.5 px-2 font-bold whitespace-nowrap ${
                          day.deltaPeakS > 0.15
                            ? 'text-rose-400'
                            : day.deltaPeakS < -0.15
                            ? 'text-emerald-400'
                            : 'text-amber-200'
                        }`}
                      >
                        {day.deltaPeakS >= 0 ? '+' : ''}
                        {day.deltaPeakS.toFixed(2)} ({day.deltaDosePct >= 0 ? '+' : ''}
                        {day.deltaDosePct}%)
                      </td>
                      <td className="py-1.5 px-2 truncate max-w-[170px]">
                        {day.actualPeakReceptor.receptorCode}:{' '}
                        {day.actualPeakReceptor.address.split(',')[0]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: SIMULÉR DEN NÆSTE UGES VEJRUDSIGT (+7 DAGE FREM)
          ===================================================================== */}
      {activeSubTab === 'next_week_forecast' && (
        <div className="space-y-3">
          <div className="p-2.5 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-sky-400 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5 max-w-2xl">
              <div className="text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  7-DAGES VEJRUDSIGT &amp; SPREDNINGS-SIMULERING ({shiftDateIsoByDays(todayIso, 1)} →{' '}
                  {shiftDateIsoByDays(todayIso, 7)})
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Simulerer den næste uges time-for-time vejrudsigt (168 timer) for Ringparken, Slagelse
                og udpeger på forhånd hvilke dage og klokkeslæt der udløser overskridelser af
                Arbejdstilsynets Sumformel (<strong className="text-white">S ≥ 1,0</strong>) eller højvinds-spredning (
                <strong className="text-white">&gt; 10 m/s</strong>).
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isLoadingForecast || next7DaysForecast.length === 0}
                onClick={() => onStartNextWeekForecastPlayback(next7DaysForecast)}
                className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulér &amp; Afspil Næste Uge (Dato-skift ved kl. 00:00)</span>
              </button>
            </div>
          </div>

          {/* 7-Day Forecast Cards Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 font-mono">
            {nextWeekSimulatedDays.map((fDay, idx) => {
              const isSelected = idx === selectedForecastDayIdx || selectedDateIso === fDay.dateIso;
              const isCritical = fDay.peakSumQuotient >= 1.0 || fDay.maxWindSpeedMs > 10;
              return (
                <button
                  key={fDay.dateIso}
                  type="button"
                  onClick={() => {
                    setSelectedForecastDayIdx(idx);
                    onSelectDateAndHour(fDay.dateIso, fDay.peakHourIndex, fDay.dataset);
                  }}
                  className={`p-2 rounded border text-left transition-all flex flex-col justify-between gap-1 ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-300 ring-1 ring-cyan-300 text-white'
                      : isCritical
                      ? 'bg-rose-950/35 border-rose-500/50 hover:border-rose-400 text-slate-200'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-cyan-300">
                        {fDay.weekdayNameDa.slice(0, 3)}
                      </span>
                      <span className="text-[11px] text-slate-400">{fDay.dayLabelShort}</span>
                    </div>
                    <div className="text-xs font-extrabold text-white mt-0.5">
                      {fDay.maxWindSpeedMs} m/s
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Fane → {fDay.dominantPlumeSector} ({fDay.dominantPlumeToDeg}°)
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-800/80 space-y-0.5">
                    <div
                      className={`text-[11px] font-extrabold ${
                        fDay.peakSumQuotient >= 1.0
                          ? 'text-rose-400'
                          : fDay.peakSumQuotient >= 0.5
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      S_max = {fDay.peakSumQuotient.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                      {fDay.totalPrecipitationMm > 0 ? (
                        <>
                          <CloudRain className="w-3 h-3 text-sky-400 shrink-0" />
                          <span>{fDay.totalPrecipitationMm} mm</span>
                        </>
                      ) : (
                        <>
                          <Sun className="w-3 h-3 text-amber-300 shrink-0" />
                          <span>{fDay.maxTempC}°C</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Recharts 7-Day Forecast Graph */}
          <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="font-bold text-white">
                7-Dages Prognose: Prædikteret Spids-Sumkvotient S_max, Vindhastighed (m/s) &amp; Nedbør (mm)
              </span>
              <span className="text-cyan-300 text-[11px]">
                Klik på en dag for at simulere spredningsfanen på 3D/2D-kortet
              </span>
            </div>

            <div className={compact ? 'h-44 w-full' : 'h-52 w-full'}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={nextWeekSimulatedDays}
                  margin={{ top: 8, right: 12, left: -14, bottom: 2 }}
                  onClick={(st) => {
                    if (st && typeof st.activeTooltipIndex === 'number') {
                      const idx = st.activeTooltipIndex;
                      setSelectedForecastDayIdx(idx);
                      const d = nextWeekSimulatedDays[idx];
                      if (d) {
                        onSelectDateAndHour(d.dateIso, d.peakHourIndex, d.dataset);
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="labelShort"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#38bdf8"
                    tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: '#334155',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      `${Number(value ?? 0).toFixed(2)}`,
                      String(name ?? ''),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                  <ReferenceLine yAxisId="left" y={1.0} stroke="#f43f5e" strokeDasharray="4 4" />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="peakSumQuotient"
                    name="Prædikteret Spids-Sumkvotient (S_max)"
                    fill="#f59e0b"
                    fillOpacity={0.25}
                    stroke="#f59e0b"
                    strokeWidth={2.2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="maxWindSpeedMs"
                    name="Max Vindhastighed (m/s)"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#22d3ee' }}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="totalPrecipitationMm"
                    name="Døgn-Nedbør (mm)"
                    fill="#6366f1"
                    barSize={16}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {activeForecastDay && (
            <div className="p-2.5 rounded bg-slate-950 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
              <div className="space-y-0.5">
                <div className="font-bold text-white">
                  Prognose-Detalje for {activeForecastDay.weekdayNameDa} d. {activeForecastDay.dateIso}:{' '}
                  <span className="text-cyan-300">{activeForecastDay.weatherSummaryDa}</span>
                </div>
                <div className="text-slate-300">
                  Mest udsatte receptor:{' '}
                  <strong className="text-amber-300">
                    {activeForecastDay.peakReceptorCode}: {activeForecastDay.peakReceptorName}
                  </strong>{' '}
                  kl. {activeForecastDay.peakHourLabel} (S ={' '}
                  {activeForecastDay.peakSumQuotient.toFixed(2)} · 24t dosis{' '}
                  {activeForecastDay.cumulativeDose24h} S·t)
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onSelectDateAndHour(
                    activeForecastDay.dateIso,
                    activeForecastDay.peakHourIndex,
                    activeForecastDay.dataset
                  )
                }
                className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
              >
                Indlæs Dag på 3D/2D Kort →
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: TIDSREJSE & KONTINUERLIG HÆNDELSES-REGISTRERING (KL. 00:00)
          ===================================================================== */}
      {activeSubTab === 'time_travel_recorder' && (
        <div className="space-y-3">
          <div
            className={`p-3 rounded border space-y-2 ${
              isPlaying && isContinuousRecordingToToday
                ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] border-l-4 border-l-fuchsia-400'
                : 'bg-[var(--surface-panel)] border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-[11px] font-mono font-bold text-fuchsia-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                  <span>
                    AUTOMATISK DATO-SKIFT VED KL. 00:00 &amp; KONTINUERLIG REGISTRERING FREM TIL DAGS DATO ({todayIso})
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Ved tidsrejse tilbage i tiden skifter både hændelsesafspilningen og
                  bevisregistreringen automatisk dato (+1 dag), når klokken passerer{' '}
                  <strong className="text-white">00:00</strong>, og fortsætter uafbrudt frem til dags
                  dato ({todayIso}), medmindre du selv klikker på{' '}
                  <strong className="text-rose-300">Afbryd Registrering</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0 font-mono">
                {onToggleAutoSaveEvidence && (
                  <button
                    type="button"
                    onClick={onToggleAutoSaveEvidence}
                    className={`px-2.5 py-1.5 rounded font-bold text-[11px] flex items-center gap-1.5 border transition-colors cursor-pointer ${
                      autoSaveEvidenceOnTimeTravel
                        ? 'bg-emerald-500 text-slate-950 border-emerald-200 shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-400/60'
                    }`}
                    title="Auto gem beviser: Tilføjer automatisk og kontinuerligt fund (med SHA-256 signatur) til Foto-Bevis / Algedonisk Log under tidsrejser"
                  >
                    <span>
                      {autoSaveEvidenceOnTimeTravel
                        ? `Auto gem beviser: TIL (${autoSavedEvidenceCount})`
                        : 'Auto gem beviser: FRA'}
                    </span>
                  </button>
                )}
                {isPlaying ? (
                  <button
                    type="button"
                    onClick={onStopTimeTravelRecording}
                    className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Afbryd Registrering &amp; Afspilning</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onStartTimeTravelToToday(shiftDateIsoByDays(todayIso, -7), 0)
                      }
                      className="px-2.5 py-1.5 rounded bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 font-bold text-[11px] flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start fra Sidste Uge (-7d) → Dags Dato</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onStartTimeTravelToToday(
                          selectedDateIso < todayIso
                            ? selectedDateIso
                            : shiftDateIsoByDays(todayIso, -3),
                          selectedHourIndex
                        )
                      }
                      className="px-2.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] flex items-center gap-1"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                      <span>
                        Fortsæt fra {selectedDateIso < todayIso ? selectedDateIso : '-3 dage'} → Dags Dato
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Live Status Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">AKTUEL AFSPILNINGS-DATO &amp; TID</div>
                <div className="text-xs font-extrabold text-white">
                  {selectedDateIso} kl. {String(selectedHourIndex).padStart(2, '0')}:00
                </div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">MÅL-DATO FOR REGISTRERING</div>
                <div className="text-xs font-extrabold text-cyan-300">
                  {playbackTargetEndDateIso} (Dags Dato: {todayIso})
                </div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">DATO-SKIFT VED KL. 00:00</div>
                <div className="text-xs font-extrabold text-amber-300">
                  {midnightRolloverCount} midnats-skift gennemført
                </div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">REGISTREREDE HÆNDELSER</div>
                <div className="text-xs font-extrabold text-fuchsia-300">
                  {recordedTimelineEvents.length} tidsrejse-logposter
                </div>
              </div>
            </div>
          </div>

          {/* Recorded Timeline Events Log */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-300 font-bold">
                Kontinuerlig Tidsrejse- &amp; Midnats-Registreringslog ({recordedTimelineEvents.length})
              </span>
              {recordedTimelineEvents.length > 0 && (
                <button
                  type="button"
                  onClick={onClearRecordedEvents}
                  className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Nulstil log</span>
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {recordedTimelineEvents.length === 0 ? (
                <div className="p-3 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[11px] text-center">
                  Klik på &quot;Start fra Sidste Uge (-7d) → Dags Dato&quot; eller tryk Play på
                  Time-Slideren for at optage hændelsesforløbet med automatisk dato-skift kl. 00:00.
                </div>
              ) : (
                recordedTimelineEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => onSelectDateAndHour(ev.simulatedDateIso, ev.simulatedHourIndex)}
                    className={`p-2 rounded border font-mono text-[11px] cursor-pointer transition-colors flex flex-wrap items-center justify-between gap-2 ${
                      ev.isMidnightDateRollover
                        ? 'bg-fuchsia-950/45 border-fuchsia-400/80 text-fuchsia-100'
                        : ev.maxSumQuotient >= 1.0
                        ? 'bg-rose-950/40 border-rose-500/60 text-rose-100'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ev.isMidnightDateRollover && (
                          <span className="px-1.5 py-0.2 rounded bg-fuchsia-400 text-slate-950 font-extrabold text-[11px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>
                              KL. 00:00 DATO-SKIFT ({ev.previousDateIso} → {ev.simulatedDateIso})
                            </span>
                          </span>
                        )}
                        <span className="font-bold text-white">
                          {ev.simulatedDateIso} kl. {ev.simulatedHourLabel}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-cyan-300">
                          Vind {ev.windSpeedMs} m/s (stød {ev.windGustsMs} m/s) → Fane{' '}
                          {ev.plumeDirectionDeg}° ({degreesToCompass(ev.plumeDirectionDeg)})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">{ev.noteDa}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          ev.maxSumQuotient >= 1.0
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-900 text-amber-300 border border-slate-700'
                        }`}
                      >
                        S = {ev.maxSumQuotient.toFixed(2)}
                      </span>
                      {onLogRecordedEventAsAlgedonic && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLogRecordedEventAsAlgedonic(ev);
                          }}
                          className="px-2 py-0.5 rounded bg-fuchsia-500/20 hover:bg-fuchsia-500/35 text-fuchsia-200 border border-fuchsia-400/50 text-[11px] font-semibold"
                          title="Overfør denne tidsrejse-hændelse direkte til Algedonisk Bevis-Registrering med den skiftede dato"
                        >
                          + Bevis-Log
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
