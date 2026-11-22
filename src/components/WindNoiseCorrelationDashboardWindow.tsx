/**
 * @file src/components/WindNoiseCorrelationDashboardWindow.tsx
 * @description Dedikeret 'Vind-Støj Korrelation' dashboard-vindue med interaktiv
 * 24-timers tidslinje, der sammenholder vindstødsmønstre (v_gust & v_10m) med
 * støv- og støjhændelser og markerer timer med høj vindstøj-sensitivitet.
 */

import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Crosshair, Volume2, Wind } from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  PuffAccumulationResult,
} from '../types/dispersion';

export interface WindNoiseCorrelationDashboardWindowProps {
  weatherHours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  selectedHourIndex: number;
  onSelectHour: (hourIndex: number) => void;
  sources: DemolitionSourceNode[];
  observations: AlgedonicObservation[];
  puff24h: PuffAccumulationResult;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
}

type TimelineFilterMode = 'all' | 'high_sensitivity' | 'events_only';

interface HourlyCorrelationRow {
  hourIndex: number;
  hourLabel: string;
  windSpeedMs: number;
  windGustMs: number;
  refractionBoostDb: number;
  estimatedLafmaxDb: number;
  sumQuotientS: number;
  noiseEventCount: number;
  dustEventCount: number;
  sensitivityScore: number;
  isHighSensitivity: boolean;
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  return dx2 > 0 && dy2 > 0 ? Number((num / Math.sqrt(dx2 * dy2)).toFixed(2)) : 0;
}

