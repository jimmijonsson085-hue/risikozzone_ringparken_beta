import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ExternalLink,
  GripHorizontal,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Pin,
  RotateCcw,
  X,
} from 'lucide-react';

export type DashboardWindowId =
  | 'photo_upload'
  | 'pdf_authority_evidence'
  | 'evidence_timeline_24h'
  | 'medical_expert_ai'
  | 'thirty_day_aggregated_heatmap'
  | 'prediction_vs_actual_forecast'
  | 'proactive_ai_agent'
  | 'stochastic_wind_bias'
  | 'wind_rose_7day'
  | 'wind_rose_24h'
  | 'temp_aerosol_24h'
  | 'cumulative_dust_24h'
  | 'receptor_dust_deposition_profile'
  | 'substances_sumformel'
  | 'algedonic_observations'
  | 'noise_dust_correlation'
  | 'wind_noise_correlation'
  | 'rolling_6h_wind_noise_correlation'
  | 'legal_compliance'
  | 'gemini_grounding_chat'
  | 'bioscience_toxicology'
  | 'who_cumulative_exposure_score'
  | 'acoustic_refraction_dashboard'
  | 'dispersion_forecast_bulletin'
  | 'neighbor_24h_asbestos_dose'
  | 'indoor_climate_telemetry'
  | 'map_viewport_2d_3d';

export interface DashboardWindowMeta {
  id: DashboardWindowId;
  title: string;
  shortTitle: string;
  category: string;
  accentColor: 'cyan' | 'amber' | 'emerald' | 'rose' | 'indigo' | 'fuchsia';
  defaultX: number;
  defaultY: number;
  defaultWidth: number;
}

export const DASHBOARD_WINDOW_REGISTRY: Record<
  DashboardWindowId,
  DashboardWindowMeta
