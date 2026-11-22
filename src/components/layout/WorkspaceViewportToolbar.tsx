import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Box,
  Calendar,
  Camera,
  ChevronDown,
  Clock,
  CloudRain,
  Compass,
  Crosshair,
  Download,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Flame,
  FlaskConical,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  Monitor,
  Pause,
  Pin,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { BUILDING_CATEGORY_METADATA } from '../../data/ringparkenData';
import { exportKierulffsvejWaterMainGeoJson } from '../../data/kierulffsvejWaterMainData';
import { exportKierulffsvejWaterMainEpsg25832GeoJson } from '../../services/waterMainPhysicsService';
import { ALGEDONIC_SCENARIO_SPECS } from '../../services/myceliumSimulationEngine';
import { degreesToCompass, shiftDateIsoByDays } from '../../services/weatherService';
import { downloadGeoJsonSnapshot } from '../../services/geojsonExportService';
import {
  AlgedonicObservation,
  AlgedonicTestScenarioId,
  BuildingOperationalCategory,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  PlumePolygonZone,
  PssMachineInterlockItem,
  ReceptorExposureResult,
  ReceptorZone,
  RingparkenBuildingUnit,
  SimultaneousAlgedonicDispatch,
  SubstanceKey,
  System3InterlockLogEntry,
  WaterMainCoordinateMode,
  WaterMainLiveTelemetry,
} from '../../types/dispersion';
import { WindowInstanceState } from '../DraggableDashboardWindow';
import { NeighborComplaintPressureWaveBanner } from '../NeighborComplaintPressureWaveBanner';
import { SourceQuickSwitchDropdown } from '../SourceQuickSwitchDropdown';
import { InteractiveMapLegend } from './InteractiveMapLegend';
import {
  DeviceEditionSelection,
  OrientationSelection,
  ViewportVisualizationMode,
} from './layoutTypes';

