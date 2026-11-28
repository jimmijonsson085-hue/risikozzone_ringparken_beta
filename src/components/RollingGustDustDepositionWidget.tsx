/**
 * @file src/components/RollingGustDustDepositionWidget.tsx
 * @description Widget i 'Noise Dust' (Støj & Støv)-panelet der beregner den rullende korrelation
 * mellem Open-Meteo vindstød (>10 m/s) og den kumulative respirable støv-deposition (µg/m²)
 * for at identificere risikofyldte vejrhændelser.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, RefreshCw, TrendingUp, Wind } from 'lucide-react';
import { HourlyReceptorPuffDose, HourlyWeatherPoint } from '../types/dispersion';
import {
  OpenMeteoLast24hResult,
  fetchOpenMeteoLast24HoursWindHistory,
} from '../services/weatherService';
import {
  RollingGustDustPoint,
  computeRollingGustCumulativeDustCorrelation,
} from '../utils/rollingGustDustDepositionCorrelation';

export interface RollingGustDustDepositionWidgetProps {
  weatherHours: HourlyWeatherPoint[];
  hourlyReceptorProfile?: HourlyReceptorPuffDose[];
  receptorName: string;
  selectedHourIndex: number;
  onSelectHour: (hourIndex: number) => void;
  dateIso: string;
}

type RollingWindowSpan = 4 | 6 | 8;
type GustDustSourceMode = 'selected_day' | 'open_meteo_live';

export const RollingGustDustDepositionWidget: React.FC<
  RollingGustDustDepositionWidgetProps
> = ({
  weatherHours,
  hourlyReceptorProfile,
  receptorName,
  selectedHourIndex,
  onSelectHour,
  dateIso,
}) => {
  const [windowSpanHours, setWindowSpanHours] = useState<RollingWindowSpan>(6);
  const [dataScope, setDataScope] = useState<GustDustSourceMode>('selected_day');
  const [openMeteoData, setOpenMeteoData] = useState<OpenMeteoLast24hResult | null>(null);
  const [isFetchingOpenMeteo, setIsFetchingOpenMeteo] = useState<boolean>(false);

  const loadOpenMeteo24h = useCallback(async () => {
    setIsFetchingOpenMeteo(true);
    try {
      const result = await fetchOpenMeteoLast24HoursWindHistory(weatherHours);
      setOpenMeteoData(result);
    } finally {
      setIsFetchingOpenMeteo(false);
    }
  }, [weatherHours]);

  useEffect(() => {
    let cancelled = false;
    setIsFetchingOpenMeteo(true);
    fetchOpenMeteoLast24HoursWindHistory(weatherHours)
      .then((res) => {
        if (!cancelled) setOpenMeteoData(res);
      })
      .finally(() => {
        if (!cancelled) setIsFetchingOpenoStateSafe(false);
      });
    function setIsFetchingOpenoStateSafe(val: boolean) {
      if (!cancelled) setIsFetchingOpenMeteo(val);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveHours = useMemo(() => {
    if (dataScope === 'open_meteo_live' && openMeteoData?.hours.length) {
      return openMeteoData.hours;
    }
    return weatherHours;
  }, [dataScope, openMeteoData, weatherHours]);

  const summary = useMemo(
    () =>
      computeRollingGustCumulativeDustCorrelation({
        weatherHours: effectiveHours,
        hourlyReceptorProfile,
        windowSpanHours,
        gustThresholdMs: 10.0,
        useLiveOpenMeteoSeries: dataScope === 'open_meteo_live',
      }),
    [effectiveHours, hourlyReceptorProfile, windowSpanHours, dataScope]
  );

  const activePoint: RollingGustDustPoint | null = useMemo(() => {
    if (summary.points.length === 0) return null;
    return (
      summary.points.find((p) => p.hourIndex === selectedHourIndex) ??
      summary.points[summary.points.length - 1]
    );
  }, [summary.points, selectedHourIndex]);

  const maxGustInSeries = useMemo(() => {
    if (summary.points.length === 0) return 0;
    return Math.max(...summary.points.map((p) => p.windGustMs));
  }, [summary.points]);

  const provenanceText =
    dataScope === 'open_meteo_live'
      ? openMeteoData?.sourceApi || 'Open-Meteo Live (Seneste 24t)'
      : `Simuleringsdøgn ${dateIso} · Receptor: ${receptorName}`;

  const activeR = activePoint?.rollingCorrelationR ?? summary.currentRollingR;

  return (
    <section
      data-testid="rolling-gust-dust-deposition-widget"
      className="rounded-lg bg-[#0F172A] border border-[#2D3B50] p-4 space-y-3.5 text-slate-100"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-2.5 pb-3 border-b border-slate-800">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Rullende Korrelation: Open-Meteo Vindstød (&gt;10 m/s) ↔ Kumulativ Støv-Deposition</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            {provenanceText}
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums text-slate-300">
              Vindue: {windowSpanHours} timer
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 font-mono text-[11px]">
          <div
            role="group"
            aria-label="Vælg rullende tidsvindue"
            className="flex items-center rounded bg-[#0B0E17] border border-slate-700 p-0.5"
          >
            {([4, 6, 8] as RollingWindowSpan[]).map((span) => (
              <button
                key={span}
                type="button"
                onClick={() => setWindowSpanHours(span)}
                className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  windowSpanHours === span
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {span}t
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Vælg datakilde til støv og vindstød"
            className="flex items-center rounded bg-[#0B0E17] border border-slate-700 p-0.5"
          >
            <button
              type="button"
              onClick={() => setDataScope('selected_day')}
              className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                dataScope === 'selected_day'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Valgt Døgn
            </button>
            <button
              type="button"
              onClick={() => setDataScope('open_meteo_live')}
              className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                dataScope === 'open_meteo_live'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Open-Meteo 24t
            </button>
          </div>

          <button
            type="button"
            onClick={loadOpenMeteo24h}
            disabled={isFetchingOpenMeteo}
            className="px-2.5 py-1 rounded bg-[#0B0E17] hover:bg-slate-800 border border-slate-700 text-cyan-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            title="Hent seneste 24-timers vindstød fra Open-Meteo"
          >
            <RefreshCw
              className={`w-3 h-3 shrink-0 ${isFetchingOpenMeteo ? 'animate-spin' : ''}`}
            />
            <span>Opdater</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
        <div className="p-2.5 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400">Rullende r ({windowSpanHours}t)</div>
          <div
            className={`text-sm font-bold ${
              activeR >= 0.7
                ? 'text-rose-400'
                : activeR >= 0.4
                ? 'text-amber-300'
                : 'text-cyan-300'
            }`}
          >
            r = {activeR.toFixed(3)}
          </div>
          <div className="text-[10.5px] text-slate-400">
            Spids r: {summary.peakRollingR.toFixed(2)} · {activePoint?.rollingStrengthLabelDa ?? 'SVAG'}
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400">Vindstød &gt;10 m/s</div>
          <div
            className={`text-sm font-bold ${
              summary.highGustHoursCount > 0 ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {summary.highGustHoursCount} timer
          </div>
          <div className="text-[10.5px] text-slate-400">
            Maks stød: {maxGustInSeries.toFixed(1)} m/s
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400">Kumulativ Støv (24t)</div>
          <div className="text-sm font-bold text-cyan-300">
            {summary.totalCumulativeDustUgM2.toFixed(1)} µg/m²
          </div>
          <div className="text-[10.5px] text-slate-400">
            Resuspension: {summary.dustResuspensionMultiplier.toFixed(2)}× ved &gt;10 m/s
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400">Risikohændelser</div>
          <div
            className={`text-sm font-bold ${
              summary.criticalEventCount > 0
                ? 'text-rose-400'
                : summary.highRiskEventCount > 0
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {summary.highRiskEventCount} fundet
          </div>
          <div className="text-[10.5px] text-slate-400">
            Kritisk: {summary.criticalEventCount} · Høj: {summary.highRiskEventCount - summary.criticalEventCount}
          </div>
        </div>
      </div>

      {/* Main Composed Chart: Cumulative Dust Deposition (µg/m²) vs Open-Meteo Wind Gusts (m/s) */}
      <div className="rounded bg-[#0B0E17] border border-slate-800 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-mono text-slate-300">
          <span>Kumulativ respirabel støv-deposition (µg/m²) vs. vindstød (m/s)</span>
          <span className="text-amber-300 tabular-nums">
            Tærskel: 10,0 m/s vindstød
          </span>
        </div>

        <div className="h-[215px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={summary.points}
              margin={{ top: 10, right: 10, left: -4, bottom: 4 }}
              onClick={(state) => {
                const idx = state?.activeTooltipIndex;
                if (typeof idx === 'number' && summary.points[idx]) {
                  onSelectHour(summary.points[idx].hourIndex);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hourLabel" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={2} />
              <YAxis
                yAxisId="dust"
                domain={[0, 'auto']}
                tick={{ fill: '#38bdf8', fontSize: 10 }}
                unit=" µg"
              />
              <YAxis
                yAxisId="gust"
                orientation="right"
                domain={[0, 'auto']}
                tick={{ fill: '#fbbf24', fontSize: 10 }}
                unit=" m/s"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0]?.payload as RollingGustDustPoint | undefined;
                  if (!pt) return null;
                  return (
                    <div className="rounded bg-[#090d16] border border-slate-700 p-2.5 shadow-xl font-mono text-[11px] tabular-nums space-y-1 max-w-[270px]">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                        <span className="font-bold text-white">Kl. {pt.hourLabel}</span>
                        <span
                          className={
                            pt.riskSeverity === 'CRITICAL'
                              ? 'text-rose-400 font-bold'
                              : pt.riskSeverity === 'HIGH_RISK'
                              ? 'text-amber-300 font-bold'
                              : 'text-slate-300'
                          }
                        >
                          {pt.riskSeverity === 'CRITICAL'
                            ? 'KRITISK'
                            : pt.riskSeverity === 'HIGH_RISK'
                            ? 'HØJ RISIKO'
                            : pt.riskSeverity === 'WATCH'
                            ? 'OBSERVATION'
                            : 'NOMINAL'}
                        </span>
                      </div>
                      <div className="text-amber-300">
                        Vindstød: <strong>{pt.windGustMs.toFixed(1)} m/s</strong>{' '}
                        <span className="text-slate-400">(middel {pt.windSpeedMs.toFixed(1)})</span>
                      </div>
                      <div className="text-cyan-300">
                        Kumulativ støv: <strong>{pt.cumulativeDustUgM2.toFixed(1)} µg/m²</strong>{' '}
                        <span className="text-slate-400">(+{pt.hourlyDustUgM2.toFixed(1)}/t)</span>
                      </div>
                      <div className="text-rose-300">
                        Rullende ({pt.windowLabel}):{' '}
                        <strong>r = {pt.rollingCorrelationR.toFixed(3)}</strong>
                      </div>
                      <div className="text-[10px] text-slate-300 leading-snug pt-0.5">
                        {pt.riskReasonDa}
                      </div>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                yAxisId="gust"
                y={10}
                stroke="#f59e0b"
                strokeDasharray="4 3"
                label={{
                  value: '10 m/s stødgrænse',
                  fill: '#fcd34d',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Area
                yAxisId="dust"
                type="monotone"
                dataKey="cumulativeDustUgM2"
                stroke="#22d3ee"
                fill="#06b6d4"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Line
                yAxisId="gust"
                type="monotone"
                dataKey="windGustMs"
                stroke="#fbbf24"
                strokeWidth={2.1}
                dot={(dotProps) => {
                  const pt = dotProps.payload as RollingGustDustPoint;
                  const isCrit = pt?.riskSeverity === 'CRITICAL';
                  const isHigh = pt?.isHighGustOver10Ms;
                  return (
                    <circle
                      key={`gust-dot-${dotProps.index}`}
                      cx={dotProps.cx}
                      cy={dotProps.cy}
                      r={isCrit ? 4.8 : isHigh ? 3.8 : 2.5}
                      fill={isCrit ? '#f43f5e' : isHigh ? '#f59e0b' : '#fde047'}
                      stroke="#090d16"
                      strokeWidth={1}
                    />
                  );
                }}
                activeDot={{ r: 5.5, fill: '#ffffff', stroke: '#f59e0b' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Synchronized 24h Rolling Correlation Interactive Strip */}
        <div className="space-y-1 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400">
            <span>Time-for-time rullende korrelation (r) · Klik time for at fokusere</span>
            <span className="tabular-nums text-slate-300">
              Høj støvrate (&gt;10 m/s): {summary.meanHourlyDustDuringHighGustUgM2.toFixed(1)} vs.{' '}
              {summary.meanHourlyDustDuringCalmUgM2.toFixed(1)} µg/m²/t
            </span>
          </div>
          <div className="grid grid-cols-12 sm:grid-cols-24 gap-1">
            {summary.points.map((pt) => {
              const isSelected = pt.hourIndex === selectedHourIndex;
              const barColor =
                pt.riskSeverity === 'CRITICAL'
                  ? 'bg-rose-500 border-rose-300 text-white'
                  : pt.riskSeverity === 'HIGH_RISK'
                  ? 'bg-amber-500/85 border-amber-300 text-slate-950'
                  : pt.isHighGustOver10Ms
                  ? 'bg-amber-900/60 border-amber-500/60 text-amber-200'
                  : pt.rollingCorrelationR >= 0.65
                  ? 'bg-cyan-900/55 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400';

              return (
                <button
                  key={`rolling-slot-${pt.slotIndex}`}
                  type="button"
                  onClick={() => onSelectHour(pt.hourIndex)}
                  title={`${pt.hourLabel}: Stød ${pt.windGustMs.toFixed(
                    1
                  )} m/s · Kumulativ ${pt.cumulativeDustUgM2.toFixed(
                    1
                  )} µg/m² · Rullende r=${pt.rollingCorrelationR.toFixed(2)}`}
                  className={`py-1 rounded border text-[9.5px] font-mono tabular-nums text-center cursor-pointer transition-colors ${barColor} ${
                    isSelected ? 'ring-1 ring-white font-bold' : ''
                  }`}
                >
                  {pt.shortHour}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Identified High-Risk Weather Events List */}
      <div className="rounded bg-[#0B0E17] border border-slate-800 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-200">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Identificerede Risikofyldte Vejrhændelser (&gt;10 m/s × Kumulativ Støv)</span>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-slate-400">
            {summary.identifiedRiskEvents.length} hændelser
          </span>
        </div>

        {summary.identifiedRiskEvents.length === 0 ? (
          <div className="px-2.5 py-2 rounded bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <Wind className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Ingen timer i denne 24-timers serie kombinerer vindstød over 10,0 m/s med høj
              kumulativ støvkorrelation. Prøv Open-Meteo 24t eller en stormfuld simuleringsdag.
            </span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 max-h-[168px] overflow-y-auto">
            {summary.identifiedRiskEvents.slice(0, 6).map((ev) => {
              const isSelected = ev.hourIndex === selectedHourIndex;
              const isCrit = ev.riskSeverity === 'CRITICAL';
              return (
                <button
                  key={`risk-ev-${ev.slotIndex}`}
                  type="button"
                  onClick={() => onSelectHour(ev.hourIndex)}
                  className={`w-full px-2 py-2 flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer transition-colors hover:bg-slate-900/90 ${
                    isSelected ? 'bg-slate-900' : ''
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span
                        className={`font-bold ${
                          isCrit ? 'text-rose-400' : 'text-amber-300'
                        }`}
                      >
                        {isCrit ? 'KRITISK' : 'HØJ RISIKO'}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-white font-semibold">Kl. {ev.hourLabel}</span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-amber-200">{ev.windGustMs.toFixed(1)} m/s stød</span>
                    </div>
                    <p className="text-[11px] text-slate-300 truncate">{ev.riskReasonDa}</p>
                  </div>

                  <div className="font-mono text-[11px] tabular-nums text-right shrink-0">
                    <div className="text-cyan-300 font-semibold">
                      {ev.cumulativeDustUgM2.toFixed(1)} µg/m²
                    </div>
                    <div className="text-[10px] text-slate-400">
                      r = {ev.rollingCorrelationR.toFixed(2)} ({ev.windowLabel})
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
