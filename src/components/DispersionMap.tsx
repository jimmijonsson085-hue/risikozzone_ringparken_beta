import React, { memo, useState, useEffect, useRef, useMemo } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  Polygon,
  Polyline,
} from '@vis.gl/react-google-maps';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  BellOff,
  Biohazard,
  Calendar,
  Camera,
  Check,
  Clock,
  CloudFog,
  Crosshair,
  Download,
  Droplets,
  ExternalLink,
  Flame,
  GripHorizontal,
  Layers,
  Lock,
  Map,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Navigation,
  Network,
  Pin,
  PlusCircle,
  Play,
  Pause,
  Printer,
  Radio,
  RotateCcw,
  ShieldCheck,
  Target,
  Volume2,
  Waves,
  Wind,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Animated24hWindWidget } from './Animated24hWindWidget';
import { CompactSimulerMenu } from './CompactSimulerMenu';
import { WaterMainBek1272Badge } from './WaterMainBek1272Badge';
import { WaterMainVibrationSankeyWidget } from './WaterMainVibrationSankeyWidget';
import { WaterMainVibrationSparkline } from './WaterMainVibrationSparkline';
import {
  computeVirtualLeakPercolationImpact,
  computeWaterMainLast6HoursTrend,
  exportWaterMainBek1272ComplianceCsv,
  snapPointToWaterMainPolyline,
} from '../services/waterMainPhysicsService';
import {
  AlgedonicObservation,
  BuildingOperationalCategory,
  DemolitionSourceNode,
  DifferenceHeatmapMetric,
  ForensicMapSnapshotMetadata,
  HeatmapComparisonResult,
  HeatmapComparisonViewMode,
  HeatmapGridCell,
  HourlyWeatherPoint,
  LatLngPoint,
  PlumePolygonZone,
  PuffAccumulationResult,
  ReceptorExposureResult,
  ReceptorZone,
  RingparkenBuildingUnit,
  RiskZoneLevel,
  SimultaneousAlgedonicDispatch,
  SubstanceKey,
  VirtualLeakPinImpact,
  WaterMainLiveTelemetry,
} from '../types/dispersion';
import {
  BUILDING_CATEGORY_METADATA,
  RINGPARKEN_CENTER,
  RINGPARKEN_MASTER_BUILDINGS,
  getReceptorIdForBuilding,
  getSourceIdForBuilding,
} from '../data/ringparkenData';
import {
  KIERULFFSVEJ_DAR_CONTROL_POINTS,
  KIERULFFSVEJ_SCENE_CONTROL_POINTS,
} from '../data/kierulffsvejWaterMainData';
import { degreesToCompass } from '../services/weatherService';
import { evaluateReceptorAtHour } from '../services/dispersionEngine';
import {
  generate2DViewportPrintPdfReport,
  render2DViewportPrintSnapshotDataUrl,
} from '../services/pdfExportService';
import { WindParticleFieldOverlay } from './WindParticleFieldOverlay';
import { WebGl2DDustPlumeOverlay } from './WebGl2DDustPlumeOverlay';
import { buildAutonomousReceptorMeshNetwork } from '../services/autonomousReceptorMeshService';
import {
  BlockComplaintDensityItem,
  ComplaintDensityFilterMode,
  NeighborComplaintDensityOverlay,
  computeNeighborComplaintBlockDensity,
} from './NeighborComplaintDensityOverlay';
import {
  MyceliumNetworkSimulationSnapshot,
  MyceliumSimulationScenario,
} from '../types/myceliumAlert';
import { simulateMyceliumNetwork } from '../services/myceliumSimulationEngine';
import { useMyceliumLiveAlerts } from '../hooks/useMyceliumLiveAlerts';
import {
  MyceliumGoogleMapsOverlayLayer,
  MyceliumSvgOverlayLayer,
} from './mycelium/MyceliumMapLayers';
import { MyceliumControlAndSankeyPanel } from './mycelium/MyceliumControlAndSankeyPanel';
import { MyceliumToastOverlay } from './mycelium/MyceliumToastOverlay';
import { SystemBFormulaSimulatorModal } from './mycelium/SystemBFormulaSimulatorModal';
import {
  WindDirectionalNoiseHudCard,
  WindDirectionalNoiseSvgLayer,
  computeWindDirectionalNoiseCells,
} from './WindDirectionalNoiseHeatmapLayer';

export type MapOverlayWindowId =
  | 'wind_hud'
  | 'asbestos_risk_heatmap'
  | 'groundwater_leaching_heatmap'
  | 'heatmap_comparison'
  | 'puff_24h_peak_heatmap'
  | 'forecast_6h_heatmap'
  | 'high_wind_notification'
  | 'map_legend_heatmap_key'
  | 'mycelium_alert_center';

export type TacticalHeatmapLayerMode = 'asbestos' | 'dust_deposition' | 'noise_contour';

export interface MapOverlayWindowState {
  isMinimized: boolean;
  isReleased: boolean;
  x: number;
  y: number;
  zIndex: number;
}

interface MapOverlayWindowBarProps {
  windowId: MapOverlayWindowId;
  title: string;
  badgeText?: string;
  accentColorClass?: string;
  state: MapOverlayWindowState;
  onToggleMinimize: (id: MapOverlayWindowId) => void;
  onToggleRelease: (id: MapOverlayWindowId) => void;
  onMove: (id: MapOverlayWindowId, x: number, y: number) => void;
  onFocus: (id: MapOverlayWindowId) => void;
  onClose?: () => void;
}

const MapOverlayWindowControlStrip: React.FC<MapOverlayWindowBarProps> = ({
  windowId,
  title,
  badgeText,
  accentColorClass = 'text-cyan-300',
  state,
  onToggleMinimize,
  onToggleRelease,
  onMove,
  onFocus,
  onClose,
}) => {
  const dragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({
    active: false,
    offsetX: 0,
    offsetY: 0,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    onFocus(windowId);

    if (!state.isReleased) {
      const rect = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
      const startX = rect ? rect.left : Math.max(20, e.clientX - 160);
      const startY = rect ? rect.top : Math.max(60, e.clientY - 16);
      onToggleRelease(windowId);
      onMove(windowId, startX, startY);
      dragRef.current = {
        active: true,
        offsetX: e.clientX - startX,
        offsetY: e.clientY - startY,
      };
    } else {
      dragRef.current = {
        active: true,
        offsetX: e.clientX - state.x,
        offsetY: e.clientY - state.y,
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    e.stopPropagation();
    const maxX = Math.max(40, window.innerWidth - 180);
    const maxY = Math.max(40, window.innerHeight - 60);
    const nextX = Math.max(8, Math.min(maxX, e.clientX - dragRef.current.offsetX));
    const nextY = Math.max(44, Math.min(maxY, e.clientY - dragRef.current.offsetY));
    onMove(windowId, nextX, nextY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`-mx-3 -mt-2.5 px-2.5 py-1.5 bg-[var(--surface-panel)] flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none transition-colors duration-200 ${
        state.isMinimized
          ? '-mb-2.5 rounded border-b-0'
          : 'mb-2 rounded-t border-b border-slate-800'
      }`}
      title="Træk her eller klik 'Frigiv' for at flytte dette vindue/heatmap frit rundt på kort-siden"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className={`text-[11px] font-mono font-bold truncate ${accentColorClass}`}>
          {title}
        </span>
        {badgeText && (
          <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-slate-700 font-mono text-[11px] font-bold text-slate-200 shrink-0">
            {badgeText}
          </span>
        )}
        {state.isReleased && (
          <span className="px-1 py-0.2 rounded bg-indigo-500/30 border border-indigo-400/60 text-[11px] font-mono text-indigo-200 font-bold shrink-0">
            FRIGIVET
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleRelease(windowId);
          }}
          className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
            state.isReleased
              ? 'bg-cyan-500/25 hover:bg-cyan-500/40 border-cyan-400/70 text-cyan-200'
              : 'bg-indigo-500/25 hover:bg-indigo-500/45 border-indigo-400/70 text-indigo-200'
          }`}
          title={
            state.isReleased
              ? 'Fastgør vinduet/heatmappet tilbage på kortet'
              : 'Frigiv vinduet/heatmappet så det kan trækkes frit rundt på skærmen'
          }
        >
          {state.isReleased ? (
            <>
              <Pin className="w-2.5 h-2.5 shrink-0" />
              <span>Fastgør</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              <span>Frigiv</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMinimize(windowId);
          }}
          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-400 hover:text-slate-950 border border-amber-400/70 text-amber-200 font-mono text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
          title={state.isMinimized ? 'Gendan / Udvid vindue' : 'Minimer vindue på kort-siden'}
        >
          <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
          <span>{state.isMinimized ? 'Gendan' : 'Minimer'}</span>
        </button>

        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-rose-600 border border-slate-700 hover:border-rose-400 text-slate-400 hover:text-white font-mono text-[11px] transition-colors cursor-pointer"
            title="Skjul dette heatmap-lag på kortet"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
};

interface DispersionMapProps {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  plumeZones: PlumePolygonZone[];
  receptorExposures: ReceptorExposureResult[];
  currentWeather: HourlyWeatherPoint;
  isPuffMode: boolean;
  puff24h: PuffAccumulationResult;
  observations: AlgedonicObservation[];
  selectedObservationId: string | null;
  pendingObservationPoint: LatLngPoint | null;
  onSelectObservation: (obs: AlgedonicObservation) => void;
  selectedSourceId: string | null;
  selectedReceptorId: string | null;
  onSelectSource: (id: string) => void;
  onSelectReceptor: (id: string) => void;
  mapClickMode: 'none' | 'add_source' | 'add_receptor' | 'add_observation';
  onSetMapClickMode: (mode: 'none' | 'add_source' | 'add_receptor' | 'add_observation') => void;
  onMapAddNode: (point: LatLngPoint, type: 'source' | 'receptor' | 'observation') => void;
  onSelectHourFromPeak?: (hourIndex: number) => void;
  isAnimatingPlumeRoute?: boolean;
  plumeRouteProgress?: number;
  onToggleAnimatePlumeRoute?: () => void;
  showHeatmapComparison?: boolean;
  onToggleHeatmapComparison?: () => void;
  heatmapComparison?: HeatmapComparisonResult;
  heatmapComparisonViewMode?: HeatmapComparisonViewMode;
  onChangeHeatmapComparisonViewMode?: (mode: HeatmapComparisonViewMode) => void;
  weatherHours?: HourlyWeatherPoint[];
  comparisonHourAIndex?: number;
  comparisonHourBIndex?: number;
  onChangeComparisonHourA?: (hourIndex: number) => void;
  onChangeComparisonHourB?: (hourIndex: number) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  fullscreenLabel?: string;
  onSaveMapSnapshotObservation?: (
    snapshot: ForensicMapSnapshotMetadata & { snapshotDataUrl: string }
  ) => void;
  buildings?: RingparkenBuildingUnit[];
  activeCategoryFilters?: BuildingOperationalCategory[];
  onToggleCategoryFilter?: (cat: BuildingOperationalCategory) => void;
  onChangeBuildingCategory?: (
    buildingId: string,
    nextCategory: BuildingOperationalCategory
  ) => void;
  isMapOnly?: boolean;
  onToggleMapOnly?: () => void;
  selectedDateIso?: string;
  onChangeDateIso?: (nextDateIso: string) => void;
  myceliumSnapshot?: MyceliumNetworkSimulationSnapshot;
  hiddenSourceIds?: string[];
  visibleSubstances?: Record<SubstanceKey, boolean>;
  onChangeVisibleSubstances?: (next: Record<SubstanceKey, boolean>) => void;
  showWindNoiseHeatmap?: boolean;
  onToggleWindNoiseHeatmap?: (next?: boolean) => void;
  showPlumeConcentrationHeatmap?: boolean;
  onTogglePlumeConcentrationHeatmap?: (next?: boolean) => void;
  plumeHeatmapPasquillThreshold?: number;
  showWeatherCorrelationHeatmap?: boolean;
  onToggleWeatherCorrelationHeatmap?: (next?: boolean) => void;
  waterMainTelemetry?: WaterMainLiveTelemetry;
  showWaterMainLayer?: boolean;
  onToggleWaterMainLayer?: () => void;
  showLerBuffer?: boolean;
  onToggleLerBuffer?: () => void;
  hasSteelRoadPlates?: boolean;
  onToggleSteelRoadPlates?: () => void;
  simulatedPipeRuptureActive?: boolean;
  onToggleSimulatedPipeRupture?: () => void;
  isS3ValveLockoutActive?: boolean;
  onToggleS3ValveLockout?: () => void;
  onToggleSourceActive?: (id: string) => void;
  onIsolateNearbyMachinery?: () => void;
  onRestoreAllMachinery?: () => void;
  virtualLeakPinPoint?: LatLngPoint | null;
  virtualLeakImpact?: VirtualLeakPinImpact | null;
  onChangeVirtualLeakPinPoint?: (pt: LatLngPoint | null) => void;
  onLogWaterMainObservation?: (
    telemetry: WaterMainLiveTelemetry,
    detailLabel?: string
  ) => void;
  simultaneousDispatch?: SimultaneousAlgedonicDispatch | null;
  onAcknowledgeSimultaneousP1?: () => void;
  onOpenSimultaneousModal?: () => void;
  machineNoiseOutputDb?: number;
}

const RISK_COLORS: Record<
  RiskZoneLevel,
  { stroke: string; fill: string; fillOpacity: number; badgeBg: string }
> = {
  red: {
    stroke: '#ef4444',
    fill: '#ef4444',
    fillOpacity: 0.36,
    badgeBg: 'bg-rose-600 text-white',
  },
  orange: {
    stroke: '#f97316',
    fill: '#f97316',
    fillOpacity: 0.26,
    badgeBg: 'bg-amber-500 text-slate-950',
  },
  yellow: {
    stroke: '#eab308',
    fill: '#eab308',
    fillOpacity: 0.17,
    badgeBg: 'bg-yellow-400 text-slate-950',
  },
  blue: {
    stroke: '#8b5cf6',
    fill: '#6366f1',
    fillOpacity: 0.34,
    badgeBg: 'bg-indigo-600 text-white',
  },
};

interface OutgoingVisualSnapshot {
  signature: string;
  modeDescriptor: string;
  hourLabel: string;
  activePolygons: PlumePolygonZone[];
  isPuffMode: boolean;
  showHeatmapComparison: boolean;
  heatmapComparisonViewMode: HeatmapComparisonViewMode;
  heatmapComparison?: HeatmapComparisonResult;
}

function getDifferenceCellVisualStyle(cell: HeatmapGridCell) {
  const d = cell.deltaS;
  const absNorm = Math.min(1, Math.abs(cell.deltaNormalizedSigned));

  if (d >= 0.4) {
    return {
      fillHex: '#dc2626',
      strokeHex: '#fca5a5',
      svgFill: `rgba(220, 38, 38, ${(0.42 + absNorm * 0.36).toFixed(2)})`,
      svgStroke: 'rgba(252, 165, 165, 0.85)',
      gmpOpacity: Math.min(0.76, 0.42 + absNorm * 0.34),
      badgeLabel: 'Kraftig Stigning (+Δ)',
      textClass: 'text-rose-200',
    };
  }
  if (d >= 0.16) {
    return {
      fillHex: '#f97316',
      strokeHex: '#fdba74',
      svgFill: `rgba(249, 115, 22, ${(0.34 + absNorm * 0.32).toFixed(2)})`,
      svgStroke: 'rgba(253, 186, 116, 0.75)',
      gmpOpacity: Math.min(0.66, 0.32 + absNorm * 0.3),
      badgeLabel: 'Moderat Stigning (+Δ)',
      textClass: 'text-orange-200',
    };
  }
  if (d >= 0.05) {
    return {
      fillHex: '#eab308',
      strokeHex: '#fde047',
      svgFill: `rgba(234, 179, 8, ${(0.24 + absNorm * 0.25).toFixed(2)})`,
      svgStroke: 'rgba(253, 224, 71, 0.6)',
      gmpOpacity: Math.min(0.5, 0.22 + absNorm * 0.24),
      badgeLabel: 'Svag Stigning (+Δ)',
      textClass: 'text-amber-200',
    };
  }
  if (d <= -0.4) {
    return {
      fillHex: '#0284c7',
      strokeHex: '#7dd3fc',
      svgFill: `rgba(2, 132, 199, ${(0.42 + absNorm * 0.36).toFixed(2)})`,
      svgStroke: 'rgba(125, 211, 252, 0.85)',
      gmpOpacity: Math.min(0.76, 0.42 + absNorm * 0.34),
      badgeLabel: 'Kraftigt Fald / Aflastet (−Δ)',
      textClass: 'text-sky-200',
    };
  }
  if (d <= -0.16) {
    return {
      fillHex: '#06b6d4',
      strokeHex: '#67e8f9',
      svgFill: `rgba(6, 182, 212, ${(0.34 + absNorm * 0.32).toFixed(2)})`,
      svgStroke: 'rgba(103, 232, 249, 0.75)',
      gmpOpacity: Math.min(0.66, 0.32 + absNorm * 0.3),
      badgeLabel: 'Moderat Fald (−Δ)',
      textClass: 'text-cyan-200',
    };
  }
  if (d <= -0.05) {
    return {
      fillHex: '#10b981',
      strokeHex: '#6ee7b7',
      svgFill: `rgba(16, 185, 129, ${(0.24 + absNorm * 0.25).toFixed(2)})`,
      svgStroke: 'rgba(110, 231, 183, 0.6)',
      gmpOpacity: Math.min(0.5, 0.22 + absNorm * 0.24),
      badgeLabel: 'Svagt Fald (−Δ)',
      textClass: 'text-emerald-200',
    };
  }
  return {
    fillHex: '#475569',
    strokeHex: '#94a3b8',
    svgFill: 'rgba(71, 85, 105, 0.14)',
    svgStroke: 'rgba(148, 163, 184, 0.22)',
    gmpOpacity: 0.14,
    badgeLabel: 'Uændret (~0)',
    textClass: 'text-slate-300',
  };
}

const DispersionMapComponent: React.FC<DispersionMapProps> = ({
  sources,
  receptors,
  plumeZones,
  receptorExposures,
  currentWeather,
  isPuffMode,
  puff24h,
  observations,
  selectedObservationId,
  pendingObservationPoint,
  onSelectObservation,
  selectedSourceId,
  selectedReceptorId,
  onSelectSource,
  onSelectReceptor,
  mapClickMode,
  onSetMapClickMode,
  onMapAddNode,
  onSelectHourFromPeak,
  isAnimatingPlumeRoute = false,
  plumeRouteProgress = 13,
  onToggleAnimatePlumeRoute,
  showHeatmapComparison = false,
  onToggleHeatmapComparison,
  heatmapComparison,
  heatmapComparisonViewMode: externalComparisonViewMode,
  onChangeHeatmapComparisonViewMode,
  weatherHours = [],
  comparisonHourAIndex = 8,
  comparisonHourBIndex = 13,
  onChangeComparisonHourA,
  onChangeComparisonHourB,
  isFullscreen = false,
  onToggleFullscreen,
  fullscreenLabel,
  onSaveMapSnapshotObservation,
  buildings = RINGPARKEN_MASTER_BUILDINGS,
  activeCategoryFilters = [
    'a_inhabited',
    'b_vacant',
    'c_under_renovation',
    'd_under_demolition',
    'e_demolished_unsecured',
  ],
  onToggleCategoryFilter,
  onChangeBuildingCategory,
  isMapOnly,
  onToggleMapOnly,
  selectedDateIso,
  onChangeDateIso,
  myceliumSnapshot,
  hiddenSourceIds = [],
  visibleSubstances: externalVisibleSubstances,
  onChangeVisibleSubstances,
  showWindNoiseHeatmap: externalShowWindNoiseHeatmap,
  onToggleWindNoiseHeatmap,
  showPlumeConcentrationHeatmap: externalShowPlumeConcentrationHeatmap,
  onTogglePlumeConcentrationHeatmap,
  plumeHeatmapPasquillThreshold = 0.25,
  showWeatherCorrelationHeatmap: externalShowWeatherCorrelationHeatmap,
  onToggleWeatherCorrelationHeatmap,
  waterMainTelemetry,
  showWaterMainLayer = false,
  onToggleWaterMainLayer,
  showLerBuffer = true,
  onToggleLerBuffer,
  hasSteelRoadPlates = false,
  onToggleSteelRoadPlates,
  simulatedPipeRuptureActive = false,
  onToggleSimulatedPipeRupture,
  isS3ValveLockoutActive = false,
  onToggleS3ValveLockout,
  onToggleSourceActive,
  onIsolateNearbyMachinery,
  onRestoreAllMachinery,
  virtualLeakPinPoint,
  virtualLeakImpact,
  onChangeVirtualLeakPinPoint,
  onLogWaterMainObservation,
  simultaneousDispatch,
  onAcknowledgeSimultaneousP1,
  onOpenSimultaneousModal,
  machineNoiseOutputDb = 114,
}) => {
  const [internalMapOnly, setInternalMapOnly] = useState<boolean>(false);
  const effectiveMapOnly = isMapOnly !== undefined ? isMapOnly : internalMapOnly;
  const handleToggleMapOnly = () => {
    if (onToggleMapOnly) {
      onToggleMapOnly();
    } else {
      setInternalMapOnly((prev) => !prev);
    }
  };

  useEffect(() => {
    if (!internalMapOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInternalMapOnly(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [internalMapOnly]);

  const hiddenSourceSet = useMemo(() => new Set(hiddenSourceIds), [hiddenSourceIds]);
  const visibleSources = useMemo(
    () => sources.filter((s) => !hiddenSourceSet.has(s.id)),
    [sources, hiddenSourceSet]
  );

  const [selectedPopupBuildingId, setSelectedPopupBuildingId] = useState<string | null>(null);
  const [showWaterMainInspector, setShowWaterMainInspector] = useState<boolean>(false);
  const [showWaterMainSankeyInInspector, setShowWaterMainSankeyInInspector] = useState<boolean>(false);
  const [selectedWaterMainSectionId, setSelectedWaterMainSectionId] = useState<string>('');
  const [waterMainCsvExportedJustNow, setWaterMainCsvExportedJustNow] = useState<boolean>(false);
  const [waterMainLoggedJustNow, setWaterMainLoggedJustNow] = useState<boolean>(false);
  const [isLeakPinDropMode, setIsLeakPinDropMode] = useState<boolean>(false);
  const [localVirtualLeakPinPoint, setLocalVirtualLeakPinPoint] = useState<LatLngPoint | null>(null);
  const [isolatedMachineryJustNow, setIsolatedMachineryJustNow] = useState<boolean>(false);
  const [eStopToastData, setEStopToastData] = useState<{
    id: number;
    isolatedCodes: string[];
    totalStoppedCount: number;
    triggeredAtLabel: string;
    ppvBeforeMmPerSec: number;
  } | null>(null);
  const eStopFeedbackTimerRef = useRef<number | null>(null);
  const eStopToastTimerRef = useRef<number | null>(null);
  const [showHighWindCorrelationHud, setShowHighWindCorrelationHud] = useState<boolean>(true);
  const [showSource85DbWavefronts, setShowSource85DbWavefronts] = useState<boolean>(true);
  const [showEvacuationFlowAnimation, setShowEvacuationFlowAnimation] = useState<boolean>(true);
  const [showWeatherCorrelationHud, setShowWeatherCorrelationHud] = useState<boolean>(true);
  const visibleBuildings = useMemo(
    () => buildings.filter((b) => activeCategoryFilters.includes(b.category)),
    [buildings, activeCategoryFilters]
  );
  const rawApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const hasConfiguredGoogleKey =
    Boolean(rawApiKey) &&
    rawApiKey !== 'YOUR_API_KEY' &&
    rawApiKey !== 'MY_GOOGLE_MAPS_API_KEY';

  const [gmpAuthFailed, setGmpAuthFailed] = useState(false);
  const [preferTacticalCanvas, setPreferTacticalCanvas] = useState(true);
  const [showWindParticles, setShowWindParticles] = useState(true);
  const [showWebGlDustPlume, setShowWebGlDustPlume] = useState(true);
  const [weatherJsonExportedJustNow, setWeatherJsonExportedJustNow] = useState(false);

  const handleExportSelectedDayWeatherJson = () => {
    const dateIso = currentWeather.isoTime ? currentWeather.isoTime.slice(0, 10) : puff24h.dateIso;
    const hoursToExport = weatherHours.length > 0 ? weatherHours : [currentWeather];
    const payload = {
      metadata: {
        title: 'Ringparken 24-Timers Meteorologisk & Vej-/Receptor-Datasæt (JSON Eksport)',
        location: 'Ringparken / Schackenborgvænget, 4200 Slagelse',
        coordinates: { lat: 55.4128, lng: 11.3533 },
        dateIso,
        selectedHourIndex: currentWeather.hourIndex,
        selectedHourLabel: currentWeather.hourLabel,
        exportedAtIso: new Date().toISOString(),
      },
      summary24h: {
        maxWindSpeed10mMs: Math.max(...hoursToExport.map((h) => h.windSpeed10m)),
        maxWindGusts10mMs: Math.max(...hoursToExport.map((h) => h.windGusts10m)),
        meanWindSpeed10mMs: Number(
          (
            hoursToExport.reduce((acc, h) => acc + h.windSpeed10m, 0) /
            Math.max(1, hoursToExport.length)
          ).toFixed(2)
        ),
        totalPrecipitationMm: Number(
          hoursToExport.reduce((acc, h) => acc + h.precipitation, 0).toFixed(2)
        ),
        dominantWindSectorText: puff24h.dominantWindSectorText,
      },
      hours: hoursToExport.map((h) => ({
        ...h,
        plumeDirectionDeg: (h.windDirection10m + 180) % 360,
        thermalStackDeltaPsPaAt12m: Number(
          Math.max(0, 3460 * (1 / (h.temperature2m + 273.15) - 1 / (22.5 + 273.15)) * 12.0).toFixed(2)
        ),
      })),
      roadAndReceptorExposures: receptorExposures,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ringparken-vejrdata-${dateIso}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setWeatherJsonExportedJustNow(true);
    window.setTimeout(() => setWeatherJsonExportedJustNow(false), 3500);
  };
  const [showAsbestosRiskLayer, setShowAsbestosRiskLayer] = useState(true);
  const [internalVisibleSubstances, setInternalVisibleSubstances] = useState<
    Record<SubstanceKey, boolean>
  >({
    asbestos: true,
    heavyMetals: true,
    pcb: true,
    quartzWool: true,
    moldSewer: true,
  });
  const visibleDispersionSubstances = externalVisibleSubstances ?? internalVisibleSubstances;
  const setVisibleDispersionSubstances = (
    updater:
      | Record<SubstanceKey, boolean>
      | ((prev: Record<SubstanceKey, boolean>) => Record<SubstanceKey, boolean>)
  ) => {
    const next =
      typeof updater === 'function' ? updater(visibleDispersionSubstances) : updater;
    if (onChangeVisibleSubstances) {
      onChangeVisibleSubstances(next);
    } else {
      setInternalVisibleSubstances(next);
    }
  };
  const [isLayerControlExpanded, setIsLayerControlExpanded] = useState<boolean>(true);
  const [showGroundwaterLeachingWarning, setShowGroundwaterLeachingWarning] = useState(true);
  const [leachingSimMode, setLeachingSimMode] = useState<'live' | 'saturated_rain' | 'cloudburst'>('live');
  const [isLeachingCardMinimized, setIsLeachingCardMinimized] = useState(false);
  const [showHourlyPuffLobes, setShowHourlyPuffLobes] = useState(true);
  const [showReceptorLabels, setShowReceptorLabels] = useState(true);
  const [isComparisonCardCollapsed, setIsComparisonCardCollapsed] = useState(false);
  const [internalComparisonViewMode, setInternalComparisonViewMode] =
    useState<HeatmapComparisonViewMode>('difference');
  const [differenceMetric, setDifferenceMetric] =
    useState<DifferenceHeatmapMetric>('sum_quotient');
  const [inspectedDiffCellId, setInspectedDiffCellId] = useState<string | null>(null);
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);

  // 6-Hour Dust Drift Forecast 2D Animation State (+0t to +6t)
  const [show6hDustForecast, setShow6hDustForecast] = useState<boolean>(true);
  const [isPlaying6hDustForecast, setIsPlaying6hDustForecast] = useState<boolean>(true);
  const [forecast6hProgress, setForecast6hProgress] = useState<number>(0);
  const [forecast6hSpeed, setForecast6hSpeed] = useState<'0.5x' | '1x' | '2x'>('1x');
  const [is6hForecastCardMinimized, setIs6hForecastCardMinimized] = useState<boolean>(false);
  const [puffWavePhase, setPuffWavePhase] = useState<number>(0);
  const [showVibrationHeatmap, setShowVibrationHeatmap] = useState<boolean>(true);

  const heatmapComparisonViewMode: HeatmapComparisonViewMode =
    externalComparisonViewMode ?? internalComparisonViewMode;
  const isDifferenceHeatmapMode =
    showHeatmapComparison && heatmapComparisonViewMode === 'difference';

  const handleSetComparisonViewMode = (mode: HeatmapComparisonViewMode) => {
    setInternalComparisonViewMode(mode);
    onChangeHeatmapComparisonViewMode?.(mode);
  };

  // Interactive Tactical Canvas pan & zoom state
  const [zoom, setZoom] = useState<number>(17);
  const [panOffsetPx, setPanOffsetPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [cursorLatLng, setCursorLatLng] = useState<LatLngPoint>(RINGPARKEN_CENTER);
  const [pdfExportedJustNow, setPdfExportedJustNow] = useState(false);
  const [pngExportedJustNow, setPngExportedJustNow] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [mapSnapshotSavedJustNow, setMapSnapshotSavedJustNow] = useState(false);
  const [lastMapSnapshotSummary, setLastMapSnapshotSummary] = useState<{
    zoom: number;
    boundsText: string;
    layersText: string;
    timestampLabel: string;
  } | null>(null);
  const [activeHeatmapLayerMode, setActiveHeatmapLayerMode] =
    useState<TacticalHeatmapLayerMode>('asbestos');
  const [isHeatmapLayerMenuOpen, setIsHeatmapLayerMenuOpen] = useState(false);
  const [show24hParticleAccumulationHeatmap, setShow24hParticleAccumulationHeatmap] =
    useState<boolean>(false);
  const [fittedToReceptorsJustNow, setFittedToReceptorsJustNow] = useState(false);
  const [fittedReceptorBounds, setFittedReceptorBounds] = useState<{
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    centerLat: number;
    centerLng: number;
  } | null>(null);
  const [gmpCenter, setGmpCenter] = useState<LatLngPoint>(RINGPARKEN_CENTER);
  const [gmpViewKey, setGmpViewKey] = useState<number>(0);

  const [isHighWindBannerMinimized, setIsHighWindBannerMinimized] = useState(false);

  // Frigiv (detach to floating draggable window) & Minimer (collapse) state for all Map Windows & Heatmaps
  const [mapWindowStates, setMapWindowStates] = useState<
    Record<MapOverlayWindowId, MapOverlayWindowState>
  >({
    wind_hud: { isMinimized: false, isReleased: false, x: 24, y: 76, zIndex: 90 },
    asbestos_risk_heatmap: { isMinimized: false, isReleased: false, x: 520, y: 110, zIndex: 91 },
    groundwater_leaching_heatmap: {
      isMinimized: false,
      isReleased: false,
      x: 36,
      y: 360,
      zIndex: 92,
    },
    heatmap_comparison: { isMinimized: false, isReleased: false, x: 48, y: 120, zIndex: 93 },
    puff_24h_peak_heatmap: { isMinimized: false, isReleased: false, x: 48, y: 125, zIndex: 94 },
    forecast_6h_heatmap: { isMinimized: false, isReleased: false, x: 490, y: 340, zIndex: 95 },
    high_wind_notification: { isMinimized: false, isReleased: false, x: 460, y: 260, zIndex: 96 },
    map_legend_heatmap_key: { isMinimized: false, isReleased: false, x: 36, y: 540, zIndex: 97 },
    mycelium_alert_center: { isMinimized: false, isReleased: false, x: 52, y: 150, zIndex: 98 },
  });
  const topMapWindowZRef = useRef(105);

  const handleFocusMapWindow = (id: MapOverlayWindowId) => {
    topMapWindowZRef.current += 1;
    const nextZ = topMapWindowZRef.current;
    setMapWindowStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], zIndex: nextZ },
    }));
  };

  const handleToggleMapWindowMinimize = (id: MapOverlayWindowId) => {
    setMapWindowStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: !prev[id].isMinimized },
    }));
  };

  const handleToggleMapWindowRelease = (id: MapOverlayWindowId) => {
    topMapWindowZRef.current += 1;
    const nextZ = topMapWindowZRef.current;
    setMapWindowStates((prev) => {
      const curr = prev[id];
      const nextReleased = !curr.isReleased;
      const clampedX = Math.max(
        16,
        Math.min(typeof window !== 'undefined' ? window.innerWidth - 460 : 800, curr.x)
      );
      const clampedY = Math.max(
        56,
        Math.min(typeof window !== 'undefined' ? window.innerHeight - 240 : 600, curr.y)
      );
      return {
        ...prev,
        [id]: {
          ...curr,
          isReleased: nextReleased,
          isMinimized: false,
          x: clampedX,
          y: clampedY,
          zIndex: nextZ,
        },
      };
    });
  };

  const handleMoveMapWindow = (id: MapOverlayWindowId, x: number, y: number) => {
    setMapWindowStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], x, y },
    }));
  };

  const handleMinimizeAllMapWindows = () => {
    setMapWindowStates((prev) => {
      const next = { ...prev };
      (Object.keys(next) as MapOverlayWindowId[]).forEach((k) => {
        next[k] = { ...next[k], isMinimized: true };
      });
      return next;
    });
  };

  const handleRestoreAllMapWindows = () => {
    setMapWindowStates((prev) => {
      const next = { ...prev };
      (Object.keys(next) as MapOverlayWindowId[]).forEach((k) => {
        next[k] = { ...next[k], isMinimized: false, isReleased: false };
      });
      return next;
    });
  };

  const isHighWindAlert = currentWeather.windSpeed10m > 10;
  const [showAutonomousMesh, setShowAutonomousMesh] = useState<boolean>(true);
  const [showMapBlockPressureWaves, setShowMapBlockPressureWaves] = useState<boolean>(true);
  const [showComplaintDensityOverlay, setShowComplaintDensityOverlay] = useState<boolean>(true);
  const [complaintDensityFilterMode, setComplaintDensityFilterMode] =
    useState<ComplaintDensityFilterMode>('all');
  const [complaintDensityOpacityPct, setComplaintDensityOpacityPct] = useState<number>(68);
  const [internalShowWindNoiseHeatmapLayer, setInternalShowWindNoiseHeatmapLayer] =
    useState<boolean>(false);
  const showWindNoiseHeatmapLayer =
    externalShowWindNoiseHeatmap !== undefined
      ? externalShowWindNoiseHeatmap
      : internalShowWindNoiseHeatmapLayer;
  const setShowWindNoiseHeatmapLayer = (
    updater: boolean | ((prev: boolean) => boolean)
  ) => {
    const nextVal =
      typeof updater === 'function' ? updater(showWindNoiseHeatmapLayer) : updater;
    if (onToggleWindNoiseHeatmap) {
      onToggleWindNoiseHeatmap(nextVal);
    } else {
      setInternalShowWindNoiseHeatmapLayer(nextVal);
    }
  };
  const [internalShowPlumeConcentrationHeatmap, setInternalShowPlumeConcentrationHeatmap] =
    useState<boolean>(false);
  const showPlumeConcentrationHeatmapLayer =
    externalShowPlumeConcentrationHeatmap !== undefined
      ? externalShowPlumeConcentrationHeatmap
      : internalShowPlumeConcentrationHeatmap;
  const setShowPlumeConcentrationHeatmapLayer = (
    updater: boolean | ((prev: boolean) => boolean)
  ) => {
    const nextVal =
      typeof updater === 'function' ? updater(showPlumeConcentrationHeatmapLayer) : updater;
    if (onTogglePlumeConcentrationHeatmap) {
      onTogglePlumeConcentrationHeatmap(nextVal);
    } else {
      setInternalShowPlumeConcentrationHeatmap(nextVal);
    }
  };
  const [internalShowWeatherCorrelationHeatmap, setInternalShowWeatherCorrelationHeatmap] =
    useState<boolean>(true);
  const showWeatherCorrelationHeatmapLayer =
    externalShowWeatherCorrelationHeatmap !== undefined
      ? externalShowWeatherCorrelationHeatmap
      : internalShowWeatherCorrelationHeatmap;
  const setShowWeatherCorrelationHeatmapLayer = (
    updater: boolean | ((prev: boolean) => boolean)
  ) => {
    const nextVal =
      typeof updater === 'function'
        ? updater(showWeatherCorrelationHeatmapLayer)
        : updater;
    if (onToggleWeatherCorrelationHeatmap) {
      onToggleWeatherCorrelationHeatmap(nextVal);
    } else {
      setInternalShowWeatherCorrelationHeatmap(nextVal);
    }
  };
  const [overrideNoiseWindFromDeg, setOverrideNoiseWindFromDeg] = useState<number | null>(null);

  const effectiveNoiseWindFromDeg = overrideNoiseWindFromDeg ?? currentWeather.windDirection10m;
  const windDirectionalNoiseCells = useMemo(
    () =>
      computeWindDirectionalNoiseCells({
        sources,
        receptors,
        windFromDeg: effectiveNoiseWindFromDeg,
        windSpeedMs: currentWeather.windSpeed10m,
        windGustMs: currentWeather.windGusts10m,
      }),
    [
      sources,
      receptors,
      effectiveNoiseWindFromDeg,
      currentWeather.windSpeed10m,
      currentWeather.windGusts10m,
    ]
  );

  useEffect(() => {
    const onMinHud = () => {
      handleMinimizeAllMapWindows();
    };
    const onResHud = () => {
      handleRestoreAllMapWindows();
    };
    window.addEventListener('ringparken-minimize-map-hud-overlays', onMinHud);
    window.addEventListener('ringparken-restore-map-hud-overlays', onResHud);
    return () => {
      window.removeEventListener('ringparken-minimize-map-hud-overlays', onMinHud);
      window.removeEventListener('ringparken-restore-map-hud-overlays', onResHud);
    };
  }, []);

  const complaintDensitySummary = useMemo(
    () =>
      computeNeighborComplaintBlockDensity({
        observations,
        sources,
        receptors,
        buildings,
        filterMode: complaintDensityFilterMode,
      }),
    [observations, sources, receptors, buildings, complaintDensityFilterMode]
  );

  const handleFocusComplaintDensityItem = (item: BlockComplaintDensityItem) => {
    setGmpCenter(item.center);
    setZoom((z) => Math.max(z, 17.6));
    setPanOffsetPx({ x: 0, y: 0 });
    if (item.linkedSourceId) {
      onSelectSource(item.linkedSourceId);
    } else if (item.linkedReceptorId) {
      onSelectReceptor(item.linkedReceptorId);
    }
  };

  const autonomousMesh = useMemo(
    () =>
      buildAutonomousReceptorMeshNetwork({
        receptors,
        sources,
        receptorExposures,
        observations,
        currentWeather,
      }),
    [receptors, sources, receptorExposures, observations, currentWeather]
  );

  // System B Mycelienetværk: Biokybernetisk Simulering, ISA-18.2 Hysterese & Scrubbing-Sikret Live Varsling
  const [showMyceliumAlertCenter, setShowMyceliumAlertCenter] = useState<boolean>(false);
  const [isFormulaSimulatorOpen, setIsFormulaSimulatorOpen] = useState<boolean>(false);
  const [myceliumScenario, setMyceliumScenario] =
    useState<MyceliumSimulationScenario>('live_telemetry');
  const [manualCraterNodeIds, setManualCraterNodeIds] = useState<string[]>([]);
  const [manualSpoofNodeIds, setManualSpoofNodeIds] = useState<string[]>([]);
  const [realitySummitOverride, setRealitySummitOverride] = useState<boolean>(false);
  const myceliumAiHistoryRef = useRef<number[]>([0.92, 0.89, 0.87]);

  const myceliumSimState = useMemo(
    () =>
      simulateMyceliumNetwork({
        receptors,
        sources,
        receptorExposures,
        observations,
        currentWeather,
        scenario: myceliumScenario,
        manualCraterNodeIds,
        manualSpoofNodeIds,
        previousAiHistory: myceliumAiHistoryRef.current,
        realitySummitOverride,
      }),
    [
      receptors,
      sources,
      receptorExposures,
      observations,
      currentWeather,
      myceliumScenario,
      manualCraterNodeIds,
      manualSpoofNodeIds,
      realitySummitOverride,
    ]
  );

  useEffect(() => {
    myceliumAiHistoryRef.current = myceliumSimState.aiHistory;
  }, [myceliumSimState.aiHistory]);

  const handleFocusMyceliumNode = (nodeId: string) => {
    const targetRec = receptors.find((r) => r.id === nodeId);
    if (targetRec) {
      setGmpCenter(targetRec.center);
      setZoom((z) => Math.max(z, 17.6));
      setPanOffsetPx({ x: 0, y: 0 });
      onSelectReceptor(targetRec.id);
    }
  };

  const myceliumLiveAlerts = useMyceliumLiveAlerts({
    simulationState: myceliumSimState,
    snapshot: myceliumSnapshot,
    currentWeather,
    dateIso: selectedDateIso || puff24h.dateIso,
    selectedHourIndex: currentWeather.hourIndex,
    timelineProgress: (plumeRouteProgress ?? 0) + forecast6hProgress,
    isPlayingTimeline: Boolean(isAnimatingPlumeRoute) || isPlaying6hDustForecast,
    onFocusNodeOnMap: handleFocusMyceliumNode,
  });

  const myceliumScrubMountedRef = useRef<boolean>(false);
  const notifyTimelineScrubFn = myceliumLiveAlerts.notifyTimelineScrub;
  useEffect(() => {
    if (!myceliumScrubMountedRef.current) {
      myceliumScrubMountedRef.current = true;
      return;
    }
    notifyTimelineScrubFn();
  }, [
    currentWeather.hourIndex,
    selectedDateIso,
    forecast6hProgress,
    plumeRouteProgress,
    comparisonHourAIndex,
    comparisonHourBIndex,
    notifyTimelineScrubFn,
  ]);

  // CSS pressure-wave animation per neighbor block on Ringparken map is specifically activated when windSpeed10m > 10 m/s
  const isMapBlockPressureWaveActive = isHighWindAlert && showMapBlockPressureWaves;

  const mapWaveSpeedTierClass =
    currentWeather.windSpeed10m >= 14
      ? 'map-block-wave-fast'
      : currentWeather.windSpeed10m >= 12
      ? 'map-block-wave-med'
      : 'map-block-wave-std';

  const neighborBlockPressureTargets = useMemo(() => {
    const residentialOrCustom = receptors.filter(
      (r) => r.category === 'residential_block' || r.category === 'custom_receptor'
    );
    const targetReceptors = residentialOrCustom.length > 0 ? residentialOrCustom : receptors;
    return targetReceptors.map((rec) => {
      const node = autonomousMesh.nodesByReceptorId[rec.id];
      const complaintCount = node?.matchedObservations.length ?? 0;
      const estimatedLafmaxDb = node?.estimatedLafmaxDb ?? 74;
      const sumQ = node?.sumQuotient ?? 0;
      const isCriticalImpulse =
        complaintCount > 0 || estimatedLafmaxDb >= 80 || sumQ >= 1.0;
      return {
        receptor: rec,
        node,
        complaintCount,
        estimatedLafmaxDb,
        sumQ,
        isCriticalImpulse,
      };
    });
  }, [receptors, autonomousMesh]);

  const firstHighWindHourInDataset = useMemo(() => {
    if (!weatherHours || weatherHours.length === 0) return null;
    const highWindHours = weatherHours.filter((h) => h.windSpeed10m > 10);
    if (highWindHours.length === 0) return null;
    return highWindHours.reduce((best, curr) =>
      curr.windSpeed10m > best.windSpeed10m ? curr : best
    );
  }, [weatherHours]);

  const top3ReceptorExposures = useMemo(
    () => [...receptorExposures].sort((a, b) => b.sumQuotient - a.sumQuotient).slice(0, 3),
    [receptorExposures]
  );

  const highWindRankByReceptorId = useMemo(() => {
    const rankMap: Record<string, number> = {};
    if (isHighWindAlert) {
      top3ReceptorExposures.forEach((exp, idx) => {
        rankMap[exp.receptorId] = idx + 1;
      });
    }
    return rankMap;
  }, [isHighWindAlert, top3ReceptorExposures]);

  const computeGeoMeters = (a: LatLngPoint, b: LatLngPoint): number => {
    const dLat = (b.lat - a.lat) * 111320;
    const dLng = (b.lng - a.lng) * 63180;
    return Math.hypot(dLat, dLng);
  };

  // Item 6: > 85 dB acoustic wavefront propagation from active demolition sources into 'støj-følsomme' neighbor zones
  const sourceWavefrontTargets = useMemo(() => {
    const sensitiveReceptors = receptors.filter(
      (r) =>
        r.category === 'residential_block' ||
        r.category === 'custom_receptor' ||
        /skole|børnehave|daginst/i.test(r.name)
    );
    const activeSrcList = visibleSources.filter((s) => s.active);
    const windDownwindDeg = (currentWeather.windDirection10m + 180) % 360;
    const gustBonusDb = Math.max(0, (currentWeather.windGusts10m - 6) * 0.42);
    const effectiveLwa = Math.max(85, machineNoiseOutputDb || 114);

    return activeSrcList
      .map((src) => {
        const hits = sensitiveReceptors
          .map((rec) => {
            const dLatM = (rec.center.lat - src.position.lat) * 111320;
            const dLngM = (rec.center.lng - src.position.lng) * 63180;
            const distM = Math.max(8, Math.hypot(dLatM, dLngM));
            if (distM > 280) return null;

            const bearingDeg = ((Math.atan2(dLngM, dLatM) * 180) / Math.PI + 360) % 360;
            const angleDiff = Math.abs(((bearingDeg - windDownwindDeg + 540) % 360) - 180);
            const downwindFactor = Math.max(0, Math.cos((angleDiff * Math.PI) / 180));
            const estimatedLafmaxDb = Number(
              (
                effectiveLwa -
                20 * Math.log10(distM) -
                6.5 +
                downwindFactor * (2.5 + gustBonusDb)
              ).toFixed(1)
            );
            return {
              receptor: rec,
              distMeters: Math.round(distM),
              estimatedLafmaxDb,
              exceeds85Db: estimatedLafmaxDb > 85,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null && item.exceeds85Db)
          .sort((a, b) => b.estimatedLafmaxDb - a.estimatedLafmaxDb);

        const peakLafmaxDb =
          hits[0]?.estimatedLafmaxDb ??
          Number((effectiveLwa - 24 + gustBonusDb).toFixed(1));
        return {
          source: src,
          peakLafmaxDb,
          exceeds85Db: hits.length > 0 || peakLafmaxDb > 85,
          impactedReceptors: hits.slice(0, 4),
        };
      })
      .filter((entry) => entry.exceeds85Db && entry.impactedReceptors.length > 0);
  }, [
    receptors,
    visibleSources,
    currentWeather.windDirection10m,
    currentWeather.windGusts10m,
    machineNoiseOutputDb,
  ]);

  // Item 7: High-Wind Dispersion Correlation (triggered when windGusts10m > 12 m/s)
  const isHighGustAlert = currentWeather.windGusts10m > 12;
  const firstHighGustHourInDataset = useMemo(() => {
    if (!weatherHours || weatherHours.length === 0) return null;
    const matches = weatherHours.filter((h) => h.windGusts10m > 12);
    if (matches.length === 0) return null;
    return matches.reduce((best, curr) =>
      curr.windGusts10m > best.windGusts10m ? curr : best
    );
  }, [weatherHours]);

  const highGustPearsonR = useMemo(() => {
    if (!weatherHours || weatherHours.length < 3) return null;
    const series = weatherHours.map((h) => {
      const gust = h.windGusts10m;
      const suspensionFlux = Number(
        (0.32 * Math.pow(Math.max(1, gust) / 10, 1.45) + h.windSpeed10m * 0.038).toFixed(3)
      );
      return { gust, suspensionFlux };
    });
    const n = series.length;
    const meanX = series.reduce((acc, p) => acc + p.gust, 0) / n;
    const meanY = series.reduce((acc, p) => acc + p.suspensionFlux, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (const p of series) {
      const dx = p.gust - meanX;
      const dy = p.suspensionFlux - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const denom = Math.sqrt(denX * denY);
    return denom > 1e-6 ? Number((num / denom).toFixed(3)) : 0;
  }, [weatherHours]);

  const highGustCorrelationData = useMemo(() => {
    const pearsonR =
      highGustPearsonR ??
      (() => {
        const gust = currentWeather.windGusts10m;
        const _flux = 0.32 * Math.pow(Math.max(1, gust) / 10, 1.45) + currentWeather.windSpeed10m * 0.038;
        return _flux > 0 ? 0.91 : 0;
      })();

    const windDownwindDeg = (currentWeather.windDirection10m + 180) % 360;
    const primarySource = visibleSources.find((s) => s.active) ?? visibleSources[0];
    const rankedReceptors = [...receptors]
      .map((rec) => {
        const exp = receptorExposures.find((e) => e.receptorId === rec.id);
        const sVal = exp?.sumQuotient ?? 0;
        let alignment = 0.5;
        if (primarySource) {
          const dLatM = (rec.center.lat - primarySource.position.lat) * 111320;
          const dLngM = (rec.center.lng - primarySource.position.lng) * 63180;
          const bearingDeg = ((Math.atan2(dLngM, dLatM) * 180) / Math.PI + 360) % 360;
          const diff = Math.abs(((bearingDeg - windDownwindDeg + 540) % 360) - 180);
          alignment = Math.max(0, Math.cos((diff * Math.PI) / 180));
        }
        const gustScore = sVal * (0.7 + alignment * 0.85) * (currentWeather.windGusts10m / 12);
        return {
          receptor: rec,
          sumQuotient: sVal,
          downwindAlignmentPct: Math.round(alignment * 100),
          gustImpactScore: Number(gustScore.toFixed(2)),
        };
      })
      .sort((a, b) => b.gustImpactScore - a.gustImpactScore)
      .slice(0, 4);

    return {
      pearsonR,
      affectedReceptors: rankedReceptors,
      affectedReceptorIds: new Set(rankedReceptors.map((r) => r.receptor.id)),
      maxGustMs: currentWeather.windGusts10m,
    };
  }, [
    highGustPearsonR,
    currentWeather,
    receptors,
    receptorExposures,
    visibleSources,
  ]);

  // Item 3: Vejr-Korrelations Heatmap (6-hour rolling correlation between wind gusts and dust deposition S-quotient > 0.8)
  const weatherCorrelationHeatmapData = useMemo(() => {
    const allHours = weatherHours.length > 0 ? weatherHours : [currentWeather];
    const hourLen = allHours.length;
    const endIdx = Math.max(
      0,
      Math.min(
        hourLen - 1,
        allHours.findIndex((h) => h.hourIndex === currentWeather.hourIndex) >= 0
          ? allHours.findIndex((h) => h.hourIndex === currentWeather.hourIndex)
          : currentWeather.hourIndex % hourLen
      )
    );
    const windowSize = Math.min(6, hourLen);
    const window6h: HourlyWeatherPoint[] = [];
    for (let offset = windowSize - 1; offset >= 0; offset--) {
      const idx = (endIdx - offset + hourLen) % hourLen;
      window6h.push(allHours[idx]);
    }

    const activeSources = visibleSources.filter((s) => s.active);
    const gustSeries = window6h.map((h) => h.windGusts10m);
    const meanGust =
      gustSeries.reduce((acc, v) => acc + v, 0) / Math.max(1, gustSeries.length);

    const receptorCorrelations = receptors.map((rec) => {
      const sSeries = window6h.map(
        (hr) => evaluateReceptorAtHour(rec, activeSources, hr).sumQuotient
      );
      const meanS =
        sSeries.reduce((acc, v) => acc + v, 0) / Math.max(1, sSeries.length);
      const maxS6h = sSeries.reduce((m, v) => Math.max(m, v), 0);
      const currentS = sSeries[sSeries.length - 1] ?? 0;

      let num = 0;
      let denG = 0;
      let denS = 0;
      for (let i = 0; i < window6h.length; i++) {
        const dg = gustSeries[i] - meanGust;
        const ds = sSeries[i] - meanS;
        num += dg * ds;
        denG += dg * dg;
        denS += ds * ds;
      }
      const denom = Math.sqrt(denG * denS);
      const pearsonR = denom > 1e-8 ? Number((num / denom).toFixed(3)) : 0;
      const isHighCorrelation = pearsonR > 0.8 && maxS6h > 0.01;

      return {
        receptor: rec,
        pearsonR,
        maxS6h: Number(maxS6h.toFixed(2)),
        currentS: Number(currentS.toFixed(2)),
        meanS6h: Number(meanS.toFixed(2)),
        isHighCorrelation,
      };
    });

    const highlightedAreas = receptorCorrelations
      .filter((item) => item.isHighCorrelation)
      .sort((a, b) => b.pearsonR - a.pearsonR || b.maxS6h - a.maxS6h);

    const highlightedReceptorIds = new Set(
      highlightedAreas.map((a) => a.receptor.id)
    );

    const highlightedBuildingIds = new Set<string>();
    visibleBuildings.forEach((b) => {
      const recId = getReceptorIdForBuilding(b.id);
      if (highlightedReceptorIds.has(recId)) {
        highlightedBuildingIds.add(b.id);
      }
    });

    const maxGust6h = gustSeries.reduce((m, v) => Math.max(m, v), 0);
    const windowStartLabel = window6h[0]?.hourLabel ?? currentWeather.hourLabel;
    const windowEndLabel =
      window6h[window6h.length - 1]?.hourLabel ?? currentWeather.hourLabel;

    return {
      windowStartLabel,
      windowEndLabel,
      maxGust6h: Number(maxGust6h.toFixed(1)),
      allCorrelations: receptorCorrelations,
      highlightedAreas,
      highlightedReceptorIds,
      highlightedBuildingIds,
    };
  }, [weatherHours, currentWeather, visibleSources, receptors, visibleBuildings]);

  // Item 8: Dynamic 'Emergency Evacuation Flow' with evacuation speed (m/s) derived from elevation slope & local dust plume density
  const evacuationFlowSegments = useMemo(() => {
    const estimateElevationMoh = (pt: LatLngPoint): number => {
      // Kierulffsvej west (~33.4 m.o.h.) rising east toward Rosenkildevej (~36.1 m.o.h.) & south toward Valbyvej (~35.4 m.o.h.)
      const eastDelta = (pt.lng - 11.3514) * 320;
      const southDelta = (55.4148 - pt.lat) * 280;
      return Number((33.4 + eastDelta + southDelta * 0.45).toFixed(1));
    };

    const estimateLocalPlumeDensity = (mid: LatLngPoint): number => {
      let peakS = 0.25;
      for (const exp of receptorExposures) {
        const rec = receptors.find((r) => r.id === exp.receptorId);
        if (!rec) continue;
        const dM = computeGeoMeters(mid, rec.center);
        const weight = Math.max(0.15, 1 - dM / 180);
        peakS = Math.max(peakS, exp.sumQuotient * weight);
      }
      return Number(Math.min(2.4, peakS).toFixed(2));
    };

    const baseCorridors: Array<{
      id: string;
      streetName: string;
      origin: LatLngPoint;
      target: LatLngPoint;
    }> =
      simultaneousDispatch?.active &&
      simultaneousDispatch.system1State.escapeVectors.length > 0
        ? simultaneousDispatch.system1State.escapeVectors.map((vec) => ({
            id: vec.id,
            streetName: vec.streetName,
            origin: vec.origin,
            target: vec.targetMusterPoint,
          }))
        : [
            {
              id: 'evac-valbyvej',
              streetName: 'Valbyvej Opsamlingspunkt',
              origin: { lat: 55.41295, lng: 11.35365 }, // Blok 1 front
              target: { lat: 55.41215, lng: 11.35225 },
            },
            {
              id: 'evac-rosenkildevej',
              streetName: 'Rosenkildevej Øst',
              origin: { lat: 55.4131, lng: 11.35415 },
              target: { lat: 55.41365, lng: 11.35555 },
            },
          ];

    return baseCorridors.map((c) => {
      const distM = Math.max(15, Math.round(computeGeoMeters(c.origin, c.target)));
      const originMoh = estimateElevationMoh(c.origin);
      const targetMoh = estimateElevationMoh(c.target);
      const slopePct = Number((((targetMoh - originMoh) / distM) * 100).toFixed(1));
      const midPt: LatLngPoint = {
        lat: (c.origin.lat + c.target.lat) * 0.5,
        lng: (c.origin.lng + c.target.lng) * 0.5,
      };
      const localPlumeDensityS = estimateLocalPlumeDensity(midPt);
      // Unimpeded pedestrian evacuation ~1.48 m/s; penalized by positive uphill slope and dense dust plume visibility impairment
      const speedMs = Number(
        Math.max(
          0.55,
          Math.min(
            1.95,
            1.48 - Math.max(0, slopePct) * 0.042 - Math.min(1.6, localPlumeDensityS) * 0.28
          )
        ).toFixed(2)
      );
      const cssDurationSec = Number(Math.max(0.55, Math.min(2.4, 1.55 / speedMs)).toFixed(2));
      return {
        ...c,
        distMeters: distM,
        originMoh,
        targetMoh,
        slopePct,
        localPlumeDensityS,
        speedMs,
        cssDurationSec,
      };
    });
  }, [simultaneousDispatch, receptorExposures, receptors]);

  // Item 10: BEK nr. 1272/2025 Status Indicator (Pb <= 5.0, 4-PAH <= 0.10, PCB <= 0.50 µg/L)
  const waterMainBek1272Status = useMemo(() => {
    if (!waterMainTelemetry) return null;
    const pbUgL = waterMainTelemetry.estimatedLeadIntrusionUgL;
    const pah4UgL = waterMainTelemetry.estimatedPah4SumUgL;
    const pcbUgL = waterMainTelemetry.estimatedPcbIntrusionUgL ?? 0.08;
    const exceeds = pbUgL > 5.0 || pah4UgL > 0.1 || pcbUgL > 0.5 || waterMainTelemetry.intrusionRiskLevel === 'active_backsiphonage';
    const elevated =
      !exceeds &&
      (pbUgL >= 3.0 ||
        pah4UgL >= 0.06 ||
        pcbUgL >= 0.3 ||
        waterMainTelemetry.intrusionRiskLevel === 'high' ||
        waterMainTelemetry.intrusionRiskLevel === 'moderate');

    const tier: 'critical' | 'warning' | 'nominal' = exceeds
      ? 'critical'
      : elevated
      ? 'warning'
      : 'nominal';

    return {
      tier,
      pbUgL,
      pah4UgL,
      pcbUgL,
      shortBadgeDa:
        tier === 'critical'
          ? 'BEK 1272/2025: OVERSKRIDELSE'
          : tier === 'warning'
          ? 'BEK 1272/2025: SKÆRPET OPSYN'
          : 'BEK 1272/2025: OVERHOLDT',
      symbolChar: tier === 'critical' ? '▲' : tier === 'warning' ? '◆' : '●',
      strokeHex:
        tier === 'critical' ? '#f43f5e' : tier === 'warning' ? '#f59e0b' : '#10b981',
      fillHex:
        tier === 'critical' ? '#4c0519' : tier === 'warning' ? '#451a03' : '#022c22',
      textClass:
        tier === 'critical'
          ? 'fill-rose-200'
          : tier === 'warning'
          ? 'fill-amber-200'
          : 'fill-emerald-200',
    };
  }, [waterMainTelemetry]);

  // Focus Mode Item 2: Pulsing red border on drikkevands-hovedrør tooltip when pipePpvMmPerSec > 50 mm/s or simulatedPipeRuptureActive is true
  const isWaterMainCriticalPulse = Boolean(
    waterMainTelemetry &&
      (waterMainTelemetry.pipePpvMmPerSec > 50 ||
        waterMainTelemetry.simulatedPipeRuptureActive)
  );

  // Vibrationsfare (DIN 4150-3): dynamically evaluates pipe PPV against the 25 mm/s Eternit threshold (alert >= 22.5 mm/s)
  const din4150ThresholdMmPerSec = 25.0;
  const ppvValMmPerSec = waterMainTelemetry ? waterMainTelemetry.pipePpvMmPerSec : 0;
  const isStructuralIntegrityAlert = Boolean(
    waterMainTelemetry && ppvValMmPerSec >= 22.5
  );
  const isDin4150ThresholdExceeded = Boolean(
    waterMainTelemetry && ppvValMmPerSec >= din4150ThresholdMmPerSec
  );
  const ppvPctOf25Threshold = waterMainTelemetry
    ? Math.round((ppvValMmPerSec / din4150ThresholdMmPerSec) * 100)
    : 0;
  const ppvDeltaFrom25MmPerSec = Number(
    (ppvValMmPerSec - din4150ThresholdMmPerSec).toFixed(1)
  );
  const ppvGaugeWidthPct = Math.min(100, Math.max(6, ppvPctOf25Threshold));

  const effectiveVirtualLeakPinPoint =
    virtualLeakPinPoint !== undefined ? virtualLeakPinPoint : localVirtualLeakPinPoint;

  const effectiveVirtualLeakImpact = useMemo<VirtualLeakPinImpact | null>(() => {
    if (virtualLeakImpact !== undefined && virtualLeakPinPoint !== undefined) {
      return virtualLeakImpact;
    }
    if (!effectiveVirtualLeakPinPoint || !waterMainTelemetry) return null;
    return computeVirtualLeakPercolationImpact({
      pinPoint: effectiveVirtualLeakPinPoint,
      telemetry: waterMainTelemetry,
      buildings,
    });
  }, [
    virtualLeakImpact,
    virtualLeakPinPoint,
    effectiveVirtualLeakPinPoint,
    waterMainTelemetry,
    buildings,
  ]);

  const setVirtualLeakPin = (pt: LatLngPoint | null) => {
    if (onChangeVirtualLeakPinPoint) {
      onChangeVirtualLeakPinPoint(pt);
    } else {
      setLocalVirtualLeakPinPoint(pt);
    }
  };

  const handlePlaceVirtualLeakPinAtPoint = (rawPt: LatLngPoint) => {
    if (!waterMainTelemetry) return;
    const snapped = snapPointToWaterMainPolyline(rawPt, waterMainTelemetry);
    setVirtualLeakPin(snapped.snappedPoint);
    setIsLeakPinDropMode(false);
    if (!showWaterMainLayer && onToggleWaterMainLayer) {
      onToggleWaterMainLayer();
    }
  };

  const handleToggleVirtualLeakPinQuick = () => {
    if (effectiveVirtualLeakPinPoint) {
      setVirtualLeakPin(null);
      setIsLeakPinDropMode(false);
    } else if (waterMainTelemetry) {
      setVirtualLeakPin(waterMainTelemetry.inspectionCenter);
      setIsLeakPinDropMode(false);
      if (!showWaterMainLayer && onToggleWaterMainLayer) {
        onToggleWaterMainLayer();
      }
    }
  };

  const handleTriggerIsolateNearbyMachinery = () => {
    const inspectionOrigin =
      waterMainTelemetry?.inspectionCenter ?? { lat: 55.4126, lng: 11.3531 };
    const activeSourcesList = sources.filter((s) => s.active);
    let nearbyActive = activeSourcesList.filter(
      (s) => computeGeoMeters(s.position, inspectionOrigin) <= 65
    );
    if (nearbyActive.length === 0 && activeSourcesList.length > 0) {
      const sorted = [...activeSourcesList].sort(
        (a, b) =>
          computeGeoMeters(a.position, inspectionOrigin) -
          computeGeoMeters(b.position, inspectionOrigin)
      );
      nearbyActive = sorted.slice(0, 1);
    }

    if (onIsolateNearbyMachinery) {
      onIsolateNearbyMachinery();
    } else if (onToggleSourceActive) {
      nearbyActive.forEach((s) => onToggleSourceActive(s.id));
    }

    if (eStopFeedbackTimerRef.current) {
      window.clearTimeout(eStopFeedbackTimerRef.current);
    }
    if (eStopToastTimerRef.current) {
      window.clearTimeout(eStopToastTimerRef.current);
    }

    setIsolatedMachineryJustNow(true);
    setEStopToastData({
      id: Date.now(),
      isolatedCodes:
        nearbyActive.length > 0
          ? nearbyActive.map((s) => s.code)
          : ['Nærmeste maskiner'],
      totalStoppedCount: nearbyActive.length,
      triggeredAtLabel: new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      ppvBeforeMmPerSec: ppvValMmPerSec,
    });

    eStopFeedbackTimerRef.current = window.setTimeout(() => {
      setIsolatedMachineryJustNow(false);
    }, 5000);
    eStopToastTimerRef.current = window.setTimeout(() => {
      setEStopToastData(null);
    }, 6500);
  };

  const buildGeoCirclePolygon = (
    center: LatLngPoint,
    radiusMeters: number,
    segments = 28
  ): LatLngPoint[] => {
    const latRad = (center.lat * Math.PI) / 180;
    const degLatPerM = 1 / 111320;
    const degLngPerM = 1 / (111320 * Math.cos(latRad));
    const pts: LatLngPoint[] = [];
    for (let i = 0; i < segments; i++) {
      const ang = (i / segments) * Math.PI * 2;
      pts.push({
        lat: Number((center.lat + Math.sin(ang) * radiusMeters * degLatPerM).toFixed(6)),
        lng: Number((center.lng + Math.cos(ang) * radiusMeters * degLngPerM).toFixed(6)),
      });
    }
    return pts;
  };

  const availableWaterMainSections = useMemo(() => {
    if (!waterMainTelemetry) return [];
    return waterMainTelemetry.coordinateMode === 'dar_verified_wgs84'
      ? waterMainTelemetry.darSegments
      : waterMainTelemetry.sceneSegments;
  }, [waterMainTelemetry]);

  const effectiveWaterMainSectionId = useMemo(() => {
    if (availableWaterMainSections.length === 0) return 'all';
    if (
      selectedWaterMainSectionId === 'all' ||
      availableWaterMainSections.some((s) => s.id === selectedWaterMainSectionId)
    ) {
      return selectedWaterMainSectionId;
    }
    return availableWaterMainSections[0].id;
  }, [availableWaterMainSections, selectedWaterMainSectionId]);

  const waterMainLast6HoursPoints = useMemo(() => {
    if (!showWaterMainLayer || !waterMainTelemetry) return [];
    return computeWaterMainLast6HoursTrend({
      telemetry: waterMainTelemetry,
      currentWeather,
      weatherHours,
      sources,
      buildings,
      manualMachineNoiseOutputDb: machineNoiseOutputDb,
      hasSteelRoadPlates: waterMainTelemetry.hasSteelRoadPlates,
      simulatedPipeRuptureActive: waterMainTelemetry.simulatedPipeRuptureActive,
    });
  }, [
    showWaterMainLayer,
    waterMainTelemetry,
    currentWeather,
    weatherHours,
    sources,
    buildings,
    machineNoiseOutputDb,
  ]);

  const handleExportWaterMainBek1272Csv = () => {
    if (!waterMainTelemetry) return;
    exportWaterMainBek1272ComplianceCsv({
      telemetry: waterMainTelemetry,
      selectedSectionId: effectiveWaterMainSectionId,
      observedTimestampIso: currentWeather.isoTime,
    });
    setWaterMainCsvExportedJustNow(true);
    window.setTimeout(() => setWaterMainCsvExportedJustNow(false), 2800);
  };

  const handleExport2DViewportPrintPdf = () => {
    generate2DViewportPrintPdfReport({
      sources,
      receptors,
      plumeZones,
      receptorExposures,
      currentWeather,
      isPuffMode,
      puff24h,
      observations,
      zoom,
      panOffsetPx,
      showHourlyPuffLobes,
      waterMainTelemetry,
      showWaterMainLayer,
      showLerBuffer,
    });
    setPdfExportedJustNow(true);
    window.setTimeout(() => {
      setPdfExportedJustNow(false);
    }, 2800);
  };

  // 'Snapshot Map' tool: saves the current 2D Tactical Map view (zoom, geographic bounds, active layers & rendered viewport snapshot) as a timestamped forensic observation entry
  const handleSaveMapSnapshotToObservations = () => {
    const zoomScale = Math.pow(2, zoom - 17);
    const pxPerDegLat = 195000 * zoomScale;
    const pxPerDegLng = 110800 * zoomScale;
    const centerLat = Number((RINGPARKEN_CENTER.lat + panOffsetPx.y / pxPerDegLat).toFixed(6));
    const centerLng = Number((RINGPARKEN_CENTER.lng - panOffsetPx.x / pxPerDegLng).toFixed(6));

    // Viewport dimensions (1200x760 internal coordinate system)
    const halfLatSpan = 760 / 2 / pxPerDegLat;
    const halfLngSpan = 1200 / 2 / pxPerDegLng;
    const bounds = {
      north: Number((centerLat + halfLatSpan).toFixed(5)),
      south: Number((centerLat - halfLatSpan).toFixed(5)),
      east: Number((centerLng + halfLngSpan).toFixed(5)),
      west: Number((centerLng - halfLngSpan).toFixed(5)),
    };

    const activeLayers: string[] = [
      preferTacticalCanvas || !hasConfiguredGoogleKey || gmpAuthFailed
        ? '2D Taktisk Vektor-Canvas'
        : 'Google Maps Hybrid',
      isPuffMode ? '24t Gaussisk Puff-Akkumulering' : 'Gaussisk Time-Spredningsfane',
    ];
    if (showWindParticles) activeLayers.push('Vind-Partikelflow');
    activeLayers.push(`Aktivt Heatmap-Lag: ${activeHeatmapLayerMode}`);
    if (showAsbestosRiskLayer) activeLayers.push('Asbest-Risikolag (<1997)');
    if (showGroundwaterLeachingWarning) {
      activeLayers.push('Grundvands-Udvaskningslag');
    }
    if (show6hDustForecast) activeLayers.push('6t Støv-Prognose (+0t..+6t)');
    if (isPuffMode && showHourlyPuffLobes) activeLayers.push('24t Time-Puff Lober');
    if (showReceptorLabels) activeLayers.push('Receptor- & Målepunkt-Labels');
    if (showHeatmapComparison) {
      activeLayers.push(`Heatmap-Sammenligning (${heatmapComparisonViewMode})`);
    }
    if (showWindNoiseHeatmapLayer) {
      activeLayers.push(`Vind-Støj Varmegraf (${Math.round(effectiveNoiseWindFromDeg)}°)`);
    }
    if (showPlumeConcentrationHeatmapLayer) {
      activeLayers.push('Plume Koncentrations-Heatmap (Høj-Konc. vs. Sikker Zone)');
    }
    if (showWeatherCorrelationHeatmapLayer) {
      activeLayers.push(
        `Vejr-Korrelations Heatmap (6t r>0,80: ${weatherCorrelationHeatmapData.highlightedAreas.length} zoner)`
      );
    }
    if (showWaterMainLayer && waterMainTelemetry) {
      activeLayers.push(
        `Drikkevands-Hovedrør Kierulffsvej (${waterMainTelemetry.dimension} · -${waterMainTelemetry.burialDepthMeters}m)`
      );
    }

    const modeDescriptor =
      showHeatmapComparison && heatmapComparison
        ? `Heatmap-Sammenligning (${heatmapComparison.hourA.hourLabel} ↔ ${heatmapComparison.hourB.hourLabel})`
        : isPuffMode
        ? '24t Gaussisk Puff-Akkumulering'
        : `Stationær Time-Plume (kl. ${currentWeather.hourLabel})`;

    const renderedSnapshot = render2DViewportPrintSnapshotDataUrl({
      sources,
      receptors,
      plumeZones,
      receptorExposures,
      currentWeather,
      isPuffMode,
      puff24h,
      observations,
      zoom,
      panOffsetPx,
      showHourlyPuffLobes,
      waterMainTelemetry,
      showWaterMainLayer,
      showLerBuffer,
      simultaneousDispatch,
    });

    const capturedAtIso = new Date().toISOString();

    onSaveMapSnapshotObservation?.({
      zoom: Number(zoom.toFixed(1)),
      center: { lat: centerLat, lng: centerLng },
      bounds,
      activeLayers,
      modeDescriptor,
      capturedAtIso,
      snapshotDataUrl: renderedSnapshot.dataUrl,
    });

    const boundsText = `N:${bounds.north}° S:${bounds.south}° Ø:${bounds.east}° V:${bounds.west}°`;
    setLastMapSnapshotSummary({
      zoom: Number(zoom.toFixed(1)),
      boundsText,
      layersText: activeLayers.join(' · '),
      timestampLabel: `${currentWeather.isoTime.split('T')[0]} kl. ${currentWeather.hourLabel}`,
    });
    setMapSnapshotSavedJustNow(true);
    window.setTimeout(() => {
      setMapSnapshotSavedJustNow(false);
    }, 4500);
  };

  const handleExportHighResHeatmapPng = () => {
    if (isExportingPng) return;
    setIsExportingPng(true);

    const W = 2400;
    const H = 1680;
    const headerH = 112;
    const footerH = 88;
    const mapH = H - headerH - footerH; // 1480px

    const dateIso = currentWeather.isoTime.split('T')[0] || puff24h.dateIso;
    const safeHour = currentWeather.hourLabel.replace(':', '');
    const plumeDir = (currentWeather.windDirection10m + 180) % 360;
    const windFrom = degreesToCompass(currentWeather.windDirection10m);
    const plumeTo = degreesToCompass(plumeDir);

    const zoomScale = Math.pow(2, zoom - 17);
    const pxPerDegLat = 195000 * zoomScale;
    const pxPerDegLng = 110800 * zoomScale;
    const viewportCenterLat = Number(
      (RINGPARKEN_CENTER.lat + panOffsetPx.y / pxPerDegLat).toFixed(4)
    );
    const viewportCenterLng = Number(
      (RINGPARKEN_CENTER.lng - panOffsetPx.x / pxPerDegLng).toFixed(4)
    );

    const activeModeTitle =
      showHeatmapComparison && heatmapComparison
        ? heatmapComparisonViewMode === 'difference'
          ? `Differens-Heatmap Δ(T_B − T_A) (${heatmapComparison.hourA.hourLabel} → ${heatmapComparison.hourB.hourLabel})`
          : `Begge Heatmaps (${heatmapComparison.hourA.hourLabel} ↔ ${heatmapComparison.hourB.hourLabel})`
        : isPuffMode
        ? showHourlyPuffLobes
          ? '24t Gaussisk Puff + Time-Vektorer'
          : '24t Gaussisk Puff-Aftryk'
        : 'Stationær Gaussisk Time-Plume';

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsExportingPng(false);
      return;
    }

    // Base dark forensic background
    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, W, H);

    const drawForensicBannersAndSave = () => {
      // 1. TOP FORENSIC HEADER BANNER (2400 x 112 px)
      ctx.fillStyle = '#0B0E17';
      ctx.fillRect(0, 0, W, headerH);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, headerH);
      ctx.lineTo(W, headerH);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `RETSMEDICINSK SPREDNINGS-HEATMAP (2400×1680 PX · 300 DPI) · RINGPARKEN, 4200 SLAGELSE (PSS SAG W22085)`,
        32,
        42
      );

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(
        `Aktivt Lag: ${activeModeTitle}   |   Dato & Tid: ${dateIso} kl. ${currentWeather.hourLabel}   |   Viewport Zoom Z:${zoom.toFixed(
          1
        )} (${viewportCenterLat}°N, ${viewportCenterLng}°E)`,
        32,
        82
      );

      // Right-side Open-Meteo Weather & Stability Badge in Header
      const badgeW = 860;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.fillRect(W - badgeW - 28, 18, badgeW, 76);
      ctx.strokeRect(W - badgeW - 28, 18, badgeW, 76);

      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `OPEN-METEO TELEMETRI: Vind ${currentWeather.windSpeed10m} m/s (stød ${currentWeather.windGusts10m} m/s) fra ${currentWeather.windDirection10m}° (${windFrom})`,
        W - 46,
        48
      );
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 17px monospace';
      ctx.fillText(
        `Spredningsfane mod ${plumeDir}° (${plumeTo}) · Pasquill Stabilitetsklasse ${currentWeather.pasquillClass} · Temp ${currentWeather.temperature2m}°C`,
        W - 46,
        78
      );

      // 2. BOTTOM FORENSIC LEGEND & TOP 3 RECEPTOR BANNER (2400 x 88 px)
      const footY = H - footerH;
      ctx.fillStyle = '#0B0E17';
      ctx.fillRect(0, footY, W, footerH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, footY);
      ctx.lineTo(W, footY);
      ctx.stroke();

      // Color legend items on left
      const legendItems = [
        { color: '#ef4444', label: 'Rød Zone: S ≥ 1,00 (Ulovlig jf. BEK 613/2026)' },
        { color: '#f97316', label: 'Orange Zone: 0,50 ≤ S < 1,00 (Forhøjet risiko)' },
        { color: '#eab308', label: 'Gul Zone: 0,15 ≤ S < 0,50 (Spredningsrand)' },
        { color: '#a855f7', label: '24t Gaussisk Puff / <1997 Asbest / Differens Δ' },
      ];

      ctx.textAlign = 'left';
      ctx.font = 'bold 16px monospace';
      let lx = 32;
      legendItems.forEach((item) => {
        ctx.fillStyle = item.color;
        ctx.fillRect(lx, footY + 22, 22, 22);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(lx, footY + 22, 22, 22);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(item.label, lx + 30, footY + 39);
        lx += ctx.measureText(item.label).width + 58;
      });

      // Second line on bottom-left: Top 3 Receptor Sum Quotients
      const top3Summary = top3ReceptorExposures
        .map(
          (r, idx) =>
            `#${idx + 1} ${r.receptorCode} (${r.receptorName.slice(0, 22)}): S = ${r.sumQuotient.toFixed(2)}`
        )
        .join('   |   ');
      ctx.fillStyle = '#fda4af';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(
        `TOP 3 MÅLTE RECEPTOR-SUMKVOTIENTER:  ${top3Summary}`,
        32,
        footY + 70
      );

      // Bottom-right Forensic Attestation stamp
      ctx.textAlign = 'right';
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(
        `VERIFICERET HØJ-OPLØSNINGS BILAG TIL RETSMEDICINSK PDF-RAPPORT`,
        W - 32,
        footY + 70
      );

      const pngDataUrl = canvas.toDataURL('image/png', 1.0);

      // Save to localStorage so Forensic PDF Report generator automatically embeds this snapshot
      try {
        window.localStorage.setItem(
          'ringparken_latest_heatmap_png_v1',
          JSON.stringify({
            dataUrl: pngDataUrl,
            exportedAtIso: new Date().toISOString(),
            dateIso,
            hourLabel: currentWeather.hourLabel,
            modeDescriptor: activeModeTitle,
            zoom,
          })
        );
      } catch {
        // Ignore storage quota errors
      }

      // Trigger browser download of high-resolution PNG file
      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.setAttribute(
        'download',
        `Ringparken_Sprednings_Heatmap_${dateIso}_kl_${safeHour}_HojOplosning_2400px.png`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsExportingPng(false);
      setPngExportedJustNow(true);
      window.setTimeout(() => {
        setPngExportedJustNow(false);
      }, 3200);
    };

    const drawFallbackProceduralViewport = () => {
      const fallbackSnap = render2DViewportPrintSnapshotDataUrl({
        sources,
        receptors,
        plumeZones,
        receptorExposures,
        currentWeather,
        isPuffMode,
        puff24h,
        observations,
        zoom,
        panOffsetPx,
        showHourlyPuffLobes,
        waterMainTelemetry,
        showWaterMainLayer,
        showLerBuffer,
        simultaneousDispatch,
      });
      if (!fallbackSnap.dataUrl) {
        drawForensicBannersAndSave();
        return;
      }
      const fbImg = new Image();
      fbImg.onload = () => {
        ctx.drawImage(fbImg, 0, headerH, W, mapH);
        drawForensicBannersAndSave();
      };
      fbImg.onerror = () => {
        drawForensicBannersAndSave();
      };
      fbImg.src = fallbackSnap.dataUrl;
    };

    if (svgRef.current) {
      try {
        const clonedSvg = svgRef.current.cloneNode(true) as SVGSVGElement;
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clonedSvg.setAttribute('width', String(W));
        clonedSvg.setAttribute('height', String(mapH));

        const svgString = new XMLSerializer().serializeToString(clonedSvg);
        const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

        const svgImg = new Image();
        svgImg.onload = () => {
          ctx.drawImage(svgImg, 0, headerH, W, mapH);
          drawForensicBannersAndSave();
        };
        svgImg.onerror = () => {
          drawFallbackProceduralViewport();
        };
        svgImg.src = svgDataUrl;
      } catch {
        drawFallbackProceduralViewport();
      }
    } else {
      drawFallbackProceduralViewport();
    }
  };

  useEffect(() => {
    const handleAuthFail = () => {
      setGmpAuthFailed(true);
      setPreferTacticalCanvas(true);
    };
    window.addEventListener('gmp-auth-failure', handleAuthFail);
    return () => window.removeEventListener('gmp-auth-failure', handleAuthFail);
  }, []);

  const useGoogleMapsEngine = hasConfiguredGoogleKey && !gmpAuthFailed && !preferTacticalCanvas;

  const plumeDirectionDeg = (currentWeather.windDirection10m + 180) % 360;
  const windFromCompass = degreesToCompass(currentWeather.windDirection10m);
  const plumeToCompass = degreesToCompass(plumeDirectionDeg);

  // Determine which polygons to render based on Stationary vs 24h Gaussian Puff mode
  const activePolygons = useMemo(() => {
    if (!isPuffMode) {
      return plumeZones;
    }
    if (showHourlyPuffLobes) {
      return [...puff24h.mergedEnvelopePolygons, ...puff24h.hourlyPuffPolygons];
    }
    return puff24h.mergedEnvelopePolygons;
  }, [isPuffMode, plumeZones, puff24h, showHourlyPuffLobes]);

  const activeSubstanceLayerCount = useMemo(
    () =>
      [
        visibleDispersionSubstances.asbestos,
        visibleDispersionSubstances.heavyMetals,
        visibleDispersionSubstances.pcb,
        visibleDispersionSubstances.quartzWool,
        visibleDispersionSubstances.moldSewer,
      ].filter(Boolean).length,
    [visibleDispersionSubstances]
  );

  // Filter active dispersion polygons by toggled-ON substances in Layer Control and visually hidden source nodes
  const filteredActivePolygons = useMemo(() => {
    const visiblePolygons =
      hiddenSourceSet.size === 0
        ? activePolygons
        : activePolygons.filter((zone) => {
            if (zone.sourceId && hiddenSourceSet.has(zone.sourceId)) return false;
            const matchedSrc = sources.find(
              (s) => s.id === zone.sourceId || zone.id.includes(s.id)
            );
            if (matchedSrc && hiddenSourceSet.has(matchedSrc.id)) return false;
            return true;
          });

    if (activeSubstanceLayerCount === 0) return [];
    const selectedKeys: SubstanceKey[] = [];
    if (visibleDispersionSubstances.asbestos) selectedKeys.push('asbestos');
    if (visibleDispersionSubstances.heavyMetals) selectedKeys.push('heavyMetals');
    if (visibleDispersionSubstances.pcb) selectedKeys.push('pcb');
    if (visibleDispersionSubstances.quartzWool) selectedKeys.push('quartzWool');
    if (visibleDispersionSubstances.moldSewer) selectedKeys.push('moldSewer');

    // When all 5 are active, show the full set cleanly
    if (activeSubstanceLayerCount === 5) return visiblePolygons;

    // When a subset is chosen, filter polygons matching sources with selected substances
    // and restrict risk tiers so toggling any of the 5 substances noticeably declutters the map
    const filtered = visiblePolygons.filter((zone) => {
      const matchedSrc = sources.find(
        (s) => s.id === zone.sourceId || zone.id.includes(s.id)
      );
      const hasMatchingSubstance = matchedSrc
        ? selectedKeys.some((k) => matchedSrc.substances.includes(k))
        : true;
      if (!hasMatchingSubstance) return false;
      if (zone.level === 'blue' && !visibleDispersionSubstances.moldSewer) {
        return false;
      }
      if (zone.level === 'yellow' && !visibleDispersionSubstances.asbestos && !visibleDispersionSubstances.quartzWool) {
        return false;
      }
      if (
        zone.level === 'orange' &&
        !visibleDispersionSubstances.pcb &&
        !visibleDispersionSubstances.heavyMetals &&
        !visibleDispersionSubstances.asbestos
      ) {
        return false;
      }
      if (
        zone.level === 'red' &&
        !visibleDispersionSubstances.asbestos &&
        !visibleDispersionSubstances.pcb &&
        !visibleDispersionSubstances.heavyMetals
      ) {
        return false;
      }
      return true;
    });

    return filtered;
  }, [activePolygons, activeSubstanceLayerCount, visibleDispersionSubstances, sources, hiddenSourceSet]);

  // Concentration Heatmap Layer derived strictly from simulation.plumeZones (distinguishing high-concentration areas vs. safe zones)
  const plumeConcentrationHeatmapData = useMemo(() => {
    const levelOrder: Record<RiskZoneLevel, number> = {
      yellow: 1,
      blue: 2,
      orange: 3,
      red: 4,
    };
    const selectedKeys: SubstanceKey[] = [];
    if (visibleDispersionSubstances.asbestos) selectedKeys.push('asbestos');
    if (visibleDispersionSubstances.heavyMetals) selectedKeys.push('heavyMetals');
    if (visibleDispersionSubstances.pcb) selectedKeys.push('pcb');
    if (visibleDispersionSubstances.quartzWool) selectedKeys.push('quartzWool');
    if (visibleDispersionSubstances.moldSewer) selectedKeys.push('moldSewer');

    const visibleSourcePlumeZones =
      activeSubstanceLayerCount === 0
        ? []
        : plumeZones.filter((zone) => {
            if (zone.sourceId && hiddenSourceSet.has(zone.sourceId)) return false;
            const matchedSrc = sources.find(
              (s) => s.id === zone.sourceId || zone.id.includes(s.id)
            );
            if (matchedSrc && hiddenSourceSet.has(matchedSrc.id)) return false;
            if (activeSubstanceLayerCount < 5) {
              const hasMatchingSubstance = matchedSrc
                ? selectedKeys.some((k) => matchedSrc.substances.includes(k))
                : true;
              if (!hasMatchingSubstance) return false;
              if (zone.level === 'blue' && !visibleDispersionSubstances.moldSewer) return false;
              if (
                zone.level === 'yellow' &&
                !visibleDispersionSubstances.asbestos &&
                !visibleDispersionSubstances.quartzWool
              ) {
                return false;
              }
              if (
                zone.level === 'orange' &&
                !visibleDispersionSubstances.pcb &&
                !visibleDispersionSubstances.heavyMetals &&
                !visibleDispersionSubstances.asbestos
              ) {
                return false;
              }
              if (
                zone.level === 'red' &&
                !visibleDispersionSubstances.asbestos &&
                !visibleDispersionSubstances.pcb &&
                !visibleDispersionSubstances.heavyMetals
              ) {
                return false;
              }
            }
            return true;
          });
    const obsThreshold = Number(
      Math.max(0.1, Math.min(1.0, plumeHeatmapPasquillThreshold)).toFixed(2)
    );
    const elevatedThreshold = Number((obsThreshold * 2).toFixed(2));
    const criticalThreshold = Number((obsThreshold * 4).toFixed(2));

    const classifyZoneLevel = (
      zone: PlumePolygonZone
    ): 'safe' | 'yellow' | 'orange' | 'red' | 'blue' => {
      if (zone.level === 'blue') return 'blue';
      const repQuotient =
        zone.maxSumQuotient > 0
          ? zone.maxSumQuotient
          : zone.level === 'red'
          ? 1.15
          : zone.level === 'orange'
          ? 0.65
          : 0.32;
      if (repQuotient < obsThreshold) return 'safe';
      if (repQuotient >= criticalThreshold) return 'red';
      if (repQuotient >= elevatedThreshold) return 'orange';
      return 'yellow';
    };

    const classifiedZones: Array<{
      zone: PlumePolygonZone;
      heatmapLevel: 'yellow' | 'orange' | 'red' | 'blue';
    }> = [];
    for (const zone of visibleSourcePlumeZones) {
      const tier = classifyZoneLevel(zone);
      if (tier !== 'safe') {
        classifiedZones.push({ zone, heatmapLevel: tier });
      }
    }
    classifiedZones.sort(
      (a, b) => (levelOrder[a.heatmapLevel] ?? 0) - (levelOrder[b.heatmapLevel] ?? 0)
    );

    const sortedZones = classifiedZones.map((item) => item.zone);
    const criticalCount = classifiedZones.filter((z) => z.heatmapLevel === 'red').length;
    const elevatedCount = classifiedZones.filter((z) => z.heatmapLevel === 'orange').length;
    const observationCount = classifiedZones.filter((z) => z.heatmapLevel === 'yellow').length;
    const runoffCount = classifiedZones.filter((z) => z.heatmapLevel === 'blue').length;
    const safeReceptorIds = new Set(
      receptorExposures
        .filter((e) => e.sumQuotient < obsThreshold)
        .map((e) => e.receptorId)
    );
    const maxZoneQuotient = sortedZones.reduce(
      (max, z) => Math.max(max, z.maxSumQuotient || 0),
      0
    );
    return {
      sortedZones,
      classifiedZones,
      obsThreshold,
      elevatedThreshold,
      criticalThreshold,
      criticalCount,
      elevatedCount,
      observationCount,
      runoffCount,
      safeReceptorIds,
      safeReceptorsCount: safeReceptorIds.size,
      impactedReceptorsCount: Math.max(0, receptorExposures.length - safeReceptorIds.size),
      maxZoneQuotient,
      safeZonePerimeter: [
        { lat: 55.4152, lng: 11.3485 },
        { lat: 55.4152, lng: 11.3588 },
        { lat: 55.4102, lng: 11.3588 },
        { lat: 55.4102, lng: 11.3485 },
      ] as LatLngPoint[],
    };
  }, [
    plumeZones,
    hiddenSourceSet,
    sources,
    receptorExposures,
    activeSubstanceLayerCount,
    visibleDispersionSubstances,
    plumeHeatmapPasquillThreshold,
  ]);

  // Smooth Cross-Fade Animation State when switching visualization modes or time intervals
  const currentModeDescriptor = useMemo(() => {
    if (showHeatmapComparison && heatmapComparison) {
      return heatmapComparisonViewMode === 'difference'
        ? `Differens-Heatmap Δ(T_B − T_A) (${heatmapComparison.hourA.hourLabel} → ${heatmapComparison.hourB.hourLabel})`
        : `Begge Heatmaps (${heatmapComparison.hourA.hourLabel} ↔ ${heatmapComparison.hourB.hourLabel})`;
    }
    if (isPuffMode) {
      return showHourlyPuffLobes ? '24t Gaussisk Puff + Time-Vektorer' : '24t Gaussisk Puff-Aftryk';
    }
    return 'Stationær Plume-Spredning';
  }, [
    showHeatmapComparison,
    heatmapComparison,
    heatmapComparisonViewMode,
    isPuffMode,
    showHourlyPuffLobes,
  ]);

  const visualStateSignature = `${currentWeather.isoTime}|${currentWeather.hourIndex}|${isPuffMode}|${showHeatmapComparison}|${heatmapComparisonViewMode}|${differenceMetric}|${comparisonHourAIndex}|${comparisonHourBIndex}|${showAsbestosRiskLayer}|${showHourlyPuffLobes}|${preferTacticalCanvas}`;

  const [outgoingSnapshot, setOutgoingSnapshot] = useState<OutgoingVisualSnapshot | null>(null);
  const [crossFadeProgress, setCrossFadeProgress] = useState<number>(1);
  const [transitionBadgeLabel, setTransitionBadgeLabel] = useState<string | null>(null);

  const lastSnapshotRef = useRef<OutgoingVisualSnapshot>({
    signature: visualStateSignature,
    modeDescriptor: currentModeDescriptor,
    hourLabel: currentWeather.hourLabel,
    activePolygons,
    isPuffMode,
    showHeatmapComparison,
    heatmapComparisonViewMode,
    heatmapComparison,
  });
  const rafCrossFadeRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = lastSnapshotRef.current;
    if (prev.signature === visualStateSignature || isAnimatingPlumeRoute) {
      // Keep ref polygons fresh without launching a competing cross-fade RAF loop during continuous playback
      lastSnapshotRef.current = {
        signature: visualStateSignature,
        modeDescriptor: currentModeDescriptor,
        hourLabel: currentWeather.hourLabel,
        activePolygons,
        isPuffMode,
        showHeatmapComparison,
        heatmapComparisonViewMode,
        heatmapComparison,
      };
      if (isAnimatingPlumeRoute && outgoingSnapshot) {
        setOutgoingSnapshot(null);
        setCrossFadeProgress(1);
      }
      return;
    }

    // Capture outgoing snapshot for dual-buffer cross-fade
    setOutgoingSnapshot(prev);
    setCrossFadeProgress(0);

    const badge =
      prev.modeDescriptor !== currentModeDescriptor
        ? `Skifter visualisering: ${prev.modeDescriptor} → ${currentModeDescriptor}`
        : prev.hourLabel !== currentWeather.hourLabel
        ? `Cross-fade tidsinterval: kl. ${prev.hourLabel} → kl. ${currentWeather.hourLabel}`
        : `Opdaterer spredningslag (kl. ${currentWeather.hourLabel})`;
    setTransitionBadgeLabel(badge);

    // Update ref to current incoming state
    lastSnapshotRef.current = {
      signature: visualStateSignature,
      modeDescriptor: currentModeDescriptor,
      hourLabel: currentWeather.hourLabel,
      activePolygons,
      isPuffMode,
      showHeatmapComparison,
      heatmapComparisonViewMode,
      heatmapComparison,
    };

    if (rafCrossFadeRef.current !== null) {
      window.cancelAnimationFrame(rafCrossFadeRef.current);
    }

    const durationMs = 420;
    const startTime = performance.now();

    const animateFade = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, Math.max(0, elapsed / durationMs));
      // Smooth cubic ease-out curve
      const eased = 1 - Math.pow(1 - t, 3);
      setCrossFadeProgress(eased);

      if (t < 1) {
        rafCrossFadeRef.current = window.requestAnimationFrame(animateFade);
      } else {
        setCrossFadeProgress(1);
        setOutgoingSnapshot(null);
        setTransitionBadgeLabel(null);
        rafCrossFadeRef.current = null;
      }
    };

    rafCrossFadeRef.current = window.requestAnimationFrame(animateFade);

    return () => {
      if (rafCrossFadeRef.current !== null) {
        window.cancelAnimationFrame(rafCrossFadeRef.current);
      }
    };
  }, [
    visualStateSignature,
    currentModeDescriptor,
    currentWeather.hourLabel,
    activePolygons,
    isPuffMode,
    showHeatmapComparison,
    heatmapComparison,
  ]);

  // Static 24-Hour Plume-Path Route base (does not recompute when timeline slider moves)
  const plumeRouteStaticBase = useMemo(() => {
    const activeSources = sources.filter((s) => s.active);
    const originSource =
      activeSources.find((s) => s.id === selectedSourceId) ||
      activeSources.find((s) => s.name === puff24h.peakReceptor.nearestSourceName) ||
      activeSources[0] ||
      sources[0];

    const sourceTrajectories = puff24h.puffTrajectories
      .filter((t) => t.sourceId === originSource?.id)
      .sort((a, b) => a.hourIndex - b.hourIndex);

    const topAffectedReceptors = [
      ...puff24h.streetPointSummaries,
      ...puff24h.receptorSummaries,
    ]
      .sort((a, b) => b.cumulativeSumDose - a.cumulativeSumDose)
      .slice(0, 3);

    const full24hTipLoop: LatLngPoint[] = sourceTrajectories.map((t) => t.puffCenterEnd);

    return {
      originSource,
      sourceTrajectories,
      topAffectedReceptors,
      full24hTipLoop,
    };
  }, [sources, selectedSourceId, puff24h]);

  // 24-Hour Animated Wind-Plume Route ('Animér Fanevej-Rute') connecting source -> 24h plume path -> most affected areas
  const plumeRouteAnimationData = useMemo(() => {
    const { originSource, sourceTrajectories, topAffectedReceptors, full24hTipLoop } =
      plumeRouteStaticBase;

    const clampProg = Math.max(0, Math.min(23.99, plumeRouteProgress));
    const curIdx = Math.floor(clampProg);
    const nextIdx = (curIdx + 1) % Math.max(1, sourceTrajectories.length);
    const frac = clampProg - curIdx;

    const curTraj = sourceTrajectories[curIdx] || sourceTrajectories[0];
    const nextTraj = sourceTrajectories[nextIdx] || curTraj;

    const lerpPt = (a: LatLngPoint, b: LatLngPoint, t: number): LatLngPoint => ({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    });

    const frontPoint =
      curTraj && nextTraj
        ? lerpPt(curTraj.puffCenterEnd, nextTraj.puffCenterEnd, frac)
        : originSource.position;

    const activeTrailPoints: LatLngPoint[] = [
      originSource.position,
      ...sourceTrajectories.slice(0, curIdx + 1).map((t) => t.puffCenterEnd),
      frontPoint,
    ];

    const receptorCorridors = topAffectedReceptors.map((rec, rankIdx) => {
      const phase = (clampProg * 0.45 + rankIdx * 0.33) % 1;
      const midControl =
        rankIdx === 0
          ? frontPoint
          : lerpPt(originSource.position, rec.position, 0.52);
      const tracerPos =
        phase < 0.5
          ? lerpPt(originSource.position, midControl, phase * 2)
          : lerpPt(midControl, rec.position, (phase - 0.5) * 2);

      return {
        receptor: rec,
        rank: rankIdx + 1,
        path: [originSource.position, midControl, rec.position],
        directLine: [originSource.position, rec.position],
        tracerPos,
      };
    });

    if (!isAnimatingPlumeRoute) {
      return {
        originSource,
        sourceTrajectories,
        topAffectedReceptors,
        curIdx,
        curTraj,
        frontPoint,
        full24hTipLoop,
        activeTrailPoints,
        receptorCorridors,
        intersectingHighDensityReceptors: [],
      };
    }

    const toMetersXY = (pt: LatLngPoint, ref: LatLngPoint) => {
      const latFactor = 111320;
      const lngFactor = 111320 * Math.cos((ref.lat * Math.PI) / 180);
      return {
        x: (pt.lng - ref.lng) * lngFactor,
        y: (pt.lat - ref.lat) * latFactor,
      };
    };
    const pointToSegmentDistMeters = (
      p: LatLngPoint,
      a: LatLngPoint,
      b: LatLngPoint
    ): number => {
      const pM = toMetersXY(p, originSource.position);
      const aM = toMetersXY(a, originSource.position);
      const bM = toMetersXY(b, originSource.position);
      const abx = bM.x - aM.x;
      const aby = bM.y - aM.y;
      const abLenSq = abx * abx + aby * aby;
      if (abLenSq < 1e-3) {
        return Math.hypot(pM.x - aM.x, pM.y - aM.y);
      }
      const t = Math.max(
        0,
        Math.min(1, ((pM.x - aM.x) * abx + (pM.y - aM.y) * aby) / abLenSq)
      );
      const projX = aM.x + t * abx;
      const projY = aM.y + t * aby;
      return Math.hypot(pM.x - projX, pM.y - projY);
    };

    const intersectingHighDensityReceptors = receptors
      .filter(
        (rec) =>
          (rec.residentCountEstimate ?? 0) >= 60 ||
          rec.category === 'residential_block' ||
          /børnehave|skole|institution|vuggestue/i.test(rec.name)
      )
      .map((rec) => {
        const distToPathMeters = Math.round(
          pointToSegmentDistMeters(rec.center, originSource.position, frontPoint)
        );
        const exp = receptorExposures.find((e) => e.receptorId === rec.id);
        const sumQuotient = exp?.sumQuotient ?? 0;
        const residentCount = rec.residentCountEstimate ?? 80;
        const isIntersected =
          distToPathMeters <= 125 || (distToPathMeters <= 175 && sumQuotient >= 0.5);
        return {
          receptor: rec,
          distToPathMeters,
          residentCount,
          sumQuotient,
          isCritical: sumQuotient >= 1.0 || distToPathMeters <= 80,
          isIntersected,
        };
      })
      .filter((item) => item.isIntersected)
      .sort((a, b) => a.distToPathMeters - b.distToPathMeters);

    return {
      originSource,
      sourceTrajectories,
      topAffectedReceptors,
      curIdx,
      curTraj,
      frontPoint,
      full24hTipLoop,
      activeTrailPoints,
      receptorCorridors,
      intersectingHighDensityReceptors,
    };
  }, [
    plumeRouteStaticBase,
    plumeRouteProgress,
    isAnimatingPlumeRoute,
    receptors,
    receptorExposures,
  ]);

  // Continuous 60fps Animation Loop for 6-Hour Dust Movement Forecast (+0t -> +6t)
  useEffect(() => {
    if (!show6hDustForecast || !isPlaying6hDustForecast) return;
    let rafId: number | null = null;
    let lastTs = performance.now();

    const speedMultiplier =
      forecast6hSpeed === '2x' ? 1.55 : forecast6hSpeed === '0.5x' ? 0.42 : 0.85;

    const tick = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      setForecast6hProgress((prev) => {
        const next = prev + dtSec * speedMultiplier;
        return next > 6.0 ? next - 6.0 : next;
      });
      setPuffWavePhase((prev) => (prev + dtSec * 0.95) % 1);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [show6hDustForecast, isPlaying6hDustForecast, forecast6hSpeed]);

  // 6-Hour Forecast Dust Drift Simulation (+0t through +6t based on hourly wind forecast)
  const sixHourDustForecastData = useMemo(() => {
    const movePt = (origin: LatLngPoint, distM: number, bearingDeg: number): LatLngPoint => {
      const rad = (bearingDeg * Math.PI) / 180;
      const dLat = (distM * Math.cos(rad)) / 111320;
      const dLng = (distM * Math.sin(rad)) / (111320 * Math.cos((origin.lat * Math.PI) / 180));
      return { lat: origin.lat + dLat, lng: origin.lng + dLng };
    };

    const lerpPt = (a: LatLngPoint, b: LatLngPoint, t: number): LatLngPoint => ({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    });

    const buildGaussianPlumeLobe = (
      origin: LatLngPoint,
      dirDeg: number,
      lengthM: number,
      maxHalfWidthM: number
    ): LatLngPoint[] => {
      const steps = [0.05, 0.2, 0.42, 0.66, 0.86, 1.0];
      const leftSide: LatLngPoint[] = [movePt(origin, 7, (dirDeg - 90 + 360) % 360)];
      const rightSide: LatLngPoint[] = [movePt(origin, 7, (dirDeg + 90) % 360)];

      for (const s of steps) {
        const d = lengthM * s;
        const w = maxHalfWidthM * Math.sin(s * Math.PI * 0.84);
        const center = movePt(origin, d, dirDeg);
        leftSide.push(movePt(center, w, (dirDeg - 90 + 360) % 360));
        rightSide.push(movePt(center, w, (dirDeg + 90) % 360));
      }
      return [...leftSide, ...rightSide.reverse()]; // Fixed 14-vertex polygon for smooth vertex-to-vertex morphing
    };

    const activeSources = visibleSources.filter((s) => s.active);
    const originSource =
      activeSources.find((s) => s.id === selectedSourceId) ||
      activeSources.find((s) => s.code === 'BLOK-1') ||
      activeSources[0] ||
      visibleSources[0] ||
      sources[0];

    const startHrIdx = currentWeather.hourIndex;

    // Build 7 hourly forecast steps: +0t (Nu), +1t, +2t, +3t, +4t, +5t, +6t
    let cumulativeDriftCenter: LatLngPoint = originSource.position;

    const hourlySteps = Array.from({ length: 7 }, (_, offsetHours) => {
      const absHour = startHrIdx + offsetHours;
      const wrappedHourIdx = absHour % 24;
      const isNextDay = absHour >= 24;

      const hrWeather: HourlyWeatherPoint =
        weatherHours.find((h) => h.hourIndex === wrappedHourIdx) || {
          ...currentWeather,
          hourIndex: wrappedHourIdx,
          hourLabel: `${String(wrappedHourIdx).padStart(2, '0')}:00`,
          windSpeed10m: Number(
            Math.max(
              2.2,
              currentWeather.windSpeed10m + Math.sin(offsetHours * 0.85) * 1.8
            ).toFixed(1)
          ),
          windGusts10m: Number(
            Math.max(
              4.0,
              currentWeather.windGusts10m + Math.sin(offsetHours * 0.85) * 2.6
            ).toFixed(1)
          ),
          windDirection10m:
            (currentWeather.windDirection10m + offsetHours * 11 + 360) % 360,
        };

      const plumeToDeg = (hrWeather.windDirection10m + 180) % 360;
      const plumeToCompassLabel = degreesToCompass(plumeToDeg);
      const windFromCompassLabel = degreesToCompass(hrWeather.windDirection10m);

      // Stability lateral spread factor
      const stabilitySpread =
        hrWeather.pasquillClass === 'A' || hrWeather.pasquillClass === 'B'
          ? 1.24
          : hrWeather.pasquillClass === 'E' || hrWeather.pasquillClass === 'F'
          ? 0.82
          : 1.0;

      // Rain washout factor
      const rainWashout = hrWeather.precipitation > 1.5 ? 0.72 : 1.0;

      // Plume reach and width for this forecast hour
      const outerLengthM = Math.round(
        (135 + hrWeather.windSpeed10m * 16.5 + hrWeather.windGusts10m * 4.2) *
          rainWashout
      );
      const coreLengthM = Math.round(outerLengthM * 0.58);
      const outerHalfWidthM = Math.round(
        (36 + originSource.releaseHeightMeters * 2.2) * stabilitySpread
      );
      const coreHalfWidthM = Math.round(outerHalfWidthM * 0.54);

      const outerPolygon = buildGaussianPlumeLobe(
        originSource.position,
        plumeToDeg,
        outerLengthM,
        outerHalfWidthM
      );
      const corePolygon = buildGaussianPlumeLobe(
        originSource.position,
        plumeToDeg,
        coreLengthM,
        coreHalfWidthM
      );

      const plumeCentroid = movePt(
        originSource.position,
        Math.round(outerLengthM * 0.52),
        plumeToDeg
      );
      const plumeTipPoint = movePt(originSource.position, outerLengthM, plumeToDeg);

      // Cumulative Lagrangian drift trajectory across Ringparken
      if (offsetHours > 0) {
        const stepDriftMeters = Math.round(28 + hrWeather.windSpeed10m * 5.2);
        cumulativeDriftCenter = movePt(cumulativeDriftCenter, stepDriftMeters, plumeToDeg);
      }

      // Evaluate receptor exposures at this forecast hour (+kt)
      const receptorHits = receptors
        .map((rec) => {
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const toDeg = (rad: number) => (rad * 180) / Math.PI;
          const dLat = (rec.center.lat - originSource.position.lat) * 111320;
          const dLng =
            (rec.center.lng - originSource.position.lng) *
            111320 *
            Math.cos(toRad(originSource.position.lat));
          const distM = Math.max(18, Math.hypot(dLat, dLng));
          const bearingDeg =
            (toDeg(Math.atan2(dLng, dLat)) + 360) % 360;
          let angleDiff = Math.abs(bearingDeg - plumeToDeg) % 360;
          if (angleDiff > 180) angleDiff = 360 - angleDiff;

          // Gaussian lateral decay + downwind decay
          const sigmaAngle = 26 * stabilitySpread;
          const angularWeight = Math.exp(
            -(angleDiff * angleDiff) / (2 * sigmaAngle * sigmaAngle)
          );
          const distWeight = Math.exp(-Math.max(0, distM - 45) / (outerLengthM * 0.85));
          const windAmp =
            0.75 + hrWeather.windSpeed10m * 0.085 + hrWeather.windGusts10m * 0.025;
          const predictedS = Number(
            (2.35 * angularWeight * distWeight * windAmp * rainWashout).toFixed(2)
          );

          return {
            receptorId: rec.id,
            receptorCode: rec.code,
            receptorName: rec.name,
            address: rec.address,
            center: rec.center,
            distM: Math.round(distM),
            angleDiff: Math.round(angleDiff),
            predictedS,
            isHit: predictedS >= 0.5,
            isCritical: predictedS >= 1.0,
          };
        })
        .sort((a, b) => b.predictedS - a.predictedS);

      const peakReceptorAtStep = receptorHits[0];

      return {
        offsetHours,
        labelOffset: offsetHours === 0 ? 'Nu (+0t)' : `+${offsetHours}t`,
        hourIndex: wrappedHourIdx,
        hourLabel: hrWeather.hourLabel,
        isNextDay,
        weather: hrWeather,
        windSpeedMs: hrWeather.windSpeed10m,
        windGustsMs: hrWeather.windGusts10m,
        windFromDeg: hrWeather.windDirection10m,
        windFromCompassLabel,
        plumeToDeg,
        plumeToCompassLabel,
        outerLengthM,
        coreLengthM,
        outerHalfWidthM,
        coreHalfWidthM,
        outerPolygon,
        corePolygon,
        plumeCentroid,
        plumeTipPoint,
        cumulativeDriftPoint: { ...cumulativeDriftCenter },
        receptorHits,
        peakReceptorAtStep,
        maxPredictedS: peakReceptorAtStep ? peakReceptorAtStep.predictedS : 0,
      };
    });

    // Smooth interpolation at current `forecast6hProgress` (0.0 .. 6.0)
    const clampedT = Math.max(0, Math.min(6, forecast6hProgress));
    const idxA = Math.min(5, Math.floor(clampedT));
    const idxB = Math.min(6, idxA + 1);
    const frac = clampedT - idxA;

    const stepA = hourlySteps[idxA];
    const stepB = hourlySteps[idxB];

    const interpolatedOuterPolygon = stepA.outerPolygon.map((ptA, i) =>
      lerpPt(ptA, stepB.outerPolygon[i] || ptA, frac)
    );
    const interpolatedCorePolygon = stepA.corePolygon.map((ptA, i) =>
      lerpPt(ptA, stepB.corePolygon[i] || ptA, frac)
    );
    const interpolatedCentroid = lerpPt(stepA.plumeCentroid, stepB.plumeCentroid, frac);
    const interpolatedTipPoint = lerpPt(stepA.plumeTipPoint, stepB.plumeTipPoint, frac);
    const interpolatedDriftPoint = lerpPt(
      stepA.cumulativeDriftPoint,
      stepB.cumulativeDriftPoint,
      frac
    );

    const interpolatedWindSpeedMs = Number(
      (stepA.windSpeedMs + (stepB.windSpeedMs - stepA.windSpeedMs) * frac).toFixed(1)
    );
    const interpolatedMaxS = Number(
      (stepA.maxPredictedS + (stepB.maxPredictedS - stepA.maxPredictedS) * frac).toFixed(2)
    );

    //Shortest-angle interpolation for plume direction
    let deltaAngle = ((stepB.plumeToDeg - stepA.plumeToDeg + 540) % 360) - 180;
    const interpolatedPlumeDeg = Math.round(
      (stepA.plumeToDeg + deltaAngle * frac + 360) % 360
    );

    // 4 Drifting Dust Cloud Puff Wavefronts moving outward from originSource -> interpolatedTipPoint
    const driftingPuffRings = [0, 0.25, 0.5, 0.75].map((offsetPhase, ringIdx) => {
      const p = (puffWavePhase + offsetPhase) % 1;
      const pos = lerpPt(originSource.position, interpolatedTipPoint, p);
      const radiusMeters = Math.round(14 + p * stepA.outerHalfWidthM * 0.92);
      return {
        id: `puff-wave-${ringIdx}`,
        progress: p,
        position: pos,
        radiusMeters,
        opacity: Number((Math.sin(p * Math.PI) * 0.65).toFixed(2)),
      };
    });

    // Aggregate 6-hour receptor early-warning timeline
    const receptorForecastWarnings = receptors
      .map((rec) => {
        let firstHitStep: (typeof hourlySteps)[number] | null = null;
        let peakStep = hourlySteps[0];
        let peakS = 0;

        for (const st of hourlySteps) {
          const hit = st.receptorHits.find((r) => r.receptorId === rec.id);
          const sVal = hit ? hit.predictedS : 0;
          if (sVal >= 0.5 && !firstHitStep) {
            firstHitStep = st;
          }
          if (sVal > peakS) {
            peakS = sVal;
            peakStep = st;
          }
        }

        const hitA =
          stepA.receptorHits.find((r) => r.receptorId === rec.id)?.predictedS ?? 0;
        const hitB =
          stepB.receptorHits.find((r) => r.receptorId === rec.id)?.predictedS ?? 0;
        const currentInterpolatedS = Number((hitA + (hitB - hitA) * frac).toFixed(2));

        return {
          receptorId: rec.id,
          receptorCode: rec.code,
          receptorName: rec.name,
          address: rec.address,
          center: rec.center,
          firstHitOffsetHours: firstHitStep ? firstHitStep.offsetHours : null,
          firstHitHourLabel: firstHitStep ? firstHitStep.hourLabel : null,
          peakOffsetHours: peakStep.offsetHours,
          peakHourLabel: peakStep.hourLabel,
          peakS,
          currentInterpolatedS,
        };
      })
      .sort((a, b) => b.peakS - a.peakS);

    return {
      originSource,
      hourlySteps,
      clampedT,
      activeStep: frac < 0.5 ? stepA : stepB,
      interpolatedOuterPolygon,
      interpolatedCorePolygon,
      interpolatedCentroid,
      interpolatedTipPoint,
      interpolatedDriftPoint,
      interpolatedWindSpeedMs,
      interpolatedPlumeDeg,
      interpolatedPlumeCompass: degreesToCompass(interpolatedPlumeDeg),
      interpolatedMaxS,
      driftingPuffRings,
      receptorForecastWarnings,
      centroidPathLine: hourlySteps.map((s) => s.plumeCentroid),
      tipTrajectoryLine: hourlySteps.map((s) => s.plumeTipPoint),
    };
  }, [sources, selectedSourceId, receptors, currentWeather, weatherHours, forecast6hProgress, puffWavePhase]);

  // Pre-1997 Building Material Asbestos & Mineral Wool Fiber Deposition Risk Layer
  const asbestosDepositionZones = useMemo(() => {
    const movePt = (origin: LatLngPoint, distM: number, bearingDeg: number): LatLngPoint => {
      const rad = (bearingDeg * Math.PI) / 180;
      const dLat = (distM * Math.cos(rad)) / 111320;
      const dLng = (distM * Math.sin(rad)) / (111320 * Math.cos((origin.lat * Math.PI) / 180));
      return { lat: origin.lat + dLat, lng: origin.lng + dLng };
    };

    const buildLobe = (
      origin: LatLngPoint,
      dirDeg: number,
      lengthM: number,
      maxHalfWidthM: number
    ): LatLngPoint[] => {
      const steps = [0.06, 0.22, 0.45, 0.72, 0.92, 1.0];
      const leftSide: LatLngPoint[] = [movePt(origin, 8, (dirDeg - 90 + 360) % 360)];
      const rightSide: LatLngPoint[] = [movePt(origin, 8, (dirDeg + 90) % 360)];

      for (const s of steps) {
        const d = lengthM * s;
        const w = maxHalfWidthM * Math.sin(s * Math.PI * 0.82);
        const center = movePt(origin, d, dirDeg);
        leftSide.push(movePt(center, w, (dirDeg - 90 + 360) % 360));
        rightSide.push(movePt(center, w, (dirDeg + 90) % 360));
      }
      return [...leftSide, ...rightSide.reverse()];
    };

    // Dry wind (>4 m/s), gusts, and freeze-thaw spalling strongly amplify <1997 asbestos fiber release and transport
    const dryWindFactor =
      currentWeather.precipitation > 2.0
        ? 0.58
        : 1.0 + Math.max(0, currentWeather.windSpeed10m - 3.0) * 0.14 + Math.max(0, currentWeather.windGusts10m - 6.0) * 0.06;
    const freezeThawFactor = currentWeather.hadRecentFreezeThaw ? 1.25 : 1.0;

    return sources
      .filter(
        (src) =>
          src.active &&
          (src.substances.includes('asbestos') || src.substances.includes('quartzWool'))
      )
      .map((src) => {
        const fiberIdx = src.fiberReleaseIndex ?? 0.82;
        const heightFactor = 1.0 + (src.releaseHeightMeters - 8) * 0.07;
        const coreLengthM = Math.round(
          (145 + fiberIdx * 95) * dryWindFactor * freezeThawFactor * heightFactor
        );
        const haloLengthM = Math.round(coreLengthM * 1.48);
        const coreHalfWidthM = Math.round((26 + src.releaseHeightMeters * 2.1) * fiberIdx);
        const haloHalfWidthM = Math.round(coreHalfWidthM * 1.55);

        const corePolygon = buildLobe(src.position, plumeDirectionDeg, coreLengthM, coreHalfWidthM);
        const haloPolygon = buildLobe(src.position, plumeDirectionDeg, haloLengthM, haloHalfWidthM);
        const depositionCentroid = movePt(
          src.position,
          Math.round(coreLengthM * 0.58),
          plumeDirectionDeg
        );

        const airborneConcFibreCm3 = Number(
          (0.0024 * fiberIdx * dryWindFactor * freezeThawFactor).toFixed(4)
        );
        const estimatedDepositionFibreM2 = Math.round(
          18500 * fiberIdx * dryWindFactor * freezeThawFactor * heightFactor
        );
        const buildingParts = src.asbestosBuildingParts ?? [
          src.substanceDetails.asbestos || 'Asbestholdige bygningsdele (<1986/1997)',
          src.substanceDetails.quartzWool || 'Gammel mineraluld (<1997 i tagrum)',
        ];

        return {
          sourceId: src.id,
          sourceCode: src.code,
          sourceName: src.name,
          sourcePosition: src.position,
          constructionYearRange: src.constructionYearRange || 'Opført før 1997 (<1986/1997)',
          materialAgeCategory:
            src.materialAgeCategory || '<1997 Asbest- & Gl. Mineraluldskonstruktion',
          releaseHeightMeters: src.releaseHeightMeters,
          fiberReleaseIndex: fiberIdx,
          probabilityPct: Math.min(99, Math.round(fiberIdx * 100)),
          buildingParts,
          healthRiskCorrelation:
            src.healthRiskCorrelation ||
            'Direkte korrelation mellem nedbrydning af <1997 asbest-/mineraluldsdele og lunge-/mesotheliomrisiko (GV: 0,003 fibre/cm³ jf. BEK 613/2026).',
          airborneConcFibreCm3,
          exceeds2026Limit: airborneConcFibreCm3 >= 0.003,
          estimatedDepositionFibreM2,
          coreLengthM,
          haloLengthM,
          corePolygon,
          haloPolygon,
          depositionCentroid,
        };
      });
  }, [sources, currentWeather, plumeDirectionDeg]);

  // Hydrological Soil Leaching & Groundwater Risk Zones (Accumulated Precipitation + Soil Saturation Degree)
  const groundwaterLeachingData = useMemo(() => {
    const movePt = (origin: LatLngPoint, distM: number, bearingDeg: number): LatLngPoint => {
      const rad = (bearingDeg * Math.PI) / 180;
      const dLat = (distM * Math.cos(rad)) / 111320;
      const dLng = (distM * Math.sin(rad)) / (111320 * Math.cos((origin.lat * Math.PI) / 180));
      return { lat: origin.lat + dLat, lng: origin.lng + dLng };
    };

    const buildLobe = (
      origin: LatLngPoint,
      dirDeg: number,
      lengthM: number,
      maxHalfWidthM: number
    ): LatLngPoint[] => {
      const steps = [0.08, 0.25, 0.5, 0.75, 0.92, 1.0];
      const leftSide: LatLngPoint[] = [movePt(origin, 10, (dirDeg - 90 + 360) % 360)];
      const rightSide: LatLngPoint[] = [movePt(origin, 10, (dirDeg + 90) % 360)];

      for (const s of steps) {
        const d = lengthM * s;
        const w = maxHalfWidthM * Math.sin(s * Math.PI * 0.84);
        const center = movePt(origin, d, dirDeg);
        leftSide.push(movePt(center, w, (dirDeg - 90 + 360) % 360));
        rightSide.push(movePt(center, w, (dirDeg + 90) % 360));
      }
      return [...leftSide, ...rightSide.reverse()];
    };

    const buildEllipse = (
      origin: LatLngPoint,
      radiusMajorM: number,
      radiusMinorM: number,
      rotationDeg: number
    ): LatLngPoint[] => {
      const pts: LatLngPoint[] = [];
      const rotRad = (rotationDeg * Math.PI) / 180;
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const x = radiusMajorM * Math.cos(angle);
        const y = radiusMinorM * Math.sin(angle);
        const rx = x * Math.cos(rotRad) - y * Math.sin(rotRad);
        const ry = x * Math.sin(rotRad) + y * Math.cos(rotRad);
        const dist = Math.hypot(rx, ry);
        const bearing = ((Math.atan2(ry, rx) * 180) / Math.PI + 360) % 360;
        pts.push(movePt(origin, dist, bearing));
      }
      return pts;
    };

    // 1. Accumulated precipitation from 00:00 up to currentWeather.hourIndex + 24h total
    const hoursUpToCurrent =
      weatherHours.length > 0
        ? weatherHours.filter((h) => h.hourIndex <= currentWeather.hourIndex)
        : [currentWeather];
    const rawAccumulatedMm = hoursUpToCurrent.reduce((sum, h) => sum + (h.precipitation || 0), 0);
    const rawTotal24hMm =
      weatherHours.length > 0
        ? weatherHours.reduce((sum, h) => sum + (h.precipitation || 0), 0)
        : currentWeather.precipitation * 6;

    // Effective rainfall & soil moisture based on live data or hydrological stress preset
    const effectiveAccumulatedPrecipMm = Number(
      (
        leachingSimMode === 'cloudburst'
          ? Math.max(36.4, rawAccumulatedMm + 32.0)
          : leachingSimMode === 'saturated_rain'
          ? Math.max(16.8, rawAccumulatedMm + 14.5)
          : Math.max(rawAccumulatedMm, currentWeather.precipitation * 2.5, 4.2)
      ).toFixed(1)
    );

    const effectiveHourlyPrecipMm = Number(
      (
        leachingSimMode === 'cloudburst'
          ? Math.max(18.5, currentWeather.precipitation + 16.0)
          : leachingSimMode === 'saturated_rain'
          ? Math.max(5.4, currentWeather.precipitation + 4.5)
          : currentWeather.precipitation
      ).toFixed(1)
    );

    // Porosity saturation ceiling in Slagelse moraine clay / fill layer (~0.42 m³/m³ = 100% water-filled pore space)
    const rawVolumetricMoisture = currentWeather.soilMoisture0To7cm || 0.28;
    const baseSaturationPct = Math.min(
      100,
      Math.round(
        (rawVolumetricMoisture / 0.42) * 100 +
          Math.min(28, effectiveAccumulatedPrecipMm * 1.15) +
          (currentWeather.hadRecentFreezeThaw ? 7 : 0)
      )
    );

    const globalSoilSaturationPct =
      leachingSimMode === 'cloudburst'
        ? Math.max(95, baseSaturationPct)
        : leachingSimMode === 'saturated_rain'
        ? Math.max(81, baseSaturationPct)
        : Math.max(64, baseSaturationPct);

    // Local subsurface hydraulic gradient in Ringparken Slagelse flows SW (~215°) toward Rødtjørnevej / Valbyvej
    const hydraulicBearingDeg = 215;

    const zones = sources
      .filter((src) => src.active)
      .map((src) => {
        const isOpenExcavationTrench =
          src.id === 'src-kierulffsvej-blok1' ||
          src.substances.includes('moldSewer') ||
          src.releaseHeightMeters <= 4;

        const localSaturationBonus = isOpenExcavationTrench ? 14 : 6;
        const zoneSaturationPct = Math.min(99, globalSoilSaturationPct + localSaturationBonus);

        // Leaching mobilization factor driven by accumulated rainfall + porewater saturation above field capacity (65%)
        const overFieldCapacityFactor =
          1 + Math.max(0, zoneSaturationPct - 60) * 0.038 + effectiveAccumulatedPrecipMm * 0.045;
        const freezeThawCrackFactor = currentWeather.hadRecentFreezeThaw ? 1.24 : 1.0;
        const trenchBypassFactor = isOpenExcavationTrench ? 1.45 : 1.05;

        const compositeLeachingIndex = Number(
          (overFieldCapacityFactor * freezeThawCrackFactor * trenchBypassFactor).toFixed(2)
        );

        // Porewater & leachate concentrations vs. Miljøstyrelsens Grundvandskvalitetskrav (MBL § 19 / § 27)
        // Lead (Pb) GV = 1.0 µg/L | PCB GV = 0.01 µg/L | PAH GV = 0.2 µg/L
        const leadLeachateUgL = Number((0.68 * compositeLeachingIndex).toFixed(2));
        const pcbLeachateUgL = Number(
          ((src.substances.includes('pcb') ? 0.0085 : 0.0035) * compositeLeachingIndex).toFixed(4)
        );
        const pahLeachateUgL = Number((0.13 * compositeLeachingIndex).toFixed(2));
        const infiltrationVelocityCmDay = Number(
          ((18 + effectiveAccumulatedPrecipMm * 2.1) * (zoneSaturationPct / 75) * (isOpenExcavationTrench ? 1.5 : 1.0)).toFixed(1)
        );

        const maxExceedanceRatio = Number(
          Math.max(leadLeachateUgL / 1.0, pcbLeachateUgL / 0.01, pahLeachateUgL / 0.2).toFixed(2)
        );

        const riskSeverity: 'critical' | 'high' | 'moderate' =
          zoneSaturationPct >= 82 || effectiveAccumulatedPrecipMm >= 14 || maxExceedanceRatio >= 1.5
            ? 'critical'
            : zoneSaturationPct >= 70 || effectiveAccumulatedPrecipMm >= 6 || maxExceedanceRatio >= 1.0
            ? 'high'
            : 'moderate';

        const coreMajorM = Math.round(
          (isOpenExcavationTrench ? 46 : 34) * (0.85 + (zoneSaturationPct / 100) * 0.45)
        );
        const coreMinorM = Math.round(coreMajorM * 0.68);
        const plumeLengthM = Math.round(
          (isOpenExcavationTrench ? 128 : 92) *
            (0.8 + (zoneSaturationPct / 100) * 0.55 + Math.min(0.6, effectiveAccumulatedPrecipMm * 0.018))
        );
        const plumeHalfWidthM = Math.round((isOpenExcavationTrench ? 36 : 26) * (0.9 + zoneSaturationPct / 220));

        const excavationCorePolygon = buildEllipse(
          src.position,
          coreMajorM,
          coreMinorM,
          hydraulicBearingDeg
        );
        const aquiferPlumePolygon = buildLobe(
          src.position,
          hydraulicBearingDeg,
          plumeLengthM,
          plumeHalfWidthM
        );
        const plumeFrontPoint = movePt(src.position, Math.round(plumeLengthM * 0.72), hydraulicBearingDeg);

        return {
          sourceId: src.id,
          sourceCode: src.code,
          sourceName: src.name,
          sourcePosition: src.position,
          isOpenExcavationTrench,
          zoneSaturationPct,
          effectiveAccumulatedPrecipMm,
          effectiveHourlyPrecipMm,
          infiltrationVelocityCmDay,
          leadLeachateUgL,
          pcbLeachateUgL,
          pahLeachateUgL,
          maxExceedanceRatio,
          riskSeverity,
          plumeLengthM,
          hydraulicBearingDeg,
          excavationCorePolygon,
          aquiferPlumePolygon,
          plumeFrontPoint,
          geologyDescription: isOpenExcavationTrench
            ? 'Åben kloak-/krybekælder-udgravning (Kierulffsvej 14-22): Direkte præferentiel nedsivning gennem sprækket moræneler til sekundært sandlinse-magasin (7,2–11,8 m u.t.).'
            : 'Blottet forurenet afgravningsfelt med blyholdig maling, PCB-fuger og PAH: Perkolation mod sekundært grundvand (7,2 m) og primært OSD-magasin (16,5 m).',
        };
      })
      .sort((a, b) => b.maxExceedanceRatio - a.maxExceedanceRatio);

    return {
      zones,
      rawAccumulatedMm: Number(rawAccumulatedMm.toFixed(1)),
      rawTotal24hMm: Number(rawTotal24hMm.toFixed(1)),
      effectiveAccumulatedPrecipMm,
      effectiveHourlyPrecipMm,
      globalSoilSaturationPct,
      hydraulicBearingDeg,
      hasHighOrCriticalRisk: zones.some(
        (z) => z.riskSeverity === 'critical' || z.riskSeverity === 'high'
      ),
    };
  }, [sources, currentWeather, weatherHours, leachingSimMode]);

  // Coordinate projection for calibrated tactical satellite/hybrid SVG (viewport 1000 x 720)
  const VIEW_W = 1000;
  const VIEW_H = 720;
  const scaleFactor = Math.pow(2, zoom - 17);
  const PX_PER_DEG_LAT = 195000 * scaleFactor;
  const PX_PER_DEG_LNG = 110800 * scaleFactor;

  const projectLatLng = (pt: LatLngPoint): { x: number; y: number } => {
    const dx = (pt.lng - RINGPARKEN_CENTER.lng) * PX_PER_DEG_LNG;
    const dy = (RINGPARKEN_CENTER.lat - pt.lat) * PX_PER_DEG_LAT;
    return {
      x: VIEW_W / 2 + dx + panOffsetPx.x,
      y: VIEW_H / 2 + dy + panOffsetPx.y,
    };
  };

  // Switch active heatmap layer ('asbestos' | 'dust_deposition' | 'noise_contour')
  const handleSelectHeatmapLayerMode = (mode: TacticalHeatmapLayerMode) => {
    setActiveHeatmapLayerMode(mode);
    setShowAsbestosRiskLayer(mode === 'asbestos');
  };

  // 'Fit to Receptors': automatically updates the 2D Tactical Map viewport (zoom & panOffsetPx) to fit all active receptor zones
  const handleFitToReceptors = () => {
    if (!receptors || receptors.length === 0) return;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const rec of receptors) {
      const pts = rec.polygon && rec.polygon.length > 0 ? [rec.center, ...rec.polygon] : [rec.center];
      for (const p of pts) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      }
    }

    if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return;

    const centerLat = Number(((minLat + maxLat) / 2).toFixed(6));
    const centerLng = Number(((minLng + maxLng) / 2).toFixed(6));
    const latSpan = Math.max(0.001, maxLat - minLat);
    const lngSpan = Math.max(0.0014, maxLng - minLng);

    // Leave generous HUD margin inside the 1000x720 tactical canvas
    const usableW = VIEW_W - 240;
    const usableH = VIEW_H - 200;
    const sfW = usableW / (lngSpan * 110800);
    const sfH = usableH / (latSpan * 195000);
    const targetSf = Math.min(sfW, sfH);
    const computedZoom = 17 + Math.log2(Math.max(0.125, targetSf));
    const nextZoom = Math.max(14.5, Math.min(18.5, Number(computedZoom.toFixed(1))));

    const nextSf = Math.pow(2, nextZoom - 17);
    const dxCenter = (centerLng - RINGPARKEN_CENTER.lng) * 110800 * nextSf;
    const dyCenter = (RINGPARKEN_CENTER.lat - centerLat) * 195000 * nextSf;

    setZoom(nextZoom);
    setPanOffsetPx({
      x: Math.round(-dxCenter),
      y: Math.round(-dyCenter),
    });
    setGmpCenter({ lat: centerLat, lng: centerLng });
    setGmpViewKey((prev) => prev + 1);
    setFittedReceptorBounds({
      minLat,
      maxLat,
      minLng,
      maxLng,
      centerLat,
      centerLng,
    });

    setFittedToReceptorsJustNow(true);
    window.setTimeout(() => {
      setFittedToReceptorsJustNow(false);
    }, 3500);
  };

  // Spatial Heatmap Data for 'dust_deposition' (µg/m²) and 'noise_contour' (dB(A))
  const dustDepositionHeatmapData = useMemo(() => {
    const mLat = 111320;
    const mLng = 111320 * Math.cos((55.4128 * Math.PI) / 180);
    const movePt = (origin: LatLngPoint, distM: number, bearingDeg: number): LatLngPoint => {
      const rad = (bearingDeg * Math.PI) / 180;
      return {
        lat: origin.lat + (distM * Math.cos(rad)) / mLat,
        lng: origin.lng + (distM * Math.sin(rad)) / mLng,
      };
    };
    const buildLobe = (
      origin: LatLngPoint,
      bearingDeg: number,
      lengthM: number,
      halfWidthM: number
    ): LatLngPoint[] => {
      const steps = 18;
      const pts: LatLngPoint[] = [];
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const forward = ((Math.cos(theta) + 1) / 2) * lengthM - 14;
        const cross = Math.sin(theta) * halfWidthM * (0.45 + 0.55 * ((Math.cos(theta) + 1) / 2));
        const p1 = movePt(origin, forward, bearingDeg);
        pts.push(movePt(p1, cross, (bearingDeg + 90) % 360));
      }
      return pts;
    };

    const plumeDir = (currentWeather.windDirection10m + 180) % 360;
    const windFactor = 0.85 + Math.min(0.95, currentWeather.windSpeed10m * 0.08);

    const sourceLobes = sources
      .filter((s) => s.active)
      .map((src) => {
        const outerLen = Math.round(195 * windFactor);
        const midLen = Math.round(135 * windFactor);
        const coreLen = Math.round(82 * windFactor);
        return {
          sourceId: src.id,
          sourceCode: src.code,
          sourceName: src.name,
          sourcePosition: src.position,
          outerPolygon: buildLobe(src.position, plumeDir, outerLen, 64),
          midPolygon: buildLobe(src.position, plumeDir, midLen, 44),
          corePolygon: buildLobe(src.position, plumeDir, coreLen, 28),
          centroid: movePt(src.position, Math.round(midLen * 0.6), plumeDir),
        };
      });

    const receptorNodes = puff24h.receptorSummaries.map((recSum) => {
      const hrDose =
        recSum.hourlyProfile[currentWeather.hourIndex]?.depositedDustUgM2 ??
        Number((recSum.totalDepositedHeavyMetalsAndPcbUgM2 / 24).toFixed(1));
      const total24hUgM2 = recSum.totalDepositedHeavyMetalsAndPcbUgM2;
      const severity: 'danger' | 'elevated' | 'moderate' =
        total24hUgM2 >= 180 ? 'danger' : total24hUgM2 >= 100 ? 'elevated' : 'moderate';
      return {
        receptorId: recSum.receptorId,
        receptorCode: recSum.receptorCode,
        receptorName: recSum.receptorName,
        position: recSum.position,
        total24hUgM2,
        hourlyDustUgM2: hrDose,
        severity,
      };
    });

    return { sourceLobes, receptorNodes };
  }, [sources, currentWeather, puff24h.receptorSummaries]);

  const noiseContourHeatmapData = useMemo(() => {
    const mLat = 111320;
    const mLng = 111320 * Math.cos((55.4128 * Math.PI) / 180);
    const movePt = (origin: LatLngPoint, distM: number, bearingDeg: number): LatLngPoint => {
      const rad = (bearingDeg * Math.PI) / 180;
      return {
        lat: origin.lat + (distM * Math.cos(rad)) / mLat,
        lng: origin.lng + (distM * Math.sin(rad)) / mLng,
      };
    };

    const plumeDir = (currentWeather.windDirection10m + 180) % 360;
    const windSpeed = currentWeather.windSpeed10m;
    const buildRefractedIsoDbRing = (
      origin: LatLngPoint,
      baseRadiusM: number,
      downwindStretchM: number
    ): LatLngPoint[] => {
      const steps = 28;
      const pts: LatLngPoint[] = [];
      for (let i = 0; i <= steps; i++) {
        const angleDeg = (i / steps) * 360;
        const diffRad = ((angleDeg - plumeDir) * Math.PI) / 180;
        // Downwind refraction stretches acoustic contour in wind direction; upwind shadow compresses it
        const r = Math.max(
          18,
          baseRadiusM + Math.cos(diffRad) * downwindStretchM * (0.5 + Math.min(1.1, windSpeed * 0.08))
        );
        pts.push(movePt(origin, r, angleDeg));
      }
      return pts;
    };

    const sourceContours = sources
      .filter((s) => s.active)
      .map((src) => ({
        sourceId: src.id,
        sourceCode: src.code,
        sourceName: src.name,
        sourcePosition: src.position,
        ring70dB: buildRefractedIsoDbRing(src.position, 44, 18),
        ring60dB: buildRefractedIsoDbRing(src.position, 88, 36),
        ring55dB: buildRefractedIsoDbRing(src.position, 138, 56),
        ring45dB: buildRefractedIsoDbRing(src.position, 195, 78),
        label55Pt: movePt(src.position, 138 + Math.round(32 * Math.min(1.2, windSpeed * 0.09)), plumeDir),
        label70Pt: movePt(src.position, 46 + Math.round(12 * Math.min(1.2, windSpeed * 0.09)), plumeDir),
      }));

    const activeSrc = sources.find((s) => s.active) || sources[0];
    const baseMachineryNoiseSourceDb = 84.5;
    const receptorNoiseNodes = receptors.map((rec) => {
      const dx = (rec.center.lng - activeSrc.position.lng) * mLng;
      const dy = (rec.center.lat - activeSrc.position.lat) * mLat;
      const distM = Math.max(35, Math.round(Math.hypot(dx, dy)));
      const bearingDeg = Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360);
      const rawDiff = Math.abs(bearingDeg - plumeDir);
      const angleOffWindDeg = Math.round(rawDiff > 180 ? 360 - rawDiff : rawDiff);
      const cosAlign = Math.cos((angleOffWindDeg * Math.PI) / 180);
      const windRefrDb = cosAlign * (windSpeed * 0.34);
      const tempRefrDb =
        currentWeather.pasquillClass === 'F' || currentWeather.pasquillClass === 'E' ? 1.2 : 0.3;
      const totalRefrDb = Number((windRefrDb + tempRefrDb).toFixed(1));
      const distAttenDb = 20 * Math.log10(Math.max(25, distM)) - 11;
      const barrierAttenDb = Math.max(2.0, 9.5 - Math.max(0, totalRefrDb) * 1.15);
      const correctedLaeqDb = Number(
        (baseMachineryNoiseSourceDb - distAttenDb - barrierAttenDb + totalRefrDb).toFixed(1)
      );
      const impulsePeakLafmaxDb = Number(
        (correctedLaeqDb + 14.5 + Math.max(0, (currentWeather.windGusts10m - 8) * 0.45)).toFixed(1)
      );
      return {
        receptorId: rec.id,
        receptorCode: rec.code,
        receptorName: rec.name,
        position: rec.center,
        correctedLaeqDb,
        impulsePeakLafmaxDb,
        totalRefrDb,
        exceeds55dB: correctedLaeqDb >= 55.0,
      };
    });

    return { sourceContours, receptorNoiseNodes };
  }, [sources, receptors, currentWeather]);

  // Real-Time Bornitz (DIN 4150-3:2016) Vibration Intensity Heatmap correlated with heavy machinery sources
  const vibrationHeatmapData = useMemo(() => {
    const mLat = 111320;
    const mLng = 111320 * Math.cos((RINGPARKEN_CENTER.lat * Math.PI) / 180);
    const activeMachinery = sources.filter((s) => s.active);
    const evalSources = activeMachinery.length > 0 ? activeMachinery : sources.slice(0, 1);

    const machineDb = Math.max(85, machineNoiseOutputDb || 114);
    const dbFactor = Math.pow(10, (machineDb - 114) / 22);
    const soilSaturationAmp = currentWeather.precipitation > 2 ? 1.14 : 1.04;
    const plateDamping = hasSteelRoadPlates ? 0.72 : 1.0;
    const alphaClay = 0.036;
    const v0Reference = 26.5;

    const evalPointPpvMmPerSec = (lat: number, lng: number): { totalPpv: number; dominantSourceId: string } => {
      let sumSquares = 0;
      let maxSingle = -1;
      let dominantSourceId = evalSources[0]?.id || '';
      for (const src of evalSources) {
        const dx = (lng - src.position.lng) * mLng;
        const dy = (lat - src.position.lat) * mLat;
        const horizM = Math.hypot(dx, dy);
        const r3D = Math.max(2.0, Math.hypot(horizM, 1.65));
        const sourceScale = src.active
          ? Math.max(0.7, Math.min(1.45, src.sourceEmissionFactor ?? 1.0))
          : 0.25;
        const ppv =
          v0Reference *
          dbFactor *
          sourceScale *
          soilSaturationAmp *
          plateDamping *
          Math.pow(2.0 / r3D, 0.55) *
          Math.exp(-alphaClay * Math.max(0, r3D - 2.0));
        sumSquares += ppv * ppv;
        if (ppv > maxSingle) {
          maxSingle = ppv;
          dominantSourceId = src.id;
        }
      }
      return {
        totalPpv: Number(Math.min(95, Math.sqrt(sumSquares)).toFixed(2)),
        dominantSourceId,
      };
    };

    const ppvColorForLevel = (ppv: number): { fill: string; stroke: string; opacity: number; label: string } => {
      if (ppv >= 20) {
        return {
          fill: '#e11d48',
          stroke: '#fda4af',
          opacity: Math.min(0.62, 0.36 + (ppv - 20) * 0.012),
          label: 'Kritisk ≥20 mm/s (DIN 4150-3 R1)',
        };
      }
      if (ppv >= 10) {
        return {
          fill: '#f97316',
          stroke: '#fdba74',
          opacity: 0.34 + ((ppv - 10) / 10) * 0.14,
          label: 'Høj 10–20 mm/s',
        };
      }
      if (ppv >= 5) {
        return {
          fill: '#facc15',
          stroke: '#fef08a',
          opacity: 0.24 + ((ppv - 5) / 5) * 0.12,
          label: 'Over Bolig-grænse ≥5 mm/s (DIN R2)',
        };
      }
      return {
        fill: '#06b6d4',
        stroke: '#67e8f9',
        opacity: Math.max(0.08, (ppv / 5) * 0.2),
        label: 'Lav <5 mm/s',
      };
    };

    const latMin = 55.4112;
    const latMax = 55.4151;
    const lngMin = 11.3484;
    const lngMax = 11.3586;
    const rows = 16;
    const cols = 22;
    const dLat = (latMax - latMin) / rows;
    const dLng = (lngMax - lngMin) / cols;

    const gridCells: Array<{
      id: string;
      nw: LatLngPoint;
      se: LatLngPoint;
      ppv: number;
      fill: string;
      opacity: number;
    }> = [];

    let peakGridPpv = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cLat = latMin + (r + 0.5) * dLat;
        const cLng = lngMin + (c + 0.5) * dLng;
        const { totalPpv } = evalPointPpvMmPerSec(cLat, cLng);
        if (totalPpv > peakGridPpv) peakGridPpv = totalPpv;
        if (totalPpv < 1.25) continue;
        const style = ppvColorForLevel(totalPpv);
        gridCells.push({
          id: `vib-cell-${r}-${c}`,
          nw: { lat: latMin + (r + 1) * dLat, lng: lngMin + c * dLng },
          se: { lat: latMin + r * dLat, lng: lngMin + (c + 1) * dLng },
          ppv: totalPpv,
          fill: style.fill,
          opacity: Number(style.opacity.toFixed(2)),
        });
      }
    }

    const solveRadiusForTargetPpv = (targetPpv: number, sourceScale: number): number => {
      const peakAt2m = v0Reference * dbFactor * sourceScale * soilSaturationAmp * plateDamping;
      if (peakAt2m <= targetPpv) return 0;
      let low = 2.0;
      let high = 160.0;
      for (let i = 0; i < 14; i++) {
        const mid = (low + high) * 0.5;
        const val =
          peakAt2m * Math.pow(2.0 / mid, 0.55) * Math.exp(-alphaClay * Math.max(0, mid - 2.0));
        if (val > targetPpv) low = mid;
        else high = mid;
      }
      return Number(((low + high) * 0.5).toFixed(1));
    };

    const buildGeoRing = (origin: LatLngPoint, radiusM: number): LatLngPoint[] => {
      const pts: LatLngPoint[] = [];
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        pts.push({
          lat: origin.lat + (radiusM * Math.cos(ang)) / mLat,
          lng: origin.lng + (radiusM * Math.sin(ang)) / mLng,
        });
      }
      return pts;
    };

    const sourceRings = activeMachinery.map((src) => {
      const sourceScale = Math.max(0.7, Math.min(1.45, src.sourceEmissionFactor ?? 1.0));
      const peakSourcePpv = Number(
        (v0Reference * dbFactor * sourceScale * soilSaturationAmp * plateDamping).toFixed(1)
      );
      const r5M = solveRadiusForTargetPpv(5.0, sourceScale);
      const r20M = solveRadiusForTargetPpv(20.0, sourceScale);
      return {
        sourceId: src.id,
        sourceCode: src.code,
        position: src.position,
        peakSourcePpv,
        radius5M: r5M,
        radius20M: r20M,
        ring5MmS: r5M > 2 ? buildGeoRing(src.position, r5M) : [],
        ring20MmS: r20M > 2 ? buildGeoRing(src.position, r20M) : [],
      };
    });

    const buildingBreaches = buildings
      .map((b) => {
        const { totalPpv } = evalPointPpvMmPerSec(b.center.lat, b.center.lng);
        const thresholdMmS =
          b.category === 'a_inhabited' || b.category === 'b_vacant' ? 5.0 : 20.0;
        return {
          buildingId: b.id,
          code: b.code,
          name: b.name,
          center: b.center,
          ppvMmPerSec: totalPpv,
          thresholdMmS,
          isBreached: totalPpv >= thresholdMmS,
        };
      })
      .filter((b) => b.isBreached);

    const maxPpvMmPerSec = Number(
      Math.max(
        peakGridPpv,
        waterMainTelemetry?.pipePpvMmPerSec ?? 0,
        ...sourceRings.map((s) => s.peakSourcePpv),
        ...buildingBreaches.map((b) => b.ppvMmPerSec)
      ).toFixed(1)
    );

    return {
      gridCells,
      sourceRings,
      buildingBreaches,
      maxPpvMmPerSec,
      machineDb,
      plateDamping,
    };
  }, [
    sources,
    buildings,
    machineNoiseOutputDb,
    currentWeather.precipitation,
    hasSteelRoadPlates,
    waterMainTelemetry?.pipePpvMmPerSec,
  ]);

  // Wind > 10 m/s CSS Dust Plume Spread Animation Targets (prioritizes selectedSourceId + active sources)
  const windOver10MsPlumeData = useMemo(() => {
    const isHighWindActive = currentWeather.windSpeed10m > 10;
    if (!isHighWindActive) {
      return {
        isActive: false,
        plumeDirectionDeg: (currentWeather.windDirection10m + 180) % 360,
        targetSources: [] as Array<{
          source: DemolitionSourceNode;
          isSelected: boolean;
          tipPoint: LatLngPoint;
          plumeDurationSec: number;
          streakDurationSec: number;
        }>,
      };
    }

    const mLat = 111320;
    const mLng = 111320 * Math.cos((RINGPARKEN_CENTER.lat * Math.PI) / 180);
    const plumeDirectionDeg = (currentWeather.windDirection10m + 180) % 360;
    const rad = (plumeDirectionDeg * Math.PI) / 180;
    const reachMeters = Math.min(240, Math.max(115, 95 + (currentWeather.windSpeed10m - 10) * 14));
    const plumeDurationSec = Number(Math.max(0.95, 22 / currentWeather.windSpeed10m).toFixed(2));
    const streakDurationSec = Number(Math.max(0.65, 13 / currentWeather.windSpeed10m).toFixed(2));

    const activeList = visibleSources.filter((s) => s.active);
    const selectedSrc = selectedSourceId
      ? visibleSources.find((s) => s.id === selectedSourceId)
      : undefined;
    const prioritized = selectedSrc
      ? [selectedSrc, ...activeList.filter((s) => s.id !== selectedSrc.id)]
      : activeList.length > 0
      ? activeList
      : visibleSources.slice(0, 1);

    const targetSources = prioritized.map((src) => ({
      source: src,
      isSelected: src.id === selectedSourceId,
      tipPoint: {
        lat: src.position.lat + (reachMeters * Math.cos(rad)) / mLat,
        lng: src.position.lng + (reachMeters * Math.sin(rad)) / mLng,
      },
      plumeDurationSec,
      streakDurationSec,
    }));

    return {
      isActive: true,
      plumeDirectionDeg,
      targetSources,
    };
  }, [
    visibleSources,
    selectedSourceId,
    currentWeather.windSpeed10m,
    currentWeather.windDirection10m,
  ]);

  const unprojectPx = (x: number, y: number): LatLngPoint => {
    const lng = RINGPARKEN_CENTER.lng + (x - VIEW_W / 2 - panOffsetPx.x) / PX_PER_DEG_LNG;
    const lat = RINGPARKEN_CENTER.lat - (y - VIEW_H / 2 - panOffsetPx.y) / PX_PER_DEG_LAT;
    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    };
  };

  const polygonToSvgPoints = (pts: LatLngPoint[]): string =>
    pts
      .map((p) => {
        const { x, y } = projectLatLng(p);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mapClickMode !== 'none') return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panOffsetPx.x,
      panY: panOffsetPx.y,
    };
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const relY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
      setCursorLatLng(unprojectPx(relX, relY));
    }
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffsetPx({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleSvgMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (isLeakPinDropMode && waterMainTelemetry) {
      const rect = svgRef.current.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const relY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
      const pt = unprojectPx(relX, relY);
      handlePlaceVirtualLeakPinAtPoint(pt);
      return;
    }
    if (mapClickMode === 'none') return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const relY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const pt = unprojectPx(relX, relY);
    onMapAddNode(
      pt,
      mapClickMode === 'add_source'
        ? 'source'
        : mapClickMode === 'add_receptor'
        ? 'receptor'
        : 'observation'
    );
  };

  const exposureByReceptorId = useMemo(() => {
    const recMap: Record<string, ReceptorExposureResult> = {};
    for (const exp of receptorExposures) {
      recMap[exp.receptorId] = exp;
    }
    return recMap;
  }, [receptorExposures]);

  const peakReceptor = puff24h.peakReceptor;

  // Authentic street centerlines for Ringparken 4200 Slagelse for hybrid map calibration
  const streetNetwork = useMemo(
    () => [
      {
        name: 'Ndr. Ringgade',
        width: 14,
        pts: [
          { lat: 55.41465, lng: 11.3485 },
          { lat: 55.41445, lng: 11.3532 },
          { lat: 55.41465, lng: 11.3635 },
        ],
      },
      {
        name: 'Valbyvej (Cykelsti & Hovedfærdselsåre)',
        width: 15,
        pts: [
          { lat: 55.41165, lng: 11.3485 },
          { lat: 55.41125, lng: 11.3515 },
          { lat: 55.41195, lng: 11.3568 },
        ],
      },
      {
        name: 'Kierulffsvej',
        width: 10,
        pts: [
          { lat: 55.41285, lng: 11.3512 },
          { lat: 55.41285, lng: 11.3536 },
          { lat: 55.4131, lng: 11.3556 },
        ],
      },
      {
        name: 'Albert Ibsensvej',
        width: 9,
        pts: [
          { lat: 55.4142, lng: 11.3551 },
          { lat: 55.4126, lng: 11.3552 },
          { lat: 55.4116, lng: 11.3554 },
        ],
      },
      {
        name: 'Jaco Dampes Vej',
        width: 9,
        pts: [
          { lat: 55.4144, lng: 11.3508 },
          { lat: 55.4128, lng: 11.3511 },
          { lat: 55.4113, lng: 11.3512 },
        ],
      },
      {
        name: 'Rødtjørnevej (C962+VV)',
        width: 9,
        pts: [
          { lat: 55.4125, lng: 11.3512 },
          { lat: 55.4122, lng: 11.3522 },
          { lat: 55.4118, lng: 11.3532 },
        ],
      },
      {
        name: 'Nordre Stationsvej (Slagelse Station)',
        width: 12,
        pts: [
          { lat: 55.4081, lng: 11.3505 },
          { lat: 55.40795, lng: 11.35265 },
          { lat: 55.4078, lng: 11.3562 },
        ],
      },
      {
        name: 'Nørrevangstorvet (Nordskolen)',
        width: 10,
        pts: [
          { lat: 55.41465, lng: 11.3624 },
          { lat: 55.41585, lng: 11.3662 },
          { lat: 55.4164, lng: 11.3678 },
        ],
      },
      {
        name: 'Østerbro (Vestsjællandscentret)',
        width: 12,
        pts: [
          { lat: 55.4052, lng: 11.3565 },
          { lat: 55.40485, lng: 11.35965 },
          { lat: 55.4045, lng: 11.3628 },
        ],
      },
      {
        name: 'Rådhuspladsen (Slagelse Rådhus)',
        width: 11,
        pts: [
          { lat: 55.4041, lng: 11.3525 },
          { lat: 55.40385, lng: 11.35415 },
          { lat: 55.4037, lng: 11.3562 },
        ],
      },
    ],
    []
  );

  // Memoized SVG Geometry Projections (decoupled from timeline slider / weather updates during playback)
  const memoizedSvgBaseGeometry = useMemo(() => {
    const sf = Math.pow(2, zoom - 17);
    const pxLat = 195000 * sf;
    const pxLng = 110800 * sf;
    const proj = (pt: LatLngPoint) => ({
      x: 500 + (pt.lng - RINGPARKEN_CENTER.lng) * pxLng + panOffsetPx.x,
      y: 360 + (RINGPARKEN_CENTER.lat - pt.lat) * pxLat + panOffsetPx.y,
    });
    const toSvgPts = (pts: LatLngPoint[]) =>
      pts
        .map((p) => {
          const { x, y } = proj(p);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    const streets = streetNetwork.map((st) => {
      const pts = st.pts.map(proj);
      const d = pts
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');
      const mid = pts[1] || pts[0];
      return {
        name: st.name,
        strokeWidth: st.width * sf,
        d,
        midX: mid.x,
        midY: mid.y,
      };
    });

    const receptorSvgPointsById: Record<string, string> = {};
    for (const rec of receptors) {
      receptorSvgPointsById[rec.id] = toSvgPts(rec.polygon);
    }

    const buildingsProjected = visibleBuildings.map((b) => ({
      building: b,
      meta: BUILDING_CATEGORY_METADATA[b.category],
      cPx: proj(b.center),
      points: toSvgPts(b.footprint),
    }));

    return {
      streets,
      receptorSvgPointsById,
      buildingsProjected,
    };
  }, [streetNetwork, receptors, visibleBuildings, zoom, panOffsetPx]);

  // Auto-pan tactical canvas when selecting a receptor outside current viewport
  useEffect(() => {
    if (!selectedReceptorId) return;
    const rec = receptors.find((r) => r.id === selectedReceptorId);
    if (!rec) return;
    const sf = Math.pow(2, zoom - 17);
    const pxLat = 195000 * sf;
    const pxLng = 110800 * sf;
    const dx = (rec.center.lng - RINGPARKEN_CENTER.lng) * pxLng;
    const dy = (RINGPARKEN_CENTER.lat - rec.center.lat) * pxLat;
    const curX = VIEW_W / 2 + dx + panOffsetPx.x;
    const curY = VIEW_H / 2 + dy + panOffsetPx.y;
    if (curX < 90 || curX > VIEW_W - 90 || curY < 90 || curY > VIEW_H - 90) {
      setPanOffsetPx({
        x: -dx,
        y: -dy,
      });
    }
  }, [selectedReceptorId, receptors, zoom]);

  return (
    <div
      className={
        internalMapOnly && isMapOnly === undefined
          ? 'fixed inset-0 z-[120] w-screen h-screen bg-[#07090E] overflow-hidden select-none flex flex-col'
          : 'relative w-full h-full bg-[#07090E] overflow-hidden select-none flex flex-col'
      }
    >
      {/* Top Map HUD Overlay: Wind Vector, Mode Indicator & Interactive Map Tools */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
        {/* Left HUD: Animated Wind Vector & Pasquill Stability (Vejrrubrik på Kort) */}
        {!effectiveMapOnly && (
        <div
          data-map-window="wind_hud"
          onMouseDown={() =>
            mapWindowStates.wind_hud.isReleased && handleFocusMapWindow('wind_hud')
          }
          style={
            mapWindowStates.wind_hud.isReleased
              ? {
                  position: 'fixed',
                  left: `${mapWindowStates.wind_hud.x}px`,
                  top: `${mapWindowStates.wind_hud.y}px`,
                  zIndex: mapWindowStates.wind_hud.zIndex,
                }
              : undefined
          }
          className={`pointer-events-auto rounded-md px-3.5 py-2.5 shadow-lg transition-colors border ${
            mapWindowStates.wind_hud.isReleased ? 'ring-2 ring-cyan-400/80 shadow-2xl' : ''
          } ${
            currentWeather.windSpeed10m > 10
              ? 'bg-rose-950/90 border-rose-500 ring-1 ring-rose-400/70'
              : 'bg-[#0B0E17]/95 border-slate-800'
          }`}
        >
          <MapOverlayWindowControlStrip
            windowId="wind_hud"
            title="Vindvektor & Atmosfærisk Stabilitet (Kort-HUD)"
            badgeText={`${currentWeather.windSpeed10m} m/s · PG-${currentWeather.pasquillClass}`}
            accentColorClass="text-cyan-300"
            state={mapWindowStates.wind_hud}
            onToggleMinimize={handleToggleMapWindowMinimize}
            onToggleRelease={handleToggleMapWindowRelease}
            onMove={handleMoveMapWindow}
            onFocus={handleFocusMapWindow}
          />
          {!mapWindowStates.wind_hud.isMinimized && (
            <div className="flex items-center gap-4">
              <div
                className={`relative w-12 h-12 rounded-full border flex items-center justify-center shrink-0 ${
                  currentWeather.windSpeed10m > 10
                    ? 'border-rose-400 bg-rose-950/90'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'
                }`}
              >
                <span className="absolute top-0.5 text-[11px] font-mono text-slate-200">N</span>
                <span className="absolute bottom-0.5 text-[11px] font-mono text-slate-300">S</span>
                <span className="absolute right-1 text-[11px] font-mono text-slate-300">Ø</span>
                <span className="absolute left-1 text-[11px] font-mono text-slate-300">V</span>
                <div
                  className="w-8 h-8 flex items-center justify-center transition-transform duration-300"
                  style={{ transform: `rotate(${plumeDirectionDeg}deg)` }}
                  title={`Vind fra ${currentWeather.windDirection10m}° (${windFromCompass}) → Spredningsfane mod ${plumeDirectionDeg}° (${plumeToCompass})`}
                >
                  <Navigation
                    className={`w-5 h-5 ${
                      currentWeather.windSpeed10m > 10
                        ? 'text-white fill-white/40'
                        : 'text-cyan-400 fill-cyan-400/30'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">Ringparken, 4200 Slagelse</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">55.4128°N, 11.3533°E</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span
                    className={
                      currentWeather.windSpeed10m > 10
                        ? 'bg-rose-600 text-white font-bold px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1'
                        : 'text-sky-300 font-semibold'
                    }
                  >
                    {currentWeather.windSpeed10m > 10 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
                    )}
                    <span>
                      Vind: {currentWeather.windSpeed10m} m/s (stød {currentWeather.windGusts10m} m/s)
                    </span>
                    {currentWeather.windSpeed10m > 10 && (
                      <span className="ml-1 px-1 py-0.2 rounded bg-slate-950/90 text-rose-200 text-[11px] font-extrabold uppercase">
                        ⚠ HØJRISIKO (&gt; 10 m/s)
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="text-slate-300">
                    Fra {currentWeather.windDirection10m}° ({windFromCompass}) → Fane{' '}
                    {plumeDirectionDeg}° ({plumeToCompass})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span>Pasquill-Gifford: Klasse {currentWeather.pasquillClass}</span>
                  <span aria-hidden="true">·</span>
                  <span>Temp: {currentWeather.temperature2m}°C</span>
                  <span aria-hidden="true">·</span>
                  <span>Sol: {currentWeather.directRadiation} W/m²</span>
                  <span aria-hidden="true">·</span>
                  <span>Nedbør: {currentWeather.precipitation} mm/t</span>
                  <button
                    type="button"
                    onClick={handleExportSelectedDayWeatherJson}
                    className={`ml-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                      weatherJsonExportedJustNow
                        ? 'bg-emerald-400 text-slate-950 border-white'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border-emerald-400/60'
                    }`}
                    title="Eksportér alle vejrdata og vej-/receptordata for den valgte dag som en JSON-fil til brug i eksterne analyseværktøjer"
                  >
                    {weatherJsonExportedJustNow ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>✓ 24t Vejrdata JSON Eksporteret!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3 text-emerald-300" />
                        <span>Eksportér Vejrdata (JSON)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Separate Box Next to Vejrrubrikken på Kort: 24-Hour Animated Wind Speed & Direction Visualization */}
        {!effectiveMapOnly && weatherHours.length > 0 && (
          <Animated24hWindWidget
            hours={weatherHours}
            currentWeather={currentWeather}
            dateIso={currentWeather.isoTime ? currentWeather.isoTime.slice(0, 10) : puff24h.dateIso}
            onSelectHour={
              onSelectHourFromPeak
                ? (hr) => {
                    myceliumLiveAlerts.notifyTimelineScrub();
                    onSelectHourFromPeak(hr);
                  }
                : undefined
            }
            onExportWeatherJson={handleExportSelectedDayWeatherJson}
            jsonExportedJustNow={weatherJsonExportedJustNow}
            variant="map-hud-box"
          />
        )}

        {/* Right HUD: Map Click Controls (Add Custom Source / Receptor) & Layer Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-[#0B0E17]/95 border border-slate-800 rounded-md p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() =>
              onSetMapClickMode(mapClickMode === 'add_source' ? 'none' : 'add_source')
            }
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              mapClickMode === 'add_source'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>
              {mapClickMode === 'add_source' ? 'Klik på kortet: Ny Kilde...' : '+ Ny Kilde på Kort'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onSetMapClickMode(mapClickMode === 'add_receptor' ? 'none' : 'add_receptor')
            }
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              mapClickMode === 'add_receptor'
                ? 'bg-cyan-600 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>
              {mapClickMode === 'add_receptor'
                ? 'Klik på kortet: Nyt Målepunkt...'
                : '+ Nyt Målepunkt (Receptor)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onSetMapClickMode(mapClickMode === 'add_observation' ? 'none' : 'add_observation')
            }
            className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              mapClickMode === 'add_observation'
                ? 'bg-fuchsia-500 text-slate-950 shadow-sm'
                : 'bg-fuchsia-950/80 text-fuchsia-200 hover:bg-fuchsia-900 border border-fuchsia-500/50'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>
              {mapClickMode === 'add_observation'
                ? 'Klik på kortet: Vælg Observationspunkt...'
                : '+ Algedonisk Signal / Observation'}
            </span>
          </button>

          {/* NEW: 'Snapshot Map' Forensic Tool Button */}
          <button
            type="button"
            onClick={handleSaveMapSnapshotToObservations}
            className={`px-2.5 py-1.5 rounded text-xs font-mono font-extrabold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer border shadow-sm ${
              mapSnapshotSavedJustNow
                ? 'bg-emerald-400 text-slate-950 border-emerald-200 ring-1 ring-emerald-300'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200'
            }`}
            title={`Snapshot Map — Gem aktuelt 2D kort-udsnit (Zoom Z:${zoom.toFixed(1)}, geografiske grænser/bounds og aktive kortlag) som tidsstemplet retsmedicinsk observation i Algedonisk Observationslog`}
          >
            {mapSnapshotSavedJustNow ? (
              <>
                <Check className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>Snapshot Map Gemt i Beviser (Z:{zoom.toFixed(1)})</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>Snapshot Map (Gem Kort som Bevis)</span>
              </>
            )}
          </button>

          {/* NEW: 'Fit to Receptors' Button in Top-Right Tactical Map Toolbar */}
          <button
            type="button"
            onClick={handleFitToReceptors}
            aria-label="Fit to Receptors"
            data-action="fit-to-receptors"
            className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer border ${
              fittedToReceptorsJustNow
                ? 'bg-emerald-400 text-slate-950 border-white shadow-sm'
                : 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border-cyan-500/60 shadow-xs'
            }`}
            title={`Fit to Receptors — Tilpas automatisk 2D kort-viewport (zoom og centrering) så alle ${receptors.length} aktive receptorzoner er synlige`}
          >
            <Target className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span>
              {fittedToReceptorsJustNow
                ? `Fit to Receptors (${receptors.length} Receptorer)`
                : `Fit to Receptors (${receptors.length})`}
            </span>
          </button>

          {/* NEW: Layer Toggle Menu ('asbestos' | 'dust_deposition' | 'noise_contour' Heatmaps) */}
          <div
            role="group"
            aria-label="Heatmap Layer Toggle Menu"
            className="relative flex items-center gap-1 bg-slate-950/95 border border-cyan-500/50 rounded-md p-0.5 shrink-0"
          >
            <button
              type="button"
              onClick={() => setIsHeatmapLayerMenuOpen((prev) => !prev)}
              className="px-2 py-1 rounded text-[11px] font-mono font-bold text-cyan-200 hover:bg-slate-900 flex items-center gap-1 cursor-pointer"
              title="Åbn Heatmap-Lag vælger ('asbestos', 'dust_deposition', 'noise_contour')"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Heatmap-Lag:</span>
            </button>

            <select
              aria-label="Select Heatmap Layer"
              value={activeHeatmapLayerMode}
              onChange={(e) =>
                handleSelectHeatmapLayerMode(e.target.value as TacticalHeatmapLayerMode)
              }
              className="bg-slate-900 text-cyan-200 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold cursor-pointer focus:outline-none focus:border-cyan-400"
            >
              <option value="asbestos">asbestos (Asbest)</option>
              <option value="dust_deposition">dust_deposition (Støv µg/m²)</option>
              <option value="noise_contour">noise_contour (Støjkontur dB)</option>
            </select>

            <button
              type="button"
              data-heatmap-layer="asbestos"
              onClick={() => handleSelectHeatmapLayerMode('asbestos')}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                activeHeatmapLayerMode === 'asbestos'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'bg-slate-900 text-emerald-300/85 hover:text-emerald-200 border border-slate-800'
              }`}
              title="Skift til 'asbestos' heatmap-lag (<1997 asbest-fiberdeposition i fibre/m² & fibre/cm³)"
            >
              <Biohazard className="w-3 h-3 shrink-0" />
              <span>asbestos</span>
            </button>

            <button
              type="button"
              data-heatmap-layer="dust_deposition"
              onClick={() => handleSelectHeatmapLayerMode('dust_deposition')}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                activeHeatmapLayerMode === 'dust_deposition'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-slate-900 text-amber-300/85 hover:text-amber-200 border border-slate-800'
              }`}
              title="Skift til 'dust_deposition' heatmap-lag (24t kumulativ støv-, bly- & PCB-deponering i µg/m²)"
            >
              <Flame className="w-3 h-3 shrink-0" />
              <span>dust_deposition (µg/m²)</span>
            </button>

            <button
              type="button"
              data-heatmap-layer="noise_contour"
              onClick={() => handleSelectHeatmapLayerMode('noise_contour')}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                activeHeatmapLayerMode === 'noise_contour'
                  ? 'bg-fuchsia-400 text-slate-950 shadow-xs'
                  : 'bg-slate-900 text-fuchsia-300/85 hover:text-fuchsia-200 border border-slate-800'
              }`}
              title="Skift til 'noise_contour' heatmap-lag (vind-refrakterede akustiske støjkonturer i dB(A) iht. ISO 9613-2 / Nord2000)"
            >
              <Volume2 className="w-3 h-3 shrink-0" />
              <span>noise_contour (dB)</span>
            </button>

            {isHeatmapLayerMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 rounded-md bg-[var(--surface-overlay)] border border-[var(--border-subtle)] shadow-lg p-2.5 z-50 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[11px] font-extrabold uppercase text-cyan-300">
                    Vælg Aktivt 2D Heatmap-Lag
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsHeatmapLayerMenuOpen(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {(
                  [
                    {
                      id: 'asbestos' as const,
                      title: "1. 'asbestos' — Asbest-Risikolag (<1997)",
                      subtitle:
                        'Bygningsmateriale-alder (<1997), asbest-fiberdeposition (fibre/m²) og 2026-grænseværdi (0,003 fibre/cm³).',
                      badge: 'Fibre/m²',
                      activeClass: 'border-emerald-400 bg-emerald-950/50 text-emerald-200',
                    },
                    {
                      id: 'dust_deposition' as const,
                      title: "2. 'dust_deposition' — Støv-Deponering (µg/m²)",
                      subtitle:
                        '24-timers kumulativ og timebaseret støv-, tungmetal- og PCB-deponering (µg/m²) ved alle receptorer.',
                      badge: `${puff24h.peakReceptor.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)} µg/m²`,
                      activeClass: 'border-amber-400 bg-amber-950/50 text-amber-200',
                    },
                    {
                      id: 'noise_contour' as const,
                      title: "3. 'noise_contour' — Akustisk Støjkontur (dB(A))",
                      subtitle:
                        'Vind-refrakterede iso-dB støjkonturer (45 / 55 / 60 / 70 dB(A)) samt L_Aeq,korr & L_AFmax ved receptorer.',
                      badge: '45–70 dB(A)',
                      activeClass: 'border-fuchsia-400 bg-fuchsia-950/50 text-fuchsia-200',
                    },
                  ]
                ).map((item) => {
                  const isAct = activeHeatmapLayerMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        handleSelectHeatmapLayerMode(item.id);
                        setIsHeatmapLayerMenuOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded border transition-all cursor-pointer space-y-0.5 ${
                        isAct
                          ? item.activeClass
                          : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[11px] text-white">{item.title}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-700 text-[11px] font-bold">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{item.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAsbestosRiskLayer((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              showAsbestosRiskLayer
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/60 shadow-xs'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
            title="Vis/skjul Asbest-Risikolag (<1997 bygningsmateriale-alder, fiberdeposition & sundhedsrisiko)"
          >
            <Biohazard className="w-3.5 h-3.5 shrink-0" />
            <span>Asbest-Risikolag (&lt;1997)</span>
          </button>

          <button
            type="button"
            onClick={() => setShow24hParticleAccumulationHeatmap((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              show24hParticleAccumulationHeatmap
                ? 'bg-rose-500/30 text-rose-200 border border-rose-400 shadow-sm ring-1 ring-rose-400/50'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-rose-500/50'
            }`}
            title="Aktivér et visuelt 24-timers akkumuleret støv- og asbestpartikel-heatmap baseret på puff-simuleringen"
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span>24t Akkumuleret Støv &amp; Asbest Heatmap (Puff)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGroundwaterLeachingWarning((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              showGroundwaterLeachingWarning
                ? groundwaterLeachingData.zones[0]?.riskSeverity === 'critical'
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400 shadow-sm'
                  : 'bg-sky-500/25 text-sky-200 border border-sky-400/70 shadow-xs'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
            title="Vis/skjul visuel advarsel på kortet for hydrologisk udvaskning af forurenet jord til grundvandet (baseret på akkumuleret nedbør og jordens mætningsgrad)"
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-300" />
            <span>
              Grundvands-Udvaskning ({groundwaterLeachingData.globalSoilSaturationPct}% Mætning ·{' '}
              {groundwaterLeachingData.effectiveAccumulatedPrecipMm} mm)
            </span>
          </button>

          {onToggleHeatmapComparison && (
            <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded p-0.5 shrink-0">
              <button
                type="button"
                onClick={onToggleHeatmapComparison}
                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  showHeatmapComparison
                    ? 'bg-amber-400/20 text-white border border-amber-400'
                    : 'bg-[var(--surface-card)] text-amber-300 border border-amber-500/40 hover:bg-[var(--surface-overlay)]'
                }`}
                title="Vis/skjul Heatmap-sammenligning mellem T_A og T_B på kortet"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  {heatmapComparison
                    ? `T_A kl. ${heatmapComparison.hourA.hourLabel} ↔ T_B kl. ${heatmapComparison.hourB.hourLabel}`
                    : 'T_A ↔ T_B'}
                </span>
              </button>

              {showHeatmapComparison && (
                <div className="flex items-center gap-0.5 pl-0.5">
                  <button
                    type="button"
                    onClick={() => handleSetComparisonViewMode('difference')}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors whitespace-nowrap ${
                      heatmapComparisonViewMode === 'difference'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                    title="Vis direkte Differens-Heatmap (Δ = T_B − T_A) i stedet for begge heatmaps"
                  >
                    Δ Differens-Heatmap (T_B − T_A)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetComparisonViewMode('dual_overlay')}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap ${
                      heatmapComparisonViewMode === 'dual_overlay'
                        ? 'bg-cyan-500 text-slate-950 shadow-xs font-bold'
                        : 'bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                    title="Vis begge heatmaps (T_A og T_B fane-arealer) oven på hinanden"
                  >
                    Begge Heatmaps (T_A + T_B)
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowWindParticles((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              showWindParticles
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
            title="Vis/skjul animeret Open-Meteo vindfelt og partikelspredning"
          >
            <Wind className="w-3.5 h-3.5" />
            <span>Vindfelt-Partikler</span>
          </button>

          {/* 6-Hour Dust Drift Forecast 2D Animation Quick-Toggle Button */}
          <div className="flex items-center gap-1 bg-slate-950/90 border border-cyan-500/50 rounded p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setShow6hDustForecast((v) => !v)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                show6hDustForecast
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[var(--surface-card)] text-sky-300 hover:text-white'
              }`}
              title="Visuel 2D-animation på kortet, der simulerer støvets bevægelse over de næste 6 timer (+0t til +6t) baseret på den aktuelle vindprognose"
            >
              <Navigation
                className="w-3.5 h-3.5 shrink-0 transition-transform"
                style={{
                  transform: `rotate(${sixHourDustForecastData.interpolatedPlumeDeg}deg)`,
                }}
              />
              <span>
                {show6hDustForecast
                  ? `✓ +6t Støv-Prognose (+${sixHourDustForecastData.clampedT.toFixed(1)}t · kl. ${sixHourDustForecastData.activeStep.hourLabel})`
                  : '+6t Støv-Prognose (2D Animation)'}
              </span>
            </button>

            {show6hDustForecast && (
              <button
                type="button"
                onClick={() => setIsPlaying6hDustForecast((p) => !p)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-colors ${
                  isPlaying6hDustForecast
                    ? 'bg-rose-500 text-white hover:bg-rose-400'
                    : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                }`}
                title={
                  isPlaying6hDustForecast
                    ? 'Pause 6-timers støv-prognose animation'
                    : 'Afspil 6-timers støv-prognose animation'
                }
              >
                {isPlaying6hDustForecast ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>Afspil +6t</span>
                  </>
                )}
              </button>
            )}
          </div>

          {onToggleAnimatePlumeRoute && (
            <button
              type="button"
              onClick={onToggleAnimatePlumeRoute}
              className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isAnimatingPlumeRoute
                  ? 'bg-cyan-400 text-slate-950 ring-2 ring-white shadow-md'
                  : 'bg-cyan-950/90 text-cyan-200 border border-cyan-400/70 hover:bg-cyan-900'
              }`}
              title="Gennemspil den 24-timers beregnede vindfane-bane som en animeret linje fra kilden til de mest berørte områder"
            >
              {isAnimatingPlumeRoute ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Stop Fanevej-Rute (kl. {currentWeather.hourLabel})</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Animér Fanevej-Rute</span>
                </>
              )}
            </button>
          )}

          {isPuffMode && (
            <button
              type="button"
              onClick={() => setShowHourlyPuffLobes((v) => !v)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                showHourlyPuffLobes
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>24t Time-Puff Vektorer</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowReceptorLabels((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              showReceptorLabels
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Matrikel-Labels
          </button>

          <button
            type="button"
            data-testid="toggle-vibration-heatmap-btn"
            onClick={() => setShowVibrationHeatmap((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showVibrationHeatmap
                ? vibrationHeatmapData.maxPpvMmPerSec >= 20
                  ? 'bg-rose-500/25 text-rose-200 border border-rose-400/70'
                  : 'bg-amber-500/20 text-amber-200 border border-amber-400/60'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
            title="Vis/skjul realtids Bornitz vibrations-heatmap (PPV mm/s · DIN 4150-3) korreleret med aktive maskinkilder"
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono tabular-nums">
              Vibrations-Heatmap ({vibrationHeatmapData.maxPpvMmPerSec.toFixed(1)} mm/s)
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-autonomous-receptor-mesh-btn"
            onClick={() => setShowAutonomousMesh((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showAutonomousMesh
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/60'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
            title={`Vis/skjul forbundet netværk af Autonome Noder (${autonomousMesh.totalNodes} receptorer · ${autonomousMesh.totalEdges} forbindelser) med ZKP-identifikation og automatisk Nabotest`}
          >
            <Network className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono tabular-nums">
              Autonome Noder ({autonomousMesh.totalNodes}/{autonomousMesh.totalEdges})
            </span>
          </button>

          <button
            type="button"
            data-testid="map-toolbar-mycelium-live-toggle-btn"
            onClick={myceliumLiveAlerts.toggleLiveEnabled}
            className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              myceliumLiveAlerts.isLiveEnabled
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/70'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
            title="Skift Global Live Varsling ON/OFF (ISA-18.2 Calmer Defaults & Gate 1 Filter)"
          >
            {myceliumLiveAlerts.isLiveEnabled ? (
              <Bell className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            ) : (
              <BellOff className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="tabular-nums">
              Live Varsling {myceliumLiveAlerts.isLiveEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            data-testid="map-toolbar-open-mycelium-center-btn"
            onClick={() => {
              if (!showMyceliumAlertCenter) {
                setShowMyceliumAlertCenter(true);
                setMapWindowStates((prev) => ({
                  ...prev,
                  mycelium_alert_center: { ...prev.mycelium_alert_center, isMinimized: false },
                }));
                handleFocusMapWindow('mycelium_alert_center');
              } else if (mapWindowStates.mycelium_alert_center.isMinimized) {
                setMapWindowStates((prev) => ({
                  ...prev,
                  mycelium_alert_center: { ...prev.mycelium_alert_center, isMinimized: false },
                }));
                handleFocusMapWindow('mycelium_alert_center');
              } else if (mapWindowStates.mycelium_alert_center.isReleased) {
                handleFocusMapWindow('mycelium_alert_center');
              } else {
                setShowMyceliumAlertCenter(false);
              }
            }}
            className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showMyceliumAlertCenter
                ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-300 shadow-sm'
                : 'bg-slate-900 text-cyan-200 border border-cyan-500/50 hover:bg-slate-800'
            }`}
            title="Åbn/fokusér Fællesskabets Mycelienetværk (System B) Kontrol-, Simulerings- & CiK 2.0 Sankey-Center"
          >
            <Network className="w-3.5 h-3.5 shrink-0" />
            <span>Mycelie-Netværk</span>
          </button>

          <button
            type="button"
            data-testid="toggle-map-neighbor-pressure-waves-btn"
            onClick={() => {
              if (!isHighWindAlert && firstHighWindHourInDataset && onSelectHourFromPeak) {
                setShowMapBlockPressureWaves(true);
                onSelectHourFromPeak(firstHighWindHourInDataset.hourIndex);
              } else {
                setShowMapBlockPressureWaves((v) => !v);
              }
            }}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isMapBlockPressureWaveActive
                ? 'bg-rose-500/25 text-rose-200 border border-rose-400/70 font-bold'
                : isHighWindAlert
                ? 'bg-slate-900 text-slate-400 border border-slate-800'
                : 'bg-slate-900 text-amber-300/90 border border-amber-500/40'
            }`}
            title={
              isHighWindAlert
                ? `CSS-trykbølgeanimation pr. naboblok er AKTIV ved v = ${currentWeather.windSpeed10m.toFixed(
                    1
                  )} m/s (> 10 m/s). Klik for at vise/skjule på kortet.`
                : firstHighWindHourInDataset
                ? `Trykbølger på kortet aktiveres specifikt når vindhastigheden overstiger 10 m/s (aktuel vind: ${currentWeather.windSpeed10m.toFixed(
                    1
                  )} m/s). Klik for at hoppe til kl. ${
                    firstHighWindHourInDataset.hourLabel
                  } (${firstHighWindHourInDataset.windSpeed10m.toFixed(1)} m/s).`
                : `Trykbølger på Ringparken-kortet aktiveres specifikt når vindhastigheden overstiger 10 m/s (aktuel vind: ${currentWeather.windSpeed10m.toFixed(
                    1
                  )} m/s).`
            }
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono tabular-nums">
              {isMapBlockPressureWaveActive
                ? `Trykbølger >10 m/s: AKTIV (${currentWeather.windSpeed10m.toFixed(1)} m/s)`
                : !isHighWindAlert && firstHighWindHourInDataset
                ? `Trykbølger (>10 m/s · Hop kl. ${firstHighWindHourInDataset.hourLabel})`
                : 'Trykbølger (>10 m/s: Afventer)'}
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-webgl-dust-plume-btn"
            onClick={() => {
              if (!isHighWindAlert && firstHighWindHourInDataset && onSelectHourFromPeak) {
                setShowWebGlDustPlume(true);
                onSelectHourFromPeak(firstHighWindHourInDataset.hourIndex);
              } else {
                setShowWebGlDustPlume((v) => !v);
              }
            }}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showWebGlDustPlume && isHighWindAlert && !useGoogleMapsEngine
                ? 'bg-amber-500/25 text-amber-100 border border-amber-400/70 font-bold'
                : isHighWindAlert
                ? 'bg-slate-900 text-slate-400 border border-slate-800'
                : 'bg-slate-900 text-amber-300/90 border border-amber-500/40'
            }`}
            title={
              isHighWindAlert
                ? `WebGL 2D-støvfane fra valgte kildenoder er AKTIV ved v = ${currentWeather.windSpeed10m.toFixed(
                    1
                  )} m/s (> 10 m/s). Klik for at vise/skjule på 2D-kortet.`
                : firstHighWindHourInDataset
                ? `WebGL-støvfanen aktiveres automatisk, når vindhastigheden overstiger 10 m/s. Klik for at hoppe til kl. ${
                    firstHighWindHourInDataset.hourLabel
                  } (${firstHighWindHourInDataset.windSpeed10m.toFixed(1)} m/s).`
                : 'WebGL-støvfanen aktiveres automatisk på 2D-kortet, når vindhastigheden overstiger 10 m/s.'
            }
          >
            <Wind className="w-3.5 h-3.5 shrink-0 text-amber-300" />
            <span className="font-mono tabular-nums">
              {showWebGlDustPlume && isHighWindAlert && !useGoogleMapsEngine
                ? `WebGL Støvfane >10 m/s: AKTIV (${currentWeather.windSpeed10m.toFixed(1)} m/s)`
                : !isHighWindAlert && firstHighWindHourInDataset
                ? `WebGL Støvfane (>10 m/s · Hop kl. ${firstHighWindHourInDataset.hourLabel})`
                : 'WebGL Støvfane (>10 m/s: Afventer)'}
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-source-85db-wavefronts-btn"
            onClick={() => setShowSource85DbWavefronts((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showSource85DbWavefronts && sourceWavefrontTargets.length > 0
                ? 'bg-rose-500/20 text-rose-200 border border-rose-400/70 font-semibold'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="Vis/skjul CSS-animeret akustisk trykbølge (> 85 dB) fra aktive nedrivningskilder ind mod støj-følsomme nabozoner"
          >
            <Waves className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span className="font-mono tabular-nums">
              Støjbølger &gt;85 dB ({sourceWavefrontTargets.length})
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-high-gust-correlation-hud-btn"
            onClick={() => {
              if (!isHighGustAlert && firstHighGustHourInDataset && onSelectHourFromPeak) {
                setShowHighWindCorrelationHud(true);
                onSelectHourFromPeak(firstHighGustHourInDataset.hourIndex);
              } else {
                setShowHighWindCorrelationHud((v) => !v);
              }
            }}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isHighGustAlert && showHighWindCorrelationHud
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/80 font-bold'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="High-Wind Dispersion Correlation (> 12 m/s vindstød) med automatisk fremhævning af berørte receptorer"
          >
            <Wind className="w-3.5 h-3.5 shrink-0 text-amber-300" />
            <span className="font-mono tabular-nums">
              {isHighGustAlert
                ? `Vindstød >12 m/s (${currentWeather.windGusts10m.toFixed(1)})`
                : firstHighGustHourInDataset
                ? `Vindstød >12 m/s (Hop kl. ${firstHighGustHourInDataset.hourLabel})`
                : 'Vindstød >12 m/s'}
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-emergency-evac-flow-btn"
            onClick={() => setShowEvacuationFlowAnimation((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showEvacuationFlowAnimation
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/70 font-semibold'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="Vis/skjul Emergency Evacuation Flow med dynamisk flugthastighed (m/s) beregnet ud fra terrænhældning og lokal støvfanetæthed"
          >
            <Navigation className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span className="font-mono tabular-nums">
              Flugtstrøm ({evacuationFlowSegments[0]?.speedMs.toFixed(2) ?? '1.20'} m/s)
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-neighbor-complaint-density-btn"
            onClick={() => setShowComplaintDensityOverlay((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showComplaintDensityOverlay
                ? 'bg-rose-500/20 text-rose-200 border border-rose-400/70 font-semibold'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="Vis/skjul varmekort over tætheden af Registrerede Naboklager på tværs af Ringparkens nedrivningssektorer og kortblokke"
          >
            <Flame className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span className="font-mono tabular-nums">
              Naboklage-Tæthed ({complaintDensitySummary.totalFilteredComplaints})
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-2d-wind-noise-heatmap-btn"
            onClick={() => {
              setShowWindNoiseHeatmapLayer((prev) => {
                const next = !prev;
                if (next) setPreferTacticalCanvas(true);
                return next;
              });
            }}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showWindNoiseHeatmapLayer
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/80 font-bold shadow-xs'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="2D Taktisk Kort: Vis/skjul varmegraf over støjniveauer (dB) korreleret med vindretning, så de mest udsatte naboblokke fremhæves ved specifikke vindvinkler"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="font-mono tabular-nums">
              Vind-Støj Varmegraf ({Math.round(effectiveNoiseWindFromDeg)}°)
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-weather-correlation-heatmap-btn"
            onClick={() => {
              setShowWeatherCorrelationHeatmapLayer((prev) => {
                const next = !prev;
                if (next) setShowWeatherCorrelationHud(true);
                return next;
              });
            }}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showWeatherCorrelationHeatmapLayer
                ? 'bg-orange-500/25 text-orange-100 border border-orange-400/80 font-bold shadow-xs'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="Vejr-Korrelations Heatmap: Fremhæver automatisk geografiske områder hvor korrelationen mellem vindstød og støvnedfald (S-kvotient) > 0,80 over de sidste 6 timer"
          >
            <Wind className="w-3.5 h-3.5 shrink-0 text-orange-300" />
            <span className="font-mono tabular-nums">
              Vejr-Korrelations Heatmap ({weatherCorrelationHeatmapData.highlightedAreas.length} r&gt;0,8)
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportHighResHeatmapPng}
            disabled={isExportingPng}
            className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              pngExportedJustNow
                ? 'bg-emerald-500 text-slate-950 border border-emerald-200 shadow-md'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 border border-cyan-200 shadow-sm'
            }`}
            title={`Eksportér det aktuelle sprednings-heatmap viewport (Z:${zoom.toFixed(
              1
            )}, kl. ${
              currentWeather.hourLabel
            }) som en høj-opløsnings PNG-billedfil (2400×1680 px, 300 DPI) klar til den retsmedicinske PDF-rapport`}
          >
            {pngExportedJustNow ? (
              <>
                <Check className="w-3.5 h-3.5 text-slate-950" />
                <span>Høj-Opløsnings PNG Gemt (2400px)!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-slate-950" />
                <span>
                  {isExportingPng
                    ? 'Eksporterer PNG (2400px)...'
                    : 'Eksportér Heatmap (Høj-Opløsnings PNG)'}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExport2DViewportPrintPdf}
            className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              pdfExportedJustNow
                ? 'bg-emerald-500 text-slate-950 border border-emerald-200 shadow-md'
                : 'bg-white text-slate-950 hover:bg-slate-100 border border-slate-300 shadow-sm'
            }`}
            title={`Generér print-venlig A4 PDF-rapport med det aktuelle 2D kort-viewport (Z:${zoom.toFixed(
              1
            )}), vejrbetingelser (kl. ${
              currentWeather.hourLabel
            }) og de 3 højeste receptor-sumkvotienter (${top3ReceptorExposures
              .map((r, i) => `#${i + 1} ${r.receptorCode}: S=${r.sumQuotient.toFixed(2)}`)
              .join(', ')})`}
          >
            {pdfExportedJustNow ? (
              <>
                <Check className="w-3.5 h-3.5 text-slate-950" />
                <span>2D PDF-Rapport Downloadet!</span>
              </>
            ) : (
              <>
                <Printer className="w-3.5 h-3.5 text-slate-900" />
                <span>Print-venlig 2D Kort-Rapport (PDF)</span>
              </>
            )}
          </button>

          {hasConfiguredGoogleKey && !gmpAuthFailed && (
            <button
              type="button"
              onClick={() => setPreferTacticalCanvas((v) => !v)}
              className="px-2.5 py-1.5 rounded text-xs font-medium bg-slate-900 text-cyan-400 border border-cyan-500/30 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {preferTacticalCanvas ? 'Skift til Google Maps Hybrid' : 'Taktisk GIS-Visning'}
            </button>
          )}

          <button
            type="button"
            onClick={handleMinimizeAllMapWindows}
            title="Minimer alle åbne kort-vinduer og Heatmaps på kortsiden"
            className="px-2 py-1.5 rounded text-[11px] font-mono font-semibold bg-slate-900 text-slate-300 border border-slate-800 hover:border-amber-400/50 hover:text-amber-200 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <Minus className="w-3 h-3 text-amber-400" />
            <span>Minimer Kort-Vinduer</span>
          </button>

          <button
            type="button"
            onClick={handleRestoreAllMapWindows}
            title="Gendan og fastgør alle kort-vinduer og Heatmaps på kortsiden"
            className="px-2 py-1.5 rounded text-[11px] font-mono font-semibold bg-slate-900 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-950/60 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <Pin className="w-3 h-3 text-cyan-400" />
            <span>Gendan Kort-Vinduer</span>
          </button>

          {(isFullscreen || effectiveMapOnly) && (() => {
            const activeDateIso = selectedDateIso || currentWeather.isoTime.slice(0, 10);
            const shiftDateByDays = (deltaDays: number) => {
              if (!onChangeDateIso) return;
              const base = new Date(`${activeDateIso}T12:00:00Z`);
              if (Number.isNaN(base.getTime())) return;
              base.setUTCDate(base.getUTCDate() + deltaDays);
              onChangeDateIso(base.toISOString().slice(0, 10));
            };
            return (
              <div
                className="px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 border shadow-lg bg-[#0B0E17]/95 text-cyan-100 border-cyan-400/80 ring-1 ring-cyan-400/40"
                title={`Simuleret Dato & Klokkeslæt: ${activeDateIso} kl. ${currentWeather.hourLabel} (${currentWeather.temperature2m.toFixed(1)}°C · ${currentWeather.windSpeed10m.toFixed(1)} m/s) — Klik eller vælg dato direkte`}
              >
                {onChangeDateIso ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => shiftDateByDays(-1)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                      title="Forrige dato (−1 dag)"
                    >
                      −1d
                    </button>
                    <label className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-cyan-400/60 hover:border-cyan-300 cursor-pointer">
                      <Calendar className="w-3 h-3 text-cyan-300 shrink-0" />
                      <input
                        type="date"
                        value={activeDateIso}
                        onChange={(e) => {
                          if (e.target.value) onChangeDateIso(e.target.value);
                        }}
                        aria-label="Skift dato i Fuld skærm eller Kun Kort"
                        className="bg-transparent text-white font-mono font-extrabold text-[11px] focus:outline-none cursor-pointer [color-scheme:dark]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => shiftDateByDays(1)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                      title="Næste dato (+1 dag)"
                    >
                      +1d
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeDateIso(new Date().toISOString().slice(0, 10))}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-amber-400 hover:text-slate-950 text-[11px] font-bold text-amber-200 border border-amber-500/40 transition-colors cursor-pointer"
                      title="Skift til dags dato (I dag)"
                    >
                      I dag
                    </button>
                  </div>
                ) : (
                  <span className="text-white font-extrabold inline-flex items-center gap-1 tabular-nums">
                    <Calendar className="w-3 h-3 text-cyan-300 shrink-0" />
                    <span>{activeDateIso}</span>
                  </span>
                )}
                <span className="text-cyan-400">·</span>
                <span className="text-amber-300 font-extrabold inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>kl. {currentWeather.hourLabel}</span>
                </span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  ({currentWeather.temperature2m.toFixed(1)}°C · {currentWeather.windSpeed10m.toFixed(1)} m/s)
                </span>
                {onSelectHourFromPeak && (
                  <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-cyan-500/40">
                    <button
                      type="button"
                      onClick={() => onSelectHourFromPeak((currentWeather.hourIndex + 23) % 24)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                      title="Forrige time (-1t)"
                    >
                      −1t
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectHourFromPeak((currentWeather.hourIndex + 1) % 24)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                      title="Næste time (+1t)"
                    >
                      +1t
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {onToggleFullscreen && !effectiveMapOnly && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border shadow-md ${
                isFullscreen
                  ? 'bg-amber-400 text-slate-950 border-amber-200 hover:bg-amber-300'
                  : 'bg-[#0B0E17]/95 text-cyan-200 border-cyan-500/60 hover:bg-cyan-950'
              }`}
              title={
                isFullscreen
                  ? 'Afslut Fuld Skærm (Esc)'
                  : `${fullscreenLabel || 'Fuld Skærm'} — Udvid visningen til hele skærmen`
              }
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>Afslut Fuld Skærm</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{fullscreenLabel || 'Fuld Skærm'}</span>
                </>
              )}
            </button>
          )}

          {onToggleCategoryFilter && effectiveMapOnly && (
            <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded p-0.5 shrink-0">
              {(
                [
                  'a_inhabited',
                  'b_vacant',
                  'c_under_renovation',
                  'd_under_demolition',
                  'e_demolished_unsecured',
                ] as BuildingOperationalCategory[]
              ).map((catCode) => {
                const meta = BUILDING_CATEGORY_METADATA[catCode];
                const isVis = activeCategoryFilters.includes(catCode);
                return (
                  <button
                    key={catCode}
                    type="button"
                    onClick={() => onToggleCategoryFilter(catCode)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
                      isVis
                        ? 'bg-slate-900 text-white border-slate-600'
                        : 'bg-slate-950/60 text-slate-500 border-slate-800 opacity-55'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.colorHex }}
                    />
                    <span>{meta.labelDa.split('.')[0]}</span>
                  </button>
                );
              })}
            </div>
          )}

          <CompactSimulerMenu
            showWaterMainLayer={showWaterMainLayer}
            onToggleWaterMainLayer={onToggleWaterMainLayer}
            showLerBuffer={showLerBuffer}
            onToggleLerBuffer={onToggleLerBuffer}
            hasSteelRoadPlates={hasSteelRoadPlates || waterMainTelemetry?.hasSteelRoadPlates}
            onToggleSteelRoadPlates={onToggleSteelRoadPlates}
            simulatedPipeRuptureActive={
              simulatedPipeRuptureActive || waterMainTelemetry?.simulatedPipeRuptureActive
            }
            onToggleSimulatedPipeRupture={onToggleSimulatedPipeRupture}
            isS3ValveLockoutActive={
              isS3ValveLockoutActive ||
              Boolean(
                waterMainTelemetry?.valves.some((v) => v.code === 'V-VEST' && v.status === 'closed')
              )
            }
            onToggleS3ValveLockout={onToggleS3ValveLockout}
            hasVirtualLeakPin={Boolean(effectiveVirtualLeakPinPoint)}
            onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
            sources={sources}
            onToggleSourceActive={onToggleSourceActive}
            onIsolateNearbyMachinery={handleTriggerIsolateNearbyMachinery}
            onRestoreAllMachinery={onRestoreAllMachinery}
            pipePpvMmPerSec={waterMainTelemetry?.pipePpvMmPerSec}
            align="right"
          />

          {/* 'Kun Kort' Button + Top-Right 'Afslut' Button when 'Kun Kort' is active */}
          {!effectiveMapOnly ? (
            <button
              type="button"
              onClick={handleToggleMapOnly}
              className="px-2.5 py-1.5 rounded text-xs font-mono font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border shadow-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 cursor-pointer"
              title="Kun Kort — Vis kun kortet med filtre og skjul øvrige paneler"
            >
              <Map className="w-3.5 h-3.5 text-slate-950" />
              <span>Kun Kort</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleMapOnly}
              className="ml-auto px-3 py-1.5 rounded text-xs font-mono font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border shadow-sm bg-rose-600 hover:bg-rose-500 text-white border-rose-300 cursor-pointer"
              title="Afslut 'Kun Kort' visning (Esc)"
            >
              <X className="w-4 h-4 text-white" />
              <span>Afslut</span>
            </button>
          )}
        </div>
      </div>

      {/* Asbest-Risikolag (<1997) Direct Building-Part -> Health Risk Correlation Overlay */}
      {!effectiveMapOnly && showAsbestosRiskLayer && asbestosDepositionZones.length > 0 && (() => {
        const activeAsbZone =
          asbestosDepositionZones.find((z) => z.sourceId === selectedSourceId) ||
          asbestosDepositionZones[0];
        const asbWin = mapWindowStates.asbestos_risk_heatmap;
        return (
          <div
            data-map-window="asbestos_risk_heatmap"
            onMouseDown={() => asbWin.isReleased && handleFocusMapWindow('asbestos_risk_heatmap')}
            className={`${
              asbWin.isReleased ? 'fixed ring-2 ring-emerald-400' : 'absolute top-20 right-3 z-20'
            } max-w-md bg-[var(--surface-overlay)] border border-[var(--border-subtle)] border-l-4 border-l-emerald-400 rounded-md p-3 shadow-lg pointer-events-auto space-y-2 transition-opacity duration-300 ease-out`}
            style={
              asbWin.isReleased
                ? {
                    left: `${asbWin.x}px`,
                    top: `${asbWin.y}px`,
                    zIndex: asbWin.zIndex,
                    opacity: 0.35 + crossFadeProgress * 0.65,
                  }
                : { opacity: 0.35 + crossFadeProgress * 0.65 }
            }
          >
            <MapOverlayWindowControlStrip
              windowId="asbestos_risk_heatmap"
              title="Asbest-Risikolag Heatmap (<1997 Materialealder)"
              badgeText={`Sandsynlighed: ${activeAsbZone.probabilityPct}%`}
              accentColorClass="text-emerald-300"
              state={asbWin}
              onToggleMinimize={handleToggleMapWindowMinimize}
              onToggleRelease={handleToggleMapWindowRelease}
              onMove={handleMoveMapWindow}
              onFocus={handleFocusMapWindow}
              onClose={() => setShowAsbestosRiskLayer(false)}
            />
            {!asbWin.isMinimized && (
              <>
                <div className="flex flex-wrap gap-1">
                  {asbestosDepositionZones.map((z) => {
                    const isSel = z.sourceId === activeAsbZone.sourceId;
                    return (
                      <button
                        key={z.sourceId}
                        type="button"
                        onClick={() => onSelectSource(z.sourceId)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                          isSel
                            ? 'bg-emerald-400 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-emerald-400/50'
                        }`}
                      >
                        {z.sourceCode} ({z.probabilityPct}%)
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-bold text-white">{activeAsbZone.sourceName}</span>
                    <span className="text-emerald-300">
                      {activeAsbZone.constructionYearRange} · H={activeAsbZone.releaseHeightMeters}m
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-amber-300">
                    Bygningsdele (&lt;1997): {activeAsbZone.buildingParts.join(' · ')}
                  </div>
                  <div className="text-[11px] text-slate-300 leading-snug">
                    <strong className="text-emerald-300">Sundhedsrisiko-korrelation:</strong>{' '}
                    {activeAsbZone.healthRiskCorrelation}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-800/90 font-mono text-[11px]">
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <div className="text-[11px] text-slate-400">LUFTKONC. (2026-GV)</div>
                    <div
                      className={`font-bold ${
                        activeAsbZone.exceeds2026Limit ? 'text-rose-400' : 'text-emerald-300'
                      }`}
                    >
                      {activeAsbZone.airborneConcFibreCm3} / 0,003 f/cm³
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <div className="text-[11px] text-slate-400">FIBERDEPOSITION</div>
                    <div className="font-bold text-emerald-300">
                      {activeAsbZone.estimatedDepositionFibreM2.toLocaleString('da-DK')} fibre/m²
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <div className="text-[11px] text-slate-400">NEDVINDS RÆKKEVIDDE</div>
                    <div className="font-bold text-white">
                      {activeAsbZone.coreLengthM}–{activeAsbZone.haloLengthM} m ({plumeDirectionDeg}°)
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* HYDROLOGISK JORD-UDVASKNING & GRUNDVANDSRISIKO ADVARSELS-OVERLAY PÅ KORTET */}
      {!effectiveMapOnly && showGroundwaterLeachingWarning && groundwaterLeachingData.zones.length > 0 && (() => {
        const activeLeachZone =
          groundwaterLeachingData.zones.find((z) => z.sourceId === selectedSourceId) ||
          groundwaterLeachingData.zones[0];
        const isCritical = activeLeachZone.riskSeverity === 'critical';
        const leachWin = mapWindowStates.groundwater_leaching_heatmap;

        return (
          <div
            data-map-window="groundwater_leaching_heatmap"
            onMouseDown={() =>
              leachWin.isReleased && handleFocusMapWindow('groundwater_leaching_heatmap')
            }
            className={`${
              leachWin.isReleased ? 'fixed ring-2 ring-amber-400' : 'absolute bottom-16 left-3 z-20'
            } max-w-md bg-[var(--surface-overlay)] border border-[var(--border-subtle)] border-l-4 rounded-md p-3 shadow-lg pointer-events-auto space-y-2 transition-opacity duration-300 ease-out ${
              isCritical
                ? 'border-l-amber-400'
                : 'border-cyan-400/80 shadow-cyan-950/40'
            }`}
            style={
              leachWin.isReleased
                ? {
                    left: `${leachWin.x}px`,
                    top: `${leachWin.y}px`,
                    zIndex: leachWin.zIndex,
                    opacity: 0.35 + crossFadeProgress * 0.65,
                  }
                : { opacity: 0.35 + crossFadeProgress * 0.65 }
            }
          >
            <MapOverlayWindowControlStrip
              windowId="groundwater_leaching_heatmap"
              title="Hydrologisk Udvaskning Heatmap (MBL § 19 / § 27)"
              badgeText={`${isCritical ? 'KRITISK' : 'HØJ RISIKO'} (${activeLeachZone.maxExceedanceRatio}× GV)`}
              accentColorClass="text-amber-300"
              state={{
                ...leachWin,
                isMinimized: leachWin.isMinimized || isLeachingCardMinimized,
              }}
              onToggleMinimize={() => {
                if (isLeachingCardMinimized) setIsLeachingCardMinimized(false);
                handleToggleMapWindowMinimize('groundwater_leaching_heatmap');
              }}
              onToggleRelease={handleToggleMapWindowRelease}
              onMove={handleMoveMapWindow}
              onFocus={handleFocusMapWindow}
              onClose={() => setShowGroundwaterLeachingWarning(false)}
            />

            {/* Hydrological Stress / Rainfall & Soil Saturation Mode Selector */}
            <div className="flex items-center justify-between gap-1 bg-slate-950/90 p-1 rounded border border-slate-800/90">
              <span className="text-[11px] font-mono uppercase text-slate-400 pl-1">
                Hydrologi-Model:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLeachingSimMode('live')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                    leachingSimMode === 'live'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  Aktuel Vejrdata
                </button>
                <button
                  type="button"
                  onClick={() => setLeachingSimMode('saturated_rain')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                    leachingSimMode === 'saturated_rain'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  Mættet Jord (16,8 mm)
                </button>
                <button
                  type="button"
                  onClick={() => setLeachingSimMode('cloudburst')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                    leachingSimMode === 'cloudburst'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  Skybrud (36,4 mm)
                </button>
              </div>
            </div>

            {!isLeachingCardMinimized && !leachWin.isMinimized && (
              <>
                {/* Zone Selector Pills */}
                <div className="flex flex-wrap gap-1">
                  {groundwaterLeachingData.zones.map((z) => {
                    const isSel = z.sourceId === activeLeachZone.sourceId;
                    return (
                      <button
                        key={z.sourceId}
                        type="button"
                        onClick={() => onSelectSource(z.sourceId)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                          isSel
                            ? 'bg-amber-400 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-amber-400/60'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Droplets className="w-3 h-3 shrink-0" />
                          <span>
                            {z.sourceCode}: Mætning {z.zoneSaturationPct}% ({z.maxExceedanceRatio}× GV)
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Soil Saturation Progress Bar & Accumulated Rainfall Metrics */}
                <div className="p-2 bg-slate-950/90 rounded border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300 font-semibold">
                      Jordens Mætningsgrad ({activeLeachZone.sourceCode}):
                    </span>
                    <span
                      className={`font-bold ${
                        activeLeachZone.zoneSaturationPct >= 82
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {activeLeachZone.zoneSaturationPct}% mættet porevolumen (Markkapacitet: 65%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        activeLeachZone.zoneSaturationPct >= 82
                          ? 'bg-gradient-to-r from-cyan-500 via-amber-500 to-rose-500'
                          : 'bg-gradient-to-r from-cyan-500 to-amber-400'
                      }`}
                      style={{ width: `${activeLeachZone.zoneSaturationPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1 font-mono text-[11px]">
                    <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                      <div className="text-[11px] text-slate-400">AKKUMULERET NEDBØR</div>
                      <div className="font-bold text-cyan-300">
                        {activeLeachZone.effectiveAccumulatedPrecipMm} mm (kl. {currentWeather.hourLabel})
                      </div>
                    </div>
                    <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                      <div className="text-[11px] text-slate-400">PERKOLATIONS-FART</div>
                      <div className="font-bold text-amber-300">
                        {activeLeachZone.infiltrationVelocityCmDay} cm/døgn ↓
                      </div>
                    </div>
                    <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                      <div className="text-[11px] text-slate-400">GRUNDVANDS-FANE</div>
                      <div className="font-bold text-white">
                        {activeLeachZone.plumeLengthM} m mod SV (215°)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Porewater Contaminant Leaching vs. Groundwater Quality Standards */}
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <div className="text-[11px] text-slate-400">BLY (Pb) PERKOLAT</div>
                    <div
                      className={`font-bold ${
                        activeLeachZone.leadLeachateUgL >= 1.0 ? 'text-rose-400' : 'text-amber-300'
                      }`}
                    >
                      {activeLeachZone.leadLeachateUgL} / 1,0 µg/L
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <div className="text-[11px] text-slate-400">PCB-TOTAL PERKOLAT</div>
                    <div
                      className={`font-bold ${
                        activeLeachZone.pcbLeachateUgL >= 0.01 ? 'text-rose-400' : 'text-amber-300'
                      }`}
                    >
                      {activeLeachZone.pcbLeachateUgL} / 0,01 µg/L
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                    <div className="text-[11px] text-slate-400">PAH-FORBINDELSER</div>
                    <div
                      className={`font-bold ${
                        activeLeachZone.pahLeachateUgL >= 0.2 ? 'text-rose-400' : 'text-emerald-300'
                      }`}
                    >
                      {activeLeachZone.pahLeachateUgL} / 0,20 µg/L
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 leading-snug">
                  <strong className="text-amber-300">Geologisk risikovurdering:</strong>{' '}
                  {activeLeachZone.geologyDescription}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* HEATMAP-SAMMENLIGNING & DIFFERENS-HEATMAP OVERLAY CARD (T_A vs T_B) */}
      {!effectiveMapOnly && showHeatmapComparison && heatmapComparison && (() => {
        const primaryShift =
          heatmapComparison.sourceShifts.find((s) => s.sourceId === selectedSourceId) ||
          heatmapComparison.sourceShifts[0];
        const topDeltaReceptors = heatmapComparison.receptorDeltas.slice(0, 3);
        const inspectedCell =
          (inspectedDiffCellId &&
            heatmapComparison.heatmapGridCells.find((c) => c.id === inspectedDiffCellId)) ||
          heatmapComparison.peakPositiveCell ||
          heatmapComparison.heatmapGridCells[0] ||
          null;

        const cmpWin = mapWindowStates.heatmap_comparison;

        return (
          <div
            data-map-window="heatmap_comparison"
            onMouseDown={() => cmpWin.isReleased && handleFocusMapWindow('heatmap_comparison')}
            className={`${
              cmpWin.isReleased ? 'fixed ring-2 ring-amber-400' : 'absolute top-20 left-3 z-20'
            } max-w-lg bg-[var(--surface-overlay)] border border-[var(--border-subtle)] border-l-4 border-l-amber-400 rounded-md p-3 shadow-lg pointer-events-auto space-y-2.5 transition-opacity duration-300 ease-out`}
            style={
              cmpWin.isReleased
                ? {
                    left: `${cmpWin.x}px`,
                    top: `${cmpWin.y}px`,
                    zIndex: cmpWin.zIndex,
                    opacity: 0.35 + crossFadeProgress * 0.65,
                  }
                : { opacity: 0.35 + crossFadeProgress * 0.65 }
            }
          >
            <MapOverlayWindowControlStrip
              windowId="heatmap_comparison"
              title={
                isDifferenceHeatmapMode
                  ? `Δ Differens-Heatmap (kl. ${heatmapComparison.hourA.hourLabel} → kl. ${heatmapComparison.hourB.hourLabel})`
                  : `Begge Heatmaps Overlay (kl. ${heatmapComparison.hourA.hourLabel} ↔ kl. ${heatmapComparison.hourB.hourLabel})`
              }
              badgeText={isDifferenceHeatmapMode ? 'Δ(T_B − T_A)' : 'T_A + T_B'}
              accentColorClass="text-amber-300"
              state={{
                ...cmpWin,
                isMinimized: cmpWin.isMinimized || isComparisonCardCollapsed,
              }}
              onToggleMinimize={() => {
                if (isComparisonCardCollapsed) setIsComparisonCardCollapsed(false);
                handleToggleMapWindowMinimize('heatmap_comparison');
              }}
              onToggleRelease={handleToggleMapWindowRelease}
              onMove={handleMoveMapWindow}
              onFocus={handleFocusMapWindow}
              onClose={onToggleHeatmapComparison}
            />

            {/* Mode Switcher: Direct Difference Heatmap (T_B - T_A) vs Dual Heatmap Overlay (T_A + T_B) */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/90 border border-slate-800 rounded p-1.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetComparisonViewMode('difference')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-colors ${
                    isDifferenceHeatmapMode
                      ? 'bg-sky-500 text-slate-950 border border-sky-300'
                      : 'bg-[var(--surface-card)] text-slate-400 border border-[var(--border-subtle)] hover:text-white'
                  }`}
                >
                  Δ Differens-Heatmap (T_B − T_A)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetComparisonViewMode('dual_overlay')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
                    !isDifferenceHeatmapMode
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/70 font-bold'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  Begge Heatmaps (T_A + T_B)
                </button>
              </div>

              {isDifferenceHeatmapMode && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDifferenceMetric('sum_quotient')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border transition-colors ${
                      differenceMetric === 'sum_quotient'
                        ? 'bg-amber-400/20 text-amber-200 border-amber-400/60'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                    title="Vis direkte forskel i Sumkvotient ΔS = S(T_B) − S(T_A)"
                  >
                    Δ Sumkvotient (ΔS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDifferenceMetric('dust_ug_m3')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border transition-colors ${
                      differenceMetric === 'dust_ug_m3'
                        ? 'bg-amber-400/20 text-amber-200 border-amber-400/60'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                    title="Vis direkte forskel i respirabel støvkoncentration ΔC (µg/m³)"
                  >
                    Δ Konc. (µg/m³)
                  </button>
                </div>
              )}
            </div>

            {/* Dual Hour Selectors (T_A and T_B) + Quick Presets */}
            <div className="grid grid-cols-11 gap-1.5 items-center font-mono text-xs">
              <div className="col-span-5 bg-cyan-950/50 border border-cyan-400/60 rounded p-1.5">
                <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold mb-0.5">
                  <span>● TIME A (FØR / REF)</span>
                  <span>
                    {heatmapComparison.hourA.windSpeed10m} m/s → {heatmapComparison.plumeDirectionADeg}°
                  </span>
                </div>
                <select
                  value={comparisonHourAIndex}
                  onChange={(e) =>
                    onChangeComparisonHourA && onChangeComparisonHourA(Number(e.target.value))
                  }
                  className="w-full bg-slate-950 border border-cyan-500/40 rounded px-1.5 py-1 text-[11px] text-cyan-100 font-bold focus:outline-none"
                >
                  {weatherHours.map((hr) => (
                    <option key={`ta-${hr.hourIndex}`} value={hr.hourIndex}>
                      T_A: kl. {hr.hourLabel} ({hr.windSpeed10m} m/s · fane{' '}
                      {(hr.windDirection10m + 180) % 360}°)
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-1 flex flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (onChangeComparisonHourA && onChangeComparisonHourB) {
                      const prevA = comparisonHourAIndex;
                      onChangeComparisonHourA(comparisonHourBIndex);
                      onChangeComparisonHourB(prevA);
                    }
                  }}
                  title="Byt Time A og Time B (inverterer Δ = T_B − T_A)"
                  className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-300 hover:text-white transition-colors"
                >
                  ⇄
                </button>
              </div>

              <div className="col-span-5 bg-rose-950/50 border border-rose-400/70 rounded p-1.5">
                <div className="flex items-center justify-between text-[11px] text-rose-300 font-bold mb-0.5">
                  <span>● TIME B (EFTER / SLIDER)</span>
                  <span>
                    {heatmapComparison.hourB.windSpeed10m} m/s → {heatmapComparison.plumeDirectionBDeg}°
                  </span>
                </div>
                <select
                  value={comparisonHourBIndex}
                  onChange={(e) =>
                    onChangeComparisonHourB && onChangeComparisonHourB(Number(e.target.value))
                  }
                  className="w-full bg-slate-950 border border-rose-500/40 rounded px-1.5 py-1 text-[11px] text-rose-100 font-bold focus:outline-none"
                >
                  {weatherHours.map((hr) => (
                    <option key={`tb-${hr.hourIndex}`} value={hr.hourIndex}>
                      T_B: kl. {hr.hourLabel} ({hr.windSpeed10m} m/s · fane{' '}
                      {(hr.windDirection10m + 180) % 360}°)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!isComparisonCardCollapsed && !cmpWin.isMinimized && (
              <>
                {/* Quick Preset Time-Pairs */}
                <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
                  <span className="text-slate-400 mr-1">Hurtigvalg:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeComparisonHourA?.(8);
                      onChangeComparisonHourB?.(14);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 hover:border-cyan-400"
                  >
                    08:00 ↔ 14:00 (Morgen/Eftermiddag)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const prev3 = (comparisonHourBIndex + 21) % 24;
                      onChangeComparisonHourA?.(prev3);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 hover:border-cyan-400"
                  >
                    -3 timer ↔ Aktiv time
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeComparisonHourA?.(6);
                      onChangeComparisonHourB?.(puff24h.peakReceptor.peakHourIndex);
                    }}
                    className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 hover:bg-amber-500/30"
                  >
                    06:00 ↔ Spids kl. {puff24h.peakReceptor.peakHourLabel}
                  </button>
                </div>

                {/* Quantitative Metrics: Direct Concentration Difference vs Footprint Area */}
                {isDifferenceHeatmapMode ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
                      <div className="p-1.5 bg-rose-950/50 rounded border border-rose-500/60">
                        <div className="text-[11px] text-rose-300 font-bold">MAKS. STIGNING (+Δ)</div>
                        <div className="text-xs font-bold text-rose-200">
                          {differenceMetric === 'sum_quotient'
                            ? `+${heatmapComparison.maxPositiveDeltaS.toFixed(2)} S`
                            : `+${heatmapComparison.maxPositiveDeltaDustUgM3.toFixed(0)} µg/m³`}
                        </div>
                      </div>
                      <div className="p-1.5 bg-sky-950/50 rounded border border-sky-500/60">
                        <div className="text-[11px] text-sky-300 font-bold">MAKS. FALD (−Δ)</div>
                        <div className="text-xs font-bold text-sky-200">
                          {differenceMetric === 'sum_quotient'
                            ? `${heatmapComparison.maxNegativeDeltaS.toFixed(2)} S`
                            : `${heatmapComparison.maxNegativeDeltaDustUgM3.toFixed(0)} µg/m³`}
                        </div>
                      </div>
                      <div className="p-1.5 bg-orange-950/40 rounded border border-orange-500/50">
                        <div className="text-[11px] text-orange-300 font-bold">FORØGET ZONE (+Δ)</div>
                        <div className="text-xs font-bold text-orange-200">
                          {heatmapComparison.increasedZoneAreaM2.toLocaleString('da-DK')} m²
                        </div>
                      </div>
                      <div className="p-1.5 bg-cyan-950/40 rounded border border-cyan-500/50">
                        <div className="text-[11px] text-cyan-300 font-bold">AFLASTET ZONE (−Δ)</div>
                        <div className="text-xs font-bold text-cyan-200">
                          {heatmapComparison.decreasedZoneAreaM2.toLocaleString('da-DK')} m²
                        </div>
                      </div>
                    </div>

                    {/* Diverging Color Scale Bar (-Delta to +Delta) */}
                    <div className="p-1.5 rounded bg-slate-950/90 border border-slate-800 space-y-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-sky-300 font-bold">
                          ▼ Koncentrationsfald (T_B &lt; T_A)
                        </span>
                        <span className="text-slate-400">0 (Uændret)</span>
                        <span className="text-rose-300 font-bold">
                          ▲ Koncentrationsstigning (T_B &gt; T_A)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gradient-to-r from-sky-600 via-cyan-500 via-35% to-rose-600 border border-slate-700" />
                      {inspectedCell && (
                        <div className="flex items-center justify-between pt-0.5 text-[11px] text-slate-200 border-t border-slate-800/80">
                          <span>
                            Valgt Δ-celle ({inspectedCell.center.lat.toFixed(4)}°N,{' '}
                            {inspectedCell.center.lng.toFixed(4)}°E):
                          </span>
                          <span
                            className={`font-bold ${
                              inspectedCell.deltaS > 0
                                ? 'text-rose-300'
                                : inspectedCell.deltaS < 0
                                ? 'text-sky-300'
                                : 'text-slate-300'
                            }`}
                          >
                            T_A: {inspectedCell.sumQuotientA.toFixed(2)} → T_B:{' '}
                            {inspectedCell.sumQuotientB.toFixed(2)} (ΔS ={' '}
                            {inspectedCell.deltaS >= 0
                              ? `+${inspectedCell.deltaS.toFixed(2)}`
                              : inspectedCell.deltaS.toFixed(2)}{' '}
                            · ΔC ={' '}
                            {inspectedCell.deltaDustUgM3 >= 0
                              ? `+${inspectedCell.deltaDustUgM3.toFixed(0)}`
                              : inspectedCell.deltaDustUgM3.toFixed(0)}{' '}
                            µg/m³)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
                    <div className="p-1.5 bg-rose-950/40 rounded border border-rose-500/50">
                      <div className="text-[11px] text-rose-300 font-bold">NYT FANE-AREAL (T_B)</div>
                      <div className="text-xs font-bold text-rose-200">
                        +{heatmapComparison.totalNewlyExposedAreaM2.toLocaleString('da-DK')} m²
                      </div>
                    </div>
                    <div className="p-1.5 bg-fuchsia-950/40 rounded border border-fuchsia-500/50">
                      <div className="text-[11px] text-fuchsia-300 font-bold">OVERLAP (T_A ∩ T_B)</div>
                      <div className="text-xs font-bold text-fuchsia-200">
                        {heatmapComparison.totalPersistentOverlapAreaM2.toLocaleString('da-DK')} m²
                      </div>
                    </div>
                    <div className="p-1.5 bg-cyan-950/40 rounded border border-cyan-500/50">
                      <div className="text-[11px] text-cyan-300 font-bold">FRAFALDET (KUN T_A)</div>
                      <div className="text-xs font-bold text-cyan-200">
                        -{heatmapComparison.totalRetreatedAreaM2.toLocaleString('da-DK')} m²
                      </div>
                    </div>
                    <div className="p-1.5 bg-slate-950 rounded border border-amber-500/50">
                      <div className="text-[11px] text-amber-300 font-bold">FANE-FLYTNING</div>
                      <div className="text-xs font-bold text-white">
                        {primaryShift
                          ? `${primaryShift.centroidShiftMeters}m (${
                              heatmapComparison.windRotationSignedDeg >= 0 ? '+' : ''
                            }${heatmapComparison.windRotationSignedDeg}°)`
                          : '0m'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Narrative Summary & Top Receptor Delta Badges */}
                <div className="text-[11px] text-slate-200 bg-slate-950/90 border border-slate-800 rounded p-2 leading-snug">
                  {heatmapComparison.narrativeSummary}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] font-mono text-slate-400">
                    Største receptor-differens (T_B − T_A):
                  </span>
                  {topDeltaReceptors.map((rd) => {
                    const isInc = rd.deltaS > 0;
                    return (
                      <button
                        key={`delta-rec-${rd.receptorId}`}
                        type="button"
                        onClick={() => onSelectReceptor(rd.receptorId)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border transition-colors ${
                          isInc
                            ? 'bg-rose-950/70 border-rose-500/60 text-rose-200 hover:bg-rose-900'
                            : rd.deltaS < 0
                            ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-200 hover:bg-cyan-900'
                            : 'bg-slate-900 border-slate-700 text-slate-300'
                        }`}
                      >
                        {rd.receptorCode}:{' '}
                        {differenceMetric === 'sum_quotient'
                          ? `${rd.sumQuotientA.toFixed(2)} → ${rd.sumQuotientB.toFixed(2)} (${
                              rd.deltaS >= 0 ? `+${rd.deltaS.toFixed(2)}` : rd.deltaS.toFixed(2)
                            })`
                          : `${rd.dustConcAUgM3.toFixed(0)} → ${rd.dustConcBUgM3.toFixed(0)} µg/m³ (${
                              rd.deltaDustUgM3 >= 0
                                ? `+${rd.deltaDustUgM3.toFixed(0)}`
                                : rd.deltaDustUgM3.toFixed(0)
                            })`}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* REAL-TIME PROACTIVE HIGH-WIND (> 10 m/s) RECEPTOR NOTIFICATION OVERLAY ON MAP */}
      {!effectiveMapOnly && isHighWindAlert && top3ReceptorExposures.length > 0 && (
        <div
          data-map-window="high_wind_notification"
          onMouseDown={() =>
            mapWindowStates.high_wind_notification.isReleased &&
            handleFocusMapWindow('high_wind_notification')
          }
          role="alert"
          aria-live="assertive"
          style={
            mapWindowStates.high_wind_notification.isReleased
              ? {
                  left: `${mapWindowStates.high_wind_notification.x}px`,
                  top: `${mapWindowStates.high_wind_notification.y}px`,
                  zIndex: mapWindowStates.high_wind_notification.zIndex,
                }
              : undefined
          }
          className={`${
            mapWindowStates.high_wind_notification.isReleased
              ? 'fixed ring-2 ring-amber-300'
              : 'absolute bottom-24 right-3 z-30'
          } max-w-md bg-[var(--surface-overlay)] border border-rose-500/70 border-l-4 border-l-rose-500 rounded-md p-3 shadow-lg pointer-events-auto space-y-2 transition-opacity duration-300`}
        >
          <MapOverlayWindowControlStrip
            windowId="high_wind_notification"
            title={`⚠ Proaktiv Støv-Notifikation: Vind ${currentWeather.windSpeed10m} m/s (> 10 m/s)`}
            badgeText="AKUT ALARM"
            accentColorClass="text-rose-200"
            state={{
              ...mapWindowStates.high_wind_notification,
              isMinimized:
                mapWindowStates.high_wind_notification.isMinimized || isHighWindBannerMinimized,
            }}
            onToggleMinimize={() => {
              if (isHighWindBannerMinimized) setIsHighWindBannerMinimized(false);
              handleToggleMapWindowMinimize('high_wind_notification');
            }}
            onToggleRelease={handleToggleMapWindowRelease}
            onMove={handleMoveMapWindow}
            onFocus={handleFocusMapWindow}
          />

          {!isHighWindBannerMinimized && !mapWindowStates.high_wind_notification.isMinimized && (
            <>
              <div className="text-[11px] text-rose-100 leading-snug">
                Mest berørte receptorer fremhæves automatisk i realtid (nedvindsfane{' '}
                <strong className="text-amber-300">{plumeDirectionDeg}° {plumeToCompass}</strong> ·
                stød <strong className="text-amber-300">{currentWeather.windGusts10m} m/s</strong>).
                Klik for at fokusere:
              </div>

              <div className="space-y-1.5">
                {top3ReceptorExposures.map((recExp, idx) => {
                  const rank = idx + 1;
                  const isSel = selectedReceptorId === recExp.receptorId;
                  return (
                    <button
                      key={`hw-map-rec-${recExp.receptorId}`}
                      type="button"
                      onClick={() => {
                        onSelectReceptor(recExp.receptorId);
                        setPanOffsetPx({ x: 0, y: 0 });
                      }}
                      className={`w-full text-left p-2 rounded border transition-all flex items-center justify-between gap-2 font-mono text-xs ${
                        isSel
                          ? 'bg-rose-900/90 border-white text-white ring-1 ring-amber-300'
                          : rank === 1
                          ? 'bg-slate-950/90 border-amber-400/80 text-rose-100 hover:bg-rose-900/60'
                          : 'bg-slate-950/75 border-rose-500/40 text-slate-200 hover:bg-rose-900/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[11px] font-extrabold ${
                              rank === 1
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            #{rank} MEST BERØRT
                          </span>
                          <span className="font-bold text-white truncate">
                            {recExp.receptorCode}: {recExp.receptorName}
                          </span>
                        </div>
                        <div className="text-[11px] text-rose-200/90 truncate mt-0.5">
                          {recExp.address} · {recExp.distanceFromNearestSourceMeters}m fra{' '}
                          {recExp.dominantSourceName.split(':')[0]}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-xs font-extrabold ${
                            recExp.sumQuotient >= 1.0 ? 'text-rose-300' : 'text-amber-300'
                          }`}
                        >
                          S = {recExp.sumQuotient.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-amber-200">Fokusér →</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-1.5 rounded bg-slate-950/90 border border-amber-400/50 text-[11px] font-mono text-amber-200 flex items-start gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                <span>
                  <strong>PROAKTIV HANDLING:</strong> Aktivér højtryks-vandkanoner ved{' '}
                  {top3ReceptorExposures[0]?.dominantSourceName.split(':')[0]} og stands uafskærmet
                  nedbrydning jf. PSS Sag W22085 pkt. 7.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 24-Hour Gaussian Puff Peak Receptor Banner Overlay when Puff Mode is active and Heatmap Comparison is hidden */}
      {!effectiveMapOnly && isPuffMode && !showHeatmapComparison && peakReceptor && (
        <div
          data-map-window="puff_24h_peak_heatmap"
          onMouseDown={() =>
            mapWindowStates.puff_24h_peak_heatmap.isReleased &&
            handleFocusMapWindow('puff_24h_peak_heatmap')
          }
          className={`${
            mapWindowStates.puff_24h_peak_heatmap.isReleased
              ? 'fixed ring-2 ring-amber-400'
              : 'absolute top-20 left-3 z-20'
          } max-w-lg bg-[var(--surface-overlay)] border border-[var(--border-subtle)] border-l-4 border-l-amber-400 rounded-md p-3 shadow-lg pointer-events-auto transition-opacity duration-300 ease-out`}
          style={
            mapWindowStates.puff_24h_peak_heatmap.isReleased
              ? {
                  left: `${mapWindowStates.puff_24h_peak_heatmap.x}px`,
                  top: `${mapWindowStates.puff_24h_peak_heatmap.y}px`,
                  zIndex: mapWindowStates.puff_24h_peak_heatmap.zIndex,
                  opacity: 0.35 + crossFadeProgress * 0.65,
                }
              : { opacity: 0.35 + crossFadeProgress * 0.65 }
          }
        >
          <MapOverlayWindowControlStrip
            windowId="puff_24h_peak_heatmap"
            title="Gaussisk Puff-Historik Heatmap (24t Akkumuleret Dosis)"
            badgeText={`∑=${peakReceptor.cumulativeSumDose.toFixed(1)} S·t`}
            accentColorClass="text-amber-300"
            state={mapWindowStates.puff_24h_peak_heatmap}
            onToggleMinimize={handleToggleMapWindowMinimize}
            onToggleRelease={handleToggleMapWindowRelease}
            onMove={handleMoveMapWindow}
            onFocus={handleFocusMapWindow}
          />
          {!mapWindowStates.puff_24h_peak_heatmap.isMinimized && (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>GAUSSISK PUFF-HISTORIK (24 TIMER) · HØJESTE AKKUMULEREDE DOSIS</span>
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {peakReceptor.receptorName}
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    Adresse: {peakReceptor.address} · GPS: {peakReceptor.position.lat.toFixed(4)}°N,{' '}
                    {peakReceptor.position.lng.toFixed(4)}°E
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {onSelectHourFromPeak && (
                    <button
                      type="button"
                      onClick={() => onSelectHourFromPeak(peakReceptor.peakHourIndex)}
                      className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 text-xs font-mono font-bold hover:bg-amber-300 transition-colors whitespace-nowrap shadow-md"
                    >
                      Spids kl. {peakReceptor.peakHourLabel} →
                    </button>
                  )}
                  {onToggleAnimatePlumeRoute && (
                    <button
                      type="button"
                      onClick={onToggleAnimatePlumeRoute}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1 shadow-md ${
                        isAnimatingPlumeRoute
                          ? 'bg-cyan-400 text-slate-950 ring-1 ring-white'
                          : 'bg-cyan-950 text-cyan-200 border border-cyan-400/80 hover:bg-cyan-900'
                      }`}
                    >
                      {isAnimatingPlumeRoute ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>Stop Rute ({currentWeather.hourLabel})</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          <span>Animér Fanevej-Rute</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/90 text-xs font-mono">
                <div>
                  <div className="text-[11px] text-slate-400">AKKUMULERET 24T DOSIS</div>
                  <div className="text-sm font-bold text-rose-400">
                    ∑ = {peakReceptor.cumulativeSumDose.toFixed(2)} S·timer
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">KLOKKESLÆT SPIDSBELASTNING</div>
                  <div className="text-sm font-bold text-amber-300">
                    kl. {peakReceptor.peakHourLabel} (S={peakReceptor.peakSumQuotient.toFixed(2)})
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">STØV &amp; TUNGMETAL-DEPONERING</div>
                  <div className="text-xs font-bold text-slate-100">
                    {peakReceptor.totalDepositedHeavyMetalsAndPcbUgM2} µg/m²/døgn
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Map Click Mode Active Instruction Banner */}
      {mapClickMode !== 'none' && (
        <div className="absolute top-20 right-3 z-20 bg-cyan-950/95 border border-cyan-400 text-cyan-100 px-3.5 py-2 rounded-md text-xs flex items-center gap-2 shadow-lg">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <span>
            Klik hvor som helst i Ringparken på kortet for at placere{' '}
            <strong>
              {mapClickMode === 'add_source'
                ? 'en ny brugerdefineret forureningskilde'
                : mapClickMode === 'add_receptor'
                ? 'et nyt målepunkt (receptor)'
                : 'et fysisk observationspunkt (Algedonisk Signal)'}
            </strong>
            .
          </span>
          <button
            type="button"
            onClick={() => onSetMapClickMode('none')}
            className="ml-2 underline text-cyan-300 hover:text-white"
          >
            Annuller
          </button>
        </div>
      )}

      {/* 6-HOUR DUST DRIFT FORECAST 2D ANIMATION HUD CONTROL OVERLAY (+0t to +6t) */}
      {!effectiveMapOnly && show6hDustForecast && (
        <div
          data-map-window="forecast_6h_heatmap"
          onMouseDown={() =>
            mapWindowStates.forecast_6h_heatmap.isReleased &&
            handleFocusMapWindow('forecast_6h_heatmap')
          }
          style={
            mapWindowStates.forecast_6h_heatmap.isReleased
              ? {
                  left: `${mapWindowStates.forecast_6h_heatmap.x}px`,
                  top: `${mapWindowStates.forecast_6h_heatmap.y}px`,
                  zIndex: mapWindowStates.forecast_6h_heatmap.zIndex,
                }
              : undefined
          }
          className={`${
            mapWindowStates.forecast_6h_heatmap.isReleased
              ? 'fixed ring-2 ring-cyan-400'
              : 'absolute bottom-16 right-3 z-20'
          } w-[430px] max-w-[calc(100vw-24px)] bg-[var(--surface-overlay)] border border-[var(--border-subtle)] border-l-4 border-l-sky-400 rounded-md p-3 shadow-lg pointer-events-auto space-y-2.5 font-mono text-xs`}
        >
          <MapOverlayWindowControlStrip
            windowId="forecast_6h_heatmap"
            title="6-Timers Støv-Prognose Heatmap (+0t → +6t)"
            badgeText={`+${sixHourDustForecastData.clampedT.toFixed(1)}t`}
            accentColorClass="text-cyan-300"
            state={{
              ...mapWindowStates.forecast_6h_heatmap,
              isMinimized:
                mapWindowStates.forecast_6h_heatmap.isMinimized || is6hForecastCardMinimized,
            }}
            onToggleMinimize={() => {
              if (is6hForecastCardMinimized) setIs6hForecastCardMinimized(false);
              handleToggleMapWindowMinimize('forecast_6h_heatmap');
            }}
            onToggleRelease={handleToggleMapWindowRelease}
            onMove={handleMoveMapWindow}
            onFocus={handleFocusMapWindow}
            onClose={() => setShow6hDustForecast(false)}
          />

          {/* Live Playback Controls + Speed Selector + Current Interpolated Telemetry */}
          <div className="flex items-center justify-between gap-2 bg-slate-950/90 border border-slate-800 rounded p-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying6hDustForecast((p) => !p)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
                  isPlaying6hDustForecast
                    ? 'bg-rose-500 text-white hover:bg-rose-400'
                    : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                }`}
              >
                {isPlaying6hDustForecast ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>Afspil</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded p-0.5">
                {(['0.5x', '1x', '2x'] as const).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setForecast6hSpeed(spd)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      forecast6hSpeed === spd
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-extrabold text-amber-300">
                +{sixHourDustForecastData.clampedT.toFixed(1)}t frem (kl.{' '}
                {sixHourDustForecastData.activeStep.hourLabel}
                {sixHourDustForecastData.activeStep.isNextDay ? ' +1d' : ''})
              </div>
              <div className="text-[11px] text-cyan-200">
                {sixHourDustForecastData.interpolatedWindSpeedMs} m/s → Fane{' '}
                {sixHourDustForecastData.interpolatedPlumeDeg}° (
                {sixHourDustForecastData.interpolatedPlumeCompass}) · S_max={sixHourDustForecastData.interpolatedMaxS.toFixed(2)}
              </div>
            </div>
          </div>

          {!is6hForecastCardMinimized && !mapWindowStates.forecast_6h_heatmap.isMinimized && (
            <>
              {/* Interactive 0..6h Scrubber & Hourly Step Buttons */}
              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.05}
                  value={sixHourDustForecastData.clampedT}
                  onChange={(e) => {
                    myceliumLiveAlerts.notifyTimelineScrub();
                    setIsPlaying6hDustForecast(false);
                    setForecast6hProgress(Number(e.target.value));
                  }}
                  aria-label="Scrub 6-timers støv-prognose (+0t til +6t)"
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />

                <div className="grid grid-cols-7 gap-1">
                  {sixHourDustForecastData.hourlySteps.map((st) => {
                    const isCurrentStep =
                      Math.round(sixHourDustForecastData.clampedT) === st.offsetHours;
                    return (
                      <button
                        key={`fc6h-btn-${st.offsetHours}`}
                        type="button"
                        onClick={() => {
                          myceliumLiveAlerts.notifyTimelineScrub();
                          setIsPlaying6hDustForecast(false);
                          setForecast6hProgress(st.offsetHours);
                        }}
                        className={`p-1 rounded border text-center transition-all ${
                          isCurrentStep
                            ? 'bg-cyan-500/25 border-cyan-300 text-white font-bold shadow-xs'
                            : 'bg-slate-950/90 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                        title={`Kl. ${st.hourLabel} (${st.labelOffset}): Vind ${st.windSpeedMs} m/s → Fane ${st.plumeToDeg}° (${st.plumeToCompassLabel}) · Maks S=${st.maxPredictedS.toFixed(2)}`}
                      >
                        <div className="text-[11px] font-extrabold text-cyan-300">
                          +{st.offsetHours}t
                        </div>
                        <div className="text-[11px] text-slate-300">{st.hourLabel}</div>
                        <div
                          className={`text-[11px] font-bold ${
                            st.maxPredictedS >= 1.0
                              ? 'text-rose-400'
                              : st.maxPredictedS >= 0.5
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          {st.plumeToCompassLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Predicted Receptor Impact Timeline over the Next 6 Hours */}
              <div className="space-y-1 pt-1 border-t border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase">
                  <span>Forudsagt Støv-Eksponering (Næste 6 Timer)</span>
                  <span>Kilde: {sixHourDustForecastData.originSource.code}</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {sixHourDustForecastData.receptorForecastWarnings
                    .slice(0, 4)
                    .map((rw) => {
                      const isCritical = rw.peakS >= 1.0;
                      const isModerate = rw.peakS >= 0.5 && rw.peakS < 1.0;
                      return (
                        <button
                          key={`fc6h-rec-${rw.receptorId}`}
                          type="button"
                          onClick={() => {
                            onSelectReceptor(rw.receptorId);
                            setIsPlaying6hDustForecast(false);
                            setForecast6hProgress(rw.peakOffsetHours);
                          }}
                          className={`text-left p-1.5 rounded border transition-colors ${
                            isCritical
                              ? 'bg-rose-950/60 border-rose-500/70 hover:border-rose-300'
                              : isModerate
                              ? 'bg-amber-950/50 border-amber-500/60 hover:border-amber-300'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-white">
                              {rw.receptorCode}
                            </span>
                            <span
                              className={`text-[11px] font-extrabold ${
                                isCritical
                                  ? 'text-rose-300'
                                  : isModerate
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                              }`}
                            >
                              Spids S={rw.peakS.toFixed(2)} (+{rw.peakOffsetHours}t)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {rw.address.split(',')[0]}
                          </div>
                          <div className="text-[11px] text-cyan-300 mt-0.5">
                            {rw.firstHitOffsetHours !== null
                              ? `⚠ Rammes om +${rw.firstHitOffsetHours}t (kl. ${rw.firstHitHourLabel})`
                              : '✓ Uden for hovedfane (0–6t)'}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MAIN MAP VIEWPORT */}
      <div className="relative flex-1 w-full h-full">
        {/* 2D Map Viewport 'Layer Control' Panel (Asbestos, Heavy Metals, PCB, Quartz Wool) */}
        {!effectiveMapOnly && (
          <div
            data-testid="map-substance-layer-control"
            className="absolute top-3 left-3 z-20 pointer-events-auto w-56 rounded-md bg-[var(--surface-panel)]/95 border border-[var(--border-subtle)] shadow-lg font-mono text-[11px]"
          >
            <button
              type="button"
              onClick={() => setIsLayerControlExpanded((v) => !v)}
              className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-[var(--surface-card)] rounded-t-md cursor-pointer"
              aria-expanded={isLayerControlExpanded}
            >
              <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Layer Control ({activeSubstanceLayerCount}/5)</span>
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                {isLayerControlExpanded ? 'Skjul' : 'Vis'}
              </span>
            </button>

            {isLayerControlExpanded && (
              <div className="px-2.5 pb-2.5 pt-1 border-t border-[var(--border-subtle)] space-y-1.5">
                <div className="text-[11px] font-sans text-[var(--text-secondary)]">
                  Tænd/sluk spredningslag individuelt:
                </div>
                {(
                  [
                    {
                      key: 'asbestos' as const,
                      label: 'Asbestos (Asbestfibre)',
                      dotClass: 'bg-emerald-400',
                    },
                    {
                      key: 'heavyMetals' as const,
                      label: 'Heavy Metals (Tungmetaller)',
                      dotClass: 'bg-amber-400',
                    },
                    {
                      key: 'pcb' as const,
                      label: 'PCB (Polyklor. Bifenyler)',
                      dotClass: 'bg-violet-400',
                    },
                    {
                      key: 'quartzWool' as const,
                      label: 'Quartz Wool (Kvartsuld)',
                      dotClass: 'bg-cyan-400',
                    },
                    {
                      key: 'moldSewer' as const,
                      label: 'Skimmel & Kloak (CFU/m³)',
                      dotClass: 'bg-lime-400',
                    },
                  ]
                ).map((item) => {
                  const checked = visibleDispersionSubstances[item.key];
                  return (
                    <label
                      key={item.key}
                      data-testid={`layer-toggle-${item.key}`}
                      className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-[var(--surface-card)] border-slate-600 text-[var(--text-primary)]'
                          : 'bg-[var(--surface-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] opacity-75'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setVisibleDispersionSubstances((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }))
                          }
                          className="accent-sky-400 cursor-pointer shrink-0"
                        />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${item.dotClass}`} />
                        <span className="truncate font-semibold">{item.label}</span>
                      </span>
                    </label>
                  );
                })}

                {onToggleWaterMainLayer && (
                  <label
                    data-testid="layer-toggle-water-main"
                    className={`flex items-center justify-between gap-2 px-1.5 py-1 rounded border cursor-pointer transition-colors ${
                      showWaterMainLayer
                        ? 'bg-sky-950/70 border-sky-400/80 text-sky-100'
                        : 'bg-[var(--surface-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] opacity-80'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={showWaterMainLayer}
                        onChange={onToggleWaterMainLayer}
                        className="accent-sky-400 cursor-pointer shrink-0"
                      />
                      <Droplets className="w-3 h-3 text-sky-400 shrink-0" />
                      <span className="truncate font-semibold">Drikkevands Hovedrør</span>
                    </span>
                  </label>
                )}

                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleDispersionSubstances({
                        asbestos: true,
                        heavyMetals: true,
                        pcb: true,
                        quartzWool: true,
                        moldSewer: true,
                      })
                    }
                    className="flex-1 py-1 rounded bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-[11px] font-bold text-sky-300 cursor-pointer"
                  >
                    Vis alle (5/5)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleDispersionSubstances({
                        asbestos: false,
                        heavyMetals: false,
                        pcb: false,
                        quartzWool: false,
                        moldSewer: false,
                      })
                    }
                    className="flex-1 py-1 rounded bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-[11px] font-bold text-slate-300 cursor-pointer"
                  >
                    Ryd kort (0/5)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {useGoogleMapsEngine ? (
          <APIProvider apiKey={rawApiKey} language="da" region="DK">
            <GoogleMap
              key={`gmp-map-${gmpViewKey}`}
              defaultCenter={gmpCenter}
              defaultZoom={zoom}
              mapId="DEMO_MAP_ID"
              mapTypeId="hybrid"
              gestureHandling="greedy"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              onClick={(ev) => {
                if (isLeakPinDropMode && ev.detail.latLng && waterMainTelemetry) {
                  handlePlaceVirtualLeakPinAtPoint(ev.detail.latLng);
                  return;
                }
                if (mapClickMode !== 'none' && ev.detail.latLng) {
                  onMapAddNode(
                    ev.detail.latLng,
                    mapClickMode === 'add_source'
                      ? 'source'
                      : mapClickMode === 'add_receptor'
                      ? 'receptor'
                      : 'observation'
                  );
                }
              }}
            >
              {/* Receptor Zone Polygons (Afd. 23, 24, 26, 32 + Roads) */}
              {receptors.map((rec) => {
                const exp = exposureByReceptorId[rec.id];
                const isHit = exp && (exp.riskLevel === 'red' || exp.riskLevel === 'orange');
                return (
                  <Polygon
                    key={`gmp-rec-poly-${rec.id}`}
                    paths={rec.polygon}
                    strokeColor={isHit ? '#f43f5e' : '#38bdf8'}
                    strokeOpacity={0.9}
                    strokeWeight={isHit ? 2.5 : 1.5}
                    fillColor={isHit ? '#f43f5e' : '#0284c7'}
                    fillOpacity={isHit ? 0.22 : 0.12}
                    onClick={() => onSelectReceptor(rec.id)}
                  />
                );
              })}

              {/* Kierulffsvej DN200 Drinking Water Main Infrastructure Overlay on Google Maps */}
              {showWaterMainLayer && waterMainTelemetry && (
                <>
                  {showLerBuffer && waterMainTelemetry.lerBufferPolygon.length >= 3 && (
                    <Polygon
                      paths={waterMainTelemetry.lerBufferPolygon}
                      strokeColor={
                        waterMainTelemetry.overallStatus === 'critical_rupture'
                          ? '#ef4444'
                          : '#38bdf8'
                      }
                      strokeOpacity={0.78}
                      strokeWeight={1.5}
                      fillColor={
                        waterMainTelemetry.overallStatus === 'critical_rupture'
                          ? '#ef4444'
                          : '#0ea5e9'
                      }
                      fillOpacity={0.16}
                      onClick={() => setShowWaterMainInspector(true)}
                    />
                  )}
                  {waterMainTelemetry.serviceBranches.map((br) => (
                    <Polyline
                      key={`gmp-wm-branch-${br.id}`}
                      path={[br.startOnMain, br.buildingConnection]}
                      strokeColor={
                        br.cappingStatus === 'uncapped_risk' ? '#ef4444' : '#38bdf8'
                      }
                      strokeOpacity={0.9}
                      strokeWeight={2.6}
                      onClick={() => setShowWaterMainInspector(true)}
                    />
                  ))}
                  {waterMainTelemetry.sceneSegments.map((seg) => {
                    const segStroke =
                      waterMainTelemetry.overallStatus === 'critical_rupture'
                        ? '#ef4444'
                        : waterMainTelemetry.overallStatus === 'warning' ||
                          waterMainTelemetry.overallStatus === 'advisory'
                        ? '#f59e0b'
                        : seg.material === 'PE100_SDR17_IKKE_DIFFUSIONSTAET'
                        ? '#06b6d4'
                        : '#0ea5e9';
                    return (
                      <Polyline
                        key={`gmp-wm-seg-${seg.id}`}
                        path={seg.waypoints.map((w) => ({ lat: w.lat, lng: w.lng }))}
                        strokeColor={segStroke}
                        strokeOpacity={0.96}
                        strokeWeight={5}
                        onClick={(ev) => {
                          if (isLeakPinDropMode && ev?.latLng) {
                            handlePlaceVirtualLeakPinAtPoint({
                              lat: ev.latLng.lat(),
                              lng: ev.latLng.lng(),
                            });
                            return;
                          }
                          setSelectedWaterMainSectionId(seg.id);
                          setShowWaterMainInspector(true);
                        }}
                      />
                    );
                  })}
                  {waterMainTelemetry.valves.map((valve) => (
                    <AdvancedMarker
                      key={`gmp-wm-valve-${valve.id}`}
                      position={valve.coordinate}
                      onClick={() => setShowWaterMainInspector(true)}
                    >
                      <div
                        className={`px-1.5 py-0.5 rounded border text-[11px] font-mono font-bold shadow cursor-pointer ${
                          valve.status === 'closed'
                            ? 'bg-rose-700 text-white border-rose-200'
                            : 'bg-sky-950/95 text-sky-200 border-sky-400'
                        }`}
                      >
                        {valve.code}
                      </div>
                    </AdvancedMarker>
                  ))}
                  {waterMainTelemetry.hydrants.map((hyd) => (
                    <AdvancedMarker
                      key={`gmp-wm-hyd-${hyd.id}`}
                      position={hyd.coordinate}
                      onClick={() => setShowWaterMainInspector(true)}
                    >
                      <div className="px-1.5 py-0.5 rounded-full bg-rose-900/95 text-rose-100 border border-rose-300 text-[11px] font-mono font-bold shadow cursor-pointer">
                        {hyd.code}
                      </div>
                    </AdvancedMarker>
                  ))}

                  {/* Virtual Leak Pin Soil Saturation Zones & Percolation Impact on Ringparken Buildings (GMP) */}
                  {effectiveVirtualLeakImpact && (
                    <>
                      {[...effectiveVirtualLeakImpact.saturationZones]
                        .reverse()
                        .map((zone) => (
                          <Polygon
                            key={`gmp-leak-zone-${zone.tier}`}
                            paths={buildGeoCirclePolygon(
                              effectiveVirtualLeakImpact.pinPoint,
                              zone.radiusMeters,
                              28
                            )}
                            strokeColor={zone.colorHex}
                            strokeOpacity={0.9}
                            strokeWeight={zone.tier === 'core_saturated' ? 2.4 : 1.5}
                            fillColor={zone.colorHex}
                            fillOpacity={
                              zone.tier === 'core_saturated'
                                ? 0.34
                                : zone.tier === 'capillary_front'
                                ? 0.22
                                : 0.13
                            }
                          />
                        ))}
                      {effectiveVirtualLeakImpact.impactedBuildings.map((bld) => (
                        <React.Fragment key={`gmp-leak-bld-${bld.buildingId}`}>
                          <Polyline
                            path={[effectiveVirtualLeakImpact.pinPoint, bld.center]}
                            strokeColor={
                              bld.severity === 'critical'
                                ? '#f43f5e'
                                : bld.severity === 'high'
                                ? '#f59e0b'
                                : '#38bdf8'
                            }
                            strokeOpacity={0.9}
                            strokeWeight={2.2}
                          />
                          <AdvancedMarker position={bld.center}>
                            <div
                              className={`px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold shadow-md tabular-nums whitespace-nowrap ${
                                bld.severity === 'critical'
                                  ? 'bg-rose-950/95 border-rose-400 text-rose-100'
                                  : bld.severity === 'high'
                                  ? 'bg-amber-950/95 border-amber-400 text-amber-100'
                                  : 'bg-sky-950/95 border-sky-400 text-sky-100'
                              }`}
                            >
                              {bld.buildingCode} · {bld.arrivalMinutes.toFixed(0)} min ·{' '}
                              {bld.intrusionRateLh.toFixed(0)} L/t
                            </div>
                          </AdvancedMarker>
                        </React.Fragment>
                      ))}
                      <AdvancedMarker position={effectiveVirtualLeakImpact.pinPoint}>
                        <div className="px-2 py-0.5 rounded bg-rose-600 text-white border-2 border-amber-200 font-mono text-[11px] font-extrabold shadow-xl flex items-center gap-1 whitespace-nowrap">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>
                            LÆKAGEPUNKT · {effectiveVirtualLeakImpact.dischargeLs.toFixed(1)} L/s
                          </span>
                        </div>
                      </AdvancedMarker>
                    </>
                  )}

                  {/* Focus Mode Items 1 & 2: Drikkevands-hovedrør Tooltip + WaterMainBek1272Badge + Structural Integrity Alert on Google Maps */}
                  {waterMainTelemetry && (
                    <AdvancedMarker
                      position={waterMainTelemetry.inspectionCenter}
                      onClick={() => setShowWaterMainInspector(true)}
                    >
                      <div
                        data-testid="gmp-water-main-bek1272-indicator"
                        className="flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <div
                          data-testid="gmp-water-main-tooltip-container"
                          data-critical-pulse={isWaterMainCriticalPulse ? 'true' : 'false'}
                          className={`px-2 py-0.5 rounded bg-[#090d16]/95 border font-mono text-[11px] font-bold shadow-md tabular-nums whitespace-nowrap ${
                            isWaterMainCriticalPulse
                              ? 'border-rose-500 text-rose-100 water-main-tooltip-critical-pulse'
                              : 'border-sky-400 text-sky-200'
                          }`}
                        >
                          Drikkevands-Hovedrør DN200 (-1,65m) · {waterMainTelemetry.pressureBar.toFixed(1)} bar · PPV{' '}
                          {waterMainTelemetry.pipePpvMmPerSec.toFixed(1)} mm/s ·{' '}
                          {waterMainTelemetry.hasSteelRoadPlates ? 'Køreplader OK' : 'Uden plader'}
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <WaterMainBek1272Badge
                            telemetry={waterMainTelemetry}
                            visible={showWaterMainLayer}
                            variant="compact"
                            testId="gmp-water-main-bek1272-status-badge"
                          />
                          {isStructuralIntegrityAlert && (
                            <span
                              data-testid="gmp-structural-integrity-alert-badge"
                              className="px-1.5 py-0.5 rounded bg-rose-900/95 border border-rose-400 text-rose-100 font-mono text-[10px] font-extrabold inline-flex items-center gap-1 shadow-md"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
                              <span>
                                Vibrationsfare (DIN 4150-3): {waterMainTelemetry.pipePpvMmPerSec.toFixed(1)}/25 mm/s ({ppvPctOf25Threshold}%)
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}
                </>
              )}

              {/* System B Simultaneous Algedonic Dispatch (S1 + S3) Layer on Google Maps */}
              {simultaneousDispatch?.active && (
                <>
                  {/* System 1 P1 Danger Zone Polygon */}
                  {simultaneousDispatch.system1State.dangerPolygon.length >= 3 && (
                    <Polygon
                      paths={simultaneousDispatch.system1State.dangerPolygon}
                      strokeColor="#ef4444"
                      strokeOpacity={simultaneousDispatch.isBlinkingP1 ? 0.98 : 0.85}
                      strokeWeight={simultaneousDispatch.isBlinkingP1 ? 3.2 : 2.4}
                      fillColor="#dc2626"
                      fillOpacity={simultaneousDispatch.isBlinkingP1 ? 0.28 : 0.18}
                    />
                  )}

                  {/* System 1 ISA-18.2 P1 Inverted-Octagon Hazard Beacon */}
                  <AdvancedMarker
                    position={simultaneousDispatch.system1State.epicenter}
                    onClick={() => {
                      if (simultaneousDispatch.isBlinkingP1 && onAcknowledgeSimultaneousP1) {
                        onAcknowledgeSimultaneousP1();
                      } else {
                        onOpenSimultaneousModal?.();
                      }
                    }}
                  >
                    <div
                      className={`px-2 py-1 rounded border-2 font-mono text-[11px] font-extrabold shadow-2xl cursor-pointer flex items-center gap-1.5 ${
                        simultaneousDispatch.isBlinkingP1
                          ? 'bg-rose-600 text-white border-amber-200 animate-pulse'
                          : 'bg-rose-900 text-rose-100 border-rose-400'
                      }`}
                      style={{
                        clipPath:
                          'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
                      }}
                    >
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        P1 FAREZONE · {simultaneousDispatch.system1State.epicenterLabelDa}
                      </span>
                    </div>
                  </AdvancedMarker>

                  {/* System 1 Upwind/Upslope Escape Vectors to Valbyvej & Rosenkildevej */}
                  {simultaneousDispatch.system1State.escapeVectors.map((vec) => (
                    <React.Fragment key={`gmp-s1-escape-${vec.id}`}>
                      <Polyline
                        path={[vec.origin, vec.targetMusterPoint]}
                        strokeColor="#22c55e"
                        strokeOpacity={0.96}
                        strokeWeight={3.6}
                      />
                      <AdvancedMarker position={vec.targetMusterPoint}>
                        <div className="px-2 py-0.5 rounded bg-emerald-950/95 border border-emerald-400 text-emerald-100 font-mono text-[11px] font-bold shadow-lg whitespace-nowrap">
                          ▲ FLUGT MODVIND → {vec.streetName} ({vec.distanceMeters} m · {vec.bearingDeg}°)
                        </div>
                      </AdvancedMarker>
                    </React.Fragment>
                  ))}

                  {/* System 1 Island Mode (Ø-DRIFT) Protective Shields on Afd. 23, 24, 26, 32, Rødtjørnevej 2 */}
                  {buildings
                    .filter((b) =>
                      simultaneousDispatch.system1State.islandModeBlockIds.includes(b.id)
                    )
                    .map((b) => (
                      <AdvancedMarker key={`gmp-s1-island-${b.id}`} position={b.center}>
                        <div className="px-1.5 py-0.5 rounded bg-emerald-900/95 border border-cyan-300 text-cyan-100 font-mono text-[11px] font-bold shadow-md flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-300 shrink-0" />
                          <span>Ø-DRIFT: {b.code}</span>
                        </div>
                      </AdvancedMarker>
                    ))}

                  {/* System 3 Locked Water Main Valves (V-VEST & V-MIDT) */}
                  {waterMainTelemetry?.valves
                    .filter((v) =>
                      simultaneousDispatch.system3State.lockedValveCodes.includes(
                        v.code as 'V-VEST' | 'V-MIDT'
                      )
                    )
                    .map((v) => (
                      <AdvancedMarker key={`gmp-s3-valve-${v.id}`} position={v.coordinate}>
                        <div className="px-2 py-0.5 rounded bg-rose-700 text-white border border-amber-200 font-mono text-[11px] font-extrabold shadow-xl flex items-center gap-1">
                          <Lock className="w-3 h-3 shrink-0" />
                          <span>{v.code} LUKKET T1</span>
                        </div>
                      </AdvancedMarker>
                    ))}

                  {/* System 3 Emergency Tanker Ingress Corridors (Valbyvej/Rosenkildevej OPEN, Nordre Ringgade CLOSED) */}
                  {simultaneousDispatch.system3State.tankerIngressCorridors.map((corridor) => {
                    const midPt =
                      corridor.waypoints[Math.floor(corridor.waypoints.length / 2)] ||
                      corridor.waypoints[0];
                    const isOpen = corridor.status === 'OPEN_INGRESS';
                    return (
                      <React.Fragment key={`gmp-s3-corridor-${corridor.id}`}>
                        <Polyline
                          path={corridor.waypoints}
                          strokeColor={isOpen ? '#10b981' : '#ef4444'}
                          strokeOpacity={isOpen ? 0.92 : 0.85}
                          strokeWeight={isOpen ? 4 : 3}
                        />
                        {midPt && (
                          <AdvancedMarker position={midPt}>
                            <div
                              className={`px-2 py-0.5 rounded border font-mono text-[11px] font-bold shadow-lg whitespace-nowrap ${
                                isOpen
                                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                                  : 'bg-rose-950/95 border-rose-400 text-rose-200'
                              }`}
                            >
                              {isOpen
                                ? `TANKVOGN ÅBEN: ${corridor.streetName}`
                                : `SPÆRRET: ${corridor.streetName}`}
                            </div>
                          </AdvancedMarker>
                        )}
                      </React.Fragment>
                    );
                  })}
                </>
              )}

              {/* Connected Autonomous Receptor Mesh Network (All Receptors Connected) on Google Maps */}
              {showAutonomousMesh &&
                autonomousMesh.edges.map((edge) => (
                  <Polyline
                    key={`gmp-mesh-${edge.edgeId}`}
                    path={[edge.fromPos, edge.toPos]}
                    strokeColor={
                      edge.bothNodesAlgedonic
                        ? '#f43f5e'
                        : edge.eitherNodeAlgedonic
                        ? '#f59e0b'
                        : '#22d3ee'
                    }
                    strokeOpacity={
                      edge.bothNodesAlgedonic
                        ? 0.92
                        : edge.eitherNodeAlgedonic
                        ? 0.65
                        : 0.45
                    }
                    strokeWeight={
                      edge.bothNodesAlgedonic
                        ? 2.8
                        : edge.isSpanningBackbone
                        ? 2.0
                        : 1.3
                    }
                  />
                ))}

              {(showAutonomousMesh ||
                showMyceliumAlertCenter ||
                myceliumScenario !== 'live_telemetry') && (
                <MyceliumGoogleMapsOverlayLayer
                  state={myceliumSimState}
                  onSelectReceptor={onSelectReceptor}
                />
              )}

              {/* CSS Neighbor-Complaint Noise Impulse Pressure-Wave Propagation per Neighbor Block on Google Maps (Activated when v > 10 m/s) */}
              {isMapBlockPressureWaveActive &&
                neighborBlockPressureTargets.map((item) => (
                  <AdvancedMarker
                    key={`gmp-pressure-wave-${item.receptor.id}`}
                    position={item.receptor.center}
                  >
                    <div
                      className={`map-gmp-pressure-wave-wrap ${mapWaveSpeedTierClass}`}
                      data-testid={`gmp-neighbor-pressure-wave-${item.receptor.code}`}
                    >
                      <span className="map-gmp-pressure-ring map-gmp-pressure-ring--1" />
                      <span className="map-gmp-pressure-ring map-gmp-pressure-ring--2" />
                      <span className="map-gmp-pressure-ring map-gmp-pressure-ring--3" />
                    </div>
                  </AdvancedMarker>
                ))}

              {/* Item 6: > 85 dB Demolition Source Acoustic Wavefront Propagation on Google Maps */}
              {showSource85DbWavefronts &&
                sourceWavefrontTargets.map((entry) => (
                  <React.Fragment key={`gmp-src-wavefront-${entry.source.id}`}>
                    <AdvancedMarker position={entry.source.position}>
                      <div
                        className="map-gmp-source-wavefront-wrap"
                        data-testid={`gmp-source-85db-wavefront-${entry.source.code}`}
                        style={
                          {
                            '--source-wave-dur': `${Math.max(
                              0.85,
                              1.75 - Math.max(0, entry.peakLafmaxDb - 85) * 0.04
                            ).toFixed(2)}s`,
                          } as React.CSSProperties
                        }
                      >
                        <span className="map-gmp-source-wavefront-ring map-gmp-source-wavefront-ring--1" />
                        <span className="map-gmp-source-wavefront-ring map-gmp-source-wavefront-ring--2" />
                        <span className="map-gmp-source-wavefront-ring map-gmp-source-wavefront-ring--3" />
                      </div>
                    </AdvancedMarker>
                    {entry.impactedReceptors.map((hit) => (
                      <Polyline
                        key={`gmp-src-wave-ray-${entry.source.id}-${hit.receptor.id}`}
                        path={[entry.source.position, hit.receptor.center]}
                        strokeColor="#f43f5e"
                        strokeOpacity={0.68}
                        strokeWeight={2}
                      />
                    ))}
                  </React.Fragment>
                ))}

              {/* Item 7: High-Wind Gust (>12 m/s) Affected Receptor Highlight Markers on Google Maps */}
              {isHighGustAlert &&
                highGustCorrelationData.affectedReceptors.map((item) => (
                  <AdvancedMarker
                    key={`gmp-gust-highlight-${item.receptor.id}`}
                    position={item.receptor.center}
                    onClick={() => onSelectReceptor(item.receptor.id)}
                  >
                    <div className="px-1.5 py-0.5 rounded bg-amber-950/95 border border-amber-400 text-amber-200 font-mono text-[11px] font-bold shadow-lg whitespace-nowrap tabular-nums">
                      STØD &gt;12m/s · {item.receptor.code} (S={item.sumQuotient.toFixed(2)})
                    </div>
                  </AdvancedMarker>
                ))}

              {/* Item 8: Dynamic Emergency Evacuation Flow Corridors on Google Maps */}
              {showEvacuationFlowAnimation &&
                evacuationFlowSegments.map((seg) => (
                  <React.Fragment key={`gmp-evac-flow-${seg.id}`}>
                    <Polyline
                      path={[seg.origin, seg.target]}
                      strokeColor="#10b981"
                      strokeOpacity={0.9}
                      strokeWeight={3.5}
                    />
                    <AdvancedMarker position={seg.target}>
                      <div className="px-2 py-0.5 rounded bg-emerald-950/95 border border-emerald-400 text-emerald-100 font-mono text-[11px] font-bold shadow-lg tabular-nums whitespace-nowrap">
                        ▲ FLUGT {seg.speedMs.toFixed(2)} m/s · Hældn. {seg.slopePct >= 0 ? '+' : ''}
                        {seg.slopePct.toFixed(1)}% · S={seg.localPlumeDensityS.toFixed(2)}
                      </div>
                    </AdvancedMarker>
                  </React.Fragment>
                ))}

              {/* 24-Hour Gaussian Puff Advection Trajectories on Google Maps */}
              {isPuffMode &&
                showHourlyPuffLobes &&
                puff24h.puffTrajectories.map((traj) => (
                  <Polyline
                    key={`gmp-traj-${traj.sourceId}-${traj.hourIndex}`}
                    path={[traj.origin, traj.puffCenterEnd]}
                    strokeColor="#fbbf24"
                    strokeOpacity={0.35}
                    strokeWeight={1.5}
                  />
                ))}

              {/* Animated 24-Hour Plume-Path Route ('Animér Fanevej-Rute') on Google Maps */}
              {isPuffMode && (
                <>
                  <Polyline
                    path={plumeRouteAnimationData.full24hTipLoop}
                    strokeColor="#22d3ee"
                    strokeOpacity={0.55}
                    strokeWeight={2}
                  />
                  <Polyline
                    path={plumeRouteAnimationData.activeTrailPoints}
                    strokeColor="#38bdf8"
                    strokeOpacity={0.95}
                    strokeWeight={3.5}
                  />
                  {plumeRouteAnimationData.receptorCorridors.map((corr) => (
                    <React.Fragment key={`gmp-corr-${corr.receptor.receptorId}`}>
                      <Polyline
                        path={corr.path}
                        strokeColor={corr.rank === 1 ? '#fbbf24' : '#22d3ee'}
                        strokeOpacity={0.9}
                        strokeWeight={corr.rank === 1 ? 3 : 2}
                      />
                      {isAnimatingPlumeRoute && (
                        <AdvancedMarker position={corr.tracerPos}>
                          <div className="w-3.5 h-3.5 rounded-full bg-cyan-300 border border-white shadow-sm" />
                        </AdvancedMarker>
                      )}
                    </React.Fragment>
                  ))}
                  {isAnimatingPlumeRoute && (
                    <AdvancedMarker position={plumeRouteAnimationData.frontPoint}>
                      <div className="px-2.5 py-1 rounded bg-cyan-400 text-slate-950 border border-white font-mono text-[11px] font-bold shadow-lg">
                        ➤ FANEVEJ-RUTE KL. {currentWeather.hourLabel} ({plumeRouteAnimationData.originSource.code} → #{1}{' '}
                        {plumeRouteAnimationData.topAffectedReceptors[0]?.receptorCode})
                      </div>
                    </AdvancedMarker>
                  )}
                  {isAnimatingPlumeRoute &&
                    plumeRouteAnimationData.intersectingHighDensityReceptors.map((item) => (
                      <AdvancedMarker
                        key={`gmp-hd-intersect-${item.receptor.id}`}
                        position={item.receptor.center}
                      >
                        <div className="px-2 py-0.5 rounded bg-rose-600 text-white border border-amber-300 font-mono text-[11px] font-extrabold shadow-lg animate-pulse">
                          ⚠ HØJTÆTHEDS-INTERSEKTION · {item.receptor.code} (~{item.residentCount}{' '}
                          beb.)
                        </div>
                      </AdvancedMarker>
                    ))}
                </>
              )}

              {/* 6-Hour Dust Drift Forecast 2D Animation Overlay on Google Maps (+0t to +6t) */}
              {show6hDustForecast && (
                <>
                  {/* Hourly Ghost Plume Envelopes (+1t .. +6t) */}
                  {sixHourDustForecastData.hourlySteps
                    .filter((st) => st.offsetHours > 0)
                    .map((st) => (
                      <Polygon
                        key={`gmp-fc6h-ghost-${st.offsetHours}`}
                        paths={st.outerPolygon}
                        strokeColor="#22d3ee"
                        strokeOpacity={0.42}
                        strokeWeight={1}
                        fillColor="#06b6d4"
                        fillOpacity={0.05}
                      />
                    ))}

                  {/* Live Morphing Interpolated Outer & Core Dust Plume at +t hours */}
                  <Polygon
                    paths={sixHourDustForecastData.interpolatedOuterPolygon}
                    strokeColor="#22d3ee"
                    strokeOpacity={0.95}
                    strokeWeight={2.4}
                    fillColor="#06b6d4"
                    fillOpacity={0.22}
                  />
                  <Polygon
                    paths={sixHourDustForecastData.interpolatedCorePolygon}
                    strokeColor="#fbbf24"
                    strokeOpacity={0.95}
                    strokeWeight={2.2}
                    fillColor="#f43f5e"
                    fillOpacity={0.32}
                  />

                  {/* Trajectory Line Connecting +0t .. +6t Plume Centroids */}
                  <Polyline
                    path={sixHourDustForecastData.centroidPathLine}
                    strokeColor="#fde047"
                    strokeOpacity={0.9}
                    strokeWeight={2.5}
                  />

                  {/* Animated Leading Dust Cloud Front Callout Marker */}
                  <AdvancedMarker position={sixHourDustForecastData.interpolatedCentroid}>
                    <div className="px-2.5 py-1 rounded bg-[var(--surface-overlay)] border border-sky-400 text-sky-100 font-mono text-[11px] font-bold shadow-lg">
                      +{sixHourDustForecastData.clampedT.toFixed(1)}t (kl.{' '}
                      {sixHourDustForecastData.activeStep.hourLabel}) ·{' '}
                      {sixHourDustForecastData.interpolatedWindSpeedMs} m/s →{' '}
                      {sixHourDustForecastData.interpolatedPlumeDeg}° (S=
                      {sixHourDustForecastData.interpolatedMaxS.toFixed(2)})
                    </div>
                  </AdvancedMarker>
                </>
              )}

              {/* Hydrological Soil Leaching & Groundwater Risk Warning Zones on Google Maps */}
              {showGroundwaterLeachingWarning &&
                groundwaterLeachingData.zones.map((lz) => {
                  const isCrit = lz.riskSeverity === 'critical';
                  return (
                    <React.Fragment key={`gmp-leach-${lz.sourceId}`}>
                      <Polygon
                        paths={lz.aquiferPlumePolygon}
                        strokeColor={isCrit ? '#f59e0b' : '#38bdf8'}
                        strokeOpacity={0.9}
                        strokeWeight={2}
                        fillColor={isCrit ? '#0284c7' : '#0369a1'}
                        fillOpacity={0.28}
                        onClick={() => onSelectSource(lz.sourceId)}
                      />
                      <Polygon
                        paths={lz.excavationCorePolygon}
                        strokeColor={isCrit ? '#ef4444' : '#f59e0b'}
                        strokeOpacity={0.95}
                        strokeWeight={2.5}
                        fillColor={isCrit ? '#dc2626' : '#d97706'}
                        fillOpacity={0.36}
                        onClick={() => onSelectSource(lz.sourceId)}
                      />
                      <Polyline
                        path={[lz.sourcePosition, lz.plumeFrontPoint]}
                        strokeColor="#fde047"
                        strokeOpacity={0.95}
                        strokeWeight={2.5}
                      />
                      <AdvancedMarker
                        position={lz.plumeFrontPoint}
                        onClick={() => onSelectSource(lz.sourceId)}
                      >
                        <div
                          className={`px-2 py-1 rounded border font-mono text-[11px] font-bold shadow-xl inline-flex items-center gap-1 ${
                            isCrit
                              ? 'bg-rose-950/95 text-amber-200 border-amber-400'
                              : 'bg-sky-950/95 text-cyan-200 border-cyan-400'
                          }`}
                        >
                          <Droplets className="w-3 h-3 shrink-0" />
                          <span>
                            UDVASKNING {lz.sourceCode}: Mætning {lz.zoneSaturationPct}% ·{' '}
                            {lz.effectiveAccumulatedPrecipMm} mm → Pb {lz.leadLeachateUgL} µg/L
                          </span>
                        </div>
                      </AdvancedMarker>
                    </React.Fragment>
                  );
                })}

              {/* Outgoing Snapshot Plume Polygons (Fading Out 1 -> 0 during Cross-Fade on Google Maps) */}
              {outgoingSnapshot &&
                crossFadeProgress < 1 &&
                outgoingSnapshot.activePolygons.map((zone) => {
                  const style = RISK_COLORS[zone.level];
                  const fadeOutWeight = Math.max(0, 1 - crossFadeProgress);
                  return (
                    <Polygon
                      key={`gmp-outgoing-plume-${zone.id}`}
                      paths={zone.polygon}
                      strokeColor={style.stroke}
                      strokeOpacity={
                        (outgoingSnapshot.showHeatmapComparison ? 0.35 : 0.85) * fadeOutWeight
                      }
                      strokeWeight={zone.level === 'red' ? 2 : 1.2}
                      fillColor={style.fill}
                      fillOpacity={
                        (outgoingSnapshot.showHeatmapComparison
                          ? style.fillOpacity * 0.35
                          : style.fillOpacity) * fadeOutWeight
                      }
                    />
                  );
                })}

              {/* Show Plume Concentration Heatmap (Google Maps Mode) */}
              {showPlumeConcentrationHeatmapLayer && (
                <>
                  <Polygon
                    paths={plumeConcentrationHeatmapData.safeZonePerimeter}
                    strokeColor="#10b981"
                    strokeOpacity={0.65}
                    strokeWeight={1.5}
                    fillColor="#10b981"
                    fillOpacity={0.1}
                  />
                  {plumeConcentrationHeatmapData.classifiedZones.map(({ zone, heatmapLevel }) => {
                    const fillHex =
                      heatmapLevel === 'red'
                        ? '#e11d48'
                        : heatmapLevel === 'orange'
                        ? '#f97316'
                        : heatmapLevel === 'blue'
                        ? '#6366f1'
                        : '#facc15';
                    const strokeHex =
                      heatmapLevel === 'red'
                        ? '#fda4af'
                        : heatmapLevel === 'orange'
                        ? '#fdba74'
                        : heatmapLevel === 'blue'
                        ? '#a5b4fc'
                        : '#fef08a';
                    const fillOp =
                      heatmapLevel === 'red'
                        ? 0.54
                        : heatmapLevel === 'orange'
                        ? 0.42
                        : heatmapLevel === 'blue'
                        ? 0.42
                        : 0.28;
                    return (
                      <Polygon
                        key={`gmp-conc-heat-${zone.id}`}
                        paths={zone.polygon}
                        strokeColor={strokeHex}
                        strokeOpacity={0.92}
                        strokeWeight={heatmapLevel === 'red' ? 2.4 : 1.6}
                        fillColor={fillHex}
                        fillOpacity={fillOp}
                      />
                    );
                  })}
                </>
              )}

              {/* Vejr-Korrelations Heatmap (6t vindstød vs. støvnedfald r > 0.8, Google Maps Mode) */}
              {showWeatherCorrelationHeatmapLayer &&
                weatherCorrelationHeatmapData.highlightedAreas.map((item) => (
                  <Polygon
                    key={`gmp-weather-corr-${item.receptor.id}`}
                    paths={item.receptor.polygon}
                    strokeColor="#f97316"
                    strokeOpacity={0.95}
                    strokeWeight={2.6}
                    fillColor="#ea580c"
                    fillOpacity={0.34}
                  />
                ))}

              {/* Plume / 24h Puff Risk Zone Polygons (Hidden in pure Differens-Heatmap mode so only the direct concentration difference is shown) */}
              {!isDifferenceHeatmapMode &&
                filteredActivePolygons.map((zone) => {
                  const style = RISK_COLORS[zone.level];
                  return (
                    <Polygon
                      key={`gmp-plume-${zone.id}`}
                      paths={zone.polygon}
                      strokeColor={style.stroke}
                      strokeOpacity={(showHeatmapComparison ? 0.35 : 0.85) * crossFadeProgress}
                      strokeWeight={zone.level === 'red' ? 2 : 1.2}
                      fillColor={style.fill}
                      fillOpacity={
                        (showHeatmapComparison ? style.fillOpacity * 0.35 : style.fillOpacity) *
                        crossFadeProgress
                      }
                    />
                  );
                })}

              {/* HEATMAP-SAMMENLIGNING & DIFFERENS-HEATMAP (T_A vs T_B) ON GOOGLE MAPS */}
              {showHeatmapComparison && heatmapComparison && (
                <>
                  {/* Spatial Grid Cells: either Direct Difference (T_B - T_A) or Dual-Overlay (only_A / only_B / overlap) */}
                  {heatmapComparison.heatmapGridCells.map((cell) => {
                    if (isDifferenceHeatmapMode) {
                      const diffStyle = getDifferenceCellVisualStyle(cell);
                      return (
                        <Polygon
                          key={`gmp-hm-diff-cell-${cell.id}`}
                          paths={cell.polygon}
                          strokeColor={diffStyle.strokeHex}
                          strokeOpacity={0.62}
                          strokeWeight={inspectedDiffCellId === cell.id ? 2 : 0.8}
                          fillColor={diffStyle.fillHex}
                          fillOpacity={diffStyle.gmpOpacity}
                          onClick={() => setInspectedDiffCellId(cell.id)}
                        />
                      );
                    }

                    const fillCol =
                      cell.zoneClass === 'only_B'
                        ? '#f43f5e'
                        : cell.zoneClass === 'only_A'
                        ? '#06b6d4'
                        : '#a855f7';
                    const strokeCol =
                      cell.zoneClass === 'only_B'
                        ? '#fb7185'
                        : cell.zoneClass === 'only_A'
                        ? '#22d3ee'
                        : '#e879f9';
                    return (
                      <Polygon
                        key={`gmp-hm-cell-${cell.id}`}
                        paths={cell.polygon}
                        strokeColor={strokeCol}
                        strokeOpacity={0.38}
                        strokeWeight={0.6}
                        fillColor={fillCol}
                        fillOpacity={Math.min(0.42, 0.14 + cell.intensityNormalized * 0.26)}
                      />
                    );
                  })}

                  {/* Only render both T_A & T_B plume footprint polygons when in 'dual_overlay' mode */}
                  {!isDifferenceHeatmapMode && (
                    <>
                      {/* Hour A (T_A) Plume Footprint Contours (Cool Cyan) */}
                      {heatmapComparison.polygonsA
                        .filter((z) => z.level === 'orange' || z.level === 'red')
                        .map((z) => (
                          <Polygon
                            key={`gmp-hm-polyA-${z.id}`}
                            paths={z.polygon}
                            strokeColor="#22d3ee"
                            strokeOpacity={0.92}
                            strokeWeight={z.level === 'red' ? 2.4 : 1.6}
                            fillColor="#06b6d4"
                            fillOpacity={z.level === 'red' ? 0.24 : 0.12}
                          />
                        ))}

                      {/* Hour B (T_B) Plume Footprint Contours (Warm Rose/Amber) */}
                      {heatmapComparison.polygonsB
                        .filter((z) => z.level === 'orange' || z.level === 'red')
                        .map((z) => (
                          <Polygon
                            key={`gmp-hm-polyB-${z.id}`}
                            paths={z.polygon}
                            strokeColor={z.level === 'red' ? '#f43f5e' : '#fb923c'}
                            strokeOpacity={0.96}
                            strokeWeight={z.level === 'red' ? 2.6 : 1.8}
                            fillColor={z.level === 'red' ? '#ef4444' : '#f97316'}
                            fillOpacity={z.level === 'red' ? 0.28 : 0.15}
                          />
                        ))}
                    </>
                  )}

                  {/* Peak +Delta and -Delta Markers on Google Maps when Differens-Heatmap is active */}
                  {isDifferenceHeatmapMode && heatmapComparison.peakPositiveCell && (
                    <AdvancedMarker position={heatmapComparison.peakPositiveCell.center}>
                      <div className="px-2 py-0.5 rounded bg-rose-950/95 border border-rose-400 text-rose-100 font-mono text-[11px] font-bold shadow-xl">
                        ▲ Maks. +Δ:{' '}
                        {differenceMetric === 'sum_quotient'
                          ? `+${heatmapComparison.peakPositiveCell.deltaS.toFixed(2)} S`
                          : `+${heatmapComparison.peakPositiveCell.deltaDustUgM3.toFixed(0)} µg/m³`}
                      </div>
                    </AdvancedMarker>
                  )}
                  {isDifferenceHeatmapMode &&
                    heatmapComparison.peakNegativeCell &&
                    heatmapComparison.peakNegativeCell.deltaS < -0.05 && (
                      <AdvancedMarker position={heatmapComparison.peakNegativeCell.center}>
                        <div className="px-2 py-0.5 rounded bg-sky-950/95 border border-sky-400 text-sky-100 font-mono text-[11px] font-bold shadow-xl">
                          ▼ Maks. −Δ:{' '}
                          {differenceMetric === 'sum_quotient'
                            ? `${heatmapComparison.peakNegativeCell.deltaS.toFixed(2)} S`
                            : `${heatmapComparison.peakNegativeCell.deltaDustUgM3.toFixed(0)} µg/m³`}
                        </div>
                      </AdvancedMarker>
                    )}

                  {/* Per-Source Centroid Shift Vectors & T_A -> T_B Badges on Google Maps */}
                  {heatmapComparison.sourceShifts.map((sh) => {
                    const midPt: LatLngPoint = {
                      lat: (sh.centroidA.lat + sh.centroidB.lat) / 2,
                      lng: (sh.centroidA.lng + sh.centroidB.lng) / 2,
                    };
                    return (
                      <React.Fragment key={`gmp-hm-shift-${sh.sourceId}`}>
                        <Polyline
                          path={[sh.centroidA, sh.centroidB]}
                          strokeColor="#fde047"
                          strokeOpacity={0.95}
                          strokeWeight={3}
                        />
                        <AdvancedMarker position={sh.centroidA}>
                          <div className="px-2 py-0.5 rounded bg-cyan-950/95 border border-cyan-300 text-cyan-200 font-mono text-[11px] font-bold shadow-lg">
                            T_A kl. {heatmapComparison.hourA.hourLabel} ({sh.plumeDirectionADeg}°)
                          </div>
                        </AdvancedMarker>
                        <AdvancedMarker position={sh.centroidB}>
                          <div className="px-2 py-0.5 rounded bg-rose-950/95 border border-rose-400 text-rose-200 font-mono text-[11px] font-bold shadow-lg">
                            T_B kl. {heatmapComparison.hourB.hourLabel} ({sh.plumeDirectionBDeg}°)
                          </div>
                        </AdvancedMarker>
                        {sh.centroidShiftMeters > 5 && (
                          <AdvancedMarker position={midPt}>
                            <div className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 border border-white font-mono text-[11px] font-bold shadow-xl">
                              ➤ {sh.sourceCode}: Flyttet {sh.centroidShiftMeters}m mod {sh.shiftCompass} (
                              {sh.rotationSignedDeg >= 0 ? `+${sh.rotationSignedDeg}°` : `${sh.rotationSignedDeg}°`})
                            </div>
                          </AdvancedMarker>
                        )}
                      </React.Fragment>
                    );
                  })}
                </>
              )}

              {/* Pre-1997 Asbestos & Mineral Wool Fiber Deposition Risk Layer on Google Maps */}
              {showAsbestosRiskLayer &&
                (visibleDispersionSubstances.asbestos || visibleDispersionSubstances.quartzWool) &&
                asbestosDepositionZones.map((az) => (
                  <React.Fragment key={`gmp-asb-${az.sourceId}`}>
                    {visibleDispersionSubstances.quartzWool && (
                      <Polygon
                        paths={az.haloPolygon}
                        strokeColor="#34d399"
                        strokeOpacity={0.75}
                        strokeWeight={1.2}
                        fillColor="#10b981"
                        fillOpacity={0.14}
                        onClick={() => onSelectSource(az.sourceId)}
                      />
                    )}
                    {visibleDispersionSubstances.asbestos && (
                      <>
                        <Polygon
                          paths={az.corePolygon}
                          strokeColor="#10b981"
                          strokeOpacity={0.95}
                          strokeWeight={2.2}
                          fillColor="#059669"
                          fillOpacity={0.28}
                          onClick={() => onSelectSource(az.sourceId)}
                        />
                        <Polyline
                          path={[az.sourcePosition, az.depositionCentroid]}
                          strokeColor="#6ee7b7"
                          strokeOpacity={0.9}
                          strokeWeight={2}
                        />
                        <AdvancedMarker
                          position={az.depositionCentroid}
                          onClick={() => onSelectSource(az.sourceId)}
                        >
                          <div className="px-2 py-1 rounded bg-emerald-950/95 border border-emerald-400 text-emerald-200 font-mono text-[11px] shadow-xl cursor-pointer">
                            <div className="font-bold text-emerald-300 inline-flex items-center gap-1">
                              <Biohazard className="w-3 h-3 shrink-0" />
                              <span>
                                {az.sourceCode} (&lt;1997): {az.probabilityPct}% Fiber-Risiko
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-200">
                              {az.buildingParts[0]} → {az.estimatedDepositionFibreM2.toLocaleString('da-DK')} fibre/m²
                            </div>
                          </div>
                        </AdvancedMarker>
                      </>
                    )}
                  </React.Fragment>
                ))}

              {/* 24-Hour Accumulated Dust & Asbestos Particle Heatmap Overlay on Google Maps */}
              {show24hParticleAccumulationHeatmap && (
                <>
                  {puff24h.mergedEnvelopePolygons.map((poly) => (
                    <Polygon
                      key={`gmp-24h-acc-env-${poly.id}`}
                      paths={poly.polygon}
                      strokeColor="#f43f5e"
                      strokeOpacity={0.9}
                      strokeWeight={2}
                      fillColor={poly.level === 'red' ? '#e11d48' : '#f97316'}
                      fillOpacity={poly.level === 'red' ? 0.35 : 0.24}
                    />
                  ))}
                  {puff24h.receptorSummaries.map((rs) => (
                    <AdvancedMarker
                      key={`gmp-24h-acc-rec-${rs.receptorId}`}
                      position={rs.position}
                    >
                      <div className="px-2 py-1 rounded bg-rose-950/95 border border-rose-400 text-rose-100 font-mono text-[11px] shadow-xl">
                        <div className="font-bold text-rose-300 inline-flex items-center gap-1">
                          <Flame className="w-3 h-3 shrink-0" />
                          <span>{rs.receptorCode} (24t Puff-Akkumulering)</span>
                        </div>
                        <div>
                          Støv: {rs.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)} µg/m² · Asbest:{' '}
                          {Math.round(rs.totalDepositedAsbestosFibersM2).toLocaleString('da-DK')} f/m²
                        </div>
                      </div>
                    </AdvancedMarker>
                  ))}
                </>
              )}

              {/* Registered Neighbor Complaints Heat-Mapped Block Density Layer on Google Maps */}
              {showComplaintDensityOverlay && (
                <>
                  {complaintDensitySummary.items
                    .filter((item) => item.normalizedDensity >= 0.08)
                    .map((item) => {
                      const scaleAlpha = complaintDensityOpacityPct / 100;
                      const fillOpacity = Math.min(
                        0.68,
                        (0.14 + item.normalizedDensity * 0.44) * scaleAlpha
                      );
                      const strokeOpacity = Math.min(
                        0.96,
                        (0.45 + item.normalizedDensity * 0.5) * scaleAlpha
                      );
                      return (
                        <Polygon
                          key={`gmp-complaint-density-${item.id}`}
                          paths={item.polygon}
                          strokeColor={item.heatStrokeHex}
                          strokeOpacity={strokeOpacity}
                          strokeWeight={item.normalizedDensity >= 0.5 ? 2.4 : 1.5}
                          fillColor={item.heatFillHex}
                          fillOpacity={fillOpacity}
                          onClick={() => handleFocusComplaintDensityItem(item)}
                        />
                      );
                    })}
                  {complaintDensitySummary.topDisputedItems
                    .filter((item) => item.normalizedDensity >= 0.35)
                    .slice(0, 4)
                    .map((item, rankIdx) => (
                      <AdvancedMarker
                        key={`gmp-complaint-hotspot-${item.id}`}
                        position={item.center}
                        onClick={() => handleFocusComplaintDensityItem(item)}
                      >
                        <div className="px-2 py-0.5 rounded bg-slate-950/95 border border-rose-400/90 text-rose-100 font-mono tabular-nums text-[11px] font-bold shadow-xl cursor-pointer whitespace-nowrap">
                          <span className="text-rose-300">#{rankIdx + 1}</span> {item.code} ·{' '}
                          {Math.round(item.normalizedDensity * 100)}% tæthed (
                          {item.directComplaintCount} kl.)
                        </div>
                      </AdvancedMarker>
                    ))}
                </>
              )}

              {/* 'dust_deposition' Heatmap Layer on Google Maps */}
              {activeHeatmapLayerMode === 'dust_deposition' && (
                <>
                  {dustDepositionHeatmapData.sourceLobes.map((lobe) => (
                    <React.Fragment key={`gmp-dust-lobe-${lobe.sourceId}`}>
                      <Polygon
                        paths={lobe.outerPolygon}
                        strokeColor="#fde047"
                        strokeOpacity={0.8}
                        strokeWeight={1.4}
                        fillColor="#eab308"
                        fillOpacity={0.16}
                      />
                      <Polygon
                        paths={lobe.midPolygon}
                        strokeColor="#fb923c"
                        strokeOpacity={0.9}
                        strokeWeight={1.8}
                        fillColor="#f97316"
                        fillOpacity={0.25}
                      />
                      <Polygon
                        paths={lobe.corePolygon}
                        strokeColor="#f43f5e"
                        strokeOpacity={0.95}
                        strokeWeight={2.2}
                        fillColor="#e11d48"
                        fillOpacity={0.34}
                      />
                    </React.Fragment>
                  ))}
                  {dustDepositionHeatmapData.receptorNodes.map((rNode) => (
                    <AdvancedMarker key={`gmp-dust-rec-${rNode.receptorId}`} position={rNode.position}>
                      <div className="px-2 py-0.5 rounded bg-amber-950/95 border border-amber-400 text-amber-200 font-mono text-[11px] font-bold shadow-xl inline-flex items-center gap-1">
                        <CloudFog className="w-3 h-3 shrink-0" />
                        <span>
                          {rNode.receptorCode}: {rNode.total24hUgM2.toFixed(1)} µg/m² (24t)
                        </span>
                      </div>
                    </AdvancedMarker>
                  ))}
                </>
              )}

              {/* 'noise_contour' Heatmap Layer on Google Maps */}
              {activeHeatmapLayerMode === 'noise_contour' && (
                <>
                  {noiseContourHeatmapData.sourceContours.map((sc) => (
                    <React.Fragment key={`gmp-noise-contour-${sc.sourceId}`}>
                      <Polygon
                        paths={sc.ring45dB}
                        strokeColor="#38bdf8"
                        strokeOpacity={0.75}
                        strokeWeight={1.2}
                        fillColor="#0284c7"
                        fillOpacity={0.08}
                      />
                      <Polygon
                        paths={sc.ring55dB}
                        strokeColor="#fde047"
                        strokeOpacity={0.9}
                        strokeWeight={1.8}
                        fillColor="#eab308"
                        fillOpacity={0.14}
                      />
                      <Polygon
                        paths={sc.ring60dB}
                        strokeColor="#fb923c"
                        strokeOpacity={0.92}
                        strokeWeight={2.0}
                        fillColor="#f97316"
                        fillOpacity={0.2}
                      />
                      <Polygon
                        paths={sc.ring70dB}
                        strokeColor="#f43f5e"
                        strokeOpacity={0.96}
                        strokeWeight={2.4}
                        fillColor="#ec4899"
                        fillOpacity={0.28}
                      />
                    </React.Fragment>
                  ))}
                  {noiseContourHeatmapData.receptorNoiseNodes.map((nNode) => (
                    <AdvancedMarker key={`gmp-noise-rec-${nNode.receptorId}`} position={nNode.position}>
                      <div className="px-2 py-0.5 rounded bg-fuchsia-950/95 border border-fuchsia-400 text-fuchsia-200 font-mono text-[11px] font-bold shadow-xl inline-flex items-center gap-1">
                        <Volume2 className="w-3 h-3 shrink-0" />
                        <span>
                          {nNode.receptorCode}: {nNode.correctedLaeqDb.toFixed(1)} dB(A) (ΔL {nNode.totalRefrDb >= 0 ? '+' : ''}{nNode.totalRefrDb.toFixed(1)} dB)
                        </span>
                      </div>
                    </AdvancedMarker>
                  ))}
                </>
              )}

              {/* All 29 Georeferenced Building Polygons (Color-Coded by Category a-e) */}
              {visibleBuildings.map((b) => {
                const meta = BUILDING_CATEGORY_METADATA[b.category];
                return (
                  <Polygon
                    key={`gmp-bldg-poly-${b.id}`}
                    paths={b.footprint}
                    strokeColor={selectedPopupBuildingId === b.id ? '#ffffff' : meta.colorHex}
                    strokeOpacity={1}
                    strokeWeight={selectedPopupBuildingId === b.id ? 3 : 2}
                    fillColor={meta.colorHex}
                    fillOpacity={b.category === 'e_demolished_unsecured' ? 0.35 : 0.52}
                    onClick={() => {
                      setSelectedPopupBuildingId(b.id);
                      setActiveInfoId(`bldg:${b.id}`);
                      if (meta.actsAsSource) onSelectSource(getSourceIdForBuilding(b.id));
                      if (meta.actsAsReceptor) onSelectReceptor(getReceptorIdForBuilding(b.id));
                    }}
                  />
                );
              })}

              {/* Source Building Footprints */}
              {visibleSources.map((src) => (
                <Polygon
                  key={`gmp-src-poly-${src.id}`}
                  paths={src.footprint}
                  strokeColor="#fbbf24"
                  strokeOpacity={1}
                  strokeWeight={2}
                  fillColor="#dc2626"
                  fillOpacity={src.active ? 0.55 : 0.2}
                  onClick={() => {
                    onSelectSource(src.id);
                    if (src.buildingUnitId) setSelectedPopupBuildingId(src.buildingUnitId);
                  }}
                />
              ))}

              {/* Source Advanced Markers */}
              {visibleSources.map((src) => (
                <AdvancedMarker
                  key={`gmp-src-marker-${src.id}`}
                  position={src.position}
                  onClick={() => {
                    onSelectSource(src.id);
                    setActiveInfoId(src.id);
                    if (src.buildingUnitId) setSelectedPopupBuildingId(src.buildingUnitId);
                  }}
                >
                  <div
                    className={`px-2 py-1 rounded border text-[11px] font-mono font-bold shadow-md cursor-pointer transition-transform ${
                      selectedSourceId === src.id
                        ? 'bg-rose-600 text-white border-white scale-110'
                        : 'bg-slate-950/95 text-rose-400 border-rose-500/80 hover:scale-105'
                    }`}
                  >
                    {src.code}: {src.name.split(':')[0]}
                  </div>
                </AdvancedMarker>
              ))}

              {/* Receptor Advanced Markers (Automatically highlighted when windSpeed10m > 10 m/s) */}
              {receptors.map((rec) => {
                const exp = exposureByReceptorId[rec.id];
                const hwRank = highWindRankByReceptorId[rec.id];
                const meshNode = autonomousMesh.nodesByReceptorId[rec.id];
                return (
                  <AdvancedMarker
                    key={`gmp-rec-marker-${rec.id}`}
                    position={rec.center}
                    onClick={() => {
                      onSelectReceptor(rec.id);
                      setActiveInfoId(rec.id);
                      if (rec.buildingUnitId) setSelectedPopupBuildingId(rec.buildingUnitId);
                    }}
                  >
                    <div
                      className={`px-2 py-1 rounded border text-[11px] font-mono tabular-nums shadow-md cursor-pointer transition-all ${
                        hwRank
                          ? 'bg-rose-600 text-white border border-amber-300 font-extrabold ring-2 ring-rose-500/60 scale-105'
                          : exp?.riskLevel === 'red'
                          ? 'bg-rose-950/95 text-rose-200 border-rose-500 font-semibold'
                          : exp?.riskLevel === 'orange'
                          ? 'bg-amber-950/95 text-amber-200 border-amber-500 font-semibold'
                          : 'bg-slate-900/90 text-cyan-200 border-cyan-500/60'
                      }`}
                    >
                      <div>
                        {hwRank ? `#${hwRank} VIND >10m/s · ` : ''}
                        {rec.code} · S={exp?.sumQuotient.toFixed(2) ?? '0.00'}
                      </div>
                      {showAutonomousMesh && meshNode && (
                        <div className="text-[11px] text-cyan-200/95 font-normal">
                          ZKP · Nabo {meshNode.nabotest.corroboratingNeighborCount}/
                          {meshNode.nabotest.analyzedNearbyNodesCount}
                        </div>
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}

              {/* Dedicated 24-Hour Peak Exposed Receptor Point Marker on Google Maps */}
              {isPuffMode && peakReceptor && (
                <AdvancedMarker
                  position={peakReceptor.position}
                  onClick={() => {
                    if (onSelectHourFromPeak) {
                      onSelectHourFromPeak(peakReceptor.peakHourIndex);
                    }
                  }}
                >
                  <div className="bg-amber-400 text-slate-950 border border-white px-3 py-1.5 rounded-md shadow-lg font-mono text-xs cursor-pointer ring-2 ring-amber-400/50">
                    <div className="font-bold">
                      HØJESTE 24T DOSIS: {peakReceptor.receptorName}
                    </div>
                    <div className="text-[11px] font-semibold">
                      Spidsbelastning kl. {peakReceptor.peakHourLabel} (S=
                      {peakReceptor.peakSumQuotient.toFixed(2)}) · ∑=
                      {peakReceptor.cumulativeSumDose.toFixed(1)} S·t
                    </div>
                  </div>
                </AdvancedMarker>
              )}

              {/* Pending Observation GPS Target Crosshair on Google Maps */}
              {pendingObservationPoint && (
                <AdvancedMarker position={pendingObservationPoint}>
                  <div className="px-2.5 py-1 rounded bg-fuchsia-500 text-slate-950 border border-white font-mono text-[11px] font-bold shadow-lg">
                    ⊕ VALGT OBSERVATIONSPUNKT ({pendingObservationPoint.lat.toFixed(4)},{' '}
                    {pendingObservationPoint.lng.toFixed(4)})
                  </div>
                </AdvancedMarker>
              )}

              {/* Registered Physical Observations / Algedonic Signals on Google Maps */}
              {observations.map((obs) => {
                const isSelected = selectedObservationId === obs.id;
                const inPlume = obs.plumeCorroboration.isInsideMathematicalPlume;
                return (
                  <AdvancedMarker
                    key={`gmp-obs-${obs.id}`}
                    position={obs.position}
                    onClick={() => onSelectObservation(obs)}
                  >
                    <div
                      className={`px-2.5 py-1 rounded border font-mono text-[11px] shadow-xl cursor-pointer transition-transform inline-flex items-center gap-1 ${
                        isSelected
                          ? 'bg-fuchsia-500 text-slate-950 border-white scale-110 font-bold'
                          : inPlume
                          ? 'bg-fuchsia-950/95 text-fuchsia-200 border-fuchsia-400 font-semibold'
                          : 'bg-slate-900/95 text-slate-200 border-slate-500'
                      }`}
                    >
                      <Zap className="w-3 h-3 shrink-0" />
                      <span>
                        {obs.code} (kl. {obs.observedHourLabel}) ·{' '}
                        {inPlume
                          ? `I FANE (S=${obs.plumeCorroboration.calculatedSumQuotient.toFixed(2)})`
                          : 'RANDZONE'}
                      </span>
                    </div>
                  </AdvancedMarker>
                );
              })}

              {activeInfoId && (() => {
                const matchedSrc = sources.find((s) => s.id === activeInfoId);
                const matchedRec = receptors.find((r) => r.id === activeInfoId);
                const bldgId = activeInfoId.startsWith('bldg:')
                  ? activeInfoId.slice(5)
                  : matchedSrc?.buildingUnitId || matchedRec?.buildingUnitId;
                const matchedBldg = bldgId ? buildings.find((b) => b.id === bldgId) : undefined;
                const pos =
                  matchedBldg?.center ||
                  matchedSrc?.position ||
                  matchedRec?.center ||
                  RINGPARKEN_CENTER;

                return (
                  <InfoWindow position={pos} onCloseClick={() => setActiveInfoId(null)}>
                    <div className="text-slate-900 text-xs max-w-xs space-y-1.5 p-1 font-mono">
                      <div className="font-bold">
                        {matchedBldg?.name || matchedSrc?.name || matchedRec?.name}
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        {matchedBldg?.address || matchedSrc?.address || matchedRec?.address}
                      </div>
                      {matchedBldg && onChangeBuildingCategory && (
                        <div className="pt-1 border-t border-slate-200 space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            Operationel Bygningskategori (a–e):
                          </label>
                          <select
                            value={matchedBldg.category}
                            onChange={(e) =>
                              onChangeBuildingCategory(
                                matchedBldg.id,
                                e.target.value as BuildingOperationalCategory
                              )
                            }
                            className="w-full bg-slate-100 border border-slate-300 rounded px-2 py-1 text-[11px] font-bold text-slate-900"
                          >
                            {(
                              Object.values(BUILDING_CATEGORY_METADATA) as Array<
                                (typeof BUILDING_CATEGORY_METADATA)[BuildingOperationalCategory]
                              >
                            ).map((cMeta) => (
                              <option key={cMeta.code} value={cMeta.code}>
                                {cMeta.labelDa} (Faktor {cMeta.sourceEmissionFactor.toFixed(2)}x)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </InfoWindow>
                );
              })()}
            </GoogleMap>
          </APIProvider>
        ) : (
          /* High-Precision Calibrated Satellite/Hybrid Tactical GIS Canvas for Ringparken 4200 Slagelse */
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className={`w-full h-full ${
              mapClickMode !== 'none'
                ? 'cursor-crosshair'
                : isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
            }`}
            onMouseDown={handleSvgMouseDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseLeave={handleSvgMouseUp}
            onClick={handleSvgClick}
          >
            <defs>
              <radialGradient id="slagelse-sat-bg" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#14221d" />
                <stop offset="55%" stopColor="#0e1816" />
                <stop offset="100%" stopColor="#080c12" />
              </radialGradient>

              <pattern
                id="gis-coord-grid"
                width={80 * scaleFactor}
                height={80 * scaleFactor}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${80 * scaleFactor} 0 L 0 0 0 ${80 * scaleFactor}`}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.09)"
                  strokeWidth="1"
                />
              </pattern>

              {/* Diagonal Bio-Fiber Hatch Pattern for <1997 Asbestos Deposition Risk Layer */}
              <pattern
                id="asbestos-fiber-hatch"
                width="10"
                height="10"
                patternTransform="rotate(35 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="10" height="10" fill="rgba(16, 185, 129, 0.14)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="10"
                  stroke="rgba(52, 211, 153, 0.65)"
                  strokeWidth="1.6"
                />
                <line
                  x1="5"
                  y1="0"
                  x2="5"
                  y2="10"
                  stroke="rgba(251, 191, 36, 0.35)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              </pattern>

              {/* Thermal Gradients for Heatmap-Sammenligning (T_A vs T_B) */}
              <radialGradient id="heatmap-ta-cyan-grad" cx="35%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.46" />
                <stop offset="65%" stopColor="#06b6d4" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.06" />
              </radialGradient>
              <radialGradient id="heatmap-tb-warm-grad" cx="35%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.56" />
                <stop offset="60%" stopColor="#f97316" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#eab308" stopOpacity="0.08" />
              </radialGradient>
              <pattern
                id="heatmap-overlap-pattern"
                width="8"
                height="8"
                patternTransform="rotate(-45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="8" height="8" fill="rgba(168, 85, 247, 0.26)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  stroke="rgba(244, 114, 182, 0.65)"
                  strokeWidth="1.5"
                />
              </pattern>

              <radialGradient id="plume-red-grad" cx="30%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.58" />
                <stop offset="70%" stopColor="#dc2626" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.1" />
              </radialGradient>
              <radialGradient id="plume-orange-grad" cx="30%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.42" />
                <stop offset="75%" stopColor="#ea580c" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#c2410c" stopOpacity="0.06" />
              </radialGradient>
              <radialGradient id="plume-yellow-grad" cx="30%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#eab308" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#ca8a04" stopOpacity="0.05" />
              </radialGradient>
              <linearGradient id="plume-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.52" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.18" />
              </linearGradient>

              {/* Hydrological Soil Leaching & Groundwater Contamination Hatch Pattern */}
              <pattern
                id="groundwater-leaching-hatch"
                width="10"
                height="10"
                patternTransform="rotate(35 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="10" height="10" fill="rgba(2, 132, 199, 0.22)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="10"
                  stroke="rgba(251, 191, 36, 0.72)"
                  strokeWidth="1.6"
                />
                <line
                  x1="5"
                  y1="0"
                  x2="5"
                  y2="10"
                  stroke="rgba(56, 189, 248, 0.55)"
                  strokeWidth="1.1"
                  strokeDasharray="2 2"
                />
              </pattern>

              {/* Plume Concentration Heatmap Gradients & Safe-Zone Grid */}
              <pattern
                id="safe-zone-emerald-grid"
                width="18"
                height="18"
                patternUnits="userSpaceOnUse"
              >
                <rect width="18" height="18" fill="rgba(16, 185, 129, 0.08)" />
                <path
                  d="M 18 0 L 0 0 0 18"
                  fill="none"
                  stroke="rgba(52, 211, 153, 0.18)"
                  strokeWidth="0.7"
                />
                <circle cx="9" cy="9" r="0.9" fill="rgba(52, 211, 153, 0.28)" />
              </pattern>
              <radialGradient id="plume-heatmap-critical-grad" cx="35%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#fb7185" stopOpacity="0.82" />
                <stop offset="45%" stopColor="#e11d48" stopOpacity="0.64" />
                <stop offset="100%" stopColor="#9f1239" stopOpacity="0.28" />
              </radialGradient>
              <radialGradient id="plume-heatmap-elevated-grad" cx="35%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#fb923c" stopOpacity="0.68" />
                <stop offset="60%" stopColor="#ea580c" stopOpacity="0.46" />
                <stop offset="100%" stopColor="#c2410c" stopOpacity="0.18" />
              </radialGradient>
              <radialGradient id="plume-heatmap-observation-grad" cx="35%" cy="50%" r="75%">
                <stop offset="0%" stopColor="#facc15" stopOpacity="0.46" />
                <stop offset="70%" stopColor="#eab308" stopOpacity="0.26" />
                <stop offset="100%" stopColor="#ca8a04" stopOpacity="0.1" />
              </radialGradient>
              <linearGradient id="plume-heatmap-runoff-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.64" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.24" />
              </linearGradient>
              {/* Vejr-Korrelations Heatmap Gradient (r > 0.8 over 6 hours) */}
              <radialGradient id="weather-corr-high-grad" cx="50%" cy="50%" r="68%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.58" />
                <stop offset="55%" stopColor="#fb923c" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#ea580c" stopOpacity="0.1" />
              </radialGradient>
              <marker
                id="water-main-flow-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#e0f2fe" />
              </marker>
            </defs>

            {/* Base Satellite / Hybrid Ortho Canvas */}
            <rect width={VIEW_W} height={VIEW_H} fill="url(#slagelse-sat-bg)" />
            <rect width={VIEW_W} height={VIEW_H} fill="url(#gis-coord-grid)" />

            {/* Urban Green Blocks / Courtyards in Ringparken */}
            <polygon
              points={polygonToSvgPoints([
                { lat: 55.4143, lng: 11.3511 },
                { lat: 55.4143, lng: 11.3551 },
                { lat: 55.4114, lng: 11.3551 },
                { lat: 55.4114, lng: 11.3511 },
              ])}
              fill="rgba(22, 46, 35, 0.45)"
              stroke="rgba(52, 211, 153, 0.12)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Street Network of Ringparken (Hybrid Road Layer - Memoized) */}
            {memoizedSvgBaseGeometry.streets.map((st) => (
              <g key={st.name}>
                <path
                  d={st.d}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth={st.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={st.d}
                  fill="none"
                  stroke="#475569"
                  strokeWidth={1.2}
                  strokeDasharray="6 6"
                />
                <text
                  x={st.midX}
                  y={st.midY - 8}
                  textAnchor="middle"
                  className="fill-slate-400 text-[11px] font-mono pointer-events-none"
                >
                  {st.name}
                </text>
              </g>
            ))}

            {/* Kierulffsvej DN200 Drinking Water Main GIS Layer (Scene-Calibrated + LER 2.0 Buffer + Valves/Branches + Virtual Leak Zones) */}
            {showWaterMainLayer && waterMainTelemetry && (() => {
              const wm = waterMainTelemetry;
              const isRupture = wm.overallStatus === 'critical_rupture';
              const isWarn = wm.overallStatus === 'warning' || wm.overallStatus === 'advisory';
              const mainPipeHex = isRupture ? '#ef4444' : isWarn ? '#f59e0b' : '#0ea5e9';
              const labelPos = projectLatLng(wm.inspectionCenter);
              const svgPxPerMeter = PX_PER_DEG_LAT / 111320;

              return (
                <g
                  data-testid="svg-kierulffsvej-water-main-layer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLeakPinDropMode && svgRef.current) {
                      const rect = svgRef.current.getBoundingClientRect();
                      const relX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
                      const relY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
                      handlePlaceVirtualLeakPinAtPoint(unprojectPx(relX, relY));
                      return;
                    }
                    setShowWaterMainInspector((prev) => !prev);
                  }}
                  className={isLeakPinDropMode ? 'cursor-crosshair' : 'cursor-pointer'}
                >
                  {/* Virtual Leak Pin Soil Saturation Zones & Building Percolation Flow on Tactical SVG */}
                  {effectiveVirtualLeakImpact && (() => {
                    const pinPx = projectLatLng(effectiveVirtualLeakImpact.pinPoint);
                    return (
                      <g data-testid="svg-virtual-leak-saturation-layer">
                        {[...effectiveVirtualLeakImpact.saturationZones]
                          .reverse()
                          .map((zone) => (
                            <circle
                              key={`svg-leak-zone-${zone.tier}`}
                              cx={pinPx.x}
                              cy={pinPx.y}
                              r={Math.max(8, zone.radiusMeters * svgPxPerMeter)}
                              fill={zone.colorHex}
                              fillOpacity={
                                zone.tier === 'core_saturated'
                                  ? 0.32
                                  : zone.tier === 'capillary_front'
                                  ? 0.2
                                  : 0.12
                              }
                              stroke={zone.colorHex}
                              strokeWidth={zone.tier === 'core_saturated' ? 2.1 : 1.3}
                              strokeDasharray={
                                zone.tier === 'clay_wetting_fringe' ? '5 3' : undefined
                              }
                            />
                          ))}
                        {effectiveVirtualLeakImpact.impactedBuildings.map((bld) => {
                          const bPx = projectLatLng(bld.center);
                          const strokeCol =
                            bld.severity === 'critical'
                              ? '#f43f5e'
                              : bld.severity === 'high'
                              ? '#f59e0b'
                              : '#38bdf8';
                          return (
                            <g key={`svg-leak-bld-${bld.buildingId}`}>
                              <line
                                x1={pinPx.x}
                                y1={pinPx.y}
                                x2={bPx.x}
                                y2={bPx.y}
                                stroke={strokeCol}
                                strokeWidth={2.0}
                                strokeDasharray="5 3"
                              />
                              <circle
                                cx={bPx.x}
                                cy={bPx.y}
                                r={6}
                                fill={strokeCol}
                                fillOpacity={0.35}
                                stroke={strokeCol}
                                strokeWidth={1.6}
                              />
                              <g transform={`translate(${bPx.x}, ${bPx.y - 14})`}>
                                <rect
                                  x={-54}
                                  y={-8}
                                  width={108}
                                  height={15}
                                  rx={3}
                                  fill="#090d16"
                                  fillOpacity={0.94}
                                  stroke={strokeCol}
                                  strokeWidth={1.1}
                                />
                                <text
                                  x={0}
                                  y={2.5}
                                  textAnchor="middle"
                                  className="fill-slate-100 text-[10px] font-mono font-bold tabular-nums"
                                >
                                  {bld.buildingCode}: {bld.arrivalMinutes.toFixed(0)}m ·{' '}
                                  {bld.intrusionRateLh.toFixed(0)}L/t
                                </text>
                              </g>
                            </g>
                          );
                        })}
                        <g transform={`translate(${pinPx.x}, ${pinPx.y})`}>
                          <circle
                            cx={0}
                            cy={0}
                            r={9}
                            fill="#e11d48"
                            stroke="#fef08a"
                            strokeWidth={2}
                          />
                          <circle cx={0} cy={0} r={3} fill="#ffffff" />
                          <g transform="translate(0, -18)">
                            <rect
                              x={-78}
                              y={-9}
                              width={156}
                              height={16}
                              rx={3}
                              fill="#881337"
                              fillOpacity={0.96}
                              stroke="#fde047"
                              strokeWidth={1.3}
                            />
                            <text
                              x={0}
                              y={2.5}
                              textAnchor="middle"
                              className="fill-white text-[10px] font-mono font-extrabold tabular-nums"
                            >
                              LÆKAGEPUNKT · {effectiveVirtualLeakImpact.dischargeLs.toFixed(1)} L/s
                            </text>
                          </g>
                        </g>
                      </g>
                    );
                  })()}

                  {/* LER 2.0 ±2.0 m Uncertainty Buffer */}
                  {showLerBuffer && wm.lerBufferPolygon.length >= 3 && (
                    <polygon
                      points={polygonToSvgPoints(wm.lerBufferPolygon)}
                      fill={isRupture ? 'rgba(239, 68, 68, 0.16)' : 'rgba(14, 165, 233, 0.16)'}
                      stroke={isRupture ? '#f87171' : '#38bdf8'}
                      strokeWidth={1.3}
                      strokeDasharray="6 4"
                    />
                  )}

                  {/* 4 Service Branches (Stikledninger) with DS 439 / DS/EN 1717 status */}
                  {wm.serviceBranches.map((br) => {
                    const p1 = projectLatLng(br.startOnMain);
                    const p2 = projectLatLng(br.buildingConnection);
                    const uncapped = br.cappingStatus === 'uncapped_risk';
                    return (
                      <g key={`svg-wm-br-${br.id}`}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke={uncapped ? '#ef4444' : '#38bdf8'}
                          strokeWidth={2.4}
                          strokeDasharray={uncapped ? '3 2' : '5 3'}
                        />
                        <circle
                          cx={p2.x}
                          cy={p2.y}
                          r={3.5}
                          fill={uncapped ? '#ef4444' : '#10b981'}
                          stroke="#0f172a"
                          strokeWidth={1.2}
                        />
                      </g>
                    );
                  })}

                  {/* Main DN200 Pipeline Segments */}
                  {wm.sceneSegments.map((seg) => {
                    const pts = seg.waypoints.map((w) => projectLatLng(w));
                    if (pts.length < 2) return null;
                    const pathD = pts
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                      .join(' ');
                    const segStroke =
                      seg.material === 'PE100_SDR17_IKKE_DIFFUSIONSTAET' &&
                      wm.overallStatus === 'nominal'
                        ? '#06b6d4'
                        : mainPipeHex;
                    return (
                      <g
                        key={`svg-wm-seg-${seg.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLeakPinDropMode && svgRef.current) {
                            const rect = svgRef.current.getBoundingClientRect();
                            const relX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
                            const relY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
                            handlePlaceVirtualLeakPinAtPoint(unprojectPx(relX, relY));
                            return;
                          }
                          setSelectedWaterMainSectionId(seg.id);
                        }}
                      >
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#090d16"
                          strokeWidth={7.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke={segStroke}
                          strokeWidth={4.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={isRupture ? 'animate-pulse' : undefined}
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#e0f2fe"
                          strokeWidth={1.3}
                          strokeDasharray="8 14"
                          markerMid="url(#water-main-flow-arrow)"
                        />
                      </g>
                    );
                  })}

                  {/* 3 Section Isolation Valves (V-VEST, V-MIDT, V-ØST) */}
                  {wm.valves.map((v) => {
                    const vp = projectLatLng(v.coordinate);
                    return (
                      <g key={`svg-wm-valve-${v.id}`} transform={`translate(${vp.x}, ${vp.y})`}>
                        <rect
                          x={-5.5}
                          y={-5.5}
                          width={11}
                          height={11}
                          rx={2}
                          fill={v.status === 'closed' ? '#dc2626' : '#0284c7'}
                          stroke="#ffffff"
                          strokeWidth={1.4}
                        />
                        <text
                          x={0}
                          y={-9}
                          textAnchor="middle"
                          className="fill-sky-200 text-[11px] font-mono font-bold pointer-events-none"
                        >
                          {v.code}
                        </text>
                      </g>
                    );
                  })}

                  {/* 2 Hydrants */}
                  {wm.hydrants.map((hyd) => {
                    const hp = projectLatLng(hyd.coordinate);
                    return (
                      <circle
                        key={`svg-wm-hyd-${hyd.id}`}
                        cx={hp.x}
                        cy={hp.y}
                        r={4.2}
                        fill="#e11d48"
                        stroke="#ffffff"
                        strokeWidth={1.3}
                      />
                    );
                  })}

                  {/* Pipe Callout Tooltip on Kierulffsvej (Focus Mode Item 8 pulsing red border on PPV > 50 mm/s or rupture) */}
                  <g
                    transform={`translate(${labelPos.x}, ${labelPos.y + 18})`}
                    data-testid="svg-water-main-tooltip-container"
                    data-critical-pulse={isWaterMainCriticalPulse ? 'true' : 'false'}
                    className="cursor-pointer"
                    onClick={() => setShowWaterMainInspector(true)}
                  >
                    <rect
                      data-testid="svg-water-main-tooltip-rect"
                      x={-130}
                      y={-9}
                      width={260}
                      height={18}
                      rx={3}
                      fill="#090d16"
                      fillOpacity={0.94}
                      stroke={isWaterMainCriticalPulse ? '#ef4444' : mainPipeHex}
                      strokeWidth={isWaterMainCriticalPulse ? 2.0 : 1.3}
                      className={
                        isWaterMainCriticalPulse ? 'water-main-svg-tooltip-critical-pulse' : undefined
                      }
                    />
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      className={`${
                        isWaterMainCriticalPulse ? 'fill-rose-200' : 'fill-sky-200'
                      } text-[11px] font-mono font-bold tabular-nums`}
                    >
                      DN200 (-1,65m) · {wm.pressureBar.toFixed(1)} bar · PPV{' '}
                      {wm.pipePpvMmPerSec.toFixed(1)} · {wm.flowLs.toFixed(1)} L/s
                    </text>
                  </g>

                  {/* Focus Mode Item 10: Clear color-coded + icon + text BEK 1272/2025 Status Indicator right next to Kierulffsvej tooltip */}
                  {waterMainBek1272Status && (
                    <g
                      transform={`translate(${labelPos.x}, ${labelPos.y + 39})`}
                      data-testid="svg-water-main-bek1272-indicator"
                    >
                      <rect
                        x={-152}
                        y={-9}
                        width={304}
                        height={18}
                        rx={3}
                        fill={waterMainBek1272Status.fillHex}
                        fillOpacity={0.95}
                        stroke={waterMainBek1272Status.strokeHex}
                        strokeWidth={1.3}
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        className={`${waterMainBek1272Status.textClass} text-[11px] font-mono font-bold tabular-nums`}
                      >
                        {waterMainBek1272Status.symbolChar} {waterMainBek1272Status.shortBadgeDa} · Pb{' '}
                        {waterMainBek1272Status.pbUgL.toFixed(2)} · 4-PAH{' '}
                        {waterMainBek1272Status.pah4UgL.toFixed(3)} · PCB{' '}
                        {waterMainBek1272Status.pcbUgL.toFixed(2)} µg/L
                      </text>
                    </g>
                  )}

                  {isStructuralIntegrityAlert && (
                    <g
                      transform={`translate(${labelPos.x}, ${labelPos.y + 60})`}
                      data-testid="svg-structural-integrity-alert-badge"
                    >
                      <rect
                        x={-152}
                        y={-9}
                        width={304}
                        height={18}
                        rx={3}
                        fill="#4c0519"
                        fillOpacity={0.96}
                        stroke="#fb7185"
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        className="fill-rose-100 text-[10.5px] font-mono font-extrabold tabular-nums"
                      >
                        ▲ Vibrationsfare (DIN 4150-3) · {wm.pipePpvMmPerSec.toFixed(1)}/25 mm/s ({ppvPctOf25Threshold}%)
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* SYSTEM B SIMULTANEOUS ALGEDONIC DISPATCH (S1 + S3) LAYER ON TACTICAL SVG */}
            {simultaneousDispatch?.active && (
              <g data-testid="svg-simultaneous-algedonic-layer">
                <defs>
                  <marker
                    id="s1-upwind-escape-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#22c55e" />
                  </marker>
                </defs>

                {/* System 1 P1 Danger Zone Polygon */}
                {simultaneousDispatch.system1State.dangerPolygon.length >= 3 && (
                  <polygon
                    points={polygonToSvgPoints(simultaneousDispatch.system1State.dangerPolygon)}
                    fill="rgba(220, 38, 38, 0.24)"
                    stroke="#ef4444"
                    strokeWidth={simultaneousDispatch.isBlinkingP1 ? 2.6 : 1.8}
                    strokeDasharray={simultaneousDispatch.isBlinkingP1 ? '7 4' : undefined}
                    className={simultaneousDispatch.isBlinkingP1 ? 'animate-pulse pointer-events-none' : 'pointer-events-none'}
                  />
                )}

                {/* System 3 Emergency Tanker Corridors */}
                {simultaneousDispatch.system3State.tankerIngressCorridors.map((corridor) => {
                  const pts = corridor.waypoints.map((w) => projectLatLng(w));
                  if (pts.length < 2) return null;
                  const pathD = pts
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                    .join(' ');
                  const mid = pts[Math.floor(pts.length / 2)];
                  const isOpen = corridor.status === 'OPEN_INGRESS';
                  return (
                    <g key={`svg-s3-corridor-${corridor.id}`} className="pointer-events-none">
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isOpen ? '#10b981' : '#ef4444'}
                        strokeWidth={isOpen ? 4 : 3}
                        strokeDasharray={isOpen ? '10 6' : '5 5'}
                        strokeOpacity={0.92}
                      />
                      <g transform={`translate(${mid.x}, ${mid.y - 12})`}>
                        <rect
                          x={-72}
                          y={-9}
                          width={144}
                          height={18}
                          rx={3}
                          fill={isOpen ? '#022c22' : '#450a0a'}
                          fillOpacity={0.94}
                          stroke={isOpen ? '#34d399' : '#f87171'}
                          strokeWidth={1.2}
                        />
                        <text
                          x={0}
                          y={3.5}
                          textAnchor="middle"
                          className={`text-[11px] font-mono font-bold ${
                            isOpen ? 'fill-emerald-200' : 'fill-rose-200'
                          }`}
                        >
                          {isOpen
                            ? `INDRYKNING: ${corridor.streetName}`
                            : `LUKKET: ${corridor.streetName}`}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* System 1 Island Mode (Ø-DRIFT) Protective Shields */}
                {buildings
                  .filter((b) =>
                    simultaneousDispatch.system1State.islandModeBlockIds.includes(b.id)
                  )
                  .map((b) => {
                    const bp = projectLatLng(b.center);
                    return (
                      <g
                        key={`svg-s1-island-${b.id}`}
                        transform={`translate(${bp.x}, ${bp.y})`}
                        className="pointer-events-none"
                      >
                        <circle
                          cx={0}
                          cy={0}
                          r={18}
                          fill="rgba(16, 185, 129, 0.14)"
                          stroke="#34d399"
                          strokeWidth={1.8}
                          strokeDasharray="4 3"
                        />
                        <rect
                          x={-36}
                          y={-28}
                          width={72}
                          height={15}
                          rx={3}
                          fill="#022c22"
                          fillOpacity={0.94}
                          stroke="#22d3ee"
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={-17.5}
                          textAnchor="middle"
                          className="fill-cyan-200 text-[11px] font-mono font-bold"
                        >
                          Ø-DRIFT {b.code}
                        </text>
                      </g>
                    );
                  })}

                {/* System 1 Upwind/Upslope Escape Vectors */}
                {simultaneousDispatch.system1State.escapeVectors.map((vec) => {
                  const p1 = projectLatLng(vec.origin);
                  const p2 = projectLatLng(vec.targetMusterPoint);
                  return (
                    <g key={`svg-s1-escape-${vec.id}`} className="pointer-events-none">
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#22c55e"
                        strokeWidth={3.2}
                        strokeDasharray="8 4"
                        markerEnd="url(#s1-upwind-escape-arrow)"
                      />
                      <g transform={`translate(${p2.x}, ${p2.y - 14})`}>
                        <rect
                          x={-68}
                          y={-9}
                          width={136}
                          height={18}
                          rx={3}
                          fill="#052e16"
                          fillOpacity={0.95}
                          stroke="#4ade80"
                          strokeWidth={1.3}
                        />
                        <text
                          x={0}
                          y={3.5}
                          textAnchor="middle"
                          className="fill-emerald-200 text-[11px] font-mono font-bold"
                        >
                          MODVIND → {vec.streetName} ({vec.distanceMeters}m)
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* System 3 Locked Valve Badges (V-VEST & V-MIDT) */}
                {waterMainTelemetry?.valves
                  .filter((v) =>
                    simultaneousDispatch.system3State.lockedValveCodes.includes(
                      v.code as 'V-VEST' | 'V-MIDT'
                    )
                  )
                  .map((v) => {
                    const vp = projectLatLng(v.coordinate);
                    return (
                      <g
                        key={`svg-s3-valve-${v.id}`}
                        transform={`translate(${vp.x}, ${vp.y})`}
                        className="pointer-events-none"
                      >
                        <rect
                          x={-34}
                          y={9}
                          width={68}
                          height={15}
                          rx={3}
                          fill="#9f1239"
                          stroke="#fde047"
                          strokeWidth={1.2}
                        />
                        <text
                          x={0}
                          y={19.5}
                          textAnchor="middle"
                          className="fill-white text-[11px] font-mono font-extrabold"
                        >
                          {v.code} LUKKET T1
                        </text>
                      </g>
                    );
                  })}

                {/* System 1 ISA-18.2 Inverted-Octagon P1 Beacon at Epicenter */}
                {(() => {
                  const ep = projectLatLng(simultaneousDispatch.system1State.epicenter);
                  const octPts = '8,-16 16,-8 16,8 8,16 -8,16 -16,8 -16,-8 -8,-16';
                  return (
                    <g
                      transform={`translate(${ep.x}, ${ep.y})`}
                      className="cursor-pointer"
                      onClick={() => {
                        if (simultaneousDispatch.isBlinkingP1 && onAcknowledgeSimultaneousP1) {
                          onAcknowledgeSimultaneousP1();
                        } else {
                          onOpenSimultaneousModal?.();
                        }
                      }}
                    >
                      <polygon
                        points={octPts}
                        fill={simultaneousDispatch.isBlinkingP1 ? '#e11d48' : '#881337'}
                        stroke="#fef08a"
                        strokeWidth={2.2}
                        className={simultaneousDispatch.isBlinkingP1 ? 'animate-pulse' : ''}
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        className="fill-white text-[11px] font-mono font-extrabold pointer-events-none"
                      >
                        P1
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}

            {/* Active 'Fit to Receptors' Bounding Box Highlight Frame on 2D Tactical Canvas */}
            {fittedReceptorBounds &&
              (() => {
                const nw = projectLatLng({
                  lat: fittedReceptorBounds.maxLat,
                  lng: fittedReceptorBounds.minLng,
                });
                const se = projectLatLng({
                  lat: fittedReceptorBounds.minLat,
                  lng: fittedReceptorBounds.maxLng,
                });
                const x = Math.min(nw.x, se.x) - 14;
                const y = Math.min(nw.y, se.y) - 14;
                const w = Math.max(40, Math.abs(se.x - nw.x) + 28);
                const h = Math.max(40, Math.abs(se.y - nw.y) + 28);
                return (
                  <g className="pointer-events-none">
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx={6}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={fittedToReceptorsJustNow ? 2.2 : 1.1}
                      strokeDasharray="8 5"
                      strokeOpacity={fittedToReceptorsJustNow ? 0.9 : 0.35}
                    />
                  </g>
                );
              })()}

            {/* Item 8: Dynamic Emergency Evacuation Flow Animation (Slope & Local Plume Density Speed) on Tactical SVG */}
            {showEvacuationFlowAnimation && evacuationFlowSegments.length > 0 && (
              <g className="pointer-events-none" data-testid="svg-emergency-evac-flow-layer">
                <defs>
                  <marker
                    id="evac-flow-arrow-head"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#34d399" />
                  </marker>
                </defs>
                {evacuationFlowSegments.map((seg) => {
                  const p1 = projectLatLng(seg.origin);
                  const p2 = projectLatLng(seg.target);
                  const midX = (p1.x + p2.x) * 0.5;
                  const midY = (p1.y + p2.y) * 0.5;
                  return (
                    <g key={`svg-evac-flow-${seg.id}`}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="rgba(16, 185, 129, 0.28)"
                        strokeWidth={7}
                        strokeLinecap="round"
                      />
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#34d399"
                        strokeWidth={2.8}
                        strokeDasharray="10 6"
                        markerEnd="url(#evac-flow-arrow-head)"
                        className="map-evac-flow-path"
                        style={
                          {
                            '--evac-flow-dur': `${seg.cssDurationSec}s`,
                          } as React.CSSProperties
                        }
                      />
                      <g transform={`translate(${midX}, ${midY - 12})`}>
                        <rect
                          x={-94}
                          y={-9}
                          width={188}
                          height={18}
                          rx={3}
                          fill="#022c22"
                          fillOpacity={0.94}
                          stroke="#34d399"
                          strokeWidth={1.1}
                        />
                        <text
                          x={0}
                          y={3.5}
                          textAnchor="middle"
                          className="fill-emerald-200 text-[11px] font-mono font-bold tabular-nums"
                        >
                          FLUGT {seg.speedMs.toFixed(2)} m/s · Hældn. {seg.slopePct >= 0 ? '+' : ''}
                          {seg.slopePct.toFixed(1)}% · S={seg.localPlumeDensityS.toFixed(2)}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Receptor Polygons (Beboede boligblokke Afd. 23, 24, 26, 32 + Veje/Cykelsti, auto-highlighted when wind > 10 m/s or gusts > 12 m/s) */}
            {receptors.map((rec) => {
              const exp = exposureByReceptorId[rec.id];
              const isSelected = selectedReceptorId === rec.id;
              const hwRank = highWindRankByReceptorId[rec.id];
              const isHighGustHit =
                isHighGustAlert && highGustCorrelationData.affectedReceptorIds.has(rec.id);
              const isRed = exp?.riskLevel === 'red';
              const isOrange = exp?.riskLevel === 'orange';

              const strokeColor = hwRank
                ? '#fbbf24'
                : isHighGustHit
                ? '#f59e0b'
                : isRed
                ? '#f43f5e'
                : isOrange
                ? '#fb923c'
                : '#38bdf8';
              const fillColor = hwRank
                ? 'rgba(225, 29, 72, 0.34)'
                : isHighGustHit
                ? 'rgba(245, 158, 11, 0.28)'
                : isRed
                ? 'rgba(244, 63, 94, 0.22)'
                : isOrange
                ? 'rgba(251, 146, 60, 0.18)'
                : 'rgba(56, 189, 248, 0.10)';

              return (
                <g
                  key={rec.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectReceptor(rec.id);
                  }}
                  className="cursor-pointer"
                >
                  <polygon
                    points={memoizedSvgBaseGeometry.receptorSvgPointsById[rec.id] || ''}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={hwRank || isHighGustHit ? 3.2 : isSelected ? 2.6 : 1.5}
                    strokeDasharray={
                      hwRank || isHighGustHit
                        ? undefined
                        : rec.category === 'residential_block'
                        ? undefined
                        : '5 3'
                    }
                  />
                </g>
              );
            })}

            {/* CONNECTED AUTONOMOUS RECEPTOR MESH NETWORK (Connects ALL Receptors + Live Nabotest Consensus Links) */}
            {showAutonomousMesh && (
              <g
                className="pointer-events-none"
                data-testid="svg-autonomous-receptor-mesh-layer"
              >
                {autonomousMesh.edges.map((edge) => {
                  const p1 = projectLatLng(edge.fromPos);
                  const p2 = projectLatLng(edge.toPos);
                  const midX = (p1.x + p2.x) * 0.5;
                  const midY = (p1.y + p2.y) * 0.5;
                  const edgeStroke = edge.bothNodesAlgedonic
                    ? '#f43f5e'
                    : edge.eitherNodeAlgedonic
                    ? '#fbbf24'
                    : '#22d3ee';
                  return (
                    <g key={`svg-mesh-${edge.edgeId}`}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={edgeStroke}
                        strokeWidth={
                          edge.bothNodesAlgedonic
                            ? 2.4
                            : edge.isSpanningBackbone
                            ? 1.6
                            : 1.15
                        }
                        strokeOpacity={
                          edge.bothNodesAlgedonic
                            ? 0.9
                            : edge.eitherNodeAlgedonic
                            ? 0.65
                            : 0.45
                        }
                        strokeDasharray={
                          edge.bothNodesAlgedonic
                            ? undefined
                            : edge.isSpanningBackbone
                            ? '6 3'
                            : '3 4'
                        }
                      />
                      {edge.bothNodesAlgedonic && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x={-26}
                            y={-7}
                            width={52}
                            height={14}
                            rx={2}
                            fill="#4c0519"
                            fillOpacity={0.92}
                            stroke="#fb7185"
                            strokeWidth={0.9}
                          />
                          <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            className="fill-rose-100 text-[11px] font-mono font-bold tabular-nums"
                          >
                            NABO {edge.signalSimilarityPct}%
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {(showAutonomousMesh ||
              showMyceliumAlertCenter ||
              myceliumScenario !== 'live_telemetry') && (
              <MyceliumSvgOverlayLayer
                state={myceliumSimState}
                projectLatLng={projectLatLng}
                onSelectReceptor={onSelectReceptor}
              />
            )}

            {/* CSS PRESSURE-WAVE PROPAGATION PER NEIGHBOR BLOCK ON RINGPARKEN MAP (Activated specifically when v > 10 m/s) */}
            {isMapBlockPressureWaveActive && (
              <g
                className={`pointer-events-none ${mapWaveSpeedTierClass}`}
                data-testid="ringparken-map-neighbor-pressure-waves"
              >
                {neighborBlockPressureTargets.map((item) => {
                  const pt = projectLatLng(item.receptor.center);
                  const baseRadius = item.isCriticalImpulse ? 22 : 17;
                  const primaryStroke = item.isCriticalImpulse ? '#f43f5e' : '#f59e0b';
                  const secondaryStroke = item.isCriticalImpulse ? '#fbbf24' : '#38bdf8';
                  return (
                    <g
                      key={`svg-block-wave-${item.receptor.id}`}
                      transform={`translate(${pt.x}, ${pt.y})`}
                      data-testid={`svg-neighbor-pressure-wave-${item.receptor.code}`}
                    >
                      {/* Directional downwind acoustic pressure cone aligned with wind vector */}
                      <g transform={`rotate(${(currentWeather.windDirection10m + 180) % 360})`}>
                        <path
                          d="M 0 0 L -22 -52 Q 0 -66 22 -52 Z"
                          fill={
                            item.isCriticalImpulse
                              ? 'rgba(244, 63, 94, 0.24)'
                              : 'rgba(245, 158, 11, 0.18)'
                          }
                          stroke={primaryStroke}
                          strokeWidth={1}
                          strokeOpacity={0.65}
                          className="map-svg-pressure-cone"
                        />
                      </g>

                      {/* 3 Staggered Concentric CSS Pressure-Wave Shockwave Rings per Neighbor Block */}
                      <circle
                        cx={0}
                        cy={0}
                        r={baseRadius}
                        fill="none"
                        stroke={primaryStroke}
                        strokeWidth={2.1}
                        className="map-svg-pressure-ring map-svg-pressure-ring--1"
                      />
                      <circle
                        cx={0}
                        cy={0}
                        r={baseRadius}
                        fill="none"
                        stroke={secondaryStroke}
                        strokeWidth={1.6}
                        className="map-svg-pressure-ring map-svg-pressure-ring--2"
                      />
                      <circle
                        cx={0}
                        cy={0}
                        r={baseRadius}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth={1.2}
                        className="map-svg-pressure-ring map-svg-pressure-ring--3"
                      />

                      {/* Acoustic Impulse Callout per Neighbor Block */}
                      <g transform="translate(0, 36)">
                        <rect
                          x={-56}
                          y={-7}
                          width={112}
                          height={14}
                          rx={2}
                          fill={item.isCriticalImpulse ? '#881337' : '#451a03'}
                          fillOpacity={0.92}
                          stroke={primaryStroke}
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          className="fill-white text-[11px] font-mono font-bold tabular-nums"
                        >
                          TRYKBØLGE {item.estimatedLafmaxDb.toFixed(0)} dB
                          {item.complaintCount > 0 ? ` · ${item.complaintCount} KL.` : ''}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Item 6: CSS-Animated Acoustic Wavefront (> 85 dB) from Active Demolition Sources into 'støj-følsomme' Neighbor Zones */}
            {showSource85DbWavefronts && sourceWavefrontTargets.length > 0 && (
              <g
                className="pointer-events-none"
                data-testid="svg-source-85db-wavefront-layer"
              >
                {sourceWavefrontTargets.map((entry) => {
                  const sp = projectLatLng(entry.source.position);
                  const waveDurSec = Math.max(
                    0.85,
                    1.75 - Math.max(0, entry.peakLafmaxDb - 85) * 0.04
                  ).toFixed(2);
                  return (
                    <g
                      key={`svg-src-wavefront-${entry.source.id}`}
                      style={{ '--source-wave-dur': `${waveDurSec}s` } as React.CSSProperties}
                    >
                      {entry.impactedReceptors.map((hit) => {
                        const rp = projectLatLng(hit.receptor.center);
                        const mx = (sp.x + rp.x) * 0.5;
                        const my = (sp.y + rp.y) * 0.5;
                        return (
                          <g key={`svg-src-wave-link-${entry.source.id}-${hit.receptor.id}`}>
                            <line
                              x1={sp.x}
                              y1={sp.y}
                              x2={rp.x}
                              y2={rp.y}
                              stroke="#fb7185"
                              strokeWidth={1.6}
                              strokeDasharray="6 4"
                              strokeOpacity={0.75}
                            />
                            <g transform={`translate(${mx}, ${my})`}>
                              <rect
                                x={-44}
                                y={-7}
                                width={88}
                                height={14}
                                rx={2}
                                fill="#4c0519"
                                fillOpacity={0.92}
                                stroke="#f43f5e"
                                strokeWidth={0.9}
                              />
                              <text
                                x={0}
                                y={3}
                                textAnchor="middle"
                                className="fill-rose-100 text-[11px] font-mono font-bold tabular-nums"
                              >
                                &gt;85dB: {hit.estimatedLafmaxDb.toFixed(0)}dB
                              </text>
                            </g>
                          </g>
                        );
                      })}
                      <g transform={`translate(${sp.x}, ${sp.y})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={24}
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth={2.2}
                          className="map-source-wavefront-ring map-source-wavefront-ring--1"
                        />
                        <circle
                          cx={0}
                          cy={0}
                          r={24}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={1.8}
                          className="map-source-wavefront-ring map-source-wavefront-ring--2"
                        />
                        <circle
                          cx={0}
                          cy={0}
                          r={24}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth={1.4}
                          className="map-source-wavefront-ring map-source-wavefront-ring--3"
                        />
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            {/* OUTGOING SNAPSHOT LAYER (FADING OUT 1 -> 0 DURING MODE OR TIME-INTERVAL CROSS-FADE) */}
            {outgoingSnapshot && crossFadeProgress < 1 && (
              <g
                className="pointer-events-none"
                opacity={Math.max(0, (1 - crossFadeProgress) * 0.9)}
              >
                {outgoingSnapshot.activePolygons.map((zone) => {
                  const gradId =
                    zone.level === 'red'
                      ? 'url(#plume-red-grad)'
                      : zone.level === 'orange'
                      ? 'url(#plume-orange-grad)'
                      : zone.level === 'blue'
                      ? 'url(#plume-blue-grad)'
                      : 'url(#plume-yellow-grad)';
                  const strokeCol = RISK_COLORS[zone.level].stroke;
                  return (
                    <polygon
                      key={`outgoing-svg-plume-${zone.id}`}
                      points={polygonToSvgPoints(zone.polygon)}
                      fill={gradId}
                      stroke={strokeCol}
                      strokeWidth={zone.level === 'red' ? 1.8 : 1.1}
                      strokeOpacity={
                        outgoingSnapshot.showHeatmapComparison
                          ? 0.22
                          : outgoingSnapshot.isPuffMode && zone.hourLabel
                          ? 0.4
                          : 0.75
                      }
                    />
                  );
                })}

                {outgoingSnapshot.showHeatmapComparison &&
                  outgoingSnapshot.heatmapComparison && (
                    <g>
                      {outgoingSnapshot.heatmapComparison.polygonsA
                        .filter(
                          (z) => z.level === 'yellow' || z.level === 'orange' || z.level === 'red'
                        )
                        .map((z) => (
                          <polygon
                            key={`outgoing-hm-polyA-${z.id}`}
                            points={polygonToSvgPoints(z.polygon)}
                            fill="url(#heatmap-ta-cyan-grad)"
                            stroke="#22d3ee"
                            strokeWidth={1.3}
                            strokeDasharray="5 3"
                          />
                        ))}
                      {outgoingSnapshot.heatmapComparison.polygonsB
                        .filter(
                          (z) => z.level === 'yellow' || z.level === 'orange' || z.level === 'red'
                        )
                        .map((z) => (
                          <polygon
                            key={`outgoing-hm-polyB-${z.id}`}
                            points={polygonToSvgPoints(z.polygon)}
                            fill="url(#heatmap-tb-warm-grad)"
                            stroke="#f43f5e"
                            strokeWidth={1.5}
                          />
                        ))}
                    </g>
                  )}
              </g>
            )}

            {/* Plume Concentration Heatmap Layer (utilizes simulation.plumeZones vs Safe Zones S < 0.25) */}
            {showPlumeConcentrationHeatmapLayer && (
              <g
                data-testid="svg-plume-concentration-heatmap-layer"
                className="pointer-events-none"
              >
                {/* Safe Zone Backdrop Perimeter (S < 0,25 outside active plumeZones) */}
                <polygon
                  points={polygonToSvgPoints(plumeConcentrationHeatmapData.safeZonePerimeter)}
                  fill="url(#safe-zone-emerald-grid)"
                  stroke="#34d399"
                  strokeWidth="1.6"
                  strokeDasharray="7 4"
                  strokeOpacity="0.7"
                />
                {(() => {
                  const safeBadgePt = projectLatLng(
                    plumeConcentrationHeatmapData.safeZonePerimeter[0]
                  );
                  return (
                    <g transform={`translate(${safeBadgePt.x + 110}, ${safeBadgePt.y + 18})`}>
                      <rect
                        x={-102}
                        y={-11}
                        width={204}
                        height={20}
                        rx={4}
                        fill="#064e3b"
                        fillOpacity={0.92}
                        stroke="#34d399"
                        strokeWidth={1.2}
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        className="fill-emerald-200 text-[11px] font-mono font-bold"
                      >
                        SIKKER ZONE BASELINE (S &lt; {plumeConcentrationHeatmapData.obsThreshold.toFixed(2)})
                      </text>
                    </g>
                  );
                })()}

                {/* Safe Receptor Halos (Receptors outside plume threshold) */}
                {receptors
                  .filter((rec) => plumeConcentrationHeatmapData.safeReceptorIds.has(rec.id))
                  .map((rec) => {
                    const cPx = projectLatLng(rec.center);
                    return (
                      <g key={`safe-rec-halo-${rec.id}`} transform={`translate(${cPx.x}, ${cPx.y})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={18}
                          fill="rgba(16, 185, 129, 0.18)"
                          stroke="#34d399"
                          strokeWidth={1.4}
                          strokeDasharray="3 2"
                        />
                        <rect
                          x={-28}
                          y={16}
                          width={56}
                          height={13}
                          rx={3}
                          fill="#064e3b"
                          fillOpacity={0.92}
                          stroke="#34d399"
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={25.5}
                          textAnchor="middle"
                          className="fill-emerald-200 text-[11px] font-mono font-bold"
                        >
                          SIKKER
                        </text>
                      </g>
                    );
                  })}

                {/* High-Concentration Plume Heatmap Layers from simulation.plumeZones */}
                {plumeConcentrationHeatmapData.classifiedZones.map(({ zone, heatmapLevel }) => {
                  const gradId =
                    heatmapLevel === 'red'
                      ? 'url(#plume-heatmap-critical-grad)'
                      : heatmapLevel === 'orange'
                      ? 'url(#plume-heatmap-elevated-grad)'
                      : heatmapLevel === 'blue'
                      ? 'url(#plume-heatmap-runoff-grad)'
                      : 'url(#plume-heatmap-observation-grad)';
                  const strokeCol =
                    heatmapLevel === 'red'
                      ? '#fda4af'
                      : heatmapLevel === 'orange'
                      ? '#fdba74'
                      : heatmapLevel === 'blue'
                      ? '#a5b4fc'
                      : '#fde047';
                  const glowCol =
                    heatmapLevel === 'red'
                      ? '#f43f5e'
                      : heatmapLevel === 'orange'
                      ? '#fb923c'
                      : heatmapLevel === 'blue'
                      ? '#6366f1'
                      : '#eab308';
                  const pts = polygonToSvgPoints(zone.polygon);
                  const centroid = zone.polygon.reduce(
                    (acc, p) => ({
                      lat: acc.lat + p.lat / Math.max(1, zone.polygon.length),
                      lng: acc.lng + p.lng / Math.max(1, zone.polygon.length),
                    }),
                    { lat: 0, lng: 0 }
                  );
                  const cPx = projectLatLng(centroid);

                  return (
                    <g key={`svg-conc-heat-${zone.id}`}>
                      {/* Soft Outer Thermal Bleed */}
                      <polygon
                        points={pts}
                        fill="none"
                        stroke={glowCol}
                        strokeWidth={heatmapLevel === 'red' ? 12 : heatmapLevel === 'orange' ? 8 : 5}
                        strokeOpacity={heatmapLevel === 'red' ? 0.28 : 0.18}
                        strokeLinejoin="round"
                      />
                      {/* Primary Thermal Concentration Gradient Fill + Iso-Contour */}
                      <polygon
                        points={pts}
                        fill={gradId}
                        stroke={strokeCol}
                        strokeWidth={heatmapLevel === 'red' ? 2.4 : heatmapLevel === 'orange' ? 1.8 : 1.2}
                        strokeOpacity={0.94}
                      />
                      {(heatmapLevel === 'red' || heatmapLevel === 'orange') && (
                        <g transform={`translate(${cPx.x}, ${cPx.y})`}>
                          <rect
                            x={-54}
                            y={-9}
                            width={108}
                            height={16}
                            rx={3}
                            fill={zone.level === 'red' ? '#881337' : '#7c2d12'}
                            fillOpacity={0.92}
                            stroke={strokeCol}
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={2.5}
                            textAnchor="middle"
                            className="fill-white text-[11px] font-mono font-bold tabular-nums"
                          >
                            {zone.level === 'red' ? 'HØJ KONC.' : 'FORHØJET'} S=
                            {zone.maxSumQuotient.toFixed(2)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Vejr-Korrelations Heatmap Layer (automatisk highlight af geografiske områder med r > 0.80 over seneste 6 timer) */}
            {showWeatherCorrelationHeatmapLayer && (
              <g
                data-testid="svg-weather-correlation-heatmap-layer"
                className="pointer-events-none"
              >
                {weatherCorrelationHeatmapData.highlightedAreas.map((item) => {
                  const pt = projectLatLng(item.receptor.center);
                  const strengthScale = Math.max(0.2, Math.min(1, (item.pearsonR - 0.8) / 0.2));
                  const auraR = 34 + strengthScale * 24;
                  return (
                    <g key={`svg-weather-corr-${item.receptor.id}`}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={auraR}
                        fill="url(#weather-corr-high-grad)"
                        stroke="#fb923c"
                        strokeOpacity={0.55}
                        strokeWidth={1.2}
                        strokeDasharray="4 3"
                      />
                      <polygon
                        points={polygonToSvgPoints(item.receptor.polygon)}
                        fill="url(#weather-corr-high-grad)"
                        stroke="#f97316"
                        strokeWidth={2.3}
                        strokeOpacity={0.94}
                      />
                      <g transform={`translate(${pt.x}, ${pt.y - 24})`}>
                        <rect
                          x={-64}
                          y={-12}
                          width={128}
                          height={16}
                          rx={3}
                          fill="#431407"
                          fillOpacity={0.94}
                          stroke="#fb923c"
                          strokeWidth={1.2}
                        />
                        <text
                          x={0}
                          y={-1}
                          textAnchor="middle"
                          className="fill-orange-100 text-[10.5px] font-mono font-bold"
                        >
                          {item.receptor.code}: r={item.pearsonR.toFixed(2)} &gt;0,80
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Plume / 24h Gaussian Puff Risk Zone Polygons (Hidden in pure Differens-Heatmap mode so only the direct concentration difference is shown) */}
            {!isDifferenceHeatmapMode &&
              filteredActivePolygons.map((zone) => {
                const gradId =
                  zone.level === 'red'
                    ? 'url(#plume-red-grad)'
                    : zone.level === 'orange'
                    ? 'url(#plume-orange-grad)'
                    : zone.level === 'blue'
                    ? 'url(#plume-blue-grad)'
                    : 'url(#plume-yellow-grad)';
                const strokeCol = RISK_COLORS[zone.level].stroke;
                return (
                  <g
                    key={zone.id}
                    className="pointer-events-none"
                    opacity={(showHeatmapComparison ? 0.25 : 1) * crossFadeProgress}
                  >
                    <polygon
                      points={polygonToSvgPoints(zone.polygon)}
                      fill={gradId}
                      stroke={strokeCol}
                      strokeWidth={zone.level === 'red' ? 1.8 : 1.1}
                      strokeOpacity={isPuffMode && zone.hourLabel ? 0.45 : 0.85}
                    />
                  </g>
                );
              })}

            {/* HEATMAP-SAMMENLIGNING & DIFFERENS-HEATMAP LAYER (T_A vs T_B) ON TACTICAL SVG CANVAS */}
            {showHeatmapComparison && heatmapComparison && (
              <g opacity={crossFadeProgress}>
                {/* 1. Spatial Grid Cells: Direct Difference Heatmap (Δ = T_B − T_A) OR Dual Overlay */}
                {heatmapComparison.heatmapGridCells.map((cell) => {
                  if (isDifferenceHeatmapMode) {
                    const diffStyle = getDifferenceCellVisualStyle(cell);
                    const centerPx = projectLatLng(cell.center);
                    const isInspected = inspectedDiffCellId === cell.id;
                    const showCellDeltaLabel =
                      Math.abs(cell.deltaS) >= 0.26 || isInspected;
                    const formattedDelta =
                      differenceMetric === 'sum_quotient'
                        ? cell.deltaS >= 0
                          ? `+${cell.deltaS.toFixed(2)}`
                          : cell.deltaS.toFixed(2)
                        : cell.deltaDustUgM3 >= 0
                        ? `+${cell.deltaDustUgM3.toFixed(0)}`
                        : cell.deltaDustUgM3.toFixed(0);

                    return (
                      <g
                        key={`svg-hm-diff-cell-${cell.id}`}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedDiffCellId(cell.id);
                        }}
                        onMouseEnter={() => setInspectedDiffCellId(cell.id)}
                      >
                        <polygon
                          points={polygonToSvgPoints(cell.polygon)}
                          fill={diffStyle.svgFill}
                          stroke={isInspected ? '#ffffff' : diffStyle.svgStroke}
                          strokeWidth={isInspected ? 1.8 : 0.85}
                        />
                        {showCellDeltaLabel && (
                          <text
                            x={centerPx.x}
                            y={centerPx.y + 2.5}
                            textAnchor="middle"
                            className="fill-white text-[11px] font-mono font-bold pointer-events-none select-none"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
                          >
                            {formattedDelta}
                          </text>
                        )}
                      </g>
                    );
                  }

                  const fillStyle =
                    cell.zoneClass === 'overlap_AB'
                      ? 'url(#heatmap-overlap-pattern)'
                      : cell.zoneClass === 'only_B'
                      ? `rgba(244, 63, 94, ${(0.14 + cell.intensityNormalized * 0.28).toFixed(2)})`
                      : `rgba(6, 182, 212, ${(0.12 + cell.intensityNormalized * 0.22).toFixed(2)})`;
                  const strokeCol =
                    cell.zoneClass === 'overlap_AB'
                      ? 'rgba(232, 121, 249, 0.55)'
                      : cell.zoneClass === 'only_B'
                      ? 'rgba(251, 113, 133, 0.45)'
                      : 'rgba(34, 211, 238, 0.4)';

                  return (
                    <polygon
                      key={`svg-hm-cell-${cell.id}`}
                      points={polygonToSvgPoints(cell.polygon)}
                      fill={fillStyle}
                      stroke={strokeCol}
                      strokeWidth="0.7"
                      className="pointer-events-none"
                    />
                  );
                })}

                {/* 2 & 3. Only render both T_A and T_B Plume Lobes when in 'dual_overlay' mode */}
                {!isDifferenceHeatmapMode && (
                  <g className="pointer-events-none">
                    {/* Hour A (T_A) Plume Lobes — Cool Cyan Dashed Footprint */}
                    {heatmapComparison.polygonsA
                      .filter(
                        (z) => z.level === 'yellow' || z.level === 'orange' || z.level === 'red'
                      )
                      .map((z) => (
                        <polygon
                          key={`svg-hm-polyA-${z.id}`}
                          points={polygonToSvgPoints(z.polygon)}
                          fill="url(#heatmap-ta-cyan-grad)"
                          stroke="#22d3ee"
                          strokeWidth={z.level === 'red' ? 2.2 : z.level === 'orange' ? 1.6 : 1}
                          strokeDasharray={z.level === 'red' ? '5 3' : '7 4'}
                          strokeOpacity={z.level === 'yellow' ? 0.55 : 0.92}
                        />
                      ))}

                    {/* Hour B (T_B) Plume Lobes — Warm Rose/Orange Solid Footprint */}
                    {heatmapComparison.polygonsB
                      .filter(
                        (z) => z.level === 'yellow' || z.level === 'orange' || z.level === 'red'
                      )
                      .map((z) => (
                        <polygon
                          key={`svg-hm-polyB-${z.id}`}
                          points={polygonToSvgPoints(z.polygon)}
                          fill="url(#heatmap-tb-warm-grad)"
                          stroke={z.level === 'red' ? '#f43f5e' : '#fb923c'}
                          strokeWidth={z.level === 'red' ? 2.4 : z.level === 'orange' ? 1.8 : 1.1}
                          strokeOpacity={z.level === 'yellow' ? 0.55 : 0.96}
                        />
                      ))}
                  </g>
                )}

                {/* Peak +Delta and -Delta Hotspot Callouts on Tactical SVG Canvas in Differens-Heatmap Mode */}
                {isDifferenceHeatmapMode &&
                  heatmapComparison.peakPositiveCell &&
                  heatmapComparison.peakPositiveCell.deltaS > 0.05 &&
                  (() => {
                    const posPx = projectLatLng(heatmapComparison.peakPositiveCell.center);
                    return (
                      <g
                        transform={`translate(${posPx.x}, ${posPx.y - 16})`}
                        className="pointer-events-none"
                      >
                        <rect
                          x={-78}
                          y={-12}
                          width={156}
                          height={17}
                          rx={3}
                          fill="#881337"
                          stroke="#fda4af"
                          strokeWidth="1.3"
                        />
                        <text
                          x={0}
                          y={-1}
                          textAnchor="middle"
                          className="fill-rose-100 text-[11px] font-mono font-bold"
                        >
                          ▲ Maks. Stigning:{' '}
                          {differenceMetric === 'sum_quotient'
                            ? `+${heatmapComparison.peakPositiveCell.deltaS.toFixed(2)} S`
                            : `+${heatmapComparison.peakPositiveCell.deltaDustUgM3.toFixed(0)} µg/m³`}
                        </text>
                      </g>
                    );
                  })()}

                {isDifferenceHeatmapMode &&
                  heatmapComparison.peakNegativeCell &&
                  heatmapComparison.peakNegativeCell.deltaS < -0.05 &&
                  (() => {
                    const negPx = projectLatLng(heatmapComparison.peakNegativeCell.center);
                    return (
                      <g
                        transform={`translate(${negPx.x}, ${negPx.y + 20})`}
                        className="pointer-events-none"
                      >
                        <rect
                          x={-78}
                          y={-12}
                          width={156}
                          height={17}
                          rx={3}
                          fill="#0c4a6e"
                          stroke="#7dd3fc"
                          strokeWidth="1.3"
                        />
                        <text
                          x={0}
                          y={-1}
                          textAnchor="middle"
                          className="fill-sky-100 text-[11px] font-mono font-bold"
                        >
                          ▼ Maks. Fald:{' '}
                          {differenceMetric === 'sum_quotient'
                            ? `${heatmapComparison.peakNegativeCell.deltaS.toFixed(2)} S`
                            : `${heatmapComparison.peakNegativeCell.deltaDustUgM3.toFixed(0)} µg/m³`}
                        </text>
                      </g>
                    );
                  })()}

                {/* 4. Per-Source Plume Centroid Displacement Vectors, Sweep Arcs & Callout Tags */}
                {heatmapComparison.sourceShifts.map((sh) => {
                  const srcPx = projectLatLng(sh.sourcePosition);
                  const cAPx = projectLatLng(sh.centroidA);
                  const cBPx = projectLatLng(sh.centroidB);
                  const tipAPx = projectLatLng(sh.tipA);
                  const tipBPx = projectLatLng(sh.tipB);
                  const midPx = {
                    x: (cAPx.x + cBPx.x) / 2,
                    y: (cAPx.y + cBPx.y) / 2,
                  };
                  const isPrimary =
                    sh.sourceId === selectedSourceId ||
                    sh.sourceId === heatmapComparison.sourceShifts[0]?.sourceId;

                  return (
                    <g key={`svg-hm-shift-${sh.sourceId}`} className="pointer-events-none">
                      {/* Centerline Axis at T_A (Cyan Dashed) */}
                      <line
                        x1={srcPx.x}
                        y1={srcPx.y}
                        x2={tipAPx.x}
                        y2={tipAPx.y}
                        stroke="#22d3ee"
                        strokeWidth={isPrimary ? 1.8 : 1.2}
                        strokeDasharray="4 3"
                        strokeOpacity={isDifferenceHeatmapMode ? 0.55 : 0.85}
                      />
                      {/* Centerline Axis at T_B (Rose/Amber Solid) */}
                      <line
                        x1={srcPx.x}
                        y1={srcPx.y}
                        x2={tipBPx.x}
                        y2={tipBPx.y}
                        stroke="#fb7185"
                        strokeWidth={isPrimary ? 2.2 : 1.4}
                        strokeOpacity={isDifferenceHeatmapMode ? 0.65 : 0.95}
                      />

                      {/* Plume Centroid Shift Vector Arrow (T_A -> T_B) */}
                      <line
                        x1={cAPx.x}
                        y1={cAPx.y}
                        x2={cBPx.x}
                        y2={cBPx.y}
                        stroke="#fde047"
                        strokeWidth={isPrimary ? 2.8 : 1.8}
                        strokeDasharray="6 3"
                      />

                      {/* Centroid A Node (T_A) */}
                      <g transform={`translate(${cAPx.x}, ${cAPx.y})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={isPrimary ? 6 : 4.5}
                          fill="#06b6d4"
                          stroke="#ffffff"
                          strokeWidth="1.6"
                        />
                        {isPrimary && (
                          <g transform="translate(0, -16)">
                            <rect
                              x={-64}
                              y={-12}
                              width={128}
                              height={16}
                              rx={3}
                              fill="#083344"
                              stroke="#22d3ee"
                              strokeWidth="1.2"
                            />
                            <text
                              x={0}
                              y={-1}
                              textAnchor="middle"
                              className="fill-cyan-200 text-[11px] font-mono font-bold"
                            >
                              T_A kl. {heatmapComparison.hourA.hourLabel} ({sh.plumeDirectionADeg}°)
                            </text>
                          </g>
                        )}
                      </g>

                      {/* Centroid B Node (T_B) */}
                      <g transform={`translate(${cBPx.x}, ${cBPx.y})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={isPrimary ? 6.5 : 5}
                          fill="#f43f5e"
                          stroke="#ffffff"
                          strokeWidth="1.8"
                        />
                        {isPrimary && (
                          <g transform="translate(0, 18)">
                            <rect
                              x={-64}
                              y={-10}
                              width={128}
                              height={16}
                              rx={3}
                              fill="#881337"
                              stroke="#fb7185"
                              strokeWidth="1.2"
                            />
                            <text
                              x={0}
                              y={1}
                              textAnchor="middle"
                              className="fill-rose-100 text-[11px] font-mono font-bold"
                            >
                              T_B kl. {heatmapComparison.hourB.hourLabel} ({sh.plumeDirectionBDeg}°)
                            </text>
                          </g>
                        )}
                      </g>

                      {/* Midpoint Displacement Vector Badge */}
                      {isPrimary && sh.centroidShiftMeters > 3 && (
                        <g transform={`translate(${midPx.x}, ${midPx.y})`}>
                          <rect
                            x={-88}
                            y={-11}
                            width={176}
                            height={20}
                            rx={3}
                            fill="#f59e0b"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <text
                            x={0}
                            y={2}
                            textAnchor="middle"
                            className="fill-slate-950 text-[11px] font-mono font-bold"
                          >
                            ➤ {sh.sourceCode}: {sh.centroidShiftMeters}m mod {sh.shiftCompass} (
                            {sh.rotationSignedDeg >= 0
                              ? `+${sh.rotationSignedDeg}°`
                              : `${sh.rotationSignedDeg}°`}
                            )
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* ASBEST-RISIKOLAG (<1997 BYGNINGSMATERIALE-ALDER & FIBERDEPOSITIONS-KORRELATION) */}
            {showAsbestosRiskLayer &&
              (visibleDispersionSubstances.asbestos || visibleDispersionSubstances.quartzWool) &&
              asbestosDepositionZones.map((az) => {
                const srcPx = projectLatLng(az.sourcePosition);
                const centroidPx = projectLatLng(az.depositionCentroid);
                const isSel = selectedSourceId === az.sourceId;

                return (
                  <g
                    key={`svg-asbestos-layer-${az.sourceId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSource(az.sourceId);
                    }}
                    className="cursor-pointer"
                  >
                    {/* Outer <1997 Roof/Facade Mineral & Quartz Wool Fiber Settling Halo */}
                    {visibleDispersionSubstances.quartzWool && (
                      <polygon
                        points={polygonToSvgPoints(az.haloPolygon)}
                        fill="rgba(16, 185, 129, 0.08)"
                        stroke="#34d399"
                        strokeWidth={isSel ? 1.6 : 1}
                        strokeDasharray="6 4"
                        strokeOpacity={0.75}
                      />
                    )}

                    {/* Inner High-Probability (<1997) Asbestos Fiber Deposition Corridor */}
                    {visibleDispersionSubstances.asbestos && (
                      <>
                        <polygon
                          points={polygonToSvgPoints(az.corePolygon)}
                          fill="url(#asbestos-fiber-hatch)"
                          stroke={az.exceeds2026Limit ? '#10b981' : '#6ee7b7'}
                          strokeWidth={isSel ? 2.4 : 1.6}
                          strokeDasharray="3 2"
                        />

                        {/* Correlation Vector from Building Part (<1997) to Fiber Deposition Zone */}
                        <line
                          x1={srcPx.x}
                          y1={srcPx.y}
                          x2={centroidPx.x}
                          y2={centroidPx.y}
                          stroke="#34d399"
                          strokeWidth={isSel ? 2.2 : 1.4}
                          strokeDasharray="4 2"
                        />
                        <circle
                          cx={centroidPx.x}
                          cy={centroidPx.y}
                          r={isSel ? 5 : 3.8}
                          fill="#10b981"
                          stroke="#ffffff"
                          strokeWidth="1.4"
                        />
                      </>
                    )}

                    {/* Direct Building-Part -> Fiber Deposition Callout Tag on Map */}
                    <g transform={`translate(${centroidPx.x}, ${centroidPx.y})`}>
                      <rect
                        x={-88}
                        y={-28}
                        width={176}
                        height={24}
                        rx={3}
                        fill={isSel ? '#064e3b' : '#022c22'}
                        fillOpacity={0.94}
                        stroke={isSel ? '#ffffff' : '#34d399'}
                        strokeWidth={isSel ? 1.6 : 1.1}
                      />
                      <text
                        x={0}
                        y={-17}
                        textAnchor="middle"
                        className="fill-emerald-300 text-[11px] font-mono font-bold"
                      >
                        ASBEST {az.sourceCode} (&lt;1997 · H={az.releaseHeightMeters}m): {az.probabilityPct}% Risiko
                      </text>
                      <text
                        x={0}
                        y={-8}
                        textAnchor="middle"
                        className="fill-slate-100 text-[11px] font-mono"
                      >
                        {az.buildingParts[0].slice(0, 26)} →{' '}
                        {az.estimatedDepositionFibreM2.toLocaleString('da-DK')} f/m²
                      </text>
                    </g>
                  </g>
                );
              })}

            {/* 24-HOUR ACCUMULATED DUST & ASBESTOS PARTICLE HEATMAP (PUFF SIMULATION) */}
            {show24hParticleAccumulationHeatmap && (
              <g className="pointer-events-none">
                {puff24h.mergedEnvelopePolygons.map((poly) => (
                  <polygon
                    key={`svg-24h-acc-poly-${poly.id}`}
                    points={polygonToSvgPoints(poly.polygon)}
                    fill={
                      poly.level === 'red'
                        ? 'rgba(225, 29, 72, 0.34)'
                        : 'rgba(249, 115, 22, 0.24)'
                    }
                    stroke={poly.level === 'red' ? '#fb7185' : '#fb923c'}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                  />
                ))}
                {puff24h.receptorSummaries.map((rs) => {
                  const pt = projectLatLng(rs.position);
                  const rad = Math.max(
                    16,
                    Math.min(
                      42,
                      Math.round((rs.totalDepositedHeavyMetalsAndPcbUgM2 / 180) * 24 * scaleFactor)
                    )
                  );
                  return (
                    <g key={`svg-24h-acc-rec-${rs.receptorId}`} transform={`translate(${pt.x}, ${pt.y})`}>
                      <circle
                        cx={0}
                        cy={0}
                        r={rad}
                        fill="rgba(225, 29, 72, 0.28)"
                        stroke="#f43f5e"
                        strokeWidth={2}
                      />
                      <g transform="translate(0, -24)">
                        <rect
                          x={-84}
                          y={-13}
                          width={168}
                          height={24}
                          rx={3}
                          fill="#1f0710"
                          fillOpacity={0.95}
                          stroke="#fb7185"
                          strokeWidth={1.2}
                        />
                        <text
                          x={0}
                          y={-2}
                          textAnchor="middle"
                          className="fill-rose-200 text-[11px] font-mono font-bold"
                        >
                          {rs.receptorCode}: {rs.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)} µg/m²
                        </text>
                        <text
                          x={0}
                          y={7}
                          textAnchor="middle"
                          className="fill-amber-200 text-[11px] font-mono"
                        >
                          Asbest (24t): {Math.round(rs.totalDepositedAsbestosFibersM2).toLocaleString('da-DK')} fibre/m²
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            {/* NEW HEATMAP LAYER: 'dust_deposition' (24-HOUR & HOURLY DUST-DEPOSITION IN µg/m²) */}
            {activeHeatmapLayerMode === 'dust_deposition' &&
              (visibleDispersionSubstances.heavyMetals || visibleDispersionSubstances.pcb) && (
              <g className="pointer-events-none">
                {dustDepositionHeatmapData.sourceLobes.map((lobe) => {
                  const centroidPx = projectLatLng(lobe.centroid);
                  return (
                    <g key={`svg-dust-dep-lobe-${lobe.sourceId}`}>
                      {/* Outer Dust-Deposition Envelope (>= 75 µg/m²) */}
                      <polygon
                        points={polygonToSvgPoints(lobe.outerPolygon)}
                        fill="rgba(250, 204, 21, 0.14)"
                        stroke="#fde047"
                        strokeWidth={1.3}
                        strokeDasharray="6 4"
                      />
                      {/* Mid Dust-Deposition Envelope (>= 150 µg/m²) */}
                      <polygon
                        points={polygonToSvgPoints(lobe.midPolygon)}
                        fill="rgba(249, 115, 22, 0.24)"
                        stroke="#fb923c"
                        strokeWidth={1.8}
                      />
                      {/* Core High-Density Dust-Deposition Zone (>= 250 µg/m²) */}
                      <polygon
                        points={polygonToSvgPoints(lobe.corePolygon)}
                        fill="rgba(225, 29, 72, 0.34)"
                        stroke="#f43f5e"
                        strokeWidth={2.2}
                      />
                      <g transform={`translate(${centroidPx.x}, ${centroidPx.y})`}>
                        <rect
                          x={-84}
                          y={-11}
                          width={168}
                          height={18}
                          rx={3}
                          fill="#451a03"
                          fillOpacity={0.94}
                          stroke="#fbbf24"
                          strokeWidth={1.2}
                        />
                        <text
                          x={0}
                          y={1}
                          textAnchor="middle"
                          className="fill-amber-200 text-[11px] font-mono font-bold"
                        >
                          {lobe.sourceCode} Støv-Deponeringsfane (µg/m²)
                        </text>
                      </g>
                    </g>
                  );
                })}

                {dustDepositionHeatmapData.receptorNodes.map((rNode) => {
                  const pt = projectLatLng(rNode.position);
                  const radiusPx = Math.max(
                    14,
                    Math.min(38, Math.round((rNode.total24hUgM2 / 220) * 26 * scaleFactor))
                  );
                  const strokeHex =
                    rNode.severity === 'danger'
                      ? '#f43f5e'
                      : rNode.severity === 'elevated'
                      ? '#fbbf24'
                      : '#38bdf8';
                  const fillRgba =
                    rNode.severity === 'danger'
                      ? 'rgba(244, 63, 94, 0.28)'
                      : rNode.severity === 'elevated'
                      ? 'rgba(251, 191, 36, 0.24)'
                      : 'rgba(56, 189, 248, 0.18)';
                  return (
                    <g key={`svg-dust-rec-${rNode.receptorId}`} transform={`translate(${pt.x}, ${pt.y})`}>
                      <circle
                        cx={0}
                        cy={0}
                        r={radiusPx}
                        fill={fillRgba}
                        stroke={strokeHex}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                      <g transform="translate(0, -22)">
                        <rect
                          x={-72}
                          y={-12}
                          width={144}
                          height={22}
                          rx={3}
                          fill="#090d16"
                          fillOpacity={0.95}
                          stroke={strokeHex}
                          strokeWidth={1.3}
                        />
                        <text
                          x={0}
                          y={-2}
                          textAnchor="middle"
                          className="fill-amber-300 text-[11px] font-mono font-extrabold"
                        >
                          {rNode.receptorCode}: {rNode.total24hUgM2.toFixed(1)} µg/m² (24t)
                        </text>
                        <text
                          x={0}
                          y={7}
                          textAnchor="middle"
                          className="fill-slate-200 text-[11px] font-mono"
                        >
                          Nu: +{rNode.hourlyDustUgM2.toFixed(1)} µg/m²/t
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            {/* NEW HEATMAP LAYER: 'noise_contour' (WIND-REFRACTED ACOUSTIC ISO-dB CONTOURS IN dB(A)) */}
            {activeHeatmapLayerMode === 'noise_contour' && (
              <g className="pointer-events-none">
                {noiseContourHeatmapData.sourceContours.map((sc) => {
                  const pt55 = projectLatLng(sc.label55Pt);
                  const pt70 = projectLatLng(sc.label70Pt);
                  return (
                    <g key={`svg-noise-contour-${sc.sourceId}`}>
                      {/* 45 dB(A) Outer Acoustic Contour */}
                      <polygon
                        points={polygonToSvgPoints(sc.ring45dB)}
                        fill="rgba(56, 189, 248, 0.08)"
                        stroke="#38bdf8"
                        strokeWidth={1.2}
                        strokeDasharray="6 4"
                      />
                      {/* 55 dB(A) Residential Daytime Noise Limit Contour (MST Vejl. 5/1984) */}
                      <polygon
                        points={polygonToSvgPoints(sc.ring55dB)}
                        fill="rgba(250, 204, 21, 0.14)"
                        stroke="#fde047"
                        strokeWidth={1.8}
                        strokeDasharray="5 3"
                      />
                      {/* 60 dB(A) Elevated Construction Noise Contour */}
                      <polygon
                        points={polygonToSvgPoints(sc.ring60dB)}
                        fill="rgba(249, 115, 22, 0.20)"
                        stroke="#fb923c"
                        strokeWidth={2.0}
                      />
                      {/* 70 dB(A) Acute Construction Noise Limit Contour */}
                      <polygon
                        points={polygonToSvgPoints(sc.ring70dB)}
                        fill="rgba(236, 72, 153, 0.28)"
                        stroke="#f43f5e"
                        strokeWidth={2.4}
                      />

                      <g transform={`translate(${pt55.x}, ${pt55.y})`}>
                        <rect
                          x={-58}
                          y={-9}
                          width={116}
                          height={15}
                          rx={3}
                          fill="#422006"
                          fillOpacity={0.94}
                          stroke="#fde047"
                          strokeWidth={1.1}
                        />
                        <text
                          x={0}
                          y={1}
                          textAnchor="middle"
                          className="fill-yellow-200 text-[11px] font-mono font-bold"
                        >
                          {sc.sourceCode}: 55 dB(A) Kontur
                        </text>
                      </g>

                      <g transform={`translate(${pt70.x}, ${pt70.y})`}>
                        <rect
                          x={-56}
                          y={-9}
                          width={112}
                          height={15}
                          rx={3}
                          fill="#500724"
                          fillOpacity={0.95}
                          stroke="#f43f5e"
                          strokeWidth={1.2}
                        />
                        <text
                          x={0}
                          y={1}
                          textAnchor="middle"
                          className="fill-rose-200 text-[11px] font-mono font-extrabold"
                        >
                          {sc.sourceCode}: 70 dB(A) Kerne
                        </text>
                      </g>
                    </g>
                  );
                })}

                {noiseContourHeatmapData.receptorNoiseNodes.map((nNode) => {
                  const pt = projectLatLng(nNode.position);
                  const strokeCol = nNode.exceeds55dB ? '#e879f9' : '#38bdf8';
                  return (
                    <g key={`svg-noise-rec-${nNode.receptorId}`} transform={`translate(${pt.x}, ${pt.y + 20})`}>
                      <rect
                        x={-76}
                        y={-10}
                        width={152}
                        height={22}
                        rx={3}
                        fill="#1e1b4b"
                        fillOpacity={0.95}
                        stroke={strokeCol}
                        strokeWidth={1.3}
                      />
                      <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        className="fill-fuchsia-200 text-[11px] font-mono font-extrabold"
                      >
                        {nNode.receptorCode}: {nNode.correctedLaeqDb.toFixed(1)} dB(A) (L_max {nNode.impulsePeakLafmaxDb.toFixed(0)})
                      </text>
                      <text
                        x={0}
                        y={9}
                        textAnchor="middle"
                        className="fill-cyan-200 text-[11px] font-mono"
                      >
                        Refraktion ΔL: {nNode.totalRefrDb >= 0 ? '+' : ''}
                        {nNode.totalRefrDb.toFixed(1)} dB
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* REAL-TIME BORNITZ (DIN 4150-3) PEAK VIBRATION INTENSITY HEATMAP OVERLAY */}
            {showVibrationHeatmap && (
              <g data-testid="dispersion-map-vibration-heatmap" className="pointer-events-none">
                {vibrationHeatmapData.gridCells.map((cell) => {
                  const nwPx = projectLatLng(cell.nw);
                  const sePx = projectLatLng(cell.se);
                  const w = Math.max(4, Math.abs(sePx.x - nwPx.x));
                  const h = Math.max(4, Math.abs(sePx.y - nwPx.y));
                  return (
                    <rect
                      key={cell.id}
                      x={Math.min(nwPx.x, sePx.x)}
                      y={Math.min(nwPx.y, sePx.y)}
                      width={w}
                      height={h}
                      fill={cell.fill}
                      fillOpacity={cell.opacity}
                      stroke={cell.ppv >= 10 ? '#fecdd3' : 'none'}
                      strokeOpacity={0.28}
                      strokeWidth={0.6}
                    />
                  );
                })}

                {vibrationHeatmapData.sourceRings.map((sr) => {
                  const sPx = projectLatLng(sr.position);
                  return (
                    <g key={`vib-src-rings-${sr.sourceId}`}>
                      {sr.ring5MmS.length > 0 && (
                        <polygon
                          points={polygonToSvgPoints(sr.ring5MmS)}
                          fill="none"
                          stroke="#facc15"
                          strokeWidth={1.6}
                          strokeDasharray="5 3"
                        />
                      )}
                      {sr.ring20MmS.length > 0 && (
                        <polygon
                          points={polygonToSvgPoints(sr.ring20MmS)}
                          fill="rgba(225, 29, 72, 0.14)"
                          stroke="#fb7185"
                          strokeWidth={2.0}
                        />
                      )}
                      <g transform={`translate(${sPx.x}, ${sPx.y - 18})`}>
                        <rect
                          x={-54}
                          y={-9}
                          width={108}
                          height={16}
                          rx={3}
                          fill="#0f172a"
                          fillOpacity={0.9}
                          stroke={sr.peakSourcePpv >= 20 ? '#fb7185' : '#facc15'}
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={2}
                          textAnchor="middle"
                          className="fill-amber-200 text-[10px] font-mono font-bold tabular-nums"
                        >
                          VIB {sr.sourceCode}: {sr.peakSourcePpv.toFixed(1)} mm/s
                        </text>
                      </g>
                    </g>
                  );
                })}

                {vibrationHeatmapData.buildingBreaches.map((bb) => {
                  const bPx = projectLatLng(bb.center);
                  return (
                    <g key={`vib-breach-${bb.buildingId}`} transform={`translate(${bPx.x}, ${bPx.y})`}>
                      <circle
                        cx={0}
                        cy={0}
                        r={12}
                        fill="rgba(225, 29, 72, 0.24)"
                        stroke="#f43f5e"
                        strokeWidth={1.8}
                      />
                      <text
                        x={0}
                        y={-15}
                        textAnchor="middle"
                        className="fill-rose-200 text-[10px] font-mono font-bold tabular-nums"
                      >
                        {bb.code}: {bb.ppvMmPerSec.toFixed(1)} mm/s
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* WIND > 10 m/s CSS ANIMATED DUST PLUME SPREAD SEQUENCE FROM SOURCE NODES */}
            {windOver10MsPlumeData.isActive && (
              <g data-testid="wind-over-10ms-dust-plume-sequence" className="pointer-events-none">
                {windOver10MsPlumeData.targetSources.map((item) => {
                  const srcPx = projectLatLng(item.source.position);
                  const tipPx = projectLatLng(item.tipPoint);
                  const dxPx = tipPx.x - srcPx.x;
                  const dyPx = tipPx.y - srcPx.y;
                  const plumeLenPx = Math.max(90, Math.hypot(dxPx, dyPx));
                  const rotDeg = (Math.atan2(dyPx, dxPx) * 180) / Math.PI;
                  const halfSpreadPx = Math.max(24, plumeLenPx * 0.26);
                  const waveStyle = {
                    '--dust-plume-dur': `${item.plumeDurationSec}s`,
                  } as React.CSSProperties;
                  const streakStyle = {
                    '--dust-streak-dur': `${item.streakDurationSec}s`,
                  } as React.CSSProperties;
                  const conePts = `0,0 ${plumeLenPx.toFixed(1)},${(-halfSpreadPx).toFixed(1)} ${(plumeLenPx * 1.07).toFixed(1)},0 ${plumeLenPx.toFixed(1)},${halfSpreadPx.toFixed(1)}`;
                  const streakOffsets = [-0.68, -0.34, 0, 0.34, 0.68];

                  return (
                    <g
                      key={`wind-plume-seq-${item.source.id}`}
                      transform={`translate(${srcPx.x}, ${srcPx.y}) rotate(${rotDeg.toFixed(2)})`}
                    >
                      <polygon
                        points={conePts}
                        fill={item.isSelected ? 'rgba(245, 158, 11, 0.34)' : 'rgba(251, 146, 60, 0.22)'}
                        stroke={item.isSelected ? '#fbbf24' : '#fdba74'}
                        strokeWidth={item.isSelected ? 1.8 : 1.2}
                        className="map-dust-plume-wave"
                        style={waveStyle}
                      />
                      <polygon
                        points={conePts}
                        fill={item.isSelected ? 'rgba(239, 68, 68, 0.26)' : 'rgba(249, 115, 22, 0.18)'}
                        stroke="#fb7185"
                        strokeWidth={1.3}
                        className="map-dust-plume-wave map-dust-plume-wave--2"
                        style={waveStyle}
                      />
                      <polygon
                        points={conePts}
                        fill="rgba(250, 204, 21, 0.2)"
                        stroke="#fde047"
                        strokeWidth={1.1}
                        className="map-dust-plume-wave map-dust-plume-wave--3"
                        style={waveStyle}
                      />

                      {streakOffsets.map((mult, idx) => (
                        <line
                          key={`plume-streak-${item.source.id}-${idx}`}
                          x1={4}
                          y1={0}
                          x2={plumeLenPx * (1.02 - Math.abs(mult) * 0.12)}
                          y2={halfSpreadPx * mult}
                          stroke={item.isSelected ? '#fde047' : '#fdba74'}
                          strokeWidth={idx === 2 ? 2.0 : 1.3}
                          strokeDasharray="10 8"
                          className="map-dust-plume-streak"
                          style={streakStyle}
                        />
                      ))}
                    </g>
                  );
                })}
              </g>
            )}

            {/* HYDROLOGISK UDVASKNINGS-RISIKO TIL GRUNDVAND (AKKUMULERET NEDBØR & JORDMÆTNINGSGRAD) */}
            {showGroundwaterLeachingWarning &&
              groundwaterLeachingData.zones.map((lz) => {
                const srcPx = projectLatLng(lz.sourcePosition);
                const frontPx = projectLatLng(lz.plumeFrontPoint);
                const isSel = selectedSourceId === lz.sourceId;
                const isCrit = lz.riskSeverity === 'critical';

                return (
                  <g
                    key={`svg-groundwater-leaching-${lz.sourceId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSource(lz.sourceId);
                    }}
                    className="cursor-pointer"
                  >
                    {/* Subsurface Groundwater Migration Plume Lobe (215° SV toward Sand-Lens & OSD Aquifer) */}
                    <polygon
                      points={polygonToSvgPoints(lz.aquiferPlumePolygon)}
                      fill="url(#groundwater-leaching-hatch)"
                      stroke={isCrit ? '#fbbf24' : '#38bdf8'}
                      strokeWidth={isSel ? 2.4 : 1.7}
                      strokeDasharray="6 3"
                    />

                    {/* Contaminated Soil Excavation Leaching Core Zone */}
                    <polygon
                      points={polygonToSvgPoints(lz.excavationCorePolygon)}
                      fill={
                        isCrit
                          ? 'rgba(220, 38, 38, 0.34)'
                          : 'rgba(245, 158, 11, 0.28)'
                      }
                      stroke={isCrit ? '#f87171' : '#fbbf24'}
                      strokeWidth={isSel ? 2.8 : 2.1}
                    />

                    {/* Pulsing Hydrological Infiltration Ring at Excavation Center */}
                    <circle
                      cx={srcPx.x}
                      cy={srcPx.y}
                      r={isCrit ? 22 : 17}
                      fill="none"
                      stroke={isCrit ? '#fbbf24' : '#38bdf8'}
                      strokeWidth="1.8"
                      strokeDasharray="3 3"
                    >
                      <animate
                        attributeName="r"
                        values={isCrit ? '14;28;14' : '12;23;12'}
                        dur="2.6s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.95;0.2;0.95"
                        dur="2.6s"
                        repeatCount="indefinite"
                      />
                    </circle>

                    {/* Hydraulic Gradient Flow Vector (215° SV) */}
                    <line
                      x1={srcPx.x}
                      y1={srcPx.y}
                      x2={frontPx.x}
                      y2={frontPx.y}
                      stroke="#fde047"
                      strokeWidth={isSel ? 2.5 : 1.8}
                      strokeDasharray="5 3"
                    />
                    <circle
                      cx={frontPx.x}
                      cy={frontPx.y}
                      r={isSel ? 5.5 : 4.2}
                      fill={isCrit ? '#ef4444' : '#0284c7'}
                      stroke="#fde047"
                      strokeWidth="1.6"
                    />

                    {/* High-Contrast Visual Warning Badge on Map */}
                    <g transform={`translate(${frontPx.x}, ${frontPx.y + 18})`}>
                      <rect
                        x={-106}
                        y={-13}
                        width={212}
                        height={26}
                        rx={3.5}
                        fill={isCrit ? '#450a0a' : '#082f49'}
                        fillOpacity={0.95}
                        stroke={isCrit ? '#fbbf24' : '#38bdf8'}
                        strokeWidth={isSel ? 1.9 : 1.3}
                      />
                      <text
                        x={0}
                        y={-2}
                        textAnchor="middle"
                        className={`text-[11px] font-mono font-bold ${
                          isCrit ? 'fill-amber-300' : 'fill-cyan-200'
                        }`}
                      >
                        UDVASKNING {lz.sourceCode}: MÆTNING {lz.zoneSaturationPct}% ·{' '}
                        {lz.effectiveAccumulatedPrecipMm} mm
                      </text>
                      <text
                        x={0}
                        y={9}
                        textAnchor="middle"
                        className="fill-white text-[11px] font-mono"
                      >
                        Pb: {lz.leadLeachateUgL} µg/L · PCB: {lz.pcbLeachateUgL} µg/L (
                        {lz.maxExceedanceRatio}× GV mod SV)
                      </text>
                    </g>
                  </g>
                );
              })}

            {/* 24-Hour Gaussian Puff Advection Vectors & Puff Centers */}
            {isPuffMode &&
              showHourlyPuffLobes &&
              puff24h.puffTrajectories
                .filter((t) => t.hourIndex % 2 === 0 || t.hourIndex === peakReceptor.peakHourIndex)
                .map((traj) => {
                  const startPx = projectLatLng(traj.origin);
                  const endPx = projectLatLng(traj.puffCenterEnd);
                  const isPeakHr = traj.hourIndex === peakReceptor.peakHourIndex;
                  return (
                    <g
                      key={`puff-traj-${traj.sourceId}-${traj.hourIndex}`}
                      className="pointer-events-none"
                    >
                      <line
                        x1={startPx.x}
                        y1={startPx.y}
                        x2={endPx.x}
                        y2={endPx.y}
                        stroke={isPeakHr ? '#fbbf24' : 'rgba(251, 191, 36, 0.32)'}
                        strokeWidth={isPeakHr ? 2 : 1}
                        strokeDasharray={isPeakHr ? undefined : '3 3'}
                      />
                      <circle
                        cx={endPx.x}
                        cy={endPx.y}
                        r={isPeakHr ? 4 : 2.5}
                        fill={isPeakHr ? '#fbbf24' : 'rgba(249, 115, 22, 0.55)'}
                      />
                    </g>
                  );
                })}

            {/* ANIMATED 24-HOUR PLUME-PATH ROUTE ('ANIMÉR FANEVEJ-RUTE': KILDE -> 24T VINDFANE-BANE -> MEST BERØRTE OMRÅDER) */}
            {isPuffMode && (() => {
              const srcPx = projectLatLng(plumeRouteAnimationData.originSource.position);
              const frontPx = projectLatLng(plumeRouteAnimationData.frontPoint);
              const fullLoopPts = polygonToSvgPoints(plumeRouteAnimationData.full24hTipLoop);
              const activeTrailPts = polygonToSvgPoints(plumeRouteAnimationData.activeTrailPoints);
              const dashOffset = -((plumeRouteProgress * 18) % 36);

              return (
                <g className="pointer-events-none">
                  {/* 24-Hour Full Plume-Tip Trajectory Loop (00:00 -> 23:00) */}
                  {plumeRouteAnimationData.full24hTipLoop.length > 1 && (
                    <polyline
                      points={fullLoopPts}
                      fill="none"
                      stroke="rgba(34, 211, 238, 0.42)"
                      strokeWidth="1.8"
                      strokeDasharray="5 4"
                    />
                  )}

                  {/* Progressive 24-Hour Plume-Path Trail up to Current Animated Hour */}
                  {plumeRouteAnimationData.activeTrailPoints.length > 1 && (
                    <polyline
                      points={activeTrailPts}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={isAnimatingPlumeRoute ? 3.2 : 2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={isAnimatingPlumeRoute ? '10 6' : undefined}
                      strokeDashoffset={isAnimatingPlumeRoute ? dashOffset : 0}
                    />
                  )}

                  {/* Direct Animated Plume Corridors Connecting Source -> Plume Path -> Top 3 Most Affected Receptor Areas */}
                  {plumeRouteAnimationData.receptorCorridors.map((corr) => {
                    const corridorPts = polygonToSvgPoints(corr.path);
                    const recPx = projectLatLng(corr.receptor.position);
                    const tracerPx = projectLatLng(corr.tracerPos);
                    const isPrimary = corr.rank === 1;

                    return (
                      <g key={`svg-corr-${corr.receptor.receptorId}`}>
                        {/* Outer Glow Line Connecting Source to Most Affected Area */}
                        <polyline
                          points={corridorPts}
                          fill="none"
                          stroke={isPrimary ? 'rgba(251, 191, 36, 0.35)' : 'rgba(34, 211, 238, 0.25)'}
                          strokeWidth={isPrimary ? 6 : 4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Animated Dashed Core Line */}
                        <polyline
                          points={corridorPts}
                          fill="none"
                          stroke={isPrimary ? '#fbbf24' : '#38bdf8'}
                          strokeWidth={isPrimary ? 2.4 : 1.7}
                          strokeDasharray="8 5"
                          strokeDashoffset={dashOffset}
                        />

                        {/* Target Ring on Most Affected Receptor Area */}
                        <circle
                          cx={recPx.x}
                          cy={recPx.y}
                          r={isPrimary ? 11 : 8}
                          fill="none"
                          stroke={isPrimary ? '#fbbf24' : '#22d3ee'}
                          strokeWidth="1.6"
                          strokeDasharray="3 2"
                        />

                        {/* Moving Tracer Packet Traveling from Source -> Affected Receptor */}
                        {(isAnimatingPlumeRoute || isPrimary) && (
                          <g transform={`translate(${tracerPx.x}, ${tracerPx.y})`}>
                            <circle
                              cx={0}
                              cy={0}
                              r={isPrimary ? 6.5 : 5}
                              fill={isPrimary ? 'rgba(251, 191, 36, 0.35)' : 'rgba(34, 211, 238, 0.35)'}
                            />
                            <circle
                              cx={0}
                              cy={0}
                              r={isPrimary ? 3.5 : 2.8}
                              fill={isPrimary ? '#fbbf24' : '#22d3ee'}
                              stroke="#ffffff"
                              strokeWidth="1.2"
                            />
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Hourly Waypoint Nodes along the 24-Hour Wind-Plume Path */}
                  {plumeRouteAnimationData.sourceTrajectories.map((traj) => {
                    const pt = projectLatLng(traj.puffCenterEnd);
                    const isVisited = traj.hourIndex <= plumeRouteAnimationData.curIdx;
                    const isCur = traj.hourIndex === plumeRouteAnimationData.curIdx;
                    if (!isAnimatingPlumeRoute && traj.hourIndex % 3 !== 0 && !isCur) {
                      return null;
                    }
                    return (
                      <g key={`route-hr-${traj.hourIndex}`} transform={`translate(${pt.x}, ${pt.y})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={isCur ? 5 : 2.8}
                          fill={isCur ? '#22d3ee' : isVisited ? '#38bdf8' : '#475569'}
                          stroke="#090d16"
                          strokeWidth="1.2"
                        />
                        {(traj.hourIndex % 4 === 0 || isCur) && (
                          <text
                            x={0}
                            y={-7}
                            textAnchor="middle"
                            className="fill-cyan-200 text-[11px] font-mono font-bold"
                          >
                            {traj.hourLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Active Plume Vector from Source to Current Animated Plume Front */}
                  <line
                    x1={srcPx.x}
                    y1={srcPx.y}
                    x2={frontPx.x}
                    y2={frontPx.y}
                    stroke="#22d3ee"
                    strokeWidth="2.4"
                  />

                  {/* Animated Plume-Front Head & Callout Badge */}
                  <g transform={`translate(${frontPx.x}, ${frontPx.y})`}>
                    <circle
                      cx={0}
                      cy={0}
                      r={isAnimatingPlumeRoute ? 14 : 9}
                      fill="rgba(34, 211, 238, 0.25)"
                      stroke="#22d3ee"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx={0}
                      cy={0}
                      r={5}
                      fill="#22d3ee"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />

                    {isAnimatingPlumeRoute && (
                      <g transform="translate(0, 18)">
                        <rect
                          x={-118}
                          y={0}
                          width={236}
                          height={28}
                          rx={4}
                          fill="#083344"
                          stroke="#22d3ee"
                          strokeWidth="1.8"
                        />
                        <text
                          x={0}
                          y={12}
                          textAnchor="middle"
                          className="fill-cyan-200 text-[11px] font-mono font-bold"
                        >
                          ➤ FANEVEJ-RUTE KL. {currentWeather.hourLabel} ({currentWeather.windSpeed10m} m/s → {plumeDirectionDeg}°)
                        </text>
                        <text
                          x={0}
                          y={23}
                          textAnchor="middle"
                          className="fill-amber-300 text-[11px] font-mono font-semibold"
                        >
                          {plumeRouteAnimationData.originSource.code} → #1{' '}
                          {plumeRouteAnimationData.topAffectedReceptors[0]?.receptorCode} &amp; #2{' '}
                          {plumeRouteAnimationData.topAffectedReceptors[1]?.receptorCode}
                        </text>
                      </g>
                    )}
                  </g>

                  {/* High-Density Receptor Intersection Rings During 24h Cumulative Plume-Path Sequence */}
                  {isAnimatingPlumeRoute &&
                    plumeRouteAnimationData.intersectingHighDensityReceptors.map((item) => {
                      const recPx = projectLatLng(item.receptor.center);
                      return (
                        <g
                          key={`svg-hd-intersect-${item.receptor.id}`}
                          transform={`translate(${recPx.x}, ${recPx.y})`}
                        >
                          <circle
                            cx={0}
                            cy={0}
                            r={24}
                            fill={
                              item.isCritical
                                ? 'rgba(244, 63, 94, 0.22)'
                                : 'rgba(245, 158, 11, 0.18)'
                            }
                            stroke={item.isCritical ? '#f43f5e' : '#f59e0b'}
                            strokeWidth="2.2"
                            strokeDasharray="4 3"
                          />
                          <rect
                            x={-68}
                            y={-38}
                            width={136}
                            height={16}
                            rx={3}
                            fill={item.isCritical ? '#881337' : '#78350f'}
                            stroke={item.isCritical ? '#fda4af' : '#fcd34d'}
                            strokeWidth="1.1"
                          />
                          <text
                            x={0}
                            y={-27}
                            textAnchor="middle"
                            className="fill-white text-[11px] font-mono font-bold tabular-nums"
                          >
                            ⚠ {item.receptor.code} ({item.residentCount} beb.)
                          </text>
                        </g>
                      );
                    })}
                </g>
              );
            })()}

            {/* 6-HOUR DUST MOVEMENT FORECAST 2D ANIMATION LAYER (+0t TO +6t BASED ON WIND FORECAST) */}
            {show6hDustForecast && (() => {
              const srcPx = projectLatLng(sixHourDustForecastData.originSource.position);
              const interpCentroidPx = projectLatLng(
                sixHourDustForecastData.interpolatedCentroid
              );
              const interpTipPx = projectLatLng(
                sixHourDustForecastData.interpolatedTipPoint
              );
              const centroidPathSvg = polygonToSvgPoints(
                sixHourDustForecastData.centroidPathLine
              );
              const tipPathSvg = polygonToSvgPoints(
                sixHourDustForecastData.tipTrajectoryLine
              );
              const animatedDashOffset = -((puffWavePhase * 36) % 36);

              // Smooth projected 6-hour trajectory SVG path (origin -> +0t..+6t centroids)
              // Driven by CSS @keyframes plume6hSvgFlow so direction & flow animate even when paused
              const trajPts = [
                srcPx,
                ...sixHourDustForecastData.hourlySteps.map((st) =>
                  projectLatLng(st.plumeCentroid)
                ),
              ];
              let smooth6hPathD = `M ${trajPts[0].x.toFixed(1)} ${trajPts[0].y.toFixed(1)}`;
              for (let i = 1; i < trajPts.length; i++) {
                const prev = trajPts[i - 1];
                const curr = trajPts[i];
                const midX = ((prev.x + curr.x) / 2).toFixed(1);
                const midY = ((prev.y + curr.y) / 2).toFixed(1);
                if (i === 1) {
                  smooth6hPathD += ` L ${midX} ${midY}`;
                } else {
                  smooth6hPathD += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${midX} ${midY}`;
                }
              }
              const lastPt = trajPts[trajPts.length - 1];
              smooth6hPathD += ` L ${lastPt.x.toFixed(1)} ${lastPt.y.toFixed(1)}`;

              return (
                <g className="pointer-events-none" data-testid="map-6h-projected-plume-layer">
                  {/* 1. Ghost Hourly Plume Envelopes (+1t to +6t) showing how the dust corridor shifts */}
                  {sixHourDustForecastData.hourlySteps
                    .filter((st) => st.offsetHours > 0)
                    .map((st) => {
                      const isHoveredStep =
                        Math.round(sixHourDustForecastData.clampedT) === st.offsetHours;
                      return (
                        <polygon
                          key={`svg-fc6h-ghost-${st.offsetHours}`}
                          points={polygonToSvgPoints(st.outerPolygon)}
                          fill={
                            isHoveredStep
                              ? 'rgba(34, 211, 238, 0.12)'
                              : 'rgba(6, 182, 212, 0.035)'
                          }
                          stroke={
                            isHoveredStep
                              ? 'rgba(34, 211, 238, 0.75)'
                              : 'rgba(34, 211, 238, 0.28)'
                          }
                          strokeWidth={isHoveredStep ? 1.6 : 1.0}
                          strokeDasharray="5 4"
                        />
                      );
                    })}

                  {/* 2. Live Morphing Interpolated 6-Hour Forecast Outer Dust Cloud Envelope */}
                  <polygon
                    points={polygonToSvgPoints(
                      sixHourDustForecastData.interpolatedOuterPolygon
                    )}
                    fill="rgba(6, 182, 212, 0.19)"
                    stroke="#22d3ee"
                    strokeWidth="2.2"
                    strokeDasharray="8 4"
                    strokeDashoffset={animatedDashOffset}
                  />

                  {/* 3. Live Morphing Interpolated High-Concentration Core Plume (S >= 1.0) */}
                  <polygon
                    points={polygonToSvgPoints(
                      sixHourDustForecastData.interpolatedCorePolygon
                    )}
                    fill="rgba(244, 63, 94, 0.26)"
                    stroke="#fbbf24"
                    strokeWidth="2.0"
                  />

                  {/* 4. Advecting Dust Cloud Puff Rings Drifting Downwind Along Current Forecast Vector */}
                  {sixHourDustForecastData.driftingPuffRings.map((ring) => {
                    const ringPx = projectLatLng(ring.position);
                    const rxPx = Math.max(8, ring.radiusMeters * 1.45 * scaleFactor);
                    const ryPx = Math.max(6, rxPx * 0.68);
                    return (
                      <g
                        key={ring.id}
                        transform={`translate(${ringPx.x}, ${ringPx.y}) rotate(${sixHourDustForecastData.interpolatedPlumeDeg})`}
                      >
                        <ellipse
                          cx={0}
                          cy={0}
                          rx={rxPx}
                          ry={ryPx}
                          fill={`rgba(251, 191, 36, ${(ring.opacity * 0.22).toFixed(2)})`}
                          stroke={`rgba(34, 211, 238, ${ring.opacity.toFixed(2)})`}
                          strokeWidth="1.6"
                          strokeDasharray="4 3"
                        />
                      </g>
                    );
                  })}

                  {/* 5. 6-Hour Plume Centroid & Outer Tip Drift Trajectory Curves (+0t -> +6t) + CSS-Animated Projected Path */}
                  <polyline
                    points={tipPathSvg}
                    fill="none"
                    stroke="rgba(34, 211, 238, 0.45)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <polyline
                    points={centroidPathSvg}
                    fill="none"
                    stroke="rgba(253, 224, 71, 0.45)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={smooth6hPathD}
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.35)"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                    strokeDasharray="16 16"
                    className="map-6h-plume-glow"
                  />
                  <path
                    d={smooth6hPathD}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeDasharray="10 6"
                    className="map-6h-plume-flow-path"
                  />

                  {/* Directional Arrow Chevrons along Projected 6h Trajectory */}
                  {trajPts.slice(1).map((pt, idx) => {
                    const prev = trajPts[idx];
                    const angleDeg = (Math.atan2(pt.y - prev.y, pt.x - prev.x) * 180) / Math.PI;
                    const mx = (prev.x + pt.x) / 2;
                    const my = (prev.y + pt.y) / 2;
                    return (
                      <polygon
                        key={`svg-fc6h-arrow-${idx}`}
                        points="-4,-3.5 5,0 -4,3.5"
                        fill="#fde047"
                        stroke="#090d16"
                        strokeWidth="0.8"
                        transform={`translate(${mx.toFixed(1)}, ${my.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`}
                      />
                    );
                  })}

                  {/* 6. Active Forecast Wind Vector Line from Origin Source -> Interpolated Plume Tip */}
                  <line
                    x1={srcPx.x}
                    y1={srcPx.y}
                    x2={interpTipPx.x}
                    y2={interpTipPx.y}
                    stroke="#22d3ee"
                    strokeWidth="2.2"
                    strokeDasharray="6 4"
                    strokeDashoffset={animatedDashOffset}
                  />

                  {/* 7. Hourly Forecast Waypoint Nodes (+1t, +2t, +3t, +4t, +5t, +6t) */}
                  {sixHourDustForecastData.hourlySteps.map((st) => {
                    const pt = projectLatLng(st.plumeCentroid);
                    const isCurStep =
                      Math.round(sixHourDustForecastData.clampedT) === st.offsetHours;
                    return (
                      <g
                        key={`svg-fc6h-step-${st.offsetHours}`}
                        transform={`translate(${pt.x}, ${pt.y})`}
                      >
                        <circle
                          cx={0}
                          cy={0}
                          r={isCurStep ? 6.5 : 4.2}
                          fill={
                            st.maxPredictedS >= 1.0
                              ? '#f43f5e'
                              : st.maxPredictedS >= 0.5
                              ? '#fbbf24'
                              : '#22d3ee'
                          }
                          stroke="#ffffff"
                          strokeWidth={isCurStep ? 2 : 1.3}
                        />
                        <g transform="translate(0, -10)">
                          <rect
                            x={-36}
                            y={-13}
                            width={72}
                            height={14}
                            rx={3}
                            fill={isCurStep ? '#083344' : '#090d16'}
                            fillOpacity={0.92}
                            stroke={isCurStep ? '#22d3ee' : '#475569'}
                            strokeWidth={isCurStep ? 1.4 : 0.9}
                          />
                          <text
                            x={0}
                            y={-3}
                            textAnchor="middle"
                            className="fill-cyan-200 text-[11px] font-mono font-bold"
                          >
                            +{st.offsetHours}t ({st.hourLabel})
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* 8. Predicted Early-Warning Target Halos on Receptors Hit Within Next 6 Hours */}
                  {sixHourDustForecastData.receptorForecastWarnings
                    .filter((rw) => rw.firstHitOffsetHours !== null && rw.peakS >= 0.5)
                    .map((rw) => {
                      const recPx = projectLatLng(rw.center);
                      const isCurrentlyHit = rw.currentInterpolatedS >= 0.5;
                      return (
                        <g
                          key={`svg-fc6h-rec-warn-${rw.receptorId}`}
                          transform={`translate(${recPx.x}, ${recPx.y})`}
                        >
                          <circle
                            cx={0}
                            cy={0}
                            r={isCurrentlyHit ? 24 : 18}
                            fill={
                              isCurrentlyHit
                                ? 'rgba(34, 211, 238, 0.20)'
                                : 'rgba(251, 191, 36, 0.08)'
                            }
                            stroke={isCurrentlyHit ? '#22d3ee' : '#fbbf24'}
                            strokeWidth={isCurrentlyHit ? 2.2 : 1.4}
                            strokeDasharray="4 3"
                          />
                          <g transform="translate(0, 34)">
                            <rect
                              x={-78}
                              y={0}
                              width={156}
                              height={15}
                              rx={3}
                              fill="#083344"
                              fillOpacity={0.95}
                              stroke="#22d3ee"
                              strokeWidth="1.2"
                            />
                            <text
                              x={0}
                              y={10.5}
                              textAnchor="middle"
                              className="fill-cyan-200 text-[11px] font-mono font-bold"
                            >
                              RAMMES OM +{rw.firstHitOffsetHours}t (kl. {rw.firstHitHourLabel} · S={rw.peakS.toFixed(2)})
                            </text>
                          </g>
                        </g>
                      );
                    })}

                  {/* 9. Moving Dust Cloud Front Head & Live Forecast Callout Flag */}
                  <g transform={`translate(${interpCentroidPx.x}, ${interpCentroidPx.y})`}>
                    <circle
                      cx={0}
                      cy={0}
                      r={15}
                      fill="rgba(34, 211, 238, 0.25)"
                      stroke="#22d3ee"
                      strokeWidth="2"
                    />
                    <circle
                      cx={0}
                      cy={0}
                      r={5.5}
                      fill="#fde047"
                      stroke="#090d16"
                      strokeWidth="1.8"
                    />
                    <g transform="translate(0, -38)">
                      <rect
                        x={-124}
                        y={0}
                        width={248}
                        height={30}
                        rx={4}
                        fill="#083344"
                        fillOpacity={0.96}
                        stroke="#22d3ee"
                        strokeWidth="1.8"
                      />
                      <text
                        x={0}
                        y={12}
                        textAnchor="middle"
                        className="fill-cyan-200 text-[11px] font-mono font-extrabold"
                      >
                        STØV-PROGNOSE +{sixHourDustForecastData.clampedT.toFixed(1)}t (KL.{' '}
                        {sixHourDustForecastData.activeStep.hourLabel})
                      </text>
                      <text
                        x={0}
                        y={24}
                        textAnchor="middle"
                        className="fill-amber-300 text-[11px] font-mono font-bold"
                      >
                        Vind {sixHourDustForecastData.interpolatedWindSpeedMs} m/s → Fane{' '}
                        {sixHourDustForecastData.interpolatedPlumeDeg}° (
                        {sixHourDustForecastData.interpolatedPlumeCompass}) · S_max=
                        {sixHourDustForecastData.interpolatedMaxS.toFixed(2)}
                      </text>
                    </g>
                  </g>
                </g>
              );
            })()}

            {/* All 29 Georeferenced Building Polygons (Color-Coded by Category a-e) on 2D Tactical Map */}
            {memoizedSvgBaseGeometry.buildingsProjected.map(({ building: b, meta, cPx, points }) => {
              const isSelectedBldg = selectedPopupBuildingId === b.id;
              return (
                <g
                  key={`svg-bldg-poly-${b.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPopupBuildingId(b.id);
                    if (meta.actsAsSource) onSelectSource(getSourceIdForBuilding(b.id));
                    if (meta.actsAsReceptor) onSelectReceptor(getReceptorIdForBuilding(b.id));
                  }}
                  className="cursor-pointer"
                >
                  <polygon
                    points={points}
                    fill={meta.colorHex}
                    fillOpacity={b.category === 'e_demolished_unsecured' ? 0.35 : 0.48}
                    stroke={isSelectedBldg ? '#ffffff' : meta.colorHex}
                    strokeWidth={isSelectedBldg ? 2.6 : 1.6}
                    strokeDasharray={b.category === 'e_demolished_unsecured' ? '4 2' : undefined}
                  />
                  <text
                    x={cPx.x}
                    y={cPx.y + 3}
                    textAnchor="middle"
                    className="fill-white text-[11px] font-mono font-bold pointer-events-none"
                  >
                    {b.code}
                  </text>
                </g>
              );
            })}

            {/* Demolition Source Polygons & Markers (Bygning 1, 2, 3 & Blok 1 + Custom Sources) */}
            {visibleSources.map((src) => {
              const centerPx = projectLatLng(src.position);
              const isSelected = selectedSourceId === src.id;
              const plumeEnd = projectLatLng({
                lat:
                  src.position.lat +
                  (Math.cos((plumeDirectionDeg * Math.PI) / 180) * 140) / 111320,
                lng:
                  src.position.lng +
                  (Math.sin((plumeDirectionDeg * Math.PI) / 180) * 140) / 63180,
              });

              return (
                <g
                  key={src.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSource(src.id);
                    if (src.buildingUnitId) setSelectedPopupBuildingId(src.buildingUnitId);
                  }}
                  className="cursor-pointer"
                >
                  {src.active && !isPuffMode && (
                    <line
                      x1={centerPx.x}
                      y1={centerPx.y}
                      x2={plumeEnd.x}
                      y2={plumeEnd.y}
                      stroke="rgba(248, 113, 113, 0.7)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  )}

                  <polygon
                    points={polygonToSvgPoints(src.footprint)}
                    fill={src.active ? 'rgba(220, 38, 38, 0.65)' : 'rgba(100, 116, 139, 0.35)'}
                    stroke={isSelected ? '#ffffff' : '#fbbf24'}
                    strokeWidth={isSelected ? 2.8 : 1.8}
                  />

                  <circle
                    cx={centerPx.x}
                    cy={centerPx.y}
                    r={isSelected ? 7 : 5.5}
                    fill={src.active ? '#ef4444' : '#64748b'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />

                  <g transform={`translate(${centerPx.x}, ${centerPx.y - 14})`}>
                    <rect
                      x={-72}
                      y={-18}
                      width={144}
                      height={20}
                      rx={3}
                      fill={isSelected ? '#e11d48' : '#090d16'}
                      stroke={isSelected ? '#ffffff' : '#f43f5e'}
                      strokeWidth="1.2"
                    />
                    <text
                      x={0}
                      y={-5}
                      textAnchor="middle"
                      className="fill-white text-[11px] font-mono font-bold"
                    >
                      {src.code}: {src.name.replace(/^Bygning \d: |^Blok \d: /, '')}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Receptor Center Labels (with Automatic Real-Time High-Wind > 10 m/s Radar Rings & Callouts for Top Affected Receptors) */}
            {showReceptorLabels &&
              receptors.map((rec) => {
                const pt = projectLatLng(rec.center);
                const exp = exposureByReceptorId[rec.id];
                const isSelected = selectedReceptorId === rec.id;
                const sVal = exp?.sumQuotient ?? 0;
                const hwRank = highWindRankByReceptorId[rec.id];

                const badgeFill = hwRank
                  ? '#be123c'
                  : sVal >= 1.0
                  ? '#881337'
                  : sVal >= 0.5
                  ? '#78350f'
                  : '#0f172a';
                const badgeStroke = hwRank
                  ? '#fde047'
                  : sVal >= 1.0
                  ? '#fb7185'
                  : sVal >= 0.5
                  ? '#fbbf24'
                  : '#38bdf8';

                return (
                  <g
                    key={`label-${rec.id}`}
                    transform={`translate(${pt.x}, ${pt.y})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReceptor(rec.id);
                    }}
                    className="cursor-pointer"
                  >
                    {/* Automatic Pulsing Radar Rings when Wind Speed > 10 m/s and Receptor is Top Affected */}
                    {hwRank && (
                      <>
                        <circle
                          cx={0}
                          cy={0}
                          r={hwRank === 1 ? 26 : 20}
                          fill="rgba(225, 29, 72, 0.22)"
                          stroke="#fbbf24"
                          strokeWidth={hwRank === 1 ? 2.2 : 1.6}
                          strokeDasharray="4 2"
                        >
                          <animate
                            attributeName="r"
                            values={hwRank === 1 ? '14;28;14' : '12;22;12'}
                            dur="1.6s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0.95;0.25;0.95"
                            dur="1.6s"
                            repeatCount="indefinite"
                          />
                        </circle>
                        <circle
                          cx={0}
                          cy={0}
                          r={11}
                          fill="rgba(244, 63, 94, 0.38)"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <g transform="translate(0, -18)">
                          <rect
                            x={-78}
                            y={-14}
                            width={156}
                            height={16}
                            rx={3}
                            fill={hwRank === 1 ? '#fbbf24' : '#e11d48'}
                            stroke="#ffffff"
                            strokeWidth="1.3"
                          />
                          <text
                            x={0}
                            y={-3}
                            textAnchor="middle"
                            className={`text-[11px] font-mono font-extrabold ${
                              hwRank === 1 ? 'fill-slate-950' : 'fill-white'
                            }`}
                          >
                            ⚠ #{hwRank} MEST BERØRT (&gt;10 m/s)
                          </text>
                        </g>
                      </>
                    )}

                    <circle
                      cx={0}
                      cy={0}
                      r={hwRank ? 5.5 : 4}
                      fill={hwRank ? '#fbbf24' : '#38bdf8'}
                      stroke="#090d16"
                      strokeWidth="1.5"
                    />

                    <rect
                      x={-72}
                      y={8}
                      width={144}
                      height={showAutonomousMesh ? 31 : 21}
                      rx={3}
                      fill={badgeFill}
                      fillOpacity={0.95}
                      stroke={isSelected ? '#ffffff' : badgeStroke}
                      strokeWidth={hwRank || isSelected ? 2 : 1}
                    />
                    <text
                      x={0}
                      y={21}
                      textAnchor="middle"
                      className="fill-slate-100 text-[11px] font-mono font-bold tabular-nums"
                    >
                      {rec.code} · S={sVal.toFixed(2)}
                    </text>
                    {showAutonomousMesh && (() => {
                      const meshNode = autonomousMesh.nodesByReceptorId[rec.id];
                      if (!meshNode) return null;
                      return (
                        <text
                          x={0}
                          y={33}
                          textAnchor="middle"
                          className="fill-cyan-300 text-[11px] font-mono font-semibold tabular-nums"
                        >
                          ⬡ ZKP · NABO {meshNode.nabotest.corroboratingNeighborCount}/
                          {meshNode.nabotest.analyzedNearbyNodesCount}
                        </text>
                      );
                    })()}
                  </g>
                );
              })}

            {/* Discrete Street-Level Probe Dots in Puff Mode */}
            {isPuffMode &&
              puff24h.streetPointSummaries.map((probe) => {
                const isPeak = probe.receptorId === peakReceptor.receptorId;
                if (isPeak) return null; // Rendered prominently below
                const pt = projectLatLng(probe.position);
                return (
                  <g key={probe.receptorId} transform={`translate(${pt.x}, ${pt.y})`}>
                    <circle
                      cx={0}
                      cy={0}
                      r={3.5}
                      fill="#fbbf24"
                      stroke="#090d16"
                      strokeWidth="1.2"
                    />
                  </g>
                );
              })}

            {/* DEDICATED 24-HOUR PEAK DOSE RECEPTOR MARKER ON MAP */}
            {isPuffMode && peakReceptor && (() => {
              const peakPx = projectLatLng(peakReceptor.position);
              return (
                <g
                  transform={`translate(${peakPx.x}, ${peakPx.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectHourFromPeak) {
                      onSelectHourFromPeak(peakReceptor.peakHourIndex);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {/* Target Crosshair & Outer Halo */}
                  <circle
                    cx={0}
                    cy={0}
                    r={28}
                    fill="rgba(245, 158, 11, 0.18)"
                    stroke="#fbbf24"
                    strokeWidth="1.8"
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={15}
                    fill="rgba(239, 68, 68, 0.35)"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                  />
                  <line x1={-34} y1={0} x2={34} y2={0} stroke="#fbbf24" strokeWidth="1.2" />
                  <line x1={0} y1={-34} x2={0} y2={34} stroke="#fbbf24" strokeWidth="1.2" />
                  <circle
                    cx={0}
                    cy={0}
                    r={6}
                    fill="#fbbf24"
                    stroke="#090d16"
                    strokeWidth="2"
                  />

                  {/* High-Contrast Callout Flag on the Exact Peak Receptor Point */}
                  <g transform="translate(0, -56)">
                    <rect
                      x={-142}
                      y={0}
                      width={284}
                      height={44}
                      rx={4}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={0}
                      y={16}
                      textAnchor="middle"
                      className="fill-slate-950 text-[11px] font-mono font-bold"
                    >
                      ★ HØJESTE 24T DOSIS: {peakReceptor.address.split(',')[0]}
                    </text>
                    <text
                      x={0}
                      y={30}
                      textAnchor="middle"
                      className="fill-slate-950 text-[11px] font-mono font-bold"
                    >
                      Spidsbelastning kl. {peakReceptor.peakHourLabel} (S=
                      {peakReceptor.peakSumQuotient.toFixed(2)}) · ∑=
                      {peakReceptor.cumulativeSumDose.toFixed(1)} S·t
                    </text>
                    <text
                      x={0}
                      y={40}
                      textAnchor="middle"
                      className="fill-slate-900 text-[11px] font-mono font-semibold"
                    >
                      Deponering: {peakReceptor.totalDepositedHeavyMetalsAndPcbUgM2} µg/m² tungmetal ·{' '}
                      {peakReceptor.totalDepositedAsbestosFibersM2.toLocaleString('da-DK')} fibre/m²
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* Pending Observation Target Crosshair on Tactical GIS Canvas */}
            {pendingObservationPoint && (() => {
              const pt = projectLatLng(pendingObservationPoint);
              return (
                <g transform={`translate(${pt.x}, ${pt.y})`} className="pointer-events-none">
                  <circle
                    cx={0}
                    cy={0}
                    r={18}
                    fill="rgba(217, 70, 239, 0.22)"
                    stroke="#e879f9"
                    strokeWidth="1.8"
                    strokeDasharray="3 3"
                  />
                  <line x1={-24} y1={0} x2={24} y2={0} stroke="#f0abfc" strokeWidth="1.4" />
                  <line x1={0} y1={-24} x2={0} y2={24} stroke="#f0abfc" strokeWidth="1.4" />
                  <circle cx={0} cy={0} r={4.5} fill="#e879f9" stroke="#ffffff" strokeWidth="1.5" />
                  <g transform="translate(0, -28)">
                    <rect
                      x={-92}
                      y={-14}
                      width={184}
                      height={18}
                      rx={3}
                      fill="#a21caf"
                      stroke="#f5d0fe"
                      strokeWidth="1.2"
                    />
                    <text
                      x={0}
                      y={-2}
                      textAnchor="middle"
                      className="fill-white text-[11px] font-mono font-bold"
                    >
                      ⊕ NY OBSERVATION ({pendingObservationPoint.lat.toFixed(4)},{' '}
                      {pendingObservationPoint.lng.toFixed(4)})
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* 2D Taktisk Kort: Varmegraf over støjniveauer korreleret med vindretning pr. naboblok */}
            {showWindNoiseHeatmapLayer && (
              <WindDirectionalNoiseSvgLayer
                cells={windDirectionalNoiseCells}
                sources={sources}
                effectiveWindFromDeg={effectiveNoiseWindFromDeg}
                projectLatLng={projectLatLng}
                onSelectReceptor={onSelectReceptor}
              />
            )}

            {/* Registered Neighbor Complaints Heat-Mapped Block Density Layer on Tactical GIS Canvas */}
            {showComplaintDensityOverlay && (
              <g data-testid="svg-neighbor-complaint-density-layer">
                {complaintDensitySummary.items
                  .filter((item) => item.normalizedDensity >= 0.08)
                  .map((item) => {
                    const pt = projectLatLng(item.center);
                    const scaleAlpha = complaintDensityOpacityPct / 100;
                    const auraRadius =
                      (item.kind === 'demolition_sector' ? 42 : 30) +
                      item.normalizedDensity * 36;
                    const auraOpacity = Math.min(
                      0.45,
                      (0.08 + item.normalizedDensity * 0.28) * scaleAlpha
                    );
                    const polyOpacity = Math.min(
                      0.65,
                      (0.16 + item.normalizedDensity * 0.42) * scaleAlpha
                    );
                    return (
                      <g
                        key={`svg-complaint-density-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFocusComplaintDensityItem(item);
                        }}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={auraRadius}
                          fill={item.heatFillHex}
                          fillOpacity={auraOpacity}
                        />
                        <polygon
                          points={polygonToSvgPoints(item.polygon)}
                          fill={item.heatFillHex}
                          fillOpacity={polyOpacity}
                          stroke={item.heatStrokeHex}
                          strokeOpacity={Math.min(0.95, 0.5 + item.normalizedDensity * 0.45)}
                          strokeWidth={item.normalizedDensity >= 0.5 ? 2.2 : 1.3}
                        />
                      </g>
                    );
                  })}
                {complaintDensitySummary.topDisputedItems
                  .filter((item) => item.normalizedDensity >= 0.35)
                  .slice(0, 4)
                  .map((item, rankIdx) => {
                    const pt = projectLatLng(item.center);
                    const badgeText = `#${rankIdx + 1} ${item.code}: ${Math.round(
                      item.normalizedDensity * 100
                    )}% klagetæthed (${item.directComplaintCount} kl.)`;
                    const badgeW = Math.max(158, badgeText.length * 5.4);
                    return (
                      <g
                        key={`svg-complaint-hotspot-${item.id}`}
                        transform={`translate(${pt.x}, ${pt.y - 24})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFocusComplaintDensityItem(item);
                        }}
                        className="cursor-pointer"
                      >
                        <rect
                          x={-badgeW / 2}
                          y={-18}
                          width={badgeW}
                          height={17}
                          rx={3}
                          fill="#090d16"
                          fillOpacity={0.92}
                          stroke={item.heatStrokeHex}
                          strokeWidth={1.3}
                        />
                        <text
                          x={0}
                          y={-6.5}
                          textAnchor="middle"
                          className="fill-rose-100 text-[11px] font-mono font-bold"
                        >
                          {badgeText}
                        </text>
                      </g>
                    );
                  })}
              </g>
            )}

            {/* Registered Physical Observations / Algedonic Signals on Tactical GIS Canvas */}
            {observations.map((obs) => {
              const pt = projectLatLng(obs.position);
              const isSelected = selectedObservationId === obs.id;
              const inPlume = obs.plumeCorroboration.isInsideMathematicalPlume;
              return (
                <g
                  key={`svg-obs-${obs.id}`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectObservation(obs);
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={isSelected ? 14 : 10}
                    fill={inPlume ? 'rgba(217, 70, 239, 0.28)' : 'rgba(148, 163, 184, 0.2)'}
                    stroke={isSelected ? '#ffffff' : '#e879f9'}
                    strokeWidth={isSelected ? 2 : 1.4}
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={5}
                    fill={inPlume ? '#d946ef' : '#64748b'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <g transform="translate(0, 14)">
                    <rect
                      x={-84}
                      y={0}
                      width={168}
                      height={22}
                      rx={3}
                      fill={isSelected ? '#c026d3' : '#2e1065'}
                      stroke={isSelected ? '#ffffff' : '#e879f9'}
                      strokeWidth={isSelected ? 1.8 : 1.1}
                    />
                    <text
                      x={0}
                      y={10}
                      textAnchor="middle"
                      className="fill-fuchsia-100 text-[11px] font-mono font-bold"
                    >
                      {obs.code} · kl. {obs.observedHourLabel} ({obs.reporterRole.split(' ')[0]})
                    </text>
                    <text
                      x={0}
                      y={19}
                      textAnchor="middle"
                      className="fill-amber-300 text-[11px] font-mono font-semibold"
                    >
                      {inPlume
                        ? `✓ I SPREDNINGSFANE (S=${obs.plumeCorroboration.calculatedSumQuotient.toFixed(
                            2
                          )})`
                        : `RANDZONE (S=${obs.plumeCorroboration.calculatedSumQuotient.toFixed(2)})`}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        )}

        {/* WebGL High-Wind (> 10 m/s) Turbulent Dust Plume Animation Sequence */}
        <WebGl2DDustPlumeOverlay
          currentWeather={currentWeather}
          sources={visibleSources}
          selectedSourceId={selectedSourceId}
          zoom={zoom}
          panOffsetPx={panOffsetPx}
          visible={showWebGlDustPlume && !useGoogleMapsEngine}
        />

        {/* Animated Open-Meteo Wind Particle & Source Aerosol Streamline Layer */}
        <WindParticleFieldOverlay
          currentWeather={currentWeather}
          sources={sources}
          zoom={zoom}
          panOffsetPx={panOffsetPx}
          visible={showWindParticles}
        />

        {/* Smooth Atmospheric Cross-Fade Veil & Transition Pill when switching modes or time intervals */}
        {crossFadeProgress < 1 && (
          <div
            className="absolute inset-0 pointer-events-none z-10 flex items-end justify-center pb-20"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(34, 211, 238, ${(
                (1 - crossFadeProgress) *
                0.08
              ).toFixed(3)}), transparent 70%)`,
            }}
          >
            {transitionBadgeLabel && (
              <div
                className="px-3 py-1 rounded-full bg-slate-950/90 border border-cyan-400/60 text-cyan-200 font-mono text-[11px] font-semibold shadow-lg flex items-center gap-1.5"
                style={{
                  opacity: Math.sin(crossFadeProgress * Math.PI),
                  transform: `translateY(${((1 - crossFadeProgress) * 4).toFixed(1)}px)`,
                }}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>{transitionBadgeLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom-Left Risk Zone Color Legend / Heatmap-Signaturforklaring */}
        {!effectiveMapOnly && (
        <div
          data-map-window="map_legend_heatmap_key"
          onMouseDown={() =>
            mapWindowStates.map_legend_heatmap_key.isReleased &&
            handleFocusMapWindow('map_legend_heatmap_key')
          }
          style={
            mapWindowStates.map_legend_heatmap_key.isReleased
              ? {
                  left: `${mapWindowStates.map_legend_heatmap_key.x}px`,
                  top: `${mapWindowStates.map_legend_heatmap_key.y}px`,
                  zIndex: mapWindowStates.map_legend_heatmap_key.zIndex,
                }
              : undefined
          }
          className={`${
            mapWindowStates.map_legend_heatmap_key.isReleased
              ? 'fixed ring-2 ring-cyan-400'
              : 'absolute bottom-3 left-3 z-20'
          } bg-[#0B0E17]/95 border border-slate-800 rounded-md px-3 py-2.5 shadow-lg max-w-2xl space-y-1.5 pointer-events-auto`}
        >
          <MapOverlayWindowControlStrip
            windowId="map_legend_heatmap_key"
            title="Heatmap-Signaturforklaring & Risikozone-Skala"
            badgeText={`GPS: ${cursorLatLng.lat.toFixed(4)}°N, ${cursorLatLng.lng.toFixed(4)}°E`}
            accentColorClass="text-cyan-300"
            state={mapWindowStates.map_legend_heatmap_key}
            onToggleMinimize={handleToggleMapWindowMinimize}
            onToggleRelease={handleToggleMapWindowRelease}
            onMove={handleMoveMapWindow}
            onFocus={handleFocusMapWindow}
          />
          {!mapWindowStates.map_legend_heatmap_key.isMinimized && (
            <>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between gap-4">
                <span>
                  {showHeatmapComparison && heatmapComparison
                    ? isDifferenceHeatmapMode
                      ? `DIFFERENS-HEATMAP Δ = T_B − T_A (kl. ${heatmapComparison.hourA.hourLabel} → kl. ${heatmapComparison.hourB.hourLabel})`
                      : `BEGGE HEATMAPS OVERLAY (T_A kl. ${heatmapComparison.hourA.hourLabel} ↔ T_B kl. ${heatmapComparison.hourB.hourLabel})`
                    : isPuffMode
                    ? 'AKKUMULERET 24-TIMERS GAUSSISK PUFF-HISTORIK & ANIMERET OPEN-METEO VINDFELT'
                    : 'STATIONÆR PLUME-SPREDNINGSMODEL & ANIMERET OPEN-METEO VINDFELT'}
                </span>
                <span className="text-cyan-400">
                  GPS: {cursorLatLng.lat.toFixed(4)}°N, {cursorLatLng.lng.toFixed(4)}°E
                </span>
              </div>

              {showHeatmapComparison && heatmapComparison && (
                isDifferenceHeatmapMode ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono pb-1 border-b border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-red-600/85 border border-red-300 shrink-0" />
                      <span className="text-rose-200 font-semibold truncate">
                        +Δ Kraftig Stigning (≥+0,40)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-orange-500/80 border border-orange-300 shrink-0" />
                      <span className="text-orange-200 font-semibold truncate">
                        +Δ Moderat Stigning (+0,05..+0,39)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-slate-600/40 border border-slate-400 shrink-0" />
                      <span className="text-slate-300 font-semibold truncate">
                        0 Uændret (±0,04)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-cyan-500/80 border border-cyan-300 shrink-0" />
                      <span className="text-cyan-200 font-semibold truncate">
                        −Δ Moderat Fald (−0,05..−0,39)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-sky-600/85 border border-sky-300 shrink-0" />
                      <span className="text-sky-200 font-semibold truncate">
                        −Δ Kraftigt Fald (≤−0,40)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pb-1 border-b border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-cyan-500/50 border border-cyan-300 border-dashed shrink-0" />
                      <span className="text-cyan-200 font-semibold truncate">
                        T_A kl. {heatmapComparison.hourA.hourLabel} (Før-fane)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-rose-500/70 border border-rose-400 shrink-0" />
                      <span className="text-rose-200 font-semibold truncate">
                        T_B kl. {heatmapComparison.hourB.hourLabel} (Nyt areal)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-fuchsia-500/60 border border-fuchsia-300 shrink-0" />
                      <span className="text-fuchsia-200 font-semibold truncate">
                        Overlap (T_A ∩ T_B)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-1 rounded-full bg-yellow-300 shrink-0" />
                      <span className="text-amber-300 font-semibold truncate">
                        ➤ Forskydningsvektor
                      </span>
                    </div>
                  </div>
                )
              )}

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-rose-500/80 border border-rose-400 shrink-0" />
                  <span className="text-slate-200 font-medium truncate">
                    Rød: S ≥ 1,0 (Ulovlig)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-orange-500/80 border border-orange-400 shrink-0" />
                  <span className="text-slate-200 font-medium truncate">
                    Orange: 0,5 ≤ S &lt; 1,0
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-yellow-400/80 border border-yellow-300 shrink-0" />
                  <span className="text-slate-200 font-medium truncate">
                    Gul: 0,1 ≤ S &lt; 0,5 (Støv)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500/40 border border-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-semibold truncate inline-flex items-center gap-1">
                    <Biohazard className="w-3 h-3 shrink-0" />
                    <span>&lt;1997 Asbest-Lag</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-sky-500/40 border border-amber-400 shrink-0" />
                  <span className="text-amber-300 font-semibold truncate inline-flex items-center gap-1">
                    <Droplets className="w-3 h-3 shrink-0" />
                    <span>Jord-Udvaskning ({groundwaterLeachingData.globalSoilSaturationPct}%)</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-cyan-400 shrink-0" />
                  <span className="text-cyan-300 font-medium truncate">
                    Vindfelt ({currentWeather.windSpeed10m} m/s → {plumeDirectionDeg}°)
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
        )}

        {/* Forensic 'Snapshot Map' Confirmation Toast Overlay */}
        {mapSnapshotSavedJustNow && lastMapSnapshotSummary && (
          <div className="absolute bottom-14 right-3 z-30 max-w-md rounded-md bg-[var(--surface-overlay)] border border-emerald-400 border-l-4 border-l-emerald-400 p-2.5 shadow-lg font-mono text-[11px] text-slate-100 space-y-1 pointer-events-auto">
            <div className="flex items-center justify-between gap-2 text-emerald-300 font-extrabold">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>SNAPSHOT MAP REGISTRERET SOM BEVIS (SHA-256)</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-[11px]">
                Z:{lastMapSnapshotSummary.zoom.toFixed(1)}
              </span>
            </div>
            <div className="text-[11px] text-amber-200">
              Bounds: {lastMapSnapshotSummary.boundsText}
            </div>
            <div className="text-[11px] text-cyan-200 truncate">
              Aktive lag: {lastMapSnapshotSummary.layersText}
            </div>
          </div>
        )}

        {/* Bottom-Right Zoom, Reset, Snapshot Map, High-Res PNG & Print-Friendly PDF Controls for 2D Map */}
        {!useGoogleMapsEngine && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-[#0B0E17]/95 border border-slate-800 rounded-md p-1 shadow-lg">
            <button
              type="button"
              onClick={handleSaveMapSnapshotToObservations}
              className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                mapSnapshotSavedJustNow
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
              }`}
              title="Snapshot Map: Gem aktuelt 2D kort-udsnit (zoom, bounds og aktive lag) som tidsstemplet retsmedicinsk observation i Algedonisk Log"
            >
              {mapSnapshotSavedJustNow ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Snapshot Gemt!</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  <span>Snapshot Map</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleExportHighResHeatmapPng}
              disabled={isExportingPng}
              className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
                pngExportedJustNow
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              }`}
              title="Eksportér aktuel visning af sprednings-heatmappet som høj-opløsnings PNG-billede (2400×1680 px) klar til den retsmedicinske PDF-rapport"
            >
              {pngExportedJustNow ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>PNG Gemt (2400px)!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG (2400px Heatmap)</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleExport2DViewportPrintPdf}
              className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors mr-1 ${
                pdfExportedJustNow
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-100 text-slate-950 hover:bg-white'
              }`}
              title="Udskriv print-venlig PDF med aktuelt 2D kort-viewport, vejrbetingelser og Top 3 receptor-sumkvotienter"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF (Viewport + Top 3 S)</span>
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(19.5, Number((z + 0.5).toFixed(1))))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors border-l border-slate-800"
              title="Zoom ind"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono text-slate-300">Z:{zoom.toFixed(1)}</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(14.0, Number((z - 0.5).toFixed(1))))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Zoom ud"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleFitToReceptors}
              className={`px-2 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1 transition-colors border-l border-slate-800 cursor-pointer ${
                fittedToReceptorsJustNow
                  ? 'bg-emerald-400 text-slate-950'
                  : 'text-cyan-300 hover:text-white hover:bg-slate-800'
              }`}
              title={`Fit to Receptors — Tilpas automatisk kortets udsnit til alle ${receptors.length} aktive receptorzoner`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fit to Receptors</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(17);
                setPanOffsetPx({ x: 0, y: 0 });
              }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors border-l border-slate-800"
              title="Centrér på Ringparken (55.4128, 11.3533)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Interactive 2D Tactical Map Popup for Selected Building Unit (29 Units: Categories a-e) */}
        {selectedPopupBuildingId && (() => {
          const b = buildings.find((item) => item.id === selectedPopupBuildingId);
          if (!b) return null;
          const meta = BUILDING_CATEGORY_METADATA[b.category];
          return (
            <div className="absolute bottom-14 left-3 z-30 w-80 bg-[var(--surface-overlay)] border border-[var(--border-subtle)] border-l-4 border-l-sky-400 rounded-md p-3 shadow-lg font-mono text-xs space-y-2 pointer-events-auto">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: meta.colorHex }}
                    />
                    <span className="font-bold text-white">
                      {b.code}: {b.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {b.address} · {b.department}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPopupBuildingId(null)}
                  className="text-slate-400 hover:text-white p-0.5"
                  title="Luk bygnings-popup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-[11px] text-slate-300 flex items-center justify-between border-t border-slate-800 pt-1.5">
                <span>
                  {b.dwellingsCount > 0 ? `${b.dwellingsCount} bol. · ` : ''}
                  {b.floors} etg. ({b.constructionYear})
                </span>
                <span>
                  H3D: <strong>{meta.buildingHeight3DMeters}m</strong> · H_udslip:{' '}
                  <strong>{meta.defaultReleaseHeightMeters}m</strong>
                </span>
              </div>

              {onChangeBuildingCategory && (
                <div className="space-y-1 pt-1 border-t border-slate-800">
                  <label className="block text-[11px] uppercase tracking-wider text-cyan-300 font-bold">
                    Skift Operationel Kategori (a–e):
                  </label>
                  <select
                    value={b.category}
                    onChange={(e) =>
                      onChangeBuildingCategory(
                        b.id,
                        e.target.value as BuildingOperationalCategory
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-cyan-400"
                  >
                    {(
                      Object.values(BUILDING_CATEGORY_METADATA) as Array<
                        (typeof BUILDING_CATEGORY_METADATA)[BuildingOperationalCategory]
                      >
                    ).map((cMeta) => (
                      <option key={cMeta.code} value={cMeta.code}>
                        {cMeta.labelDa} (Faktor {cMeta.sourceEmissionFactor.toFixed(2)}x)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })()}

        {/* Map-Overlaying Heat-Mapped Density Card for 'Registered Neighbor Complaints' */}
        {showComplaintDensityOverlay && (
          <div className="absolute bottom-14 right-3 z-20 pointer-events-auto max-w-[calc(100%-24px)]">
            <NeighborComplaintDensityOverlay
              summary={complaintDensitySummary}
              filterMode={complaintDensityFilterMode}
              onChangeFilterMode={setComplaintDensityFilterMode}
              opacityPct={complaintDensityOpacityPct}
              onChangeOpacityPct={setComplaintDensityOpacityPct}
              onFocusItem={handleFocusComplaintDensityItem}
              onCloseOverlay={() => setShowComplaintDensityOverlay(false)}
            />
          </div>
        )}

        {/* 2D Taktisk Kort HUD-kort for Vind-Støj Varmegraf & Vindvinkel-Simulator */}
        {showWindNoiseHeatmapLayer && !useGoogleMapsEngine && (
          <div className="absolute bottom-14 left-3 z-20 pointer-events-auto max-w-[calc(100%-24px)]">
            <WindDirectionalNoiseHudCard
              cells={windDirectionalNoiseCells}
              currentWeather={currentWeather}
              overrideWindFromDeg={overrideNoiseWindFromDeg}
              onChangeOverrideWindFromDeg={setOverrideNoiseWindFromDeg}
              onSelectReceptor={onSelectReceptor}
              onClose={() => setShowWindNoiseHeatmapLayer(false)}
            />
          </div>
        )}

        {/* Plume Concentration Heatmap Legend HUD (Høj-Koncentration vs. Sikker Zone fra simulation.plumeZones) */}
        {showPlumeConcentrationHeatmapLayer && (
          <div
            data-testid="plume-concentration-heatmap-hud"
            className="absolute bottom-14 right-3 z-20 pointer-events-auto w-[340px] max-w-[calc(100%-24px)] bg-[#0F1623]/95 border border-rose-500/65 rounded-md p-2.5 shadow-2xl font-mono text-[11px] tabular-nums space-y-2"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-200 uppercase">
                <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Plume Koncentrations-Heatmap</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPlumeConcentrationHeatmapLayer(false)}
                className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                aria-label="Luk koncentrations-heatmap"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 rounded bg-rose-950/50 border border-rose-500/50 space-y-1">
                <div className="flex items-center gap-1.5 text-rose-200 font-bold">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 border border-rose-300 shrink-0" />
                  <span>Høj-Konc. Faner</span>
                </div>
                <div className="text-slate-300">
                  Kritisk (S≥{plumeConcentrationHeatmapData.criticalThreshold.toFixed(2)}):{' '}
                  <strong className="text-rose-300">{plumeConcentrationHeatmapData.criticalCount}</strong>
                </div>
                <div className="text-slate-300">
                  Forhøjet ({plumeConcentrationHeatmapData.elevatedThreshold.toFixed(2)}–
                  {plumeConcentrationHeatmapData.criticalThreshold.toFixed(2)}):{' '}
                  <strong className="text-amber-300">{plumeConcentrationHeatmapData.elevatedCount}</strong>
                </div>
                <div className="text-slate-300">
                  Obs. ({plumeConcentrationHeatmapData.obsThreshold.toFixed(2)}–
                  {plumeConcentrationHeatmapData.elevatedThreshold.toFixed(2)}):{' '}
                  <strong className="text-yellow-300">{plumeConcentrationHeatmapData.observationCount}</strong>
                </div>
              </div>

              <div className="p-1.5 rounded bg-emerald-950/45 border border-emerald-500/50 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-200 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Sikre Zoner (Kl. {currentWeather.pasquillClass})</span>
                </div>
                <div className="text-slate-300">
                  Grænse:{' '}
                  <strong className="text-emerald-300">
                    S &lt; {plumeConcentrationHeatmapData.obsThreshold.toFixed(2)}
                  </strong>
                </div>
                <div className="text-slate-300">
                  Sikre receptorer:{' '}
                  <strong className="text-emerald-300">
                    {plumeConcentrationHeatmapData.safeReceptorsCount}/{receptors.length}
                  </strong>
                </div>
                <div className="text-slate-300">
                  Max S-top: <strong className="text-rose-200">{plumeConcentrationHeatmapData.maxZoneQuotient.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Real-Time Kierulffsvej Drikkevands-Hovedrør Tooltip / Infobox + BEK 1272/2025 Badge */}
        {!showWaterMainInspector && showWaterMainLayer && waterMainTelemetry && (
          <div
            data-testid="water-main-live-telemetry-infobox"
            data-critical-pulse={isWaterMainCriticalPulse ? 'true' : 'false'}
            className={`absolute bottom-14 left-3 z-30 pointer-events-auto w-[372px] max-w-[calc(100%-24px)] rounded-md p-2.5 shadow-2xl font-mono text-[11px] tabular-nums border space-y-2 ${
              isWaterMainCriticalPulse
                ? 'bg-rose-950/95 border-rose-500 text-rose-50 water-main-tooltip-critical-pulse'
                : waterMainTelemetry.overallStatus === 'warning' ||
                  waterMainTelemetry.overallStatus === 'advisory'
                ? 'bg-[#1a150b]/95 border-amber-400/90 text-amber-50'
                : 'bg-[#0F1623]/95 border-sky-400/80 text-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/15 pb-1.5">
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-sky-300 uppercase">
                  <Droplets className="w-3.5 h-3.5 shrink-0" />
                  <span>Drikkevands-Hovedrør (Kierulffsvej)</span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  {waterMainTelemetry.ownerName} · DN200 (-1,65 m)
                </div>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded border text-[11px] font-bold shrink-0 ${
                  isWaterMainCriticalPulse
                    ? 'bg-rose-900 border-rose-400 text-rose-100'
                    : 'bg-sky-950 border-sky-500/50 text-sky-200'
                }`}
              >
                {isWaterMainCriticalPulse ? 'BRUD / >50 mm/s' : 'LIVE TELEMETRI'}
              </span>
            </div>

            <WaterMainBek1272Badge
              telemetry={waterMainTelemetry}
              visible={showWaterMainLayer}
              variant="detailed"
              testId="infobox-bek1272-status-badge"
            />

            {/* Focus Mode Item 1: Vibrationsfare (DIN 4150-3) dynamic PPV vs. 25 mm/s alert overlay + Maskin-Stop (pulsing E-Stop activation) */}
            {(isStructuralIntegrityAlert || isolatedMachineryJustNow) && (
              <div
                role="alert"
                data-testid="water-main-structural-integrity-alert"
                className={`p-2 rounded border space-y-1.5 ${
                  isolatedMachineryJustNow
                    ? 'bg-emerald-950/95 border-emerald-400/90 text-emerald-100'
                    : 'bg-rose-950/95 border-rose-400/90 text-rose-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isolatedMachineryJustNow ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-extrabold text-[11px] tracking-tight">
                        {isolatedMachineryJustNow
                          ? 'E-Stop Aktiv · Nærmeste maskiner frakoblet'
                          : `Vibrationsfare (DIN 4150-3) · ${
                              isDin4150ThresholdExceeded ? 'OVERSKREDET' : '≥90% GRÆNSE'
                            }`}
                      </div>
                      <div className="text-[10.5px] opacity-90 tabular-nums">
                        PPV {ppvValMmPerSec.toFixed(1)} / 25,0 mm/s ({ppvPctOf25Threshold}% ·{' '}
                        {ppvDeltaFrom25MmPerSec >= 0 ? '+' : ''}
                        {ppvDeltaFrom25MmPerSec.toFixed(1)} mm/s)
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="water-main-isolate-machinery-btn"
                    onClick={handleTriggerIsolateNearbyMachinery}
                    title="Hurtig deaktivering af de nærmeste entreprenørmaskiner (≤65 m fra DN200 hovedrør)"
                    className={`px-2.5 py-1 rounded font-bold border text-[10.5px] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      isolatedMachineryJustNow
                        ? 'bg-emerald-500 text-slate-950 border-emerald-200 ring-2 ring-emerald-300/80 machine-estop-btn-pulse animate-pulse'
                        : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-200'
                    }`}
                  >
                    {isolatedMachineryJustNow ? '✓ E-Stop Aktiv' : 'Maskin-Stop'}
                  </button>
                </div>
                <div className="w-full h-1.5 rounded bg-black/50 overflow-hidden border border-rose-400/40">
                  <div
                    className={
                      isolatedMachineryJustNow
                        ? 'h-full bg-emerald-400'
                        : isDin4150ThresholdExceeded
                        ? 'h-full bg-rose-500'
                        : 'h-full bg-amber-400'
                    }
                    style={{ width: `${ppvGaugeWidthPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 rounded bg-black/30 border border-white/10">
                <div className="text-slate-400">Tryk &amp; Flow</div>
                <div className="font-bold text-cyan-300">
                  {waterMainTelemetry.pressureBar.toFixed(2)} bar · {waterMainTelemetry.flowLs.toFixed(1)} L/s
                </div>
              </div>
              <div className="p-1.5 rounded bg-black/30 border border-white/10">
                <div className="text-slate-400">PPV-Vibration (DIN 4150-3)</div>
                <div
                  className={`font-bold ${
                    waterMainTelemetry.pipePpvMmPerSec > 50
                      ? 'text-rose-300'
                      : waterMainTelemetry.pipePpvMmPerSec >= 25
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }`}
                >
                  {waterMainTelemetry.pipePpvMmPerSec.toFixed(1)} mm/s (stik {waterMainTelemetry.nearestBranchPpvMmPerSec.toFixed(1)})
                </div>
              </div>
              <div className="p-1.5 rounded bg-black/30 border border-white/10">
                <div className="text-slate-400">Køreplade-status</div>
                <div
                  className={`font-bold ${
                    waterMainTelemetry.hasSteelRoadPlates ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {waterMainTelemetry.hasSteelRoadPlates ? 'Wissenberg PSS Aktiv' : 'Uden køreplader'} (
                  {waterMainTelemetry.crownStressKpa.toFixed(1)} kPa)
                </div>
              </div>
              <div className="p-1.5 rounded bg-black/30 border border-white/10">
                <div className="text-slate-400">BEK 1272/2025 (Pb/PAH/PCB)</div>
                <div className="font-semibold text-slate-200 truncate">
                  Pb {waterMainTelemetry.estimatedLeadIntrusionUgL.toFixed(1)} · PAH{' '}
                  {waterMainTelemetry.estimatedPah4SumUgL.toFixed(2)} · PCB{' '}
                  {(waterMainTelemetry.estimatedPcbIntrusionUgL ?? 0.08).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Focus Mode: Last 6 hours pipe vibration trend sparkline */}
            <WaterMainVibrationSparkline
              points={waterMainLast6HoursPoints}
              currentPpvMmPerSec={waterMainTelemetry.pipePpvMmPerSec}
            />

            {/* Focus Mode Item 2: Simulér Lækagepunkt (pin-drop) + Soil Saturation & Building Foundation Percolation Impact */}
            <div className="p-1.5 rounded bg-black/35 border border-sky-500/30 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <button
                  type="button"
                  data-testid="water-main-simulate-leak-pin-btn"
                  onClick={() => setIsLeakPinDropMode((v) => !v)}
                  className={`px-2 py-1 rounded border font-bold text-[10.5px] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isLeakPinDropMode
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : effectiveVirtualLeakImpact
                      ? 'bg-rose-600/30 border-rose-400 text-rose-100'
                      : 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/60 text-sky-200'
                  }`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>
                    {isLeakPinDropMode ? 'Klik på røret på kortet...' : 'Simulér Lækagepunkt'}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  {!effectiveVirtualLeakImpact && (
                    <button
                      type="button"
                      data-testid="water-main-quick-leak-pin-btn"
                      onClick={handleToggleVirtualLeakPinQuick}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[10px] font-bold cursor-pointer"
                    >
                      Placér nu
                    </button>
                  )}
                  {effectiveVirtualLeakImpact && (
                    <button
                      type="button"
                      data-testid="water-main-clear-leak-pin-btn"
                      onClick={() => {
                        setVirtualLeakPin(null);
                        setIsLeakPinDropMode(false);
                      }}
                      className="px-1.5 py-0.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/60 text-rose-200 text-[10px] font-bold cursor-pointer"
                    >
                      Fjern pin
                    </button>
                  )}
                </div>
              </div>

              {effectiveVirtualLeakImpact && (
                <div
                  data-testid="water-main-virtual-leak-impact-panel"
                  className="space-y-1 text-[10.5px] border-t border-white/10 pt-1"
                >
                  <div className="flex items-center justify-between text-amber-200 font-bold">
                    <span>
                      Udslip: {effectiveVirtualLeakImpact.dischargeLs.toFixed(1)} L/s · Trykfald −
                      {effectiveVirtualLeakImpact.pressureDropBar.toFixed(2)} bar
                    </span>
                    <span className="text-sky-300">
                      Mætning op til {effectiveVirtualLeakImpact.saturationZones[2]?.radiusMeters} m (dybde{' '}
                      {effectiveVirtualLeakImpact.immediatePercolationDepthM.toFixed(1)} m)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-300">
                    {effectiveVirtualLeakImpact.saturationZones.map((z) => (
                      <span key={`inf-sat-${z.tier}`}>
                        {z.saturationPct}% ({z.radiusMeters}m)
                      </span>
                    ))}
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-0.5">
                    {effectiveVirtualLeakImpact.impactedBuildings.slice(0, 4).map((b) => (
                      <div
                        key={`inf-leak-${b.buildingId}`}
                        className="flex items-center justify-between gap-1 text-slate-200"
                      >
                        <span className="truncate">
                          {b.buildingCode} ({b.distanceMeters.toFixed(0)}m · fund. −{b.foundationDepthExposureM.toFixed(2)}m)
                        </span>
                        <span
                          className={`font-bold shrink-0 ${
                            b.severity === 'critical'
                              ? 'text-rose-300'
                              : b.severity === 'high'
                              ? 'text-amber-300'
                              : 'text-sky-300'
                          }`}
                        >
                          {b.arrivalMinutes.toFixed(0)} min · {b.intrusionRateLh.toFixed(0)} L/t
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected pipe section + BEK 1272/2025 CSV export & details */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
              {availableWaterMainSections.length > 0 ? (
                <select
                  data-testid="water-main-section-select"
                  aria-label="Vælg rørstrækning for BEK 1272/2025 CSV-eksport"
                  value={effectiveWaterMainSectionId}
                  onChange={(e) => setSelectedWaterMainSectionId(e.target.value)}
                  className="flex-1 min-w-[140px] max-w-[180px] px-1.5 py-0.5 rounded bg-[#090d16] border border-slate-700 text-slate-200 text-[11px] font-mono truncate cursor-pointer"
                >
                  {availableWaterMainSections.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name}
                    </option>
                  ))}
                  <option value="all">Alle strækninger</option>
                </select>
              ) : (
                <span className="text-slate-400 truncate">Kierulffsvej DN200</span>
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="water-main-export-bek1272-csv-btn"
                  onClick={handleExportWaterMainBek1272Csv}
                  className={`px-2 py-0.5 rounded border font-bold cursor-pointer inline-flex items-center gap-1 transition-colors ${
                    waterMainCsvExportedJustNow
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                      : 'bg-cyan-500/20 hover:bg-cyan-500/35 border-cyan-400/60 text-cyan-200'
                  }`}
                  title="Download CSV med seneste BEK 1272/2025 compliance-telemetri (Bly, PAH, PCB, tryk, PPV) for den valgte rørstrækning"
                >
                  <Download className="w-3 h-3 shrink-0" />
                  <span>{waterMainCsvExportedJustNow ? '✓ CSV gemt' : 'BEK 1272 CSV'}</span>
                </button>
                <button
                  type="button"
                  data-testid="water-main-open-full-inspector-btn"
                  onClick={() => setShowWaterMainInspector(true)}
                  className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/60 text-sky-200 font-bold cursor-pointer shrink-0"
                >
                  Detaljer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kierulffsvej DN200 Drinking Water Main Forensic Inspection HUD Card */}
        {showWaterMainInspector && showWaterMainLayer && waterMainTelemetry && (
          <div
            data-testid="water-main-forensic-inspector-card"
            data-critical-pulse={isWaterMainCriticalPulse ? 'true' : 'false'}
            className={`absolute bottom-14 left-3 z-30 pointer-events-auto w-[420px] max-w-[calc(100%-24px)] rounded-md p-3 shadow-2xl font-mono text-[11px] tabular-nums border space-y-2 ${
              isWaterMainCriticalPulse
                ? 'bg-rose-950/95 border-rose-500 text-rose-50 water-main-tooltip-critical-pulse'
                : waterMainTelemetry.overallStatus === 'warning' ||
                  waterMainTelemetry.overallStatus === 'advisory'
                ? 'bg-[#1a150b]/95 border-amber-400 text-amber-50'
                : 'bg-[#0F1623]/95 border-sky-400/75 text-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/15 pb-1.5">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-sky-300 uppercase">
                  <Droplets className="w-3.5 h-3.5 shrink-0" />
                  <span>Kierulffsvej Drikkevandshovedrør (DN200)</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  {waterMainTelemetry.ownerName} · {waterMainTelemetry.waterHardnessDh.toFixed(2)} °dH
                </div>
                <WaterMainBek1272Badge
                  telemetry={waterMainTelemetry}
                  visible={showWaterMainLayer}
                  variant="detailed"
                  testId="inspector-bek1272-status-badge"
                />
                {(isStructuralIntegrityAlert || isolatedMachineryJustNow) && (
                  <div
                    role="alert"
                    data-testid="inspector-structural-integrity-alert"
                    className={`p-2 rounded border space-y-1 ${
                      isolatedMachineryJustNow
                        ? 'bg-emerald-950/95 border-emerald-400/90 text-emerald-100'
                        : 'bg-rose-950/95 border-rose-400/90 text-rose-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-extrabold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span>
                          Vibrationsfare (DIN 4150-3): {ppvValMmPerSec.toFixed(1)}/25 mm/s ({ppvPctOf25Threshold}%)
                        </span>
                      </span>
                      <button
                        type="button"
                        data-testid="inspector-isolate-machinery-btn"
                        onClick={handleTriggerIsolateNearbyMachinery}
                        className={`px-2 py-0.5 rounded font-bold border text-[10.5px] whitespace-nowrap shrink-0 cursor-pointer ${
                          isolatedMachineryJustNow
                            ? 'bg-emerald-500 text-slate-950 border-emerald-200 ring-2 ring-emerald-300/80 machine-estop-btn-pulse animate-pulse'
                            : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-200'
                        }`}
                      >
                        {isolatedMachineryJustNow ? '✓ E-Stop Aktiv' : 'Maskin-Stop'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowWaterMainInspector(false)}
                className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer shrink-0"
                aria-label="Luk rør-inspektør"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 rounded bg-black/30 border border-white/10">
                <div className="text-slate-400">Dybde &amp; Materiale</div>
                <div className="font-bold text-white">
                  ~{waterMainTelemetry.burialDepthMeters.toFixed(2)} m (1,45–1,80 m · LIGE UNDER ~
                  {waterMainTelemetry.districtHeatingDepthMeters.toFixed(2)} m fjernv.)
                </div>
                <div className="text-slate-300">
                  DN200 ældre asbestcement (1964) + PE100 delstræk · LER ±{waterMainTelemetry.lerUncertaintyMeters.toFixed(1)} m
                </div>
              </div>
              <div className="p-1.5 rounded bg-black/30 border border-white/10">
                <div className="text-slate-400">Hydraulik (CiK 2.0)</div>
                <div className="font-bold text-cyan-300">
                  {waterMainTelemetry.pressureBar.toFixed(2)} bar · {waterMainTelemetry.flowLs.toFixed(1)} L/s
                </div>
                <div className="text-slate-300">
                  Effekt: {waterMainTelemetry.hydraulicPowerWatts.toFixed(0)} W ({waterMainTelemetry.hydraulicEnergyPerHourKj.toFixed(0)} kJ/t)
                </div>
              </div>
              <div className="p-1.5 rounded bg-black/30 border border-white/10">
                <div className="text-slate-400">DIN 4150-3 Tabel 3</div>
                <div
                  className={`font-bold ${
                    waterMainTelemetry.pipePpvMmPerSec >= 50
                      ? 'text-rose-300'
                      : waterMainTelemetry.pipePpvMmPerSec >= 25
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }`}
                >
                  Rør: {waterMainTelemetry.pipePpvMmPerSec.toFixed(1)} mm/s (Eternit &ge;25 · Plast 50 · Metal 80)
                </div>
                <div className="text-slate-300">
                  Stikledning: {waterMainTelemetry.nearestBranchPpvMmPerSec.toFixed(1)} mm/s (5–20)
                </div>
              </div>
              <div className="p-1.5 rounded bg-black/30 border border-white/10">
                <div className="text-slate-400">BEK 1272/2025 &amp; Boussinesq</div>
                <div className="font-bold text-white">
                  {waterMainTelemetry.crownStressKpa.toFixed(1)} kPa (
                  {waterMainTelemetry.hasSteelRoadPlates ? 'm/ køreplader' : 'uden plader'})
                </div>
                <div className="text-slate-300">
                  GW: -{waterMainTelemetry.effectiveGroundwaterDepthMeters.toFixed(2)} m · Bly{' '}
                  {waterMainTelemetry.estimatedLeadIntrusionUgL.toFixed(2)} (&le;5,0) · 4-PAH{' '}
                  {waterMainTelemetry.estimatedPah4SumUgL.toFixed(3)} (&le;0,10) · PCB{' '}
                  {(waterMainTelemetry.estimatedPcbIntrusionUgL ?? 0.08).toFixed(2)} (&le;0,50) µg/L
                </div>
              </div>
            </div>

            {waterMainTelemetry.legalAlerts.length > 0 && (
              <div className="p-1.5 rounded bg-rose-950/60 border border-rose-500/50 space-y-0.5 max-h-24 overflow-y-auto">
                {waterMainTelemetry.legalAlerts.map((al) => (
                  <div key={al.code} className="text-[11px] leading-tight text-rose-100">
                    <strong className="text-amber-300">{al.statute}:</strong> {al.title} (
                    {al.measuredText})
                  </div>
                ))}
              </div>
            )}

            <div className="p-1.5 rounded bg-black/30 border border-white/10 space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                <span>
                  Binding:{' '}
                  <strong className="text-sky-200">{waterMainTelemetry.coordinateMode}</strong>
                </span>
                <span className="text-amber-200 truncate">
                  7. juni 2018 brud: 60 m rende / ~180 m³ vandtab
                </span>
              </div>
              <div className="max-h-20 overflow-y-auto space-y-0.5 text-[11px] leading-tight text-slate-300">
                {(waterMainTelemetry.coordinateMode === 'dar_verified_wgs84'
                  ? KIERULFFSVEJ_DAR_CONTROL_POINTS
                  : KIERULFFSVEJ_SCENE_CONTROL_POINTS
                ).map((cp) => (
                  <div
                    key={cp.code}
                    className="flex items-center justify-between gap-1.5 border-t border-white/5 pt-0.5"
                  >
                    <span className="text-slate-200 truncate">
                      {cp.label}
                      {cp.noteDa ? ` (${cp.noteDa})` : ''}
                    </span>
                    <span className="text-cyan-300 shrink-0">
                      {cp.lat.toFixed(
                        waterMainTelemetry.coordinateMode === 'dar_verified_wgs84' ? 6 : 5
                      )}
                      ,{' '}
                      {cp.lng.toFixed(
                        waterMainTelemetry.coordinateMode === 'dar_verified_wgs84' ? 6 : 5
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <WaterMainVibrationSparkline
              points={waterMainLast6HoursPoints}
              currentPpvMmPerSec={waterMainTelemetry.pipePpvMmPerSec}
            />

            {/* Simulér Lækagepunkt (pin-drop) in full inspector */}
            <div className="p-1.5 rounded bg-black/35 border border-sky-500/30 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <button
                  type="button"
                  data-testid="inspector-simulate-leak-pin-btn"
                  onClick={() => setIsLeakPinDropMode((v) => !v)}
                  className={`px-2 py-1 rounded border font-bold text-[10.5px] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                    isLeakPinDropMode
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : effectiveVirtualLeakImpact
                      ? 'bg-rose-600/30 border-rose-400 text-rose-100'
                      : 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/60 text-sky-200'
                  }`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>
                    {isLeakPinDropMode ? 'Klik på røret på kortet...' : 'Simulér Lækagepunkt'}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  {!effectiveVirtualLeakImpact ? (
                    <button
                      type="button"
                      onClick={handleToggleVirtualLeakPinQuick}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[10px] font-bold cursor-pointer"
                    >
                      Placér ved Kilde
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setVirtualLeakPin(null);
                        setIsLeakPinDropMode(false);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/60 text-rose-200 text-[10px] font-bold cursor-pointer"
                    >
                      Fjern lækagepunkt
                    </button>
                  )}
                </div>
              </div>
              {effectiveVirtualLeakImpact && (
                <div className="space-y-1 text-[10.5px] border-t border-white/10 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-amber-200 font-bold">
                    <span>
                      Udslip {effectiveVirtualLeakImpact.dischargeLs.toFixed(1)} L/s · ΔP −
                      {effectiveVirtualLeakImpact.pressureDropBar.toFixed(2)} bar
                    </span>
                    <span className="text-sky-300">
                      Kerne {effectiveVirtualLeakImpact.saturationZones[0]?.radiusMeters}m / Rand{' '}
                      {effectiveVirtualLeakImpact.saturationZones[2]?.radiusMeters}m
                    </span>
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-0.5">
                    {effectiveVirtualLeakImpact.impactedBuildings.map((b) => (
                      <div
                        key={`full-leak-${b.buildingId}`}
                        className="flex items-center justify-between gap-1 text-slate-200"
                      >
                        <span className="truncate">
                          {b.buildingCode} ({b.address}) · {b.distanceMeters.toFixed(0)}m · fund. −{b.foundationDepthExposureM.toFixed(2)}m
                        </span>
                        <span
                          className={`font-bold shrink-0 ${
                            b.severity === 'critical'
                              ? 'text-rose-300'
                              : b.severity === 'high'
                              ? 'text-amber-300'
                              : 'text-sky-300'
                          }`}
                        >
                          {b.arrivalMinutes.toFixed(0)} min · {b.intrusionRateLh.toFixed(0)} L/t
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {availableWaterMainSections.length > 0 && (
                <select
                  data-testid="inspector-water-main-section-select"
                  aria-label="Vælg rørstrækning for BEK 1272/2025 CSV-eksport"
                  value={effectiveWaterMainSectionId}
                  onChange={(e) => setSelectedWaterMainSectionId(e.target.value)}
                  className="px-1.5 py-1.5 rounded bg-[#090d16] border border-slate-700 text-slate-200 text-[11px] font-mono max-w-[155px] truncate cursor-pointer"
                >
                  {availableWaterMainSections.map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name}
                    </option>
                  ))}
                  <option value="all">Alle strækninger</option>
                </select>
              )}

              <button
                type="button"
                data-testid="inspector-water-main-export-bek1272-csv-btn"
                onClick={handleExportWaterMainBek1272Csv}
                className={`px-2 py-1.5 rounded font-bold border transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                  waterMainCsvExportedJustNow
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/35 border-cyan-400/60 text-cyan-200'
                }`}
                title="Download CSV med BEK 1272/2025 telemetri for valgt rørstrækning"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{waterMainCsvExportedJustNow ? '✓ CSV gemt' : 'BEK 1272 CSV'}</span>
              </button>

              <button
                type="button"
                data-testid="water-main-toggle-sankey-btn"
                onClick={() => setShowWaterMainSankeyInInspector((v) => !v)}
                className={`px-2 py-1.5 rounded font-bold border transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                  showWaterMainSankeyInInspector
                    ? 'bg-cyan-500/25 text-cyan-100 border-cyan-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-cyan-200 border-slate-700'
                }`}
              >
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span>{showWaterMainSankeyInInspector ? 'Skjul Sankey' : 'Vibrations-Sankey'}</span>
              </button>

              {onLogWaterMainObservation && (
                <button
                  type="button"
                  data-testid="water-main-log-sha256-btn"
                  onClick={() => {
                    onLogWaterMainObservation(
                      waterMainTelemetry,
                      `Kierulffsvej DN200 Rør-Inspektion (${waterMainTelemetry.statusLabelDa})`
                    );
                    setWaterMainLoggedJustNow(true);
                    window.setTimeout(() => setWaterMainLoggedJustNow(false), 3200);
                  }}
                  className={`flex-1 px-2.5 py-1.5 rounded font-bold border transition-colors cursor-pointer ${
                    waterMainLoggedJustNow
                      ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950 border-sky-200'
                  }`}
                >
                  {waterMainLoggedJustNow
                    ? '✓ Rør-observation SHA-256 signeret & logget'
                    : 'Log rør-observation til Beviser (SHA-256)'}
                </button>
              )}
            </div>

            {showWaterMainSankeyInInspector && (
              <div className="pt-1 border-t border-white/10">
                <WaterMainVibrationSankeyWidget
                  waterMainTelemetry={waterMainTelemetry}
                  sources={sources}
                  manualMachineNoiseOutputDb={machineNoiseOutputDb}
                  compact
                />
              </div>
            )}
          </div>
        )}

        {/* Item 2: E-Stop Confirmation Toast when nearby construction machinery is disconnected */}
        {eStopToastData && (
          <div
            role="status"
            data-testid="e-stop-confirmation-toast"
            className="absolute top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto w-[440px] max-w-[calc(100%-24px)] rounded-md bg-emerald-950/95 border border-emerald-400 p-2.5 shadow-2xl font-mono text-[11px] tabular-nums text-emerald-50 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-extrabold text-emerald-200 uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>E-Stop Bekræftet · Maskin-Stop Aktiveret</span>
              </div>
              <button
                type="button"
                onClick={() => setEStopToastData(null)}
                aria-label="Luk E-Stop bekræftelse"
                className="p-0.5 rounded text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-emerald-100">
              Frakoblede {eStopToastData.totalStoppedCount} nærliggende maskinkilder (
              <strong className="text-white">{eStopToastData.isolatedCodes.join(', ')}</strong>) kl.{' '}
              {eStopToastData.triggeredAtLabel} ved PPV{' '}
              <strong className="text-amber-300">{eStopToastData.ppvBeforeMmPerSec.toFixed(1)} mm/s</strong>.
            </div>
            {onRestoreAllMachinery && (
              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onRestoreAllMachinery();
                    setEStopToastData(null);
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-900 hover:bg-emerald-800 border border-emerald-400/60 text-emerald-100 text-[10.5px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Gendan maskiner
                </button>
              </div>
            )}
          </div>
        )}

        {/* Item 3: Vejr-Korrelations Heatmap HUD Legend (6h gusts vs S-quotient r > 0.80) */}
        {!effectiveMapOnly &&
          showWeatherCorrelationHeatmapLayer &&
          showWeatherCorrelationHud && (
            <div
              data-testid="weather-correlation-heatmap-hud"
              className="absolute top-14 left-3 z-25 pointer-events-auto w-[332px] max-w-[calc(100%-24px)] bg-[#0F1623]/95 border border-orange-400/75 rounded-md p-2.5 shadow-xl font-mono text-[11px] tabular-nums space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-orange-500/30 pb-1">
                <div className="flex items-center gap-1.5 font-bold text-orange-200 uppercase truncate">
                  <Wind className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate">Vejr-Korrelations Heatmap (r &gt; 0,80)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWeatherCorrelationHud(false)}
                  className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Minimer Vejr-Korrelations Heatmap HUD"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10.5px] text-slate-300 flex items-center justify-between">
                <span>
                  Vindue: {weatherCorrelationHeatmapData.windowStartLabel}–{weatherCorrelationHeatmapData.windowEndLabel} (6t)
                </span>
                <span className="text-orange-300 font-bold">
                  Max stød: {weatherCorrelationHeatmapData.maxGust6h.toFixed(1)} m/s
                </span>
              </div>
              {weatherCorrelationHeatmapData.highlightedAreas.length === 0 ? (
                <div className="text-[10.5px] text-slate-400 py-0.5">
                  Ingen geografiske områder har Pearson r &gt; 0,80 mellem vindstød og S-kvotient i de seneste 6 timer.
                </div>
              ) : (
                <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                  {weatherCorrelationHeatmapData.highlightedAreas.slice(0, 4).map((item) => (
                    <button
                      key={`hud-wcorr-${item.receptor.id}`}
                      type="button"
                      onClick={() => onSelectReceptor(item.receptor.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded border text-left cursor-pointer transition-colors ${
                        selectedReceptorId === item.receptor.id
                          ? 'bg-orange-900/70 border-orange-300 text-white'
                          : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-200'
                      }`}
                    >
                      <span className="truncate font-semibold">
                        {item.receptor.code} · {item.receptor.name}
                      </span>
                      <span className="shrink-0 text-orange-300 font-bold">
                        r={item.pearsonR.toFixed(2)} · S={item.maxS6h.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* Item 7: High-Wind Dispersion Correlation HUD Widget (Triggered automatically when windGusts10m > 12 m/s) */}
        {!effectiveMapOnly && isHighGustAlert && showHighWindCorrelationHud && (
          <div
            data-testid="high-wind-dispersion-correlation-widget"
            className="absolute top-28 right-3 z-30 pointer-events-auto w-[348px] max-w-[calc(100%-24px)] bg-[#0F1623]/95 border border-amber-400/75 rounded-md p-2.5 shadow-2xl font-mono text-[11px] tabular-nums space-y-2"
          >
            <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-1">
              <div className="flex items-center gap-1.5 text-amber-200 font-bold uppercase truncate">
                <Wind className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">High-Wind Dispersion Correlation</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-400/60 text-amber-200 font-bold">
                  {highGustCorrelationData.maxGustMs.toFixed(1)} m/s &gt;12
                </span>
                <button
                  type="button"
                  onClick={() => setShowHighWindCorrelationHud(false)}
                  className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Minimer High-Wind Dispersion Correlation HUD"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 rounded bg-black/35 border border-slate-800">
                <div className="text-slate-400">Pearson r (Stød vs. S)</div>
                <div className="text-sm font-bold text-cyan-300">
                  r = {highGustCorrelationData.pearsonR.toFixed(3)}
                </div>
              </div>
              <div className="p-1.5 rounded bg-black/35 border border-slate-800">
                <div className="text-slate-400">Fremhævede Receptorer</div>
                <div className="text-sm font-bold text-amber-300">
                  {highGustCorrelationData.affectedReceptors.length} zoner i nedvind
                </div>
              </div>
            </div>

            <div className="space-y-1">
              {highGustCorrelationData.affectedReceptors.map((item) => (
                <button
                  key={`gust-hud-rec-${item.receptor.id}`}
                  type="button"
                  onClick={() => onSelectReceptor(item.receptor.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded border text-left cursor-pointer transition-colors ${
                    selectedReceptorId === item.receptor.id
                      ? 'bg-amber-900/70 border-amber-300 text-white'
                      : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  <span className="truncate font-semibold">
                    {item.receptor.code} · {item.receptor.name}
                  </span>
                  <span className="shrink-0 text-amber-300 font-bold">
                    {item.downwindAlignmentPct}% · S={item.sumQuotient.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Automated 24h Cumulative Plume-Path Sequence & High-Density Receptor Intersection Alert Overlay */}
        {isAnimatingPlumeRoute &&
          isPuffMode &&
          (() => {
            const intersected = plumeRouteAnimationData.intersectingHighDensityReceptors;
            const hasIntersection = intersected.length > 0;
            const totalResidentsImpacted = intersected.reduce(
              (acc, item) => acc + item.residentCount,
              0
            );
            const pctComplete = Math.round(
              (Math.max(0, Math.min(23.99, plumeRouteProgress)) / 24) * 100
            );

            return (
              <div
                role={hasIntersection ? 'alert' : 'status'}
                data-testid="plume-path-intersection-alert-overlay"
                data-intersection-active={hasIntersection ? 'true' : 'false'}
                className={`absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[460px] max-w-[calc(100%-24px)] rounded-md p-2.5 shadow-2xl font-mono text-[11px] tabular-nums border transition-colors ${
                  hasIntersection
                    ? 'bg-rose-950/95 border-rose-400 text-rose-50 ring-2 ring-amber-400/70'
                    : 'bg-[#0F1623]/95 border-cyan-500/75 text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/15">
                  <div className="flex items-center gap-1.5 font-bold uppercase min-w-0">
                    {hasIntersection ? (
                      <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
                    ) : (
                      <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {hasIntersection
                        ? `INTERSEKTIONSALARM: 24T PLUME-PATH (${intersected.length} HØJTÆTHEDSZONER)`
                        : `24T KUMULATIV PLUME-PATH SEKVENS · KL. ${currentWeather.hourLabel}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/20 text-[11px] font-bold">
                      {currentWeather.hourLabel} ({Math.round(currentWeather.windDirection10m)}° →{' '}
                      {plumeDirectionDeg}°)
                    </span>
                    {onToggleAnimatePlumeRoute && (
                      <button
                        type="button"
                        onClick={onToggleAnimatePlumeRoute}
                        className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold cursor-pointer flex items-center gap-1"
                        aria-label="Stop 24t Plume-Path animation"
                      >
                        <Pause className="w-3 h-3" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 24-Hour Wind Vector History Progress Strip */}
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>
                      Kilde: <strong className="text-cyan-300">{plumeRouteAnimationData.originSource.code}</strong>{' '}
                      · Vind {currentWeather.windSpeed10m.toFixed(1)} m/s (stød{' '}
                      {currentWeather.windGusts10m.toFixed(1)} m/s) · Kl.{' '}
                      {currentWeather.pasquillClass}
                    </span>
                    <span className="font-bold text-cyan-200">{pctComplete}% / 24t</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-900/90 overflow-hidden border border-white/15">
                    <div
                      className={`h-full transition-all duration-75 ${
                        hasIntersection
                          ? 'bg-gradient-to-r from-amber-400 to-rose-500'
                          : 'bg-gradient-to-r from-cyan-400 to-sky-500'
                      }`}
                      style={{ width: `${Math.max(4, pctComplete)}%` }}
                    />
                  </div>
                </div>

                {hasIntersection ? (
                  <div className="mt-2 pt-1.5 border-t border-rose-400/35 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-amber-200 font-bold">
                      <span>
                        Vindfanen krydser {intersected.length} tætbefolkede bolig-/institutionszoner
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-900 border border-rose-400/70 text-white">
                        ~{totalResidentsImpacted} beboere
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {intersected.slice(0, 4).map((item) => (
                        <button
                          key={`overlay-hit-${item.receptor.id}`}
                          type="button"
                          onClick={() => onSelectReceptor(item.receptor.id)}
                          className={`px-2 py-0.5 rounded border text-left cursor-pointer transition-colors ${
                            item.isCritical
                              ? 'bg-rose-900/80 hover:bg-rose-800 border-rose-300 text-white font-bold'
                              : 'bg-amber-950/80 hover:bg-amber-900 border-amber-400 text-amber-100 font-semibold'
                          }`}
                        >
                          {item.receptor.code} · {item.distToPathMeters}m · S=
                          {item.sumQuotient.toFixed(2)} ({item.residentCount} beb.)
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 text-cyan-200/90">
                    Ingen akut direkte skæring med højtætheds-receptorzone på kl.{' '}
                    {currentWeather.hourLabel} — overvåger løbende gennem 24t vindvektor-historik.
                  </div>
                )}
              </div>
            );
          })()}

        {/* Frigørbart & Minimerbart 'mycelium_alert_center' Vindue (System B Simuler, Live Varsling & CiK 2.0 Sankey) */}
        {showMyceliumAlertCenter && (() => {
          const mycWin = mapWindowStates.mycelium_alert_center;
          const targetReceptorId = selectedReceptorId ?? receptors[0]?.id ?? '';
          return (
            <div
              data-map-window="mycelium_alert_center"
              onMouseDown={() => mycWin.isReleased && handleFocusMapWindow('mycelium_alert_center')}
              className={`${
                mycWin.isReleased
                  ? 'fixed ring-2 ring-cyan-400/85'
                  : 'absolute top-20 left-3 z-30'
              } w-[488px] max-w-[calc(100%-24px)] bg-[#0B0E17]/95 border border-cyan-500/65 rounded-md p-3 shadow-2xl pointer-events-auto space-y-2`}
              style={
                mycWin.isReleased
                  ? {
                      left: `${mycWin.x}px`,
                      top: `${mycWin.y}px`,
                      zIndex: mycWin.zIndex,
                    }
                  : undefined
              }
            >
              <MapOverlayWindowControlStrip
                windowId="mycelium_alert_center"
                title="System B Mycelienetværk · Simuler, BFT & CiK 2.0"
                badgeText={`A_i=${myceliumSimState.kpis.autonomyIndexAi.toFixed(2)} · EU868 ${myceliumSimState.kpis.eu868DutyCyclePct.toFixed(2)}%`}
                accentColorClass="text-cyan-300"
                state={mycWin}
                onToggleMinimize={handleToggleMapWindowMinimize}
                onToggleRelease={handleToggleMapWindowRelease}
                onMove={handleMoveMapWindow}
                onFocus={handleFocusMapWindow}
                onClose={() => setShowMyceliumAlertCenter(false)}
              />
              {!mycWin.isMinimized && (
                <MyceliumControlAndSankeyPanel
                  state={myceliumSimState}
                  observations={observations}
                  scenario={myceliumScenario}
                  onChangeScenario={setMyceliumScenario}
                  realitySummitOverride={realitySummitOverride}
                  onToggleRealitySummit={() => setRealitySummitOverride((v) => !v)}
                  selectedReceptorId={targetReceptorId}
                  manualCraterNodeIds={manualCraterNodeIds}
                  manualSpoofNodeIds={manualSpoofNodeIds}
                  onToggleSelectedCrater={() => {
                    if (!targetReceptorId) return;
                    setManualCraterNodeIds((prev) =>
                      prev.includes(targetReceptorId)
                        ? prev.filter((id) => id !== targetReceptorId)
                        : [...prev, targetReceptorId]
                    );
                  }}
                  onToggleSelectedSpoof={() => {
                    if (!targetReceptorId) return;
                    setManualSpoofNodeIds((prev) =>
                      prev.includes(targetReceptorId)
                        ? prev.filter((id) => id !== targetReceptorId)
                        : [...prev, targetReceptorId]
                    );
                  }}
                  onResetManualOverrides={() => {
                    setManualCraterNodeIds([]);
                    setManualSpoofNodeIds([]);
                  }}
                  isLiveEnabled={myceliumLiveAlerts.isLiveEnabled}
                  onToggleLiveEnabled={myceliumLiveAlerts.toggleLiveEnabled}
                  alertProfile={myceliumLiveAlerts.alertProfile}
                  onChangeAlertProfile={myceliumLiveAlerts.setAlertProfile}
                  isAudioChimeEnabled={myceliumLiveAlerts.isAudioChimeEnabled}
                  onToggleAudioChime={myceliumLiveAlerts.toggleAudioMuted}
                  onTriggerTestAlert={myceliumLiveAlerts.triggerTestAlert}
                  onEnableOsNotification={() => {
                    void myceliumLiveAlerts.enableOsBrowserNotification();
                  }}
                  channelBadgeLabelDa={myceliumLiveAlerts.channelBadgeLabelDa}
                  suppressedStats={myceliumLiveAlerts.suppressedStats}
                  eventLog={myceliumLiveAlerts.eventLog}
                  onFocusReceptor={handleFocusMyceliumNode}
                  onOpenFormulaSimulator={() => setIsFormulaSimulatorOpen(true)}
                />
              )}
            </div>
          );
        })()}

        {/* Modul IV: Biokybernetisk Formelsamling & Dekonstruktion af System A */}
        <SystemBFormulaSimulatorModal
          isOpen={isFormulaSimulatorOpen}
          onClose={() => setIsFormulaSimulatorOpen(false)}
          liveTrMs={myceliumSimState.activeSelfHealingRoute?.reactionTimeTrMs ?? 179}
          liveAi={myceliumSimState.kpis.autonomyIndexAi}
          liveGamma={myceliumSimState.kpis.coercionIndexGamma}
        />

        {/* Ikke-blokerende Mycelium Live Toast Overlay (Respekterer Normal, Fuld Skærm & Kun Kort) */}
        <MyceliumToastOverlay
          visibleToasts={myceliumLiveAlerts.visibleToasts}
          isLiveEnabled={myceliumLiveAlerts.isLiveEnabled}
          channelBadgeLabelDa={myceliumLiveAlerts.channelBadgeLabelDa}
          isFullscreen={isFullscreen}
          isMapOnly={effectiveMapOnly}
          onFocusReceptor={handleFocusMyceliumNode}
          onDismissToast={myceliumLiveAlerts.dismissToast}
          onHoverToastChange={myceliumLiveAlerts.setHoveredToastId}
        />
      </div>
    </div>
  );
};

function areDispersionMapPropsEqual(
  prev: DispersionMapProps,
  next: DispersionMapProps
): boolean {
  if (
    prev.sources !== next.sources ||
    prev.receptors !== next.receptors ||
    prev.plumeZones !== next.plumeZones ||
    prev.receptorExposures !== next.receptorExposures ||
    prev.currentWeather !== next.currentWeather ||
    prev.isPuffMode !== next.isPuffMode ||
    prev.puff24h !== next.puff24h ||
    prev.observations !== next.observations ||
    prev.selectedObservationId !== next.selectedObservationId ||
    prev.pendingObservationPoint !== next.pendingObservationPoint ||
    prev.selectedSourceId !== next.selectedSourceId ||
    prev.selectedReceptorId !== next.selectedReceptorId ||
    prev.mapClickMode !== next.mapClickMode ||
    prev.isAnimatingPlumeRoute !== next.isAnimatingPlumeRoute ||
    prev.showHeatmapComparison !== next.showHeatmapComparison ||
    prev.heatmapComparison !== next.heatmapComparison ||
    prev.heatmapComparisonViewMode !== next.heatmapComparisonViewMode ||
    prev.weatherHours !== next.weatherHours ||
    prev.comparisonHourAIndex !== next.comparisonHourAIndex ||
    prev.comparisonHourBIndex !== next.comparisonHourBIndex ||
    prev.isFullscreen !== next.isFullscreen ||
    prev.fullscreenLabel !== next.fullscreenLabel ||
    prev.buildings !== next.buildings ||
    prev.activeCategoryFilters !== next.activeCategoryFilters ||
    prev.isMapOnly !== next.isMapOnly ||
    prev.selectedDateIso !== next.selectedDateIso ||
    prev.myceliumSnapshot !== next.myceliumSnapshot ||
    prev.hiddenSourceIds !== next.hiddenSourceIds ||
    prev.visibleSubstances !== next.visibleSubstances ||
    prev.showWindNoiseHeatmap !== next.showWindNoiseHeatmap ||
    prev.showPlumeConcentrationHeatmap !== next.showPlumeConcentrationHeatmap ||
    prev.plumeHeatmapPasquillThreshold !== next.plumeHeatmapPasquillThreshold ||
    prev.showWeatherCorrelationHeatmap !== next.showWeatherCorrelationHeatmap ||
    prev.waterMainTelemetry !== next.waterMainTelemetry ||
    prev.showWaterMainLayer !== next.showWaterMainLayer ||
    prev.showLerBuffer !== next.showLerBuffer ||
    prev.hasSteelRoadPlates !== next.hasSteelRoadPlates ||
    prev.simulatedPipeRuptureActive !== next.simulatedPipeRuptureActive ||
    prev.isS3ValveLockoutActive !== next.isS3ValveLockoutActive ||
    prev.virtualLeakPinPoint !== next.virtualLeakPinPoint ||
    prev.virtualLeakImpact !== next.virtualLeakImpact ||
    prev.simultaneousDispatch !== next.simultaneousDispatch ||
    prev.machineNoiseOutputDb !== next.machineNoiseOutputDb
  ) {
    return false;
  }

  // Only re-render for fractional plumeRouteProgress changes when the 24h plume route animation is active
  if (
    next.isAnimatingPlumeRoute &&
    prev.plumeRouteProgress !== next.plumeRouteProgress
  ) {
    return false;
  }

  if (
    prev.onSelectObservation !== next.onSelectObservation ||
    prev.onSelectSource !== next.onSelectSource ||
    prev.onSelectReceptor !== next.onSelectReceptor ||
    prev.onSetMapClickMode !== next.onSetMapClickMode ||
    prev.onMapAddNode !== next.onMapAddNode ||
    prev.onSelectHourFromPeak !== next.onSelectHourFromPeak ||
    prev.onToggleAnimatePlumeRoute !== next.onToggleAnimatePlumeRoute ||
    prev.onToggleHeatmapComparison !== next.onToggleHeatmapComparison ||
    prev.onChangeHeatmapComparisonViewMode !== next.onChangeHeatmapComparisonViewMode ||
    prev.onChangeComparisonHourA !== next.onChangeComparisonHourA ||
    prev.onChangeComparisonHourB !== next.onChangeComparisonHourB ||
    prev.onToggleFullscreen !== next.onToggleFullscreen ||
    prev.onSaveMapSnapshotObservation !== next.onSaveMapSnapshotObservation ||
    prev.onToggleCategoryFilter !== next.onToggleCategoryFilter ||
    prev.onChangeBuildingCategory !== next.onChangeBuildingCategory ||
    prev.onToggleMapOnly !== next.onToggleMapOnly ||
    prev.onChangeDateIso !== next.onChangeDateIso ||
    prev.onChangeVisibleSubstances !== next.onChangeVisibleSubstances ||
    prev.onToggleWindNoiseHeatmap !== next.onToggleWindNoiseHeatmap ||
    prev.onTogglePlumeConcentrationHeatmap !== next.onTogglePlumeConcentrationHeatmap ||
    prev.onToggleWeatherCorrelationHeatmap !== next.onToggleWeatherCorrelationHeatmap ||
    prev.onToggleWaterMainLayer !== next.onToggleWaterMainLayer ||
    prev.onToggleLerBuffer !== next.onToggleLerBuffer ||
    prev.onToggleSteelRoadPlates !== next.onToggleSteelRoadPlates ||
    prev.onToggleSimulatedPipeRupture !== next.onToggleSimulatedPipeRupture ||
    prev.onToggleS3ValveLockout !== next.onToggleS3ValveLockout ||
    prev.onToggleSourceActive !== next.onToggleSourceActive ||
    prev.onIsolateNearbyMachinery !== next.onIsolateNearbyMachinery ||
    prev.onRestoreAllMachinery !== next.onRestoreAllMachinery ||
    prev.onChangeVirtualLeakPinPoint !== next.onChangeVirtualLeakPinPoint ||
    prev.onLogWaterMainObservation !== next.onLogWaterMainObservation ||
    prev.onAcknowledgeSimultaneousP1 !== next.onAcknowledgeSimultaneousP1 ||
    prev.onOpenSimultaneousModal !== next.onOpenSimultaneousModal
  ) {
    return false;
  }

  return true;
}

export const DispersionMap = memo(DispersionMapComponent, areDispersionMapPropsEqual);
DispersionMap.displayName = 'DispersionMap';
