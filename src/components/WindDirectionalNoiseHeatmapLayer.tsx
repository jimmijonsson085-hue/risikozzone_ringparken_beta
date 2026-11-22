/**
 * @file src/components/WindDirectionalNoiseHeatmapLayer.tsx
 * @description Visuel lag-mulighed til '2D Taktisk Kort', der beregner og plotter en
 * varmegraf over støjniveauer (LAFmax / LAeq dB(A)) korreleret med vindretning, så
 * brugeren kan aflæse hvilke naboblokke der er mest udsatte ved specifikke vindvinkler.
 */

import React, { useMemo } from 'react';
import { Compass, RotateCcw, Volume2, X } from 'lucide-react';
import { haversineMetersBetween } from '../services/autonomousReceptorMeshService';
import { DemolitionSourceNode, HourlyWeatherPoint, LatLngPoint, ReceptorZone } from '../types/dispersion';

export interface ReceptorWindNoiseCell {
  receptor: ReceptorZone;
  laeqDb: number;
  lafmaxDb: number;
  windRefractionDb: number;
  downwindAlignmentCos: number;
  nearestSourceDistMeters: number;
  dominantSourceCode: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  heatHex: string;
}

function bearingDeg(from: LatLngPoint, to: LatLngPoint): number {
  const r = Math.PI / 180;
  const dLng = (to.lng - from.lng) * r;
  const lat1 = from.lat * r;
  const lat2 = to.lat * r;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compassLabelDa(deg: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export function computeWindDirectionalNoiseCells(params: {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  windFromDeg: number;
  windSpeedMs: number;
  windGustMs: number;
  baseMachineLwaDb?: number;
}): ReceptorWindNoiseCell[] {
  const { sources, receptors, windFromDeg, windSpeedMs, windGustMs, baseMachineLwaDb = 111 } = params;
  const activeSources = sources.filter((s) => s.active);
  const effectiveSources = activeSources.length > 0 ? activeSources : sources.slice(0, 1);
  const downwindPropagationDeg = (windFromDeg + 180) % 360;
  const speedFactor = Math.min(1.45, Math.max(0.35, (windSpeedMs * 0.65 + windGustMs * 0.35) / 9.5));

  return receptors
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
        const alignCos = Math.cos(((bearingDeg(src.position, rec.center) - downwindPropagationDeg) * Math.PI) / 180);
        const windRefDb = alignCos >= 0 ? alignCos * 6.8 * speedFactor : alignCos * 7.5 * Math.min(1.2, speedFactor);
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

      const laeqDb = Number((energySum > 0 ? 10 * Math.log10(energySum) : 42).toFixed(1));
      const lafmaxDb = Number((laeqDb + 5.0 + Math.max(0, bestCos) * 2.4).toFixed(1));
      const severity: ReceptorWindNoiseCell['severity'] =
        lafmaxDb >= 80 ? 'critical' : lafmaxDb >= 72 ? 'high' : lafmaxDb >= 63 ? 'moderate' : 'low';
      const heatHex =
        severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : severity === 'moderate' ? '#eab308' : '#22d3ee';

      return {
        receptor: rec,
        laeqDb,
        lafmaxDb,
        windRefractionDb: Number(bestRefraction.toFixed(1)),
        downwindAlignmentCos: Number(bestCos.toFixed(2)),
        nearestSourceDistMeters: Math.round(nearestDist),
        dominantSourceCode: bestSourceCode,
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

export const WindDirectionalNoiseSvgLayer: React.FC<WindDirectionalNoiseSvgLayerProps> = ({
  cells,
  sources,
  effectiveWindFromDeg,
  projectLatLng,
  onSelectReceptor,
}) => {
  const downwindDeg = (effectiveWindFromDeg + 180) % 360;
  const activeSources = sources.filter((s) => s.active);

  return (
    <g data-testid="svg-wind-directional-noise-heatmap-layer">
      <defs>
        <radialGradient id="windNoiseCriticalGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.62" />
          <stop offset="55%" stopColor="#f97316" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="windNoiseHighGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.52" />
          <stop offset="60%" stopColor="#eab308" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="windNoiseModGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eab308" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {activeSources.map((src) => {
        const sp = projectLatLng(src.position);
        return (
          <g key={`wind-noise-lobe-${src.id}`} transform={`translate(${sp.x}, ${sp.y}) rotate(${downwindDeg - 90})`} className="pointer-events-none">
            <path d="M 0,0 L 165,-68 A 180,180 0 0,1 165,68 Z" fill="#f97316" fillOpacity={0.14} stroke="#fbbf24" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="4 3" />
          </g>
        );
      })}

      {cells.map((cell, idx) => {
        const pt = projectLatLng(cell.receptor.center);
        const polyPts = cell.receptor.polygon.map((p) => {
          const xy = projectLatLng(p);
          return `${xy.x.toFixed(1)},${xy.y.toFixed(1)}`;
        }).join(' ');
        const gradId = cell.severity === 'critical' ? 'url(#windNoiseCriticalGrad)' : cell.severity === 'high' ? 'url(#windNoiseHighGrad)' : 'url(#windNoiseModGrad)';
        const auraR = cell.severity === 'critical' ? 58 : cell.severity === 'high' ? 46 : 34;

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
                fillOpacity={cell.severity === 'critical' ? 0.44 : cell.severity === 'high' ? 0.32 : 0.18}
                stroke={cell.heatHex}
                strokeWidth={cell.severity === 'critical' ? 2.2 : 1.3}
              />
            )}
            {(idx < 5 || cell.severity === 'critical') && (
              <g transform={`translate(${pt.x}, ${pt.y - 16})`}>
                <rect x={-48} y={-11} width={96} height={16} rx={3} fill="#07090E" fillOpacity={0.92} stroke={cell.heatHex} strokeWidth={1} />
                <text x={0} y={0} textAnchor="middle" className="fill-white text-[9.5px] font-mono font-bold tabular-nums">
                  {cell.receptor.code}: {cell.lafmaxDb.toFixed(0)}dB ({cell.windRefractionDb >= 0 ? '+' : ''}{cell.windRefractionDb.toFixed(1)})
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

export const WindDirectionalNoiseHudCard: React.FC<WindDirectionalNoiseHudCardProps> = ({
  cells,
  currentWeather,
  overrideWindFromDeg,
  onChangeOverrideWindFromDeg,
  onSelectReceptor,
  onClose,
}) => {
  const effectiveDeg = overrideWindFromDeg ?? currentWeather.windDirection10m;
  const downwindDeg = (effectiveDeg + 180) % 360;
  const criticalCount = useMemo(() => cells.filter((c) => c.lafmaxDb >= 80).length, [cells]);

  return (
    <div
      data-testid="wind-directional-noise-hud-card"
      className="w-[336px] max-w-[calc(100vw-28px)] rounded-md bg-[#090D16]/95 border border-amber-400/70 p-2.5 shadow-2xl font-mono text-slate-100 text-[11px] space-y-2 tabular-nums pointer-events-auto"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
        <span className="font-bold text-amber-300 flex items-center gap-1.5 truncate">
          <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Vind-Støj Varmegraf (2D Taktisk)</span>
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
          <button type="button" onClick={onClose} className="p-0.5 rounded bg-slate-900 hover:bg-rose-600 border border-slate-700 text-slate-300 hover:text-white cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 inline-flex items-center gap-1">
            <Compass className="w-3 h-3 text-cyan-400" />
            Vind fra: <strong className="text-cyan-200">{Math.round(effectiveDeg)}° ({compassLabelDa(effectiveDeg)})</strong>
          </span>
          <span className="text-amber-300">Mod {Math.round(downwindDeg)}° · {criticalCount} ≥80dB</span>
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
                Math.abs(effectiveDeg - p.deg) <= 12 ? 'bg-amber-400 text-slate-950 border-amber-200' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 pt-1 border-t border-slate-800">
        <div className="text-[11px] text-slate-400">Mest udsatte naboblokke ved {Math.round(effectiveDeg)}° vind:</div>
        {cells.slice(0, 4).map((c, idx) => (
          <button
            key={c.receptor.id}
            type="button"
            onClick={() => onSelectReceptor(c.receptor.id)}
            className="w-full px-2 py-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-800 flex items-center justify-between gap-1.5 text-left cursor-pointer"
          >
            <span className="truncate text-slate-200">
              <strong className="text-amber-300">#{idx + 1}</strong> {c.receptor.code} · {c.receptor.name}
            </span>
            <span className={`shrink-0 font-bold ${c.lafmaxDb >= 80 ? 'text-rose-300' : c.lafmaxDb >= 72 ? 'text-amber-300' : 'text-cyan-300'}`}>
              {c.lafmaxDb.toFixed(1)} dB ({c.windRefractionDb >= 0 ? '+' : ''}{c.windRefractionDb.toFixed(1)})
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
