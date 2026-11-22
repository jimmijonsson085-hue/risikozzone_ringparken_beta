/**
 * @file src/components/SourceReceptorSelectorModal.tsx
 * @description Interaktivt 'Valg af kilder & Receptorer' kontrolvindue til hurtig
 * til-/frakobling af nedrivnings-kildenoder og valg af fokus-receptorer / naboblokke.
 */

import React, { useMemo, useState } from 'react';
import { CheckSquare, Crosshair, PlusCircle, Radio, Search, Square, X } from 'lucide-react';
import {
  DemolitionSourceNode,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';
import { SourceQuickSwitchDropdown } from './SourceQuickSwitchDropdown';

export interface SourceReceptorSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  selectedSourceId: string | null;
  selectedReceptorId: string | null;
  onToggleSourceActive: (sourceId: string) => void;
  onSetAllSourcesActive?: (active: boolean) => void;
  onSelectSource: (sourceId: string) => void;
  onSelectReceptor: (receptorId: string) => void;
  onTriggerAddOnMap?: (mode: 'add_source' | 'add_receptor') => void;
}

const RECEPTOR_CAT_LABELS: Record<ReceptorZone['category'], string> = {
  residential_block: 'Boligblok',
  public_road: 'Offentlig vej',
  bike_path: 'Cykelsti',
  custom_receptor: 'Brugerdefineret',
};

