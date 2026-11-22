import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Layers, MapPin, Radio } from 'lucide-react';
import {
  DemolitionSourceNode,
  ReceptorExposureResult,
  ReceptorZone,
  SubstanceKey,
} from '../../types/dispersion';

export interface InteractiveMapLegendProps {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  hiddenSourceIds?: string[];
  visibleSubstances: Record<SubstanceKey, boolean>;
  onToggleSubstance: (key: SubstanceKey) => void;
  onSetAllSubstances: (visible: boolean) => void;
  onSelectSource?: (sourceId: string) => void;
  onSelectReceptor?: (receptorId: string) => void;
}

const SUBSTANCE_LEGEND_ITEMS: Array<{
  key: SubstanceKey;
  label: string;
  shortLabel: string;
  swatchColor: string;
  dotClass: string;
}> = [
  {
    key: 'asbestos',
    label: 'Asbestfibre (Asbestos)',
    shortLabel: 'Asbest',
    swatchColor: '#10b981',
    dotClass: 'bg-emerald-400',
  },
  {
    key: 'pcb',
    label: 'PCB',
    shortLabel: 'PCB',
    swatchColor: '#a855f7',
    dotClass: 'bg-purple-400',
  },
  {
    key: 'heavyMetals',
    label: 'Tungmetaller (Pb / Heavy Metals)',
    shortLabel: 'Tungmetaller',
    swatchColor: '#f59e0b',
    dotClass: 'bg-amber-400',
  },
  {
    key: 'quartzWool',
    label: 'Kvarts- & Mineraluld (Quartz Wool)',
    shortLabel: 'Kvartsuld',
    swatchColor: '#06b6d4',
    dotClass: 'bg-cyan-400',
  },
  {
    key: 'moldSewer',
    label: 'Skimmel & Kloak (Mold/Sewer)',
    shortLabel: 'Skimmel/Kloak',
    swatchColor: '#84cc16',
    dotClass: 'bg-lime-400',
  },
];