export const WindNoiseCorrelationDashboardWindow: React.FC<WindNoiseCorrelationDashboardWindowProps> = ({
  weatherHours,
  currentWeather,
  selectedHourIndex,
  onSelectHour,
  sources,
  observations,
  puff24h,
  manualMachineNoiseOutputDb = 108,
  isManualMachineNoiseOverrideActive = false,
}) => {
  const [filterMode, setFilterMode] = useState<TimelineFilterMode>('all');
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [isScrubbingSvg, setIsScrubbingSvg] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const activeSourceCount = Math.max(1, sources.filter((s) => s.active).length);
  const baseLwaDb = isManualMachineNoiseOverrideActive
    ? manualMachineNoiseOutputDb
    : 104 + Math.min(6, (activeSourceCount - 1) * 1.8);

  const rows: HourlyCorrelationRow[] = useMemo(() => {
    const profile = puff24h.peakReceptor.hourlyProfile;
    return weatherHours.slice(0, 24).map((hr, idx) => {
      const hourIndex = hr.hourIndex ?? idx;
      const windSpeedMs = hr.windSpeed10m;
      const windGustMs = Math.max(windSpeedMs, hr.windGusts10m || windSpeedMs * 1.32);
      const isWorkWindow = hourIndex >= 6 && hourIndex <= 18;
      const refractionBoostDb = Number(
        Math.min(7.5, Math.max(0, (windSpeedMs - 4.5) * 0.42 + (windGustMs - 8.0) * 0.24)).toFixed(1)
      );
      const estimatedLafmaxDb = Number(
        Math.max(42, baseLwaDb - 33.5 + (isWorkWindow ? 0 : -14) + refractionBoostDb).toFixed(1)
      );
      const sumQuotientS = Number((profile[hourIndex]?.sumQuotient ?? 0).toFixed(2));
      const hrObs = observations.filter((o) => o.observedHourIndex === hourIndex);
      const obsNoise = hrObs.filter(
        (o) => Boolean(o.audioEvidence) || /støj|db|impuls|mejsel|hammer|klage|vibrat/i.test(`${o.observationType} ${o.description}`)
      ).length;
      const noiseEventCount = obsNoise + (estimatedLafmaxDb >= 80 ? 1 : 0);
      const dustEventCount = (hrObs.length - obsNoise) + (sumQuotientS >= 0.8 ? 1 : 0);
      const sensitivityScore = Number(
        (windGustMs * 0.45 + refractionBoostDb * 2.1 + (estimatedLafmaxDb >= 75 ? 4 : 0) + sumQuotientS * 3).toFixed(1)
      );
      const isHighSensitivity =
        (windSpeedMs > 10.0 || windGustMs >= 13.0 || refractionBoostDb >= 3.0) &&
        (estimatedLafmaxDb >= 72.0 || sumQuotientS >= 0.5 || hrObs.length > 0);

      return {
        hourIndex,
        hourLabel: hr.hourLabel || `${String(hourIndex).padStart(2, '0')}:00`,
        windSpeedMs,
        windGustMs,
        refractionBoostDb,
        estimatedLafmaxDb,
        sumQuotientS,
        noiseEventCount,
        dustEventCount,
        sensitivityScore,
        isHighSensitivity,
      };
    });
  }, [weatherHours, puff24h.peakReceptor.hourlyProfile, observations, baseLwaDb]);

  const stats = useMemo(() => {
    const rGustNoise = pearsonCorrelation(rows.map((r) => r.windGustMs), rows.map((r) => r.estimatedLafmaxDb));
    const rGustDust = pearsonCorrelation(rows.map((r) => r.windGustMs), rows.map((r) => r.sumQuotientS));
    const highSensHours = rows.filter((r) => r.isHighSensitivity);
    const totalNoiseEvents = rows.reduce((s, r) => s + r.noiseEventCount, 0);
    const totalDustEvents = rows.reduce((s, r) => s + r.dustEventCount, 0);
    const peakSensRow = [...rows].sort((a, b) => b.sensitivityScore - a.sensitivityScore)[0] ?? rows[0];
    return { rGustNoise, rGustDust, highSensCount: highSensHours.length, totalNoiseEvents, totalDustEvents, peakSensRow };
  }, [rows]);

  const inspectedRow = rows.find((r) => r.hourIndex === (hoveredHour ?? selectedHourIndex)) || rows[0];

  const filteredRows = useMemo(() => {
    if (filterMode === 'high_sensitivity') return rows.filter((r) => r.isHighSensitivity);
    if (filterMode === 'events_only') return rows.filter((r) => r.noiseEventCount > 0 || r.dustEventCount > 0);
    return rows;
  }, [rows, filterMode]);

  const W = 476, H = 174, padL = 32, padR = 30, padT = 18, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xAt = (h: number) => padL + (h / 23) * plotW;
  const yGust = (g: number) => padT + plotH - (Math.min(26, Math.max(0, g)) / 26) * plotH;
  const yDb = (db: number) => padT + plotH - ((Math.min(95, Math.max(40, db)) - 40) / 55) * plotH;

  const gustAreaPoints = `${padL},${padT + plotH} ${rows.map((r) => `${xAt(r.hourIndex).toFixed(1)},${yGust(r.windGustMs).toFixed(1)}`).join(' ')} ${padL + plotW},${padT + plotH}`;

  const resolveHourFromClientX = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / Math.max(1, rect.width)) * W;
    const clamped = Math.max(0, Math.min(23, Math.round(((relX - padL) / plotW) * 23)));
    onSelectHour(clamped);
  };

  return (
    <div data-testid="wind-noise-correlation-dashboard" className="p-3 bg-[#0B0E17] text-slate-100 font-mono text-xs space-y-2.5 tabular-nums">
      {/* KPI-Linje & Hurtigfokus på mest vindstøj-sensitive time */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          <span className="text-amber-300 font-bold">Høj Vindstøj-Sensitivitet: {stats.highSensCount}/24t</span>
          <span aria-hidden="true">·</span>
          <span className="text-cyan-300">r(Pust,dB)={stats.rGustNoise.toFixed(2)}</span>
          <span aria-hidden="true">·</span>
          <span className="text-fuchsia-300">r(Pust,S)={stats.rGustDust.toFixed(2)}</span>
          <span aria-hidden="true">·</span>
          <span>Hændelser: {stats.totalNoiseEvents} støj / {stats.totalDustEvents} støv</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {stats.peakSensRow && (
            <button
              type="button"
              onClick={() => onSelectHour(stats.peakSensRow.hourIndex)}
              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 text-amber-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Hop direkte til døgnets time med højest vindstøj-sensitivitet"
            >
              <Crosshair className="w-3 h-3 text-amber-300" />
              <span>Spids kl. {stats.peakSensRow.hourLabel}</span>
            </button>
          )}
          <div className="flex items-center gap-1 bg-[#07090E] p-0.5 rounded border border-slate-800">
            {([
              { id: 'all', lbl: 'Alle 24t' },
              { id: 'high_sensitivity', lbl: `Sensitiv (${stats.highSensCount})` },
              { id: 'events_only', lbl: 'Hændelser' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                  filterMode === tab.id ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interaktiv 24-Timers SVG Tidslinje (Klik eller træk på grafen) */}
      <div className="rounded bg-[#07090E] border border-slate-800 p-2 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>Cyan: Vindstød (m/s) · Rose: LAFmax (dB) · Violet søjle: Støv (S) · Rav zone: Høj vindstøj-sensitivitet</span>
          <span className="text-slate-200 font-bold">Valgt: kl. {currentWeather.hourLabel}</span>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          onPointerDown={(e) => { setIsScrubbingSvg(true); resolveHourFromClientX(e.clientX); }}
          onPointerMove={(e) => { if (isScrubbingSvg) resolveHourFromClientX(e.clientX); }}
          onPointerUp={() => setIsScrubbingSvg(false)}
          onPointerLeave={() => { setIsScrubbingSvg(false); setHoveredHour(null); }}
          className="w-full h-auto select-none cursor-crosshair"
        >
          <polygon points={gustAreaPoints} fill="#22d3ee" fillOpacity={0.08} />
          <line x1={padL} y1={yGust(10)} x2={W - padR} y2={yGust(10)} stroke="#22d3ee" strokeOpacity={0.35} strokeDasharray="3 3" />
          <line x1={padL} y1={yDb(80)} x2={W - padR} y2={yDb(80)} stroke="#f43f5e" strokeOpacity={0.45} strokeDasharray="4 3" />
          <text x={3} y={yGust(10) + 3} className="fill-cyan-400 text-[9.5px]">10m/s</text>
          <text x={W - padR + 2} y={yDb(80) + 3} className="fill-rose-400 text-[9.5px]">80dB</text>

          {rows.map((r) => {
            const cx = xAt(r.hourIndex), colW = plotW / 24, isSel = r.hourIndex === selectedHourIndex;
            const sBarH = Math.min(plotH * 0.62, r.sumQuotientS * 34);
            return (
              <g key={r.hourIndex} onMouseEnter={() => setHoveredHour(r.hourIndex)}>
                <rect
                  x={cx - colW / 2} y={padT} width={colW} height={plotH}
                  fill={r.isHighSensitivity ? '#f59e0b' : '#0f172a'}
                  fillOpacity={r.isHighSensitivity ? (isSel ? 0.36 : 0.19) : isSel ? 0.45 : 0.01}
                />
                {sBarH > 0.5 && (
                  <rect x={cx - colW * 0.28} y={padT + plotH - sBarH} width={colW * 0.56} height={sBarH} rx={1} fill={r.sumQuotientS > 0.8 ? '#e879f9' : '#38bdf8'} fillOpacity={0.48} />
                )}
                {r.isHighSensitivity && (
                  <polygon points={`${cx},${padT + 2} ${cx - 3.2},${padT + 7.5} ${cx + 3.2},${padT + 7.5}`} fill="#fbbf24" />
                )}
                {r.noiseEventCount > 0 && (
                  <circle cx={cx - (r.dustEventCount > 0 ? 2.2 : 0)} cy={padT + plotH - 4} r={2.7} fill="#f43f5e" stroke="#ffffff" strokeWidth={0.6} />
                )}
                {r.dustEventCount > 0 && (
                  <circle cx={cx + (r.noiseEventCount > 0 ? 2.2 : 0)} cy={padT + plotH - 4} r={2.7} fill="#e879f9" stroke="#ffffff" strokeWidth={0.6} />
                )}
                {isSel && <line x1={cx} y1={padT} x2={cx} y2={padT + plotH} stroke="#ffffff" strokeWidth={1.3} strokeOpacity={0.9} />}
                {r.hourIndex % 3 === 0 && (
                  <text x={cx} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[9.5px]">{String(r.hourIndex).padStart(2, '0')}:00</text>
                )}
              </g>
            );
          })}

          <polyline fill="none" stroke="#38bdf8" strokeWidth={1.1} strokeDasharray="2 2" strokeOpacity={0.65} points={rows.map((r) => `${xAt(r.hourIndex).toFixed(1)},${yGust(r.windSpeedMs).toFixed(1)}`).join(' ')} />
          <polyline fill="none" stroke="#22d3ee" strokeWidth={2.1} points={rows.map((r) => `${xAt(r.hourIndex).toFixed(1)},${yGust(r.windGustMs).toFixed(1)}`).join(' ')} />
          <polyline fill="none" stroke="#fb7185" strokeWidth={2.1} points={rows.map((r) => `${xAt(r.hourIndex).toFixed(1)},${yDb(r.estimatedLafmaxDb).toFixed(1)}`).join(' ')} />
        </svg>

        {inspectedRow && (
          <div className="px-2.5 py-1.5 rounded bg-[#0B0E17] border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-white">Kl. {inspectedRow.hourLabel}</strong>
              <span className="text-cyan-300 inline-flex items-center gap-1">
                <Wind className="w-3 h-3" />
                {inspectedRow.windSpeedMs.toFixed(1)} / pust {inspectedRow.windGustMs.toFixed(1)} m/s
              </span>
              <span className="text-rose-300 inline-flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                {inspectedRow.estimatedLafmaxDb.toFixed(1)} dB (+{inspectedRow.refractionBoostDb.toFixed(1)} dB vind)
              </span>
              <span className="text-fuchsia-300">S={inspectedRow.sumQuotientS.toFixed(2)}</span>
              <span className="text-slate-400">({inspectedRow.noiseEventCount} støj · {inspectedRow.dustEventCount} støv)</span>
            </div>
            <span className={`font-bold ${inspectedRow.isHighSensitivity ? 'text-amber-300' : 'text-emerald-300'}`}>
              {inspectedRow.isHighSensitivity ? '▲ HØJ VINDSTØJ-SENSITIVITET' : '● MODERAT SENSITIVITET'}
            </span>
          </div>
        )}
      </div>

      {/* Filtreret 24-timers hændelses- og sensitivitetstabel */}
      <div className="max-h-36 overflow-y-auto rounded border border-slate-800 divide-y divide-slate-800/80 bg-[#07090E]">
        {filteredRows.length === 0 ? (
          <div className="p-2.5 text-slate-400 text-[11px] text-center">
            Ingen timer matcher det valgte filter i dette døgn. Skift til &quot;Alle 24t&quot; for fuld tidslinje.
          </div>
        ) : (
          filteredRows.map((r) => (
            <button
              key={`row-${r.hourIndex}`}
              type="button"
              onClick={() => onSelectHour(r.hourIndex)}
              className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left text-[11px] transition-colors cursor-pointer ${
                r.hourIndex === selectedHourIndex ? 'bg-cyan-950/55 text-white' : 'hover:bg-slate-900 text-slate-300'
              }`}
            >
              <span className="font-bold w-12 shrink-0">{r.hourLabel}</span>
              <span className="text-cyan-300">Pust {r.windGustMs.toFixed(1)} m/s</span>
              <span className={r.estimatedLafmaxDb >= 80 ? 'text-rose-300 font-bold' : 'text-slate-200'}>
                {r.estimatedLafmaxDb.toFixed(1)} dB (+{r.refractionBoostDb.toFixed(1)})
              </span>
              <span className="text-fuchsia-300">S={r.sumQuotientS.toFixed(2)}</span>
              <span className="text-slate-400 text-[11px] inline-flex items-center gap-1 tabular-nums">
                <span className="inline-flex items-center gap-0.5">
                  {r.noiseEventCount}
                  <Volume2 className="w-3 h-3" />
                </span>
                <span>/</span>
                <span className="inline-flex items-center gap-0.5">
                  {r.dustEventCount}
                  <Wind className="w-3 h-3" />
                </span>
              </span>
              <span className="shrink-0">
                {r.isHighSensitivity ? (
                  <span className="text-amber-300 font-bold inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />Sensitiv
                  </span>
                ) : (
                  <span className="text-slate-500">Normal</span>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
