/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Biohazard,
  Box,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Clock,
  CloudRain,
  Compass,
  Copy,
  Crosshair,
  Dna,
  Download,
  Droplets,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Gauge,
  HardHat,
  Home,
  Landmark,
  Layers,
  Lock,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Moon,
  Navigation,
  Pause,
  Pin,
  Play,
  PlusCircle,
  Printer,
  Radio,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Stethoscope,
  Sun,
  Thermometer,
  Trash2,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  BUILDING_CATEGORY_METADATA,
  CRITICAL_WEATHER_SCENARIOS,
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
  RINGPARKEN_MASTER_BUILDINGS,
  SUBSTANCE_SPECS,
  SourceNodeOverride,
  deriveReceptorsFromBuildings,
  deriveSourcesFromBuildings,
  getDefaultSourceBaseLwaDb,
  getReceptorIdForBuilding,
  getSourceIdForBuilding,
} from './data/ringparkenData';
import {
  AlgedonicObservation,
  BuildingOperationalCategory,
  DemolitionSourceNode,
  DispersionSimulationState,
  ExportFilterCriteria,
  ForensicAudioEvidence,
  ForensicMapSnapshotMetadata,
  ForensicPdfEvidence,
  ForensicPhotoEvidence,
  HeatmapComparisonViewMode,
  LatLngPoint,
  LegalBasisFilterCategory,
  LegalViolationEntry,
  MapsGroundingPlace,
  ReceptorZone,
  ReporterRole,
  RingparkenBuildingUnit,
  SimultaneousAlgedonicDispatch,
  SubstanceKey,
  System3InterlockLogEntry,
  VirtualLeakPinImpact,
  WaterMainCoordinateMode,
  WaterMainLiveTelemetry,
  WeatherDataset,
} from './types/dispersion';
import {
  computeVirtualLeakPercolationImpact,
  computeWaterMainLiveTelemetry,
} from './services/waterMainPhysicsService';
import { closestPointOnPolyline } from './data/kierulffsvejWaterMainData';
import {
  Next7DayForecastDay,
  buildLastWeekPredictedVsActualWeatherPairs,
  computeSunriseSunsetForDate,
  degreesToCompass,
  fetchOpenMeteoWeatherForDate,
  shiftDateIsoByDays,
} from './services/weatherService';
import {
  compute24HourPuffHistory,
  computeForensicSha256Hash,
  computeIndoorClimateTelemetry,
  computePlumeHeatmapComparison,
  evaluatePointInDispersionPlume,
  offsetLatLngByMeters,
  runDispersionSimulation,
} from './services/dispersionEngine';
import { DispersionMap } from './components/DispersionMap';
import { RiskZoneMap } from './components/RiskZoneMap';
import { RoleDashboard } from './components/RoleDashboard';
import { ComplianceAuditPanel } from './components/ComplianceAuditPanel';
import { ClimateResiliencePanel } from './components/ClimateResiliencePanel';
import { Ringparken3DScene } from './components/Ringparken3DScene';
import { UndergroundPercolation2D } from './components/UndergroundPercolation2D';
import { BuildingCategoryManagerPanel } from './components/BuildingCategoryManagerPanel';
import { BuildingSampleAndDmaPanel } from './components/BuildingSampleAndDmaPanel';
import { L69PenaltyCalculatorWidget } from './components/L69PenaltyCalculatorWidget';
import { PssSafetyInterlockWidget } from './components/PssSafetyInterlockWidget';
import { Rolling6hGustNoiseCorrelationWidget } from './components/Rolling6hGustNoiseCorrelationWidget';
import { WaterMainVibrationSankeyWidget } from './components/WaterMainVibrationSankeyWidget';
import { CikMaterialMetabolismSankey } from './components/CikMaterialMetabolismSankey';
import { ForensicReportModal, ReportModalTab } from './components/ForensicReportModal';
import { ExpertPersonaRole, ForensicChatbotPanel } from './components/ForensicChatbotPanel';
import { BioscienceToxicologyPanel } from './components/BioscienceToxicologyPanel';
import { WeatherNoiseDustCorrelationPanel } from './components/WeatherNoiseDustCorrelationPanel';
import { HeaderWeatherCorrelationD3Popup } from './components/HeaderWeatherCorrelationD3Popup';
import {
  IndoorClimateAlgedonicLogEntry,
  IndoorClimateAlgedonicLogPanel,
  MAX_INDOOR_ALARM_LOG_ENTRIES,
  createSignedIndoorAlarmEntry,
  loadStoredIndoorAlarms,
  persistStoredIndoorAlarms,
} from './components/IndoorClimateAlgedonicLogPanel';
import { EksponeringsBadge } from './components/EksponeringsBadge';
import { SKvotientTendensSparkline } from './components/SKvotientTendensSparkline';
import { ForensicAudioEvidencePanel } from './components/ForensicAudioEvidencePanel';
import { AutonomousReceptorMeshPanel } from './components/AutonomousReceptorMeshPanel';
import { WindCompensatedDbaCatalogSection } from './components/WindCompensatedDbaCatalogSection';
import {
  AutonomousReceptorNode,
  LegalStandingRoleKey,
  buildAutonomousReceptorMeshNetwork,
  evaluateNabotestForPoint,
} from './services/autonomousReceptorMeshService';
import { MachineImpulseWindSensitivityWidget } from './components/MachineImpulseWindSensitivityWidget';
import { NeighborComplaintPressureWaveBanner } from './components/NeighborComplaintPressureWaveBanner';
import { AutoNoiseViolationPromptModal } from './components/AutoNoiseViolationPromptModal';
import { WindGustNoiseDustCorrelationWidget } from './components/WindGustNoiseDustCorrelationWidget';
import { SlagelseLegalEvidenceDashboard } from './components/SlagelseLegalEvidenceDashboard';
import { runMyceliumSimulationEngine } from './services/myceliumSimulationEngine';
import {
  useMyceliumLiveAlerts,
  useSimultaneousAlgedonicDispatch,
} from './hooks/useMyceliumLiveAlerts';
import { MyceliumCyberneticDashboardPanel } from './components/mycelium/MyceliumCyberneticDashboardPanel';
import { MyceliumZkpAuditLog } from './components/mycelium/MyceliumZkpAuditLog';
import {
  SimultaneousAlgedonicSimulationModal,
  SimultaneousAlgedonicSplitHud,
} from './components/mycelium/SimultaneousAlgedonicSimulationModal';
import { TacticalAlgedonicToastDrawer } from './components/mycelium/TacticalAlgedonicToastDrawer';
import {
  ProactiveWeatherAlert,
  evaluateProactiveWeatherDeviations,
} from './services/proactiveWeatherAlertService';
import {
  RangeSimulationSummary,
  buildFormalSlagelseLegalComplaintDraft,
  downloadCombinedPercolationPdfReport,
  downloadCombinedSupervisionPdfReport,
  downloadFormalSlagelseLegalComplaintPdf,
  downloadRangeSimulationCsv,
  downloadRangeSimulationJson,
  runMultiHourRangeSimulation,
} from './services/rangeSimulationService';
import { InteractiveWindRoseChart } from './components/InteractiveWindRoseChart';
import { SevenDayHistoricalWindRoseWidget } from './components/SevenDayHistoricalWindRoseWidget';
import { TemperatureAerosolChart } from './components/TemperatureAerosolChart';
import { CumulativeRespirableDustChart } from './components/CumulativeRespirableDustChart';
import { Neighbor24hAsbestosExposureDoseWidget } from './components/Neighbor24hAsbestosExposureDoseWidget';
import { ForensicPhotoEvidencePanel } from './components/ForensicPhotoEvidencePanel';
import { ForensicPdfEvidencePanel } from './components/ForensicPdfEvidencePanel';
import {
  ForensicEvidenceTimelineWidget,
  classifyObservationKind,
} from './components/ForensicEvidenceTimelineWidget';
import { ProactiveComplaintMitigationAgentWidget } from './components/ProactiveComplaintMitigationAgentWidget';
import { StochasticWindBiasWidget } from './components/StochasticWindBiasWidget';
import { FiveDayWindForecastRoseWidget } from './components/FiveDayWindForecastRoseWidget';
import { NoiseComplianceLogPanel } from './components/NoiseComplianceLogPanel';
import {
  PredictionVsActualAndForecastWidget,
  TimeTravelRecordedEvent,
} from './components/PredictionVsActualAndForecastWidget';
import { ThirtyDayAggregatedHeatmapWidget } from './components/ThirtyDayAggregatedHeatmapWidget';
import { MedicalExpertAiWidget } from './components/MedicalExpertAiWidget';
import { ReceptorDustDepositionProfileWidget } from './components/ReceptorDustDepositionProfileWidget';
import { WhoCumulativeExposureScoreWidget } from './components/WhoCumulativeExposureScoreWidget';
import {
  DispersionForecastBulletinWidget,
  DispersionForecastOptionMode,
} from './components/DispersionForecastBulletinWidget';
import {
  DASHBOARD_WINDOW_REGISTRY,
  DashboardWindowId,
  DockableWindowFrame,
  FloatingDraggableWindow,
  MinimizedWindowsDropdownMenu,
  WindowInstanceState,
} from './components/DraggableDashboardWindow';
import {
  buildChainOfCustodyVerificationEntries,
  computeDeterministicZkpVerification,
  downloadForensicDatabaseAuditLogJson,
  downloadForensicJsonReport,
  exportSevenDayWindRoseAndBiasPdf,
  generateAcousticRefractionDiagramPdfReport,
  generateBuildingRegistryInspectionPdfReport,
  generateChronologicalEvidenceObservationsPdfReport,
  generateForensicChainOfCustodyPdfReport,
  generateForensicPdfReport,
  generatePercolationPdfReport,
  render2DViewportPrintSnapshotDataUrl,
  validateChainOfCustodyAgainstStateRegistry,
} from './services/pdfExportService';
import { generateWeatherCorrelationPdfReport } from './services/weatherCorrelationPdfService';
import {
  BornehaveSpatialPlumeAlertStatus,
  evaluateBornehaveDaycare3DPlumeAlert,
} from './services/bornehaveSpatialAlertService';
import { SourceManagerPanel } from './components/SourceManagerPanel';

import {
  StructuralEnvelopeEvidencePayload,
  StructuralEnvelopeImpactPanel,
} from './components/StructuralEnvelopeImpactPanel';
import {
  CavExhaustEvidencePayload,
  CavExhaustImpactWidget,
  CavVentilationMode,
} from './components/CavExhaustImpactWidget';
import {
  ThermalStackBuoyancyWidget,
  ThermalStackEvidencePayload,
} from './components/ThermalStackBuoyancyWidget';
import { BasementMonteCarloSimulationWidget } from './components/BasementMonteCarloSimulationWidget';
import { WindNoiseCorrelationDashboardWindow } from './components/WindNoiseCorrelationDashboardWindow';
import { SourceReceptorSelectorModal } from './components/SourceReceptorSelectorModal';
import { SelectedNoiseEventsPdfBuilderCard } from './components/SelectedNoiseEventsPdfBuilderCard';
import { TopCommandHeader } from './components/layout/TopCommandHeader';
import { RangeSimulationDrawer } from './components/layout/RangeSimulationDrawer';
import { WeatherTelemetryStrip } from './components/layout/WeatherTelemetryStrip';
import { AcousticRefractionDrawer } from './components/layout/AcousticRefractionDrawer';
import {
  computeInterpolatedRefractionFrame,
  computeReceptorRefractions,
} from './services/acousticRefractionMath';
import {
  AsbestosHeatmapHudOverlay,
  WorkspaceViewportToolbar,
} from './components/layout/WorkspaceViewportToolbar';
import { RightSidebarHeaderChrome } from './components/layout/RightSidebarHeaderChrome';
import { CollapsibleSection } from './components/layout/CollapsibleSection';
import { ChronologicalForensicExportCard } from './components/layout/ChronologicalForensicExportCard';
import { BottomTimelineFooter } from './components/layout/BottomTimelineFooter';
import { ExportHubPopover } from './components/layout/ExportHubPopover';
import { CommandPaletteModal } from './components/layout/CommandPaletteModal';
import { RightPanelTab, UiDensityMode } from './components/layout/layoutTypes';
import {
  exportDbaVsRealtimeSimulationCsv,
  exportFormalSlagelseComplaintFromState,
  exportFull168hDbaCatalogPdfFromState,
  exportMachineWindNoiseCorrelation24hJson,
  exportOpenMeteo24hWeatherDatasetJson,
  exportSlagelseViolationsEsdhCsv,
} from './services/exportHubHelpers';

const RELEVANT_SIDEBAR_WINDOWS_BY_TAB: Record<RightPanelTab, DashboardWindowId[]> = {
  algedonic: [
    'algedonic_observations',
    'evidence_timeline_24h',
    'photo_upload',
    'pdf_authority_evidence',
  ],
  noiseDust: [
    'wind_noise_correlation',
    'rolling_6h_wind_noise_correlation',
    'noise_dust_correlation',
    'proactive_ai_agent',
  ],
  indoorClimate: ['indoor_climate_telemetry'],
  puff24h: [
    'receptor_dust_deposition_profile',
    'cumulative_dust_24h',
    'wind_rose_24h',
    'temp_aerosol_24h',
    'neighbor_24h_asbestos_dose',
  ],
  substances: ['substances_sumformel'],
  bioscience: [
    'who_cumulative_exposure_score',
    'bioscience_toxicology',
    'medical_expert_ai',
  ],
  compliance: ['legal_compliance', 'pdf_authority_evidence'],
  grounding: ['gemini_grounding_chat'],
};

const ALGEDONIC_OBSERVATION_PRESETS: Array<{
  type: string;
  defaultPoint: LatLngPoint;
  defaultLocationLabel: string;
  defaultDetail: string;
}> = [
  {
    type: 'Synlig støvsky fra Blok 1 uden vanddæmpning',
    defaultPoint: { lat: 55.41295, lng: 11.35365 },
    defaultLocationLabel: 'Kierulffsvej ud for Blok 1 / Afd. 23',
    defaultDetail:
      'Synlig gråhvid støvsky fra mekanisk betonnedbrydning og nedtagning af brystningsplader ved Blok 1 (Kierulffsvej 14-22) uden aktiv vandforstøvning. Støvfanen driver direkte ind over Kierulffsvej mod beboede altaner.',
  },
  {
    type: 'Åbne containere med gammel mineraluld i blæsevejr',
    defaultPoint: { lat: 55.41335, lng: 11.35455 },
    defaultLocationLabel: 'Kierulffsvej 2-12 (ved Børnehave / Bazar)',
    defaultDetail:
      'Uafdækkede affaldscontainere med gammel mineraluld (<1997) og nedrevne loftplader står åbne i vindstød uden presenning eller støvtæt lukning.',
  },
  {
    type: 'Kørsel med entreprenørmaskiner på uforseglet jord i regnvejr',
    defaultPoint: { lat: 55.41235, lng: 11.35265 },
    defaultLocationLabel: 'Byggepladsudkørsel ved Kierulffsvej / Valbyvej',
    defaultDetail:
      'Tunge entreprenørmaskiner kører gennem opgravet, uforseglet jord og kloaktracé i regnvejr og slæber bly- og PAH-holdigt mudder ud på offentlig vej og cykelsti uden hjulvask.',
  },
  {
    type: 'Lugt af skimmel ved blotlagt krybekælder',
    defaultPoint: { lat: 55.41282, lng: 11.35295 },
    defaultLocationLabel: 'Blotlagt krybekælder ved Blok 1 (Kierulffsvej 14-22)',
    defaultDetail:
      'Kraftig muggen lugt af skimmelsvamp og kloak-aerosoler umiddelbart efter fjernelse af overliggende dæk over krybekælder i Blok 1.',
  },
  {
    type: 'Støv- og tungmetalnedfald ved Rødtjørnevej 2 (C962+VV Slagelse)',
    defaultPoint: { lat: 55.4122, lng: 11.3522 },
    defaultLocationLabel: 'Rødtjørnevej 2, 4200 Slagelse (Plus Code: C962+VV Slagelse)',
    defaultDetail:
      'Målbar støvdeposition og lugtgener ved Rødtjørnevej 2, 4200 Slagelse (Plus Code: C962+VV Slagelse, Lat 55.4122, Lng 11.3522) umiddelbart syd for Blok 1 og vest for Bygning 2 under nedbrydningsarbejde.',
  },
  {
    type: 'Naboklage: Impulsstøj (>85 dB) & betonstøv fra hydraulisk nedbrydning',
    defaultPoint: { lat: 55.4122, lng: 11.3522 },
    defaultLocationLabel: 'Rødtjørnevej 2, 4200 Slagelse (C962+VV Slagelse)',
    defaultDetail:
      'Naboklage over kraftig impulsstøj (>85 dB L_AFmax) fra hydraulisk betonknusning ved Blok 1 og mejselhammer ved Bygning 2 kombineret med synligt støvnedfald i medvind.',
  },
];

export default function App() {
  // Quota warning state for Google Maps Platform (Section 8 requirement)
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Date & Hour Time-Machine State (supports historical dates + next 7 days weather forecast)
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const nextWeekEndIso = useMemo(() => shiftDateIsoByDays(todayIso, 7), [todayIso]);
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso);
  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(13);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simulationSpeedMultiplier, setSimulationSpeedMultiplier] = useState<1 | 2 | 3 | 5 | 10>(1);
  const [showWorkspaceImpulseSensitivityGraph, setShowWorkspaceImpulseSensitivityGraph] =
    useState<boolean>(false);
  const [showWorkspaceVibrationSankey, setShowWorkspaceVibrationSankey] =
    useState<boolean>(true);
  const [isWorkspaceVibrationSankeyCollapsed, setIsWorkspaceVibrationSankeyCollapsed] =
    useState<boolean>(false);
  const [isContinuousRecordingToToday, setIsContinuousRecordingToToday] =
    useState<boolean>(true);
  const [autoSaveEvidenceOnTimeTravel, setAutoSaveEvidenceOnTimeTravel] =
    useState<boolean>(true);
  const [autoSavedEvidenceCount, setAutoSavedEvidenceCount] = useState<number>(0);
  const [lastAutoSavedFindingLabel, setLastAutoSavedFindingLabel] = useState<
    string | null
  >(null);
  const autoSavedTimestampsRef = useRef<Set<string>>(new Set());
  const isInitialMountTimeTravelRef = useRef<boolean>(true);
  const [playbackTargetEndDateIso, setPlaybackTargetEndDateIso] =
    useState<string>(todayIso);
  const [midnightRolloverCount, setMidnightRolloverCount] = useState<number>(0);
  const [lastMidnightRolloverNotice, setLastMidnightRolloverNotice] = useState<{
    fromDateIso: string;
    toDateIso: string;
  } | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Pre-populated timeline & midnight-rollover log from Last Week's Test Run (ready from start)
  const [recordedTimelineEvents, setRecordedTimelineEvents] = useState<
    TimeTravelRecordedEvent[]
  >(() => {
    const lastWeekPairs = buildLastWeekPredictedVsActualWeatherPairs(todayIso);
    return lastWeekPairs.map((pair, idx) => {
      const prevDate =
        idx === 0
          ? shiftDateIsoByDays(pair.dateIso, -1)
          : lastWeekPairs[idx - 1].dateIso;
      const sim00 = runDispersionSimulation(
        pair.dateIso,
        0,
        pair.actualDataset.hours,
        INITIAL_DEMOLITION_SOURCES,
        INITIAL_RECEPTOR_ZONES
      );
      const simPeak = runDispersionSimulation(
        pair.dateIso,
        13,
        pair.actualDataset.hours,
        INITIAL_DEMOLITION_SOURCES,
        INITIAL_RECEPTOR_ZONES
      );
      const hr13 = pair.actualDataset.hours[13] || pair.actualDataset.hours[0];
      return {
        id: `init-lw-${pair.dateIso}`,
        recordedAtRealIso: new Date().toISOString(),
        simulatedDateIso: pair.dateIso,
        simulatedHourIndex: 0,
        simulatedHourLabel: '00:00',
        isMidnightDateRollover: true,
        previousDateIso: prevDate,
        windSpeedMs: hr13.windSpeed10m,
        windGustsMs: hr13.windGusts10m,
        windDirectionDeg: hr13.windDirection10m,
        plumeDirectionDeg: (hr13.windDirection10m + 180) % 360,
        precipitationMm: hr13.precipitation,
        maxSumQuotient: Number(
          Math.max(sim00.maxSiteSumQuotient, simPeak.maxSiteSumQuotient).toFixed(2)
        ),
        worstReceptorCode: simPeak.worstExposedReceptor.receptorCode,
        worstReceptorName: simPeak.worstExposedReceptor.receptorName,
        worstReceptorAddress: simPeak.worstExposedReceptor.address,
        legalStatusLabel:
          simPeak.maxSiteSumQuotient >= 1.0
            ? 'OVERSKRIDELSE (S ≥ 1,0)'
            : 'OBSERVATIONSZONE',
        noteDa: `Test fra sidste uge (${pair.weekdayNameDa} ${pair.dateIso}): Dato skiftet ved kl. 00:00 (${prevDate} → ${pair.dateIso}) · ${pair.eventAnomalyHeadline}`,
      };
    });
  });

  // 24-Hour Gaussian Puff Cumulative Mode State, Animated Plume-Path Route & Dual-Hour Heatmap Comparison State
  const [isPuffMode, setIsPuffMode] = useState<boolean>(true);
  const [isAnimatingPlumeRoute, setIsAnimatingPlumeRoute] = useState<boolean>(false);
  const [plumeRouteProgress, setPlumeRouteProgress] = useState<number>(13);
  const [showHeatmapComparison, setShowHeatmapComparison] = useState<boolean>(true);
  const [heatmapComparisonViewMode, setHeatmapComparisonViewMode] =
    useState<HeatmapComparisonViewMode>('difference');
  const [comparisonHourAIndex, setComparisonHourAIndex] = useState<number>(8);
  const [viewportMode, setViewportMode] = useState<
    '3d' | 'underground_3d' | 'underground_2d' | 'underground_split' | 'split' | '2d' | 'risk_gis'
  >('3d');
  const [activeUserRole, setActiveUserRole] = useState<
    'workspace' | 'resident' | 'worker' | 'audit' | 'climate'
  >('workspace');
  const [focusedGisBuildingId, setFocusedGisBuildingId] = useState<string | null>(null);
  const [precipitationOverrideMm, setPrecipitationOverrideMm] = useState<number | null>(null);
  const [isFullscreen3D, setIsFullscreen3D] = useState<boolean>(false);
  const [isMapOnlyMode, setIsMapOnlyMode] = useState<boolean>(false);

  // Kierulffsvej DN200 Drinking Water Main Layer State (SK Vand A/S / Envafors)
  const [showWaterMainInSurface, setShowWaterMainInSurface] = useState<boolean>(false);
  const [showWaterMainInUnderground, setShowWaterMainInUnderground] = useState<boolean>(true);
  const [hasSteelRoadPlates, setHasSteelRoadPlates] = useState<boolean>(false);
  const [showLerBuffer, setShowLerBuffer] = useState<boolean>(true);
  const [simulatedPipeRuptureActive, setSimulatedPipeRuptureActive] = useState<boolean>(false);
  const [isS3ValveLockoutActive, setIsS3ValveLockoutActive] = useState<boolean>(false);
  const [virtualLeakPinPoint, setVirtualLeakPinPoint] = useState<LatLngPoint | null>(null);
  const [waterMainCoordMode, setWaterMainCoordMode] =
    useState<WaterMainCoordinateMode>('scene_calibrated');
  const isUndergroundViewport =
    viewportMode === 'underground_3d' ||
    viewportMode === 'underground_2d' ||
    viewportMode === 'underground_split';
  const effectiveShowWaterMainLayer = isUndergroundViewport
    ? showWaterMainInUnderground
    : showWaterMainInSurface;
  const handleToggleWaterMainLayer = useCallback(() => {
    if (isUndergroundViewport) {
      setShowWaterMainInUnderground((v) => !v);
    } else {
      setShowWaterMainInSurface((v) => !v);
    }
  }, [isUndergroundViewport]);

  // Allow pressing Escape to exit Fullscreen mode or 'Kun Kort' mode
  useEffect(() => {
    if (!isFullscreen3D && !isMapOnlyMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen3D(false);
        setIsMapOnlyMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen3D, isMapOnlyMode]);

  const [showRibbonWindRose, setShowRibbonWindRose] = useState<boolean>(false);
  const [showRibbon7DayWindRose, setShowRibbon7DayWindRose] = useState<boolean>(false);
  const [showRibbon30DayHeatmap, setShowRibbon30DayHeatmap] = useState<boolean>(false);
  const [showRibbonPredVsActual, setShowRibbonPredVsActual] = useState<boolean>(false);
  const [showRibbonDispersionForecast, setShowRibbonDispersionForecast] =
    useState<boolean>(false);
  const [dispersionForecastMode, setDispersionForecastMode] =
    useState<DispersionForecastOptionMode>('five_day_forecast');
  const [forecastAnchorDateIso, setForecastAnchorDateIso] =
    useState<string>(todayIso);
  const [dispersionForecastFocusTrigger, setDispersionForecastFocusTrigger] =
    useState<number>(1);
  const [showRibbonStochasticBias, setShowRibbonStochasticBias] = useState<boolean>(false);
  const [showRibbonProactiveAgent, setShowRibbonProactiveAgent] = useState<boolean>(false);
  const [showRibbonTempChart, setShowRibbonTempChart] = useState<boolean>(false);
  const [showRibbonStackEffect, setShowRibbonStackEffect] = useState<boolean>(false);
  const [weatherJsonExportedJustNow, setWeatherJsonExportedJustNow] = useState<boolean>(false);
  const [showRibbonAcousticRefraction, setShowRibbonAcousticRefraction] = useState<boolean>(false);
  const [showWindNoiseSensitivityAnalysis, setShowWindNoiseSensitivityAnalysis] =
    useState<boolean>(false);
  const [selectedImpulseMachineryKey, setSelectedImpulseMachineryKey] = useState<
    'hydraulic_hammer' | 'concrete_crusher' | 'steel_shear_impact'
  >('hydraulic_hammer');
  const [showWindCompensatedImpulseCatalog, setShowWindCompensatedImpulseCatalog] =
    useState<boolean>(false);
  const [selectedDbaNeighborBlockKey] = useState<
    'roedtjoernevej_2' | 'schackenborgvaenget_b' | 'kierulffsvej_4' | 'ringparken_blok_3'
  >('roedtjoernevej_2');
  const [customDbaFileName] = useState<string | null>(null);
  const [customDbaOffsetDb] = useState<number>(0);

  // Automatic Width & Orientation Adaptation (Standard, Mobil, Tablet × Stående & Liggende)
  const [deviceEditionSelection, setDeviceEditionSelection] = useState<
    'auto' | 'standard' | 'tablet' | 'mobile'
  >('auto');
  const [orientationSelection, setOrientationSelection] = useState<
    'auto' | 'portrait' | 'landscape'
  >('auto');
  const [liveViewportMetrics, setLiveViewportMetrics] = useState<{
    width: number;
    height: number;
    detectedEdition: 'standard' | 'tablet' | 'mobile';
    detectedOrientation: 'portrait' | 'landscape';
  }>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const detectedEdition: 'standard' | 'tablet' | 'mobile' =
      w < 768 ? 'mobile' : w < 1200 ? 'tablet' : 'standard';
    const detectedOrientation: 'portrait' | 'landscape' =
      h >= w ? 'portrait' : 'landscape';
    return { width: w, height: h, detectedEdition, detectedOrientation };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateViewportAdaptation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isMobileLandscape = w <= 932 && h <= 540 && w > h;
      const detectedEdition: 'standard' | 'tablet' | 'mobile' =
        w < 768 || isMobileLandscape ? 'mobile' : w < 1200 ? 'tablet' : 'standard';
      const mqlPortrait = window.matchMedia?.('(orientation: portrait)')?.matches;
      const detectedOrientation: 'portrait' | 'landscape' =
        typeof mqlPortrait === 'boolean'
          ? mqlPortrait
            ? 'portrait'
            : 'landscape'
          : h >= w
          ? 'portrait'
          : 'landscape';
      setLiveViewportMetrics({
        width: w,
        height: h,
        detectedEdition,
        detectedOrientation,
      });
    };
    updateViewportAdaptation();
    window.addEventListener('resize', updateViewportAdaptation);
    window.addEventListener('orientationchange', updateViewportAdaptation);
    const mql = window.matchMedia?.('(orientation: portrait)');
    if (mql?.addEventListener) {
      mql.addEventListener('change', updateViewportAdaptation);
    }
    return () => {
      window.removeEventListener('resize', updateViewportAdaptation);
      window.removeEventListener('orientationchange', updateViewportAdaptation);
      if (mql?.removeEventListener) {
        mql.removeEventListener('change', updateViewportAdaptation);
      }
    };
  }, []);

  const effectiveDeviceEdition: 'standard' | 'tablet' | 'mobile' =
    deviceEditionSelection === 'auto'
      ? liveViewportMetrics.detectedEdition
      : deviceEditionSelection;
  const effectiveOrientation: 'portrait' | 'landscape' =
    orientationSelection === 'auto'
      ? liveViewportMetrics.detectedOrientation
      : orientationSelection;

  const [manualMachineNoiseOutputDb, setManualMachineNoiseOutputDb] =
    useState<number>(114);
  const [isManualMachineNoiseOverrideActive, setIsManualMachineNoiseOverrideActive] =
    useState<boolean>(true);
  const [showHeaderWeatherCorrelationPopup, setShowHeaderWeatherCorrelationPopup] =
    useState<boolean>(false);
  const [isExportHubOpen, setIsExportHubOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [densityMode, setDensityMode] = useState<UiDensityMode>(() => {
    try {
      const saved = window.localStorage.getItem('ringparken_ui_density');
      return saved === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const handleToggleDensityMode = useCallback(() => {
    setDensityMode((prev) => {
      const next: UiDensityMode = prev === 'comfortable' ? 'compact' : 'comfortable';
      try {
        window.localStorage.setItem('ringparken_ui_density', next);
      } catch {
        // ignore storage quota errors in sandboxed iframes
      }
      return next;
    });
  }, []);
  const [showRibbonMedicalExpert, setShowRibbonMedicalExpert] = useState<boolean>(false);
  const [showRibbonExpertChat, setShowRibbonExpertChat] = useState<boolean>(false);
  const [showRibbonDepositionProfile, setShowRibbonDepositionProfile] = useState<boolean>(false);

  // Fra - Til Interval Simulation ("fra dato_klokkeslæt - Til dato_klokkeslæt") & 3D Blok 1/2 Percolation Focus State
  const [isRangeSimPanelOpen, setIsRangeSimPanelOpen] = useState<boolean>(false);
  const [rangeFromDateIso, setRangeFromDateIso] = useState<string>(() =>
    shiftDateIsoByDays(todayIso, -1)
  );
  const [rangeFromHourIndex, setRangeFromHourIndex] = useState<number>(8);
  const [rangeToDateIso, setRangeToDateIso] = useState<string>(todayIso);
  const [rangeToHourIndex, setRangeToHourIndex] = useState<number>(16);
  const [isRunningRangeSimulation, setIsRunningRangeSimulation] = useState<boolean>(false);
  const [rangeSimulationProgress, setRangeSimulationProgress] = useState<{
    completed: number;
    total: number;
    currentLabel: string;
  } | null>(null);
  const [completedRangeSimulation, setCompletedRangeSimulation] =
    useState<RangeSimulationSummary | null>(null);
  const [focusBlok12PercolationTrigger, setFocusBlok12PercolationTrigger] =
    useState<number>(0);

  // Draggable & Minimizable Dashboard Windows State
  const [topWindowZIndex, setTopWindowZIndex] = useState<number>(20);
  const [windowStates, setWindowStates] = useState<
    Record<DashboardWindowId, WindowInstanceState>
  >(() => {
    const initial = {} as Record<DashboardWindowId, WindowInstanceState>;
    (Object.keys(DASHBOARD_WINDOW_REGISTRY) as DashboardWindowId[]).forEach(
      (id, idx) => {
        const meta = DASHBOARD_WINDOW_REGISTRY[id];
        initial[id] = {
          id,
          isFloating: false,
          isMinimized: false,
          x: meta.defaultX,
          y: meta.defaultY,
          width: meta.defaultWidth,
          zIndex: idx + 1,
        };
      }
    );
    return initial;
  });

  const handleFocusWindow = useCallback((id: DashboardWindowId) => {
    setTopWindowZIndex((prevZ) => {
      const nextZ = prevZ + 1;
      setWindowStates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          zIndex: nextZ,
        },
      }));
      return nextZ;
    });
  }, []);

  const handleMoveFloatingWindow = useCallback(
    (id: DashboardWindowId, x: number, y: number) => {
      setWindowStates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          x,
          y,
        },
      }));
    },
    []
  );

  const handleMinimizeWindow = useCallback((id: DashboardWindowId) => {
    setWindowStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isMinimized: true,
      },
    }));
  }, []);

  const handleRestoreWindow = useCallback((id: DashboardWindowId) => {
    setWindowStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isMinimized: false,
        isFloating: false,
      },
    }));
    // Also switch to the relevant tab if restoring a docked window
    if (id === 'photo_upload' || id === 'algedonic_observations') {
      setActiveTab('algedonic');
    } else if (
      id === 'proactive_ai_agent' ||
      id === 'noise_dust_correlation' ||
      id === 'wind_noise_correlation' ||
      id === 'rolling_6h_wind_noise_correlation'
    ) {
      setActiveTab('noiseDust');
    } else if (
      id === 'thirty_day_aggregated_heatmap' ||
      id === 'prediction_vs_actual_forecast' ||
      id === 'stochastic_wind_bias' ||
      id === 'wind_rose_7day' ||
      id === 'wind_rose_24h' ||
      id === 'temp_aerosol_24h' ||
      id === 'cumulative_dust_24h' ||
      id === 'receptor_dust_deposition_profile'
    ) {
      setActiveTab('puff24h');
    } else if (id === 'substances_sumformel') {
      setActiveTab('substances');
    } else if (id === 'legal_compliance') {
      setActiveTab('compliance');
    } else if (id === 'gemini_grounding_chat') {
      setActiveTab('grounding');
    } else if (
      id === 'bioscience_toxicology' ||
      id === 'medical_expert_ai' ||
      id === 'who_cumulative_exposure_score'
    ) {
      setActiveTab('bioscience');
    }
  }, []);

  const handlePopOutFloatingWindow = useCallback(
    (id: DashboardWindowId, initialX?: number, initialY?: number) => {
      setTopWindowZIndex((prevZ) => {
        const nextZ = prevZ + 1;
        setWindowStates((prev) => {
          const current = prev[id];
          return {
            ...prev,
            [id]: {
              ...current,
              isFloating: true,
              isMinimized: false,
              x: initialX ?? current.x,
              y: initialY ?? current.y,
              zIndex: nextZ,
            },
          };
        });
        return nextZ;
      });
    },
    []
  );

  const handleCloseOrDockFloatingWindow = useCallback(
    (id: DashboardWindowId) => {
      setWindowStates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          isFloating: false,
          isMinimized: false,
        },
      }));
    },
    []
  );

  const handleMinimizeAllFloating = useCallback(() => {
    setWindowStates((prev) => {
      const next = { ...prev };
      (Object.keys(next) as DashboardWindowId[]).forEach((id) => {
        if (next[id].isFloating) {
          next[id] = { ...next[id], isMinimized: true };
        }
      });
      return next;
    });
  }, []);

  const handleRestoreAllMinimized = useCallback(() => {
    setWindowStates((prev) => {
      const next = { ...prev };
      (Object.keys(next) as DashboardWindowId[]).forEach((id) => {
        if (next[id].isMinimized) {
          next[id] = { ...next[id], isMinimized: false };
        }
      });
      return next;
    });
  }, []);

  // Weather dataset (initialized with calibrated fallback, then immediately populated with all 24 hours from Open-Meteo API)
  const [weatherDataset, setWeatherDataset] = useState<WeatherDataset>(() => {
    const defaultScenario = CRITICAL_WEATHER_SCENARIOS[0];
    return {
      dateIso: todayIso,
      sourceApi: 'Open-Meteo 24-Timers Vejrtelemetri (Indlæser...)',
      fetchedAtIso: new Date().toISOString(),
      isScenarioOverride: false,
      hours: defaultScenario.generate24Hours(todayIso),
    };
  });
  const [isLoadingWeather, setIsLoadingWeather] = useState<boolean>(false);

  // Master Building Registry (29 physical units: 24 residential blocks + 5 commercial/institutional buildings)
  // Dynamically synchronized with DemolitionSourceNode[] and ReceptorZone[]
  const [buildings, setBuildings] = useState<RingparkenBuildingUnit[]>(
    RINGPARKEN_MASTER_BUILDINGS
  );
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<
    BuildingOperationalCategory[]
  >([
    'a_inhabited',
    'b_vacant',
    'c_under_renovation',
    'd_under_demolition',
    'e_demolished_unsecured',
  ]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>('BLOK-1');
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, SourceNodeOverride>>({});
  const [customSources, setCustomSources] = useState<DemolitionSourceNode[]>([]);
  const [customReceptors, setCustomReceptors] = useState<ReceptorZone[]>([]);

  const sources = useMemo(
    () => deriveSourcesFromBuildings(buildings, sourceOverrides, customSources),
    [buildings, sourceOverrides, customSources]
  );
  const receptors = useMemo(
    () => deriveReceptorsFromBuildings(buildings, customReceptors),
    [buildings, customReceptors]
  );

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>('src-blok-1');
  const [hiddenSourceIds, setHiddenSourceIds] = useState<string[]>([]);
  const handleToggleSourceVisibility = useCallback((sourceId: string) => {
    setHiddenSourceIds((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    );
  }, []);
  const handleShowAllSources = useCallback(() => {
    setHiddenSourceIds([]);
  }, []);
  const [visibleSubstances, setVisibleSubstances] = useState<Record<SubstanceKey, boolean>>({
    asbestos: true,
    heavyMetals: true,
    pcb: true,
    quartzWool: true,
    moldSewer: true,
  });
  const handleToggleSubstanceVisibility = useCallback((key: SubstanceKey) => {
    setVisibleSubstances((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);
  const handleSetAllSubstancesVisibility = useCallback((visible: boolean) => {
    setVisibleSubstances({
      asbestos: visible,
      heavyMetals: visible,
      pcb: visible,
      quartzWool: visible,
      moldSewer: visible,
    });
  }, []);
  const [showWindNoiseHeatmapLayer, setShowWindNoiseHeatmapLayer] = useState<boolean>(false);
  const [showPlumeConcentrationHeatmap, setShowPlumeConcentrationHeatmap] =
    useState<boolean>(false);
  const [plumeHeatmapPasquillThreshold, setPlumeHeatmapPasquillThreshold] =
    useState<number>(0.25);
  const [showWeatherCorrelationHeatmapLayer, setShowWeatherCorrelationHeatmapLayer] =
    useState<boolean>(true);
  const [validatePhotoEvidenceBinary, setValidatePhotoEvidenceBinary] =
    useState<boolean>(true);
  const [exportFilter, setExportFilter] = useState<ExportFilterCriteria>(() => ({
    enabled: false,
    startDateIso: todayIso,
    endDateIso: todayIso,
    receptorIds: [],
    substances: ['asbestos', 'pcb', 'heavyMetals', 'quartzWool', 'moldSewer'],
  }));
  const exportFilterRef = useRef<ExportFilterCriteria>(exportFilter);
  const handleChangeExportFilter = useCallback((next: ExportFilterCriteria) => {
    exportFilterRef.current = next;
    setExportFilter(next);
  }, []);
  const [selectedReceptorId, setSelectedReceptorId] = useState<string | null>('rec-roedtjoornevej-2');
  const [mapClickMode, setMapClickMode] = useState<
    'none' | 'add_source' | 'add_receptor' | 'add_observation'
  >('none');

  // Algedonic Signal / Physical Observation Reporting State
  const [pendingObservationPoint, setPendingObservationPoint] = useState<LatLngPoint>({
    lat: 55.41295,
    lng: 11.35365,
  });
  const [obsLocationLabel, setObsLocationLabel] = useState<string>(
    ALGEDONIC_OBSERVATION_PRESETS[0].defaultLocationLabel
  );
  const [obsReporterRole, setObsReporterRole] = useState<ReporterRole>(
    'Arbejdsmiljørepræsentant (AMR)'
  );
  const [obsReporterId, setObsReporterId] = useState<string>('AMR / Beboer-Tilsyn #4200');
  const [obsType, setObsType] = useState<string>(ALGEDONIC_OBSERVATION_PRESETS[0].type);
  const [obsDescription, setObsDescription] = useState<string>(
    ALGEDONIC_OBSERVATION_PRESETS[0].defaultDetail
  );
  const [pendingPhotoEvidence, setPendingPhotoEvidence] =
    useState<ForensicPhotoEvidence | undefined>(undefined);
  const [observations, setObservations] = useState<AlgedonicObservation[]>([]);
  const observationsRef = useRef<AlgedonicObservation[]>(observations);
  observationsRef.current = observations;
  const observationsCountRef = useRef<number>(observations.length);
  observationsCountRef.current = Math.max(
    observationsCountRef.current,
    observations.length
  );
  const pendingObsSignPromisesRef = useRef<Set<Promise<void>>>(new Set());
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [rightToOpacityEnabled, setRightToOpacityEnabled] = useState<boolean>(true);
  const [relaxationTimeTrHours, setRelaxationTimeTrHours] = useState<number>(18.5);

  // Right Panel Navigation & Report Modal
  const [activeTab, setActiveTab] = useState<RightPanelTab>('algedonic');
  const [legalBasisFilter, setLegalBasisFilter] = useState<'ALL' | LegalBasisFilterCategory>('ALL');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportModalInitialTab, setReportModalInitialTab] =
    useState<ReportModalTab>('legal_submission');
  const [sha256Hash, setSha256Hash] = useState<string>('beregner...');

  // Google Maps Grounding AI State
  const [groundingAnalysis, setGroundingAnalysis] = useState<string>('');
  const [groundingPlaces, setGroundingPlaces] = useState<MapsGroundingPlace[]>([]);
  const [isLoadingGrounding, setIsLoadingGrounding] = useState<boolean>(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);

  // Fetch all 24 hours of wind directions and wind speeds for the selected date from Open-Meteo
  const loadLiveOpenMeteo = useCallback(async (targetDate: string) => {
    setIsLoadingWeather(true);
    setActiveScenarioId(null);
    try {
      const ds = await fetchOpenMeteoWeatherForDate(targetDate);
      setWeatherDataset(ds);
    } finally {
      setIsLoadingWeather(false);
    }
  }, []);

  // Automatically fetch 24-hour Open-Meteo data on initial mount
  useEffect(() => {
    loadLiveOpenMeteo(todayIso);
  }, [loadLiveOpenMeteo, todayIso]);

  // Unified handler to change the simulated date from anywhere (including Fullscreen & Kun Kort modes)
  const handleChangeSimulatedDateIso = useCallback(
    (nextDateIso: string) => {
      if (!nextDateIso) return;
      setSelectedDateIso(nextDateIso);
      loadLiveOpenMeteo(nextDateIso);
    },
    [loadLiveOpenMeteo]
  );

  // Unified handler to step simulated hour (-1t / +1t) from 3D/2D Fullscreen & Kun Kort modes
  const handleStepSimulatedHour = useCallback((deltaHours: number) => {
    setSelectedHourIndex((prev) => {
      const next = (prev + deltaHours + 24) % 24;
      setPlumeRouteProgress(next);
      return next;
    });
  }, []);

  // Handler when user toggles "Vis 24-timers kumulativt aftryk" next to Time-Slider
  const handleToggle24hPuffMode = useCallback(() => {
    setIsPuffMode((prev) => {
      const next = !prev;
      if (next) {
        setActiveTab('puff24h');
        // Ensure all 24 hours of wind directions & speeds for selectedDateIso are fetched from Open-Meteo if not in a manual scenario override
        if (!activeScenarioId) {
          loadLiveOpenMeteo(selectedDateIso);
        }
      } else {
        setIsAnimatingPlumeRoute(false);
      }
      return next;
    });
  }, [activeScenarioId, loadLiveOpenMeteo, selectedDateIso]);

  // Handler when user clicks "Animér Fanevej-Rute" in Puff-Historik or on the map
  const handleToggleAnimatePlumeRoute = useCallback(() => {
    setIsPuffMode(true);
    setActiveTab('puff24h');
    setIsPlaying(false);
    setIsAnimatingPlumeRoute((prev) => {
      const next = !prev;
      if (next) {
        setPlumeRouteProgress(0);
        setSelectedHourIndex(0);
      }
      return next;
    });
  }, []);

  const handleApplyScenario = (scenarioId: string) => {
    const found = CRITICAL_WEATHER_SCENARIOS.find((s) => s.id === scenarioId);
    if (!found) return;
    setActiveScenarioId(found.id);
    setSelectedHourIndex(found.defaultFocusHour);
    setPlumeRouteProgress(found.defaultFocusHour);
    setWeatherDataset({
      dateIso: selectedDateIso,
      sourceApi: `Kritisk Scenarie: ${found.title} (24t Slagelse-profil)`,
      fetchedAtIso: new Date().toISOString(),
      isScenarioOverride: true,
      scenarioName: found.title,
      hours: found.generate24Hours(selectedDateIso),
    });
  };

  // Helper to append a continuous time-travel / midnight rollover event & sync registration date
  const recordTimeTravelStep = useCallback(
    (
      nextDateIso: string,
      prevDateIso: string,
      hrIdx: number,
      isMidnightRollover: boolean,
      dsForDate: WeatherDataset
    ) => {
      const hrPoint = dsForDate.hours[hrIdx] || dsForDate.hours[0];
      if (!hrPoint) return;
      const stepSim = runDispersionSimulation(
        nextDateIso,
        hrIdx,
        dsForDate.hours,
        sources,
        receptors
      );
      const hourStr = `${String(hrIdx).padStart(2, '0')}:00`;
      const plumeDeg = (hrPoint.windDirection10m + 180) % 360;
      const entry: TimeTravelRecordedEvent = {
        id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        recordedAtRealIso: new Date().toISOString(),
        simulatedDateIso: nextDateIso,
        simulatedHourIndex: hrIdx,
        simulatedHourLabel: hourStr,
        isMidnightDateRollover: isMidnightRollover,
        previousDateIso: isMidnightRollover ? prevDateIso : undefined,
        windSpeedMs: hrPoint.windSpeed10m,
        windGustsMs: hrPoint.windGusts10m,
        windDirectionDeg: hrPoint.windDirection10m,
        plumeDirectionDeg: plumeDeg,
        precipitationMm: hrPoint.precipitation,
        maxSumQuotient: Number(stepSim.maxSiteSumQuotient.toFixed(2)),
        worstReceptorCode: stepSim.worstExposedReceptor.receptorCode,
        worstReceptorName: stepSim.worstExposedReceptor.receptorName,
        worstReceptorAddress: stepSim.worstExposedReceptor.address,
        legalStatusLabel:
          stepSim.maxSiteSumQuotient >= 1.0
            ? 'KRITISK OVERSKRIDELSE (S ≥ 1,0)'
            : 'UNDER GRÆNSE / OBSERVATION',
        noteDa: isMidnightRollover
          ? `Kl. 00:00 Dato-skift på hændelsesafspilning & registrering (${prevDateIso} → ${nextDateIso}) · Fortsætter mod ${playbackTargetEndDateIso} · Mest udsat: ${stepSim.worstExposedReceptor.receptorCode} (S=${stepSim.maxSiteSumQuotient.toFixed(2)})`
          : `Auto-gemt tidsrejse-fund (${nextDateIso} kl. ${hourStr}): Vind ${hrPoint.windSpeed10m} m/s → ${stepSim.worstExposedReceptor.receptorCode} (S=${stepSim.maxSiteSumQuotient.toFixed(2)})`,
      };

      setRecordedTimelineEvents((prev) => {
        if (
          prev[0] &&
          prev[0].simulatedDateIso === nextDateIso &&
          prev[0].simulatedHourIndex === hrIdx &&
          prev[0].isMidnightDateRollover === isMidnightRollover
        ) {
          return prev;
        }
        return [entry, ...prev.slice(0, 180)];
      });

      if (isMidnightRollover) {
        setMidnightRolloverCount((c) => c + 1);
        setLastMidnightRolloverNotice({
          fromDateIso: prevDateIso,
          toDateIso: nextDateIso,
        });
      }

      // Continuously save findings to forensic evidence log (observations) when Auto gem beviser is active (or on midnight rollover)
      if (autoSaveEvidenceOnTimeTravel || isMidnightRollover) {
        const stepKey = `${nextDateIso}T${hourStr}${isMidnightRollover ? '|MIDNIGHT' : ''}`;
        if (!autoSavedTimestampsRef.current.has(stepKey)) {
          autoSavedTimestampsRef.current.add(stepKey);

          const corr = evaluatePointInDispersionPlume(
            stepSim.worstExposedReceptor.position,
            sources,
            hrPoint,
            isMidnightRollover
              ? `Automatisk Tidsrejse Døgn-Skift Registrering (kl. 00:00 · ${nextDateIso})`
              : `Auto-Gemt Tidsrejse-Fund (${nextDateIso} kl. ${hourStr})`
          );
          computeForensicSha256Hash({
            type: isMidnightRollover
              ? 'MIDNIGHT_ROLLOVER_REGISTRATION'
              : 'AUTO_SAVE_TIMETRAVEL_EVIDENCE',
            fromDateIso: prevDateIso,
            toDateIso: nextDateIso,
            hour: hourStr,
            weather: hrPoint,
            sumQuotient: stepSim.maxSiteSumQuotient,
            receptor: stepSim.worstExposedReceptor.receptorCode,
          }).then((sig) => {
            const autoObs: AlgedonicObservation = {
              id: `obs-autotravel-${nextDateIso}-h${String(hrIdx).padStart(2, '0')}-${Date.now()}`,
              code: isMidnightRollover
                ? `DATO-${nextDateIso.slice(5)}`
                : `AUTO-${nextDateIso.slice(5)}-H${String(hrIdx).padStart(2, '0')}`,
              createdAtIso: new Date().toISOString(),
              observedDateIso: nextDateIso,
              observedHourIndex: hrIdx,
              observedHourLabel: hourStr,
              observedTimestampIso: `${nextDateIso}T${hourStr}`,
              position: stepSim.worstExposedReceptor.position,
              locationLabel: `${stepSim.worstExposedReceptor.receptorName} (${stepSim.worstExposedReceptor.address})`,
              reporterRole: 'Byggerådgiver / Miljøtekniker',
              reporterIdentifier: isMidnightRollover
                ? 'Tidsrejse Kontinuerlig Registrering (Kl. 00:00)'
                : 'Auto-Gem Beviser (Kontinuerlig Tidsrejse)',
              observationType: isMidnightRollover
                ? `Automatisk Dato-Skift & Kontinuerlig Hændelses-Registrering (${prevDateIso} → ${nextDateIso} kl. 00:00)`
                : `⚡ Auto-Gemt Tidsrejse-Fund (${nextDateIso} kl. ${hourStr} · ${stepSim.worstExposedReceptor.receptorCode} · S=${stepSim.maxSiteSumQuotient.toFixed(2)})`,
              description: isMidnightRollover
                ? `Ved overgang til kl. 00:00 skiftede hændelsesafspilningen og bevisregistreringen automatisk dato fra ${prevDateIso} til ${nextDateIso}. Kontinuerlig registrering fortsætter frem til ${playbackTargetEndDateIso}. Mest eksponerede receptor: ${stepSim.worstExposedReceptor.receptorName} (S=${stepSim.maxSiteSumQuotient.toFixed(2)}).`
                : `Kontinuerligt auto-gemt fund ved tidsrejse (${nextDateIso} kl. ${hourStr}): Vind ${hrPoint.windSpeed10m.toFixed(1)} m/s (${hrPoint.windDirection10m}°, PG-${hrPoint.pasquillClass}), temp. ${hrPoint.temperature2m.toFixed(1)}°C. Mest berørte receptor: ${stepSim.worstExposedReceptor.receptorName} (${stepSim.worstExposedReceptor.address}) fra ${stepSim.worstExposedReceptor.dominantSourceName} med sumkvotient S = ${stepSim.maxSiteSumQuotient.toFixed(2)} (${stepSim.maxSiteSumQuotient >= 1.0 ? 'KRITISK OVERSKRIDELSE jf. BEK 613/2026 & MBL § 19' : 'Dokumenteret eksponeringsmåling'}).`,
              weatherSnapshot: hrPoint,
              plumeCorroboration: corr,
              sha256Signature: sig,
            };
            setObservations((prevObs) => [autoObs, ...prevObs]);
            setAutoSavedEvidenceCount((c) => c + 1);
            setLastAutoSavedFindingLabel(
              `${nextDateIso} kl. ${hourStr} → ${stepSim.worstExposedReceptor.receptorCode} (S=${stepSim.maxSiteSumQuotient.toFixed(2)})`
            );
          });
        }
      }
    },
    [autoSaveEvidenceOnTimeTravel, playbackTargetEndDateIso, receptors, sources]
  );

  // Continuously auto-save evidence whenever the user travels across hours/dates (slider scrub, -1t/+1t, date change, or playback) when autoSaveEvidenceOnTimeTravel is active
  useEffect(() => {
    if (isInitialMountTimeTravelRef.current) {
      isInitialMountTimeTravelRef.current = false;
      return;
    }
    if (!autoSaveEvidenceOnTimeTravel) return;
    const debounceId = window.setTimeout(() => {
      recordTimeTravelStep(
        selectedDateIso,
        selectedDateIso,
        selectedHourIndex,
        false,
        weatherDataset
      );
    }, 180);
    return () => window.clearTimeout(debounceId);
  }, [
    selectedDateIso,
    selectedHourIndex,
    autoSaveEvidenceOnTimeTravel,
    weatherDataset,
    recordTimeTravelStep,
  ]);

  // Playback timer for Time-Slider with automatic Midnight (00:00) Date Rollover & Continuous Recording up to Today's Date
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      if (selectedHourIndex < 23) {
        const nextHr = selectedHourIndex + 1;
        setSelectedHourIndex(nextHr);
        setPlumeRouteProgress(nextHr);

        // Log every hour when Auto gem beviser is enabled, or key hours during standard continuous time-travel recording
        if (
          autoSaveEvidenceOnTimeTravel ||
          (isContinuousRecordingToToday &&
            (nextHr === 8 || nextHr === 12 || nextHr === 16 || nextHr === 20))
        ) {
          recordTimeTravelStep(
            selectedDateIso,
            selectedDateIso,
            nextHr,
            false,
            weatherDataset
          );
        }
      } else {
        // Clock reaches 00:00 (transition from 23:00 -> 00:00)
        if (selectedDateIso < playbackTargetEndDateIso) {
          const nextDateIso = shiftDateIsoByDays(selectedDateIso, 1);
          setSelectedDateIso(nextDateIso);
          setSelectedHourIndex(0);
          setPlumeRouteProgress(0);

          // Immediately fetch/update weather dataset for the new date and record the midnight 00:00 date rollover
          fetchOpenMeteoWeatherForDate(nextDateIso).then((nextDs) => {
            setWeatherDataset(nextDs);
            recordTimeTravelStep(
              nextDateIso,
              selectedDateIso,
              0,
              true,
              nextDs
            );
          });
        } else if (isContinuousRecordingToToday && selectedDateIso === playbackTargetEndDateIso) {
          // Reached the end of target date (dags dato) — stop continuous recording unless user restarts
          setIsPlaying(false);
        } else {
          // Single-day wrap when already on target date without continuous multi-day progression
          setSelectedHourIndex(0);
          setPlumeRouteProgress(0);
        }
      }
    }, Math.max(75, Math.round(850 / simulationSpeedMultiplier)));
    return () => window.clearInterval(timer);
  }, [
    isPlaying,
    simulationSpeedMultiplier,
    selectedHourIndex,
    selectedDateIso,
    playbackTargetEndDateIso,
    isContinuousRecordingToToday,
    autoSaveEvidenceOnTimeTravel,
    weatherDataset,
    recordTimeTravelStep,
  ]);

  // Smooth 24-hour Plume-Path Route ('Animér Fanevej-Rute') animation timer (also supports midnight 00:00 date rollover when traveling back in time)
  useEffect(() => {
    if (!isAnimatingPlumeRoute) return;
    const timer = window.setInterval(() => {
      setPlumeRouteProgress((prev) => {
        const next = prev + 0.08 * simulationSpeedMultiplier;
        if (next >= 24) {
          if (selectedDateIso < playbackTargetEndDateIso) {
            const nextDateIso = shiftDateIsoByDays(selectedDateIso, 1);
            setSelectedDateIso(nextDateIso);
            fetchOpenMeteoWeatherForDate(nextDateIso).then((nextDs) => {
              setWeatherDataset(nextDs);
              recordTimeTravelStep(
                nextDateIso,
                selectedDateIso,
                0,
                true,
                nextDs
              );
            });
          }
          setSelectedHourIndex(0);
          return 0;
        }
        const hrIdx = Math.min(23, Math.floor(next));
        setSelectedHourIndex(hrIdx);
        return next;
      });
    }, 55);
    return () => window.clearInterval(timer);
  }, [
    isAnimatingPlumeRoute,
    simulationSpeedMultiplier,
    selectedDateIso,
    playbackTargetEndDateIso,
    recordTimeTravelStep,
  ]);

  // Handler to start continuous time-travel playback & recording from any past date up to today's date (dags dato)
  const handleStartTimeTravelToToday = useCallback(
    (startDateIso: string, startHourIndex = 0) => {
      setIsAnimatingPlumeRoute(false);
      setSelectedDateIso(startDateIso);
      setSelectedHourIndex(startHourIndex);
      setPlumeRouteProgress(startHourIndex);
      setPlaybackTargetEndDateIso(todayIso);
      setIsContinuousRecordingToToday(true);
      loadLiveOpenMeteo(startDateIso);
      setIsPlaying(true);
    },
    [loadLiveOpenMeteo, todayIso]
  );

  // Handler to simulate and play through the Next 7 Days Weather Forecast (+1d to +7d) with midnight 00:00 date rollover
  const handleStartNextWeekForecastPlayback = useCallback(
    (forecastDays: Next7DayForecastDay[]) => {
      const firstDay = forecastDays[0];
      if (!firstDay) return;
      const lastDay = forecastDays[forecastDays.length - 1] || firstDay;
      setIsAnimatingPlumeRoute(false);
      setSelectedDateIso(firstDay.dateIso);
      setSelectedHourIndex(0);
      setPlumeRouteProgress(0);
      setPlaybackTargetEndDateIso(lastDay.dateIso);
      setIsContinuousRecordingToToday(true);
      setWeatherDataset(firstDay.dataset);
      setIsPlaying(true);
    },
    []
  );

  const handleStopTimeTravelRecording = useCallback(() => {
    setIsPlaying(false);
    setIsAnimatingPlumeRoute(false);
  }, []);

  const handleScrubTimelineProgress = useCallback((fractionalHour: number) => {
    const clamped = Math.max(0, Math.min(23, fractionalHour));
    setPlumeRouteProgress(clamped);
    setSelectedHourIndex(Math.round(clamped));
  }, []);

  const handleMoveObservationHour = useCallback(
    (obsId: string, newHourIndex: number) => {
      const targetHr = Math.max(0, Math.min(23, Math.round(newHourIndex)));
      const targetWeather =
        weatherDataset.hours[targetHr] || weatherDataset.hours[0];
      if (!targetWeather) return;

      setObservations((prev) =>
        prev.map((obs) => {
          if (obs.id !== obsId) return obs;
          const nextCorroboration = evaluatePointInDispersionPlume(
            obs.position,
            sources,
            targetWeather,
            obs.observationType
          );
          return {
            ...obs,
            observedHourIndex: targetHr,
            observedHourLabel: targetWeather.hourLabel,
            observedTimestampIso: targetWeather.isoTime,
            weatherSnapshot: targetWeather,
            plumeCorroboration: nextCorroboration,
          };
        })
      );
    },
    [weatherDataset.hours, sources]
  );

  // Precompute 24h Gaussian Puff history per dataset/sources/receptors so continuous 60fps scrubbing only recomputes instantaneous plume polygons
  const precomputedPuff24h = useMemo(
    () =>
      compute24HourPuffHistory(
        weatherDataset.dateIso,
        weatherDataset.hours,
        sources,
        receptors
      ),
    [weatherDataset, sources, receptors]
  );

  // Run scientific dispersion (with continuous fractional-hour interpolation when scrubbing) & 24h Gaussian Puff simulation
  const simulation = useMemo(
    () =>
      runDispersionSimulation(
        weatherDataset.dateIso,
        selectedHourIndex,
        weatherDataset.hours,
        sources,
        receptors,
        {
          fractionalHour: plumeRouteProgress,
          precomputedPuff24h,
        }
      ),
    [
      weatherDataset,
      selectedHourIndex,
      plumeRouteProgress,
      sources,
      receptors,
      precomputedPuff24h,
    ]
  );

  const {
    currentWeather,
    receptorExposures,
    legalViolations,
    puff24h,
    maxSiteSumQuotient,
    worstExposedReceptor,
  } = simulation;

  // Connected network of Autonomous Nodes in every Receptor with ZKP Legal Identification & continuous Nabotest
  const autonomousReceptorMesh = useMemo(
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

  // System B Mycelium-Netværk: BFT Gate 1 (n >= 3f + 1), EU868 LoRa, Dijkstra P2P Self-Healing, CiK 2.0 & Regulatory Apoptosis
  const [myceliumDisabledNodeIds, setMyceliumDisabledNodeIds] = useState<Record<string, boolean>>({});
  const [myceliumByzantineNodeIds, setMyceliumByzantineNodeIds] = useState<Record<string, boolean>>({});

  const handleToggleMyceliumNodeOffline = useCallback((receptorId: string) => {
    setMyceliumDisabledNodeIds((prev) => ({
      ...prev,
      [receptorId]: !prev[receptorId],
    }));
  }, []);

  const handleToggleMyceliumByzantineFault = useCallback((receptorId: string) => {
    setMyceliumByzantineNodeIds((prev) => ({
      ...prev,
      [receptorId]: !prev[receptorId],
    }));
  }, []);

  const handleResetMyceliumFaultSimulations = useCallback(() => {
    setMyceliumDisabledNodeIds({});
    setMyceliumByzantineNodeIds({});
  }, []);

  const myceliumSnapshot = useMemo(
    () =>
      runMyceliumSimulationEngine({
        mesh: autonomousReceptorMesh,
        receptors,
        sources,
        receptorExposures,
        observations,
        currentWeather,
        weatherHours: weatherDataset.hours,
        machineNoiseOutputDb: isManualMachineNoiseOverrideActive
          ? manualMachineNoiseOutputDb
          : 114,
        disabledNodeIds: myceliumDisabledNodeIds,
        byzantineFaultNodeIds: myceliumByzantineNodeIds,
      }),
    [
      autonomousReceptorMesh,
      receptors,
      sources,
      receptorExposures,
      observations,
      currentWeather,
      weatherDataset.hours,
      isManualMachineNoiseOverrideActive,
      manualMachineNoiseOutputDb,
      myceliumDisabledNodeIds,
      myceliumByzantineNodeIds,
    ]
  );

  const myceliumAlerts = useMyceliumLiveAlerts({
    snapshot: myceliumSnapshot,
    currentWeather,
    dateIso: weatherDataset.dateIso,
    selectedHourIndex,
    timelineProgress: plumeRouteProgress,
    isPlayingTimeline:
      isPlaying || isAnimatingPlumeRoute || isRunningRangeSimulation,
  });

  // Proactive Weather Alert Service: monitors live windSpeed10m, windGusts10m, and relativeHumidity2m vs. 24h average
  const weatherDeviationEvaluation = useMemo(
    () =>
      evaluateProactiveWeatherDeviations({
        currentWeather,
        weatherHours: weatherDataset.hours,
        dateIso: weatherDataset.dateIso,
      }),
    [currentWeather, weatherDataset.hours, weatherDataset.dateIso]
  );

  const [proactiveWeatherAlerts, setProactiveWeatherAlerts] = useState<ProactiveWeatherAlert[]>([]);
  const dismissedProactiveKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const active = weatherDeviationEvaluation.activeAlerts;
    if (active.length === 0) {
      setProactiveWeatherAlerts([]);
      return;
    }

    const delayMs =
      isPlaying || isAnimatingPlumeRoute || isRunningRangeSimulation ? 450 : 120;
    const timer = window.setTimeout(() => {
      const pending = active.filter(
        (alert) => !dismissedProactiveKeysRef.current.has(alert.dedupKey)
      );
      setProactiveWeatherAlerts(pending);

      if (pending.length > 0) {
        try {
          const isIframe = window.self !== window.top;
          if (
            !isIframe &&
            'Notification' in window &&
            window.Notification.permission === 'granted'
          ) {
            const topAlert = pending[0];
            new window.Notification(`Ringparken · ${topAlert.title}`, {
              body: `${topAlert.message} (${topAlert.metricLabel}: ${topAlert.currentValueFormatted} vs. 24t gns ${topAlert.average24hFormatted})`,
              tag: topAlert.dedupKey,
            });
          }
        } catch {
          // Sandbox-safe no-op
        }
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    weatherDeviationEvaluation,
    isPlaying,
    isAnimatingPlumeRoute,
    isRunningRangeSimulation,
  ]);

  const handleAcknowledgeProactiveWeatherAlert = useCallback((dedupKey: string) => {
    dismissedProactiveKeysRef.current.add(dedupKey);
    setProactiveWeatherAlerts((prev) => prev.filter((a) => a.dedupKey !== dedupKey));
  }, []);

  const handleAcknowledgeAllProactiveWeatherAlerts = useCallback(() => {
    setProactiveWeatherAlerts((prev) => {
      prev.forEach((a) => dismissedProactiveKeysRef.current.add(a.dedupKey));
      return [];
    });
  }, []);

  const [copiedPdfWidgetSha256, setCopiedPdfWidgetSha256] = useState<boolean>(false);
  const [complianceSubTab, setComplianceSubTab] = useState<
    | 'all'
    | 'slagelse_legal_dashboard'
    | 'l69_calculator'
    | 'pss_interlocks'
    | 'violations_pdf'
  >('all');

  // Last 6 hours of sum quotient S for the 'S-kvotient tendens' sparkline in header
  const last6HoursSparklinePoints = useMemo(() => {
    const profile = puff24h.peakReceptor.hourlyProfile;
    const result: Array<{ hourIndex: number; hourLabel: string; sumQuotient: number }> = [];
    for (let offset = 5; offset >= 0; offset--) {
      const idx = (selectedHourIndex - offset + 24) % 24;
      const item = profile[idx] || profile[0];
      result.push({
        hourIndex: idx,
        hourLabel: item?.hourLabel || `${String(idx).padStart(2, '0')}:00`,
        sumQuotient: item?.sumQuotient ?? maxSiteSumQuotient,
      });
    }
    return result;
  }, [puff24h.peakReceptor.hourlyProfile, selectedHourIndex, maxSiteSumQuotient]);

  // Compute Heatmap Comparison ('Heatmap-sammenligning') between two selected Time-Slider hours (T_A and T_B)
  const heatmapComparison = useMemo(() => {
    const hourA =
      weatherDataset.hours[
        Math.min(Math.max(0, comparisonHourAIndex), weatherDataset.hours.length - 1)
      ] || weatherDataset.hours[0];
    const hourB = currentWeather || weatherDataset.hours[0];
    return computePlumeHeatmapComparison(sources, receptors, hourA, hourB);
  }, [sources, receptors, weatherDataset.hours, comparisonHourAIndex, currentWeather]);

  const top3MostAffectedReceptors = useMemo(
    () => [...receptorExposures].sort((a, b) => b.sumQuotient - a.sumQuotient).slice(0, 3),
    [receptorExposures]
  );

  // Live forensic & physical telemetry for the Kierulffsvej DN200 water main
  const waterMainTelemetry: WaterMainLiveTelemetry = useMemo(
    () =>
      computeWaterMainLiveTelemetry({
        sources,
        buildings,
        currentWeather,
        precipitationOverrideMm,
        manualMachineNoiseOutputDb: isManualMachineNoiseOverrideActive
          ? manualMachineNoiseOutputDb
          : 114,
        hasSteelRoadPlates,
        simulatedPipeRuptureActive,
        isS3ValveLockoutActive,
        coordinateMode: waterMainCoordMode,
      }),
    [
      sources,
      buildings,
      currentWeather,
      precipitationOverrideMm,
      isManualMachineNoiseOverrideActive,
      manualMachineNoiseOutputDb,
      hasSteelRoadPlates,
      simulatedPipeRuptureActive,
      isS3ValveLockoutActive,
      waterMainCoordMode,
    ]
  );

  const virtualLeakImpact: VirtualLeakPinImpact | null = useMemo(
    () =>
      virtualLeakPinPoint
        ? computeVirtualLeakPercolationImpact({
            pinPoint: virtualLeakPinPoint,
            telemetry: waterMainTelemetry,
            buildings,
          })
        : null,
    [virtualLeakPinPoint, waterMainTelemetry, buildings]
  );

  const handleToggleVirtualLeakPinQuick = useCallback(() => {
    setVirtualLeakPinPoint((prev) => {
      if (prev) return null;
      if (!effectiveShowWaterMainLayer) {
        if (isUndergroundViewport) setShowWaterMainInUnderground(true);
        else setShowWaterMainInSurface(true);
      }
      return waterMainTelemetry.inspectionCenter;
    });
  }, [effectiveShowWaterMainLayer, isUndergroundViewport, waterMainTelemetry.inspectionCenter]);

  const highWindRankByReceptorId = useMemo(() => {
    const map: Record<string, number> = {};
    if (currentWeather.windSpeed10m > 10) {
      top3MostAffectedReceptors.forEach((r, idx) => {
        map[r.receptorId] = idx + 1;
      });
    }
    return map;
  }, [currentWeather.windSpeed10m, top3MostAffectedReceptors]);

  // Automatically focus the #1 most affected receptor in real time when wind speed exceeds 10 m/s
  useEffect(() => {
    if (currentWeather.windSpeed10m > 10 && top3MostAffectedReceptors[0]) {
      setSelectedReceptorId(top3MostAffectedReceptors[0].receptorId);
    }
  }, [currentWeather.hourIndex, currentWeather.windSpeed10m, top3MostAffectedReceptors]);

  const handleJumpToHighWindHour = () => {
    const highWindHr = weatherDataset.hours.find((h) => h.windSpeed10m > 10);
    if (highWindHr) {
      setSelectedHourIndex(highWindHr.hourIndex);
      setPlumeRouteProgress(highWindHr.hourIndex);
    } else {
      handleApplyScenario(CRITICAL_WEATHER_SCENARIOS[0].id);
    }
  };

  const selectedReceptorExposure = useMemo(
    () =>
      receptorExposures.find((r) => r.receptorId === selectedReceptorId) ||
      simulation.worstExposedReceptor,
    [receptorExposures, selectedReceptorId, simulation.worstExposedReceptor]
  );

  // Live mathematical plume evaluation for the currently selected GPS point and Time-Slider hour
  const livePendingCorroboration = useMemo(
    () =>
      evaluatePointInDispersionPlume(
        pendingObservationPoint,
        sources,
        currentWeather,
        obsType
      ),
    [pendingObservationPoint, sources, currentWeather, obsType]
  );

  // Compact / Normal mode states & dropdown menus for Top (<header>) and Bottom (<footer>)
  const [isTopCompactMode, setIsTopCompactMode] = useState<boolean>(false);
  const [isTopCompactDropdownOpen, setIsTopCompactDropdownOpen] = useState<boolean>(false);
  const [isMinimizeAllFocusActive, setIsMinimizeAllFocusActive] = useState<boolean>(false);

  // Keep map_viewport_2d_3d and the active right-column tab's relevant windows un-minimized while 'Minimer alle' is active
  useEffect(() => {
    if (!isMinimizeAllFocusActive) return;
    const relevantIds = RELEVANT_SIDEBAR_WINDOWS_BY_TAB[activeTab] || [];
    setWindowStates((prev) => {
      const next = { ...prev };
      (Object.keys(next) as DashboardWindowId[]).forEach((id) => {
        if (id === 'map_viewport_2d_3d' || relevantIds.includes(id)) {
          next[id] = { ...next[id], isMinimized: false, isFloating: false };
        } else {
          next[id] = { ...next[id], isMinimized: true, isFloating: false };
        }
      });
      return next;
    });
  }, [activeTab, isMinimizeAllFocusActive]);

  const handleToggleMinimizeAllExceptMapAndSidebar = useCallback(() => {
    if (!isMinimizeAllFocusActive) {
      setIsMinimizeAllFocusActive(true);
      setIsTopCompactMode(true);
      setIsTopCompactDropdownOpen(false);
      setIsRangeSimPanelOpen(false);
      setShowHeaderWeatherCorrelationPopup(false);
      setShowRibbonWindRose(false);
      setShowRibbon7DayWindRose(false);
      setShowRibbon30DayHeatmap(false);
      setShowRibbonDepositionProfile(false);
      setShowRibbonMedicalExpert(false);
      setShowRibbonExpertChat(false);
      setShowRibbonPredVsActual(false);
      setShowRibbonDispersionForecast(false);
      setShowRibbonStochasticBias(false);
      setShowRibbonProactiveAgent(false);
      setShowRibbonTempChart(false);
      setShowRibbonStackEffect(false);
      setShowRibbonAcousticRefraction(false);
      setShowWorkspaceImpulseSensitivityGraph(false);
      window.dispatchEvent(new CustomEvent('ringparken-minimize-map-hud-overlays'));

      const relevantIds = RELEVANT_SIDEBAR_WINDOWS_BY_TAB[activeTab] || [];
      setWindowStates((prev) => {
        const next = { ...prev };
        (Object.keys(next) as DashboardWindowId[]).forEach((id) => {
          if (id === 'map_viewport_2d_3d' || relevantIds.includes(id)) {
            next[id] = { ...next[id], isMinimized: false, isFloating: false };
          } else {
            next[id] = { ...next[id], isMinimized: true, isFloating: false };
          }
        });
        return next;
      });
    } else {
      setIsMinimizeAllFocusActive(false);
      setIsTopCompactMode(false);
      handleRestoreAllMinimized();
      window.dispatchEvent(new CustomEvent('ringparken-restore-map-hud-overlays'));
    }
  }, [activeTab, handleRestoreAllMinimized, isMinimizeAllFocusActive]);

  // Global 'Minimer alle' i højre sidepanel (minimerer samtlige åbne dashboards i kontrolcentret med undtagelse af det aktive analysevindue + kortet)
  const [activeSidebarAnalysisWindowId, setActiveSidebarAnalysisWindowId] =
    useState<DashboardWindowId>('algedonic_observations');
  const [isSidebarMinimizeOthersActive, setIsSidebarMinimizeOthersActive] =
    useState<boolean>(false);

  const currentTabWindowIds = useMemo(
    () => RELEVANT_SIDEBAR_WINDOWS_BY_TAB[activeTab] || [],
    [activeTab]
  );

  const allSidebarWindowEntries = useMemo(() => {
    const entries: Array<{ id: DashboardWindowId; tab: RightPanelTab }> = [];
    (Object.keys(RELEVANT_SIDEBAR_WINDOWS_BY_TAB) as RightPanelTab[]).forEach((tab) => {
      RELEVANT_SIDEBAR_WINDOWS_BY_TAB[tab].forEach((id) => {
        if (!entries.some((e) => e.id === id)) {
          entries.push({ id, tab });
        }
      });
    });
    return entries;
  }, []);

  const effectiveActiveSidebarWindowId: DashboardWindowId = useMemo(
    () =>
      currentTabWindowIds.includes(activeSidebarAnalysisWindowId) ||
      windowStates[activeSidebarAnalysisWindowId]?.isFloating
        ? activeSidebarAnalysisWindowId
        : (currentTabWindowIds[0] ?? activeSidebarAnalysisWindowId),
    [currentTabWindowIds, activeSidebarAnalysisWindowId, windowStates]
  );

  useEffect(() => {
    if (!isSidebarMinimizeOthersActive) return;
    setWindowStates((prev) => {
      const next = { ...prev };
      (Object.keys(next) as DashboardWindowId[]).forEach((id) => {
        if (id === 'map_viewport_2d_3d' || id === effectiveActiveSidebarWindowId) {
          next[id] = { ...next[id], isMinimized: false };
        } else {
          next[id] = { ...next[id], isMinimized: true, isFloating: false };
        }
      });
      return next;
    });
  }, [isSidebarMinimizeOthersActive, effectiveActiveSidebarWindowId]);

  const handleSelectActiveAnalysisWindow = useCallback(
    (nextId: DashboardWindowId) => {
      const owner = allSidebarWindowEntries.find((e) => e.id === nextId);
      if (owner && !RELEVANT_SIDEBAR_WINDOWS_BY_TAB[activeTab].includes(nextId)) {
        setActiveTab(owner.tab);
      }
      setActiveSidebarAnalysisWindowId(nextId);
      setWindowStates((prev) => ({
        ...prev,
        [nextId]: { ...prev[nextId], isMinimized: false },
      }));
    },
    [activeTab, allSidebarWindowEntries]
  );

  const handleToggleSidebarMinimizeAllExceptActive = useCallback(() => {
    if (!isSidebarMinimizeOthersActive) {
      setIsSidebarMinimizeOthersActive(true);
      setIsRangeSimPanelOpen(false);
      setShowHeaderWeatherCorrelationPopup(false);
      setShowRibbonWindRose(false);
      setShowRibbon7DayWindRose(false);
      setShowRibbon30DayHeatmap(false);
      setShowRibbonDepositionProfile(false);
      setShowRibbonMedicalExpert(false);
      setShowRibbonExpertChat(false);
      setShowRibbonPredVsActual(false);
      setShowRibbonDispersionForecast(false);
      setShowRibbonStochasticBias(false);
      setShowRibbonProactiveAgent(false);
      setShowRibbonTempChart(false);
      setShowRibbonStackEffect(false);
      setShowRibbonAcousticRefraction(false);
      setShowWorkspaceImpulseSensitivityGraph(false);
      window.dispatchEvent(new CustomEvent('ringparken-minimize-map-hud-overlays'));

      setWindowStates((prev) => {
        const next = { ...prev };
        (Object.keys(next) as DashboardWindowId[]).forEach((id) => {
          if (id === 'map_viewport_2d_3d' || id === effectiveActiveSidebarWindowId) {
            next[id] = { ...next[id], isMinimized: false };
          } else {
            next[id] = { ...next[id], isMinimized: true, isFloating: false };
          }
        });
        return next;
      });
    } else {
      setIsSidebarMinimizeOthersActive(false);
      handleRestoreAllMinimized();
      window.dispatchEvent(new CustomEvent('ringparken-restore-map-hud-overlays'));
    }
  }, [
    isSidebarMinimizeOthersActive,
    effectiveActiveSidebarWindowId,
    handleRestoreAllMinimized,
  ]);

  // Diskret akustisk advarselstone (Web Audio API) når sumkvotienten S > 0,8 under højvindsscenarier (v > 10 m/s)
  const [acousticDustWarningEnabled, setAcousticDustWarningEnabled] = useState<boolean>(true);
  const [forceHighWindDustWarningSim, setForceHighWindDustWarningSim] = useState<boolean>(false);
  const [lastAcousticChimeLabel, setLastAcousticChimeLabel] = useState<string | null>(null);
  const lastChimedStateKeyRef = useRef<string>('');
  const webAudioCtxRef = useRef<AudioContext | null>(null);
  const hasUserAudioGestureRef = useRef<boolean>(false);

  useEffect(() => {
    const unlockAudio = () => {
      hasUserAudioGestureRef.current = true;
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playAcousticDustDispersionWarningTone = useCallback(
    (sumQuotientVal: number, windSpeedVal: number, receptorLabel: string, forcePlay = false) => {
      if (!forcePlay && !hasUserAudioGestureRef.current) return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        if (!webAudioCtxRef.current) {
          webAudioCtxRef.current = new AudioCtx();
        }
        const ctx = webAudioCtxRef.current;
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => undefined);
        }

        const now = ctx.currentTime;
        // Diskret to-tonet harmonisk advarselspuls (D5 587.33 Hz -> A5 880 Hz; strengt positiv ramp >= 0.0001)
        const freqs = sumQuotientVal >= 1.0 ? [659.25, 987.77] : [587.33, 880.0];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const subOsc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.16);

          subOsc.type = 'triangle';
          subOsc.frequency.setValueAtTime(freq * 0.5, now + idx * 0.16);

          gain.gain.setValueAtTime(0.0001, now + idx * 0.16);
          gain.gain.exponentialRampToValueAtTime(0.065, now + idx * 0.16 + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.16 + 0.24);

          osc.connect(gain);
          subOsc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.16);
          subOsc.start(now + idx * 0.16);
          osc.stop(now + idx * 0.16 + 0.26);
          subOsc.stop(now + idx * 0.16 + 0.26);
        });

        setLastAcousticChimeLabel(
          `${new Date().toLocaleTimeString('da-DK')} · ${receptorLabel} (S = ${sumQuotientVal.toFixed(2)}, v = ${windSpeedVal.toFixed(1)} m/s)`
        );
      } catch {
        // Ignorér sandbox autoplay-begrænsninger indtil brugerinteraktion
      }
    },
    []
  );

  // Afspil automatisk diskret advarselstone når S > 0,8 under højvindsscenarier (v > 10 m/s)
  useEffect(() => {
    if (!acousticDustWarningEnabled || myceliumAlerts.channelStatus.isScrubbingSuppressed) return;
    const isHighWindScenario =
      currentWeather.windSpeed10m > 10.0 || forceHighWindDustWarningSim;
    const exceedingReceptor =
      receptorExposures.find((r) => r.sumQuotient > 0.8) ||
      (forceHighWindDustWarningSim ? worstExposedReceptor : undefined);
    const effectiveS = forceHighWindDustWarningSim
      ? Math.max(0.92, exceedingReceptor?.sumQuotient ?? 0.92)
      : (exceedingReceptor?.sumQuotient ?? 0);

    // Hysterese-reset når vind eller S falder tydeligt under tærsklen
    if (!forceHighWindDustWarningSim && (currentWeather.windSpeed10m <= 9.0 || effectiveS <= 0.72)) {
      lastChimedStateKeyRef.current = '';
      return;
    }

    if (isHighWindScenario && exceedingReceptor && effectiveS > 0.8) {
      const stateKey = `${currentWeather.hourIndex}-${exceedingReceptor.receptorId}-${forceHighWindDustWarningSim ? 'sim' : 'live'}`;
      if (lastChimedStateKeyRef.current !== stateKey) {
        lastChimedStateKeyRef.current = stateKey;
        playAcousticDustDispersionWarningTone(
          effectiveS,
          Math.max(currentWeather.windSpeed10m, forceHighWindDustWarningSim ? 11.4 : 0),
          exceedingReceptor.receptorName
        );
      }
    }
  }, [
    acousticDustWarningEnabled,
    myceliumAlerts.channelStatus.isScrubbingSuppressed,
    currentWeather.hourIndex,
    currentWeather.windSpeed10m,
    forceHighWindDustWarningSim,
    receptorExposures,
    worstExposedReceptor,
    playAcousticDustDispersionWarningTone,
  ]);
  const [isBottomCompactMode, setIsBottomCompactMode] = useState<boolean>(true);
  const [isBottomCompactDropdownOpen, setIsBottomCompactDropdownOpen] = useState<boolean>(false);
  const [evidenceClearedBanner, setEvidenceClearedBanner] = useState<boolean>(false);

  // Start evidence registration from scratch (0 pre-seeded observations) & clear legacy seeded PDF storage
  useEffect(() => {
    try {
      localStorage.removeItem('ringparken_pdf_evidence_archive_v1');
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleClearAllEvidenceFromScratch = useCallback(() => {
    setObservations([]);
    setSelectedObservationId(null);
    setPendingPhotoEvidence(undefined);
    try {
      localStorage.removeItem('ringparken_pdf_evidence_archive_v1');
      localStorage.removeItem('ringparken_pdf_evidence_archive_v2_scratch');
    } catch {
      // ignore storage errors
    }
    setEvidenceClearedBanner(true);
    window.setTimeout(() => setEvidenceClearedBanner(false), 4000);
  }, []);

  const [batchAddFindingsSuccess, setBatchAddFindingsSuccess] = useState<boolean>(false);
  const [batchAddedFindingsCount, setBatchAddedFindingsCount] = useState<number>(0);
  const [isBulkDownloading, setIsBulkDownloading] = useState<boolean>(false);
  const [bulkDownloadSuccess, setBulkDownloadSuccess] = useState<boolean>(false);
  const [bulkExportAuditValidation, setBulkExportAuditValidation] = useState<{
    status: 'verified' | 'error';
    totalChecked: number;
    missingCount: number;
    missingIds: string[];
    merkleRoot: string;
    message: string;
  } | null>(null);

  // Compute total number of current findings (lovovertrædelser + udsatte receptorer + meteorologisk/støv-korrelation)
  const totalCurrentFindingsCount = useMemo(() => {
    const exposedRecCount = receptorExposures.filter((r) => r.sumQuotient >= 0.45).length || Math.min(3, receptorExposures.length);
    return legalViolations.length + exposedRecCount + 1;
  }, [legalViolations.length, receptorExposures]);

  // Central action: "Føj alle fund til Beviser" — cryptographically signs (SHA-256) and adds all current findings to `observations` (Beviser)
  const handleAddAllFindingsToEvidence = useCallback(async () => {
    const candidateFindings: Array<{
      dedupKey: string;
      point: LatLngPoint;
      locationLabel: string;
      reporterRole:AlgedonicObservation['reporterRole'];
      reporterIdentifier: string;
      observationType: string;
      description: string;
    }> = [];

    // 1. All active Legal Violations (Lovovertrædelser: BEK 613/2026 Asbest, Miljøstyrelsens støjgrænser, MBL § 19/27 m.fl.)
    legalViolations.forEach((v) => {
      const matchedRec =
        receptorExposures.find(
          (r) =>
            r.receptorName === v.receptorName ||
            v.receptorName.includes(r.receptorName) ||
            v.receptorAddress.includes(r.address)
        ) || worstExposedReceptor;

      const pt = matchedRec ? matchedRec.position : pendingObservationPoint;
      const locLabel = `${v.receptorName} (${v.receptorAddress})`;
      const obsTypeLabel =
        v.legalBasisCategory === 'MST_NOISE_LIMITS'
          ? `Lovbrud (Støj): ${v.statuteReference}`
          : `Lovbrud (Asbest/Støv): ${v.statuteReference}`;

      const desc = `[RETSMEDICINSK FUND · ${v.statuteTitle} (${v.statuteReference})] Sumkvotient S = ${v.sumQuotient.toFixed(
        2
      )} ved ${v.receptorName}. Teknisk bevis: ${v.technicalEvidence} Juridisk konsekvens: ${
        v.legalConsequence
      }`;

      candidateFindings.push({
        dedupKey: `viol-${weatherDataset.dateIso}-${currentWeather.hourIndex}-${v.id}`,
        point: pt,
        locationLabel: locLabel,
        reporterRole: 'Tilsynsførende (Arbejdstilsynet / Kommune)',
        reporterIdentifier: `Automatisk Lovlog (${v.legalBasisLabel})`,
        observationType: obsTypeLabel,
        description: desc,
      });
    });

    // 2. Exposed Receptors (Receptor-eksponering & støvnedfald ved udsatte naboer)
    const targetReceptors =
      receptorExposures.filter((r) => r.sumQuotient >= 0.45).length > 0
        ? receptorExposures.filter((r) => r.sumQuotient >= 0.45)
        : top3MostAffectedReceptors;

    targetReceptors.forEach((rec) => {
      const topSubstancesText = rec.substances
        .slice()
        .sort((a, b) => b.quotient - a.quotient)
        .slice(0, 3)
        .map(
          (s) =>
            `${s.name}: ${s.concentration} ${s.unit} (${Math.round(s.quotient * 100)}% GV)`
        )
        .join(', ');

      candidateFindings.push({
        dedupKey: `rec-${weatherDataset.dateIso}-${currentWeather.hourIndex}-${rec.receptorId}`,
        point: rec.position,
        locationLabel: `${rec.receptorCode}: ${rec.receptorName} (${rec.address})`,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        reporterIdentifier: `Sprednings- & Deponeringsprofil (${rec.receptorCode})`,
        observationType: `Receptor-Eksponering (S = ${rec.sumQuotient.toFixed(2)})`,
        description: `[RECEPTOR-FUND · ${rec.receptorCode} ${
          rec.receptorName
        }] Sumkvotient S = ${rec.sumQuotient.toFixed(2)} (${rec.riskLevel.toUpperCase()}-zone) i afstand ${
          rec.distanceFromNearestSourceMeters
        }m fra dominerende kilde ${rec.dominantSourceName}. Stoffer: ${topSubstancesText}.`,
      });
    });

    // 3. Meteorological, Plume & Acoustic / Hydrological Correlation Finding
    const plumeDeg = (currentWeather.windDirection10m + 180) % 360;
    const worstPos = worstExposedReceptor
      ? worstExposedReceptor.position
      : pendingObservationPoint;
    candidateFindings.push({
      dedupKey: `meteo-${weatherDataset.dateIso}-${currentWeather.hourIndex}`,
      point: worstPos,
      locationLabel: worstExposedReceptor
        ? `${worstExposedReceptor.receptorCode}: ${worstExposedReceptor.receptorName} (Meteorologisk Fane-Korridor)`
        : 'Ringparken Nedrivningsfelt (Centrum)',
      reporterRole: 'Arbejdsmiljørepræsentant (AMR)',
      reporterIdentifier: 'Open-Meteo & Gaussisk Fane-Korrelation',
      observationType: 'Vejr- & Støvnedfalds-Korrelation',
      description: `[METEOROLOGISK & FYSISK KORRELATIONS-FUND kl. ${
        currentWeather.hourLabel
      }] Vind: ${currentWeather.windSpeed10m} m/s (vindstød ${
        currentWeather.windGusts10m
      } m/s) fra ${currentWeather.windDirection10m}° (${degreesToCompass(
        currentWeather.windDirection10m
      )}) → Fanespredning mod ${plumeDeg}° (${degreesToCompass(
        plumeDeg
      )}). Pasquill-klasse ${currentWeather.pasquillClass}, Nedbør ${
        currentWeather.precipitation
      } mm/t. Maksimal Sumkvotient S_max = ${maxSiteSumQuotient.toFixed(2)}.`,
    });

    if (pendingObsSignPromisesRef.current.size > 0) {
      await Promise.allSettled(Array.from(pendingObsSignPromisesRef.current));
    }
    const baseObservations = observationsRef.current;

    // Filter out findings that have already been added for the exact same timestamp & description
    const existingDescriptions = new Set(
      baseObservations.map((o) => `${o.observedDateIso}-${o.observedHourIndex}-${o.description}`)
    );

    const newEntries: AlgedonicObservation[] = [];
    let seqOffset = Math.max(observationsCountRef.current, baseObservations.length);

    for (const item of candidateFindings) {
      const sigKey = `${weatherDataset.dateIso}-${currentWeather.hourIndex}-${item.description}`;
      if (existingDescriptions.has(sigKey)) continue;

      seqOffset += 1;
      observationsCountRef.current = seqOffset;
      const code = `FUND-${String(seqOffset).padStart(2, '0')}`;
      const corroboration = evaluatePointInDispersionPlume(
        item.point,
        sources,
        currentWeather,
        item.observationType
      );

      const signature = await computeForensicSha256Hash({
        code,
        dedupKey: item.dedupKey,
        dateIso: weatherDataset.dateIso,
        hourIso: currentWeather.isoTime,
        position: item.point,
        reporterRole: item.reporterRole,
        observationType: item.observationType,
        description: item.description,
        weather: currentWeather,
        isInsideMathematicalPlume: corroboration.isInsideMathematicalPlume,
        calculatedSumQuotient: corroboration.calculatedSumQuotient,
      });

      newEntries.push({
        id: `obs-fund-${Date.now()}-${seqOffset}`,
        code,
        createdAtIso: new Date().toISOString(),
        observedDateIso: weatherDataset.dateIso,
        observedHourIndex: currentWeather.hourIndex,
        observedHourLabel: currentWeather.hourLabel,
        observedTimestampIso: currentWeather.isoTime,
        position: item.point,
        locationLabel: item.locationLabel,
        reporterRole: item.reporterRole,
        reporterIdentifier: item.reporterIdentifier,
        observationType: item.observationType,
        description: item.description,
        weatherSnapshot: currentWeather,
        plumeCorroboration: corroboration,
        sha256Signature: signature,
      });
    }

    const combinedObservations =
      newEntries.length > 0 ? [...newEntries, ...baseObservations] : baseObservations;

    if (newEntries.length > 0) {
      observationsRef.current = combinedObservations;
      setObservations((prev) => [...newEntries, ...prev]);
      setSelectedObservationId(newEntries[0].id);
      setBatchAddedFindingsCount(newEntries.length);
    } else {
      setBatchAddedFindingsCount(candidateFindings.length);
    }

    setBatchAddFindingsSuccess(true);
    setActiveTab('algedonic');
    window.setTimeout(() => setBatchAddFindingsSuccess(false), 4500);
    return combinedObservations;
  }, [
    legalViolations,
    receptorExposures,
    worstExposedReceptor,
    pendingObservationPoint,
    weatherDataset.dateIso,
    currentWeather,
    top3MostAffectedReceptors,
    maxSiteSumQuotient,
    observations,
    sources,
  ]);

  // Quick-log a neighbor complaint about noise & dust from the WeatherNoiseDustCorrelationPanel
  const handleQuickLogNoiseDustComplaint = async (presetObservation: {
    point: LatLngPoint;
    locationLabel: string;
    observationType: string;
    description: string;
  }) => {
    const nextNum = observations.length + 1;
    const code = `ALG-${String(nextNum).padStart(2, '0')}`;
    const corroboration = evaluatePointInDispersionPlume(
      presetObservation.point,
      sources,
      currentWeather,
      presetObservation.observationType
    );
    const nabotestCheck = evaluateNabotestForPoint(
      presetObservation.point,
      autonomousReceptorMesh
    );
    const enrichedDescription = nabotestCheck.nabotestAppendixDa
      ? `${presetObservation.description} ${nabotestCheck.nabotestAppendixDa}`
      : presetObservation.description;

    const signature = await computeForensicSha256Hash({
      code,
      dateIso: weatherDataset.dateIso,
      hourIso: currentWeather.isoTime,
      position: presetObservation.point,
      reporterRole: 'Beboer (Ringparken)',
      observationType: presetObservation.observationType,
      description: enrichedDescription,
      weather: currentWeather,
      isInsideMathematicalPlume: corroboration.isInsideMathematicalPlume,
      calculatedSumQuotient: corroboration.calculatedSumQuotient,
    });

    const zkpVerification = computeDeterministicZkpVerification({
      code,
      position: presetObservation.point,
      reporterRole: 'Beboer (Ringparken)',
      observedTimestampIso: currentWeather.isoTime,
      weather: currentWeather,
      sumQuotientS: corroboration.calculatedSumQuotient,
      distanceFromSourceMeters: corroboration.distanceFromSourceMeters,
      rightToOpacityEnabled: true,
      existingSha256: signature,
    });

    const newObs: AlgedonicObservation = {
      id: `obs-${Date.now()}`,
      code,
      createdAtIso: new Date().toISOString(),
      observedDateIso: weatherDataset.dateIso,
      observedHourIndex: currentWeather.hourIndex,
      observedHourLabel: currentWeather.hourLabel,
      observedTimestampIso: currentWeather.isoTime,
      position: presetObservation.point,
      locationLabel: presetObservation.locationLabel,
      reporterRole: 'Beboer (Ringparken)',
      reporterIdentifier: zkpVerification.anonymizedRoleCommitment,
      observationType: presetObservation.observationType,
      description: enrichedDescription,
      weatherSnapshot: currentWeather,
      plumeCorroboration: corroboration,
      sha256Signature: signature,
      zkpVerification,
    };

    setObservations((prev) => [newObs, ...prev]);
    setSelectedObservationId(newObs.id);
  };

  // Emit a ZKP-shielded Algedonic Signal from an Autonomous Receptor Node with automatic Nabotest consensus
  const handleEmitZkpNodeAlgedonicSignal = async (params: {
    node: AutonomousReceptorNode;
    legalStandingRole: LegalStandingRoleKey;
    zkpProofHash: string;
    anonymizedRoleCommitment: string;
    nullifierHash: string;
    reporterRole: ReporterRole;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => {
    const nextNum = observations.length + 1;
    const code = `ZKP-NODE-${String(nextNum).padStart(2, '0')}`;
    const corroboration = evaluatePointInDispersionPlume(
      params.position,
      sources,
      currentWeather,
      params.observationType
    );

    const signature = await computeForensicSha256Hash({
      code,
      dateIso: weatherDataset.dateIso,
      hourIso: currentWeather.isoTime,
      position: params.position,
      reporterRole: params.reporterRole,
      zkpProofHash: params.zkpProofHash,
      nullifierHash: params.nullifierHash,
      observationType: params.observationType,
      description: params.description,
      weather: currentWeather,
      calculatedSumQuotient: corroboration.calculatedSumQuotient,
    });

    const baseZkp = computeDeterministicZkpVerification({
      code,
      position: params.position,
      reporterRole: params.reporterRole,
      observedTimestampIso: currentWeather.isoTime,
      weather: currentWeather,
      sumQuotientS: corroboration.calculatedSumQuotient,
      distanceFromSourceMeters: corroboration.distanceFromSourceMeters,
      rightToOpacityEnabled: true,
      existingSha256: signature,
    });

    const newObs: AlgedonicObservation = {
      id: `obs-zkp-node-${Date.now()}`,
      code,
      createdAtIso: new Date().toISOString(),
      observedDateIso: weatherDataset.dateIso,
      observedHourIndex: currentWeather.hourIndex,
      observedHourLabel: currentWeather.hourLabel,
      observedTimestampIso: currentWeather.isoTime,
      position: params.position,
      locationLabel: params.locationLabel,
      reporterRole: params.reporterRole,
      reporterIdentifier: params.anonymizedRoleCommitment,
      observationType: params.observationType,
      description: params.description,
      weatherSnapshot: currentWeather,
      plumeCorroboration: corroboration,
      sha256Signature: signature,
      zkpVerification: {
        ...baseZkp,
        zkpProofHash: params.zkpProofHash,
        anonymizedRoleCommitment: params.anonymizedRoleCommitment,
        rightToOpacityEnabled: true,
      },
    };

    setObservations((prev) => [newObs, ...prev]);
    setSelectedObservationId(newObs.id);
    setPendingObservationPoint(params.position);
  };

  // Register a Spredningsprognose (Døgnet efter 00.00.00-00.59.59, Fem døgns prognose, eller Vejrudsigt-indlæg) directly into Beviser
  const handleAddForecastToEvidence = useCallback(
    async (
      observationTitle: string,
      observationDetails: string,
      targetDateIso: string,
      targetHourIndex: number
    ) => {
      const nextNum = observations.length + 1;
      const code = `PROG-${String(nextNum).padStart(2, '0')}`;
      const pt = selectedReceptorExposure?.position || {
        lat: 55.4122,
        lng: 11.3522,
      };
      const corroboration = evaluatePointInDispersionPlume(
        pt,
        sources,
        currentWeather,
        observationTitle
      );

      const signature = await computeForensicSha256Hash({
        code,
        dateIso: targetDateIso,
        hourIndex: targetHourIndex,
        position: pt,
        reporterRole: obsReporterRole,
        observationType: observationTitle,
        description: observationDetails,
        weather: currentWeather,
        calculatedSumQuotient: corroboration.calculatedSumQuotient,
      });

      const newObs: AlgedonicObservation = {
        id: `obs-forecast-${Date.now()}`,
        code,
        createdAtIso: new Date().toISOString(),
        observedDateIso: targetDateIso,
        observedHourIndex: targetHourIndex,
        observedHourLabel: `${String(targetHourIndex).padStart(2, '0')}:00`,
        observedTimestampIso: `${targetDateIso}T${String(targetHourIndex).padStart(2, '0')}:00:00`,
        position: pt,
        locationLabel:
          selectedReceptorExposure?.address ||
          'Ringparken / Rødtjørnevej 2, 4200 Slagelse',
        reporterRole: obsReporterRole,
        reporterIdentifier: obsReporterId.trim() || obsReporterRole,
        observationType: observationTitle,
        description: observationDetails,
        weatherSnapshot: currentWeather,
        plumeCorroboration: corroboration,
        sha256Signature: signature,
      };

      setObservations((prev) => [newObs, ...prev]);
      setSelectedObservationId(newObs.id);
    },
    [
      observations.length,
      selectedReceptorExposure,
      sources,
      currentWeather,
      obsReporterRole,
      obsReporterId,
    ]
  );

  // Register Structural Envelope & DIN 4150-3 Vibration Evidence (S_in, Delta_P_CAV, z_NPL, PPV, q_75) into Beviser / Merkle-Root chain
  const handleAddStructuralEnvelopeEvidence = useCallback(
    async (payload: StructuralEnvelopeEvidencePayload) => {
      const nextNum = observations.length + 1;
      const code = `BYG-${String(nextNum).padStart(2, '0')}`;
      const corroboration = evaluatePointInDispersionPlume(
        payload.point,
        sources,
        currentWeather,
        payload.observationType
      );

      const signature = await computeForensicSha256Hash({
        code,
        dateIso: weatherDataset.dateIso,
        hourIso: currentWeather.isoTime,
        position: payload.point,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        observationType: payload.observationType,
        description: payload.description,
        telemetrySnapshot: payload.telemetrySnapshot,
        weather: currentWeather,
        calculatedSumQuotient: payload.telemetrySnapshot.indoorSumQuotientSin,
      });

      const zkpVerification = computeDeterministicZkpVerification({
        code,
        position: payload.point,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        observedTimestampIso: currentWeather.isoTime,
        weather: currentWeather,
        sumQuotientS: payload.telemetrySnapshot.indoorSumQuotientSin,
        distanceFromSourceMeters: payload.telemetrySnapshot.distanceMeters,
        rightToOpacityEnabled,
        existingSha256: signature,
      });

      const newObs: AlgedonicObservation = {
        id: `obs-struct-${Date.now()}`,
        code,
        createdAtIso: new Date().toISOString(),
        observedDateIso: weatherDataset.dateIso,
        observedHourIndex: currentWeather.hourIndex,
        observedHourLabel: currentWeather.hourLabel,
        observedTimestampIso: currentWeather.isoTime,
        position: payload.point,
        locationLabel: payload.locationLabel,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        reporterIdentifier: 'DIN 4150-3 & COWI Sag A205732 Indeklima-Telemetri',
        observationType: payload.observationType,
        description: payload.description,
        weatherSnapshot: currentWeather,
        plumeCorroboration: {
          ...corroboration,
          calculatedSumQuotient: Math.max(
            corroboration.calculatedSumQuotient,
            payload.telemetrySnapshot.indoorSumQuotientSin
          ),
        },
        sha256Signature: signature,
        zkpVerification,
      };

      setObservations((prev) => [newObs, ...prev]);
      setSelectedObservationId(newObs.id);
    },
    [
      observations.length,
      sources,
      currentWeather,
      weatherDataset.dateIso,
      rightToOpacityEnabled,
    ]
  );

  // Shared CAV Ventilation Mode state coupled between CavExhaustImpactWidget and PssSafetyInterlockWidget
  const [cavVentilationMode, setCavVentilationMode] =
    useState<CavVentilationMode>('cav_central_exhaust');

  // Register CAV Exhaust Vacuum & DS 447 Evidence into Beviser / Merkle-Root chain
  const handleAddCavExhaustEvidence = useCallback(
    async (payload: CavExhaustEvidencePayload) => {
      const nextNum = observations.length + 1;
      const code = `CAV-${String(nextNum).padStart(2, '0')}`;
      const corroboration = evaluatePointInDispersionPlume(
        payload.point,
        sources,
        currentWeather,
        payload.observationType
      );

      const signature = await computeForensicSha256Hash({
        code,
        dateIso: weatherDataset.dateIso,
        hourIso: currentWeather.isoTime,
        position: payload.point,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        observationType: payload.observationType,
        description: payload.description,
        telemetrySnapshot: payload.telemetrySnapshot,
        weather: currentWeather,
        calculatedSumQuotient: payload.telemetrySnapshot.indoorSumQuotientSin,
      });

      const zkpVerification = computeDeterministicZkpVerification({
        code,
        position: payload.point,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        observedTimestampIso: currentWeather.isoTime,
        weather: currentWeather,
        sumQuotientS: payload.telemetrySnapshot.indoorSumQuotientSin,
        distanceFromSourceMeters: payload.telemetrySnapshot.distanceMeters,
        rightToOpacityEnabled,
        existingSha256: signature,
      });

      const newObs: AlgedonicObservation = {
        id: `obs-cav-${Date.now()}`,
        code,
        createdAtIso: new Date().toISOString(),
        observedDateIso: weatherDataset.dateIso,
        observedHourIndex: currentWeather.hourIndex,
        observedHourLabel: currentWeather.hourLabel,
        observedTimestampIso: currentWeather.isoTime,
        position: payload.point,
        locationLabel: payload.locationLabel,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        reporterIdentifier: 'BR18 § 443 & DS 447 CAV-Vakuum Telemetri',
        observationType: payload.observationType,
        description: payload.description,
        weatherSnapshot: currentWeather,
        plumeCorroboration: {
          ...corroboration,
          calculatedSumQuotient: Math.max(
            corroboration.calculatedSumQuotient,
            payload.telemetrySnapshot.indoorSumQuotientSin
          ),
        },
        sha256Signature: signature,
        zkpVerification,
      };

      setObservations((prev) => [newObs, ...prev]);
      setSelectedObservationId(newObs.id);
    },
    [
      observations.length,
      sources,
      currentWeather,
      weatherDataset.dateIso,
      rightToOpacityEnabled,
    ]
  );

  // Shared 3D Neutral Pressure Plane (z_NPL) & Thermal Stack Buoyancy state coupled with Ringparken3DScene
  const [show3DNeutralPressurePlane, setShow3DNeutralPressurePlane] =
    useState<boolean>(true);
  const [neutralPressurePlaneHeightMeters, setNeutralPressurePlaneHeightMeters] =
    useState<number>(12.0);

  // Register Thermal Stack Buoyancy & 3D Neutral Pressure Plane (z_NPL) Evidence into Beviser / Merkle-Root chain
  const handleAddThermalStackEvidence = useCallback(
    async (payload: ThermalStackEvidencePayload) => {
      const nextNum = observations.length + 1;
      const code = `NPL-${String(nextNum).padStart(2, '0')}`;
      const corroboration = evaluatePointInDispersionPlume(
        payload.point,
        sources,
        currentWeather,
        payload.observationType
      );

      const signature = await computeForensicSha256Hash({
        code,
        dateIso: weatherDataset.dateIso,
        hourIso: currentWeather.isoTime,
        position: payload.point,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        observationType: payload.observationType,
        description: payload.description,
        telemetrySnapshot: payload.telemetrySnapshot,
        weather: currentWeather,
        calculatedSumQuotient: payload.telemetrySnapshot.indoorSumQuotientSin,
      });

      const zkpVerification = computeDeterministicZkpVerification({
        code,
        position: payload.point,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        observedTimestampIso: currentWeather.isoTime,
        weather: currentWeather,
        sumQuotientS: payload.telemetrySnapshot.indoorSumQuotientSin,
        distanceFromSourceMeters: payload.telemetrySnapshot.distanceMeters,
        rightToOpacityEnabled,
        existingSha256: signature,
      });

      const newObs: AlgedonicObservation = {
        id: `obs-npl-${Date.now()}`,
        code,
        createdAtIso: new Date().toISOString(),
        observedDateIso: weatherDataset.dateIso,
        observedHourIndex: currentWeather.hourIndex,
        observedHourLabel: currentWeather.hourLabel,
        observedTimestampIso: currentWeather.isoTime,
        position: payload.point,
        locationLabel: payload.locationLabel,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        reporterIdentifier: 'Termisk Opdrift (Skorstenseffekt) & 3D Neutraltryksplan z_NPL',
        observationType: payload.observationType,
        description: payload.description,
        weatherSnapshot: currentWeather,
        plumeCorroboration: {
          ...corroboration,
          calculatedSumQuotient: Math.max(
            corroboration.calculatedSumQuotient,
            payload.telemetrySnapshot.indoorSumQuotientSin
          ),
        },
        sha256Signature: signature,
        zkpVerification,
      };

      setObservations((prev) => [newObs, ...prev]);
      setSelectedObservationId(newObs.id);
    },
    [
      observations.length,
      sources,
      currentWeather,
      weatherDataset.dateIso,
      rightToOpacityEnabled,
    ]
  );

  // ============================================================================
  // FORENSIC INDOOR CLIMATE TELEMETRY & PHYSICS ENGINE (`computeIndoorClimateTelemetry`)
  // ============================================================================
  const [useCalibratedForensicIndoorRef, setUseCalibratedForensicIndoorRef] =
    useState<boolean>(true);
  const [autoLogIndoorClimateAlarm, setAutoLogIndoorClimateAlarm] =
    useState<boolean>(false);
  const [lastLoggedIndoorAlarmCode, setLastLoggedIndoorAlarmCode] = useState<
    string | null
  >(null);
  const loggedIndoorAlarmKeysRef = useRef<Set<string>>(new Set());

  const selectedReceptorZone = useMemo(
    () =>
      receptors.find((r) => r.id === selectedReceptorExposure.receptorId) ||
      receptors[0],
    [receptors, selectedReceptorExposure.receptorId]
  );

  const indoorClimateTelemetry = useMemo(
    () =>
      computeIndoorClimateTelemetry({
        receptor: selectedReceptorZone,
        outdoorExposure: selectedReceptorExposure,
        activeSources: sources,
        weather: currentWeather,
        machineryKey: selectedImpulseMachineryKey,
        ventilationMode: cavVentilationMode,
        apartmentAreaM2: 82,
        indoorTempC: 21.0,
        leakageRatioTopBottom: 0.96,
        useCalibratedForensicReference: useCalibratedForensicIndoorRef,
      }),
    [
      selectedReceptorZone,
      selectedReceptorExposure,
      sources,
      currentWeather,
      selectedImpulseMachineryKey,
      cavVentilationMode,
      useCalibratedForensicIndoorRef,
    ]
  );

  const handleLogIndoorClimateAlgedonicAlarm = useCallback(
    async (triggerType: 'AUTOMATISK' | 'MANUEL') => {
      const nextNum = observations.length + 1;
      const code = `IND-${String(nextNum).padStart(2, '0')}`;
      const pt = selectedReceptorExposure.position;
      const obsTitle = `Algedonisk Indeklima-Alarm (${triggerType}): S_in = ${indoorClimateTelemetry.indoorSumQuotientSin.toFixed(
        2
      )} · ΔP_CAV = ${indoorClimateTelemetry.deltaPCavPa.toFixed(
        1
      )} Pa · z_NPL = ${indoorClimateTelemetry.zNplEffectiveMeters.toFixed(
        1
      )} m · PPV = ${indoorClimateTelemetry.ppvFoundationMmPerSec.toFixed(1)} mm/s`;

      const corroboration = evaluatePointInDispersionPlume(
        pt,
        sources,
        currentWeather,
        obsTitle
      );

      const description = `[RETSMEDICINSK INDEKLIMA-TELEMETRI · ${
        indoorClimateTelemetry.focusReceptorScopeLabel
      } · Receptor: ${indoorClimateTelemetry.receptorCode} (${
        indoorClimateTelemetry.receptorName
      })] Afstand d = ${
        indoorClimateTelemetry.distanceMeters
      } m → Vibrations-PPV = ${indoorClimateTelemetry.ppvFoundationMmPerSec.toFixed(
        1
      )} mm/s (@ ${
        indoorClimateTelemetry.dominantFrequencyHz
      } Hz), Degraderet Permeabilitet q_75,deg = ${indoorClimateTelemetry.degradedPermeabilityQ75DegM3PerHm2.toFixed(
        2
      )} m³/(h·m²). Mekanisk CAV-Undertryk ΔP_CAV = ${indoorClimateTelemetry.deltaPCavPa.toFixed(
        1
      )} Pa, Skakt-indsugning Q_op = ${indoorClimateTelemetry.shaftAndCrackInflowQopM3PerH.toFixed(
        1
      )} m³/h. Termisk Skorstenstryk ΔP_s = +${indoorClimateTelemetry.deltaPsSpanPa.toFixed(
        1
      )} Pa (${indoorClimateTelemetry.stackGradientPaPerM.toFixed(
        2
      )} Pa/m), Forskudt Neutraltryksplan z_NPL = ${indoorClimateTelemetry.zNplEffectiveMeters.toFixed(
        1
      )} m / ${indoorClimateTelemetry.buildingHeightMeters.toFixed(
        1
      )} m. Kvadratisk Superposition Q_tot = ${indoorClimateTelemetry.qTotSuperposedM3PerH.toFixed(
        1
      )} m³/h (ACH = ${indoorClimateTelemetry.achTotalPerHour.toFixed(
        2
      )} h⁻¹). Indendørs Asbest C_in = ${indoorClimateTelemetry.indoorAsbestosFibrePerCm3.toFixed(
        4
      )} fibre/cm³ (${
        indoorClimateTelemetry.indoorAsbestosPctOfGv
      }% af GV) → Samlet Indendørs Sumkvotient: S_in = ${indoorClimateTelemetry.indoorSumQuotientSin.toFixed(
        2
      )} (ULOVLIG ≥ 1,0 jf. BEK nr. 613 af 29/06/2026 § 3, stk. 3).`;

      const signature = await computeForensicSha256Hash({
        code,
        dateIso: weatherDataset.dateIso,
        hourIso: currentWeather.isoTime,
        position: pt,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        observationType: obsTitle,
        description,
        indoorClimateTelemetry: {
          indoorSumQuotientSin: indoorClimateTelemetry.indoorSumQuotientSin,
          deltaPCavPa: indoorClimateTelemetry.deltaPCavPa,
          zNplEffectiveMeters: indoorClimateTelemetry.zNplEffectiveMeters,
          ppvFoundationMmPerSec: indoorClimateTelemetry.ppvFoundationMmPerSec,
          degradedPermeabilityQ75DegM3PerHm2:
            indoorClimateTelemetry.degradedPermeabilityQ75DegM3PerHm2,
          indoorAsbestosFibrePerCm3:
            indoorClimateTelemetry.indoorAsbestosFibrePerCm3,
          qTotSuperposedM3PerH: indoorClimateTelemetry.qTotSuperposedM3PerH,
        },
        weather: currentWeather,
      });

      const zkpVerification = computeDeterministicZkpVerification({
        code,
        position: pt,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        observedTimestampIso: currentWeather.isoTime,
        weather: currentWeather,
        sumQuotientS: indoorClimateTelemetry.indoorSumQuotientSin,
        distanceFromSourceMeters: indoorClimateTelemetry.distanceMeters,
        rightToOpacityEnabled,
        existingSha256: signature,
      });

      const newObs: AlgedonicObservation = {
        id: `obs-indoor-telemetry-${Date.now()}`,
        code,
        createdAtIso: new Date().toISOString(),
        observedDateIso: weatherDataset.dateIso,
        observedHourIndex: currentWeather.hourIndex,
        observedHourLabel: currentWeather.hourLabel,
        observedTimestampIso: currentWeather.isoTime,
        position: pt,
        locationLabel: `${indoorClimateTelemetry.receptorCode}: ${indoorClimateTelemetry.receptorName} (${indoorClimateTelemetry.receptorAddress})`,
        reporterRole: 'Byggerådgiver / Miljøtekniker',
        reporterIdentifier:
          'Indeklima-Telemetri & Fysikmotor (computeIndoorClimateTelemetry · SHA-256 & ZKP)',
        observationType: obsTitle,
        description,
        weatherSnapshot: currentWeather,
        plumeCorroboration: {
          ...corroboration,
          calculatedSumQuotient: Math.max(
            corroboration.calculatedSumQuotient,
            indoorClimateTelemetry.indoorSumQuotientSin
          ),
        },
        sha256Signature: signature,
        zkpVerification,
      };

      setObservations((prev) => [newObs, ...prev]);
      setSelectedObservationId(newObs.id);
      setLastLoggedIndoorAlarmCode(code);
    },
    [
      observations.length,
      selectedReceptorExposure.position,
      indoorClimateTelemetry,
      sources,
      currentWeather,
      weatherDataset.dateIso,
      rightToOpacityEnabled,
    ]
  );

  // Automatic Algedonic Indoor Alarm trigger when S_in >= 0.8 or ΔP_tot < -25 Pa (when auto-log is enabled)
  useEffect(() => {
    if (!autoLogIndoorClimateAlarm) return;
    if (!indoorClimateTelemetry.triggersAlgedonicIndoorAlarm) return;
    const dedupeKey = `${weatherDataset.dateIso}::${currentWeather.hourIndex}::${indoorClimateTelemetry.receptorId}::${indoorClimateTelemetry.ventilationMode}`;
    if (loggedIndoorAlarmKeysRef.current.has(dedupeKey)) return;
    loggedIndoorAlarmKeysRef.current.add(dedupeKey);
    void handleLogIndoorClimateAlgedonicAlarm('AUTOMATISK');
  }, [
    autoLogIndoorClimateAlarm,
    indoorClimateTelemetry,
    weatherDataset.dateIso,
    currentWeather.hourIndex,
    handleLogIndoorClimateAlgedonicAlarm,
  ]);

  // Persistent ring-buffer of latest 50 algedonic indoor alarms where S_in > 1.0 with SHA-256 integrity seal
  const [indoorAlarmRingLog, setIndoorAlarmRingLog] = useState<
    IndoorClimateAlgedonicLogEntry[]
  >(() => loadStoredIndoorAlarms());
  const indoorAlarmDedupeRef = useRef<string | null>(null);

  useEffect(() => {
    if (indoorClimateTelemetry.indoorSumQuotientSin <= 1.0) return;
    const quantizedSin = Math.round(indoorClimateTelemetry.indoorSumQuotientSin * 100);
    const dedupeKey = `${weatherDataset.dateIso}::${currentWeather.hourIndex}::${indoorClimateTelemetry.receptorId}::${indoorClimateTelemetry.ventilationMode}::${quantizedSin}`;
    if (indoorAlarmDedupeRef.current === dedupeKey) return;
    indoorAlarmDedupeRef.current = dedupeKey;

    let cancelled = false;
    void createSignedIndoorAlarmEntry({
      telemetry: indoorClimateTelemetry,
      currentWeather,
      dateIso: weatherDataset.dateIso,
    }).then((signedEntry) => {
      if (cancelled) return;
      setIndoorAlarmRingLog((prev) => {
        if (prev.some((e) => e.dedupeKey === signedEntry.dedupeKey)) return prev;
        const next = [signedEntry, ...prev].slice(0, MAX_INDOOR_ALARM_LOG_ENTRIES);
        persistStoredIndoorAlarms(next);
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [indoorClimateTelemetry, currentWeather, weatherDataset.dateIso]);

  // System B Atomar Algedonisk Simultan-Simulering (System 1 + System 3 · T0 -> T1, Δt = 0 ms)
  const [latestSimultaneousChainEntry, setLatestSimultaneousChainEntry] = useState<{
    code: string;
    signature: string;
  } | null>(null);
  const [system3InterlockLogs, setSystem3InterlockLogs] = useState<System3InterlockLogEntry[]>([]);

  const cavModeLabelDa = useMemo(() => {
    switch (cavVentilationMode) {
      case 'balanced_hepa_overpress':
        return 'Balanceret HEPA Overtryk';
      case 'cav_plus_range_hood_120':
        return 'CAV + Emhætte (120 L/s Undertryk)';
      case 'natural_passive':
        return 'Naturlig Passiv Ventilation';
      default:
        return 'Centralt CAV-Udsug (Undertryk)';
    }
  }, [cavVentilationMode]);

  const handleAtomicSimultaneousDispatch = useCallback(
    (dispatchEvent: SimultaneousAlgedonicDispatch) => {
      // 1. System 3 øjeblikkeligt CAV-tvangsskift til balanceret HEPA overtryk & ventilspærring (V-VEST + V-MIDT) ved T1
      setCavVentilationMode('balanced_hepa_overpress');
      setIsS3ValveLockoutActive(true);

      // 2. Aktivér Kierulffsvej DN200 rørlag & brudtelemetri når vandrørstrigger/brudscenarie er aktivt
      if (
        dispatchEvent.triggers.waterMainRuptureOrVibrationBreach ||
        dispatchEvent.scenarioId === 'kierulffsvej_eternit_rupture' ||
        dispatchEvent.scenarioId === 'combined_vibration_rupture_plume'
      ) {
        setShowWaterMainInSurface(true);
        if (
          dispatchEvent.scenarioId === 'kierulffsvej_eternit_rupture' ||
          dispatchEvent.scenarioId === 'combined_vibration_rupture_plume'
        ) {
          setSimulatedPipeRuptureActive(true);
        }
      }

      // 3. Auto-signer atomar SHA-256 Chain-of-Custody hændelse (100% valideret mod State Registry & Merkle-Root)
      observationsCountRef.current =
        Math.max(observationsCountRef.current, observationsRef.current.length) + 1;
      const nextNum = observationsCountRef.current;
      const code = `S1S3-${String(nextNum).padStart(2, '0')}`;
      const pt = dispatchEvent.system1State.epicenter;
      const obsTitle = `Algedonisk Simultan-Nødbremse (S1+S3 · ${dispatchEvent.scenarioTitleDa})`;
      const desc =
        `T0 (${dispatchEvent.t0DetectedIso}) → T1 (${dispatchEvent.t1DispatchedIso}, latens ${dispatchEvent.latencyMs} ms, Δt = 0 ms bureaukratisk bypass). ` +
        `Gate 1: ${dispatchEvent.gate1Validation.corroboratingNodes}/${dispatchEvent.gate1Validation.totalNodes} noder (${dispatchEvent.gate1Validation.corroborationPct}%) · Tr: 18,5 t → ${dispatchEvent.relaxationTimeAfterHours.toFixed(3)} t. ` +
        `S1: ${dispatchEvent.system1State.workerOrderDa} · Ø-drift på ${dispatchEvent.system1State.islandModeBlockLabels.join(', ')}. ` +
        `S3: Spærring af ${dispatchEvent.system3State.lockedValveCodes.join(' & ')} (${dispatchEvent.system3State.waterLossPreventedM3} m³ vandspild afværget), CAV tvangsskiftet til Balanceret HEPA-Overtryk.`;

      const logId = `s3log-${dispatchEvent.eventId}-${nextNum}`;
      const pendingLogEntry: System3InterlockLogEntry = {
        id: logId,
        observationCode: code,
        eventId: dispatchEvent.eventId,
        scenarioTitleDa: dispatchEvent.scenarioTitleDa,
        timestampIso: dispatchEvent.t1DispatchedIso,
        dispatchedTimeLabel: dispatchEvent.t1DispatchedIso.slice(11, 19),
        lockedValveCodes: [...dispatchEvent.system3State.lockedValveCodes],
        haltedMachines: dispatchEvent.system3State.haltedMachines.map((m) => ({
          id: m.id,
          nameDa: m.nameDa,
          interlockRuleDa: m.interlockRuleDa,
        })),
        sha256Signature: 'Beregner SHA-256...',
        triggerSummaryDa: `${dispatchEvent.system3State.sectioningStatuteDa} · ${dispatchEvent.system3State.waterLossPreventedM3} m³ vandspild afværget · CAV tvangsskiftet til Balanceret HEPA-Overtryk`,
      };
      setSystem3InterlockLogs((prev) => [pendingLogEntry, ...prev].slice(0, 30));

      const signTask = (async () => {
        const corroboration = evaluatePointInDispersionPlume(
          pt,
          sources,
          currentWeather,
          obsTitle
        );
        const signature = await computeForensicSha256Hash({
          code,
          eventId: dispatchEvent.eventId,
          scenarioId: dispatchEvent.scenarioId,
          dateIso: weatherDataset.dateIso,
          hourIso: currentWeather.isoTime,
          position: pt,
          t0DetectedIso: dispatchEvent.t0DetectedIso,
          t1DispatchedIso: dispatchEvent.t1DispatchedIso,
          latencyMs: dispatchEvent.latencyMs,
          lockedValves: dispatchEvent.system3State.lockedValveCodes,
          observationType: obsTitle,
          description: desc,
        });
        const zkpVerification = computeDeterministicZkpVerification({
          code,
          position: pt,
          reporterRole: 'Byggerådgiver / Miljøtekniker',
          observedTimestampIso: currentWeather.isoTime,
          weather: currentWeather,
          sumQuotientS: Math.max(
            corroboration.calculatedSumQuotient,
            dispatchEvent.triggers.outdoorSumQuotientValue,
            dispatchEvent.triggers.indoorSumQuotientValue
          ),
          distanceFromSourceMeters: corroboration.distanceFromSourceMeters,
          rightToOpacityEnabled,
          existingSha256: signature,
        });
        const newObs: AlgedonicObservation = {
          id: `obs-s1s3-${dispatchEvent.t0EpochMs}-${nextNum}`,
          code,
          createdAtIso: dispatchEvent.t1DispatchedIso,
          observedDateIso: weatherDataset.dateIso,
          observedHourIndex: currentWeather.hourIndex,
          observedHourLabel: currentWeather.hourLabel,
          observedTimestampIso: currentWeather.isoTime,
          position: pt,
          locationLabel: dispatchEvent.system1State.epicenterLabelDa,
          reporterRole: 'Byggerådgiver / Miljøtekniker',
          reporterIdentifier: `VSM System B Algedonisk Bypass (ZKP ${dispatchEvent.gate1Validation.zkpRightToOpacityHash.slice(
            0,
            12
          )})`,
          observationType: obsTitle,
          description: desc,
          weatherSnapshot: currentWeather,
          plumeCorroboration: {
            ...corroboration,
            calculatedSumQuotient: Math.max(
              corroboration.calculatedSumQuotient,
              dispatchEvent.triggers.outdoorSumQuotientValue,
              dispatchEvent.triggers.indoorSumQuotientValue
            ),
          },
          sha256Signature: signature,
          zkpVerification,
        };
        observationsRef.current = [newObs, ...observationsRef.current];
        setObservations((prev) => [newObs, ...prev]);
        setLatestSimultaneousChainEntry({ code, signature });
        setSystem3InterlockLogs((prev) =>
          prev.map((entry) =>
            entry.id === logId ? { ...entry, sha256Signature: signature } : entry
          )
        );
      })().finally(() => {
        pendingObsSignPromisesRef.current.delete(signTask);
      });
      pendingObsSignPromisesRef.current.add(signTask);
    },
    [
      sources,
      currentWeather,
      weatherDataset.dateIso,
      rightToOpacityEnabled,
    ]
  );

  const byzantineFaultCount = useMemo(
    () => Object.values(myceliumByzantineNodeIds).filter(Boolean).length,
    [myceliumByzantineNodeIds]
  );

  const simultaneousAlgedonic = useSimultaneousAlgedonicDispatch({
    sources,
    receptors,
    buildings,
    receptorExposures,
    mesh: autonomousReceptorMesh,
    currentWeather,
    maxSiteSumQuotient,
    indoorClimateTelemetry,
    waterMainTelemetry,
    machineNoiseOutputDb: isManualMachineNoiseOverrideActive
      ? manualMachineNoiseOutputDb
      : 114,
    cavVentilationModeLabelDa: cavModeLabelDa,
    selectedHourIndex,
    timelineProgress: plumeRouteProgress,
    isPlayingTimeline:
      isPlaying || isAnimatingPlumeRoute || isRunningRangeSimulation,
    audioMuted: !myceliumAlerts.isAudioChimeEnabled,
    linkedSha256ObservationCode: latestSimultaneousChainEntry?.code,
    linkedSha256Signature: latestSimultaneousChainEntry?.signature,
    byzantineSpoofNodeCount: byzantineFaultCount,
    onAtomicSimultaneousDispatch: handleAtomicSimultaneousDispatch,
  });

  useEffect(() => {
    setIsS3ValveLockoutActive(simultaneousAlgedonic.dispatch.active);
  }, [simultaneousAlgedonic.dispatch.active]);

  const handleClearSimultaneousAll = useCallback(() => {
    simultaneousAlgedonic.clearSimultaneousSimulation();
    setSimulatedPipeRuptureActive(false);
    setIsS3ValveLockoutActive(false);
  }, [simultaneousAlgedonic]);

  // Collective PSS W22085 Machine Interlocks Aggregation & Mitigation Acknowledgement
  const [pssAckIds, setPssAckIds] = useState<string[]>([]);
  const [pssCollectiveAckAtIso, setPssCollectiveAckAtIso] = useState<string | null>(null);

  const pssInterlocks = useMemo(() => {
    const ackSet = new Set(pssAckIds);
    const hasUnsealedCatE = buildings.some((b) => b.category === 'e_demolished_unsecured');
    const hasConcurrentDC =
      buildings.some((b) => b.category === 'd_under_demolition') &&
      buildings.some((b) => b.category === 'c_under_renovation');
    const isCavExhaustActive =
      cavVentilationMode === 'cav_central_exhaust' ||
      cavVentilationMode === 'cav_plus_range_hood_120';
    const cavBreached = maxSiteSumQuotient >= 0.5 && isCavExhaustActive;
    const waterMainBreached =
      !hasSteelRoadPlates ||
      waterMainTelemetry.pipePpvMmPerSec >= 25 ||
      waterMainTelemetry.overallStatus === 'critical_rupture';
    const s3LockoutActive =
      simultaneousAlgedonic.dispatch.active &&
      simultaneousAlgedonic.dispatch.system3State.haltedMachines.length > 0;

    return [
      {
        id: 'pss-crawlspace-blok1',
        code: 'PSS-7-1.1',
        titleDa: 'Krybekælder-sekvenslås Blok 1',
        ruleRefDa: 'Wissenberg PSS W22085 pkt. 7 ID 1.1',
        severity: 'critical' as const,
        machineLabelDa: 'Gravemaskine / Kælderrydning (Blok 1)',
        mitigationHintDa: 'Bekræft at stueetagedæk fjernes før krybekælder-rydning',
        isActive: buildings.some((b) => b.id === 'BLOK-1' && b.category === 'd_under_demolition'),
        isAcknowledged: ackSet.has('pss-crawlspace-blok1'),
      },
      {
        id: 'pss-unsealed-ground',
        code: 'PSS-11.1',
        titleDa: 'Afrømningsniveau & Køreplader',
        ruleRefDa: 'PSS W22085 pkt. 11.1 · Boussinesq DN200',
        severity: waterMainTelemetry.pipePpvMmPerSec >= 25 ? ('critical' as const) : ('warning' as const),
        machineLabelDa: 'Entreprenørmaskiner / Kierulffsvej',
        mitigationHintDa: 'Udlæg Wissenberg køreplader og vask hjul ved udkørsel',
        isActive: hasUnsealedCatE || waterMainBreached,
        isAcknowledged: ackSet.has('pss-unsealed-ground'),
      },
      {
        id: 'pss-noise-concurrency',
        code: 'PSS-7-3.4',
        titleDa: 'Samtidighed d↔c & >80 dB',
        ruleRefDa: 'PSS pkt. 7 ID 3.3 & 3.4 (5-dages varsel)',
        severity: 'warning' as const,
        machineLabelDa: 'Hydraulisk hammer / Diamantskærer',
        mitigationHintDa: 'Opsæt støjvæg / tidsadskillelse mod renovering (kat. c)',
        isActive: hasConcurrentDC || manualMachineNoiseOutputDb >= 110,
        isAcknowledged: ackSet.has('pss-noise-concurrency'),
      },
      {
        id: 'br18-cav-vacuum',
        code: 'BR18-§443',
        titleDa: 'CAV-Vakuumspærring',
        ruleRefDa: 'BR18 § 443 · DS 447 (S_out ≥ 0,5)',
        severity: 'critical' as const,
        machineLabelDa: 'Nedrivning opstrøms & CAV-udsugning',
        mitigationHintDa: 'Skift til balanceret H14-HEPA overtryk eller stands nedrivning i medvind',
        isActive: cavBreached,
        isAcknowledged: ackSet.has('br18-cav-vacuum'),
      },
      {
        id: 's3-algedonic-lockout',
        code: 'S3-LOCKOUT',
        titleDa: 'Algedonisk Maskin-Tvangsstop',
        ruleRefDa: 'VSM System 3 Nødbremse · PSS W22085',
        severity: 'critical' as const,
        machineLabelDa: 'Alle aktive nedrivningsmaskiner',
        mitigationHintDa: 'Verificér modvind-evakuering, lukkede ventiler og vandtåge før genstart',
        isActive: s3LockoutActive,
        isAcknowledged: ackSet.has('s3-algedonic-lockout'),
      },
    ];
  }, [
    pssAckIds,
    buildings,
    cavVentilationMode,
    maxSiteSumQuotient,
    hasSteelRoadPlates,
    waterMainTelemetry.pipePpvMmPerSec,
    waterMainTelemetry.overallStatus,
    simultaneousAlgedonic.dispatch.active,
    simultaneousAlgedonic.dispatch.system3State.haltedMachines.length,
    manualMachineNoiseOutputDb,
  ]);

  const handleAcknowledgeAllPssInterlocks = useCallback(() => {
    const activeIds = pssInterlocks.filter((i) => i.isActive).map((i) => i.id);
    if (activeIds.length === 0) return;
    const tsIso = new Date().toISOString();
    setPssAckIds((prev) => Array.from(new Set([...prev, ...activeIds])));
    setPssCollectiveAckAtIso(tsIso);
    const ackCodes = pssInterlocks
      .filter((i) => i.isActive)
      .map((i) => `${i.code} (${i.titleDa})`)
      .join(' · ');
    void handleAddForecastToEvidence(
      `[PSS W22085 KOLLEKTIV INTERLOCK-KVITTERING] ${activeIds.length} maskin-låse kvitteret efter afværge`,
      `Kollektiv kvittering kl. ${tsIso.slice(11, 19)} UTC efter afværgeforanstaltninger (køreplader=${
        hasSteelRoadPlates ? 'AKTIV' : 'EJ UDLAGT'
      }, CAV-tilstand=${cavVentilationMode}): ${ackCodes}.`,
      weatherDataset.dateIso,
      selectedHourIndex
    );
  }, [
    pssInterlocks,
    hasSteelRoadPlates,
    cavVentilationMode,
    handleAddForecastToEvidence,
    weatherDataset.dateIso,
    selectedHourIndex,
  ]);

  const handleResetPssInterlockAck = useCallback(() => {
    setPssAckIds([]);
    setPssCollectiveAckAtIso(null);
  }, []);

  // Focus 'Spredningsprognose' widget and automatically display 'Døgnet efter fra klokken 00.00.00 - 00.59.59' when selected
  const handleSelectDispersionForecastOption = useCallback(
    (nextMode: DispersionForecastOptionMode) => {
      setDispersionForecastMode(nextMode);
      setShowRibbonDispersionForecast(true);
      setDispersionForecastFocusTrigger((prev) => prev + 1);
      if (nextMode === 'next_day_00_00_59') {
        const nextDate = shiftDateIsoByDays(forecastAnchorDateIso, 1);
        setSelectedDateIso(nextDate);
        setSelectedHourIndex(0);
        setPlumeRouteProgress(0);
      }
    },
    [forecastAnchorDateIso]
  );

  // Register a new physical observation / Algedonic Signal and couple it with Open-Meteo + mathematical plume
  const handleRegisterObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextNum = observations.length + 1;
    const code = `ALG-${String(nextNum).padStart(2, '0')}`;
    const corroboration = evaluatePointInDispersionPlume(
      pendingObservationPoint,
      sources,
      currentWeather,
      obsType
    );
    const nabotestCheck = evaluateNabotestForPoint(
      pendingObservationPoint,
      autonomousReceptorMesh
    );
    const baseDescription = obsDescription.trim() || obsType;
    const enrichedObsDescription = nabotestCheck.nabotestAppendixDa
      ? `${baseDescription} ${nabotestCheck.nabotestAppendixDa}`
      : baseDescription;

    const signature = await computeForensicSha256Hash({
      code,
      dateIso: weatherDataset.dateIso,
      hourIso: currentWeather.isoTime,
      position: pendingObservationPoint,
      reporterRole: obsReporterRole,
      observationType: obsType,
      description: enrichedObsDescription,
      weather: currentWeather,
      isInsideMathematicalPlume: corroboration.isInsideMathematicalPlume,
      calculatedSumQuotient: corroboration.calculatedSumQuotient,
      photoSha256: pendingPhotoEvidence?.imageSha256Hash || null,
    });

    const zkpVerification = computeDeterministicZkpVerification({
      code,
      position: pendingObservationPoint,
      reporterRole: obsReporterRole,
      observedTimestampIso: currentWeather.isoTime,
      weather: currentWeather,
      sumQuotientS: corroboration.calculatedSumQuotient,
      distanceFromSourceMeters: corroboration.distanceFromSourceMeters,
      rightToOpacityEnabled,
      existingSha256: signature,
    });

    const newObs: AlgedonicObservation = {
      id: `obs-${Date.now()}`,
      code,
      createdAtIso: new Date().toISOString(),
      observedDateIso: weatherDataset.dateIso,
      observedHourIndex: currentWeather.hourIndex,
      observedHourLabel: currentWeather.hourLabel,
      observedTimestampIso: currentWeather.isoTime,
      position: pendingObservationPoint,
      locationLabel:
        obsLocationLabel.trim() ||
        `GPS ${pendingObservationPoint.lat.toFixed(4)}°N, ${pendingObservationPoint.lng.toFixed(
          4
        )}°E (Ringparken)`,
      reporterRole: obsReporterRole,
      reporterIdentifier: rightToOpacityEnabled
        ? zkpVerification.anonymizedRoleCommitment
        : obsReporterId.trim() || obsReporterRole,
      observationType: obsType,
      description: enrichedObsDescription,
      weatherSnapshot: currentWeather,
      plumeCorroboration: corroboration,
      sha256Signature: signature,
      zkpVerification,
      photoEvidence: pendingPhotoEvidence,
    };

    setObservations((prev) => [newObs, ...prev]);
    setSelectedObservationId(newObs.id);
    setPendingPhotoEvidence(undefined);
    setMapClickMode('none');
  };

  // Register AI-analyzed photo documentation directly as cryptographically signed forensic evidence
  const handleRegisterPhotoEvidenceObservation = async (params: {
    photoEvidence: ForensicPhotoEvidence;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => {
    const nextNum = observations.length + 1;
    const code = `FOTO-ALG-${String(nextNum).padStart(2, '0')}`;
    const corroboration = evaluatePointInDispersionPlume(
      params.position,
      sources,
      currentWeather,
      params.observationType
    );

    const signature = await computeForensicSha256Hash({
      code,
      dateIso: weatherDataset.dateIso,
      hourIso: currentWeather.isoTime,
      position: params.position,
      reporterRole: obsReporterRole,
      observationType: params.observationType,
      description: params.description,
      imageSha256Hash: params.photoEvidence.imageSha256Hash,
      aiVisualTitle: params.photoEvidence.aiAnalysis.visualTitle,
      weather: currentWeather,
      isInsideMathematicalPlume: corroboration.isInsideMathematicalPlume,
      calculatedSumQuotient: corroboration.calculatedSumQuotient,
    });

    const newObs: AlgedonicObservation = {
      id: `obs-photo-${Date.now()}`,
      code,
      createdAtIso: new Date().toISOString(),
      observedDateIso: weatherDataset.dateIso,
      observedHourIndex: currentWeather.hourIndex,
      observedHourLabel: currentWeather.hourLabel,
      observedTimestampIso: currentWeather.isoTime,
      position: params.position,
      locationLabel:
        params.locationLabel.trim() ||
        `GPS ${params.position.lat.toFixed(4)}°N, ${params.position.lng.toFixed(4)}°E (Ringparken)`,
      reporterRole: obsReporterRole,
      reporterIdentifier: obsReporterId.trim() || obsReporterRole,
      observationType: params.observationType,
      description: params.description,
      weatherSnapshot: currentWeather,
      plumeCorroboration: corroboration,
      sha256Signature: signature,
      photoEvidence: params.photoEvidence,
    };

    setObservations((prev) => [newObs, ...prev]);
    setSelectedObservationId(newObs.id);
    setMapClickMode('none');
  };

  // Register analyzed forensic audio clip & identified machinery/tool source as SHA-256 signed evidence
  const handleRegisterAudioEvidenceObservation = async (params: {
    audioEvidence: ForensicAudioEvidence;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => {
    const nextNum = observations.length + 1;
    const code = `LYD-ALG-${String(nextNum).padStart(2, '0')}`;
    const corroboration = evaluatePointInDispersionPlume(
      params.position,
      sources,
      currentWeather,
      params.observationType
    );

    const signature = await computeForensicSha256Hash({
      code,
      dateIso: weatherDataset.dateIso,
      hourIso: currentWeather.isoTime,
      position: params.position,
      reporterRole: obsReporterRole,
      observationType: params.observationType,
      description: params.description,
      audioSha256Hash: params.audioEvidence.audioSha256Hash,
      identifiedToolOrMachine: params.audioEvidence.analysis.identifiedToolOrMachine,
      estimatedSourceLwaDb: params.audioEvidence.analysis.estimatedSourceLwaDb,
      dominantFrequencyHz: params.audioEvidence.analysis.dominantFrequencyHz,
      statutoryPenaltyDb: params.audioEvidence.analysis.statutoryPenaltyDb,
      weather: currentWeather,
      isInsideMathematicalPlume: corroboration.isInsideMathematicalPlume,
      calculatedSumQuotient: corroboration.calculatedSumQuotient,
    });

    const newObs: AlgedonicObservation = {
      id: `obs-audio-${Date.now()}`,
      code,
      createdAtIso: new Date().toISOString(),
      observedDateIso: weatherDataset.dateIso,
      observedHourIndex: currentWeather.hourIndex,
      observedHourLabel: currentWeather.hourLabel,
      observedTimestampIso: currentWeather.isoTime,
      position: params.position,
      locationLabel:
        params.locationLabel.trim() ||
        `GPS ${params.position.lat.toFixed(4)}°N, ${params.position.lng.toFixed(4)}°E (Ringparken)`,
      reporterRole: obsReporterRole,
      reporterIdentifier: obsReporterId.trim() || obsReporterRole,
      evidenceCategory: 'Beboerklage',
      observationType: params.observationType,
      description: params.description,
      weatherSnapshot: currentWeather,
      plumeCorroboration: corroboration,
      sha256Signature: signature,
      audioEvidence: params.audioEvidence,
    };

    setObservations((prev) => [newObs, ...prev]);
    setSelectedObservationId(newObs.id);
    setMapClickMode('none');
  };

  // Register AI-analyzed PDF correspondence, FOIA/aktindsigt responses, and authority filings as cryptographically signed forensic evidence
  const handleRegisterPdfEvidenceObservation = async (params: {
    pdfEvidence: ForensicPdfEvidence;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => {
    const nextNum = observations.length + 1;
    const code = `PDF-ALG-${String(nextNum).padStart(2, '0')}`;
    const corroboration = evaluatePointInDispersionPlume(
      params.position,
      sources,
      currentWeather,
      params.observationType
    );

    const signature = await computeForensicSha256Hash({
      code,
      dateIso: weatherDataset.dateIso,
      hourIso: currentWeather.isoTime,
      position: params.position,
      reporterRole: obsReporterRole,
      observationType: params.observationType,
      description: params.description,
      pdfSha256Hash: params.pdfEvidence.sha256Hash,
      documentTitle: params.pdfEvidence.aiAnalysis.documentTitle,
      referenceJournalNumber: params.pdfEvidence.aiAnalysis.referenceJournalNumber,
      weather: currentWeather,
      isInsideMathematicalPlume: corroboration.isInsideMathematicalPlume,
      calculatedSumQuotient: corroboration.calculatedSumQuotient,
    });

    const newObs: AlgedonicObservation = {
      id: `obs-pdf-${Date.now()}`,
      code,
      createdAtIso: new Date().toISOString(),
      observedDateIso: weatherDataset.dateIso,
      observedHourIndex: currentWeather.hourIndex,
      observedHourLabel: currentWeather.hourLabel,
      observedTimestampIso: currentWeather.isoTime,
      position: params.position,
      locationLabel:
        params.locationLabel.trim() ||
        `GPS ${params.position.lat.toFixed(4)}°N, ${params.position.lng.toFixed(4)}°E (Ringparken)`,
      reporterRole: obsReporterRole,
      reporterIdentifier:
        params.pdfEvidence.aiAnalysis.senderEntity || obsReporterId.trim() || obsReporterRole,
      observationType: params.observationType,
      description: params.description,
      weatherSnapshot: currentWeather,
      plumeCorroboration: corroboration,
      sha256Signature: signature,
      pdfEvidence: params.pdfEvidence,
    };

    setObservations((prev) => [newObs, ...prev]);
    setSelectedObservationId(newObs.id);
    setMapClickMode('none');
  };

  // Register a 2D Tactical Map 'Snapshot Map' view (zoom, geographic bounds, active layers & rendered viewport image) as a timestamped forensic observation entry
  const handleSaveMapSnapshotObservation = useCallback(
    async (snapshot: ForensicMapSnapshotMetadata & { snapshotDataUrl: string }) => {
      const nextNum = observations.length + 1;
      const code = `SNAP-ALG-${String(nextNum).padStart(2, '0')}`;
      const corroboration = evaluatePointInDispersionPlume(
        snapshot.center,
        sources,
        currentWeather,
        'Snapshot Map (2D Taktisk Kort-Udsnit)'
      );

      const imageSha256Hash = await computeForensicSha256Hash({
        snapshotDataUrlLength: snapshot.snapshotDataUrl.length,
        snapshotDataUrlHead: snapshot.snapshotDataUrl.slice(0, 128),
        capturedAtIso: snapshot.capturedAtIso,
        zoom: snapshot.zoom,
        bounds: snapshot.bounds,
      });

      const description = `[SNAPSHOT MAP · 2D TAKTISK KORT-UDSNIT] Tidspunkt: ${weatherDataset.dateIso} kl. ${currentWeather.hourLabel} (${snapshot.capturedAtIso}). Zoom: Z=${snapshot.zoom.toFixed(1)}x. Geografiske grænser (Bounds): [N ${snapshot.bounds.north.toFixed(5)}°N, S ${snapshot.bounds.south.toFixed(5)}°N, Ø ${snapshot.bounds.east.toFixed(5)}°E, V ${snapshot.bounds.west.toFixed(5)}°E]. Kort-centrum: ${snapshot.center.lat.toFixed(5)}°N, ${snapshot.center.lng.toFixed(5)}°E. Tilstand: ${snapshot.modeDescriptor}. Aktive kortlag (${snapshot.activeLayers.length}): ${snapshot.activeLayers.join(' · ')}.`;

      const signature = await computeForensicSha256Hash({
        code,
        dateIso: weatherDataset.dateIso,
        hourIso: currentWeather.isoTime,
        position: snapshot.center,
        zoom: snapshot.zoom,
        bounds: snapshot.bounds,
        activeLayers: snapshot.activeLayers,
        modeDescriptor: snapshot.modeDescriptor,
        imageSha256Hash,
        weather: currentWeather,
        calculatedSumQuotient: corroboration.calculatedSumQuotient,
      });

      const mapPhotoEvidence: ForensicPhotoEvidence = {
        id: `snap-img-${Date.now()}`,
        fileName: `snapshot-map-${weatherDataset.dateIso}-kl-${currentWeather.hourLabel.replace(':', '')}-z${snapshot.zoom.toFixed(1)}.png`,
        mimeType: 'image/png',
        fileSizeBytes: Math.round(snapshot.snapshotDataUrl.length * 0.75),
        dataUrl: snapshot.snapshotDataUrl,
        imageSha256Hash,
        capturedAtIso: snapshot.capturedAtIso,
        aiAnalysis: {
          visualTitle: `2D Taktisk Kort-Snapshot (Z:${snapshot.zoom.toFixed(1)} · ${snapshot.activeLayers.length} lag)`,
          visualDescription: description,
          detectedHazards: snapshot.activeLayers,
          suspectedSubstances: ['asbestos', 'heavyMetals', 'pcb', 'quartzWool'],
          severityAssessment:
            corroboration.calculatedSumQuotient >= 1.0
              ? 'KRITISK'
              : corroboration.calculatedSumQuotient >= 0.5
              ? 'FORHØJET'
              : 'MODERAT',
          confidencePct: 99,
          recommendedObservationType: 'Snapshot Map (2D Taktisk Kort-Udsnit · Zoom, Bounds & Lag)',
          statutoryReferences: [
            'BEK nr. 613 af 29/06/2026 § 3, stk. 3',
            'Retsplejelovens § 823 / ISO/IEC 27037 (Digitalt Kartografisk Bevis)',
          ],
          forensicConclusion: `Tidsstemplet 2D kort-snapshot med låst zoom (Z:${snapshot.zoom.toFixed(1)}), koordinatgrænser og aktive spredningslag (${snapshot.activeLayers.join(', ')}).`,
          analyzedAtIso: snapshot.capturedAtIso,
          modelUsed: '2D Tactical Map Snapshot Engine (Deterministic Geo-Bounds)',
        },
      };

      const newObs: AlgedonicObservation = {
        id: `obs-map-snapshot-${Date.now()}`,
        code,
        createdAtIso: snapshot.capturedAtIso,
        observedDateIso: weatherDataset.dateIso,
        observedHourIndex: currentWeather.hourIndex,
        observedHourLabel: currentWeather.hourLabel,
        observedTimestampIso: currentWeather.isoTime,
        position: snapshot.center,
        locationLabel: `Snapshot Map Centrum (${snapshot.center.lat.toFixed(4)}°N, ${snapshot.center.lng.toFixed(4)}°E · Z:${snapshot.zoom.toFixed(1)})`,
        reporterRole: obsReporterRole,
        reporterIdentifier: obsReporterId.trim() || obsReporterRole,
        observationType: 'Snapshot Map (2D Taktisk Kort-Udsnit · Zoom, Bounds & Lag)',
        description,
        weatherSnapshot: currentWeather,
        plumeCorroboration: corroboration,
        sha256Signature: signature,
        photoEvidence: mapPhotoEvidence,
        mapSnapshot: {
          zoom: snapshot.zoom,
          center: snapshot.center,
          bounds: snapshot.bounds,
          activeLayers: snapshot.activeLayers,
          modeDescriptor: snapshot.modeDescriptor,
          capturedAtIso: snapshot.capturedAtIso,
        },
      };

      setObservations((prev) => [newObs, ...prev]);
      setSelectedObservationId(newObs.id);
    },
    [
      observations.length,
      sources,
      currentWeather,
      weatherDataset.dateIso,
      obsReporterRole,
      obsReporterId,
    ]
  );

  // Register Kierulffsvej DN200 drinking water main telemetry & inspection as SHA-256 signed evidence
  const handleLogWaterMainObservation = useCallback(
    async (telemetry: WaterMainLiveTelemetry, detailLabel?: string) => {
      observationsCountRef.current =
        Math.max(observationsCountRef.current, observationsRef.current.length) + 1;
      const nextNum = observationsCountRef.current;
      const code = `VAND-ALG-${String(nextNum).padStart(2, '0')}`;
      const pos = telemetry.inspectionCenter;
      const corroboration = evaluatePointInDispersionPlume(
        pos,
        sources,
        currentWeather,
        detailLabel || 'Drikkevands-Hovedrør Kierulffsvej (DN200)'
      );
      const alertSummary =
        telemetry.legalAlerts.length > 0
          ? telemetry.legalAlerts.map((a) => `${a.code} (${a.statute})`).join(' · ')
          : 'Ingen aktive lovbrud';
      const description = `[KIERULFFSVEJ DRIKKEVANDSHOVEDRØR · ${telemetry.layerId}] ${
        detailLabel || telemetry.statusLabelDa
      }. Ejer: ${telemetry.ownerName} · Hårdhed: ${telemetry.waterHardnessDh.toFixed(2)} °dH · Dim: ${
        telemetry.dimension
      } (${telemetry.primaryMaterial}) · Lægningsdybde: -${telemetry.burialDepthMeters.toFixed(
        2
      )} m u.t. (under -${telemetry.districtHeatingDepthMeters.toFixed(
        2
      )} m fjernvarme). Driftstryk: ${telemetry.pressureBar.toFixed(2)} bar · Flow: ${telemetry.flowLs.toFixed(
        1
      )} L/s · Hydraulisk effekt: ${telemetry.hydraulicPowerWatts.toFixed(
        0
      )} W. DIN 4150-3 PPV: ${telemetry.pipePpvMmPerSec.toFixed(
        1
      )} mm/s (stikledning: ${telemetry.nearestBranchPpvMmPerSec.toFixed(1)} mm/s, kilde ${
        telemetry.nearestSourceCode
      } på ${telemetry.nearestSourceDistanceMeters.toFixed(
        1
      )} m). Boussinesq kronetryk: ${telemetry.crownStressKpa.toFixed(1)} kPa (${
        telemetry.hasSteelRoadPlates
          ? 'med Wissenberg PSS W22085 køreplader'
          : 'uden køreplader'
      }). Grundvand: -${telemetry.effectiveGroundwaterDepthMeters.toFixed(
        2
      )} m · Tilbagesugning: ${telemetry.intrusionRiskLevel} (Pb ${
        telemetry.estimatedLeadIntrusionUgL
      } µg/L, PAH-4 ${telemetry.estimatedPah4SumUgL} µg/L). Retsalarmer: ${alertSummary}.`;

      const signature = await computeForensicSha256Hash({
        code,
        layerId: telemetry.layerId,
        coordinateMode: telemetry.coordinateMode,
        dateIso: weatherDataset.dateIso,
        hourIso: currentWeather.isoTime,
        position: pos,
        pressureBar: telemetry.pressureBar,
        flowLs: telemetry.flowLs,
        pipePpvMmPerSec: telemetry.pipePpvMmPerSec,
        crownStressKpa: telemetry.crownStressKpa,
        hasSteelRoadPlates: telemetry.hasSteelRoadPlates,
        simulatedPipeRuptureActive: telemetry.simulatedPipeRuptureActive,
        legalAlerts: telemetry.legalAlerts.map((a) => a.code),
      });

      const zkpVerification = computeDeterministicZkpVerification({
        code,
        position: pos,
        reporterRole: obsReporterRole,
        observedTimestampIso: currentWeather.isoTime,
        weather: currentWeather,
        sumQuotientS: corroboration.calculatedSumQuotient,
        distanceFromSourceMeters: corroboration.distanceFromSourceMeters,
        rightToOpacityEnabled,
        existingSha256: signature,
      });

      const newObs: AlgedonicObservation = {
        id: `obs-water-main-${Date.now()}-${nextNum}`,
        code,
        createdAtIso: new Date().toISOString(),
        observedDateIso: weatherDataset.dateIso,
        observedHourIndex: currentWeather.hourIndex,
        observedHourLabel: currentWeather.hourLabel,
        observedTimestampIso: currentWeather.isoTime,
        position: pos,
        locationLabel: `Kierulffsvej DN200 Hovedrør (${
          telemetry.coordinateMode === 'dar_verified_wgs84'
            ? 'DAR/EPSG:25832'
            : 'Scene-kalibreret'
        })`,
        reporterRole: obsReporterRole,
        reporterIdentifier: obsReporterId.trim() || obsReporterRole,
        observationType: 'Infrastruktur & Drikkevand (SK Vand A/S DN200 Kierulffsvej)',
        description,
        weatherSnapshot: currentWeather,
        plumeCorroboration: corroboration,
        sha256Signature: signature,
        zkpVerification,
      };

      observationsRef.current = [newObs, ...observationsRef.current];
      setObservations((prev) => [newObs, ...prev]);
      setSelectedObservationId(newObs.id);
      setActiveTab('algedonic');
    },
    [
      sources,
      currentWeather,
      weatherDataset.dateIso,
      obsReporterRole,
      obsReporterId,
      rightToOpacityEnabled,
    ]
  );

  // ============================================================================
  // AUTOMATED 24-HOUR CUMULATIVE DUST-DEPOSITION (µg/m²) DANGER ALERT & ALGEDONIC LOGGING
  // ============================================================================
  const [dustDepositionDangerThresholdUgM2, setDustDepositionDangerThresholdUgM2] =
    useState<number>(150);
  const [autoLogDustDangerToAlgedonic, setAutoLogDustDangerToAlgedonic] =
    useState<boolean>(true);
  const [lastAutoLoggedDustAlertCode, setLastAutoLoggedDustAlertCode] = useState<string | null>(
    null
  );
  const loggedDustDangerKeysRef = useRef<Set<string>>(new Set());

  const allReceptors24hDustSorted = useMemo(() => {
    const combined = [...puff24h.receptorSummaries, ...puff24h.streetPointSummaries];
    const uniqueById = new Map<string, (typeof combined)[number]>();
    for (const r of combined) {
      if (!uniqueById.has(r.receptorId)) {
        uniqueById.set(r.receptorId, r);
      }
    }
    return Array.from(uniqueById.values()).sort(
      (a, b) => b.totalDepositedHeavyMetalsAndPcbUgM2 - a.totalDepositedHeavyMetalsAndPcbUgM2
    );
  }, [puff24h.receptorSummaries, puff24h.streetPointSummaries]);

  const receptorsExceeding24hDustDanger = useMemo(
    () =>
      allReceptors24hDustSorted.filter(
        (r) => r.totalDepositedHeavyMetalsAndPcbUgM2 >= dustDepositionDangerThresholdUgM2
      ),
    [allReceptors24hDustSorted, dustDepositionDangerThresholdUgM2]
  );

  const handleLog24hDustDepositionDangerObservation = useCallback(
    async (
      targetReceptor: (typeof allReceptors24hDustSorted)[number],
      triggerMode: 'AUTOMATISK' | 'MANUEL'
    ) => {
      const peakHrWeather =
        weatherDataset.hours[targetReceptor.peakHourIndex] || currentWeather;
      const corroboration = evaluatePointInDispersionPlume(
        targetReceptor.position,
        sources,
        peakHrWeather,
        `24t Kumulativ Støv-Deponering Fare-Alarm (≥ ${dustDepositionDangerThresholdUgM2} µg/m²)`
      );
      const excessPct = Math.round(
        ((targetReceptor.totalDepositedHeavyMetalsAndPcbUgM2 -
          dustDepositionDangerThresholdUgM2) /
          Math.max(1, dustDepositionDangerThresholdUgM2)) *
          100
      );
      const code = `STØV-FARE-${String(observations.length + 1).padStart(2, '0')}`;
      const description = `[${triggerMode} ALGEDONISK FARE-ALARM · 24T KUMULATIV STØV-DEPONERING] Receptor ${targetReceptor.receptorCode} (${targetReceptor.receptorName}, ${targetReceptor.address}) har akkumuleret ${targetReceptor.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)} µg/m² tungmetal- og PCB-holdigt nedrivningsstøv over 24 timer (${weatherDataset.dateIso}), hvilket overskrider fare-grænsen på ${dustDepositionDangerThresholdUgM2} µg/m² med +${excessPct}% (+${(targetReceptor.totalDepositedHeavyMetalsAndPcbUgM2 - dustDepositionDangerThresholdUgM2).toFixed(1)} µg/m²). Spidsbelastning kl. ${targetReceptor.peakHourLabel} (S_max = ${targetReceptor.peakSumQuotient.toFixed(2)}, 24t kumulativ dosis = ${targetReceptor.cumulativeSumDose.toFixed(2)} S·t, asbestdeponering = ${targetReceptor.totalDepositedAsbestosFibersM2.toLocaleString('da-DK')} fibre/m²). Primær kilde: ${targetReceptor.nearestSourceName} (${targetReceptor.distanceToNearestSourceMeters} m).`;

      const signature = await computeForensicSha256Hash({
        code,
        triggerMode,
        dateIso: weatherDataset.dateIso,
        receptorId: targetReceptor.receptorId,
        receptorCode: targetReceptor.receptorCode,
        totalDepositedDustUgM2: targetReceptor.totalDepositedHeavyMetalsAndPcbUgM2,
        dangerThresholdUgM2: dustDepositionDangerThresholdUgM2,
        peakHourLabel: targetReceptor.peakHourLabel,
        cumulativeSumDose: targetReceptor.cumulativeSumDose,
      });

      const newObs: AlgedonicObservation = {
        id: `obs-dust-danger-${weatherDataset.dateIso}-${targetReceptor.receptorId}-${Date.now()}`,
        code,
        createdAtIso: new Date().toISOString(),
        observedDateIso: weatherDataset.dateIso,
        observedHourIndex: targetReceptor.peakHourIndex,
        observedHourLabel: targetReceptor.peakHourLabel,
        observedTimestampIso: peakHrWeather.isoTime,
        position: targetReceptor.position,
        locationLabel: `${targetReceptor.receptorCode}: ${targetReceptor.receptorName} (${targetReceptor.address})`,
        reporterRole: obsReporterRole,
        reporterIdentifier:
          triggerMode === 'AUTOMATISK'
            ? 'Automatisk 24t Støv-Deponerings Alarm-Vagt (µg/m²)'
            : obsReporterId.trim() || obsReporterRole,
        observationType: `⚠ 24t Støv-Deponering Fare-Alarm: ${targetReceptor.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)} µg/m² (Grænse ${dustDepositionDangerThresholdUgM2} µg/m²)`,
        description,
        weatherSnapshot: peakHrWeather,
        plumeCorroboration: corroboration,
        sha256Signature: signature,
      };

      setObservations((prev) => [newObs, ...prev]);
      setSelectedObservationId(newObs.id);
      setLastAutoLoggedDustAlertCode(code);
    },
    [
      weatherDataset.hours,
      weatherDataset.dateIso,
      currentWeather,
      sources,
      dustDepositionDangerThresholdUgM2,
      observations.length,
      obsReporterRole,
      obsReporterId,
    ]
  );

  // Automatically trigger and append to the Algedonic observation log when the 24-hour cumulative dust-deposition (µg/m²) at any receptor exceeds the 'danger' threshold
  useEffect(() => {
    if (!autoLogDustDangerToAlgedonic) return;
    if (receptorsExceeding24hDustDanger.length === 0) return;

    const topExceeding = receptorsExceeding24hDustDanger[0];
    const dedupeKey = `${weatherDataset.dateIso}::${topExceeding.receptorId}::${dustDepositionDangerThresholdUgM2}`;
    if (loggedDustDangerKeysRef.current.has(dedupeKey)) return;

    loggedDustDangerKeysRef.current.add(dedupeKey);
    void handleLog24hDustDepositionDangerObservation(topExceeding, 'AUTOMATISK');
  }, [
    autoLogDustDangerToAlgedonic,
    receptorsExceeding24hDustDanger,
    weatherDataset.dateIso,
    dustDepositionDangerThresholdUgM2,
    handleLog24hDustDepositionDangerObservation,
  ]);

  // Update cryptographic SHA-256 Proof-of-State hash whenever telemetry, simulation, indoor climate exceedances, or observations change
  useEffect(() => {
    let cancelled = false;
    computeForensicSha256Hash({
      dateIso: weatherDataset.dateIso,
      hour: currentWeather.isoTime,
      weather: currentWeather,
      maxSiteSumQuotient,
      indoorClimateProofOfState: {
        indoorSumQuotientSin: indoorClimateTelemetry.indoorSumQuotientSin,
        deltaPCavPa: indoorClimateTelemetry.deltaPCavPa,
        zNplEffectiveMeters: indoorClimateTelemetry.zNplEffectiveMeters,
        ppvFoundationMmPerSec: indoorClimateTelemetry.ppvFoundationMmPerSec,
        degradedPermeabilityQ75DegM3PerHm2:
          indoorClimateTelemetry.degradedPermeabilityQ75DegM3PerHm2,
        indoorAsbestosFibrePerCm3:
          indoorClimateTelemetry.indoorAsbestosFibrePerCm3,
      },
      peak24hReceptor: puff24h.peakReceptor.receptorId,
      peak24hAddress: puff24h.peakReceptor.address,
      peak24hDose: puff24h.peakReceptor.cumulativeSumDose,
      peak24hHour: puff24h.peakReceptor.peakHourLabel,
      violationsCount: legalViolations.length,
      algedonicObservationsCount: observations.length,
      algedonicSignatures: observations.map((o) => o.sha256Signature),
    }).then((hash) => {
      if (!cancelled) setSha256Hash(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [
    weatherDataset.dateIso,
    currentWeather,
    maxSiteSumQuotient,
    indoorClimateTelemetry,
    puff24h,
    legalViolations.length,
    observations,
  ]);

  // Trigger Google Maps Grounding Analysis
  const runMapsGroundingAnalysis = useCallback(async () => {
    setIsLoadingGrounding(true);
    setGroundingError(null);
    try {
      const plumeVectorDeg = (currentWeather.windDirection10m + 180) % 360;
      const affectedZones = receptorExposures
        .filter((r) => r.sumQuotient >= 0.25)
        .map((r) => `${r.receptorName} (${r.address}, S=${r.sumQuotient.toFixed(2)})`);

      const res = await fetch('/api/forensic-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windDirectionDeg: currentWeather.windDirection10m,
          plumeVectorDeg,
          windSpeedMs: currentWeather.windSpeed10m,
          windGustsMs: currentWeather.windGusts10m,
          temperatureC: currentWeather.temperature2m,
          precipitationMm: currentWeather.precipitation,
          stabilityClass: currentWeather.pasquillClass,
          maxSumQuotient: maxSiteSumQuotient,
          isPuffMode,
          peakReceptorName: `${puff24h.peakReceptor.receptorName} (${puff24h.peakReceptor.address})`,
          peakReceptorHour: puff24h.peakReceptor.peakHourLabel,
          peakReceptorDose: puff24h.peakReceptor.cumulativeSumDose,
          affectedZones,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setGroundingError(data.error || 'Kunne ikke hente Google Maps Grounding analyse.');
      } else {
        setGroundingAnalysis(data.text || '');
        setGroundingPlaces(Array.isArray(data.places) ? data.places : []);
      }
    } catch (err) {
      setGroundingError(
        err instanceof Error ? err.message : 'Netværksfejl ved Google Maps Grounding kald.'
      );
    } finally {
      setIsLoadingGrounding(false);
    }
  }, [currentWeather, receptorExposures, maxSiteSumQuotient, isPuffMode, puff24h]);

  // Run initial Maps Grounding check on mount
  useEffect(() => {
    runMapsGroundingAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle adding a custom source, receptor, or physical observation point when clicking on the map
  const handleMapAddNode = useCallback(
    (pt: LatLngPoint, type: 'source' | 'receptor' | 'observation') => {
      if (type === 'observation') {
        setPendingObservationPoint(pt);
        setObsLocationLabel(
          `Kortpunkt i Ringparken (${pt.lat.toFixed(4)}°N, ${pt.lng.toFixed(4)}°E)`
        );
        setActiveTab('algedonic');
        setMapClickMode('none');
        return;
      }

      if (type === 'source') {
        const idx = sources.filter((s) => s.isCustom).length + 1;
        const newId = `src-custom-${Date.now()}`;
        const footprint = [
          offsetLatLngByMeters(pt, 12, -12),
          offsetLatLngByMeters(pt, 12, 12),
          offsetLatLngByMeters(pt, -12, 12),
          offsetLatLngByMeters(pt, -12, -12),
        ];
        const newSource: DemolitionSourceNode = {
          id: newId,
          code: `KILDE-U${idx}`,
          name: `Brugerdefineret Kilde #${idx}`,
          address: `GPS ${pt.lat.toFixed(4)}°N, ${pt.lng.toFixed(4)}°E (4200 Slagelse)`,
          position: pt,
          footprint,
          releaseHeightMeters: 6,
          substances: ['asbestos', 'pcb', 'heavyMetals', 'quartzWool'],
          substanceDetails: {
            asbestos: 'Brugerdefineret asbest-/nedrivningspunkt',
            pcb: 'Brugerdefineret PCB-kilde',
            heavyMetals: 'Bly- og tungmetalholdigt støv',
            quartzWool: 'Respirabelt kvartsstøv',
            moldSewer: 'Lokal jord-/skimmelkilde',
          },
          pssReference: 'Brugeroprettet Punkt-Kilde i Ringparken',
          isCustom: true,
          active: true,
        };
        setCustomSources((prev) => [...prev, newSource]);
        setSelectedSourceId(newId);
      } else {
        const idx = receptors.filter((r) => r.isCustom).length + 1;
        const newId = `rec-custom-${Date.now()}`;
        const polygon = [
          offsetLatLngByMeters(pt, 16, -16),
          offsetLatLngByMeters(pt, 16, 16),
          offsetLatLngByMeters(pt, -16, 16),
          offsetLatLngByMeters(pt, -16, -16),
        ];
        const newRec: ReceptorZone = {
          id: newId,
          code: `MÅL-U${idx}`,
          name: `Brugerdefineret Målepunkt #${idx}`,
          category: 'custom_receptor',
          address: `GPS ${pt.lat.toFixed(4)}°N, ${pt.lng.toFixed(4)}°E (Ringparken)`,
          center: pt,
          polygon,
          vulnerableGroupNote: 'Brugerplaceret retsmedicinsk målepunkt / receptor',
          isCustom: true,
        };
        setCustomReceptors((prev) => [...prev, newRec]);
        setSelectedReceptorId(newId);
      }
      setMapClickMode('none');
    },
    [sources, receptors]
  );

  const handleChangeBuildingCategory = useCallback(
    (buildingId: string, nextCategory: BuildingOperationalCategory) => {
      setBuildings((prev) =>
        prev.map((b) => (b.id === buildingId ? { ...b, category: nextCategory } : b))
      );
      setSelectedBuildingId(buildingId);
      const meta = BUILDING_CATEGORY_METADATA[nextCategory];
      if (meta.actsAsSource) {
        setSelectedSourceId(getSourceIdForBuilding(buildingId));
      }
      if (meta.actsAsReceptor) {
        setSelectedReceptorId(getReceptorIdForBuilding(buildingId));
      }
    },
    []
  );

  const handleToggleCategoryFilter = useCallback(
    (cat: BuildingOperationalCategory) => {
      setActiveCategoryFilters((prev) =>
        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
      );
    },
    []
  );

  const handleResetCategoryFilters = useCallback(() => {
    setActiveCategoryFilters([
      'a_inhabited',
      'b_vacant',
      'c_under_renovation',
      'd_under_demolition',
      'e_demolished_unsecured',
    ]);
  }, []);

  const handleApplyBatchBuildingScenario = useCallback(
    (
      updater: (prev: RingparkenBuildingUnit[]) => RingparkenBuildingUnit[],
      focusBuildingId?: string
    ) => {
      setBuildings((prev) => updater(prev));
      if (focusBuildingId) {
        setSelectedBuildingId(focusBuildingId);
        setSelectedSourceId(getSourceIdForBuilding(focusBuildingId));
      }
    },
    []
  );

  const toggleSourceActive = useCallback((id: string) => {
    if (id.startsWith('src-custom-')) {
      setCustomSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
      );
      return;
    }
    setSourceOverrides((prev) => {
      const curr = prev[id]?.active ?? true;
      return {
        ...prev,
        [id]: { ...prev[id], active: !curr },
      };
    });
  }, []);

  const [isSourceReceptorModalOpen, setIsSourceReceptorModalOpen] = useState<boolean>(false);

  const handleSetAllSourcesActive = useCallback(
    (active: boolean) => {
      const keepId = selectedSourceId || sources[0]?.id || 'src-blok-1';
      setCustomSources((prev) =>
        prev.map((s) => ({ ...s, active: active ? true : s.id === keepId }))
      );
      setSourceOverrides((prev) => {
        const next = { ...prev };
        sources.forEach((s) => {
          if (!s.id.startsWith('src-custom-')) {
            next[s.id] = { ...next[s.id], active: active ? true : s.id === keepId };
          }
        });
        return next;
      });
    },
    [selectedSourceId, sources]
  );

  const handleIsolateNearbyMachinery = useCallback(() => {
    const mainPts =
      waterMainTelemetry.coordinateMode === 'dar_verified_wgs84'
        ? waterMainTelemetry.darSegments.flatMap((s) => s.waypoints)
        : waterMainTelemetry.sceneSegments.flatMap((s) => s.waypoints);

    const nearbyIds = new Set<string>();
    sources.forEach((src) => {
      if (!src.active) return;
      const closest = closestPointOnPolyline(src.position, mainPts);
      if (closest.distanceMeters <= 65) {
        nearbyIds.add(src.id);
      }
    });
    if (nearbyIds.size === 0) {
      const firstActive = sources.find((s) => s.active);
      if (firstActive) nearbyIds.add(firstActive.id);
    }
    setCustomSources((prev) =>
      prev.map((s) => (nearbyIds.has(s.id) ? { ...s, active: false } : s))
    );
    setSourceOverrides((prev) => {
      const next = { ...prev };
      sources.forEach((s) => {
        if (!s.id.startsWith('src-custom-') && nearbyIds.has(s.id)) {
          next[s.id] = { ...next[s.id], active: false };
        }
      });
      return next;
    });
  }, [sources, waterMainTelemetry]);

  const handleRestoreAllMachinery = useCallback(() => {
    setCustomSources((prev) => prev.map((s) => ({ ...s, active: true })));
    setSourceOverrides((prev) => {
      const next = { ...prev };
      sources.forEach((s) => {
        if (!s.id.startsWith('src-custom-')) {
          next[s.id] = { ...next[s.id], active: true };
        }
      });
      return next;
    });
  }, [sources]);

  // Stable memoized callbacks for DispersionMap (prevents React.memo invalidation when timeline slider moves)
  const handleSelectMapObservation = useCallback((obs: AlgedonicObservation) => {
    setSelectedObservationId(obs.id);
    setSelectedHourIndex(obs.observedHourIndex);
    setActiveTab('algedonic');
  }, []);

  const handleSelectMapObservationModal = useCallback((obs: AlgedonicObservation) => {
    setSelectedObservationId(obs.id);
    setSelectedHourIndex(obs.observedHourIndex);
  }, []);

  const handleSelectMapSource = useCallback((id: string) => {
    setSelectedSourceId(id);
    setActiveTab('substances');
  }, []);

  const handleSelectMapSourceModal = useCallback((id: string) => {
    setSelectedSourceId(id);
  }, []);

  const handleSelectMapReceptor = useCallback((id: string) => {
    setSelectedReceptorId(id);
  }, []);

  const handleSetMapClickModeFromMap = useCallback(
    (mode: 'none' | 'add_source' | 'add_receptor' | 'add_observation') => {
      setMapClickMode(mode);
      if (mode === 'add_observation') {
        setActiveTab('algedonic');
      }
    },
    []
  );

  const handleSelectHourFromPeak = useCallback((hr: number) => {
    setSelectedHourIndex(hr);
    setPlumeRouteProgress(hr);
  }, []);

  const handleToggleHeatmapComparison = useCallback(
    () => setShowHeatmapComparison((v) => !v),
    []
  );
  const handleToggleFullscreen3D = useCallback(() => setIsFullscreen3D((v) => !v), []);
  const handleToggleMapOnlyMode = useCallback(() => setIsMapOnlyMode((v) => !v), []);
  const handleToggleWindNoiseHeatmapFromMap = useCallback((next?: boolean) => {
    setShowWindNoiseHeatmapLayer((prev) => (next !== undefined ? next : !prev));
  }, []);
  const handleTogglePlumeConcentrationHeatmapFromMap = useCallback((next?: boolean) => {
    setShowPlumeConcentrationHeatmap((prev) => (next !== undefined ? next : !prev));
  }, []);
  const handleToggleWeatherCorrelationHeatmapFromMap = useCallback((next?: boolean) => {
    setShowWeatherCorrelationHeatmapLayer((prev) => (next !== undefined ? next : !prev));
  }, []);
  const handleToggleLerBuffer = useCallback(() => setShowLerBuffer((v) => !v), []);
  const handleToggleSteelRoadPlates = useCallback(() => setHasSteelRoadPlates((v) => !v), []);
  const handleToggleSimulatedPipeRupture = useCallback(
    () => setSimulatedPipeRuptureActive((v) => !v),
    []
  );
  const handleToggleS3ValveLockout = useCallback(() => setIsS3ValveLockoutActive((v) => !v), []);
  const handleOpenSimultaneousModal = useCallback(() => {
    simultaneousAlgedonic.setIsSplitModalOpen(true);
  }, [simultaneousAlgedonic.setIsSplitModalOpen]);

  // Interactive source parameter handlers for the 3D Asbestos-Fiber Dispersion Heatmap
  const [asbestosHeatmapActive, setAsbestosHeatmapActive] = useState<boolean>(true);
  const [temporal24hAsbestosAccumulation, setTemporal24hAsbestosAccumulation] =
    useState<boolean>(false);
  const [showLeewardWakeEffect, setShowLeewardWakeEffect] = useState<boolean>(true);
  const [showWeatherCorrelationOverlay, setShowWeatherCorrelationOverlay] =
    useState<boolean>(true);
  const [asbestosSourceScope, setAsbestosSourceScope] = useState<
    'all_active' | 'selected_source'
  >('all_active');
  const [asbestosEvalHeightMeters, setAsbestosEvalHeightMeters] = useState<number>(1.5);

  const updateSourceReleaseHeight = useCallback((id: string, releaseHeightMeters: number) => {
    const clamped = Math.max(1, Math.min(28, releaseHeightMeters));
    if (id.startsWith('src-custom-')) {
      setCustomSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, releaseHeightMeters: clamped } : s))
      );
      return;
    }
    setSourceOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], releaseHeightMeters: clamped },
    }));
  }, []);

  const updateSourceFiberReleaseIndex = useCallback((id: string, fiberReleaseIndex: number) => {
    const clamped = Number(Math.max(0.05, Math.min(2.0, fiberReleaseIndex)).toFixed(2));
    if (id.startsWith('src-custom-')) {
      setCustomSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, fiberReleaseIndex: clamped } : s))
      );
      return;
    }
    setSourceOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], fiberReleaseIndex: clamped },
    }));
  }, []);

  const toggleSourceAsbestosSubstance = useCallback(
    (id: string) => {
      const target = sources.find((s) => s.id === id);
      if (!target) return;
      const hasAsbestos = target.substances.includes('asbestos');
      const nextSubstances = hasAsbestos
        ? target.substances.filter((k) => k !== 'asbestos')
        : (['asbestos', ...target.substances] as SubstanceKey[]);

      if (id.startsWith('src-custom-')) {
        setCustomSources((prev) =>
          prev.map((s) => (s.id === id ? { ...s, substances: nextSubstances } : s))
        );
        return;
      }
      setSourceOverrides((prev) => ({
        ...prev,
        [id]: { ...prev[id], substances: nextSubstances },
      }));
    },
    [sources]
  );

  const updateSourceBaseLwaDb = useCallback((id: string, nextLwaDb: number) => {
    const clamped = Number(Math.max(58, Math.min(134, nextLwaDb)).toFixed(1));
    if (id.startsWith('src-custom-')) {
      setCustomSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, baseSoundPowerLwaDb: clamped } : s))
      );
      return;
    }
    setSourceOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], baseSoundPowerLwaDb: clamped },
    }));
  }, []);

  const resetSourceBaseLwaDb = useCallback(
    (id: string) => {
      const target = sources.find((s) => s.id === id);
      const defaultLwa = getDefaultSourceBaseLwaDb(id, target?.buildingCategory);
      if (id.startsWith('src-custom-')) {
        setCustomSources((prev) =>
          prev.map((s) => (s.id === id ? { ...s, baseSoundPowerLwaDb: defaultLwa } : s))
        );
        return;
      }
      setSourceOverrides((prev) => {
        const next = { ...prev };
        if (next[id]) {
          const { baseSoundPowerLwaDb: _removed, ...rest } = next[id];
          next[id] = rest;
        }
        return next;
      });
    },
    [sources]
  );

  const [csvExportSuccess, setCsvExportSuccess] = useState(false);
  const [auditLogJsonExportSuccess, setAuditLogJsonExportSuccess] = useState(false);
  const [selectedViolationIdsForAi, setSelectedViolationIdsForAi] = useState<string[]>([]);
  const [violationAiRequest, setViolationAiRequest] = useState<{
    requestId: number;
    violations: LegalViolationEntry[];
    preferredRole?: ExpertPersonaRole;
  } | null>(null);
  const [municipalLegalSummary, setMunicipalLegalSummary] = useState<{
    headline: string;
    summaryText: string;
    municipalLegalBases: string[];
    demandedMunicipalActions: string[];
    modelUsed: string;
    generatedAtLabel: string;
  } | null>(null);
  const [isGeneratingMunicipalSummary, setIsGeneratingMunicipalSummary] = useState(false);
  const [municipalSummaryCopied, setMunicipalSummaryCopied] = useState(false);
  const [violationsCsvExportSuccess, setViolationsCsvExportSuccess] = useState(false);
  const [showViolationsCsvTable, setShowViolationsCsvTable] = useState(true);
  const [violationsCsvCopied, setViolationsCsvCopied] = useState(false);
  const [chainOfCustodyPdfExportSuccess, setChainOfCustodyPdfExportSuccess] = useState(false);
  const [chronologicalPdfExportSuccess, setChronologicalPdfExportSuccess] = useState(false);
  const [isGeneratingChronologicalPdf, setIsGeneratingChronologicalPdf] = useState(false);
  const [pdfWidgetCsvExportSuccess, setPdfWidgetCsvExportSuccess] = useState(false);
  const [directForensicPdfExportSuccess, setDirectForensicPdfExportSuccess] = useState(false);
  const [showObservationChainOfCustodyLog, setShowObservationChainOfCustodyLog] = useState(false);
  const [obsChainImmutabilityVerifiedAt, setObsChainImmutabilityVerifiedAt] = useState<string>('');
  const [acousticRefractionPdfBanner, setAcousticRefractionPdfBanner] = useState<string | null>(
    null
  );

  const getFilteredExportContext = useCallback(() => {
    const f = exportFilterRef.current;
    if (!f.enabled) {
      return {
        isFiltered: false,
        filterSummary: undefined as string | undefined,
        selectedSubstances: [
          'asbestos',
          'pcb',
          'heavyMetals',
          'quartzWool',
          'moldSewer',
        ] as SubstanceKey[],
        receptors,
        receptorExposures,
        observations,
        legalViolations,
        simulation,
        maxSiteSumQuotient,
      };
    }

    const startIso = f.startDateIso <= f.endDateIso ? f.startDateIso : f.endDateIso;
    const endIso = f.startDateIso <= f.endDateIso ? f.endDateIso : f.startDateIso;
    const hasReceptorSubset = f.receptorIds.length > 0 && f.receptorIds.length < receptors.length;
    const receptorIdSet = new Set(hasReceptorSubset ? f.receptorIds : receptors.map((r) => r.id));
    const selectedSubstances: SubstanceKey[] =
      f.substances.length > 0
        ? f.substances
        : ['asbestos', 'pcb', 'heavyMetals', 'quartzWool', 'moldSewer'];
    const substanceSet = new Set<SubstanceKey>(selectedSubstances);
    const hasSubstanceSubset = selectedSubstances.length < 5;

    const filteredReceptors = receptors.filter((r) => receptorIdSet.has(r.id));
    const filteredExposures = receptorExposures
      .filter((exp) => receptorIdSet.has(exp.receptorId))
      .map((exp) => {
        if (!hasSubstanceSubset) return exp;
        const keptSubstances = exp.substances.filter((s) => substanceSet.has(s.key));
        const recomputedSum = Number(
          keptSubstances.reduce((acc, s) => acc + s.quotient, 0).toFixed(4)
        );
        const recomputedRisk: typeof exp.riskLevel =
          recomputedSum >= 1.0
            ? 'red'
            : recomputedSum >= 0.5
            ? 'orange'
            : recomputedSum >= 0.25
            ? 'yellow'
            : exp.hydrologicalRunoffActive
            ? 'blue'
            : 'safe';
        return {
          ...exp,
          substances: keptSubstances,
          sumQuotient: recomputedSum,
          riskLevel: recomputedRisk,
        };
      });

    const filteredObservations = observations.filter((obs) => {
      if (obs.observedDateIso < startIso || obs.observedDateIso > endIso) {
        return false;
      }
      if (!hasReceptorSubset) return true;
      const labelLower = obs.locationLabel.toLowerCase();
      return filteredReceptors.some(
        (r) =>
          labelLower.includes(r.code.toLowerCase()) ||
          labelLower.includes(r.name.toLowerCase()) ||
          labelLower.includes(r.address.split(',')[0].toLowerCase())
      );
    });

    const substanceKeywords: Record<SubstanceKey, string[]> = {
      asbestos: ['asbest', 'fibre', 'fiber', 'bek 613'],
      pcb: ['pcb', 'bifenyl'],
      heavyMetals: ['bly', 'tungmetal', 'chrom', 'zink', 'cadmium'],
      quartzWool: ['kvarts', 'mineraluld', 'stenuld', 'glasuld'],
      moldSewer: ['skimmel', 'kloak', 'cfu'],
    };

    const filteredViolations = legalViolations.filter((v) => {
      const tsDate = v.timestampIso?.slice(0, 10);
      const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(tsDate) ? tsDate : weatherDataset.dateIso;
      if (effectiveDate < startIso || effectiveDate > endIso) {
        return false;
      }
      if (hasReceptorSubset) {
        const recMatch = filteredReceptors.some(
          (r) =>
            v.receptorName.toLowerCase().includes(r.name.toLowerCase()) ||
            v.receptorName.toLowerCase().includes(r.code.toLowerCase()) ||
            v.receptorAddress.toLowerCase().includes(r.address.split(',')[0].toLowerCase())
        );
        if (!recMatch) return false;
      }
      if (hasSubstanceSubset && v.legalBasisCategory !== 'MST_NOISE_LIMITS') {
        const text = `${v.statuteTitle} ${v.technicalEvidence} ${v.legalConsequence}`.toLowerCase();
        const matchesSub = selectedSubstances.some((subKey) =>
          substanceKeywords[subKey].some((kw) => text.includes(kw))
        );
        if (!matchesSub) return false;
      }
      return true;
    });

    const filteredMaxS =
      filteredExposures.length > 0
        ? Math.max(...filteredExposures.map((e) => e.sumQuotient))
        : 0;
    const filteredWorst =
      filteredExposures.length > 0
        ? [...filteredExposures].sort((a, b) => b.sumQuotient - a.sumQuotient)[0]
        : simulation.worstExposedReceptor;

    const filteredSimulation: DispersionSimulationState = {
      ...simulation,
      receptorExposures: filteredExposures,
      legalViolations: filteredViolations,
      maxSiteSumQuotient: filteredMaxS,
      worstExposedReceptor: filteredWorst,
    };

    const filterSummary = `Periode ${startIso}..${endIso} | ${filteredReceptors.length}/${receptors.length} receptorer | Stoffer: ${selectedSubstances
      .map((k) => SUBSTANCE_SPECS[k].shortName)
      .join(', ')}`;

    return {
      isFiltered: true,
      filterSummary,
      selectedSubstances,
      receptors: filteredReceptors,
      receptorExposures: filteredExposures,
      observations: filteredObservations,
      legalViolations: filteredViolations,
      simulation: filteredSimulation,
      maxSiteSumQuotient: filteredMaxS,
    };
  }, [
    receptors,
    receptorExposures,
    observations,
    legalViolations,
    simulation,
    maxSiteSumQuotient,
    weatherDataset.dateIso,
  ]);

  const observationChainOfCustodyLedger = useMemo(
    () =>
      buildChainOfCustodyVerificationEntries({
        pdfArchive: [],
        observations,
        dateIso: weatherDataset.dateIso,
        hourLabel: currentWeather.hourLabel,
        maxSiteSumQuotient,
        sha256Hash,
      }),
    [observations, weatherDataset.dateIso, currentWeather.hourLabel, maxSiteSumQuotient, sha256Hash]
  );

  const handleExportChainOfCustodyPdfReport = useCallback(() => {
    const ctx = getFilteredExportContext();
    generateForensicChainOfCustodyPdfReport({
      pdfArchive: [],
      observations: ctx.observations,
      dateIso: weatherDataset.dateIso,
      hourLabel: currentWeather.hourLabel,
      maxSiteSumQuotient: ctx.maxSiteSumQuotient,
      sha256Hash,
    });
    setChainOfCustodyPdfExportSuccess(true);
    window.setTimeout(() => setChainOfCustodyPdfExportSuccess(false), 4000);
  }, [getFilteredExportContext, weatherDataset.dateIso, currentWeather.hourLabel, sha256Hash]);

  const handleExportChronologicalEvidencePdfReport = useCallback(() => {
    const ctx = getFilteredExportContext();
    setIsGeneratingChronologicalPdf(true);
    setChronologicalPdfExportSuccess(false);
    window.setTimeout(() => {
      generateChronologicalEvidenceObservationsPdfReport({
        observations: ctx.observations,
        pdfArchive: [],
        dateIso: weatherDataset.dateIso,
        hourLabel: currentWeather.hourLabel,
        maxSiteSumQuotient: ctx.maxSiteSumQuotient,
        sha256Hash,
      });
      setIsGeneratingChronologicalPdf(false);
      setChronologicalPdfExportSuccess(true);
      window.setTimeout(() => setChronologicalPdfExportSuccess(false), 4500);
    }, 360);
  }, [getFilteredExportContext, weatherDataset.dateIso, currentWeather.hourLabel, sha256Hash]);

  const handleDirectExportForensicAppendixPdf = useCallback(() => {
    const ctx = getFilteredExportContext();
    setIsGeneratingChronologicalPdf(true);
    setDirectForensicPdfExportSuccess(false);
    window.setTimeout(() => {
      generateForensicPdfReport({
        weatherDataset,
        simulation: ctx.simulation,
        sources,
        receptors: ctx.receptors,
        observations: ctx.observations,
        isPuffMode,
        sha256Hash,
        groundingPlaces,
        exportFilterSummary: ctx.filterSummary,
        validatePhotoEvidenceBinary,
      });
      setIsGeneratingChronologicalPdf(false);
      setDirectForensicPdfExportSuccess(true);
      window.setTimeout(() => setDirectForensicPdfExportSuccess(false), 4500);
    }, 320);
  }, [
    getFilteredExportContext,
    weatherDataset,
    sources,
    isPuffMode,
    sha256Hash,
    groundingPlaces,
    validatePhotoEvidenceBinary,
  ]);

  const handleExportPdfWidgetStatsCsv = useCallback(() => {
    const ctx = getFilteredExportContext();
    const obsList = ctx.observations;
    const photosCount = obsList.filter((o) => Boolean(o.photoEvidence)).length;
    const pdfsCount = obsList.filter((o) => Boolean(o.pdfEvidence)).length;
    const physicalSignalsCount = obsList.filter(
      (o) => !o.photoEvidence && !o.pdfEvidence
    ).length;
    const totalSha256Count = obsList.length;
    const latestSha256 = obsList[0]?.sha256Signature || sha256Hash;
    const merkleRoot = observationChainOfCustodyLedger.merkleRootSignature;
    const sStatus = ctx.maxSiteSumQuotient >= 1.0 ? 'OVERSKREDET (S >= 1.0)' : 'OK (S < 1.0)';
    const catDCount = buildings.filter((b) => b.category === 'd_under_demolition').length;
    const catECount = buildings.filter((b) => b.category === 'e_demolished_unsecured').length;
    const estimatedL69PenaltyDkk =
      (catDCount + catECount) * 165000 + (ctx.maxSiteSumQuotient >= 1.0 ? 250000 : 80000);

    const csvHeaders = [
      'Dato_ISO',
      'Klokkeslaet',
      'Fotos_Antal',
      'PDF_Beviser_Antal',
      'Fysiske_Signaler_Antal',
      'Total_SHA256_Beviser',
      'L69_Estimeret_Boederisiko_DKK',
      'Aktive_Kat_D_Under_Nedrivning',
      'Aktive_Kat_E_Uforseglede_Felter',
      'Maks_Sumkvotient_S',
      'Lovgraense_S_Status',
      'Seneste_SHA256_Signatur',
      'Merkle_Root_Signatur',
      'System_Status',
    ];
    const csvRow = [
      weatherDataset.dateIso,
      currentWeather.hourLabel,
      String(photosCount),
      String(pdfsCount),
      String(physicalSignalsCount),
      String(totalSha256Count),
      String(estimatedL69PenaltyDkk),
      String(catDCount),
      String(catECount),
      ctx.maxSiteSumQuotient.toFixed(3),
      `"${sStatus}"`,
      `"${latestSha256}"`,
      `"${merkleRoot}"`,
      ctx.filterSummary
        ? `"Filtreret: ${ctx.filterSummary.replace(/"/g, "'")}"`
        : '"Klar til eksport · Verificeret (ISO/IEC 27037)"',
    ];

    const csvContent = `\uFEFF${csvHeaders.join(',')}\n${csvRow.join(',')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retsmedicinsk_bilag_statistik_${weatherDataset.dateIso}${
      ctx.isFiltered ? '_filtreret' : ''
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setPdfWidgetCsvExportSuccess(true);
    window.setTimeout(() => setPdfWidgetCsvExportSuccess(false), 4000);
  }, [
    getFilteredExportContext,
    sha256Hash,
    observationChainOfCustodyLedger.merkleRootSignature,
    weatherDataset.dateIso,
    currentWeather.hourLabel,
    buildings,
  ]);

  const handlePrintPdfWidgetAppendix = useCallback(() => {
    document.body.classList.add('printing-pdf-widget-only');
    const cleanupPrintClass = () => {
      document.body.classList.remove('printing-pdf-widget-only');
      window.removeEventListener('afterprint', cleanupPrintClass);
    };
    window.addEventListener('afterprint', cleanupPrintClass);
    window.print();
    window.setTimeout(cleanupPrintClass, 1500);
  }, []);

  const handleExportAcousticDiagramAndDbValuesPdf = useCallback(() => {
    const ctx = getFilteredExportContext();
    const targetExposures =
      ctx.receptorExposures.length > 0 ? ctx.receptorExposures : receptorExposures;
    const activeSrc = sources.find((s) => s.active) || sources[0];
    const plumeDir = (currentWeather.windDirection10m + 180) % 360;
    const baseMachineryNoiseSourceDb = 84.5;
    const rows = targetExposures.map((recExp) => {
      const recObj = receptors.find((r) => r.id === recExp.receptorId) || receptors[0];
      const dx = (recObj.center.lng - activeSrc.position.lng) * 63700;
      const dy = (recObj.center.lat - activeSrc.position.lat) * 111320;
      const distM = Math.max(35, Math.round(Math.hypot(dx, dy)));
      const bearingDeg = Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360);
      const rawDiff = Math.abs(bearingDeg - plumeDir);
      const angleOffWindDeg = Math.round(rawDiff > 180 ? 360 - rawDiff : rawDiff);
      const cosAlign = Number(Math.cos((angleOffWindDeg * Math.PI) / 180).toFixed(2));
      const windRefrDb = Number((cosAlign * (currentWeather.windSpeed10m * 0.34)).toFixed(1));
      const tempRefrDb = Number(
        (currentWeather.pasquillClass === 'F' || currentWeather.pasquillClass === 'E' ? 1.2 : 0.3).toFixed(1)
      );
      const totalRefrDb = Number((windRefrDb + tempRefrDb).toFixed(1));
      const distAttenDb = Number((20 * Math.log10(Math.max(25, distM)) - 11).toFixed(1));
      const barrierAttenDb = Number(Math.max(2.0, 9.5 - Math.max(0, totalRefrDb) * 1.15).toFixed(1));
      const correctedLaeqDb = Number(
        (baseMachineryNoiseSourceDb - distAttenDb - barrierAttenDb + totalRefrDb).toFixed(1)
      );
      const impulsePeakLafmaxDb = Number(
        (correctedLaeqDb + 14.5 + Math.max(0, (currentWeather.windGusts10m - 8) * 0.45)).toFixed(1)
      );
      return {
        receptorId: recExp.receptorId,
        receptorCode: recObj.code,
        receptorName: recExp.receptorName,
        distanceMeters: distM,
        bearingDeg,
        angleOffWindDeg,
        cosAlign,
        windRefrDb,
        tempRefrDb,
        totalRefrDb,
        correctedLaeqDb,
        impulsePeakLafmaxDb,
        sumQuotient: recExp.sumQuotient,
        exceedsNoiseLimit: correctedLaeqDb > 55.0 || totalRefrDb > 3.0,
      };
    });
    const selectedRow =
      rows.find((r) => r.receptorId === selectedReceptorExposure.receptorId) || rows[0];
    generateAcousticRefractionDiagramPdfReport({
      dateIso: weatherDataset.dateIso,
      hourLabel: currentWeather.hourLabel,
      windSpeedMs: currentWeather.windSpeed10m,
      windGustsMs: currentWeather.windGusts10m,
      windDirectionDeg: currentWeather.windDirection10m,
      plumeDirectionDeg: plumeDir,
      temperatureC: currentWeather.temperature2m,
      pasquillClass: currentWeather.pasquillClass,
      windGradientDuDz: Number((currentWeather.windSpeed10m * 0.085).toFixed(3)),
      tempGradientDtDz: currentWeather.pasquillClass === 'F' ? 0.025 : -0.006,
      thermalRegimeLabel:
        currentWeather.pasquillClass === 'F' || currentWeather.pasquillClass === 'E'
          ? 'Stabil Inversion (Nedbøjning)'
          : 'Neutral / Konvektiv',
      speedOfSoundMs: Number((331.3 + 0.606 * currentWeather.temperature2m).toFixed(1)),
      rayCurvatureRadiusKm: Number(
        Math.max(1.8, 18 / Math.max(1, currentWeather.windSpeed10m)).toFixed(2)
      ),
      maxDownwindRefractionDb: Math.max(...rows.map((r) => r.totalRefrDb), 2.4),
      upwindShadowRefractionDb: Math.min(...rows.map((r) => r.totalRefrDb), -1.8),
      selectedSourceCode: activeSrc.code,
      selectedSourceName: activeSrc.name,
      selectedReceptorRow: selectedRow,
      receptorRows: rows,
      sha256Hash,
    });
    setAcousticRefractionPdfBanner(
      `Download Acoustic Diagram PDF & Download dB Values Report eksporteret (SHA-256: ${sha256Hash.slice(0, 16)}...)`
    );
    window.setTimeout(() => setAcousticRefractionPdfBanner(null), 6000);
  }, [
    getFilteredExportContext,
    sources,
    currentWeather,
    receptorExposures,
    receptors,
    selectedReceptorExposure.receptorId,
    weatherDataset.dateIso,
    sha256Hash,
  ]);

  const handleExportForensicAuditLogJson = useCallback(() => {
    downloadForensicDatabaseAuditLogJson({
      observations,
      weatherDataset,
      simulation,
      sources,
      receptors,
      sha256Hash,
    });
    setAuditLogJsonExportSuccess(true);
    window.setTimeout(() => setAuditLogJsonExportSuccess(false), 4000);
  }, [observations, weatherDataset, simulation, sources, receptors, sha256Hash]);

  const handleExportSelectedHourCsv = useCallback(() => {
    const ctx = getFilteredExportContext();
    const selectedSubstanceSet = new Set<SubstanceKey>(ctx.selectedSubstances);
    const escapeCsvCell = (val: string | number | boolean | undefined | null): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const plumeDirDeg = (currentWeather.windDirection10m + 180) % 360;
    const compassFrom = degreesToCompass(currentWeather.windDirection10m);

    const baseHeaders = [
      'Dato',
      'Klokkeslæt',
      'ISO_Tidspunkt',
      'Vejrkilde_Scenarie',
      'Vindhastighed_10m_ms',
      'Vindstød_10m_ms',
      'Vindretning_Fra_Grader',
      'Vindretning_Kompas',
      'Fane_Spredningsretning_Til_Grader',
      'Temperatur_2m_C',
      'Relativ_Luftfugtighed_pct',
      'Nedbør_mm_t',
      'Skydække_pct',
      'Jordfugtighed_0_7cm_m3m3',
      'Direkte_Solstråling_Wm2',
      'Pasquill_Stabilitetsklasse',
      'Frost_Tø_Cyklus',
      'Receptor_ID',
      'Receptor_Kode',
      'Receptor_Navn',
      'Adresse',
      'Kategori',
      'GPS_Lat',
      'GPS_Lng',
      'Afstand_Nærmeste_Kilde_m',
      'Dominerende_Kilde',
      'Sumkvotient_S_BEK613',
      'Risikozone',
      'Juridisk_Status_BEK613',
      'Hydrologisk_Udvaskning_Aktiv',
    ];

    const substanceHeaderColumns: Array<{ key: SubstanceKey; cols: string[] }> = [
      {
        key: 'asbestos',
        cols: ['Asbest_Konc_fibre_cm3', 'Asbest_2026_GV_fibre_cm3', 'Asbest_Kvotient_C_GV'],
      },
      {
        key: 'pcb',
        cols: ['PCB_Konc_mg_m3', 'PCB_2026_GV_mg_m3', 'PCB_Kvotient_C_GV'],
      },
      {
        key: 'heavyMetals',
        cols: [
          'Tungmetaller_Bly_Konc_mg_m3',
          'Tungmetaller_Bly_2026_GV_mg_m3',
          'Tungmetaller_Bly_Kvotient_C_GV',
        ],
      },
      {
        key: 'quartzWool',
        cols: [
          'Kvarts_MineralskUld_Konc_mg_m3',
          'Kvarts_MineralskUld_2026_GV_mg_m3',
          'Kvarts_MineralskUld_Kvotient_C_GV',
        ],
      },
      {
        key: 'moldSewer',
        cols: [
          'Skimmel_Kloak_Konc_CFU_m3',
          'Skimmel_Kloak_2026_GV_CFU_m3',
          'Skimmel_Kloak_Kvotient_C_GV',
        ],
      },
    ];

    const activeSubstanceHeaders = substanceHeaderColumns
      .filter((col) => selectedSubstanceSet.has(col.key))
      .flatMap((col) => col.cols);

    const headers = [...baseHeaders, ...activeSubstanceHeaders];

    const rows = ctx.receptorExposures.map((rec) => {
      const subMap = new Map(rec.substances.map((s) => [s.key, s]));

      const legalStatus =
        rec.sumQuotient >= 1.0
          ? 'KRITISK_OVERSKRIDELSE (S >= 1.0)'
          : rec.sumQuotient >= 0.5
          ? 'FORHØJET_RISIKO (0.5 <= S < 1.0)'
          : rec.sumQuotient >= 0.25
          ? 'OBSERVATIONSZONE (0.25 <= S < 0.5)'
          : 'UNDER_GRÆNSEVÆRDI (S < 0.25)';

      const baseCells = [
        weatherDataset.dateIso,
        currentWeather.hourLabel,
        currentWeather.isoTime,
        weatherDataset.isScenarioOverride && weatherDataset.scenarioName
          ? weatherDataset.scenarioName
          : weatherDataset.sourceApi,
        currentWeather.windSpeed10m,
        currentWeather.windGusts10m,
        currentWeather.windDirection10m,
        compassFrom,
        plumeDirDeg,
        currentWeather.temperature2m,
        currentWeather.relativeHumidity2m,
        currentWeather.precipitation,
        currentWeather.cloudCover,
        currentWeather.soilMoisture0To7cm,
        currentWeather.directRadiation,
        currentWeather.pasquillClass,
        currentWeather.hadRecentFreezeThaw ? 'Ja' : 'Nej',
        rec.receptorId,
        rec.receptorCode,
        rec.receptorName,
        rec.address,
        rec.category,
        rec.position.lat.toFixed(6),
        rec.position.lng.toFixed(6),
        rec.distanceFromNearestSourceMeters,
        rec.dominantSourceName,
        rec.sumQuotient.toFixed(4),
        rec.riskLevel.toUpperCase(),
        legalStatus,
        rec.hydrologicalRunoffActive ? 'Ja' : 'Nej',
      ];

      const substanceCells = substanceHeaderColumns
        .filter((col) => selectedSubstanceSet.has(col.key))
        .flatMap((col) => {
          const entry = subMap.get(col.key);
          return [
            entry ? entry.concentration : 0,
            entry ? entry.limitValue : SUBSTANCE_SPECS[col.key].limitValue2026,
            entry ? entry.quotient.toFixed(4) : '0.0000',
          ];
        });

      return [...baseCells, ...substanceCells].map(escapeCsvCell).join(';');
    });

    // Use semicolon delimiter with UTF-8 BOM for direct compatibility with Danish/European Excel & CSV tools
    const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanHour = currentWeather.hourLabel.replace(':', '');
    const filterSuffix = ctx.isFiltered ? '-filtreret' : '';
    link.href = url;
    link.setAttribute(
      'download',
      `ringparken-vejr-og-sumkvotienter-${weatherDataset.dateIso}-kl-${cleanHour}${filterSuffix}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCsvExportSuccess(true);
    window.setTimeout(() => setCsvExportSuccess(false), 2500);
  }, [currentWeather, weatherDataset, getFilteredExportContext]);

  // "Tilføj alle & Bulk Download" — validates Chain-of-Custody SHA-256 ledger completeness, signs & adds findings, and bulk-downloads full forensic bundle
  const handleAddAllAndBulkDownload = useCallback(
    async (rangeOverride?: RangeSimulationSummary | null) => {
      if (isBulkDownloading) return;
      setIsBulkDownloading(true);
      const waitMs = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

      try {
        const updatedObservations = await handleAddAllFindingsToEvidence();
        await waitMs(160);

        // Pre-Export Validation Step: cross-reference every SHA-256 signature in the Chain-of-Custody
        // ledger against the live state registry (master state, observations, photo binaries, and PDF archive)
        let registeredPdfArchive: ForensicPdfEvidence[] = [];
        try {
          const rawArchive = localStorage.getItem('ringparken_pdf_evidence_archive_v2_scratch');
          if (rawArchive) {
            const parsedArchive = JSON.parse(rawArchive);
            if (Array.isArray(parsedArchive)) {
              registeredPdfArchive = parsedArchive;
            }
          }
        } catch {
          registeredPdfArchive = [];
        }

        const effectiveMasterSha256 = /^[a-f0-9]{64}$/i.test(sha256Hash.trim())
          ? sha256Hash.trim().toLowerCase()
          : await computeForensicSha256Hash({
              dateIso: weatherDataset.dateIso,
              hour: currentWeather.isoTime,
              maxSiteSumQuotient,
              algedonicObservationsCount: updatedObservations.length,
              algedonicSignatures: updatedObservations.map((o) => o.sha256Signature),
            });

        const ledgerCheck = buildChainOfCustodyVerificationEntries({
          pdfArchive: registeredPdfArchive,
          observations: updatedObservations,
          dateIso: weatherDataset.dateIso,
          hourLabel: currentWeather.hourLabel,
          maxSiteSumQuotient,
          sha256Hash: effectiveMasterSha256,
        });

        const registryValidation = validateChainOfCustodyAgainstStateRegistry({
          ledger: ledgerCheck,
          observations: updatedObservations,
          pdfArchive: registeredPdfArchive,
          sha256Hash: effectiveMasterSha256,
        });

        const combinedFailures = Array.from(
          new Set([
            ...registryValidation.missingOrInvalidIds,
            ...registryValidation.registryMismatchIds,
            ...registryValidation.chainIntegrityBrokenIds,
          ])
        );

        if (!registryValidation.isValid) {
          setBulkExportAuditValidation({
            status: 'error',
            totalChecked: registryValidation.totalLedgerEntriesChecked,
            missingCount: combinedFailures.length,
            missingIds: combinedFailures,
            merkleRoot: registryValidation.merkleRoot,
            message: registryValidation.summaryMessageDa,
          });
          setActiveTab('algedonic');
          return;
        }

        setBulkExportAuditValidation({
          status: 'verified',
          totalChecked: registryValidation.totalLedgerEntriesChecked,
          missingCount: 0,
          missingIds: [],
          merkleRoot: registryValidation.merkleRoot,
          message: registryValidation.summaryMessageDa,
        });

        if (rangeOverride) {
          downloadCombinedSupervisionPdfReport(rangeOverride);
          await waitMs(220);
          downloadCombinedPercolationPdfReport(rangeOverride);
          await waitMs(220);
          downloadRangeSimulationCsv(rangeOverride);
          await waitMs(220);
          downloadRangeSimulationJson(rangeOverride);
        } else {
          generateForensicPdfReport({
            weatherDataset,
            simulation,
            sources,
            receptors,
            observations: updatedObservations,
            isPuffMode,
            sha256Hash,
            groundingPlaces,
            pdfEvidenceArchive: registeredPdfArchive,
            validatePhotoEvidenceBinary,
          });
          await waitMs(220);
          generatePercolationPdfReport({
            dateIso: weatherDataset.dateIso,
            currentWeather,
            sources,
            receptors,
            precipitationOverrideMm,
          });
          await waitMs(220);
          handleExportSelectedHourCsv();
          await waitMs(220);
          downloadForensicDatabaseAuditLogJson({
            observations: updatedObservations,
            weatherDataset,
            simulation,
            sources,
            receptors,
            sha256Hash,
          });
        }

        setBulkDownloadSuccess(true);
        window.setTimeout(() => setBulkDownloadSuccess(false), 5000);
        window.setTimeout(() => setBulkExportAuditValidation(null), 7000);
      } finally {
        setIsBulkDownloading(false);
      }
    },
    [
      isBulkDownloading,
      handleAddAllFindingsToEvidence,
      weatherDataset,
      simulation,
      sources,
      receptors,
      isPuffMode,
      sha256Hash,
      groundingPlaces,
      currentWeather,
      precipitationOverrideMm,
      handleExportSelectedHourCsv,
      maxSiteSumQuotient,
    ]
  );

  const plumeDirectionDeg = (currentWeather.windDirection10m + 180) % 360;

  const [live3DBornehavePlumeAlert, setLive3DBornehavePlumeAlert] =
    useState<BornehaveSpatialPlumeAlertStatus | null>(null);
  const computedBornehavePlumeAlert = useMemo(
    () =>
      evaluateBornehaveDaycare3DPlumeAlert({
        sources,
        receptors,
        weather: currentWeather,
        evalHeightMeters: asbestosEvalHeightMeters,
        waterSuppressionActive:
          (precipitationOverrideMm !== null
            ? precipitationOverrideMm
            : currentWeather.precipitation) > 0.2,
      }),
    [sources, receptors, currentWeather, asbestosEvalHeightMeters, precipitationOverrideMm]
  );
  const bornehavePlumeAlertStatus = useMemo(() => {
    if (
      live3DBornehavePlumeAlert &&
      live3DBornehavePlumeAlert.timestampIso === currentWeather.isoTime &&
      live3DBornehavePlumeAlert.evalHeightMeters === asbestosEvalHeightMeters
    ) {
      return live3DBornehavePlumeAlert;
    }
    return computedBornehavePlumeAlert;
  }, [
    live3DBornehavePlumeAlert,
    computedBornehavePlumeAlert,
    currentWeather.isoTime,
    asbestosEvalHeightMeters,
  ]);

  const handleToggleWindNoiseHeatmapFromToolbar = useCallback(() => {
    setShowWindNoiseHeatmapLayer((prev) => {
      const next = !prev;
      if (next && viewportMode !== '2d' && viewportMode !== 'split') {
        setViewportMode(viewportMode === '3d' ? 'split' : '2d');
      }
      return next;
    });
  }, [viewportMode]);

  const handleTogglePlumeConcentrationHeatmapFromToolbar = useCallback(() => {
    setShowPlumeConcentrationHeatmap((prev) => {
      const next = !prev;
      if (next && viewportMode !== '2d' && viewportMode !== 'split') {
        setViewportMode(viewportMode === '3d' ? 'split' : '2d');
      }
      return next;
    });
  }, [viewportMode]);

  const handleToggleWeatherCorrelationHeatmapFromToolbar = useCallback(() => {
    setShowWeatherCorrelationHeatmapLayer((prev) => {
      const next = !prev;
      if (next && viewportMode !== '2d' && viewportMode !== 'split') {
        setViewportMode(viewportMode === '3d' ? 'split' : '2d');
      }
      return next;
    });
  }, [viewportMode]);

  const handleQuickSnapshotFromToolbar = useCallback(async () => {
    const renderedSnapshot = render2DViewportPrintSnapshotDataUrl({
      sources,
      receptors,
      plumeZones: simulation.plumeZones,
      receptorExposures,
      currentWeather,
      isPuffMode,
      puff24h,
      observations,
      zoom: 17,
      panOffsetPx: { x: 0, y: 0 },
      showHourlyPuffLobes: isPuffMode,
      waterMainTelemetry,
      showWaterMainLayer: effectiveShowWaterMainLayer,
      showLerBuffer,
      simultaneousDispatch: simultaneousAlgedonic.dispatch,
    });

    const activeSourceCount = sources.filter(
      (s) => s.active && !hiddenSourceIds.includes(s.id)
    ).length;
    const enabledSubstancesCount = Object.values(visibleSubstances).filter(Boolean).length;
    const activeLayers: string[] = [
      `Viewport: ${viewportMode.toUpperCase()}`,
      isPuffMode
        ? '24t Gaussisk Puff-Akkumulering'
        : `Gaussisk Time-Plume (kl. ${currentWeather.hourLabel})`,
      `Aktive kilder: ${activeSourceCount}/${sources.length}`,
      `Synlige stoffer: ${enabledSubstancesCount}/5`,
      `Max Sumkvotient S=${maxSiteSumQuotient.toFixed(2)}`,
    ];
    if (effectiveShowWaterMainLayer) {
      activeLayers.push(
        `SK Vand DN200 (-1,65m · ${waterMainTelemetry.pressureBar.toFixed(1)} bar · ${waterMainTelemetry.pipePpvMmPerSec.toFixed(1)} mm/s)`
      );
    }
    if (simultaneousAlgedonic.dispatch.active) {
      activeLayers.push(
        `Algedonisk Simultan S1+S3 (${simultaneousAlgedonic.dispatch.system3State.lockedValveCodes.join('+')} LUKKET)`
      );
    }
    if (showPlumeConcentrationHeatmap) {
      activeLayers.push('Plume Concentration Heatmap (Høj-Konc. vs. Sikker Zone)');
    }
    if (showWindNoiseHeatmapLayer) {
      activeLayers.push('Vind-Støj Korrelation Heatmap');
    }
    if (asbestosHeatmapActive) activeLayers.push('Asbest Risikolag');
    if (showLeewardWakeEffect) activeLayers.push('Læ-Effekt (Recirkulation)');
    if (showWeatherCorrelationOverlay) activeLayers.push('Vejr-Korrelation');
    if (showWeatherCorrelationHeatmapLayer) {
      activeLayers.push('Vejr-Korrelations Heatmap (6t r > 0,80)');
    }
    if (bornehavePlumeAlertStatus.isAlertActive) {
      activeLayers.push(
        `Børnehave 3D-Alert (${bornehavePlumeAlertStatus.pctOfPasquillThreshold.toFixed(0)}%)`
      );
    }

    await handleSaveMapSnapshotObservation({
      zoom: 17,
      center: renderedSnapshot.viewportCenter,
      bounds: {
        north: renderedSnapshot.boundsNorthWest.lat,
        south: renderedSnapshot.boundsSouthEast.lat,
        east: renderedSnapshot.boundsSouthEast.lng,
        west: renderedSnapshot.boundsNorthWest.lng,
      },
      activeLayers,
      modeDescriptor: `Quick-Snapshot (${viewportMode.toUpperCase()} · ${selectedDateIso} kl. ${currentWeather.hourLabel})`,
      capturedAtIso: new Date().toISOString(),
      snapshotDataUrl: renderedSnapshot.dataUrl,
    });
  }, [
    sources,
    receptors,
    simulation.plumeZones,
    receptorExposures,
    currentWeather,
    isPuffMode,
    puff24h,
    observations,
    waterMainTelemetry,
    effectiveShowWaterMainLayer,
    showLerBuffer,
    simultaneousAlgedonic.dispatch,
    hiddenSourceIds,
    visibleSubstances,
    viewportMode,
    maxSiteSumQuotient,
    showPlumeConcentrationHeatmap,
    showWindNoiseHeatmapLayer,
    asbestosHeatmapActive,
    showLeewardWakeEffect,
    showWeatherCorrelationOverlay,
    showWeatherCorrelationHeatmapLayer,
    bornehavePlumeAlertStatus.isAlertActive,
    bornehavePlumeAlertStatus.pctOfPasquillThreshold,
    selectedDateIso,
    handleSaveMapSnapshotObservation,
  ]);

  return (
    <div
      data-density={densityMode}
      data-effective-edition={effectiveDeviceEdition}
      data-effective-orientation={effectiveOrientation}
      data-edition-forced={
        deviceEditionSelection !== 'auto' || orientationSelection !== 'auto'
          ? 'true'
          : 'false'
      }
      className="ringparken-app-shell min-h-screen lg:h-dvh lg:max-h-dvh w-full max-w-full min-w-0 flex flex-col bg-[var(--surface-canvas)] text-[var(--text-primary)] overflow-y-auto lg:overflow-hidden overflow-x-hidden scroll-smooth"
    >
      {/* Google Maps Platform Quota Notice (Mandatory per GMP Skill Section 8) */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* TOP BAR CONTRACT: ISA-101 Calm 3-Zone TopCommandHeader */}
      <TopCommandHeader
        onSelectTab={(tab) => setActiveTab(tab)}
        last6HoursSparklinePoints={last6HoursSparklinePoints}
        onSelectHour={(hr) => {
          setSelectedHourIndex(hr);
          setPlumeRouteProgress(hr);
        }}
        currentWeather={currentWeather}
        maxSiteSumQuotient={maxSiteSumQuotient}
        observations={observations}
        puff24h={puff24h}
        relaxationTimeTrHours={relaxationTimeTrHours}
        manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
        isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
        legalViolations={legalViolations}
        batchAddFindingsSuccess={batchAddFindingsSuccess}
        batchAddedFindingsCount={batchAddedFindingsCount}
        totalCurrentFindingsCount={totalCurrentFindingsCount}
        onAddAllFindingsToEvidence={() => {
          void handleAddAllFindingsToEvidence();
        }}
        isBulkDownloading={isBulkDownloading}
        bulkDownloadSuccess={bulkDownloadSuccess}
        onAddAllAndBulkDownload={() => {
          void handleAddAllAndBulkDownload();
        }}
        windowStates={windowStates}
        onRestoreWindow={handleRestoreWindow}
        onPopOutFloatingWindow={handlePopOutFloatingWindow}
        onMinimizeAllFloating={handleMinimizeAllFloating}
        onRestoreAllMinimized={handleRestoreAllMinimized}
        isMinimizeAllFocusActive={isMinimizeAllFocusActive}
        onToggleMinimizeAllExceptMapAndSidebar={handleToggleMinimizeAllExceptMapAndSidebar}
        onOpenSourceReceptorModal={() => setIsSourceReceptorModalOpen(true)}
        myceliumUnacknowledgedCount={myceliumAlerts.unacknowledgedCount}
        onToggleMyceliumDrawer={() =>
          myceliumAlerts.setIsDrawerOpen(!myceliumAlerts.isDrawerOpen)
        }
        isSlagelseLegalDashboardActive={
          activeTab === 'compliance' && complianceSubTab === 'slagelse_legal_dashboard'
        }
        onOpenSlagelseLegalDashboard={() => {
          setActiveTab('compliance');
          setComplianceSubTab('slagelse_legal_dashboard');
        }}
        isRangeSimPanelOpen={isRangeSimPanelOpen}
        onToggleRangeSimPanel={() => setIsRangeSimPanelOpen((prev) => !prev)}
        showHeaderWeatherCorrelationPopup={showHeaderWeatherCorrelationPopup}
        onToggleHeaderWeatherCorrelationPopup={() =>
          setShowHeaderWeatherCorrelationPopup((prev) => !prev)
        }
        onCloseHeaderWeatherCorrelationPopup={() =>
          setShowHeaderWeatherCorrelationPopup(false)
        }
        isExportHubOpen={isExportHubOpen}
        onToggleExportHub={() => setIsExportHubOpen((prev) => !prev)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        dateIso={weatherDataset.dateIso}
        weatherHours={weatherDataset.hours}
        selectedReceptorExposure={selectedReceptorExposure}
        receptorExposures={receptorExposures}
        indoorSumQuotientSin={indoorClimateTelemetry.indoorSumQuotientSin}
        selectedHourIndex={selectedHourIndex}
        densityMode={densityMode}
        onToggleDensityMode={handleToggleDensityMode}
        sources={sources}
        selectedSourceId={selectedSourceId}
        onSelectSource={(id) => setSelectedSourceId(id)}
        onToggleSourceActive={toggleSourceActive}
        simultaneousDispatch={simultaneousAlgedonic.dispatch}
        manualSimultaneousScenario={simultaneousAlgedonic.manualScenarioOverride}
        onTriggerSimultaneousScenario={simultaneousAlgedonic.triggerScenarioSimulation}
        onOpenSimultaneousModal={() => simultaneousAlgedonic.setIsSplitModalOpen(true)}
        onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
        onClearSimultaneousSimulation={handleClearSimultaneousAll}
        onExportWeatherCorrelationPdf={() =>
          generateWeatherCorrelationPdfReport({
            weatherDataset,
            simulation,
            sources,
            receptors,
            observations,
            sha256Hash,
          })
        }
      />

      {/* TOP ROLE NAVIGATION: 1. Beboer & Nabo · 2. Arbejder & AMK · 3. Borgertilsyn & Dokument-Audit */}
      <nav
        aria-label="Brugerrolle top-navigation"
        className="px-4 py-1.5 bg-[#0F141D] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 shrink-0"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveUserRole('workspace')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeUserRole === 'workspace'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#1B2433]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>GIS &amp; Spredningsoverblik</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveUserRole('resident')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeUserRole === 'resident'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#1B2433]'
            }`}
          >
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span>1. Beboer &amp; Nabo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveUserRole('worker')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeUserRole === 'worker'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#1B2433]'
            }`}
          >
            <HardHat className="w-3.5 h-3.5 shrink-0" />
            <span>2. Arbejder &amp; AMK</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveUserRole('audit')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeUserRole === 'audit'
                ? 'bg-emerald-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#1B2433]'
            }`}
          >
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span>3. Borgertilsyn &amp; Dokument-Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveUserRole('climate')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeUserRole === 'climate'
                ? 'bg-emerald-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#1B2433]'
            }`}
          >
            <Sprout className="w-3.5 h-3.5 shrink-0" />
            <span>4. Klima, LCA &amp; LAR</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>Ringparken, 4200 Slagelse</span>
          <span aria-hidden="true">·</span>
          <span>Sager 25-019352 / 25-019350 / 25-019157 / 25-019354</span>
        </div>
      </nav>

      {bulkExportAuditValidation && (
        <div
          role="status"
          data-testid="bulk-export-validation-banner"
          className={`px-4 py-2 border-b text-xs font-mono flex items-center justify-between gap-3 shrink-0 ${
            bulkExportAuditValidation.status === 'error'
              ? 'bg-rose-950/85 border-rose-500/70 text-rose-100'
              : 'bg-emerald-950/75 border-emerald-500/60 text-emerald-100'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {bulkExportAuditValidation.status === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="truncate font-semibold">{bulkExportAuditValidation.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBulkExportAuditValidation(null)}
            className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[11px] text-slate-200 hover:text-white cursor-pointer shrink-0"
          >
            Luk
          </button>
        </div>
      )}

      {/* INTERVAL-SIMULERING BAR: Simuler Fra "fra dato_klokkeslæt - Til dato_klokkeslæt" */}
      <RangeSimulationDrawer
        isOpen={isRangeSimPanelOpen}
        onClose={() => setIsRangeSimPanelOpen(false)}
        rangeFromDateIso={rangeFromDateIso}
        onChangeRangeFromDateIso={setRangeFromDateIso}
        rangeFromHourIndex={rangeFromHourIndex}
        onChangeRangeFromHourIndex={setRangeFromHourIndex}
        rangeToDateIso={rangeToDateIso}
        onChangeRangeToDateIso={setRangeToDateIso}
        rangeToHourIndex={rangeToHourIndex}
        onChangeRangeToHourIndex={setRangeToHourIndex}
        nextWeekEndIso={nextWeekEndIso}
        simulationSpeedMultiplier={simulationSpeedMultiplier}
        onChangeSimulationSpeedMultiplier={setSimulationSpeedMultiplier}
        isRunningRangeSimulation={isRunningRangeSimulation}
        rangeSimulationProgress={rangeSimulationProgress}
        onRunRangeSimulation={async () => {
          setIsRunningRangeSimulation(true);
          setCompletedRangeSimulation(null);
          try {
            const summary = await runMultiHourRangeSimulation({
              fromDateIso: rangeFromDateIso,
              fromHourIndex: rangeFromHourIndex,
              toDateIso: rangeToDateIso,
              toHourIndex: rangeToHourIndex,
              sources,
              receptors,
              buildings,
              precipitationOverrideMm,
              machineNoiseOutputDb: isManualMachineNoiseOverrideActive
                ? manualMachineNoiseOutputDb
                : 114,
              stepDelayMs: Math.max(8, Math.round(90 / simulationSpeedMultiplier)),
              onProgress: (done, total, latestStep, dsForDate) => {
                setRangeSimulationProgress({
                  completed: done,
                  total,
                  currentLabel: `${latestStep.dateIso}_${latestStep.hourLabel}`,
                });
                setSelectedDateIso(latestStep.dateIso);
                setSelectedHourIndex(latestStep.hourIndex);
                setPlumeRouteProgress(latestStep.hourIndex);
                setWeatherDataset(dsForDate);
              },
            });
            setCompletedRangeSimulation(summary);
          } finally {
            setIsRunningRangeSimulation(false);
          }
        }}
        onFocusBlok12Percolation3D={() => {
          setViewportMode('underground_3d');
          setFocusBlok12PercolationTrigger((c) => c + 1);
        }}
        completedRangeSimulation={completedRangeSimulation}
        isBulkDownloading={isBulkDownloading}
        onBulkDownloadCompletedSimulation={(summary) => {
          void handleAddAllAndBulkDownload(summary);
        }}
        onDownloadSupervisionPdf={downloadCombinedSupervisionPdfReport}
        onDownloadPercolationPdf={downloadCombinedPercolationPdfReport}
        onDownloadRangeCsv={downloadRangeSimulationCsv}
        onDownloadRangeJson={downloadRangeSimulationJson}
      />

      {/* MODULE A: KOMPAKT NIVEAU-1 VEJR- & TELEMETRILINJE + KONTROLLEREDE ANALYSESKUFFER */}
      {(() => {
        const isHighRiskWind = currentWeather.windSpeed10m > 10;
        const stripFrame = computeInterpolatedRefractionFrame({
          hours: weatherDataset.hours,
          fallbackWeather: currentWeather,
          loopProgress: selectedHourIndex,
          isPlayingLoop: false,
        });
        const primaryActiveSource =
          sources.find((s) => s.active && s.code === 'BLOK-1') ||
          sources.find((s) => s.active) ||
          sources[0];
        const receptorRefractions = computeReceptorRefractions({
          receptors,
          primaryActiveSource,
          receptorExposures,
          frame: stripFrame,
        });
        const selectedRecRefraction =
          receptorRefractions.find(
            (r) => r.receptorId === selectedReceptorExposure.receptorId
          ) || receptorRefractions[0];

        const externalDrawersCount = [
          showRibbonWindRose,
          showRibbon7DayWindRose,
          showRibbon30DayHeatmap,
          showRibbonDepositionProfile,
          showRibbonMedicalExpert,
          showRibbonExpertChat,
          showRibbonPredVsActual,
          showRibbonDispersionForecast,
          showRibbonStochasticBias,
          showRibbonProactiveAgent,
          showRibbonTempChart,
          showRibbonStackEffect,
        ].filter(Boolean).length;

        const handleCloseAllExternalDrawers = () => {
          setShowRibbonWindRose(false);
          setShowRibbon7DayWindRose(false);
          setShowRibbon30DayHeatmap(false);
          setShowRibbonDepositionProfile(false);
          setShowRibbonMedicalExpert(false);
          setShowRibbonExpertChat(false);
          setShowRibbonPredVsActual(false);
          setShowRibbonDispersionForecast(false);
          setShowRibbonStochasticBias(false);
          setShowRibbonProactiveAgent(false);
          setShowRibbonTempChart(false);
          setShowRibbonStackEffect(false);
          setShowRibbonAcousticRefraction(false);
        };

        const handleExportSelectedDayWeatherJson = () => {
          exportOpenMeteo24hWeatherDatasetJson({
            weatherDataset,
            selectedHourIndex,
            currentWeather,
            puff24h,
            indoorClimateTelemetry,
            receptorExposures,
          });
          setWeatherJsonExportedJustNow(true);
          window.setTimeout(() => setWeatherJsonExportedJustNow(false), 3500);
        };

        return (
          <div className="shrink-0">
            {!isTopCompactMode && (
              <WeatherTelemetryStrip
                weatherDataset={weatherDataset}
                currentWeather={currentWeather}
                plumeDirectionDeg={plumeDirectionDeg}
                isHighRiskWind={isHighRiskWind}
                maxSiteSumQuotient={maxSiteSumQuotient}
                sources={sources}
                receptors={receptors}
                receptorExposures={receptorExposures}
                selectedReceptorExposure={selectedReceptorExposure}
                worstExposedReceptor={worstExposedReceptor}
                top3MostAffectedReceptors={top3MostAffectedReceptors}
                buildings={buildings}
                indoorClimateTelemetry={indoorClimateTelemetry}
                isNoiseAmplificationRisk={stripFrame.isNoiseAmplificationRisk}
                isModerateDownwardBending={stripFrame.isModerateDownwardBending}
                downwindWindRefractionDb={stripFrame.downwindWindRefractionDb}
                windGradientDuDz={stripFrame.windGradientDuDz}
                thermalSpec={stripFrame.thermalSpec}
                maxDownwindRefractionDb={stripFrame.maxDownwindRefractionDb}
                showRibbonWindRose={showRibbonWindRose}
                onToggleRibbonWindRose={() => setShowRibbonWindRose((prev) => !prev)}
                showRibbon7DayWindRose={showRibbon7DayWindRose}
                onToggleRibbon7DayWindRose={() => setShowRibbon7DayWindRose((prev) => !prev)}
                showRibbonProactiveAgent={showRibbonProactiveAgent}
                onToggleRibbonProactiveAgent={() =>
                  setShowRibbonProactiveAgent((prev) => !prev)
                }
                showRibbonStochasticBias={showRibbonStochasticBias}
                onToggleRibbonStochasticBias={() =>
                  setShowRibbonStochasticBias((prev) => !prev)
                }
                showRibbonPredVsActual={showRibbonPredVsActual}
                onToggleRibbonPredVsActual={() => setShowRibbonPredVsActual((prev) => !prev)}
                showRibbonDispersionForecast={showRibbonDispersionForecast}
                dispersionForecastMode={dispersionForecastMode}
                onSelectDispersionForecastOption={handleSelectDispersionForecastOption}
                showRibbon30DayHeatmap={showRibbon30DayHeatmap}
                onToggleRibbon30DayHeatmap={() => setShowRibbon30DayHeatmap((prev) => !prev)}
                showRibbonDepositionProfile={showRibbonDepositionProfile}
                onToggleRibbonDepositionProfile={() =>
                  setShowRibbonDepositionProfile((prev) => !prev)
                }
                showRibbonMedicalExpert={showRibbonMedicalExpert}
                onToggleRibbonMedicalExpert={() =>
                  setShowRibbonMedicalExpert((prev) => !prev)
                }
                showRibbonExpertChat={showRibbonExpertChat}
                onToggleRibbonExpertChat={() => {
                  setShowRibbonExpertChat((prev) => !prev);
                  setActiveTab('grounding');
                }}
                showRibbonTempChart={showRibbonTempChart}
                onToggleRibbonTempChart={() => setShowRibbonTempChart((prev) => !prev)}
                showRibbonAcousticRefraction={showRibbonAcousticRefraction}
                onToggleRibbonAcousticRefraction={() =>
                  setShowRibbonAcousticRefraction((prev) => !prev)
                }
                showRibbonStackEffect={showRibbonStackEffect}
                onToggleRibbonStackEffect={() => setShowRibbonStackEffect((prev) => !prev)}
                weatherJsonExportedJustNow={weatherJsonExportedJustNow}
                onExportSelectedDayWeatherJson={handleExportSelectedDayWeatherJson}
                onJumpToHighWindHour={handleJumpToHighWindHour}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                onSelectReceptorAndFocusSubstances={(receptorId) => {
                  setSelectedReceptorId(receptorId);
                  setActiveTab('substances');
                }}
                onSelectReceptorAndHour={(receptorId, hourIdx) => {
                  setSelectedReceptorId(receptorId);
                  setSelectedHourIndex(hourIdx);
                  setPlumeRouteProgress(hourIdx);
                }}
                onLogVerticalPlumeEvidence={(payload) => {
                  const targetRec = worstExposedReceptor || receptorExposures[0];
                  const floorSummary = payload.floorQuots
                    .map((f) => `${f.label}: S=${f.sQuotient.toFixed(2)}`)
                    .join(' | ');
                  void handleQuickLogNoiseDustComplaint({
                    point: targetRec.position,
                    locationLabel: `${targetRec.receptorCode}: ${targetRec.receptorName} (${targetRec.address})`,
                    observationType: `3D Vertikal Støvfane-Udbredelse (kl. ${payload.hourLabel} · Pasquill ${payload.pasquillClass})`,
                    description: `[3D VERTIKAL STØVFANE-UDBREDELSE · ${weatherDataset.dateIso} kl. ${payload.hourLabel}] Vind: ${payload.windSpeedMs.toFixed(1)} m/s, Pasquill-klasse ${payload.pasquillClass}, Fane-retning ${payload.plumeDirectionDeg}°. Tværsnit ved x = ${payload.sliceDistanceMeters} m: vertikal spredning σ_z = ${payload.sigmaZAtSliceMeters.toFixed(1)} m, fanetop Z_max = ${payload.plumeTopHeightMeters.toFixed(1)} m. Etage-eksponering: ${floorSummary}.`,
                  });
                }}
                receptorsExceeding24hDustDanger={receptorsExceeding24hDustDanger}
                allReceptors24hDustSorted={allReceptors24hDustSorted}
                dustDepositionDangerThresholdUgM2={dustDepositionDangerThresholdUgM2}
                onChangeDustDepositionDangerThresholdUgM2={
                  setDustDepositionDangerThresholdUgM2
                }
                autoLogDustDangerToAlgedonic={autoLogDustDangerToAlgedonic}
                onChangeAutoLogDustDangerToAlgedonic={setAutoLogDustDangerToAlgedonic}
                lastAutoLoggedDustAlertCode={lastAutoLoggedDustAlertCode}
                onOpenAlgedonicTab={() => setActiveTab('algedonic')}
                onLog24hDustDepositionDangerManual={(rec) => {
                  void handleLog24hDustDepositionDangerObservation(rec, 'MANUEL');
                  setActiveTab('algedonic');
                }}
                onCloseAllExternalDrawers={handleCloseAllExternalDrawers}
                externalDrawersActiveCount={
                  externalDrawersCount + (showRibbonAcousticRefraction ? 1 : 0)
                }
                onExport7DayWindRoseBiasPdf={async () => {
                  await exportSevenDayWindRoseAndBiasPdf({
                    dateIso: weatherDataset.dateIso,
                    currentWeather,
                    currentDayHours: weatherDataset.hours,
                    puff24h,
                    selectedReceptorId,
                  });
                }}
              />
            )}

            {acousticRefractionPdfBanner && (
              <div className="px-4 py-1.5 bg-[#0F291E] border-b border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-2">
                <span className="font-semibold">✓ {acousticRefractionPdfBanner}</span>
                <button
                  type="button"
                  onClick={() => setAcousticRefractionPdfBanner(null)}
                  className="text-emerald-300 hover:text-white text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 cursor-pointer"
                >
                  Luk
                </button>
              </div>
            )}

            {/* KONTROLLERET SKUFFEMODUL: ISOLERET AKUSTISK REFRAKTIONS-DASHBOARD (60fps RAF kun lokalt) */}
            {showRibbonAcousticRefraction && !isTopCompactMode && (
              <div
                role="region"
                aria-label="Akustisk Refraktions-Skuffe"
                className="px-4 py-2 bg-[#151C28] border-b border-[#253042] max-h-[55vh] overflow-y-auto"
              >
                <DockableWindowFrame
                  windowId="acoustic_refraction_dashboard"
                  state={windowStates.acoustic_refraction_dashboard}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <AcousticRefractionDrawer
                    weatherDataset={weatherDataset}
                    currentWeather={currentWeather}
                    selectedHourIndex={selectedHourIndex}
                    onSelectHour={(hrIdx) => {
                      setSelectedHourIndex(hrIdx);
                      setPlumeRouteProgress(hrIdx);
                    }}
                    simulationSpeedMultiplier={simulationSpeedMultiplier}
                    sources={sources}
                    selectedSourceId={selectedSourceId}
                    onSelectSource={(srcId) => setSelectedSourceId(srcId)}
                    receptors={receptors}
                    receptorExposures={receptorExposures}
                    selectedReceptorExposure={selectedReceptorExposure}
                    worstExposedReceptor={worstExposedReceptor}
                    maxSiteSumQuotient={maxSiteSumQuotient}
                    onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                    observations={observations}
                    manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                    isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
                    onChangeMachineNoiseOutputDb={(nextDb) => {
                      setManualMachineNoiseOutputDb(nextDb);
                      setIsManualMachineNoiseOverrideActive(true);
                    }}
                    onApplyMatchedMachineProfile={({ lwaDb, machineryCategoryKey }) => {
                      setSelectedImpulseMachineryKey(machineryCategoryKey);
                      setManualMachineNoiseOutputDb(lwaDb);
                      setIsManualMachineNoiseOverrideActive(true);
                    }}
                    showWindNoiseSensitivityAnalysis={showWindNoiseSensitivityAnalysis}
                    onToggleWindNoiseSensitivityAnalysis={() =>
                      setShowWindNoiseSensitivityAnalysis((prev) => !prev)
                    }
                    showWindCompensatedImpulseCatalog={showWindCompensatedImpulseCatalog}
                    onToggleWindCompensatedImpulseCatalog={() =>
                      setShowWindCompensatedImpulseCatalog((prev) => !prev)
                    }
                    acousticDustWarningEnabled={acousticDustWarningEnabled}
                    onToggleAcousticDustWarning={() =>
                      setAcousticDustWarningEnabled((prev) => !prev)
                    }
                    forceHighWindDustWarningSim={forceHighWindDustWarningSim}
                    onToggleForceHighWindDustWarningSim={() =>
                      setForceHighWindDustWarningSim((prev) => {
                        const next = !prev;
                        if (next) {
                          lastChimedStateKeyRef.current = '';
                        }
                        return next;
                      })
                    }
                    lastAcousticChimeLabel={lastAcousticChimeLabel}
                    onPlayAcousticDustWarningTone={(sumQ, vMs, recLabel) =>
                      playAcousticDustDispersionWarningTone(sumQ, vMs, recLabel, true)
                    }
                    onNotifyTimelineScrub={() => myceliumAlerts.notifyTimelineScrub()}
                    onOpenNoiseDustTab={() => setActiveTab('noiseDust')}
                    onTrigger3DImpulseWaves={() => {
                      if (viewportMode !== '3d' && viewportMode !== 'split') {
                        setViewportMode('3d');
                      }
                    }}
                    onQuickLogNoiseDustComplaint={handleQuickLogNoiseDustComplaint}
                    onExportMachineWindNoiseJson={() =>
                      exportMachineWindNoiseCorrelation24hJson({
                        weatherDataset,
                        selectedHourIndex,
                        currentWeather,
                        sources,
                        receptors,
                        selectedReceptorExposure,
                        observations,
                        selectedImpulseMachineryKey,
                        isManualMachineNoiseOverrideActive,
                        manualMachineNoiseOutputDb,
                        selectedDbaNeighborBlockKey,
                        customDbaFileName,
                        customDbaOffsetDb,
                      })
                    }
                    onClose={() => setShowRibbonAcousticRefraction(false)}
                  />
                </DockableWindowFrame>
              </div>
            )}




            {/* KONTROLLEREDE VEJR-, PROGNOSE- & AI-ANALYSESKUFFER (max-h-[55vh] + Luk alle / Esc) */}
            {externalDrawersCount > 0 && !isTopCompactMode && (
              <div
                role="region"
                aria-label="Vejr- og Prognose-Skuffer"
                className="px-4 py-2 bg-[#151C28] border-b border-[#253042] space-y-3 max-h-[55vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-[#1B2433] border border-[#2D3B50] sticky top-0 z-10">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-200">
                    Vejr- &amp; Prognose-Skuffer ({externalDrawersCount} aktive · Tryk Esc eller Luk)
                  </span>
                  <button
                    type="button"
                    onClick={handleCloseAllExternalDrawers}
                    className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#36465E] text-slate-200 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Luk</span>
                  </button>
                </div>
                {showRibbonStackEffect &&
                  (windowStates.indoor_climate_telemetry?.isFloating ? (
                    <div
                      data-window-id="indoor_climate_telemetry"
                      data-window-floating="true"
                      className="w-full px-3 py-2 rounded-md bg-[#1B2433] border border-dashed border-[#36465E] flex items-center justify-between gap-2 font-mono text-xs"
                    >
                      <span className="text-slate-200 text-[11px] truncate">
                        Vinduet (<strong className="text-white">Indeklima &amp; CAV/Opdrift</strong>) vises som flydende panel
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRestoreWindow('indoor_climate_telemetry')}
                        className="px-2.5 py-1 rounded bg-[#212C3E] hover:bg-slate-700 border border-[#36465E] text-cyan-300 text-[11px] font-semibold shrink-0 cursor-pointer"
                      >
                        Fastgør her
                      </button>
                    </div>
                  ) : (
                    <ThermalStackBuoyancyWidget
                      currentWeather={currentWeather}
                      dateIso={weatherDataset.dateIso}
                      observations={observations}
                      cavVentilationMode={cavVentilationMode}
                      onChangeCavVentilationMode={setCavVentilationMode}
                      show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                      onToggle3DNeutralPressurePlane={(next) => {
                        const resolved = next !== undefined ? next : !show3DNeutralPressurePlane;
                        setShow3DNeutralPressurePlane(resolved);
                        if (resolved && viewportMode !== '3d' && viewportMode !== 'split') {
                          setViewportMode('3d');
                        }
                      }}
                      onChangeEffectiveZNplMeters={setNeutralPressurePlaneHeightMeters}
                      onAddThermalStackEvidence={handleAddThermalStackEvidence}
                    />
                  ))}
                {showRibbonDispersionForecast && (
                  <DockableWindowFrame
                    windowId="dispersion_forecast_bulletin"
                    state={windowStates.dispersion_forecast_bulletin}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <DispersionForecastBulletinWidget
                      baseDateIso={forecastAnchorDateIso}
                      simulatedDateIso={selectedDateIso}
                      simulatedHourIndex={selectedHourIndex}
                      todayIso={todayIso}
                      currentWeather={currentWeather}
                      sources={sources}
                      receptors={receptors}
                      buildings={buildings}
                      selectedReceptorId={selectedReceptorId}
                      mode={dispersionForecastMode}
                      focusTrigger={dispersionForecastFocusTrigger}
                      onChangeMode={handleSelectDispersionForecastOption}
                      onSelectDateAndHour={(dIso, hrIdx, customDs) => {
                        setSelectedDateIso(dIso);
                        setSelectedHourIndex(hrIdx);
                        setPlumeRouteProgress(hrIdx);
                        if (customDs) {
                          setWeatherDataset(customDs);
                        } else {
                          loadLiveOpenMeteo(dIso);
                        }
                      }}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      onAddForecastToEvidence={handleAddForecastToEvidence}
                      onClose={() => setShowRibbonDispersionForecast(false)}
                    />
                  </DockableWindowFrame>
                )}
                {showRibbonDepositionProfile && (
                  <DockableWindowFrame
                    windowId="receptor_dust_deposition_profile"
                    state={windowStates.receptor_dust_deposition_profile}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <ReceptorDustDepositionProfileWidget
                      puff24h={puff24h}
                      receptorExposures={receptorExposures}
                      weatherHours={weatherDataset.hours}
                      currentWeather={currentWeather}
                      dateIso={weatherDataset.dateIso}
                      selectedReceptorId={selectedReceptorExposure.receptorId}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      onSelectHour={(hrIdx) => {
                        setSelectedHourIndex(hrIdx);
                        setPlumeRouteProgress(hrIdx);
                      }}
                      buildings={buildings}
                      compact
                    />
                  </DockableWindowFrame>
                )}

                {showRibbonExpertChat && (
                  <DockableWindowFrame
                    windowId="gemini_grounding_chat"
                    state={windowStates.gemini_grounding_chat}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <ForensicChatbotPanel
                      telemetryContext={{
                        selectedSourceName:
                          sources.find((s) => s.id === selectedSourceId)?.name ||
                          sources[0]?.name ||
                          'Blok 1',
                        windSpeedMs: currentWeather.windSpeed10m,
                        windDirDeg: currentWeather.windDirection10m,
                        stabilityClass: currentWeather.pasquillClass,
                        sumQuotient: maxSiteSumQuotient,
                        peakAddress: puff24h.peakReceptor.address,
                        selectedDate: weatherDataset.dateIso,
                        selectedHour: selectedHourIndex,
                        precipitationMm: currentWeather.precipitation,
                        observationsCount: observations.length,
                        indoorClimate: indoorClimateTelemetry,
                      }}
                      onRunMapsGrounding={runMapsGroundingAnalysis}
                      mapsGroundingLoading={isLoadingGrounding}
                    />
                  </DockableWindowFrame>
                )}

                {showRibbonMedicalExpert &&
                  activeTab !== 'bioscience' &&
                  activeTab !== 'indoorClimate' && (
                  <DockableWindowFrame
                    windowId="medical_expert_ai"
                    state={windowStates.medical_expert_ai}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <MedicalExpertAiWidget
                      selectedReceptorExposure={selectedReceptorExposure}
                      allReceptorExposures={receptorExposures}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      currentWeather={currentWeather}
                      currentDateIso={weatherDataset.dateIso}
                      cumulativeSumQuotient24h={
                        puff24h.receptorSummaries.find(
                          (r) => r.receptorId === selectedReceptorExposure.receptorId
                        )?.cumulativeSumDose || puff24h.peakReceptor.cumulativeSumDose
                      }
                      acousticRefractionDb={selectedRecRefraction.totalRefrDb}
                      compactMode
                    />
                  </DockableWindowFrame>
                )}

                {showRibbon30DayHeatmap && (
                  <DockableWindowFrame
                    windowId="thirty_day_aggregated_heatmap"
                    state={windowStates.thirty_day_aggregated_heatmap}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <ThirtyDayAggregatedHeatmapWidget
                      todayIso={todayIso}
                      selectedDateIso={selectedDateIso}
                      currentWeather={currentWeather}
                      weatherDataset={weatherDataset}
                      sources={sources}
                      receptors={receptors}
                      selectedReceptorId={selectedReceptorId}
                      onSelectDateIso={(newDateIso) => {
                        setSelectedDateIso(newDateIso);
                        loadLiveOpenMeteo(newDateIso);
                      }}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      compact
                    />
                  </DockableWindowFrame>
                )}

                {showRibbonPredVsActual && (
                  <DockableWindowFrame
                    windowId="prediction_vs_actual_forecast"
                    state={windowStates.prediction_vs_actual_forecast}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <PredictionVsActualAndForecastWidget
                      todayIso={todayIso}
                      selectedDateIso={selectedDateIso}
                      selectedHourIndex={selectedHourIndex}
                      isPlaying={isPlaying}
                      isContinuousRecordingToToday={isContinuousRecordingToToday}
                      playbackTargetEndDateIso={playbackTargetEndDateIso}
                      midnightRolloverCount={midnightRolloverCount}
                      recordedTimelineEvents={recordedTimelineEvents}
                      sources={sources}
                      receptors={receptors}
                      onStartTimeTravelToToday={handleStartTimeTravelToToday}
                      onStartNextWeekForecastPlayback={handleStartNextWeekForecastPlayback}
                      onStopTimeTravelRecording={handleStopTimeTravelRecording}
                      onClearRecordedEvents={() => setRecordedTimelineEvents([])}
                      onSelectDateAndHour={(dIso, hrIdx, customDs) => {
                        setSelectedDateIso(dIso);
                        setSelectedHourIndex(hrIdx);
                        setPlumeRouteProgress(hrIdx);
                        if (customDs) {
                          setWeatherDataset(customDs);
                        } else {
                          loadLiveOpenMeteo(dIso);
                        }
                      }}
                      autoSaveEvidenceOnTimeTravel={autoSaveEvidenceOnTimeTravel}
                      onToggleAutoSaveEvidence={() =>
                        setAutoSaveEvidenceOnTimeTravel((v) => !v)
                      }
                      autoSavedEvidenceCount={autoSavedEvidenceCount}
                      compact
                    />
                  </DockableWindowFrame>
                )}

                {showRibbonProactiveAgent && (
                  <DockableWindowFrame
                    windowId="proactive_ai_agent"
                    state={windowStates.proactive_ai_agent}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <ProactiveComplaintMitigationAgentWidget
                      observations={observations}
                      currentWeather={currentWeather}
                      dateIso={weatherDataset.dateIso}
                      maxSiteSumQuotient={maxSiteSumQuotient}
                      worstExposedReceptor={worstExposedReceptor}
                      sources={sources}
                      onSelectObservation={(obsId, hrIdx) => {
                        setSelectedObservationId(obsId);
                        setSelectedHourIndex(hrIdx);
                        setPlumeRouteProgress(hrIdx);
                      }}
                      onToggleSourceActive={toggleSourceActive}
                      compact
                    />
                  </DockableWindowFrame>
                )}

                {showRibbonStochasticBias && (
                  <DockableWindowFrame
                    windowId="stochastic_wind_bias"
                    state={windowStates.stochastic_wind_bias}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <StochasticWindBiasWidget
                      hours={weatherDataset.hours}
                      currentWeather={currentWeather}
                      dateIso={weatherDataset.dateIso}
                      puff24h={puff24h}
                      selectedReceptorId={selectedReceptorId}
                      onSelectHour={(hrIdx) => {
                        setSelectedHourIndex(hrIdx);
                        setPlumeRouteProgress(hrIdx);
                      }}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      compact
                    />
                  </DockableWindowFrame>
                )}

                {(showRibbonWindRose || showRibbonTempChart) && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {showRibbonWindRose && (
                      <DockableWindowFrame
                        windowId="wind_rose_24h"
                        state={windowStates.wind_rose_24h}
                        onMinimize={handleMinimizeWindow}
                        onPopOutFloating={handlePopOutFloatingWindow}
                        onRestore={handleRestoreWindow}
                      >
                        <InteractiveWindRoseChart
                          hours={weatherDataset.hours}
                          currentWeather={currentWeather}
                          dateIso={weatherDataset.dateIso}
                          onSelectHour={(hrIdx) => {
                            setSelectedHourIndex(hrIdx);
                            setPlumeRouteProgress(hrIdx);
                          }}
                          compact
                        />
                      </DockableWindowFrame>
                    )}
                    {showRibbonTempChart && (
                      <DockableWindowFrame
                        windowId="temp_aerosol_24h"
                        state={windowStates.temp_aerosol_24h}
                        onMinimize={handleMinimizeWindow}
                        onPopOutFloating={handlePopOutFloatingWindow}
                        onRestore={handleRestoreWindow}
                      >
                        <TemperatureAerosolChart
                          hours={weatherDataset.hours}
                          currentWeather={currentWeather}
                          dateIso={weatherDataset.dateIso}
                          onSelectHour={(hrIdx) => {
                            setSelectedHourIndex(hrIdx);
                            setPlumeRouteProgress(hrIdx);
                          }}
                          variant="full"
                        />
                      </DockableWindowFrame>
                    )}
                  </div>
                )}

                {showRibbon7DayWindRose && (
                  <DockableWindowFrame
                    windowId="wind_rose_7day"
                    state={windowStates.wind_rose_7day}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <SevenDayHistoricalWindRoseWidget
                      dateIso={weatherDataset.dateIso}
                      currentDayHours={weatherDataset.hours}
                      currentWeather={currentWeather}
                      onSelectDateIso={(newDateIso) => {
                        setSelectedDateIso(newDateIso);
                        loadLiveOpenMeteo(newDateIso);
                      }}
                      onSelectHour={(hrIdx) => {
                        setSelectedHourIndex(hrIdx);
                        setPlumeRouteProgress(hrIdx);
                      }}
                      compact
                    />
                  </DockableWindowFrame>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ROLLE-SPECIFIKKE VISNINGER: 1. Beboer & Nabo · 2. Arbejder & AMK · 3. Borgertilsyn & Dokument-Audit */}
      {activeUserRole !== 'workspace' && (
        <main className="flex-1 min-h-0 w-full overflow-hidden">
          {(activeUserRole === 'resident' || activeUserRole === 'worker') && (
            <RoleDashboard
              role={activeUserRole}
              onChangeRole={(nextRole) => setActiveUserRole(nextRole)}
              windFromDeg={currentWeather.windDirection10m}
              windSpeedMs={currentWeather.windSpeed10m}
              isDryWeather={(precipitationOverrideMm ?? currentWeather.precipitation) < 0.2}
              initialBuildingId={focusedGisBuildingId}
              onOpenOnGisMap={(buildingId) => {
                setFocusedGisBuildingId(buildingId);
                setViewportMode('risk_gis');
                setActiveUserRole('workspace');
              }}
            />
          )}
          {activeUserRole === 'audit' && (
            <ComplianceAuditPanel
              onOpenBuildingOnGis={(buildingId) => {
                setFocusedGisBuildingId(buildingId);
                setViewportMode('risk_gis');
                setActiveUserRole('workspace');
              }}
            />
          )}
          {activeUserRole === 'climate' && (
            <ClimateResiliencePanel
              initialPrecipitationMmH={
                precipitationOverrideMm ?? currentWeather.precipitation
              }
              onOpenGisMap={() => {
                setViewportMode('risk_gis');
                setActiveUserRole('workspace');
              }}
            />
          )}
        </main>
      )}

      {/* MAIN SPLIT-SCREEN WORKSPACE: 2/3 MAP & 3D DIGITAL TWIN (LEFT) + 1/3 FORENSIC PANEL (RIGHT) */}
      {activeUserRole === 'workspace' && (
      <div
        id="main-workspace-anchor"
        className={`main-workspace flex-1 min-h-0 w-full max-w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 items-stretch ${
          windowStates.map_viewport_2d_3d.isMinimized ? 'h-auto' : ''
        } overflow-visible lg:overflow-hidden transition-all duration-200`}
      >
        {/* LEFT/CENTER 2/3: Interactive 3D Three.js Scene / Google Maps / Split 2D+3D */}
        <div
          data-window-minimized={windowStates.map_viewport_2d_3d.isMinimized ? 'true' : 'false'}
          className={
            isMapOnlyMode || isFullscreen3D
              ? 'fixed inset-0 z-[120] w-screen h-screen bg-[#0F141D] flex flex-col overflow-hidden'
              : windowStates.map_viewport_2d_3d.isMinimized
              ? 'window-minimized-collapse lg:col-span-8 w-full min-w-0 h-auto min-h-0 self-start flex-none relative border-b lg:border-b-0 lg:border-r border-[#253042] flex flex-col transition-all duration-200'
              : 'lg:col-span-8 w-full min-w-0 h-full min-h-[540px] lg:min-h-0 relative border-b lg:border-b-0 lg:border-r border-[#253042] flex flex-col overflow-hidden transition-all duration-200'
          }
        >
          <WorkspaceViewportToolbar
            isMapOnlyMode={isMapOnlyMode}
            onSetMapOnlyMode={setIsMapOnlyMode}
            isFullscreen3D={isFullscreen3D}
            onToggleFullscreen3D={() => setIsFullscreen3D((v) => !v)}
            isMinimizeAllFocusActive={isMinimizeAllFocusActive}
            onToggleMinimizeAllExceptMapAndSidebar={handleToggleMinimizeAllExceptMapAndSidebar}
            effectiveDeviceEdition={effectiveDeviceEdition}
            effectiveOrientation={effectiveOrientation}
            liveViewportMetrics={liveViewportMetrics}
            deviceEditionSelection={deviceEditionSelection}
            onSelectDeviceEdition={setDeviceEditionSelection}
            orientationSelection={orientationSelection}
            onSelectOrientation={setOrientationSelection}
            currentWeather={currentWeather}
            weatherHours={weatherDataset.hours}
            selectedHourIndex={selectedHourIndex}
            onSelectHour={(hr) => {
              setSelectedHourIndex(hr);
              setPlumeRouteProgress(hr);
            }}
            observations={observations}
            sources={sources}
            selectedSourceId={selectedSourceId}
            isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
            manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
            onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
            viewportMode={viewportMode}
            onSelectViewportMode={setViewportMode}
            asbestosHeatmapActive={asbestosHeatmapActive}
            onSetAsbestosHeatmapActive={setAsbestosHeatmapActive}
            temporal24hAsbestosAccumulation={temporal24hAsbestosAccumulation}
            onSetTemporal24hAsbestosAccumulation={setTemporal24hAsbestosAccumulation}
            showLeewardWakeEffect={showLeewardWakeEffect}
            onToggleLeewardWakeEffect={() => setShowLeewardWakeEffect((v) => !v)}
            showWeatherCorrelationOverlay={showWeatherCorrelationOverlay}
            onToggleWeatherCorrelationOverlay={() => setShowWeatherCorrelationOverlay((v) => !v)}
            selectedDateIso={selectedDateIso}
            todayIso={todayIso}
            onChangeSimulatedDateIso={handleChangeSimulatedDateIso}
            onStepSimulatedHour={handleStepSimulatedHour}
            onFocusNoiseDustTab={() => setActiveTab('noiseDust')}
            showWorkspaceImpulseSensitivityGraph={showWorkspaceImpulseSensitivityGraph}
            onToggleWorkspaceImpulseSensitivityGraph={() =>
              setShowWorkspaceImpulseSensitivityGraph((v) => !v)
            }
            showWorkspaceVibrationSankey={showWorkspaceVibrationSankey}
            onToggleWorkspaceVibrationSankey={() =>
              setShowWorkspaceVibrationSankey((v) => !v)
            }
            autoSaveEvidenceOnTimeTravel={autoSaveEvidenceOnTimeTravel}
            autoSavedEvidenceCount={autoSavedEvidenceCount}
            onToggleAutoSaveEvidenceOnTimeTravel={() =>
              setAutoSaveEvidenceOnTimeTravel((v) => !v)
            }
            precipitationOverrideMm={precipitationOverrideMm}
            plumeDirectionDeg={plumeDirectionDeg}
            mapWindowState={windowStates.map_viewport_2d_3d}
            onToggleMinimizeMapWindow={() =>
              windowStates.map_viewport_2d_3d.isMinimized
                ? handleRestoreWindow('map_viewport_2d_3d')
                : handleMinimizeWindow('map_viewport_2d_3d')
            }
            onToggleFloatMapWindow={() =>
              windowStates.map_viewport_2d_3d.isFloating
                ? handleRestoreWindow('map_viewport_2d_3d')
                : handlePopOutFloatingWindow('map_viewport_2d_3d')
            }
            onOpenSourceReceptorModal={() => setIsSourceReceptorModalOpen(true)}
            buildings={buildings}
            activeCategoryFilters={activeCategoryFilters}
            onToggleCategoryFilter={handleToggleCategoryFilter}
            onResetCategoryFilters={handleResetCategoryFilters}
            onApplyBatchBuildingScenario={handleApplyBatchBuildingScenario}
            onFocusBlok12Percolation3D={() => {
              setViewportMode('underground_3d');
              setFocusBlok12PercolationTrigger((c) => c + 1);
            }}
            onOpenCategoryManagerInSubstances={() => setActiveTab('substances')}
            plumeZones={simulation.plumeZones}
            receptors={receptors}
            receptorExposures={receptorExposures}
            maxSiteSumQuotient={maxSiteSumQuotient}
            onSelectSource={(id) => setSelectedSourceId(id)}
            onToggleSourceActive={toggleSourceActive}
            hiddenSourceIds={hiddenSourceIds}
            onToggleSourceVisibility={handleToggleSourceVisibility}
            onShowAllSources={handleShowAllSources}
            visibleSubstances={visibleSubstances}
            onToggleSubstanceVisibility={handleToggleSubstanceVisibility}
            onSetAllSubstancesVisibility={handleSetAllSubstancesVisibility}
            showWindNoiseHeatmap={showWindNoiseHeatmapLayer}
            onToggleWindNoiseHeatmap={handleToggleWindNoiseHeatmapFromToolbar}
            onQuickSnapshot={handleQuickSnapshotFromToolbar}
            showPlumeConcentrationHeatmap={showPlumeConcentrationHeatmap}
            onTogglePlumeConcentrationHeatmap={handleTogglePlumeConcentrationHeatmapFromToolbar}
            plumeHeatmapPasquillThreshold={plumeHeatmapPasquillThreshold}
            onChangePlumeHeatmapPasquillThreshold={setPlumeHeatmapPasquillThreshold}
            showWeatherCorrelationHeatmap={showWeatherCorrelationHeatmapLayer}
            onToggleWeatherCorrelationHeatmap={handleToggleWeatherCorrelationHeatmapFromToolbar}
            isAnimatingPlumeRoute={isAnimatingPlumeRoute}
            onToggleAnimatePlumeRoute={handleToggleAnimatePlumeRoute}
            waterMainTelemetry={waterMainTelemetry}
            showWaterMainLayer={effectiveShowWaterMainLayer}
            onToggleWaterMainLayer={handleToggleWaterMainLayer}
            hasSteelRoadPlates={hasSteelRoadPlates}
            onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
            showLerBuffer={showLerBuffer}
            onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
            simulatedPipeRuptureActive={simulatedPipeRuptureActive}
            onToggleSimulatedPipeRupture={() => setSimulatedPipeRuptureActive((v) => !v)}
            waterMainCoordMode={waterMainCoordMode}
            onChangeWaterMainCoordMode={setWaterMainCoordMode}
            simultaneousDispatch={simultaneousAlgedonic.dispatch}
            manualSimultaneousScenario={simultaneousAlgedonic.manualScenarioOverride}
            onTriggerSimultaneousScenario={simultaneousAlgedonic.triggerScenarioSimulation}
            onOpenSimultaneousModal={() => simultaneousAlgedonic.setIsSplitModalOpen(true)}
            onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
            onClearSimultaneousSimulation={handleClearSimultaneousAll}
            pssInterlocks={pssInterlocks}
            onAcknowledgeAllPssInterlocks={handleAcknowledgeAllPssInterlocks}
            onResetPssInterlockAck={handleResetPssInterlockAck}
            pssCollectiveAckAtIso={pssCollectiveAckAtIso}
            system3InterlockLogs={system3InterlockLogs}
          />

          {/* Real-Time Spatial Alert System: 3D Plume Concentration Monitoring at 'Børnehave' Receptor Area */}
          {bornehavePlumeAlertStatus.isAlertActive && (
            <div
              role="alert"
              data-testid="bornehave-spatial-plume-alert-banner"
              className={`px-3 py-2 border-b font-mono text-[11px] tabular-nums flex flex-wrap items-center justify-between gap-2 shrink-0 ${
                bornehavePlumeAlertStatus.isCriticalAbove100Pct
                  ? 'bg-rose-950/90 border-rose-500/80 text-rose-100'
                  : 'bg-amber-950/85 border-amber-400/75 text-amber-100'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-extrabold uppercase shrink-0 ${
                    bornehavePlumeAlertStatus.isCriticalAbove100Pct
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-amber-400 text-slate-950 animate-pulse'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    BØRNEHAVE 3D-SPREDNINGSADVARSEL ({bornehavePlumeAlertStatus.pctOfPasquillThreshold.toFixed(0)}%)
                  </span>
                </span>
                <span className="font-semibold text-white">
                  {bornehavePlumeAlertStatus.receptorLabel} ({bornehavePlumeAlertStatus.address}):
                </span>
                <span>
                  Støvpartikler i 3D-fanen er{' '}
                  <strong className="text-amber-300">
                    {bornehavePlumeAlertStatus.dustConcentrationUgM3.toFixed(1)} µg/m³
                  </strong>{' '}
                  ({bornehavePlumeAlertStatus.pctOfPasquillThreshold.toFixed(1)}% af Pasquill-{bornehavePlumeAlertStatus.pasquillClass} tærskel på{' '}
                  {bornehavePlumeAlertStatus.pasquillThresholdUgM3} µg/m³ &gt; 50%) · Asbest:{' '}
                  <strong className="text-rose-200">
                    {bornehavePlumeAlertStatus.asbestosFibersCm3.toFixed(4)} f/cm³
                  </strong>{' '}
                  · Kilde:{' '}
                  <strong className="text-cyan-300">{bornehavePlumeAlertStatus.dominantSourceCode}</strong>
                </span>
              </div>

              <button
                type="button"
                data-testid="bornehave-spatial-alert-focus-btn"
                onClick={() => {
                  setSelectedReceptorId(bornehavePlumeAlertStatus.receptorId);
                  setActiveTab('substances');
                }}
                className="px-2.5 py-1 rounded bg-[#0F141D]/90 hover:bg-amber-400 hover:text-slate-950 border border-amber-400/60 text-amber-200 font-bold cursor-pointer shrink-0 transition-colors"
              >
                Fokus Børnehave
              </button>
            </div>
          )}

          {/* Automatic Noise-Violation Compliance Report Prompt (generates SHA-256 PDF & appends to Evidence Log) */}
          {!isMapOnlyMode && !isFullscreen3D && !isMinimizeAllFocusActive && (
            <AutoNoiseViolationPromptModal
              dateIso={weatherDataset.dateIso}
              currentWeather={currentWeather}
              legalViolations={legalViolations}
              receptorExposures={receptorExposures}
              sources={sources}
              machineNoiseOutputDb={manualMachineNoiseOutputDb}
              isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
              onAppendPdfEvidenceToLog={handleRegisterPdfEvidenceObservation}
              onOpenEvidenceLogTab={() => setActiveTab('algedonic')}
            />
          )}

          {/* Active Visualization Canvas Area (unmounted when minimized or popped out to FloatingDraggableWindow) */}
          {windowStates.map_viewport_2d_3d.isMinimized ? (
            <div className="p-4 bg-[var(--surface-panel)] border-b border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono text-[var(--text-primary)]">
              <span className="inline-flex items-center gap-1.5">
                <MapIcon className="w-4 h-4 text-[var(--status-action-text)] shrink-0" />
                <span>Kort &amp; 3D Digital Tvilling Viewport er minimeret</span>
              </span>
              <button
                type="button"
                onClick={() => handleRestoreWindow('map_viewport_2d_3d')}
                className="px-3 py-1 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 font-bold hover:bg-emerald-500/30 cursor-pointer"
              >
                Gendan Kort-Vindue
              </button>
            </div>
          ) : windowStates.map_viewport_2d_3d.isFloating ? (
            <div
              data-window-id="map_viewport_2d_3d"
              data-window-floating="true"
              className="p-3 bg-[#1B2433] border-b border-dashed border-[#36465E] flex items-center justify-between gap-2 text-xs font-mono text-slate-200"
            >
              <span className="inline-flex items-center gap-2 min-w-0 truncate">
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[11px] truncate">
                  Vinduet (<strong className="text-white">Kort-Siden &amp; Heatmaps</strong>) vises som flydende panel
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleRestoreWindow('map_viewport_2d_3d')}
                className="px-2.5 py-1 rounded bg-[#212C3E] hover:bg-slate-700 border border-[#36465E] text-cyan-300 text-[11px] font-semibold shrink-0 cursor-pointer"
              >
                Fastgør her
              </button>
            </div>
          ) : (
          <div className="flex-1 min-h-[480px] lg:min-h-0 relative grid grid-cols-1 grid-rows-1 overflow-hidden">
            {(viewportMode === '3d' || viewportMode === 'underground_3d') && (
              <Ringparken3DScene
                sources={sources}
                receptors={receptors}
                buildings={buildings}
                activeCategoryFilters={activeCategoryFilters}
                onToggleCategoryFilter={handleToggleCategoryFilter}
                onChangeBuildingCategory={handleChangeBuildingCategory}
                plumeZones={simulation.plumeZones}
                receptorExposures={receptorExposures}
                currentWeather={currentWeather}
                observations={observations}
                selectedSourceId={selectedSourceId}
                selectedReceptorId={selectedReceptorId}
                onSelectSource={(id) => {
                  setSelectedSourceId(id);
                  setActiveTab('substances');
                }}
                onSelectReceptor={(id) => {
                  setSelectedReceptorId(id);
                }}
                onToggleSourceActive={toggleSourceActive}
                isFullscreen3D={isFullscreen3D}
                onToggleFullscreen3D={() => setIsFullscreen3D((v) => !v)}
                isMapOnly={isMapOnlyMode}
                onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                undergroundMode={viewportMode === 'underground_3d'}
                onToggleUndergroundMode={(next) => {
                  const active = next !== undefined ? next : viewportMode !== 'underground_3d';
                  setViewportMode(active ? 'underground_3d' : '3d');
                }}
                precipitationOverrideMm={precipitationOverrideMm}
                onChangePrecipitationOverride={setPrecipitationOverrideMm}
                onSwitchTo2DPercolation={() => setViewportMode('underground_2d')}
                asbestosHeatmapActive={asbestosHeatmapActive}
                onToggleAsbestosHeatmap={setAsbestosHeatmapActive}
                asbestosSourceScope={asbestosSourceScope}
                onChangeAsbestosSourceScope={setAsbestosSourceScope}
                asbestosEvalHeightMeters={asbestosEvalHeightMeters}
                onChangeAsbestosEvalHeightMeters={setAsbestosEvalHeightMeters}
                weatherHours={weatherDataset.hours}
                temporal24hAsbestosAccumulation={temporal24hAsbestosAccumulation}
                onToggleTemporal24hAsbestosAccumulation={setTemporal24hAsbestosAccumulation}
                showLeewardWakeEffect={showLeewardWakeEffect}
                onToggleLeewardWakeEffect={setShowLeewardWakeEffect}
                showWeatherCorrelationOverlay={showWeatherCorrelationOverlay}
                onToggleWeatherCorrelationOverlay={setShowWeatherCorrelationOverlay}
                timelineSliderProgress={plumeRouteProgress}
                show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                onToggle3DNeutralPressurePlane={setShow3DNeutralPressurePlane}
                neutralPressurePlaneHeightMeters={neutralPressurePlaneHeightMeters}
                onChangeNeutralPressurePlaneHeightMeters={setNeutralPressurePlaneHeightMeters}
                machineNoiseOutputDb={
                  isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : undefined
                }
                selectedDateIso={selectedDateIso}
                onChangeDateIso={handleChangeSimulatedDateIso}
                onStepHour={handleStepSimulatedHour}
                focusBlok12PercolationTrigger={focusBlok12PercolationTrigger}
                simulationSpeedMultiplier={simulationSpeedMultiplier}
                hiddenSourceIds={hiddenSourceIds}
                visibleSubstances={visibleSubstances}
                onBornehavePlumeAlertUpdate={setLive3DBornehavePlumeAlert}
                waterMainTelemetry={waterMainTelemetry}
                showWaterMainLayer={effectiveShowWaterMainLayer}
                onToggleWaterMainLayer={handleToggleWaterMainLayer}
                showLerBuffer={showLerBuffer}
                onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                hasSteelRoadPlates={hasSteelRoadPlates}
                onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                onToggleSimulatedPipeRupture={() => setSimulatedPipeRuptureActive((v) => !v)}
                isS3ValveLockoutActive={isS3ValveLockoutActive}
                onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                onRestoreAllMachinery={handleRestoreAllMachinery}
                virtualLeakPinPoint={virtualLeakPinPoint}
                virtualLeakImpact={virtualLeakImpact}
                onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                simultaneousDispatch={simultaneousAlgedonic.dispatch}
              />
            )}

            {viewportMode === 'underground_2d' && (
              <UndergroundPercolation2D
                sources={sources}
                receptors={receptors}
                currentWeather={currentWeather}
                selectedSourceId={selectedSourceId}
                onSelectSource={(id) => {
                  setSelectedSourceId(id);
                }}
                precipitationOverrideMm={precipitationOverrideMm}
                onChangePrecipitationOverride={setPrecipitationOverrideMm}
                onSwitchTo3DUnderground={() => setViewportMode('underground_3d')}
                onSwitchToSplitUnderground={() => setViewportMode('underground_split')}
                isMapOnly={isMapOnlyMode}
                onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                isFullscreen={isFullscreen3D}
                selectedDateIso={selectedDateIso}
                onChangeDateIso={handleChangeSimulatedDateIso}
                onStepHour={handleStepSimulatedHour}
                hiddenSourceIds={hiddenSourceIds}
                waterMainTelemetry={waterMainTelemetry}
                showWaterMainLayer={effectiveShowWaterMainLayer}
                onToggleWaterMainLayer={handleToggleWaterMainLayer}
                showLerBuffer={showLerBuffer}
                onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                hasSteelRoadPlates={hasSteelRoadPlates}
                onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                onToggleSimulatedPipeRupture={() => setSimulatedPipeRuptureActive((v) => !v)}
                isS3ValveLockoutActive={isS3ValveLockoutActive}
                onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                onToggleSourceActive={toggleSourceActive}
                onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                onRestoreAllMachinery={handleRestoreAllMachinery}
                hasVirtualLeakPin={Boolean(virtualLeakPinPoint)}
                virtualLeakImpact={virtualLeakImpact}
                onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                simultaneousDispatch={simultaneousAlgedonic.dispatch}
                onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
                manualMachineNoiseOutputDb={
                  isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114
                }
              />
            )}

            {viewportMode === 'underground_split' && (
              <div className="w-full h-full grid grid-cols-1 xl:grid-cols-2 min-h-0 overflow-hidden divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
                <div className="w-full h-full min-h-[260px] relative overflow-hidden">
                  <UndergroundPercolation2D
                    sources={sources}
                    receptors={receptors}
                    currentWeather={currentWeather}
                    selectedSourceId={selectedSourceId}
                    onSelectSource={(id) => {
                      setSelectedSourceId(id);
                    }}
                    precipitationOverrideMm={precipitationOverrideMm}
                    onChangePrecipitationOverride={setPrecipitationOverrideMm}
                    onSwitchTo3DUnderground={() => setViewportMode('underground_3d')}
                    isCompactSplit
                    isMapOnly={isMapOnlyMode}
                    onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                    isFullscreen={isFullscreen3D}
                    selectedDateIso={selectedDateIso}
                    onChangeDateIso={handleChangeSimulatedDateIso}
                    onStepHour={handleStepSimulatedHour}
                    hiddenSourceIds={hiddenSourceIds}
                    waterMainTelemetry={waterMainTelemetry}
                    showWaterMainLayer={effectiveShowWaterMainLayer}
                    onToggleWaterMainLayer={handleToggleWaterMainLayer}
                    showLerBuffer={showLerBuffer}
                    onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                    hasSteelRoadPlates={hasSteelRoadPlates}
                    onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                    simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                    onToggleSimulatedPipeRupture={() => setSimulatedPipeRuptureActive((v) => !v)}
                    isS3ValveLockoutActive={isS3ValveLockoutActive}
                    onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                    onToggleSourceActive={toggleSourceActive}
                    onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                    onRestoreAllMachinery={handleRestoreAllMachinery}
                    hasVirtualLeakPin={Boolean(virtualLeakPinPoint)}
                    virtualLeakImpact={virtualLeakImpact}
                    onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                    simultaneousDispatch={simultaneousAlgedonic.dispatch}
                    onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
                    manualMachineNoiseOutputDb={
                      isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114
                    }
                  />
                </div>
                <div className="w-full h-full min-h-[260px] relative overflow-hidden">
                  <Ringparken3DScene
                    sources={sources}
                    receptors={receptors}
                    buildings={buildings}
                    activeCategoryFilters={activeCategoryFilters}
                    onToggleCategoryFilter={handleToggleCategoryFilter}
                    onChangeBuildingCategory={handleChangeBuildingCategory}
                    plumeZones={simulation.plumeZones}
                    receptorExposures={receptorExposures}
                    currentWeather={currentWeather}
                    observations={observations}
                    selectedSourceId={selectedSourceId}
                    selectedReceptorId={selectedReceptorId}
                    onSelectSource={(id) => {
                      setSelectedSourceId(id);
                      setActiveTab('substances');
                    }}
                    onSelectReceptor={(id) => {
                      setSelectedReceptorId(id);
                    }}
                    onToggleSourceActive={toggleSourceActive}
                    isFullscreen3D={isFullscreen3D}
                    onToggleFullscreen3D={() => setIsFullscreen3D((v) => !v)}
                    isMapOnly={isMapOnlyMode}
                    onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                    undergroundMode={true}
                    onToggleUndergroundMode={(next) => {
                      if (next === false) setViewportMode('3d');
                    }}
                    precipitationOverrideMm={precipitationOverrideMm}
                    onChangePrecipitationOverride={setPrecipitationOverrideMm}
                    onSwitchTo2DPercolation={() => setViewportMode('underground_2d')}
                    asbestosHeatmapActive={asbestosHeatmapActive}
                    onToggleAsbestosHeatmap={setAsbestosHeatmapActive}
                    asbestosSourceScope={asbestosSourceScope}
                    onChangeAsbestosSourceScope={setAsbestosSourceScope}
                    asbestosEvalHeightMeters={asbestosEvalHeightMeters}
                    onChangeAsbestosEvalHeightMeters={setAsbestosEvalHeightMeters}
                    weatherHours={weatherDataset.hours}
                    temporal24hAsbestosAccumulation={temporal24hAsbestosAccumulation}
                    onToggleTemporal24hAsbestosAccumulation={setTemporal24hAsbestosAccumulation}
                    showLeewardWakeEffect={showLeewardWakeEffect}
                    onToggleLeewardWakeEffect={setShowLeewardWakeEffect}
                    showWeatherCorrelationOverlay={showWeatherCorrelationOverlay}
                    onToggleWeatherCorrelationOverlay={setShowWeatherCorrelationOverlay}
                    timelineSliderProgress={plumeRouteProgress}
                    show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                    onToggle3DNeutralPressurePlane={setShow3DNeutralPressurePlane}
                    neutralPressurePlaneHeightMeters={neutralPressurePlaneHeightMeters}
                    onChangeNeutralPressurePlaneHeightMeters={setNeutralPressurePlaneHeightMeters}
                    machineNoiseOutputDb={
                      isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : undefined
                    }
                    selectedDateIso={selectedDateIso}
                    onChangeDateIso={handleChangeSimulatedDateIso}
                    onStepHour={handleStepSimulatedHour}
                    focusBlok12PercolationTrigger={focusBlok12PercolationTrigger}
                    simulationSpeedMultiplier={simulationSpeedMultiplier}
                    hiddenSourceIds={hiddenSourceIds}
                    visibleSubstances={visibleSubstances}
                    onBornehavePlumeAlertUpdate={setLive3DBornehavePlumeAlert}
                    waterMainTelemetry={waterMainTelemetry}
                    showWaterMainLayer={effectiveShowWaterMainLayer}
                    onToggleWaterMainLayer={handleToggleWaterMainLayer}
                    showLerBuffer={showLerBuffer}
                    onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                    hasSteelRoadPlates={hasSteelRoadPlates}
                    onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                    simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                    onToggleSimulatedPipeRupture={() => setSimulatedPipeRuptureActive((v) => !v)}
                    isS3ValveLockoutActive={isS3ValveLockoutActive}
                    onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                    onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                    onRestoreAllMachinery={handleRestoreAllMachinery}
                    virtualLeakPinPoint={virtualLeakPinPoint}
                    virtualLeakImpact={virtualLeakImpact}
                    onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                    simultaneousDispatch={simultaneousAlgedonic.dispatch}
                  />
                </div>
              </div>
            )}

            {viewportMode === '2d' && (
              <DispersionMap
                sources={sources}
                receptors={receptors}
                buildings={buildings}
                activeCategoryFilters={activeCategoryFilters}
                onChangeBuildingCategory={handleChangeBuildingCategory}
                plumeZones={simulation.plumeZones}
                receptorExposures={receptorExposures}
                currentWeather={currentWeather}
                isPuffMode={isPuffMode}
                puff24h={puff24h}
                observations={observations}
                selectedObservationId={selectedObservationId}
                pendingObservationPoint={
                  activeTab === 'algedonic' || mapClickMode === 'add_observation'
                    ? pendingObservationPoint
                    : null
                }
                onSelectObservation={handleSelectMapObservation}
                selectedSourceId={selectedSourceId}
                selectedReceptorId={selectedReceptorId}
                onSelectSource={handleSelectMapSource}
                onSelectReceptor={handleSelectMapReceptor}
                mapClickMode={mapClickMode}
                onSetMapClickMode={handleSetMapClickModeFromMap}
                onMapAddNode={handleMapAddNode}
                onSelectHourFromPeak={handleSelectHourFromPeak}
                isAnimatingPlumeRoute={isAnimatingPlumeRoute}
                plumeRouteProgress={plumeRouteProgress}
                onToggleAnimatePlumeRoute={handleToggleAnimatePlumeRoute}
                showHeatmapComparison={showHeatmapComparison}
                onToggleHeatmapComparison={handleToggleHeatmapComparison}
                heatmapComparison={heatmapComparison}
                heatmapComparisonViewMode={heatmapComparisonViewMode}
                onChangeHeatmapComparisonViewMode={setHeatmapComparisonViewMode}
                weatherHours={weatherDataset.hours}
                comparisonHourAIndex={comparisonHourAIndex}
                comparisonHourBIndex={selectedHourIndex}
                onChangeComparisonHourA={setComparisonHourAIndex}
                onChangeComparisonHourB={setSelectedHourIndex}
                isFullscreen={isFullscreen3D}
                onToggleFullscreen={handleToggleFullscreen3D}
                fullscreenLabel="Fuld Skærm (2D Taktisk)"
                isMapOnly={isMapOnlyMode}
                onToggleMapOnly={handleToggleMapOnlyMode}
                onToggleCategoryFilter={handleToggleCategoryFilter}
                onSaveMapSnapshotObservation={handleSaveMapSnapshotObservation}
                selectedDateIso={selectedDateIso}
                onChangeDateIso={handleChangeSimulatedDateIso}
                myceliumSnapshot={myceliumSnapshot}
                hiddenSourceIds={hiddenSourceIds}
                visibleSubstances={visibleSubstances}
                onChangeVisibleSubstances={setVisibleSubstances}
                showWindNoiseHeatmap={showWindNoiseHeatmapLayer}
                onToggleWindNoiseHeatmap={handleToggleWindNoiseHeatmapFromMap}
                showPlumeConcentrationHeatmap={showPlumeConcentrationHeatmap}
                onTogglePlumeConcentrationHeatmap={handleTogglePlumeConcentrationHeatmapFromMap}
                plumeHeatmapPasquillThreshold={plumeHeatmapPasquillThreshold}
                showWeatherCorrelationHeatmap={showWeatherCorrelationHeatmapLayer}
                onToggleWeatherCorrelationHeatmap={handleToggleWeatherCorrelationHeatmapFromMap}
                waterMainTelemetry={waterMainTelemetry}
                showWaterMainLayer={effectiveShowWaterMainLayer}
                onToggleWaterMainLayer={handleToggleWaterMainLayer}
                showLerBuffer={showLerBuffer}
                onToggleLerBuffer={handleToggleLerBuffer}
                hasSteelRoadPlates={hasSteelRoadPlates}
                onToggleSteelRoadPlates={handleToggleSteelRoadPlates}
                simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                onToggleSimulatedPipeRupture={handleToggleSimulatedPipeRupture}
                isS3ValveLockoutActive={isS3ValveLockoutActive}
                onToggleS3ValveLockout={handleToggleS3ValveLockout}
                onToggleSourceActive={toggleSourceActive}
                onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                onRestoreAllMachinery={handleRestoreAllMachinery}
                virtualLeakPinPoint={virtualLeakPinPoint}
                virtualLeakImpact={virtualLeakImpact}
                onChangeVirtualLeakPinPoint={setVirtualLeakPinPoint}
                onLogWaterMainObservation={handleLogWaterMainObservation}
                simultaneousDispatch={simultaneousAlgedonic.dispatch}
                onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
                onOpenSimultaneousModal={handleOpenSimultaneousModal}
                machineNoiseOutputDb={
                  isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : undefined
                }
              />
            )}

            {viewportMode === 'split' && (
              <div className="w-full h-full grid grid-cols-1 xl:grid-cols-2 min-h-0 overflow-hidden divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
                <div className="w-full h-full min-h-[260px] relative overflow-hidden">
                  <DispersionMap
                    sources={sources}
                    receptors={receptors}
                    buildings={buildings}
                    activeCategoryFilters={activeCategoryFilters}
                    onToggleCategoryFilter={handleToggleCategoryFilter}
                    onChangeBuildingCategory={handleChangeBuildingCategory}
                    plumeZones={simulation.plumeZones}
                    receptorExposures={receptorExposures}
                    currentWeather={currentWeather}
                    isPuffMode={isPuffMode}
                    puff24h={puff24h}
                    observations={observations}
                    selectedObservationId={selectedObservationId}
                    pendingObservationPoint={
                      activeTab === 'algedonic' || mapClickMode === 'add_observation'
                        ? pendingObservationPoint
                        : null
                    }
                    onSelectObservation={handleSelectMapObservation}
                    selectedSourceId={selectedSourceId}
                    selectedReceptorId={selectedReceptorId}
                    onSelectSource={handleSelectMapSource}
                    onSelectReceptor={handleSelectMapReceptor}
                    mapClickMode={mapClickMode}
                    onSetMapClickMode={handleSetMapClickModeFromMap}
                    onMapAddNode={handleMapAddNode}
                    onSelectHourFromPeak={handleSelectHourFromPeak}
                    isAnimatingPlumeRoute={isAnimatingPlumeRoute}
                    plumeRouteProgress={plumeRouteProgress}
                    onToggleAnimatePlumeRoute={handleToggleAnimatePlumeRoute}
                    showHeatmapComparison={showHeatmapComparison}
                    onToggleHeatmapComparison={handleToggleHeatmapComparison}
                    heatmapComparison={heatmapComparison}
                    heatmapComparisonViewMode={heatmapComparisonViewMode}
                    onChangeHeatmapComparisonViewMode={setHeatmapComparisonViewMode}
                    weatherHours={weatherDataset.hours}
                    comparisonHourAIndex={comparisonHourAIndex}
                    comparisonHourBIndex={selectedHourIndex}
                    onChangeComparisonHourA={setComparisonHourAIndex}
                    onChangeComparisonHourB={setSelectedHourIndex}
                    isFullscreen={isFullscreen3D}
                    onToggleFullscreen={handleToggleFullscreen3D}
                    fullscreenLabel="Fuld Skærm (2D/3D Split)"
                    isMapOnly={isMapOnlyMode}
                    onToggleMapOnly={handleToggleMapOnlyMode}
                    onSaveMapSnapshotObservation={handleSaveMapSnapshotObservation}
                    selectedDateIso={selectedDateIso}
                    onChangeDateIso={handleChangeSimulatedDateIso}
                    myceliumSnapshot={myceliumSnapshot}
                    hiddenSourceIds={hiddenSourceIds}
                    visibleSubstances={visibleSubstances}
                    onChangeVisibleSubstances={setVisibleSubstances}
                    showWindNoiseHeatmap={showWindNoiseHeatmapLayer}
                    onToggleWindNoiseHeatmap={handleToggleWindNoiseHeatmapFromMap}
                    showPlumeConcentrationHeatmap={showPlumeConcentrationHeatmap}
                    onTogglePlumeConcentrationHeatmap={handleTogglePlumeConcentrationHeatmapFromMap}
                    plumeHeatmapPasquillThreshold={plumeHeatmapPasquillThreshold}
                    showWeatherCorrelationHeatmap={showWeatherCorrelationHeatmapLayer}
                    onToggleWeatherCorrelationHeatmap={handleToggleWeatherCorrelationHeatmapFromMap}
                    waterMainTelemetry={waterMainTelemetry}
                    showWaterMainLayer={effectiveShowWaterMainLayer}
                    onToggleWaterMainLayer={handleToggleWaterMainLayer}
                    showLerBuffer={showLerBuffer}
                    onToggleLerBuffer={handleToggleLerBuffer}
                    hasSteelRoadPlates={hasSteelRoadPlates}
                    onToggleSteelRoadPlates={handleToggleSteelRoadPlates}
                    simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                    onToggleSimulatedPipeRupture={handleToggleSimulatedPipeRupture}
                    isS3ValveLockoutActive={isS3ValveLockoutActive}
                    onToggleS3ValveLockout={handleToggleS3ValveLockout}
                    onToggleSourceActive={toggleSourceActive}
                    onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                    onRestoreAllMachinery={handleRestoreAllMachinery}
                    virtualLeakPinPoint={virtualLeakPinPoint}
                    virtualLeakImpact={virtualLeakImpact}
                    onChangeVirtualLeakPinPoint={setVirtualLeakPinPoint}
                    onLogWaterMainObservation={handleLogWaterMainObservation}
                    simultaneousDispatch={simultaneousAlgedonic.dispatch}
                    onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
                    onOpenSimultaneousModal={handleOpenSimultaneousModal}
                    machineNoiseOutputDb={
                      isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : undefined
                    }
                  />
                </div>
                <div className="w-full h-full min-h-[260px] relative overflow-hidden">
                  <Ringparken3DScene
                    sources={sources}
                    receptors={receptors}
                    buildings={buildings}
                    activeCategoryFilters={activeCategoryFilters}
                    onToggleCategoryFilter={handleToggleCategoryFilter}
                    onChangeBuildingCategory={handleChangeBuildingCategory}
                    plumeZones={simulation.plumeZones}
                    receptorExposures={receptorExposures}
                    currentWeather={currentWeather}
                    observations={observations}
                    selectedSourceId={selectedSourceId}
                    selectedReceptorId={selectedReceptorId}
                    onSelectSource={(id) => {
                      setSelectedSourceId(id);
                      setActiveTab('substances');
                    }}
                    onSelectReceptor={(id) => {
                      setSelectedReceptorId(id);
                    }}
                    onToggleSourceActive={toggleSourceActive}
                    isFullscreen3D={isFullscreen3D}
                    onToggleFullscreen3D={() => setIsFullscreen3D((v) => !v)}
                    isMapOnly={isMapOnlyMode}
                    onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                    precipitationOverrideMm={precipitationOverrideMm}
                    onChangePrecipitationOverride={setPrecipitationOverrideMm}
                    onSwitchTo2DPercolation={() => setViewportMode('underground_2d')}
                    asbestosHeatmapActive={asbestosHeatmapActive}
                    onToggleAsbestosHeatmap={setAsbestosHeatmapActive}
                    asbestosSourceScope={asbestosSourceScope}
                    onChangeAsbestosSourceScope={setAsbestosSourceScope}
                    asbestosEvalHeightMeters={asbestosEvalHeightMeters}
                    onChangeAsbestosEvalHeightMeters={setAsbestosEvalHeightMeters}
                    weatherHours={weatherDataset.hours}
                    temporal24hAsbestosAccumulation={temporal24hAsbestosAccumulation}
                    onToggleTemporal24hAsbestosAccumulation={setTemporal24hAsbestosAccumulation}
                    showLeewardWakeEffect={showLeewardWakeEffect}
                    onToggleLeewardWakeEffect={setShowLeewardWakeEffect}
                    showWeatherCorrelationOverlay={showWeatherCorrelationOverlay}
                    onToggleWeatherCorrelationOverlay={setShowWeatherCorrelationOverlay}
                    timelineSliderProgress={plumeRouteProgress}
                    show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                    onToggle3DNeutralPressurePlane={setShow3DNeutralPressurePlane}
                    neutralPressurePlaneHeightMeters={neutralPressurePlaneHeightMeters}
                    onChangeNeutralPressurePlaneHeightMeters={setNeutralPressurePlaneHeightMeters}
                    machineNoiseOutputDb={
                      isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : undefined
                    }
                    selectedDateIso={selectedDateIso}
                    onChangeDateIso={handleChangeSimulatedDateIso}
                    onStepHour={handleStepSimulatedHour}
                    focusBlok12PercolationTrigger={focusBlok12PercolationTrigger}
                    simulationSpeedMultiplier={simulationSpeedMultiplier}
                    hiddenSourceIds={hiddenSourceIds}
                    visibleSubstances={visibleSubstances}
                    onBornehavePlumeAlertUpdate={setLive3DBornehavePlumeAlert}
                    waterMainTelemetry={waterMainTelemetry}
                    showWaterMainLayer={effectiveShowWaterMainLayer}
                    onToggleWaterMainLayer={handleToggleWaterMainLayer}
                    showLerBuffer={showLerBuffer}
                    onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                    hasSteelRoadPlates={hasSteelRoadPlates}
                    onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                    simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                    onToggleSimulatedPipeRupture={() => setSimulatedPipeRuptureActive((v) => !v)}
                    isS3ValveLockoutActive={isS3ValveLockoutActive}
                    onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                    onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                    onRestoreAllMachinery={handleRestoreAllMachinery}
                    virtualLeakPinPoint={virtualLeakPinPoint}
                    virtualLeakImpact={virtualLeakImpact}
                    onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                    simultaneousDispatch={simultaneousAlgedonic.dispatch}
                  />
                </div>
              </div>
            )}
            {viewportMode === 'risk_gis' && (
              <div className="w-full h-full min-h-[480px] overflow-y-auto">
                <RiskZoneMap
                  initialWindFromDeg={currentWeather.windDirection10m}
                  initialWindSpeedMs={currentWeather.windSpeed10m}
                  initialIsDryWeather={
                    (precipitationOverrideMm ?? currentWeather.precipitation) < 0.2
                  }
                  initialSelectedBuildingId={focusedGisBuildingId ?? 'blok-2-kierulffsvej-24-32'}
                />
              </div>
            )}
            {simultaneousAlgedonic.dispatch.active && !isMapOnlyMode && (
              <div className="pointer-events-none absolute top-3 left-3 right-3 z-30 flex justify-center">
                <div className="w-full max-w-[780px]">
                  <SimultaneousAlgedonicSplitHud
                    dispatch={simultaneousAlgedonic.dispatch}
                    audioMuted={simultaneousAlgedonic.audioMuted}
                    onToggleAudioMuted={simultaneousAlgedonic.toggleAudioMuted}
                    onAcknowledgeP1={simultaneousAlgedonic.acknowledgeP1}
                    onOpenSplitModal={() => simultaneousAlgedonic.setIsSplitModalOpen(true)}
                    onClearSimulation={handleClearSimultaneousAll}
                  />
                </div>
              </div>
            )}
            {!isMapOnlyMode &&
              asbestosHeatmapActive &&
              (viewportMode === '3d' || viewportMode === 'split') && (
                <AsbestosHeatmapHudOverlay
                  currentHourLabel={currentWeather.hourLabel}
                  temporal24hAsbestosAccumulation={temporal24hAsbestosAccumulation}
                  onSetTemporal24hAsbestosAccumulation={setTemporal24hAsbestosAccumulation}
                  onDisableHeatmap={() => setAsbestosHeatmapActive(false)}
                />
              )}
          </div>
          )}

          {/* Vibrations-Sankey Widget inside #main-workspace-anchor (Entreprenørmaskiner -> Fundamenter & PPV) */}
          {showWorkspaceVibrationSankey && !isFullscreen3D && !isMapOnlyMode && (
            <section
              data-testid="workspace-vibration-sankey-widget"
              aria-label="Vibrations-Sankey energistrøm fra entreprenørmaskiner til fundamenter"
              className="shrink-0 bg-[#0B111C] border-t border-[#253042]"
            >
              <div className="px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 bg-[#0F1624] border-b border-slate-800/80">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 whitespace-nowrap">
                    Vibrations-Sankey
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    Energistrøm · Entreprenørmaskiner → Jord/Køreplade → Fundamenter &amp; DN200 PPV
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-mono font-bold tabular-nums whitespace-nowrap ${
                      waterMainTelemetry.pipePpvMmPerSec >= 25
                        ? 'text-red-300'
                        : waterMainTelemetry.pipePpvMmPerSec >= 22.5
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    PPV {waterMainTelemetry.pipePpvMmPerSec.toFixed(1)} mm/s
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsWorkspaceVibrationSankeyCollapsed((v) => !v)}
                    className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px] font-semibold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isWorkspaceVibrationSankeyCollapsed ? 'Vis graf' : 'Minimer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWorkspaceVibrationSankey(false)}
                    className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px] font-semibold text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Luk
                  </button>
                </div>
              </div>
              {!isWorkspaceVibrationSankeyCollapsed && (
                <div className="max-h-[240px] overflow-y-auto p-2.5">
                  <WaterMainVibrationSankeyWidget
                    compact
                    waterMainTelemetry={waterMainTelemetry}
                    sources={sources}
                    manualMachineNoiseOutputDb={
                      isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114
                    }
                  />
                </div>
              )}
            </section>
          )}

          {/* Interactive Impulse-Noise Sensitivity Graph (v > 10 m/s <-> L_Aeq,korr & Real-Time Hourly Exceedances) inside #main-workspace-anchor */}
          {showWorkspaceImpulseSensitivityGraph && !isFullscreen3D && !isMapOnlyMode && (
            <div className="shrink-0 max-h-[38%] overflow-y-auto p-2.5 bg-[#0F141D] border-t border-[#253042]">
              <MachineImpulseWindSensitivityWidget
                sources={sources}
                receptors={receptors}
                selectedSourceId={selectedSourceId}
                selectedReceptorId={selectedReceptorId}
                onSelectSource={(id) => setSelectedSourceId(id)}
                onSelectReceptor={(id) => setSelectedReceptorId(id)}
                weatherHours={weatherDataset.hours}
                selectedHourIndex={selectedHourIndex}
                onSelectHour={(hr) => {
                  setSelectedHourIndex(hr);
                  setPlumeRouteProgress(hr);
                }}
                selectedDateIso={selectedDateIso}
                machineNoiseOutputDb={manualMachineNoiseOutputDb}
                isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
                onChangeMachineNoiseOutputDb={(nextDb) => {
                  setIsManualMachineNoiseOverrideActive(true);
                  setManualMachineNoiseOutputDb(nextDb);
                }}
                onTrigger3DImpulseWaves={() => {
                  if (viewportMode !== '3d' && viewportMode !== 'split') {
                    setViewportMode('3d');
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* RIGHT 1/3: Forensic Analysis, Algedonic Signal, Substance Breakdown, 24h Puff & Legal Panel */}
        <aside
          onPointerDownCapture={(e) => {
            const winEl = (e.target as HTMLElement).closest('[data-window-id]');
            const winId = winEl?.getAttribute('data-window-id') as DashboardWindowId | null;
            if (winId && winId in DASHBOARD_WINDOW_REGISTRY) {
              setActiveSidebarAnalysisWindowId(winId);
            }
          }}
          className="sidebar lg:col-span-4 w-full min-w-0 h-full min-h-0 bg-[var(--surface-panel)] flex flex-col overflow-hidden"
        >
          <RightSidebarHeaderChrome
            selectedReceptorExposure={selectedReceptorExposure}
            receptorExposures={receptorExposures}
            onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
            observations={observations}
            legalViolations={legalViolations}
            isSidebarMinimizeOthersActive={isSidebarMinimizeOthersActive}
            onToggleSidebarMinimizeAllExceptActive={handleToggleSidebarMinimizeAllExceptActive}
            effectiveActiveSidebarWindowId={effectiveActiveSidebarWindowId}
            onSelectActiveAnalysisWindow={handleSelectActiveAnalysisWindow}
            currentTabWindowIds={currentTabWindowIds}
            allSidebarWindowEntries={allSidebarWindowEntries}
            onOpenWindNoiseCorrelationDocked={() => {
              setActiveTab('noiseDust');
              setActiveSidebarAnalysisWindowId('wind_noise_correlation');
              setWindowStates((prev) => ({
                ...prev,
                wind_noise_correlation: {
                  ...prev.wind_noise_correlation,
                  isMinimized: false,
                  isFloating: false,
                },
              }));
            }}
            onFloatWindNoiseCorrelationWindow={() => {
              setActiveSidebarAnalysisWindowId('wind_noise_correlation');
              handlePopOutFloatingWindow('wind_noise_correlation');
            }}
            acousticDustWarningEnabled={acousticDustWarningEnabled}
            onToggleAcousticDustWarning={() => setAcousticDustWarningEnabled((v) => !v)}
            onTestAcousticDustWarningTone={() => {
              hasUserAudioGestureRef.current = true;
              playAcousticDustDispersionWarningTone(
                Math.max(0.88, maxSiteSumQuotient),
                Math.max(10.8, currentWeather.windSpeed10m),
                selectedReceptorExposure.receptorName,
                true
              );
            }}
            maxSiteSumQuotient={maxSiteSumQuotient}
            indoorSumQuotientSin={indoorClimateTelemetry.indoorSumQuotientSin}
            last6HoursSparklinePoints={last6HoursSparklinePoints}
            onSelectHour={(hr) => {
              setSelectedHourIndex(hr);
              setPlumeRouteProgress(hr);
            }}
            batchAddFindingsSuccess={batchAddFindingsSuccess}
            batchAddedFindingsCount={batchAddedFindingsCount}
            totalCurrentFindingsCount={totalCurrentFindingsCount}
            onAddAllFindingsToEvidence={() => {
              void handleAddAllFindingsToEvidence();
            }}
            isBulkDownloading={isBulkDownloading}
            bulkDownloadSuccess={bulkDownloadSuccess}
            onAddAllAndBulkDownload={() => {
              void handleAddAllAndBulkDownload();
            }}
            onOpenExportHub={() => setIsExportHubOpen(true)}
          />

          {/* Scrollable Panel Content */}
          <div
            data-sidebar-scroll-body="true"
            data-minimize-others={isSidebarMinimizeOthersActive ? 'true' : 'false'}
            className="flex-1 min-h-0 overflow-y-auto scroll-smooth p-4 space-y-4"
          >
            {/* TAB 0: AI FOTO-DOKUMENTATION, VISUEL BESKRIVELSE & ALGEDONISK SIGNAL */}
            {activeTab === 'algedonic' && (
              <div className="space-y-4">
                {/* ÅBEN SOM STANDARD: RETSMEDICINSK STATUS- & EKSPORTKORT */}
                <ChronologicalForensicExportCard
                  maxSiteSumQuotient={maxSiteSumQuotient}
                  observations={observations}
                  sha256Hash={sha256Hash}
                  copiedPdfWidgetSha256={copiedPdfWidgetSha256}
                  onCopySha256={(targetHash) => {
                    void navigator.clipboard.writeText(targetHash);
                    setCopiedPdfWidgetSha256(true);
                    window.setTimeout(() => {
                      setCopiedPdfWidgetSha256(false);
                    }, 2200);
                  }}
                  isGeneratingChronologicalPdf={isGeneratingChronologicalPdf}
                  chronologicalPdfExportSuccess={chronologicalPdfExportSuccess}
                  merkleRootSignature={observationChainOfCustodyLedger.merkleRootSignature}
                  buildings={buildings}
                  indoorClimateTelemetry={indoorClimateTelemetry}
                  pdfWidgetCsvExportSuccess={pdfWidgetCsvExportSuccess}
                  onExportPdfWidgetStatsCsv={handleExportPdfWidgetStatsCsv}
                  onPrintPdfWidgetAppendix={handlePrintPdfWidgetAppendix}
                  onOpenIndoorClimateTab={() => setActiveTab('indoorClimate')}
                  onDownload29BuildingInspectionPdf={() =>
                    generateBuildingRegistryInspectionPdfReport({
                      buildings,
                      dateIso: weatherDataset.dateIso,
                      hourLabel: currentWeather.hourLabel,
                      sha256Hash,
                      receptorExposures,
                    })
                  }
                  onExportAcousticDiagramAndDbValuesPdf={handleExportAcousticDiagramAndDbValuesPdf}
                  directForensicPdfExportSuccess={directForensicPdfExportSuccess}
                  onDirectExportForensicAppendixPdf={handleDirectExportForensicAppendixPdf}
                  onOpenReportModal={() => setIsReportModalOpen(true)}
                  onExportChronologicalEvidencePdfReport={handleExportChronologicalEvidencePdfReport}
                />

                {/* ÅBEN SOM STANDARD: 24-TIMERS BEVIS-TIDSLINJE WIDGET */}
                <DockableWindowFrame
                  windowId="evidence_timeline_24h"
                  state={windowStates.evidence_timeline_24h}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <ForensicEvidenceTimelineWidget
                    observations={observations}
                    weatherHours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    puff24h={puff24h}
                    selectedDateIso={weatherDataset.dateIso}
                    selectedHourIndex={selectedHourIndex}
                    plumeRouteProgress={plumeRouteProgress}
                    maxSiteSumQuotient={maxSiteSumQuotient}
                    selectedObservationId={selectedObservationId}
                    onSelectHour={(hrIdx) => {
                      setSelectedHourIndex(hrIdx);
                      setPlumeRouteProgress(hrIdx);
                    }}
                    onScrubProgress={handleScrubTimelineProgress}
                    onSelectObservation={(obs) => {
                      setSelectedObservationId(obs.id);
                      setSelectedHourIndex(obs.observedHourIndex);
                      setPlumeRouteProgress(obs.observedHourIndex);
                      setPendingObservationPoint(obs.position);
                    }}
                    onMoveObservationHour={handleMoveObservationHour}
                    comparisonHourAIndex={comparisonHourAIndex}
                    showHeatmapComparison={showHeatmapComparison}
                    onChangeComparisonHourA={setComparisonHourAIndex}
                    onToggleHeatmapComparison={() =>
                      setShowHeatmapComparison((v) => !v)
                    }
                    variant="full_widget"
                  />
                </DockableWindowFrame>

                {/* SAMMENKLAPPELIG (a): NY FYSISK OBSERVATION / ZKP-INDBERETNING & PROAKTIV AI-AGENT */}
                <CollapsibleSection
                  title="(a) Ny Fysisk Observation / ZKP-Indberetning"
                  subtitle="GPS-punkt på kort, Algedonisk signal, Right-to-Opacity ZKP & Proaktiv AI-agent"
                  badge={mapClickMode === 'add_observation' ? 'Kort-valg AKTIV' : 'ZKP · SHA-256'}
                  icon={<Radio className="w-3.5 h-3.5 text-fuchsia-400" />}
                  defaultOpen={false}
                  forceOpen={
                    mapClickMode === 'add_observation' ||
                    (isSidebarMinimizeOthersActive &&
                      (effectiveActiveSidebarWindowId === 'algedonic_observations' ||
                        effectiveActiveSidebarWindowId === 'proactive_ai_agent'))
                  }
                  accentBorderClass="border-fuchsia-500/40"
                >
                  <DockableWindowFrame
                    windowId="algedonic_observations"
                    state={windowStates.algedonic_observations}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <div className="p-2.5 space-y-3">
                      <div className="p-3.5 bg-fuchsia-950/20 border border-fuchsia-500/50 rounded-md space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
                            <Radio className="w-4 h-4 text-fuchsia-400 shrink-0" />
                            <span>Registrér Fysisk Observation / Algedonisk Signal</span>
                          </div>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40">
                            {weatherDataset.dateIso} kl. {currentWeather.hourLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Beboere, arbejdsmiljørepræsentanter (AMR) og tilsynsførende kan udpege et præcist
                          GPS-punkt på kortet på det valgte historiske eller aktuelle klokkeslæt. Appen
                          kobler automatisk observationen med Open-Meteo vejrtelemetrien, beregner om
                          punktet ligger inde i den matematiske spredningsfane, og føjer det til den
                          kryptografisk signerede Bevis-Rapport.
                        </p>
                      </div>

                      {/* Observation Registration Form */}
                      <form
                        onSubmit={handleRegisterObservation}
                        className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-md space-y-3"
                      >
                        {/* Step 1: GPS Point Picker on Map */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold">
                              1. GPS-Observationspunkt i Ringparken
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setMapClickMode(
                                  mapClickMode === 'add_observation' ? 'none' : 'add_observation'
                                )
                              }
                              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors ${
                                mapClickMode === 'add_observation'
                                  ? 'bg-fuchsia-500 text-slate-950'
                                  : 'bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-500/50 hover:bg-fuchsia-900'
                              }`}
                            >
                              <Crosshair className="w-3 h-3" />
                              <span>
                                {mapClickMode === 'add_observation'
                                  ? 'Klik nu på kortet...'
                                  : 'Klik på kortet for at vælge punkt'}
                              </span>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                            <div className="p-2 bg-slate-950 border border-slate-800 rounded flex items-center gap-1.5 text-fuchsia-300">
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-fuchsia-400" />
                              <span>
                                {pendingObservationPoint.lat.toFixed(4)}°N,{' '}
                                {pendingObservationPoint.lng.toFixed(4)}°E
                              </span>
                            </div>
                            <input
                              type="text"
                              value={obsLocationLabel}
                              onChange={(e) => setObsLocationLabel(e.target.value)}
                              placeholder="Sted / Adresse i Ringparken"
                              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-fuchsia-500"
                            />
                          </div>
                        </div>

                        {/* Step 2: Quick-Select Presets for Field Observations */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-slate-400 font-semibold">
                            2. Vælg Hændelsestype (Algedonisk Signal)
                          </label>
                          <div className="grid grid-cols-1 gap-1.5">
                            {ALGEDONIC_OBSERVATION_PRESETS.map((preset) => {
                              const isSelected = obsType === preset.type;
                              return (
                                <button
                                  key={preset.type}
                                  type="button"
                                  onClick={() => {
                                    setObsType(preset.type);
                                    setObsDescription(preset.defaultDetail);
                                    setPendingObservationPoint(preset.defaultPoint);
                                    setObsLocationLabel(preset.defaultLocationLabel);
                                  }}
                                  className={`text-left px-2.5 py-1.5 rounded border text-xs transition-colors flex items-center gap-1.5 ${
                                    isSelected
                                      ? 'bg-fuchsia-950/60 border-fuchsia-400 text-white font-semibold'
                                      : 'bg-[var(--surface-panel)] border-[var(--border-subtle)] text-slate-300 hover:border-slate-500'
                                  }`}
                                >
                                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>{preset.type}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Step 3: Reporter Role & Identifier */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                              3. Indberetter-Rolle
                            </label>
                            <select
                              value={obsReporterRole}
                              onChange={(e) => setObsReporterRole(e.target.value as ReporterRole)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-fuchsia-500"
                            >
                              <option value="Beboer (Ringparken)">Beboer (Ringparken)</option>
                              <option value="Arbejdsmiljørepræsentant (AMR)">
                                Arbejdsmiljørepræsentant (AMR)
                              </option>
                              <option value="Tilsynsførende (Arbejdstilsynet / Kommune)">
                                Tilsynsførende (Arbejdstilsynet / Kommune)
                              </option>
                              <option value="Byggerådgiver / Miljøtekniker">
                                Byggerådgiver / Miljøtekniker
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                              Afdeling / Enhed / ID
                            </label>
                            <input
                              type="text"
                              value={obsReporterId}
                              onChange={(e) => setObsReporterId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-fuchsia-500"
                            />
                          </div>
                        </div>

                        {/* Step 4: Detailed Field Observation Description */}
                        <div>
                          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                            4. Faktuel Beskrivelse af Fysisk Observation
                          </label>
                          <textarea
                            rows={2}
                            value={obsDescription}
                            onChange={(e) => setObsDescription(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-fuchsia-500"
                          />
                        </div>

                        {/* Live Mathematical Plume & Open-Meteo Corroboration Preview */}
                        <div
                          className={`p-2.5 rounded border text-xs font-mono space-y-1 ${
                            livePendingCorroboration.isInsideMathematicalPlume
                              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                              : 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>
                              {livePendingCorroboration.isInsideMathematicalPlume
                                ? '✓ PUNKT BEFINDER SIG I MATEMATISK SPREDNINGSFANE'
                                : '○ PUNKT UDEN FOR HOVEDFANE (LOKAL KILDE-/RANDZONE)'}
                            </span>
                            <span>S = {livePendingCorroboration.calculatedSumQuotient.toFixed(2)}</span>
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Open-Meteo ({weatherDataset.dateIso} kl. {currentWeather.hourLabel}): Vind{' '}
                            {currentWeather.windSpeed10m} m/s (stød {currentWeather.windGusts10m} m/s) fra{' '}
                            {currentWeather.windDirection10m}° → Fane mod{' '}
                            {livePendingCorroboration.plumeDirectionDeg}° · Afstand:{' '}
                            {livePendingCorroboration.distanceFromSourceMeters} m fra{' '}
                            {livePendingCorroboration.nearestSourceName.split(':')[0]} (Δθ ={' '}
                            {livePendingCorroboration.angularDeviationDeg}°)
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Zone: {livePendingCorroboration.zoneLabel}
                          </div>
                        </div>

                        {/* Zero-Knowledge Proof (ZKP) & Cryptographic Physical-to-Digital Proof-of-State Box */}
                        {(() => {
                          const previewZkp = computeDeterministicZkpVerification({
                            code: `ALG-${String(observations.length + 1).padStart(2, '0')}`,
                            position: pendingObservationPoint,
                            reporterRole: obsReporterRole,
                            observedTimestampIso: currentWeather.isoTime,
                            weather: currentWeather,
                            sumQuotientS: livePendingCorroboration.calculatedSumQuotient,
                            distanceFromSourceMeters: livePendingCorroboration.distanceFromSourceMeters,
                            rightToOpacityEnabled,
                            existingSha256: sha256Hash,
                          });
                          return (
                            <div className="p-2.5 rounded bg-slate-950/95 border border-cyan-500/45 space-y-1.5 font-mono text-[11px]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  <span>
                                    Zero-Knowledge Proof (ZKP) &amp; Right-to-Opacity Anonymitetsbeskyttelse
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRightToOpacityEnabled((prev) => !prev)}
                                  className={`px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer ${
                                    rightToOpacityEnabled
                                      ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                                      : 'bg-slate-900 border-slate-700 text-slate-400'
                                  }`}
                                >
                                  {rightToOpacityEnabled ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-300 shrink-0" />
                                      <span>Right-to-Opacity: AKTIV (Ingen navn/CPR/IP gemmes)</span>
                                    </span>
                                  ) : (
                                    'Right-to-Opacity: FRA'
                                  )}
                                </button>
                              </div>
                              <div className="text-slate-300">
                                ZKP Proof Hash:{' '}
                                <span className="text-emerald-300">
                                  {previewZkp.zkpProofHash.slice(0, 28)}...
                                </span>{' '}
                                · Geofence:{' '}
                                <strong className="text-white">
                                  {previewZkp.geofenceVerified ? 'VERIFICERET I RINGPARKEN' : 'EKSTERN'}
                                </strong>
                              </div>
                              <div className="text-amber-200/90">
                                Physical-to-Digital State Anchor: Vind {previewZkp.physicalToDigitalProofOfState.windDirectionDeg}° · ∂T/∂z ={' '}
                                {previewZkp.physicalToDigitalProofOfState.temperatureGradientDtDzKm} K/m · S ={' '}
                                {previewZkp.physicalToDigitalProofOfState.sumQuotientS.toFixed(2)} · L_AFmax(+5,0 dB) ={' '}
                                {previewZkp.physicalToDigitalProofOfState.noiseLafmaxDb} dB(A)
                              </div>
                            </div>
                          );
                        })()}

                        <button
                          type="submit"
                          className="w-full py-2 rounded bg-fuchsia-500 text-slate-950 font-bold text-xs hover:bg-fuchsia-400 transition-colors flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            Signér med ZKP &amp; Føj Observation til Retsmedicinsk Bevis-Rapport (SHA-256)
                          </span>
                        </button>
                      </form>
                    </div>
                  </DockableWindowFrame>

                  {/* Proactive AI-Agent Widget correlating the latest 3 neighbor complaints with Open-Meteo weather */}
                  <DockableWindowFrame
                    windowId="proactive_ai_agent"
                    state={windowStates.proactive_ai_agent}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <ProactiveComplaintMitigationAgentWidget
                      observations={observations}
                      currentWeather={currentWeather}
                      dateIso={weatherDataset.dateIso}
                      maxSiteSumQuotient={maxSiteSumQuotient}
                      worstExposedReceptor={worstExposedReceptor}
                      sources={sources}
                      onSelectObservation={(obsId, hrIdx) => {
                        setSelectedObservationId(obsId);
                        setSelectedHourIndex(hrIdx);
                        setPlumeRouteProgress(hrIdx);
                      }}
                      onToggleSourceActive={toggleSourceActive}
                    />
                  </DockableWindowFrame>
                </CollapsibleSection>

                {/* SAMMENKLAPPELIG (b): FOTO-, LYD- & PDF-BEVISUPLOAD */}
                <CollapsibleSection
                  title="(b) Foto-, Lyd- & PDF-Bevisupload"
                  subtitle="AI Fotoanalyse, Retsakustisk Lydklip & Myndigheds-PDF'er"
                  badge={`${
                    observations.filter(
                      (o) => Boolean(o.photoEvidence || o.audioEvidence || o.pdfEvidence)
                    ).length
                  } bilag`}
                  icon={<Camera className="w-3.5 h-3.5 text-cyan-400" />}
                  defaultOpen={false}
                  forceOpen={
                    isSidebarMinimizeOthersActive &&
                    (effectiveActiveSidebarWindowId === 'photo_upload' ||
                      effectiveActiveSidebarWindowId === 'pdf_authority_evidence')
                  }
                  accentBorderClass="border-cyan-500/40"
                >
                  <DockableWindowFrame
                    windowId="photo_upload"
                    state={windowStates.photo_upload}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <ForensicPhotoEvidencePanel
                      dateIso={weatherDataset.dateIso}
                      currentWeather={currentWeather}
                      pendingPosition={pendingObservationPoint}
                      locationLabel={obsLocationLabel}
                      reporterRole={obsReporterRole}
                      reporterId={obsReporterId}
                      observationType={obsType}
                      corroboration={livePendingCorroboration}
                      observationsWithPhotos={observations.filter((o) => Boolean(o.photoEvidence))}
                      onSelectObservation={(obs) => {
                        setSelectedObservationId(obs.id);
                        setSelectedHourIndex(obs.observedHourIndex);
                        setPendingObservationPoint(obs.position);
                      }}
                      onRegisterPhotoEvidenceObservation={handleRegisterPhotoEvidenceObservation}
                      onApplyAiDescriptionToForm={({
                        observationType: recType,
                        description: recDesc,
                        photoEvidence,
                      }) => {
                        setObsType(recType);
                        setObsDescription(recDesc);
                        setPendingPhotoEvidence(photoEvidence);
                      }}
                      onOpenReportModal={() => {
                        setReportModalInitialTab('technical');
                        setIsReportModalOpen(true);
                      }}
                    />
                  </DockableWindowFrame>

                  <ForensicAudioEvidencePanel
                    currentWeather={currentWeather}
                    selectedDateIso={weatherDataset.dateIso}
                    pendingPoint={pendingObservationPoint}
                    defaultLocationLabel={
                      selectedReceptorExposure
                        ? `${selectedReceptorExposure.receptorName} (${selectedReceptorExposure.address})`
                        : 'Ringparken Nedrivningsfelt, 4200 Slagelse'
                    }
                    observationsWithAudio={observations.filter((o) => Boolean(o.audioEvidence))}
                    onSelectObservation={(obs) => {
                      setSelectedObservationId(obs.id);
                      setSelectedHourIndex(obs.observedHourIndex);
                      setPendingObservationPoint(obs.position);
                    }}
                    onRegisterAudioEvidenceObservation={handleRegisterAudioEvidenceObservation}
                    onApplyDetectedMachineNoiseToSimulation={({
                      estimatedSourceLwaDb,
                      machineryCategoryKey,
                    }) => {
                      setManualMachineNoiseOutputDb(estimatedSourceLwaDb);
                      setIsManualMachineNoiseOverrideActive(true);
                      setSelectedImpulseMachineryKey(machineryCategoryKey);
                    }}
                  />

                  <DockableWindowFrame
                    windowId="pdf_authority_evidence"
                    state={windowStates.pdf_authority_evidence}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <ForensicPdfEvidencePanel
                      currentWeather={currentWeather}
                      selectedDate={weatherDataset.dateIso}
                      receptorExposures={receptorExposures}
                      maxSumQuotient={maxSiteSumQuotient}
                      observations={observations}
                      legalViolations={legalViolations}
                      sha256Hash={sha256Hash}
                      onRegisterPdfEvidenceObservation={handleRegisterPdfEvidenceObservation}
                      onGenerateFullForensicPdfReport={(pdfArchive) =>
                        generateForensicPdfReport({
                          weatherDataset,
                          simulation,
                          sources,
                          receptors,
                          observations,
                          isPuffMode,
                          sha256Hash,
                          groundingPlaces,
                          pdfEvidenceArchive: pdfArchive,
                          validatePhotoEvidenceBinary,
                        })
                      }
                    />
                  </DockableWindowFrame>
                </CollapsibleSection>

                {/* SAMMENKLAPPELIG (c): AUTONOMT RECEPTOR-MESH, SYSTEM B MYCELIUM & KYBERNETISK TETANUS (Tr/Δt) */}
                <CollapsibleSection
                  title="(c) Autonomt Receptor-Mesh, System B Mycelium & Kybernetisk Tetanus (Tr/Δt)"
                  subtitle="BFT Gate 1, EU868 LoRa, ZKP Audit-Log, Tr/Δt Monitor & ISO/IEC 27037 DB Audit"
                  badge={
                    myceliumAlerts.unacknowledgedCount > 0
                      ? `${myceliumAlerts.unacknowledgedCount} alarmer`
                      : `α ${((myceliumSnapshot.biocyberneticState?.kpis.autonomyIndexAi ?? 1) * 100).toFixed(0)}%`
                  }
                  icon={<ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />}
                  defaultOpen={false}
                  accentBorderClass="border-emerald-500/40"
                >
                  <AutonomousReceptorMeshPanel
                    mesh={autonomousReceptorMesh}
                    receptors={receptors}
                    selectedReceptorId={selectedReceptorExposure.receptorId}
                    onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                    currentTimestampIso={currentWeather.isoTime}
                    onEmitZkpAlgedonicSignal={handleEmitZkpNodeAlgedonicSignal}
                  />

                  <MyceliumCyberneticDashboardPanel
                    snapshot={myceliumSnapshot}
                    disabledNodeIds={myceliumDisabledNodeIds}
                    byzantineFaultNodeIds={myceliumByzantineNodeIds}
                    unacknowledgedAlertCount={myceliumAlerts.unacknowledgedCount}
                    onToggleNodeOffline={handleToggleMyceliumNodeOffline}
                    onToggleByzantineFault={handleToggleMyceliumByzantineFault}
                    onResetFaultSimulations={handleResetMyceliumFaultSimulations}
                    onOpenAlertDrawer={() => myceliumAlerts.setIsDrawerOpen(true)}
                    onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                  />

                  <MyceliumZkpAuditLog
                    observations={observations}
                    myceliumState={myceliumSnapshot.biocyberneticState}
                    onFocusSignal={(id) => {
                      if (receptors.some((r) => r.id === id)) {
                        setSelectedReceptorId(id);
                      }
                    }}
                    onExportChainOfCustodyPdf={handleExportChainOfCustodyPdfReport}
                  />

                  {/* KYBERNETISK AFSLAPNINGSTID (Tr) VS. KRISEINTERVAL (Δt) MONITOR & AUTOMATISK JURIDISK INDSIGELSES-GENERATOR */}
                  {(() => {
                    const breachHoursCount = Math.max(
                      1,
                      puff24h.peakReceptor.hourlyProfile.filter((h) => h.sumQuotient >= 0.45).length +
                        observations.length
                    );
                    const crisisIntervalDtHours = Number((24 / breachHoursCount).toFixed(1));
                    const isSystemicTetanus = relaxationTimeTrHours > crisisIntervalDtHours;

                    return (
                      <div
                        className={`p-3.5 rounded-md border space-y-3 ${
                          isSystemicTetanus
                            ? 'bg-[#1B2433] border-rose-500/60'
                            : 'bg-[#1B2433] border-[#2D3B50]'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="text-xs font-mono uppercase tracking-wider font-extrabold flex items-center gap-1.5 text-white">
                              <AlertTriangle
                                className={`w-4 h-4 shrink-0 ${
                                  isSystemicTetanus ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              />
                              <span>
                                {isSystemicTetanus
                                  ? 'SYSTEMISK TETANUS (Tr > Δt): Administrativ Varians-Dæmpning Detekteret'
                                  : 'Kybernetisk Ligevægt (Tr ≤ Δt): Afværgeforanstaltninger Følger Med Kriseinterval'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-200 leading-relaxed">
                              Overvåger forholdet mellem <strong className="text-cyan-300">Kriseintervallet (Δt = {crisisIntervalDtHours.toFixed(1)} timer)</strong> mellem grænseværdioverskridelser (S ≥ 0,45 / støj &gt;80 dB(A) / algedoniske smertesignaler) og byggeledelsens/tilsynets <strong className="text-amber-300">Afslapningstid (Tr = {relaxationTimeTrHours.toFixed(1)} timer)</strong> til fysisk afværge (vanddæmpning, stop af mejselhammer, forsegling af krybekælder).
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setReportModalInitialTab('legal_objections');
                              setIsReportModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>
                              Åbn EU- &amp; Miljøretlig Klagegenerator (Waddenzee C-127/02 · L 69 · C-417/23)
                            </span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
                          <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800">
                            <div className="text-[11px] text-slate-400 uppercase">
                              Kriseinterval (Δt)
                            </div>
                            <div className="text-base font-extrabold text-cyan-300 tabular-nums">
                              Δt = {crisisIntervalDtHours.toFixed(1)} timer
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {breachHoursCount} overskridelser / smertesignaler pr. 24t
                            </div>
                          </div>

                          <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase">
                              <span>Afslapningstid (Tr · FOB/Titan/Tilsyn)</span>
                              <strong className="text-amber-300">
                                Tr = {relaxationTimeTrHours.toFixed(1)} t
                              </strong>
                            </div>
                            <input
                              type="range"
                              min={0.5}
                              max={48}
                              step={0.5}
                              value={relaxationTimeTrHours}
                              onChange={(e) => setRelaxationTimeTrHours(Number(e.target.value))}
                              className="w-full accent-amber-400 cursor-pointer"
                            />
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <button
                                type="button"
                                onClick={() => setRelaxationTimeTrHours(1.5)}
                                className="underline hover:text-emerald-300 cursor-pointer"
                              >
                                Hurtig afværge (1,5t)
                              </button>
                              <button
                                type="button"
                                onClick={() => setRelaxationTimeTrHours(18.5)}
                                className="underline hover:text-rose-300 cursor-pointer"
                              >
                                Passiv ledelse (18,5t)
                              </button>
                            </div>
                          </div>

                          <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800">
                            <div className="text-[11px] text-slate-400 uppercase">
                              Kybernetisk Kvotient (Tr / Δt)
                            </div>
                            <div
                              className={`text-base font-extrabold tabular-nums ${
                                isSystemicTetanus ? 'text-rose-400' : 'text-emerald-300'
                              }`}
                            >
                              Tr / Δt = {(relaxationTimeTrHours / crisisIntervalDtHours).toFixed(2)}x
                            </div>
                            <div className="text-[11px] text-slate-300">
                              {isSystemicTetanus
                                ? 'Eskaleringsprotokol AKTIV (Q → ∞)'
                                : 'Systemet når at relaksere'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Forensic Database Audit-Log JSON Export Bar (ISO/IEC 27037 Chain-of-Custody & SHA-256) */}
                  <div className="p-3 rounded-md bg-slate-900/90 border border-cyan-500/50 space-y-2 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>Retsmedicinsk Database Audit-Log (ISO/IEC 27037 · SHA-256)</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                          Eksportér samtlige registrerede observationer ({observations.length} poster:
                          fysiske signaler, foto- og PDF-beviser) med kædede SHA-256 signaturer,
                          WGS84-koordinater og Open-Meteo telemetri til direkte import i en
                          retsmedicinsk database.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportForensicAuditLogJson}
                        className={`px-3 py-2 rounded font-mono text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                          auditLogJsonExportSuccess
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-sm'
                            : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-cyan-200 shadow-sm'
                        }`}
                        title="Download fuld retsmedicinsk audit-log (JSON) med SHA-256 kædesignaturer til database-import"
                      >
                        {auditLogJsonExportSuccess ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Audit-Log JSON Eksporteret ({observations.length} poster)</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 shrink-0" />
                            <span>
                              Eksportér Fuld Audit-Log til Retsmedicinsk Database (JSON · SHA-256)
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                      <span>
                        Tabel-skema: <strong className="text-cyan-300">forensic_observations_audit_log</strong> · PK:{' '}
                        <strong className="text-slate-200">record_uuid</strong>
                      </span>
                      <span className="truncate max-w-[280px]">
                        State SHA-256: <strong className="text-cyan-300">{sha256Hash.slice(0, 20)}...</strong>
                      </span>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* ÅBEN SOM STANDARD: REGISTERED ALGEDONIC SIGNALS & PHOTO EVIDENCE LOG */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Registrerede Algedoniske Signaler &amp; Foto-Beviser ({observations.length})
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddAllFindingsToEvidence}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 border border-emerald-200 text-[11px] font-mono font-bold text-slate-950 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        title="Føj alle aktuelle fund (lovovertrædelser, udsatte receptorer og vejr-/støvkorrelation) direkte til Beviser med SHA-256 signatur"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                        <span>
                          {batchAddFindingsSuccess
                            ? `${batchAddedFindingsCount} fund føjet til Beviser`
                            : `Føj alle fund til Beviser (${totalCurrentFindingsCount})`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportChronologicalEvidencePdfReport}
                        className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 border border-amber-200 text-[11px] font-mono font-extrabold text-slate-950 flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Generér og download kronologisk PDF-rapport over alle registrerede observationer (fotos, PDF-beviser og fysiske signaler) med SHA-256 signaturer som officielt retsmedicinsk bilag i klagesager"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                        <span>
                          {chronologicalPdfExportSuccess
                            ? 'Kronologisk PDF-Rapport Downloadet'
                            : `Eksportér Kronologisk PDF-Rapport (Fotos, PDF & Signaler · ${observations.length})`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportChainOfCustodyPdfReport}
                        className="px-2.5 py-1 rounded bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] border-l-4 border-l-emerald-400 text-[11px] font-mono font-bold text-emerald-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Generér og download 'Chain-of-Custody' rapport som PDF, hvor alle SHA-256 signaturer fra registrerede beviser er samlet i en verificerbar log-tabel (beviser uforanderlighed over tid)"
                      >
                        <Lock className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                        <span>
                          {chainOfCustodyPdfExportSuccess
                            ? 'Chain-of-Custody PDF Downloadet'
                            : `Chain-of-Custody Rapport (PDF · ${observationChainOfCustodyLedger.entries.length} SHA-256)`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowObservationChainOfCustodyLog((prev) => !prev)}
                        className={`px-2.5 py-1 rounded border text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                          showObservationChainOfCustodyLog
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                            : 'bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] border-emerald-500/50 text-emerald-300'
                        }`}
                        title="Vis eller skjul den verificerbare Chain-of-Custody SHA-256 log-tabel for alle registrerede observationer"
                      >
                        <span>
                          {showObservationChainOfCustodyLog
                            ? 'Skjul SHA-256 Log-Tabel'
                            : 'Vis SHA-256 Log-Tabel'}
                        </span>
                        {showObservationChainOfCustodyLog ? (
                          <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportForensicAuditLogJson}
                        className="px-2.5 py-1 rounded bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-[11px] font-mono font-bold text-sky-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Eksportér fuld audit-log over alle registrerede observationer (inkl. SHA-256 signaturer) som JSON til retsmedicinsk database"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        <span>
                          {auditLogJsonExportSuccess
                            ? 'Audit-Log JSON Downloadet'
                            : 'Eksportér Audit-Log (DB JSON · SHA-256)'}
                        </span>
                      </button>
                      {observations.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllEvidenceFromScratch}
                          className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-[11px] font-mono font-bold text-rose-200 flex items-center gap-1.5 cursor-pointer"
                          title="Slet alle registrerede beviser og start registreringen helt forfra (fra scratch)"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                          <span>Slet Alle Beviser (Start Fra Scratch)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setReportModalInitialTab('chain_of_custody');
                          setIsReportModalOpen(true);
                        }}
                        className="text-[11px] font-mono text-emerald-400 underline hover:text-emerald-300"
                      >
                        Åbn Chain-of-Custody i Bevis-Rapport →
                      </button>
                    </div>
                  </div>

                  {/* Interactive Verifiable Chain-of-Custody SHA-256 Log Table in Observation Panel */}
                  {showObservationChainOfCustodyLog && (
                    <div className="p-3 rounded-md bg-slate-950/95 border border-emerald-500/40 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
                            CHAIN-OF-CUSTODY (BEVISKÆDE) · VERIFICERBAR SHA-256 SIGNATUR-LOG OVER TID
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            Merkle-Root:{' '}
                            <span className="text-cyan-300">
                              {observationChainOfCustodyLedger.merkleRootSignature.slice(0, 32)}...
                            </span>{' '}
                            · Hver enkelt observation er kryptografisk bevist uforandret siden oprettelse.
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setObsChainImmutabilityVerifiedAt(
                                new Date().toISOString().slice(11, 19) + ' UTC'
                              )
                            }
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-[11px] font-mono font-bold text-emerald-200 cursor-pointer"
                          >
                            ✓ Re-Verificér SHA-256 Uforanderlighed
                          </button>
                          <button
                            type="button"
                            onClick={handleExportChainOfCustodyPdfReport}
                            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-mono font-bold cursor-pointer"
                          >
                            Download PDF Log-Tabel
                          </button>
                        </div>
                      </div>

                      {obsChainImmutabilityVerifiedAt && (
                        <div className="px-2.5 py-1.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-mono text-emerald-200">
                          ✓ Kryptografisk Re-Hash Kontrol gennemført kl. {obsChainImmutabilityVerifiedAt}: Alle{' '}
                          {observationChainOfCustodyLedger.entries.length} SHA-256 signaturer og Merkle-kædeled matcher 100% — ingen observationer er ændret over tid.
                        </div>
                      )}

                      <div className="max-h-64 overflow-y-auto rounded border border-slate-800">
                        <table className="w-full text-left border-collapse text-[11px] font-mono">
                          <thead className="bg-slate-900 text-slate-300 sticky top-0">
                            <tr>
                              <th className="py-1.5 px-2">Sekv. / ID</th>
                              <th className="py-1.5 px-2">Observation / Tidspunkt / Kanonisk Payload</th>
                              <th className="py-1.5 px-2">SHA-256 Signatur (64-Hex)</th>
                              <th className="py-1.5 px-2">Bevis Over Tid</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {observationChainOfCustodyLedger.entries.map((row) => (
                              <tr key={`obs-coc-${row.seqNo}-${row.entryId}`} className="hover:bg-slate-900/60">
                                <td className="py-1.5 px-2 align-top whitespace-nowrap">
                                  <div className="font-bold text-white">
                                    #{String(row.seqNo).padStart(3, '0')}
                                  </div>
                                  <div className="text-indigo-300 font-bold">{row.entryId}</div>
                                  <div className="text-[11px] text-slate-500">
                                    Reg: {row.registeredUtcIso.slice(0, 19).replace('T', ' ')}
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 align-top">
                                  <div className="text-emerald-400 font-bold">
                                    {row.entryTypeLabel} · {row.timestampIso}
                                  </div>
                                  <div className="text-slate-200">{row.sourceOrSubject}</div>
                                  <div className="text-[11px] text-slate-400">{row.referenceOrLocation}</div>
                                  <div className="text-[11px] text-cyan-300/80 break-all mt-0.5">
                                    {row.canonicalPayloadFingerprint}
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 align-top">
                                  <div className="p-1 rounded bg-slate-900 border border-cyan-500/30 text-[11px] text-cyan-200 break-all select-all">
                                    {row.sha256Signature}
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 align-top whitespace-nowrap">
                                  <div className="text-[11px] text-slate-400">
                                    Chain: {row.chainedAuditDigest.slice(0, 12)}...
                                  </div>
                                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-[11px] font-bold text-emerald-300">
                                    ✓ BEVIST UFORANDRET
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {evidenceClearedBanner && (
                    <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-500/50 text-xs font-mono text-emerald-200">
                      ✓ Alle tidligere registrerede beviser er slettet. Du starter nu registreringen helt fra scratch (0 beviser).
                    </div>
                  )}

                  {observations.length === 0 && (
                    <div className="p-4 rounded-md bg-slate-900/70 border border-slate-800 text-center space-y-1.5">
                      <div className="text-xs font-mono font-bold text-cyan-300">
                        Ingen registrerede beviser endnu (0 beviser — klar til registrering fra scratch)
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Upload et foto herover (med interaktiv <strong className="text-amber-300">y/n</strong> prompt til justering af beskrivelsen), upload et PDF-dokument eller registrér en fysisk observation på kortet for at opbygge dit bevismateriale fra bunden.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {observations.map((obs) => {
                      const isSel = selectedObservationId === obs.id;
                      const inPlume = obs.plumeCorroboration.isInsideMathematicalPlume;
                      return (
                        <div
                          key={obs.id}
                          onClick={() => {
                            setSelectedObservationId(obs.id);
                            setSelectedHourIndex(obs.observedHourIndex);
                            setPendingObservationPoint(obs.position);
                          }}
                          className={`p-3 rounded-md border cursor-pointer transition-colors space-y-1.5 ${
                            isSel
                              ? 'bg-fuchsia-950/30 border-fuchsia-400'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                            <span className="font-bold text-fuchsia-300 inline-flex items-center gap-1">
                              {obs.photoEvidence ? (
                                <Camera className="w-3.5 h-3.5 shrink-0" />
                              ) : obs.pdfEvidence ? (
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <Zap className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>
                                {obs.code} · {obs.observedDateIso} kl. {obs.observedHourLabel}
                              </span>
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                inPlume
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {inPlume
                                ? `✓ I FANE (S=${obs.plumeCorroboration.calculatedSumQuotient.toFixed(
                                    2
                                  )})`
                                : `RANDZONE (S=${obs.plumeCorroboration.calculatedSumQuotient.toFixed(
                                    2
                                  )})`}
                            </span>
                          </div>

                          {obs.photoEvidence && (
                            <div className="p-2 rounded bg-slate-950/90 border border-cyan-500/40 space-y-1.5">
                              <div className="flex items-start gap-2.5">
                                <img
                                  src={obs.photoEvidence.dataUrl}
                                  alt={obs.photoEvidence.fileName}
                                  className="w-24 h-16 object-cover rounded border border-slate-700 shrink-0"
                                />
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="text-[11px] font-mono text-cyan-300 font-bold truncate">
                                    AI FOTO-ANALYSE: {obs.photoEvidence.aiAnalysis.visualTitle}
                                  </div>
                                  <div className="text-[11px] font-mono text-amber-300">
                                    Alvorsgrad: {obs.photoEvidence.aiAnalysis.severityAssessment} (
                                    {obs.photoEvidence.aiAnalysis.confidencePct}% AI-konfidens)
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-400 truncate">
                                    Billed SHA-256: {obs.photoEvidence.imageSha256Hash.slice(0, 22)}...
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {obs.pdfEvidence && (
                            <div className="p-2 rounded bg-indigo-950/40 border border-indigo-500/50 space-y-1">
                              <div className="text-[11px] font-mono text-indigo-300 font-bold truncate flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                  PDF-BEVIS ({obs.pdfEvidence.id}): {obs.pdfEvidence.aiAnalysis.documentTitle}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-300 truncate">
                                Fra: {obs.pdfEvidence.aiAnalysis.senderEntity} → Til:{' '}
                                {obs.pdfEvidence.aiAnalysis.recipientEntity}
                              </div>
                              <div className="text-[11px] font-mono text-amber-300 truncate">
                                Ref.: {obs.pdfEvidence.aiAnalysis.referenceJournalNumber} · PDF SHA-256:{' '}
                                {obs.pdfEvidence.sha256Hash.slice(0, 18)}...
                              </div>
                            </div>
                          )}

                          {obs.mapSnapshot && (
                            <div className="p-2 rounded bg-amber-950/35 border border-amber-400/60 space-y-1 font-mono text-[11px]">
                              <div className="flex items-center justify-between gap-2 text-amber-300 font-bold">
                                <span className="inline-flex items-center gap-1">
                                  <MapIcon className="w-3.5 h-3.5 shrink-0" />
                                  <span>SNAPSHOT MAP BEVIS (2D TAKTISK KORT-UDSNIT)</span>
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-950 border border-amber-400/50 text-white">
                                  Zoom Z:{obs.mapSnapshot.zoom.toFixed(1)}
                                </span>
                              </div>
                              <div className="text-slate-200">
                                Bounds: N {obs.mapSnapshot.bounds.north.toFixed(4)}° · S{' '}
                                {obs.mapSnapshot.bounds.south.toFixed(4)}° · Ø{' '}
                                {obs.mapSnapshot.bounds.east.toFixed(4)}° · V{' '}
                                {obs.mapSnapshot.bounds.west.toFixed(4)}°
                              </div>
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {obs.mapSnapshot.activeLayers.map((layerName) => (
                                  <span
                                    key={`${obs.id}-layer-${layerName}`}
                                    className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-cyan-500/40 text-[11px] text-cyan-200"
                                  >
                                    {layerName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="text-xs font-bold text-white">{obs.observationType}</div>
                          <p className="text-xs text-slate-300 leading-snug">{obs.description}</p>

                          <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80 space-y-0.5">
                            <div>
                              Rolle: <strong className="text-slate-200">{obs.reporterRole}</strong> ·
                              GPS: {obs.position.lat.toFixed(4)}°N, {obs.position.lng.toFixed(4)}°E
                            </div>
                            <div>
                              Open-Meteo: Vind {obs.weatherSnapshot.windSpeed10m} m/s (stød{' '}
                              {obs.weatherSnapshot.windGusts10m} m/s) fra{' '}
                              {obs.weatherSnapshot.windDirection10m}° · Nedbør{' '}
                              {obs.weatherSnapshot.precipitation} mm/t
                            </div>
                            <div className="text-fuchsia-300/90">
                              {obs.plumeCorroboration.corroborationSummary}
                            </div>
                            {(() => {
                              const zkp =
                                obs.zkpVerification ||
                                computeDeterministicZkpVerification({
                                  code: obs.code,
                                  position: obs.position,
                                  reporterRole: obs.reporterRole,
                                  observedTimestampIso: obs.observedTimestampIso,
                                  weather: obs.weatherSnapshot,
                                  sumQuotientS: obs.plumeCorroboration.calculatedSumQuotient,
                                  distanceFromSourceMeters:
                                    obs.plumeCorroboration.distanceFromSourceMeters,
                                  existingSha256: obs.sha256Signature,
                                });
                              return (
                                <div className="text-[11px] text-cyan-300/90 pt-0.5">
                                  ZKP ({zkp.rightToOpacityEnabled ? 'Right-to-Opacity' : 'Åben'}):{' '}
                                  {zkp.zkpProofHash.slice(0, 20)}... · ∂T/∂z={' '}
                                  {zkp.physicalToDigitalProofOfState.temperatureGradientDtDzKm} K/m ·
                                  L_AFmax(+5dB)={zkp.physicalToDigitalProofOfState.noiseLafmaxDb} dB(A)
                                </div>
                              );
                            })()}
                            <div className="text-[11px] text-slate-500 truncate">
                              SHA-256: {obs.sha256Signature}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: STOFFER, KILDENODER & ARBEJDSTILSYNETS SUMFORMEL */}
            {activeTab === 'substances' && (
              <DockableWindowFrame
                windowId="substances_sumformel"
                state={windowStates.substances_sumformel}
                onMinimize={handleMinimizeWindow}
                onPopOutFloating={handlePopOutFloatingWindow}
                onRestore={handleRestoreWindow}
              >
                <div className="p-2.5 space-y-3">
                {/* Automatic Real-Time High-Wind (> 10 m/s) Receptor Highlight Card in Stof- & Sumformel */}
                {currentWeather.windSpeed10m > 10 && top3MostAffectedReceptors.length > 0 && (
                  <div
                    role="region"
                    aria-label="Højvinds-fremhævning af mest berørte receptorer"
                    className="p-3 bg-rose-950/45 border border-rose-500/70 rounded-md space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 font-mono">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span>
                          REALTIDS-ALARM (&gt; 10 m/s): MEST BERØRTE RECEPTORER
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[11px] font-mono font-bold">
                        {currentWeather.windSpeed10m} m/s
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-100 leading-snug">
                      Vindhastigheden overstiger 10 m/s (stød {currentWeather.windGusts10m} m/s). De 3
                      mest udsatte receptorer i spredningsretningen ({plumeDirectionDeg}°) er automatisk
                      fremhævet til proaktiv støvbekæmpelse:
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                      {top3MostAffectedReceptors.map((r, idx) => {
                        const rank = idx + 1;
                        const isSel = selectedReceptorExposure.receptorId === r.receptorId;
                        return (
                          <button
                            key={`panel-hw-rec-${r.receptorId}`}
                            type="button"
                            onClick={() => setSelectedReceptorId(r.receptorId)}
                            className={`p-2 rounded border text-left flex items-center justify-between gap-2 transition-colors ${
                              isSel
                                ? 'bg-rose-900/90 border-amber-300 text-white'
                                : 'bg-slate-950/85 border-rose-500/40 text-slate-200 hover:border-rose-400'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[11px] font-extrabold mr-1.5">
                                #{rank}
                              </span>
                              <span className="font-bold">{r.receptorCode}: {r.receptorName}</span>
                              <div className="text-[11px] text-slate-300 truncate mt-0.5">
                                {r.address} · {r.distanceFromNearestSourceMeters} m fra{' '}
                                {r.dominantSourceName.split(':')[0]}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-extrabold text-rose-300">
                                S = {r.sumQuotient.toFixed(2)}
                              </div>
                              <div className="text-[11px] text-amber-200">Aktiv fokus</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-md space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        ARBEJDSTILSYNETS SUMFORMEL · BEK 613/2026 § 3, STK. 3
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{selectedReceptorExposure.receptorName}</span>
                        {highWindRankByReceptorId[selectedReceptorExposure.receptorId] && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white border border-amber-300 text-[11px] font-mono font-extrabold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>#{highWindRankByReceptorId[selectedReceptorExposure.receptorId]} MEST BERØRT (&gt;10 m/s)</span>
                          </span>
                        )}
                      </h3>
                      <div className="text-xs text-slate-400 font-mono">
                        {selectedReceptorExposure.address} ·{' '}
                        {selectedReceptorExposure.distanceFromNearestSourceMeters} m fra{' '}
                        {selectedReceptorExposure.dominantSourceName.split(':')[0]}
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <div className="text-[11px] text-slate-400">SUMKVOTIENT</div>
                      <div
                        className={`text-2xl font-bold tabular-nums ${
                          selectedReceptorExposure.sumQuotient >= 1.0
                            ? 'text-rose-400'
                            : selectedReceptorExposure.sumQuotient >= 0.5
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        S = {selectedReceptorExposure.sumQuotient.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Vælg Receptor / Naboblok i Ringparken:
                    </label>
                    <select
                      value={selectedReceptorExposure.receptorId}
                      onChange={(e) => setSelectedReceptorId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      {receptorExposures.map((r) => {
                        const hwRank = highWindRankByReceptorId[r.receptorId];
                        return (
                          <option key={r.receptorId} value={r.receptorId}>
                            {hwRank ? `[#${hwRank} MEST BERØRT >10m/s] ` : ''}
                            {r.receptorCode}: {r.receptorName} — S = {r.sumQuotient.toFixed(2)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* CSV Export Action for Selected Hour's Raw Weather Data & All Receptor Sum Quotients */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportSelectedHourCsv}
                      className={`w-full py-2 px-3 rounded font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2 border ${
                        csvExportSuccess
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40'
                      }`}
                    >
                      {csvExportSuccess ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            CSV Eksporteret ({receptorExposures.length} receptorer · kl.{' '}
                            {currentWeather.hourLabel})
                          </span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>
                            Eksportér Vejrdata &amp; Sumkvotienter (CSV · kl.{' '}
                            {currentWeather.hourLabel})
                          </span>
                        </>
                      )}
                    </button>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between px-0.5">
                      <span>
                        Inkl. rå Open-Meteo telemetri ({currentWeather.windSpeed10m} m/s,{' '}
                        {currentWeather.windDirection10m}°, Pasquill {currentWeather.pasquillClass})
                      </span>
                      <span>{receptorExposures.length} receptorer</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    {selectedReceptorExposure.substances.map((sub) => {
                      const pct = Math.min(100, Math.round(sub.quotient * 100));
                      return (
                        <div
                          key={sub.key}
                          className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-200">{sub.name}</span>
                            <span className="font-mono text-xs font-bold text-cyan-300">
                              C/GV = {sub.quotient.toFixed(3)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>
                              Konc: <strong className="text-slate-200">{sub.concentration}</strong>{' '}
                              {sub.unit}
                            </span>
                            <span>
                              2026-GV: {sub.limitValue} {sub.unit}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-200 ${
                                sub.quotient >= 0.5
                                  ? 'bg-rose-500'
                                  : sub.quotient >= 0.25
                                  ? 'bg-amber-400'
                                  : 'bg-cyan-400'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug">
                            {sub.weatherTriggerNote}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Direct Cross-Link to Bioscience & Molecular Toxicology Workbench */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setActiveTab('bioscience')}
                      className="w-full py-2 px-3 rounded bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] border border-teal-500/40 text-teal-200 font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Dna className="w-4 h-4 text-teal-300 shrink-0" />
                      <span>
                        Åbn 3D Molekylær Toksikologi &amp; Lægefaglig AI Ekspert →
                      </span>
                    </button>
                  </div>
                </div>

                {/* Lægefaglig AI Ekspert & Samlet Bevis-Bilag over Sundhedsmæssige Konsekvenser */}
                <DockableWindowFrame
                  windowId="medical_expert_ai"
                  state={windowStates.medical_expert_ai}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <MedicalExpertAiWidget
                    selectedReceptorExposure={selectedReceptorExposure}
                    allReceptorExposures={receptorExposures}
                    onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                    currentWeather={currentWeather}
                    currentDateIso={weatherDataset.dateIso}
                    cumulativeSumQuotient24h={
                      puff24h.receptorSummaries.find(
                        (r) => r.receptorId === selectedReceptorExposure.receptorId
                      )?.cumulativeSumDose || puff24h.peakReceptor.cumulativeSumDose
                    }
                    compactMode
                  />
                </DockableWindowFrame>

                {/* Interactive Cumulative Respirable Dust Dose Chart at Most Exposed Receptors */}
                <DockableWindowFrame
                  windowId="cumulative_dust_24h"
                  state={windowStates.cumulative_dust_24h}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <CumulativeRespirableDustChart
                    puff24h={puff24h}
                    weatherHours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    selectedReceptorId={selectedReceptorId}
                    onSelectHour={(hrIdx) => {
                      setSelectedHourIndex(hrIdx);
                      setPlumeRouteProgress(hrIdx);
                    }}
                    onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                  />
                </DockableWindowFrame>

                {/* 24-Hour Total Asbestos Exposure Dose Calculator & Visualizer for Most Exposed Neighbor Blocks based on Source Activity */}
                <DockableWindowFrame
                  windowId="neighbor_24h_asbestos_dose"
                  state={windowStates.neighbor_24h_asbestos_dose}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <Neighbor24hAsbestosExposureDoseWidget
                    receptors={receptors}
                    sources={sources}
                    buildings={buildings}
                    weatherHours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    selectedSourceId={selectedSourceId}
                    selectedReceptorId={selectedReceptorId}
                    asbestosSourceScope={asbestosSourceScope}
                    onChangeAsbestosSourceScope={setAsbestosSourceScope}
                    onSelectSource={(srcId) => setSelectedSourceId(srcId)}
                    onToggleSourceActive={toggleSourceActive}
                    onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                    onSelectHour={(hrIdx) => {
                      setSelectedHourIndex(hrIdx);
                      setPlumeRouteProgress(hrIdx);
                    }}
                    onActivate3DTemporalAsbestosHeatmap={() => {
                      setAsbestosHeatmapActive(true);
                      setTemporal24hAsbestosAccumulation(true);
                      if (viewportMode !== '3d' && viewportMode !== 'split') {
                        setViewportMode('3d');
                      }
                    }}
                  />
                </DockableWindowFrame>

                {/* SAMMENKLAPPELIG: 29-Enheder Bygningskategorier & DMA-Prøver */}
                <CollapsibleSection
                  title="29-Enheder Bygningskategorier & DMA-Prøver"
                  subtitle="Master bygningsregister (a–e), Wissenberg/COWI miljøprøver & DMA-anbefalinger"
                  badge={`${buildings.length} enheder`}
                  icon={<Layers className="w-3.5 h-3.5 text-cyan-400" />}
                  defaultOpen={false}
                >
                  <BuildingCategoryManagerPanel
                    buildings={buildings}
                    activeCategoryFilters={activeCategoryFilters}
                    onToggleCategoryFilter={handleToggleCategoryFilter}
                    onResetCategoryFilters={handleResetCategoryFilters}
                    onChangeBuildingCategory={handleChangeBuildingCategory}
                    onApplyBatchScenario={handleApplyBatchBuildingScenario}
                    selectedBuildingId={selectedBuildingId}
                    onSelectBuildingOnMap={(b) => {
                      setSelectedBuildingId(b.id);
                      const meta = BUILDING_CATEGORY_METADATA[b.category];
                      if (meta.actsAsSource) {
                        setSelectedSourceId(getSourceIdForBuilding(b.id));
                      }
                      if (meta.actsAsReceptor) {
                        setSelectedReceptorId(getReceptorIdForBuilding(b.id));
                      }
                    }}
                    receptorExposures={receptorExposures}
                    currentWeather={currentWeather}
                  />

                  <BuildingSampleAndDmaPanel
                    buildings={buildings}
                    selectedBuildingId={selectedBuildingId}
                    onSelectBuildingId={(bId) => {
                      setSelectedBuildingId(bId);
                      const b = buildings.find((item) => item.id === bId);
                      if (b) {
                        const meta = BUILDING_CATEGORY_METADATA[b.category];
                        if (meta.actsAsSource) {
                          setSelectedSourceId(getSourceIdForBuilding(b.id));
                        }
                        if (meta.actsAsReceptor) {
                          setSelectedReceptorId(getReceptorIdForBuilding(b.id));
                        }
                      }
                    }}
                    onChangeBuildingCategory={handleChangeBuildingCategory}
                  />
                </CollapsibleSection>

                {/* SAMMENKLAPPELIG: 3D Kilde-Parametre & Asbest-Fiber Heatmap */}
                <CollapsibleSection
                  title="3D Kilde-Parametre & Asbest-Fiber Heatmap"
                  subtitle="Frigivelseshøjde (H), <1997 asbest-fiberindeks & snithøjde pr. kildenode"
                  badge={`${sources.filter((s) => s.active).length}/${sources.length} aktive`}
                  icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}
                  defaultOpen={false}
                  accentBorderClass="border-rose-500/40"
                >
                  <div className="space-y-2.5">
                    {/* Dedicated 3D Asbestos-Fiber Dispersion Heatmap Control Banner in Stof-Panelet */}
                    <div className="p-3 rounded-md bg-rose-950/35 border border-rose-500/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-200 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>3D Asbest-Fiber Sprednings-Heatmap (Kilde-Parametre)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAsbestosHeatmapActive(true);
                            if (viewportMode !== '3d' && viewportMode !== 'split') {
                              setViewportMode('3d');
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-mono font-bold transition-colors shrink-0 inline-flex items-center gap-1"
                        >
                          <Biohazard className="w-3.5 h-3.5 shrink-0" />
                          <span>Fokusér 3D Heatmap</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-snug">
                        Justér <strong className="text-white">frigivelseshøjde (H)</strong> og{' '}
                        <strong className="text-emerald-300">&lt;1997 asbest-fiberindeks</strong> på
                        kildenoderne herunder for at se fiber-koncentrationen (fibre/cm³ mod 2026-GV =
                        0,003 fibre/cm³) opdatere i realtid i 3D-scenen.
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-rose-500/30 text-[11px] font-mono">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">3D Visning:</span>
                          <button
                            type="button"
                            onClick={() => setAsbestosSourceScope('all_active')}
                            className={`px-2 py-0.5 rounded border transition-colors ${
                              asbestosSourceScope === 'all_active'
                                ? 'bg-rose-600 text-white font-bold border-rose-300'
                                : 'bg-slate-900 text-slate-300 border-slate-800'
                            }`}
                          >
                            Alle aktive kilder
                          </button>
                          <button
                            type="button"
                            onClick={() => setAsbestosSourceScope('selected_source')}
                            className={`px-2 py-0.5 rounded border transition-colors ${
                              asbestosSourceScope === 'selected_source'
                                ? 'bg-rose-600 text-white font-bold border-rose-300'
                                : 'bg-slate-900 text-slate-300 border-slate-800'
                            }`}
                          >
                            Kun valgt kilde
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Snithøjde:</span>
                          {[1.5, 6.0, 12.0].map((hVal) => (
                            <button
                              key={hVal}
                              type="button"
                              onClick={() => setAsbestosEvalHeightMeters(hVal)}
                              className={`px-1.5 py-0.5 rounded border transition-colors ${
                                Math.abs(asbestosEvalHeightMeters - hVal) < 0.2
                                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                                  : 'bg-slate-900 text-slate-300 border-slate-800'
                              }`}
                            >
                              {hVal}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <SourceManagerPanel
                      sources={sources}
                      receptors={receptors}
                      receptorExposures={receptorExposures}
                      currentWeather={currentWeather}
                      selectedSourceId={selectedSourceId}
                      onSelectSource={(id) => setSelectedSourceId(id)}
                      onToggleSourceActive={toggleSourceActive}
                      onToggleSourceAsbestosSubstance={toggleSourceAsbestosSubstance}
                      onUpdateSourceReleaseHeight={updateSourceReleaseHeight}
                      onUpdateSourceFiberReleaseIndex={updateSourceFiberReleaseIndex}
                      onUpdateSourceBaseLwaDb={updateSourceBaseLwaDb}
                      onResetSourceBaseLwaDb={resetSourceBaseLwaDb}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                    />
                  </div>
                </CollapsibleSection>
                </div>
              </DockableWindowFrame>
            )}

            {/* TAB 2: 24-TIMERS GAUSSISK PUFF-HISTORIK & SPIDSBELASTNINGS-RECEPTOR */}
            {activeTab === 'puff24h' && (
              <div className="space-y-4">
                {/* SAMMENKLAPPELIG: 30-DAGES HEATMAP & PRÆDIKTION VS. VIRKELIGHED */}
                <CollapsibleSection
                  title="30-Dages Heatmap & Prædiktion vs. Virkelighed"
                  subtitle="Langtidssimulering, 7-dages prognose, midnat 00:00 tidsslider & auto-bevis"
                  badge="30d + Prognose"
                  icon={<Calendar className="w-3.5 h-3.5 text-cyan-400" />}
                  defaultOpen={false}
                  forceOpen={
                    isSidebarMinimizeOthersActive &&
                    (effectiveActiveSidebarWindowId === 'thirty_day_aggregated_heatmap' ||
                      effectiveActiveSidebarWindowId === 'prediction_vs_actual_forecast')
                  }
                >
                  <div className="space-y-3">
                    {/* NEW: 30-Day Aggregated Dust Dispersion Heatmap & Long-Term Trends (Saved Simulations) */}
                    <DockableWindowFrame
                      windowId="thirty_day_aggregated_heatmap"
                      state={windowStates.thirty_day_aggregated_heatmap}
                      onMinimize={handleMinimizeWindow}
                      onPopOutFloating={handlePopOutFloatingWindow}
                      onRestore={handleRestoreWindow}
                    >
                      <ThirtyDayAggregatedHeatmapWidget
                        todayIso={todayIso}
                        selectedDateIso={selectedDateIso}
                        currentWeather={currentWeather}
                        weatherDataset={weatherDataset}
                        sources={sources}
                        receptors={receptors}
                        selectedReceptorId={selectedReceptorId}
                        onSelectDateIso={(newDateIso) => {
                          setSelectedDateIso(newDateIso);
                          loadLiveOpenMeteo(newDateIso);
                        }}
                        onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      />
                    </DockableWindowFrame>

                    {/* NEW: Prediction vs. Actual Weather Event (Pre-run Last Week Test) + Next Week 7-Day Forecast Simulation + Midnight 00:00 Time-Travel Recorder */}
                    <DockableWindowFrame
                      windowId="prediction_vs_actual_forecast"
                      state={windowStates.prediction_vs_actual_forecast}
                      onMinimize={handleMinimizeWindow}
                      onPopOutFloating={handlePopOutFloatingWindow}
                      onRestore={handleRestoreWindow}
                    >
                      <PredictionVsActualAndForecastWidget
                        todayIso={todayIso}
                        selectedDateIso={selectedDateIso}
                        selectedHourIndex={selectedHourIndex}
                        isPlaying={isPlaying}
                        isContinuousRecordingToToday={isContinuousRecordingToToday}
                        playbackTargetEndDateIso={playbackTargetEndDateIso}
                        midnightRolloverCount={midnightRolloverCount}
                        recordedTimelineEvents={recordedTimelineEvents}
                        sources={sources}
                        receptors={receptors}
                        onStartTimeTravelToToday={handleStartTimeTravelToToday}
                        onStartNextWeekForecastPlayback={handleStartNextWeekForecastPlayback}
                        onStopTimeTravelRecording={handleStopTimeTravelRecording}
                        onClearRecordedEvents={() => setRecordedTimelineEvents([])}
                        onSelectDateAndHour={(dIso, hrIdx, customDs) => {
                          setSelectedDateIso(dIso);
                          setSelectedHourIndex(hrIdx);
                          setPlumeRouteProgress(hrIdx);
                          if (customDs) {
                            setWeatherDataset(customDs);
                          } else {
                            loadLiveOpenMeteo(dIso);
                          }
                        }}
                        autoSaveEvidenceOnTimeTravel={autoSaveEvidenceOnTimeTravel}
                        onToggleAutoSaveEvidence={() =>
                          setAutoSaveEvidenceOnTimeTravel((v) => !v)
                        }
                        autoSavedEvidenceCount={autoSavedEvidenceCount}
                      />
                    </DockableWindowFrame>
                  </div>
                </CollapsibleSection>

                {/* 24h Open-Meteo Telemetry Summary Banner */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md text-xs font-mono space-y-1">
                  <div className="text-[11px] text-cyan-400 uppercase font-semibold">
                    24-TIMERS OPEN-METEO VIND- &amp; PUFF-INTEGRATION ({weatherDataset.dateIso})
                  </div>
                  <div className="text-slate-200">{puff24h.dominantWindSectorText}</div>
                  <div className="text-[11px] text-slate-400">
                    Vindinterval (00:00–23:00): {puff24h.minWindSpeedMs}–{puff24h.maxWindSpeedMs} m/s
                    (stød op til {puff24h.maxWindGustsMs} m/s)
                  </div>
                </div>

                {/* Interactive 24-Hour Polar Wind-Rose & Prevailing Dispersion Chart */}
                <DockableWindowFrame
                  windowId="wind_rose_24h"
                  state={windowStates.wind_rose_24h}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <InteractiveWindRoseChart
                    hours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    dateIso={weatherDataset.dateIso}
                    onSelectHour={(hrIdx) => {
                      setSelectedHourIndex(hrIdx);
                      setPlumeRouteProgress(hrIdx);
                    }}
                  />
                </DockableWindowFrame>

                {/* 5-Døgns Vindprognose & Kommende Uges Vindrose-Overblik (Open-Meteo) */}
                <FiveDayWindForecastRoseWidget
                  todayIso={todayIso}
                  onSelectForecastDay={(dIso, customDs) => {
                    setSelectedDateIso(dIso);
                    setWeatherDataset(customDs);
                  }}
                />

                {/* SAMMENKLAPPELIG: 7-DAGES VINDROSE, STOKASTISK VIND-BIAS & TEMPERATUR-AEROSOL */}
                <CollapsibleSection
                  title="7-Dages Vindrose, Stokastisk Vind-Bias & Temperatur-Aerosol"
                  subtitle="Slagelse klimanormal, Open-Meteo usikkerhed & 24t aerosoldannelse"
                  badge="Meteorologi"
                  icon={<Wind className="w-3.5 h-3.5 text-amber-400" />}
                  defaultOpen={false}
                  forceOpen={
                    isSidebarMinimizeOthersActive &&
                    (effectiveActiveSidebarWindowId === 'wind_rose_7day' ||
                      effectiveActiveSidebarWindowId === 'stochastic_wind_bias' ||
                      effectiveActiveSidebarWindowId === 'temp_aerosol_24h')
                  }
                >
                  <div className="space-y-3">
                    {/* Dedicated 7-Day Historical Wind-Rose vs. Typical Slagelse Climate Normal Widget */}
                    <DockableWindowFrame
                      windowId="wind_rose_7day"
                      state={windowStates.wind_rose_7day}
                      onMinimize={handleMinimizeWindow}
                      onPopOutFloating={handlePopOutFloatingWindow}
                      onRestore={handleRestoreWindow}
                    >
                      <SevenDayHistoricalWindRoseWidget
                        dateIso={weatherDataset.dateIso}
                        currentDayHours={weatherDataset.hours}
                        currentWeather={currentWeather}
                        onSelectDateIso={(newDateIso) => {
                          setSelectedDateIso(newDateIso);
                          loadLiveOpenMeteo(newDateIso);
                        }}
                        onSelectHour={(hrIdx) => {
                          setSelectedHourIndex(hrIdx);
                          setPlumeRouteProgress(hrIdx);
                        }}
                      />
                    </DockableWindowFrame>

                    {/* Stochastic Wind-Bias Analysis Widget (24h Statistical Uncertainty: Open-Meteo vs. Actual Slagelse Weather Station) */}
                    <DockableWindowFrame
                      windowId="stochastic_wind_bias"
                      state={windowStates.stochastic_wind_bias}
                      onMinimize={handleMinimizeWindow}
                      onPopOutFloating={handlePopOutFloatingWindow}
                      onRestore={handleRestoreWindow}
                    >
                      <StochasticWindBiasWidget
                        hours={weatherDataset.hours}
                        currentWeather={currentWeather}
                        dateIso={weatherDataset.dateIso}
                        puff24h={puff24h}
                        selectedReceptorId={selectedReceptorId}
                        onSelectHour={(hrIdx) => {
                          setSelectedHourIndex(hrIdx);
                          setPlumeRouteProgress(hrIdx);
                        }}
                        onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      />
                    </DockableWindowFrame>

                    {/* 24-Hour Temperature Development vs. Aerosol Formation Correlation (Recharts) */}
                    <DockableWindowFrame
                      windowId="temp_aerosol_24h"
                      state={windowStates.temp_aerosol_24h}
                      onMinimize={handleMinimizeWindow}
                      onPopOutFloating={handlePopOutFloatingWindow}
                      onRestore={handleRestoreWindow}
                    >
                      <TemperatureAerosolChart
                        hours={weatherDataset.hours}
                        currentWeather={currentWeather}
                        dateIso={weatherDataset.dateIso}
                        onSelectHour={(hrIdx) => {
                          setSelectedHourIndex(hrIdx);
                          setPlumeRouteProgress(hrIdx);
                        }}
                        variant="full"
                      />
                    </DockableWindowFrame>
                  </div>
                </CollapsibleSection>

                {/* Peak Exposed Receptor Highlight Box */}
                <div className="p-3.5 bg-[#1B2433] border border-amber-500/50 rounded-md space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>HØJESTE 24-TIMERS AKKUMULEREDE DOSIS I RINGPARKEN</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      Spids kl. {puff24h.peakReceptor.peakHourLabel}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-bold text-white">
                      {puff24h.peakReceptor.receptorName}
                    </div>
                    <div className="text-xs font-mono text-slate-300">
                      {puff24h.peakReceptor.address} · GPS:{' '}
                      {puff24h.peakReceptor.position.lat.toFixed(4)}°N,{' '}
                      {puff24h.peakReceptor.position.lng.toFixed(4)}°E
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Primær kilde: {puff24h.peakReceptor.nearestSourceName} (
                      {puff24h.peakReceptor.distanceToNearestSourceMeters} m) · Dominerende stof:{' '}
                      {puff24h.peakReceptor.dominantSubstanceName}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 font-mono text-xs">
                    <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                      <div className="text-[11px] text-slate-400">24T KUMULATIV SUM-DOSIS</div>
                      <div className="text-base font-bold text-rose-400">
                        {puff24h.peakReceptor.cumulativeSumDose.toFixed(2)} S·t
                      </div>
                    </div>
                    <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                      <div className="text-[11px] text-slate-400">KLOKKESLÆT SPIDSBELASTNING</div>
                      <div className="text-base font-bold text-amber-300">
                        kl. {puff24h.peakReceptor.peakHourLabel} (S=
                        {puff24h.peakReceptor.peakSumQuotient.toFixed(2)})
                      </div>
                    </div>
                    <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                      <div className="text-[11px] text-slate-400">24T TUNGMETAL/PCB DEPONERING</div>
                      <div className="text-sm font-bold text-white">
                        {puff24h.peakReceptor.totalDepositedHeavyMetalsAndPcbUgM2} µg/m²
                      </div>
                    </div>
                    <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                      <div className="text-[11px] text-slate-400">24T ASBESTFIBER-DEPONERING</div>
                      <div className="text-sm font-bold text-white">
                        {puff24h.peakReceptor.totalDepositedAsbestosFibersM2.toLocaleString('da-DK')}{' '}
                        fibre/m²
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPuffMode(true);
                      setSelectedHourIndex(puff24h.peakReceptor.peakHourIndex);
                    }}
                    className="w-full py-1.5 rounded bg-amber-400 text-slate-950 font-mono text-xs font-bold hover:bg-amber-300 transition-colors"
                  >
                    Fokusér Kort &amp; Time-Slider på Spidsbelastning (kl.{' '}
                    {puff24h.peakReceptor.peakHourLabel})
                  </button>
                </div>

                {/* Interactive Cumulative Dose of Respirable Dust Particles & 24h Neighbor Asbestos Exposure Dose */}
                <DockableWindowFrame
                  windowId="cumulative_dust_24h"
                  state={windowStates.cumulative_dust_24h}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <div className="space-y-3">
                    {windowStates.neighbor_24h_asbestos_dose?.isFloating ? (
                      <div
                        data-window-id="neighbor_24h_asbestos_dose"
                        data-window-floating="true"
                        className="w-full px-3 py-2 rounded-md bg-[#1B2433] border border-dashed border-[#36465E] flex items-center justify-between gap-2 font-mono text-xs"
                      >
                        <span className="text-slate-200 text-[11px] truncate">
                          Vinduet (<strong className="text-white">24t Nabo Asbest-Dosis</strong>) vises som flydende panel
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRestoreWindow('neighbor_24h_asbestos_dose')}
                          className="px-2.5 py-1 rounded bg-[#212C3E] hover:bg-slate-700 border border-[#36465E] text-cyan-300 text-[11px] font-semibold shrink-0 cursor-pointer"
                        >
                          Fastgør her
                        </button>
                      </div>
                    ) : (
                      <Neighbor24hAsbestosExposureDoseWidget
                        receptors={receptors}
                        sources={sources}
                        buildings={buildings}
                        weatherHours={weatherDataset.hours}
                        currentWeather={currentWeather}
                        selectedSourceId={selectedSourceId}
                        selectedReceptorId={selectedReceptorId}
                        asbestosSourceScope={asbestosSourceScope}
                        onChangeAsbestosSourceScope={setAsbestosSourceScope}
                        onSelectSource={(srcId) => setSelectedSourceId(srcId)}
                        onToggleSourceActive={toggleSourceActive}
                        onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                        onSelectHour={(hrIdx) => {
                          setSelectedHourIndex(hrIdx);
                          setPlumeRouteProgress(hrIdx);
                        }}
                        onActivate3DTemporalAsbestosHeatmap={() => {
                          setAsbestosHeatmapActive(true);
                          setTemporal24hAsbestosAccumulation(true);
                          if (viewportMode !== '3d' && viewportMode !== 'split') {
                            setViewportMode('3d');
                          }
                        }}
                      />
                    )}
                    <CumulativeRespirableDustChart
                      puff24h={puff24h}
                      weatherHours={weatherDataset.hours}
                      currentWeather={currentWeather}
                      selectedReceptorId={selectedReceptorId}
                      onSelectHour={(hrIdx) => {
                        setSelectedHourIndex(hrIdx);
                        setPlumeRouteProgress(hrIdx);
                      }}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                    />
                  </div>
                </DockableWindowFrame>

                {/* Side-by-Side: 24-Hour Dose Histogram & 'Vejr-Trend' Line Graph (Wind Speed & Precipitation) with Sunrise/Sunset Timeline Markers */}
                {(() => {
                  const hours24 = weatherDataset.hours;
                  const solarInfo = computeSunriseSunsetForDate(weatherDataset.dateIso);
                  const sunriseLeftPct = Math.max(
                    2,
                    Math.min(96, (solarInfo.sunriseDecimalHour / 23) * 100)
                  );
                  const sunsetLeftPct = Math.max(
                    4,
                    Math.min(98, (solarInfo.sunsetDecimalHour / 23) * 100)
                  );
                  const daylightWidthPct = Math.max(2, sunsetLeftPct - sunriseLeftPct);

                  const hourlyProfile = puff24h.peakReceptor.hourlyProfile;
                  const daylightProfileHours = hourlyProfile.filter(
                    (hp) =>
                      hp.hourIndex >= solarInfo.sunriseHourIndex &&
                      hp.hourIndex <= solarInfo.sunsetHourIndex
                  );
                  const nightProfileHours = hourlyProfile.filter(
                    (hp) =>
                      hp.hourIndex < solarInfo.sunriseHourIndex ||
                      hp.hourIndex > solarInfo.sunsetHourIndex
                  );

                  const totalDose24h = Math.max(
                    0.001,
                    hourlyProfile.reduce((acc, hp) => acc + hp.sumQuotient, 0)
                  );
                  const daylightCumulativeDose = daylightProfileHours.reduce(
                    (acc, hp) => acc + hp.sumQuotient,
                    0
                  );
                  const daylightDoseSharePct = Math.round(
                    (daylightCumulativeDose / totalDose24h) * 100
                  );
                  const meanDaylightS =
                    daylightProfileHours.length > 0
                      ? daylightCumulativeDose / daylightProfileHours.length
                      : 0;
                  const meanNightS =
                    nightProfileHours.length > 0
                      ? nightProfileHours.reduce((acc, hp) => acc + hp.sumQuotient, 0) /
                        nightProfileHours.length
                      : 0;

                  const maxS = Math.max(1.5, puff24h.peakReceptor.peakSumQuotient);
                  const maxWind = Math.max(
                    12,
                    ...hours24.map((h) => Math.max(h.windSpeed10m, h.windGusts10m))
                  );
                  const maxPrecip = Math.max(5, ...hours24.map((h) => h.precipitation));
                  const svgW = 240;
                  const svgH = 96;
                  const padX = 6;
                  const padY = 8;
                  const plotW = svgW - padX * 2;
                  const plotH = svgH - padY * 2;

                  const xForHour = (idx: number) =>
                    padX + (idx / Math.max(1, hours24.length - 1)) * plotW;
                  const yForWind = (val: number) =>
                    padY + plotH - Math.min(1, Math.max(0, val / maxWind)) * plotH;
                  const yForPrecip = (val: number) =>
                    padY + plotH - Math.min(1, Math.max(0, val / maxPrecip)) * plotH;

                  const sunriseSvgX = xForHour(solarInfo.sunriseDecimalHour);
                  const sunsetSvgX = xForHour(solarInfo.sunsetDecimalHour);

                  const windPoints = hours24
                    .map((h, i) => `${xForHour(i).toFixed(1)},${yForWind(h.windSpeed10m).toFixed(1)}`)
                    .join(' ');
                  const windAreaPoints = `${xForHour(0).toFixed(1)},${(padY + plotH).toFixed(1)} ${windPoints} ${xForHour(hours24.length - 1).toFixed(1)},${(padY + plotH).toFixed(1)}`;

                  const gustPoints = hours24
                    .map((h, i) => `${xForHour(i).toFixed(1)},${yForWind(h.windGusts10m).toFixed(1)}`)
                    .join(' ');
                  const gustAreaPoints = `${xForHour(0).toFixed(1)},${(padY + plotH).toFixed(1)} ${gustPoints} ${xForHour(hours24.length - 1).toFixed(1)},${(padY + plotH).toFixed(1)}`;
                  const maxGust24h = Math.max(...hours24.map((h) => h.windGusts10m));
                  const peakGustHrIdx = hours24.reduce(
                    (bestIdx, h, idx) =>
                      h.windGusts10m > (hours24[bestIdx]?.windGusts10m ?? 0) ? idx : bestIdx,
                    0
                  );

                  const precipPoints = hours24
                    .map(
                      (h, i) => `${xForHour(i).toFixed(1)},${yForPrecip(h.precipitation).toFixed(1)}`
                    )
                    .join(' ');
                  const precipAreaPoints = `${xForHour(0).toFixed(1)},${(padY + plotH).toFixed(1)} ${precipPoints} ${xForHour(hours24.length - 1).toFixed(1)},${(padY + plotH).toFixed(1)}`;

                  const peakHrIdx = puff24h.peakReceptor.peakHourIndex;
                  const peakWeather = hours24[peakHrIdx] || currentWeather;
                  const selectedProfilePt =
                    puff24h.peakReceptor.hourlyProfile[selectedHourIndex] ||
                    puff24h.peakReceptor.hourlyProfile[0];

                  return (
                    <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                            METEOROLOGISK KORRELATION &amp; DAGSLYS-VINDUE (00:00–23:00)
                          </div>
                          <div className="text-xs font-bold text-white">
                            Dosis-Histogram (Solopgang/Solnedgang) vs. Vejr-Trend
                          </div>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300">
                          Valgt: kl. {currentWeather.hourLabel} · Spids: kl.{' '}
                          {puff24h.peakReceptor.peakHourLabel}
                        </span>
                      </div>

                      {/* Sunrise & Sunset Interactive Timeline Strip for Selected Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-950/90 border border-yellow-500/35 font-mono text-[11px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHourIndex(solarInfo.sunriseHourIndex);
                              setPlumeRouteProgress(solarInfo.sunriseHourIndex);
                            }}
                            className="px-2 py-0.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/60 text-yellow-200 font-bold flex items-center gap-1 transition-colors"
                            title={`Hop til solopgang i Slagelse (${weatherDataset.dateIso} kl. ${solarInfo.sunriseLabel})`}
                          >
                            <Sun className="w-3 h-3 text-yellow-300 shrink-0" />
                            <span>Solopgang: {solarInfo.sunriseLabel}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHourIndex(solarInfo.sunsetHourIndex);
                              setPlumeRouteProgress(solarInfo.sunsetHourIndex);
                            }}
                            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-bold flex items-center gap-1 transition-colors"
                            title={`Hop til solnedgang i Slagelse (${weatherDataset.dateIso} kl. ${solarInfo.sunsetLabel})`}
                          >
                            <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Solnedgang: {solarInfo.sunsetLabel}</span>
                          </button>
                        </div>

                        <div className="text-slate-300 flex items-center gap-1.5">
                          <span className="text-yellow-300 font-semibold">
                            Dagslys: {solarInfo.daylightDurationFormatted}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-cyan-300 font-semibold">
                            {daylightDoseSharePct}% af 24t støv i dagslys
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* LEFT: 24-Hour Dose Histogram with Sunrise & Sunset Visual Timeline Markers */}
                        <div className="p-2.5 bg-slate-950/90 border border-slate-800/90 rounded space-y-1.5 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                            <span className="text-slate-200 font-semibold truncate">
                              Dosis-Histogram ({puff24h.peakReceptor.receptorCode})
                            </span>
                            <span className="text-rose-400 font-bold shrink-0">
                              S_max={puff24h.peakReceptor.peakSumQuotient.toFixed(2)}
                            </span>
                          </div>

                          <div className="relative h-28 flex items-end gap-0.5 pt-5">
                            {/* Shaded Daylight Demolition Window between Sunrise and Sunset */}
                            <div
                              className="absolute inset-y-0 bg-amber-400/10 border-x border-amber-400/20 pointer-events-none z-0 rounded-t"
                              style={{
                                left: `${sunriseLeftPct.toFixed(1)}%`,
                                width: `${daylightWidthPct.toFixed(1)}%`,
                              }}
                            >
                              <div className="w-full text-center text-[11px] font-mono text-yellow-200/80 pt-0.5 truncate">
                                Dagslys ({solarInfo.sunriseLabel}–{solarInfo.sunsetLabel})
                              </div>
                            </div>

                            {/* Visual Timeline Marker: SUNRISE (Solopgang) */}
                            <div
                              className="absolute inset-y-0 border-l-2 border-dashed border-yellow-300/90 z-20 pointer-events-none"
                              style={{ left: `${sunriseLeftPct.toFixed(1)}%` }}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedHourIndex(solarInfo.sunriseHourIndex)}
                                title={`Solopgang kl. ${solarInfo.sunriseLabel} (${weatherDataset.dateIso}) — Klik for at vælge kl. ${String(
                                  solarInfo.sunriseHourIndex
                                ).padStart(2, '0')}:00`}
                                className="pointer-events-auto -translate-x-1/2 -top-0.5 absolute px-1 py-0.2 rounded bg-slate-950/95 border border-yellow-300 text-[11px] font-mono font-bold text-yellow-300 whitespace-nowrap hover:bg-yellow-400 hover:text-slate-950 transition-colors"
                              >
                                ↑ {solarInfo.sunriseLabel}
                              </button>
                            </div>

                            {/* Visual Timeline Marker: SUNSET (Solnedgang) */}
                            <div
                              className="absolute inset-y-0 border-l-2 border-dashed border-amber-400/90 z-20 pointer-events-none"
                              style={{ left: `${sunsetLeftPct.toFixed(1)}%` }}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedHourIndex(solarInfo.sunsetHourIndex)}
                                title={`Solnedgang kl. ${solarInfo.sunsetLabel} (${weatherDataset.dateIso}) — Klik for at vælge kl. ${String(
                                  solarInfo.sunsetHourIndex
                                ).padStart(2, '0')}:00`}
                                className="pointer-events-auto -translate-x-1/2 -top-0.5 absolute px-1 py-0.2 rounded bg-slate-950/95 border border-amber-400 text-[11px] font-mono font-bold text-amber-300 whitespace-nowrap hover:bg-amber-400 hover:text-slate-950 transition-colors"
                              >
                                ↓ {solarInfo.sunsetLabel}
                              </button>
                            </div>

                            {/* S = 1.0 Legal Limit Reference Line */}
                            <div
                              className="absolute inset-x-0 border-t border-dashed border-rose-500/60 pointer-events-none z-10"
                              style={{
                                bottom: `${Math.min(84, Math.round((1.0 / maxS) * 84))}%`,
                              }}
                            >
                              <span className="absolute right-0 -top-3 text-[11px] font-mono text-rose-400 bg-slate-950/80 px-1 rounded">
                                S=1,0
                              </span>
                            </div>

                            {puff24h.peakReceptor.hourlyProfile.map((hp) => {
                              const heightPct = Math.max(
                                8,
                                Math.min(86, Math.round((hp.sumQuotient / maxS) * 86))
                              );
                              const isPeak = hp.hourIndex === peakHrIdx;
                              const isSelectedHr = hp.hourIndex === selectedHourIndex;
                              const isDaylightBar =
                                hp.hourIndex >= solarInfo.sunriseHourIndex &&
                                hp.hourIndex <= solarInfo.sunsetHourIndex;
                              return (
                                <button
                                  key={hp.hourIndex}
                                  type="button"
                                  onClick={() => setSelectedHourIndex(hp.hourIndex)}
                                  title={`Kl. ${hp.hourLabel} (${
                                    isDaylightBar
                                      ? `Dagslys ${solarInfo.sunriseLabel}–${solarInfo.sunsetLabel}`
                                      : 'Nat/Skumring'
                                  }): S = ${hp.sumQuotient.toFixed(2)} · Vind ${
                                    hp.windSpeedMs
                                  } m/s fra ${hp.windDirectionFromDeg}°`}
                                  className={`relative z-10 flex-1 rounded-t transition-all ${
                                    isPeak
                                      ? 'bg-amber-400 ring-1 ring-white'
                                      : hp.sumQuotient >= 1.0
                                      ? 'bg-rose-500'
                                      : hp.sumQuotient >= 0.5
                                      ? 'bg-orange-400'
                                      : isDaylightBar
                                      ? 'bg-cyan-400/75'
                                      : 'bg-cyan-600/45'
                                  } ${
                                    isSelectedHr
                                      ? 'opacity-100 ring-1 ring-cyan-300'
                                      : 'opacity-80 hover:opacity-100'
                                  }`}
                                  style={{ height: `${heightPct}%` }}
                                />
                              );
                            })}
                          </div>

                          <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 pt-0.5 tabular-nums">
                            <span>00</span>
                            <span className="text-yellow-300 font-semibold inline-flex items-center gap-0.5">
                              <Sun className="w-3 h-3 shrink-0" />
                              <span>{solarInfo.sunriseLabel}</span>
                            </span>
                            <span>12</span>
                            <span className="text-amber-300 font-semibold inline-flex items-center gap-0.5">
                              <Moon className="w-3 h-3 shrink-0" />
                              <span>{solarInfo.sunsetLabel}</span>
                            </span>
                            <span>23</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-1">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block" /> S≥1,0
                            </span>
                            <span className="flex items-center gap-1 text-yellow-300">
                              <span className="w-2 h-2 rounded-xs bg-yellow-400/50 border border-yellow-300 inline-block" />{' '}
                              Dagslys
                            </span>
                            <span className="text-slate-300">
                              Kl. {currentWeather.hourLabel}: S=
                              {selectedProfilePt.sumQuotient.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* RIGHT: 'Vejr-Trend' 24-Hour Line Graph (Wind Speed, Peak Wind Gust & Precipitation) with Sunrise/Sunset Markers */}
                        <div className="p-2.5 bg-slate-950/90 border border-slate-800/90 rounded space-y-1.5 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-cyan-300 font-semibold flex items-center gap-1">
                              <Wind className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span>Vejr-Trend (24t)</span>
                            </span>
                            <span className="text-[11px] text-slate-400">
                              <span className="text-amber-300 font-semibold">
                                Peak Stød: {maxGust24h.toFixed(1)} m/s
                              </span>{' '}
                              · <span className="text-cyan-300">{maxWind.toFixed(0)} m/s</span> ·{' '}
                              <span className="text-indigo-300">{maxPrecip.toFixed(1)} mm/t</span>
                            </span>
                          </div>

                          <div className="relative h-28 w-full">
                            <svg
                              viewBox={`0 0 ${svgW} ${svgH}`}
                              className="w-full h-full overflow-visible"
                              preserveAspectRatio="none"
                            >
                              <defs>
                                <linearGradient id="windAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
                                </linearGradient>
                                <linearGradient id="gustAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.24" />
                                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                                </linearGradient>
                                <linearGradient id="precipAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.40" />
                                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.03" />
                                </linearGradient>
                              </defs>

                              {/* Daylight Window Shading on Vejr-Trend SVG */}
                              <rect
                                x={sunriseSvgX}
                                y={padY}
                                width={Math.max(4, sunsetSvgX - sunriseSvgX)}
                                height={plotH}
                                fill="rgba(250, 204, 21, 0.07)"
                              />

                              {/* Sunrise & Sunset Vertical Dashed Lines on Vejr-Trend SVG */}
                              <line
                                x1={sunriseSvgX}
                                x2={sunriseSvgX}
                                y1={padY}
                                y2={padY + plotH}
                                stroke="#fde047"
                                strokeWidth="1.1"
                                strokeDasharray="3 2"
                              />
                              <line
                                x1={sunsetSvgX}
                                x2={sunsetSvgX}
                                y1={padY}
                                y2={padY + plotH}
                                stroke="#f59e0b"
                                strokeWidth="1.1"
                                strokeDasharray="3 2"
                              />

                              {/* Horizontal Grid Lines */}
                              {[0.25, 0.5, 0.75].map((ratio) => (
                                <line
                                  key={ratio}
                                  x1={padX}
                                  x2={svgW - padX}
                                  y1={padY + plotH * ratio}
                                  y2={padY + plotH * ratio}
                                  stroke="#1e293b"
                                  strokeWidth="1"
                                  strokeDasharray="2 2"
                                />
                              ))}

                              {/* Peak Dose Hour Vertical Marker */}
                              <line
                                x1={xForHour(peakHrIdx)}
                                x2={xForHour(peakHrIdx)}
                                y1={padY}
                                y2={padY + plotH}
                                stroke="#fbbf24"
                                strokeWidth="1.2"
                                strokeDasharray="2 2"
                              />

                              {/* Selected Hour Vertical Marker */}
                              <line
                                x1={xForHour(selectedHourIndex)}
                                x2={xForHour(selectedHourIndex)}
                                y1={padY}
                                y2={padY + plotH}
                                stroke="#e2e8f0"
                                strokeWidth="1.2"
                              />

                              {/* Precipitation Area & Line (mm/t) */}
                              <polygon points={precipAreaPoints} fill="url(#precipAreaGrad)" />
                              <polyline
                                fill="none"
                                stroke="#818cf8"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={precipPoints}
                              />

                              {/* Peak Wind Gust (m/s) Area & Trend Line */}
                              <polygon points={gustAreaPoints} fill="url(#gustAreaGrad)" />
                              <polyline
                                fill="none"
                                stroke="#fbbf24"
                                strokeWidth="1.9"
                                strokeDasharray="4 2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.95"
                                points={gustPoints}
                              />

                              {/* Wind Speed 10m Area & Solid Line (m/s) */}
                              <polygon points={windAreaPoints} fill="url(#windAreaGrad)" />
                              <polyline
                                fill="none"
                                stroke="#22d3ee"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={windPoints}
                              />

                              {/* Active Hour Data Dots (Wind Speed, Peak Wind Gust & Precipitation) */}
                              {hours24[selectedHourIndex] && (
                                <>
                                  <circle
                                    cx={xForHour(selectedHourIndex)}
                                    cy={yForWind(hours24[selectedHourIndex].windGusts10m)}
                                    r="3"
                                    fill="#fbbf24"
                                    stroke="#0f172a"
                                    strokeWidth="1.2"
                                  />
                                  <circle
                                    cx={xForHour(selectedHourIndex)}
                                    cy={yForWind(hours24[selectedHourIndex].windSpeed10m)}
                                    r="3"
                                    fill="#22d3ee"
                                    stroke="#0f172a"
                                    strokeWidth="1.2"
                                  />
                                  <circle
                                    cx={xForHour(selectedHourIndex)}
                                    cy={yForPrecip(hours24[selectedHourIndex].precipitation)}
                                    r="2.8"
                                    fill="#818cf8"
                                    stroke="#0f172a"
                                    strokeWidth="1.2"
                                  />
                                </>
                              )}

                              {/* 24h Peak Wind Gust Data Dot */}
                              {hours24[peakGustHrIdx] && (
                                <circle
                                  cx={xForHour(peakGustHrIdx)}
                                  cy={yForWind(hours24[peakGustHrIdx].windGusts10m)}
                                  r="3.4"
                                  fill="#f43f5e"
                                  stroke="#fde047"
                                  strokeWidth="1.2"
                                />
                              )}

                              {/* Peak Dose Hour Data Dot */}
                              {hours24[peakHrIdx] && (
                                <circle
                                  cx={xForHour(peakHrIdx)}
                                  cy={yForWind(hours24[peakHrIdx].windSpeed10m)}
                                  r="3.2"
                                  fill="#fbbf24"
                                  stroke="#0f172a"
                                  strokeWidth="1.2"
                                />
                              )}

                              {/* Interactive Click Columns for all 24 Hours */}
                              {hours24.map((h, i) => {
                                const colW = plotW / hours24.length;
                                return (
                                  <rect
                                    key={h.hourIndex}
                                    x={xForHour(i) - colW / 2}
                                    y={0}
                                    width={colW}
                                    height={svgH}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onClick={() => setSelectedHourIndex(i)}
                                  >
                                    <title>
                                      {`Kl. ${h.hourLabel}: Vind ${h.windSpeed10m} m/s (Peak vindstød ${h.windGusts10m} m/s) · Nedbør ${h.precipitation} mm/t`}
                                    </title>
                                  </rect>
                                );
                              })}
                            </svg>
                          </div>

                          <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 pt-0.5 tabular-nums">
                            <span>00</span>
                            <span className="text-yellow-300 font-semibold inline-flex items-center gap-0.5">
                              <Sun className="w-3 h-3 shrink-0" />
                              <span>{solarInfo.sunriseLabel}</span>
                            </span>
                            <span>12</span>
                            <span className="text-amber-300 font-semibold inline-flex items-center gap-0.5">
                              <Moon className="w-3 h-3 shrink-0" />
                              <span>{solarInfo.sunsetLabel}</span>
                            </span>
                            <span>23</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-1 tabular-nums">
                            <span
                              className={`flex items-center gap-1 ${
                                currentWeather.windSpeed10m > 10
                                  ? 'bg-rose-950/90 text-rose-200 px-1.5 py-0.5 rounded font-bold border border-rose-500/60'
                                  : 'text-cyan-300'
                              }`}
                            >
                              <span
                                className={`w-2.5 h-0.5 inline-block ${
                                  currentWeather.windSpeed10m > 10 ? 'bg-rose-400' : 'bg-cyan-400'
                                }`}
                              />{' '}
                              Vind ({currentWeather.windSpeed10m} m/s
                              {currentWeather.windSpeed10m > 10 ? ' · >10 m/s' : ''})
                            </span>
                            <span className="flex items-center gap-1 text-amber-300 font-semibold">
                              <span className="w-2.5 h-0.5 border-b-2 border-dashed border-amber-400 inline-block" />{' '}
                              Peak Stød ({currentWeather.windGusts10m} m/s)
                            </span>
                            <span className="flex items-center gap-1 text-indigo-300">
                              <span className="w-2.5 h-0.5 bg-indigo-400 inline-block" /> Regn (
                              {currentWeather.precipitation} mm)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Daylight Hours vs. Demolition Dust Dispersion Correlation Summary */}
                      <div className="p-2 bg-slate-950/80 border border-slate-800/90 rounded text-[11px] font-mono text-slate-300 flex flex-col gap-1 tabular-nums">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
                          <span className="text-yellow-300 font-semibold inline-flex items-center gap-1">
                            <Sun className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              DAGSLYS-KORRELATION ({solarInfo.sunriseLabel}–{solarInfo.sunsetLabel} ·{' '}
                              {solarInfo.daylightDurationFormatted}):
                            </span>
                          </span>
                          <span className="text-cyan-300 font-semibold">
                            Gns. S (Dagslys): {meanDaylightS.toFixed(2)} vs. Nat/Skumring:{' '}
                            {meanNightS.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-slate-300 leading-snug">
                          {daylightDoseSharePct}% af døgnets akkumulerede støv- og asbestdosis ved{' '}
                          <strong className="text-white">{puff24h.peakReceptor.receptorCode}</strong>{' '}
                          falder inden for dagslys-timerne ({solarInfo.sunriseLabel}–
                          {solarInfo.sunsetLabel}), hvor mekanisk nedbrydning, solindstråling og
                          termisk konvektion (Pasquill A–D) driver støvfanen mod naboblokkene.
                        </div>
                      </div>

                      {/* Meteorological Correlation Insight Footer */}
                      <div className="p-2 bg-slate-950/80 border border-slate-800/90 rounded text-[11px] font-mono text-slate-300 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            KORRELATION VED SPIDSBELASTNING (KL. {puff24h.peakReceptor.peakHourLabel}
                            ):
                          </span>
                          <span className="text-amber-300 font-semibold">
                            Vind {peakWeather.windSpeed10m} m/s (stød {peakWeather.windGusts10m}{' '}
                            m/s) · Nedbør {peakWeather.precipitation} mm/t
                          </span>
                        </div>
                        <div className="text-slate-300 leading-snug">
                          {peakWeather.precipitation > 2.0
                            ? `Nedbørstop (${peakWeather.precipitation} mm/t) dæmper luftfane, men aktiverer hydrologisk udvaskning af bly/PAH mod terræn.`
                            : peakWeather.windSpeed10m >= 5.0
                            ? `Tør vindtop (${peakWeather.windSpeed10m} m/s, stød ${peakWeather.windGusts10m} m/s) fra ${peakWeather.windDirection10m}° korrelerer direkte med maksimal støv- og asbestspredning (S = ${puff24h.peakReceptor.peakSumQuotient.toFixed(2)}).`
                            : `Moderat vind (${peakWeather.windSpeed10m} m/s) og stabilitetsklasse ${peakWeather.pasquillClass} giver koncentreret nærfelts-akkumulering ved ${puff24h.peakReceptor.receptorCode}.`}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Dedicated Widget: Accumulated Dust Deposition Profile (µg/m²) per Square Meter for Individual Receptors */}
                <DockableWindowFrame
                  windowId="receptor_dust_deposition_profile"
                  state={windowStates.receptor_dust_deposition_profile}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <ReceptorDustDepositionProfileWidget
                    puff24h={puff24h}
                    receptorExposures={receptorExposures}
                    weatherHours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    dateIso={weatherDataset.dateIso}
                    selectedReceptorId={selectedReceptorExposure.receptorId}
                    onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                    onSelectHour={(hrIdx) => {
                      setSelectedHourIndex(hrIdx);
                      setPlumeRouteProgress(hrIdx);
                    }}
                    buildings={buildings}
                  />
                </DockableWindowFrame>

                {/* Street-Level & Residential Receptors Ranked by 24-Hour Cumulative Dose */}
                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    24-Timers Receptor-Rangliste i Ringparken (Akkumuleret Dosis)
                  </h4>
                  <div className="space-y-1.5">
                    {[...puff24h.streetPointSummaries, ...puff24h.receptorSummaries]
                      .sort((a, b) => b.cumulativeSumDose - a.cumulativeSumDose)
                      .slice(0, 8)
                      .map((rec, idx) => (
                        <div
                          key={rec.receptorId}
                          onClick={() => {
                            setSelectedHourIndex(rec.peakHourIndex);
                          }}
                          className={`p-2.5 rounded border cursor-pointer transition-colors ${
                            idx === 0
                              ? 'bg-amber-950/30 border-amber-400/70'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white inline-flex items-center gap-1">
                              {idx === 0 && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              <span>{`#${idx + 1} `}{rec.receptorName}</span>
                            </span>
                            <span className="font-mono font-bold text-rose-400">
                              ∑ {rec.cumulativeSumDose.toFixed(2)} S·t
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
                            <span>
                              Spids kl.{' '}
                              <strong className="text-amber-300">{rec.peakHourLabel}</strong> (S=
                              {rec.peakSumQuotient.toFixed(2)})
                            </span>
                            <span>{rec.totalDepositedHeavyMetalsAndPcbUgM2} µg/m² støv/metal</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: AUTOMATISK JURIDISK COMPLIANCE- & LOVOVERTRÆDELSES-DETEKTOR */}
            {activeTab === 'compliance' && (() => {
              const bek613Violations = legalViolations.filter(
                (v) => v.legalBasisCategory === 'BEK_613_2026_ASBESTOS'
              );
              const mstNoiseViolations = legalViolations.filter(
                (v) => v.legalBasisCategory === 'MST_NOISE_LIMITS'
              );
              const filteredLegalViolations =
                legalBasisFilter === 'ALL'
                  ? legalViolations
                  : legalViolations.filter((v) => v.legalBasisCategory === legalBasisFilter);

              const explicitlySelected = filteredLegalViolations.filter((v) =>
                selectedViolationIdsForAi.includes(v.id)
              );
              const effectiveSelectedViolations =
                explicitlySelected.length > 0 ? explicitlySelected : filteredLegalViolations;

              const handleToggleViolationSelection = (violationId: string) => {
                setSelectedViolationIdsForAi((prev) =>
                  prev.includes(violationId)
                    ? prev.filter((id) => id !== violationId)
                    : [...prev, violationId]
                );
              };

              const handleTriggerGeminiLegalInterpretation = (
                violationsToAnalyze: LegalViolationEntry[],
                role: ExpertPersonaRole = 'jurist'
              ) => {
                setViolationAiRequest({
                  requestId: Date.now(),
                  violations: violationsToAnalyze,
                  preferredRole: role,
                });
                setActiveTab('grounding');
                if (windowStates.gemini_grounding_chat?.isMinimized) {
                  handleRestoreWindow('gemini_grounding_chat');
                }
              };

              const buildViolationsCsvContent = (
                rowsToExport: LegalViolationEntry[],
                delimiter: ';' | ',' = ';'
              ): string => {
                const escapeCell = (val: string | number | undefined | null): string => {
                  if (val === undefined || val === null) return '""';
                  const cleaned = String(val).replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
                  return `"${cleaned}"`;
                };

                const headers = [
                  'Sags_Journal_Ref',
                  'KLE_Emnenr_Slagelse_Kommune',
                  'FACET_Klassifikation',
                  'Kommune_Myndighed',
                  'Overtrædelse_ID',
                  'Tidsstempel_ISO',
                  'Dato',
                  'Klokkeslæt',
                  'Alvorsgrad',
                  'Lovgrundlag_Kategori',
                  'Lovgrundlag_Paragraf',
                  'Lovtitel',
                  'Sumkvotient_S',
                  'Sumkvotient_Grænseværdi',
                  'Overskridelse_Pct_Af_GV',
                  'Støj_LAeq_Impuls_dB',
                  'Støj_Grænse_dB',
                  'Berørt_Receptor',
                  'Receptor_Adresse',
                  'Vindhastighed_10m_ms',
                  'Vindstød_10m_ms',
                  'Vindretning_Fra_Grader',
                  'Spredningsfane_Til_Grader',
                  'Pasquill_Stabilitetsklasse',
                  'Juridisk_Konsekvens',
                  'Teknisk_Bevisførelse',
                  'SHA256_State_Signatur',
                ];

                const csvRows = rowsToExport.map((v) => {
                  const severityLabel =
                    v.severity === 'CRITICAL_RED'
                      ? 'KRITISK (RØD ZONE S >= 1,0)'
                      : v.severity === 'HYDROLOGICAL_BLUE'
                      ? 'HYDROLOGISK UDVASKNING (BLÅ ZONE)'
                      : 'FORHØJET RISIKO / PÅBUD (ORANGE ZONE)';
                  const kleCode =
                    v.legalBasisCategory === 'MST_NOISE_LIMITS'
                      ? '09.08.00 (Støj fra virksomheder og bygge- og anlægsarbejde)'
                      : '09.02.00 (Luftforurening, Asbest & Miljøfarlige stoffer)';
                  const exceedancePct = `${Math.round(v.sumQuotient * 100)}%`;
                  return [
                    escapeCell('PSS-W22085-RINGPARKEN'),
                    escapeCell(kleCode),
                    escapeCell('P19 (Tilsyn, Påbud & Standsning jf. MBL § 42 / Byggeloven § 12)'),
                    escapeCell(
                      'Slagelse Kommune - Center for Miljø, Plan og Teknik (Rådhuspladsen 11, 4200 Slagelse)'
                    ),
                    escapeCell(v.id),
                    escapeCell(v.timestampIso),
                    escapeCell(weatherDataset.dateIso),
                    escapeCell(currentWeather.hourLabel),
                    escapeCell(severityLabel),
                    escapeCell(v.legalBasisLabel),
                    escapeCell(v.statuteReference),
                    escapeCell(v.statuteTitle),
                    escapeCell(v.sumQuotient.toFixed(3)),
                    escapeCell('1.000'),
                    escapeCell(exceedancePct),
                    escapeCell(
                      v.noiseMetrics ? v.noiseMetrics.impulseAdjustedLaeqDb.toFixed(1) : ''
                    ),
                    escapeCell(v.noiseMetrics ? v.noiseMetrics.limitLaeqDb.toFixed(1) : ''),
                    escapeCell(v.receptorName),
                    escapeCell(v.receptorAddress),
                    escapeCell(currentWeather.windSpeed10m.toFixed(1)),
                    escapeCell(currentWeather.windGusts10m.toFixed(1)),
                    escapeCell(currentWeather.windDirection10m),
                    escapeCell(plumeDirectionDeg),
                    escapeCell(currentWeather.pasquillClass),
                    escapeCell(v.legalConsequence),
                    escapeCell(v.technicalEvidence),
                    escapeCell(sha256Hash),
                  ].join(delimiter);
                });

                return '\uFEFF' + [headers.map(escapeCell).join(delimiter), ...csvRows].join('\r\n');
              };

              const handleExportViolationsToCsv = (
                delimiter: ';' | ',' = ';',
                customRows?: LegalViolationEntry[]
              ) => {
                const targetRows = customRows ?? effectiveSelectedViolations;
                const csvContent = buildViolationsCsvContent(targetRows, delimiter);
                const blob = new Blob([csvContent], {
                  type: 'text/csv;charset=utf-8;',
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const safeHour = currentWeather.hourLabel.replace(':', '');
                link.href = url;
                link.setAttribute(
                  'download',
                  `Slagelse_Kommune_Lovovertraedelser_${weatherDataset.dateIso}_kl_${safeHour}.csv`
                );
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                setShowViolationsCsvTable(true);
                setViolationsCsvExportSuccess(true);
                window.setTimeout(() => {
                  setViolationsCsvExportSuccess(false);
                }, 3800);
              };

              const pdfAuthorityEvidenceBlock = (
                <DockableWindowFrame
                  windowId="pdf_authority_evidence"
                  state={windowStates.pdf_authority_evidence}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <ForensicPdfEvidencePanel
                    currentWeather={currentWeather}
                    selectedDate={weatherDataset.dateIso}
                    receptorExposures={receptorExposures}
                    maxSumQuotient={maxSiteSumQuotient}
                    observations={observations}
                    legalViolations={legalViolations}
                    sha256Hash={sha256Hash}
                    onRegisterPdfEvidenceObservation={handleRegisterPdfEvidenceObservation}
                    onGenerateFullForensicPdfReport={(pdfArchive) =>
                      generateForensicPdfReport({
                        weatherDataset,
                        simulation,
                        sources,
                        receptors,
                        observations,
                        isPuffMode,
                        sha256Hash,
                        groundingPlaces,
                        pdfEvidenceArchive: pdfArchive,
                        validatePhotoEvidenceBinary,
                      })
                    }
                  />
                </DockableWindowFrame>
              );

              const buildingSampleAndDmaBlock = (
                <BuildingSampleAndDmaPanel
                  buildings={buildings}
                  selectedBuildingId={selectedBuildingId}
                  onSelectBuildingId={(bId) => {
                    setSelectedBuildingId(bId);
                    const b = buildings.find((item) => item.id === bId);
                    if (b) {
                      const meta = BUILDING_CATEGORY_METADATA[b.category];
                      if (meta.actsAsSource) {
                        setSelectedSourceId(getSourceIdForBuilding(b.id));
                      }
                      if (meta.actsAsReceptor) {
                        setSelectedReceptorId(getReceptorIdForBuilding(b.id));
                      }
                    }
                  }}
                  onChangeBuildingCategory={handleChangeBuildingCategory}
                  compactMode
                />
              );

              return (
                <div className="space-y-4">
                  {/* Dedicated Sub-Tab Bar inside 'compliance' panel including 'L 69 Straffesats- og Konfiskationsberegner' */}
                  <div className="p-2.5 rounded-lg bg-slate-900/95 border border-rose-500/40 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-rose-300 font-bold flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-rose-400" />
                      <span>RETSMEDICINSKE COMPLIANCE- &amp; SANKTIONSMODULER:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                      {(
                        [
                          { id: 'all', label: 'Alle Kontrolmoduler' },
                          {
                            id: 'slagelse_legal_dashboard',
                            label: 'Slagelse Kommune & SHA-256 Dashboard',
                          },
                          {
                            id: 'l69_calculator',
                            label: 'L 69 Straffesats- og Konfiskationsberegner',
                          },
                          {
                            id: 'pss_interlocks',
                            label: 'Wissenberg PSS W22085 Sikkerhedslåse',
                          },
                          {
                            id: 'violations_pdf',
                            label: 'Lovovertrædelser & PDF-Bevisarkiv',
                          },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setComplianceSubTab(tab.id)}
                          className={`px-2.5 py-1 rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            complianceSubTab === tab.id
                              ? 'bg-rose-600 text-white border-rose-300 font-bold shadow-sm'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-rose-500/50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(complianceSubTab === 'all' ||
                    complianceSubTab === 'slagelse_legal_dashboard') && (
                    <SlagelseLegalEvidenceDashboard
                      dateIso={weatherDataset.dateIso}
                      currentWeather={currentWeather}
                      legalViolations={legalViolations}
                      observations={observations}
                      masterStateSha256={sha256Hash}
                      onSelectObservation={(obs) => {
                        setSelectedObservationId(obs.id);
                        setSelectedHourIndex(obs.observedHourIndex);
                      }}
                      onAppendGeneratedMunicipalPdf={
                        handleRegisterPdfEvidenceObservation
                      }
                      simultaneousDispatch={simultaneousAlgedonic.dispatch}
                    />
                  )}

                  {complianceSubTab === 'violations_pdf' && pdfAuthorityEvidenceBlock}

                  {(complianceSubTab === 'all' ||
                    complianceSubTab === 'violations_pdf') && (

                <DockableWindowFrame
                  windowId="legal_compliance"
                  state={windowStates.legal_compliance}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                <div className="p-2.5 space-y-3">
                  <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-md space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>Automatisk Juridisk Lovovertrædelses-Detektor</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-rose-500/40 text-[11px] font-mono text-rose-200">
                        {filteredLegalViolations.length} af {legalViolations.length} hændelser
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Overvåger om Røde (S ≥ 1,0), Orange (0,5 ≤ S &lt; 1,0), Blå (udvasknings-)
                      risikozoner eller støjudbredelse (dB(A)) overskrider grænseværdier ved beboede
                      naboblokke (Afd. 23, 24, 26, 32 &amp; Rødtjørnevej 2) eller offentlig vej.
                    </p>

                    {/* LOVGRUNDLAG-FILTER: Skift mellem 'BEK 613/2026 (Asbest)' og 'Miljøstyrelsens vejledende støjgrænser' */}
                    <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded-md space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1.5">
                          <Filter className="w-3.5 h-3.5 shrink-0" />
                          <span>Filtrér Overtrædelseslog efter Lovgrundlag</span>
                        </div>
                        {legalBasisFilter !== 'ALL' && (
                          <button
                            type="button"
                            onClick={() => setLegalBasisFilter('ALL')}
                            className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 underline"
                          >
                            Nulstil filter (Vis alle)
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setLegalBasisFilter((prev) =>
                              prev === 'BEK_613_2026_ASBESTOS' ? 'ALL' : 'BEK_613_2026_ASBESTOS'
                            )
                          }
                          className={`w-full px-2.5 py-2 rounded text-left font-mono text-xs transition-all flex items-center justify-between gap-2 border ${
                            legalBasisFilter === 'BEK_613_2026_ASBESTOS'
                              ? 'bg-rose-600/30 border-rose-400 text-white font-bold shadow-xs'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <Scale className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span className="truncate">BEK 613/2026 (Asbest)</span>
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                              legalBasisFilter === 'BEK_613_2026_ASBESTOS'
                                ? 'bg-rose-500 text-white'
                                : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {bek613Violations.length} brud
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setLegalBasisFilter((prev) =>
                              prev === 'MST_NOISE_LIMITS' ? 'ALL' : 'MST_NOISE_LIMITS'
                            )
                          }
                          className={`w-full px-2.5 py-2 rounded text-left font-mono text-xs transition-all flex items-center justify-between gap-2 border ${
                            legalBasisFilter === 'MST_NOISE_LIMITS'
                              ? 'bg-amber-500/30 border-amber-400 text-white font-bold shadow-xs'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">
                              Miljøstyrelsens vejledende støjgrænser
                            </span>
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                              legalBasisFilter === 'MST_NOISE_LIMITS'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {mstNoiseViolations.length} brud
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLegalBasisFilter('ALL')}
                          className={`w-full px-2.5 py-1.5 rounded text-center font-mono text-[11px] transition-colors flex items-center justify-center gap-1.5 border ${
                            legalBasisFilter === 'ALL'
                              ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200 font-bold'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>
                            Vis samtlige lovgrundlag ({legalViolations.length} registrerede overtrædelser)
                          </span>
                        </button>
                      </div>

                      {/* Aktiv lovhjemmel-specifikation for det valgte filter */}
                      <div className="p-2 rounded bg-slate-900/80 border border-slate-800/90 text-[11px] text-slate-300 leading-snug">
                        {legalBasisFilter === 'BEK_613_2026_ASBESTOS' ? (
                          <div>
                            <strong className="text-rose-300 font-mono">
                              Aktivt filter — BEK 613/2026 (Asbest):
                            </strong>{' '}
                            Arbejdstilsynets bekendtgørelse nr. 613 af 29. juni 2026 (skærpet
                            asbestgrænseværdi 0,003 fibre/cm³ &amp; § 3, stk. 3 Sumformel S = ∑ C_i /
                            GV_i ≥ 1,0) samt Asbestbekendtgørelsen Bek. 1328 (Entreprenørstop &amp;
                            tredjeparts-asbestprøver).
                          </div>
                        ) : legalBasisFilter === 'MST_NOISE_LIMITS' ? (
                          <div>
                            <strong className="text-amber-300 font-mono">
                              Aktivt filter — Miljøstyrelsens vejledende støjgrænser:
                            </strong>{' '}
                            Miljøstyrelsens vejledning nr. 5/1984 (pkt. 2.2.2: +5 dB genetillæg ved
                            impulsstøj fra betonknusning/mejselhammer) &amp; grænser for bygge- og
                            anlægsarbejder (Hverdage kl. 07–18: 70 dB(A) L_Aeq / 85 dB(A) L_AFmax ·
                            Aften: 45 dB(A) · Nat: 40/55 dB(A)) jf. MBL § 42.
                          </div>
                        ) : (
                          <div>
                            <strong className="text-cyan-300 font-mono">
                              Samlet Lovlog (Asbest + Støj):
                            </strong>{' '}
                            Viser både kemiske/asbestrelaterede grænseoverskridelser under{' '}
                            <span className="text-rose-300 font-semibold">
                              BEK 613/2026 (Asbest)
                            </span>{' '}
                            og akustiske overskridelser under{' '}
                            <span className="text-amber-300 font-semibold">
                              Miljøstyrelsens vejledende støjgrænser
                            </span>
                            .
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {/* Instant Formal 'Juridisk Resume' & Draft Complaint to Slagelse Kommune for Selected Violations (S >= 1,0) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const s1Violations = effectiveSelectedViolations.filter(
                              (v) => v.sumQuotient >= 1.0
                            );
                            if (s1Violations.length > 0) {
                              setSelectedViolationIdsForAi(s1Violations.map((v) => v.id));
                            }
                            const draft = buildFormalSlagelseLegalComplaintDraft({
                              selectedViolations:
                                s1Violations.length > 0
                                  ? s1Violations
                                  : effectiveSelectedViolations,
                              dateIso: weatherDataset.dateIso,
                              hourLabel: currentWeather.hourLabel,
                              windSpeedMs: currentWeather.windSpeed10m,
                              windGustsMs: currentWeather.windGusts10m,
                              windDirectionDeg: currentWeather.windDirection10m,
                              plumeDirectionDeg,
                              stabilityClass: currentWeather.pasquillClass,
                              maxSumQuotient: maxSiteSumQuotient,
                              precipitationMmH:
                                precipitationOverrideMm !== null
                                  ? precipitationOverrideMm
                                  : currentWeather.precipitation,
                              sha256Hash,
                            });
                            setMunicipalLegalSummary(draft);
                          }}
                          className="w-full py-2.5 px-3 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
                          title="Generér straks et formelt 'Juridisk Resume' baseret på de aktuelt valgte lovovertrædelser (S >= 1,0) som udkast til klage til Slagelse Kommune inkl. MBL og BEK 613/2026"
                        >
                          <Scale className="w-4 h-4 shrink-0" />
                          <span>
                            Generér &apos;Juridisk Resume&apos; &amp; Klageudkast (S ≥ 1,0 · MBL &amp; BEK 613/2026)
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isGeneratingMunicipalSummary}
                          onClick={async () => {
                            setIsGeneratingMunicipalSummary(true);
                            const s1Only = effectiveSelectedViolations.filter(
                              (v) => v.sumQuotient >= 1.0
                            );
                            const violationsPayload =
                              s1Only.length > 0 ? s1Only : effectiveSelectedViolations;
                            try {
                              const response = await fetch('/api/generate-municipal-legal-summary', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  violations: violationsPayload,
                                  dateIso: weatherDataset.dateIso,
                                  hourLabel: currentWeather.hourLabel,
                                  windSpeedMs: currentWeather.windSpeed10m,
                                  windGustsMs: currentWeather.windGusts10m,
                                  windDirectionDeg: currentWeather.windDirection10m,
                                  plumeDirectionDeg,
                                  stabilityClass: currentWeather.pasquillClass,
                                  maxSumQuotient: maxSiteSumQuotient,
                                  sha256Hash,
                                }),
                              });
                              const data = await response.json();
                              setMunicipalLegalSummary({
                                headline:
                                  data.headline ||
                                  `Juridisk Resume til Slagelse Kommune (${violationsPayload.length} S ≥ 1,0 overtrædelser)`,
                                summaryText: data.summaryText || '',
                                municipalLegalBases: Array.isArray(data.municipalLegalBases)
                                  ? data.municipalLegalBases
                                  : [],
                                demandedMunicipalActions: Array.isArray(data.demandedMunicipalActions)
                                  ? data.demandedMunicipalActions
                                  : [],
                                modelUsed:
                                  data.modelUsed ||
                                  'Juridisk Klage-Syntese (MBL & BEK 613/2026)',
                                generatedAtLabel: `${weatherDataset.dateIso} kl. ${currentWeather.hourLabel}`,
                              });
                            } catch {
                              const fallbackDraft = buildFormalSlagelseLegalComplaintDraft({
                                selectedViolations: violationsPayload,
                                dateIso: weatherDataset.dateIso,
                                hourLabel: currentWeather.hourLabel,
                                windSpeedMs: currentWeather.windSpeed10m,
                                windGustsMs: currentWeather.windGusts10m,
                                windDirectionDeg: currentWeather.windDirection10m,
                                plumeDirectionDeg,
                                stabilityClass: currentWeather.pasquillClass,
                                maxSumQuotient: maxSiteSumQuotient,
                                precipitationMmH:
                                  precipitationOverrideMm !== null
                                    ? precipitationOverrideMm
                                    : currentWeather.precipitation,
                                sha256Hash,
                              });
                              setMunicipalLegalSummary(fallbackDraft);
                            } finally {
                              setIsGeneratingMunicipalSummary(false);
                            }
                          }}
                          className="w-full py-2.5 px-3 rounded bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
                          title="Udarbejd udvidet AI-syntetiseret Juridisk Resume & klageudkast til Slagelse Kommune baseret på valgte S >= 1,0 overtrædelser"
                        >
                          {isGeneratingMunicipalSummary ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                          ) : (
                            <Sparkles className="w-4 h-4 shrink-0" />
                          )}
                          <span>
                            {isGeneratingMunicipalSummary
                              ? 'Udarbejder udvidet Klageudkast...'
                              : `Udvidet Klage-Syntese til Slagelse Kommune (${
                                  effectiveSelectedViolations.filter((v) => v.sumQuotient >= 1.0)
                                    .length || effectiveSelectedViolations.length
                                } S≥1,0)`}
                          </span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleTriggerGeminiLegalInterpretation(
                              effectiveSelectedViolations,
                              'jurist'
                            )
                          }
                          className="w-full py-2 px-3 rounded bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Scale className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            AI Juridisk Tolkning ({effectiveSelectedViolations.length} valgt)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportViolationsToCsv(';')}
                          className={`w-full py-2 px-3 rounded font-mono font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border ${
                            violationsCsvExportSuccess
                              ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                              : 'bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border-emerald-400/70'
                          }`}
                          title="Generér en tabel og download CSV-fil over de valgte lovovertrædelser med tidsstempler, lovgrundlag og sumkvotienter til Slagelse Kommunes sagsbehandlingssystemer (SBSYS / KMD Nova / ESDH)"
                        >
                          {violationsCsvExportSuccess ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                ✓ CSV Eksporteret ({effectiveSelectedViolations.length} rækker)
                              </span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                              <span>
                                Eksportér til CSV ({effectiveSelectedViolations.length} valgt)
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setReportModalInitialTab('legal_submission');
                            setIsReportModalOpen(true);
                          }}
                          className="w-full py-2 px-3 rounded bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Formel Indberetning (kl. {currentWeather.hourLabel})
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* GENERATED CSV / SAGSBEHANDLINGS-TABEL OVER VALGTE LOVOVERTRÆDELSER TIL SLAGELSE KOMMUNE */}
                    {showViolationsCsvTable && effectiveSelectedViolations.length > 0 && (
                      <div className="p-3 rounded-md bg-[#1B2433] border border-[#2D3B50] space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div>
                            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-bold flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>
                                CSV SAGSBEHANDLINGS-TABEL · SLAGELSE KOMMUNE (ESDH / SBSYS / KMD NOVA)
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                              Viser <strong className="text-white">{effectiveSelectedViolations.length}</strong>{' '}
                              valgte lovovertrædelser med ISO-tidsstempler, lovgrundlag og sumkvotienter (S) · Sag: PSS W22085
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleExportViolationsToCsv(';')}
                              className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[11px] font-mono font-bold cursor-pointer flex items-center gap-1"
                              title="Download CSV med semikolon (;) til dansk Excel og Slagelse Kommunes ESDH/SBSYS"
                            >
                              <Download className="w-3 h-3 shrink-0" />
                              <span>Download .CSV (Semikolon ;)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportViolationsToCsv(',')}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-emerald-200 text-[11px] font-mono font-semibold cursor-pointer"
                              title="Download CSV med komma (,) til internationale GIS- og databasesystemer"
                            >
                              Download .CSV (Komma ,)
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const csvText = buildViolationsCsvContent(
                                    effectiveSelectedViolations,
                                    ';'
                                  );
                                  await navigator.clipboard.writeText(csvText);
                                  setViolationsCsvCopied(true);
                                  window.setTimeout(() => setViolationsCsvCopied(false), 2500);
                                } catch {
                                  // ignore clipboard error
                                }
                              }}
                              className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-[11px] font-mono font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              {violationsCsvCopied ? (
                                <>
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>CSV Kopieret</span>
                                </>
                              ) : (
                                <>
                                  <Clipboard className="w-3 h-3 shrink-0" />
                                  <span>Kopiér CSV</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowViolationsCsvTable(false)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-[11px] font-mono cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Skjul tabel</span>
                              <X className="w-3 h-3 shrink-0" />
                            </button>
                          </div>
                        </div>

                        <div className="max-h-64 overflow-x-auto overflow-y-auto rounded border border-slate-800">
                          <table className="w-full text-left border-collapse text-[11px] font-mono">
                            <thead className="bg-slate-900 text-slate-300 sticky top-0 border-b border-slate-800">
                              <tr>
                                <th className="py-1.5 px-2 whitespace-nowrap">Tidsstempel</th>
                                <th className="py-1.5 px-2">Lovgrundlag &amp; Paragraf</th>
                                <th className="py-1.5 px-2 whitespace-nowrap">Sumkvotient (S)</th>
                                <th className="py-1.5 px-2">Berørt Receptor &amp; Adresse</th>
                                <th className="py-1.5 px-2 whitespace-nowrap">Vind / Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                              {effectiveSelectedViolations.map((row) => {
                                const isNoise = row.legalBasisCategory === 'MST_NOISE_LIMITS';
                                return (
                                  <tr
                                    key={`csv-tbl-${row.id}`}
                                    className="hover:bg-slate-900/70 transition-colors"
                                  >
                                    <td className="py-1.5 px-2 align-top whitespace-nowrap text-cyan-300 font-semibold">
                                      <div>{row.timestampIso.replace('T', ' ')}</div>
                                      <div className="text-[11px] text-slate-500">{row.id}</div>
                                    </td>
                                    <td className="py-1.5 px-2 align-top">
                                      <div
                                        className={`font-bold ${
                                          isNoise ? 'text-amber-300' : 'text-rose-300'
                                        }`}
                                      >
                                        {row.legalBasisLabel}
                                      </div>
                                      <div className="text-[11px] text-slate-200">
                                        {row.statuteReference}
                                      </div>
                                      <div className="text-[11px] text-slate-400 truncate max-w-[230px]">
                                        {row.statuteTitle}
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-2 align-top whitespace-nowrap">
                                      <div
                                        className={`font-extrabold ${
                                          row.sumQuotient >= 1.0
                                            ? 'text-rose-400'
                                            : 'text-amber-300'
                                        }`}
                                      >
                                        S = {row.sumQuotient.toFixed(3)}
                                      </div>
                                      {isNoise && row.noiseMetrics && (
                                        <div className="text-[11px] text-amber-200">
                                          {row.noiseMetrics.impulseAdjustedLaeqDb.toFixed(1)} /{' '}
                                          {row.noiseMetrics.limitLaeqDb} dB(A)
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 align-top">
                                      <div className="font-semibold text-white">
                                        {row.receptorName}
                                      </div>
                                      <div className="text-[11px] text-slate-400">
                                        {row.receptorAddress}
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-2 align-top whitespace-nowrap">
                                      <span
                                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                                          row.severity === 'CRITICAL_RED'
                                            ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                                            : row.severity === 'HYDROLOGICAL_BLUE'
                                            ? 'bg-indigo-950/90 border-indigo-500/60 text-indigo-200'
                                            : 'bg-amber-950/90 border-amber-500/60 text-amber-200'
                                        }`}
                                      >
                                        {row.severity === 'CRITICAL_RED'
                                          ? 'KRITISK (S ≥ 1,0)'
                                          : row.severity === 'HYDROLOGICAL_BLUE'
                                          ? 'UDVASKNING'
                                          : 'PÅBUD / RISIKO'}
                                      </span>
                                      <div className="text-[11px] text-slate-400 mt-0.5">
                                        {currentWeather.windSpeed10m} m/s · PG-{currentWeather.pasquillClass}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* GENERATED 'JURIDISK RESUME' CARD FOR FORMAL COMPLAINT TO SLAGELSE KOMMUNE */}
                    {municipalLegalSummary && (
                      <div className="p-3 rounded-md bg-[#1B2433] border border-amber-500/50 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div>
                            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                              <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                JURIDISK RESUME · FORMEL KLAGEFORBEREDELSE TIL SLAGELSE KOMMUNE
                              </span>
                            </div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              {municipalLegalSummary.headline}
                            </div>
                            <div className="text-[11px] font-mono text-cyan-300">
                              Kilde: {municipalLegalSummary.modelUsed} · Modtager: Slagelse Kommune (Rådhuspladsen 11, 4200 Slagelse)
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    municipalLegalSummary.summaryText
                                  );
                                  setMunicipalSummaryCopied(true);
                                  window.setTimeout(() => setMunicipalSummaryCopied(false), 2500);
                                } catch {
                                  // ignore clipboard error
                                }
                              }}
                              className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-mono font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                            >
                              {municipalSummaryCopied ? (
                                <>
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>Kopieret til Udklipsholder</span>
                                </>
                              ) : (
                                <>
                                  <Clipboard className="w-3 h-3 shrink-0" />
                                  <span>Kopiér Juridisk Resume</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                downloadFormalSlagelseLegalComplaintPdf(
                                  {
                                    headline: municipalLegalSummary.headline,
                                    summaryText: municipalLegalSummary.summaryText,
                                    municipalLegalBases: municipalLegalSummary.municipalLegalBases,
                                    demandedMunicipalActions:
                                      municipalLegalSummary.demandedMunicipalActions,
                                    sAtLeastOneCount: effectiveSelectedViolations.filter(
                                      (v) => v.sumQuotient >= 1.0
                                    ).length,
                                    evaluatedViolationCount: effectiveSelectedViolations.length,
                                    modelUsed: municipalLegalSummary.modelUsed,
                                    generatedAtLabel: municipalLegalSummary.generatedAtLabel,
                                  },
                                  weatherDataset.dateIso,
                                  currentWeather.hourLabel
                                );
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[11px] font-mono font-extrabold cursor-pointer transition-colors inline-flex items-center gap-1"
                            >
                              <Download className="w-3 h-3 shrink-0" />
                              <span>Download Klageudkast (.pdf)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const blob = new Blob([municipalLegalSummary.summaryText], {
                                  type: 'text/plain;charset=utf-8',
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Juridisk_Resume_Klage_Slagelse_Kommune_${weatherDataset.dateIso}_kl_${currentWeather.hourLabel.replace(':', '')}.txt`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-[11px] font-mono font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                            >
                              <Download className="w-3 h-3 shrink-0" />
                              <span>Download Klage-Resume (.txt)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setMunicipalLegalSummary(null)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-[11px] font-mono cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Luk</span>
                              <X className="w-3 h-3 shrink-0" />
                            </button>
                          </div>
                        </div>

                        {/* Key Municipal Legal Bases & Demanded Actions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="p-2 rounded bg-slate-900/90 border border-slate-800 space-y-1">
                            <div className="text-amber-300 font-bold uppercase">
                              Påberåbte Lovhjemler over for Slagelse Kommune:
                            </div>
                            <ul className="space-y-0.5 text-slate-300 list-disc list-inside">
                              {municipalLegalSummary.municipalLegalBases.map((lb, idx) => (
                                <li key={idx}>{lb}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-2 rounded bg-slate-900/90 border border-rose-500/30 space-y-1">
                            <div className="text-rose-300 font-bold uppercase">
                              Krav i Klagen til Slagelse Kommune:
                            </div>
                            <ul className="space-y-0.5 text-slate-200 list-disc list-inside">
                              {municipalLegalSummary.demandedMunicipalActions.map((act, idx) => (
                                <li key={idx}>{act}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Full Formatted Juridisk Resume Text */}
                        <div className="p-3 rounded bg-slate-900/95 border border-slate-800 font-mono text-[11px] leading-relaxed text-slate-100 whitespace-pre-wrap max-h-80 overflow-y-auto select-all">
                          {municipalLegalSummary.summaryText}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selection toolbar for choosing specific violations for AI interpretation */}
                  {filteredLegalViolations.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-950/90 border border-slate-800 text-[11px] font-mono">
                      <span className="text-slate-300">
                        Valgte lovovertrædelser (AI / CSV):{' '}
                        <strong className="text-cyan-300">
                          {explicitlySelected.length > 0
                            ? `${explicitlySelected.length} håndvalgte`
                            : `Alle ${filteredLegalViolations.length} filtrerede`}
                        </strong>
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowViolationsCsvTable((prev) => !prev)}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 font-bold cursor-pointer"
                        >
                          {showViolationsCsvTable ? 'Skjul CSV-Tabel ▲' : 'Vis CSV-Tabel ▼'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportViolationsToCsv(';')}
                          className="px-2 py-0.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold cursor-pointer"
                        >
                          ⬇ Eksportér til CSV
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedViolationIdsForAi(
                              filteredLegalViolations
                                .filter((v) => v.sumQuotient >= 1.0)
                                .map((v) => v.id)
                            )
                          }
                          className="px-2 py-0.5 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/60 text-rose-200 font-bold cursor-pointer"
                        >
                          Markér kun S ≥ 1,0 (
                          {filteredLegalViolations.filter((v) => v.sumQuotient >= 1.0).length})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedViolationIdsForAi(filteredLegalViolations.map((v) => v.id))
                          }
                          className="text-cyan-400 hover:underline cursor-pointer"
                        >
                          Markér alle ({filteredLegalViolations.length})
                        </button>
                        {explicitlySelected.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedViolationIdsForAi([])}
                            className="text-slate-400 hover:text-rose-300 hover:underline cursor-pointer"
                          >
                            Nulstil valg
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {filteredLegalViolations.length === 0 ? (
                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded text-xs text-slate-400 text-center space-y-2">
                      <div>
                        Ingen registrerede grænseoverskridelser under{' '}
                        <strong className="text-slate-200">
                          {legalBasisFilter === 'BEK_613_2026_ASBESTOS'
                            ? 'BEK 613/2026 (Asbest)'
                            : legalBasisFilter === 'MST_NOISE_LIMITS'
                            ? 'Miljøstyrelsens vejledende støjgrænser'
                            : 'det valgte filter'}
                        </strong>{' '}
                        på den valgte time (kl. {currentWeather.hourLabel}).
                      </div>
                      {legalBasisFilter !== 'ALL' && legalViolations.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setLegalBasisFilter('ALL')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px]"
                        >
                          Vis alle {legalViolations.length} overtrædelser på tværs af lovgrundlag
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredLegalViolations.map((v) => {
                        const isNoiseViolation = v.legalBasisCategory === 'MST_NOISE_LIMITS';
                        const isCheckedForAi =
                          selectedViolationIdsForAi.length === 0 ||
                          selectedViolationIdsForAi.includes(v.id);
                        return (
                          <div
                            key={v.id}
                            className={`p-3 rounded-md border space-y-1.5 transition-all ${
                              v.severity === 'CRITICAL_RED'
                                ? 'bg-rose-950/25 border-rose-500/50'
                                : v.severity === 'HYDROLOGICAL_BLUE'
                                ? 'bg-indigo-950/25 border-indigo-500/50'
                                : 'bg-amber-950/20 border-amber-500/40'
                            } ${isCheckedForAi ? 'ring-1 ring-cyan-500/35' : 'opacity-75'}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono">
                              <span
                                className={`font-bold ${
                                  v.severity === 'CRITICAL_RED'
                                    ? 'text-rose-400'
                                    : v.severity === 'HYDROLOGICAL_BLUE'
                                    ? 'text-indigo-300'
                                    : 'text-amber-300'
                                }`}
                              >
                                {v.severity === 'CRITICAL_RED' ? (
                                  <span className="inline-flex items-center gap-1">
                                    <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                                    <span>KRITISK LOVOVERTRÆDELSE</span>
                                  </span>
                                ) : v.severity === 'HYDROLOGICAL_BLUE' ? (
                                  'HYDROLOGISK UDVASKNING'
                                ) : (
                                  <span className="inline-flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>FORHØJET RISIKO / PÅBUD</span>
                                  </span>
                                )}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                                    isNoiseViolation
                                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                                      : 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                                  }`}
                                >
                                  {v.legalBasisLabel}
                                </span>
                                {isNoiseViolation && v.noiseMetrics ? (
                                  <span className="text-amber-300 font-bold">
                                    {v.noiseMetrics.impulseAdjustedLaeqDb.toFixed(1)} dB(A)
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-bold">
                                    S = {v.sumQuotient.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-xs font-bold text-white">{v.statuteTitle}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              Lovgrundlag: {v.statuteReference}
                            </div>
                            <div className="text-[11px] font-mono text-cyan-300">
                              Rammer: {v.receptorName} ({v.receptorAddress})
                            </div>

                            {isNoiseViolation && v.noiseMetrics && (
                              <div className="grid grid-cols-3 gap-1.5 p-2 rounded bg-slate-950/80 border border-amber-500/30 font-mono text-[11px]">
                                <div>
                                  <div className="text-slate-400">L_Aeq (+5 dB)</div>
                                  <div className="text-amber-300 font-bold">
                                    {v.noiseMetrics.impulseAdjustedLaeqDb} / {v.noiseMetrics.limitLaeqDb} dB
                                  </div>
                                </div>
                                <div>
                                  <div className="text-slate-400">Spids L_AFmax</div>
                                  <div className="text-rose-300 font-bold">
                                    {v.noiseMetrics.lafmaxDb} / {v.noiseMetrics.limitLafmaxDb} dB
                                  </div>
                                </div>
                                <div>
                                  <div className="text-slate-400">Vind ΔL_met</div>
                                  <div className="text-cyan-300 font-bold">
                                    {v.noiseMetrics.windRefractionDb >= 0
                                      ? `+${v.noiseMetrics.windRefractionDb}`
                                      : v.noiseMetrics.windRefractionDb}{' '}
                                    dB
                                  </div>
                                </div>
                              </div>
                            )}

                            <p className="text-xs text-slate-200 leading-relaxed">
                              {v.legalConsequence}
                            </p>
                            <div className="text-[11px] font-mono text-slate-400 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                              <span className="truncate max-w-full">{v.technicalEvidence}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleViolationSelection(v.id)}
                                  className={`px-2 py-0.5 rounded border text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                                    selectedViolationIdsForAi.includes(v.id)
                                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400'
                                  }`}
                                >
                                  {selectedViolationIdsForAi.includes(v.id)
                                    ? '✓ Valgt (AI / CSV)'
                                    : '+ Vælg (AI / CSV)'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportViolationsToCsv(';', [v])}
                                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 text-[11px] font-mono font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Eksportér denne specifikke lovovertrædelse som CSV-fil til Slagelse Kommunes sagsbehandlingssystem"
                                >
                                  <Download className="w-2.5 h-2.5 shrink-0" />
                                  <span>CSV</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTriggerGeminiLegalInterpretation([v], 'jurist')}
                                  className="px-2.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Få automatisk juridisk AI-tolkning af denne lovovertrædelse via Gemini 5 Eksperter"
                                >
                                  <Scale className="w-3 h-3 shrink-0" />
                                  <span>Tolk med Gemini 5 Eksperter</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </DockableWindowFrame>
                  )}

                  {/* 1. LOVFORSLAG L 69 (OKTOBER 2026) STRAFFESATS- OG KONFISKATIONSBEREGNER */}
                  {(complianceSubTab === 'all' ||
                    complianceSubTab === 'l69_calculator') && (
                    <L69PenaltyCalculatorWidget
                      buildings={buildings}
                      maxSiteSumQuotient={maxSiteSumQuotient}
                      onLogAlgedonicEvent={(title, details) => {
                        void handleAddForecastToEvidence(
                          title,
                          details,
                          weatherDataset.dateIso,
                          selectedHourIndex
                        );
                      }}
                      onSendToLegalAi={(_promptText) => {
                        handleTriggerGeminiLegalInterpretation(
                          effectiveSelectedViolations,
                          'jurist'
                        );
                      }}
                    />
                  )}

                  {/* 2. WISSENBERG PSS W22085 PROCES- OG SIKKERHEDSLÅS (INTERLOCK & BOD-TRACKER) */}
                  {(complianceSubTab === 'all' ||
                    complianceSubTab === 'pss_interlocks') && (
                    <PssSafetyInterlockWidget
                      buildings={buildings}
                      maxSiteSumQuotient={maxSiteSumQuotient}
                      cavVentilationMode={cavVentilationMode}
                      onChangeCavVentilationMode={setCavVentilationMode}
                      onChangeBuildingCategory={handleChangeBuildingCategory}
                      onLogAlgedonicEvent={(title, details) => {
                        void handleAddForecastToEvidence(
                          title,
                          details,
                          weatherDataset.dateIso,
                          selectedHourIndex
                        );
                      }}
                      simultaneousDispatch={simultaneousAlgedonic.dispatch}
                    />
                  )}

                  {(complianceSubTab === 'all' ||
                    complianceSubTab === 'pss_interlocks') && (
                    <WaterMainVibrationSankeyWidget
                      waterMainTelemetry={waterMainTelemetry}
                      sources={sources}
                      manualMachineNoiseOutputDb={
                        isManualMachineNoiseOverrideActive
                          ? manualMachineNoiseOutputDb
                          : 114
                      }
                    />
                  )}

                  {/* 3. CALCULATION IN KIND 2.0 (CiK 2.0) MATERIALE-SANKEY (73.420 m²) */}
                  {(complianceSubTab === 'all' ||
                    complianceSubTab === 'slagelse_legal_dashboard') && (
                    <CikMaterialMetabolismSankey buildings={buildings} />
                  )}

                  {complianceSubTab === 'violations_pdf' && buildingSampleAndDmaBlock}

                  {complianceSubTab === 'all' && (
                    <CollapsibleSection
                      title="PDF-Bevisarkiv & DMA-Saneringsprotokol"
                      subtitle="Myndigheds-PDF'er, 29-enheders miljøprøvekort & DMA/PSS-saneringsprotokol"
                      badge={`${observations.filter((o) => Boolean(o.pdfEvidence)).length} PDF'er`}
                      icon={<FileText className="w-3.5 h-3.5 text-amber-400" />}
                      defaultOpen={false}
                      forceOpen={
                        isSidebarMinimizeOthersActive &&
                        effectiveActiveSidebarWindowId === 'pdf_authority_evidence'
                      }
                    >
                      <div className="space-y-3">
                        {pdfAuthorityEvidenceBlock}
                        {buildingSampleAndDmaBlock}
                      </div>
                    </CollapsibleSection>
                  )}
                </div>
              );
            })()}

            {/* TAB 4: MULTI-TURN GEMINI CHATBOT, GOOGLE SEARCH & MAPS GROUNDING + SHA-256 BEVIS */}
            {activeTab === 'grounding' && (
              <DockableWindowFrame
                windowId="gemini_grounding_chat"
                state={windowStates.gemini_grounding_chat}
                onMinimize={handleMinimizeWindow}
                onPopOutFloating={handlePopOutFloatingWindow}
                onRestore={handleRestoreWindow}
              >
              <div className="p-2.5 space-y-4">
                {(() => {
                  const filteredViolationsForGrounding =
                    legalBasisFilter === 'ALL'
                      ? legalViolations
                      : legalViolations.filter(
                          (v) => v.legalBasisCategory === legalBasisFilter
                        );
                  const explicitlySelectedForGrounding =
                    filteredViolationsForGrounding.filter((v) =>
                      selectedViolationIdsForAi.includes(v.id)
                    );
                  const effectiveViolationsForGrounding =
                    explicitlySelectedForGrounding.length > 0
                      ? explicitlySelectedForGrounding
                      : filteredViolationsForGrounding;
                  return (
                    <ForensicChatbotPanel
                      telemetryContext={{
                        selectedSourceName:
                          sources.find((s) => s.id === selectedSourceId)?.name ||
                          sources[0]?.name ||
                          'Blok 1',
                        windSpeedMs: currentWeather.windSpeed10m,
                        windDirDeg: currentWeather.windDirection10m,
                        stabilityClass: currentWeather.pasquillClass,
                        sumQuotient: maxSiteSumQuotient,
                        peakAddress: puff24h.peakReceptor.address,
                        selectedDate: weatherDataset.dateIso,
                        selectedHour: selectedHourIndex,
                        precipitationMm: currentWeather.precipitation,
                        observationsCount: observations.length,
                        indoorClimate: indoorClimateTelemetry,
                      }}
                      onRunMapsGrounding={runMapsGroundingAnalysis}
                      mapsGroundingLoading={isLoadingGrounding}
                      initialPersonaRole="jurist"
                      selectedLegalViolations={effectiveViolationsForGrounding}
                      externalViolationRequest={violationAiRequest}
                    />
                  );
                })()}

                <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-md space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Google Maps Grounding Matrikel-Analyse</span>
                    </div>
                    <button
                      type="button"
                      onClick={runMapsGroundingAnalysis}
                      disabled={isLoadingGrounding}
                      className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono hover:bg-cyan-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isLoadingGrounding ? 'animate-spin' : ''}`}
                      />
                      <span>{isLoadingGrounding ? 'Analyserer...' : 'Opdatér Grounding'}</span>
                    </button>
                  </div>

                  {groundingError && (
                    <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded text-xs text-rose-200">
                      {groundingError}
                    </div>
                  )}

                  <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed bg-slate-950/80 p-3 rounded border border-slate-800">
                    {isLoadingGrounding
                      ? 'Analyserer berørte adresser, boligblokke og færdselsarealer i spredningsfanen via Gemini 3.8 Flash med Google Maps Grounding...'
                      : groundingAnalysis}
                  </div>

                  {/* Mandatory Google Maps Grounding Links with translate="no" */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-mono uppercase text-slate-400">
                      Verificerede Google Maps Kilde-Links (translate=&quot;no&quot;):
                    </div>
                    <div className="space-y-1">
                      {groundingPlaces.map((pl, idx) => (
                        <a
                          key={idx}
                          href={pl.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          translate="no"
                          className="flex items-center justify-between gap-2 p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-xs text-cyan-300 transition-colors"
                        >
                          <span className="truncate font-mono" translate="no">
                            {pl.title}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cryptographic SHA-256 Proof-of-State Box */}
                <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-md space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    PHYSICAL-TO-DIGITAL PROOF-OF-STATE (SHA-256)
                  </div>
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-cyan-300 break-all">
                    {sha256Hash}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReportModalInitialTab('legal_submission');
                        setIsReportModalOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Åbn Formel Juridisk Indberetning (Gemini AI — kl. {currentWeather.hourLabel})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportModalInitialTab('technical');
                        setIsReportModalOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded bg-cyan-400 text-slate-950 font-semibold text-xs hover:bg-cyan-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>Eksportér Teknisk Bevis-Rapport (JSON / PDF)</span>
                    </button>
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          generateForensicPdfReport({
                            weatherDataset,
                            simulation,
                            sources,
                            receptors,
                            observations,
                            isPuffMode,
                            sha256Hash,
                            groundingPlaces,
                            validatePhotoEvidenceBinary,
                          })
                        }
                        className="py-1.5 px-2 rounded bg-slate-950 border border-amber-500/40 text-amber-300 hover:bg-amber-950/30 font-mono text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3 shrink-0" />
                        <span>Direkte PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadForensicJsonReport({
                            weatherDataset,
                            simulation,
                            sources,
                            observations,
                            isPuffMode,
                            sha256Hash,
                            groundingPlaces,
                          })
                        }
                        className="py-1.5 px-2 rounded bg-slate-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/30 font-mono text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3 shrink-0" />
                        <span>Direkte JSON</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              </DockableWindowFrame>
            )}

            {/* TAB 5: BIO-TOKS & LÆGE-AI — SAMLET BIOSCIENCE, TOKSIKOLOGI, WHO-SCORE & LÆGEFAGLIG AI */}
            {activeTab === 'bioscience' && (
              <div className="space-y-4">
                {/* Samlet Bio-toks & Læge-AI Overblikskort */}
                <div
                  data-testid="bio-toks-laege-ai-unified-panel"
                  className="p-3.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-teal-400 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Dna className="w-4 h-4 text-teal-400 shrink-0" />
                      <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-tight">
                        Bio-toks &amp; Læge-AI — Samlet Toksikologisk &amp; Klinisk Arbejdsrum
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)] font-mono text-[11px] text-teal-300 tabular-nums">
                      {selectedReceptorExposure.receptorCode}: S ={' '}
                      {selectedReceptorExposure.sumQuotient.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Sammenkædet visning af WHO-eksponeringsscore, bygningsprøver (DMA), lægefaglig AI-vurdering og molekylær toksikologi (AlphaFold 3D, UniProt, PubChem &amp; Europe PMC) for{' '}
                    <strong className="text-[var(--text-primary)]">
                      {selectedReceptorExposure.receptorName}
                    </strong>{' '}
                    kl. {currentWeather.hourLabel}.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                    <a
                      href="#bio-who-score"
                      className="px-2 py-1 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-slate-200 transition-colors"
                    >
                      1. WHO-Score
                    </a>
                    <a
                      href="#bio-dma-samples"
                      className="px-2 py-1 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-slate-200 transition-colors"
                    >
                      2. Bygningsprøver &amp; DMA
                    </a>
                    <a
                      href="#bio-medical-ai"
                      className="px-2 py-1 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-teal-500/50 text-teal-200 font-semibold transition-colors"
                    >
                      3. Læge-AI Ekspert
                    </a>
                    <a
                      href="#bio-molecular-panel"
                      className="px-2 py-1 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-slate-200 transition-colors"
                    >
                      4. Molekylær Toksikologi
                    </a>
                  </div>
                </div>

                <div id="bio-who-score">
                  <DockableWindowFrame
                    windowId="who_cumulative_exposure_score"
                    state={windowStates.who_cumulative_exposure_score}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <WhoCumulativeExposureScoreWidget
                      puff24h={puff24h}
                      receptorExposures={receptorExposures}
                      selectedReceptorId={selectedReceptorExposure.receptorId}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      selectedHourIndex={selectedHourIndex}
                      onSelectHour={(hr) => {
                        setSelectedHourIndex(hr);
                        setPlumeRouteProgress(hr);
                      }}
                      currentWeather={currentWeather}
                      dateIso={weatherDataset.dateIso}
                    />
                  </DockableWindowFrame>
                </div>

                {/* Bygningsspecifikke Miljøprøver & DMA-Anbefalinger i Bio-toks & Læge-AI fanen */}
                <div id="bio-dma-samples">
                  <BuildingSampleAndDmaPanel
                    buildings={buildings}
                    selectedBuildingId={selectedBuildingId}
                    onSelectBuildingId={(bId) => {
                      setSelectedBuildingId(bId);
                      const b = buildings.find((item) => item.id === bId);
                      if (b) {
                        const meta = BUILDING_CATEGORY_METADATA[b.category];
                        if (meta.actsAsSource) {
                          setSelectedSourceId(getSourceIdForBuilding(b.id));
                        }
                        if (meta.actsAsReceptor) {
                          setSelectedReceptorId(getReceptorIdForBuilding(b.id));
                        }
                      }
                    }}
                    onChangeBuildingCategory={handleChangeBuildingCategory}
                    compactMode
                  />
                </div>

                <div id="bio-medical-ai">
                  <DockableWindowFrame
                    windowId="medical_expert_ai"
                    state={windowStates.medical_expert_ai}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <MedicalExpertAiWidget
                      selectedReceptorExposure={selectedReceptorExposure}
                      allReceptorExposures={receptorExposures}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      currentWeather={currentWeather}
                      currentDateIso={weatherDataset.dateIso}
                      cumulativeSumQuotient24h={
                        puff24h.receptorSummaries.find(
                          (r) => r.receptorId === selectedReceptorExposure.receptorId
                        )?.cumulativeSumDose || puff24h.peakReceptor.cumulativeSumDose
                      }
                    />
                  </DockableWindowFrame>
                </div>

                <div id="bio-molecular-panel">
                  <DockableWindowFrame
                    windowId="bioscience_toxicology"
                    state={windowStates.bioscience_toxicology}
                    onMinimize={handleMinimizeWindow}
                    onPopOutFloating={handlePopOutFloatingWindow}
                    onRestore={handleRestoreWindow}
                  >
                    <BioscienceToxicologyPanel
                      selectedReceptorName={selectedReceptorExposure.receptorName}
                      selectedReceptorSubstances={selectedReceptorExposure.substances}
                      hourLabel={currentWeather.hourLabel}
                      dateIso={weatherDataset.dateIso}
                      puff24h={puff24h}
                      receptorExposures={receptorExposures}
                      selectedReceptorId={selectedReceptorExposure.receptorId}
                      onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                      selectedHourIndex={selectedHourIndex}
                      onSelectHour={(hr) => {
                        setSelectedHourIndex(hr);
                        setPlumeRouteProgress(hr);
                      }}
                      currentWeather={currentWeather}
                    />
                  </DockableWindowFrame>
                </div>
              </div>
            )}

            {/* TAB 6: VEJR-KORRELATION MED NABOKLAGER OM STØJ (dB) OG STØV (S) PR. KILDENODE */}
            {activeTab === 'noiseDust' && (
              <div className="space-y-4">
                {/* On-Demand Progressive Disclosure Bar for Deep Acoustic Analyses */}
                <div className="p-2.5 rounded-md bg-[#1B2433] border border-[#2D3B50] flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="text-slate-300 font-semibold">Dybde-moduler (On-Demand):</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowWorkspaceImpulseSensitivityGraph((v) => !v)}
                      className={`px-2 py-1 rounded border font-semibold cursor-pointer transition-colors ${
                        showWorkspaceImpulseSensitivityGraph
                          ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                          : 'bg-[#151C28] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                      }`}
                    >
                      Impulsstøjs-Følsomhed
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showWindNoiseSensitivityAnalysis;
                        setShowWindNoiseSensitivityAnalysis(next);
                        if (next && !showRibbonAcousticRefraction) {
                          setShowRibbonAcousticRefraction(true);
                        }
                      }}
                      className={`px-2 py-1 rounded border font-semibold cursor-pointer transition-colors ${
                        showWindNoiseSensitivityAnalysis
                          ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
                          : 'bg-[#151C28] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                      }`}
                    >
                      Vindstøj-Sensitivitet (&gt;10 m/s)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showWindCompensatedImpulseCatalog;
                        setShowWindCompensatedImpulseCatalog(next);
                        if (next) {
                          setShowWindNoiseSensitivityAnalysis(true);
                          if (!showRibbonAcousticRefraction) {
                            setShowRibbonAcousticRefraction(true);
                          }
                        }
                      }}
                      className={`px-2 py-1 rounded border font-semibold cursor-pointer transition-colors ${
                        showWindCompensatedImpulseCatalog
                          ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
                          : 'bg-[#151C28] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                      }`}
                    >
                      Impuls-Katalog (DBA)
                    </button>
                  </div>
                </div>

                <DockableWindowFrame
                  windowId="wind_noise_correlation"
                  state={windowStates.wind_noise_correlation}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <WindNoiseCorrelationDashboardWindow
                    weatherHours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    selectedHourIndex={selectedHourIndex}
                    onSelectHour={(hr) => {
                      myceliumAlerts.notifyTimelineScrub();
                      setSelectedHourIndex(hr);
                      setPlumeRouteProgress(hr);
                    }}
                    sources={sources}
                    observations={observations}
                    puff24h={puff24h}
                    manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                    isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
                  />
                </DockableWindowFrame>

                {/* Rullende 6-timers korrelationskoefficient mellem vindstød og maskin-impulsstøj */}
                <DockableWindowFrame
                  windowId="rolling_6h_wind_noise_correlation"
                  state={windowStates.rolling_6h_wind_noise_correlation}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <Rolling6hGustNoiseCorrelationWidget
                    weatherHours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    selectedHourIndex={selectedHourIndex}
                    onSelectHour={(hr) => {
                      myceliumAlerts.notifyTimelineScrub();
                      setSelectedHourIndex(hr);
                      setPlumeRouteProgress(hr);
                    }}
                    sources={sources}
                    observations={observations}
                    manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                    isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
                  />
                </DockableWindowFrame>

                {/* Retsmedicinsk PDF-generator for valgte støj-hændelser, vindkorrelation og sumkvotient S */}
                <SelectedNoiseEventsPdfBuilderCard
                  dateIso={weatherDataset.dateIso}
                  receptorFocusName={selectedReceptorExposure.receptorName}
                  weatherHours={weatherDataset.hours}
                  observations={observations}
                  sources={sources}
                  puff24h={puff24h}
                  manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                  isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
                  onSelectHour={(hr) => {
                    myceliumAlerts.notifyTimelineScrub();
                    setSelectedHourIndex(hr);
                    setPlumeRouteProgress(hr);
                  }}
                />

                {/* Realtids Støj-Overholdelseslog (> 55 dB(A)) med Slagelse-Kommune-ESDH eksport */}
                <NoiseComplianceLogPanel
                  dateIso={weatherDataset.dateIso}
                  currentWeather={currentWeather}
                  weatherHours={weatherDataset.hours}
                  selectedHourIndex={selectedHourIndex}
                  sources={sources}
                  receptors={receptors}
                  selectedReceptorExposure={selectedReceptorExposure}
                  manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                  isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
                  plumeDirectionDeg={plumeDirectionDeg}
                  sha256Hash={sha256Hash}
                  onSelectHour={(hr) => {
                    myceliumAlerts.notifyTimelineScrub();
                    setSelectedHourIndex(hr);
                    setPlumeRouteProgress(hr);
                  }}
                />

                {/* Quick Top Slider for Machine Noise Output Level (90 dB – 125 dB) inside 'Støj & Støv' */}
                <div
                  data-testid="sidebar-machine-noise-slider-card"
                  className="p-3 rounded-lg bg-slate-900/95 border border-amber-500/50 space-y-2 font-mono text-xs shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Maskinernes Støj-Output-Niveau (90 dB – 125 dB)</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400 text-amber-100 font-extrabold">
                        {manualMachineNoiseOutputDb.toFixed(1)} dB(A) L_WA
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsManualMachineNoiseOverrideActive((v) => !v)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                          isManualMachineNoiseOverrideActive
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                            : 'bg-slate-950 border-slate-700 text-slate-400'
                        }`}
                      >
                        {isManualMachineNoiseOverrideActive ? 'Manuel: TIL' : 'Auto'}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] text-emerald-300 font-bold shrink-0">90 dB</span>
                    <input
                      type="range"
                      min={90}
                      max={125}
                      step={0.5}
                      value={manualMachineNoiseOutputDb}
                      onChange={(e) => {
                        setIsManualMachineNoiseOverrideActive(true);
                        setManualMachineNoiseOutputDb(Number(e.target.value));
                      }}
                      aria-label="Juster maskinernes støj-output-niveau fra 90 dB til 125 dB"
                      className="flex-1 accent-amber-400 cursor-pointer"
                    />
                    <span className="text-[11px] text-rose-300 font-bold shrink-0">125 dB</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {[90, 100, 108, 114, 118, 125].map((dbPreset) => {
                        const isSel = Math.abs(manualMachineNoiseOutputDb - dbPreset) < 0.4;
                        return (
                          <button
                            key={dbPreset}
                            type="button"
                            onClick={() => {
                              setIsManualMachineNoiseOverrideActive(true);
                              setManualMachineNoiseOutputDb(dbPreset);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold border cursor-pointer transition-colors ${
                              isSel
                                ? 'bg-amber-400 text-slate-950 border-white'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-400/50'
                            }`}
                          >
                            {dbPreset} dB
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-slate-300">
                      Simulerer maskinstyrke i 3D &amp; 24t-grafer
                    </span>
                  </div>
                </div>

                {/* INTERAKTIV 24-TIMERS VINDSTØDS-KORRELATION (Vindstød vs. Støv, Støj & Naboklager) */}
                <WindGustNoiseDustCorrelationWidget
                  dateIso={weatherDataset.dateIso}
                  weatherHours={weatherDataset.hours}
                  hourlyReceptorProfile={
                    (
                      puff24h.receptorSummaries.find(
                        (r) => r.receptorId === selectedReceptorExposure.receptorId
                      ) || puff24h.peakReceptor
                    ).hourlyProfile
                  }
                  receptorName={selectedReceptorExposure.receptorName}
                  observations={observations}
                  sources={sources}
                  selectedHourIndex={selectedHourIndex}
                  machineNoiseOutputDb={
                    isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114
                  }
                  onSelectHour={(hr) => {
                    setSelectedHourIndex(hr);
                    setPlumeRouteProgress(hr);
                  }}
                  onSelectObservation={(obs) => {
                    setSelectedObservationId(obs.id);
                    setSelectedHourIndex(obs.observedHourIndex);
                  }}
                />

                {/* DEDIKERET SEKTION: VIND-KOMPENSERET IMPULS-KATALOG (.DBA Fil-Upload, Automatisk Maskin-/Vejrkorrelation & 168-Timers PDF-Rapport) */}
                <WindCompensatedDbaCatalogSection
                  sources={sources}
                  receptors={receptors}
                  weatherDataset={weatherDataset}
                  currentWeather={currentWeather}
                  selectedHourIndex={selectedHourIndex}
                  onSelectHour={(hr) => {
                    setSelectedHourIndex(hr);
                    setPlumeRouteProgress(hr);
                  }}
                  observations={observations}
                  manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                  isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
                  onApplyMatchedMachineProfile={({
                    lwaDb,
                    machineryCategoryKey,
                  }) => {
                    setManualMachineNoiseOutputDb(lwaDb);
                    setIsManualMachineNoiseOverrideActive(true);
                    setSelectedImpulseMachineryKey(machineryCategoryKey);
                  }}
                />

                <DockableWindowFrame
                  windowId="proactive_ai_agent"
                  state={windowStates.proactive_ai_agent}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <ProactiveComplaintMitigationAgentWidget
                    observations={observations}
                    currentWeather={currentWeather}
                    dateIso={weatherDataset.dateIso}
                    maxSiteSumQuotient={maxSiteSumQuotient}
                    worstExposedReceptor={worstExposedReceptor}
                    sources={sources}
                    onSelectObservation={(obsId, hrIdx) => {
                      setSelectedObservationId(obsId);
                      setSelectedHourIndex(hrIdx);
                      setPlumeRouteProgress(hrIdx);
                    }}
                    onToggleSourceActive={toggleSourceActive}
                  />
                </DockableWindowFrame>

                {/* Retsakustisk Lydanalyse & Upload af Lydklip i 'Støj & Støv'-fanen for direkte definition af lydkilde */}
                <ForensicAudioEvidencePanel
                  currentWeather={currentWeather}
                  selectedDateIso={weatherDataset.dateIso}
                  pendingPoint={pendingObservationPoint}
                  defaultLocationLabel={
                    selectedReceptorExposure
                      ? `${selectedReceptorExposure.receptorName} (${selectedReceptorExposure.address})`
                      : 'Ringparken Nedrivningsfelt, 4200 Slagelse'
                  }
                  observationsWithAudio={observations.filter((o) => Boolean(o.audioEvidence))}
                  onSelectObservation={(obs) => {
                    setSelectedObservationId(obs.id);
                    setSelectedHourIndex(obs.observedHourIndex);
                    setPendingObservationPoint(obs.position);
                  }}
                  onRegisterAudioEvidenceObservation={handleRegisterAudioEvidenceObservation}
                  onApplyDetectedMachineNoiseToSimulation={({
                    estimatedSourceLwaDb,
                    machineryCategoryKey,
                  }) => {
                    setManualMachineNoiseOutputDb(estimatedSourceLwaDb);
                    setIsManualMachineNoiseOverrideActive(true);
                    setSelectedImpulseMachineryKey(machineryCategoryKey);
                  }}
                />

                <DockableWindowFrame
                  windowId="noise_dust_correlation"
                  state={windowStates.noise_dust_correlation}
                  onMinimize={handleMinimizeWindow}
                  onPopOutFloating={handlePopOutFloatingWindow}
                  onRestore={handleRestoreWindow}
                >
                  <WeatherNoiseDustCorrelationPanel
                    sources={sources}
                    observations={observations}
                    weatherDataset={weatherDataset}
                    currentWeather={currentWeather}
                    selectedHourIndex={selectedHourIndex}
                    onSelectHour={(hr) => {
                      setSelectedHourIndex(hr);
                      setPlumeRouteProgress(hr);
                    }}
                    selectedObservationId={selectedObservationId}
                    onSelectObservation={setSelectedObservationId}
                    onQuickLogNoiseDustComplaint={handleQuickLogNoiseDustComplaint}
                    manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                    onChangeManualMachineNoiseOutputDb={setManualMachineNoiseOutputDb}
                    isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
                    onToggleManualMachineNoiseOverride={setIsManualMachineNoiseOverrideActive}
                  />
                </DockableWindowFrame>

                {/* Kompakt Nøgletals-Resumé for Indeklima, CAV-Vakuum & Termisk Opdrift (fuld analyse i fanen Indeklima & Byggeteknik) */}
                <div className="p-3 rounded-lg bg-[#1B2433] border border-[#2D3B50] space-y-2.5 font-mono">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Indeklima, CAV &amp; Opdrift — Nøgletal (Resumé)</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-extrabold border tabular-nums ${
                        indoorClimateTelemetry.isIllegalExceedanceSinGte1
                          ? 'bg-rose-600/90 text-white border-rose-300'
                          : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                      }`}
                    >
                      S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase">Indeklima S_in</div>
                      <div
                        className={`font-bold ${
                          indoorClimateTelemetry.isIllegalExceedanceSinGte1
                            ? 'text-rose-400'
                            : 'text-emerald-300'
                        }`}
                      >
                        {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase">ΔP_CAV</div>
                      <div className="font-bold text-cyan-300">
                        {indoorClimateTelemetry.deltaPCavPa.toFixed(1)} Pa
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase">z_NPL</div>
                      <div className="font-bold text-indigo-300">
                        {indoorClimateTelemetry.zNplEffectiveMeters.toFixed(1)} m
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                      <div className="text-[11px] text-slate-400 uppercase">PPV (DIN 4150-3)</div>
                      <div className="font-bold text-amber-300">
                        {indoorClimateTelemetry.ppvFoundationMmPerSec.toFixed(1)} mm/s
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('indoorClimate')}
                    className="w-full py-2 px-3 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Åbn fuld Indeklima &amp; CAV/Opdrift analyse →</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 7: INDEKLIMA & BYGGETEKNISK PÅVIRKNING (DIN 4150-3, COWI SAG A205732, CAV-UNDERTRYK & S_in) */}
            {activeTab === 'indoorClimate' && (
              <DockableWindowFrame
                windowId="indoor_climate_telemetry"
                state={windowStates.indoor_climate_telemetry}
                onMinimize={handleMinimizeWindow}
                onPopOutFloating={handlePopOutFloatingWindow}
                onRestore={handleRestoreWindow}
              >
                <div className="space-y-4">
                  {/* UNIFIED FORENSIC INDOOR CLIMATE TELEMETRY & PHYSICS ENGINE HEADER (`computeIndoorClimateTelemetry`) */}
                  <div className="p-3.5 rounded-lg bg-[#1B2433] border border-rose-500/50 space-y-3 font-mono">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#2D3B50] pb-2.5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-wider font-extrabold text-rose-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>
                            RETSMEDICINSK INDEKLIMA-TELEMETRI &amp; FYSIKMOTOR (computeIndoorClimateTelemetry)
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-extrabold text-white">
                          Primær Fokus-Receptor: {indoorClimateTelemetry.focusReceptorScopeLabel}
                        </h3>
                        <p className="text-[11px] font-sans text-slate-300 leading-snug">
                          Kobler <strong className="text-amber-300">1. Byggeteknisk Påvirkning (DIN 4150-3 PPV &amp; q₇₅)</strong>,{' '}
                          <strong className="text-cyan-300">2. CAV-Udsugningens Vakuum (BR18 § 443 &amp; DS 447)</strong> og{' '}
                          <strong className="text-rose-300">3. Termisk Opdrift (Skorstenseffekt &amp; z_NPL)</strong> via kvadratisk superposition{' '}
                          <code className="text-white">Q_tot = √(Q_w² + Q_s² + Q_CAV²)</code>.
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-extrabold border tabular-nums inline-flex items-center gap-1.5 ${
                            indoorClimateTelemetry.isIllegalExceedanceSinGte1
                              ? 'bg-rose-600 text-white border-amber-300 animate-pulse'
                              : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                          }`}
                        >
                          {indoorClimateTelemetry.isIllegalExceedanceSinGte1 ? (
                            <>
                              <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                              <span>{`S_in = ${indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)} (ULOVLIG ≥ 1,0)`}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{`S_in = ${indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)} (< 1,0)`}</span>
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setUseCalibratedForensicIndoorRef((prev) => !prev)
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer transition-colors inline-flex items-center gap-1 ${
                            useCalibratedForensicIndoorRef
                              ? 'bg-amber-400 text-slate-950 border-white'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400'
                          }`}
                          title="Skift mellem Låst Kalibreret Bevis-Tilstand (d=32m, PPV=8,7 mm/s, q75,deg=6,57, ΔP_CAV=-45,3 Pa, z_NPL=12,0 m, S_in=3,15) og Dynamisk Time-Slider beregning"
                        >
                          {useCalibratedForensicIndoorRef ? (
                            <>
                              <Pin className="w-3 h-3 shrink-0" />
                              <span>Kalibreret Bevis-Lås AKTIV (S_in = 3,15)</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3 shrink-0" />
                              <span>Dynamisk Time-Slider Beregning</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 4-Column Calibrated Telemetry Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded bg-slate-900/95 border border-amber-500/40 space-y-1">
                        <div className="text-[11px] uppercase text-amber-300 font-bold">
                          1. Byggeteknisk Påvirkning (DIN 4150-3)
                        </div>
                        <div className="text-white font-bold">
                          Afstand d = {indoorClimateTelemetry.distanceMeters} m → PPV ={' '}
                          <span className="text-rose-400">
                            {indoorClimateTelemetry.ppvFoundationMmPerSec.toFixed(1)} mm/s
                          </span>{' '}
                          (@ {indoorClimateTelemetry.dominantFrequencyHz} Hz)
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Degraderet Permeabilitet:{' '}
                          <strong className="text-amber-300">
                            q₇₅,deg = {indoorClimateTelemetry.degradedPermeabilityQ75DegM3PerHm2.toFixed(2)} m³/(h·m²)
                          </strong>{' '}
                          (P_pen = {indoorClimateTelemetry.envelopePenetrationFactorPpen.toFixed(2)})
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900/95 border border-cyan-500/40 space-y-1">
                        <div className="text-[11px] uppercase text-cyan-300 font-bold">
                          2. Mekanisk CAV-Udsugning (BR18 § 443)
                        </div>
                        <div className="text-white font-bold">
                          ΔP_CAV ={' '}
                          <span className="text-rose-400">
                            {indoorClimateTelemetry.deltaPCavPa.toFixed(1)} Pa
                          </span>{' '}
                          · Skakt-indsugning Q_op ={' '}
                          <span className="text-cyan-300">
                            {indoorClimateTelemetry.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Kontinuitet Q_ind = Q_ud ({indoorClimateTelemetry.qCavExhaustM3PerH.toFixed(1)} m³/h ={' '}
                          {indoorClimateTelemetry.qCavExhaustLs.toFixed(1)} l/s uden indblæsningsfilter)
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900/95 border border-indigo-500/40 space-y-1">
                        <div className="text-[11px] uppercase text-indigo-300 font-bold">
                          3. Termisk Opdrift &amp; 3D Neutraltryksplan
                        </div>
                        <div className="text-white font-bold">
                          ΔP_s = +{indoorClimateTelemetry.deltaPsSpanPa.toFixed(1)} Pa (
                          {indoorClimateTelemetry.stackGradientPaPerM.toFixed(2)} Pa/m) · z_NPL ={' '}
                          <span className="text-rose-400">
                            {indoorClimateTelemetry.zNplEffectiveMeters.toFixed(1)} m /{' '}
                            {indoorClimateTelemetry.buildingHeightMeters.toFixed(1)} m
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Trappedørskraft F_door ={' '}
                          <strong className="text-amber-300">
                            {indoorClimateTelemetry.stairwellDoorOpeningForceN.toFixed(1)} N
                          </strong>{' '}
                          (krav ≤ 133 N) · Krybekælder-sug:{' '}
                          {indoorClimateTelemetry.crawlspaceMoldAndAsbestosSuctionM3PerH.toFixed(1)} m³/h
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900/95 border border-rose-500/60 space-y-1">
                        <div className="text-[11px] uppercase text-rose-300 font-bold">
                          4. Indendørs Asbest &amp; Sumkvotient (BEK 613/2026)
                        </div>
                        <div className="text-white font-bold">
                          Asbest C_in ={' '}
                          <span className="text-rose-400">
                            {indoorClimateTelemetry.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³
                          </span>{' '}
                          ({indoorClimateTelemetry.indoorAsbestosPctOfGv}% af GV)
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Q_tot = {indoorClimateTelemetry.qTotSuperposedM3PerH.toFixed(1)} m³/h (ACH ={' '}
                          {indoorClimateTelemetry.achTotalPerHour.toFixed(2)} h⁻¹) →{' '}
                          <strong className="text-rose-300">
                            S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Embedded Mathematical Formulas Box */}
                    <div className="p-2.5 rounded bg-slate-950/95 border border-slate-800 space-y-1 text-[11px]">
                      <div className="text-cyan-300 font-bold uppercase">
                        Matematiske Formler i Fysikmotoren (services/dispersionEngine.ts):
                      </div>
                      <div className="text-slate-200 space-y-0.5">
                        <div>
                          • <code className="text-amber-200">Q_tot = √(Q_w² + Q_s² + Q_CAV²)</code> = √(
                          {indoorClimateTelemetry.qWindM3PerH.toFixed(1)}² +{' '}
                          {indoorClimateTelemetry.qStackM3PerH.toFixed(1)}² +{' '}
                          {indoorClimateTelemetry.qCavM3PerH.toFixed(1)}²) ={' '}
                          <strong className="text-white">
                            {indoorClimateTelemetry.qTotSuperposedM3PerH.toFixed(1)} m³/h
                          </strong>
                        </div>
                        <div>
                          •{' '}
                          <code className="text-cyan-200">
                            C_in,i(t) = [P_pen,i · ACH_tot · C_out,i(t) + G_crawl,i / V_room] / (ACH_tot + k_dep,i)
                          </code>
                        </div>
                        <div>
                          •{' '}
                          <code className="text-rose-200">
                            S_in(t) = ∑ (C_in,i(t) / GV_i) = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)} ≥ 1,0
                          </code>{' '}
                          (BEK nr. 613 af 29/06/2026 § 3, stk. 3)
                        </div>
                      </div>
                    </div>

                    {/* 5 Substances Indoor Mass-Balance Breakdown Table */}
                    <div className="overflow-x-auto rounded border border-slate-800">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                          <tr>
                            <th className="py-1.5 px-2">Stof (i)</th>
                            <th className="py-1.5 px-2">P_pen</th>
                            <th className="py-1.5 px-2">C_in,i(t)</th>
                            <th className="py-1.5 px-2">2026-GV_i</th>
                            <th className="py-1.5 px-2 text-right">Kvotient (C_in/GV)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 bg-slate-950/90">
                          {indoorClimateTelemetry.substances.map((sub) => (
                            <tr key={`ind-sub-${sub.key}`} className="hover:bg-slate-900/60">
                              <td className="py-1.5 px-2 font-bold text-white">{sub.name}</td>
                              <td className="py-1.5 px-2 text-slate-300">
                                {sub.penetrationFactorPpen.toFixed(2)}
                              </td>
                              <td className="py-1.5 px-2 font-bold text-amber-300">
                                {sub.indoorConcentrationCin} {sub.unit}
                              </td>
                              <td className="py-1.5 px-2 text-slate-400">
                                {sub.limitValueGv} {sub.unit}
                              </td>
                              <td
                                className={`py-1.5 px-2 text-right font-extrabold ${
                                  sub.indoorQuotient >= 1.0
                                    ? 'text-rose-400'
                                    : sub.indoorQuotient >= 0.25
                                    ? 'text-amber-300'
                                    : 'text-cyan-300'
                                }`}
                              >
                                {sub.indoorQuotient.toFixed(2)} ({sub.indoorPctOfGv}%)
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Automatic & Manual Algedonic Indoor Alarm + Cryptographic SHA-256 & ZKP Anchoring */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={
                          indoorClimateTelemetry.triggersAlgedonicIndoorAlarm
                            ? 'indoor-alarm-active'
                            : 'indoor-alarm-standby'
                        }
                        data-testid="indoor-climate-alarm-banner"
                        initial={{ opacity: 0, y: -4, scale: 0.99 }}
                        animate={
                          indoorClimateTelemetry.triggersAlgedonicIndoorAlarm
                            ? {
                                opacity: [1, 0.85, 1],
                                y: 0,
                                scale: 1,
                                boxShadow: [
                                  '0 0 0 0 rgba(244, 63, 94, 0)',
                                  '0 0 18px 2px rgba(244, 63, 94, 0.28)',
                                  '0 0 0 0 rgba(244, 63, 94, 0)',
                                ],
                              }
                            : {
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                boxShadow: '0 0 0 0 rgba(244, 63, 94, 0)',
                              }
                        }
                        exit={{ opacity: 0, y: 4, scale: 0.99 }}
                        transition={
                          indoorClimateTelemetry.triggersAlgedonicIndoorAlarm
                            ? {
                                opacity: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                                boxShadow: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                                y: { duration: 0.25 },
                                scale: { duration: 0.25 },
                              }
                            : { duration: 0.25 }
                        }
                        className={`p-2.5 rounded border space-y-2 ${
                          indoorClimateTelemetry.triggersAlgedonicIndoorAlarm
                            ? 'bg-rose-950/70 border-rose-400'
                            : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] font-bold text-rose-200 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            <span>
                              {indoorClimateTelemetry.triggersAlgedonicIndoorAlarm
                                ? 'ALGEDONISK INDEKLIMA-ALARM AKTIV (S_in ≥ 0,8 eller ΔP_tot < -25 Pa)'
                                : 'Indeklima-Overvågning Aktiv'}
                            </span>
                          </div>

                          <label className="flex items-center gap-1.5 text-[11px] text-cyan-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoLogIndoorClimateAlarm}
                              onChange={(e) => setAutoLogIndoorClimateAlarm(e.target.checked)}
                              className="accent-cyan-400"
                            />
                            <span>Auto-log Algedonisk Alarm (SHA-256 + ZKP)</span>
                          </label>
                        </div>

                        <p className="text-[11px] font-sans text-slate-200 leading-snug">
                          {indoorClimateTelemetry.algedonicAlarmReasonDa}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-rose-500/30 text-[11px]">
                          <span className="text-slate-300 truncate max-w-[320px]">
                            State SHA-256 (inkl. S_in, ΔP_CAV, z_NPL, PPV):{' '}
                            <strong className="text-emerald-300">{sha256Hash.slice(0, 20)}...</strong>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {lastLoggedIndoorAlarmCode && (
                              <button
                                type="button"
                                onClick={() => setActiveTab('algedonic')}
                                className="px-2 py-1 rounded bg-fuchsia-600 text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                              >
                                <Check className="w-3 h-3 shrink-0" />
                                <span>Logget: {lastLoggedIndoorAlarmCode} →</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleLogIndoorClimateAlgedonicAlarm('MANUEL')}
                              className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5 shrink-0" />
                              <span>Signér &amp; Føj Indeklima-Alarm til Beviser (SHA-256 + ZKP)</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* DEDICATED INDOOR ALGEDONIC ALARM LOG VIEW (LATEST 50 S_in > 1.0 WITH SHA-256 VERIFICATION) */}
                  <IndoorClimateAlgedonicLogPanel
                    telemetry={indoorClimateTelemetry}
                    dateIso={weatherDataset.dateIso}
                    entries={indoorAlarmRingLog}
                    onClearEntries={() => {
                      setIndoorAlarmRingLog([]);
                      persistStoredIndoorAlarms([]);
                      indoorAlarmDedupeRef.current = null;
                    }}
                  />

                  <StructuralEnvelopeImpactPanel
                    buildings={buildings}
                    sources={sources}
                    receptorExposures={receptorExposures}
                    selectedReceptorId={selectedReceptorExposure.receptorId}
                    onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                    currentWeather={currentWeather}
                    dateIso={weatherDataset.dateIso}
                    observations={observations}
                    selectedMachineryKey={selectedImpulseMachineryKey}
                    onSelectMachineryKey={setSelectedImpulseMachineryKey}
                    onAddStructuralEvidence={handleAddStructuralEnvelopeEvidence}
                  />

                  <CavExhaustImpactWidget
                    buildings={buildings}
                    currentWeather={currentWeather}
                    dateIso={weatherDataset.dateIso}
                    observations={observations}
                    maxSiteSumQuotient={maxSiteSumQuotient}
                    selectedVentilationMode={cavVentilationMode}
                    onChangeVentilationMode={setCavVentilationMode}
                    onAddCavEvidence={handleAddCavExhaustEvidence}
                    onOpenInterlockTab={() => setActiveTab('compliance')}
                  />

                  <ThermalStackBuoyancyWidget
                    currentWeather={currentWeather}
                    dateIso={weatherDataset.dateIso}
                    observations={observations}
                    cavVentilationMode={cavVentilationMode}
                    onChangeCavVentilationMode={setCavVentilationMode}
                    show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                    onToggle3DNeutralPressurePlane={(next) => {
                      const resolved = next !== undefined ? next : !show3DNeutralPressurePlane;
                      setShow3DNeutralPressurePlane(resolved);
                      if (resolved && viewportMode !== '3d' && viewportMode !== 'split') {
                        setViewportMode('3d');
                      }
                    }}
                    onChangeEffectiveZNplMeters={setNeutralPressurePlaneHeightMeters}
                    onAddThermalStackEvidence={handleAddThermalStackEvidence}
                  />

                  <BasementMonteCarloSimulationWidget
                    currentOutdoorTempC={currentWeather.temperature2m}
                    onLogMonteCarloEvidence={(title, details) => {
                      void handleAddForecastToEvidence(
                        title,
                        details,
                        weatherDataset.dateIso,
                        selectedHourIndex
                      );
                    }}
                  />
                </div>
              </DockableWindowFrame>
            )}
          </div>
        </aside>
      </div>
      )}

      {/* MODULE C: FULL-WIDTH BOTTOM INTERACTIVE TIME-SLIDER, 24H PUFF TOGGLE & SCENARIO DECK */}
      <BottomTimelineFooter
        isBottomCompactMode={isBottomCompactMode}
        onToggleBottomCompactMode={() => {
          setIsBottomCompactMode((prev) => !prev);
          setIsBottomCompactDropdownOpen(false);
        }}
        isBottomCompactDropdownOpen={isBottomCompactDropdownOpen}
        onSetBottomCompactDropdownOpen={setIsBottomCompactDropdownOpen}
        isPuffMode={isPuffMode}
        onToggle24hPuffMode={handleToggle24hPuffMode}
        showHeatmapComparison={showHeatmapComparison}
        onToggleHeatmapComparison={() => setShowHeatmapComparison((v) => !v)}
        heatmapComparisonViewMode={heatmapComparisonViewMode}
        onSelectHeatmapComparisonMode={(mode) => {
          setHeatmapComparisonViewMode(mode);
          if (viewportMode !== '2d' && viewportMode !== 'split') {
            setViewportMode('split');
          }
        }}
        comparisonHourAIndex={comparisonHourAIndex}
        onSelectComparisonHourAIndex={setComparisonHourAIndex}
        weatherDataset={weatherDataset}
        currentWeather={currentWeather}
        puff24h={puff24h}
        selectedDateIso={selectedDateIso}
        todayIso={todayIso}
        nextWeekEndIso={nextWeekEndIso}
        selectedHourIndex={selectedHourIndex}
        plumeRouteProgress={plumeRouteProgress}
        onSelectHourIndex={(hr) => {
          setSelectedHourIndex(hr);
          setPlumeRouteProgress(hr);
        }}
        onSelectDateFromPicker={(d) => {
          setSelectedDateIso(d);
          setForecastAnchorDateIso(d);
          if (d <= todayIso) {
            setPlaybackTargetEndDateIso(todayIso);
            setIsContinuousRecordingToToday(true);
          } else {
            setPlaybackTargetEndDateIso(nextWeekEndIso);
            setIsContinuousRecordingToToday(true);
          }
          loadLiveOpenMeteo(d);
        }}
        dispersionForecastMode={dispersionForecastMode}
        onSelectDispersionForecastOption={handleSelectDispersionForecastOption}
        onStepBackwardOneHour={() => {
          if (selectedHourIndex === 0) {
            const prevDateIso = shiftDateIsoByDays(selectedDateIso, -1);
            setSelectedDateIso(prevDateIso);
            setSelectedHourIndex(23);
            setPlumeRouteProgress(23);
            loadLiveOpenMeteo(prevDateIso);
          } else {
            setSelectedHourIndex((h) => h - 1);
            setPlumeRouteProgress(selectedHourIndex - 1);
          }
        }}
        onStepForwardOneHour={() => {
          if (selectedHourIndex === 23) {
            const nextDateIso = shiftDateIsoByDays(selectedDateIso, 1);
            setSelectedDateIso(nextDateIso);
            setSelectedHourIndex(0);
            setPlumeRouteProgress(0);
            fetchOpenMeteoWeatherForDate(nextDateIso).then((nextDs) => {
              setWeatherDataset(nextDs);
              recordTimeTravelStep(nextDateIso, selectedDateIso, 0, true, nextDs);
            });
          } else {
            setSelectedHourIndex((h) => h + 1);
            setPlumeRouteProgress(selectedHourIndex + 1);
          }
        }}
        isPlaying={isPlaying}
        onTogglePlayPause={() => {
          setIsPlaying((prevPlaying) => {
            const nextPlaying = !prevPlaying;
            if (nextPlaying) {
              setIsContinuousRecordingToToday(true);
              if (selectedDateIso <= todayIso) {
                setPlaybackTargetEndDateIso(todayIso);
              } else {
                setPlaybackTargetEndDateIso(nextWeekEndIso);
              }
            }
            return nextPlaying;
          });
        }}
        simulationSpeedMultiplier={simulationSpeedMultiplier}
        onSelectSimulationSpeedMultiplier={setSimulationSpeedMultiplier}
        autoSaveEvidenceOnTimeTravel={autoSaveEvidenceOnTimeTravel}
        autoSavedEvidenceCount={autoSavedEvidenceCount}
        lastAutoSavedFindingLabel={lastAutoSavedFindingLabel}
        onToggleAutoSaveEvidenceOnTimeTravel={() =>
          setAutoSaveEvidenceOnTimeTravel((v) => !v)
        }
        playbackTargetEndDateIso={playbackTargetEndDateIso}
        lastMidnightRolloverNotice={lastMidnightRolloverNotice}
        midnightRolloverCount={midnightRolloverCount}
        onStartLastWeekTimeTravel={() =>
          handleStartTimeTravelToToday(shiftDateIsoByDays(todayIso, -7), 0)
        }
        onSimulateNextWeekForecast={() => {
          const nextDay1 = shiftDateIsoByDays(todayIso, 1);
          setSelectedDateIso(nextDay1);
          setPlaybackTargetEndDateIso(nextWeekEndIso);
          setIsContinuousRecordingToToday(true);
          loadLiveOpenMeteo(nextDay1);
          setActiveTab('puff24h');
        }}
        onStopTimeTravelRecording={handleStopTimeTravelRecording}
        onNotifyTimelineScrub={() => myceliumAlerts.notifyTimelineScrub()}
        onScrubTimelineProgress={handleScrubTimelineProgress}
        observations={observations}
        maxSiteSumQuotient={maxSiteSumQuotient}
        selectedObservationId={selectedObservationId}
        onSelectObservationFromTimeline={(obs) => {
          setSelectedObservationId(obs.id);
          setSelectedHourIndex(obs.observedHourIndex);
          setPlumeRouteProgress(obs.observedHourIndex);
          setPendingObservationPoint(obs.position);
        }}
        onMoveObservationHour={handleMoveObservationHour}
        activeScenarioId={activeScenarioId}
        onApplyScenario={handleApplyScenario}
        isLoadingWeather={isLoadingWeather}
        onLoadLiveOpenMeteo={() => loadLiveOpenMeteo(selectedDateIso)}
        sha256Hash={sha256Hash}
      />

      {/* FLOATING DRAGGABLE DASHBOARD WINDOWS LAYER (Can be dragged freely around the screen & minimized to Dropdown Menu) */}
      {(Object.keys(DASHBOARD_WINDOW_REGISTRY) as DashboardWindowId[]).map((winId) => {
        const st = windowStates[winId];
        if (!st?.isFloating || st?.isMinimized) return null;
        const meta = DASHBOARD_WINDOW_REGISTRY[winId];

        return (
          <FloatingDraggableWindow
            key={winId}
            meta={meta}
            state={st}
            onFocus={handleFocusWindow}
            onMove={handleMoveFloatingWindow}
            onMinimize={handleMinimizeWindow}
            onCloseOrDock={handleCloseOrDockFloatingWindow}
          >
            {winId === 'photo_upload' && (
              <ForensicPhotoEvidencePanel
                dateIso={weatherDataset.dateIso}
                currentWeather={currentWeather}
                pendingPosition={pendingObservationPoint}
                locationLabel={obsLocationLabel}
                reporterRole={obsReporterRole}
                reporterId={obsReporterId}
                observationType={obsType}
                corroboration={livePendingCorroboration}
                observationsWithPhotos={observations.filter((o) => Boolean(o.photoEvidence))}
                onSelectObservation={(obs) => {
                  setSelectedObservationId(obs.id);
                  setSelectedHourIndex(obs.observedHourIndex);
                  setPendingObservationPoint(obs.position);
                }}
                onRegisterPhotoEvidenceObservation={handleRegisterPhotoEvidenceObservation}
                onApplyAiDescriptionToForm={({
                  observationType: recType,
                  description: recDesc,
                  photoEvidence,
                }) => {
                  setObsType(recType);
                  setObsDescription(recDesc);
                  setPendingPhotoEvidence(photoEvidence);
                }}
                onOpenReportModal={() => {
                  setReportModalInitialTab('technical');
                  setIsReportModalOpen(true);
                }}
              />
            )}

            {winId === 'pdf_authority_evidence' && (
              <ForensicPdfEvidencePanel
                currentWeather={currentWeather}
                selectedDate={weatherDataset.dateIso}
                receptorExposures={receptorExposures}
                maxSumQuotient={maxSiteSumQuotient}
                observations={observations}
                legalViolations={legalViolations}
                sha256Hash={sha256Hash}
                onRegisterPdfEvidenceObservation={handleRegisterPdfEvidenceObservation}
                onGenerateFullForensicPdfReport={(pdfArchive) =>
                  generateForensicPdfReport({
                    weatherDataset,
                    simulation,
                    sources,
                    receptors,
                    observations,
                    isPuffMode,
                    sha256Hash,
                    groundingPlaces,
                    pdfEvidenceArchive: pdfArchive,
                    validatePhotoEvidenceBinary,
                  })
                }
              />
            )}

            {winId === 'evidence_timeline_24h' && (
              <ForensicEvidenceTimelineWidget
                observations={observations}
                weatherHours={weatherDataset.hours}
                currentWeather={currentWeather}
                puff24h={puff24h}
                selectedDateIso={weatherDataset.dateIso}
                selectedHourIndex={selectedHourIndex}
                plumeRouteProgress={plumeRouteProgress}
                maxSiteSumQuotient={maxSiteSumQuotient}
                selectedObservationId={selectedObservationId}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                onScrubProgress={handleScrubTimelineProgress}
                onSelectObservation={(obs) => {
                  setSelectedObservationId(obs.id);
                  setSelectedHourIndex(obs.observedHourIndex);
                  setPlumeRouteProgress(obs.observedHourIndex);
                  setPendingObservationPoint(obs.position);
                }}
                onMoveObservationHour={handleMoveObservationHour}
                comparisonHourAIndex={comparisonHourAIndex}
                showHeatmapComparison={showHeatmapComparison}
                onChangeComparisonHourA={setComparisonHourAIndex}
                onToggleHeatmapComparison={() =>
                  setShowHeatmapComparison((v) => !v)
                }
                variant="full_widget"
              />
            )}

            {winId === 'proactive_ai_agent' && (
              <ProactiveComplaintMitigationAgentWidget
                observations={observations}
                currentWeather={currentWeather}
                dateIso={weatherDataset.dateIso}
                maxSiteSumQuotient={maxSiteSumQuotient}
                worstExposedReceptor={worstExposedReceptor}
                sources={sources}
                onSelectObservation={(obsId, hrIdx) => {
                  setSelectedObservationId(obsId);
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                onToggleSourceActive={toggleSourceActive}
              />
            )}

            {winId === 'thirty_day_aggregated_heatmap' && (
              <ThirtyDayAggregatedHeatmapWidget
                todayIso={todayIso}
                selectedDateIso={selectedDateIso}
                currentWeather={currentWeather}
                weatherDataset={weatherDataset}
                sources={sources}
                receptors={receptors}
                selectedReceptorId={selectedReceptorId}
                onSelectDateIso={(newDateIso) => {
                  setSelectedDateIso(newDateIso);
                  loadLiveOpenMeteo(newDateIso);
                }}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
              />
            )}

            {winId === 'medical_expert_ai' && (
              <MedicalExpertAiWidget
                selectedReceptorExposure={selectedReceptorExposure}
                allReceptorExposures={receptorExposures}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                currentWeather={currentWeather}
                currentDateIso={weatherDataset.dateIso}
                cumulativeSumQuotient24h={
                  puff24h.receptorSummaries.find(
                    (r) => r.receptorId === selectedReceptorExposure.receptorId
                  )?.cumulativeSumDose || puff24h.peakReceptor.cumulativeSumDose
                }
              />
            )}

            {winId === 'prediction_vs_actual_forecast' && (
              <PredictionVsActualAndForecastWidget
                todayIso={todayIso}
                selectedDateIso={selectedDateIso}
                selectedHourIndex={selectedHourIndex}
                isPlaying={isPlaying}
                isContinuousRecordingToToday={isContinuousRecordingToToday}
                playbackTargetEndDateIso={playbackTargetEndDateIso}
                midnightRolloverCount={midnightRolloverCount}
                recordedTimelineEvents={recordedTimelineEvents}
                sources={sources}
                receptors={receptors}
                onStartTimeTravelToToday={handleStartTimeTravelToToday}
                onStartNextWeekForecastPlayback={handleStartNextWeekForecastPlayback}
                onStopTimeTravelRecording={handleStopTimeTravelRecording}
                onClearRecordedEvents={() => setRecordedTimelineEvents([])}
                onSelectDateAndHour={(dIso, hrIdx, customDs) => {
                  setSelectedDateIso(dIso);
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                  if (customDs) {
                    setWeatherDataset(customDs);
                  } else {
                    loadLiveOpenMeteo(dIso);
                  }
                }}
                autoSaveEvidenceOnTimeTravel={autoSaveEvidenceOnTimeTravel}
                onToggleAutoSaveEvidence={() =>
                  setAutoSaveEvidenceOnTimeTravel((v) => !v)
                }
                autoSavedEvidenceCount={autoSavedEvidenceCount}
              />
            )}

            {winId === 'dispersion_forecast_bulletin' && (
              <DispersionForecastBulletinWidget
                baseDateIso={forecastAnchorDateIso}
                simulatedDateIso={selectedDateIso}
                simulatedHourIndex={selectedHourIndex}
                todayIso={todayIso}
                currentWeather={currentWeather}
                sources={sources}
                receptors={receptors}
                buildings={buildings}
                selectedReceptorId={selectedReceptorId}
                mode={dispersionForecastMode}
                focusTrigger={dispersionForecastFocusTrigger}
                onChangeMode={handleSelectDispersionForecastOption}
                onSelectDateAndHour={(dIso, hrIdx, customDs) => {
                  setSelectedDateIso(dIso);
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                  if (customDs) {
                    setWeatherDataset(customDs);
                  } else {
                    loadLiveOpenMeteo(dIso);
                  }
                }}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                onAddForecastToEvidence={handleAddForecastToEvidence}
                onClose={() => handleCloseOrDockFloatingWindow('dispersion_forecast_bulletin')}
              />
            )}

            {winId === 'stochastic_wind_bias' && (
              <StochasticWindBiasWidget
                hours={weatherDataset.hours}
                currentWeather={currentWeather}
                dateIso={weatherDataset.dateIso}
                puff24h={puff24h}
                selectedReceptorId={selectedReceptorId}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
              />
            )}

            {winId === 'wind_rose_7day' && (
              <SevenDayHistoricalWindRoseWidget
                dateIso={weatherDataset.dateIso}
                currentDayHours={weatherDataset.hours}
                currentWeather={currentWeather}
                onSelectDateIso={(newDateIso) => {
                  setSelectedDateIso(newDateIso);
                  loadLiveOpenMeteo(newDateIso);
                }}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
              />
            )}

            {winId === 'wind_rose_24h' && (
              <InteractiveWindRoseChart
                hours={weatherDataset.hours}
                currentWeather={currentWeather}
                dateIso={weatherDataset.dateIso}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
              />
            )}

            {winId === 'temp_aerosol_24h' && (
              <TemperatureAerosolChart
                hours={weatherDataset.hours}
                currentWeather={currentWeather}
                dateIso={weatherDataset.dateIso}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                variant="full"
              />
            )}

            {winId === 'cumulative_dust_24h' && (
              <CumulativeRespirableDustChart
                puff24h={puff24h}
                weatherHours={weatherDataset.hours}
                currentWeather={currentWeather}
                selectedReceptorId={selectedReceptorId}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
              />
            )}

            {winId === 'receptor_dust_deposition_profile' && (
              <ReceptorDustDepositionProfileWidget
                puff24h={puff24h}
                receptorExposures={receptorExposures}
                weatherHours={weatherDataset.hours}
                currentWeather={currentWeather}
                dateIso={weatherDataset.dateIso}
                selectedReceptorId={selectedReceptorExposure.receptorId}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                buildings={buildings}
              />
            )}

            {winId === 'noise_dust_correlation' && (
              <WeatherNoiseDustCorrelationPanel
                sources={sources}
                observations={observations}
                weatherDataset={weatherDataset}
                currentWeather={currentWeather}
                selectedHourIndex={selectedHourIndex}
                onSelectHour={(hr) => {
                  setSelectedHourIndex(hr);
                  setPlumeRouteProgress(hr);
                }}
                selectedObservationId={selectedObservationId}
                onSelectObservation={setSelectedObservationId}
                onQuickLogNoiseDustComplaint={handleQuickLogNoiseDustComplaint}
              />
            )}

            {winId === 'bioscience_toxicology' && (
              <BioscienceToxicologyPanel
                selectedReceptorName={selectedReceptorExposure.receptorName}
                selectedReceptorSubstances={selectedReceptorExposure.substances}
                hourLabel={currentWeather.hourLabel}
                dateIso={weatherDataset.dateIso}
                puff24h={puff24h}
                receptorExposures={receptorExposures}
                selectedReceptorId={selectedReceptorExposure.receptorId}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                selectedHourIndex={selectedHourIndex}
                onSelectHour={(hr) => {
                  setSelectedHourIndex(hr);
                  setPlumeRouteProgress(hr);
                }}
                currentWeather={currentWeather}
              />
            )}

            {winId === 'who_cumulative_exposure_score' && (
              <WhoCumulativeExposureScoreWidget
                puff24h={puff24h}
                receptorExposures={receptorExposures}
                selectedReceptorId={selectedReceptorExposure.receptorId}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                selectedHourIndex={selectedHourIndex}
                onSelectHour={(hr) => {
                  setSelectedHourIndex(hr);
                  setPlumeRouteProgress(hr);
                }}
                currentWeather={currentWeather}
                dateIso={weatherDataset.dateIso}
              />
            )}

            {winId === 'gemini_grounding_chat' && (
              <ForensicChatbotPanel
                telemetryContext={{
                  selectedSourceName:
                    sources.find((s) => s.id === selectedSourceId)?.name ||
                    sources[0]?.name ||
                    'Blok 1',
                  windSpeedMs: currentWeather.windSpeed10m,
                  windDirDeg: currentWeather.windDirection10m,
                  stabilityClass: currentWeather.pasquillClass,
                  sumQuotient: maxSiteSumQuotient,
                  peakAddress: puff24h.peakReceptor.address,
                  selectedDate: weatherDataset.dateIso,
                  selectedHour: selectedHourIndex,
                  precipitationMm: currentWeather.precipitation,
                  observationsCount: observations.length,
                  indoorClimate: indoorClimateTelemetry,
                }}
                onRunMapsGrounding={runMapsGroundingAnalysis}
                mapsGroundingLoading={isLoadingGrounding}
              />
            )}

            {winId === 'neighbor_24h_asbestos_dose' && (
              <Neighbor24hAsbestosExposureDoseWidget
                receptors={receptors}
                sources={sources}
                buildings={buildings}
                weatherHours={weatherDataset.hours}
                currentWeather={currentWeather}
                selectedSourceId={selectedSourceId}
                selectedReceptorId={selectedReceptorId}
                asbestosSourceScope={asbestosSourceScope}
                onChangeAsbestosSourceScope={setAsbestosSourceScope}
                onSelectSource={(srcId) => setSelectedSourceId(srcId)}
                onToggleSourceActive={toggleSourceActive}
                onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                onActivate3DTemporalAsbestosHeatmap={() => {
                  setAsbestosHeatmapActive(true);
                  setTemporal24hAsbestosAccumulation(true);
                  if (viewportMode !== '3d' && viewportMode !== 'split') {
                    setViewportMode('3d');
                  }
                }}
              />
            )}

            {winId === 'indoor_climate_telemetry' && (
              <div className="space-y-4">
                <StructuralEnvelopeImpactPanel
                  buildings={buildings}
                  sources={sources}
                  receptorExposures={receptorExposures}
                  selectedReceptorId={selectedReceptorExposure.receptorId}
                  onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
                  currentWeather={currentWeather}
                  dateIso={weatherDataset.dateIso}
                  observations={observations}
                  selectedMachineryKey={selectedImpulseMachineryKey}
                  onSelectMachineryKey={setSelectedImpulseMachineryKey}
                  onAddStructuralEvidence={handleAddStructuralEnvelopeEvidence}
                />

                <CavExhaustImpactWidget
                  buildings={buildings}
                  currentWeather={currentWeather}
                  dateIso={weatherDataset.dateIso}
                  observations={observations}
                  maxSiteSumQuotient={maxSiteSumQuotient}
                  selectedVentilationMode={cavVentilationMode}
                  onChangeVentilationMode={setCavVentilationMode}
                  onAddCavEvidence={handleAddCavExhaustEvidence}
                  onOpenInterlockTab={() => setActiveTab('compliance')}
                />

                <ThermalStackBuoyancyWidget
                  currentWeather={currentWeather}
                  dateIso={weatherDataset.dateIso}
                  observations={observations}
                  cavVentilationMode={cavVentilationMode}
                  onChangeCavVentilationMode={setCavVentilationMode}
                  show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                  onToggle3DNeutralPressurePlane={(next) => {
                    const resolved = next !== undefined ? next : !show3DNeutralPressurePlane;
                    setShow3DNeutralPressurePlane(resolved);
                    if (resolved && viewportMode !== '3d' && viewportMode !== 'split') {
                      setViewportMode('3d');
                    }
                  }}
                  onChangeEffectiveZNplMeters={setNeutralPressurePlaneHeightMeters}
                  onAddThermalStackEvidence={handleAddThermalStackEvidence}
                />

                <BasementMonteCarloSimulationWidget
                  currentOutdoorTempC={currentWeather.temperature2m}
                  onLogMonteCarloEvidence={(title, details) => {
                    void handleAddForecastToEvidence(
                      title,
                      details,
                      weatherDataset.dateIso,
                      selectedHourIndex
                    );
                  }}
                />
              </div>
            )}

            {winId === 'map_viewport_2d_3d' && (
              <div className="h-[540px] w-full rounded overflow-hidden border border-slate-800 relative flex flex-col">
                <div className="flex-1 min-h-0 relative grid grid-cols-1 grid-rows-1 overflow-hidden">
                  {(viewportMode === '3d' || viewportMode === 'underground_3d') && (
                    <Ringparken3DScene
                      sources={sources}
                      receptors={receptors}
                      buildings={buildings}
                      activeCategoryFilters={activeCategoryFilters}
                      onToggleCategoryFilter={handleToggleCategoryFilter}
                      onChangeBuildingCategory={handleChangeBuildingCategory}
                      plumeZones={simulation.plumeZones}
                      receptorExposures={receptorExposures}
                      currentWeather={currentWeather}
                      observations={observations}
                      selectedSourceId={selectedSourceId}
                      selectedReceptorId={selectedReceptorId}
                      onSelectSource={(id) => {
                        setSelectedSourceId(id);
                        setActiveTab('substances');
                      }}
                      onSelectReceptor={(id) => setSelectedReceptorId(id)}
                      onToggleSourceActive={toggleSourceActive}
                      isFullscreen3D={isFullscreen3D}
                      onToggleFullscreen3D={() => setIsFullscreen3D((v) => !v)}
                      isMapOnly={isMapOnlyMode}
                      onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                      undergroundMode={viewportMode === 'underground_3d'}
                      onToggleUndergroundMode={(next) => {
                        const active = next !== undefined ? next : viewportMode !== 'underground_3d';
                        setViewportMode(active ? 'underground_3d' : '3d');
                      }}
                      precipitationOverrideMm={precipitationOverrideMm}
                      onChangePrecipitationOverride={setPrecipitationOverrideMm}
                      onSwitchTo2DPercolation={() => setViewportMode('underground_2d')}
                      asbestosHeatmapActive={asbestosHeatmapActive}
                      onToggleAsbestosHeatmap={setAsbestosHeatmapActive}
                      asbestosSourceScope={asbestosSourceScope}
                      onChangeAsbestosSourceScope={setAsbestosSourceScope}
                      asbestosEvalHeightMeters={asbestosEvalHeightMeters}
                      onChangeAsbestosEvalHeightMeters={setAsbestosEvalHeightMeters}
                      weatherHours={weatherDataset.hours}
                      temporal24hAsbestosAccumulation={temporal24hAsbestosAccumulation}
                      onToggleTemporal24hAsbestosAccumulation={setTemporal24hAsbestosAccumulation}
                      showLeewardWakeEffect={showLeewardWakeEffect}
                      onToggleLeewardWakeEffect={setShowLeewardWakeEffect}
                      showWeatherCorrelationOverlay={showWeatherCorrelationOverlay}
                      onToggleWeatherCorrelationOverlay={setShowWeatherCorrelationOverlay}
                      timelineSliderProgress={plumeRouteProgress}
                      show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                      onToggle3DNeutralPressurePlane={setShow3DNeutralPressurePlane}
                      neutralPressurePlaneHeightMeters={neutralPressurePlaneHeightMeters}
                      onChangeNeutralPressurePlaneHeightMeters={setNeutralPressurePlaneHeightMeters}
                      machineNoiseOutputDb={
                        isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : undefined
                      }
                      selectedDateIso={selectedDateIso}
                      onChangeDateIso={handleChangeSimulatedDateIso}
                      onStepHour={handleStepSimulatedHour}
                      focusBlok12PercolationTrigger={focusBlok12PercolationTrigger}
                      simulationSpeedMultiplier={simulationSpeedMultiplier}
                      hiddenSourceIds={hiddenSourceIds}
                      visibleSubstances={visibleSubstances}
                      onBornehavePlumeAlertUpdate={setLive3DBornehavePlumeAlert}
                      waterMainTelemetry={waterMainTelemetry}
                      showWaterMainLayer={effectiveShowWaterMainLayer}
                      onToggleWaterMainLayer={handleToggleWaterMainLayer}
                      showLerBuffer={showLerBuffer}
                      onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                      hasSteelRoadPlates={hasSteelRoadPlates}
                      onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                      simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                      onToggleSimulatedPipeRupture={() => setSimulatedPipeRuptureActive((v) => !v)}
                      isS3ValveLockoutActive={isS3ValveLockoutActive}
                      onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                      onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                      onRestoreAllMachinery={handleRestoreAllMachinery}
                      virtualLeakPinPoint={virtualLeakPinPoint}
                      virtualLeakImpact={virtualLeakImpact}
                      onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                      simultaneousDispatch={simultaneousAlgedonic.dispatch}
                    />
                  )}

                  {viewportMode === 'underground_2d' && (
                    <UndergroundPercolation2D
                      sources={sources}
                      receptors={receptors}
                      currentWeather={currentWeather}
                      selectedSourceId={selectedSourceId}
                      onSelectSource={(id) => setSelectedSourceId(id)}
                      precipitationOverrideMm={precipitationOverrideMm}
                      onChangePrecipitationOverride={setPrecipitationOverrideMm}
                      onSwitchTo3DUnderground={() => setViewportMode('underground_3d')}
                      onSwitchToSplitUnderground={() => setViewportMode('underground_split')}
                      isMapOnly={isMapOnlyMode}
                      onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                      isFullscreen={isFullscreen3D}
                      selectedDateIso={selectedDateIso}
                      onChangeDateIso={handleChangeSimulatedDateIso}
                      onStepHour={handleStepSimulatedHour}
                      hiddenSourceIds={hiddenSourceIds}
                      waterMainTelemetry={waterMainTelemetry}
                      showWaterMainLayer={effectiveShowWaterMainLayer}
                      onToggleWaterMainLayer={handleToggleWaterMainLayer}
                      showLerBuffer={showLerBuffer}
                      onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                      hasSteelRoadPlates={hasSteelRoadPlates}
                      onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                      simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                      onToggleSimulatedPipeRupture={() => setSimulatedPipeRuptureActive((v) => !v)}
                      isS3ValveLockoutActive={isS3ValveLockoutActive}
                      onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                      onToggleSourceActive={toggleSourceActive}
                      onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                      onRestoreAllMachinery={handleRestoreAllMachinery}
                      hasVirtualLeakPin={Boolean(virtualLeakPinPoint)}
                      virtualLeakImpact={virtualLeakImpact}
                      onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                      simultaneousDispatch={simultaneousAlgedonic.dispatch}
                      onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
                      manualMachineNoiseOutputDb={
                        isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114
                      }
                    />
                  )}

                  {viewportMode === 'underground_split' && (
                    <div className="w-full h-full grid grid-cols-1 xl:grid-cols-2 min-h-0 overflow-hidden divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
                      <div className="w-full h-full min-h-[240px] relative overflow-hidden">
                        <UndergroundPercolation2D
                          sources={sources}
                          receptors={receptors}
                          currentWeather={currentWeather}
                          selectedSourceId={selectedSourceId}
                          onSelectSource={(id) => setSelectedSourceId(id)}
                          precipitationOverrideMm={precipitationOverrideMm}
                          onChangePrecipitationOverride={setPrecipitationOverrideMm}
                          onSwitchTo3DUnderground={() => setViewportMode('underground_3d')}
                          isCompactSplit
                          isMapOnly={isMapOnlyMode}
                          onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                          isFullscreen={isFullscreen3D}
                          selectedDateIso={selectedDateIso}
                          onChangeDateIso={handleChangeSimulatedDateIso}
                          onStepHour={handleStepSimulatedHour}
                          hiddenSourceIds={hiddenSourceIds}
                          waterMainTelemetry={waterMainTelemetry}
                          showWaterMainLayer={effectiveShowWaterMainLayer}
                          onToggleWaterMainLayer={handleToggleWaterMainLayer}
                          showLerBuffer={showLerBuffer}
                          onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                          hasSteelRoadPlates={hasSteelRoadPlates}
                          onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                          simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                          onToggleSimulatedPipeRupture={() =>
                            setSimulatedPipeRuptureActive((v) => !v)
                          }
                          isS3ValveLockoutActive={isS3ValveLockoutActive}
                          onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                          onToggleSourceActive={toggleSourceActive}
                          onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                          onRestoreAllMachinery={handleRestoreAllMachinery}
                          hasVirtualLeakPin={Boolean(virtualLeakPinPoint)}
                          virtualLeakImpact={virtualLeakImpact}
                          onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                          simultaneousDispatch={simultaneousAlgedonic.dispatch}
                          onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
                          manualMachineNoiseOutputDb={
                            isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114
                          }
                        />
                      </div>
                      <div className="w-full h-full min-h-[240px] relative overflow-hidden">
                        <Ringparken3DScene
                          sources={sources}
                          receptors={receptors}
                          buildings={buildings}
                          activeCategoryFilters={activeCategoryFilters}
                          onToggleCategoryFilter={handleToggleCategoryFilter}
                          onChangeBuildingCategory={handleChangeBuildingCategory}
                          plumeZones={simulation.plumeZones}
                          receptorExposures={receptorExposures}
                          currentWeather={currentWeather}
                          observations={observations}
                          selectedSourceId={selectedSourceId}
                          selectedReceptorId={selectedReceptorId}
                          onSelectSource={(id) => setSelectedSourceId(id)}
                          onSelectReceptor={(id) => setSelectedReceptorId(id)}
                          onToggleSourceActive={toggleSourceActive}
                          isFullscreen3D={isFullscreen3D}
                          onToggleFullscreen3D={() => setIsFullscreen3D((v) => !v)}
                          isMapOnly={isMapOnlyMode}
                          onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                          undergroundMode={true}
                          onToggleUndergroundMode={(next) => {
                            if (next === false) setViewportMode('3d');
                          }}
                          precipitationOverrideMm={precipitationOverrideMm}
                          onChangePrecipitationOverride={setPrecipitationOverrideMm}
                          onSwitchTo2DPercolation={() => setViewportMode('underground_2d')}
                          asbestosHeatmapActive={asbestosHeatmapActive}
                          onToggleAsbestosHeatmap={setAsbestosHeatmapActive}
                          asbestosSourceScope={asbestosSourceScope}
                          onChangeAsbestosSourceScope={setAsbestosSourceScope}
                          asbestosEvalHeightMeters={asbestosEvalHeightMeters}
                          onChangeAsbestosEvalHeightMeters={setAsbestosEvalHeightMeters}
                          weatherHours={weatherDataset.hours}
                          temporal24hAsbestosAccumulation={temporal24hAsbestosAccumulation}
                          onToggleTemporal24hAsbestosAccumulation={
                            setTemporal24hAsbestosAccumulation
                          }
                          showLeewardWakeEffect={showLeewardWakeEffect}
                          onToggleLeewardWakeEffect={setShowLeewardWakeEffect}
                          showWeatherCorrelationOverlay={showWeatherCorrelationOverlay}
                          onToggleWeatherCorrelationOverlay={setShowWeatherCorrelationOverlay}
                          timelineSliderProgress={plumeRouteProgress}
                          show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                          onToggle3DNeutralPressurePlane={setShow3DNeutralPressurePlane}
                          neutralPressurePlaneHeightMeters={neutralPressurePlaneHeightMeters}
                          onChangeNeutralPressurePlaneHeightMeters={
                            setNeutralPressurePlaneHeightMeters
                          }
                          machineNoiseOutputDb={
                            isManualMachineNoiseOverrideActive
                              ? manualMachineNoiseOutputDb
                              : undefined
                          }
                          selectedDateIso={selectedDateIso}
                          onChangeDateIso={handleChangeSimulatedDateIso}
                          onStepHour={handleStepSimulatedHour}
                          focusBlok12PercolationTrigger={focusBlok12PercolationTrigger}
                          simulationSpeedMultiplier={simulationSpeedMultiplier}
                          hiddenSourceIds={hiddenSourceIds}
                          visibleSubstances={visibleSubstances}
                          onBornehavePlumeAlertUpdate={setLive3DBornehavePlumeAlert}
                          waterMainTelemetry={waterMainTelemetry}
                          showWaterMainLayer={effectiveShowWaterMainLayer}
                          onToggleWaterMainLayer={handleToggleWaterMainLayer}
                          showLerBuffer={showLerBuffer}
                          onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                          hasSteelRoadPlates={hasSteelRoadPlates}
                          onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                          simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                          onToggleSimulatedPipeRupture={() =>
                            setSimulatedPipeRuptureActive((v) => !v)
                          }
                          isS3ValveLockoutActive={isS3ValveLockoutActive}
                          onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                          onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                          onRestoreAllMachinery={handleRestoreAllMachinery}
                          virtualLeakPinPoint={virtualLeakPinPoint}
                          virtualLeakImpact={virtualLeakImpact}
                          onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                          simultaneousDispatch={simultaneousAlgedonic.dispatch}
                        />
                      </div>
                    </div>
                  )}

                  {viewportMode === '2d' && (
                    <DispersionMap
                      sources={sources}
                      receptors={receptors}
                      buildings={buildings}
                      activeCategoryFilters={activeCategoryFilters}
                      onToggleCategoryFilter={handleToggleCategoryFilter}
                      onChangeBuildingCategory={handleChangeBuildingCategory}
                      plumeZones={simulation.plumeZones}
                      receptorExposures={receptorExposures}
                      currentWeather={currentWeather}
                      isPuffMode={isPuffMode}
                      puff24h={puff24h}
                      observations={observations}
                      selectedObservationId={selectedObservationId}
                      pendingObservationPoint={pendingObservationPoint}
                      onSelectObservation={handleSelectMapObservationModal}
                      selectedSourceId={selectedSourceId}
                      selectedReceptorId={selectedReceptorId}
                      onSelectSource={handleSelectMapSourceModal}
                      onSelectReceptor={handleSelectMapReceptor}
                      mapClickMode={mapClickMode}
                      onSetMapClickMode={setMapClickMode}
                      onMapAddNode={handleMapAddNode}
                      onSelectHourFromPeak={handleSelectHourFromPeak}
                      isAnimatingPlumeRoute={isAnimatingPlumeRoute}
                      plumeRouteProgress={plumeRouteProgress}
                      onToggleAnimatePlumeRoute={handleToggleAnimatePlumeRoute}
                      showHeatmapComparison={showHeatmapComparison}
                      onToggleHeatmapComparison={handleToggleHeatmapComparison}
                      heatmapComparison={heatmapComparison}
                      heatmapComparisonViewMode={heatmapComparisonViewMode}
                      onChangeHeatmapComparisonViewMode={setHeatmapComparisonViewMode}
                      weatherHours={weatherDataset.hours}
                      comparisonHourAIndex={comparisonHourAIndex}
                      comparisonHourBIndex={selectedHourIndex}
                      onChangeComparisonHourA={setComparisonHourAIndex}
                      onChangeComparisonHourB={setSelectedHourIndex}
                      isFullscreen={isFullscreen3D}
                      onToggleFullscreen={handleToggleFullscreen3D}
                      fullscreenLabel="Fuld Skærm (2D Taktisk)"
                      isMapOnly={isMapOnlyMode}
                      onToggleMapOnly={handleToggleMapOnlyMode}
                      onSaveMapSnapshotObservation={handleSaveMapSnapshotObservation}
                      selectedDateIso={selectedDateIso}
                      onChangeDateIso={handleChangeSimulatedDateIso}
                      myceliumSnapshot={myceliumSnapshot}
                      hiddenSourceIds={hiddenSourceIds}
                      visibleSubstances={visibleSubstances}
                      onChangeVisibleSubstances={setVisibleSubstances}
                      showWindNoiseHeatmap={showWindNoiseHeatmapLayer}
                      onToggleWindNoiseHeatmap={handleToggleWindNoiseHeatmapFromMap}
                      showPlumeConcentrationHeatmap={showPlumeConcentrationHeatmap}
                      onTogglePlumeConcentrationHeatmap={
                        handleTogglePlumeConcentrationHeatmapFromMap
                      }
                      plumeHeatmapPasquillThreshold={plumeHeatmapPasquillThreshold}
                      showWeatherCorrelationHeatmap={showWeatherCorrelationHeatmapLayer}
                      onToggleWeatherCorrelationHeatmap={
                        handleToggleWeatherCorrelationHeatmapFromMap
                      }
                      waterMainTelemetry={waterMainTelemetry}
                      showWaterMainLayer={effectiveShowWaterMainLayer}
                      onToggleWaterMainLayer={handleToggleWaterMainLayer}
                      showLerBuffer={showLerBuffer}
                      onToggleLerBuffer={handleToggleLerBuffer}
                      hasSteelRoadPlates={hasSteelRoadPlates}
                      onToggleSteelRoadPlates={handleToggleSteelRoadPlates}
                      simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                      onToggleSimulatedPipeRupture={handleToggleSimulatedPipeRupture}
                      isS3ValveLockoutActive={isS3ValveLockoutActive}
                      onToggleS3ValveLockout={handleToggleS3ValveLockout}
                      onToggleSourceActive={toggleSourceActive}
                      onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                      onRestoreAllMachinery={handleRestoreAllMachinery}
                      virtualLeakPinPoint={virtualLeakPinPoint}
                      virtualLeakImpact={virtualLeakImpact}
                      onChangeVirtualLeakPinPoint={setVirtualLeakPinPoint}
                      onLogWaterMainObservation={handleLogWaterMainObservation}
                      simultaneousDispatch={simultaneousAlgedonic.dispatch}
                      onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
                      onOpenSimultaneousModal={handleOpenSimultaneousModal}
                      machineNoiseOutputDb={
                        isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : undefined
                      }
                    />
                  )}

                  {viewportMode === 'split' && (
                    <div className="w-full h-full grid grid-cols-1 xl:grid-cols-2 min-h-0 overflow-hidden divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
                      <div className="w-full h-full min-h-[240px] relative overflow-hidden">
                        <DispersionMap
                          sources={sources}
                          receptors={receptors}
                          buildings={buildings}
                          activeCategoryFilters={activeCategoryFilters}
                          onToggleCategoryFilter={handleToggleCategoryFilter}
                          onChangeBuildingCategory={handleChangeBuildingCategory}
                          plumeZones={simulation.plumeZones}
                          receptorExposures={receptorExposures}
                          currentWeather={currentWeather}
                          isPuffMode={isPuffMode}
                          puff24h={puff24h}
                          observations={observations}
                          selectedObservationId={selectedObservationId}
                          pendingObservationPoint={pendingObservationPoint}
                          onSelectObservation={handleSelectMapObservationModal}
                          selectedSourceId={selectedSourceId}
                          selectedReceptorId={selectedReceptorId}
                          onSelectSource={handleSelectMapSourceModal}
                          onSelectReceptor={handleSelectMapReceptor}
                          mapClickMode={mapClickMode}
                          onSetMapClickMode={setMapClickMode}
                          onMapAddNode={handleMapAddNode}
                          onSelectHourFromPeak={handleSelectHourFromPeak}
                          isAnimatingPlumeRoute={isAnimatingPlumeRoute}
                          plumeRouteProgress={plumeRouteProgress}
                          onToggleAnimatePlumeRoute={handleToggleAnimatePlumeRoute}
                          showHeatmapComparison={showHeatmapComparison}
                          onToggleHeatmapComparison={handleToggleHeatmapComparison}
                          heatmapComparison={heatmapComparison}
                          heatmapComparisonViewMode={heatmapComparisonViewMode}
                          onChangeHeatmapComparisonViewMode={setHeatmapComparisonViewMode}
                          weatherHours={weatherDataset.hours}
                          comparisonHourAIndex={comparisonHourAIndex}
                          comparisonHourBIndex={selectedHourIndex}
                          onChangeComparisonHourA={setComparisonHourAIndex}
                          onChangeComparisonHourB={setSelectedHourIndex}
                          isFullscreen={isFullscreen3D}
                          onToggleFullscreen={handleToggleFullscreen3D}
                          fullscreenLabel="Fuld Skærm (2D/3D Split)"
                          isMapOnly={isMapOnlyMode}
                          onToggleMapOnly={handleToggleMapOnlyMode}
                          onSaveMapSnapshotObservation={handleSaveMapSnapshotObservation}
                          selectedDateIso={selectedDateIso}
                          onChangeDateIso={handleChangeSimulatedDateIso}
                          myceliumSnapshot={myceliumSnapshot}
                          hiddenSourceIds={hiddenSourceIds}
                          visibleSubstances={visibleSubstances}
                          onChangeVisibleSubstances={setVisibleSubstances}
                          showWindNoiseHeatmap={showWindNoiseHeatmapLayer}
                          onToggleWindNoiseHeatmap={handleToggleWindNoiseHeatmapFromMap}
                          showPlumeConcentrationHeatmap={showPlumeConcentrationHeatmap}
                          onTogglePlumeConcentrationHeatmap={
                            handleTogglePlumeConcentrationHeatmapFromMap
                          }
                          plumeHeatmapPasquillThreshold={plumeHeatmapPasquillThreshold}
                          showWeatherCorrelationHeatmap={showWeatherCorrelationHeatmapLayer}
                          onToggleWeatherCorrelationHeatmap={
                            handleToggleWeatherCorrelationHeatmapFromMap
                          }
                          waterMainTelemetry={waterMainTelemetry}
                          showWaterMainLayer={effectiveShowWaterMainLayer}
                          onToggleWaterMainLayer={handleToggleWaterMainLayer}
                          showLerBuffer={showLerBuffer}
                          onToggleLerBuffer={handleToggleLerBuffer}
                          hasSteelRoadPlates={hasSteelRoadPlates}
                          onToggleSteelRoadPlates={handleToggleSteelRoadPlates}
                          simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                          onToggleSimulatedPipeRupture={handleToggleSimulatedPipeRupture}
                          isS3ValveLockoutActive={isS3ValveLockoutActive}
                          onToggleS3ValveLockout={handleToggleS3ValveLockout}
                          onToggleSourceActive={toggleSourceActive}
                          onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                          onRestoreAllMachinery={handleRestoreAllMachinery}
                          virtualLeakPinPoint={virtualLeakPinPoint}
                          virtualLeakImpact={virtualLeakImpact}
                          onChangeVirtualLeakPinPoint={setVirtualLeakPinPoint}
                          onLogWaterMainObservation={handleLogWaterMainObservation}
                          simultaneousDispatch={simultaneousAlgedonic.dispatch}
                          onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
                          onOpenSimultaneousModal={handleOpenSimultaneousModal}
                          machineNoiseOutputDb={
                            isManualMachineNoiseOverrideActive
                              ? manualMachineNoiseOutputDb
                              : undefined
                          }
                        />
                      </div>
                      <div className="w-full h-full min-h-[240px] relative overflow-hidden">
                        <Ringparken3DScene
                          sources={sources}
                          receptors={receptors}
                          buildings={buildings}
                          activeCategoryFilters={activeCategoryFilters}
                          onToggleCategoryFilter={handleToggleCategoryFilter}
                          onChangeBuildingCategory={handleChangeBuildingCategory}
                          plumeZones={simulation.plumeZones}
                          receptorExposures={receptorExposures}
                          currentWeather={currentWeather}
                          observations={observations}
                          selectedSourceId={selectedSourceId}
                          selectedReceptorId={selectedReceptorId}
                          onSelectSource={(id) => setSelectedSourceId(id)}
                          onSelectReceptor={(id) => setSelectedReceptorId(id)}
                          onToggleSourceActive={toggleSourceActive}
                          isFullscreen3D={isFullscreen3D}
                          onToggleFullscreen3D={() => setIsFullscreen3D((v) => !v)}
                          isMapOnly={isMapOnlyMode}
                          onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                          precipitationOverrideMm={precipitationOverrideMm}
                          onChangePrecipitationOverride={setPrecipitationOverrideMm}
                          onSwitchTo2DPercolation={() => setViewportMode('underground_2d')}
                          asbestosHeatmapActive={asbestosHeatmapActive}
                          onToggleAsbestosHeatmap={setAsbestosHeatmapActive}
                          asbestosSourceScope={asbestosSourceScope}
                          onChangeAsbestosSourceScope={setAsbestosSourceScope}
                          asbestosEvalHeightMeters={asbestosEvalHeightMeters}
                          onChangeAsbestosEvalHeightMeters={setAsbestosEvalHeightMeters}
                          weatherHours={weatherDataset.hours}
                          temporal24hAsbestosAccumulation={temporal24hAsbestosAccumulation}
                          onToggleTemporal24hAsbestosAccumulation={
                            setTemporal24hAsbestosAccumulation
                          }
                          showLeewardWakeEffect={showLeewardWakeEffect}
                          onToggleLeewardWakeEffect={setShowLeewardWakeEffect}
                          showWeatherCorrelationOverlay={showWeatherCorrelationOverlay}
                          onToggleWeatherCorrelationOverlay={setShowWeatherCorrelationOverlay}
                          timelineSliderProgress={plumeRouteProgress}
                          show3DNeutralPressurePlane={show3DNeutralPressurePlane}
                          onToggle3DNeutralPressurePlane={setShow3DNeutralPressurePlane}
                          neutralPressurePlaneHeightMeters={neutralPressurePlaneHeightMeters}
                          onChangeNeutralPressurePlaneHeightMeters={
                            setNeutralPressurePlaneHeightMeters
                          }
                          machineNoiseOutputDb={
                            isManualMachineNoiseOverrideActive
                              ? manualMachineNoiseOutputDb
                              : undefined
                          }
                          selectedDateIso={selectedDateIso}
                          onChangeDateIso={handleChangeSimulatedDateIso}
                          onStepHour={handleStepSimulatedHour}
                          focusBlok12PercolationTrigger={focusBlok12PercolationTrigger}
                          simulationSpeedMultiplier={simulationSpeedMultiplier}
                          hiddenSourceIds={hiddenSourceIds}
                          visibleSubstances={visibleSubstances}
                          onBornehavePlumeAlertUpdate={setLive3DBornehavePlumeAlert}
                          waterMainTelemetry={waterMainTelemetry}
                          showWaterMainLayer={effectiveShowWaterMainLayer}
                          onToggleWaterMainLayer={handleToggleWaterMainLayer}
                          showLerBuffer={showLerBuffer}
                          onToggleLerBuffer={() => setShowLerBuffer((v) => !v)}
                          hasSteelRoadPlates={hasSteelRoadPlates}
                          onToggleSteelRoadPlates={() => setHasSteelRoadPlates((v) => !v)}
                          simulatedPipeRuptureActive={simulatedPipeRuptureActive}
                          onToggleSimulatedPipeRupture={() =>
                            setSimulatedPipeRuptureActive((v) => !v)
                          }
                          isS3ValveLockoutActive={isS3ValveLockoutActive}
                          onToggleS3ValveLockout={() => setIsS3ValveLockoutActive((v) => !v)}
                          onIsolateNearbyMachinery={handleIsolateNearbyMachinery}
                          onRestoreAllMachinery={handleRestoreAllMachinery}
                          virtualLeakPinPoint={virtualLeakPinPoint}
                          virtualLeakImpact={virtualLeakImpact}
                          onToggleVirtualLeakPinQuick={handleToggleVirtualLeakPinQuick}
                          simultaneousDispatch={simultaneousAlgedonic.dispatch}
                        />
                      </div>
                    </div>
                  )}

                  {viewportMode === 'risk_gis' && (
                    <div className="w-full h-full overflow-y-auto">
                      <RiskZoneMap
                        initialWindFromDeg={currentWeather.windDirection10m}
                        initialWindSpeedMs={currentWeather.windSpeed10m}
                        initialIsDryWeather={
                          (precipitationOverrideMm ?? currentWeather.precipitation) < 0.2
                        }
                      />
                    </div>
                  )}

                  {simultaneousAlgedonic.dispatch.active && !isMapOnlyMode && (
                    <div className="pointer-events-none absolute top-2 left-2 right-2 z-30 flex justify-center">
                      <div className="w-full max-w-[740px]">
                        <SimultaneousAlgedonicSplitHud
                          dispatch={simultaneousAlgedonic.dispatch}
                          audioMuted={simultaneousAlgedonic.audioMuted}
                          onToggleAudioMuted={simultaneousAlgedonic.toggleAudioMuted}
                          onAcknowledgeP1={simultaneousAlgedonic.acknowledgeP1}
                          onOpenSplitModal={() => simultaneousAlgedonic.setIsSplitModalOpen(true)}
                          onClearSimulation={handleClearSimultaneousAll}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {winId === 'wind_noise_correlation' && (
              <WindNoiseCorrelationDashboardWindow
                weatherHours={weatherDataset.hours}
                currentWeather={currentWeather}
                selectedHourIndex={selectedHourIndex}
                onSelectHour={(hr) => {
                  myceliumAlerts.notifyTimelineScrub();
                  setSelectedHourIndex(hr);
                  setPlumeRouteProgress(hr);
                }}
                sources={sources}
                observations={observations}
                puff24h={puff24h}
                manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
              />
            )}

            {winId === 'rolling_6h_wind_noise_correlation' && (
              <Rolling6hGustNoiseCorrelationWidget
                weatherHours={weatherDataset.hours}
                currentWeather={currentWeather}
                selectedHourIndex={selectedHourIndex}
                onSelectHour={(hr) => {
                  myceliumAlerts.notifyTimelineScrub();
                  setSelectedHourIndex(hr);
                  setPlumeRouteProgress(hr);
                }}
                sources={sources}
                observations={observations}
                manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
                isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
              />
            )}

            {(winId === 'substances_sumformel' ||
              winId === 'algedonic_observations' ||
              winId === 'legal_compliance' ||
              winId === 'acoustic_refraction_dashboard') && (
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded text-xs space-y-2">
                <div className="font-bold text-white">{meta.title}</div>
                <p className="text-slate-300">
                  Receptor: <strong className="text-cyan-300">{selectedReceptorExposure.receptorName}</strong> ({selectedReceptorExposure.address}) · Aktuel Sumkvotient: <strong className="text-rose-400">S = {selectedReceptorExposure.sumQuotient.toFixed(2)}</strong> · Registrerede Lovbrud: <strong className="text-amber-300">{legalViolations.length}</strong> · Algedoniske Signaler: <strong className="text-fuchsia-300">{observations.length}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => handleRestoreWindow(winId)}
                  className="px-3 py-1.5 rounded bg-cyan-500 text-slate-950 font-mono font-bold text-xs hover:bg-cyan-400"
                >
                  Fastgør &amp; åbn fuld visning i panelet →
                </button>
              </div>
            )}
          </FloatingDraggableWindow>
        );
      })}

      {/* Proactive Weather Alert High-Priority Notification Stack (24h Deviation Monitor) */}
      {proactiveWeatherAlerts.length > 0 && !isMapOnlyMode && !isFullscreen3D && (
        <aside
          data-testid="proactive-weather-alert-stack"
          aria-live="assertive"
          aria-label="Proaktive højt-prioriterede vejradvarsler"
          className="fixed top-20 right-4 z-[95] w-[390px] max-w-[calc(100vw-2rem)] flex flex-col gap-2 pointer-events-auto font-mono"
        >
          {proactiveWeatherAlerts.length > 1 && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded bg-[#1E293B]/95 border border-[#334155] text-[11px] text-slate-200 shadow-lg">
              <span className="font-bold text-amber-300">
                {proactiveWeatherAlerts.length} aktive vejrafvigelser over 24t gns.
              </span>
              <button
                type="button"
                onClick={handleAcknowledgeAllProactiveWeatherAlerts}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold cursor-pointer"
              >
                Kvittér alle
              </button>
            </div>
          )}
          {proactiveWeatherAlerts.map((alert) => {
            const isCritical = alert.priority === 'CRITICAL';
            return (
              <div
                key={alert.id}
                data-testid={`proactive-weather-alert-${alert.kind}`}
                className={`rounded-lg border p-3 shadow-2xl backdrop-blur-md space-y-1.5 text-[11px] ${
                  isCritical
                    ? 'bg-[#19121B]/95 border-rose-500/80 text-slate-100'
                    : 'bg-[#1A1C16]/95 border-amber-500/75 text-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        isCritical ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    />
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider shrink-0 ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/60'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/60'
                      }`}
                    >
                      {isCritical ? 'P1 KRITISK VEJR' : 'P2 HØJ PRIORITET'}
                    </span>
                    <span className="text-slate-400 truncate">kl. {alert.hourLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAcknowledgeProactiveWeatherAlert(alert.dedupKey)}
                    aria-label={`Kvittér ${alert.title}`}
                    className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                    title="Kvittér notifikation"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="font-bold text-xs text-white leading-snug">{alert.title}</div>
                <p className="text-slate-300 leading-relaxed">{alert.message}</p>

                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] tabular-nums">
                  <div className="rounded bg-[#0B0F19]/80 border border-[#334155] px-1.5 py-1">
                    <div className="text-slate-400 uppercase">{alert.metricLabel}</div>
                    <div className="font-bold text-white">{alert.currentValueFormatted}</div>
                  </div>
                  <div className="rounded bg-[#0B0F19]/80 border border-[#334155] px-1.5 py-1">
                    <div className="text-slate-400 uppercase">24t Gennemsnit</div>
                    <div className="font-bold text-cyan-300">{alert.average24hFormatted}</div>
                  </div>
                  <div className="rounded bg-[#0B0F19]/80 border border-[#334155] px-1.5 py-1">
                    <div className="text-slate-400 uppercase">Afvigelse</div>
                    <div
                      className={`font-bold ${
                        isCritical ? 'text-rose-300' : 'text-amber-300'
                      }`}
                    >
                      {alert.deltaFormatted}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 bg-[#0B0F19]/60 border border-[#334155]/80 rounded px-2 py-1 leading-snug">
                  <strong className="text-cyan-300">Tiltag:</strong> {alert.operationalGuidance}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('puff24h');
                      setShowWeatherCorrelationOverlay(true);
                    }}
                    className="px-2 py-0.5 rounded bg-[#1E293B] hover:bg-[#263449] border border-[#334155] text-cyan-300 font-semibold cursor-pointer"
                  >
                    Vis Spredning &amp; Vejr
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcknowledgeProactiveWeatherAlert(alert.dedupKey)}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/60 text-emerald-200 font-bold cursor-pointer"
                  >
                    Kvittér
                  </button>
                </div>
              </div>
            );
          })}
        </aside>
      )}

      {/* System B Mycelium Tactical Algedonic Toast Stack & ISA-18.2 Alarm-Log Drawer (Guaranteed Primary In-App Channel) */}
      <TacticalAlgedonicToastDrawer
        alerts={myceliumAlerts.alerts}
        activeToastAlerts={[]}
        unacknowledgedCount={myceliumAlerts.unacknowledgedCount}
        channelStatus={myceliumAlerts.channelStatus}
        isDrawerOpen={myceliumAlerts.isDrawerOpen}
        onSetDrawerOpen={myceliumAlerts.setIsDrawerOpen}
        onAcknowledgeAlert={myceliumAlerts.acknowledgeAlert}
        onAcknowledgeAll={myceliumAlerts.acknowledgeAllAlerts}
        onClearResolved={myceliumAlerts.clearResolvedAlerts}
        onToggleAudioMuted={myceliumAlerts.toggleAudioMuted}
        onRequestBrowserNotification={() => {
          void myceliumAlerts.requestBrowserNotificationSafe();
        }}
        onTriggerTestSignal={myceliumAlerts.triggerManualAlgedonicTest}
        onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
        simultaneousDispatch={simultaneousAlgedonic.dispatch}
        onOpenSimultaneousModal={() => simultaneousAlgedonic.setIsSplitModalOpen(true)}
        onAcknowledgeSimultaneousP1={simultaneousAlgedonic.acknowledgeP1}
      />

      {/* Synchronized Split-Screen Overlay Modal: Algedonisk Simultan-Simulering (System 1 + System 3) */}
      <SimultaneousAlgedonicSimulationModal
        isOpen={simultaneousAlgedonic.isSplitModalOpen}
        onClose={() => simultaneousAlgedonic.setIsSplitModalOpen(false)}
        dispatch={simultaneousAlgedonic.dispatch}
        manualScenarioOverride={simultaneousAlgedonic.manualScenarioOverride}
        audioMuted={simultaneousAlgedonic.audioMuted}
        onToggleAudioMuted={simultaneousAlgedonic.toggleAudioMuted}
        onTriggerScenario={simultaneousAlgedonic.triggerScenarioSimulation}
        onAcknowledgeP1={simultaneousAlgedonic.acknowledgeP1}
        onClearSimulation={handleClearSimultaneousAll}
        onOpenWaterMainLayer={() => {
          setShowWaterMainInSurface(true);
          simultaneousAlgedonic.setIsSplitModalOpen(false);
        }}
        onOpenSlagelseLegalDashboard={() => {
          setActiveTab('compliance');
          setComplianceSubTab('slagelse_legal_dashboard');
          simultaneousAlgedonic.setIsSplitModalOpen(false);
        }}
        onFocusEpicenter2D={() => {
          setViewportMode('2d');
          simultaneousAlgedonic.setIsSplitModalOpen(false);
        }}
      />

      {/* Forensic Report & JSON/PDF Export Modal */}
      <ForensicReportModal
        isOpen={isReportModalOpen}
        initialTab={reportModalInitialTab}
        onClose={() => setIsReportModalOpen(false)}
        weatherDataset={weatherDataset}
        simulation={simulation}
        sources={sources}
        receptors={receptors}
        observations={observations}
        isPuffMode={isPuffMode}
        sha256Hash={sha256Hash}
        groundingAnalysis={groundingAnalysis}
        groundingPlaces={groundingPlaces}
        validatePhotoEvidenceBinary={validatePhotoEvidenceBinary}
        onToggleValidatePhotoEvidenceBinary={() =>
          setValidatePhotoEvidenceBinary((prev) => !prev)
        }
      />

      {/* Modal for Valg af kilder & Receptorer */}
      <SourceReceptorSelectorModal
        isOpen={isSourceReceptorModalOpen}
        onClose={() => setIsSourceReceptorModalOpen(false)}
        sources={sources}
        receptors={receptors}
        receptorExposures={receptorExposures}
        selectedSourceId={selectedSourceId}
        selectedReceptorId={selectedReceptorId}
        onSelectSource={(id) => setSelectedSourceId(id)}
        onToggleSourceActive={toggleSourceActive}
        onSetAllSourcesActive={handleSetAllSourcesActive}
        onSelectReceptor={(id) => setSelectedReceptorId(id)}
        onTriggerAddOnMap={(mode) => setMapClickMode(mode)}
      />

      {/* Unified Rapport- & Eksport-Hub (All 23 PDF, ESDH CSV, JSON, TXT, Print & Bulk Flows) */}
      <ExportHubPopover
        isOpen={isExportHubOpen}
        onClose={() => setIsExportHubOpen(false)}
        dateIso={weatherDataset.dateIso}
        hourLabel={currentWeather.hourLabel}
        sha256Hash={sha256Hash}
        merkleRootSignature={observationChainOfCustodyLedger.merkleRootSignature}
        observationsCount={observations.length}
        observations={observations}
        validatePhotoEvidenceBinary={validatePhotoEvidenceBinary}
        onToggleValidatePhotoEvidenceBinary={() =>
          setValidatePhotoEvidenceBinary((prev) => !prev)
        }
        legalViolationsCount={legalViolations.length}
        receptors={receptors}
        exportFilter={exportFilter}
        onChangeExportFilter={handleChangeExportFilter}
        completedRangeSimulation={completedRangeSimulation}
        onOpenRangeSimDrawer={() => setIsRangeSimPanelOpen(true)}
        isBulkDownloading={isBulkDownloading}
        onDownloadForensicPdf={() => {
          const ctx = getFilteredExportContext();
          generateForensicPdfReport({
            weatherDataset,
            simulation: ctx.simulation,
            sources,
            receptors: ctx.receptors,
            observations: ctx.observations,
            isPuffMode,
            sha256Hash,
            groundingPlaces,
            exportFilterSummary: ctx.filterSummary,
            validatePhotoEvidenceBinary,
          });
        }}
        onOpenForensicReportModal={() => setIsReportModalOpen(true)}
        onExportChronologicalEvidencePdf={handleExportChronologicalEvidencePdfReport}
        onExportChainOfCustodyPdf={handleExportChainOfCustodyPdfReport}
        onDownloadPercolationPdf={() => {
          const ctx = getFilteredExportContext();
          generatePercolationPdfReport({
            dateIso: weatherDataset.dateIso,
            currentWeather,
            sources,
            receptors: ctx.receptors,
            precipitationOverrideMm,
          });
        }}
        onExportAcousticDiagramPdf={handleExportAcousticDiagramAndDbValuesPdf}
        onDownload29BuildingRegistryPdf={() => {
          const ctx = getFilteredExportContext();
          generateBuildingRegistryInspectionPdfReport({
            buildings,
            dateIso: weatherDataset.dateIso,
            hourLabel: currentWeather.hourLabel,
            sha256Hash,
            receptorExposures: ctx.receptorExposures,
          });
        }}
        onDownloadFormalSlagelseComplaintPdf={() => {
          const ctx = getFilteredExportContext();
          const baseViolations = ctx.legalViolations;
          const selectedViolations =
            selectedViolationIdsForAi.length > 0
              ? baseViolations.filter((v) => selectedViolationIdsForAi.includes(v.id))
              : baseViolations;
          exportFormalSlagelseComplaintFromState({
            format: 'pdf',
            existingSummary: municipalLegalSummary,
            violations: selectedViolations,
            dateIso: weatherDataset.dateIso,
            currentWeather,
            plumeDirectionDeg,
            maxSiteSumQuotient: ctx.maxSiteSumQuotient,
            precipitationMmH:
              precipitationOverrideMm !== null
                ? precipitationOverrideMm
                : currentWeather.precipitation,
            sha256Hash,
          });
        }}
        onDownloadFull168hDbaCatalogPdf={() => {
          const ctx = getFilteredExportContext();
          exportFull168hDbaCatalogPdfFromState({
            weatherDataset,
            selectedHourIndex,
            currentWeather,
            sources,
            receptors: ctx.receptors,
            selectedReceptorExposure,
            observations: ctx.observations,
            selectedImpulseMachineryKey,
            isManualMachineNoiseOverrideActive,
            manualMachineNoiseOutputDb,
            selectedDbaNeighborBlockKey,
            customDbaFileName,
            customDbaOffsetDb,
          });
        }}
        onDownloadRangeSupervisionPdf={downloadCombinedSupervisionPdfReport}
        onDownloadRangePercolationPdf={downloadCombinedPercolationPdfReport}
        onExportSelectedHourCsv={handleExportSelectedHourCsv}
        onExportSlagelseViolationsCsv={(delimiter) => {
          const ctx = getFilteredExportContext();
          const baseViolations = ctx.legalViolations;
          const selectedViolations =
            selectedViolationIdsForAi.length > 0
              ? baseViolations.filter((v) => selectedViolationIdsForAi.includes(v.id))
              : baseViolations;
          exportSlagelseViolationsEsdhCsv({
            violations: selectedViolations,
            dateIso: weatherDataset.dateIso,
            currentWeather,
            plumeDirectionDeg,
            sha256Hash,
            delimiter,
          });
          setShowViolationsCsvTable(true);
          setViolationsCsvExportSuccess(true);
          window.setTimeout(() => setViolationsCsvExportSuccess(false), 3800);
        }}
        onExportPdfWidgetStatsCsv={handleExportPdfWidgetStatsCsv}
        onExportDbaVsRealtimeCsv={() => {
          const ctx = getFilteredExportContext();
          exportDbaVsRealtimeSimulationCsv({
            weatherDataset,
            selectedHourIndex,
            currentWeather,
            sources,
            receptors: ctx.receptors,
            selectedReceptorExposure,
            observations: ctx.observations,
            selectedImpulseMachineryKey,
            isManualMachineNoiseOverrideActive,
            manualMachineNoiseOutputDb,
            selectedDbaNeighborBlockKey,
            customDbaFileName,
            customDbaOffsetDb,
          });
        }}
        onDownloadRangeCsv={downloadRangeSimulationCsv}
        onExportForensicAuditLogJson={handleExportForensicAuditLogJson}
        onDownloadForensicJsonReport={() =>
          downloadForensicJsonReport({
            weatherDataset,
            simulation,
            sources,
            observations,
            isPuffMode,
            sha256Hash,
            groundingPlaces,
          })
        }
        onExportSelectedDayWeatherJson={() =>
          exportOpenMeteo24hWeatherDatasetJson({
            weatherDataset,
            selectedHourIndex,
            currentWeather,
            puff24h,
            indoorClimateTelemetry,
            receptorExposures,
          })
        }
        onExportMachineWindNoiseJson={() =>
          exportMachineWindNoiseCorrelation24hJson({
            weatherDataset,
            selectedHourIndex,
            currentWeather,
            sources,
            receptors,
            selectedReceptorExposure,
            observations,
            selectedImpulseMachineryKey,
            isManualMachineNoiseOverrideActive,
            manualMachineNoiseOutputDb,
            selectedDbaNeighborBlockKey,
            customDbaFileName,
            customDbaOffsetDb,
          })
        }
        onDownloadRangeJson={downloadRangeSimulationJson}
        onDownloadLegalComplaintTxt={() => {
          const selectedViolations =
            selectedViolationIdsForAi.length > 0
              ? legalViolations.filter((v) => selectedViolationIdsForAi.includes(v.id))
              : legalViolations;
          exportFormalSlagelseComplaintFromState({
            format: 'txt',
            existingSummary: municipalLegalSummary,
            violations: selectedViolations,
            dateIso: weatherDataset.dateIso,
            currentWeather,
            plumeDirectionDeg,
            maxSiteSumQuotient,
            precipitationMmH:
              precipitationOverrideMm !== null
                ? precipitationOverrideMm
                : currentWeather.precipitation,
            sha256Hash,
          });
        }}
        onPrintPdfWidgetAppendix={() => {
          if (activeTab !== 'algedonic') {
            setActiveTab('algedonic');
            window.setTimeout(() => handlePrintPdfWidgetAppendix(), 90);
          } else {
            handlePrintPdfWidgetAppendix();
          }
        }}
        onAddAllAndBulkDownload={() => {
          void handleAddAllAndBulkDownload(completedRangeSimulation);
        }}
      />

      {/* Global Cmd+K / Ctrl+K Command Palette */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onOpen={() => setIsCommandPaletteOpen(true)}
        onClose={() => setIsCommandPaletteOpen(false)}
        buildings={buildings}
        receptors={receptors}
        activeScenarioId={activeScenarioId}
        observationsCount={observations.length}
        legalViolationsCount={legalViolations.length}
        onSelectTab={(tab) => setActiveTab(tab)}
        onSelectPuff24hTab={() => {
          setIsPuffMode(true);
          setActiveTab('puff24h');
        }}
        onSetViewportMode={(mode) => setViewportMode(mode)}
        onToggleWeatherCorrelationPopup={() =>
          setShowHeaderWeatherCorrelationPopup((prev) => !prev)
        }
        onOpenAcousticRefraction={() => setShowRibbonAcousticRefraction(true)}
        onOpenDispersionForecast={() =>
          handleSelectDispersionForecastOption('five_day_forecast')
        }
        onOpenRangeSimDrawer={() => setIsRangeSimPanelOpen(true)}
        onFocusBuilding={(b) => {
          setSelectedBuildingId(b.id);
          setActiveCategoryFilters((prev) =>
            prev.includes(b.category) ? prev : [...prev, b.category]
          );
          const meta = BUILDING_CATEGORY_METADATA[b.category];
          if (meta.actsAsSource) {
            setSelectedSourceId(getSourceIdForBuilding(b.id));
          }
          if (meta.actsAsReceptor) {
            setSelectedReceptorId(getReceptorIdForBuilding(b.id));
          }
          if (viewportMode !== '2d' && viewportMode !== '3d' && viewportMode !== 'split') {
            setViewportMode('3d');
          }
        }}
        onFocusReceptor={(rec) => {
          setSelectedReceptorId(rec.id);
          if (viewportMode !== '2d' && viewportMode !== '3d' && viewportMode !== 'split') {
            setViewportMode('2d');
          }
        }}
        onSelectLiveOpenMeteo={() => {
          void loadLiveOpenMeteo(selectedDateIso);
        }}
        onApplyWeatherScenario={(scenarioId) => handleApplyScenario(scenarioId)}
        onAddAllFindingsToEvidence={() => {
          void handleAddAllFindingsToEvidence();
        }}
        onExportChronologicalPdf={handleExportChronologicalEvidencePdfReport}
        onOpenSlagelseComplaintGenerator={() => {
          setActiveTab('compliance');
          setComplianceSubTab('slagelse_legal_dashboard');
        }}
        onOpenExportHub={() => setIsExportHubOpen(true)}
        onRestoreAllWindows={() => {
          handleRestoreAllMinimized();
          setIsMinimizeAllFocusActive(false);
          setIsSidebarMinimizeOthersActive(false);
        }}
        densityMode={densityMode}
        onToggleDensityMode={handleToggleDensityMode}
      />
    </div>
  );
}