export interface WorkspaceViewportToolbarProps {
  isMapOnlyMode: boolean;
  onSetMapOnlyMode: (val: boolean) => void;
  isFullscreen3D: boolean;
  onToggleFullscreen3D: () => void;
  isMinimizeAllFocusActive: boolean;
  onToggleMinimizeAllExceptMapAndSidebar: () => void;
  effectiveDeviceEdition: 'standard' | 'tablet' | 'mobile';
  effectiveOrientation: 'portrait' | 'landscape';
  liveViewportMetrics: { width: number; height: number };
  deviceEditionSelection: DeviceEditionSelection;
  onSelectDeviceEdition: (ed: DeviceEditionSelection) => void;
  orientationSelection: OrientationSelection;
  onSelectOrientation: (orMode: OrientationSelection) => void;
  currentWeather: HourlyWeatherPoint;
  weatherHours: HourlyWeatherPoint[];
  selectedHourIndex: number;
  onSelectHour: (hr: number) => void;
  observations: AlgedonicObservation[];
  sources: DemolitionSourceNode[];
  selectedSourceId: string | null;
  isManualMachineNoiseOverrideActive: boolean;
  manualMachineNoiseOutputDb: number;
  onSelectReceptor: (recId: string) => void;
  viewportMode: ViewportVisualizationMode;
  onSelectViewportMode: (mode: ViewportVisualizationMode) => void;
  asbestosHeatmapActive: boolean;
  onSetAsbestosHeatmapActive: (val: boolean) => void;
  temporal24hAsbestosAccumulation: boolean;
  onSetTemporal24hAsbestosAccumulation: React.Dispatch<React.SetStateAction<boolean>>;
  showLeewardWakeEffect: boolean;
  onToggleLeewardWakeEffect: () => void;
  showWeatherCorrelationOverlay: boolean;
  onToggleWeatherCorrelationOverlay: () => void;
  selectedDateIso: string;
  todayIso: string;
  onChangeSimulatedDateIso: (nextDateIso: string) => void;
  onStepSimulatedHour: (deltaHours: number) => void;
  onFocusNoiseDustTab: () => void;
  showWorkspaceImpulseSensitivityGraph: boolean;
  onToggleWorkspaceImpulseSensitivityGraph: () => void;
  showWorkspaceVibrationSankey?: boolean;
  onToggleWorkspaceVibrationSankey?: () => void;
  autoSaveEvidenceOnTimeTravel: boolean;
  autoSavedEvidenceCount: number;
  onToggleAutoSaveEvidenceOnTimeTravel: () => void;
  precipitationOverrideMm: number | null;
  plumeDirectionDeg: number;
  mapWindowState: WindowInstanceState;
  onToggleMinimizeMapWindow: () => void;
  onToggleFloatMapWindow: () => void;
  onOpenSourceReceptorModal: () => void;
  buildings: RingparkenBuildingUnit[];
  activeCategoryFilters: BuildingOperationalCategory[];
  onToggleCategoryFilter: (cat: BuildingOperationalCategory) => void;
  onResetCategoryFilters: () => void;
  onApplyBatchBuildingScenario: (
    updater: (prev: RingparkenBuildingUnit[]) => RingparkenBuildingUnit[],
    focusBuildingId?: string
  ) => void;
  onFocusBlok12Percolation3D: () => void;
  onOpenCategoryManagerInSubstances: () => void;
  plumeZones: PlumePolygonZone[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  maxSiteSumQuotient: number;
  onSelectSource: (sourceId: string) => void;
  onToggleSourceActive: (sourceId: string) => void;
  hiddenSourceIds?: string[];
  onToggleSourceVisibility?: (sourceId: string) => void;
  onShowAllSources?: () => void;
  visibleSubstances?: Record<SubstanceKey, boolean>;
  onToggleSubstanceVisibility?: (key: SubstanceKey) => void;
  onSetAllSubstancesVisibility?: (visible: boolean) => void;
  showWindNoiseHeatmap?: boolean;
  onToggleWindNoiseHeatmap?: () => void;
  onQuickSnapshot?: () => Promise<void> | void;
  showPlumeConcentrationHeatmap?: boolean;
  onTogglePlumeConcentrationHeatmap?: () => void;
  plumeHeatmapPasquillThreshold?: number;
  onChangePlumeHeatmapPasquillThreshold?: (nextThreshold: number) => void;
  showWeatherCorrelationHeatmap?: boolean;
  onToggleWeatherCorrelationHeatmap?: () => void;
  isAnimatingPlumeRoute?: boolean;
  onToggleAnimatePlumeRoute?: () => void;
  waterMainTelemetry?: WaterMainLiveTelemetry;
  showWaterMainLayer?: boolean;
  onToggleWaterMainLayer?: () => void;
  hasSteelRoadPlates?: boolean;
  onToggleSteelRoadPlates?: () => void;
  showLerBuffer?: boolean;
  onToggleLerBuffer?: () => void;
  simulatedPipeRuptureActive?: boolean;
  onToggleSimulatedPipeRupture?: () => void;
  waterMainCoordMode?: WaterMainCoordinateMode;
  onChangeWaterMainCoordMode?: (mode: WaterMainCoordinateMode) => void;
  simultaneousDispatch?: SimultaneousAlgedonicDispatch | null;
  manualSimultaneousScenario?: AlgedonicTestScenarioId | null;
  onTriggerSimultaneousScenario?: (
    scenarioId: AlgedonicTestScenarioId,
    openSplitModal?: boolean
  ) => void;
  onOpenSimultaneousModal?: () => void;
  onAcknowledgeSimultaneousP1?: () => void;
  onClearSimultaneousSimulation?: () => void;
  pssInterlocks?: PssMachineInterlockItem[];
  onAcknowledgeAllPssInterlocks?: () => void;
  onResetPssInterlockAck?: () => void;
  pssCollectiveAckAtIso?: string | null;
  system3InterlockLogs?: System3InterlockLogEntry[];
}

export const WorkspaceViewportToolbar: React.FC<WorkspaceViewportToolbarProps> = ({
  isMapOnlyMode,
  onSetMapOnlyMode,
  isFullscreen3D,
  onToggleFullscreen3D,
  isMinimizeAllFocusActive,
  onToggleMinimizeAllExceptMapAndSidebar,
  effectiveDeviceEdition,
  effectiveOrientation,
  liveViewportMetrics,
  deviceEditionSelection,
  onSelectDeviceEdition,
  orientationSelection,
  onSelectOrientation,
  currentWeather,
  weatherHours,
  selectedHourIndex,
  onSelectHour,
  observations,
  sources,
  selectedSourceId,
  isManualMachineNoiseOverrideActive,
  manualMachineNoiseOutputDb,
  onSelectReceptor,
  viewportMode,
  onSelectViewportMode,
  asbestosHeatmapActive,
  onSetAsbestosHeatmapActive,
  temporal24hAsbestosAccumulation,
  onSetTemporal24hAsbestosAccumulation,
  showLeewardWakeEffect,
  onToggleLeewardWakeEffect,
  showWeatherCorrelationOverlay,
  onToggleWeatherCorrelationOverlay,
  selectedDateIso,
  todayIso,
  onChangeSimulatedDateIso,
  onStepSimulatedHour,
  onFocusNoiseDustTab,
  showWorkspaceImpulseSensitivityGraph,
  onToggleWorkspaceImpulseSensitivityGraph,
  showWorkspaceVibrationSankey = true,
  onToggleWorkspaceVibrationSankey,
  autoSaveEvidenceOnTimeTravel,
  autoSavedEvidenceCount,
  onToggleAutoSaveEvidenceOnTimeTravel,
  precipitationOverrideMm,
  plumeDirectionDeg,
  mapWindowState,
  onToggleMinimizeMapWindow,
  onToggleFloatMapWindow,
  onOpenSourceReceptorModal,
  buildings,
  activeCategoryFilters,
  onToggleCategoryFilter,
  onResetCategoryFilters,
  onApplyBatchBuildingScenario,
  onFocusBlok12Percolation3D,
  onOpenCategoryManagerInSubstances,
  plumeZones,
  receptors,
  receptorExposures,
  maxSiteSumQuotient,
  onSelectSource,
  onToggleSourceActive,
  hiddenSourceIds = [],
  onToggleSourceVisibility,
  onShowAllSources,
  visibleSubstances,
  onToggleSubstanceVisibility,
  onSetAllSubstancesVisibility,
  showWindNoiseHeatmap = false,
  onToggleWindNoiseHeatmap,
  onQuickSnapshot,
  showPlumeConcentrationHeatmap = false,
  onTogglePlumeConcentrationHeatmap,
  plumeHeatmapPasquillThreshold: externalPasquillThreshold,
  onChangePlumeHeatmapPasquillThreshold,
  showWeatherCorrelationHeatmap = true,
  onToggleWeatherCorrelationHeatmap,
  isAnimatingPlumeRoute = false,
  onToggleAnimatePlumeRoute,
  waterMainTelemetry,
  showWaterMainLayer = false,
  onToggleWaterMainLayer,
  hasSteelRoadPlates = false,
  onToggleSteelRoadPlates,
  showLerBuffer = true,
  onToggleLerBuffer,
  simulatedPipeRuptureActive = false,
  onToggleSimulatedPipeRupture,
  waterMainCoordMode = 'scene_calibrated',
  onChangeWaterMainCoordMode,
  simultaneousDispatch,
  manualSimultaneousScenario,
  onTriggerSimultaneousScenario,
  onOpenSimultaneousModal,
  onAcknowledgeSimultaneousP1,
  onClearSimultaneousSimulation,
  pssInterlocks = [],
  onAcknowledgeAllPssInterlocks,
  onResetPssInterlockAck,
  pssCollectiveAckAtIso = null,
  system3InterlockLogs = [],
}) => {
  const [isLayersPopoverOpen, setIsLayersPopoverOpen] = useState(false);
  const [isScreenEditionPopoverOpen, setIsScreenEditionPopoverOpen] = useState(false);
  const [isWhatIfPopoverOpen, setIsWhatIfPopoverOpen] = useState(false);
  const [isVisibilityPopoverOpen, setIsVisibilityPopoverOpen] = useState(false);
  const [isSubstanceMenuOpen, setIsSubstanceMenuOpen] = useState(false);
  const [isSimultaneousPopoverOpen, setIsSimultaneousPopoverOpen] = useState(false);
  const [geoJsonSavedCount, setGeoJsonSavedCount] = useState<number | null>(null);
  const [waterMainGeoJsonCount, setWaterMainGeoJsonCount] = useState<number | null>(null);
  const [epsg25832GeoJsonCount, setEpsg25832GeoJsonCount] = useState<number | null>(null);
  const [isSystem3InterlockLogOpen, setIsSystem3InterlockLogOpen] = useState<boolean>(false);
  const [copiedInterlockLogId, setCopiedInterlockLogId] = useState<string | null>(null);
  const [isQuickSnapshotSaving, setIsQuickSnapshotSaving] = useState<boolean>(false);
  const [quickSnapshotSavedJustNow, setQuickSnapshotSavedJustNow] = useState<boolean>(false);
  const [internalPasquillThreshold, setInternalPasquillThreshold] = useState<number>(0.25);
  const effectivePasquillThreshold =
    externalPasquillThreshold !== undefined ? externalPasquillThreshold : internalPasquillThreshold;
  const handleSetPasquillThreshold = (nextVal: number) => {
    const clamped = Number(Math.max(0.1, Math.min(1.0, nextVal)).toFixed(2));
    if (onChangePlumeHeatmapPasquillThreshold) {
      onChangePlumeHeatmapPasquillThreshold(clamped);
    } else {
      setInternalPasquillThreshold(clamped);
    }
  };
  const hiddenSourceSet = new Set(hiddenSourceIds);
  const visibleSourceCount = Math.max(0, sources.length - hiddenSourceIds.length);
  const substanceKeysList: SubstanceKey[] = ['asbestos', 'pcb', 'heavyMetals', 'quartzWool', 'moldSewer'];
  const visibleSubstanceCount = visibleSubstances
    ? substanceKeysList.filter((k) => Boolean(visibleSubstances[k])).length
    : 5;

  const activeSrc =
    sources.find((s) => s.id === selectedSourceId) ||
    sources.find((s) => s.active) ||
    sources[0];
  const effMachineDb = isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114;
  const isDaytimeHr = currentWeather.hourIndex >= 7 && currentWeather.hourIndex < 18;
  const isEveningHr = currentWeather.hourIndex >= 18 && currentWeather.hourIndex < 22;
  const hrLimitDb = isDaytimeHr ? 70.0 : isEveningHr ? 45.0 : 40.0;
  const hrImpulseLimitDb = isDaytimeHr ? 85.0 : 55.0;
  const estReceptorLaeqDb = Number(
    (effMachineDb - 36.3 + Math.min(4.3, currentWeather.windSpeed10m * 0.34)).toFixed(1)
  );
  const estImpulsePeakDb = Number((estReceptorLaeqDb + 15.2).toFixed(1));
  const exceedanceDb = Number(
    Math.max(estReceptorLaeqDb - hrLimitDb, estImpulsePeakDb - hrImpulseLimitDb).toFixed(1)
  );
  const isNoiseExceeded = Boolean(activeSrc?.active) && exceedanceDb > 0;

  return (
    <>
      {/* CSS Pressure-Wave Propagation per Neighbor Block when Wind Speed > 10 m/s */}
      {!isMapOnlyMode && !isFullscreen3D && !isMinimizeAllFocusActive && (
        <NeighborComplaintPressureWaveBanner
          currentWeather={currentWeather}
          weatherHours={weatherHours}
          selectedHourIndex={selectedHourIndex}
          onSelectHour={onSelectHour}
          observations={observations}
          activeSourceLabel={activeSrc?.name.split('—')[0].trim() || 'Nedrivningskilde'}
          effectiveMachineDb={effMachineDb}
          onSelectReceptor={onSelectReceptor}
        />
      )}

      {/* ROW 1: CALM SEGMENTED VISUALIZATION BAR & PRIMARY WORKSPACE ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#151C28] border-b border-[#253042] font-mono text-[11px] tabular-nums shrink-0">
        {/* Segmented Visualization Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-[#1B2433] border border-[#2D3B50] rounded-md p-0.5">
          {(
            [
              { id: '3d', label: '3D Digital Tvilling', icon: Box },
              { id: '2d', label: '2D Taktisk Kort', icon: MapPin },
              { id: 'risk_gis', label: 'GIS Risikokort', icon: Compass },
              { id: 'split', label: 'Split 2D + 3D', icon: Layers },
              { id: 'underground_3d', label: '3D Perkolation', icon: Droplets },
              { id: 'underground_2d', label: '2D Perkolation', icon: CloudRain },
              { id: 'underground_split', label: '2D+3D Grundvand', icon: Layers },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = viewportMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectViewportMode(id)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-[#212C3E]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Date/Hour, Temporal Toggle, 3D Lag & Skærm Popover, Minimize/Selector/MapOnly */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Date & Hour Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1B2433] border border-[#2D3B50] text-slate-200"
            title={`Simuleret Dato & Klokkeslæt: ${selectedDateIso} kl. ${currentWeather.hourLabel}`}
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {isFullscreen3D || isMapOnlyMode ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChangeSimulatedDateIso(shiftDateIsoByDays(selectedDateIso, -1))}
                  className="px-1.5 py-0.5 rounded bg-[#151C28] hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-semibold text-cyan-200 border border-[#2D3B50] cursor-pointer"
                >
                  −1d
                </button>
                <input
                  type="date"
                  value={selectedDateIso}
                  onChange={(e) => {
                    if (e.target.value) onChangeSimulatedDateIso(e.target.value);
                  }}
                  aria-label="Ændr dato i Fuld skærm eller Kun Kort"
                  className="bg-transparent text-slate-100 font-bold text-[11px] focus:outline-none cursor-pointer [color-scheme:dark]"
                />
                <button
                  type="button"
                  onClick={() => onChangeSimulatedDateIso(shiftDateIsoByDays(selectedDateIso, 1))}
                  className="px-1.5 py-0.5 rounded bg-[#151C28] hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-semibold text-cyan-200 border border-[#2D3B50] cursor-pointer"
                >
                  +1d
                </button>
                <button
                  type="button"
                  onClick={() => onChangeSimulatedDateIso(todayIso)}
                  className="px-1.5 py-0.5 rounded bg-[#151C28] hover:bg-amber-400 hover:text-slate-950 text-[11px] font-semibold text-amber-200 border border-[#2D3B50] cursor-pointer"
                >
                  I dag
                </button>
              </div>
            ) : (
              <span className="font-semibold text-slate-100 whitespace-nowrap">{selectedDateIso}</span>
            )}
            <span className="text-slate-500">·</span>
            <span className="font-bold text-amber-300 whitespace-nowrap">
              kl. {currentWeather.hourLabel}
            </span>
            {(isFullscreen3D || isMapOnlyMode) && (
              <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-[#2D3B50]">
                <button
                  type="button"
                  onClick={() => onStepSimulatedHour(-1)}
                  className="px-1.5 py-0.5 rounded bg-[#151C28] hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-semibold text-cyan-200 border border-[#2D3B50] cursor-pointer"
                >
                  −1t
                </button>
                <button
                  type="button"
                  onClick={() => onStepSimulatedHour(1)}
                  className="px-1.5 py-0.5 rounded bg-[#151C28] hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-semibold text-cyan-200 border border-[#2D3B50] cursor-pointer"
                >
                  +1t
                </button>
              </div>
            )}
          </div>

          {/* Mandatory Temporal Accumulation Toggle Contract */}
          <button
            type="button"
            data-temporal-accumulation-toggle="true"
            onClick={() => {
              if (!asbestosHeatmapActive) {
                onSetAsbestosHeatmapActive(true);
              }
              if (viewportMode !== '3d' && viewportMode !== 'split') {
                onSelectViewportMode('3d');
              }
              onSetTemporal24hAsbestosAccumulation((prev) => !prev);
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              temporal24hAsbestosAccumulation && asbestosHeatmapActive
                ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-100 font-bold'
                : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
            }`}
            title="Skift dynamisk mellem Øjebliksbillede (realtids fibre/cm³) og 24-timers kumulativ eksponeringsrisiko (fibre/cm³·t)"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              Tidsmæssig Akkumulering:{' '}
              {temporal24hAsbestosAccumulation
                ? '24t Kumulativ Risiko'
                : `Øjebliksbillede (kl. ${currentWeather.hourLabel})`}
            </span>
          </button>

          {/* Direct 1-Click Impulsstøjs-Følsomhed Toggle */}
          <button
            type="button"
            onClick={onToggleWorkspaceImpulseSensitivityGraph}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showWorkspaceImpulseSensitivityGraph
                ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
            }`}
            title="Åbn/skjul Impulsstøjs-Følsomhed (v > 10 m/s ↔ L_Aeq,korr & Time-Overskridelser)"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Impulsstøjs-Følsomhed</span>
          </button>

          {/* Discreet Screen-Icon Settings Popover for Auto-Bredde / Enhedsudgave */}
          <div className="relative">
            <button
              type="button"
              data-testid="screen-edition-settings-popover-btn"
              onClick={() => {
                setIsScreenEditionPopoverOpen((v) => !v);
                setIsLayersPopoverOpen(false);
              }}
              className={`px-2 py-1 rounded border font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                isScreenEditionPopoverOpen ||
                deviceEditionSelection !== 'auto' ||
                orientationSelection !== 'auto'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
                  : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
              }`}
              title={`Auto-Bredde / Enhedsudgave (${
                effectiveDeviceEdition === 'mobile'
                  ? 'Mobil'
                  : effectiveDeviceEdition === 'tablet'
                  ? 'Tablet'
                  : 'Standard'
              } · ${effectiveOrientation === 'portrait' ? 'Stående' : 'Liggende'} · ${
                liveViewportMetrics.width
              }×${liveViewportMetrics.height}px)`}
              aria-label="Auto-Bredde og Enhedsudgave indstillinger"
            >
              <Monitor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden 2xl:inline">Enhed</span>
            </button>

            {isScreenEditionPopoverOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-[330px] max-w-[92vw] rounded-lg bg-[#212C3E] border border-[#36465E] shadow-2xl p-3 space-y-2.5 z-50 text-[11px]">
                <div className="flex items-center justify-between border-b border-[#36465E] pb-1.5">
                  <span className="font-bold uppercase text-slate-200 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Auto-Bredde / Enhedsudgave</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsScreenEditionPopoverOpen(false)}
                    className="text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Luk</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between px-2 py-1 rounded bg-[#151C28] border border-[#2D3B50] text-slate-300">
                  <span>Aktiv skærm:</span>
                  <span className="text-cyan-300 font-semibold">
                    {effectiveDeviceEdition === 'mobile'
                      ? 'Mobil'
                      : effectiveDeviceEdition === 'tablet'
                      ? 'Tablet'
                      : 'Standard'}{' '}
                    · {effectiveOrientation === 'portrait' ? 'Stående' : 'Liggende'} (
                    {liveViewportMetrics.width}×{liveViewportMetrics.height}px)
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 uppercase block">Enhedsudgave</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'auto', label: 'Auto' },
                        { id: 'standard', label: 'Standard' },
                        { id: 'tablet', label: 'Tablet' },
                        { id: 'mobile', label: 'Mobil' },
                      ] as const
                    ).map((ed) => (
                      <button
                        key={ed.id}
                        type="button"
                        onClick={() => onSelectDeviceEdition(ed.id)}
                        className={`px-2 py-1 rounded border font-semibold cursor-pointer ${
                          deviceEditionSelection === ed.id
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                            : 'bg-[#151C28] text-slate-300 border-[#2D3B50] hover:text-white'
                        }`}
                      >
                        {ed.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 uppercase block">Skærmretning</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'auto', label: 'Auto-Retning' },
                        { id: 'portrait', label: 'Stående' },
                        { id: 'landscape', label: 'Liggende' },
                      ] as const
                    ).map((orMode) => (
                      <button
                        key={orMode.id}
                        type="button"
                        onClick={() => onSelectOrientation(orMode.id)}
                        className={`px-2 py-1 rounded border font-semibold cursor-pointer ${
                          orientationSelection === orMode.id
                            ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                            : 'bg-[#151C28] text-slate-300 border-[#2D3B50] hover:text-white'
                        }`}
                      >
                        {orMode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Consolidated 3D Lag & Akustik Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsLayersPopoverOpen((v) => !v);
                setIsScreenEditionPopoverOpen(false);
              }}
              className="px-2.5 py-1 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="3D-lag (Asbest Heatmap, Læ-effekt, Vejr-korrelation, Impuls-støj) og Vindues-styring"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>3D Lag</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isLayersPopoverOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-[390px] max-w-[92vw] rounded-lg bg-[#212C3E] border border-[#36465E] shadow-2xl p-3 space-y-2.5 z-50 text-[11px]">
                <div className="font-bold uppercase text-slate-300 border-b border-[#36465E] pb-1">
                  3D Miljø- &amp; Støj-Lag
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleLeewardWakeEffect}
                    className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                      showLeewardWakeEffect
                        ? 'bg-amber-500/20 border-amber-400/70 text-amber-100 font-semibold'
                        : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-amber-400" />
                      <span>Læ-Effekt (Vindstille Recirkulations-Zoner)</span>
                    </span>
                    <span>{showLeewardWakeEffect ? 'AKTIV' : 'FRA'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleWeatherCorrelationOverlay}
                    className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                      showWeatherCorrelationOverlay
                        ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-100 font-semibold'
                        : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Vis Vejr-Korrelation i 3D-Rummet</span>
                    </span>
                    <span>{showWeatherCorrelationOverlay ? 'AKTIV' : 'FRA'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onFocusNoiseDustTab();
                      setIsLayersPopoverOpen(false);
                    }}
                    className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                      isNoiseExceeded
                        ? 'bg-rose-950/60 border-rose-500/60 text-rose-200 font-semibold'
                        : 'bg-[#151C28] border-[#2D3B50] text-emerald-300 hover:bg-[#1B2433]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                      <span>3D Impuls-Støjbølger ({effMachineDb} dB)</span>
                    </span>
                    <span>
                      {isNoiseExceeded
                        ? `+${exceedanceDb} dB OVER`
                        : `OK (${estReceptorLaeqDb}/${hrLimitDb} dB)`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleWorkspaceImpulseSensitivityGraph}
                    className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                      showWorkspaceImpulseSensitivityGraph
                        ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-100 font-semibold'
                        : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Impulsstøjs-Følsomhed (v &gt; 10 m/s)</span>
                    </span>
                    <span>{showWorkspaceImpulseSensitivityGraph ? 'AKTIV' : 'SKJULT'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleAutoSaveEvidenceOnTimeTravel}
                    className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                      autoSaveEvidenceOnTimeTravel
                        ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-100 font-semibold'
                        : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                    }`}
                  >
                    <span>Auto gem beviser (SHA-256)</span>
                    <span>
                      {autoSaveEvidenceOnTimeTravel ? `TIL (${autoSavedEvidenceCount})` : 'FRA'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAsbestosHeatmapActive(!asbestosHeatmapActive)}
                    className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                      asbestosHeatmapActive
                        ? 'bg-rose-500/20 border-rose-400/70 text-rose-100 font-semibold'
                        : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                    }`}
                  >
                    <span>3D Asbest-Fiber Heatmap</span>
                    <span>{asbestosHeatmapActive ? 'AKTIV' : 'FRA'}</span>
                  </button>

