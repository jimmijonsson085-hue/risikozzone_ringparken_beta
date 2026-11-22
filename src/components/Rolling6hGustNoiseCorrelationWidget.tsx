import React, { useMemo, useState } from 'react';
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
import { Activity, AlertTriangle, TrendingUp, Volume2, Wind } from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
} from '../types/dispersion';

export interface Rolling6hGustNoiseCorrelationWidgetProps {
  weatherHours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  selectedHourIndex: number;
  onSelectHour: (hourIndex: number) => void;
  sources: DemolitionSourceNode[];
  observations: AlgedonicObservation[];
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
}

interface Rolling6hPoint {
  hourIndex: number;
  hourLabel: string;
  shortHour: string;
  windGustMs: number;
  windSpeedMs: number;
  machineImpulseNoiseDb: number;
  rolling6hR: number;
  rolling6hAbsStrength: 'STÆRK' | 'MODERAT' | 'SVAG';
  windowLabel: string;
  isWithinSelectedWindow: boolean;
  isExceeding85Db: boolean;
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
  if (denom < 1e-6) return 0;
  return Number(Math.max(-1, Math.min(1, num / denom)).toFixed(3));
}

export const Rolling6hGustNoiseCorrelationWidget: React.FC<
  Rolling6hGustNoiseCorrelationWidgetProps
