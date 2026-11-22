import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Clock,
  CloudLightning,
  Compass,
  FileDown,
  Layers,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import {
  BUILDING_CATEGORY_METADATA,
  CRITICAL_WEATHER_SCENARIOS,
} from '../../data/ringparkenData';
import {
  ReceptorZone,
  RingparkenBuildingUnit,
} from '../../types/dispersion';
import { RightPanelTab, UiDensityMode, ViewportVisualizationMode } from './layoutTypes';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  buildings: RingparkenBuildingUnit[];
  receptors: ReceptorZone[];
  activeScenarioId: string | null;
  observationsCount: number;
  legalViolationsCount: number;
  // Navigation & Actions
  onSelectTab: (tab: RightPanelTab) => void;
  onSelectPuff24hTab: () => void;
  onSetViewportMode: (mode: ViewportVisualizationMode) => void;
  onToggleWeatherCorrelationPopup: () => void;
  onOpenAcousticRefraction: () => void;
  onOpenDispersionForecast: () => void;
  onOpenRangeSimDrawer: () => void;
  onFocusBuilding: (building: RingparkenBuildingUnit) => void;
  onFocusReceptor: (receptor: ReceptorZone) => void;
  onSelectLiveOpenMeteo: () => void;
  onApplyWeatherScenario: (scenarioId: string) => void;
  onAddAllFindingsToEvidence: () => void;
  onExportChronologicalPdf: () => void;
  onOpenSlagelseComplaintGenerator: () => void;
  onOpenExportHub: () => void;
  onRestoreAllWindows: () => void;
  densityMode: UiDensityMode;
  onToggleDensityMode: () => void;
}

type CommandGroupKey = 'workspaces' | 'buildings_receptors' | 'scenarios' | 'quick_actions';

interface CommandItem {
  id: string;
  group: CommandGroupKey;
  title: string;
  subtitle: string;
  keywords: string;
  metaRight?: string;
  execute: () => void;
}

const RECENT_STORAGE_KEY = 'ringparken_cmd_palette_recent_v1';

