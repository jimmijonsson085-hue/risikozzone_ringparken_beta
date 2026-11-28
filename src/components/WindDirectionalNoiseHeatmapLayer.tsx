/**
 * @file src/components/WindDirectionalNoiseHeatmapLayer.tsx
 * @description Dedikeret 2D heatmap-lag, der visuelt repræsenterer den korrelerede
 * støj- og vindpåvirkning på de valgte naboblokke, baseret på de aktuelt valgte
 * kilde-noder (`visibleSources`) og de seneste 6 timers vindstødsmålinger.
 */

import React, { useMemo } from 'react';
import { CheckSquare, Compass, RotateCcw, Square, Volume2, Wind, X } from 'lucide-react';
import { haversineMetersBetween } from '../services/autonomousReceptorMeshService';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  ReceptorZone,
} from '../types/dispersion';

export interface ReceptorWindNoiseCell {
  receptor: ReceptorZone;
  laeqDb: number;
  lafmaxDb: number;
  windRefractionDb: number;
  gust6hCorrelationBoostDb: number;
  gust6hMeanMs: number;
  gust6hPeakMs: number;
  downwindAlignmentCos: number;
  nearestSourceDistMeters: number;
  dominantSourceCode: string;
  activeSourceCount: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  heatHex: string;
}

export interface Latest6hGustWindowSummary {
  windowHours: HourlyWeatherPoint[];
  windowLabel: string;
  meanWindSpeedMs: number;
  meanWindGustMs: number;
  peakWindGustMs: number;
  dominantWindFromDeg: number;
}

