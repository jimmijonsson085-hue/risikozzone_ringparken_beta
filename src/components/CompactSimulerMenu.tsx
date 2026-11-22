import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Droplets,
  Layers,
  MapPin,
  Power,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { DemolitionSourceNode } from '../types/dispersion';

export interface CompactSimulerMenuProps {
  showWaterMainLayer: boolean;
  onToggleWaterMainLayer?: () => void;
  showLerBuffer?: boolean;
  onToggleLerBuffer?: () => void;
  hasSteelRoadPlates?: boolean;
  onToggleSteelRoadPlates?: () => void;
  simulatedPipeRuptureActive?: boolean;
  onToggleSimulatedPipeRupture?: () => void;
  isS3ValveLockoutActive?: boolean;
  onToggleS3ValveLockout?: () => void;
  hasVirtualLeakPin?: boolean;
  onToggleVirtualLeakPinQuick?: () => void;
  sources?: DemolitionSourceNode[];
  onToggleSourceActive?: (id: string) => void;
  onIsolateNearbyMachinery?: () => void;
  onRestoreAllMachinery?: () => void;
  pipePpvMmPerSec?: number;
  align?: 'left' | 'right';
}

export const CompactSimulerMenu: React.FC<CompactSimulerMenuProps> = ({
  showWaterMainLayer,
  onToggleWaterMainLayer,
  showLerBuffer = true,
  onToggleLerBuffer,
  hasSteelRoadPlates = false,
  onToggleSteelRoadPlates,
  simulatedPipeRuptureActive = false,
  onToggleSimulatedPipeRupture,
  isS3ValveLockoutActive = false,
  onToggleS3ValveLockout,
  hasVirtualLeakPin = false,
  onToggleVirtualLeakPinQuick,
  sources = [],
  onToggleSourceActive,
  onIsolateNearbyMachinery,
  onRestoreAllMachinery,
  pipePpvMmPerSec,
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const activeSourceCount = sources.filter((s) => s.active).length;
  const activeSimCount =
    (showWaterMainLayer ? 1 : 0) +
    (hasSteelRoadPlates ? 1 : 0) +
    (simulatedPipeRuptureActive ? 1 : 0) +
    (isS3ValveLockoutActive ? 1 : 0) +
    (hasVirtualLeakPin ? 1 : 0);

  return (
    <div ref={containerRef} className="relative inline-block pointer-events-auto">
      <button
        type="button"
        data-testid="compact-simuler-menu-btn"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
        className={`px-2 py-1 rounded text-[11px] font-mono font-bold border flex items-center gap-1 shadow-md transition-colors cursor-pointer whitespace-nowrap ${
          isOpen
            ? 'bg-cyan-500 text-slate-950 border-cyan-200'
            : simulatedPipeRuptureActive || hasVirtualLeakPin
            ? 'bg-rose-950/95 text-rose-100 border-rose-400/80 hover:bg-rose-900'
            : 'bg-[#0B0E17]/95 text-cyan-200 border-cyan-500/60 hover:bg-slate-900 hover:border-cyan-400'
        }`}
        title="Åbn kompakt Simuler Fra/Til menu (fungerer også i Fuld Skærm og Kun Kort)"
      >
        <SlidersHorizontal className="w-3 h-3 shrink-0" />
        <span>Simuler Fra/Til</span>
        <span className="px-1 rounded bg-black/30 text-[10px] tabular-nums">
          {activeSimCount}
        </span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          data-testid="compact-simuler-menu-popover"
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } top-full mt-1.5 w-[310px] max-w-[90vw] rounded-lg bg-[#0B0E17] border border-cyan-500/70 shadow-2xl p-2.5 z-[140] font-mono text-[11px] tabular-nums space-y-2 text-slate-100`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-cyan-200 uppercase">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Simuler Fra/Til</span>
            </div>
            <div className="flex items-center gap-1.5">
              {typeof pipePpvMmPerSec === 'number' && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    pipePpvMmPerSec >= 22.5
                      ? 'bg-rose-950 border-rose-500/70 text-rose-200'
                      : 'bg-slate-900 border-slate-700 text-emerald-300'
                  }`}
                >
                  PPV {pipePpvMmPerSec.toFixed(1)} mm/s
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                aria-label="Luk Simuler Fra/Til menu"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 1. Kortlag: Drikkevands Hovedrør & LER Buffer */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Lag (2D &amp; 3D Kort)
            </div>
            {onToggleWaterMainLayer && (
              <button
                type="button"
                data-testid="simuler-toggle-water-main-layer"
                onClick={onToggleWaterMainLayer}
                className={`w-full px-2 py-1 rounded border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  showWaterMainLayer
                    ? 'bg-sky-500/20 border-sky-400/80 text-sky-100 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Drikkevands Hovedrør</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                    showWaterMainLayer
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {showWaterMainLayer ? 'TIL' : 'FRA'}
                </span>
              </button>
            )}

            {onToggleLerBuffer && (
              <button
                type="button"
                data-testid="simuler-toggle-ler-buffer"
                onClick={onToggleLerBuffer}
                className={`w-full px-2 py-1 rounded border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  showLerBuffer
                    ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-100 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">LER 2.0 ±2,0 m Buffer</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                    showLerBuffer
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {showLerBuffer ? 'TIL' : 'FRA'}
                </span>
              </button>
            )}
          </div>

          {/* 2. Infrastruktur & Lækagesimulering */}
          <div className="space-y-1 pt-1 border-t border-slate-800">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Hændelser &amp; Sikring
            </div>

            {onToggleSteelRoadPlates && (
              <button
                type="button"
                data-testid="simuler-toggle-steel-plates"
                onClick={onToggleSteelRoadPlates}
                className={`w-full px-2 py-1 rounded border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  hasSteelRoadPlates
                    ? 'bg-emerald-500/20 border-emerald-400/80 text-emerald-100 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Køreplader (PSS W22085)</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                    hasSteelRoadPlates
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {hasSteelRoadPlates ? 'TIL' : 'FRA'}
                </span>
              </button>
            )}

            {onToggleSimulatedPipeRupture && (
              <button
                type="button"
                data-testid="simuler-toggle-pipe-rupture"
                onClick={onToggleSimulatedPipeRupture}
                className={`w-full px-2 py-1 rounded border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  simulatedPipeRuptureActive
                    ? 'bg-rose-600/30 border-rose-400 text-rose-100 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-rose-500/50'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">Simulér Rørbrud (-0,25 bar)</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                    simulatedPipeRuptureActive
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {simulatedPipeRuptureActive ? 'TIL' : 'FRA'}
                </span>
              </button>
            )}

            {onToggleVirtualLeakPinQuick && (
              <button
                type="button"
                data-testid="simuler-toggle-leak-pin"
                onClick={onToggleVirtualLeakPinQuick}
                className={`w-full px-2 py-1 rounded border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  hasVirtualLeakPin
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-400/50'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Virtuelt Lækagepunkt (Mætning)</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                    hasVirtualLeakPin
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {hasVirtualLeakPin ? 'TIL' : 'FRA'}
                </span>
              </button>
            )}

            {onToggleS3ValveLockout && (
              <button
                type="button"
                data-testid="simuler-toggle-s3-valves"
                onClick={onToggleS3ValveLockout}
                className={`w-full px-2 py-1 rounded border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isS3ValveLockoutActive
                    ? 'bg-rose-500/25 border-rose-400 text-rose-100 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">Ventilspærring V-VEST/V-MIDT</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                    isS3ValveLockoutActive
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isS3ValveLockoutActive ? 'LUKKET' : 'ÅBEN'}
                </span>
              </button>
            )}
          </div>

          {/* 3. Maskiner / Kilder Fra/Til */}
          {sources.length > 0 && onToggleSourceActive && (
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Gravemaskiner ({activeSourceCount}/{sources.length} TIL)
                </span>
                <div className="flex items-center gap-1">
                  {onIsolateNearbyMachinery && (
                    <button
                      type="button"
                      data-testid="simuler-isolate-nearby-btn"
                      onClick={onIsolateNearbyMachinery}
                      className="px-1.5 py-0.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/60 text-rose-200 text-[10px] font-bold cursor-pointer"
                      title="Stop nærliggende nedrivningsmaskiner ved Kierulffsvej"
                    >
                      Isolér nær rør
                    </button>
                  )}
                  {onRestoreAllMachinery && (
                    <button
                      type="button"
                      data-testid="simuler-restore-all-btn"
                      onClick={onRestoreAllMachinery}
                      className="px-1.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-200 text-[10px] font-bold cursor-pointer"
                    >
                      Alle TIL
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-0.5">
                {sources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => onToggleSourceActive(src.id)}
                    className={`w-full px-2 py-1 rounded border flex items-center justify-between gap-1.5 cursor-pointer transition-colors text-left ${
                      src.active
                        ? 'bg-slate-900 border-slate-700 text-slate-100 hover:border-cyan-400/60'
                        : 'bg-slate-950 border-slate-800/70 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Power
                        className={`w-3 h-3 shrink-0 ${
                          src.active ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                      />
                      <span className="font-bold shrink-0">{src.code}</span>
                      <span className="truncate opacity-85">
                        {src.name.split('—')[0].trim()}
                      </span>
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold shrink-0 ${
                        src.active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {src.active ? 'TIL' : 'FRA'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