const FIXED_GROUP_ORDER: Array<{
  key: CommandGroupKey;
  heading: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'workspaces', heading: 'Arbejdsrum & Moduler', icon: Layers },
  { key: 'buildings_receptors', heading: '29 Bygninger & Receptorer', icon: Building2 },
  { key: 'scenarios', heading: 'Kritiske Vejr-Scenarier', icon: CloudLightning },
  { key: 'quick_actions', heading: 'Hurtige Bevis- & Eksporthandlinger', icon: FileDown },
];

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onOpen,
  onClose,
  buildings,
  receptors,
  activeScenarioId,
  observationsCount,
  legalViolationsCount,
  onSelectTab,
  onSelectPuff24hTab,
  onSetViewportMode,
  onToggleWeatherCorrelationPopup,
  onOpenAcousticRefraction,
  onOpenDispersionForecast,
  onOpenRangeSimDrawer,
  onFocusBuilding,
  onFocusReceptor,
  onSelectLiveOpenMeteo,
  onApplyWeatherScenario,
  onAddAllFindingsToEvidence,
  onExportChronologicalPdf,
  onOpenSlagelseComplaintGenerator,
  onOpenExportHub,
  onRestoreAllWindows,
  densityMode,
  onToggleDensityMode,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Global Cmd+K / Ctrl+K shortcut — works even when focus is inside <input>, <textarea>, or <select>
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
      } else if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, onOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const recordRecent = useCallback((cmdId: string) => {
    setRecentIds((prev) => {
      const next = [cmdId, ...prev.filter((id) => id !== cmdId)].slice(0, 5);
      try {
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors in sandboxed iframes
      }
      return next;
    });
  }, []);

  const allCommands = useMemo<CommandItem[]>(() => {
    const workspaceItems: CommandItem[] = [
      {
        id: 'ws-tab-algedonic',
        group: 'workspaces',
        title: 'AI Foto-Bevis & Algedoniske Signaler',
        subtitle: `Skift højre analysepanel til bevisførelse og SHA-256 registrering (${observationsCount} beviser)`,
        keywords: 'foto bevis algedonisk kamera observationer sha256',
        metaRight: 'Fane',
        execute: () => onSelectTab('algedonic'),
      },
      {
        id: 'ws-tab-noisedust',
        group: 'workspaces',
        title: 'Støj & Støv Analyse (dB & Sumkvotient)',
        subtitle: 'Vindstøjs-følsomhed, 168t .DBA impulskatalog og naboklage-korrelation',
        keywords: 'støj støv db dba impuls maskinstøj betonhammer',
        metaRight: 'Fane',
        execute: () => onSelectTab('noiseDust'),
      },
      {
        id: 'ws-tab-indoor',
        group: 'workspaces',
        title: 'Indeklima, CAV-Aftræk & Termisk Opdrift',
        subtitle: 'DIN 4150-3 bygningsvibrationer, BR18 § 443 og skorstenseffekt ΔP_s',
        keywords: 'indeklima cav opdrift br18 din 4150 kælder asbest',
        metaRight: 'Fane',
        execute: () => onSelectTab('indoorClimate'),
      },
      {
        id: 'ws-tab-puff24h',
        group: 'workspaces',
        title: '24-Timers Gaussisk Puff-Historik',
        subtitle: 'Aktivér kumulativ 24t støv- og faneakkumulering på kortet',
        keywords: '24t puff historik spredning fanevej kumulativ',
        metaRight: 'Fane + Kort',
        execute: onSelectPuff24hTab,
      },
      {
        id: 'ws-tab-substances',
        group: 'workspaces',
        title: 'Stof- & Sumformel + 29 Bygningsregister',
        subtitle: 'Arbejdstilsynets BEK 613/2026 sumformel og miljøprøver (PSS W22085)',
        keywords: 'stof sumformel asbest pcb bly kvarts bek 613 bygninger',
        metaRight: 'Fane',
        execute: () => onSelectTab('substances'),
      },
      {
        id: 'ws-tab-bioscience',
        group: 'workspaces',
        title: 'Molekylær Bio-Toksikologi & WHO Eksponering',
        subtitle: 'AlphaFold 3D-strukturer, PubChem og Europe PMC litteratur',
        keywords: 'bio toksikologi who alphafold pubchem helbred læge',
        metaRight: 'Fane',
        execute: () => onSelectTab('bioscience'),
      },
      {
        id: 'ws-tab-compliance',
        group: 'workspaces',
        title: 'Lovovertrædelser, L 69 Bødeberegner & Slagelse Sagslog',
        subtitle: `Juridisk kontrolmodul med ${legalViolationsCount} registrerede lovbrud`,
        keywords: 'lovovertrædelser compliance l69 bøde slagelse kommune mbl',
        metaRight: 'Fane',
        execute: () => onSelectTab('compliance'),
      },
      {
        id: 'ws-tab-grounding',
        group: 'workspaces',
        title: '5 Faglige Ekspert-Rådgivere',
        subtitle: 'AMR, Miljøjurist, Atmosfærefysiker, Arbejdsmediciner & Kybernetiker',
        keywords: 'eksperter amr jurist fysiker læge kybernetiker rådgiver',
        metaRight: 'Fane',
        execute: () => onSelectTab('grounding'),
      },
      {
        id: 'ws-view-2d',
        group: 'workspaces',
        title: 'Skift Visning: 2D Taktisk Spredningskort',
        subtitle: 'Fuld højde 2D GIS-kort med vindvektorer, isoplether og receptorer',
        keywords: '2d kort gis spredningskort visning',
        metaRight: 'Viewport',
        execute: () => onSetViewportMode('2d'),
      },
      {
        id: 'ws-view-3d',
        group: 'workspaces',
        title: 'Skift Visning: 3D Digital Tvilling',
        subtitle: 'Interaktiv 3D-bygningsmodel med volumetriske støvfaner og støjbølger',
        keywords: '3d digital tvilling scene bygninger visning',
        metaRight: 'Viewport',
        execute: () => onSetViewportMode('3d'),
      },
      {
        id: 'ws-view-split',
        group: 'workspaces',
        title: 'Skift Visning: Split 2D Kort + 3D Tvilling',
        subtitle: 'Synkroniseret side-om-side visning af 2D taktisk kort og 3D-model',
        keywords: 'split 2d 3d delt skærm visning',
        metaRight: 'Viewport',
        execute: () => onSetViewportMode('split'),
      },
      {
        id: 'ws-view-groundwater-2d',
        group: 'workspaces',
        title: 'Skift Visning: Grundvand & 2D Perkolation',
        subtitle: 'Tværsnit af jordlag, Darcy-nedsivning og grundvandsmagasin',
        keywords: 'grundvand perkolation 2d darcy udvaskning jord',
        metaRight: 'Viewport',
        execute: () => onSetViewportMode('underground_2d'),
      },
      {
        id: 'ws-view-groundwater-3d',
        group: 'workspaces',
        title: 'Skift Visning: 3D Underjordisk Perkolation',
        subtitle: '3D hydrogeologisk model under Blok 1–2 og omkringliggende moræneler',
        keywords: 'grundvand perkolation 3d underjordisk blok 1 2',
        metaRight: 'Viewport',
        execute: () => onSetViewportMode('underground_3d'),
      },
      {
        id: 'ws-tool-weather-corr',
        group: 'workspaces',
        title: 'Åbn 24t Vejr-Korrelationsgraf (D3)',
        subtitle: 'Sammenhold vindhastighed (m/s) med støj- og støvhændelser time for time',
        keywords: 'vejr korrelationsgraf d3 vind støj støv graf',
        metaRight: 'Værktøj',
        execute: onToggleWeatherCorrelationPopup,
      },
      {
        id: 'ws-tool-acoustic-refr',
        group: 'workspaces',
        title: 'Åbn Akustisk Lydbølge-Refraktion',
        subtitle: 'Nord2000 nedbøjning af lydbølger og >3 dB støjforstærknings-risiko',
        keywords: 'akustisk refraktion lydbølge nedbøjning nord2000 db',
        metaRight: 'Værktøj',
        execute: onOpenAcousticRefraction,
      },
      {
        id: 'ws-tool-forecast',
        group: 'workspaces',
        title: 'Åbn 5-Døgns Spredningsprognose',
        subtitle: 'Kommende døgns vindretning, støvrisiko og præventive nabovarsler',
        keywords: 'spredningsprognose prognose 5 døgn varsling vejrudsigt',
        metaRight: 'Værktøj',
        execute: onOpenDispersionForecast,
      },
      {
        id: 'ws-tool-range-sim',
        group: 'workspaces',
        title: 'Åbn Interval-Simulering (Simuler Fra – Til)',
        subtitle: 'Kør sammenhængende fler-døgns simulering mellem to datoer og klokkeslæt',
        keywords: 'interval simulering fra til dato klokkeslæt periode',
        metaRight: 'Simulering',
        execute: onOpenRangeSimDrawer,
      },
    ];

    const buildingAndReceptorItems: CommandItem[] = [
      ...buildings.map((b) => {
        const catMeta = BUILDING_CATEGORY_METADATA[b.category];
        return {
          id: `bldg-${b.id}`,
          group: 'buildings_receptors' as const,
          title: `${b.code} — ${b.name}`,
          subtitle: `${b.address} · ${catMeta.labelDa} (${b.floors} etager, ${b.constructionYear})`,
          keywords: `${b.id} ${b.code} ${b.name} ${b.address} ${catMeta.labelDa} ${b.department} blok bygning`,
          metaRight: catMeta.labelDa,
          execute: () => onFocusBuilding(b),
        };
      }),
      ...receptors
        .filter((r) => !r.buildingUnitId)
        .map((r) => ({
          id: `rec-${r.id}`,
          group: 'buildings_receptors' as const,
          title: `${r.code} — ${r.name}`,
          subtitle: `${r.address} · ${r.vulnerableGroupNote}`,
          keywords: `${r.id} ${r.code} ${r.name} ${r.address} ${r.vulnerableGroupNote} receptor nabo`,
          metaRight: 'Receptor',
          execute: () => onFocusReceptor(r),
        })),
    ];

    const scenarioItems: CommandItem[] = [
      {
        id: 'scen-live-open-meteo',
        group: 'scenarios',
        title: 'Live Open-Meteo (24t Realtids-Vejrtelemetri)',
        subtitle: 'Hent aktuelle meteorologiske målinger for 4200 Slagelse uden scenarie-override',
        keywords: 'live open meteo realtid vejr sluk scenarie',
        metaRight: activeScenarioId === null ? 'Aktiv' : 'Live API',
        execute: onSelectLiveOpenMeteo,
      },
      ...CRITICAL_WEATHER_SCENARIOS.map((sc) => ({
        id: `scen-${sc.id}`,
        group: 'scenarios' as const,
        title: sc.title,
        subtitle: `${sc.shortLabel} — ${sc.description}`,
        keywords: `${sc.id} ${sc.title} ${sc.shortLabel} ${sc.badgeText} kritisk vejr scenarie vind`,
        metaRight: activeScenarioId === sc.id ? 'Aktiv' : `Kl. ${String(sc.defaultFocusHour).padStart(2, '0')}:00`,
        execute: () => onApplyWeatherScenario(sc.id),
      })),
    ];

    const quickActionItems: CommandItem[] = [
      {
        id: 'act-add-all-findings',
        group: 'quick_actions',
        title: 'Føj alle aktuelle fund til Beviser (SHA-256)',
        subtitle: 'Signerer alle aktuelle grænseværdioverskridelser kryptografisk i beviskæden',
        keywords: 'føj alle fund beviser sha256 registrer gem',
        metaRight: 'Handling',
        execute: onAddAllFindingsToEvidence,
      },
      {
        id: 'act-export-chrono-pdf',
        group: 'quick_actions',
        title: 'Eksportér Kronologisk Bevis-PDF',
        subtitle: 'Generér og download kronologisk PDF-bilag med fotos og SHA-256 signaturer',
        keywords: 'eksporter kronologisk pdf rapport bilag download',
        metaRight: 'PDF',
        execute: onExportChronologicalPdf,
      },
      {
        id: 'act-open-slagelse-complaint',
        group: 'quick_actions',
        title: 'Åbn EU / Slagelse Kommune Klagegenerator',
        subtitle: 'Gå direkte til juridisk klageudkast (MBL § 42, BEK 613/2026 & ESDH-eksport)',
        keywords: 'eu slagelse kommune klagegenerator juridisk klage påbud',
        metaRight: 'Juridisk',
        execute: onOpenSlagelseComplaintGenerator,
      },
      {
        id: 'act-open-export-hub',
        group: 'quick_actions',
        title: 'Åbn Rapport- & Eksport-Hub (Alle 23 Flows)',
        subtitle: 'Samlet adgang til alle 10 PDF-rapporter, 5 ESDH CSV-tabeller og 8 JSON/TXT/Print-flows',
        keywords: 'åbn rapport eksport hub pdf csv json print bulk',
        metaRight: '23 Flows',
        execute: onOpenExportHub,
      },
      {
        id: 'act-toggle-density-mode',
        group: 'quick_actions',
        title:
          densityMode === 'compact'
            ? 'Skift Analyst Density Mode: Standard (1.00×)'
            : 'Skift Analyst Density Mode: Kompakt Tilsyn (0.80×)',
        subtitle:
          'Skifter kort-padding og tabelrækker mellem Standard og ~20 % tættere feltvisning til 13" laptops',
        keywords: 'density tæthed kompakt standard tilsyn 13 laptop feltvisning rækker',
        metaRight: densityMode === 'compact' ? 'Kompakt' : 'Standard',
        execute: onToggleDensityMode,
      },
      {
        id: 'act-restore-windows',
        group: 'quick_actions',
        title: 'Gendan alle minimerede vinduer',
        subtitle: 'Åbner alle sammenklappede analysevinduer i arbejdsrummet igen',
        keywords: 'gendan vinduer vis alle åbn minimerede',
        metaRight: 'Layout',
        execute: onRestoreAllWindows,
      },
    ];

    return [
      ...workspaceItems,
      ...buildingAndReceptorItems,
      ...scenarioItems,
      ...quickActionItems,
    ];
  }, [
    observationsCount,
    legalViolationsCount,
    buildings,
    receptors,
    activeScenarioId,
    onSelectTab,
    onSelectPuff24hTab,
    onSetViewportMode,
    onToggleWeatherCorrelationPopup,
    onOpenAcousticRefraction,
    onOpenDispersionForecast,
    onOpenRangeSimDrawer,
    onFocusBuilding,
    onFocusReceptor,
    onSelectLiveOpenMeteo,
    onApplyWeatherScenario,
    onAddAllFindingsToEvidence,
    onExportChronologicalPdf,
    onOpenSlagelseComplaintGenerator,
    onOpenExportHub,
    onRestoreAllWindows,
    densityMode,
    onToggleDensityMode,
  ]);

  const trimmedQuery = query.trim().toLowerCase();

  const { renderedSections, flatVisibleOptions } = useMemo(() => {
    const tokens = trimmedQuery ? trimmedQuery.split(/\s+/).filter(Boolean) : [];
    const matchesQuery = (cmd: CommandItem) => {
      if (tokens.length === 0) return true;
      const haystack = `${cmd.title} ${cmd.subtitle} ${cmd.keywords}`.toLowerCase();
      return tokens.every((tk) => haystack.includes(tk));
    };

    const sections: Array<{
      sectionKey: string;
      heading: string;
      icon: React.ComponentType<{ className?: string }>;
      options: Array<{ optionDomId: string; item: CommandItem }>;
    }> = [];

    // Show up to 5 most recently used commands at top when search query is empty
    if (tokens.length === 0 && recentIds.length > 0) {
      const recentItems = recentIds
        .map((id) => allCommands.find((c) => c.id === id))
        .filter((c): c is CommandItem => Boolean(c));
      if (recentItems.length > 0) {
        sections.push({
          sectionKey: 'recent',
          heading: 'Senest brugte kommandoer',
          icon: Clock,
          options: recentItems.map((item) => ({
            optionDomId: `cmd-opt-recent-${item.id}`,
            item,
          })),
        });
      }
    }

    // Always render the 4 fixed groups in invariant order (never reordered between keystrokes)
    for (const grp of FIXED_GROUP_ORDER) {
      const matched = allCommands.filter((c) => c.group === grp.key && matchesQuery(c));
      if (matched.length > 0) {
        sections.push({
          sectionKey: grp.key,
          heading: grp.heading,
          icon: grp.icon,
          options: matched.map((item) => ({
            optionDomId: `cmd-opt-${grp.key}-${item.id}`,
            item,
          })),
        });
      }
    }

    const flat = sections.flatMap((s) => s.options);
    return { renderedSections: sections, flatVisibleOptions: flat };
  }, [allCommands, recentIds, trimmedQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery]);

  const safeActiveIndex =
    flatVisibleOptions.length === 0
      ? -1
      : Math.min(activeIndex, flatVisibleOptions.length - 1);
  const activeOption = safeActiveIndex >= 0 ? flatVisibleOptions[safeActiveIndex] : null;

  useEffect(() => {
    if (!activeOption || !listContainerRef.current) return;
    const el = listContainerRef.current.querySelector<HTMLElement>(
      `#${CSS.escape(activeOption.optionDomId)}`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeOption]);

  const triggerCommand = useCallback(
    (item: CommandItem) => {
      recordRecent(item.id);
      onClose();
      item.execute();
    },
    [recordRecent, onClose]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatVisibleOptions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatVisibleOptions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatVisibleOptions.length > 0) {
        setActiveIndex(
          (prev) => (prev - 1 + flatVisibleOptions.length) % flatVisibleOptions.length
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeOption) {
        triggerCommand(activeOption.item);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  let runningFlatIdx = -1;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center pt-16 px-4 pb-8 bg-black/70 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global Kommandopalet"
        data-testid="command-palette-modal"
        className="w-full max-w-2xl max-h-[78dvh] flex flex-col rounded-lg bg-[var(--surface-overlay)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden font-sans tabular-nums text-[var(--text-primary)]"
      >
        {/* Search Input Header (Focus remains strictly inside input while ArrowUp/ArrowDown navigate via aria-activedescendant) */}
        <div className="px-4 py-3 bg-[var(--surface-panel)] border-b border-[var(--border-subtle)] flex items-center gap-2.5 shrink-0">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-listbox"
            aria-activedescendant={activeOption ? activeOption.optionDomId : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Søg bygning (f.eks. Blok 1, Rødtjørnevej 2), arbejdsrum, vejrscenarie eller rapport…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer"
            >
              Ryd
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk kommandopalet"
            className="p-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Grouped Command Listbox */}
        <div
          id="command-palette-listbox"
          ref={listContainerRef}
          role="listbox"
          aria-label="Kommandoforslag"
          className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3"
        >
          {renderedSections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.sectionKey} className="space-y-1">
                <div className="px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <SectionIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{section.heading}</span>
                  <span className="text-slate-500">· {section.options.length}</span>
                </div>

                <div className="space-y-0.5">
                  {section.options.map((opt) => {
                    runningFlatIdx += 1;
                    const optIdx = runningFlatIdx;
                    const isSelected = optIdx === safeActiveIndex;

                    return (
                      <div
                        key={opt.optionDomId}
                        id={opt.optionDomId}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActiveIndex(optIdx)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          triggerCommand(opt.item);
                        }}
                        className={`px-3 py-2 rounded-md flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#212C3E] border border-cyan-500/50 text-white'
                            : 'border border-transparent text-slate-200 hover:bg-[#1B2433]'
                        }`}
                      >
                        <div className="min-w-0 flex items-start gap-2.5">
                          {opt.item.group === 'buildings_receptors' ? (
                            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          ) : (
                            <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{opt.item.title}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {opt.item.subtitle}
                            </div>
                          </div>
                        </div>

                        {opt.item.metaRight && (
                          <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">
                            {opt.item.metaRight}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {flatVisibleOptions.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-400">
              Ingen bygninger, receptorer, scenarier eller moduler matcher &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        {/* Subtle Keyboard Hint Footer */}
        <div className="px-4 py-2 bg-[var(--surface-panel)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 text-[11px] font-mono text-[var(--text-secondary)] shrink-0">
          <span>↑↓ Vælg kommando · Enter Udfør · Esc Luk</span>
          <span>Genvej: ⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
};