> = ({
  weatherHours,
  currentWeather,
  selectedHourIndex,
  onSelectHour,
  sources,
  observations,
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
}) => {
  const [windowSpanHours, setWindowSpanHours] = useState<6 | 8>(6);

  const activeSourcesCount = Math.max(
    1,
    sources.filter((s) => s.active).length
  );
  const effectiveSourceLwaDb = isManualMachineNoiseOverrideActive
    ? manualMachineNoiseOutputDb
    : 109 + Math.min(6, (activeSourcesCount - 1) * 1.9);

  const rollingSeries = useMemo<Rolling6hPoint[]>(() => {
    const hours = weatherHours.slice(0, 24);
    if (hours.length === 0) return [];

    // Compute per-hour wind gust (m/s) and machine impulse-noise L_AFmax (dB(A))
    const rawHours = hours.map((hr, idx) => {
      const hIdx = hr.hourIndex ?? idx;
      const windSpeedMs = hr.windSpeed10m;
      const windGustMs = Number(
        Math.max(windSpeedMs, hr.windGusts10m || windSpeedMs * 1.32).toFixed(1)
      );
      const isActiveWorkWindow = hIdx >= 7 && hIdx <= 18;
      const obsBoostCount = observations.filter(
        (o) =>
          o.observedHourIndex === hIdx &&
          (Boolean(o.audioEvidence) ||
            /støj|db|impuls|hammer|mejsel|vibrat/i.test(
              `${o.observationType} ${o.description}`
            ))
      ).length;
      const gustRefractionBoostDb =
        Math.max(0, (windGustMs - 7.5) * 0.62) +
        Math.max(0, (windSpeedMs - 5.5) * 0.35);
      const daytimeBaselineShift = isActiveWorkWindow ? 0 : -15.5;
      const machineImpulseNoiseDb = Number(
        Math.max(
          44,
          Math.min(
            106,
            effectiveSourceLwaDb -
              26.4 +
              daytimeBaselineShift +
              gustRefractionBoostDb +
              obsBoostCount * 1.4
          )
        ).toFixed(1)
      );
      return {
        hourIndex: hIdx,
        hourLabel: hr.hourLabel || `${String(hIdx).padStart(2, '0')}:00`,
        shortHour: String(hIdx).padStart(2, '0'),
        windGustMs,
        windSpeedMs,
        machineImpulseNoiseDb,
      };
    });

    const selectedIndices = new Set<number>();
    for (let k = 0; k < windowSpanHours; k++) {
      selectedIndices.add((selectedHourIndex - k + 24) % rawHours.length);
    }

    return rawHours.map((item, idx) => {
      const windowSlice: typeof rawHours = [];
      for (let k = windowSpanHours - 1; k >= 0; k--) {
        const wIdx = (idx - k + rawHours.length) % rawHours.length;
        windowSlice.push(rawHours[wIdx]);
      }
      const rVal = computePearsonR(
        windowSlice.map((w) => w.windGustMs),
        windowSlice.map((w) => w.machineImpulseNoiseDb)
      );
      const absR = Math.abs(rVal);
      const strength: Rolling6hPoint['rolling6hAbsStrength'] =
        absR >= 0.7 ? 'STÆRK' : absR >= 0.4 ? 'MODERAT' : 'SVAG';
      const firstLabel = windowSlice[0]?.hourLabel ?? item.hourLabel;
      const lastLabel =
        windowSlice[windowSlice.length - 1]?.hourLabel ?? item.hourLabel;

      return {
        ...item,
        rolling6hR: rVal,
        rolling6hAbsStrength: strength,
        windowLabel: `${firstLabel}–${lastLabel}`,
        isWithinSelectedWindow: selectedIndices.has(item.hourIndex),
        isExceeding85Db: item.machineImpulseNoiseDb > 85,
      };
    });
  }, [
    weatherHours,
    observations,
    effectiveSourceLwaDb,
    selectedHourIndex,
    windowSpanHours,
  ]);

  const activePoint =
    rollingSeries.find((p) => p.hourIndex === selectedHourIndex) ||
    rollingSeries[0];

  const selectedWindowRows = useMemo(
    () => rollingSeries.filter((p) => p.isWithinSelectedWindow),
    [rollingSeries]
  );

  const windowMaxGust = useMemo(
    () =>
      selectedWindowRows.length > 0
        ? Math.max(...selectedWindowRows.map((p) => p.windGustMs))
        : currentWeather.windGusts10m,
    [selectedWindowRows, currentWeather.windGusts10m]
  );

  const windowMaxImpulseDb = useMemo(
    () =>
      selectedWindowRows.length > 0
        ? Math.max(...selectedWindowRows.map((p) => p.machineImpulseNoiseDb))
        : 0,
    [selectedWindowRows]
  );

  const windowOver85Hours = useMemo(
    () => selectedWindowRows.filter((p) => p.isExceeding85Db).length,
    [selectedWindowRows]
  );

  const rolling6hWindowRows = useMemo(() => {
    if (rollingSeries.length === 0) return [];
    const idxSet = new Set<number>();
    for (let k = 0; k < 6; k++) {
      idxSet.add((selectedHourIndex - k + rollingSeries.length) % rollingSeries.length);
    }
    return rollingSeries.filter((p) => idxSet.has(p.hourIndex));
  }, [rollingSeries, selectedHourIndex]);

  const rolling6hNoiseAvgDb = useMemo(() => {
    if (rolling6hWindowRows.length === 0) return 0;
    const sum = rolling6hWindowRows.reduce(
      (acc, p) => acc + p.machineImpulseNoiseDb,
      0
    );
    return Number((sum / rolling6hWindowRows.length).toFixed(1));
  }, [rolling6hWindowRows]);

  const isRolling6hNoiseAvgAbove55Db = rolling6hNoiseAvgDb > 55;

  const activeR = activePoint?.rolling6hR ?? 0;
  const rStatusColor =
    activeR >= 0.7
      ? 'text-rose-300 border-rose-500/50 bg-rose-950/50'
      : activeR >= 0.4
      ? 'text-amber-300 border-amber-500/50 bg-amber-950/45'
      : 'text-cyan-300 border-cyan-500/50 bg-cyan-950/45';

  return (
    <div
      data-testid="rolling-6h-gust-noise-correlation-widget"
      data-rolling-6h-noise-exceeds-55db={
        isRolling6hNoiseAvgAbove55Db ? 'true' : 'false'
      }
      className={`p-3.5 rounded-md border space-y-3 font-mono tabular-nums transition-colors duration-200 ${
        isRolling6hNoiseAvgAbove55Db
          ? 'bg-amber-950/65 border-amber-500/75'
          : 'bg-[#0B0E17] border-[#253042]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#1E293B] pb-2.5">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span>Rullende {windowSpanHours}-Timers Vindstød × Maskin-Impulsstøj Korrelation</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug font-sans">
            Beregner dynamisk Pearsons korrelationskoefficient <strong className="text-white font-mono">r</strong> mellem
            vindstød (<span className="font-mono text-cyan-300">v_stød</span> m/s) og maskiners impulsstøj (<span className="font-mono text-rose-300">L_AFmax</span> dB(A))
            hen over et rullende {windowSpanHours}-timers vindue afsluttende kl.{' '}
            <strong className="text-amber-300 font-mono">{currentWeather.hourLabel}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#151C28] border border-[#253042] rounded p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setWindowSpanHours(6)}
            className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
              windowSpanHours === 6
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            6t Vindue
          </button>
          <button
            type="button"
            onClick={() => setWindowSpanHours(8)}
            className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
              windowSpanHours === 8
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            8t (MST-Ref)
          </button>
        </div>
      </div>

      {/* 6-Hour Rolling Noise Average Threshold Indicator (55 dB(A)) */}
      <div
        role="status"
        data-testid="rolling-6h-noise-55db-threshold-indicator"
        className={`px-2.5 py-1.5 rounded border flex flex-wrap items-center justify-between gap-2 text-[11px] ${
          isRolling6hNoiseAvgAbove55Db
            ? 'bg-amber-900/55 border-amber-400/75 text-amber-100'
            : 'bg-[#151C28] border-[#253042] text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {isRolling6hNoiseAvgAbove55Db ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="font-bold">
            {isRolling6hNoiseAvgAbove55Db
              ? `▲ OVER 55 dB(A) GRÆNSE (+${(rolling6hNoiseAvgDb - 55).toFixed(1)} dB)`
              : '● UNDER 55 dB(A) GRÆNSE'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-300">6-timers rullende støjgennemsnit:</span>
          <strong
            className={
              isRolling6hNoiseAvgAbove55Db ? 'text-amber-200' : 'text-emerald-300'
            }
          >
            {rolling6hNoiseAvgDb.toFixed(1)} dB(A)
          </strong>
          <span aria-hidden="true" className="text-slate-500">/</span>
          <span className="text-slate-400">Grænse: 55,0 dB(A)</span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <div className={`p-2 rounded border ${rStatusColor}`}>
          <div className="text-[10px] uppercase tracking-wider opacity-85">
            Rullende {windowSpanHours}t Korrelation (r)
          </div>
          <div className="text-base font-extrabold mt-0.5">
            r = {activeR >= 0 ? `+${activeR.toFixed(2)}` : activeR.toFixed(2)}
          </div>
          <div className="text-[11px] font-semibold mt-0.5">
            {activePoint?.rolling6hAbsStrength ?? 'SVAG'} · {activePoint?.windowLabel}
          </div>
        </div>

        <div className="p-2 rounded bg-[#151C28] border border-[#253042]">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Wind className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>Max Vindstød ({windowSpanHours}t)</span>
          </div>
          <div className="text-base font-extrabold text-cyan-300 mt-0.5">
            {windowMaxGust.toFixed(1)} m/s
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Nu: {currentWeather.windGusts10m.toFixed(1)} m/s
          </div>
        </div>

        <div className="p-2 rounded bg-[#151C28] border border-[#253042]">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-rose-400 shrink-0" />
            <span>Max Impulsstøj ({windowSpanHours}t)</span>
          </div>
          <div
            className={`text-base font-extrabold mt-0.5 ${
              windowMaxImpulseDb > 85 ? 'text-rose-400' : 'text-amber-300'
            }`}
          >
            {windowMaxImpulseDb.toFixed(1)} dB
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Kildestyrke: {effectiveSourceLwaDb.toFixed(0)} dB LwA
          </div>
        </div>

        <div className="p-2 rounded bg-[#151C28] border border-[#253042]">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Impuls &gt; 85 dB i Vindue</span>
          </div>
          <div
            className={`text-base font-extrabold mt-0.5 ${
              windowOver85Hours > 0 ? 'text-rose-400' : 'text-emerald-300'
            }`}
          >
            {windowOver85Hours} / {windowSpanHours} timer
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {windowOver85Hours > 0 ? 'Akustisk trykbølge-risiko' : 'Under 85 dB grænse'}
          </div>
        </div>
      </div>

      {/* Interactive Recharts Timeline */}
      <div className="p-2.5 rounded bg-[#151C28]/80 border border-[#253042] space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
          <span className="font-bold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>24t Forløb: Rullende {windowSpanHours}t r · Vindstød (m/s) · Impulsstøj L_AFmax (dB)</span>
          </span>
          <span className="text-slate-400">Klik på time for at flytte {windowSpanHours}t-vinduet</span>
        </div>

        <div className="w-full h-44">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rollingSeries}
              margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
              onClick={(state) => {
                if (state && typeof state.activeTooltipIndex === 'number') {
                  const idx = state.activeTooltipIndex;
                  if (idx >= 0 && idx < 24) {
                    onSelectHour(idx);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="shortHour"
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                interval={2}
              />
              <YAxis
                yAxisId="left"
                domain={[-1, 1]}
                stroke="#FBBF24"
                tick={{ fill: '#FCD34D', fontSize: 9.5, fontFamily: 'monospace' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[40, 105]}
                stroke="#FB7185"
                tick={{ fill: '#FDA4AF', fontSize: 9.5, fontFamily: 'monospace' }}
                tickLine={false}
              />
              <ReferenceLine
                yAxisId="left"
                y={0.7}
                stroke="#F59E0B"
                strokeDasharray="3 3"
              />
              <ReferenceLine
                yAxisId="right"
                y={55}
                stroke="#F59E0B"
                strokeDasharray="3 3"
              />
              <ReferenceLine
                yAxisId="right"
                y={85}
                stroke="#F43F5E"
                strokeDasharray="4 3"
              />
              <ReferenceLine
                yAxisId="left"
                x={String(selectedHourIndex).padStart(2, '0')}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const row = payload[0].payload as Rolling6hPoint;
                  return (
                    <div className="bg-[#0B0E17]/95 border border-[#36465E] rounded p-2 shadow-xl text-[11px] font-mono space-y-1">
                      <div className="font-bold text-white border-b border-[#253042] pb-0.5">
                        Kl. {row.hourLabel} (Vindue {row.windowLabel})
                      </div>
                      <div className="text-amber-300 font-bold">
                        Rullende {windowSpanHours}t r: {row.rolling6hR >= 0 ? `+${row.rolling6hR.toFixed(2)}` : row.rolling6hR.toFixed(2)} ({row.rolling6hAbsStrength})
                      </div>
                      <div className="text-cyan-300">
                        Vindstød: {row.windGustMs.toFixed(1)} m/s (Middel {row.windSpeedMs.toFixed(1)} m/s)
                      </div>
                      <div className={row.isExceeding85Db ? 'text-rose-300 font-bold' : 'text-slate-200'}>
                        Maskin-impuls L_AFmax: {row.machineImpulseNoiseDb.toFixed(1)} dB(A)
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="rolling6hR"
                name={`Rullende ${windowSpanHours}t r`}
                stroke="#FBBF24"
                strokeWidth={2}
                fill="#FBBF24"
                fillOpacity={0.18}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="machineImpulseNoiseDb"
                name="Impulsstøj L_AFmax (dB)"
                stroke="#F43F5E"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Window hour quick-pills */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[#1E293B] text-[11px]">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-400">Aktivt vindue:</span>
            {selectedWindowRows.map((row) => (
              <button
                key={`r6h-hr-${row.hourIndex}`}
                type="button"
                onClick={() => onSelectHour(row.hourIndex)}
                className={`px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                  row.hourIndex === selectedHourIndex
                    ? 'bg-amber-400 text-slate-950 border-white font-bold'
                    : row.isExceeding85Db
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200 hover:border-rose-300'
                    : 'bg-[#0B0E17] border-[#253042] text-slate-300 hover:border-cyan-400'
                }`}
              >
                {row.hourLabel} ({row.windGustMs.toFixed(0)}m/s · {row.machineImpulseNoiseDb.toFixed(0)}dB)
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
