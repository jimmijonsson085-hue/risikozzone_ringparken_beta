/**
 * @file src/components/OpenMeteo24hWindImpulseCorrelationChart.tsx
 * @description Interaktiv korrelationsgraf der viser sammenhængen mellem vindhastighed (m/s)
 * og impulsstøj (dB(A)) for de seneste 24 timer baseret på Open-Meteo data.
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
import {
  Activity,
  Crosshair,
  RefreshCw,
  TrendingUp,
  Volume2,
  Wind,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
} from '../types/dispersion';
import {
  OpenMeteoLast24hResult,
  fetchOpenMeteoLast24HoursWindHistory,
} from '../services/weatherService';
import { DEFAULT_DEMOLITION_MACHINERY_PROFILES } from '../utils/gustNoiseStatistics';
import {
  OpenMeteoWindImpulsePoint,
  computeOpenMeteoWindImpulseCorrelation,
} from '../utils/openMeteoWindImpulseCorrelation';
import { useAcousticWeighting } from '../context/AcousticWeightingContext';

export interface OpenMeteo24hWindImpulseCorrelationChartProps {
  weatherHours: HourlyWeatherPoint[];
  selectedHourIndex: number;
  onSelectHour: (hourIndex: number) => void;
  sources: DemolitionSourceNode[];
  observations: AlgedonicObservation[];
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  dateIso: string;
}

type ChartViewMode = 'scatter' | 'timeline';
type DataSourceScope = 'open_meteo_last24h' | 'selected_day';

export const OpenMeteo24hWindImpulseCorrelationChart: React.FC<
  OpenMeteo24hWindImpulseCorrelationChartProps
> = ({
  weatherHours,
  selectedHourIndex,
  onSelectHour,
  sources,
  observations,
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
  dateIso,
}) => {
  const { convertDb, unitLabel, labels } = useAcousticWeighting();
  const [viewMode, setViewMode] = useState<ChartViewMode>('scatter');
  const [dataScope, setDataScope] = useState<DataSourceScope>('open_meteo_last24h');
  const [selectedMachineryId, setSelectedMachineryId] = useState<string>('active_site');
  const [distanceMeters, setDistanceMeters] = useState<number>(45);
  const [isolateWindPhysics, setIsolateWindPhysics] = useState<boolean>(false);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);

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
        if (!cancelled) setIsFetchingOpenMeteo(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSourcesCount = useMemo(
    () => Math.max(1, sources.filter((s) => s.active).length),
    [sources]
  );

  const machineSpec = useMemo(() => {
    if (selectedMachineryId === 'active_site') {
      const lwa = isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114;
      return {
        label: `Aktiv L_WA (${lwa.toFixed(0)} dB)`,
        lwaDb: lwa,
        impulsePenaltyDb: 14.5,
      };
    }
    const found =
      DEFAULT_DEMOLITION_MACHINERY_PROFILES.find((p) => p.modeId === selectedMachineryId) ||
      DEFAULT_DEMOLITION_MACHINERY_PROFILES[0];
    return {
      label: found.shortLabel,
      lwaDb: found.lwaDb,
      impulsePenaltyDb: found.impulsePenaltyDb,
    };
  }, [selectedMachineryId, isManualMachineNoiseOverrideActive, manualMachineNoiseOutputDb]);

  const effectiveHours = useMemo(() => {
    if (dataScope === 'open_meteo_last24h' && openMeteoData?.hours.length) {
      return openMeteoData.hours;
    }
    return weatherHours;
  }, [dataScope, openMeteoData, weatherHours]);

  const correlation = useMemo(
    () =>
      computeOpenMeteoWindImpulseCorrelation({
        weatherHours: effectiveHours,
        observations,
        machineLwaDb: machineSpec.lwaDb,
        impulsePenaltyDb: machineSpec.impulsePenaltyDb,
        distanceMeters,
        activeSourcesCount,
        ignoreWorkScheduleAttenuation: isolateWindPhysics,
      }),
    [
      effectiveHours,
      observations,
      machineSpec,
      distanceMeters,
      activeSourcesCount,
      isolateWindPhysics,
    ]
  );

  const weightedPoints = useMemo(
    () =>
      correlation.points.map((pt) => ({
        ...pt,
        displayImpulseDb: convertDb(pt.impulseDb, {
          windSpeedMs: pt.windSpeedMs,
          windGustMs: pt.windGustsMs,
          isImpulse: true,
        }),
      })),
    [correlation.points, convertDb]
  );

  const displayMaxImpulseDb = useMemo(
    () =>
      weightedPoints.length > 0
        ? Math.max(...weightedPoints.map((p) => p.displayImpulseDb))
        : convertDb(correlation.maxImpulseDb, { isImpulse: true }),
    [weightedPoints, correlation.maxImpulseDb, convertDb]
  );

  const displayMinImpulseDb = useMemo(
    () =>
      weightedPoints.length > 0
        ? Math.min(...weightedPoints.map((p) => p.displayImpulseDb))
        : convertDb(correlation.minImpulseDb, { isImpulse: true }),
    [weightedPoints, correlation.minImpulseDb, convertDb]
  );

  const displayLimit85Db = convertDb(85, { isImpulse: true });

  const inspectedPoint = useMemo(() => {
    if (weightedPoints.length === 0) return null;
    if (hoveredSlotIndex !== null) {
      return (
        weightedPoints.find((p) => p.slotIndex === hoveredSlotIndex) ??
        weightedPoints[0]
      );
    }
    return (
      weightedPoints.find((p) => p.hourIndex === selectedHourIndex) ??
      weightedPoints[weightedPoints.length - 1]
    );
  }, [weightedPoints, hoveredSlotIndex, selectedHourIndex]);

  // SVG scatter dimensions
  const W = 540;
  const H = 224;
  const padL = 42;
  const padR = 18;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const minW = Math.max(0, Math.floor(correlation.minWindSpeedMs - 1));
  const maxW = Math.max(14, Math.ceil(correlation.maxWindSpeedMs + 1.5));
  const minDb = Math.min(45, Math.floor(displayMinImpulseDb - 4));
  const maxDb = Math.max(Math.ceil(displayLimit85Db + 7), Math.ceil(displayMaxImpulseDb + 4));

  const xForWind = (w: number) =>
    padL + ((Math.min(maxW, Math.max(minW, w)) - minW) / Math.max(1, maxW - minW)) * plotW;
  const yForDb = (db: number) =>
    padT +
    plotH -
    ((Math.min(maxDb, Math.max(minDb, db)) - minDb) / Math.max(1, maxDb - minDb)) * plotH;

  const avgDisplayOffset =
    weightedPoints.length > 0
      ? weightedPoints.reduce((acc, p) => acc + (p.displayImpulseDb - p.impulseDb), 0) /
        weightedPoints.length
      : convertDb(85, { isImpulse: true }) - 85;
  const regY1 = correlation.interceptDb + correlation.slopeDbPerMs * minW + avgDisplayOffset;
  const regY2 = correlation.interceptDb + correlation.slopeDbPerMs * maxW + avgDisplayOffset;

  const provenanceLabel =
    dataScope === 'open_meteo_last24h'
      ? openMeteoData?.sourceApi || 'Open-Meteo Forecast API (Seneste 24 timer)'
      : `Simuleret døgn (${dateIso})`;

  return (
    <section
      data-testid="open-meteo-24h-wind-impulse-correlation-chart"
      className="rounded-lg bg-[#0F172A] border border-[#2D3B50] p-3.5 space-y-3 text-slate-100"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs font-mono uppercase tracking-wide">
            <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Open-Meteo 24t Korrelationsgraf: Vindhastighed (m/s) ↔ Impulsstøj ({unitLabel})</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Kilde: <span className="text-cyan-200 font-medium">{provenanceLabel}</span> · 55.41°N, 11.35°Ø
            {openMeteoData?.fetchedAtIso && dataScope === 'open_meteo_last24h' && (
              <span className="text-slate-400 font-mono tabular-nums">
                {' '}
                (Hentet {openMeteoData.fetchedAtIso.slice(11, 16)} UTC)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded bg-[#0B0E17] border border-slate-700 p-0.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setDataScope('open_meteo_last24h')}
              className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap transition-colors ${
                dataScope === 'open_meteo_last24h'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Seneste 24t (Open-Meteo)
            </button>
            <button
              type="button"
              onClick={() => setDataScope('selected_day')}
              className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap transition-colors ${
                dataScope === 'selected_day'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Valgt Døgn ({dateIso.slice(5)})
            </button>
          </div>

          <button
            type="button"
            onClick={loadOpenMeteo24h}
            disabled={isFetchingOpenMeteo}
            className="px-2 py-1 rounded bg-[#0B0E17] hover:bg-slate-800 border border-slate-700 text-cyan-200 text-[11px] font-mono font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            title="Hent friske 24-timers time-for-time vinddata fra Open-Meteo API"
          >
            <RefreshCw
              className={`w-3 h-3 shrink-0 ${isFetchingOpenMeteo ? 'animate-spin' : ''}`}
            />
            <span>{isFetchingOpenMeteo ? 'Henter...' : 'Opdater Open-Meteo'}</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded bg-[#0B0E17] border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('scatter')}
              className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap transition-colors ${
                viewMode === 'scatter'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Korrelations-Scatter (m/s ↔ {unitLabel})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              24-Timers Kurve
            </button>
          </div>

          <select
            aria-label="Vælg maskinprofil for Open-Meteo korrelationsgraf"
            value={selectedMachineryId}
            onChange={(e) => setSelectedMachineryId(e.target.value)}
            className="bg-[#0B0E17] border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-cyan-400"
          >
            <option value="active_site">
              Aktiv styring ({convertDb(isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114).toFixed(0)} {unitLabel} {labels.lwaLabel})
            </option>
            {DEFAULT_DEMOLITION_MACHINERY_PROFILES.map((m) => (
              <option key={m.modeId} value={m.modeId}>
                {m.shortLabel}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded bg-[#0B0E17] border border-slate-700 p-0.5">
            {[30, 45, 65, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDistanceMeters(d)}
                className={`px-1.5 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                  distanceMeters === d
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsolateWindPhysics((v) => !v)}
          className={`px-2 py-1 rounded border text-[11px] cursor-pointer whitespace-nowrap transition-colors ${
            isolateWindPhysics
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold'
              : 'bg-[#0B0E17] border-slate-700 text-slate-300 hover:text-white'
          }`}
          title="Slår nat-dæmpning fra, så ren fysisk vind-refraktion mellem Open-Meteo vindhastighed og impulsstøj ses tydeligt"
        >
          {isolateWindPhysics ? '✓ Ren Vind-Fysik (24t kontinuerlig)' : 'Inkl. Dagdrift (07–18)'}
        </button>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400 uppercase">Korrelation (Pearson r)</div>
          <div className="text-sm font-bold text-cyan-300">
            r = {correlation.pearsonR.toFixed(3)}
          </div>
          <div className="text-[10.5px] text-slate-400">
            R² = {correlation.rSquared.toFixed(3)} · t = {correlation.tStatistic.toFixed(2)}
          </div>
        </div>

        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400 uppercase">Hældning (dB pr. m/s)</div>
          <div className="text-sm font-bold text-amber-300">
            {correlation.slopeDbPerMs >= 0 ? '+' : ''}
            {correlation.slopeDbPerMs.toFixed(2)} dB/(m/s)
          </div>
          <div className="text-[10.5px] text-slate-400 truncate" title={correlation.significanceLabelDa}>
            {correlation.significanceLabelDa}
          </div>
        </div>

        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400 uppercase">Vindhastighed (24t)</div>
          <div className="text-sm font-bold text-sky-300">
            {correlation.minWindSpeedMs.toFixed(1)}–{correlation.maxWindSpeedMs.toFixed(1)} m/s
          </div>
          <div className="text-[10.5px] text-slate-400">
            Gns: {correlation.meanWindSpeedMs.toFixed(1)} m/s · {correlation.hoursOver10MsWind}t &gt;10
          </div>
        </div>

        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400 uppercase">Spids Impulsstøj (24t)</div>
          <div
            className={`text-sm font-bold ${
              correlation.maxImpulseDb >= 85 ? 'text-rose-400' : 'text-emerald-300'
            }`}
          >
            {displayMaxImpulseDb.toFixed(1)} {unitLabel}
          </div>
          <div className="text-[10.5px] text-slate-400">
            Kl. {correlation.peakHourLabel} · {correlation.hoursExceeding85Db}t ≥{displayLimit85Db.toFixed(0)} dB
          </div>
        </div>
      </div>

      {/* Main Interactive Correlation Chart */}
      <div className="rounded bg-[#0B0E17] border border-slate-800 p-2.5 space-y-2">
        {viewMode === 'scatter' ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto select-none overflow-visible"
            role="img"
            aria-label="Interaktiv korrelationsgraf mellem Open-Meteo vindhastighed og impulsstøj for de seneste 24 timer"
          >
            {/* Grid horizontal dB ticks */}
            {[50, 60, 70, 80, 90, 100].map((dbTick) => {
              if (dbTick < minDb || dbTick > maxDb) return null;
              const ty = yForDb(dbTick);
              return (
                <g key={dbTick}>
                  <line
                    x1={padL}
                    y1={ty}
                    x2={padL + plotW}
                    y2={ty}
                    stroke="#1e293b"
                    strokeWidth={0.8}
                  />
                  <text
                    x={padL - 6}
                    y={ty + 3}
                    textAnchor="end"
                    className="text-[10px] font-mono fill-slate-400"
                  >
                    {dbTick}
                  </text>
                </g>
              );
            })}

            {/* Impulse 85 dB(A) equivalent limit line */}
            {displayLimit85Db >= minDb && displayLimit85Db <= maxDb && (
              <>
                <line
                  x1={padL}
                  y1={yForDb(displayLimit85Db)}
                  x2={padL + plotW}
                  y2={yForDb(displayLimit85Db)}
                  stroke="#fb7185"
                  strokeWidth={1.2}
                  strokeDasharray="5 3"
                />
                <text
                  x={padL + 6}
                  y={yForDb(displayLimit85Db) - 5}
                  className="fill-rose-300 text-[9.5px] font-mono font-bold"
                >
                  {displayLimit85Db.toFixed(1)} {unitLabel} Impuls-Grænse
                </text>
              </>
            )}

            {/* Vertical 10 m/s threshold if in view */}
            {10 >= minW && 10 <= maxW && (
              <>
                <line
                  x1={xForWind(10)}
                  y1={padT}
                  x2={xForWind(10)}
                  y2={padT + plotH}
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                <text
                  x={xForWind(10) + 4}
                  y={padT + 11}
                  className="fill-amber-300 text-[9.5px] font-mono font-bold"
                >
                  10 m/s
                </text>
              </>
            )}

            {/* X-axis ticks */}
            {Array.from({ length: 6 }, (_, i) => {
              const wVal = Number((minW + ((maxW - minW) * i) / 5).toFixed(1));
              const tx = xForWind(wVal);
              return (
                <g key={i}>
                  <line
                    x1={tx}
                    y1={padT + plotH}
                    x2={tx}
                    y2={padT + plotH + 4}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text
                    x={tx}
                    y={padT + plotH + 15}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9.5px] font-mono"
                  >
                    {wVal}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#334155" strokeWidth="1" />
            <line
              x1={padL}
              y1={padT + plotH}
              x2={padL + plotW}
              y2={padT + plotH}
              stroke="#334155"
              strokeWidth="1"
            />
            <text
              x={padL + plotW / 2}
              y={H - 2}
              textAnchor="middle"
              className="fill-slate-400 text-[10px] font-mono"
            >
              Open-Meteo Vindhastighed v₁₀ₘ (m/s)
            </text>
            <text
              x={12}
              y={padT + plotH / 2}
              textAnchor="middle"
              transform={`rotate(-90 12 ${padT + plotH / 2})`}
              className="fill-slate-400 text-[10px] font-mono"
            >
              Impulsstøj {unitLabel}
            </text>

            {/* Linear Regression Line */}
            {weightedPoints.length >= 2 && (
              <line
                x1={xForWind(minW)}
                y1={yForDb(regY1)}
                x2={xForWind(maxW)}
                y2={yForDb(regY2)}
                stroke="#38bdf8"
                strokeWidth="2"
                strokeOpacity="0.85"
              />
            )}

            {/* Hourly 24h Data Points */}
            {weightedPoints.map((pt) => {
              const cx = xForWind(pt.windSpeedMs);
              const cy = yForDb(pt.displayImpulseDb);
              const isHovered = hoveredSlotIndex === pt.slotIndex;
              const isSelected =
                hoveredSlotIndex === null && pt.hourIndex === selectedHourIndex;
              const fill = pt.exceeds85Db
                ? '#f43f5e'
                : pt.isHighWindOver10Ms
                ? '#f59e0b'
                : '#22d3ee';

              return (
                <g
                  key={pt.slotIndex}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredSlotIndex(pt.slotIndex)}
                  onMouseLeave={() => setHoveredSlotIndex(null)}
                  onClick={() => onSelectHour(pt.hourIndex)}
                >
                  {(isHovered || isSelected) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={9.5}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.6"
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={pt.recordedImpulseObsCount > 0 ? 6 : 4.6}
                    fill={fill}
                    fillOpacity={0.9}
                    stroke="#090d16"
                    strokeWidth="1.2"
                  />
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="h-[224px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={weightedPoints}
                margin={{ top: 10, right: 12, left: -6, bottom: 4 }}
                onClick={(state) => {
                  const idx = state?.activeTooltipIndex;
                  if (typeof idx === 'number' && weightedPoints[idx]) {
                    onSelectHour(weightedPoints[idx].hourIndex);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="hourLabel"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  interval={2}
                />
                <YAxis
                  yAxisId="wind"
                  domain={[0, 'auto']}
                  tick={{ fill: '#38bdf8', fontSize: 10 }}
                  unit=" m/s"
                />
                <YAxis
                  yAxisId="noise"
                  orientation="right"
                  domain={[40, Math.max(100, Math.ceil(displayMaxImpulseDb + 5))]}
                  tick={{ fill: '#fb7185', fontSize: 10 }}
                  unit=" dB"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090d16',
                    borderColor: '#334155',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value, name) => {
                    const num = typeof value === 'number' ? value : Number(value ?? 0);
                    return name === 'windSpeedMs'
                      ? [`${num.toFixed(1)} m/s`, 'Vindhastighed (Open-Meteo)']
                      : [`${num.toFixed(1)} ${unitLabel}`, `Impulsstøj (${labels.lmaxLabel})`];
                  }}
                />
                <ReferenceLine
                  yAxisId="noise"
                  y={displayLimit85Db}
                  stroke="#f43f5e"
                  strokeDasharray="4 3"
                  label={{
                    value: `${displayLimit85Db.toFixed(0)} ${unitLabel}`,
                    fill: '#fda4af',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
                <Area
                  yAxisId="wind"
                  type="monotone"
                  dataKey="windSpeedMs"
                  stroke="#22d3ee"
                  fill="#06b6d4"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="noise"
                  type="monotone"
                  dataKey="displayImpulseDb"
                  stroke="#fb7185"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: '#fb7185' }}
                  activeDot={{ r: 5.5, fill: '#ffffff', stroke: '#fb7185' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Interactive Point Readout Bar */}
        {inspectedPoint && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#151C28] border border-slate-700 font-mono text-[11px] tabular-nums">
            <div className="flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="font-bold text-white">{inspectedPoint.shortDateTimeLabel}</span>
              <span className="text-slate-400">
                ({inspectedPoint.windCompass} · Pasquill {inspectedPoint.pasquillClass})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-cyan-300">
                <Wind className="w-3 h-3 shrink-0" />
                <strong>{inspectedPoint.windSpeedMs.toFixed(1)} m/s</strong>
                <span className="text-slate-400">(stød {inspectedPoint.windGustsMs.toFixed(1)})</span>
              </span>
              <span className="inline-flex items-center gap-1 text-rose-300">
                <Volume2 className="w-3 h-3 shrink-0" />
                <strong>
                  {inspectedPoint.displayImpulseDb.toFixed(1)} {unitLabel}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Activity className="w-3 h-3 shrink-0" />
                Refr: +{inspectedPoint.windRefractionDb.toFixed(1)} dB
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