                  {onToggleWorkspaceVibrationSankey && (
                    <button
                      type="button"
                      data-testid="layers-popover-vibration-sankey-toggle"
                      onClick={onToggleWorkspaceVibrationSankey}
                      className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                        showWorkspaceVibrationSankey
                          ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-100 font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Vibrations-Sankey (Maskiner → Fundamenter)</span>
                      </span>
                      <span>{showWorkspaceVibrationSankey ? 'AKTIV' : 'SKJULT'}</span>
                    </button>
                  )}

                  {onToggleWindNoiseHeatmap && (
                    <button
                      type="button"
                      onClick={onToggleWindNoiseHeatmap}
                      className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                        showWindNoiseHeatmap
                          ? 'bg-amber-500/25 border-amber-400/75 text-amber-100 font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Vis Vind-Støj Korrelation (Varmekort)</span>
                      </span>
                      <span>{showWindNoiseHeatmap ? 'AKTIV' : 'FRA'}</span>
                    </button>
                  )}

                  {onToggleWeatherCorrelationHeatmap && (
                    <button
                      type="button"
                      data-testid="layers-popover-weather-correlation-heatmap-toggle"
                      onClick={onToggleWeatherCorrelationHeatmap}
                      className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                        showWeatherCorrelationHeatmap
                          ? 'bg-orange-500/25 border-orange-400/80 text-orange-100 font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Wind className="w-3.5 h-3.5 text-orange-400" />
                        <span>Vejr-Korrelations Heatmap (6t r &gt; 0,8)</span>
                      </span>
                      <span>{showWeatherCorrelationHeatmap ? 'AKTIV' : 'FRA'}</span>
                    </button>
                  )}