> = {
  photo_upload: {
    id: 'photo_upload',
    title: 'Upload Foto, AI Billedanalyse & SHA-256 Bevis-Registrering',
    shortTitle: 'Upload Foto & AI Bevis',
    category: 'Foto-Bevis',
    accentColor: 'fuchsia',
    defaultX: 80,
    defaultY: 96,
    defaultWidth: 560,
  },
  pdf_authority_evidence: {
    id: 'pdf_authority_evidence',
    title: 'PDF-Upload: Mailkorrespondancer, Svar på Aktindsigt & Myndighedshenvendelser',
    shortTitle: 'PDF-Bevis & Aktindsigt',
    category: 'PDF-Bevis',
    accentColor: 'indigo',
    defaultX: 90,
    defaultY: 98,
    defaultWidth: 840,
  },
  evidence_timeline_24h: {
    id: 'evidence_timeline_24h',
    title: '24-Timers Bevis-Tidslinje (Fysiske Observationer, Foto- & PDF-Beviser vs. Meteorologisk Spidsbelastning)',
    shortTitle: '24t Bevis-Tidslinje',
    category: 'Bevis-Tidslinje',
    accentColor: 'cyan',
    defaultX: 96,
    defaultY: 104,
    defaultWidth: 780,
  },
  medical_expert_ai: {
    id: 'medical_expert_ai',
    title: 'Lægefaglig AI Ekspert: Kroppens Reaktion, Sundhedsfaglige Råd & Samlet Bevis-Bilag',
    shortTitle: 'Lægefaglig AI Ekspert & Bilag',
    category: 'Lægefagligt Bilag',
    accentColor: 'rose',
    defaultX: 84,
    defaultY: 92,
    defaultWidth: 840,
  },
  thirty_day_aggregated_heatmap: {
    id: 'thirty_day_aggregated_heatmap',
    title: '30-Dages Aggregeret Støvsprednings-Heatmap & Langsigtede Tendenser (Gemte Simuleringer)',
    shortTitle: '30-Dages Støv-Heatmap (Tendenser)',
    category: '30d Heatmap',
    accentColor: 'rose',
    defaultX: 88,
    defaultY: 94,
    defaultWidth: 820,
  },
  prediction_vs_actual_forecast: {
    id: 'prediction_vs_actual_forecast',
    title: 'Prædiktion vs. Virkeligt Vejrforløb (Sidste Uge), Næste Uges Vejrudsigt & Tidsrejse (00:00)',
    shortTitle: 'Prædiktion vs. Virkelighed & 7d Udsigt',
    category: 'Prædiktion & Udsigt',
    accentColor: 'amber',
    defaultX: 95,
    defaultY: 98,
    defaultWidth: 800,
  },
  proactive_ai_agent: {
    id: 'proactive_ai_agent',
    title: 'Proaktiv AI-Agent: De 3 Seneste Naboklager × Vejrmønster → Tiltag',
    shortTitle: 'Proaktiv AI-Agent (3 Klager)',
    category: 'AI-Agent',
    accentColor: 'amber',
    defaultX: 110,
    defaultY: 110,
    defaultWidth: 740,
  },
  stochastic_wind_bias: {
    id: 'stochastic_wind_bias',
    title: 'Stokastisk Vind-Bias Analyse (Open-Meteo vs. Slagelse Vejrstation)',
    shortTitle: 'Stokastisk Vind-Bias (95% CI)',
    category: 'Bevisværdi',
    accentColor: 'emerald',
    defaultX: 140,
    defaultY: 120,
    defaultWidth: 760,
  },
  wind_rose_7day: {
    id: 'wind_rose_7day',
    title: '7-Dages Historisk Vind-Rose vs. Typisk Slagelse Klimanormal',
    shortTitle: '7-Dages Historisk Vind-Rose',
    category: 'Vind-Historik',
    accentColor: 'indigo',
    defaultX: 160,
    defaultY: 105,
    defaultWidth: 740,
  },
  wind_rose_24h: {
    id: 'wind_rose_24h',
    title: '24-Timers Interaktiv Vind-Rose & Spredningsretninger',
    shortTitle: '24t Vind-Rose',
    category: 'Meteorologi',
    accentColor: 'cyan',
    defaultX: 190,
    defaultY: 125,
    defaultWidth: 580,
  },
  temp_aerosol_24h: {
    id: 'temp_aerosol_24h',
    title: '24-Timers Temperaturudvikling & Aerosol-Dannelse (Recharts)',
    shortTitle: '24t Temperatur & Aerosol',
    category: 'Meteorologi',
    accentColor: 'amber',
    defaultX: 220,
    defaultY: 140,
    defaultWidth: 600,
  },
  cumulative_dust_24h: {
    id: 'cumulative_dust_24h',
    title: 'Akkumuleret Dosis af Respirable Støvpartikler over Tid',
    shortTitle: 'Akkumuleret Støvdosis (24t)',
    category: 'Eksponering',
    accentColor: 'rose',
    defaultX: 150,
    defaultY: 135,
    defaultWidth: 640,
  },
  receptor_dust_deposition_profile: {
    id: 'receptor_dust_deposition_profile',
    title: 'Akkumuleret Støv-Deponeringsprofil (µg/m²) pr. Kvadratmeter for Enkelte Receptorer',
    shortTitle: 'Støv-Deponeringsprofil (µg/m²)',
    category: 'Deponering (µg/m²)',
    accentColor: 'amber',
    defaultX: 135,
    defaultY: 108,
    defaultWidth: 820,
  },
  substances_sumformel: {
    id: 'substances_sumformel',
    title: 'Stoffer, Kildenoder & Arbejdstilsynets Sumformel (BEK 613/2026)',
    shortTitle: 'Stoffer & Sumformel (S)',
    category: 'Toksikologi',
    accentColor: 'rose',
    defaultX: 120,
    defaultY: 100,
    defaultWidth: 580,
  },
  algedonic_observations: {
    id: 'algedonic_observations',
    title: 'Indberet Algedonisk Signal & Registrerede Naboklager (SHA-256)',
    shortTitle: 'Algedoniske Signaler & Klager',
    category: 'Felt-Bevis',
    accentColor: 'fuchsia',
    defaultX: 130,
    defaultY: 115,
    defaultWidth: 600,
  },
  noise_dust_correlation: {
    id: 'noise_dust_correlation',
    title: 'Vejr-Korrelation med Naboklager om Støj (dB) og Støv (S)',
    shortTitle: 'Støj (dB) & Støv Korrelation',
    category: 'Akustik & Støv',
    accentColor: 'amber',
    defaultX: 145,
    defaultY: 110,
    defaultWidth: 680,
  },
  legal_compliance: {
    id: 'legal_compliance',
    title: 'Automatisk Juridisk Lovovertrædelses-Detektor (BEK 613/2026 & MST)',
    shortTitle: 'Juridisk Lov-Detektor',
    category: 'Jura',
    accentColor: 'rose',
    defaultX: 175,
    defaultY: 120,
    defaultWidth: 620,
  },
  gemini_grounding_chat: {
    id: 'gemini_grounding_chat',
    title: 'Dedikeret Gemini Chat Bot — 5 AI Eksperter (AMR · Jurist · Fysiker/Mat. · Læge · Kybernetiker/VSM)',
    shortTitle: '5 AI Eksperter (Gemini Chat)',
    category: '5 AI Eksperter',
    accentColor: 'cyan',
    defaultX: 145,
    defaultY: 96,
    defaultWidth: 740,
  },
  bioscience_toxicology: {
    id: 'bioscience_toxicology',
    title: 'Molekylær Toksikologi (AlphaFold DB, UniProt, PubChem & Europe PMC)',
    shortTitle: 'Molekylær Toksikologi',
    category: 'Bioscience',
    accentColor: 'emerald',
    defaultX: 155,
    defaultY: 110,
    defaultWidth: 640,
  },
  who_cumulative_exposure_score: {
    id: 'who_cumulative_exposure_score',
    title: 'WHO Kumulativ Eksponeringsscore (AirQ+ / WHO AQG 2021) for Valgte Receptorer',
    shortTitle: 'WHO Eksponeringsscore (Graf)',
    category: 'WHO Bio-Toks',
    accentColor: 'emerald',
    defaultX: 148,
    defaultY: 102,
    defaultWidth: 780,
  },
  acoustic_refraction_dashboard: {
    id: 'acoustic_refraction_dashboard',
    title: 'Akustisk Refraktions Mini-Dashboard (Lydbølge-Nedbøjning & Støjforstærknings-risiko > 3 dB)',
    shortTitle: 'Akustisk Refraktion (> 3 dB)',
    category: 'Akustik & Vejr',
    accentColor: 'rose',
    defaultX: 90,
    defaultY: 88,
    defaultWidth: 920,
  },
  dispersion_forecast_bulletin: {
    id: 'dispersion_forecast_bulletin',
    title: 'Spredningsprognose: 1. Døgnet efter kl. 00.00.00-00.59.59 · 2. Fem døgns prognose · 3. Som indlæg i en Vejrudsigt',
    shortTitle: 'Spredningsprognose (3 Tilstande)',
    category: 'Spredningsprognose',
    accentColor: 'cyan',
    defaultX: 92,
    defaultY: 90,
    defaultWidth: 940,
  },
  neighbor_24h_asbestos_dose: {
    id: 'neighbor_24h_asbestos_dose',
    title: 'Asbestos Exposure Risk: 24-Timers Respirable Asbestfibre pr. Receptorzone vs. Aktuel Nedrivningsaktivitet',
    shortTitle: 'Asbestos Exposure Risk (24t)',
    category: 'Asbest-Heatmap',
    accentColor: 'fuchsia',
    defaultX: 115,
    defaultY: 95,
    defaultWidth: 760,
  },
  indoor_climate_telemetry: {
    id: 'indoor_climate_telemetry',
    title: 'Indeklima & CAV/Opdrift Telemetri (DIN 4150-3 · BR18 § 443 · z_NPL · S_in = 3,15)',
    shortTitle: 'Indeklima & CAV/Opdrift',
    category: 'Indeklima-Telemetri',
    accentColor: 'rose',
    defaultX: 98,
    defaultY: 86,
    defaultWidth: 880,
  },
  map_viewport_2d_3d: {
    id: 'map_viewport_2d_3d',
    title: 'Kort-Siden & Heatmaps (2D Taktisk Spredningskort, Differens-Heatmap & 3D Digital Tvilling)',
    shortTitle: 'Kort-Siden & Heatmaps',
    category: 'Kort & Heatmaps',
    accentColor: 'cyan',
    defaultX: 60,
    defaultY: 70,
    defaultWidth: 980,
  },
  wind_noise_correlation: {
    id: 'wind_noise_correlation',
    title: 'Vind-Støj Korrelation: 24-Timers Tidslinje (Vindstød × Støv- & Støj-Hændelser · Vindstøj-Sensitivitet)',
    shortTitle: 'Vind-Støj Korrelation (24t)',
    category: 'Vind-Støj',
    accentColor: 'amber',
    defaultX: 108,
    defaultY: 96,
    defaultWidth: 780,
  },
  rolling_6h_wind_noise_correlation: {
    id: 'rolling_6h_wind_noise_correlation',
    title: 'Rullende 6-Timers Vindstød × Maskin-Impulsstøj Korrelation (Pearsons r)',
    shortTitle: 'Rullende 6t Vindstød × Støj (r)',
    category: 'Vind-Støj',
    accentColor: 'amber',
    defaultX: 124,
    defaultY: 112,
    defaultWidth: 760,
  },
};

