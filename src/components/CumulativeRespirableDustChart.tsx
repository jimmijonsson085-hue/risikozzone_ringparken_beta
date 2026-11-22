import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Clock,
  Crosshair,
  Flame,
  Layers,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  HourlyWeatherPoint,
  PuffAccumulationResult,
  Receptor24hCumulativeSummary,
} from '../types/dispersion';

export interface CumulativeRespirableDustChartProps {
  puff24h: PuffAccumulationResult;
  weatherHours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  selectedReceptorId: string | null;
  onSelectHour: (hourIndex: number) => void;
  onSelectReceptor: (receptorId: string) => void;
}

type DoseMetricMode = 'dust_ug_m2' | 'sum_quotient_st' | 'fibers_m2';

interface HighRiskTimeWindow {
  id: string;
  startHourIndex: number;
  endHourIndex: number;
  startHourLabel: string;
  endHourLabel: string;
  peakHourIndex: number;
  peakHourLabel: string;
  severity: 'CRITICAL' | 'ELEVATED';
  maxSumQuotient: number;
  accumulatedDustInWindowUgM2: number;
  shareOf24hDustPct: number;
  accumulatedFibersInWindowM2: number;
  meanWindSpeedMs: number;
  maxWindGustsMs: number;
  dominantReceptorCode: string;
  dominantReceptorName: string;
  actionRecommendation: string;
}

const RECEPTOR_LINE_COLORS = [
  { stroke: '#f43f5e', fill: '#f43f5e', badge: 'border-rose-400 text-rose-200 bg-rose-950/60' },
  { stroke: '#fbbf24', fill: '#fbbf24', badge: 'border-amber-400 text-amber-200 bg-amber-950/60' },
  { stroke: '#22d3ee', fill: '#22d3ee', badge: 'border-cyan-400 text-cyan-200 bg-cyan-950/60' },
  { stroke: '#a855f7', fill: '#a855f7', badge: 'border-purple-400 text-purple-200 bg-purple-950/60' },
];