                  {onToggleWaterMainLayer && (
                    <button
                      type="button"
                      data-testid="layers-popover-water-main-toggle"
                      onClick={onToggleWaterMainLayer}
                      className={`px-2.5 py-1.5 rounded border text-left flex items-center justify-between cursor-pointer ${
                        showWaterMainLayer
                          ? 'bg-sky-500/25 border-sky-400/80 text-sky-100 font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5 text-sky-400" />
                        <span>Drikkevands Hovedrør (2D &amp; 3D Lag)</span>
                      </span>
                      <span>{showWaterMainLayer ? 'AKTIV' : 'FRA'}</span>
                    </button>
                  )}
                </div>

                {!isMapOnlyMode && (
                  <div className="pt-2 border-t border-[#36465E] flex items-center justify-between gap-2">
                    <span className="text-slate-400">
                      Nedbør:{' '}
                      <strong className="text-cyan-300">
                        {(precipitationOverrideMm !== null
                          ? precipitationOverrideMm
                          : currentWeather.precipitation
                        ).toFixed(1)}{' '}
                        mm/t
                      </strong>{' '}
                      · Fane {plumeDirectionDeg}° ({degreesToCompass(plumeDirectionDeg)})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={onToggleMinimizeMapWindow}
                        className="px-2 py-1 rounded bg-[#151C28] hover:bg-[#1B2433] border border-[#2D3B50] text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Minimize2 className="w-3 h-3" />
                        <span>{mapWindowState.isMinimized ? 'Gendan Kort' : 'Minimer'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onToggleFloatMapWindow}
                        className="px-2 py-1 rounded bg-[#151C28] hover:bg-[#1B2433] border border-[#2D3B50] text-cyan-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {mapWindowState.isFloating ? (
                          <Pin className="w-3 h-3" />
                        ) : (
                          <ExternalLink className="w-3 h-3" />
                        )}
                        <span>{mapWindowState.isFloating ? 'Fastgør' : 'Frigiv'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isMapOnlyMode ? (
            <>
              <button
                type="button"
                data-testid="workspace-minimize-all-btn"
                aria-label={
                  isMinimizeAllFocusActive
                    ? 'Gendan alle minimerede paneler'
                    : 'Minimer alle sekundære paneler og bevar kort samt højre kolonne'
                }
                onClick={onToggleMinimizeAllExceptMapAndSidebar}
                className={`p-1.5 rounded text-[11px] font-semibold transition-colors flex items-center justify-center border cursor-pointer shrink-0 ${
                  isMinimizeAllFocusActive
                    ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                    : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                }`}
                title="Minimer alle, med undtagelse af kort & relevant indhold i højre kolonne"
              >
                {isMinimizeAllFocusActive ? (
                  <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
              </button>

              <SourceQuickSwitchDropdown
                sources={sources}
                selectedSourceId={selectedSourceId}
                onSelectSource={onSelectSource}
                onToggleSourceActive={onToggleSourceActive}
                hiddenSourceIds={hiddenSourceIds}
                onToggleSourceVisibility={onToggleSourceVisibility}
                onShowAllSources={onShowAllSources}
                onOpenFullModal={onOpenSourceReceptorModal}
                searchable
                defaultFilter="all"
                align="right"
                buttonTestId="toolbar-source-quick-switch-btn"
                menuTestId="toolbar-source-quick-switch-menu"
                searchInputTestId="toolbar-source-quick-switch-search"
                labelPrefix="Quick Switch:"
                title="Hurtig-skift mellem individuelle kildenoder og slå kilder til/fra uden at åbne fuld dialog"
              />

              {onToggleSourceVisibility && (
                <div className="relative">
                  <button
                    type="button"
                    data-testid="toolbar-source-visibility-btn"
                    onClick={() => {
                      setIsVisibilityPopoverOpen((v) => !v);
                      setIsSubstanceMenuOpen(false);
                      setIsLayersPopoverOpen(false);
                      setIsScreenEditionPopoverOpen(false);
                      setIsWhatIfPopoverOpen(false);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap shrink-0 ${
                      hiddenSourceIds.length > 0
                        ? 'bg-amber-500/20 border-amber-400/70 text-amber-100 font-bold'
                        : isVisibilityPopoverOpen
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 font-bold'
                        : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                    }`}
                    title="Skjul/vis individuelle nedrivningskilder på kortet uden at fjerne dem fra simuleringen"
                    aria-expanded={isVisibilityPopoverOpen}
                    aria-haspopup="menu"
                  >
                    {hiddenSourceIds.length > 0 ? (
                      <EyeOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}
                    <span>
                      Kilde-synlighed ({visibleSourceCount}/{sources.length})
                    </span>
                  </button>

                  {isVisibilityPopoverOpen && (
                    <div
                      data-testid="toolbar-source-visibility-menu"
                      role="menu"
                      aria-label="Kilde-synlighed uden ændring af simulering"
                      className="absolute right-0 top-full mt-1.5 w-[350px] max-w-[92vw] rounded-lg bg-[#161F2E] border border-cyan-500/55 shadow-2xl p-2.5 z-[90] font-mono text-[11px] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[#2D3B50] pb-1.5">
                        <div>
                          <div className="font-bold text-slate-100 uppercase">
                            Visuel Kilde-Synlighed
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Skjuler noder visuelt — bevares aktivt i simuleringen
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsVisibilityPopoverOpen(false)}
                          className="text-slate-400 hover:text-white cursor-pointer p-0.5"
                          aria-label="Luk kilde-synlighed"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                        {sources.map((src) => {
                          const isHidden = hiddenSourceSet.has(src.id);
                          return (
                            <button
                              key={src.id}
                              type="button"
                              data-testid={`toolbar-visibility-node-${src.id}`}
                              onClick={() => onToggleSourceVisibility(src.id)}
                              aria-pressed={!isHidden}
                              className={`w-full px-2 py-1.5 rounded border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                isHidden
                                  ? 'bg-[#0B0F19] border-amber-500/40 text-slate-400'
                                  : 'bg-[#0F1623] border-[#253042] hover:border-cyan-400/60 text-slate-100'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-cyan-300 shrink-0">
                                    {src.code}
                                  </span>
                                  <span className="truncate font-semibold">
                                    {src.name.split('—')[0].trim()}
                                  </span>
                                  {!src.active && (
                                    <span className="text-[11px] text-slate-500 shrink-0">
                                      (Inaktiv)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {isHidden
                                    ? 'Skjult på kort (stadig medregnet i S-beregning)'
                                    : 'Synlig på 2D/3D-kort og i faner'}
                                </div>
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded border inline-flex items-center gap-1 text-[11px] font-bold shrink-0 ${
                                  isHidden
                                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                                    : 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                                }`}
                              >
                                {isHidden ? (
                                  <>
                                    <EyeOff className="w-3 h-3" />
                                    <span>Skjult</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3" />
                                    <span>Synlig</span>
                                  </>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-1.5 border-t border-[#2D3B50] flex items-center justify-between gap-2">
                        <span className="text-slate-400">
                          {visibleSourceCount} af {sources.length} synlige
                        </span>
                        {hiddenSourceIds.length > 0 && onShowAllSources && (
                          <button
                            type="button"
                            onClick={onShowAllSources}
                            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Vis alle ({sources.length})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Substance Visibility Toggle Menu */}
              {visibleSubstances && onToggleSubstanceVisibility && onSetAllSubstancesVisibility && (
                <div className="relative">
                  <button
                    type="button"
                    data-testid="toolbar-substance-visibility-btn"
                    onClick={() => {
                      setIsSubstanceMenuOpen((v) => !v);
                      setIsVisibilityPopoverOpen(false);
                      setIsLayersPopoverOpen(false);
                      setIsScreenEditionPopoverOpen(false);
                      setIsWhatIfPopoverOpen(false);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap shrink-0 ${
                      visibleSubstanceCount < 5
                        ? 'bg-amber-500/20 border-amber-400/70 text-amber-100 font-bold'
                        : isSubstanceMenuOpen
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 font-bold'
                        : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                    }`}
                    title="Stof-synlighed: Filtrér aktive spredningsfaner pr. forureningskategori for at rydde op på kortet"
                    aria-expanded={isSubstanceMenuOpen}
                    aria-haspopup="menu"
                  >
                    <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Stof-synlighed ({visibleSubstanceCount}/5)</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>

                  {isSubstanceMenuOpen && (
                    <div
                      data-testid="toolbar-substance-visibility-menu"
                      role="menu"
                      aria-label="Stof-synlighed (Substance Visibility)"
                      className="absolute right-0 top-full mt-1.5 w-[360px] max-w-[92vw] rounded-lg bg-[#161F2E] border border-cyan-500/55 shadow-2xl p-2.5 z-[90] font-mono text-[11px] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[#2D3B50] pb-1.5">
                        <div>
                          <div className="font-bold text-slate-100 uppercase">
                            Stof-Synlighed (Fanefilter)
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Filtrér aktive fanelag pr. forureningskategori
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsSubstanceMenuOpen(false)}
                          className="text-slate-400 hover:text-white cursor-pointer p-0.5"
                          aria-label="Luk stof-synlighed"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {(
                          [
                            {
                              key: 'asbestos',
                              label: 'Asbest (Asbestos)',
                              desc: 'Respirable fibre & ydre asbest-fanelag',
                              dotClass: 'bg-emerald-400',
                            },
                            {
                              key: 'pcb',
                              label: 'PCB',
                              desc: 'Fugemasser, sekundær fane & gasfase',
                              dotClass: 'bg-purple-400',
                            },
                            {
                              key: 'heavyMetals',
                              label: 'Tungmetaller (Pb / Heavy Metals)',
                              desc: 'Blystøv, partikel-nedfald & overfladelag',
                              dotClass: 'bg-amber-400',
                            },
                            {
                              key: 'quartzWool',
                              label: 'Kvartsuld (Quartz Wool)',
                              desc: 'Mineraluld (<1997) & kvartsstøv',
                              dotClass: 'bg-cyan-400',
                            },
                            {
                              key: 'moldSewer',
                              label: 'Skimmel & Kloak (Mold/Sewer)',
                              desc: 'Krybekælder-sporer & hydrologisk runoff',
                              dotClass: 'bg-lime-400',
                            },
                          ] as const
                        ).map((item) => {
                          const isChecked = Boolean(visibleSubstances[item.key]);
                          const matchingPlumeCount = plumeZones.filter((z) => {
                            const matchedSrc = sources.find(
                              (s) => s.id === z.sourceId || z.id.includes(s.id)
                            );
                            return matchedSrc ? matchedSrc.substances.includes(item.key) : false;
                          }).length;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              role="menuitemcheckbox"
                              aria-checked={isChecked}
                              data-testid={`toolbar-substance-toggle-${item.key}`}
                              onClick={() => onToggleSubstanceVisibility(item.key)}
                              className={`w-full px-2 py-1.5 rounded border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-[#0F1623] border-[#2D3B50] hover:border-cyan-400/60 text-slate-100'
                                  : 'bg-[#0B0F19] border-amber-500/35 text-slate-500 opacity-75 hover:opacity-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  readOnly
                                  tabIndex={-1}
                                  className="accent-cyan-400 w-3.5 h-3.5 shrink-0 pointer-events-none"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 font-semibold">
                                    <span
                                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.dotClass}`}
                                      aria-hidden="true"
                                    />
                                    <span className="truncate">{item.label}</span>
                                    <span className="text-[11px] text-slate-400 font-normal shrink-0">
                                      ({matchingPlumeCount} faner)
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {item.desc}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[11px] font-bold shrink-0 ${
                                  isChecked
                                    ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                                    : 'bg-slate-900 border-slate-700 text-slate-400'
                                }`}
                              >
                                {isChecked ? 'SYN' : 'SKJULT'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-1.5 border-t border-[#2D3B50] flex flex-wrap items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSetAllSubstancesVisibility(true)}
                          className="px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 font-semibold cursor-pointer"
                        >
                          Vis alle (5)
                        </button>
                        <button
                          type="button"
                          data-testid="toolbar-substance-critical-only-btn"
                          onClick={() => {
                            const criticalTargets: Record<SubstanceKey, boolean> = {
                              asbestos: true,
                              pcb: true,
                              heavyMetals: true,
                              quartzWool: false,
                              moldSewer: false,
                            };
                            (Object.keys(criticalTargets) as SubstanceKey[]).forEach((k) => {
                              if (Boolean(visibleSubstances[k]) !== criticalTargets[k]) {
                                onToggleSubstanceVisibility(k);
                              }
                            });
                          }}
                          className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 font-semibold cursor-pointer"
                          title="Vis kun Asbest, PCB og Tungmetaller for at rydde kortet for sekundære stoffer"
                        >
                          Kun Kritiske (3)
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetAllSubstancesVisibility(false)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold cursor-pointer"
                        >
                          Skjul alle (0)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Show Wind-Noise Correlation Heatmap Toggle */}
              {onToggleWindNoiseHeatmap && (
                <button
                  type="button"
                  data-testid="toolbar-wind-noise-correlation-btn"
                  onClick={onToggleWindNoiseHeatmap}
                  aria-pressed={showWindNoiseHeatmap}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap shrink-0 ${
                    showWindNoiseHeatmap
                      ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold shadow-xs'
                      : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                  }`}
                  title={`Vis Vind-Støj Korrelation: Plotter akustisk støj-varmekort på kortet ud fra kl. ${currentWeather.hourLabel} (${Math.round(
                    currentWeather.windDirection10m
                  )}°, ${currentWeather.windSpeed10m.toFixed(1)} m/s)`}
                >
                  <Volume2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      showWindNoiseHeatmap ? 'text-slate-950' : 'text-amber-400'
                    }`}
                  />
                  <span>Vind-Støj Korrelation ({Math.round(currentWeather.windDirection10m)}°)</span>
                </button>
              )}

              {/* Show Plume Concentration Heatmap Toggle */}
              {onTogglePlumeConcentrationHeatmap && (
                <button
                  type="button"
                  data-testid="toolbar-plume-concentration-heatmap-btn"
                  onClick={onTogglePlumeConcentrationHeatmap}
                  aria-pressed={showPlumeConcentrationHeatmap}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap shrink-0 ${
                    showPlumeConcentrationHeatmap
                      ? 'bg-rose-500 text-white border-rose-300 font-bold shadow-xs'
                      : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                  }`}
                  title={`Show Plume Concentration Heatmap: Adskiller visuelt højkoncentrations-faneområder fra simulation.plumeZones (rød/orange/gul) og sikre zoner (grøn S < ${effectivePasquillThreshold.toFixed(
                    2
                  )})`}
                >
                  <Flame
                    className={`w-3.5 h-3.5 shrink-0 ${
                      showPlumeConcentrationHeatmap ? 'text-amber-200' : 'text-rose-400'
                    }`}
                  />
                  <span>
                    Koncentrations-Heatmap ({plumeZones.length}
                    {showPlumeConcentrationHeatmap
                      ? ` · T=${effectivePasquillThreshold.toFixed(2)}`
                      : ''}
                    )
                  </span>
                </button>
              )}

              {/* Automated 24h Cumulative Plume-Path Animation Sequence Toggle */}
              {onToggleAnimatePlumeRoute && (
                <button
                  type="button"
                  data-testid="toolbar-animate-24h-plume-path-btn"
                  onClick={onToggleAnimatePlumeRoute}
                  aria-pressed={isAnimatingPlumeRoute}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap shrink-0 ${
                    isAnimatingPlumeRoute
                      ? 'bg-cyan-400 text-slate-950 border-white font-bold shadow-xs animate-pulse'
                      : 'bg-[#1B2433] hover:bg-[#212C3E] text-cyan-200 border-cyan-500/50'
                  }`}
                  title="24t Kumulativ Plume-Path Auto-Sekvens: Gennemspiller automatisk døgnets 24-timers vindvektor-historik og viser alarm ved krydsning af højtætheds-receptorzoner"
                >
                  {isAnimatingPlumeRoute ? (
                    <>
                      <Pause className="w-3.5 h-3.5 shrink-0" />
                      <span>Stop 24t Plume-Path ({currentWeather.hourLabel})</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Animér 24t Plume-Path</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                data-testid="workspace-source-receptor-selector-btn"
                aria-label="Valg af kilder og Receptorer"
                onClick={onOpenSourceReceptorModal}
                className="p-1.5 rounded text-[11px] font-semibold transition-colors flex items-center justify-center border bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50] cursor-pointer shrink-0"
                title="Valg af kilder & Receptorer — Aktivér/deaktivér kilder og vælg målereceptorer"
              >
                <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </button>

              {/* Algedonisk Simultan-Simulering (S1 + S3) Toolbar Button + 3-Scenario Menu */}
              {onTriggerSimultaneousScenario && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    data-testid="toolbar-simultaneous-algedonic-btn"
                    onClick={() => {
                      setIsSimultaneousPopoverOpen((v) => !v);
                      setIsVisibilityPopoverOpen(false);
                      setIsSubstanceMenuOpen(false);
                      setIsLayersPopoverOpen(false);
                      setIsScreenEditionPopoverOpen(false);
                    }}
                    aria-expanded={isSimultaneousPopoverOpen}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap shrink-0 ${
                      simultaneousDispatch?.isBlinkingP1
                        ? 'bg-rose-600 hover:bg-rose-500 text-white border-amber-300 animate-pulse shadow-md'
                        : simultaneousDispatch?.active
                        ? 'bg-rose-900 hover:bg-rose-800 text-rose-100 border-rose-400'
                        : 'bg-[#1B2433] hover:bg-[#212C3E] text-cyan-200 border-cyan-500/45'
                    }`}
                    title="Algedonisk Simultan-Simulering (S1 + S3): Samtidig aktivering af System 1 (evakuering/Ø-drift) og System 3 (ventillås, PSS-stop & tankvognskorridorer) ved T1 (Δt = 0 ms)"
                  >
                    <AlertOctagon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        simultaneousDispatch?.active ? 'text-amber-200' : 'text-cyan-400'
                      }`}
                    />
                    <span>Algedonisk Simultan-Simulering (S1 + S3)</span>
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>

                  {isSimultaneousPopoverOpen && (
                    <div
                      data-testid="toolbar-simultaneous-algedonic-menu"
                      className="absolute right-0 top-full mt-1.5 w-[370px] max-w-[92vw] rounded-lg bg-[#0F1623] border border-rose-500/70 shadow-2xl p-3 z-[90] font-mono text-[11px] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-rose-200 uppercase flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                          <span>Test-scenarier (S1 + S3 Atomar T1)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsSimultaneousPopoverOpen(false)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                          aria-label="Luk simultan-simulering menu"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {(
                          [
                            'kierulffsvej_eternit_rupture',
                            'asbestos_plume_cav_vacuum',
                            'combined_vibration_rupture_plume',
                          ] as AlgedonicTestScenarioId[]
                        ).map((scenId) => {
                          const spec = ALGEDONIC_SCENARIO_SPECS[scenId];
                          const isSelected = manualSimultaneousScenario === scenId;
                          return (
                            <button
                              key={scenId}
                              type="button"
                              data-testid={`toolbar-sim-scenario-${scenId}`}
                              onClick={() => {
                                onTriggerSimultaneousScenario(scenId, true);
                                setIsSimultaneousPopoverOpen(false);
                              }}
                              className={`w-full p-2 rounded border text-left transition-colors cursor-pointer space-y-0.5 ${
                                isSelected
                                  ? 'bg-rose-600/25 border-rose-400 text-white font-bold'
                                  : 'bg-[#151C28] hover:bg-[#1B2433] border-[#2D3B50] text-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-amber-200 font-bold">{spec.shortTitleDa}</span>
                                {isSelected && (
                                  <span className="px-1 rounded bg-rose-600 text-white text-[11px]">
                                    AKTIV
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 leading-snug">
                                {spec.subtitleDa}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-1.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                        {onOpenSimultaneousModal && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenSimultaneousModal();
                              setIsSimultaneousPopoverOpen(false);
                            }}
                            className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 font-bold cursor-pointer"
                          >
                            Åbn Split-Screen Modal
                          </button>
                        )}
                        <div className="flex items-center gap-1.5">
                          {simultaneousDispatch?.isBlinkingP1 && onAcknowledgeSimultaneousP1 && (
                            <button
                              type="button"
                              onClick={() => {
                                onAcknowledgeSimultaneousP1();
                                setIsSimultaneousPopoverOpen(false);
                              }}
                              className="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                            >
                              Kvittér P1
                            </button>
                          )}
                          {simultaneousDispatch?.active && onClearSimultaneousSimulation && (
                            <button
                              type="button"
                              onClick={() => {
                                onClearSimultaneousSimulation();
                                setIsSimultaneousPopoverOpen(false);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Nulstil</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick-Snapshot Button (triggers handleSaveMapSnapshotObservation directly) */}
              {onQuickSnapshot && (
                <button
                  type="button"
                  data-testid="toolbar-quick-snapshot-btn"
                  disabled={isQuickSnapshotSaving}
                  onClick={async () => {
                    if (isQuickSnapshotSaving) return;
                    setIsQuickSnapshotSaving(true);
                    try {
                      await onQuickSnapshot();
                      setQuickSnapshotSavedJustNow(true);
                      window.setTimeout(() => setQuickSnapshotSavedJustNow(false), 3200);
                    } finally {
                      setIsQuickSnapshotSaving(false);
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap shrink-0 ${
                    quickSnapshotSavedJustNow
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold'
                      : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                  }`}
                  title="Quick-Snapshot: Logger aktuel kortvisning som tidsstemplet & SHA-256 signeret observation i evidensloggen"
                >
                  <Camera
                    className={`w-3.5 h-3.5 shrink-0 ${
                      quickSnapshotSavedJustNow ? 'text-emerald-300' : 'text-cyan-400'
                    }`}
                  />
                  <span>
                    {isQuickSnapshotSaving
                      ? 'Gemmer...'
                      : quickSnapshotSavedJustNow
                      ? '✓ Snapshot Logget'
                      : 'Quick-Snapshot'}
                  </span>
                </button>
              )}

              <button
                type="button"
                data-testid="toolbar-export-geojson-btn"
                onClick={() => {
                  const res = downloadGeoJsonSnapshot({
                    plumeZones,
                    sources,
                    receptors,
                    receptorExposures,
                    selectedSourceId,
                    currentWeather,
                    selectedDateIso,
                    viewportMode,
                    plumeDirectionDeg,
                    precipitationOverrideMm,
                    maxSiteSumQuotient,
                    effectiveMachineDb: effMachineDb,
                  });
                  setGeoJsonSavedCount(res.featureCount);
                  window.setTimeout(() => setGeoJsonSavedCount(null), 3200);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap shrink-0 ${
                  geoJsonSavedCount !== null
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold'
                    : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                }`}
                title="Eksportér aktuel visning som højopløselig RFC 7946 GeoJSON-snapshot (fanepolygoner, vindlinjer, aktive kilder & receptorer) til GIS-gennemgang i QGIS/ArcGIS"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  {geoJsonSavedCount !== null
                    ? `✓ GeoJSON (${geoJsonSavedCount} obj.)`
                    : 'GeoJSON Snapshot'}
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleFullscreen3D}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap ${
                  isFullscreen3D
                    ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                    : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                }`}
              >
                {isFullscreen3D ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Afslut Fuld Skærm</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Fuld Skærm</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSetMapOnlyMode(true)}
                className="px-2.5 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1.5 border bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 cursor-pointer whitespace-nowrap shrink-0"
                title="Kun Kort — Vis kun kortet med filtre og en Afslut-knap i højre hjørne"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>Kun Kort</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSetMapOnlyMode(false)}
              className="px-3 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1.5 border bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-lg cursor-pointer"
              title="Afslut 'Kun Kort' visning (Esc)"
            >
              <X className="w-3.5 h-3.5 text-white" />
              <span>Afslut</span>
            </button>
          )}
        </div>
      </div>

      {/* ROW 2: 29-BUILDING OPERATIONAL CATEGORY FILTER & HVAD-HVIS POPOVER */}
      <div className="px-3 py-1.5 bg-[#151C28] border-b border-[#253042] flex items-center justify-between gap-2 flex-wrap font-mono text-[11px] tabular-nums">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Bygningskategorier (29 enheder):</span>
          </span>
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
            const isActive = activeCategoryFilters.includes(catCode);
            const count = buildings.filter((b) => b.category === catCode).length;
            return (
              <button
                key={catCode}
                type="button"
                onClick={() => onToggleCategoryFilter(catCode)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#1B2433] text-slate-100'
                    : 'bg-[#0F141D] text-slate-500 border-[#253042] opacity-60 hover:opacity-90'
                }`}
                style={{
                  borderColor: isActive ? meta.colorHex : undefined,
                }}
                title={`${meta.labelDa} (faktor ${meta.sourceEmissionFactor.toFixed(2)}x · H=${meta.defaultReleaseHeightMeters}m)`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: meta.colorHex }}
                />
                <span>{meta.labelDa}</span>
                <span className="px-1 rounded bg-[#0F141D] text-[11px] text-slate-300">
                  {count}
                </span>
              </button>
            );
          })}
          {activeCategoryFilters.length < 5 && (
            <button
              type="button"
              onClick={onResetCategoryFilters}
              className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-[11px] text-cyan-300 cursor-pointer"
            >
              Vis alle (5)
            </button>
          )}
        </div>

        {/* Hvad-hvis Scenarier Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsWhatIfPopoverOpen((v) => !v)}
            className="px-2.5 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <FlaskConical className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Hvad-hvis Scenarier</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {isWhatIfPopoverOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 rounded-lg bg-[#212C3E] border border-[#36465E] shadow-2xl p-2.5 space-y-1.5 z-50 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  onApplyBatchBuildingScenario(
                    (prev) =>
                      prev.map((b) =>
                        b.id === 'BLOK-1' ? { ...b, category: 'e_demolished_unsecured' } : b
                      ),
                    'BLOK-1'
                  );
                  setIsWhatIfPopoverOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded bg-[#151C28] hover:bg-[#1B2433] border border-[#2D3B50] text-amber-200 font-semibold text-left cursor-pointer"
              >
                Blok 1 → e. Nedrevet, ikke sikret
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyBatchBuildingScenario(
                    (prev) =>
                      prev.map((b) =>
                        b.id === 'BLOK-9' || b.id === 'BLOK-10'
                          ? { ...b, category: 'd_under_demolition' }
                          : b
                      ),
                    'BLOK-9'
                  );
                  setIsWhatIfPopoverOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded bg-[#151C28] hover:bg-[#1B2433] border border-[#2D3B50] text-rose-200 font-semibold text-left cursor-pointer"
              >
                Blok 9 &amp; 10 → d. Under nedrivning
              </button>
              <button
                type="button"
                onClick={() => {
                  onFocusBlok12Percolation3D();
                  setIsWhatIfPopoverOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded bg-[#151C28] hover:bg-[#1B2433] border border-[#2D3B50] text-emerald-200 font-semibold text-left flex items-center gap-1.5 cursor-pointer"
              >
                <Droplets className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Fokus 3D: Blok 1 &amp; 2 Perkolation (Pb &amp; PAH)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenCategoryManagerInSubstances();
                  setIsWhatIfPopoverOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded bg-[#151C28] hover:bg-[#1B2433] border border-[#2D3B50] text-cyan-200 font-semibold text-left cursor-pointer"
              >
                Åbn Kategoristyring (29 enheder)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2B: KIERULFFSVEJ DN200 DRIKKEVANDSHOVEDRØR (SK VAND A/S) INFRASTRUKTUR & FYSISK SIKKERHED */}
      {onToggleWaterMainLayer && (
        <div
          data-testid="toolbar-water-main-strip"
          className="px-3 py-1.5 bg-[#111827] border-b border-[#253042] flex items-center justify-between gap-2 flex-wrap font-mono text-[11px] tabular-nums"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              data-testid="toolbar-water-main-toggle-btn"
              onClick={onToggleWaterMainLayer}
              aria-pressed={showWaterMainLayer}
              className={`px-2 py-0.5 rounded font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                showWaterMainLayer
                  ? simulatedPipeRuptureActive || waterMainTelemetry?.overallStatus === 'critical_rupture'
                    ? 'bg-rose-600 text-white border-rose-300 font-bold shadow-xs'
                    : 'bg-sky-500/25 border-sky-400 text-sky-100 font-bold shadow-xs'
                  : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-300 border-[#2D3B50]'
              }`}
              title="Vis/skjul SK Vand A/S DN200 hovedrør (Eternit 1964 + PE100, -1,65 m u.t.) langs Kierulffsvej i 2D, 3D og Undergrund"
            >
              <Droplets
                className={`w-3.5 h-3.5 shrink-0 ${
                  showWaterMainLayer ? 'text-sky-300' : 'text-sky-400'
                }`}
              />
              <span>Drikkevands-Hovedrør (Kierulffsvej)</span>
            </button>

            {onToggleSteelRoadPlates && (
              <button
                type="button"
                data-testid="toolbar-water-main-steel-plates-btn"
                onClick={onToggleSteelRoadPlates}
                aria-pressed={hasSteelRoadPlates}
                className={`px-2 py-0.5 rounded font-semibold border transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  hasSteelRoadPlates
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100 font-bold'
                    : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-300 border-[#2D3B50]'
                }`}
                title="Wissenberg PSS W22085 køreplader: Fordeler maskinlast via Boussinesq (~32,9 kPa → ~10,2 kPa ved -1,65 m)"
              >
                <ShieldCheck
                  className={`w-3.5 h-3.5 shrink-0 ${
                    hasSteelRoadPlates ? 'text-emerald-300' : 'text-slate-400'
                  }`}
                />
                <span>Køreplader på Kierulffsvej (PSS W22085)</span>
              </button>
            )}

            {onToggleLerBuffer && (
              <button
                type="button"
                data-testid="toolbar-water-main-ler-buffer-btn"
                onClick={onToggleLerBuffer}
                aria-pressed={showLerBuffer}
                className={`px-2 py-0.5 rounded font-semibold border transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  showLerBuffer
                    ? 'bg-cyan-500/20 border-cyan-400/75 text-cyan-100 font-semibold'
                    : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-400 border-[#2D3B50]'
                }`}
                title="Vis/skjul LER 2.0 ±2,0 meter graveusikkerhedszone omkring DN200-centerlinjen"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Vis LER ±2,0m Buffer</span>
              </button>
            )}

            {onToggleSimulatedPipeRupture && (
              <button
                type="button"
                data-testid="toolbar-water-main-rupture-btn"
                onClick={onToggleSimulatedPipeRupture}
                aria-pressed={simulatedPipeRuptureActive}
                className={`px-2 py-0.5 rounded font-bold border transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  simulatedPipeRuptureActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-200 animate-pulse'
                    : 'bg-[#1B2433] hover:bg-rose-950/60 text-rose-200 border-rose-500/50'
                }`}
                title="Simulér trykfald og tilbagesugning ved brud på Kierulffsvej DN200 (Ledningsbrud 7. juni 2018: 60 m rende / ~180 m³ vandtab)"
              >
                {simulatedPipeRuptureActive ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>Simulér Rørbrud</span>
              </button>
            )}

            <button
              type="button"
              data-testid="toolbar-water-main-geojson-btn"
              onClick={() => {
                const res = exportKierulffsvejWaterMainGeoJson(waterMainCoordMode, buildings);
                setWaterMainGeoJsonCount(res.featureCount);
                window.setTimeout(() => setWaterMainGeoJsonCount(null), 3200);
              }}
              className={`px-2 py-0.5 rounded font-semibold border transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                waterMainGeoJsonCount !== null
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold'
                  : 'bg-[#1B2433] hover:bg-[#212C3E] text-sky-200 border-sky-500/50'
              }`}
              title={`Eksportér Kierulffsvej DN200 hovedrør, ventiler, brandhaner og stikledninger som RFC 7946 GeoJSON (${waterMainCoordMode})`}
            >
              <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                {waterMainGeoJsonCount !== null
                  ? `✓ Rørlag (${waterMainGeoJsonCount} obj.)`
                  : 'Eksportér Rørlag (GeoJSON)'}
              </span>
            </button>

            <button
              type="button"
              data-testid="toolbar-water-main-epsg25832-geojson-btn"
              onClick={() => {
                const res = exportKierulffsvejWaterMainEpsg25832GeoJson(buildings);
                setEpsg25832GeoJsonCount(res.featureCount);
                window.setTimeout(() => setEpsg25832GeoJsonCount(null), 3400);
              }}
              className={`px-2 py-0.5 rounded font-semibold border transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                epsg25832GeoJsonCount !== null
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold'
                  : 'bg-[#1B2433] hover:bg-[#212C3E] text-amber-200 border-amber-500/50'
              }`}
              title="Eksportér DAR-verificeret EPSG:25832 (ETRS89 / UTM zone 32N meterkoordinater) GeoJSON for Kierulffsvej DN200 hovedrør"
            >
              <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {epsg25832GeoJsonCount !== null
                  ? `✓ EPSG:25832 (${epsg25832GeoJsonCount} obj.)`
                  : 'Eksportér EPSG:25832 GeoJSON'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onChangeWaterMainCoordMode && (
              <div
                className="inline-flex items-center rounded bg-[#0F141D] border border-[#2D3B50] p-0.5"
                role="group"
                aria-label="Geodætisk koordinattilstand for drikkevandsrør"
              >
                <button
                  type="button"
                  data-testid="toolbar-water-main-coord-scene"
                  onClick={() => onChangeWaterMainCoordMode('scene_calibrated')}
                  className={`px-1.5 py-0.2 rounded text-[11px] font-semibold cursor-pointer ${
                    waterMainCoordMode === 'scene_calibrated'
                      ? 'bg-sky-500/30 text-sky-100 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Scene
                </button>
                <button
                  type="button"
                  data-testid="toolbar-water-main-coord-dar"
                  onClick={() => onChangeWaterMainCoordMode('dar_verified_wgs84')}
                  className={`px-1.5 py-0.2 rounded text-[11px] font-semibold cursor-pointer ${
                    waterMainCoordMode === 'dar_verified_wgs84'
                      ? 'bg-amber-500/30 text-amber-100 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Officielt DAR/WGS84 & EPSG:25832 750 m vejtracé langs Kierulffsvej"
                >
                  DAR/EPSG:25832
                </button>
              </div>
            )}

            {waterMainTelemetry && (
              <div
                data-testid="toolbar-water-main-telemetry-badge"
                className={`px-2 py-0.5 rounded border flex items-center gap-1.5 text-[11px] ${
                  waterMainTelemetry.overallStatus === 'critical_rupture'
                    ? 'bg-rose-950/75 border-rose-400 text-rose-100 font-bold'
                    : waterMainTelemetry.overallStatus === 'warning' ||
                      waterMainTelemetry.overallStatus === 'advisory'
                    ? 'bg-amber-950/70 border-amber-400/75 text-amber-100 font-semibold'
                    : 'bg-[#0F141D] border-sky-500/40 text-sky-200'
                }`}
              >
                <span>{waterMainTelemetry.pressureBar.toFixed(2)} bar</span>
                <span className="text-slate-500">·</span>
                <span>{waterMainTelemetry.flowLs.toFixed(1)} L/s</span>
                <span className="text-slate-500">·</span>
                <span>PPV {waterMainTelemetry.pipePpvMmPerSec.toFixed(1)} mm/s</span>
                <span className="text-slate-500">·</span>
                <span>{waterMainTelemetry.crownStressKpa.toFixed(1)} kPa</span>
                {waterMainTelemetry.legalAlerts.length > 0 && (
                  <span className="px-1 rounded bg-rose-600/80 text-white font-bold">
                    {waterMainTelemetry.legalAlerts.length} alarmer
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROW 2C: AGGREGATED WISSENBERG PSS W22085 MACHINE INTERLOCKS & SYSTEM 3 INTERLOCK-LOG */}
      {(pssInterlocks.length > 0 || system3InterlockLogs.length > 0 || simultaneousDispatch?.active) &&
        !isMapOnlyMode &&
        !isFullscreen3D &&
        (() => {
          const activeInterlocks = pssInterlocks.filter((i) => i.isActive);
          const unackInterlocks = activeInterlocks.filter((i) => !i.isAcknowledged);
          const allAcknowledged = activeInterlocks.length > 0 && unackInterlocks.length === 0;
          const criticalCount = unackInterlocks.filter((i) => i.severity === 'critical').length;

          const effectiveLogs: System3InterlockLogEntry[] =
            system3InterlockLogs.length > 0
              ? system3InterlockLogs
              : simultaneousDispatch?.active
              ? [
                  {
                    id: `live-s3-${simultaneousDispatch.eventId}`,
                    observationCode: 'LIVE-S3',
                    eventId: simultaneousDispatch.eventId,
                    scenarioTitleDa: simultaneousDispatch.scenarioTitleDa,
                    timestampIso: simultaneousDispatch.t1DispatchedIso,
                    dispatchedTimeLabel: simultaneousDispatch.t1DispatchedIso.slice(11, 19),
                    lockedValveCodes: simultaneousDispatch.system3State.lockedValveCodes,
                    haltedMachines: simultaneousDispatch.system3State.haltedMachines.map((m) => ({
                      id: m.id,
                      nameDa: m.nameDa,
                      interlockRuleDa: m.interlockRuleDa,
                    })),
                    sha256Signature:
                      simultaneousDispatch.gate1Validation.zkpRightToOpacityHash ||
                      'Afventer SHA-256 registrering',
                    triggerSummaryDa: `${simultaneousDispatch.system3State.sectioningStatuteDa} · ${simultaneousDispatch.system3State.waterLossPreventedM3} m³ vandspild afværget · CAV Balanceret HEPA`,
                  },
                ]
              : [];

          return (
            <div
              data-testid="toolbar-pss-interlock-aggregator"
              className={`px-3 py-1.5 border-b flex flex-col gap-1.5 font-mono text-[11px] tabular-nums ${
                unackInterlocks.length > 0
                  ? criticalCount > 0
                    ? 'bg-rose-950/35 border-rose-500/45 text-rose-100'
                    : 'bg-amber-950/30 border-amber-500/45 text-amber-100'
                  : 'bg-[#0E1522] border-[#253042] text-slate-300'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider shrink-0">
                    <Lock
                      className={`w-3.5 h-3.5 shrink-0 ${
                        unackInterlocks.length > 0
                          ? criticalCount > 0
                            ? 'text-rose-400'
                            : 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    />
                    <span>
                      PSS W22085 Maskin-Interlocks ({unackInterlocks.length} ukvitterede / {activeInterlocks.length} aktive):
                    </span>
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {activeInterlocks.length === 0 ? (
                      <span className="text-emerald-300 font-semibold">
                        Alle maskin-låse frigivet og overholdt
                      </span>
                    ) : (
                      activeInterlocks.map((item) => (
                        <span
                          key={item.id}
                          title={`${item.ruleRefDa} — Afværgetiltag: ${item.mitigationHintDa} (${item.machineLabelDa})`}
                          className={`px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                            item.isAcknowledged
                              ? 'bg-emerald-950/50 border-emerald-500/45 text-emerald-200'
                              : item.severity === 'critical'
                              ? 'bg-rose-950/80 border-rose-500/70 text-rose-200 font-semibold'
                              : 'bg-amber-950/75 border-amber-500/65 text-amber-200 font-semibold'
                          }`}
                        >
                          <span>{item.code}</span>
                          <span className="text-slate-400">·</span>
                          <span className="truncate max-w-[165px]">{item.titleDa}</span>
                          {item.isAcknowledged && (
                            <span className="text-emerald-300 font-bold">✓</span>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    data-testid="toolbar-system3-interlock-log-btn"
                    onClick={() => setIsSystem3InterlockLogOpen((v) => !v)}
                    aria-expanded={isSystem3InterlockLogOpen}
                    className={`px-2 py-0.5 rounded border font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors ${
                      isSystem3InterlockLogOpen
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 font-bold'
                        : effectiveLogs.length > 0
                        ? 'bg-[#1B2433] hover:bg-[#253042] border-cyan-500/50 text-cyan-200'
                        : 'bg-[#141B27] hover:bg-[#1B2433] border-[#2D3B50] text-slate-300'
                    }`}
                    title="Vis System 3 Interlock-log med nøjagtige tidspunkter for automatisk V-VEST/V-MIDT ventil-lukning, maskinstop og SHA-256 verifikations-hashes"
                  >
                    <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>System 3 Interlock-log ({effectiveLogs.length})</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        isSystem3InterlockLogOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {allAcknowledged && pssCollectiveAckAtIso && (
                    <span className="text-emerald-300 text-[11px] font-semibold">
                      ✓ Afværget &amp; kollektivt kvitteret ({pssCollectiveAckAtIso.slice(11, 19)})
                    </span>
                  )}
                  {unackInterlocks.length > 0 && onAcknowledgeAllPssInterlocks && (
                    <button
                      type="button"
                      data-testid="toolbar-pss-collective-ack-btn"
                      onClick={onAcknowledgeAllPssInterlocks}
                      className="px-2.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-200 font-bold cursor-pointer inline-flex items-center gap-1 transition-colors"
                      title="Kvittér alle aktive PSS W22085 maskin-interlocks kollektivt efter dokumenterede afværgeforanstaltninger (køreplader, vandtåge, CAV-stop) og bogfør SHA-256 hændelse"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Kvittér alle interlocks kollektivt ({unackInterlocks.length})</span>
                    </button>
                  )}
                  {allAcknowledged && onResetPssInterlockAck && (
                    <button
                      type="button"
                      onClick={onResetPssInterlockAck}
                      className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#253042] border border-[#2D3B50] text-slate-300 font-semibold cursor-pointer inline-flex items-center gap-1"
                      title="Genaktiver udestående låsestatus for fornyet AMK-B kontrol"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Nulstil kvittering</span>
                    </button>
                  )}
                </div>
              </div>

              {isSystem3InterlockLogOpen && (
                <div
                  data-testid="toolbar-system3-interlock-log-panel"
                  className="mt-0.5 p-2 rounded bg-[#080C14] border border-cyan-500/40 space-y-1.5 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
                    <span className="font-bold text-cyan-200 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>
                        System 3 Interlock-log · Automatisk Ventil-Lukning (V-VEST / V-MIDT) &amp; Maskin-Lockout (SHA-256 Chain-of-Custody)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSystem3InterlockLogOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                      aria-label="Luk System 3 Interlock-log"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {effectiveLogs.length === 0 ? (
                    <div className="text-slate-400 py-1">
                      Ingen udløste System 3 ventil-lukninger eller maskinstop registreret i denne session endnu. Aktivér en Algedonisk S1+S3 simulering eller udløs grænseværdioverskridelse for automatisk SHA-256 journalføring.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {effectiveLogs.map((entry) => (
                        <div
                          key={entry.id}
                          data-testid={`system3-interlock-log-entry-${entry.observationCode}`}
                          className="p-1.5 rounded bg-[#0F1623] border border-slate-700/80 space-y-1"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-200 font-bold">
                                {entry.observationCode}
                              </span>
                              <span className="text-white font-bold">{entry.scenarioTitleDa}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-cyan-300 font-semibold">
                                Kl. {entry.dispatchedTimeLabel} ({entry.timestampIso})
                              </span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/50 text-cyan-200 font-semibold">
                              Lukket: {entry.lockedValveCodes.join(' + ')}
                            </span>
                          </div>

                          <div className="text-slate-300 leading-snug">{entry.triggerSummaryDa}</div>

                          {entry.haltedMachines.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {entry.haltedMachines.map((m) => (
                                <span
                                  key={`${entry.id}-${m.id}`}
                                  className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/50 text-amber-200"
                                >
                                  ⛔ {m.nameDa} ({m.interlockRuleDa})
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 border-t border-slate-800/80">
                            <div className="text-emerald-300 break-all">
                              <span className="text-slate-400 mr-1">SHA-256:</span>
                              <span className="select-all font-semibold">{entry.sha256Signature}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                  navigator.clipboard.writeText(entry.sha256Signature).catch(() => {});
                                }
                                setCopiedInterlockLogId(entry.id);
                                window.setTimeout(() => setCopiedInterlockLogId(null), 1800);
                              }}
                              className="px-1.5 py-0.5 rounded bg-[#1B2433] hover:bg-[#253042] border border-[#2D3B50] text-slate-200 cursor-pointer shrink-0"
                            >
                              {copiedInterlockLogId === entry.id ? '✓ Kopieret' : 'Kopiér SHA-256'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      {/* ROW 3: INTERACTIVE MAP LEGEND (ACTIVE SOURCES, RECEPTOR ZONES & SUBSTANCE CHECKBOXES) */}
      {visibleSubstances && onToggleSubstanceVisibility && onSetAllSubstancesVisibility && (
        <InteractiveMapLegend
          sources={sources}
          receptors={receptors}
          receptorExposures={receptorExposures}
          hiddenSourceIds={hiddenSourceIds}
          visibleSubstances={visibleSubstances}
          onToggleSubstance={onToggleSubstanceVisibility}
          onSetAllSubstances={onSetAllSubstancesVisibility}
          onSelectSource={onSelectSource}
          onSelectReceptor={onSelectReceptor}
        />
      )}

      {/* ROW 4: INTERACTIVE PLUME CONCENTRATION HEATMAP COLOR-SCALE LEGEND & PASQUILL SENSITIVITY THRESHOLD */}
      {showPlumeConcentrationHeatmap && (() => {
        const obsT = effectivePasquillThreshold;
        const elevT = Number((obsT * 2).toFixed(2));
        const critT = Number((obsT * 4).toFixed(2));
        const markerPct = Math.max(4, Math.min(96, ((obsT - 0.1) / 0.9) * 100));
        const presets = [
          { label: 'Kl. E/F Streng (0,15)', val: 0.15, desc: 'Stabil nat/inversion — maks følsomhed' },
          { label: 'Std. BEK (0,25)', val: 0.25, desc: 'Standard Arbejdstilsynet/BEK 613 tærskel' },
          { label: 'Kl. C/D (0,40)', val: 0.4, desc: 'Neutral dagsopblanding — moderat filtrering' },
          { label: 'Kl. A/B (0,60)', val: 0.6, desc: 'Kraftig turbulens — kun højkoncentration' },
        ];
        return (
          <div
            data-testid="toolbar-plume-concentration-legend"
            className="px-3 py-2 bg-[#121824] border-b border-rose-500/45 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] tabular-nums"
          >
            {/* Left: Color-scale stops + interactive gradient bar */}
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-1.5 text-rose-200 font-bold uppercase shrink-0">
                <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Heatmap Farveskala (Pasquill {currentWeather.pasquillClass}):</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetPasquillThreshold(0.15)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/60 text-emerald-200 cursor-pointer"
                  title="Klik for højere følsomhed (Kl. E/F)"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0" />
                  <span>Sikker S &lt; {obsT.toFixed(2)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPasquillThreshold(0.25)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-950/50 hover:bg-yellow-900/60 border border-yellow-500/60 text-yellow-200 cursor-pointer"
                  title="Klik for standard BEK tærskel (0,25)"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-yellow-400 shrink-0" />
                  <span>
                    Obs. {obsT.toFixed(2)}–{elevT.toFixed(2)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPasquillThreshold(0.4)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-950/50 hover:bg-orange-900/60 border border-orange-500/60 text-orange-200 cursor-pointer"
                  title="Klik for Kl. C/D tærskel (0,40)"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-orange-500 shrink-0" />
                  <span>
                    Forhøjet {elevT.toFixed(2)}–{critT.toFixed(2)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPasquillThreshold(0.6)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/60 text-rose-200 cursor-pointer"
                  title="Klik for Kl. A/B højkoncentrations-tærskel (0,60)"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 shrink-0" />
                  <span>Kritisk S ≥ {critT.toFixed(2)}</span>
                </button>
              </div>

              {/* Continuous gradient scale indicator */}
              <div
                className="hidden xl:flex items-center gap-1.5"
                title={`Aktuel Pasquill følsomhedstærskel: S = ${obsT.toFixed(2)}`}
              >
                <div className="relative w-32 h-2.5 rounded-full overflow-hidden border border-[#2D3B50] bg-gradient-to-r from-emerald-500 via-yellow-400 via-55% to-rose-600">
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_4px_#fff]"
                    style={{ left: `calc(${markerPct}% - 2px)` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Pasquill Sensitivity Threshold Slider + Fine Adjust + Presets */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0F141D] border border-[#2D3B50]">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <label
                  htmlFor="pasquill-sensitivity-slider"
                  className="text-slate-300 font-semibold whitespace-nowrap"
                >
                  Pasquill Tærskel:
                </label>
                <button
                  type="button"
                  data-testid="pasquill-threshold-dec-btn"
                  onClick={() => handleSetPasquillThreshold(obsT - 0.05)}
                  disabled={obsT <= 0.1}
                  className="px-1.5 py-0.2 rounded bg-[#1B2433] hover:bg-[#253042] border border-[#2D3B50] text-slate-200 font-bold disabled:opacity-40 cursor-pointer"
                  aria-label="Sænk Pasquill følsomhedstærskel"
                >
                  -
                </button>
                <input
                  id="pasquill-sensitivity-slider"
                  data-testid="pasquill-sensitivity-threshold-slider"
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={obsT}
                  onChange={(e) => handleSetPasquillThreshold(Number(e.target.value))}
                  className="w-24 sm:w-28 accent-rose-500 cursor-pointer"
                  aria-label="Pasquill-klasse følsomhedstærskel for koncentrations-heatmap"
                />
                <button
                  type="button"
                  data-testid="pasquill-threshold-inc-btn"
                  onClick={() => handleSetPasquillThreshold(obsT + 0.05)}
                  disabled={obsT >= 1.0}
                  className="px-1.5 py-0.2 rounded bg-[#1B2433] hover:bg-[#253042] border border-[#2D3B50] text-slate-200 font-bold disabled:opacity-40 cursor-pointer"
                  aria-label="Forhøj Pasquill følsomhedstærskel"
                >
                  +
                </button>
                <span
                  data-testid="pasquill-threshold-readout"
                  className="px-1.5 py-0.2 rounded bg-rose-950/70 border border-rose-500/50 text-rose-200 font-extrabold min-w-[46px] text-center"
                >
                  {obsT.toFixed(2)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {presets.map((p) => {
                  const activePreset = Math.abs(obsT - p.val) < 0.01;
                  return (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => handleSetPasquillThreshold(p.val)}
                      title={p.desc}
                      className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer whitespace-nowrap ${
                        activePreset
                          ? 'bg-rose-500/25 border-rose-400 text-rose-100 font-bold'
                          : 'bg-[#151C28] hover:bg-[#1B2433] border-[#2D3B50] text-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {onTogglePlumeConcentrationHeatmap && (
                <button
                  type="button"
                  onClick={onTogglePlumeConcentrationHeatmap}
                  className="p-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Skjul koncentrations-heatmap"
                  title="Deaktiver koncentrations-heatmap"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })()}

    </>
  );
};

export interface AsbestosHeatmapHudOverlayProps {
  currentHourLabel: string;
  temporal24hAsbestosAccumulation: boolean;
  onSetTemporal24hAsbestosAccumulation: React.Dispatch<React.SetStateAction<boolean>>;
  onDisableHeatmap: () => void;
}

export const AsbestosHeatmapHudOverlay: React.FC<AsbestosHeatmapHudOverlayProps> = ({
  currentHourLabel,
  temporal24hAsbestosAccumulation,
  onSetTemporal24hAsbestosAccumulation,
  onDisableHeatmap,
}) => {
  const [isLegendExpanded, setIsLegendExpanded] = useState<boolean>(false);

  return (
    <div
      data-workspace-asbestos-legend="true"
      className="absolute bottom-3 left-3 z-30 max-w-[calc(100%-1.5rem)] sm:max-w-[520px] rounded-md bg-[#151C28]/92 backdrop-blur-sm border border-[#2D3B50] shadow-xl px-2.5 py-1.5 font-mono text-[11px] tabular-nums pointer-events-auto"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-slate-100 truncate">
            3D Asbest-Fiber Heatmap:
          </span>
          <span className="text-cyan-300 font-semibold truncate">
            {temporal24hAsbestosAccumulation
              ? '24t Kumulativ Risiko'
              : `Øjebliksbillede (kl. ${currentHourLabel})`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="toggle-asbestos-hud-legend-btn"
            onClick={() => setIsLegendExpanded((v) => !v)}
            className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-200 font-semibold cursor-pointer"
          >
            {isLegendExpanded ? 'Skjul Legende' : 'Vis/Skjul Legende'}
          </button>
          <button
            type="button"
            onClick={onDisableHeatmap}
            title="Slå 3D Asbest-Fiber Heatmap fra"
            className="px-1.5 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {isLegendExpanded && (
        <div className="mt-2 pt-2 border-t border-[#253042] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-400">
              {temporal24hAsbestosAccumulation
                ? 'Døgn-GV = 0,0240 fibre/cm³·t'
                : 'BEK 613/2026 GV = 0,0030 fibre/cm³'}
            </span>
            <div
              className="inline-flex items-center gap-1 p-0.5 rounded bg-[#1B2433] border border-[#2D3B50]"
              role="group"
              aria-label="Vælg visningstilstand for 3D asbest-heatmap"
            >
              <button
                type="button"
                onClick={() => onSetTemporal24hAsbestosAccumulation(false)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  !temporal24hAsbestosAccumulation
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Øjebliksbillede
              </button>
              <button
                type="button"
                onClick={() => onSetTemporal24hAsbestosAccumulation(true)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  temporal24hAsbestosAccumulation
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                24t Kumulativ Risiko
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div
              className={`h-2 w-full rounded-xs border border-[#2D3B50] ${
                temporal24hAsbestosAccumulation
                  ? 'bg-gradient-to-r from-sky-400 via-violet-500 via-amber-400 to-rose-600'
                  : 'bg-gradient-to-r from-teal-500 via-emerald-400 via-amber-400 to-rose-600'
              }`}
            />
            {temporal24hAsbestosAccumulation ? (
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 shrink-0" />
                  <span>
                    <strong className="text-sky-300">Blå:</strong> &lt;0,0024 f/cm³·t (&lt;10% GV)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-violet-500 shrink-0" />
                  <span>
                    <strong className="text-purple-300">Violet:</strong> 0,0024–0,0120 (10–50%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 shrink-0" />
                  <span>
                    <strong className="text-amber-300">Rav:</strong> 0,0120–0,0240 (50–100%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 border border-white shrink-0" />
                  <span>
                    <strong className="text-rose-300">Karmoisin:</strong> ≥0,0240 (Overskridelse)
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 shrink-0" />
                  <span>
                    <strong className="text-teal-300">Turkis:</strong> 0,0001–0,0003 (&lt;10% GV)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 shrink-0" />
                  <span>
                    <strong className="text-emerald-300">Smaragd:</strong> 0,0003–0,0015 (10–50%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 shrink-0" />
                  <span>
                    <strong className="text-amber-300">Rav:</strong> 0,0015–0,0030 (50–100%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 border border-white shrink-0" />
                  <span>
                    <strong className="text-rose-300">Karmoisin:</strong> ≥0,0030 (Lovoverskridelse)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
