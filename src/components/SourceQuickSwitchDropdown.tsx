import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  Search,
  Square,
} from 'lucide-react';
import { DemolitionSourceNode } from '../types/dispersion';

export interface SourceQuickSwitchDropdownProps {
  sources: DemolitionSourceNode[];
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string) => void;
  onToggleSourceActive?: (sourceId: string) => void;
  hiddenSourceIds?: string[];
  onToggleSourceVisibility?: (sourceId: string) => void;
  onShowAllSources?: () => void;
  onOpenFullModal?: () => void;
  searchable?: boolean;
  defaultFilter?: 'active' | 'all';
  align?: 'left' | 'right';
  buttonTestId?: string;
  menuTestId?: string;
  searchInputTestId?: string;
  labelPrefix?: string;
  hideLabelOnSmall?: boolean;
  title?: string;
}

export const SourceQuickSwitchDropdown: React.FC<SourceQuickSwitchDropdownProps> = ({
  sources,
  selectedSourceId,
  onSelectSource,
  onToggleSourceActive,
  hiddenSourceIds = [],
  onToggleSourceVisibility,
  onShowAllSources,
  onOpenFullModal,
  searchable = true,
  defaultFilter = 'active',
  align = 'right',
  buttonTestId = 'source-quick-switch-btn',
  menuTestId = 'source-quick-switch-menu',
  searchInputTestId = 'source-quick-switch-search',
  labelPrefix = 'Kilde:',
  hideLabelOnSmall = false,
  title = 'Hurtig-skift mellem aktive nedrivningskilder uden at åbne fuld dialog',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'active' | 'all'>(defaultFilter);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const hiddenSet = useMemo(() => new Set(hiddenSourceIds), [hiddenSourceIds]);
  const activeSources = useMemo(() => sources.filter((s) => s.active), [sources]);
  const currentSource = useMemo(
    () =>
      sources.find((s) => s.id === selectedSourceId) ||
      activeSources[0] ||
      sources[0] ||
      null,
    [sources, selectedSourceId, activeSources]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 20);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  const filteredSources = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = filterMode === 'active' ? activeSources : sources;
    return base.filter(
      (s) =>
        !q ||
        `${s.code} ${s.name} ${s.address} ${s.pssReference}`
          .toLowerCase()
          .includes(q)
    );
  }, [sources, activeSources, filterMode, query]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        data-testid={buttonTestId}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        title={title}
        className={`px-2 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
          isOpen
            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 font-bold'
            : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
        }`}
      >
        <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className={hideLabelOnSmall ? 'hidden xl:inline' : ''}>
          {labelPrefix}{' '}
          <strong className="text-cyan-300">{currentSource?.code || 'Ingen'}</strong>
        </span>
        <span className="px-1 rounded bg-slate-950/80 border border-slate-700/80 text-[11px] text-amber-300 tabular-nums">
          {activeSources.length}/{sources.length}
        </span>
        {hiddenSourceIds.length > 0 && (
          <span
            className="px-1 rounded bg-amber-500/20 border border-amber-400/50 text-[11px] text-amber-200 inline-flex items-center gap-0.5 tabular-nums"
            title={`${hiddenSourceIds.length} kildenode(r) skjult visuelt på kortet (stadig aktive i simuleringen)`}
          >
            <EyeOff className="w-3 h-3" />
            <span>{hiddenSourceIds.length}</span>
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180 text-cyan-300' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          data-testid={menuTestId}
          role="menu"
          aria-label="Skift aktiv nedrivningskilde"
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } top-full mt-1.5 w-[370px] max-w-[92vw] rounded-lg bg-[#161F2E] border border-cyan-500/55 shadow-2xl p-2.5 z-[90] font-mono text-[11px] space-y-2`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#2D3B50] pb-1.5">
            <span className="font-bold text-slate-100 uppercase tracking-tight">
              Hurtig-skift Kildenode
            </span>
            <div className="inline-flex items-center rounded bg-[#0B0F19] border border-[#2D3B50] p-0.5">
              <button
                type="button"
                onClick={() => setFilterMode('active')}
                className={`px-1.5 py-0.5 rounded text-[11px] cursor-pointer ${
                  filterMode === 'active'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Aktive ({activeSources.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-1.5 py-0.5 rounded text-[11px] cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Alle ({sources.length})
              </button>
            </div>
          </div>

          {searchable && (
            <label className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                data-testid={searchInputTestId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Søg kildenode, blok eller adresse…"
                className="w-full pl-8 pr-2.5 py-1.5 rounded bg-[#0B0F19] border border-[#2D3B50] focus:border-cyan-400 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </label>
          )}

          <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5">
            {filteredSources.length === 0 ? (
              <div className="py-3 text-center text-slate-400">
                Ingen kildenoder matcher &ldquo;{query}&rdquo;
              </div>
            ) : (
              filteredSources.map((src) => {
                const isSelected = currentSource?.id === src.id;
                const isHiddenVisually = hiddenSet.has(src.id);
                return (
                  <div
                    key={src.id}
                    className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded border transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-400/80 text-white'
                        : src.active
                        ? 'bg-[#0F1623] border-[#253042] hover:border-cyan-500/50 text-slate-200'
                        : 'bg-[#0B0F19]/80 border-[#1E293B] text-slate-500'
                    }`}
                  >
                    {onToggleSourceActive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSourceActive(src.id);
                        }}
                        title={
                          src.active
                            ? `Deaktiver ${src.code} i spredningsberegningen`
                            : `Aktivér ${src.code} i spredningsberegningen`
                        }
                        aria-label={`Slå ${src.code} til/fra i simulering`}
                        className="p-0.5 rounded hover:bg-slate-800 cursor-pointer shrink-0"
                      >
                        {src.active ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (!src.active && onToggleSourceActive) {
                          onToggleSourceActive(src.id);
                        }
                        onSelectSource(src.id);
                        setIsOpen(false);
                      }}
                      className={`flex-1 min-w-0 text-left cursor-pointer ${
                        isHiddenVisually ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-cyan-300 shrink-0">{src.code}</span>
                        <span className="truncate font-semibold">
                          {src.name.split('—')[0].trim()}
                        </span>
                        {isHiddenVisually && (
                          <span className="px-1 rounded bg-amber-500/20 border border-amber-400/50 text-[11px] text-amber-200 shrink-0">
                            Skjult
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {src.address} · H={src.releaseHeightMeters}m ·{' '}
                        {(src.sourceEmissionFactor ?? 1).toFixed(2)}x
                      </div>
                    </button>

                    {onToggleSourceVisibility && (
                      <button
                        type="button"
                        data-testid={`source-visibility-toggle-${src.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSourceVisibility(src.id);
                        }}
                        aria-pressed={!isHiddenVisually}
                        aria-label={
                          isHiddenVisually
                            ? `Vis ${src.code} på kortet`
                            : `Skjul ${src.code} visuelt på kortet`
                        }
                        title={
                          isHiddenVisually
                            ? `Vis ${src.code} på 2D/3D-kortet igen`
                            : `Skjul ${src.code} visuelt på 2D/3D-kortet (forbliver i simuleringen)`
                        }
                        className={`p-1 rounded border transition-colors cursor-pointer shrink-0 ${
                          isHiddenVisually
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 hover:bg-amber-500/30'
                            : 'bg-[#0B0F19] border-[#2D3B50] text-cyan-300 hover:border-cyan-400'
                        }`}
                      >
                        {isHiddenVisually ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {(onOpenFullModal || (hiddenSourceIds.length > 0 && onShowAllSources)) && (
            <div className="pt-1.5 border-t border-[#2D3B50] flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-400">
                {activeSources.length} af {sources.length} aktive
                {hiddenSourceIds.length > 0 ? ` · ${hiddenSourceIds.length} skjult` : ''}
              </span>
              <div className="flex items-center gap-1.5">
                {hiddenSourceIds.length > 0 && onShowAllSources && (
                  <button
                    type="button"
                    onClick={onShowAllSources}
                    className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Vis alle</span>
                  </button>
                )}
                {onOpenFullModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenFullModal();
                    }}
                    className="px-2 py-1 rounded bg-[#0B0F19] hover:bg-[#1E293B] border border-[#2D3B50] text-cyan-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Alle kilder &amp; receptorer</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