export interface WindowInstanceState {
  id: DashboardWindowId;
  isFloating: boolean;
  isMinimized: boolean;
  x: number;
  y: number;
  width: number;
  zIndex: number;
}

const ACCENT_LABEL_TEXT: Record<DashboardWindowMeta['accentColor'], string> = {
  cyan: 'text-cyan-300',
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
  rose: 'text-rose-300',
  indigo: 'text-indigo-300',
  fuchsia: 'text-fuchsia-300',
};

export interface FloatingDraggableWindowProps {
  meta: DashboardWindowMeta;
  state: WindowInstanceState;
  onFocus: (id: DashboardWindowId) => void;
  onMove: (id: DashboardWindowId, x: number, y: number) => void;
  onMinimize: (id: DashboardWindowId) => void;
  onCloseOrDock: (id: DashboardWindowId) => void;
  children: React.ReactNode;
}

export const FloatingDraggableWindow: React.FC<FloatingDraggableWindowProps> = ({
  meta,
  state,
  onFocus,
  onMove,
  onMinimize,
  onCloseOrDock,
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({
    offsetX: 0,
    offsetY: 0,
  });

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onFocus(meta.id);
    if (isMaximized) return;

    setIsDragging(true);
    dragOffsetRef.current = {
      offsetX: e.clientX - state.x,
      offsetY: e.clientY - state.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const maxX = Math.max(40, window.innerWidth - 180);
    const maxY = Math.max(40, window.innerHeight - 80);
    const nextX = Math.max(8, Math.min(maxX, e.clientX - dragOffsetRef.current.offsetX));
    const nextY = Math.max(44, Math.min(maxY, e.clientY - dragOffsetRef.current.offsetY));
    onMove(meta.id, nextX, nextY);
  };

  const handleHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if capture already released
    }
  };

  if (state.isMinimized || !state.isFloating) {
    return null;
  }

  const windowStyle: React.CSSProperties = isMaximized
    ? {
        position: 'fixed',
        top: 52,
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: state.zIndex + 200,
      }
    : {
        position: 'fixed',
        left: state.x,
        top: state.y,
        width: Math.min(state.width, Math.max(340, window.innerWidth - 24)),
        maxHeight: 'calc(100vh - 76px)',
        zIndex: state.zIndex + 100,
      };

  return (
    <div
      style={windowStyle}
      onMouseDown={() => onFocus(meta.id)}
      role="dialog"
      aria-label={meta.title}
      className={`flex flex-col rounded-lg bg-[var(--surface-overlay)] border border-[var(--border-subtle)] shadow-2xl transition-colors ${
        isDragging ? 'cursor-grabbing select-none ring-1 ring-[#38BDF8]' : ''
      }`}
    >
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className={`px-3 py-2 rounded-t-lg bg-[var(--surface-panel)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 select-none ${
          isMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        title="Træk i titellinjen for at flytte vinduet frit rundt på skærmen"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
          <span
            className={`font-mono text-[11px] font-semibold shrink-0 ${
              ACCENT_LABEL_TEXT[meta.accentColor]
            }`}
          >
            {meta.category}
          </span>
          <span className="text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="text-xs font-semibold text-slate-100 truncate">
            {meta.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onCloseOrDock(meta.id)}
            className="px-2.5 py-1 rounded bg-[#1B2433] hover:bg-slate-700 border border-[#2D3B50] text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            title="Fastgør vinduet tilbage i dashboard-panelet"
          >
            <Pin className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Fastgør</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMaximized((prev) => !prev)}
            className="p-1.5 rounded bg-[#1B2433] hover:bg-slate-700 border border-[#2D3B50] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isMaximized ? 'Gendan vinduesstørrelse' : 'Maksimér vindue'}
            aria-label={isMaximized ? 'Gendan vinduesstørrelse' : 'Maksimér vindue'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onMinimize(meta.id)}
            className="px-2.5 py-1 rounded bg-[#1B2433] hover:bg-slate-700 border border-[#2D3B50] text-slate-200 hover:text-white font-mono text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Minimer vindue til Dropdown-menuen for minimerede vinduer"
            aria-label={`Minimer ${meta.shortTitle}`}
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Minimer</span>
          </button>

          <button
            type="button"
            onClick={() => onCloseOrDock(meta.id)}
            className="p-1.5 rounded bg-[#1B2433] hover:bg-rose-600 border border-[#2D3B50] hover:border-rose-400 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Luk flydende vindue"
            aria-label={`Luk ${meta.shortTitle}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 overflow-y-auto flex-1 space-y-3 bg-[#1B2433] rounded-b-lg">
        {children}
      </div>
    </div>
  );
};

export interface DockableWindowFrameProps {
  windowId: DashboardWindowId;
  state: WindowInstanceState;
  onMinimize: (id: DashboardWindowId) => void;
  onPopOutFloating: (id: DashboardWindowId, initialX?: number, initialY?: number) => void;
  onRestore: (id: DashboardWindowId) => void;
  children: React.ReactNode;
}

export const DockableWindowFrame: React.FC<DockableWindowFrameProps> = ({
  windowId,
  state,
  onMinimize,
  onPopOutFloating,
  onRestore,
  children,
}) => {
  const meta = DASHBOARD_WINDOW_REGISTRY[windowId];

  if (state?.isMinimized) {
    return (
      <div
        data-window-minimized="true"
        className="window-minimized-collapse h-auto min-h-0 flex-none self-start w-full px-3 py-2 rounded-md bg-[#1B2433] border border-[#2D3B50] flex items-center justify-between gap-2 font-mono text-xs transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-amber-300 text-[11px] font-semibold shrink-0">
            Minimeret
          </span>
          <span className="text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="text-slate-200 text-[11px] truncate">{meta.shortTitle}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onRestore(windowId)}
            className="px-2.5 py-1 rounded bg-[#212C3E] hover:bg-slate-700 border border-[#36465E] text-cyan-300 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Gendan Vindue
          </button>
          <button
            type="button"
            onClick={() => onPopOutFloating(windowId)}
            className="px-2.5 py-1 rounded bg-[#212C3E] hover:bg-slate-700 border border-[#36465E] text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Frigiv
          </button>
        </div>
      </div>
    );
  }

  if (state?.isFloating) {
    return (
      <div
        data-window-id={windowId}
        data-window-floating="true"
        data-window-minimized="true"
        className="window-minimized-collapse h-auto min-h-0 flex-none self-start w-full px-3 py-2 rounded-md bg-[#1B2433] border border-dashed border-[#36465E] flex items-center justify-between gap-2 font-mono text-xs transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-slate-200 text-[11px] truncate">
            Vinduet (<strong className="text-white">{meta.shortTitle}</strong>) vises som flydende panel
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onRestore(windowId)}
            className="px-2.5 py-1 rounded bg-[#212C3E] hover:bg-slate-700 border border-[#36465E] text-cyan-300 text-[11px] font-semibold shrink-0 cursor-pointer"
          >
            Fastgør her
          </button>
          <button
            type="button"
            onClick={() => onMinimize(windowId)}
            className="px-2.5 py-1 rounded bg-[#212C3E] hover:bg-slate-700 border border-[#36465E] text-slate-200 text-[11px] font-semibold shrink-0 cursor-pointer"
          >
            Minimer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-window-id={windowId}
      data-window-minimized="false"
      className="h-auto min-h-0 self-start w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden transition-colors"
    >
      <div
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          const startX = e.clientX;
          const startY = e.clientY;
          const handleMove = (moveEvent: PointerEvent) => {
            if (
              Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 12
            ) {
              window.removeEventListener('pointermove', handleMove);
              window.removeEventListener('pointerup', handleUp);
              onPopOutFloating(
                windowId,
                Math.max(24, moveEvent.clientX - 180),
                Math.max(56, moveEvent.clientY - 20)
              );
            }
          };
          const handleUp = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
          };
          window.addEventListener('pointermove', handleMove);
          window.addEventListener('pointerup', handleUp);
        }}
        className="px-3 py-1.5 bg-[#151C28] border-b border-[#253042] flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none"
        title="Træk i denne titellinje (eller klik 'Frigiv') for at frigive og flytte vinduet frit rundt på skærmen"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span
            className={`font-mono text-[11px] font-semibold shrink-0 ${
              ACCENT_LABEL_TEXT[meta.accentColor]
            }`}
          >
            {meta.category}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-[11px] font-mono font-semibold text-slate-100 truncate">
            {meta.shortTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onPopOutFloating(windowId)}
            className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-slate-700 border border-[#2D3B50] text-slate-200 hover:text-white font-mono text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Frigiv vinduet så du kan trække det frit rundt på skærmen"
          >
            <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>Frigiv</span>
          </button>

          <button
            type="button"
            onClick={() => onMinimize(windowId)}
            className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-slate-700 border border-[#2D3B50] text-slate-300 hover:text-white font-mono text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Minimer vindue til Dropdown-menuen (øverste højre hjørne)"
            aria-label={`Minimer ${meta.shortTitle}`}
          >
            <Minus className="w-3 h-3" />
            <span>Minimer</span>
          </button>
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
};

export interface MinimizedWindowsDropdownMenuProps {
  windowStates: Record<DashboardWindowId, WindowInstanceState>;
  onRestoreWindow: (id: DashboardWindowId) => void;
  onPopOutFloating: (id: DashboardWindowId) => void;
  onMinimizeAllFloating: () => void;
  onRestoreAllMinimized: () => void;
}

export const MinimizedWindowsDropdownMenu: React.FC<
  MinimizedWindowsDropdownMenuProps
> = ({
  windowStates,
  onRestoreWindow,
  onPopOutFloating,
  onMinimizeAllFloating,
  onRestoreAllMinimized,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allWindowIds = Object.keys(
    DASHBOARD_WINDOW_REGISTRY
  ) as DashboardWindowId[];

  const minimizedWindows = allWindowIds
    .filter((id) => windowStates[id]?.isMinimized)
    .map((id) => DASHBOARD_WINDOW_REGISTRY[id]);

  const floatingWindows = allWindowIds
    .filter((id) => windowStates[id]?.isFloating && !windowStates[id]?.isMinimized)
    .map((id) => DASHBOARD_WINDOW_REGISTRY[id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative flex items-center gap-1.5" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => onPopOutFloating('photo_upload')}
        className={`px-2.5 py-1.5 rounded text-[11px] font-mono font-semibold transition-colors flex items-center gap-1.5 border whitespace-nowrap cursor-pointer ${
          windowStates.photo_upload?.isFloating &&
          !windowStates.photo_upload?.isMinimized
            ? 'bg-cyan-500 text-slate-950 border-cyan-300'
            : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
        }`}
        title="Åbn 'Upload Foto & AI Bevis-Analyse' som et frit trækbart vindue på skærmen"
      >
        <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>Upload Foto</span>
      </button>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-2.5 py-1.5 rounded text-[11px] font-mono tabular-nums font-semibold transition-colors flex items-center gap-1.5 border whitespace-nowrap cursor-pointer ${
          minimizedWindows.length > 0
            ? 'bg-amber-500/20 text-amber-200 border-amber-400/60 hover:bg-amber-500/30'
            : isOpen
            ? 'bg-cyan-500 text-slate-950 border-cyan-300'
            : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
        }`}
        title="Åbn dropdown-menu med minimerede vinduer til visning samt styring af flytbare dashboard-vinduer"
      >
        <Layers className="w-3.5 h-3.5 shrink-0" />
        <span>Vinduer ({minimizedWindows.length})</span>
        {floatingWindows.length > 0 && (
          <span className="text-cyan-300 text-[11px]">
            · {floatingWindows.length} flydende
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="fixed sm:absolute right-2 sm:right-0 top-12 sm:top-full mt-1.5 w-[390px] max-w-[95vw] rounded-lg bg-[#212C3E] border border-[#36465E] shadow-2xl z-[9999] p-3.5 space-y-3 font-mono text-xs tabular-nums">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-[#2D3B50] pb-2">
              <span className="text-[11px] font-bold text-slate-100">
                Minimerede Vinduer ({minimizedWindows.length})
              </span>
              {minimizedWindows.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onRestoreAllMinimized();
                    setIsOpen(false);
                  }}
                  className="px-2.5 py-1 rounded bg-[#1B2433] hover:bg-slate-700 border border-[#2D3B50] text-emerald-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Gendan Alle ({minimizedWindows.length})</span>
                </button>
              )}
            </div>

            {minimizedWindows.length === 0 ? (
              <div className="p-3 rounded bg-[#1B2433] border border-[#2D3B50] text-slate-300 text-[11px] leading-relaxed">
                Ingen minimerede vinduer i øjeblikket. Klik på{' '}
                <strong className="text-slate-100">Minimer</strong> i øverste højre hjørne på et
                vindue for at samle det her.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {minimizedWindows.map((win) => (
                  <div
                    key={win.id}
                    className="p-2 rounded bg-[#1B2433] border border-[#2D3B50] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {win.shortTitle}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {win.category}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreWindow(win.id);
                          setIsOpen(false);
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 font-semibold text-[11px] hover:bg-cyan-400 transition-colors cursor-pointer"
                        title="Gendan og vis vinduet"
                      >
                        Vis
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onPopOutFloating(win.id);
                          setIsOpen(false);
                        }}
                        className="px-2.5 py-1 rounded bg-[#212C3E] hover:bg-slate-700 border border-[#36465E] text-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
                        title="Åbn som frit trækbart vindue på skærmen"
                      >
                        Trækbart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-[#2D3B50]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200">
                Åbn eller Frigør Analysevinduer
              </span>
              {floatingWindows.length > 0 && (
                <button
                  type="button"
                  onClick={() => onMinimizeAllFloating()}
                  className="text-[11px] text-amber-300 hover:underline cursor-pointer"
                >
                  Minimér flydende ({floatingWindows.length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto pr-0.5">
              {allWindowIds.map((id) => {
                const meta = DASHBOARD_WINDOW_REGISTRY[id];
                const st = windowStates[id];
                const isFloat = st?.isFloating && !st?.isMinimized;
                const isMin = st?.isMinimized;
                return (
                  <div
                    key={id}
                    className="px-2.5 py-1.5 rounded bg-[#1B2433] border border-[#2D3B50] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-[11px] text-slate-200 truncate">
                        {meta.shortTitle}
                      </span>
                      {isMin && (
                        <span className="text-[11px] text-amber-300 shrink-0">
                          · Minimeret
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onPopOutFloating(id);
                        setIsOpen(false);
                      }}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-colors shrink-0 cursor-pointer ${
                        isFloat
                          ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                          : 'bg-[#212C3E] hover:bg-slate-700 border-[#36465E] text-slate-200'
                      }`}
                    >
                      {isFloat ? 'Fokusér' : 'Åbn Trækbart'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
