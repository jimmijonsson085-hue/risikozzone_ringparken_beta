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
    title: '📸 Upload Foto, AI Billedanalyse & SHA-256 Bevis-Registrering',
    shortTitle: '📸 Upload Foto & AI Bevis',
    category: 'Foto-Bevis',
    accentColor: 'fuchsia',
    defaultX: 80,
    defaultY: 96,
    defaultWidth: 560,
  },
  pdf_authority_evidence: {
    id: 'pdf_authority_evidence',
    title: '📄 PDF-Upload: Mailkorrespondancer, Svar på Aktindsigt & Myndighedshenvendelser',
    shortTitle: '📄 PDF-Bevis & Aktindsigt',
    category: 'PDF-Bevis',
    accentColor: 'indigo',
    defaultX: 90,
    defaultY: 98,
    defaultWidth: 840,
  },
  evidence_timeline_24h: {
    id: 'evidence_timeline_24h',
    title: '⏱ 24-Timers Bevis-Tidslinje (Fysiske Observationer, Foto- & PDF-Beviser vs. Meteorologisk Spidsbelastning)',
    shortTitle: '⏱ 24t Bevis-Tidslinje',
    category: 'Bevis-Tidslinje',
    accentColor: 'cyan',
    defaultX: 96,
    defaultY: 104,
    defaultWidth: 780,
  },
  medical_expert_ai: {
    id: 'medical_expert_ai',
    title: '🩺 Lægefaglig AI Ekspert: Kroppens Reaktion, Sundhedsfaglige Råd & Samlet Bevis-Bilag',
    shortTitle: '🩺 Lægefaglig AI Ekspert & Bilag',
    category: 'Lægefagligt Bilag',
    accentColor: 'rose',
    defaultX: 84,
    defaultY: 92,
    defaultWidth: 840,
  },
  thirty_day_aggregated_heatmap: {
    id: 'thirty_day_aggregated_heatmap',
    title: '🔥 30-Dages Aggregeret Støvsprednings-Heatmap & Langsigtede Tendenser (Gemte Simuleringer)',
    shortTitle: '🔥 30-Dages Støv-Heatmap (Tendenser)',
    category: '30d Heatmap',
    accentColor: 'rose',
    defaultX: 88,
    defaultY: 94,
    defaultWidth: 820,
  },
  prediction_vs_actual_forecast: {
    id: 'prediction_vs_actual_forecast',
    title: '📊 Prædiktion vs. Virkeligt Vejrforløb (Sidste Uge), Næste Uges Vejrudsigt & Tidsrejse (00:00)',
    shortTitle: '📊 Prædiktion vs. Virkelighed & 7d Udsigt',
    category: 'Prædiktion & Udsigt',
    accentColor: 'amber',
    defaultX: 95,
    defaultY: 98,
    defaultWidth: 800,
  },
  proactive_ai_agent: {
    id: 'proactive_ai_agent',
    title: '🤖 Proaktiv AI-Agent: De 3 Seneste Naboklager × Vejrmønster → Tiltag',
    shortTitle: '🤖 Proaktiv AI-Agent (3 Klager)',
    category: 'AI-Agent',
    accentColor: 'amber',
    defaultX: 110,
    defaultY: 110,
    defaultWidth: 740,
  },
  stochastic_wind_bias: {
    id: 'stochastic_wind_bias',
    title: '⚖ Stokastisk Vind-Bias Analyse (Open-Meteo vs. Slagelse Vejrstation)',
    shortTitle: '⚖ Stokastisk Vind-Bias (95% CI)',
    category: 'Bevisværdi',
    accentColor: 'emerald',
    defaultX: 140,
    defaultY: 120,
    defaultWidth: 760,
  },
  wind_rose_7day: {
    id: 'wind_rose_7day',
    title: '🧭 7-Dages Historisk Vind-Rose vs. Typisk Slagelse Klimanormal',
    shortTitle: '🧭 7-Dages Historisk Vind-Rose',
    category: 'Vind-Historik',
    accentColor: 'indigo',
    defaultX: 160,
    defaultY: 105,
    defaultWidth: 740,
  },
  wind_rose_24h: {
    id: 'wind_rose_24h',
    title: '🌬 24-Timers Interaktiv Vind-Rose & Spredningsretninger',
    shortTitle: '🌬 24t Vind-Rose',
    category: 'Meteorologi',
    accentColor: 'cyan',
    defaultX: 190,
    defaultY: 125,
    defaultWidth: 580,
  },
  temp_aerosol_24h: {
    id: 'temp_aerosol_24h',
    title: '🌡 24-Timers Temperaturudvikling & Aerosol-Dannelse (Recharts)',
    shortTitle: '🌡 24t Temperatur & Aerosol',
    category: 'Meteorologi',
    accentColor: 'amber',
    defaultX: 220,
    defaultY: 140,
    defaultWidth: 600,
  },
  cumulative_dust_24h: {
    id: 'cumulative_dust_24h',
    title: '💨 Akkumuleret Dosis af Respirable Støvpartikler over Tid',
    shortTitle: '💨 Akkumuleret Støvdosis (24t)',
    category: 'Eksponering',
    accentColor: 'rose',
    defaultX: 150,
    defaultY: 135,
    defaultWidth: 640,
  },
  receptor_dust_deposition_profile: {
    id: 'receptor_dust_deposition_profile',
    title: '🧱 Akkumuleret Støv-Deponeringsprofil (µg/m²) pr. Kvadratmeter for Enkelte Receptorer',
    shortTitle: '🧱 Støv-Deponeringsprofil (µg/m²)',
    category: 'Deponering (µg/m²)',
    accentColor: 'amber',
    defaultX: 135,
    defaultY: 108,
    defaultWidth: 820,
  },
  substances_sumformel: {
    id: 'substances_sumformel',
    title: '☣ Stoffer, Kildenoder & Arbejdstilsynets Sumformel (BEK 613/2026)',
    shortTitle: '☣ Stoffer & Sumformel (S)',
    category: 'Toksikologi',
    accentColor: 'rose',
    defaultX: 120,
    defaultY: 100,
    defaultWidth: 580,
  },
  algedonic_observations: {
    id: 'algedonic_observations',
    title: '⚡ Indberet Algedonisk Signal & Registrerede Naboklager (SHA-256)',
    shortTitle: '⚡ Algedoniske Signaler & Klager',
    category: 'Felt-Bevis',
    accentColor: 'fuchsia',
    defaultX: 130,
    defaultY: 115,
    defaultWidth: 600,
  },
  noise_dust_correlation: {
    id: 'noise_dust_correlation',
    title: '🔊 Vejr-Korrelation med Naboklager om Støj (dB) og Støv (S)',
    shortTitle: '🔊 Støj (dB) & Støv Korrelation',
    category: 'Akustik & Støv',
    accentColor: 'amber',
    defaultX: 145,
    defaultY: 110,
    defaultWidth: 680,
  },
  legal_compliance: {
    id: 'legal_compliance',
    title: '⚖ Automatisk Juridisk Lovovertrædelses-Detektor (BEK 613/2026 & MST)',
    shortTitle: '⚖ Juridisk Lov-Detektor',
    category: 'Jura',
    accentColor: 'rose',
    defaultX: 175,
    defaultY: 120,
    defaultWidth: 620,
  },
  gemini_grounding_chat: {
    id: 'gemini_grounding_chat',
    title: '🤖 Dedikeret Gemini Chat Bot — 5 AI Eksperter (AMR · Jurist · Fysiker/Mat. · Læge · Kybernetiker/VSM)',
    shortTitle: '🤖 5 AI Eksperter (Gemini Chat)',
    category: '5 AI Eksperter',
    accentColor: 'cyan',
    defaultX: 145,
    defaultY: 96,
    defaultWidth: 740,
  },
  bioscience_toxicology: {
    id: 'bioscience_toxicology',
    title: '🧬 Molekylær Toksikologi (AlphaFold DB, UniProt, PubChem & Europe PMC)',
    shortTitle: '🧬 Molekylær Toksikologi',
    category: 'Bioscience',
    accentColor: 'emerald',
    defaultX: 155,
    defaultY: 110,
    defaultWidth: 640,
  },
  who_cumulative_exposure_score: {
    id: 'who_cumulative_exposure_score',
    title: '🌍 WHO Kumulativ Eksponeringsscore (AirQ+ / WHO AQG 2021) for Valgte Receptorer',
    shortTitle: '🌍 WHO Eksponeringsscore (Graf)',
    category: 'WHO Bio-Toks',
    accentColor: 'emerald',
    defaultX: 148,
    defaultY: 102,
    defaultWidth: 780,
  },
  acoustic_refraction_dashboard: {
    id: 'acoustic_refraction_dashboard',
    title: '🔊 Akustisk Refraktions Mini-Dashboard (Lydbølge-Nedbøjning & Støjforstærknings-risiko > 3 dB)',
    shortTitle: '🔊 Akustisk Refraktion (> 3 dB)',
    category: 'Akustik & Vejr',
    accentColor: 'rose',
    defaultX: 90,
    defaultY: 88,
    defaultWidth: 920,
  },
  dispersion_forecast_bulletin: {
    id: 'dispersion_forecast_bulletin',
    title: '🔮 Spredningsprognose: 1. Døgnet efter kl. 00.00.00-00.59.59 · 2. Fem døgns prognose · 3. Som indlæg i en Vejrudsigt',
    shortTitle: '🔮 Spredningsprognose (3 Tilstande)',
    category: 'Spredningsprognose',
    accentColor: 'cyan',
    defaultX: 92,
    defaultY: 90,
    defaultWidth: 940,
  },
  neighbor_24h_asbestos_dose: {
    id: 'neighbor_24h_asbestos_dose',
    title: '☣ 24-Timers Samlet Asbest-Eksponerings-Dosis for Mest Udsatte Naboblokke (Kilde-Aktivitet)',
    shortTitle: '☣ 24t Nabo Asbest-Dosis',
    category: 'Asbest-Heatmap',
    accentColor: 'fuchsia',
    defaultX: 115,
    defaultY: 95,
    defaultWidth: 760,
  },
  indoor_climate_telemetry: {
    id: 'indoor_climate_telemetry',
    title: '🏠 Indeklima & CAV/Opdrift Telemetri (DIN 4150-3 · BR18 § 443 · z_NPL · S_in = 3,15)',
    shortTitle: '🏠 Indeklima & CAV/Opdrift',
    category: 'Indeklima-Telemetri',
    accentColor: 'rose',
    defaultX: 98,
    defaultY: 86,
    defaultWidth: 880,
  },
  map_viewport_2d_3d: {
    id: 'map_viewport_2d_3d',
    title: '🗺️ Kort-Siden & Heatmaps (2D Taktisk Spredningskort, Differens-Heatmap & 3D Digital Tvilling)',
    shortTitle: '🗺️ Kort-Siden & Heatmaps',
    category: 'Kort & Heatmaps',
    accentColor: 'cyan',
    defaultX: 60,
    defaultY: 70,
    defaultWidth: 980,
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

const ACCENT_BORDER_CLASSES: Record<
  DashboardWindowMeta['accentColor'],
  string
> = {
  cyan: 'border-cyan-500/70 shadow-[0_12px_40px_rgba(6,182,212,0.22)]',
  amber: 'border-amber-400/80 shadow-[0_12px_40px_rgba(245,158,11,0.22)]',
  emerald: 'border-emerald-500/70 shadow-[0_12px_40px_rgba(16,185,129,0.22)]',
  rose: 'border-rose-500/75 shadow-[0_12px_40px_rgba(244,63,94,0.25)]',
  indigo: 'border-indigo-500/75 shadow-[0_12px_40px_rgba(99,102,241,0.25)]',
  fuchsia: 'border-fuchsia-500/75 shadow-[0_12px_40px_rgba(217,70,239,0.25)]',
};

const ACCENT_HEADER_CLASSES: Record<
  DashboardWindowMeta['accentColor'],
  string
> = {
  cyan: 'from-cyan-950/90 via-slate-900 to-slate-950 border-cyan-500/40',
  amber: 'from-amber-950/85 via-slate-900 to-slate-950 border-amber-500/40',
  emerald: 'from-emerald-950/85 via-slate-900 to-slate-950 border-emerald-500/40',
  rose: 'from-rose-950/85 via-slate-900 to-slate-950 border-rose-500/40',
  indigo: 'from-indigo-950/90 via-slate-900 to-slate-950 border-indigo-500/40',
  fuchsia: 'from-fuchsia-950/90 via-slate-900 to-slate-950 border-fuchsia-500/40',
};

/**
 * FloatingDraggableWindow:
 * Allows the user to drag any open dashboard window freely around the screen,
 * bring it to front on click/drag, dock it back, or click the Minimize button in the top-right corner.
 */
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
    // Ignore clicks on buttons inside the header
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
      className={`flex flex-col rounded-lg bg-[#090D16]/98 backdrop-blur-md border-2 transition-shadow ${
        ACCENT_BORDER_CLASSES[meta.accentColor]
      } ${isDragging ? 'cursor-grabbing select-none ring-2 ring-cyan-300' : ''}`}
    >
      {/* Draggable Window Title Bar with Minimize Button in Top-Right Corner */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className={`px-3 py-2 rounded-t-md bg-gradient-to-r ${
          ACCENT_HEADER_CLASSES[meta.accentColor]
        } border-b flex items-center justify-between gap-2 select-none ${
          isMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        title="Træk i titellinjen for at flytte vinduet frit rundt på skærmen"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 font-mono text-[9.5px] font-bold uppercase text-cyan-300 shrink-0">
            {meta.category}
          </span>
          <span className="text-xs font-bold text-white truncate">
            {meta.title}
          </span>
        </div>

        {/* Right-Corner Window Controls: Dock/Pin, Maximize, Minimize (—), Close */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onCloseOrDock(meta.id)}
            className="px-2 py-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
            title="Fastgør vinduet tilbage i dashboard-panelet"
          >
            <Pin className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Fastgør</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMaximized((prev) => !prev)}
            className="p-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title={isMaximized ? 'Gendan vinduesstørrelse' : 'Maksimér vindue'}
            aria-label={isMaximized ? 'Gendan vinduesstørrelse' : 'Maksimér vindue'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Dedicated Minimize Button in Top-Right Corner */}
          <button
            type="button"
            onClick={() => onMinimize(meta.id)}
            className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-400 hover:text-slate-950 border border-amber-400/70 text-amber-200 font-mono text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="Minimer vindue til Dropdown-menuen for minimerede vinduer"
            aria-label={`Minimer ${meta.shortTitle}`}
          >
            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Minimer</span>
          </button>

          <button
            type="button"
            onClick={() => onCloseOrDock(meta.id)}
            className="p-1 rounded bg-rose-950/80 hover:bg-rose-600 border border-rose-500/50 text-rose-200 hover:text-white transition-colors cursor-pointer"
            title="Luk flydende vindue"
            aria-label={`Luk ${meta.shortTitle}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Window Body */}
      <div className="p-3 overflow-y-auto flex-1 space-y-3">{children}</div>
    </div>
  );
};