export const SourceReceptorSelectorModal: React.FC<SourceReceptorSelectorModalProps> = ({
  isOpen,
  onClose,
  sources,
  receptors,
  receptorExposures,
  selectedSourceId,
  selectedReceptorId,
  onToggleSourceActive,
  onSetAllSourcesActive,
  onSelectSource,
  onSelectReceptor,
  onTriggerAddOnMap,
}) => {
  const [sourceQuery, setSourceQuery] = useState('');
  const [receptorQuery, setReceptorQuery] = useState('');
  const [receptorSort, setReceptorSort] = useState<'exposure' | 'name'>('exposure');

  const exposureMap = useMemo(
    () => Object.fromEntries(receptorExposures.map((e) => [e.receptorId, e])),
    [receptorExposures]
  );

  const filteredSources = useMemo(() => {
    const q = sourceQuery.trim().toLowerCase();
    return sources.filter(
      (s) => !q || `${s.code} ${s.name} ${s.address}`.toLowerCase().includes(q)
    );
  }, [sources, sourceQuery]);

  const filteredReceptors = useMemo(() => {
    const q = receptorQuery.trim().toLowerCase();
    const list = receptors.filter(
      (r) => !q || `${r.code} ${r.name} ${r.address}`.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) =>
      receptorSort === 'exposure'
        ? (exposureMap[b.id]?.sumQuotient ?? 0) - (exposureMap[a.id]?.sumQuotient ?? 0)
        : a.name.localeCompare(b.name, 'da')
    );
  }, [receptors, receptorQuery, receptorSort, exposureMap]);

  if (!isOpen) return null;

  const activeSourceCount = sources.filter((s) => s.active).length;

  return (
    <div
      data-testid="source-receptor-selector-modal"
      className="fixed inset-0 z-[9995] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[86vh] rounded-lg bg-[#090D16] border border-cyan-500/60 shadow-2xl flex flex-col font-mono text-slate-100 tabular-nums overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#07090E] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Valg af Kilder &amp; Receptorer — Ringparken Spredningsmodel</span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Aktive kildenoder: <strong className="text-amber-300">{activeSourceCount}/{sources.length}</strong> · Registrerede receptorer: <strong className="text-cyan-300">{receptors.length}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceQuickSwitchDropdown
              sources={sources}
              selectedSourceId={selectedSourceId}
              onSelectSource={onSelectSource}
              onToggleSourceActive={onToggleSourceActive}
              searchable
              defaultFilter="active"
              align="right"
              buttonTestId="modal-searchable-source-dropdown-btn"
              menuTestId="modal-searchable-source-dropdown-menu"
              searchInputTestId="modal-searchable-source-input"
              labelPrefix="Hurtig-skift aktiv kilde:"
              title="Søg og skift hurtigt mellem aktive kildenoder"
            />
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Luk</span>
            </button>
          </div>
        </div>

        {/* 2-Kolonners Indhold: Kildenoder (venstre) & Receptorer (højre) */}
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto flex-1">
          {/* KOLONNE 1: Emissions-Kildenoder */}
          <section className="rounded bg-[#07090E] border border-slate-800 p-3 flex flex-col space-y-2.5 min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-300">
                1. Emissions-Kildenoder ({activeSourceCount} aktive)
              </span>
              <div className="flex items-center gap-1.5">
                {onSetAllSourcesActive && (
                  <>
                    <button
                      type="button"
                      onClick={() => onSetAllSourcesActive(true)}
                      className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 text-[11px] font-bold cursor-pointer"
                    >
                      Aktivér alle
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetAllSourcesActive(false)}
                      className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                    >
                      Kun 1 kilde
                    </button>
                  </>
                )}
                {onTriggerAddOnMap && (
                  <button
                    type="button"
                    onClick={() => { onTriggerAddOnMap('add_source'); onClose(); }}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 text-amber-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>Ny på kort</span>
                  </button>
                )}
              </div>
            </div>

            <label className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder="Søg kildenode, blok eller adresse…"
                className="w-full pl-8 pr-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </label>

            <div className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
              {filteredSources.map((src) => {
                const isSelected = src.id === selectedSourceId;
                return (
                  <div
                    key={src.id}
                    className={`p-2 rounded border flex items-center justify-between gap-2 text-[11px] transition-colors ${
                      src.active
                        ? isSelected
                          ? 'bg-amber-950/35 border-amber-400 text-white'
                          : 'bg-slate-900/90 border-slate-800 text-slate-100'
                        : 'bg-slate-950/60 border-slate-800/60 text-slate-500'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleSourceActive(src.id)}
                      className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
                    >
                      {src.active ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold truncate">
                          {src.code} — {src.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {src.address} · H={src.releaseHeightMeters}m · Faktor {(src.sourceEmissionFactor ?? 1).toFixed(2)}x
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectSource(src.id)}
                      className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Fokus</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* KOLONNE 2: Receptorer / Naboblokke */}
          <section className="rounded bg-[#07090E] border border-slate-800 p-3 flex flex-col space-y-2.5 min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-cyan-300">
                2. Receptorer &amp; Naboblokke ({receptors.length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReceptorSort((s) => (s === 'exposure' ? 'name' : 'exposure'))}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                >
                  Sortér: {receptorSort === 'exposure' ? 'Højeste S' : 'Navn A-Å'}
                </button>
                {onTriggerAddOnMap && (
                  <button
                    type="button"
                    onClick={() => { onTriggerAddOnMap('add_receptor'); onClose(); }}
                    className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/60 text-cyan-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>Ny på kort</span>
                  </button>
                )}
              </div>
            </div>

            <label className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={receptorQuery}
                onChange={(e) => setReceptorQuery(e.target.value)}
                placeholder="Søg receptor, naboblok eller vejnavn…"
                className="w-full pl-8 pr-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </label>

            <div className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
              {filteredReceptors.map((rec) => {
                const exp = exposureMap[rec.id];
                const sVal = exp?.sumQuotient ?? 0;
                const isSelected = rec.id === selectedReceptorId;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => onSelectReceptor(rec.id)}
                    className={`w-full p-2 rounded border flex items-center justify-between gap-2 text-left text-[11px] transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-400 text-white'
                        : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">
                        {rec.code} — {rec.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {RECEPTOR_CAT_LABELS[rec.category]} · {rec.address}
                        {exp ? ` · ${Math.round(exp.distanceFromNearestSourceMeters)}m` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-bold ${
                          sVal >= 1.0 ? 'text-rose-300' : sVal >= 0.5 ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                      >
                        S = {sVal.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-cyan-300">
                        {isSelected ? '✓ Aktiv' : 'Vælg'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