export const InteractiveMapLegend: React.FC<InteractiveMapLegendProps> = ({
  sources,
  receptors,
  receptorExposures,
  hiddenSourceIds = [],
  visibleSubstances,
  onToggleSubstance,
  onSetAllSubstances,
  onSelectSource,
  onSelectReceptor,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const hiddenSet = useMemo(() => new Set(hiddenSourceIds), [hiddenSourceIds]);

  const activeSources = useMemo(
    () => sources.filter((s) => s.active && !hiddenSet.has(s.id)),
    [sources, hiddenSet]
  );
  const totalActiveCount = useMemo(() => sources.filter((s) => s.active).length, [sources]);
  const inactiveCount = Math.max(0, sources.length - totalActiveCount);

  const emitterCountBySubstance = useMemo(() => {
    const counts: Record<SubstanceKey, number> = {
      asbestos: 0,
      heavyMetals: 0,
      pcb: 0,
      quartzWool: 0,
      moldSewer: 0,
    };
    for (const src of activeSources) {
      for (const k of src.substances) {
        if (counts[k] !== undefined) counts[k] += 1;
      }
    }
    return counts;
  }, [activeSources]);

  const receptorCounts = useMemo(() => {
    let red = 0;
    let orange = 0;
    let yellow = 0;
    let safe = 0;
    let blue = 0;
    for (const exp of receptorExposures) {
      if (exp.hydrologicalRunoffActive) blue += 1;
      if (exp.riskLevel === 'red' || exp.sumQuotient >= 1.0) red += 1;
      else if (exp.riskLevel === 'orange' || exp.sumQuotient >= 0.5) orange += 1;
      else if (exp.riskLevel === 'yellow' || exp.sumQuotient >= 0.25) yellow += 1;
      else safe += 1;
    }
    return { red, orange, yellow, safe, blue, total: receptors.length };
  }, [receptorExposures, receptors.length]);

  const visibleSubstanceCount = useMemo(
    () => SUBSTANCE_LEGEND_ITEMS.filter((item) => visibleSubstances[item.key]).length,
    [visibleSubstances]
  );

  const worstReceptors = useMemo(
    () =>
      [...receptorExposures]
        .sort((a, b) => b.sumQuotient - a.sumQuotient)
        .slice(0, 4),
    [receptorExposures]
  );

  return (
    <div
      data-testid="toolbar-interactive-map-legend"
      className="px-3 py-1.5 bg-[#111722] border-b border-[#253042] font-mono text-[11px] tabular-nums flex flex-col gap-1.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Color-coded Markers for Demolition Source Nodes & Receptor Zones */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Kortlegende:</span>
          </span>

          {/* Demolition Source Nodes Marker Key (Distinct Square/Diamond Beacon) */}
          <div
            data-testid="legend-active-sources-marker"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-950/35 border border-rose-500/55 text-slate-200"
            title={`Nedrivningskilder / Demolition Source Nodes (${activeSources.length} synlige af ${totalActiveCount} aktive · ${hiddenSet.size} skjult · ${inactiveCount} inaktive)`}
          >
            <span
              className="w-2.5 h-2.5 rotate-45 rounded-[1px] bg-rose-500 border border-white shrink-0 shadow-[0_0_6px_rgba(244,63,94,0.85)]"
              aria-hidden="true"
            />
            <span className="font-bold text-rose-200">Nedrivningskilder</span>
            <span className="text-white font-bold">
              {activeSources.length}/{totalActiveCount}
            </span>
            {hiddenSet.size > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-300 pl-1 border-l border-rose-500/35">
                <span>{hiddenSet.size} skjult</span>
              </span>
            )}
            {inactiveCount > 0 && (
              <span className="inline-flex items-center gap-1 text-slate-400 pl-1 border-l border-rose-500/35">
                <span className="w-2 h-2 rotate-45 bg-slate-500 shrink-0" aria-hidden="true" />
                <span>{inactiveCount} inaktiv</span>
              </span>
            )}
          </div>

          {/* Receptor Zones Marker Key (Distinct Concentric Circular Zone Ring) */}
          <div
            data-testid="legend-receptor-zones-marker"
            className="inline-flex flex-wrap items-center gap-2 px-2 py-0.5 rounded bg-sky-950/30 border border-sky-500/45 text-slate-200"
            title="Farvekodede Receptorzoner (Receptor Zones) efter Arbejdstilsynets Sumformel S = Sum(Ci/GVi)"
          >
            <span className="inline-flex items-center gap-1.5 font-bold text-sky-200">
              <span
                className="w-3 h-3 rounded-full border-2 border-sky-400 bg-sky-500/30 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <span className="w-1 h-1 rounded-full bg-sky-200" />
              </span>
              <span>Receptorzoner ({receptorCounts.total}):</span>
            </span>
            <span className="inline-flex items-center gap-1 text-rose-300" title="Kritisk zone S >= 1,0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white/80 shrink-0" />
              <span>S≥1,0 ({receptorCounts.red})</span>
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300" title="Forhøjet zone 0,5 <= S < 1,0">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
              <span>0,5–1,0 ({receptorCounts.orange})</span>
            </span>
            <span className="inline-flex items-center gap-1 text-yellow-200" title="Observationszone 0,25 <= S < 0,5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
              <span>0,25–0,5 ({receptorCounts.yellow})</span>
            </span>
            <span className="inline-flex items-center gap-1 text-sky-300" title="Under grænseværdi S < 0,25">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
              <span>S&lt;0,25 ({receptorCounts.safe})</span>
            </span>
            {receptorCounts.blue > 0 && (
              <span className="inline-flex items-center gap-1 text-indigo-300" title="Hydrologisk afstrømning aktiv">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                <span>Runoff ({receptorCounts.blue})</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Substance Category Checkboxes + Quick All/Clear + Details Toggle */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-semibold mr-0.5">
            Stoflag ({visibleSubstanceCount}/{SUBSTANCE_LEGEND_ITEMS.length}):
          </span>

          {SUBSTANCE_LEGEND_ITEMS.map((item) => {
            const checked = Boolean(visibleSubstances[item.key]);
            const emitterCount = emitterCountBySubstance[item.key] || 0;
            return (
              <label
                key={item.key}
                data-testid={`legend-substance-checkbox-${item.key}`}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border cursor-pointer transition-colors select-none ${
                  checked
                    ? 'bg-[#1B2433] border-slate-500 text-slate-100 font-semibold'
                    : 'bg-[#0F141D] border-[#253042] text-slate-500 opacity-75 hover:opacity-100'
                }`}
                title={`Vis/skjul ${item.label} på kortet (${emitterCount} aktive emissionskilder)`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleSubstance(item.key)}
                  className="accent-cyan-400 cursor-pointer w-3 h-3 shrink-0"
                  aria-label={`Vis/skjul ${item.label}`}
                />
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${item.dotClass}`}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap">{item.shortLabel}</span>
                <span className="text-[11px] text-slate-400">({emitterCount})</span>
              </label>
            );
          })}

          <button
            type="button"
            data-testid="legend-substances-toggle-all-btn"
            onClick={() => onSetAllSubstances(visibleSubstanceCount < SUBSTANCE_LEGEND_ITEMS.length)}
            className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-300 font-semibold cursor-pointer whitespace-nowrap"
            title={
              visibleSubstanceCount < SUBSTANCE_LEGEND_ITEMS.length
                ? 'Aktivér alle 5 stoflag'
                : 'Skjul alle stoflag'
            }
          >
            <Eye className="w-3 h-3 inline mr-1 -mt-0.5" />
            {visibleSubstanceCount < SUBSTANCE_LEGEND_ITEMS.length ? 'Alle (5)' : 'Ryd'}
          </button>

          <button
            type="button"
            data-testid="legend-expand-nodes-btn"
            onClick={() => setIsDetailsExpanded((v) => !v)}
            className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-300 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            aria-expanded={isDetailsExpanded}
            title="Vis detaljeret liste over aktive kilder og mest eksponerede receptorer"
          >
            <span>Noder</span>
            {isDetailsExpanded ? (
              <ChevronUp className="w-3 h-3 shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Active Sources & Top Receptor Zones Quick-Jump Strip */}
      {isDetailsExpanded && (
        <div
          data-testid="legend-expanded-details"
          className="pt-1.5 border-t border-[#253042] grid grid-cols-1 lg:grid-cols-2 gap-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-rose-300 font-semibold inline-flex items-center gap-1 mr-1">
              <Radio className="w-3 h-3 shrink-0" />
              <span>Aktive kildenoder:</span>
            </span>
            {activeSources.length === 0 ? (
              <span className="text-[11px] text-slate-400">Ingen synlige aktive kilder</span>
            ) : (
              activeSources.map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => onSelectSource?.(src.id)}
                  className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-rose-500/40 text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  title={src.address}
                >
                  <span className="w-2 h-2 rounded-[2px] bg-rose-500 shrink-0" />
                  <span className="font-bold text-rose-200">{src.code}</span>
                  <span className="text-slate-300 truncate max-w-[140px]">
                    {src.name.split('—')[0].trim()}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-sky-300 font-semibold inline-flex items-center gap-1 mr-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span>Top eksponerede receptorer:</span>
            </span>
            {worstReceptors.map((exp) => {
              const dotCls =
                exp.sumQuotient >= 1.0
                  ? 'bg-rose-500'
                  : exp.sumQuotient >= 0.5
                  ? 'bg-orange-500'
                  : exp.sumQuotient >= 0.25
                  ? 'bg-yellow-400'
                  : 'bg-sky-400';
              return (
                <button
                  key={exp.receptorId}
                  type="button"
                  onClick={() => onSelectReceptor?.(exp.receptorId)}
                  className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  title={`${exp.receptorName} — ${exp.address}`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                  <span className="font-bold text-slate-100">{exp.receptorCode}</span>
                  <span className="text-slate-300">S={exp.sumQuotient.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