/**
 * DockableWindowFrame:
 * Wraps any inline/docked dashboard window so it has:
 * 1) A top-right Minimize button ("— Minimer") that minimizes it to the Dropdown Menu.
 * 2) A "Frigiv" button (or drag gesture on the header) that pops it out into a floating draggable window on screen.
 */
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

  // If this window is currently minimized, hide its body and show a compact restore strip (plus it appears in the top Dropdown Menu)
  if (state?.isMinimized) {
    return (
      <div
        data-window-minimized="true"
        className="window-minimized-collapse h-auto min-h-0 flex-none self-start w-full px-3 py-2 rounded-md bg-slate-950/90 border border-amber-500/40 flex items-center justify-between gap-2 font-mono text-xs transition-all duration-200"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
            MINIMERET VINDUE
          </span>
          <span className="text-slate-300 truncate">{meta.shortTitle}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onRestore(windowId)}
            className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/60 text-cyan-200 text-[10.5px] font-bold transition-colors cursor-pointer"
          >
            Gendan Vindue
          </button>
          <button
            type="button"
            onClick={() => onPopOutFloating(windowId)}
            className="px-2 py-0.5 rounded bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/60 text-indigo-200 text-[10.5px] font-bold transition-colors cursor-pointer"
          >
            Frigiv
          </button>
        </div>
      </div>
    );
  }

  // If popped out as a floating window, show a subtle placeholder in the dock with a button to focus or dock back
  if (state?.isFloating) {
    return (
      <div
        data-window-minimized="true"
        className="window-minimized-collapse h-auto min-h-0 flex-none self-start w-full px-3 py-2 rounded-md bg-indigo-950/30 border border-dashed border-indigo-400/60 flex items-center justify-between gap-2 font-mono text-xs transition-all duration-200"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ExternalLink className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
          <span className="text-indigo-200 truncate">
            <strong>{meta.shortTitle}</strong> er frigivet som frit trækbart vindue på skærmen
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onRestore(windowId)}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-indigo-400/50 text-cyan-300 text-[10.5px] font-semibold shrink-0 cursor-pointer"
          >
            Fastgør i panel
          </button>
          <button
            type="button"
            onClick={() => onMinimize(windowId)}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-400 hover:text-slate-950 border border-amber-400/70 text-amber-200 text-[10.5px] font-bold shrink-0 cursor-pointer"
          >
            Minimer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-window-minimized="false"
      className="h-auto min-h-0 self-start w-full rounded-md border border-slate-800 bg-slate-950/60 overflow-hidden transition-all duration-200"
    >
      {/* Window Control Bar with Drag-to-Float ('Frigiv') & Top-Right 'Minimer' Button */}
      <div
        onPointerDown={(e) => {
          // Allow user to drag the header directly to undock and move around the screen
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
        className={`px-2.5 py-1.5 bg-gradient-to-r ${
          ACCENT_HEADER_CLASSES[meta.accentColor]
        } border-b flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none`}
        title="Træk i denne titellinje (eller klik 'Frigiv') for at frigive og flytte vinduet frit rundt på skærmen"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-slate-700 font-mono text-[9px] font-bold uppercase text-cyan-300 shrink-0">
            {meta.category}
          </span>
          <span className="text-[11px] font-mono font-bold text-slate-100 truncate">
            {meta.shortTitle}
          </span>
        </div>

        {/* Top-Right Corner Controls: 'Frigiv' Button + 'Minimer' Button */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onPopOutFloating(windowId)}
            className="px-2 py-0.5 rounded bg-indigo-500/25 hover:bg-indigo-500/45 border border-indigo-400/60 text-indigo-200 font-mono text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="Frigiv vinduet så du kan trække det frit rundt på skærmen"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span>Frigiv</span>
          </button>

          <button
            type="button"
            onClick={() => onMinimize(windowId)}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-400 hover:text-slate-950 border border-amber-400/70 text-amber-200 font-mono text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="Minimer vindue til Dropdown-menuen (øverste højre hjørne)"
            aria-label={`Minimer ${meta.shortTitle}`}
          >
            <Minus className="w-3 h-3 stroke-[2.5]" />
            <span>Minimer</span>
          </button>
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
};

/**
 * MinimizedWindowsDropdownMenu:
 * Renders a dropdown menu in the top header / telemetry bar showing:
 * 1) All currently minimized windows with 1-click restore (docked or floating)
 * 2) Quick button to open "📸 Upload Foto & AI Bevis-Analyse" as a draggable window
 * 3) Quick launcher to pop out any dashboard window as a draggable floating window
 */
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
      {/* Dedicated Quick-Button: Upload Foto (Opens draggable Upload Foto & AI Bevis window) */}
      <button
        type="button"
        onClick={() => onPopOutFloating('photo_upload')}
        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors flex items-center gap-1.5 border whitespace-nowrap ${
          windowStates.photo_upload?.isFloating &&
          !windowStates.photo_upload?.isMinimized
            ? 'bg-fuchsia-500 text-slate-950 border-fuchsia-300 shadow-xs'
            : 'bg-fuchsia-950/80 hover:bg-fuchsia-900 text-fuchsia-200 border-fuchsia-400/70'
        }`}
        title="Åbn 'Upload Foto & AI Bevis-Analyse' som et frit trækbart vindue på skærmen"
      >
        <Camera className="w-3.5 h-3.5 shrink-0" />
        <span>Upload Foto (Vindue)</span>
      </button>

      {/* Dropdown Trigger Button for Minimized & Draggable Windows */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors flex items-center gap-1.5 border whitespace-nowrap ${
          minimizedWindows.length > 0
            ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-sm'
            : isOpen
            ? 'bg-cyan-500 text-slate-950 border-cyan-300'
            : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/50'
        }`}
        title="Åbn dropdown-menu med minimerede vinduer til visning samt styring af flytbare dashboard-vinduer"
      >
        <Layers className="w-3.5 h-3.5 shrink-0" />
        <span>
          Minimerede Vinduer ({minimizedWindows.length})
        </span>
        {floatingWindows.length > 0 && (
          <span className="px-1.5 py-0.2 rounded bg-slate-950/90 text-cyan-300 text-[10px]">
            {floatingWindows.length} flydende
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div className="fixed sm:absolute right-2 sm:right-0 top-12 sm:top-full mt-1.5 w-[380px] max-w-[95vw] rounded-lg bg-[#090D16]/98 border-2 border-cyan-500/70 shadow-[0_16px_48px_rgba(0,0,0,0.85)] z-[9999] p-3 space-y-3 font-mono text-xs">
          {/* Section 1: Minimized Windows for Restoration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-300">
                ▼ Minimerede Vinduer til Visning ({minimizedWindows.length})
              </span>
              {minimizedWindows.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onRestoreAllMinimized();
                    setIsOpen(false);
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/60 text-emerald-200 text-[10px] font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Gendan Alle ({minimizedWindows.length})</span>
                </button>
              )}
            </div>

            {minimizedWindows.length === 0 ? (
              <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-slate-400 text-[11px] text-center">
                Ingen minimerede vinduer i øjeblikket. Klik på{' '}
                <strong className="text-amber-300">[— Minimér]</strong> i øverste højre
                hjørne på et hvilket som helst vindue for at lægge det herned.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {minimizedWindows.map((win) => (
                  <div
                    key={win.id}
                    className="p-2 rounded bg-slate-900/95 border border-amber-500/50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {win.shortTitle}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Kategori: {win.category}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreWindow(win.id);
                          setIsOpen(false);
                        }}
                        className="px-2 py-1 rounded bg-cyan-500 text-slate-950 font-bold text-[10.5px] hover:bg-cyan-400 transition-colors"
                        title="Gendan og vis vinduet"
                      >
                        Vis Vindue
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onPopOutFloating(win.id);
                          setIsOpen(false);
                        }}
                        className="px-2 py-1 rounded bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400 text-indigo-200 font-bold text-[10.5px] transition-colors"
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

          {/* Section 2: Open / Undock Any Dashboard Window to Drag Around Screen */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-cyan-300">
                ✥ Åbn / Frigør Trækbare Dashboard-Vinduer
              </span>
              {floatingWindows.length > 0 && (
                <button
                  type="button"
                  onClick={() => onMinimizeAllFloating()}
                  className="text-[10px] text-amber-300 hover:underline"
                >
                  Minimér alle flydende ({floatingWindows.length})
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
                    className="px-2 py-1.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isMin
                            ? 'bg-amber-400'
                            : isFloat
                            ? 'bg-emerald-400'
                            : 'bg-cyan-500/60'
                        }`}
                      />
                      <span className="text-[11px] text-slate-200 truncate">
                        {meta.shortTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onPopOutFloating(id);
                          setIsOpen(false);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          isFloat
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                            : 'bg-indigo-500/20 hover:bg-indigo-500/40 border-indigo-400/60 text-indigo-200'
                        }`}
                      >
                        {isFloat ? 'Fokusér Vindue' : 'Åbn Trækbart'}
                      </button>
                    </div>
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