export const CumulativeRespirableDustChart: React.FC<CumulativeRespirableDustChartProps> = ({
  puff24h,
  weatherHours,
  currentWeather,
  selectedReceptorId,
  onSelectHour,
  onSelectReceptor,
}) => {
  const [metricMode, setMetricMode] = useState<DoseMetricMode>('dust_ug_m2');
  const [hiddenReceptorIds, setHiddenReceptorIds] = useState<Record<string, boolean>>({});

  // Select Top 4 Most Exposed Receptors across residential blocks & street-level probes
  const top4Receptors = useMemo<Receptor24hCumulativeSummary[]>(() => {
    const combined = [...puff24h.receptorSummaries, ...puff24h.streetPointSummaries];
    const uniqueMap = new Map<string, Receptor24hCumulativeSummary>();
    for (const r of combined) {
      if (!uniqueMap.has(r.receptorId)) {
        uniqueMap.set(r.receptorId, r);
      }
    }
    const sorted = Array.from(uniqueMap.values()).sort(
      (a, b) => b.cumulativeSumDose - a.cumulativeSumDose
    );
    return sorted.slice(0, 4);
  }, [puff24h.receptorSummaries, puff24h.streetPointSummaries]);

  // Build 24-hour cumulative time-series dataset for Recharts + detect High-Risk Demolition Windows
  const {
    chartSeries,
    highRiskWindows,
    primaryWindow,
    unitLabel,
    metricTitle,
    selectedHourTotals,
  } = useMemo(() => {
    const runningTotals: Record<string, number> = {};
    for (const rec of top4Receptors) {
      runningTotals[rec.receptorId] = 0;
    }

    const series: Array<Record<string, number | string>> = [];

    for (let h = 0; h < 24; h++) {
      const hrLabel = `${String(h).padStart(2, '0')}:00`;
      const shortHr = String(h).padStart(2, '0');
      const row: Record<string, number | string> = {
        hourIndex: h,
        hourLabel: hrLabel,
        shortHour: shortHr,
      };

      let maxHourlyInflux = 0;
      let maxHourlyS = 0;

      for (const rec of top4Receptors) {
        const hp = rec.hourlyProfile[h];
        const stepValue =
          metricMode === 'dust_ug_m2'
            ? hp?.depositedDustUgM2 ?? 0
            : metricMode === 'sum_quotient_st'
            ? hp?.sumQuotient ?? 0
            : hp?.depositedAsbestosFibersM2 ?? 0;

        runningTotals[rec.receptorId] = Number(
          (runningTotals[rec.receptorId] + stepValue).toFixed(2)
        );

        row[`cum_${rec.receptorId}`] = runningTotals[rec.receptorId];
        row[`rate_${rec.receptorId}`] = Number(stepValue.toFixed(2));
        row[`s_${rec.receptorId}`] = Number((hp?.sumQuotient ?? 0).toFixed(2));

        if (stepValue > maxHourlyInflux) {
          maxHourlyInflux = stepValue;
        }
        if ((hp?.sumQuotient ?? 0) > maxHourlyS) {
          maxHourlyS = hp?.sumQuotient ?? 0;
        }
      }

      row.peakHourlyInflux = Number(maxHourlyInflux.toFixed(2));
      row.maxHourlyS = Number(maxHourlyS.toFixed(2));
      series.push(row);
    }

    // Identify High-Risk Demolition Time Intervals (contiguous hours where max S >= 0.55 or top quartile dust influx)
    const primaryRec = top4Receptors[0];
    const total24hDustPrimary = Math.max(
      1,
      primaryRec?.hourlyProfile.reduce((acc, p) => acc + p.depositedDustUgM2, 0) ?? 1
    );

    const windows: HighRiskTimeWindow[] = [];
    let currentStart: number | null = null;
    let currentHours: number[] = [];

    const isHourHighRisk = (hIdx: number): boolean => {
      const maxSAtHr = Math.max(
        ...top4Receptors.map((r) => r.hourlyProfile[hIdx]?.sumQuotient ?? 0)
      );
      const meanDustAtHr =
        (primaryRec?.hourlyProfile[hIdx]?.depositedDustUgM2 ?? 0) / (total24hDustPrimary / 24);
      return maxSAtHr >= 0.65 || meanDustAtHr >= 1.25;
    };

    for (let h = 0; h < 24; h++) {
      if (isHourHighRisk(h)) {
        if (currentStart === null) {
          currentStart = h;
          currentHours = [h];
        } else {
          currentHours.push(h);
        }
      } else if (currentStart !== null) {
        const startH = currentStart;
        const endH = currentHours[currentHours.length - 1];
        windows.push(buildWindowSummary(startH, endH, currentHours));
        currentStart = null;
        currentHours = [];
      }
    }
    if (currentStart !== null && currentHours.length > 0) {
      windows.push(
        buildWindowSummary(currentStart, currentHours[currentHours.length - 1], currentHours)
      );
    }

    function buildWindowSummary(
      startH: number,
      endH: number,
      hrs: number[]
    ): HighRiskTimeWindow {
      let bestHr = startH;
      let maxS = 0;
      let domRec = top4Receptors[0];
      let dustSum = 0;
      let fiberSum = 0;
      let windSum = 0;
      let maxGust = 0;

      for (const hIdx of hrs) {
        const w = weatherHours[hIdx];
        if (w) {
          windSum += w.windSpeed10m;
          if (w.windGusts10m > maxGust) maxGust = w.windGusts10m;
        }
        const pHp = primaryRec?.hourlyProfile[hIdx];
        if (pHp) {
          dustSum += pHp.depositedDustUgM2;
          fiberSum += pHp.depositedAsbestosFibersM2;
        }
        for (const r of top4Receptors) {
          const s = r.hourlyProfile[hIdx]?.sumQuotient ?? 0;
          if (s > maxS) {
            maxS = s;
            bestHr = hIdx;
            domRec = r;
          }
        }
      }

      const sharePct = Math.min(100, Math.round((dustSum / total24hDustPrimary) * 100));
      const meanW = Number((windSum / Math.max(1, hrs.length)).toFixed(1));
      const isCrit = maxS >= 1.0;

      return {
        id: `win-${startH}-${endH}`,
        startHourIndex: startH,
        endHourIndex: endH,
        startHourLabel: `${String(startH).padStart(2, '0')}:00`,
        endHourLabel: `${String(endH).padStart(2, '0')}:59`,
        peakHourIndex: bestHr,
        peakHourLabel: `${String(bestHr).padStart(2, '0')}:00`,
        severity: isCrit ? 'CRITICAL' : 'ELEVATED',
        maxSumQuotient: Number(maxS.toFixed(2)),
        accumulatedDustInWindowUgM2: Math.round(dustSum),
        shareOf24hDustPct: sharePct,
        accumulatedFibersInWindowM2: Math.round(fiberSum),
        meanWindSpeedMs: meanW,
        maxWindGustsMs: Number(maxGust.toFixed(1)),
        dominantReceptorCode: domRec?.receptorCode ?? 'REC',
        dominantReceptorName: domRec?.receptorName ?? 'Receptor',
        actionRecommendation: isCrit
          ? 'Indstil tør mekanisk betonknusning/tagnedtagning i dette interval; kræv aktiv højtryks-vandforstøvning og inddækning (BEK 613/2026).'
          : 'Skærpet støvdæmpning påkrævet: reducer faldhøjde ved sortering/læsning og overvåg grænseværdi ved nabofacader.',
      };
    }

    const sortedWindows = [...windows].sort(
      (a, b) => b.accumulatedDustInWindowUgM2 - a.accumulatedDustInWindowUgM2
    );

    const uLabel =
      metricMode === 'dust_ug_m2'
        ? 'µg/m²'
        : metricMode === 'sum_quotient_st'
        ? 'S·t'
        : 'fibre/m²';

    const mTitle =
      metricMode === 'dust_ug_m2'
        ? 'Akkumuleret Respirabel Støvdosis (µg/m²)'
        : metricMode === 'sum_quotient_st'
        ? 'Akkumuleret Sumkvotient-Dosis (∑ S·t)'
        : 'Akkumuleret Asbest- & Kvartsfiber-Dosis (fibre/m²)';

    const curRow = series[currentWeather.hourIndex] || series[0] || {};

    return {
      chartSeries: series,
      highRiskWindows: sortedWindows,
      primaryWindow: sortedWindows[0] || null,
      unitLabel: uLabel,
      metricTitle: mTitle,
      selectedHourTotals: curRow,
    };
  }, [top4Receptors, metricMode, weatherHours, currentWeather.hourIndex]);

  const toggleReceptorVisibility = (recId: string) => {
    setHiddenReceptorIds((prev) => ({
      ...prev,
      [recId]: !prev[recId],
    }));
  };

  return (
    <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-md space-y-3">
      {/* Header & Dose Metric Switcher */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-bold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>AKKUMULERET RESPIRABEL STØVDOSIS OVER TID (TOP 4 UDSATTE RECEPTORER)</span>
          </div>
          <h4 className="text-xs font-bold text-white mt-0.5">{metricTitle}</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Identificerer specifikke tidsintervaller hvor nedrivningsaktivitet og vindforhold
            forårsager stejl dosis-akkumulering ved de mest udsatte naboreceptorer.
          </p>
        </div>

        {/* Metric Mode Selector Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setMetricMode('dust_ug_m2')}
            className={`px-2 py-1 rounded transition-colors ${
              metricMode === 'dust_ug_m2'
                ? 'bg-rose-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Respirabelt Støv (µg/m²)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('sum_quotient_st')}
            className={`px-2 py-1 rounded transition-colors ${
              metricMode === 'sum_quotient_st'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sumkvotient (∑ S·t)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('fibers_m2')}
            className={`px-2 py-1 rounded transition-colors ${
              metricMode === 'fibers_m2'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Asbestfibre (fibre/m²)
          </button>
        </div>
      </div>

      {/* Interactive Top 4 Receptor Filter & Cumulative Readout Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {top4Receptors.map((rec, idx) => {
          const palette = RECEPTOR_LINE_COLORS[idx % RECEPTOR_LINE_COLORS.length];
          const isHidden = Boolean(hiddenReceptorIds[rec.receptorId]);
          const isSelectedOnMap = selectedReceptorId === rec.receptorId;
          const cumAtSelectedHour = Number(selectedHourTotals[`cum_${rec.receptorId}`] ?? 0);
          const total24hVal =
            metricMode === 'dust_ug_m2'
              ? rec.totalDepositedHeavyMetalsAndPcbUgM2
              : metricMode === 'sum_quotient_st'
              ? Number(rec.cumulativeSumDose.toFixed(1))
              : rec.totalDepositedAsbestosFibersM2;

          return (
            <div
              key={rec.receptorId}
              className={`p-2 rounded border transition-all flex items-center justify-between gap-2 font-mono text-[11px] ${
                isHidden
                  ? 'bg-slate-950/40 border-slate-800/60 opacity-50'
                  : isSelectedOnMap
                  ? 'bg-slate-950 border-white ring-1 ring-white/50'
                  : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectReceptor(rec.receptorId)}
                className="flex items-center gap-2 text-left min-w-0 flex-1"
                title={`Fokusér kortet på ${rec.receptorName} (${rec.address})`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
                  style={{ backgroundColor: palette.stroke }}
                />
                <div className="truncate">
                  <div className="font-bold text-white truncate">
                    #{idx + 1} {rec.receptorCode}: {rec.receptorName}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Ved kl. {currentWeather.hourLabel}:{' '}
                    <strong className="text-slate-200">
                      {cumAtSelectedHour.toLocaleString('da-DK')} {unitLabel}
                    </strong>{' '}
                    (24t: {total24hVal.toLocaleString('da-DK')} {unitLabel})
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleReceptorVisibility(rec.receptorId)}
                className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300 hover:text-white shrink-0"
                title={isHidden ? 'Vis kurve på graf' : 'Skjul kurve på graf'}
              >
                {isHidden ? 'Vis' : 'Aktiv'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Recharts 24-Hour Cumulative Dose & Hourly Influx Rate Chart */}
      <div className="p-2.5 bg-slate-950/95 border border-slate-800/90 rounded space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-semibold">
              Kurver: Akkumuleret Dosis ({unitLabel})
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-rose-300">
              Søjler: Time-tilvækst (Δ {unitLabel}/time)
            </span>
          </div>
          {primaryWindow && (
            <span className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-500/50 text-rose-200 font-bold">
              ⚠ Højrisiko-interval: kl. {primaryWindow.startHourLabel}–{primaryWindow.endHourLabel}
            </span>
          )}
        </div>

        <div className="w-full h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartSeries}
              margin={{ top: 8, right: 6, bottom: 0, left: -8 }}
              onClick={(state) => {
                if (state && typeof state.activeTooltipIndex === 'number') {
                  const idx = state.activeTooltipIndex;
                  if (idx >= 0 && idx < chartSeries.length) {
                    onSelectHour(Number(chartSeries[idx].hourIndex));
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

              <XAxis
                dataKey="shortHour"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                interval={2}
              />

              <YAxis
                yAxisId="cum"
                orientation="left"
                stroke="#f8fafc"
                tick={{ fill: '#cbd5e1', fontSize: 9.5, fontFamily: 'monospace' }}
                tickLine={false}
              />

              <YAxis
                yAxisId="rate"
                orientation="right"
                stroke="#fb7185"
                tick={{ fill: '#fda4af', fontSize: 9.5, fontFamily: 'monospace' }}
                tickLine={false}
              />

              {/* Highlighted High-Risk Demolition Time Window(s) */}
              {highRiskWindows.map((win) => (
                <ReferenceArea
                  key={win.id}
                  yAxisId="cum"
                  x1={String(win.startHourIndex).padStart(2, '0')}
                  x2={String(win.endHourIndex).padStart(2, '0')}
                  fill={win.severity === 'CRITICAL' ? '#e11d48' : '#f59e0b'}
                  fillOpacity={win.severity === 'CRITICAL' ? 0.16 : 0.1}
                  stroke={win.severity === 'CRITICAL' ? '#f43f5e' : '#fbbf24'}
                  strokeOpacity={0.5}
                  strokeDasharray="3 3"
                />
              ))}

              {/* Active Time-Slider Hour Vertical Reference Line */}
              <ReferenceLine
                yAxisId="cum"
                x={String(currentWeather.hourIndex).padStart(2, '0')}
                stroke="#ffffff"
                strokeWidth={1.6}
                strokeDasharray="3 2"
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const row = payload[0].payload as Record<string, number | string>;
                  const hrIdx = Number(row.hourIndex ?? 0);
                  const matchingWin = highRiskWindows.find(
                    (w) => hrIdx >= w.startHourIndex && hrIdx <= w.endHourIndex
                  );

                  return (
                    <div className="bg-slate-950/95 border border-slate-700 rounded p-2.5 shadow-2xl font-mono text-[11px] space-y-1.5 max-w-xs">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                        <span className="font-bold text-white">
                          Kl. {row.hourLabel} (Akkumuleret Dosis)
                        </span>
                        <span className="text-amber-300 font-bold">
                          S_max = {Number(row.maxHourlyS ?? 0).toFixed(2)}
                        </span>
                      </div>

                      {matchingWin && (
                        <div className="px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-500/60 text-rose-200 font-bold text-[11px]">
                          ⚠ HØJRISIKO-INTERVAL ({matchingWin.startHourLabel}–
                          {matchingWin.endHourLabel})
                        </div>
                      )}

                      <div className="space-y-1">
                        {top4Receptors.map((rec, idx) => {
                          if (hiddenReceptorIds[rec.receptorId]) return null;
                          const palette =
                            RECEPTOR_LINE_COLORS[idx % RECEPTOR_LINE_COLORS.length];
                          const cumVal = Number(row[`cum_${rec.receptorId}`] ?? 0);
                          const rateVal = Number(row[`rate_${rec.receptorId}`] ?? 0);
                          return (
                            <div
                              key={rec.receptorId}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: palette.stroke }}
                                />
                                <span className="text-slate-200 font-semibold">
                                  {rec.receptorCode}:
                                </span>
                              </span>
                              <span className="text-white font-bold">
                                {cumVal.toLocaleString('da-DK')} {unitLabel}{' '}
                                <span className="text-rose-300 font-normal">
                                  (+{rateVal.toLocaleString('da-DK')}/t)
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />

              {/* Hourly Dust/Dose Influx Rate Bars (Right Axis) to highlight steep accumulation intervals */}
              <Bar
                yAxisId="rate"
                dataKey="peakHourlyInflux"
                name={`Time-tilvækst (${unitLabel}/t)`}
                fill="#f43f5e"
                fillOpacity={0.28}
                radius={[2, 2, 0, 0]}
              />

              {/* Cumulative Dose Curves for Top 4 Exposed Receptors (Left Axis) */}
              {top4Receptors.map((rec, idx) => {
                if (hiddenReceptorIds[rec.receptorId]) return null;
                const palette = RECEPTOR_LINE_COLORS[idx % RECEPTOR_LINE_COLORS.length];
                if (idx === 0) {
                  return (
                    <Area
                      key={rec.receptorId}
                      yAxisId="cum"
                      type="monotone"
                      dataKey={`cum_${rec.receptorId}`}
                      name={rec.receptorCode}
                      stroke={palette.stroke}
                      strokeWidth={2.5}
                      fill={palette.fill}
                      fillOpacity={0.14}
                      activeDot={{
                        r: 4.5,
                        fill: palette.stroke,
                        stroke: '#ffffff',
                        strokeWidth: 1.5,
                      }}
                    />
                  );
                }
                return (
                  <Line
                    key={rec.receptorId}
                    yAxisId="cum"
                    type="monotone"
                    dataKey={`cum_${rec.receptorId}`}
                    name={rec.receptorCode}
                    stroke={palette.stroke}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: palette.stroke,
                      stroke: '#ffffff',
                      strokeWidth: 1.4,
                    }}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>Klik på et punkt på kurven for at hoppe til klokkeslættet på kortet</span>
          </span>
          <span className="text-slate-300">
            Valgt: <strong>kl. {currentWeather.hourLabel}</strong>
          </span>
        </div>
      </div>

      {/* Identified High-Risk Demolition Time Intervals List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>
              Identificerede Tidsintervaller med Høj Miljørisiko ({highRiskWindows.length})
            </span>
          </h5>
          <span className="text-[11px] font-mono text-slate-400">
            Klik for at inspicere interval
          </span>
        </div>

        {highRiskWindows.length === 0 ? (
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-emerald-300">
            Ingen kritiske højrisiko-intervaller registreret med den aktuelle kildenode-opsætning.
          </div>
        ) : (
          <div className="space-y-2">
            {highRiskWindows.slice(0, 3).map((win) => {
              const isCurrentInWindow =
                currentWeather.hourIndex >= win.startHourIndex &&
                currentWeather.hourIndex <= win.endHourIndex;

              return (
                <div
                  key={win.id}
                  onClick={() => onSelectHour(win.peakHourIndex)}
                  className={`p-2.5 rounded border cursor-pointer transition-colors space-y-1.5 ${
                    isCurrentInWindow
                      ? 'bg-rose-950/40 border-rose-400 ring-1 ring-rose-400/40'
                      : win.severity === 'CRITICAL'
                      ? 'bg-rose-950/20 border-rose-500/50 hover:border-rose-400'
                      : 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono text-[11px]">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          win.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <span>
                        Interval kl. {win.startHourLabel}–{win.endHourLabel} (Spids kl.{' '}
                        {win.peakHourLabel})
                      </span>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        win.severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-400 text-slate-950'
                      }`}
                    >
                      {win.shareOf24hDustPct}% af døgn-dosis · S_max = {win.maxSumQuotient.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] bg-slate-950/80 p-1.5 rounded border border-slate-800/80">
                    <div>
                      <div className="text-slate-400">Støv-Tilvækst</div>
                      <div className="font-bold text-rose-300">
                        +{win.accumulatedDustInWindowUgM2.toLocaleString('da-DK')} µg/m²
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Fiber-Tilvækst</div>
                      <div className="font-bold text-cyan-300">
                        +{win.accumulatedFibersInWindowM2.toLocaleString('da-DK')} f/m²
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Vind / Stød</div>
                      <div className="font-bold text-amber-300">
                        {win.meanWindSpeedMs} / {win.maxWindGustsMs} m/s
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300 leading-snug">
                    <strong className="text-amber-300">Mest udsat:</strong>{' '}
                    {win.dominantReceptorCode} ({win.dominantReceptorName}) —{' '}
                    {win.actionRecommendation}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