function bearingDeg(from: LatLngPoint, to: LatLngPoint): number {
  const r = Math.PI / 180;
  const dLng = (to.lng - from.lng) * r;
  const lat1 = from.lat * r;
  const lat2 = to.lat * r;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compassLabelDa(deg: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/**
 * Udtrækker de seneste 6 timers vindstødsmålinger afsluttende ved `selectedHourIndex`.
 */
export function computeLatest6hGustMetrics(
  weatherHours: HourlyWeatherPoint[],
  selectedHourIndex: number,
  fallbackWeather: HourlyWeatherPoint
): Latest6hGustWindowSummary {
  const hours = weatherHours.length > 0 ? weatherHours : [fallbackWeather];
  const windowHours: HourlyWeatherPoint[] = [];
  const count = Math.min(6, hours.length);
  for (let offset = count - 1; offset >= 0; offset--) {
    const idx =
      ((selectedHourIndex - offset) % hours.length + hours.length) % hours.length;
    windowHours.push(hours[idx]);
  }

  const meanWindSpeedMs = Number(
    (
      windowHours.reduce((s, h) => s + (h.windSpeed10m ?? 0), 0) /
      Math.max(1, windowHours.length)
    ).toFixed(1)
  );
  const gusts = windowHours.map((h) =>
    Math.max(h.windSpeed10m ?? 0, h.windGusts10m || (h.windSpeed10m ?? 0) * 1.32)
  );
  const meanWindGustMs = Number(
    (gusts.reduce((s, g) => s + g, 0) / Math.max(1, gusts.length)).toFixed(1)
  );
  const peakWindGustMs = Number(Math.max(...gusts, 0).toFixed(1));

  // Vector mean of wind direction across the 6h window
  let sumSin = 0;
  let sumCos = 0;
  windowHours.forEach((h) => {
    const rad = ((h.windDirection10m ?? 240) * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  });
  const dominantWindFromDeg = Math.round(
    ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360
  );

  const firstLbl = windowHours[0]?.hourLabel ?? fallbackWeather.hourLabel;
  const lastLbl =
    windowHours[windowHours.length - 1]?.hourLabel ?? fallbackWeather.hourLabel;

  return {
    windowHours,
    windowLabel: `${firstLbl}–${lastLbl}`,
    meanWindSpeedMs,
    meanWindGustMs,
    peakWindGustMs,
    dominantWindFromDeg,
  };
}

export function computeWindDirectionalNoiseCells(params: {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  selectedNeighborBlockIds?: string[];
  windFromDeg: number;
  windSpeedMs: number;
  windGustMs: number;
  latest6hWeatherHours?: HourlyWeatherPoint[];
  baseMachineLwaDb?: number;
}): ReceptorWindNoiseCell[] {
  const {
    sources,
    receptors,
    selectedNeighborBlockIds,
    windFromDeg,
    windSpeedMs,
    windGustMs,
    latest6hWeatherHours,
    baseMachineLwaDb = 111,
  } = params;

  // Kun aktuelt valgte/aktive kilde-noder indgår (hvis ingen aktiv, fald tilbage til valgte synlige kilder)
  const activeSelectedSources = sources.filter((s) => s.active);
  const effectiveSources =
    activeSelectedSources.length > 0 ? activeSelectedSources : sources.slice(0, 1);

  if (effectiveSources.length === 0) return [];

  const targetReceptors =
    selectedNeighborBlockIds && selectedNeighborBlockIds.length > 0
      ? receptors.filter((r) => selectedNeighborBlockIds.includes(r.id))
      : receptors;

  const gustWindow =
    latest6hWeatherHours && latest6hWeatherHours.length > 0
      ? latest6hWeatherHours
      : [{ windSpeed10m: windSpeedMs, windGusts10m: windGustMs, windDirection10m: windFromDeg }];

  const gust6hValues = gustWindow.map((h) =>
    Math.max(h.windSpeed10m ?? 0, h.windGusts10m || (h.windSpeed10m ?? 0) * 1.32)
  );
  const gust6hMeanMs = Number(
    (gust6hValues.reduce((a, b) => a + b, 0) / Math.max(1, gust6hValues.length)).toFixed(1)
  );
  const gust6hPeakMs = Number(Math.max(...gust6hValues, windGustMs).toFixed(1));
  const gust6hExcessDb = Math.max(0, (gust6hPeakMs - 9.0) * 0.28 + (gust6hMeanMs - 7.0) * 0.18);

  const downwindPropagationDeg = (windFromDeg + 180) % 360;
  const speedFactor = Math.min(
    1.55,
    Math.max(0.35, (windSpeedMs * 0.45 + gust6hMeanMs * 0.3 + gust6hPeakMs * 0.25) / 10.0)
  );

  return targetReceptors
    .map((rec) => {
      let energySum = 0;
      let bestSourceCode = effectiveSources[0]?.code ?? 'K1';
      let bestSourceContribution = -Infinity;
      let nearestDist = Infinity;
      let bestCos = -1;
      let bestRefraction = 0;

      effectiveSources.forEach((src) => {
        const dist = Math.max(18, haversineMetersBetween(src.position, rec.center));
        if (dist < nearestDist) nearestDist = dist;
        const alignCos = Math.cos(
          ((bearingDeg(src.position, rec.center) - downwindPropagationDeg) * Math.PI) / 180
        );
        const windRefDb =
          alignCos >= 0
            ? alignCos * 6.8 * speedFactor
            : alignCos * 7.2 * Math.min(1.2, speedFactor);
        const srcLwa =
          typeof src.baseSoundPowerLwaDb === 'number'
            ? src.baseSoundPowerLwaDb
            : baseMachineLwaDb + ((src.sourceEmissionFactor ?? 1) - 1) * 2.2;
        const laeqSingle = srcLwa - (20 * Math.log10(dist) + 11 + dist * 0.004) + windRefDb;
        energySum += Math.pow(10, laeqSingle / 10);

        if (laeqSingle > bestSourceContribution) {
          bestSourceContribution = laeqSingle;
          bestSourceCode = src.code;
          bestCos = alignCos;
          bestRefraction = windRefDb;
        }
      });

      const directionalGustBoostDb = Number(
        (gust6hExcessDb * (0.45 + 0.55 * Math.max(0, bestCos))).toFixed(1)
      );
      const laeqDb = Number((energySum > 0 ? 10 * Math.log10(energySum) : 42).toFixed(1));
      const lafmaxDb = Number(
        (laeqDb + 5.0 + Math.max(0, bestCos) * 2.2 + directionalGustBoostDb).toFixed(1)
      );
      const severity: ReceptorWindNoiseCell['severity'] =
        lafmaxDb >= 80
          ? 'critical'
          : lafmaxDb >= 72
          ? 'high'
          : lafmaxDb >= 63
          ? 'moderate'
          : 'low';
      const heatHex =
        severity === 'critical'
          ? '#ef4444'
          : severity === 'high'
          ? '#f97316'
          : severity === 'moderate'
          ? '#eab308'
          : '#22d3ee';

      return {
        receptor: rec,
        laeqDb,
        lafmaxDb,
        windRefractionDb: Number(bestRefraction.toFixed(1)),
        gust6hCorrelationBoostDb: directionalGustBoostDb,
        gust6hMeanMs,
        gust6hPeakMs,
        downwindAlignmentCos: Number(bestCos.toFixed(2)),
        nearestSourceDistMeters: Math.round(nearestDist),
        dominantSourceCode: bestSourceCode,
        activeSourceCount: effectiveSources.length,
        severity,
        heatHex,
      };
    })
    .sort((a, b) => b.lafmaxDb - a.lafmaxDb);
}

export interface WindDirectionalNoiseSvgLayerProps {
  cells: ReceptorWindNoiseCell[];
  sources: DemolitionSourceNode[];
  effectiveWindFromDeg: number;
  projectLatLng: (pt: LatLngPoint) => { x: number; y: number };
  onSelectReceptor: (receptorId: string) => void;
}

export const WindDirectionalNoiseSvgLayer: React.FC<
  WindDirectionalNoiseSvgLayerProps
> = ({ cells, sources, effectiveWindFromDeg, projectLatLng, onSelectReceptor }) => {
  const downwindDeg = (effectiveWindFromDeg + 180) % 360;
  const activeSources = sources.filter((s) => s.active);
  const lobeSources = activeSources.length > 0 ? activeSources : sources.slice(0, 1);

  return (
    <g data-testid="svg-wind-directional-noise-heatmap-layer">
      <defs>
        <radialGradient id="windNoiseCriticalGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.68" />
          <stop offset="55%" stopColor="#f97316" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="windNoiseHighGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.56" />
          <stop offset="60%" stopColor="#eab308" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="windNoiseModGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eab308" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {lobeSources.map((src) => {
        const sp = projectLatLng(src.position);
        return (
          <g
            key={`wind-noise-lobe-${src.id}`}
            transform={`translate(${sp.x}, ${sp.y}) rotate(${downwindDeg - 90})`}
            className="pointer-events-none"
          >
            <path
              d="M 0,0 L 175,-72 A 190,190 0 0,1 175,72 Z"
              fill="#f97316"
              fillOpacity={0.14}
              stroke="#fbbf24"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          </g>
        );
      })}

      {cells.map((cell, idx) => {
        const pt = projectLatLng(cell.receptor.center);
        const polyPts = cell.receptor.polygon
          .map((p) => {
            const xy = projectLatLng(p);
            return `${xy.x.toFixed(1)},${xy.y.toFixed(1)}`;
          })
          .join(' ');
        const gradId =
          cell.severity === 'critical'
            ? 'url(#windNoiseCriticalGrad)'
            : cell.severity === 'high'
            ? 'url(#windNoiseHighGrad)'
            : 'url(#windNoiseModGrad)';
        const auraR =
          cell.severity === 'critical' ? 62 : cell.severity === 'high' ? 48 : 36;

        return (
          <g
            key={`wind-noise-cell-${cell.receptor.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectReceptor(cell.receptor.id);
            }}
            className="cursor-pointer"
          >
            {cell.severity !== 'low' && <circle cx={pt.x} cy={pt.y} r={auraR} fill={gradId} />}
            {cell.receptor.polygon.length >= 3 && (
              <polygon
                points={polyPts}
                fill={cell.heatHex}
                fillOpacity={
                  cell.severity === 'critical' ? 0.48 : cell.severity === 'high' ? 0.34 : 0.2
                }
                stroke={cell.heatHex}
                strokeWidth={cell.severity === 'critical' ? 2.3 : 1.4}
              />
            )}
            {(idx < 6 || cell.severity === 'critical') && (
              <g transform={`translate(${pt.x}, ${pt.y - 16})`}>
                <rect
                  x={-54}
                  y={-11}
                  width={108}
                  height={16}
                  rx={3}
                  fill="#07090E"
                  fillOpacity={0.94}
                  stroke={cell.heatHex}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  className="fill-white text-[9.5px] font-mono font-bold tabular-nums"
                >
                  {cell.receptor.code}: {cell.lafmaxDb.toFixed(0)}dB (+6t{' '}
                  {cell.gust6hCorrelationBoostDb.toFixed(1)})
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
};

export interface WindDirectionalNoiseHudCardProps {
  cells: ReceptorWindNoiseCell[];
  allReceptors: ReceptorZone[];
  selectedNeighborBlockIds: string[];
  onToggleNeighborBlock: (receptorId: string) => void;
  onSelectAllNeighborBlocks: () => void;
  onSelectResidentialBlocksOnly: () => void;
  selectedSourceCodes: string[];
  latest6hSummary: Latest6hGustWindowSummary;
  currentWeather: HourlyWeatherPoint;
  overrideWindFromDeg: number | null;
  onChangeOverrideWindFromDeg: (deg: number | null) => void;
  onSelectReceptor: (receptorId: string) => void;
  onClose: () => void;
}

const COMPASS_PRESETS: Array<{ label: string; deg: number }> = [
  { label: 'N', deg: 0 },
  { label: 'NØ', deg: 45 },
  { label: 'Ø', deg: 90 },
  { label: 'SØ', deg: 135 },
  { label: 'S', deg: 180 },
  { label: 'SV', deg: 225 },
  { label: 'V', deg: 270 },
  { label: 'NV', deg: 315 },
];

export const WindDirectionalNoiseHudCard: React.FC<
  WindDirectionalNoiseHudCardProps
> = ({
  cells,
  allReceptors,
  selectedNeighborBlockIds,
  onToggleNeighborBlock,
  onSelectAllNeighborBlocks,
  onSelectResidentialBlocksOnly,
  selectedSourceCodes,
  latest6hSummary,
  currentWeather,
  overrideWindFromDeg,
  onChangeOverrideWindFromDeg,
  onSelectReceptor,
  onClose,
}) => {
  const effectiveDeg = overrideWindFromDeg ?? currentWeather.windDirection10m;
  const downwindDeg = (effectiveDeg + 180) % 360;
  const criticalCount = useMemo(
    () => cells.filter((c) => c.lafmaxDb >= 80).length,
    [cells]
  );

  return (
    <div
      data-testid="wind-directional-noise-hud-card"
      className="w-[356px] max-w-[calc(100vw-28px)] rounded-md bg-[#090D16]/95 border border-amber-400/70 p-2.5 shadow-2xl font-mono text-slate-100 text-[11px] space-y-2 tabular-nums pointer-events-auto"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
        <span className="font-bold text-amber-300 flex items-center gap-1.5 truncate">
          <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>6t Vindstød &amp; Støj Heatmap (Valgte Blokke)</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {overrideWindFromDeg !== null && (
            <button
              type="button"
              onClick={() => onChangeOverrideWindFromDeg(null)}
              title="Nulstil til live meteorologisk vindretning"
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] inline-flex items-center gap-0.5 cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Live</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk 6t støj- og vindstøds-heatmap"
            className="p-0.5 rounded bg-slate-900 hover:bg-rose-600 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Proveniens: Aktuelle kilde-noder + seneste 6t vindstød */}
      <div className="p-1.5 rounded bg-[#07090E] border border-slate-800 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-1 text-cyan-200">
          <span className="inline-flex items-center gap-1 font-bold">
            <Wind className="w-3 h-3 text-cyan-400 shrink-0" />
            6t Vindstød ({latest6hSummary.windowLabel}):
          </span>
          <span>
            Snit {latest6hSummary.meanWindGustMs.toFixed(1)} · Spids{' '}
            <strong className="text-amber-300">{latest6hSummary.peakWindGustMs.toFixed(1)} m/s</strong>
          </span>
        </div>
        <div className="text-slate-300 truncate">
          Valgte kilde-noder ({selectedSourceCodes.length}):{' '}
          <strong className="text-white">{selectedSourceCodes.join(', ') || 'Ingen'}</strong>
        </div>
        <div
          data-testid="wind-noise-heatmap-high-wind-banner"
          className={`px-1.5 py-1 rounded border text-[10.5px] font-semibold flex items-center justify-between gap-1 ${
            currentWeather.windSpeed10m > 10 && selectedSourceCodes.length > 0
              ? 'bg-rose-950/80 border-rose-400/75 text-rose-100'
              : 'bg-slate-900/90 border-slate-700 text-slate-300'
          }`}
        >
          <span>
            {currentWeather.windSpeed10m > 10 && selectedSourceCodes.length > 0
              ? `HØJ VIND >10 m/s + ${selectedSourceCodes.length} IMPULSKILDE(R)`
              : `Vindbasis: ${currentWeather.windSpeed10m.toFixed(1)} m/s (Grænse >10 m/s)`}
          </span>
          <span className="font-bold tabular-nums shrink-0">
            {currentWeather.windSpeed10m > 10 ? 'FORHØJET RISIKO' : 'MODERAT'}
          </span>
        </div>
      </div>

      {/* Vindvinkel slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 inline-flex items-center gap-1">
            <Compass className="w-3 h-3 text-cyan-400" />
            Vind fra:{' '}
            <strong className="text-cyan-200">
              {Math.round(effectiveDeg)}° ({compassLabelDa(effectiveDeg)})
            </strong>
          </span>
          <span className="text-amber-300">
            Mod {Math.round(downwindDeg)}° · {criticalCount} ≥80dB
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={Math.round(effectiveDeg)}
          onChange={(e) => onChangeOverrideWindFromDeg(Number(e.target.value))}
          aria-label="Simulér specifik vindvinkel for støj-varmegraf"
          className="w-full accent-amber-400 cursor-pointer h-1.5"
        />
        <div className="grid grid-cols-8 gap-1">
          {COMPASS_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChangeOverrideWindFromDeg(p.deg)}
              className={`py-0.5 rounded border text-[11px] font-bold cursor-pointer ${
                Math.abs(effectiveDeg - p.deg) <= 12
                  ? 'bg-amber-400 text-slate-950 border-amber-200'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-select Valgte Naboblokke */}
      <div className="space-y-1 pt-1 border-t border-slate-800">
        <div className="flex items-center justify-between gap-1 text-[11px]">
          <span className="text-slate-300 font-semibold">
            Valgte naboblokke ({selectedNeighborBlockIds.length}/{allReceptors.length})
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSelectAllNeighborBlocks}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] cursor-pointer"
            >
              Alle
            </button>
            <button
              type="button"
              onClick={onSelectResidentialBlocksOnly}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-200 text-[10px] cursor-pointer"
            >
              Boligblokke
            </button>
          </div>
        </div>
        <div className="max-h-20 overflow-y-auto grid grid-cols-2 gap-1 pr-0.5">
          {allReceptors.map((rec) => {
            const isChecked = selectedNeighborBlockIds.includes(rec.id);
            return (
              <button
                key={`sel-block-${rec.id}`}
                type="button"
                onClick={() => onToggleNeighborBlock(rec.id)}
                className={`px-1.5 py-0.5 rounded border text-left flex items-center gap-1 truncate cursor-pointer text-[10px] ${
                  isChecked
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-100 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title={`${rec.code} · ${rec.name}`}
              >
                {isChecked ? (
                  <CheckSquare className="w-3 h-3 text-amber-300 shrink-0" />
                ) : (
                  <Square className="w-3 h-3 text-slate-500 shrink-0" />
                )}
                <span className="truncate">{rec.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top exposed selected neighbor blocks */}
      <div className="space-y-1 pt-1 border-t border-slate-800">
        <div className="text-[11px] text-slate-400">
          Korrigeret 6t støj- &amp; vindpåvirkning pr. valgt blok:
        </div>
        {cells.slice(0, 4).map((c, idx) => (
          <button
            key={c.receptor.id}
            type="button"
            onClick={() => onSelectReceptor(c.receptor.id)}
            className="w-full px-2 py-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-800 flex items-center justify-between gap-1.5 text-left cursor-pointer"
          >
            <span className="truncate text-slate-200">
              <strong className="text-amber-300">#{idx + 1}</strong> {c.receptor.code} ·{' '}
              {c.receptor.name}
            </span>
            <span
              className={`shrink-0 font-bold ${
                c.lafmaxDb >= 80
                  ? 'text-rose-300'
                  : c.lafmaxDb >= 72
                  ? 'text-amber-300'
                  : 'text-cyan-300'
              }`}
            >
              {c.lafmaxDb.toFixed(1)} dB (+{c.gust6hCorrelationBoostDb.toFixed(1)} 6t)
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
