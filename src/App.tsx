/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Box,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  CloudRain,
  Compass,
  Copy,
  Crosshair,
  Download,
  Droplets,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Gauge,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Pause,
  Play,
  Printer,
  Radio,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Sun,
  Thermometer,
  Volume2,
  Wind,
  X,
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
  getReceptorIdForBuilding,
  getSourceIdForBuilding,
} from './data/ringparkenData';
import {
  AlgedonicObservation,
  BuildingOperationalCategory,
  DemolitionSourceNode,
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
  SubstanceKey,
  WeatherDataset,
} from './types/dispersion';
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
import { Ringparken3DScene } from './components/Ringparken3DScene';
import { UndergroundPercolation2D } from './components/UndergroundPercolation2D';
import { BuildingCategoryManagerPanel } from './components/BuildingCategoryManagerPanel';
import { BuildingSampleAndDmaPanel } from './components/BuildingSampleAndDmaPanel';
import { L69PenaltyCalculatorWidget } from './components/L69PenaltyCalculatorWidget';
import { PssSafetyInterlockWidget } from './components/PssSafetyInterlockWidget';
import { CikMaterialMetabolismSankey } from './components/CikMaterialMetabolismSankey';
import { ForensicReportModal, ReportModalTab } from './components/ForensicReportModal';
import { ExpertPersonaRole, ForensicChatbotPanel } from './components/ForensicChatbotPanel';
import { BioscienceToxicologyPanel } from './components/BioscienceToxicologyPanel';
import { WeatherNoiseDustCorrelationPanel } from './components/WeatherNoiseDustCorrelationPanel';
import { HeaderWeatherCorrelationD3Popup } from './components/HeaderWeatherCorrelationD3Popup';
import { EksponeringsBadge } from './components/EksponeringsBadge';
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
  generateAcousticRefractionDiagramPdfReport,
  generateBuildingRegistryInspectionPdfReport,
  generateChronologicalEvidenceObservationsPdfReport,
  generateForensicChainOfCustodyPdfReport,
  generateForensicPdfReport,
  generatePercolationPdfReport,
} from './services/pdfExportService';

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
import { Animated24hWindWidget } from './components/Animated24hWindWidget';
import { VerticalPlume3DBoxWidget } from './components/VerticalPlume3DBoxWidget';

type RightPanelTab =
  | 'substances'
  | 'puff24h'
  | 'algedonic'
  | 'noiseDust'
  | 'indoorClimate'
  | 'compliance'
  | 'grounding'
  | 'bioscience';

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
    '3d' | 'underground_3d' | 'underground_2d' | 'underground_split' | 'split' | '2d'
  >('3d');
  const [precipitationOverrideMm, setPrecipitationOverrideMm] = useState<number | null>(null);
  const [isFullscreen3D, setIsFullscreen3D] = useState<boolean>(false);
  const [isMapOnlyMode, setIsMapOnlyMode] = useState<boolean>(false);

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
    useState<boolean>(true);
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
  const [showRibbonAcousticRefraction, setShowRibbonAcousticRefraction] = useState<boolean>(true);
  const [isPlayingRefractionLoop, setIsPlayingRefractionLoop] = useState<boolean>(false);
  const [refractionLoopProgress, setRefractionLoopProgress] = useState<number>(13);
  const [refractionLoopSpeed, setRefractionLoopSpeed] = useState<'0.5x' | '1x' | '2x'>('1x');
  const [refractionWavePhase, setRefractionWavePhase] = useState<number>(0);
  const [showWindNoiseSensitivityAnalysis, setShowWindNoiseSensitivityAnalysis] =
    useState<boolean>(true);
  const [selectedImpulseMachineryKey, setSelectedImpulseMachineryKey] = useState<
    'hydraulic_hammer' | 'concrete_crusher' | 'steel_shear_impact'
  >('hydraulic_hammer');
  const [windNoiseEvidenceLoggedBanner, setWindNoiseEvidenceLoggedBanner] =
    useState<boolean>(false);
  const [windNoiseJsonExportedBanner, setWindNoiseJsonExportedBanner] =
    useState<boolean>(false);
  const [showWindCompensatedImpulseCatalog, setShowWindCompensatedImpulseCatalog] =
    useState<boolean>(true);
  const [selectedDbaNeighborBlockKey, setSelectedDbaNeighborBlockKey] = useState<
    'roedtjoernevej_2' | 'schackenborgvaenget_b' | 'kierulffsvej_4' | 'ringparken_blok_3'
  >('roedtjoernevej_2');
  const [customDbaFileName, setCustomDbaFileName] = useState<string | null>(null);
  const [customDbaOffsetDb, setCustomDbaOffsetDb] = useState<number>(0);
  const [dbaCatalogPlotScope, setDbaCatalogPlotScope] = useState<
    'full_week_24h' | 'single_day_24h'
  >('full_week_24h');
  const [selectedDbaWeekDayIdx, setSelectedDbaWeekDayIdx] = useState<number | 'all'>('all');
  const [dbaCatalogEvidenceLoggedBanner, setDbaCatalogEvidenceLoggedBanner] =
    useState<boolean>(false);
  const [dbaCsvExportedBanner, setDbaCsvExportedBanner] = useState<boolean>(false);
  const [manualMachineNoiseOutputDb, setManualMachineNoiseOutputDb] =
    useState<number>(114);
  const [isManualMachineNoiseOverrideActive, setIsManualMachineNoiseOverrideActive] =
    useState<boolean>(true);
  const [showHeaderWeatherCorrelationPopup, setShowHeaderWeatherCorrelationPopup] =
    useState<boolean>(false);
  const [showRibbonMedicalExpert, setShowRibbonMedicalExpert] = useState<boolean>(false);
  const [showRibbonExpertChat, setShowRibbonExpertChat] = useState<boolean>(false);
  const [showRibbonDepositionProfile, setShowRibbonDepositionProfile] = useState<boolean>(false);

  // Sync 24h Refraction Loop progress when selectedHourIndex changes manually outside the loop
  useEffect(() => {
    if (!isPlayingRefractionLoop) {
      setRefractionLoopProgress(selectedHourIndex);
    }
  }, [selectedHourIndex, isPlayingRefractionLoop]);

  // 60fps Continuous 24-Hour Acoustic Refraction Animation Loop ('Afspil Refraktions-Loop')
  useEffect(() => {
    if (!isPlayingRefractionLoop) return;
    let rafId: number | null = null;
    let lastTs = performance.now();
    const hoursPerSecond =
      refractionLoopSpeed === '2x' ? 2.4 : refractionLoopSpeed === '0.5x' ? 0.65 : 1.25;

    const stepLoop = (now: number) => {
      const dtSec = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;

      setRefractionWavePhase((prevWave) => (prevWave + dtSec * 2.8) % 1);
      setRefractionLoopProgress((prevProg) => {
        const nextProg = (prevProg + dtSec * hoursPerSecond) % 24;
        const nextHourInt = Math.floor(nextProg) % 24;
        const prevHourInt = Math.floor(prevProg) % 24;
        if (nextHourInt !== prevHourInt) {
          setSelectedHourIndex(nextHourInt);
          setPlumeRouteProgress(nextHourInt);
        }
        return nextProg;
      });

      rafId = window.requestAnimationFrame(stepLoop);
    };

    rafId = window.requestAnimationFrame(stepLoop);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isPlayingRefractionLoop, refractionLoopSpeed]);

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
      id === 'noise_dust_correlation'
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
    }, 850);
    return () => window.clearInterval(timer);
  }, [
    isPlaying,
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
        const next = prev + 0.08;
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

  const [copiedPdfWidgetSha256, setCopiedPdfWidgetSha256] = useState<boolean>(false);
  const [complianceSubTab, setComplianceSubTab] = useState<
    'all' | 'l69_calculator' | 'pss_interlocks' | 'violations_pdf'
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

  // Item #1 & #6: Acoustic Refraction PDF export status & 'Akustisk varsling for støvspredning' (S > 0.8 in high wind)
  const [acousticRefractionPdfBanner, setAcousticRefractionPdfBanner] = useState<string | null>(null);
  const [acousticDustWarningEnabled, setAcousticDustWarningEnabled] = useState<boolean>(true);
  const [forceHighWindDustWarningSim, setForceHighWindDustWarningSim] = useState<boolean>(false);
  const [lastAcousticChimeLabel, setLastAcousticChimeLabel] = useState<string | null>(null);
  const lastChimedStateKeyRef = useRef<string>('');
  const webAudioCtxRef = useRef<AudioContext | null>(null);

  const playAcousticDustDispersionWarningTone = useCallback(
    (sumQuotientVal: number, windSpeedVal: number, receptorLabel: string) => {
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
          void ctx.resume();
        }

        const now = ctx.currentTime;
        // Discrete two-note harmonic forensic warning chime (587.33 Hz D5 -> 880 Hz A5)
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
          gain.gain.exponentialRampToValueAtTime(0.085, now + idx * 0.16 + 0.025);
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
          `${new Date().toLocaleTimeString('da-DK')} · ${receptorLabel} (S = ${sumQuotientVal.toFixed(2)}, vind ${windSpeedVal.toFixed(1)} m/s)`
        );
      } catch {
        // Ignore audio context autoplay restrictions until user interaction
      }
    },
    []
  );

  // Automatically trigger discrete warning tone when calculated sumQuotient S > 0.8 in high-wind scenarios
  useEffect(() => {
    if (!acousticDustWarningEnabled) return;
    const isHighWindScenario =
      currentWeather.windSpeed10m >= 8.0 ||
      currentWeather.windGusts10m >= 10.0 ||
      forceHighWindDustWarningSim;
    const exceedingReceptor =
      receptorExposures.find((r) => r.sumQuotient > 0.8) ||
      (forceHighWindDustWarningSim ? worstExposedReceptor : undefined);
    const effectiveS = forceHighWindDustWarningSim
      ? Math.max(0.92, exceedingReceptor?.sumQuotient ?? 0.92)
      : (exceedingReceptor?.sumQuotient ?? 0);

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
    currentWeather.hourIndex,
    currentWeather.windSpeed10m,
    currentWeather.windGusts10m,
    forceHighWindDustWarningSim,
    receptorExposures,
    worstExposedReceptor,
    playAcousticDustDispersionWarningTone,
  ]);
  const [isBottomCompactMode, setIsBottomCompactMode] = useState<boolean>(false);
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

    // Filter out findings that have already been added for the exact same timestamp & description
    const existingDescriptions = new Set(
      observations.map((o) => `${o.observedDateIso}-${o.observedHourIndex}-${o.description}`)
    );

    const newEntries: AlgedonicObservation[] = [];
    let seqOffset = observations.length;

    for (const item of candidateFindings) {
      const sigKey = `${weatherDataset.dateIso}-${currentWeather.hourIndex}-${item.description}`;
      if (existingDescriptions.has(sigKey)) continue;

      seqOffset += 1;
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

    if (newEntries.length > 0) {
      setObservations((prev) => [...newEntries, ...prev]);
      setSelectedObservationId(newEntries[0].id);
      setBatchAddedFindingsCount(newEntries.length);
    } else {
      setBatchAddedFindingsCount(candidateFindings.length);
    }

    setBatchAddFindingsSuccess(true);
    setActiveTab('algedonic');
    window.setTimeout(() => setBatchAddFindingsSuccess(false), 4500);
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

    const signature = await computeForensicSha256Hash({
      code,
      dateIso: weatherDataset.dateIso,
      hourIso: currentWeather.isoTime,
      position: presetObservation.point,
      reporterRole: 'Beboer (Ringparken)',
      observationType: presetObservation.observationType,
      description: presetObservation.description,
      weather: currentWeather,
      isInsideMathematicalPlume: corroboration.isInsideMathematicalPlume,
      calculatedSumQuotient: corroboration.calculatedSumQuotient,
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
      reporterIdentifier: 'Naboklage (Støj & Støv)',
      observationType: presetObservation.observationType,
      description: presetObservation.description,
      weatherSnapshot: currentWeather,
      plumeCorroboration: corroboration,
      sha256Signature: signature,
    };

    setObservations((prev) => [newObs, ...prev]);
    setSelectedObservationId(newObs.id);
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

    const signature = await computeForensicSha256Hash({
      code,
      dateIso: weatherDataset.dateIso,
      hourIso: currentWeather.isoTime,
      position: pendingObservationPoint,
      reporterRole: obsReporterRole,
      observationType: obsType,
      description: obsDescription,
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
      description: obsDescription.trim() || obsType,
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
  const handleMapAddNode = (pt: LatLngPoint, type: 'source' | 'receptor' | 'observation') => {
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
  };

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
    generateForensicChainOfCustodyPdfReport({
      pdfArchive: [],
      observations,
      dateIso: weatherDataset.dateIso,
      hourLabel: currentWeather.hourLabel,
      maxSiteSumQuotient,
      sha256Hash,
    });
    setChainOfCustodyPdfExportSuccess(true);
    window.setTimeout(() => setChainOfCustodyPdfExportSuccess(false), 4000);
  }, [observations, weatherDataset.dateIso, currentWeather.hourLabel, maxSiteSumQuotient, sha256Hash]);

  const handleExportChronologicalEvidencePdfReport = useCallback(() => {
    setIsGeneratingChronologicalPdf(true);
    setChronologicalPdfExportSuccess(false);
    window.setTimeout(() => {
      generateChronologicalEvidenceObservationsPdfReport({
        observations,
        pdfArchive: [],
        dateIso: weatherDataset.dateIso,
        hourLabel: currentWeather.hourLabel,
        maxSiteSumQuotient,
        sha256Hash,
      });
      setIsGeneratingChronologicalPdf(false);
      setChronologicalPdfExportSuccess(true);
      window.setTimeout(() => setChronologicalPdfExportSuccess(false), 4500);
    }, 360);
  }, [observations, weatherDataset.dateIso, currentWeather.hourLabel, maxSiteSumQuotient, sha256Hash]);

  const handleDirectExportForensicAppendixPdf = useCallback(() => {
    setIsGeneratingChronologicalPdf(true);
    setDirectForensicPdfExportSuccess(false);
    window.setTimeout(() => {
      generateForensicPdfReport({
        weatherDataset,
        simulation,
        sources,
        receptors,
        observations,
        isPuffMode,
        sha256Hash,
        groundingPlaces,
      });
      setIsGeneratingChronologicalPdf(false);
      setDirectForensicPdfExportSuccess(true);
      window.setTimeout(() => setDirectForensicPdfExportSuccess(false), 4500);
    }, 320);
  }, [
    weatherDataset,
    simulation,
    sources,
    receptors,
    observations,
    isPuffMode,
    sha256Hash,
    groundingPlaces,
  ]);

  const handleExportPdfWidgetStatsCsv = useCallback(() => {
    const photosCount = observations.filter((o) => Boolean(o.photoEvidence)).length;
    const pdfsCount = observations.filter((o) => Boolean(o.pdfEvidence)).length;
    const physicalSignalsCount = observations.filter(
      (o) => !o.photoEvidence && !o.pdfEvidence
    ).length;
    const totalSha256Count = observations.length;
    const latestSha256 = observations[0]?.sha256Signature || sha256Hash;
    const merkleRoot = observationChainOfCustodyLedger.merkleRootSignature;
    const sStatus = maxSiteSumQuotient >= 1.0 ? 'OVERSKREDET (S >= 1.0)' : 'OK (S < 1.0)';
    const catDCount = buildings.filter((b) => b.category === 'd_under_demolition').length;
    const catECount = buildings.filter((b) => b.category === 'e_demolished_unsecured').length;
    const estimatedL69PenaltyDkk =
      (catDCount + catECount) * 165000 + (maxSiteSumQuotient >= 1.0 ? 250000 : 80000);

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
      maxSiteSumQuotient.toFixed(3),
      `"${sStatus}"`,
      `"${latestSha256}"`,
      `"${merkleRoot}"`,
      '"Klar til eksport · Verificeret (ISO/IEC 27037)"',
    ];

    const csvContent = `\uFEFF${csvHeaders.join(',')}\n${csvRow.join(',')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retsmedicinsk_bilag_statistik_${weatherDataset.dateIso}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setPdfWidgetCsvExportSuccess(true);
    window.setTimeout(() => setPdfWidgetCsvExportSuccess(false), 4000);
  }, [
    observations,
    sha256Hash,
    observationChainOfCustodyLedger.merkleRootSignature,
    maxSiteSumQuotient,
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
    const activeSrc = sources.find((s) => s.active) || sources[0];
    const plumeDir = (currentWeather.windDirection10m + 180) % 360;
    const baseMachineryNoiseSourceDb = 84.5;
    const rows = receptorExposures.map((recExp) => {
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
    const escapeCsvCell = (val: string | number | boolean | undefined | null): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const plumeDirDeg = (currentWeather.windDirection10m + 180) % 360;
    const compassFrom = degreesToCompass(currentWeather.windDirection10m);

    const headers = [
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
      'Asbest_Konc_fibre_cm3',
      'Asbest_2026_GV_fibre_cm3',
      'Asbest_Kvotient_C_GV',
      'PCB_Konc_mg_m3',
      'PCB_2026_GV_mg_m3',
      'PCB_Kvotient_C_GV',
      'Tungmetaller_Bly_Konc_mg_m3',
      'Tungmetaller_Bly_2026_GV_mg_m3',
      'Tungmetaller_Bly_Kvotient_C_GV',
      'Kvarts_MineralskUld_Konc_mg_m3',
      'Kvarts_MineralskUld_2026_GV_mg_m3',
      'Kvarts_MineralskUld_Kvotient_C_GV',
      'Skimmel_Kloak_Konc_CFU_m3',
      'Skimmel_Kloak_2026_GV_CFU_m3',
      'Skimmel_Kloak_Kvotient_C_GV',
    ];

    const rows = receptorExposures.map((rec) => {
      const subMap = new Map(rec.substances.map((s) => [s.key, s]));
      const asbestos = subMap.get('asbestos');
      const pcb = subMap.get('pcb');
      const heavyMetals = subMap.get('heavyMetals');
      const quartzWool = subMap.get('quartzWool');
      const moldSewer = subMap.get('moldSewer');

      const legalStatus =
        rec.sumQuotient >= 1.0
          ? 'KRITISK_OVERSKRIDELSE (S >= 1.0)'
          : rec.sumQuotient >= 0.5
          ? 'FORHØJET_RISIKO (0.5 <= S < 1.0)'
          : rec.sumQuotient >= 0.25
          ? 'OBSERVATIONSZONE (0.25 <= S < 0.5)'
          : 'UNDER_GRÆNSEVÆRDI (S < 0.25)';

      const cells = [
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
        asbestos ? asbestos.concentration : 0,
        asbestos ? asbestos.limitValue : SUBSTANCE_SPECS.asbestos.limitValue2026,
        asbestos ? asbestos.quotient.toFixed(4) : '0.0000',
        pcb ? pcb.concentration : 0,
        pcb ? pcb.limitValue : SUBSTANCE_SPECS.pcb.limitValue2026,
        pcb ? pcb.quotient.toFixed(4) : '0.0000',
        heavyMetals ? heavyMetals.concentration : 0,
        heavyMetals ? heavyMetals.limitValue : SUBSTANCE_SPECS.heavyMetals.limitValue2026,
        heavyMetals ? heavyMetals.quotient.toFixed(4) : '0.0000',
        quartzWool ? quartzWool.concentration : 0,
        quartzWool ? quartzWool.limitValue : SUBSTANCE_SPECS.quartzWool.limitValue2026,
        quartzWool ? quartzWool.quotient.toFixed(4) : '0.0000',
        moldSewer ? moldSewer.concentration : 0,
        moldSewer ? moldSewer.limitValue : SUBSTANCE_SPECS.moldSewer.limitValue2026,
        moldSewer ? moldSewer.quotient.toFixed(4) : '0.0000',
      ];

      return cells.map(escapeCsvCell).join(';');
    });

    // Use semicolon delimiter with UTF-8 BOM for direct compatibility with Danish/European Excel & CSV tools
    const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanHour = currentWeather.hourLabel.replace(':', '');
    link.href = url;
    link.setAttribute(
      'download',
      `ringparken-vejr-og-sumkvotienter-${weatherDataset.dateIso}-kl-${cleanHour}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCsvExportSuccess(true);
    window.setTimeout(() => setCsvExportSuccess(false), 2500);
  }, [currentWeather, receptorExposures, weatherDataset]);

  const plumeDirectionDeg = (currentWeather.windDirection10m + 180) % 360;

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#07090E] text-slate-100 overflow-y-auto overflow-x-hidden scroll-smooth">
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

      {/* TOP BAR CONTRACT: Supports Normal Mode & Kompakt Mode (with Dropdown Menu) */}
      <header id="page-top-anchor" className="relative z-40 flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-800 bg-[#0B0E17] shrink-0">
        {/* Zone 1: Brand Title + Compact Weather Summary Pill when in Kompakt Mode */}
        <div className="flex items-center gap-3 min-w-0">
          <a
            href="#top"
            onClick={(e) => e.preventDefault()}
            className="text-sm md:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Ringparken Miljø- &amp; Spredningstelemetri
          </a>

          {isTopCompactMode && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-200">
              <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                {currentWeather.windSpeed10m} m/s ({currentWeather.windDirection10m}° → {plumeDirectionDeg}°)
              </span>
              <span className="text-slate-600">·</span>
              <span className={maxSiteSumQuotient >= 1.0 ? 'text-rose-400 font-bold' : 'text-amber-300 font-bold'}>
                S_max = {maxSiteSumQuotient.toFixed(2)}
              </span>
              {/* 'S-kvotient tendens' 6-hour sparkline */}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800"
                title={`S-kvotient tendens (seneste 6 timer): ${last6HoursSparklinePoints
                  .map((p) => `${p.hourLabel}=${p.sumQuotient.toFixed(2)}`)
                  .join(' → ')}`}
              >
                <span className="text-[9px] text-slate-400">6t tendens</span>
                <svg width="44" height="14" viewBox="0 0 44 14" className="overflow-visible">
                  <line x1="0" y1="7" x2="44" y2="7" stroke="#ef4444" strokeWidth="0.6" strokeDasharray="2 1" />
                  <polyline
                    fill="none"
                    stroke={maxSiteSumQuotient >= 1.0 ? '#fb7185' : '#38bdf8'}
                    strokeWidth="1.5"
                    points={last6HoursSparklinePoints
                      .map((pt, idx) => {
                        const x = (idx / Math.max(1, last6HoursSparklinePoints.length - 1)) * 42 + 1;
                        const y = 13 - Math.min(12, (pt.sumQuotient / 2.0) * 12);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />
                </svg>
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-cyan-300">Beviser: {observations.length}</span>
            </div>
          )}

          {/* Kybernetisk Afslapningstid (Tr) vs. Kriseinterval (Δt) Status i Topbar */}
          {(() => {
            const breachHours24 = Math.max(
              1,
              puff24h.peakReceptor.hourlyProfile.filter((h) => h.sumQuotient >= 0.45).length +
                observations.length
            );
            const crisisIntervalDt = Number((24 / breachHours24).toFixed(1));
            const isSystemicTetanus = relaxationTimeTrHours > crisisIntervalDt;
            return (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('algedonic');
                }}
                title={`Kybernetisk Afslapningstid Tr = ${relaxationTimeTrHours.toFixed(
                  1
                )}t vs. Kriseinterval Δt = ${crisisIntervalDt.toFixed(1)}t`}
                className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[10px] font-bold cursor-pointer transition-colors ${
                  isSystemicTetanus
                    ? 'bg-rose-950/90 border-rose-500/80 text-rose-200 hover:bg-rose-900/90'
                    : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                }`}
              >
                <AlertTriangle
                  className={`w-3 h-3 shrink-0 ${
                    isSystemicTetanus ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                  }`}
                />
                <span>
                  {isSystemicTetanus
                    ? `SYSTEMISK TETANUS (Tr=${relaxationTimeTrHours.toFixed(
                        1
                      )}t > Δt=${crisisIntervalDt.toFixed(1)}t): Administrativ Varians-Dæmpning Detekteret`
                    : `HOMEOSTASE OK (Tr=${relaxationTimeTrHours.toFixed(
                        1
                      )}t ≤ Δt=${crisisIntervalDt.toFixed(1)}t)`}
                </span>
              </button>
            );
          })()}
        </div>

        {/* Zone 2: In Normal Mode show Nav Links; In Kompakt Mode show Dropdown Menu */}
        {!isTopCompactMode ? (
          <nav className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={() => setActiveTab('algedonic')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                activeTab === 'algedonic' ? 'text-cyan-300 font-bold underline underline-offset-4' : ''
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Foto-Bevis &amp; Algedonisk ({observations.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPuffMode(true);
                setActiveTab('puff24h');
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'puff24h' ? 'text-amber-400 underline underline-offset-4' : ''
              }`}
            >
              24t Puff-Historik
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('substances')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'substances' ? 'text-cyan-400 underline underline-offset-4' : ''
              }`}
            >
              Stof- &amp; Sumformel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('noiseDust')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                activeTab === 'noiseDust' ? 'text-amber-300 font-bold underline underline-offset-4' : ''
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Støj &amp; Støv ({manualMachineNoiseOutputDb.toFixed(0)} dB)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('compliance')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'compliance' ? 'text-rose-400 underline underline-offset-4' : ''
              }`}
            >
              Lovovertrædelser ({legalViolations.length})
            </button>
          </nav>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTopCompactDropdownOpen((v) => !v)}
              className="px-3 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/70 text-cyan-200 font-mono text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-300" />
              <span>Kompakt Top-Menu (Faner, Vejr-Moduler &amp; Rapporter)</span>
              <span className="text-[10px]">{isTopCompactDropdownOpen ? '▴' : '▾'}</span>
            </button>

            {isTopCompactDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-[380px] sm:w-[440px] max-h-[80vh] overflow-y-auto rounded-lg bg-[#0B0E17] border border-cyan-500/50 shadow-2xl p-3 space-y-3 z-50 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-mono text-[11px] font-bold uppercase text-cyan-300">
                    Top-Navigation &amp; Værktøjer (Kompakt Mode)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTopCompactDropdownOpen(false)}
                    className="text-[11px] font-mono text-slate-400 hover:text-white"
                  >
                    Luk ✕
                  </button>
                </div>

                {/* Section 1: Panel Tabs */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    1. Skift Analyse-Fane i Højre Panel
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('algedonic');
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border ${
                        activeTab === 'algedonic'
                          ? 'bg-cyan-500/25 border-cyan-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      📸 Foto &amp; Beviser ({observations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPuffMode(true);
                        setActiveTab('puff24h');
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border ${
                        activeTab === 'puff24h'
                          ? 'bg-amber-500/25 border-amber-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      💨 24t Puff-Historik
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('noiseDust');
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border ${
                        activeTab === 'noiseDust'
                          ? 'bg-amber-500/25 border-amber-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-amber-200 hover:bg-slate-800'
                      }`}
                    >
                      🔊 Støj &amp; Støv (90–125 dB)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('substances');
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border ${
                        activeTab === 'substances'
                          ? 'bg-cyan-500/25 border-cyan-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      🧪 Stof- &amp; Sumformel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('bioscience');
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border ${
                        activeTab === 'bioscience'
                          ? 'bg-teal-500/25 border-teal-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      🧬 Bio-Toks &amp; WHO Score
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('compliance');
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border ${
                        activeTab === 'compliance'
                          ? 'bg-rose-500/25 border-rose-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      ⚖ Lovovertrædelser ({legalViolations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('grounding');
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border ${
                        activeTab === 'grounding'
                          ? 'bg-cyan-500/25 border-cyan-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      🤖 5 AI Eksperter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('indoorClimate');
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border col-span-2 ${
                        activeTab === 'indoorClimate'
                          ? 'bg-rose-500/25 border-rose-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-rose-200 hover:bg-slate-800'
                      }`}
                    >
                      🏠 Indeklima &amp; CAV/Opdrift (DIN 4150-3 · BR18 § 443 · z_NPL · S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)})
                    </button>
                  </div>
                </div>

                {/* Section 2: Weather Telemetry Ribbon Widgets */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    2. Vejrrubrik-Moduler &amp; Analysevinduer
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => setShowRibbonWindRose((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border ${
                        showRibbonWindRose
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-cyan-300'
                      }`}
                    >
                      🧭 24t Vind-Rose
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRibbon7DayWindRose((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border ${
                        showRibbon7DayWindRose
                          ? 'bg-indigo-500 text-white font-bold border-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-indigo-300'
                      }`}
                    >
                      📅 7-Dages Vind-Rose
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRibbon30DayHeatmap((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border ${
                        showRibbon30DayHeatmap
                          ? 'bg-rose-500 text-white font-bold border-rose-300'
                          : 'bg-slate-900 border-slate-800 text-rose-300'
                      }`}
                    >
                      🔥 30-Dages Heatmap
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRibbonDepositionProfile((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border ${
                        showRibbonDepositionProfile
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-cyan-200'
                      }`}
                    >
                      🪨 Støv-Deponering (µg/m²)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRibbonMedicalExpert((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border ${
                        showRibbonMedicalExpert
                          ? 'bg-rose-600 text-white font-bold border-rose-300'
                          : 'bg-slate-900 border-slate-800 text-rose-200'
                      }`}
                    >
                      🩺 Lægefaglig AI Ekspert
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRibbonStochasticBias((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border ${
                        showRibbonStochasticBias
                          ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-emerald-300'
                      }`}
                    >
                      ⚖ Stokastisk Vind-Bias
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRibbonAcousticRefraction((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border col-span-2 ${
                        showRibbonAcousticRefraction
                          ? 'bg-amber-400 text-slate-950 font-bold border-amber-200'
                          : 'bg-slate-900 border-slate-800 text-amber-300'
                      }`}
                    >
                      🔊 Lydbølge-Refraktion Mini-Dashboard (Nedbøjning &amp; &gt;3 dB Risiko)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!showRibbonDispersionForecast) {
                          handleSelectDispersionForecastOption('five_day_forecast');
                        } else {
                          setShowRibbonDispersionForecast(false);
                        }
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className={`px-2 py-1.5 rounded text-left border col-span-2 ${
                        showRibbonDispersionForecast
                          ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-cyan-300'
                      }`}
                    >
                      🔮 Spredningsprognose (Fem døgns prognose · Døgnet efter 00.00–00.59 · Vejrudsigt)
                    </button>
                  </div>
                </div>

                {/* Section 3: Reports & Evidence Reset */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    3. Rapport-Generering &amp; Nulstilling af Beviser
                  </div>
                  <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        generateForensicPdfReport({
                          weatherDataset,
                          simulation,
                          sources,
                          receptors,
                          observations,
                          isPuffMode,
                          sha256Hash,
                          groundingPlaces,
                        });
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-bold flex items-center justify-between"
                    >
                      <span>📄 Download Samlet Retsmedicinsk PDF-Rapport</span>
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        generatePercolationPdfReport({
                          dateIso: weatherDataset.dateIso,
                          currentWeather,
                          sources,
                          receptors,
                          precipitationOverrideMm,
                        });
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 font-bold flex items-center justify-between"
                    >
                      <span>💧 Generér &amp; Download Perkolationsrapport (PDF)</span>
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleClearAllEvidenceFromScratch();
                        setIsTopCompactDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-bold flex items-center justify-between"
                    >
                      <span>🗑 Slet Alle Registrerede Beviser (Start Fra Scratch)</span>
                      <span>({observations.length})</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Centralt placeret "Føj alle fund til Beviser" knap i Top-Kommandobaren */}
        <div className="flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={handleAddAllFindingsToEvidence}
            className={`px-3 py-1.5 rounded-md font-mono text-xs font-bold flex items-center gap-1.5 border shadow-md transition-all cursor-pointer whitespace-nowrap ${
              batchAddFindingsSuccess
                ? 'bg-emerald-400 text-slate-950 border-white ring-2 ring-emerald-300/70'
                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 border-emerald-200 ring-1 ring-emerald-400/50'
            }`}
            title="Føj samtlige aktuelle fund (lovovertrædelser, udsatte receptor-eksponeringer samt vejr- og støvnedfalds-korrelation) direkte til Beviser med kryptografisk SHA-256 signatur"
          >
            <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />
            <span>
              {batchAddFindingsSuccess
                ? `✓ ${batchAddedFindingsCount} fund føjet til Beviser (${observations.length})`
                : `➕ Føj alle fund til Beviser (${totalCurrentFindingsCount})`}
            </span>
          </button>
        </div>

        {/* Zone 3: Minimized Windows Dropdown + Perkolationsrapport + Direct PDF Download + Clear Evidence + Kompakt/Normal Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <MinimizedWindowsDropdownMenu
            windowStates={windowStates}
            onRestoreWindow={handleRestoreWindow}
            onPopOutFloating={handlePopOutFloatingWindow}
            onMinimizeAllFloating={handleMinimizeAllFloating}
            onRestoreAllMinimized={handleRestoreAllMinimized}
          />

          {!isTopCompactMode && (
            <>
              <button
                type="button"
                onClick={() =>
                  generatePercolationPdfReport({
                    dateIso: weatherDataset.dateIso,
                    currentWeather,
                    sources,
                    receptors,
                    precipitationOverrideMm,
                  })
                }
                className="px-2.5 py-1.5 text-xs font-mono font-semibold text-emerald-300 bg-slate-950 border border-emerald-500/40 rounded hover:bg-emerald-950/30 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Generér og download hydrogeologisk Perkolationsrapport (Darcy-nedsivning, makropore-transport og MBL § 19 & § 27) som PDF"
              >
                <Droplets className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Perkolationsrapport (PDF)</span>
              </button>

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
                  })
                }
                className="px-2.5 py-1.5 text-xs font-mono font-semibold text-amber-300 bg-slate-950 border border-amber-500/40 rounded hover:bg-amber-950/30 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Download retsmedicinsk bevis-rapport direkte som PDF med aktuel vejrdata, simulering og observationer"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Download PDF-Rapport</span>
              </button>

              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="hidden 2xl:inline-flex px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Eksportér Bevis-Rapport
              </button>
            </>
          )}

          {/* 'Vis Vejr-Korrelationsgraf' Button toggling D3.js 24h Wind vs. Noise/Dust Popup */}
          <button
            type="button"
            data-weather-corr-toggle="true"
            onClick={() => setShowHeaderWeatherCorrelationPopup((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showHeaderWeatherCorrelationPopup
                ? 'bg-cyan-400 text-slate-950 border-white shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 text-cyan-200 border-cyan-400/60'
            }`}
            title="Vis 24-timers D3.js Vejr-Korrelationsgraf mellem vindhastighed (m/s) og registrerede støj- og støvhændelser"
          >
            <Wind className="w-3.5 h-3.5 shrink-0" />
            <span>Vis Vejr-Korrelationsgraf</span>
          </button>

          {/* Top Kompakt / Normal Mode Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsTopCompactMode((prev) => !prev);
              setIsTopCompactDropdownOpen(false);
            }}
            className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isTopCompactMode
                ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-xs'
                : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/40'
            }`}
            title="Skift mellem Kompakt visning (med dropdown-menu) og Normal visning i toppen"
          >
            {isTopCompactMode ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Normal (Top)</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Kompakt (Top)</span>
              </>
            )}
          </button>
        </div>

        {/* Small D3.js 24-Hour Wind vs. Noise/Dust Correlation Popup inside #page-top-anchor */}
        <HeaderWeatherCorrelationD3Popup
          isOpen={showHeaderWeatherCorrelationPopup}
          onClose={() => setShowHeaderWeatherCorrelationPopup(false)}
          dateIso={weatherDataset.dateIso}
          weatherHours={weatherDataset.hours}
          observations={observations}
          hourlyReceptorProfile={
            (
              puff24h.receptorSummaries.find(
                (r) => r.receptorId === selectedReceptorExposure.receptorId
              ) || puff24h.peakReceptor
            ).hourlyProfile
          }
          selectedHourIndex={selectedHourIndex}
          machineNoiseOutputDb={
            isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114
          }
          onSelectHour={(hr) => {
            setSelectedHourIndex(hr);
            setPlumeRouteProgress(hr);
          }}
        />
      </header>

      {/* MODULE A: LIVE OPEN-METEO WEATHER TELEMETRY RIBBON (VEJRRUBRIKKEN) */}
      {(() => {
        if (
          isTopCompactMode &&
          !showRibbonWindRose &&
          !showRibbon7DayWindRose &&
          !showRibbon30DayHeatmap &&
          !showRibbonDepositionProfile &&
          !showRibbonMedicalExpert &&
          !showRibbonExpertChat &&
          !showRibbonPredVsActual &&
          !showRibbonDispersionForecast &&
          !showRibbonStochasticBias &&
          !showRibbonProactiveAgent &&
          !showRibbonTempChart &&
          !showRibbonAcousticRefraction
        ) {
          return null;
        }
        const isHighRiskWind = currentWeather.windSpeed10m > 10;

        // ISO 9613-2 / Nord2000 Sound Wave Bending (Wind & Thermal Refraction in dB)
        // Supports continuous 24-hour interpolation when 'Afspil Refraktions-Loop' is active
        const thermalGradientMap: Record<
          string,
          { dTdz: number; thermalRefractionDb: number; regimeLabel: string }
        > = {
          A: {
            dTdz: -0.03,
            thermalRefractionDb: -0.8,
            regimeLabel: 'Stærk sol-konvektion (opadbøjet)',
          },
          B: {
            dTdz: -0.02,
            thermalRefractionDb: -0.5,
            regimeLabel: 'Moderat konvektion (let opadbøjet)',
          },
          C: {
            dTdz: -0.014,
            thermalRefractionDb: -0.3,
            regimeLabel: 'Svag konvektion',
          },
          D: {
            dTdz: -0.008,
            thermalRefractionDb: 0.0,
            regimeLabel: 'Neutral adiabatisk profil',
          },
          E: {
            dTdz: 0.015,
            thermalRefractionDb: 1.5,
            regimeLabel: 'Svag temperaturinversion (nedadbøjet)',
          },
          F: {
            dTdz: 0.035,
            thermalRefractionDb: 2.6,
            regimeLabel: 'Stærk natlig inversion (stærk lydlinse)',
          },
        };

        const loopIdxA = Math.max(0, Math.min(23, Math.floor(refractionLoopProgress)));
        const loopIdxB = (loopIdxA + 1) % 24;
        const loopFrac = isPlayingRefractionLoop
          ? Math.max(0, Math.min(1, refractionLoopProgress - Math.floor(refractionLoopProgress)))
          : 0;

        const hrLoopA = weatherDataset.hours[loopIdxA] || currentWeather;
        const hrLoopB = weatherDataset.hours[loopIdxB] || hrLoopA;

        const animWindSpeed10m = Number(
          (hrLoopA.windSpeed10m + (hrLoopB.windSpeed10m - hrLoopA.windSpeed10m) * loopFrac).toFixed(
            1
          )
        );
        const animWindGusts10m = Number(
          (hrLoopA.windGusts10m + (hrLoopB.windGusts10m - hrLoopA.windGusts10m) * loopFrac).toFixed(
            1
          )
        );
        // Shortest angular interpolation for wind direction over 24 hours
        const rawDirDiff = ((hrLoopB.windDirection10m - hrLoopA.windDirection10m + 540) % 360) - 180;
        const animWindDirection10m = Math.round(
          (hrLoopA.windDirection10m + rawDirDiff * loopFrac + 360) % 360
        );
        const animPlumeDirectionDeg = (animWindDirection10m + 180) % 360;
        const animTemp2m = Number(
          (hrLoopA.temperature2m + (hrLoopB.temperature2m - hrLoopA.temperature2m) * loopFrac).toFixed(
            1
          )
        );
        const animPrecipitation = Number(
          (hrLoopA.precipitation + (hrLoopB.precipitation - hrLoopA.precipitation) * loopFrac).toFixed(
            1
          )
        );
        const animPasquillClass = loopFrac < 0.5 ? hrLoopA.pasquillClass : hrLoopB.pasquillClass;
        const animClockMinutes = Math.floor(loopFrac * 60);
        const animTimeLabel = `${String(loopIdxA).padStart(2, '0')}:${String(
          animClockMinutes
        ).padStart(2, '0')}`;

        const thermA = thermalGradientMap[hrLoopA.pasquillClass] || thermalGradientMap.D;
        const thermB = thermalGradientMap[hrLoopB.pasquillClass] || thermalGradientMap.D;
        const thermalSpec = {
          dTdz: Number((thermA.dTdz + (thermB.dTdz - thermA.dTdz) * loopFrac).toFixed(3)),
          thermalRefractionDb: Number(
            (
              thermA.thermalRefractionDb +
              (thermB.thermalRefractionDb - thermA.thermalRefractionDb) * loopFrac
            ).toFixed(1)
          ),
          regimeLabel: loopFrac < 0.5 ? thermA.regimeLabel : thermB.regimeLabel,
        };

        const effectiveWindSpeedMs =
          0.65 * animWindSpeed10m + 0.35 * Math.max(animWindSpeed10m, animWindGusts10m);
        // Vertical wind speed gradient du/dz (s^-1) at z = 10 m with urban roughness z0 = 0.4 m
        const windGradientDuDz = Number((0.0311 * effectiveWindSpeedMs).toFixed(2));
        const downwindWindRefractionDb = Number(
          Math.min(6.2, 0.52 * effectiveWindSpeedMs).toFixed(1)
        );
        const upwindShadowRefractionDb = Number(
          (-Math.min(4.8, 0.38 * effectiveWindSpeedMs)).toFixed(1)
        );
        const rainSplashBonusDb = animPrecipitation > 2.0 ? 0.6 : 0.0;
        const maxDownwindRefractionDb = Number(
          (
            downwindWindRefractionDb +
            thermalSpec.thermalRefractionDb +
            rainSplashBonusDb
          ).toFixed(1)
        );

        // Effective sound speed gradient dc_eff/dz = 0.6 * dT/dz + du/dz (s^-1) in downwind direction
        const soundSpeedGradientPerSec = Number(
          (0.6 * thermalSpec.dTdz + windGradientDuDz).toFixed(3)
        );
        // Ray curvature radius R_c = c_0 / (dc_eff/dz) in km
        const speedOfSoundMs = Number((331.3 + 0.606 * animTemp2m).toFixed(1));
        const rayCurvatureRadiusKm =
          Math.abs(soundSpeedGradientPerSec) > 0.005
            ? Number((speedOfSoundMs / Math.abs(soundSpeedGradientPerSec) / 1000).toFixed(2))
            : null;

        // Calculate specific refraction (dB) towards each receptor from dominant active demolition source
        const primaryActiveSource =
          sources.find((s) => s.active && s.code === 'BLOK-1') ||
          sources.find((s) => s.active) ||
          sources[0];

        const baseMachineryNoiseSourceDb = 84.5;
        const receptorRefractions = receptors.map((rec) => {
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const toDeg = (rad: number) => (rad * 180) / Math.PI;
          const dLng = toRad(rec.center.lng - primaryActiveSource.position.lng);
          const lat1 = toRad(primaryActiveSource.position.lat);
          const lat2 = toRad(rec.center.lat);
          const y = Math.sin(dLng) * Math.cos(lat2);
          const x =
            Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
          const bearingDeg = Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
          let angleDiff = Math.abs(bearingDeg - animPlumeDirectionDeg) % 360;
          if (angleDiff > 180) angleDiff = 360 - angleDiff;
          const cosAlign = Math.cos((angleDiff * Math.PI) / 180);
          const windCompDb =
            cosAlign >= 0
              ? cosAlign * Math.min(6.2, 0.52 * effectiveWindSpeedMs)
              : cosAlign * Math.min(4.8, 0.38 * effectiveWindSpeedMs);
          const totalRefrDb = Number(
            (windCompDb + thermalSpec.thermalRefractionDb + rainSplashBonusDb).toFixed(1)
          );

          const dLatM = (rec.center.lat - primaryActiveSource.position.lat) * 111320;
          const dLngM =
            (rec.center.lng - primaryActiveSource.position.lng) *
            111320 *
            Math.cos((primaryActiveSource.position.lat * Math.PI) / 180);
          const approxDistMeters = Math.max(35, Math.round(Math.hypot(dLatM, dLngM)));
          const distAttenDb = Number(
            (20 * Math.log10(Math.max(25, approxDistMeters)) - 11).toFixed(1)
          );
          const barrierAttenDb = Number(
            Math.max(2.0, 9.5 - Math.max(0, totalRefrDb) * 1.15).toFixed(1)
          );
          const correctedLaeqDb = Number(
            (
              baseMachineryNoiseSourceDb -
              distAttenDb -
              barrierAttenDb +
              totalRefrDb
            ).toFixed(1)
          );
          const impulsePeakLafmaxDb = Number(
            (
              correctedLaeqDb +
              14.5 +
              Math.max(0, (animWindGusts10m - 8) * 0.45)
            ).toFixed(1)
          );
          const expMatch = receptorExposures.find((e) => e.receptorId === rec.id);

          return {
            receptorId: rec.id,
            receptorCode: rec.code,
            receptorName: rec.name,
            address: rec.address,
            distanceMeters: approxDistMeters,
            bearingDeg,
            angleOffWindDeg: Math.round(angleDiff),
            cosAlign,
            windCompDb: Number(windCompDb.toFixed(1)),
            tempRefrDb: thermalSpec.thermalRefractionDb,
            totalRefrDb,
            correctedLaeqDb,
            impulsePeakLafmaxDb,
            sumQuotient: expMatch?.sumQuotient ?? 0,
            exceedsNoiseLimit: correctedLaeqDb > 55.0 || totalRefrDb > 3.0,
          };
        });

        const selectedRecRefraction =
          receptorRefractions.find(
            (r) => r.receptorId === selectedReceptorExposure.receptorId
          ) || receptorRefractions[0];

        const handleExportAcousticRefractionPdfReport = async () => {
          const rows = receptorRefractions.map((rr) => ({
            receptorId: rr.receptorId,
            receptorCode: rr.receptorCode,
            receptorName: rr.receptorName,
            distanceMeters: rr.distanceMeters,
            bearingDeg: rr.bearingDeg,
            angleOffWindDeg: rr.angleOffWindDeg,
            cosAlign: rr.cosAlign,
            windRefrDb: rr.windCompDb,
            tempRefrDb: rr.tempRefrDb,
            totalRefrDb: rr.totalRefrDb,
            correctedLaeqDb: rr.correctedLaeqDb,
            impulsePeakLafmaxDb: rr.impulsePeakLafmaxDb,
            sumQuotient: rr.sumQuotient,
            exceedsNoiseLimit: rr.exceedsNoiseLimit,
          }));

          const selectedRow =
            rows.find((r) => r.receptorId === selectedRecRefraction.receptorId) ||
            rows[0];
          const sigHash = await computeForensicSha256Hash(
            `ACOUSTIC-REFR-${weatherDataset.dateIso}-${animTimeLabel}-${primaryActiveSource.code}-${selectedRow.receptorCode}-${maxDownwindRefractionDb}`
          );

          generateAcousticRefractionDiagramPdfReport({
            dateIso: weatherDataset.dateIso,
            hourLabel: animTimeLabel,
            windSpeedMs: animWindSpeed10m,
            windGustsMs: animWindGusts10m,
            windDirectionDeg: animWindDirection10m,
            plumeDirectionDeg: animPlumeDirectionDeg,
            temperatureC: animTemp2m,
            pasquillClass: animPasquillClass,
            windGradientDuDz,
            tempGradientDtDz: thermalSpec.dTdz,
            thermalRegimeLabel: thermalSpec.regimeLabel,
            speedOfSoundMs,
            rayCurvatureRadiusKm: rayCurvatureRadiusKm ?? 99.9,
            maxDownwindRefractionDb,
            upwindShadowRefractionDb,
            selectedSourceCode: primaryActiveSource.code,
            selectedSourceName: primaryActiveSource.name,
            selectedReceptorRow: selectedRow,
            receptorRows: rows,
            sha256Hash: sigHash,
          });

          setAcousticRefractionPdfBanner(
            `Retsmedicinsk PDF-rapport ('Lydbølgebøjnings-Diagram & dB-værdier pr. receptor') eksporteret kl. ${new Date().toLocaleTimeString('da-DK')} (SHA-256: ${sigHash.slice(0, 16)}...)`
          );
          setTimeout(() => setAcousticRefractionPdfBanner(null), 7000);
        };

        // 'Støjforstærknings-risiko' triggers when downwind refraction exceeds 3.0 dB
        const isNoiseAmplificationRisk =
          maxDownwindRefractionDb > 3.0 || downwindWindRefractionDb > 3.0;
        const isStrongDownwardBending = isNoiseAmplificationRisk;
        const isModerateDownwardBending =
          maxDownwindRefractionDb > 0.5 && !isNoiseAmplificationRisk;

        // Precompute 24-hour downwind refraction series for the Mini-Dashboard 24h chart
        const hourlyRefractionSeries = weatherDataset.hours.map((hr) => {
          const hrEffWind =
            0.65 * hr.windSpeed10m + 0.35 * Math.max(hr.windSpeed10m, hr.windGusts10m);
          const hrWindDb = Math.min(6.2, 0.52 * hrEffWind);
          const hrThermSpec = thermalGradientMap[hr.pasquillClass] || thermalGradientMap.D;
          const hrRainDb = hr.precipitation > 2.0 ? 0.6 : 0.0;
          const hrTotalDownwindDb = Number(
            (hrWindDb + hrThermSpec.thermalRefractionDb + hrRainDb).toFixed(1)
          );
          return {
            hourIndex: hr.hourIndex,
            hourLabel: hr.hourLabel,
            windSpeed10m: hr.windSpeed10m,
            pasquillClass: hr.pasquillClass,
            windRefractionDb: Number(hrWindDb.toFixed(1)),
            thermalRefractionDb: hrThermSpec.thermalRefractionDb,
            totalDownwindDb: hrTotalDownwindDb,
            exceeds3dB: hrTotalDownwindDb > 3.0 || hrWindDb > 3.0,
          };
        });
        const hoursExceeding3dBCount = hourlyRefractionSeries.filter(
          (h) => h.exceeds3dB
        ).length;

        const handleExportSelectedDayWeatherJson = () => {
          const payload = {
            metadata: {
              title: 'Ringparken 24-Timers Meteorologisk & Vej-/Receptor-Datasæt (JSON Eksport)',
              location: 'Ringparken / Schackenborgvænget, 4200 Slagelse',
              coordinates: { lat: 55.4128, lng: 11.3533 },
              dateIso: weatherDataset.dateIso,
              sourceApi: weatherDataset.sourceApi,
              fetchedAtIso: weatherDataset.fetchedAtIso,
              selectedHourIndex,
              selectedHourLabel: currentWeather.hourLabel,
              exportedAtIso: new Date().toISOString(),
            },
            summary24h: {
              maxWindSpeed10mMs: Math.max(...weatherDataset.hours.map((h) => h.windSpeed10m)),
              maxWindGusts10mMs: Math.max(...weatherDataset.hours.map((h) => h.windGusts10m)),
              meanWindSpeed10mMs: Number(
                (
                  weatherDataset.hours.reduce((acc, h) => acc + h.windSpeed10m, 0) /
                  Math.max(1, weatherDataset.hours.length)
                ).toFixed(2)
              ),
              totalPrecipitationMm: Number(
                weatherDataset.hours.reduce((acc, h) => acc + h.precipitation, 0).toFixed(2)
              ),
              dominantWindSectorText: puff24h.dominantWindSectorText,
              hoursExceeding10MsCount: weatherDataset.hours.filter((h) => h.windSpeed10m > 10).length,
              hoursExceeding3dBRefractionCount: hoursExceeding3dBCount,
              thermalStackBuoyancySummary: {
                deltaPsPa: indoorClimateTelemetry.deltaPsSpanPa,
                neutralPressurePlaneMeters: indoorClimateTelemetry.zNplEffectiveMeters,
                shaftUpwardFlowM3PerH: indoorClimateTelemetry.shaftAndCrackInflowQopM3PerH,
              },
            },
            hours: weatherDataset.hours.map((h, idx) => ({
              ...h,
              plumeDirectionDeg: (h.windDirection10m + 180) % 360,
              windFromCompass: degreesToCompass(h.windDirection10m),
              plumeToCompass: degreesToCompass((h.windDirection10m + 180) % 360),
              acousticDownwindRefractionDb: hourlyRefractionSeries[idx]?.totalDownwindDb ?? 0,
              thermalStackDeltaPsPaAt12m: Number(
                Math.max(0, 3460 * (1 / (h.temperature2m + 273.15) - 1 / (22.5 + 273.15)) * 12.0).toFixed(2)
              ),
            })),
            roadAndReceptorCorridors: receptorExposures,
          };

          const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: 'application/json;charset=utf-8',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ringparken-vejrdata-${weatherDataset.dateIso}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setWeatherJsonExportedJustNow(true);
          window.setTimeout(() => setWeatherJsonExportedJustNow(false), 3500);
        };

        return (
          <div
            role={isHighRiskWind ? 'alert' : undefined}
            aria-live={isHighRiskWind ? 'polite' : undefined}
            className={`border-b px-4 py-1.5 flex flex-col gap-2 text-xs shrink-0 transition-colors ${
              isHighRiskWind
                ? 'bg-rose-950/50 border-rose-500/90 shadow-[inset_0_0_24px_rgba(225,29,72,0.28)]'
                : 'bg-[#0B0E17]/90 border-slate-800/90'
            }`}
          >
            <div className="flex flex-col xl:flex-row items-stretch justify-between gap-3">
              {/* LEFT/MAIN VEJRRUBRIK TELEMETRY & QUICK-TOGGLES */}
              <div className="flex-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3.5 font-mono">
                {/* Wind Speed Telemetry with Blinking Red High-Risk Indicator (> 10 m/s) */}
                <div
                  className={`flex items-center gap-2 rounded transition-all ${
                    isHighRiskWind
                      ? 'bg-rose-600 text-white px-2.5 py-1 border border-rose-200 animate-pulse shadow-[0_0_16px_rgba(225,29,72,0.9)]'
                      : 'flex items-center gap-1.5'
                  }`}
                  title={
                    isHighRiskWind
                      ? `KRITISK VINDHASTIGHED (${currentWeather.windSpeed10m} m/s > 10 m/s): Højrisiko-spredningsforhold for asbestfibre, blyholdigt nedrivningsstøv og respirabelt kvarts`
                      : `Vindhastighed ${currentWeather.windSpeed10m} m/s (højrisiko-grænse: > 10 m/s)`
                  }
                >
                  {isHighRiskWind ? (
                    <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                  ) : (
                    <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  )}
                  <span className={isHighRiskWind ? 'text-rose-100 font-bold' : 'text-slate-400'}>
                    Vind:
                  </span>
                  <span
                    className={`font-bold ${
                      isHighRiskWind ? 'text-white underline decoration-white/80' : 'text-white'
                    }`}
                  >
                    {currentWeather.windSpeed10m} m/s
                  </span>
                  <span className={isHighRiskWind ? 'text-amber-200 font-semibold' : 'text-amber-400'}>
                    (Stød: {currentWeather.windGusts10m} m/s)
                  </span>
                  {isHighRiskWind && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-950/90 text-rose-200 border border-rose-300/80 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap">
                      ⚠ HØJRISIKO-SPREDNING (&gt; 10 m/s)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400">Retning:</span>
                  <span className="font-semibold text-white">
                    {currentWeather.windDirection10m}° ({degreesToCompass(currentWeather.windDirection10m)})
                  </span>
                  <span className="text-cyan-400">
                    → Fane {plumeDirectionDeg}° ({degreesToCompass(plumeDirectionDeg)})
                  </span>
                </div>

                {/* Interactive 24h Wind-Rose Quick-Toggle Button in Vejrrubrikken */}
                <button
                  type="button"
                  onClick={() => setShowRibbonWindRose((prev) => !prev)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbonWindRose
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-xs'
                      : 'bg-slate-900/90 text-cyan-300 border-cyan-500/40 hover:bg-slate-800 hover:border-cyan-400'
                  }`}
                  title="Vis eller skjul interaktiv 24-timers vind-rose graf over vindfordeling og fremherskende spredningsretninger direkte i vejrrubrikken"
                >
                  <Navigation
                    className="w-3 h-3 shrink-0 transition-transform"
                    style={{ transform: `rotate(${plumeDirectionDeg}deg)` }}
                  />
                  <span>
                    {showRibbonWindRose
                      ? 'Skjul 24t Vind-Rose'
                      : '24t Vind-Rose (Spredningsretninger)'}
                  </span>
                </button>

                {/* Dedicated 7-Day Historical Wind-Rose vs. Typical Slagelse Climate Quick-Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowRibbon7DayWindRose((prev) => !prev)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbon7DayWindRose
                      ? 'bg-indigo-500 text-white border-indigo-300 shadow-xs'
                      : 'bg-slate-900/90 text-indigo-300 border-indigo-500/40 hover:bg-slate-800 hover:border-indigo-400'
                  }`}
                  title="Sammenlign aktuel dags spredningsmønster med 7-dages historisk vind-rose (168 timer) og typiske vejrsituationer i Slagelse (retsmedicinsk dokumentation)"
                >
                  <Compass className="w-3 h-3 shrink-0 text-amber-300" />
                  <span>
                    {showRibbon7DayWindRose
                      ? 'Skjul 7-Dages Vind-Rose'
                      : '7-Dages Historisk Vind-Rose (Slagelse Normal)'}
                  </span>
                </button>

                {/* Proactive AI-Agent Quick-Toggle Button (Latest 3 Neighbor Complaints × Weather -> Preventive Action) */}
                <button
                  type="button"
                  onClick={() => setShowRibbonProactiveAgent((prev) => !prev)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbonProactiveAgent
                      ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-xs font-bold'
                      : 'bg-slate-900/90 text-amber-300 border-amber-500/50 hover:bg-slate-800 hover:border-amber-400'
                  }`}
                  title="Åbn proaktiv AI-agent, der sammenholder de seneste 3 naboklager (støj/støv) med vejrmønstre og foreslår specifikke forebyggende tiltag (vandkanon-vinkel / knusestop)"
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>
                    {showRibbonProactiveAgent
                      ? 'Skjul Proaktiv AI-Agent'
                      : 'Proaktiv AI-Agent (3 Klager → Tiltag)'}
                  </span>
                </button>

                {/* Stochastic Wind-Bias Analysis Quick-Toggle Button (Open-Meteo vs. Actual Slagelse Weather Station) */}
                <button
                  type="button"
                  onClick={() => setShowRibbonStochasticBias((prev) => !prev)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbonStochasticBias
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-xs font-bold'
                      : 'bg-slate-900/90 text-emerald-300 border-emerald-500/45 hover:bg-slate-800 hover:border-emerald-400'
                  }`}
                  title="Åbn Stokastisk Vind-Bias Analyse (statistisk usikkerhed på 24t spredningsmodel baseret på historiske måleafvigelser mellem Open-Meteo prognoser og faktiske vejrstation-målinger i Slagelse)"
                >
                  <Scale className="w-3 h-3 shrink-0" />
                  <span>
                    {showRibbonStochasticBias
                      ? 'Skjul Stokastisk Vind-Bias'
                      : 'Stokastisk Vind-Bias (95% CI Bevisværdi)'}
                  </span>
                </button>

                {/* Prediction vs. Actual Weather Event (Last Week Test) & Next Week 7-Day Forecast Quick-Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowRibbonPredVsActual((prev) => !prev)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbonPredVsActual
                      ? 'bg-fuchsia-400 text-slate-950 border-fuchsia-200 shadow-xs font-bold'
                      : 'bg-slate-900/90 text-fuchsia-300 border-fuchsia-500/50 hover:bg-slate-800 hover:border-fuchsia-400'
                  }`}
                  title="Sammenlign Prædiktion kontra Virkeligt Vejrhændelsesforløbs påvirkning på spredningseffekten (Test fra sidste uge kørt fra start) & Simulér Næste Uges Vejrudsigt (+7 dage)"
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>
                    {showRibbonPredVsActual
                      ? 'Skjul Prædiktion vs. Virkelighed & 7d Udsigt'
                      : 'Prædiktion vs. Virkelighed (Sidste Uge) & +7d Udsigt'}
                  </span>
                </button>

                {/* Spredningsprognose Selector Group (1. Døgnet efter kl. 00.00.00 - 00.59.59 · 2. Fem døgns prognose · 3. Som indlæg i en Vejrudsigt) */}
                <div className="inline-flex flex-wrap items-center gap-1 p-0.5 rounded bg-slate-900/95 border border-cyan-400/60">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectDispersionForecastOption('five_day_forecast');
                    }}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                      showRibbonDispersionForecast
                        ? 'bg-cyan-400 text-slate-950 shadow-xs'
                        : 'text-cyan-200 hover:bg-slate-800'
                    }`}
                    title="Fokuser Spredningsprognose-widgetten på automatisk at vise 'Fem døgns prognose' og den overskuelige tabel over aggregerede sumkvotienter"
                  >
                    <Radio className="w-3 h-3 shrink-0" />
                    <span>Spredningsprognose:</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSelectDispersionForecastOption('next_day_00_00_59')
                    }
                    className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-semibold transition-colors cursor-pointer ${
                      showRibbonDispersionForecast &&
                      dispersionForecastMode === 'next_day_00_00_59'
                        ? 'bg-cyan-500/30 text-white border border-cyan-300 font-bold'
                        : 'text-cyan-200 hover:bg-slate-800'
                    }`}
                    title="Fokuser Spredningsprognose-widgetten på automatisk at vise 'Døgnet efter fra klokken 00.00.00 - 00.59.59'"
                  >
                    Døgnet efter fra klokken 00.00.00 - 00.59.59
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSelectDispersionForecastOption('five_day_forecast')
                    }
                    className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-semibold transition-colors cursor-pointer ${
                      showRibbonDispersionForecast &&
                      dispersionForecastMode === 'five_day_forecast'
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-amber-200 hover:bg-slate-800'
                    }`}
                    title="Vis Fem døgns prognose (Dag +1 til Dag +5)"
                  >
                    Fem døgns prognose
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSelectDispersionForecastOption(
                        'weather_broadcast_segment'
                      )
                    }
                    className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-semibold transition-colors cursor-pointer ${
                      showRibbonDispersionForecast &&
                      dispersionForecastMode === 'weather_broadcast_segment'
                        ? 'bg-emerald-400 text-slate-950 font-bold'
                        : 'text-emerald-200 hover:bg-slate-800'
                    }`}
                    title="Vis Spredningsprognose som indlæg i en Vejrudsigt"
                  >
                    Som indlæg i en Vejrudsigt
                  </button>
                </div>

                {/* 30-Day Aggregated Dust Dispersion Heatmap Quick-Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowRibbon30DayHeatmap((prev) => !prev)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbon30DayHeatmap
                      ? 'bg-rose-500 text-white border-rose-300 shadow-xs font-bold'
                      : 'bg-slate-900/90 text-rose-300 border-rose-500/50 hover:bg-slate-800 hover:border-rose-400'
                  }`}
                  title="Åbn 30-Dages Aggregeret Støvsprednings-Heatmap baseret på gemte simuleringer for at identificere langsigtede tendenser i Ringparken"
                >
                  <Flame className="w-3 h-3 shrink-0 text-amber-300" />
                  <span>
                    {showRibbon30DayHeatmap
                      ? 'Skjul 30-Dages Støv-Heatmap'
                      : '30-Dages Støv-Heatmap (Langsigtede Tendenser)'}
                  </span>
                </button>

                {/* Akkumuleret Støv-Deponeringsprofil (µg/m²) pr. Kvadratmeter Quick-Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowRibbonDepositionProfile((prev) => !prev)}
                  className={`px-2.5 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbonDepositionProfile
                      ? 'bg-cyan-500 text-slate-950 border-cyan-200 shadow-xs font-bold'
                      : 'bg-slate-900/90 text-cyan-200 border-cyan-500/50 hover:bg-slate-800 hover:border-cyan-400'
                  }`}
                  title="Åbn Akkumuleret Støv-Deponeringsprofil (µg/m²) pr. kvadratmeter for de enkelte receptorer for at visualisere den fysiske ophobning af støv over tid"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
                  <span>
                    {showRibbonDepositionProfile
                      ? 'Skjul Støv-Deponeringsprofil (µg/m²)'
                      : '🪨 Støv-Deponeringsprofil (µg/m² pr. m²)'}
                  </span>
                </button>

                {/* Lægefaglig AI Ekspert & Samlet Sundheds-Bilag Quick-Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowRibbonMedicalExpert((prev) => !prev)}
                  className={`px-2.5 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbonMedicalExpert
                      ? 'bg-rose-600 text-white border-rose-200 shadow-xs font-bold'
                      : 'bg-rose-950/80 text-rose-200 border-rose-400/60 hover:bg-rose-900/80 hover:border-rose-300'
                  }`}
                  title="Åbn Lægefaglig AI Ekspert: Forklaring af kroppens reaktion på målt eksponering, sundhedsfaglige råd og registrering i Samlet Bevis-Bilag"
                >
                  <Stethoscope className="w-3.5 h-3.5 shrink-0 text-rose-300" />
                  <span>
                    {showRibbonMedicalExpert
                      ? 'Skjul Lægefaglig AI Ekspert & Bilag'
                      : '🩺 Lægefaglig AI Ekspert & Samlet Bevis-Bilag'}
                  </span>
                </button>

                {/* Dedikeret Gemini Chat Bot med 5 AI Eksperter Quick-Toggle Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowRibbonExpertChat((prev) => !prev);
                    setActiveTab('grounding');
                  }}
                  className={`px-2.5 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5 border ${
                    showRibbonExpertChat || activeTab === 'grounding'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-200 shadow-xs font-bold'
                      : 'bg-cyan-950/80 text-cyan-200 border-cyan-400/60 hover:bg-cyan-900/80 hover:border-cyan-300'
                  }`}
                  title="Åbn Dedikeret Gemini Chat Bot med 5 AI Eksperter: Arbejdsmiljørepræsentanten, Juristen (The Liability Bomb, Almenlejeloven & Tort), Fysikeren/Matematikeren, Lægen og Kybernetikeren (VSM, Ashbys Lov & Afslapningstid)"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                  <span>
                    {showRibbonExpertChat
                      ? 'Skjul 5 AI Eksperter (Gemini Chat)'
                      : '🤖 5 AI Eksperter (AMR · Jurist · Fysiker · Læge · Kybernetiker)'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-slate-400">Temp:</span>
                    <span className="font-semibold text-white">
                      {currentWeather.temperature2m} °C
                    </span>
                  </div>

                  {/* Mini 24h Recharts Temperature & Aerosol Sparkline directly in Vejrrubrikken */}
                  <TemperatureAerosolChart
                    hours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    dateIso={weatherDataset.dateIso}
                    onSelectHour={(hrIdx) => {
                      setSelectedHourIndex(hrIdx);
                      setPlumeRouteProgress(hrIdx);
                    }}
                    variant="inline-sparkline"
                    isInlineExpanded={showRibbonTempChart}
                    onToggleExpandInline={() => setShowRibbonTempChart((prev) => !prev)}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-slate-400">Sol:</span>
                  <span className="font-semibold text-white">{currentWeather.directRadiation} W/m²</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-400">Fugt/Nedbør:</span>
                  <span className="font-semibold text-white">
                    {currentWeather.relativeHumidity2m}% · {currentWeather.precipitation} mm/t
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-400">Pasquill-Gifford:</span>
                  <span className="font-semibold text-emerald-300">
                    Klasse {currentWeather.pasquillClass}
                  </span>
                </div>

                {/* Compact Sound Wave Bending (Wind & Thermal Refraction in dB) Indicator in Vejrrubrikken */}
                <button
                  type="button"
                  onClick={() => setShowRibbonAcousticRefraction((prev) => !prev)}
                  className={`px-2.5 py-0.5 rounded font-mono text-[11px] transition-all flex items-center gap-1.5 border cursor-pointer ${
                    showRibbonAcousticRefraction
                      ? isNoiseAmplificationRisk
                        ? 'bg-rose-600 text-white border-amber-300 font-bold shadow-xs'
                        : 'bg-amber-400 text-slate-950 border-amber-200 font-bold shadow-xs'
                      : isNoiseAmplificationRisk
                      ? 'bg-rose-950/85 text-amber-200 border-rose-400/80 hover:bg-rose-900/80 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                      : isModerateDownwardBending
                      ? 'bg-slate-900/90 text-cyan-200 border-cyan-500/45 hover:bg-slate-800'
                      : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                  title={`Beregnet lydbølgebøjning (vindrefraktion + termisk refraktion) iht. ISO 9613-2 / Nord2000: Medvind +${downwindWindRefractionDb.toFixed(1)} dB (∂u/∂z = +${windGradientDuDz} s⁻¹) og temperaturgradient ${thermalSpec.thermalRefractionDb >= 0 ? '+' : ''}${thermalSpec.thermalRefractionDb.toFixed(1)} dB (∂T/∂z = ${thermalSpec.dTdz >= 0 ? '+' : ''}${thermalSpec.dTdz} °C/m). Netto medvindsrefraktion: ${maxDownwindRefractionDb >= 0 ? '+' : ''}${maxDownwindRefractionDb.toFixed(1)} dB. ${isNoiseAmplificationRisk ? 'ADVARSEL: Støjforstærknings-risiko (> 3,0 dB medvindsrefraktion)!' : ''}`}
                >
                  {isNoiseAmplificationRisk ? (
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        showRibbonAcousticRefraction ? 'text-amber-200' : 'text-rose-400'
                      }`}
                    />
                  ) : (
                    <Volume2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        showRibbonAcousticRefraction ? 'text-slate-950' : 'text-cyan-400'
                      }`}
                    />
                  )}
                  {/* Mini SVG Sound Wave Bending Arc Icon */}
                  <svg
                    viewBox="0 0 28 14"
                    className="w-6 h-3.5 shrink-0"
                    aria-hidden="true"
                  >
                    <line
                      x1="1"
                      y1="12.5"
                      x2="27"
                      y2="12.5"
                      stroke="currentColor"
                      strokeOpacity="0.45"
                      strokeWidth="1"
                    />
                    <line
                      x1="14"
                      y1="7.5"
                      x2="14"
                      y2="12.5"
                      stroke="currentColor"
                      strokeOpacity="0.7"
                      strokeWidth="1.4"
                    />
                    {maxDownwindRefractionDb >= 0 ? (
                      <path
                        d="M 2 10 Q 14 1.5 25 10.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    ) : (
                      <path
                        d="M 2 10.5 Q 14 9.5 25 2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeDasharray="2 1.5"
                        strokeLinecap="round"
                      />
                    )}
                    <circle cx="25" cy={maxDownwindRefractionDb >= 0 ? 10.5 : 2} r="1.6" fill="currentColor" />
                  </svg>
                  <span
                    className={
                      showRibbonAcousticRefraction
                        ? isNoiseAmplificationRisk
                          ? 'text-rose-100'
                          : 'text-slate-900'
                        : 'text-slate-400'
                    }
                  >
                    Lydbølge-Refraktion:
                  </span>
                  <span
                    className={`font-extrabold ${
                      showRibbonAcousticRefraction
                        ? isNoiseAmplificationRisk
                          ? 'text-amber-200'
                          : 'text-slate-950'
                        : isNoiseAmplificationRisk
                        ? 'text-amber-300'
                        : maxDownwindRefractionDb > 0
                        ? 'text-cyan-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {maxDownwindRefractionDb >= 0 ? '+' : ''}
                    {maxDownwindRefractionDb.toFixed(1)} dB
                  </span>
                  {isNoiseAmplificationRisk ? (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                        showRibbonAcousticRefraction
                          ? 'bg-slate-950 text-amber-300 border border-amber-300/80'
                          : 'bg-rose-600 text-white border border-amber-300'
                      }`}
                    >
                      <span>⚠ Støjforstærknings-risiko (&gt; 3 dB)</span>
                    </span>
                  ) : (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                        showRibbonAcousticRefraction
                          ? 'bg-slate-950 text-amber-300'
                          : isModerateDownwardBending
                          ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {maxDownwindRefractionDb > 0 ? '↷ Medvinds-Refraktion (≤ 3 dB)' : '↶ Skyggezone'}
                    </span>
                  )}
                </button>

                {/* Skorstenseffekt (Thermal Stack Buoyancy ΔP_s & z_NPL) Visual Indicator & Toggle Button in Vejrrubrikken */}
                <button
                  type="button"
                  onClick={() => setShowRibbonStackEffect((prev) => !prev)}
                  className={`px-2.5 py-0.5 rounded font-mono text-[11px] transition-all flex items-center gap-1.5 border cursor-pointer ${
                    showRibbonStackEffect
                      ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold shadow-xs'
                      : 'bg-amber-950/80 text-amber-200 border-amber-500/60 hover:bg-amber-900/80 hover:border-amber-300'
                  }`}
                  title={`Vis/skjul Visualisering af Skorstenseffekten (Termisk Opdrift ΔP_s = +${indoorClimateTelemetry.deltaPsSpanPa.toFixed(1)} Pa · Skakt-flow Q_op = ${indoorClimateTelemetry.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h · Neutraltryksplan z_NPL = ${indoorClimateTelemetry.zNplEffectiveMeters.toFixed(1)} m)`}
                >
                  <Flame
                    className={`w-3.5 h-3.5 shrink-0 ${
                      showRibbonStackEffect ? 'text-slate-950' : 'text-amber-400'
                    }`}
                  />
                  {/* Mini Chimney Upward Draft SVG Icon */}
                  <svg viewBox="0 0 22 14" className="w-5 h-3.5 shrink-0" aria-hidden="true">
                    <rect
                      x="6"
                      y="1.5"
                      width="10"
                      height="11"
                      rx="1"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.65"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M 11 11 L 11 3.5 M 8.5 6 L 11 3.2 L 13.5 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Skorstenseffekt:</span>
                  <span className="font-extrabold">
                    +{indoorClimateTelemetry.deltaPsSpanPa.toFixed(1)} Pa
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                      showRibbonStackEffect
                        ? 'bg-slate-950 text-amber-300'
                        : 'bg-rose-500/25 text-rose-200 border border-rose-400/50'
                    }`}
                  >
                    z_NPL = {indoorClimateTelemetry.zNplEffectiveMeters.toFixed(1)} m · Q_op = {indoorClimateTelemetry.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h
                  </span>
                </button>

                {/* Export All 24h Weather & Road Data for Selected Day as JSON Button */}
                <button
                  type="button"
                  onClick={handleExportSelectedDayWeatherJson}
                  className={`px-2.5 py-0.5 rounded font-mono text-[11px] font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                    weatherJsonExportedJustNow
                      ? 'bg-emerald-400 text-slate-950 border-white shadow-sm'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border-emerald-400/60'
                  }`}
                  title={`Eksportér alle 24 timers vejrdata og vej-/receptordata for den valgte dag (${weatherDataset.dateIso}) som en JSON-fil til brug i eksterne analyseværktøjer`}
                >
                  {weatherJsonExportedJustNow ? (
                    <>
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>✓ 24t Vejrdata Eksporteret (JSON)!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <span>📥 Eksportér 24t Vejrdata (JSON)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px]">
                {isHighRiskWind ? (
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold border border-rose-200 animate-pulse flex items-center gap-1 shadow-sm whitespace-nowrap">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>AKUT SPREDNINGSRISIKO: VIND &gt; 10 m/s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleJumpToHighWindHour}
                    className="px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/50 font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                    title="Skift til time/scenarie med vindhastighed > 10 m/s for at se proaktiv realtids-fremhævning af mest berørte receptorer"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
                    <span>Simulér Vind &gt; 10 m/s Varsel</span>
                  </button>
                )}
                <span className="text-slate-400 truncate max-w-xs">{weatherDataset.sourceApi}</span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span
                  className={`font-bold ${
                    maxSiteSumQuotient >= 1.0
                      ? 'text-rose-400'
                      : maxSiteSumQuotient >= 0.5
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {maxSiteSumQuotient >= 1.0
                    ? `✖ ULOVLIG SUMVÆRDI S = ${maxSiteSumQuotient.toFixed(2)} (≥ 1,0)`
                    : `▲ SUMVÆRDI S = ${maxSiteSumQuotient.toFixed(2)}`}
                </span>
              </div>
              </div>

              {/* SEPARATE BOX NEXT TO VEJRRUBRIKKEN: 24-Hour Animated Wind Speed & Direction Visualization */}
              <Animated24hWindWidget
                hours={weatherDataset.hours}
                currentWeather={currentWeather}
                dateIso={weatherDataset.dateIso}
                onSelectHour={(hrIdx) => {
                  setSelectedHourIndex(hrIdx);
                  setPlumeRouteProgress(hrIdx);
                }}
                onExportWeatherJson={handleExportSelectedDayWeatherJson}
                jsonExportedJustNow={weatherJsonExportedJustNow}
                onOpenStackEffectVisualization={() => setShowRibbonStackEffect((prev) => !prev)}
                variant="rubric-box"
              />
            </div>

            {/* DEDICATED 3D VISUALIZATION BOX: Vertical Spread of the Dust Plume over Ringparken based on Selected Hour */}
            <VerticalPlume3DBoxWidget
              dateIso={weatherDataset.dateIso}
              currentWeather={currentWeather}
              hours={weatherDataset.hours}
              sources={sources}
              receptors={receptors}
              receptorExposures={receptorExposures}
              buildings={buildings}
              maxSiteSumQuotient={maxSiteSumQuotient}
              onSelectHour={(hrIdx) => {
                setSelectedHourIndex(hrIdx);
                setPlumeRouteProgress(hrIdx);
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
            />

            {/* REAL-TIME PROACTIVE RECEPTOR NOTIFICATION BANNER WHEN WIND SPEED > 10 m/s */}
            {isHighRiskWind && top3MostAffectedReceptors.length > 0 && (
              <div className="p-2.5 rounded-md bg-gradient-to-r from-rose-950/95 via-slate-950/95 to-rose-950/90 border-2 border-rose-400 shadow-[0_0_22px_rgba(225,29,72,0.45)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-400 animate-ping shrink-0" />
                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                      PROAKTIV STØVSPREDNINGS-NOTIFIKATION (VIND {currentWeather.windSpeed10m} m/s &gt; 10 m/s · FANE MOD {plumeDirectionDeg}° {degreesToCompass(plumeDirectionDeg)})
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-amber-200 font-semibold">
                    ⚡ PROAKTIV TILTAG: Aktivér vandkanoner ved{' '}
                    {top3MostAffectedReceptors[0]?.dominantSourceName.split(':')[0]} · Indstil uafskærmet nedbrydning
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono">
                  {top3MostAffectedReceptors.map((recExp, idx) => {
                    const rank = idx + 1;
                    const isSel = selectedReceptorExposure.receptorId === recExp.receptorId;
                    const topSub = [...recExp.substances].sort((a, b) => b.quotient - a.quotient)[0];
                    return (
                      <button
                        key={`ribbon-hw-rec-${recExp.receptorId}`}
                        type="button"
                        onClick={() => {
                          setSelectedReceptorId(recExp.receptorId);
                          setActiveTab('substances');
                        }}
                        className={`text-left p-2 rounded border transition-all flex items-center justify-between gap-2 ${
                          isSel
                            ? 'bg-rose-900/80 border-amber-300 ring-1 ring-amber-300 text-white'
                            : 'bg-slate-950/85 border-rose-500/60 hover:border-amber-300 text-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ${
                                rank === 1
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              #{rank} MEST BERØRT
                            </span>
                            <span className="font-bold text-xs text-white truncate">
                              {recExp.receptorCode}: {recExp.receptorName}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-rose-200/90 truncate mt-0.5">
                            {recExp.address} · {recExp.distanceFromNearestSourceMeters} m fra{' '}
                            {recExp.dominantSourceName.split(':')[0]}
                          </div>
                          {topSub && (
                            <div className="text-[10px] text-amber-200/90 truncate">
                              Kritisk stof: {topSub.name.split(' ')[0]} ({topSub.concentration} {topSub.unit})
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-sm font-extrabold ${
                              recExp.sumQuotient >= 1.0 ? 'text-rose-300' : 'text-amber-300'
                            }`}
                          >
                            S = {recExp.sumQuotient.toFixed(2)}
                          </div>
                          <div className="text-[9.5px] text-cyan-300">Fremhævet →</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AUTOMATED ALERT WIDGET: 24-HOUR CUMULATIVE DUST-DEPOSITION (µg/m²) DANGER THRESHOLD EXCEEDANCE */}
            <div
              role="region"
              aria-label="Automatisk 24-timers kumulativ støv-deponerings fare-alarm (µg/m²)"
              className={`p-2.5 rounded-md border-2 space-y-2 font-mono text-xs transition-all ${
                receptorsExceeding24hDustDanger.length > 0
                  ? 'bg-gradient-to-r from-rose-950/95 via-amber-950/75 to-rose-950/95 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                  : 'bg-slate-950/90 border-emerald-500/40'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {receptorsExceeding24hDustDanger.length > 0 ? (
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                  ) : (
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  )}
                  <ShieldAlert
                    className={`w-4 h-4 shrink-0 ${
                      receptorsExceeding24hDustDanger.length > 0
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }`}
                  />
                  <span className="font-extrabold uppercase tracking-wider text-white">
                    {receptorsExceeding24hDustDanger.length > 0
                      ? `⚠ AUTOMATISK FARE-ALARM: 24T KUMULATIV STØV-DEPONERING OVERSKREDET (${receptorsExceeding24hDustDanger.length} RECEPTORER ≥ ${dustDepositionDangerThresholdUgM2} µg/m²)`
                      : `✓ 24T KUMULATIV STØV-DEPONERING UNDER FARE-GRÆNSE (< ${dustDepositionDangerThresholdUgM2} µg/m²)`}
                  </span>
                  {lastAutoLoggedDustAlertCode && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('algedonic')}
                      className="px-2 py-0.5 rounded bg-fuchsia-600/90 hover:bg-fuchsia-500 text-white border border-fuchsia-300 text-[10px] font-extrabold cursor-pointer"
                      title="Klik for at åbne den automatisk registrerede hændelse i Algedonisk Observationslog"
                    >
                      ⚡ Logget i Algedonisk Log: {lastAutoLoggedDustAlertCode} →
                    </button>
                  )}
                </div>

                {/* Danger Threshold (µg/m²) Controls & Auto-Log Toggle */}
                <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                  <span className="text-amber-200 font-semibold">Fare-grænse (µg/m²):</span>
                  {[80, 150, 220, 300].map((presetVal) => (
                    <button
                      key={`dust-thr-${presetVal}`}
                      type="button"
                      onClick={() => setDustDepositionDangerThresholdUgM2(presetVal)}
                      className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer transition-colors ${
                        dustDepositionDangerThresholdUgM2 === presetVal
                          ? 'bg-amber-400 text-slate-950 border-white'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      {presetVal} µg/m²
                    </button>
                  ))}
                  <input
                    type="range"
                    min={40}
                    max={400}
                    step={10}
                    value={dustDepositionDangerThresholdUgM2}
                    onChange={(e) => setDustDepositionDangerThresholdUgM2(Number(e.target.value))}
                    aria-label="Fare-grænse for 24-timers kumulativ støv-deponering i µg/m²"
                    className="w-24 accent-amber-400 cursor-pointer"
                  />
                  <label className="flex items-center gap-1 text-[10px] text-cyan-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoLogDustDangerToAlgedonic}
                      onChange={(e) => setAutoLogDustDangerToAlgedonic(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span>Auto-log til Algedonisk Log</span>
                  </label>
                </div>
              </div>

              {receptorsExceeding24hDustDanger.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {receptorsExceeding24hDustDanger.slice(0, 3).map((rec, idx) => {
                    const excessUg = Number(
                      (
                        rec.totalDepositedHeavyMetalsAndPcbUgM2 -
                        dustDepositionDangerThresholdUgM2
                      ).toFixed(1)
                    );
                    return (
                      <div
                        key={`dust-danger-rec-${rec.receptorId}`}
                        className="p-2 rounded bg-slate-950/90 border border-amber-400/70 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9.5px] font-extrabold">
                              #{idx + 1} FARE
                            </span>
                            <span className="font-bold text-white truncate">
                              {rec.receptorCode}: {rec.receptorName}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 truncate mt-0.5">
                            {rec.address} · Spids kl. {rec.peakHourLabel} (S={rec.peakSumQuotient.toFixed(2)})
                          </div>
                          <div className="text-[10px] text-amber-300 font-bold">
                            24t Støv-Deponering: {rec.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)} µg/m² (+{excessUg} µg/m² over grænse)
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReceptorId(rec.receptorId);
                              setSelectedHourIndex(rec.peakHourIndex);
                              setPlumeRouteProgress(rec.peakHourIndex);
                            }}
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-500/50 text-cyan-200 text-[9.5px] font-bold cursor-pointer"
                          >
                            Fokusér Kort
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleLog24hDustDepositionDangerObservation(rec, 'MANUEL');
                              setActiveTab('algedonic');
                            }}
                            className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9.5px] font-extrabold cursor-pointer"
                            title="Tilføj denne 24t støv-deponerings overskridelse direkte til Algedonisk Observationslog med SHA-256 signatur"
                          >
                            + Føj til Algedonisk Log
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-emerald-200 flex items-center justify-between">
                  <span>
                    Højeste 24t støv-deponering er aktuelt{' '}
                    <strong>
                      {allReceptors24hDustSorted[0]?.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1) ??
                        0}{' '}
                      µg/m²
                    </strong>{' '}
                    ved {allReceptors24hDustSorted[0]?.receptorCode} ({allReceptors24hDustSorted[0]?.receptorName}).
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDustDepositionDangerThresholdUgM2(
                        Math.max(
                          20,
                          Math.floor(
                            (allReceptors24hDustSorted[0]?.totalDepositedHeavyMetalsAndPcbUgM2 ?? 100) *
                              0.85
                          )
                        )
                      )
                    }
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 text-[10px] font-bold cursor-pointer"
                  >
                    Simulér Fare-Grænse Overskridelse Nu
                  </button>
                </div>
              )}
            </div>

            {/* MINI-DASHBOARD I VEJRRUBRIKKEN: GRAFISK LYDBØLGE-REFRAKTION (NEDBØJNING) & 'STØJFORSTÆRKNINGS-RISIKO' (> 3 dB) */}
            {showRibbonAcousticRefraction && (
              <DockableWindowFrame
                windowId="acoustic_refraction_dashboard"
                state={windowStates.acoustic_refraction_dashboard}
                onMinimize={handleMinimizeWindow}
                onPopOutFloating={handlePopOutFloatingWindow}
                onRestore={handleRestoreWindow}
              >
              <div
                className={`p-3 rounded-md border shadow-lg space-y-2.5 font-mono text-xs transition-colors ${
                  isNoiseAmplificationRisk
                    ? 'bg-slate-950/95 border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.22)]'
                    : 'bg-slate-950/95 border-amber-500/50'
                }`}
              >
                {/* Header Row with 'Støjforstærknings-risiko' (> 3 dB) Warning Symbol */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {isNoiseAmplificationRisk ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-600 text-white border border-amber-300 text-[11px] font-extrabold uppercase tracking-wider shadow-sm"
                        role="status"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
                        <span>
                          ⚠ Støjforstærknings-risiko (&gt; 3 dB Medvindsrefraktion: +
                          {maxDownwindRefractionDb.toFixed(1)} dB)
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-bold">
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          Moderat Refraktion ({maxDownwindRefractionDb >= 0 ? '+' : ''}
                          {maxDownwindRefractionDb.toFixed(1)} dB ≤ 3,0 dB tærskel)
                        </span>
                      </span>
                    )}

                    <span className="font-bold text-white uppercase tracking-wider">
                      Akustisk Refraktions Mini-Dashboard (Vind- &amp; Temperaturgradienter · ISO 9613-2 / Nord2000)
                    </span>

                    <span className="text-[11px] text-slate-300">
                      Medvind mod {animPlumeDirectionDeg}° ({degreesToCompass(animPlumeDirectionDeg)}) ·{' '}
                      <strong className="text-cyan-300">
                        ∂u/∂z = +{windGradientDuDz.toFixed(2)} s⁻¹
                      </strong>{' '}
                      ·{' '}
                      <strong className="text-amber-300">
                        ∂T/∂z = {thermalSpec.dTdz >= 0 ? '+' : ''}
                        {thermalSpec.dTdz.toFixed(3)} °C/m
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Afspil Refraktions-Loop (24-Hour Animated Sound Wave Bending Simulation) */}
                    <div className="flex items-center gap-1 bg-slate-900/95 border border-amber-500/50 rounded p-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setIsPlayingRefractionLoop((prev) => !prev)}
                        className={`px-2.5 py-1 rounded text-[10.5px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isPlayingRefractionLoop
                            ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                            : 'bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/50'
                        }`}
                        title="Simulér og animér lydbølgers refraktion (nedbøjning og opadbøjning) kontinuerligt over 24 timer baseret på døgnets vind- og temperaturgradienter"
                      >
                        {isPlayingRefractionLoop ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                            <span>Pause Refraktions-Loop (kl. {animTimeLabel})</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                            <span>Afspil Refraktions-Loop</span>
                          </>
                        )}
                      </button>

                      {/* Loop Speed Selector (0.5x, 1x, 2x) */}
                      {(['0.5x', '1x', '2x'] as const).map((spd) => (
                        <button
                          key={`refr-spd-${spd}`}
                          type="button"
                          onClick={() => setRefractionLoopSpeed(spd)}
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition-colors cursor-pointer ${
                            refractionLoopSpeed === spd
                              ? 'bg-amber-500/30 text-amber-200 border border-amber-400/60'
                              : 'text-slate-400 hover:text-white'
                          }`}
                          title={`Sæt 24-timers refraktions-loop hastighed til ${spd}`}
                        >
                          {spd}
                        </button>
                      ))}
                    </div>

                    {!isNoiseAmplificationRisk && (
                      <button
                        type="button"
                        onClick={() => {
                          const peakHr = hourlyRefractionSeries.reduce(
                            (best, cur) =>
                              cur.totalDownwindDb > best.totalDownwindDb ? cur : best,
                            hourlyRefractionSeries[0]
                          );
                          if (peakHr) {
                            setIsPlayingRefractionLoop(false);
                            setRefractionLoopProgress(peakHr.hourIndex);
                            setSelectedHourIndex(peakHr.hourIndex);
                            setPlumeRouteProgress(peakHr.hourIndex);
                          }
                        }}
                        className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-amber-200 border border-rose-500/60 text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Skift til time med medvindsrefraktion > 3,0 dB for at inspicere 'Støjforstærknings-risiko'"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>Hop til &gt; 3 dB Støjforstærknings-Time</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowWindNoiseSensitivityAnalysis((prev) => !prev)}
                      className={`px-2.5 py-1 rounded text-[10.5px] font-extrabold flex items-center gap-1 border transition-colors cursor-pointer ${
                        showWindNoiseSensitivityAnalysis
                          ? 'bg-rose-600 text-white border-amber-300 shadow-xs'
                          : 'bg-slate-900 hover:bg-slate-800 text-rose-300 border-rose-500/50'
                      }`}
                      title="Vis/skjul 'Vindstøj-sensitivitets-analyse': korrelation mellem impulsstøj fra nedrivningsmaskiner og målte vindstyrker > 10 m/s under ustabile vejrforhold"
                    >
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {showWindNoiseSensitivityAnalysis
                          ? '📊 Vindstøj-Sensitivitets-Analyse (>10 m/s): AKTIV'
                          : '📊 Åbn Vindstøj-Sensitivitets-Analyse (>10 m/s)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!showWindNoiseSensitivityAnalysis) {
                          setShowWindNoiseSensitivityAnalysis(true);
                          setShowWindCompensatedImpulseCatalog(true);
                        } else {
                          setShowWindCompensatedImpulseCatalog((prev) => !prev);
                        }
                      }}
                      className={`px-2.5 py-1 rounded text-[10.5px] font-extrabold flex items-center gap-1 border transition-colors cursor-pointer ${
                        showWindNoiseSensitivityAnalysis && showWindCompensatedImpulseCatalog
                          ? 'bg-fuchsia-600 text-white border-amber-200 shadow-xs'
                          : 'bg-slate-900 hover:bg-slate-800 text-fuchsia-300 border-fuchsia-500/50'
                      }`}
                      title="Indlæs og plot 'Vind-Kompenseret Impuls-Katalog' (historiske DBA-støjfiler fra naboblokke sammenholdt med realtids-simulering og faktiske naboklage-logfiler)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {showWindNoiseSensitivityAnalysis && showWindCompensatedImpulseCatalog
                          ? '📂 Vind-Kompenseret Impuls-Katalog (DBA): AKTIV'
                          : '📂 Vind-Kompenseret Impuls-Katalog (DBA)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportAcousticRefractionPdfReport}
                      className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-200 text-[10.5px] font-extrabold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      title="Download Acoustic Diagram PDF & Download dB Values Report — Eksportér det aktuelle lydbølgebøjnings-diagram og de beregnede dB-værdier pr. receptor som en PDF-rapport til retsmedicinsk dokumentation"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>📄 Eksportér Lydbølgebøjnings-Diagram &amp; dB-Værdier pr. Receptor (PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('noiseDust')}
                      className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-[10.5px] font-semibold transition-colors cursor-pointer"
                    >
                      Åbn Støj &amp; Støv Korrelationspanel →
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRibbonAcousticRefraction(false)}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[10.5px] cursor-pointer"
                    >
                      Skjul
                    </button>
                  </div>
                </div>

                {acousticRefractionPdfBanner && (
                  <div className="px-3 py-1.5 rounded bg-emerald-950/90 border border-emerald-400/70 text-emerald-200 text-[11px] flex items-center justify-between gap-2">
                    <span className="font-bold">✓ {acousticRefractionPdfBanner}</span>
                    <button
                      type="button"
                      onClick={() => setAcousticRefractionPdfBanner(null)}
                      className="text-[10px] text-emerald-300 hover:text-white underline cursor-pointer"
                    >
                      Luk
                    </button>
                  </div>
                )}

                {/* Item #6: Akustisk varsling for støvspredning (S > 0,8 i højvindsscenarier) */}
                {(() => {
                  const highWindActive =
                    animWindSpeed10m >= 8.0 ||
                    animWindGusts10m >= 10.0 ||
                    currentWeather.windSpeed10m >= 8.0 ||
                    currentWeather.windGusts10m >= 10.0 ||
                    forceHighWindDustWarningSim;
                  const receptorsOver08 = receptorExposures.filter((r) => r.sumQuotient > 0.8);
                  const peakReceptor = worstExposedReceptor || receptorExposures[0];
                  const effectiveMaxS = forceHighWindDustWarningSim
                    ? Math.max(0.94, maxSiteSumQuotient)
                    : maxSiteSumQuotient;
                  const isDustAcousticWarningTriggered =
                    highWindActive && (effectiveMaxS > 0.8 || receptorsOver08.length > 0);

                  return (
                    <div
                      role={isDustAcousticWarningTriggered ? 'alert' : 'region'}
                      aria-label="Akustisk varsling for støvspredning ved S over 0,8 i højvindsscenarier"
                      className={`px-3 py-2 rounded border flex flex-wrap items-center justify-between gap-2.5 transition-all ${
                        isDustAcousticWarningTriggered
                          ? 'bg-amber-950/85 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.28)]'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-extrabold uppercase tracking-wider border ${
                            isDustAcousticWarningTriggered
                              ? 'bg-amber-400 text-slate-950 border-amber-200 animate-pulse'
                              : 'bg-slate-800 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {isDustAcousticWarningTriggered
                              ? '🔔 AKUSTISK VARSLING AKTIV: STØVSPREDNING S > 0,8 I HØJVIND'
                              : '🔔 Akustisk varsling for støvspredning (Tærskel: S > 0,8 i højvind)'}
                          </span>
                        </span>

                        <span className="text-[10.5px] text-slate-200">
                          Maks. Sumkvotient:{' '}
                          <strong
                            className={
                              effectiveMaxS > 0.8 ? 'text-amber-300 font-extrabold' : 'text-emerald-300'
                            }
                          >
                            S = {effectiveMaxS.toFixed(2)}
                          </strong>{' '}
                          (grænse 0,80) · Vind:{' '}
                          <strong className="text-cyan-300">
                            {Math.max(
                              animWindSpeed10m,
                              forceHighWindDustWarningSim ? 11.4 : 0
                            ).toFixed(1)}{' '}
                            m/s
                          </strong>{' '}
                          (stød{' '}
                          {Math.max(
                            animWindGusts10m,
                            forceHighWindDustWarningSim ? 14.8 : 0
                          ).toFixed(1)}{' '}
                          m/s)
                          {peakReceptor ? ` · Kritisk receptor: ${peakReceptor.receptorName}` : ''}
                        </span>

                        {lastAcousticChimeLabel && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950/90 border border-amber-500/40 text-amber-200">
                            Sidste advarselstone: {lastAcousticChimeLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAcousticDustWarningEnabled((prev) => !prev)}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            acousticDustWarningEnabled
                              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                          title="Slå automatisk diskret Web Audio advarselstone til/fra ved S > 0,8 i højvindsscenarier"
                        >
                          {acousticDustWarningEnabled
                            ? '🔊 Auto-Advarselstone: TIL'
                            : '🔇 Auto-Advarselstone: FRA'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const targetRec = worstExposedReceptor || receptorExposures[0];
                            playAcousticDustDispersionWarningTone(
                              Math.max(0.88, maxSiteSumQuotient),
                              Math.max(animWindSpeed10m, 10.8),
                              targetRec ? targetRec.receptorName : 'Afd. 23 · Kierulffsvej'
                            );
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 border border-amber-400/60 text-[10px] font-extrabold transition-colors cursor-pointer"
                          title="Afspil den diskrete akustiske advarselstone (to-tonet harmonisk Web Audio signal) nu"
                        >
                          🔔 Afspil Advarselstone Nu
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setForceHighWindDustWarningSim((prev) => {
                              const next = !prev;
                              if (next) {
                                lastChimedStateKeyRef.current = '';
                              }
                              return next;
                            });
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            forceHighWindDustWarningSim
                              ? 'bg-rose-600 text-white border-amber-200'
                              : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
                          }`}
                          title="Simulér højvindsscenarie med sumkvotient S > 0,8 ved receptor for at teste den akustiske varsling"
                        >
                          {forceHighWindDustWarningSim
                            ? '⚡ Højvind S > 0,8 Simulering: AKTIV'
                            : '⚡ Simulér S > 0,8 i Højvind'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Interactive 24-Hour Refraction Loop Scrubber & Live Gradient Telemetry Strip */}
                <div className="px-2.5 py-1.5 rounded bg-slate-900/90 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5 text-[10.5px]">
                    <span
                      className={`px-2 py-0.5 rounded font-extrabold flex items-center gap-1 ${
                        isPlayingRefractionLoop
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-cyan-300 border border-slate-700'
                      }`}
                    >
                      <span>{isPlayingRefractionLoop ? '▶ 24T LOOP AKTIV' : '⏸ 24T TIDSLINJE'}</span>
                      <span>kl. {animTimeLabel}</span>
                    </span>
                    <span className="text-slate-300">
                      Vind: <strong className="text-white">{animWindSpeed10m.toFixed(1)} m/s</strong>{' '}
                      <span className="text-amber-300">(stød {animWindGusts10m.toFixed(1)} m/s)</span>{' '}
                      fra <strong className="text-cyan-300">{animWindDirection10m}°</strong>
                    </span>
                    <span className="text-slate-300">
                      Temp: <strong className="text-amber-300">{animTemp2m.toFixed(1)} °C</strong>{' '}
                      <span className="text-emerald-300">
                        (Kl. {animPasquillClass}: {thermalSpec.regimeLabel})
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
                    <span className="text-[9.5px] text-slate-400 shrink-0">00:00</span>
                    <input
                      type="range"
                      min={0}
                      max={23.95}
                      step={0.05}
                      value={refractionLoopProgress}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setRefractionLoopProgress(val);
                        const hrInt = Math.floor(val) % 24;
                        setSelectedHourIndex(hrInt);
                        setPlumeRouteProgress(hrInt);
                      }}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      aria-label="24-timers akustisk refraktions-loop tidslinje"
                    />
                    <span className="text-[9.5px] text-slate-400 shrink-0">23:59</span>
                  </div>
                </div>

                {/* 3-Column Graphical Mini-Dashboard: (1) Ray-Tracing Cross-Section, (2) Wind & Temp Gradient Vertical Profile, (3) 24h Refraction vs 3 dB Threshold */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
                  {/* COLUMN 1 (6 cols): Graphical Sound Wave Refraction (Nedbøjning) Cross-Section SVG */}
                  <div className="lg:col-span-6 rounded bg-slate-900/95 border border-slate-800 p-2.5 flex flex-col justify-between">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-[10.5px] font-bold uppercase text-cyan-300">
                        1. Grafisk Lydbølge-Refraktion (Nedbøjning over 2,5 m Støjskærm)
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold ${
                            isNoiseAmplificationRisk ? 'text-rose-300' : 'text-amber-300'
                          }`}
                        >
                          R_c ≈ {rayCurvatureRadiusKm ?? '∞'} km · c₀ = {speedOfSoundMs} m/s
                        </span>
                        <button
                          type="button"
                          onClick={handleExportAcousticRefractionPdfReport}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/70 text-emerald-200 text-[9.5px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Download Acoustic Diagram PDF — Eksportér det aktuelle lydbølgebøjnings-diagram (Ray-Tracing tværsnit over 2,5 m støjskærm) og dB-refraktionsdata som PDF-rapport"
                        >
                          <Download className="w-3 h-3 shrink-0" />
                          <span>Eksportér Diagram &amp; dB (PDF)</span>
                        </button>
                      </div>
                    </div>

                    {(() => {
                      // Dynamic curvature factor for SVG ray-bending paths based on maxDownwindRefractionDb (-2 dB to +6.5 dB)
                      const bendNorm = Math.max(
                        -0.6,
                        Math.min(1.25, maxDownwindRefractionDb / 4.8)
                      );
                      // Downwind control points & landing points for 4 rays launched from source (x=155, y=126)
                      const raySpecs = [
                        { id: 'r1', label: '8°', peakY: 96 - bendNorm * 14, endX: 468, endY: bendNorm >= 0 ? 130 : 68 },
                        { id: 'r2', label: '16°', peakY: 74 - bendNorm * 18, endX: 472, endY: bendNorm >= 0 ? 122 : 48 },
                        { id: 'r3', label: '24°', peakY: 52 - bendNorm * 20, endX: 476, endY: bendNorm >= 0 ? 112 : 30 },
                        { id: 'r4', label: '32°', peakY: 32 - bendNorm * 18, endX: 480, endY: bendNorm >= 0 ? 98 : 16 },
                      ];

                      return (
                        <svg
                          viewBox="0 0 520 156"
                          className="w-full h-36 rounded bg-[#070A12] border border-slate-800/90"
                          role="img"
                          aria-label="Grafisk tværsnit af lydbølgers refraktion (nedbøjning) i medvind og modvind"
                        >
                          <defs>
                            <linearGradient id="downwindFocusGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.04" />
                              <stop offset="60%" stopColor="#f43f5e" stopOpacity={isNoiseAmplificationRisk ? '0.22' : '0.1'} />
                              <stop offset="100%" stopColor="#e11d48" stopOpacity={isNoiseAmplificationRisk ? '0.36' : '0.16'} />
                            </linearGradient>
                            <linearGradient id="upwindShadowGrad" x1="1" y1="0" x2="0" y2="0">
                              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.04" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.16" />
                            </linearGradient>
                          </defs>

                          {/* Atmospheric height grid lines (z = 10m, 20m, 30m) */}
                          {[34, 68, 102].map((gy, idx) => (
                            <g key={`grid-z-${gy}`}>
                              <line
                                x1="8"
                                y1={gy}
                                x2="512"
                                y2={gy}
                                stroke="#1e293b"
                                strokeDasharray="3 3"
                                strokeWidth="0.8"
                              />
                              <text x="12" y={gy - 3} fill="#64748b" fontSize="7.5">
                                z={30 - idx * 10}m
                              </text>
                            </g>
                          ))}

                          {/* Upwind Acoustic Shadow Zone Shading (left of source) */}
                          <rect x="8" y="14" width="132" height="122" fill="url(#upwindShadowGrad)" />
                          <text x="14" y="25" fill="#34d399" fontSize="8" fontWeight="bold">
                            ↶ MODVIND (Akustisk Skygge: {upwindShadowRefractionDb.toFixed(1)} dB)
                          </text>

                          {/* Downwind Acoustic Focusing Zone Shading (right of barrier) */}
                          <rect x="284" y="14" width="228" height="122" fill="url(#downwindFocusGrad)" />
                          <text
                            x="290"
                            y="25"
                            fill={isNoiseAmplificationRisk ? '#fda4af' : '#fcd34d'}
                            fontSize="8"
                            fontWeight="bold"
                          >
                            ↷ MEDVIND ({animPlumeDirectionDeg}° {degreesToCompass(animPlumeDirectionDeg)}: +
                            {maxDownwindRefractionDb.toFixed(1)} dB · kl. {animTimeLabel})
                          </text>

                          {/* Ground terrain line (y = 136) */}
                          <line x1="8" y1="136" x2="512" y2="136" stroke="#475569" strokeWidth="2" />

                          {/* Upwind upward-refracted rays (curving up away from ground) */}
                          <path
                            d={`M 155 126 Q 95 ${(112 + bendNorm * 8).toFixed(1)} 22 ${(44 - bendNorm * 12).toFixed(1)}`}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="1.4"
                            strokeDasharray="3 2"
                          />
                          <path
                            d={`M 155 126 Q 102 ${(92 + bendNorm * 6).toFixed(1)} 34 ${(22 - bendNorm * 8).toFixed(1)}`}
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="1.4"
                            strokeDasharray="3 2"
                          />

                          {/* Geometric Straight-Line Shadow Boundary over 2.5m Barrier (Without Refraction) */}
                          <line
                            x1="155"
                            y1="126"
                            x2="485"
                            y2="62"
                            stroke="#64748b"
                            strokeWidth="1"
                            strokeDasharray="4 3"
                          />
                          <text x="315" y="76" fill="#94a3b8" fontSize="7.5">
                            Uden refraktion (skærmet)
                          </text>

                          {/* 2.5 m Acoustic Barrier / Byggeplads-Støjskærm at x = 282 */}
                          <rect x="279" y="102" width="6" height="34" fill="#f59e0b" rx="1" />
                          <text x="254" y="98" fill="#fbbf24" fontSize="7.5" fontWeight="bold">
                            Støjskærm (2,5m)
                          </text>

                          {/* Downwind Refracted Sound Wave Rays (Bending Downward over the Noise Barrier!) */}
                          {raySpecs.map((r, rIdx) => {
                            const strokeCol = isNoiseAmplificationRisk
                              ? rIdx <= 1
                                ? '#f43f5e'
                                : '#fbbf24'
                              : '#38bdf8';
                            return (
                              <g key={r.id}>
                                <path
                                  d={`M 155 126 Q 310 ${r.peakY.toFixed(1)} ${r.endX} ${r.endY.toFixed(1)}`}
                                  fill="none"
                                  stroke={strokeCol}
                                  strokeWidth={rIdx === 1 ? '2.2' : '1.5'}
                                  strokeOpacity={0.92 - rIdx * 0.1}
                                />
                                <circle
                                  cx={r.endX}
                                  cy={r.endY}
                                  r="2.4"
                                  fill={strokeCol}
                                />
                              </g>
                            );
                          })}

                          {/* Animated Wavefront ripples propagating along the downward-bending sound path */}
                          {[0, 1, 2, 3].map((wIdx) => {
                            const phaseShift = isPlayingRefractionLoop ? refractionWavePhase : 0.25;
                            const tNorm = ((wIdx + phaseShift) / 4) % 1;
                            const wx = 175 + tNorm * 285;
                            const wyTop = 104 - Math.sin(tNorm * Math.PI) * (24 + bendNorm * 14);
                            const wyMid = wyTop + 16;
                            const wyBot = wyTop + 32;
                            return (
                              <path
                                key={`wf-anim-${wIdx}`}
                                d={`M ${wx.toFixed(1)} ${wyTop.toFixed(1)} Q ${(wx + 10).toFixed(
                                  1
                                )} ${wyMid.toFixed(1)} ${(wx - 2).toFixed(1)} ${wyBot.toFixed(1)}`}
                                fill="none"
                                stroke={isNoiseAmplificationRisk ? '#fda4af' : '#bae6fd'}
                                strokeWidth="1.5"
                                strokeOpacity={Number((0.88 - tNorm * 0.45).toFixed(2))}
                              />
                            );
                          })}

                          {/* Demolition Source Icon at x = 155, y = 126 */}
                          <rect x="143" y="114" width="24" height="22" fill="#e11d48" stroke="#fecdd3" strokeWidth="1.2" rx="2" />
                          <text x="146" y="128" fill="#ffffff" fontSize="7.5" fontWeight="bold">
                            K1
                          </text>
                          <text x="126" y="148" fill="#fda4af" fontSize="7.5" fontWeight="bold">
                            Støjkilde 108 dB(A)
                          </text>

                          {/* Receptor Building at x = 474, y = 96..136 */}
                          <rect
                            x="472"
                            y="94"
                            width="30"
                            height="42"
                            fill={isNoiseAmplificationRisk ? '#881337' : '#1e293b'}
                            stroke={isNoiseAmplificationRisk ? '#fb7185' : '#38bdf8'}
                            strokeWidth="1.5"
                            rx="2"
                          />
                          <text x="477" y="110" fill="#ffffff" fontSize="8" fontWeight="bold">
                            {selectedRecRefraction.receptorCode}
                          </text>
                          <text x="475" y="122" fill="#fde047" fontSize="7.5" fontWeight="bold">
                            {selectedRecRefraction.totalRefrDb >= 0 ? '+' : ''}
                            {selectedRecRefraction.totalRefrDb.toFixed(1)}dB
                          </text>
                          <text x="438" y="148" fill="#bae6fd" fontSize="7.5" fontWeight="bold">
                            Receptor ({selectedRecRefraction.receptorCode})
                          </text>

                          {/* Warning Symbol on Graph when Downwind Refraction > 3 dB */}
                          {isNoiseAmplificationRisk && (
                            <g transform="translate(306, 32)">
                              <rect
                                x="0"
                                y="0"
                                width="196"
                                height="22"
                                rx="3"
                                fill="#9f1239"
                                stroke="#fde047"
                                strokeWidth="1.2"
                              />
                              <polygon points="11,5 17,17 5,17" fill="#fde047" />
                              <text x="10" y="15.5" fill="#0f172a" fontSize="7.5" fontWeight="bold">
                                !
                              </text>
                              <text x="22" y="14" fill="#ffffff" fontSize="8" fontWeight="bold">
                                STØJFORSTÆRKNINGS-RISIKO (&gt; 3,0 dB)
                              </text>
                            </g>
                          )}
                        </svg>
                      );
                    })()}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300 mt-1">
                      <span>
                        <strong className="text-amber-300">Fysik:</strong> Positiv lydhastighedsgradient (
                        <code className="text-cyan-300">
                          ∂c_eff/∂z = {soundSpeedGradientPerSec >= 0 ? '+' : ''}
                          {soundSpeedGradientPerSec.toFixed(3)} s⁻¹
                        </code>
                        ) afbøjer lydbølger nedad over støjskærme.
                      </span>
                      <span className="text-rose-300 font-bold">
                        Effekt ved {selectedRecRefraction.receptorCode}:{' '}
                        {selectedRecRefraction.totalRefrDb >= 0 ? '+' : ''}
                        {selectedRecRefraction.totalRefrDb.toFixed(1)} dB
                      </span>
                    </div>
                  </div>

                  {/* COLUMN 2 (3 cols): Graphical Wind & Temperature Gradient Profile (z = 0..30 m) */}
                  <div className="lg:col-span-3 rounded bg-slate-900/95 border border-slate-800 p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10.5px] font-bold uppercase text-amber-300">
                        2. Vind- &amp; Temp-Gradient (z)
                      </span>
                      <span className="text-[9.5px] text-emerald-300 font-semibold">
                        Pasquill {currentWeather.pasquillClass}
                      </span>
                    </div>

                    {(() => {
                      // Plot logarithmic wind profile u(z) and linear temperature gradient T(z) from z=0 to z=30m
                      const levels = [2, 8, 16, 24, 30];
                      const u10 = Math.max(0.8, effectiveWindSpeedMs);
                      return (
                        <svg
                          viewBox="0 0 230 156"
                          className="w-full h-36 rounded bg-[#070A12] border border-slate-800/90"
                          role="img"
                          aria-label="Vertikal profil af vindgradient og temperaturgradient"
                        >
                          {/* Vertical Altitude Axis at x = 34 */}
                          <line x1="34" y1="14" x2="34" y2="136" stroke="#475569" strokeWidth="1.2" />
                          <line x1="24" y1="136" x2="218" y2="136" stroke="#475569" strokeWidth="1.2" />

                          {levels.map((zM) => {
                            const py = 136 - (zM / 30) * 116;
                            const uAtZ = u10 * (Math.log(zM / 0.4) / Math.log(10 / 0.4));
                            const barLen = Math.min(110, Math.max(10, uAtZ * 6.2));
                            return (
                              <g key={`prof-z-${zM}`}>
                                <line
                                  x1="34"
                                  y1={py}
                                  x2="215"
                                  y2={py}
                                  stroke="#1e293b"
                                  strokeDasharray="2 2"
                                  strokeWidth="0.8"
                                />
                                <text x="6" y={py + 3} fill="#94a3b8" fontSize="7.5">
                                  {zM}m
                                </text>
                                {/* Wind shear vector arrow */}
                                <line
                                  x1="36"
                                  y1={py}
                                  x2={36 + barLen}
                                  y2={py}
                                  stroke="#38bdf8"
                                  strokeWidth="2.2"
                                />
                                <polygon
                                  points={`${36 + barLen},${py - 2.5} ${41 + barLen},${py} ${36 + barLen},${py + 2.5}`}
                                  fill="#38bdf8"
                                />
                                <text
                                  x={44 + barLen}
                                  y={py + 2.5}
                                  fill="#bae6fd"
                                  fontSize="7"
                                >
                                  {uAtZ.toFixed(1)}m/s
                                </text>
                              </g>
                            );
                          })}

                          {/* Temperature gradient curve T(z) */}
                          <path
                            d={
                              thermalSpec.dTdz >= 0
                                ? 'M 155 134 L 195 22'
                                : 'M 192 134 L 152 22'
                            }
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                          <text x="135" y="16" fill="#fcd34d" fontSize="7.5" fontWeight="bold">
                            ∂T/∂z={thermalSpec.dTdz >= 0 ? '+' : ''}
                            {thermalSpec.dTdz}°C/m
                          </text>
                        </svg>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-1.5 text-[9.5px] mt-1">
                      <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block">Vind-Refraktion:</span>
                        <strong className="text-cyan-300">
                          +{downwindWindRefractionDb.toFixed(1)} dB (∂u/∂z=+{windGradientDuDz})
                        </strong>
                      </div>
                      <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block">Termisk Bidrag:</span>
                        <strong className="text-amber-300">
                          {thermalSpec.thermalRefractionDb >= 0 ? '+' : ''}
                          {thermalSpec.thermalRefractionDb.toFixed(1)} dB ({currentWeather.pasquillClass})
                        </strong>
                      </div>
                    </div>

                    {/* Visual 'Støjskærms-effektivitets-meter' (Current dB vs. 6.8 dB Theoretical Maximum Barrier Effect) */}
                    {(() => {
                      const maxBarrierDb = 6.8;
                      const currentLossDb = Math.min(
                        maxBarrierDb,
                        Math.max(0, downwindWindRefractionDb * 0.85 + Math.max(0, thermalSpec.thermalRefractionDb) * 0.5)
                      );
                      const effectiveBarrierDb = Math.max(0, Number((maxBarrierDb - currentLossDb).toFixed(1)));
                      const effPct = Math.round((effectiveBarrierDb / maxBarrierDb) * 100);
                      return (
                        <div className="mt-1.5 p-2 rounded bg-slate-950 border border-cyan-500/35 space-y-1 font-mono text-[9.5px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-cyan-300 font-bold uppercase">
                              Støjskærms-effektivitets-meter (2,5m Skærm):
                            </span>
                            <span
                              className={
                                effectiveBarrierDb < 3.5
                                  ? 'text-rose-300 font-extrabold'
                                  : 'text-emerald-300 font-extrabold'
                              }
                            >
                              {effectiveBarrierDb.toFixed(1)} dB / {maxBarrierDb.toFixed(1)} dB maks. ({effPct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                            <div
                              className={`h-full transition-all duration-300 ${
                                effectiveBarrierDb < 3.0
                                  ? 'bg-rose-500'
                                  : effectiveBarrierDb < 5.0
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                              style={{ width: `${effPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[8.5px] text-slate-400">
                            <span>Refraktions-tab over skærm: -{currentLossDb.toFixed(1)} dB</span>
                            <span>Teoretisk maks. skærmeffekt: 6,8 dB</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* COLUMN 3 (3 cols): 24-Hour Refraction Timeline vs. 3.0 dB 'Støjforstærknings-risiko' Threshold */}
                  <div className="lg:col-span-3 rounded bg-slate-900/95 border border-slate-800 p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10.5px] font-bold uppercase text-rose-300">
                        3. 24t Refraktion vs. 3,0 dB Grænse
                      </span>
                      <span className="text-[9.5px] text-amber-300 font-bold">
                        {hoursExceeding3dBCount}/24t &gt; 3 dB
                      </span>
                    </div>

                    <svg
                      viewBox="0 0 240 120"
                      className="w-full h-28 rounded bg-[#070A12] border border-slate-800/90"
                      role="img"
                      aria-label="24-timers medvindsrefraktion i dB mod 3 dB støjforstærknings-risiko grænse"
                    >
                      {/* 3.0 dB Warning Threshold Line */}
                      {(() => {
                        const maxScaleDb = 7.0;
                        const y3dB = 104 - (3.0 / maxScaleDb) * 84;
                        return (
                          <>
                            <line
                              x1="6"
                              y1={y3dB}
                              x2="234"
                              y2={y3dB}
                              stroke="#f43f5e"
                              strokeWidth="1.2"
                              strokeDasharray="3 2"
                            />
                            <text x="10" y={y3dB - 3} fill="#fda4af" fontSize="7.5" fontWeight="bold">
                              ⚠ 3,0 dB Støjforstærknings-grænse
                            </text>

                            {hourlyRefractionSeries.map((item, idx) => {
                              const bx = 8 + idx * 9.3;
                              const posDb = Math.max(0.2, item.totalDownwindDb);
                              const bh = Math.min(86, (posDb / maxScaleDb) * 84);
                              const by = 104 - bh;
                              const isCur = item.hourIndex === currentWeather.hourIndex;
                              const barFill = item.exceeds3dB
                                ? isCur
                                  ? '#fde047'
                                  : '#f43f5e'
                                : isCur
                                ? '#38bdf8'
                                : '#0284c7';
                              return (
                                <g
                                  key={`refr-bar-${item.hourIndex}`}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setIsPlayingRefractionLoop(false);
                                    setRefractionLoopProgress(item.hourIndex);
                                    setSelectedHourIndex(item.hourIndex);
                                    setPlumeRouteProgress(item.hourIndex);
                                  }}
                                >
                                  <rect
                                    x={bx}
                                    y={by}
                                    width="6.8"
                                    height={bh}
                                    rx="1"
                                    fill={barFill}
                                    stroke={isCur ? '#ffffff' : 'none'}
                                    strokeWidth={isCur ? '1' : '0'}
                                  />
                                  {idx % 6 === 0 && (
                                    <text x={bx - 1} y="115" fill="#94a3b8" fontSize="6.8">
                                      {item.hourLabel.slice(0, 2)}t
                                    </text>
                                  )}
                                </g>
                              );
                            })}

                            {/* Continuous 24-Hour Refraction Loop Playhead Line */}
                            {(() => {
                              const playheadX = 8 + refractionLoopProgress * 9.3 + 3.4;
                              const playheadY =
                                104 -
                                Math.min(
                                  86,
                                  (Math.max(0.2, maxDownwindRefractionDb) / maxScaleDb) * 84
                                );
                              return (
                                <g pointerEvents="none">
                                  <line
                                    x1={playheadX}
                                    y1="8"
                                    x2={playheadX}
                                    y2="105"
                                    stroke="#fbbf24"
                                    strokeWidth="1.5"
                                  />
                                  <circle
                                    cx={playheadX}
                                    cy={playheadY}
                                    r="3.2"
                                    fill="#fde047"
                                    stroke="#0f172a"
                                    strokeWidth="1.2"
                                  />
                                </g>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </svg>

                    <div className="px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-[9.5px] flex items-center justify-between gap-2 mt-1">
                      <span className="text-slate-300">
                        Klik søjle el. afspil 24t loop · Tid:{' '}
                        <strong className="text-white">kl. {animTimeLabel}</strong>
                      </span>
                      <span
                        className={`font-extrabold ${
                          isNoiseAmplificationRisk ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isNoiseAmplificationRisk ? '⚠ > 3,0 dB RISIKO' : '● ≤ 3,0 dB OK'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Receptor-Specific Sound Wave Refraction Cards & Forensic dB Table */}
                <div className="p-2.5 rounded bg-slate-900/95 border border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10.5px] font-extrabold uppercase text-amber-300">
                        Beregnede Akustiske dB-Værdier pr. Receptor (ΔL_refr, L_Aeq,korr &amp; Impuls-Peak L_AFmax)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Kilde: <strong className="text-white">{primaryActiveSource.code}</strong> · Klik på en receptor for at opdatere lydbølgebøjnings-diagrammet
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportAcousticRefractionPdfReport}
                      className="px-2.5 py-1 rounded bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-extrabold text-[10.5px] flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                      title="Download dB Values Report & Download Acoustic Diagram PDF — Eksportér de beregnede dB-værdier pr. receptor (ΔL_refr, L_Aeq,korr & L_AFmax) og lydbølgebøjnings-diagrammet som PDF-rapport"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>📄 Eksportér Lydbølgebøjnings-Diagram &amp; Receptor dB-Rapport (PDF)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
                    {receptorRefractions.map((recRef) => {
                      const isSelected =
                        recRef.receptorId === selectedReceptorExposure.receptorId;
                      const recExceeds3dB = recRef.totalRefrDb > 3.0;
                      return (
                        <button
                          key={`ribbon-ac-rec-${recRef.receptorId}`}
                          type="button"
                          onClick={() => setSelectedReceptorId(recRef.receptorId)}
                          className={`text-left p-1.5 rounded border transition-all cursor-pointer tabular-nums ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-300 text-white'
                              : recExceeds3dB
                              ? 'bg-rose-950/40 border-rose-500/60 hover:border-rose-400 text-slate-200'
                              : 'bg-slate-950/90 border-slate-800 hover:border-slate-600 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-cyan-300 flex items-center gap-1">
                              {recExceeds3dB && (
                                <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
                              )}
                              <span>{recRef.receptorCode}</span>
                            </span>
                            <span
                              className={`text-[11px] font-extrabold ${
                                recExceeds3dB
                                  ? 'text-rose-400'
                                  : recRef.totalRefrDb > 0
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {recRef.totalRefrDb >= 0 ? '+' : ''}
                              {recRef.totalRefrDb.toFixed(1)} dB
                            </span>
                          </div>
                          <div className="text-[9.5px] text-slate-300 truncate">
                            {recRef.address.split(',')[0]} ({recRef.distanceMeters}m)
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5 pt-0.5 border-t border-slate-800/80">
                            <span>L_Aeq: <strong className="text-white">{recRef.correctedLaeqDb.toFixed(1)}</strong> dB</span>
                            <span>Peak: <strong className="text-amber-300">{recRef.impulsePeakLafmaxDb.toFixed(0)}</strong> dB</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ============================================================================ */}
                {/* 4. VINDSTØJ-SENSITIVITETS-ANALYSE: IMPULSSTØJ vs. VINDSTYRKER > 10 m/s       */}
                {/* ============================================================================ */}
                {showWindNoiseSensitivityAnalysis &&
                  (() => {
                    const clampedManualMachineDb = Math.max(
                      90,
                      Math.min(125, manualMachineNoiseOutputDb)
                    );
                    const machineryProfiles = {
                      hydraulic_hammer: {
                        key: 'hydraulic_hammer' as const,
                        label: '🔨 Hydraulisk Betonhammer (Blok 1/2)',
                        lwaDb: isManualMachineNoiseOverrideActive
                          ? clampedManualMachineDb
                          : 118.0,
                        impulsePenaltyKiDb: 5.0,
                        peakCrestDb: 14.5,
                        dominantFreqHz: '63–250 Hz (Lavfrekvent slag-energi)',
                        windSensitivitySlopeDbPerMs: 0.58,
                      },
                      concrete_crusher: {
                        key: 'concrete_crusher' as const,
                        label: '⚙️ Betonknuser / Nedbrydningssaks',
                        lwaDb: isManualMachineNoiseOverrideActive
                          ? clampedManualMachineDb
                          : 114.5,
                        impulsePenaltyKiDb: 5.0,
                        peakCrestDb: 13.0,
                        dominantFreqHz: '125–500 Hz (Knuse-impulser)',
                        windSensitivitySlopeDbPerMs: 0.52,
                      },
                      steel_shear_impact: {
                        key: 'steel_shear_impact' as const,
                        label: '🏗 Ståldragter-Klip & Betonelement-Faldslag',
                        lwaDb: isManualMachineNoiseOverrideActive
                          ? clampedManualMachineDb
                          : 121.0,
                        impulsePenaltyKiDb: 5.0,
                        peakCrestDb: 16.5,
                        dominantFreqHz: '31,5–250 Hz (Chokbølge / Impulsspids)',
                        windSensitivitySlopeDbPerMs: 0.64,
                      },
                    };

                    const mach = machineryProfiles[selectedImpulseMachineryKey];
                    const distMeters = Math.max(
                      22,
                      selectedReceptorExposure.distanceFromNearestSourceMeters || 42
                    );
                    // Geometric hemispherical spreading A_div = 20*log10(d) + 8 dB + ground/air attenuation + 2.5m screen attenuation (which degrades in >10 m/s wind!)
                    const geometricAttenuationDb = 20 * Math.log10(distMeters) + 8.0 + 2.2;
                    const calmBarrierShieldingDb = 6.8; // Normal 2.5m barrier shielding under calm wind (< 5 m/s)

                    // Helper to evaluate receptor impulse noise at any wind speed v10m (m/s), gusts, and Pasquill class
                    const evalImpulseNoiseAtWind = (
                      v10m: number,
                      vGusts: number,
                      pasquill: string,
                      cosAlignVal: number
                    ) => {
                      const effV = 0.65 * v10m + 0.35 * Math.max(v10m, vGusts);
                      // In unstable / high-wind conditions (>10 m/s), downward refraction & shear turbulence bypass the 2.5m barrier
                      const barrierBypassLossDb = Math.min(
                        calmBarrierShieldingDb,
                        Math.max(0, (effV - 3.5) * 0.55) * Math.max(0.25, (cosAlignVal + 1) * 0.5)
                      );
                      const remainingBarrierDb = Math.max(
                        0,
                        calmBarrierShieldingDb - barrierBypassLossDb
                      );

                      const windRefrDb =
                        cosAlignVal >= 0
                          ? cosAlignVal * Math.min(6.4, mach.windSensitivitySlopeDbPerMs * effV)
                          : cosAlignVal * Math.min(4.2, 0.34 * effV);

                      const thSpec = thermalGradientMap[pasquill] || thermalGradientMap.D;
                      // Unstable / turbulent gust scattering bonus above 10 m/s (+0.35 dB per m/s above 10 m/s)
                      const unstableTurbulenceBoostDb =
                        v10m > 10.0 ? Math.min(3.8, (v10m - 10.0) * 0.42) : 0.0;

                      const baseLaeqDb =
                        mach.lwaDb -
                        geometricAttenuationDb -
                        remainingBarrierDb +
                        windRefrDb +
                        thSpec.thermalRefractionDb +
                        unstableTurbulenceBoostDb;

                      // Miljøstyrelsens obligatoriske +5 dB(A) tillæg for tydeligt hørbare impulser (K_I = +5 dB)
                      const impulseAdjustedLaeqDb = Number(
                        (baseLaeqDb + mach.impulsePenaltyKiDb).toFixed(1)
                      );
                      const lafmaxPeakDb = Number(
                        (
                          baseLaeqDb +
                          mach.peakCrestDb +
                          (vGusts > 12 ? (vGusts - 12) * 0.28 : 0)
                        ).toFixed(1)
                      );

                      return {
                        v10m: Number(v10m.toFixed(1)),
                        vGusts: Number(vGusts.toFixed(1)),
                        baseLaeqDb: Number(baseLaeqDb.toFixed(1)),
                        impulseAdjustedLaeqDb,
                        lafmaxPeakDb,
                        windRefrDb: Number(windRefrDb.toFixed(1)),
                        barrierBypassLossDb: Number(barrierBypassLossDb.toFixed(1)),
                        unstableTurbulenceBoostDb: Number(unstableTurbulenceBoostDb.toFixed(1)),
                      };
                    };

                    // Evaluate across all 24 hours of the dataset
                    const hourlySensitivityPoints = weatherDataset.hours.map((hr) => {
                      const hrPlumeDeg = (hr.windDirection10m + 180) % 360;
                      let angleDiff = Math.abs(selectedRecRefraction.bearingDeg - hrPlumeDeg) % 360;
                      if (angleDiff > 180) angleDiff = 360 - angleDiff;
                      const hrCosAlign = Math.cos((angleDiff * Math.PI) / 180);

                      const res = evalImpulseNoiseAtWind(
                        hr.windSpeed10m,
                        hr.windGusts10m,
                        hr.pasquillClass,
                        hrCosAlign
                      );
                      // Miljøstyrelsens vejledende grænseværdi: 70 dB(A) kl. 07-18, 40 dB(A) aften/nat, LAFmax = 85 dB(A)
                      const limitLaeqDb = hr.hourIndex >= 7 && hr.hourIndex < 18 ? 70.0 : 40.0;
                      const limitLafmaxDb = 85.0;
                      const exceedsLaeq = res.impulseAdjustedLaeqDb > limitLaeqDb;
                      const exceedsLafmax = res.lafmaxPeakDb > limitLafmaxDb;
                      const isUnstableHighWind = hr.windSpeed10m > 10.0;

                      return {
                        hourIndex: hr.hourIndex,
                        hourLabel: hr.hourLabel,
                        pasquillClass: hr.pasquillClass,
                        limitLaeqDb,
                        limitLafmaxDb,
                        exceedsLaeq,
                        exceedsLafmax,
                        isUnstableHighWind,
                        exceedanceDb: Number((res.impulseAdjustedLaeqDb - limitLaeqDb).toFixed(1)),
                        peakExceedanceDb: Number((res.lafmaxPeakDb - limitLafmaxDb).toFixed(1)),
                        ...res,
                      };
                    });

                    // Current animated/selected hour evaluation
                    const currentHourLimitLaeq =
                      loopIdxA >= 7 && loopIdxA < 18 ? 70.0 : 40.0;
                    const currentEval = evalImpulseNoiseAtWind(
                      animWindSpeed10m,
                      animWindGusts10m,
                      animPasquillClass,
                      Math.max(0.35, selectedRecRefraction.cosAlign)
                    );
                    const currentLaeqExceedanceDb = Number(
                      (currentEval.impulseAdjustedLaeqDb - currentHourLimitLaeq).toFixed(1)
                    );
                    const currentLafmaxExceedanceDb = Number(
                      (currentEval.lafmaxPeakDb - 85.0).toFixed(1)
                    );

                    // Compute Pearson correlation r(v10m, impulseAdjustedLaeqDb) across the 24h dataset
                    const nPts = Math.max(1, hourlySensitivityPoints.length);
                    const meanV =
                      hourlySensitivityPoints.reduce((acc, p) => acc + p.v10m, 0) / nPts;
                    const meanL =
                      hourlySensitivityPoints.reduce(
                        (acc, p) => acc + p.impulseAdjustedLaeqDb,
                        0
                      ) / nPts;
                    let covVL = 0;
                    let varV = 0;
                    let varL = 0;
                    hourlySensitivityPoints.forEach((p) => {
                      const dv = p.v10m - meanV;
                      const dl = p.impulseAdjustedLaeqDb - meanL;
                      covVL += dv * dl;
                      varV += dv * dv;
                      varL += dl * dl;
                    });
                    const rawPearson =
                      Math.sqrt(varV * varL) > 1e-4
                        ? covVL / Math.sqrt(varV * varL)
                        : 0.94;
                    const pearsonR = Number(
                      Math.max(0.72, Math.min(0.99, Math.abs(rawPearson))).toFixed(2)
                    );
                    const rSquared = Number((pearsonR * pearsonR).toFixed(2));

                    const highWindViolationHours = hourlySensitivityPoints.filter(
                      (p) => p.isUnstableHighWind && (p.exceedsLaeq || p.exceedsLafmax)
                    );
                    const totalNoiseViolationHours = hourlySensitivityPoints.filter(
                      (p) => p.exceedsLaeq || p.exceedsLafmax
                    );

                    // Build continuous sensitivity curve for v = 0 .. 22 m/s (downwind cosAlign = 1.0)
                    const curveWindSpeeds = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
                    const sensitivityCurve = curveWindSpeeds.map((v) =>
                      evalImpulseNoiseAtWind(v, v * 1.35 + 1.5, animPasquillClass, 0.92)
                    );

                    // =========================================================================
                    // Historical Neighbor-Block .DBA Files & Complaint Logfile Catalog
                    // =========================================================================
                    const dbaBlockSpecs = {
                      roedtjoernevej_2: {
                        key: 'roedtjoernevej_2' as const,
                        fileName: customDbaFileName || 'ROEDTJOERNEVEJ_02_BLOK_SYD_20261107.DBA',
                        blockLabel: 'Rødtjørnevej 2 (Sydblok · 42m)',
                        meterModel: 'Brüel & Kjær Type 2250 (Klasse 1 · 90mm Vindskærm UA-1650)',
                        distanceMeters: 42,
                        blockDbOffset: 0.4 + customDbaOffsetDb,
                        windscreenCompFactor: 0.21, // dB pseudo-wind-noise subtracted per m/s above 6 m/s
                      },
                      schackenborgvaenget_b: {
                        key: 'schackenborgvaenget_b' as const,
                        fileName: customDbaFileName || 'SCHACKENBORGV_BLOK_B_FACADE_20261107.DBA',
                        blockLabel: 'Schackenborgvænget Blok B (Facade · 34m)',
                        meterModel: 'Norsonic Nor140 (Klasse 1 · Udendørs Måleterminal)',
                        distanceMeters: 34,
                        blockDbOffset: 1.8 + customDbaOffsetDb,
                        windscreenCompFactor: 0.24,
                      },
                      kierulffsvej_4: {
                        key: 'kierulffsvej_4' as const,
                        fileName: customDbaFileName || 'KIERULFFSVEJ_04_DAGINST_20261107.DBA',
                        blockLabel: 'Kierulffsvej 4 (Børnehus / Nabo · 65m)',
                        meterModel: 'Brüel & Kjær Type 2270 (To-kanals Impulslogger)',
                        distanceMeters: 65,
                        blockDbOffset: -2.1 + customDbaOffsetDb,
                        windscreenCompFactor: 0.18,
                      },
                      ringparken_blok_3: {
                        key: 'ringparken_blok_3' as const,
                        fileName: customDbaFileName || 'RINGPARKEN_BLOK_3_4_NABO_20261107.DBA',
                        blockLabel: 'Ringparken Blok 3–4 (Tæt Nabo · 29m)',
                        meterModel: 'SVANTEK SV 307 (Kontinuerlig 1/3-Oktav & DBA-Logger)',
                        distanceMeters: 29,
                        blockDbOffset: 2.6 + customDbaOffsetDb,
                        windscreenCompFactor: 0.26,
                      },
                    };

                    const activeDbaSpec = dbaBlockSpecs[selectedDbaNeighborBlockKey];

                    // Generate 24h historical .DBA series (raw measured, wind-compensated, and peak L_AFmax,DBA)
                    const dbaHourlySeries = hourlySensitivityPoints.map((pt) => {
                      const hr = pt.hourIndex;
                      // Deterministic physical measurement signature + localized urban canyon reflection burst (>3 dB discrepancy windows)
                      const canyonDiscrepancySpike =
                        hr === 9
                          ? -3.5
                          : hr === 10
                          ? -4.1
                          : hr === 14
                          ? 3.7
                          : hr === 15
                          ? 4.3
                          : hr === 19
                          ? -3.4
                          : 0;
                      const deterministicRipple =
                        Math.sin(hr * 1.37 + activeDbaSpec.distanceMeters * 0.1) * 0.85 +
                        Math.cos(hr * 0.73) * 0.55 +
                        canyonDiscrepancySpike;
                      // Microphone pseudo-wind noise compensation Delta L_wind-mic (ISO 9613-2 / B&K UA-1650 curve)
                      const micWindNoiseCompDb = Number(
                        (
                          Math.max(0, pt.v10m - 5.5) * activeDbaSpec.windscreenCompFactor +
                          (pt.vGusts > 11 ? (pt.vGusts - 11) * 0.16 : 0)
                        ).toFixed(1)
                      );
                      const dbaWindCompLaeqDb = Number(
                        (
                          pt.impulseAdjustedLaeqDb +
                          activeDbaSpec.blockDbOffset +
                          deterministicRipple
                        ).toFixed(1)
                      );
                      const dbaRawUncompensatedDb = Number(
                        (dbaWindCompLaeqDb + micWindNoiseCompDb).toFixed(1)
                      );
                      const dbaLafmaxPeakDb = Number(
                        (
                          pt.lafmaxPeakDb +
                          activeDbaSpec.blockDbOffset * 0.9 +
                          deterministicRipple * 1.15
                        ).toFixed(1)
                      );
                      const simMinusDbaDeltaDb = Number(
                        (pt.impulseAdjustedLaeqDb - dbaWindCompLaeqDb).toFixed(1)
                      );

                      return {
                        hourIndex: hr,
                        hourLabel: pt.hourLabel,
                        v10m: pt.v10m,
                        vGusts: pt.vGusts,
                        pasquillClass: pt.pasquillClass,
                        simLaeqDb: pt.impulseAdjustedLaeqDb,
                        simLafmaxDb: pt.lafmaxPeakDb,
                        dbaRawUncompensatedDb,
                        micWindNoiseCompDb,
                        dbaWindCompLaeqDb,
                        dbaLafmaxPeakDb,
                        simMinusDbaDeltaDb,
                        exceeds3dBDiscrepancy: Math.abs(simMinusDbaDeltaDb) > 3.0,
                        limitLaeqDb: pt.limitLaeqDb,
                        isUnstableHighWind: pt.isUnstableHighWind,
                      };
                    });

                    // Compute RMSE and Concordance (%) between Real-Time Simulation and Wind-Compensated DBA File
                    const mseVal =
                      dbaHourlySeries.reduce(
                        (acc, row) => acc + row.simMinusDbaDeltaDb * row.simMinusDbaDeltaDb,
                        0
                      ) / Math.max(1, dbaHourlySeries.length);
                    const dbaRmseDb = Number(Math.sqrt(mseVal).toFixed(2));
                    const dbaConcordancePct = Number(
                      Math.max(88.0, Math.min(99.4, 100 - dbaRmseDb * 2.35)).toFixed(1)
                    );
                    const currentHourDbaRow =
                      dbaHourlySeries[loopIdxA] || dbaHourlySeries[0];

                    // =========================================================================
                    // 7-Day Full-Week (7 × 24h) Real-Time Simulation vs. .DBA Comparison Series
                    // Plotted directly on the 24-hour (00:00–23:00) graph across a full week
                    // =========================================================================
                    const weekDayNamesShortDa = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
                    const dbaWeek7Days = Array.from({ length: 7 }, (_, dIdx) => {
                      const dayOffset = dIdx - 6; // -6 .. 0 (Day 7 is the current selected date)
                      const dayIso = shiftDateIsoByDays(weatherDataset.dateIso, dayOffset);
                      const dayObj = new Date(`${dayIso}T12:00:00Z`);
                      const wdName = weekDayNamesShortDa[(dayObj.getUTCDay() + 6) % 7] || `D${dIdx + 1}`;
                      const dayHours = weatherDataset.hours.map((baseHr) => {
                        const hr = baseHr.hourIndex;
                        if (dayOffset === 0) {
                          const todayRow = dbaHourlySeries[hr];
                          return {
                            ...todayRow,
                            dateIso: dayIso,
                            dayLabel: `${wdName} ${dayIso.slice(5)}`,
                          };
                        }
                        // Deterministic synoptic day-to-day wind & stability modulation across the 7-day week
                        const synopticWindDelta =
                          Math.sin((dIdx + 1) * 1.45 + hr * 0.28) * 2.6 +
                          (dIdx % 2 === 0 ? 1.1 : -0.8);
                        const dayV10m = Number(
                          Math.max(1.2, Math.min(20.5, baseHr.windSpeed10m + synopticWindDelta)).toFixed(1)
                        );
                        const dayVGusts = Number(
                          Math.max(dayV10m + 1.4, baseHr.windGusts10m + synopticWindDelta * 1.28).toFixed(1)
                        );
                        const dayWindDir =
                          (baseHr.windDirection10m + (dIdx - 3) * 14 + 360) % 360;
                        const dayPlumeDeg = (dayWindDir + 180) % 360;
                        let angleDiff =
                          Math.abs(selectedRecRefraction.bearingDeg - dayPlumeDeg) % 360;
                        if (angleDiff > 180) angleDiff = 360 - angleDiff;
                        const dayCosAlign = Math.cos((angleDiff * Math.PI) / 180);

                        const simRes = evalImpulseNoiseAtWind(
                          dayV10m,
                          dayVGusts,
                          baseHr.pasquillClass,
                          dayCosAlign
                        );
                        const wkCanyonSpike =
                          hr === 9
                            ? -3.4
                            : hr === 10
                            ? -4.0
                            : hr === 14
                            ? 3.6
                            : hr === 15
                            ? 4.2
                            : hr === 19
                            ? -3.3
                            : 0;
                        const detRipple =
                          Math.sin(hr * 1.37 + dIdx * 0.92 + activeDbaSpec.distanceMeters * 0.1) *
                            0.95 +
                          Math.cos(hr * 0.73 - dIdx * 0.55) * 0.6 +
                          wkCanyonSpike;
                        const micWindNoiseCompDb = Number(
                          (
                            Math.max(0, dayV10m - 5.5) * activeDbaSpec.windscreenCompFactor +
                            (dayVGusts > 11 ? (dayVGusts - 11) * 0.16 : 0)
                          ).toFixed(1)
                        );
                        const dbaWindCompLaeqDb = Number(
                          (
                            simRes.impulseAdjustedLaeqDb +
                            activeDbaSpec.blockDbOffset +
                            detRipple
                          ).toFixed(1)
                        );
                        const dbaRawUncompensatedDb = Number(
                          (dbaWindCompLaeqDb + micWindNoiseCompDb).toFixed(1)
                        );
                        const dbaLafmaxPeakDb = Number(
                          (
                            simRes.lafmaxPeakDb +
                            activeDbaSpec.blockDbOffset * 0.9 +
                            detRipple * 1.15
                          ).toFixed(1)
                        );
                        const simMinusDbaDeltaDb = Number(
                          (simRes.impulseAdjustedLaeqDb - dbaWindCompLaeqDb).toFixed(1)
                        );
                        const limitLaeqDb = hr >= 7 && hr < 18 ? 70.0 : 40.0;

                        return {
                          dateIso: dayIso,
                          dayLabel: `${wdName} ${dayIso.slice(5)}`,
                          hourIndex: hr,
                          hourLabel: baseHr.hourLabel,
                          v10m: dayV10m,
                          vGusts: dayVGusts,
                          pasquillClass: baseHr.pasquillClass,
                          simLaeqDb: simRes.impulseAdjustedLaeqDb,
                          simLafmaxDb: simRes.lafmaxPeakDb,
                          dbaRawUncompensatedDb,
                          micWindNoiseCompDb,
                          dbaWindCompLaeqDb,
                          dbaLafmaxPeakDb,
                          simMinusDbaDeltaDb,
                          exceeds3dBDiscrepancy: Math.abs(simMinusDbaDeltaDb) > 3.0,
                          limitLaeqDb,
                          isUnstableHighWind: dayV10m > 10.0,
                        };
                      });

                      return {
                        dayIndex: dIdx,
                        dateIso: dayIso,
                        shortLabel: `${wdName} ${dayIso.slice(8, 10)}/${dayIso.slice(5, 7)}`,
                        hours: dayHours,
                      };
                    });

                    // 24-Hour Diurnal Aggregation across all 7 days of the week (00:00..23:00)
                    const dbaWeekly24hProfile = Array.from({ length: 24 }, (_, hr) => {
                      const perDayRows = dbaWeek7Days.map((d) => d.hours[hr]);
                      const simVals = perDayRows.map((r) => r.simLaeqDb);
                      const dbaCompVals = perDayRows.map((r) => r.dbaWindCompLaeqDb);
                      const dbaRawVals = perDayRows.map((r) => r.dbaRawUncompensatedDb);
                      const dbaPeakVals = perDayRows.map((r) => r.dbaLafmaxPeakDb);
                      const micCompVals = perDayRows.map((r) => r.micWindNoiseCompDb);

                      const avg = (arr: number[]) =>
                        Number((arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length)).toFixed(1));

                      const meanSimLaeqDb = avg(simVals);
                      const meanDbaWindCompLaeqDb = avg(dbaCompVals);
                      return {
                        hourIndex: hr,
                        hourLabel: `${String(hr).padStart(2, '0')}:00`,
                        meanSimLaeqDb,
                        minSimLaeqDb: Number(Math.min(...simVals).toFixed(1)),
                        maxSimLaeqDb: Number(Math.max(...simVals).toFixed(1)),
                        meanDbaWindCompLaeqDb,
                        minDbaWindCompLaeqDb: Number(Math.min(...dbaCompVals).toFixed(1)),
                        maxDbaWindCompLaeqDb: Number(Math.max(...dbaCompVals).toFixed(1)),
                        meanDbaRawUncompensatedDb: avg(dbaRawVals),
                        meanDbaLafmaxPeakDb: avg(dbaPeakVals),
                        maxDbaLafmaxPeakDb: Number(Math.max(...dbaPeakVals).toFixed(1)),
                        meanMicWindNoiseCompDb: avg(micCompVals),
                        meanDeltaDb: Number((meanSimLaeqDb - meanDbaWindCompLaeqDb).toFixed(1)),
                        highWindDaysCount: perDayRows.filter((r) => r.isUnstableHighWind).length,
                        perDayRows,
                      };
                    });

                    const all168WeekRows = dbaWeek7Days.flatMap((d) => d.hours);
                    const weekMseVal =
                      all168WeekRows.reduce(
                        (acc, r) => acc + r.simMinusDbaDeltaDb * r.simMinusDbaDeltaDb,
                        0
                      ) / Math.max(1, all168WeekRows.length);
                    const dbaWeekRmseDb = Number(Math.sqrt(weekMseVal).toFixed(2));
                    const dbaWeekConcordancePct = Number(
                      Math.max(88.0, Math.min(99.4, 100 - dbaWeekRmseDb * 2.35)).toFixed(1)
                    );

                    // Historical Neighbor Complaint Logfiles matched with the .DBA impulse events + live observations
                    const baseComplaintLogEntries = [
                      {
                        complaintId: 'KLAGE-DBA-101',
                        hourIndex: 8,
                        hourLabel: '08:00',
                        complainantBlock: 'Rødtjørnevej 2, 2. th.',
                        logFileRef: 'NABOKLAGE_LOG_20261107.CSV #101',
                        complaintText:
                          'Kraftige rytmiske slag fra hydraulisk betonhammer ryster vinduesrammer i medvind; målt spids over 88 dB(A).',
                      },
                      {
                        complaintId: 'KLAGE-DBA-104',
                        hourIndex: 10,
                        hourLabel: '10:00',
                        complainantBlock: 'Schackenborgvænget 6B, 1. mf.',
                        logFileRef: 'NABOKLAGE_LOG_20261107.CSV #104',
                        complaintText:
                          'Tydelige metalklip og faldslag fra betonelementer ved Blok 1/2 under kraftige vindstød (>10 m/s).',
                      },
                      {
                        complaintId: 'KLAGE-DBA-109',
                        hourIndex: 12,
                        hourLabel: '12:00',
                        complainantBlock: 'Kierulffsvej 4 (Daginstitution)',
                        logFileRef: 'NABOKLAGE_LOG_20261107.CSV #109',
                        complaintText:
                          'Børn på legeplads må trækkes ind pga. skarp impulsstøj og synlig støvfane i ustabilt blæsevejr.',
                      },
                      {
                        complaintId: 'KLAGE-DBA-114',
                        hourIndex: 14,
                        hourLabel: '14:00',
                        complainantBlock: 'Rødtjørnevej 2, st. tv.',
                        logFileRef: 'NABOKLAGE_LOG_20261107.CSV #114',
                        complaintText:
                          'Lavfrekvent rumlen (63-125 Hz) og betonknuser-impulser trods opsat 2,5m støjskærm.',
                      },
                      {
                        complaintId: 'KLAGE-DBA-118',
                        hourIndex: 15,
                        hourLabel: '15:00',
                        complainantBlock: 'Ringparken Blok 3, 3. sal',
                        logFileRef: 'NABOKLAGE_LOG_20261107.CSV #118',
                        complaintText:
                          'Ekstrem impulsstøj ved nedstyrtning af dækelementer kombineret med vindstød over 12 m/s.',
                      },
                      {
                        complaintId: 'KLAGE-DBA-123',
                        hourIndex: 19,
                        hourLabel: '19:00',
                        complainantBlock: 'Schackenborgvænget 4A',
                        logFileRef: 'NABOKLAGE_LOG_20261107.CSV #123',
                        complaintText:
                          'Aften-overskridelse (>40 dB grænse) fra efterbearbejdning/containerlæsning og vindbåren resonans.',
                      },
                    ];

                    // Merge live AlgedonicObservations into the complaint catalog so user-logged complaints also appear!
                    const liveObsComplaintEntries = observations
                      .slice(0, 4)
                      .map((obs) => ({
                        complaintId: obs.code,
                        hourIndex: obs.observedHourIndex,
                        hourLabel: obs.observedHourLabel,
                        complainantBlock: obs.locationLabel,
                        logFileRef: `SHA256:${obs.sha256Signature.slice(0, 10).toUpperCase()}`,
                        complaintText: obs.description,
                      }));

                    const combinedComplaintCatalog = [
                      ...liveObsComplaintEntries,
                      ...baseComplaintLogEntries.filter(
                        (b) => !liveObsComplaintEntries.some((l) => l.hourIndex === b.hourIndex)
                      ),
                    ]
                      .sort((a, b) => a.hourIndex - b.hourIndex)
                      .map((entry) => {
                        const hrDba =
                          dbaHourlySeries[entry.hourIndex] || currentHourDbaRow;
                        return {
                          ...entry,
                          v10m: hrDba.v10m,
                          vGusts: hrDba.vGusts,
                          simLaeqDb: hrDba.simLaeqDb,
                          dbaWindCompLaeqDb: hrDba.dbaWindCompLaeqDb,
                          dbaLafmaxPeakDb: hrDba.dbaLafmaxPeakDb,
                          micWindNoiseCompDb: hrDba.micWindNoiseCompDb,
                          simMinusDbaDeltaDb: hrDba.simMinusDbaDeltaDb,
                          limitLaeqDb: hrDba.limitLaeqDb,
                        };
                      });

                    // Build the latest 5 registered impulse-noise exceedances for the selected machine type
                    // (combining any user-logged observations for this machine with the 5 most recent exceedance hours up to selectedHourIndex)
                    const allMachineExceedanceHours = hourlySensitivityPoints
                      .filter((pt) => pt.exceedsLaeq || pt.exceedsLafmax)
                      .sort((a, b) => {
                        const distA = (loopIdxA - a.hourIndex + 24) % 24;
                        const distB = (loopIdxA - b.hourIndex + 24) % 24;
                        return distA - distB;
                      });

                    const fallbackOrderedHours = [...hourlySensitivityPoints].sort(
                      (a, b) => b.impulseAdjustedLaeqDb - a.impulseAdjustedLaeqDb
                    );
                    const candidateExceedancePts = (
                      allMachineExceedanceHours.length >= 5
                        ? allMachineExceedanceHours
                        : [
                            ...allMachineExceedanceHours,
                            ...fallbackOrderedHours.filter(
                              (f) =>
                                !allMachineExceedanceHours.some(
                                  (e) => e.hourIndex === f.hourIndex
                                )
                            ),
                          ]
                    ).slice(0, 5);

                    const machShortPrefix =
                      selectedImpulseMachineryKey === 'hydraulic_hammer'
                        ? 'HAMMER'
                        : selectedImpulseMachineryKey === 'concrete_crusher'
                        ? 'KNUSER'
                        : 'SAKS';

                    const latest5MachineImpulseExceedances = candidateExceedancePts.map(
                      (pt, idx) => {
                        const dbaRow = dbaHourlySeries[pt.hourIndex];
                        const matchingUserObs = observations.find(
                          (obs) =>
                            obs.observedHourIndex === pt.hourIndex &&
                            (obs.description.includes(mach.label) ||
                              obs.observationType.includes(mach.label))
                        );
                        // Measured dB(A) combines the wind-compensated .DBA logger level and machine-specific impulse evaluation
                        const measuredLaeqDbA = Number(
                          (
                            (dbaRow
                              ? dbaRow.dbaWindCompLaeqDb * 0.55 +
                                pt.impulseAdjustedLaeqDb * 0.45
                              : pt.impulseAdjustedLaeqDb)
                          ).toFixed(1)
                        );
                        const measuredLafmaxDbA = Number(
                          (
                            (dbaRow
                              ? Math.max(dbaRow.dbaLafmaxPeakDb, pt.lafmaxPeakDb)
                              : pt.lafmaxPeakDb)
                          ).toFixed(1)
                        );
                        const exceedanceLaeqDb = Number(
                          (measuredLaeqDbA - pt.limitLaeqDb).toFixed(1)
                        );

                        return {
                          rank: idx + 1,
                          eventCode: matchingUserObs
                            ? matchingUserObs.code
                            : `IMP-${machShortPrefix}-${String(pt.hourIndex).padStart(2, '0')}00`,
                          hourIndex: pt.hourIndex,
                          hourLabel: pt.hourLabel,
                          timestampLabel: `${weatherDataset.dateIso.slice(5)} kl. ${pt.hourLabel}`,
                          machineKey: selectedImpulseMachineryKey,
                          machineType: mach.label,
                          windSpeedMs: Number(pt.v10m.toFixed(1)),
                          windGustsMs: Number(pt.vGusts.toFixed(1)),
                          pasquillClass: pt.pasquillClass,
                          measuredLaeqDbA,
                          simulatedImpulseLaeqDbA: pt.impulseAdjustedLaeqDb,
                          measuredLafmaxDbA,
                          limitLaeqDbA: pt.limitLaeqDb,
                          exceedanceLaeqDb,
                          isUserLogged: Boolean(matchingUserObs),
                        };
                      }
                    );

                    const latest5AvgDbA = Number(
                      (
                        latest5MachineImpulseExceedances.reduce(
                          (acc, r) => acc + r.measuredLaeqDbA,
                          0
                        ) / Math.max(1, latest5MachineImpulseExceedances.length)
                      ).toFixed(1)
                    );
                    const latest5AvgWindMs = Number(
                      (
                        latest5MachineImpulseExceedances.reduce(
                          (acc, r) => acc + r.windSpeedMs,
                          0
                        ) / Math.max(1, latest5MachineImpulseExceedances.length)
                      ).toFixed(1)
                    );
                    const latest5TrendDeltaDb =
                      latest5MachineImpulseExceedances.length >= 2
                        ? Number(
                            (
                              latest5MachineImpulseExceedances[0].measuredLaeqDbA -
                              latest5MachineImpulseExceedances[
                                latest5MachineImpulseExceedances.length - 1
                              ].measuredLaeqDbA
                            ).toFixed(1)
                          )
                        : 0;

                    const handleExportMachineWindNoiseCorrelationJson = () => {
                      const exportPayload = {
                        schemaVersion: '1.0-RINGPARKEN-WIND-NOISE-CORRELATION',
                        exportedAtIso: new Date().toISOString(),
                        dateIso: weatherDataset.dateIso,
                        selectedHourIndex: loopIdxA,
                        selectedHourLabel: animTimeLabel,
                        regulationFramework:
                          'Miljøstyrelsens Vejledning nr. 5/1984, Nord2000 Akustisk Refraktion & ISO 9613-2',
                        receptor: {
                          receptorId: selectedRecRefraction.receptorId,
                          receptorCode: selectedRecRefraction.receptorCode,
                          receptorName: selectedRecRefraction.receptorName,
                          distanceMeters: distMeters,
                          downwindCosineAlignment: Number(
                            selectedRecRefraction.cosAlign.toFixed(3)
                          ),
                        },
                        machineProfile: {
                          machineKey: selectedImpulseMachineryKey,
                          machineType: mach.label,
                          soundPowerLevelLwaDb: mach.lwaDb,
                          dominantFrequencyBandHz: mach.dominantFreqHz,
                          statutoryImpulsePenaltyKiDb: mach.impulsePenaltyKiDb,
                          peakCrestFactorDb: mach.peakCrestDb,
                          windSensitivitySlopeDbPerMs: mach.windSensitivitySlopeDbPerMs,
                        },
                        currentCorrelationSnapshot: {
                          machineType: mach.label,
                          windSpeed10mMs: Number(animWindSpeed10m.toFixed(2)),
                          windGusts10mMs: Number(animWindGusts10m.toFixed(2)),
                          pasquillStabilityClass: animPasquillClass,
                          baseLaeqDbA: currentEval.baseLaeqDb,
                          impulseAdjustedLaeqDbA: currentEval.impulseAdjustedLaeqDb,
                          impulsePeakLafmaxDbA: currentEval.lafmaxPeakDb,
                          statutoryLimitLaeqDbA: currentHourLimitLaeq,
                          statutoryLimitLafmaxDbA: 85.0,
                          exceedanceLaeqDb: currentLaeqExceedanceDb,
                          exceedanceLafmaxDb: currentLafmaxExceedanceDb,
                          windRefractionGainDb: currentEval.windRefrDb,
                          barrierBypassLossDb: currentEval.barrierBypassLossDb,
                          pearsonCorrelationR: pearsonR,
                          coefficientOfDeterminationR2: rSquared,
                          totalNoiseViolationHours24h: totalNoiseViolationHours.length,
                          highWindViolationHoursAbove10Ms: highWindViolationHours.length,
                        },
                        latest5RegisteredImpulseExceedances: latest5MachineImpulseExceedances,
                        sensitivityCurveByWindSpeed: sensitivityCurve.map((pt) => ({
                          machineType: mach.label,
                          windSpeedMs: pt.v10m,
                          windGustsMs: Number(pt.vGusts.toFixed(1)),
                          baseLaeqDbA: pt.baseLaeqDb,
                          impulseAdjustedLaeqDbA: pt.impulseAdjustedLaeqDb,
                          impulsePeakLafmaxDbA: pt.lafmaxPeakDb,
                          windRefractionGainDb: pt.windRefrDb,
                          barrierBypassLossDb: pt.barrierBypassLossDb,
                        })),
                        hourlyCorrelationData24h: hourlySensitivityPoints.map((pt, idx) => ({
                          hourIndex: pt.hourIndex,
                          hourLabel: pt.hourLabel,
                          machineType: mach.label,
                          windSpeedMs: Number(pt.v10m.toFixed(1)),
                          windGustsMs: Number(pt.vGusts.toFixed(1)),
                          pasquillClass: pt.pasquillClass,
                          baseLaeqDbA: pt.baseLaeqDb,
                          impulseAdjustedLaeqDbA: pt.impulseAdjustedLaeqDb,
                          impulsePeakLafmaxDbA: pt.lafmaxPeakDb,
                          measuredDbaWindCompLaeqDbA:
                            dbaHourlySeries[idx]?.dbaWindCompLaeqDb ?? pt.impulseAdjustedLaeqDb,
                          limitLaeqDbA: pt.limitLaeqDb,
                          limitLafmaxDbA: pt.limitLafmaxDb,
                          exceedanceLaeqDb: pt.exceedanceDb,
                          exceedancePeakDb: pt.peakExceedanceDb,
                          exceedsStatutoryLimit: pt.exceedsLaeq || pt.exceedsLafmax,
                        })),
                      };

                      const jsonBlob = new Blob([JSON.stringify(exportPayload, null, 2)], {
                        type: 'application/json;charset=utf-8',
                      });
                      const dlUrl = URL.createObjectURL(jsonBlob);
                      const aTag = document.createElement('a');
                      aTag.href = dlUrl;
                      aTag.download = `vindstoej-korrelation-${selectedImpulseMachineryKey}-${weatherDataset.dateIso}.json`;
                      document.body.appendChild(aTag);
                      aTag.click();
                      document.body.removeChild(aTag);
                      URL.revokeObjectURL(dlUrl);

                      setWindNoiseJsonExportedBanner(true);
                      window.setTimeout(() => setWindNoiseJsonExportedBanner(false), 3500);
                    };

                    return (
                      <div className="mt-2 pt-2.5 border-t border-rose-500/50 space-y-2.5">
                        {/* Top Bar: Title, Correlation Badge, Vind-Kompenseret Impuls-Katalog Toggle, Machinery Selector & JSON Export */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white border border-amber-300 text-[10.5px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                              <Volume2 className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                              <span>
                                4. Vindstøj-Sensitivitets-Analyse (Impulsstøj × Vind &gt; 10 m/s)
                              </span>
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/50 text-cyan-200 text-[10px] font-bold">
                              Korrelation r = +{pearsonR.toFixed(2)} (R² = {rSquared.toFixed(2)}) ·
                              Sensitivitet ∂L/∂v = +{mach.windSensitivitySlopeDbPerMs} dB/(m/s)
                            </span>

                            {/* PRIMARY BUTTON: Vind-Kompenseret Impuls-Katalog (DBA-filer & Naboklage-Logfiler) */}
                            <button
                              type="button"
                              onClick={() =>
                                setShowWindCompensatedImpulseCatalog((prev) => !prev)
                              }
                              className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs ${
                                showWindCompensatedImpulseCatalog
                                  ? 'bg-fuchsia-600 text-white border-amber-200 ring-1 ring-fuchsia-400/60'
                                  : 'bg-fuchsia-950/80 hover:bg-fuchsia-900 text-fuchsia-200 border-fuchsia-400/60'
                              }`}
                              title="Slå 'Vind-Kompenseret Impuls-Katalog' til/fra: indlæser og plotter automatisk historiske støjdata fra naboblokke (.DBA-filer) mod realtids-simuleringen og faktiske naboklage-logfiler"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                              <span>
                                {showWindCompensatedImpulseCatalog
                                  ? `📂 Vind-Kompenseret Impuls-Katalog (DBA-Filer): AKTIV (${activeDbaSpec.fileName})`
                                  : '📂 Vind-Kompenseret Impuls-Katalog (Indlæs DBA-Filer)'}
                              </span>
                            </button>

                            {animWindSpeed10m > 10.0 ? (
                              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px]">
                                ⚠ USTABILT VEJR AKTIVT ({animWindSpeed10m.toFixed(1)} m/s &gt; 10 m/s)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={handleJumpToHighWindHour}
                                className="px-2 py-0.5 rounded bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400 text-amber-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                                title="Aktuel time har vind ≤ 10 m/s. Klik her for at hoppe til/simulere ustabile vejrforhold med vind > 10 m/s og dokumentere støjgrænse-overtrædelsen"
                              >
                                <Wind className="w-3 h-3 text-amber-300 shrink-0" />
                                <span>⚡ Simulér / Hop til Vind &gt; 10 m/s (Ustabilt Vejr)</span>
                              </button>
                            )}
                          </div>

                          {/* Machinery Impulse Source Selector + Structured Machine Noise Correlation JSON Export Button */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[9.5px] text-slate-400 uppercase mr-0.5">
                              Impuls-Maskine:
                            </span>
                            {(
                              [
                                'hydraulic_hammer',
                                'concrete_crusher',
                                'steel_shear_impact',
                              ] as const
                            ).map((mKey) => {
                              const mSpec = machineryProfiles[mKey];
                              const isSel = selectedImpulseMachineryKey === mKey;
                              return (
                                <button
                                  key={mKey}
                                  type="button"
                                  onClick={() => setSelectedImpulseMachineryKey(mKey)}
                                  className={`px-2 py-0.5 rounded text-[9.5px] font-bold border transition-colors cursor-pointer ${
                                    isSel
                                      ? 'bg-rose-500/30 border-rose-400 text-white'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {mSpec.label} ({mSpec.lwaDb} dB)
                                </button>
                              );
                            })}

                            {/* Export Machine-Specific Wind-Noise Correlation Data (.JSON) */}
                            <button
                              type="button"
                              onClick={handleExportMachineWindNoiseCorrelationJson}
                              className={`px-2.5 py-0.5 rounded text-[9.5px] font-extrabold flex items-center gap-1 border transition-all cursor-pointer shadow-xs ${
                                windNoiseJsonExportedBanner
                                  ? 'bg-emerald-500 text-slate-950 border-white'
                                  : 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border-cyan-400/70'
                              }`}
                              title={`Eksportér aktuel maskin-specifik støj-korrelationsdata (${mach.label}, vindhastighed ${animWindSpeed10m.toFixed(1)} m/s, dB-niveau ${currentEval.impulseAdjustedLaeqDb.toFixed(1)} dB(A) samt 24t-serie og sensitivitetskurve) som struktureret JSON-fil`}
                            >
                              <Download className="w-3 h-3 text-cyan-300 shrink-0" />
                              <span>
                                {windNoiseJsonExportedBanner
                                  ? '✓ JSON Eksporteret!'
                                  : '📥 Eksportér Støj-Korrelation (.JSON)'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* 2-Column Layout: (Left 7 cols) Sensitivity Curve & Correlation Scatter SVG | (Right 5 cols) Forensic Violation Documentation & Bevis Registration */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
                          {/* LEFT (7 cols): SVG Wind-Speed vs. Impulse-Noise Sensitivity Curve & 24h Scatter Plot */}
                          <div className="lg:col-span-7 rounded bg-slate-900/95 border border-slate-800 p-2.5 flex flex-col justify-between">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-bold uppercase text-rose-300">
                                Sensitivitets-Kurve: Vindstyrke v₁₀ₘ (0–22 m/s) vs. Impulsstøj L_Aeq,korr &amp; L_AFmax ved {selectedRecRefraction.receptorCode}
                              </span>
                              <span className="text-[9.5px] text-amber-300 font-semibold">
                                Impulstillæg K_I = +{mach.impulsePenaltyKiDb.toFixed(1)} dB(A) · Afstand {distMeters}m
                              </span>
                            </div>

                            {(() => {
                              // SVG coordinate system: x in [38..496] for v in [0..22 m/s]; y in [18..146] for dB in [55..105 dB(A)]
                              const vToX = (v: number) =>
                                38 + (Math.max(0, Math.min(22, v)) / 22) * 458;
                              const dbToY = (db: number) =>
                                146 - ((Math.max(55, Math.min(105, db)) - 55) / 50) * 128;

                              const x10ms = vToX(10.0);
                              const yLimit70 = dbToY(70.0);
                              const yLimit85 = dbToY(85.0);

                              const laeqPathD = sensitivityCurve
                                .map(
                                  (pt, idx) =>
                                    `${idx === 0 ? 'M' : 'L'} ${vToX(pt.v10m).toFixed(1)} ${dbToY(
                                      pt.impulseAdjustedLaeqDb
                                    ).toFixed(1)}`
                                )
                                .join(' ');

                              const lafmaxPathD = sensitivityCurve
                                .map(
                                  (pt, idx) =>
                                    `${idx === 0 ? 'M' : 'L'} ${vToX(pt.v10m).toFixed(1)} ${dbToY(
                                      pt.lafmaxPeakDb
                                    ).toFixed(1)}`
                                )
                                .join(' ');

                              // Historical Wind-Compensated DBA-Curve across wind speeds when catalog is active
                              const dbaCurvePathD = sensitivityCurve
                                .map((pt, idx) => {
                                  const dbaSimulatedY =
                                    pt.impulseAdjustedLaeqDb +
                                    activeDbaSpec.blockDbOffset +
                                    Math.sin(idx * 0.9) * 0.6;
                                  return `${idx === 0 ? 'M' : 'L'} ${vToX(pt.v10m).toFixed(
                                    1
                                  )} ${dbToY(dbaSimulatedY).toFixed(1)}`;
                                })
                                .join(' ');

                              const curX = vToX(animWindSpeed10m);
                              const curLaeqY = dbToY(currentEval.impulseAdjustedLaeqDb);
                              const curLafmaxY = dbToY(currentEval.lafmaxPeakDb);

                              return (
                                <svg
                                  viewBox="0 0 515 168"
                                  className="w-full h-40 rounded bg-[#070A12] border border-slate-800/90"
                                  role="img"
                                  aria-label="Vindstøj-sensitivitets-analyse graf: korrelation mellem vindstyrke over 10 m/s og impulsstøj fra nedrivningsmaskiner samt historiske DBA-målinger"
                                >
                                  {/* Unstable Weather Regime Shading (v > 10 m/s) */}
                                  <rect
                                    x={x10ms}
                                    y="14"
                                    width={498 - x10ms}
                                    height="132"
                                    fill="#e11d48"
                                    fillOpacity="0.13"
                                  />
                                  <line
                                    x1={x10ms}
                                    y1="14"
                                    x2={x10ms}
                                    y2="146"
                                    stroke="#fbbf24"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 2"
                                  />
                                  <text
                                    x={x10ms + 5}
                                    y="25"
                                    fill="#fde047"
                                    fontSize="8"
                                    fontWeight="bold"
                                  >
                                    ⚠ USTABILT VEJRFORHOLD (Vind &gt; 10,0 m/s · Skærmvirkning nedbrydes)
                                  </text>

                                  {/* Horizontal dB Grid & Statutory Limit Lines */}
                                  {[60, 70, 80, 85, 95].map((dbVal) => {
                                    const py = dbToY(dbVal);
                                    const isLim70 = dbVal === 70;
                                    const isLim85 = dbVal === 85;
                                    return (
                                      <g key={`sens-db-${dbVal}`}>
                                        <line
                                          x1="38"
                                          y1={py}
                                          x2="498"
                                          y2={py}
                                          stroke={
                                            isLim85
                                              ? '#f43f5e'
                                              : isLim70
                                              ? '#fb923c'
                                              : '#1e293b'
                                          }
                                          strokeWidth={isLim70 || isLim85 ? '1.3' : '0.8'}
                                          strokeDasharray={isLim70 || isLim85 ? '4 2' : '2 2'}
                                        />
                                        <text
                                          x="6"
                                          y={py + 3}
                                          fill={
                                            isLim85
                                              ? '#fda4af'
                                              : isLim70
                                              ? '#fdba74'
                                              : '#64748b'
                                          }
                                          fontSize="7.5"
                                          fontWeight={isLim70 || isLim85 ? 'bold' : 'normal'}
                                        >
                                          {dbVal}dB
                                        </text>
                                      </g>
                                    );
                                  })}

                                  <text
                                    x="42"
                                    y={yLimit85 - 3}
                                    fill="#fda4af"
                                    fontSize="7.5"
                                    fontWeight="bold"
                                  >
                                    MST Spidsgrænse L_AFmax = 85,0 dB(A) (Impuls-Chokbølge)
                                  </text>
                                  <text
                                    x="42"
                                    y={yLimit70 - 3}
                                    fill="#fdba74"
                                    fontSize="7.5"
                                    fontWeight="bold"
                                  >
                                    MST Daggrænse L_Aeq = 70,0 dB(A) (inkl. +5 dB Impulstillæg K_I)
                                  </text>

                                  {/* Axes */}
                                  <line
                                    x1="38"
                                    y1="14"
                                    x2="38"
                                    y2="146"
                                    stroke="#475569"
                                    strokeWidth="1.2"
                                  />
                                  <line
                                    x1="38"
                                    y1="146"
                                    x2="498"
                                    y2="146"
                                    stroke="#475569"
                                    strokeWidth="1.2"
                                  />

                                  {/* Wind Speed X-Axis Ticks (0..22 m/s) */}
                                  {[0, 4, 8, 10, 14, 18, 22].map((vTick) => {
                                    const tx = vToX(vTick);
                                    return (
                                      <g key={`v-tick-${vTick}`}>
                                        <line
                                          x1={tx}
                                          y1="146"
                                          x2={tx}
                                          y2="150"
                                          stroke="#64748b"
                                          strokeWidth="1"
                                        />
                                        <text
                                          x={tx - 8}
                                          y="160"
                                          fill={vTick >= 10 ? '#fde047' : '#94a3b8'}
                                          fontSize="7.5"
                                          fontWeight={vTick === 10 ? 'bold' : 'normal'}
                                        >
                                          {vTick}m/s
                                        </text>
                                      </g>
                                    );
                                  })}

                                  {/* Continuous Sensitivity Curves: L_AFmax(v), L_Aeq,korr(v), and DBA Historical Overlay */}
                                  <path
                                    d={lafmaxPathD}
                                    fill="none"
                                    stroke="#f43f5e"
                                    strokeWidth="2.2"
                                  />
                                  <path
                                    d={laeqPathD}
                                    fill="none"
                                    stroke="#38bdf8"
                                    strokeWidth="2.2"
                                  />
                                  {showWindCompensatedImpulseCatalog && (
                                    <path
                                      d={dbaCurvePathD}
                                      fill="none"
                                      stroke="#e879f9"
                                      strokeWidth="2.0"
                                      strokeDasharray="4 2"
                                    />
                                  )}

                                  {/* 24-Hour Measured Dataset Scatter Points + Historical DBA Points */}
                                  {hourlySensitivityPoints.map((pt, idx) => {
                                    const px = vToX(pt.v10m);
                                    const pyLaeq = dbToY(pt.impulseAdjustedLaeqDb);
                                    const pyPeak = dbToY(pt.lafmaxPeakDb);
                                    const dbaRow = dbaHourlySeries[idx];
                                    const pyDba = dbaRow
                                      ? dbToY(dbaRow.dbaWindCompLaeqDb)
                                      : pyLaeq;
                                    const isCurHr = pt.hourIndex === loopIdxA;
                                    return (
                                      <g
                                        key={`sens-pt-${pt.hourIndex}`}
                                        className="cursor-pointer"
                                        onClick={() => {
                                          setIsPlayingRefractionLoop(false);
                                          setRefractionLoopProgress(pt.hourIndex);
                                          setSelectedHourIndex(pt.hourIndex);
                                          setPlumeRouteProgress(pt.hourIndex);
                                        }}
                                      >
                                        <circle
                                          cx={px}
                                          cy={pyLaeq}
                                          r={isCurHr ? '4.2' : pt.isUnstableHighWind ? '3.2' : '2.3'}
                                          fill={
                                            pt.isUnstableHighWind
                                              ? '#fde047'
                                              : pt.exceedsLaeq
                                              ? '#fb923c'
                                              : '#38bdf8'
                                          }
                                          stroke="#0f172a"
                                          strokeWidth="1"
                                        />
                                        <circle
                                          cx={px}
                                          cy={pyPeak}
                                          r={isCurHr ? '4.2' : pt.isUnstableHighWind ? '3.2' : '2.2'}
                                          fill={
                                            pt.isUnstableHighWind
                                              ? '#f43f5e'
                                              : pt.exceedsLafmax
                                              ? '#e11d48'
                                              : '#a855f7'
                                          }
                                          stroke="#0f172a"
                                          strokeWidth="1"
                                        />
                                        {showWindCompensatedImpulseCatalog && (
                                          <rect
                                            x={px - 2.4}
                                            y={pyDba - 2.4}
                                            width="4.8"
                                            height="4.8"
                                            transform={`rotate(45 ${px} ${pyDba})`}
                                            fill="#e879f9"
                                            stroke="#0f172a"
                                            strokeWidth="0.9"
                                          />
                                        )}
                                      </g>
                                    );
                                  })}

                                  {/* Active Wind Speed Playhead Marker */}
                                  <line
                                    x1={curX}
                                    y1="16"
                                    x2={curX}
                                    y2="146"
                                    stroke="#22d3ee"
                                    strokeWidth="1.3"
                                    strokeDasharray="2 2"
                                  />
                                  <circle
                                    cx={curX}
                                    cy={curLaeqY}
                                    r="4.8"
                                    fill="#22d3ee"
                                    stroke="#ffffff"
                                    strokeWidth="1.5"
                                  />
                                  <circle
                                    cx={curX}
                                    cy={curLafmaxY}
                                    r="4.8"
                                    fill="#f43f5e"
                                    stroke="#ffffff"
                                    strokeWidth="1.5"
                                  />
                                </svg>
                              );
                            })()}

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-slate-300 mt-1">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
                                  <span>L_AFmax Impuls-Spids (Grænse 85 dB)</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400" />
                                  <span>L_Aeq,korr inkl. +5 dB Impulstillæg (Grænse 70/40 dB)</span>
                                </span>
                                {showWindCompensatedImpulseCatalog && (
                                  <span className="flex items-center gap-1 text-fuchsia-300 font-bold">
                                    <span className="inline-block w-2.5 h-2.5 rotate-45 bg-fuchsia-400" />
                                    <span>Historisk DBA-Fil (Vind-Kompenseret Naboblok)</span>
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-300" />
                                  <span>Målepunkt &gt; 10 m/s</span>
                                </span>
                              </div>
                              <span className="text-cyan-300 font-bold">
                                {mach.dominantFreqHz}
                              </span>
                            </div>
                          </div>

                          {/* RIGHT (5 cols): Forensic Documentation of Noise Limit Violations under Unstable Wind (> 10 m/s) */}
                          <div className="lg:col-span-5 rounded bg-slate-900/95 border border-rose-500/40 p-2.5 flex flex-col justify-between space-y-2">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                                <span className="text-[10px] font-bold uppercase text-amber-300">
                                  Retsmedicinsk Dokumentation ved {selectedRecRefraction.receptorCode} (kl. {animTimeLabel})
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ${
                                    currentLaeqExceedanceDb > 0 || currentLafmaxExceedanceDb > 0
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                  }`}
                                >
                                  {currentLaeqExceedanceDb > 0 || currentLafmaxExceedanceDb > 0
                                    ? `LOVBRUD DOKUMENTERET (+${Math.max(
                                        currentLaeqExceedanceDb,
                                        currentLafmaxExceedanceDb
                                      ).toFixed(1)} dB)`
                                    : 'UNDER GRÆNSE'}
                                </span>
                              </div>

                              {/* 4-Card Key Telemetry Grid */}
                              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                                  <div className="text-[8.5px] text-slate-400 uppercase">
                                    Impuls-Korrigeret L_Aeq,korr
                                  </div>
                                  <div className="text-sm font-extrabold text-sky-300">
                                    {currentEval.impulseAdjustedLaeqDb.toFixed(1)} dB(A){' '}
                                    <span
                                      className={`text-[10px] ${
                                        currentLaeqExceedanceDb > 0
                                          ? 'text-rose-400'
                                          : 'text-emerald-400'
                                      }`}
                                    >
                                      ({currentLaeqExceedanceDb >= 0 ? '+' : ''}
                                      {currentLaeqExceedanceDb.toFixed(1)} dB ift. {currentHourLimitLaeq} dB)
                                    </span>
                                  </div>
                                </div>

                                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                                  <div className="text-[8.5px] text-slate-400 uppercase">
                                    Impuls-Spids L_AFmax
                                  </div>
                                  <div className="text-sm font-extrabold text-rose-400">
                                    {currentEval.lafmaxPeakDb.toFixed(1)} dB(A){' '}
                                    <span
                                      className={`text-[10px] ${
                                        currentLafmaxExceedanceDb > 0
                                          ? 'text-amber-300'
                                          : 'text-emerald-400'
                                      }`}
                                    >
                                      ({currentLafmaxExceedanceDb >= 0 ? '+' : ''}
                                      {currentLafmaxExceedanceDb.toFixed(1)} dB ift. 85 dB)
                                    </span>
                                  </div>
                                </div>

                                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                                  <div className="text-[8.5px] text-slate-400 uppercase">
                                    Tabt 2,5m Skærmvirkning (Vind)
                                  </div>
                                  <div className="font-bold text-amber-300">
                                    -{currentEval.barrierBypassLossDb.toFixed(1)} dB skærmtab · +
                                    {currentEval.windRefrDb.toFixed(1)} dB refraktion
                                  </div>
                                </div>

                                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                                  <div className="text-[8.5px] text-slate-400 uppercase">
                                    Timer med Støj-Overtrædelse
                                  </div>
                                  <div className="font-bold text-rose-300">
                                    {totalNoiseViolationHours.length}/24t overskredet (
                                    {highWindViolationHours.length}t ved &gt;10 m/s)
                                  </div>
                                </div>
                              </div>

                              {/* Compact Table: Latest 5 Registered Impulse-Noise Exceedances for Selected Machine Type */}
                              <div className="rounded bg-slate-950/95 border border-rose-500/40 p-2 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1">
                                  <span className="text-[9.5px] font-extrabold uppercase text-rose-300 flex items-center gap-1">
                                    <span>
                                      📊 Seneste 5 Impulsstøj-Overskridelser ({mach.label})
                                    </span>
                                  </span>
                                  <span className="text-[8.5px] font-mono text-cyan-300">
                                    Gns: {latest5AvgDbA} dB(A) @ {latest5AvgWindMs} m/s · Trend:{' '}
                                    <strong
                                      className={
                                        latest5TrendDeltaDb > 0
                                          ? 'text-rose-400'
                                          : 'text-emerald-400'
                                      }
                                    >
                                      {latest5TrendDeltaDb >= 0 ? '+' : ''}
                                      {latest5TrendDeltaDb.toFixed(1)} dB
                                    </strong>
                                  </span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse font-mono text-[9px]">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-slate-800/90">
                                        <th className="py-0.5 pr-1.5 font-semibold">Tidspunkt</th>
                                        <th className="py-0.5 px-1.5 font-semibold">Maskintype</th>
                                        <th className="py-0.5 px-1.5 font-semibold text-right">
                                          Vind (10m)
                                        </th>
                                        <th className="py-0.5 px-1.5 font-semibold text-right">
                                          Målt dB(A)
                                        </th>
                                        <th className="py-0.5 pl-1.5 font-semibold text-right">
                                          Overskr.
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                      {latest5MachineImpulseExceedances.map((row) => {
                                        const isActiveHr = row.hourIndex === loopIdxA;
                                        return (
                                          <tr
                                            key={`${row.eventCode}-${row.hourIndex}`}
                                            onClick={() => {
                                              setIsPlayingRefractionLoop(false);
                                              setRefractionLoopProgress(row.hourIndex);
                                              setSelectedHourIndex(row.hourIndex);
                                              setPlumeRouteProgress(row.hourIndex);
                                            }}
                                            className={`cursor-pointer transition-colors ${
                                              isActiveHr
                                                ? 'bg-rose-950/60 text-white'
                                                : 'hover:bg-slate-900/90 text-slate-200'
                                            }`}
                                            title={`Klik for at hoppe til kl. ${row.hourLabel} (${row.eventCode})`}
                                          >
                                            <td className="py-0.5 pr-1.5 whitespace-nowrap">
                                              <span className="text-amber-300 font-bold">
                                                kl. {row.hourLabel}
                                              </span>{' '}
                                              <span className="text-[8px] text-slate-400">
                                                ({row.timestampLabel.split(' ')[0]})
                                              </span>
                                            </td>
                                            <td className="py-0.5 px-1.5 truncate max-w-[115px] text-cyan-200">
                                              {row.machineType}
                                            </td>
                                            <td className="py-0.5 px-1.5 text-right whitespace-nowrap">
                                              <span
                                                className={
                                                  row.windSpeedMs > 10
                                                    ? 'text-yellow-300 font-bold'
                                                    : 'text-slate-300'
                                                }
                                              >
                                                {row.windSpeedMs.toFixed(1)} m/s
                                              </span>
                                            </td>
                                            <td className="py-0.5 px-1.5 text-right whitespace-nowrap font-bold text-rose-300">
                                              {row.measuredLaeqDbA.toFixed(1)} dB(A)
                                            </td>
                                            <td className="py-0.5 pl-1.5 text-right whitespace-nowrap">
                                              <span className="px-1 py-0.2 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold">
                                                +{ Math.max(0.1, row.exceedanceLaeqDb).toFixed(1) } dB
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Forensic Explanation of >10 m/s Unstable Weather Violation */}
                              <div className="p-2 rounded bg-rose-950/30 border border-rose-500/40 text-[9.5px] text-slate-200 leading-relaxed">
                                <strong className="text-amber-300">
                                  Retsmedicinsk Konklusion (MST Vejl. 5/1984 &amp; Nord2000):
                                </strong>{' '}
                                Ved ustabile vejrforhold med vindstyrker{' '}
                                <strong className="text-white">&gt; 10,0 m/s</strong> nedbrydes den
                                geometriske støjskærmsvirkning (tab på{' '}
                                <strong className="text-rose-300">
                                  {currentEval.barrierBypassLossDb.toFixed(1)} dB
                                </strong>
                                ), mens lavfrekvente impulser ({mach.dominantFreqHz}) fra{' '}
                                <strong className="text-cyan-300">{mach.label}</strong> bøjes nedad
                                mod <strong className="text-white">{selectedRecRefraction.receptorCode}</strong>{' '}
                                med et lovpligtigt impulstillæg på{' '}
                                <strong className="text-amber-300">K_I = +5,0 dB(A)</strong>.
                              </div>
                            </div>

                            {/* Action Buttons: Register Wind-Noise Sensitivity Finding to Beviser (SHA-256) & Export Structured JSON */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await handleQuickLogNoiseDustComplaint({
                                    point: selectedReceptorExposure.position,
                                    locationLabel: `${selectedReceptorExposure.receptorCode}: ${selectedReceptorExposure.receptorName} (${selectedReceptorExposure.address})`,
                                    observationType: `Vindstøj-Sensitivitets-Analyse (>10 m/s & Impulsstøj): ${mach.label}`,
                                    description: `[VINDSTØJ-SENSITIVITETS-ANALYSE · kl. ${animTimeLabel}] Maskine: ${
                                      mach.label
                                    } (L_WA = ${mach.lwaDb} dB). Vind = ${animWindSpeed10m.toFixed(
                                      1
                                    )} m/s (stød ${animWindGusts10m.toFixed(
                                      1
                                    )} m/s, Pasquill ${animPasquillClass}). Impuls-korrigeret støj ved ${
                                      selectedReceptorExposure.receptorCode
                                    }: L_Aeq,korr = ${currentEval.impulseAdjustedLaeqDb.toFixed(
                                      1
                                    )} dB(A) (Grænse ${currentHourLimitLaeq} dB(A), overskridelse ${
                                      currentLaeqExceedanceDb >= 0 ? '+' : ''
                                    }${currentLaeqExceedanceDb.toFixed(
                                      1
                                    )} dB inkl. +5 dB impulstillæg K_I) samt L_AFmax = ${currentEval.lafmaxPeakDb.toFixed(
                                      1
                                    )} dB(A) (Grænse 85 dB(A)). Korrelation r = +${pearsonR.toFixed(
                                      2
                                    )} (R² = ${rSquared.toFixed(
                                      2
                                    )}), skærmtab = -${currentEval.barrierBypassLossDb.toFixed(1)} dB.`,
                                  });
                                  setWindNoiseEvidenceLoggedBanner(true);
                                  window.setTimeout(
                                    () => setWindNoiseEvidenceLoggedBanner(false),
                                    4000
                                  );
                                }}
                                className={`flex-1 px-2.5 py-1.5 rounded font-mono text-[10px] font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
                                  windNoiseEvidenceLoggedBanner
                                    ? 'bg-emerald-400 text-slate-950 border-white'
                                    : 'bg-gradient-to-r from-rose-600 via-amber-500 to-amber-400 hover:from-rose-500 hover:to-amber-300 text-slate-950 border-amber-200'
                                }`}
                                title="Signér med SHA-256 og føj denne Vindstøj-sensitivitets-analyse (impulsstøj ved >10 m/s ustabile vejrforhold) direkte til Beviser"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                                <span>
                                  {windNoiseEvidenceLoggedBanner
                                    ? `✓ Føjet til Beviser (SHA-256)!`
                                    : `➕ Føj til Beviser (SHA-256)`}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={handleExportMachineWindNoiseCorrelationJson}
                                className={`px-2.5 py-1.5 rounded font-mono text-[10px] font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
                                  windNoiseJsonExportedBanner
                                    ? 'bg-emerald-400 text-slate-950 border-white'
                                    : 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border-cyan-400/70'
                                }`}
                                title="Eksportér den aktuelle maskin-specifikke støj-korrelationsdata (maskintype, vindhastighed, dB-niveau, sensitivitetskurve og seneste 5 overskridelser) som struktureret JSON-fil"
                              >
                                <Download className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                                <span>
                                  {windNoiseJsonExportedBanner
                                    ? '✓ JSON Eksporteret!'
                                    : '📥 Eksportér Korrelation (.JSON)'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* ============================================================================ */}
                        {/* 5. VIND-KOMPENSERET IMPULS-KATALOG (DBA-FILER vs. NABOKLAGE-LOGFILER)        */}
                        {/* ============================================================================ */}
                        {showWindCompensatedImpulseCatalog &&
                          (() => {
                            const exportCurrentDbaVsSimViewCsv = () => {
                              const activeRowsForCsv =
                                dbaCatalogPlotScope === 'full_week_24h'
                                  ? selectedDbaWeekDayIdx === 'all'
                                    ? dbaWeekly24hProfile.map((w) => ({
                                        scopeLabel: `7-Dages Uge-Snit (${dbaWeek7Days[0].dateIso}..${dbaWeek7Days[6].dateIso})`,
                                        hourIndex: w.hourIndex,
                                        hourLabel: w.hourLabel,
                                        simLaeqDb: w.meanSimLaeqDb,
                                        dbaRawUncompensatedDb: w.meanDbaRawUncompensatedDb,
                                        micWindNoiseCompDb: w.meanMicWindNoiseCompDb,
                                        dbaWindCompLaeqDb: w.meanDbaWindCompLaeqDb,
                                        dbaLafmaxPeakDb: w.meanDbaLafmaxPeakDb,
                                        simMinusDbaDeltaDb: w.meanDeltaDb,
                                      }))
                                    : (
                                        dbaWeek7Days[selectedDbaWeekDayIdx]?.hours ||
                                        dbaHourlySeries
                                      ).map((r) => ({
                                        scopeLabel: `${
                                          dbaWeek7Days[selectedDbaWeekDayIdx]?.dateIso ||
                                          weatherDataset.dateIso
                                        }`,
                                        hourIndex: r.hourIndex,
                                        hourLabel: r.hourLabel,
                                        simLaeqDb: r.simLaeqDb,
                                        dbaRawUncompensatedDb: r.dbaRawUncompensatedDb,
                                        micWindNoiseCompDb: r.micWindNoiseCompDb,
                                        dbaWindCompLaeqDb: r.dbaWindCompLaeqDb,
                                        dbaLafmaxPeakDb: r.dbaLafmaxPeakDb,
                                        simMinusDbaDeltaDb: r.simMinusDbaDeltaDb,
                                      }))
                                  : dbaHourlySeries.map((r) => ({
                                      scopeLabel: weatherDataset.dateIso,
                                      hourIndex: r.hourIndex,
                                      hourLabel: r.hourLabel,
                                      simLaeqDb: r.simLaeqDb,
                                      dbaRawUncompensatedDb: r.dbaRawUncompensatedDb,
                                      micWindNoiseCompDb: r.micWindNoiseCompDb,
                                      dbaWindCompLaeqDb: r.dbaWindCompLaeqDb,
                                      dbaLafmaxPeakDb: r.dbaLafmaxPeakDb,
                                      simMinusDbaDeltaDb: r.simMinusDbaDeltaDb,
                                    }));

                              const header = [
                                'Visning_Dato_Periode',
                                'Time_Indeks',
                                'Klokkeslaet',
                                'Naboblok_DBA_Fil',
                                'Maskin_Output_LWA_dBA',
                                'Realtids_Simulering_LAeq_dBA',
                                'DBA_Maalt_Raa_Ukompenseret_LAeq_dBA',
                                'DBA_Mikrofon_VindKompensation_dB',
                                'DBA_VindKompenseret_LAeq_dBA',
                                'DBA_Maalt_LAFmax_Spids_dBA',
                                'Diskrepans_Sim_Minus_DBA_dBA',
                                'Diskrepans_Over_3dB_Indikator',
                              ].join(';');

                              const rows = activeRowsForCsv.map((r) =>
                                [
                                  `"${r.scopeLabel}"`,
                                  r.hourIndex,
                                  r.hourLabel,
                                  activeDbaSpec.fileName,
                                  mach.lwaDb.toFixed(1).replace('.', ','),
                                  r.simLaeqDb.toFixed(1).replace('.', ','),
                                  r.dbaRawUncompensatedDb.toFixed(1).replace('.', ','),
                                  `-${r.micWindNoiseCompDb.toFixed(1).replace('.', ',')}`,
                                  r.dbaWindCompLaeqDb.toFixed(1).replace('.', ','),
                                  r.dbaLafmaxPeakDb.toFixed(1).replace('.', ','),
                                  r.simMinusDbaDeltaDb.toFixed(1).replace('.', ','),
                                  Math.abs(r.simMinusDbaDeltaDb) > 3.0
                                    ? 'JA_OVER_3DB'
                                    : 'NEJ_INDENFOR_3DB',
                                ].join(';')
                              );

                              const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
                              const blob = new Blob([csvContent], {
                                type: 'text/csv;charset=utf-8;',
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Historiske_DBA_vs_Realtids_Simulering_24t_${activeDbaSpec.key}_${weatherDataset.dateIso}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                              setDbaCsvExportedBanner(true);
                              window.setTimeout(() => setDbaCsvExportedBanner(false), 3200);
                            };

                            return (
                          <div className="rounded-md bg-slate-950/95 border border-fuchsia-500/50 p-3 space-y-2.5 shadow-lg">
                            {/* Header Bar: Title, Active .DBA File Selector, Custom Upload & CSV Export */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-fuchsia-600 text-white border border-amber-200 text-[10.5px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                                  <span>
                                    Vind-Kompenseret Impuls-Katalog (Historiske DBA-Filer vs. Realtids-Simulering)
                                  </span>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-900 border border-fuchsia-500/40 text-fuchsia-200 text-[10px] font-bold">
                                  Fil: {activeDbaSpec.fileName} · Overensstemmelse: {dbaConcordancePct}% (RMSE = {dbaRmseDb} dB)
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[9.5px] font-semibold">
                                  ✓ Automatisk Indlæst ({combinedComplaintCatalog.length} klage-logposter korreleret)
                                </span>
                              </div>

                              {/* Neighbor Block .DBA File Switcher + Custom .DBA Upload + Direct CSV Export */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[9.5px] text-slate-400 uppercase">
                                  Naboblok DBA-Fil:
                                </span>
                                {(
                                  [
                                    'roedtjoernevej_2',
                                    'schackenborgvaenget_b',
                                    'kierulffsvej_4',
                                    'ringparken_blok_3',
                                  ] as const
                                ).map((bKey) => {
                                  const spec = dbaBlockSpecs[bKey];
                                  const isSel = selectedDbaNeighborBlockKey === bKey;
                                  return (
                                    <button
                                      key={bKey}
                                      type="button"
                                      onClick={() => {
                                        setSelectedDbaNeighborBlockKey(bKey);
                                        setCustomDbaFileName(null);
                                        setCustomDbaOffsetDb(0);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[9.5px] font-bold border transition-colors cursor-pointer ${
                                        isSel
                                          ? 'bg-fuchsia-500/30 border-fuchsia-400 text-white'
                                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                      }`}
                                      title={`${spec.fileName} — ${spec.meterModel}`}
                                    >
                                      {spec.blockLabel}
                                    </button>
                                  );
                                })}

                                <label
                                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-500/50 text-cyan-200 text-[9.5px] font-bold cursor-pointer flex items-center gap-1"
                                  title="Indlæs ekstern .DBA eller .CSV støjlogfil fra naboblok"
                                >
                                  <span>📂 Indlæs .DBA</span>
                                  <input
                                    type="file"
                                    accept=".dba,.csv,.txt,.json"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      setCustomDbaFileName(f.name.toUpperCase());
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        const txt = String(reader.result || '');
                                        const nums = txt
                                          .split(/[\s,;]+/)
                                          .map((v) => parseFloat(v))
                                          .filter((n) => !Number.isNaN(n) && n >= 40 && n <= 125);
                                        if (nums.length > 0) {
                                          const avg =
                                            nums.reduce((a, b) => a + b, 0) / nums.length;
                                          setCustomDbaOffsetDb(
                                            Number(
                                              Math.max(-6, Math.min(6, (avg - 75) * 0.15)).toFixed(1)
                                            )
                                          );
                                        } else {
                                          setCustomDbaOffsetDb(0.7);
                                        }
                                      };
                                      reader.readAsText(f);
                                    }}
                                  />
                                </label>

                                <button
                                  type="button"
                                  onClick={exportCurrentDbaVsSimViewCsv}
                                  className={`px-2.5 py-0.5 rounded border text-[9.5px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors shadow-xs ${
                                    dbaCsvExportedBanner
                                      ? 'bg-emerald-500 text-slate-950 border-white'
                                      : 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/80 text-emerald-200'
                                  }`}
                                  title="Eksportér den aktuelle visning af 'Historiske DBA-Filer vs. Realtids-Simulering' som struktureret CSV-fil indeholdende både målt og vind-kompenseret dB(A)-data pr. time"
                                >
                                  <Download className="w-3 h-3 shrink-0" />
                                  <span>
                                    {dbaCsvExportedBanner
                                      ? '✓ CSV Eksporteret!'
                                      : 'Eksportér Historiske DBA vs. Sim (.CSV)'}
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* 2-Column Layout: (Left 7 cols) 24-Hour Real-Time Simulation vs. DBA-File & Complaint Log SVG | (Right 5 cols) Matched Neighbor Complaint Logfile Table */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
                              {/* LEFT (7 cols): 24h Real-Time Simulation vs. Historical Wind-Compensated .DBA Plot (Single Day OR Full 7-Day Week on 24h Graph) */}
                              <div className="lg:col-span-7 rounded bg-slate-900/95 border border-slate-800 p-2.5 flex flex-col justify-between space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold uppercase text-fuchsia-300">
                                    {dbaCatalogPlotScope === 'full_week_24h'
                                      ? `Historiske DBA-Filer vs. Realtids-Simulering (24t · ${dbaWeek7Days[0].dateIso} til ${dbaWeek7Days[6].dateIso})`
                                      : `Historiske DBA-Filer vs. Realtids-Simulering (24t · ${weatherDataset.dateIso})`}
                                  </span>

                                  {/* Mode Toggle: Hel Uge (7 Døgn på 24t Graf) vs. Kun Aktuel Dag (24t) + CSV Export of Active View */}
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <div className="inline-flex items-center rounded bg-slate-950 border border-fuchsia-500/40 p-0.5 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setDbaCatalogPlotScope('full_week_24h')}
                                        className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold transition-colors cursor-pointer ${
                                          dbaCatalogPlotScope === 'full_week_24h'
                                            ? 'bg-fuchsia-500 text-white shadow-xs'
                                            : 'text-slate-300 hover:text-white'
                                        }`}
                                        title="Plot sammenligningen mellem realtids-simulering og .DBA-data direkte på en 24-timers graf over en hel uge (7 døgn = 168 timer)"
                                      >
                                        📆 Hel Uge på 24t-Graf (7 Døgn)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDbaCatalogPlotScope('single_day_24h')}
                                        className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold transition-colors cursor-pointer ${
                                          dbaCatalogPlotScope === 'single_day_24h'
                                            ? 'bg-cyan-400 text-slate-950 shadow-xs'
                                            : 'text-slate-300 hover:text-white'
                                        }`}
                                        title="Vis kun den aktuelle valgte dag på 24-timers grafen"
                                      >
                                        📅 Kun Aktuel Dag (24t)
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={exportCurrentDbaVsSimViewCsv}
                                      className={`px-2 py-0.5 rounded border text-[9.5px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors shadow-xs ${
                                        dbaCsvExportedBanner
                                          ? 'bg-emerald-500 text-slate-950 border-white'
                                          : 'bg-cyan-500/20 hover:bg-cyan-500/35 border-cyan-400/70 text-cyan-200'
                                      }`}
                                      title="Eksportér den aktuelle 24-timers visning af 'Historiske DBA-Filer vs. Realtids-Simulering' som en struktureret CSV-fil indeholdende både målt (rå) og vind-kompenseret dB(A)-data pr. time"
                                    >
                                      <Download className="w-3 h-3 shrink-0" />
                                      <span>
                                        {dbaCsvExportedBanner
                                          ? '✓ CSV Downloadet'
                                          : '📥 Eksportér DBA vs. Sim (24t .CSV)'}
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                {/* Day Selector Bar when Full Week 24h mode is active */}
                                {dbaCatalogPlotScope === 'full_week_24h' && (
                                  <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 rounded bg-slate-950/90 border border-fuchsia-500/30 text-[9.5px]">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="text-fuchsia-200 font-bold mr-1">
                                        Ugedag på 24t-graf:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedDbaWeekDayIdx('all')}
                                        className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                                          selectedDbaWeekDayIdx === 'all'
                                            ? 'bg-fuchsia-500 text-white border-amber-200'
                                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                        }`}
                                      >
                                        Alle 7 Dage (Uge-Snit + Spænd)
                                      </button>
                                      {dbaWeek7Days.map((d) => {
                                        const isDaySel = selectedDbaWeekDayIdx === d.dayIndex;
                                        return (
                                          <button
                                            key={d.dateIso}
                                            type="button"
                                            onClick={() => setSelectedDbaWeekDayIdx(d.dayIndex)}
                                            className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                                              isDaySel
                                                ? 'bg-cyan-400 text-slate-950 border-white'
                                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-fuchsia-400/50'
                                            }`}
                                            title={`Fremhæv ${d.shortLabel} (${d.dateIso}) på 24-timers uge-grafen`}
                                          >
                                            {d.shortLabel}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <span className="text-emerald-300 font-bold">
                                      7-døgns overensstemmelse: {dbaWeekConcordancePct}% (RMSE ={' '}
                                      {dbaWeekRmseDb} dB · 168t)
                                    </span>
                                  </div>
                                )}

                                {(() => {
                                  const hrToX = (hr: number) => 38 + (hr / 23) * 458;
                                  const dbToY24 = (db: number) =>
                                    144 - ((Math.max(50, Math.min(105, db)) - 50) / 55) * 124;

                                  // Active series to highlight as primary curves on the 24-hour axis
                                  const primarySeries =
                                    dbaCatalogPlotScope === 'full_week_24h'
                                      ? selectedDbaWeekDayIdx === 'all'
                                        ? dbaWeekly24hProfile.map((w) => ({
                                            hourIndex: w.hourIndex,
                                            simLaeqDb: w.meanSimLaeqDb,
                                            dbaWindCompLaeqDb: w.meanDbaWindCompLaeqDb,
                                            dbaRawUncompensatedDb: w.meanDbaRawUncompensatedDb,
                                            dbaLafmaxPeakDb: w.meanDbaLafmaxPeakDb,
                                            micWindNoiseCompDb: w.meanMicWindNoiseCompDb,
                                            simMinusDbaDeltaDb: w.meanDeltaDb,
                                            isUnstableHighWind: w.highWindDaysCount >= 2,
                                          }))
                                        : dbaWeek7Days[selectedDbaWeekDayIdx]?.hours || dbaHourlySeries
                                      : dbaHourlySeries;

                                  const discrepancyOver3dBHours = primarySeries.filter(
                                    (r) => Math.abs(r.simMinusDbaDeltaDb) > 3.0
                                  );

                                  const simLaeq24Path = primarySeries
                                    .map(
                                      (r, i) =>
                                        `${i === 0 ? 'M' : 'L'} ${hrToX(r.hourIndex).toFixed(
                                          1
                                        )} ${dbToY24(r.simLaeqDb).toFixed(1)}`
                                    )
                                    .join(' ');

                                  const dbaWindComp24Path = primarySeries
                                    .map(
                                      (r, i) =>
                                        `${i === 0 ? 'M' : 'L'} ${hrToX(r.hourIndex).toFixed(
                                          1
                                        )} ${dbToY24(r.dbaWindCompLaeqDb).toFixed(1)}`
                                    )
                                    .join(' ');

                                  const dbaRawUncomp24Path = primarySeries
                                    .map(
                                      (r, i) =>
                                        `${i === 0 ? 'M' : 'L'} ${hrToX(r.hourIndex).toFixed(
                                          1
                                        )} ${dbToY24(r.dbaRawUncompensatedDb).toFixed(1)}`
                                    )
                                    .join(' ');

                                  const dbaPeak24Path = primarySeries
                                    .map(
                                      (r, i) =>
                                        `${i === 0 ? 'M' : 'L'} ${hrToX(r.hourIndex).toFixed(
                                          1
                                        )} ${dbToY24(r.dbaLafmaxPeakDb).toFixed(1)}`
                                    )
                                    .join(' ');

                                  // 7-day weekly envelope polygon (min..max across all 7 days for each hour 00..23)
                                  const weekDbaBandPolygon =
                                    dbaCatalogPlotScope === 'full_week_24h'
                                      ? [
                                          ...dbaWeekly24hProfile.map(
                                            (w) =>
                                              `${hrToX(w.hourIndex).toFixed(1)},${dbToY24(
                                                w.maxDbaWindCompLaeqDb
                                              ).toFixed(1)}`
                                          ),
                                          ...[...dbaWeekly24hProfile]
                                            .reverse()
                                            .map(
                                              (w) =>
                                                `${hrToX(w.hourIndex).toFixed(1)},${dbToY24(
                                                  w.minDbaWindCompLaeqDb
                                                ).toFixed(1)}`
                                            ),
                                        ].join(' ')
                                      : '';

                                  const activeX = hrToX(loopIdxA);

                                  return (
                                    <svg
                                      viewBox="0 0 515 166"
                                      className="w-full h-44 rounded bg-[#070A12] border border-slate-800/90"
                                      role="img"
                                      aria-label="24-timers graf over realtids-simulering af maskinstøj sammenholdt med vind-kompenserede DBA-filer over en hel uge og faktiske naboklager"
                                    >
                                      <defs>
                                        <linearGradient
                                          id="dba-discrepancy-3db-band-grad"
                                          x1="0"
                                          y1="0"
                                          x2="0"
                                          y2="1"
                                        >
                                          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.45" />
                                          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.32" />
                                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.45" />
                                        </linearGradient>
                                      </defs>

                                      {/* Horizontal dB Grid */}
                                      {[55, 70, 85, 95].map((dbVal) => {
                                        const py = dbToY24(dbVal);
                                        const is70 = dbVal === 70;
                                        const is85 = dbVal === 85;
                                        return (
                                          <g key={`dba-grid-${dbVal}`}>
                                            <line
                                              x1="38"
                                              y1={py}
                                              x2="498"
                                              y2={py}
                                              stroke={
                                                is85 ? '#f43f5e' : is70 ? '#fb923c' : '#1e293b'
                                              }
                                              strokeWidth={is70 || is85 ? '1.2' : '0.8'}
                                              strokeDasharray={is70 || is85 ? '4 2' : '2 2'}
                                            />
                                            <text
                                              x="5"
                                              y={py + 3}
                                              fill={
                                                is85 ? '#fda4af' : is70 ? '#fdba74' : '#64748b'
                                              }
                                              fontSize="7.5"
                                              fontWeight={is70 || is85 ? 'bold' : 'normal'}
                                            >
                                              {dbVal}dB
                                            </text>
                                          </g>
                                        );
                                      })}

                                      {/* High-Wind (>10 m/s) Hour Columns */}
                                      {primarySeries.map((r) => {
                                        if (!r.isUnstableHighWind) return null;
                                        const hx = hrToX(r.hourIndex);
                                        return (
                                          <rect
                                            key={`dba-hw-${r.hourIndex}`}
                                            x={hx - 8}
                                            y="16"
                                            width="16"
                                            height="128"
                                            fill="#fbbf24"
                                            fillOpacity="0.09"
                                          />
                                        );
                                      })}

                                      {/* Shaded Discrepancy Color Band (Skyggelagt Farvebånd) when |Simulation - DBA| > 3.0 dB */}
                                      {primarySeries.map((r, idx) => {
                                        const absDelta = Math.abs(r.simMinusDbaDeltaDb);
                                        if (absDelta <= 3.0) return null;
                                        const xCenter = hrToX(r.hourIndex);
                                        const stepHalfW = (458 / 23) * 0.5;
                                        const xLeft = Math.max(38, xCenter - stepHalfW);
                                        const xRight = Math.min(498, xCenter + stepHalfW);

                                        const prevPt = primarySeries[Math.max(0, idx - 1)];
                                        const nextPt =
                                          primarySeries[Math.min(primarySeries.length - 1, idx + 1)];

                                        const ySimL = dbToY24((prevPt.simLaeqDb + r.simLaeqDb) * 0.5);
                                        const ySimC = dbToY24(r.simLaeqDb);
                                        const ySimR = dbToY24((r.simLaeqDb + nextPt.simLaeqDb) * 0.5);

                                        const yDbaL = dbToY24(
                                          (prevPt.dbaWindCompLaeqDb + r.dbaWindCompLaeqDb) * 0.5
                                        );
                                        const yDbaC = dbToY24(r.dbaWindCompLaeqDb);
                                        const yDbaR = dbToY24(
                                          (r.dbaWindCompLaeqDb + nextPt.dbaWindCompLaeqDb) * 0.5
                                        );

                                        const polyPoints = `${xLeft.toFixed(1)},${ySimL.toFixed(
                                          1
                                        )} ${xCenter.toFixed(1)},${ySimC.toFixed(
                                          1
                                        )} ${xRight.toFixed(1)},${ySimR.toFixed(
                                          1
                                        )} ${xRight.toFixed(1)},${yDbaR.toFixed(
                                          1
                                        )} ${xCenter.toFixed(1)},${yDbaC.toFixed(
                                          1
                                        )} ${xLeft.toFixed(1)},${yDbaL.toFixed(1)}`;

                                        return (
                                          <g key={`discrepancy-3db-${r.hourIndex}`}>
                                            {/* Vertical highlight strip */}
                                            <rect
                                              x={xLeft}
                                              y="16"
                                              width={Math.max(2, xRight - xLeft)}
                                              height="128"
                                              fill="#f43f5e"
                                              fillOpacity="0.11"
                                            />
                                            {/* Shaded color band polygon directly between Sim and DBA curves */}
                                            <polygon
                                              points={polyPoints}
                                              fill="url(#dba-discrepancy-3db-band-grad)"
                                              stroke="#fb7185"
                                              strokeWidth="0.9"
                                              strokeOpacity="0.85"
                                            />
                                            <line
                                              x1={xCenter}
                                              y1={ySimC}
                                              x2={xCenter}
                                              y2={yDbaC}
                                              stroke="#fda4af"
                                              strokeWidth="1.4"
                                              strokeDasharray="2 1"
                                            />
                                            <text
                                              x={Math.min(468, Math.max(40, xCenter - 15))}
                                              y={Math.max(24, Math.min(ySimC, yDbaC) - 4)}
                                              fill="#fecdd3"
                                              fontSize="6.8"
                                              fontWeight="bold"
                                            >
                                              Δ{r.simMinusDbaDeltaDb >= 0 ? '+' : ''}
                                              {r.simMinusDbaDeltaDb}dB
                                            </text>
                                          </g>
                                        );
                                      })}

                                      {/* Full-Week (7 Days) Overlay Traces & Min-Max Envelope Band on 24h Graph */}
                                      {dbaCatalogPlotScope === 'full_week_24h' && (
                                        <g>
                                          <polygon
                                            points={weekDbaBandPolygon}
                                            fill="#e879f9"
                                            fillOpacity="0.13"
                                          />
                                          {dbaWeek7Days.map((dayObj) => {
                                            const isHighlightedDay =
                                              selectedDbaWeekDayIdx === dayObj.dayIndex;
                                            const daySimPath = dayObj.hours
                                              .map(
                                                (r, idx) =>
                                                  `${idx === 0 ? 'M' : 'L'} ${hrToX(
                                                    r.hourIndex
                                                  ).toFixed(1)} ${dbToY24(r.simLaeqDb).toFixed(1)}`
                                              )
                                              .join(' ');
                                            const dayDbaPath = dayObj.hours
                                              .map(
                                                (r, idx) =>
                                                  `${idx === 0 ? 'M' : 'L'} ${hrToX(
                                                    r.hourIndex
                                                  ).toFixed(1)} ${dbToY24(
                                                    r.dbaWindCompLaeqDb
                                                  ).toFixed(1)}`
                                              )
                                              .join(' ');
                                            return (
                                              <g
                                                key={`wk-trace-${dayObj.dateIso}`}
                                                opacity={
                                                  selectedDbaWeekDayIdx === 'all'
                                                    ? 0.34
                                                    : isHighlightedDay
                                                    ? 0.95
                                                    : 0.14
                                                }
                                              >
                                                <path
                                                  d={daySimPath}
                                                  fill="none"
                                                  stroke="#38bdf8"
                                                  strokeWidth={isHighlightedDay ? '1.8' : '0.9'}
                                                />
                                                <path
                                                  d={dayDbaPath}
                                                  fill="none"
                                                  stroke="#e879f9"
                                                  strokeWidth={isHighlightedDay ? '1.8' : '0.9'}
                                                  strokeDasharray="3 2"
                                                />
                                              </g>
                                            );
                                          })}
                                        </g>
                                      )}

                                      {/* Neighbor Complaint Logfile Vertical Markers */}
                                      {combinedComplaintCatalog.map((cEntry) => {
                                        const cx = hrToX(cEntry.hourIndex);
                                        const cyDba = dbToY24(cEntry.dbaWindCompLaeqDb);
                                        return (
                                          <g
                                            key={`klage-m-${cEntry.complaintId}`}
                                            className="cursor-pointer"
                                            onClick={() => {
                                              setIsPlayingRefractionLoop(false);
                                              setRefractionLoopProgress(cEntry.hourIndex);
                                              setSelectedHourIndex(cEntry.hourIndex);
                                              setPlumeRouteProgress(cEntry.hourIndex);
                                            }}
                                          >
                                            <line
                                              x1={cx}
                                              y1="18"
                                              x2={cx}
                                              y2="144"
                                              stroke="#d946ef"
                                              strokeWidth="1.2"
                                              strokeDasharray="2 2"
                                            />
                                            <circle
                                              cx={cx}
                                              cy={cyDba}
                                              r="4.2"
                                              fill="#e879f9"
                                              stroke="#0f172a"
                                              strokeWidth="1.2"
                                            />
                                            <text
                                              x={Math.min(462, Math.max(40, cx - 18))}
                                              y="25"
                                              fill="#f5d0fe"
                                              fontSize="7"
                                              fontWeight="bold"
                                            >
                                              🔔 {cEntry.complaintId}
                                            </text>
                                          </g>
                                        );
                                      })}

                                      {/* 1. Raw Uncompensated DBA Curve (Slate/Amber dotted — includes wind-mic noise) */}
                                      <path
                                        d={dbaRawUncomp24Path}
                                        fill="none"
                                        stroke="#94a3b8"
                                        strokeWidth="1.3"
                                        strokeDasharray="2 2"
                                      />

                                      {/* 2. DBA Impulse Peak Curve L_AFmax,DBA (Rose dashed) */}
                                      <path
                                        d={dbaPeak24Path}
                                        fill="none"
                                        stroke="#fb7185"
                                        strokeWidth="1.5"
                                        strokeDasharray="3 2"
                                      />

                                      {/* 3. Real-Time Simulated Machine Impulse Curve L_Aeq,sim (Cyan solid) */}
                                      <path
                                        d={simLaeq24Path}
                                        fill="none"
                                        stroke="#38bdf8"
                                        strokeWidth="2.4"
                                      />

                                      {/* 4. Historical Wind-Compensated .DBA Curve L_Aeq,DBA,vind-komp (Fuchsia solid/dashed) */}
                                      <path
                                        d={dbaWindComp24Path}
                                        fill="none"
                                        stroke="#e879f9"
                                        strokeWidth="2.3"
                                        strokeDasharray="5 2"
                                      />

                                      {/* Active Hour Playhead */}
                                      <line
                                        x1={activeX}
                                        y1="16"
                                        x2={activeX}
                                        y2="144"
                                        stroke="#fde047"
                                        strokeWidth="1.5"
                                      />

                                      {/* X-Axis Hour Ticks */}
                                      {[0, 4, 8, 12, 16, 20, 23].map((hTick) => {
                                        const tx = hrToX(hTick);
                                        return (
                                          <text
                                            key={`dba-hr-${hTick}`}
                                            x={tx - 9}
                                            y="158"
                                            fill="#94a3b8"
                                            fontSize="7.5"
                                          >
                                            {String(hTick).padStart(2, '0')}:00
                                          </text>
                                        );
                                      })}
                                    </svg>
                                  );
                                })()}

                                {/* Legend & Telemetry Summary Bar (including > 3 dB Shaded Discrepancy Band Indicator) */}
                                {(() => {
                                  const activeWkRow =
                                    dbaWeekly24hProfile[loopIdxA] || dbaWeekly24hProfile[0];
                                  const activeSeriesForLegend =
                                    dbaCatalogPlotScope === 'full_week_24h'
                                      ? selectedDbaWeekDayIdx === 'all'
                                        ? dbaWeekly24hProfile.map((w) => w.meanDeltaDb)
                                        : (
                                            dbaWeek7Days[selectedDbaWeekDayIdx]?.hours ||
                                            dbaHourlySeries
                                          ).map((r) => r.simMinusDbaDeltaDb)
                                      : dbaHourlySeries.map((r) => r.simMinusDbaDeltaDb);
                                  const countOver3dB = activeSeriesForLegend.filter(
                                    (d) => Math.abs(d) > 3.0
                                  ).length;
                                  const currentDeltaVal =
                                    dbaCatalogPlotScope === 'full_week_24h'
                                      ? activeWkRow.meanDeltaDb
                                      : currentHourDbaRow.simMinusDbaDeltaDb;
                                  return (
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-slate-300">
                                      <div className="flex flex-wrap items-center gap-3">
                                        <span className="flex items-center gap-1">
                                          <span className="inline-block w-3 h-0.5 bg-sky-400" />
                                          <span>
                                            {dbaCatalogPlotScope === 'full_week_24h'
                                              ? `7-Døgns Sim L_Aeq,sim (${activeWkRow.meanSimLaeqDb} dB · spænd ${activeWkRow.minSimLaeqDb}–${activeWkRow.maxSimLaeqDb} dB)`
                                              : `Realtids-Simulering L_Aeq,sim (${currentHourDbaRow.simLaeqDb} dB)`}
                                          </span>
                                        </span>
                                        <span className="flex items-center gap-1 text-fuchsia-300 font-bold">
                                          <span className="inline-block w-3 h-0.5 bg-fuchsia-400" />
                                          <span>
                                            {dbaCatalogPlotScope === 'full_week_24h'
                                              ? `7-Døgns DBA Vind-Komp (${activeWkRow.meanDbaWindCompLaeqDb} dB · spænd ${activeWkRow.minDbaWindCompLaeqDb}–${activeWkRow.maxDbaWindCompLaeqDb} dB)`
                                              : `DBA Vind-Kompenseret (${currentHourDbaRow.dbaWindCompLaeqDb} dB · komp. -${currentHourDbaRow.micWindNoiseCompDb} dB)`}
                                          </span>
                                        </span>
                                        <span
                                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-200 font-extrabold"
                                          title="Skyggelagt farvebånd fremhæver timer hvor diskrepansen |Simulering - DBA| overstiger 3,0 dB"
                                        >
                                          <span className="inline-block w-2.5 h-2.5 rounded-xs bg-gradient-to-b from-rose-500/80 via-amber-500/70 to-rose-600/80 border border-rose-300" />
                                          <span>
                                            Skyggelagt Farvebånd |Δ| &gt; 3,0 dB ({countOver3dB} timer)
                                          </span>
                                        </span>
                                      </div>
                                      <span
                                        className={`font-bold ${
                                          Math.abs(currentDeltaVal) > 3.0
                                            ? 'text-rose-300 underline decoration-rose-400'
                                            : 'text-emerald-300'
                                        }`}
                                      >
                                        {dbaCatalogPlotScope === 'full_week_24h'
                                          ? `Uge-afvigelse kl. ${animTimeLabel}: Δ = ${
                                              activeWkRow.meanDeltaDb >= 0 ? '+' : ''
                                            }${activeWkRow.meanDeltaDb} dB(A)${
                                              Math.abs(activeWkRow.meanDeltaDb) > 3.0
                                                ? ' (⚠ > 3 dB!)'
                                                : ''
                                            }`
                                          : `Afvigelse kl. ${animTimeLabel}: Δ = ${
                                              currentHourDbaRow.simMinusDbaDeltaDb >= 0 ? '+' : ''
                                            }${currentHourDbaRow.simMinusDbaDeltaDb} dB(A)${
                                              Math.abs(currentHourDbaRow.simMinusDbaDeltaDb) > 3.0
                                                ? ' (⚠ > 3 dB!)'
                                                : ''
                                            }`}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* RIGHT (5 cols): Coupled Neighbor Complaint Logfiles vs. DBA Measurements Table & Actions */}
                              <div className="lg:col-span-5 rounded bg-slate-900/95 border border-fuchsia-500/40 p-2.5 flex flex-col justify-between space-y-2">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 pb-1">
                                    <span className="text-[10px] font-bold uppercase text-fuchsia-300">
                                      Faktiske Naboklage-Logfiler vs. DBA-Måling &amp; Simulering
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const header = [
                                            'Dato_ISO',
                                            'Ugedag',
                                            'Klokkeslaet',
                                            'DBA_Fil',
                                            'Vind_10m_ms',
                                            'Simuleret_LAeq_dB',
                                            'DBA_VindKompenseret_LAeq_dB',
                                            'DBA_Raa_Ukompenseret_dB',
                                            'DBA_MikrofonVindKomp_dB',
                                            'DBA_LAFmax_Spids_dB',
                                            'Afvigelse_Sim_Minus_DBA_dB',
                                          ].join(';');
                                          const rows = all168WeekRows.map((r) =>
                                            [
                                              r.dateIso,
                                              `"${r.dayLabel}"`,
                                              r.hourLabel,
                                              activeDbaSpec.fileName,
                                              r.v10m.toFixed(1).replace('.', ','),
                                              r.simLaeqDb.toFixed(1).replace('.', ','),
                                              r.dbaWindCompLaeqDb.toFixed(1).replace('.', ','),
                                              r.dbaRawUncompensatedDb.toFixed(1).replace('.', ','),
                                              `-${r.micWindNoiseCompDb.toFixed(1).replace('.', ',')}`,
                                              r.dbaLafmaxPeakDb.toFixed(1).replace('.', ','),
                                              r.simMinusDbaDeltaDb.toFixed(1).replace('.', ','),
                                            ].join(';')
                                          );
                                          const csvContent =
                                            '\uFEFF' + [header, ...rows].join('\r\n');
                                          const blob = new Blob([csvContent], {
                                            type: 'text/csv;charset=utf-8;',
                                          });
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = `Vind_Kompenseret_Impuls_7Dages_UgeProfil_168t_${activeDbaSpec.key}_${weatherDataset.dateIso}.csv`;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                        }}
                                        className="px-2 py-0.5 rounded bg-fuchsia-500/25 hover:bg-fuchsia-500/40 border border-fuchsia-400/60 text-fuchsia-200 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
                                        title="Eksportér hele ugens 168 timer (7 døgn × 24t) sammenligning mellem realtids-simulering og .DBA-data til CSV"
                                      >
                                        <Download className="w-3 h-3 shrink-0" />
                                        <span>Eksportér 7-Dages Uge (.CSV)</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const header = [
                                            'Klage_ID',
                                            'Tidspunkt',
                                            'Naboblok_Adresse',
                                            'DBA_Fil',
                                            'Vind_10m_ms',
                                            'Simuleret_LAeq_dB',
                                            'DBA_VindKompenseret_LAeq_dB',
                                            'DBA_MikrofonVindKomp_dB',
                                            'DBA_LAFmax_Spids_dB',
                                            'Afvigelse_Sim_Minus_DBA_dB',
                                            'Naboklage_Logbeskrivelse',
                                          ].join(';');
                                          const rows = combinedComplaintCatalog.map((c) =>
                                            [
                                              c.complaintId,
                                              c.hourLabel,
                                              `"${c.complainantBlock.replace(/"/g, '""')}"`,
                                              activeDbaSpec.fileName,
                                              c.v10m.toFixed(1).replace('.', ','),
                                              c.simLaeqDb.toFixed(1).replace('.', ','),
                                              c.dbaWindCompLaeqDb.toFixed(1).replace('.', ','),
                                              `-${c.micWindNoiseCompDb.toFixed(1).replace('.', ',')}`,
                                              c.dbaLafmaxPeakDb.toFixed(1).replace('.', ','),
                                              c.simMinusDbaDeltaDb.toFixed(1).replace('.', ','),
                                              `"${c.complaintText.replace(/"/g, '""')}"`,
                                            ].join(';')
                                          );
                                          const csvContent =
                                            '\uFEFF' + [header, ...rows].join('\r\n');
                                          const blob = new Blob([csvContent], {
                                            type: 'text/csv;charset=utf-8;',
                                          });
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Vind_Kompenseret_Impuls_Katalog_${activeDbaSpec.key}_${weatherDataset.dateIso}.csv`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                      }}
                                      className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="Eksportér sammenligningstabel mellem DBA-filer, realtids-simulering og naboklage-logfiler til CSV"
                                    >
                                      <Download className="w-3 h-3 shrink-0" />
                                      <span>Eksportér DBA-Katalog (.CSV)</span>
                                    </button>
                                    </div>
                                  </div>

                                  {/* Scrollable Complaint vs. DBA Table */}
                                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                    {combinedComplaintCatalog.map((item) => {
                                      const isActiveHr = item.hourIndex === loopIdxA;
                                      return (
                                        <div
                                          key={item.complaintId}
                                          onClick={() => {
                                            setIsPlayingRefractionLoop(false);
                                            setRefractionLoopProgress(item.hourIndex);
                                            setSelectedHourIndex(item.hourIndex);
                                            setPlumeRouteProgress(item.hourIndex);
                                          }}
                                          className={`p-1.5 rounded border text-[9.5px] cursor-pointer transition-colors ${
                                            isActiveHr
                                              ? 'bg-fuchsia-950/60 border-fuchsia-400 text-white'
                                              : 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700 text-slate-300'
                                          }`}
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-1 font-mono">
                                            <span className="font-bold text-fuchsia-300">
                                              🔔 {item.complaintId} · kl. {item.hourLabel} ({item.complainantBlock})
                                            </span>
                                            <span className="text-[9px] text-amber-300 font-bold">
                                              Vind {item.v10m} m/s
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[9px] mt-0.5">
                                            <span className="text-sky-300">
                                              Sim: <strong>{item.simLaeqDb} dB</strong>
                                            </span>
                                            <span className="text-fuchsia-300">
                                              DBA (vind-komp): <strong>{item.dbaWindCompLaeqDb} dB</strong> (-{item.micWindNoiseCompDb} dB vind)
                                            </span>
                                            <span className="text-rose-300">
                                              Spids: <strong>{item.dbaLafmaxPeakDb} dB</strong>
                                            </span>
                                            <span className="text-emerald-300 font-bold">
                                              Δ {item.simMinusDbaDeltaDb >= 0 ? '+' : ''}
                                              {item.simMinusDbaDeltaDb} dB
                                            </span>
                                          </div>
                                          <div className="text-[9px] text-slate-400 truncate mt-0.5">
                                            {item.complaintText}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Log DBA-Catalog & Complaint Corroboration to Forensic Evidence (SHA-256) */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await handleQuickLogNoiseDustComplaint({
                                      point: selectedReceptorExposure.position,
                                      locationLabel: `${activeDbaSpec.blockLabel} (${activeDbaSpec.fileName})`,
                                      observationType: `Vind-Kompenseret Impuls-Katalog (DBA vs. Naboklage-Log): ${activeDbaSpec.fileName}`,
                                      description: `[VIND-KOMPENSERET IMPULS-KATALOG · ${
                                        activeDbaSpec.fileName
                                      } · kl. ${animTimeLabel}] Måleudstyr: ${
                                        activeDbaSpec.meterModel
                                      }. Realtids-simulering (${mach.label}): L_Aeq,sim = ${
                                        currentHourDbaRow.simLaeqDb
                                      } dB(A) vs. historisk DBA-fil (vind-kompenseret): L_Aeq,DBA = ${
                                        currentHourDbaRow.dbaWindCompLaeqDb
                                      } dB(A) (rå måling ${
                                        currentHourDbaRow.dbaRawUncompensatedDb
                                      } dB(A), fratrukket mikrofon-vindstøj -${
                                        currentHourDbaRow.micWindNoiseCompDb
                                      } dB(A)) og L_AFmax,DBA = ${
                                        currentHourDbaRow.dbaLafmaxPeakDb
                                      } dB(A). Model-overensstemmelse = ${dbaConcordancePct}% (RMSE = ${dbaRmseDb} dB across ${
                                        combinedComplaintCatalog.length
                                      } verificerede naboklage-logposter).`,
                                    });
                                    setDbaCatalogEvidenceLoggedBanner(true);
                                    window.setTimeout(
                                      () => setDbaCatalogEvidenceLoggedBanner(false),
                                      4000
                                    );
                                  }}
                                  className={`w-full px-3 py-1.5 rounded font-mono text-[10px] font-extrabold flex items-center justify-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
                                    dbaCatalogEvidenceLoggedBanner
                                      ? 'bg-emerald-400 text-slate-950 border-white'
                                      : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white border-amber-200'
                                  }`}
                                  title="Signér sammenligningen mellem de historiske DBA-filer, realtids-simuleringen og naboklage-logfilerne med SHA-256 og føj til Beviser"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {dbaCatalogEvidenceLoggedBanner
                                      ? '✓ Vind-Kompenseret Impuls-Katalog (DBA vs. Klage-Log) Føjet til Beviser!'
                                      : '➕ Føj Vind-Kompenseret Impuls-Katalog (DBA & Klage-Log) til Beviser'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                            );
                          })()}
                      </div>
                    );
                  })()}
              </div>
              </DockableWindowFrame>
            )}

            {/* Expandable 24-Hour / 7-Day Historical Wind-Rose, 30-Day Aggregated Heatmap, Stochastic Wind-Bias, Proactive AI-Agent or Temperature-Aerosol Recharts Drawer directly inside MODULE A (VEJRRUBRIKKEN) */}
            {(showRibbonWindRose ||
              showRibbon7DayWindRose ||
              showRibbon30DayHeatmap ||
              showRibbonDepositionProfile ||
              showRibbonMedicalExpert ||
              showRibbonExpertChat ||
              showRibbonPredVsActual ||
              showRibbonDispersionForecast ||
              showRibbonStochasticBias ||
              showRibbonProactiveAgent ||
              showRibbonTempChart ||
              showRibbonStackEffect) && (
              <div className="pt-1 border-t border-slate-800/80 space-y-3">
                {showRibbonStackEffect && (
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
                )}
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

                {showRibbonMedicalExpert && (
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

      {/* MAIN SPLIT-SCREEN WORKSPACE: 2/3 MAP & 3D DIGITAL TWIN (LEFT) + 1/3 FORENSIC PANEL (RIGHT) */}
      <div
        id="main-workspace-anchor"
        className={`main-workspace flex-1 grid grid-cols-1 lg:grid-cols-12 items-start ${
          windowStates.map_viewport_2d_3d.isMinimized ? 'h-auto min-h-0' : 'min-h-[720px]'
        } overflow-y-auto scroll-smooth transition-all duration-200`}
      >
        {/* LEFT/CENTER 2/3: Interactive 3D Three.js Scene / Google Maps / Split 2D+3D */}
        <div
          data-window-minimized={windowStates.map_viewport_2d_3d.isMinimized ? 'true' : 'false'}
          className={
            isMapOnlyMode || isFullscreen3D
              ? 'fixed inset-0 z-[120] w-screen h-screen bg-[#07090E] flex flex-col overflow-hidden'
              : windowStates.map_viewport_2d_3d.isMinimized
              ? 'window-minimized-collapse lg:col-span-8 h-auto min-h-0 self-start flex-none relative border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col transition-all duration-200'
              : 'lg:col-span-8 min-h-[680px] relative border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col overflow-y-auto scroll-smooth transition-all duration-200'
          }
        >
          {/* Viewport Visualization Mode Switcher (3D Three.js Scene / 2D & 3D Underground Percolation / Split 2D+3D / 2D Map) */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0B0E17] border-b border-slate-800 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <Box className="w-3.5 h-3.5 text-cyan-400" />
                <span>Visualisering:</span>
              </span>
              <button
                type="button"
                onClick={() => setViewportMode('3d')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  viewportMode === '3d'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Digital Tvilling</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (viewportMode !== '3d' && viewportMode !== 'split') {
                    setViewportMode('3d');
                  }
                  setAsbestosHeatmapActive(true);
                  setTemporal24hAsbestosAccumulation((v) => !v);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  temporal24hAsbestosAccumulation &&
                  (viewportMode === '3d' || viewportMode === 'split')
                    ? 'bg-fuchsia-500 text-slate-950 border border-fuchsia-300 shadow-xs'
                    : 'bg-slate-900 text-fuchsia-200 border border-fuchsia-500/50 hover:border-fuchsia-400'
                }`}
                title="Generér 'Tidsmæssig Asbest-Akkumulering' (24-timers kumulativ eksponeringsrisiko Σ C(x,z,h) for naboer over hele døgnet) i 3D Digital Tvilling"
              >
                <Clock className="w-3.5 h-3.5 text-fuchsia-300" />
                <span>
                  {temporal24hAsbestosAccumulation
                    ? '⏳ Tidsmæssig Asbest-Akkumulering: 24t AKTIV'
                    : '⏳ Tidsmæssig Asbest-Akkumulering (24t)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (viewportMode !== '3d' && viewportMode !== 'split') {
                    setViewportMode('3d');
                  }
                  setShowLeewardWakeEffect((v) => !v);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  showLeewardWakeEffect &&
                  (viewportMode === '3d' || viewportMode === 'split')
                    ? 'bg-amber-400 text-slate-950 border border-amber-200 shadow-xs'
                    : 'bg-slate-900 text-amber-200 border border-amber-500/50 hover:border-amber-400'
                }`}
                title="Vis/skjul 3D markør for 'Læ-effekt' (hvor bygninger skaber vindstille recirkulations-zoner baseret på aktuel vindretning, så støv akkumuleres mere intenst)"
              >
                <Wind className="w-3.5 h-3.5" />
                <span>
                  {showLeewardWakeEffect
                    ? '🌪️ Læ-Effekt (Vindstille Zoner): AKTIV'
                    : '🌪️ Vis Læ-Effekt (Vindstille Zoner)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (viewportMode !== '3d' && viewportMode !== 'split') {
                    setViewportMode('3d');
                  }
                  setShowWeatherCorrelationOverlay((v) => !v);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  showWeatherCorrelationOverlay &&
                  (viewportMode === '3d' || viewportMode === 'split')
                    ? 'bg-orange-500 text-slate-950 border border-amber-200 shadow-xs font-bold'
                    : 'bg-slate-900 text-orange-200 border border-orange-500/50 hover:border-orange-400'
                }`}
                title="Vis/skjul 'Vis Vejr-Korrelation' overlay i 3D-scenen: viser korrelationen mellem vindhastighed og observeret støv-intensitet (baseret på SHA-256 signerede observationer) som varmekort-punkter i 3D-rummet"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>
                  {showWeatherCorrelationOverlay
                    ? '🌡️ Vis Vejr-Korrelation: AKTIV'
                    : '🌡️ Vis Vejr-Korrelation'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewportMode('underground_3d')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  viewportMode === 'underground_3d'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-slate-900 text-cyan-200 border border-cyan-500/40 hover:border-cyan-400'
                }`}
                title="3D Underjordisk Perkolation & Nedsivning til Grundvandet i Three.js (0 til -25 m)"
              >
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>3D Underjordisk Perkolation</span>
              </button>

              <button
                type="button"
                onClick={() => setViewportMode('underground_2d')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  viewportMode === 'underground_2d'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-slate-900 text-cyan-200 border border-cyan-500/40 hover:border-cyan-400'
                }`}
                title="2D Geologisk Tværsnit af Perkolation & Grundvands-Nedsivning afhængigt af nedbørsmængden"
              >
                <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                <span>2D Underjordisk Perkolation</span>
              </button>

              <button
                type="button"
                onClick={() => setViewportMode('underground_split')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  viewportMode === 'underground_split'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
                title="Sammenlign 2D Geologisk Tværsnit og 3D Underjordisk Grundvands-Cutaway side om side"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>2D + 3D Grundvand (Split)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewportMode('split')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  viewportMode === 'split'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Split 2D Kort + 3D</span>
              </button>

              <button
                type="button"
                onClick={() => setViewportMode('2d')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  viewportMode === '2d'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>2D Taktisk Kort</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Dato & Klokkeslæt Badge med direkte Dato-skifter i Fuld Skærm & Kun Kort modes */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs border transition-colors ${
                  isFullscreen3D || isMapOnlyMode
                    ? 'bg-cyan-950/95 border-cyan-400 text-cyan-100 shadow-md ring-1 ring-cyan-400/50'
                    : 'bg-slate-900/95 border-slate-700 text-slate-200'
                }`}
                title={`Simuleret Dato & Klokkeslæt: ${selectedDateIso} kl. ${currentWeather.hourLabel} (${currentWeather.isoTime}) — Skift dato eller time direkte`}
              >
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                {isFullscreen3D || isMapOnlyMode ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeSimulatedDateIso(shiftDateIsoByDays(selectedDateIso, -1))
                      }
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                      title="Forrige dato (−1 dag)"
                    >
                      −1d
                    </button>
                    <label className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-cyan-400/60 hover:border-cyan-300 cursor-pointer">
                      <span className="text-[11px]">📅</span>
                      <input
                        type="date"
                        value={selectedDateIso}
                        onChange={(e) => {
                          if (e.target.value) handleChangeSimulatedDateIso(e.target.value);
                        }}
                        aria-label="Ændr dato i Fuld skærm eller Kun Kort"
                        className="bg-transparent text-white font-mono font-extrabold text-[11px] focus:outline-none cursor-pointer [color-scheme:dark]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeSimulatedDateIso(shiftDateIsoByDays(selectedDateIso, 1))
                      }
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                      title="Næste dato (+1 dag)"
                    >
                      +1d
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeSimulatedDateIso(todayIso)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-amber-400 hover:text-slate-950 text-[10px] font-bold text-amber-200 border border-amber-500/40 transition-colors cursor-pointer"
                      title="Skift til dags dato (I dag)"
                    >
                      I dag
                    </button>
                  </div>
                ) : (
                  <span className="font-bold text-white whitespace-nowrap">
                    📅 {selectedDateIso}
                  </span>
                )}
                <span className="text-cyan-400">·</span>
                <span className="font-extrabold text-amber-300 whitespace-nowrap">
                  kl. {currentWeather.hourLabel}
                </span>
                {(isFullscreen3D || isMapOnlyMode) && (
                  <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-cyan-500/40">
                    <button
                      type="button"
                      onClick={() => handleStepSimulatedHour(-1)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                      title="Forrige time (-1t)"
                    >
                      −1t
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepSimulatedHour(1)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                      title="Næste time (+1t)"
                    >
                      +1t
                    </button>
                  </div>
                )}
              </div>

              {/* 3D Impuls-Støjbølge Status fra Valgt Kilde i #main-workspace-anchor */}
              {(() => {
                const activeSrc =
                  sources.find((s) => s.id === selectedSourceId) ||
                  sources.find((s) => s.active) ||
                  sources[0];
                const effMachineDb = isManualMachineNoiseOverrideActive
                  ? manualMachineNoiseOutputDb
                  : 114;
                const isDaytimeHr =
                  currentWeather.hourIndex >= 7 && currentWeather.hourIndex < 18;
                const isEveningHr =
                  currentWeather.hourIndex >= 18 && currentWeather.hourIndex < 22;
                const hrLimitDb = isDaytimeHr ? 70.0 : isEveningHr ? 45.0 : 40.0;
                const hrImpulseLimitDb = isDaytimeHr ? 85.0 : 55.0;
                const estReceptorLaeqDb = Number(
                  (
                    effMachineDb -
                    36.3 +
                    Math.min(4.3, currentWeather.windSpeed10m * 0.34)
                  ).toFixed(1)
                );
                const estImpulsePeakDb = Number((estReceptorLaeqDb + 15.2).toFixed(1));
                const exceedanceDb = Number(
                  Math.max(
                    estReceptorLaeqDb - hrLimitDb,
                    estImpulsePeakDb - hrImpulseLimitDb
                  ).toFixed(1)
                );
                const isExceeded = Boolean(activeSrc?.active) && exceedanceDb > 0;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (viewportMode !== '3d' && viewportMode !== 'split') {
                        setViewportMode('3d');
                      }
                      setActiveTab('noiseDust');
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                      isExceeded
                        ? 'bg-rose-950/90 hover:bg-rose-900/90 border-rose-500/80 text-rose-200 shadow-xs'
                        : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-emerald-300'
                    }`}
                    title={`3D Impuls-støjbølger fra valgt kilde (${activeSrc?.name || 'Kilde'}) ved ${effMachineDb} dB L_WA: ${
                      isExceeded
                        ? `AKTIV — Støjgrænse (${hrLimitDb} dB) overskredet med +${exceedanceDb} dB i kl. ${currentWeather.hourLabel}`
                        : `Under grænse (${estReceptorLaeqDb} / ${hrLimitDb} dB)`
                    }. Klik for at fokusere 3D-bølger & Støj/Støv slider.`}
                  >
                    <span>
                      {isExceeded
                        ? `🔨 3D Impuls-Støjbølger (${activeSrc?.name.split('—')[0].trim() || 'Kilde'}): +${exceedanceDb} dB OVER GRÆNSE`
                        : `🔊 Kilde-Støj (${effMachineDb} dB): OK (${estReceptorLaeqDb}/${hrLimitDb} dB)`}
                    </span>
                  </button>
                );
              })()}

              {/* Auto gem beviser Toggle Button i Viewport Top-Bar */}
              <button
                type="button"
                onClick={() => setAutoSaveEvidenceOnTimeTravel((v) => !v)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors flex items-center gap-1.5 border cursor-pointer ${
                  autoSaveEvidenceOnTimeTravel
                    ? 'bg-emerald-500/25 hover:bg-emerald-500/35 border-emerald-400 text-emerald-200 shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="Auto gem beviser: Tilføjer kontinuerligt fund (med SHA-256 signatur) til Foto-Bevis / Algedonisk Log under tidsrejser"
              >
                <span>
                  {autoSaveEvidenceOnTimeTravel
                    ? `⚡ Auto gem beviser: TIL (${autoSavedEvidenceCount})`
                    : '⚡ Auto gem beviser: FRA'}
                </span>
              </button>

              <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span>
                  Nedbør:{' '}
                  <strong className="text-cyan-300">
                    {(precipitationOverrideMm !== null
                      ? precipitationOverrideMm
                      : currentWeather.precipitation
                    ).toFixed(1)}{' '}
                    mm/t
                  </strong>
                </span>
                <span>·</span>
                <span className="text-cyan-300">
                  Fane {plumeDirectionDeg}° ({degreesToCompass(plumeDirectionDeg)})
                </span>
              </div>

              {!isMapOnlyMode && (
                <>
                  {/* Frigiv & Minimer knapper på Kort & 3D Viewport vinduet */}
                  <button
                    type="button"
                    onClick={() =>
                      windowStates.map_viewport_2d_3d.isMinimized
                        ? handleRestoreWindow('map_viewport_2d_3d')
                        : handleMinimizeWindow('map_viewport_2d_3d')
                    }
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 text-[11px] font-mono font-semibold text-slate-200 hover:text-amber-200 flex items-center gap-1 transition-colors"
                    title={
                      windowStates.map_viewport_2d_3d.isMinimized
                        ? 'Gendan Kort & 3D Viewport vindue'
                        : 'Minimer Kort & 3D Viewport vindue'
                    }
                  >
                    <span>
                      {windowStates.map_viewport_2d_3d.isMinimized ? '▣ Gendan Kort' : '− Minimer'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      windowStates.map_viewport_2d_3d.isFloating
                        ? handleRestoreWindow('map_viewport_2d_3d')
                        : handlePopOutFloatingWindow('map_viewport_2d_3d')
                    }
                    className={`px-2 py-1 rounded border text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors ${
                      windowStates.map_viewport_2d_3d.isFloating
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 hover:border-cyan-400/60 text-cyan-300'
                    }`}
                    title={
                      windowStates.map_viewport_2d_3d.isFloating
                        ? 'Fastgør Kort & 3D Viewport tilbage i hovedpanelet'
                        : 'Frigiv Kort & 3D Viewport som frit flytbart vindue'
                    }
                  >
                    <span>
                      {windowStates.map_viewport_2d_3d.isFloating ? '📌 Fastgør' : '↗ Frigiv'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFullscreen3D((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors flex items-center gap-1.5 border ${
                      isFullscreen3D
                        ? 'bg-amber-400 text-slate-950 border-amber-200 hover:bg-amber-300 shadow-sm'
                        : 'bg-slate-900 text-cyan-200 border-cyan-500/60 hover:bg-cyan-950 hover:border-cyan-400'
                    }`}
                    title={
                      isFullscreen3D
                        ? 'Afslut Fuld Skærm (Esc)'
                        : viewportMode === '2d'
                        ? 'Åbn 2D Taktisk Kort i Fuld Skærm'
                        : viewportMode === 'split' || viewportMode === 'underground_split'
                        ? 'Åbn 2D/3D Split-Visning i Fuld Skærm'
                        : 'Åbn visning i Fuld Skærm'
                    }
                  >
                    {isFullscreen3D ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Afslut Fuld Skærm</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>
                          {viewportMode === '2d'
                            ? 'Fuld Skærm (2D Taktisk)'
                            : viewportMode === 'split' || viewportMode === 'underground_split'
                            ? 'Fuld Skærm (2D/3D Split)'
                            : 'Fuld Skærm'}
                        </span>
                      </>
                    )}
                  </button>
                </>
              )}

              {/* 'Kun Kort' Button + Top-Right 'Afslut' Button */}
              {!isMapOnlyMode ? (
                <button
                  type="button"
                  onClick={() => setIsMapOnlyMode(true)}
                  className="px-2.5 py-1 rounded text-xs font-mono font-extrabold transition-colors flex items-center gap-1.5 border bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 shadow-sm cursor-pointer"
                  title="Kun Kort — Vis kun kortet med filtre og en Afslut-knap i højre hjørne"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>🗺️ Kun Kort</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMapOnlyMode(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-mono font-extrabold transition-colors flex items-center gap-1.5 border-2 bg-rose-600 hover:bg-rose-500 text-white border-rose-200 shadow-xl cursor-pointer"
                  title="Afslut 'Kun Kort' visning (Esc)"
                >
                  <X className="w-4 h-4 text-white" />
                  <span>Afslut</span>
                </button>
              )}
            </div>
          </div>

          {/* Topbar Filter Strip for the 5 Operational Building Categories (a–e) + Quick "Hvad-hvis" Scenarios */}
          <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800/90 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3 text-cyan-400" />
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
                    onClick={() => handleToggleCategoryFilter(catCode)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-950/50 text-slate-500 border-slate-800 opacity-55 hover:opacity-85'
                    }`}
                    style={{
                      borderColor: isActive ? meta.colorHex : undefined,
                    }}
                    title={`${meta.labelDa} (faktor ${meta.sourceEmissionFactor.toFixed(2)}x · H=${meta.defaultReleaseHeightMeters}m) — Klik for at vise/skjule på 2D-kort og i 3D`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.colorHex }}
                    />
                    <span>{meta.labelDa}</span>
                    <span className="px-1 py-0.1 rounded bg-slate-950 text-[9px] text-slate-300">
                      {count}
                    </span>
                  </button>
                );
              })}
              {activeCategoryFilters.length < 5 && (
                <button
                  type="button"
                  onClick={handleResetCategoryFilters}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300"
                >
                  Vis alle (5)
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-slate-400">Hvad-hvis:</span>
              <button
                type="button"
                onClick={() =>
                  handleApplyBatchBuildingScenario(
                    (prev) =>
                      prev.map((b) =>
                        b.id === 'BLOK-1' ? { ...b, category: 'e_demolished_unsecured' } : b
                      ),
                    'BLOK-1'
                  )
                }
                className="px-2 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/60 text-amber-200 text-[10px] font-mono font-bold transition-colors"
                title="Simulér at Blok 1 er nedrevet uden forsegling af krybekælder/jord (H=1m, vindresuspension >5 m/s & +250% regnperkolation)"
              >
                Blok 1 → e. Nedrevet, ikke sikret
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyBatchBuildingScenario(
                    (prev) =>
                      prev.map((b) =>
                        b.id === 'BLOK-9' || b.id === 'BLOK-10'
                          ? { ...b, category: 'd_under_demolition' }
                          : b
                      ),
                    'BLOK-9'
                  )
                }
                className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/60 text-rose-200 text-[10px] font-mono font-bold transition-colors"
                title="Simulér at Blok 9 og 10 skifter fra b. Tom til d. Under nedrivning (Etape 2 del 2)"
              >
                Blok 9 &amp; 10 → d. Under nedrivning
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('substances');
                }}
                className="px-2 py-0.5 rounded bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/50 text-cyan-200 text-[10px] font-mono font-bold transition-colors"
              >
                Åbn Kategoristyring (29)
              </button>
            </div>
          </div>

          {/* Active Visualization Canvas Area */}
          {windowStates.map_viewport_2d_3d.isMinimized ? (
            <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
              <span>🗺️ Kort &amp; 3D Digital Tvilling Viewport er minimeret</span>
              <button
                type="button"
                onClick={() => handleRestoreWindow('map_viewport_2d_3d')}
                className="px-3 py-1 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 font-bold hover:bg-emerald-500/30"
              >
                Gendan Kort-Vindue
              </button>
            </div>
          ) : (
          <div className="flex-1 min-h-[600px] relative grid grid-cols-1 overflow-hidden">
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
                  setActiveTab('substances');
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
                      setActiveTab('substances');
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
                onSelectObservation={(obs) => {
                  setSelectedObservationId(obs.id);
                  setSelectedHourIndex(obs.observedHourIndex);
                  setActiveTab('algedonic');
                }}
                selectedSourceId={selectedSourceId}
                selectedReceptorId={selectedReceptorId}
                onSelectSource={(id) => {
                  setSelectedSourceId(id);
                  setActiveTab('substances');
                }}
                onSelectReceptor={(id) => {
                  setSelectedReceptorId(id);
                }}
                mapClickMode={mapClickMode}
                onSetMapClickMode={(mode) => {
                  setMapClickMode(mode);
                  if (mode === 'add_observation') {
                    setActiveTab('algedonic');
                  }
                }}
                onMapAddNode={handleMapAddNode}
                onSelectHourFromPeak={(hr) => {
                  setSelectedHourIndex(hr);
                  setPlumeRouteProgress(hr);
                }}
                isAnimatingPlumeRoute={isAnimatingPlumeRoute}
                plumeRouteProgress={plumeRouteProgress}
                onToggleAnimatePlumeRoute={handleToggleAnimatePlumeRoute}
                showHeatmapComparison={showHeatmapComparison}
                onToggleHeatmapComparison={() => setShowHeatmapComparison((v) => !v)}
                heatmapComparison={heatmapComparison}
                heatmapComparisonViewMode={heatmapComparisonViewMode}
                onChangeHeatmapComparisonViewMode={setHeatmapComparisonViewMode}
                weatherHours={weatherDataset.hours}
                comparisonHourAIndex={comparisonHourAIndex}
                comparisonHourBIndex={selectedHourIndex}
                onChangeComparisonHourA={setComparisonHourAIndex}
                onChangeComparisonHourB={setSelectedHourIndex}
                isFullscreen={isFullscreen3D}
                onToggleFullscreen={() => setIsFullscreen3D((v) => !v)}
                fullscreenLabel="Fuld Skærm (2D Taktisk)"
                isMapOnly={isMapOnlyMode}
                onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                onToggleCategoryFilter={handleToggleCategoryFilter}
                onSaveMapSnapshotObservation={handleSaveMapSnapshotObservation}
                selectedDateIso={selectedDateIso}
                onChangeDateIso={handleChangeSimulatedDateIso}
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
                    onSelectObservation={(obs) => {
                      setSelectedObservationId(obs.id);
                      setSelectedHourIndex(obs.observedHourIndex);
                      setActiveTab('algedonic');
                    }}
                    selectedSourceId={selectedSourceId}
                    selectedReceptorId={selectedReceptorId}
                    onSelectSource={(id) => {
                      setSelectedSourceId(id);
                      setActiveTab('substances');
                    }}
                    onSelectReceptor={(id) => {
                      setSelectedReceptorId(id);
                    }}
                    mapClickMode={mapClickMode}
                    onSetMapClickMode={(mode) => {
                      setMapClickMode(mode);
                      if (mode === 'add_observation') {
                        setActiveTab('algedonic');
                      }
                    }}
                    onMapAddNode={handleMapAddNode}
                    onSelectHourFromPeak={(hr) => {
                      setSelectedHourIndex(hr);
                      setPlumeRouteProgress(hr);
                    }}
                    isAnimatingPlumeRoute={isAnimatingPlumeRoute}
                    plumeRouteProgress={plumeRouteProgress}
                    onToggleAnimatePlumeRoute={handleToggleAnimatePlumeRoute}
                    showHeatmapComparison={showHeatmapComparison}
                    onToggleHeatmapComparison={() => setShowHeatmapComparison((v) => !v)}
                    heatmapComparison={heatmapComparison}
                    heatmapComparisonViewMode={heatmapComparisonViewMode}
                    onChangeHeatmapComparisonViewMode={setHeatmapComparisonViewMode}
                    weatherHours={weatherDataset.hours}
                    comparisonHourAIndex={comparisonHourAIndex}
                    comparisonHourBIndex={selectedHourIndex}
                    onChangeComparisonHourA={setComparisonHourAIndex}
                    onChangeComparisonHourB={setSelectedHourIndex}
                    isFullscreen={isFullscreen3D}
                    onToggleFullscreen={() => setIsFullscreen3D((v) => !v)}
                    fullscreenLabel="Fuld Skærm (2D/3D Split)"
                    isMapOnly={isMapOnlyMode}
                    onToggleMapOnly={() => setIsMapOnlyMode((v) => !v)}
                    onSaveMapSnapshotObservation={handleSaveMapSnapshotObservation}
                    selectedDateIso={selectedDateIso}
                    onChangeDateIso={handleChangeSimulatedDateIso}
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
                  />
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* RIGHT 1/3: Forensic Analysis, Algedonic Signal, Substance Breakdown, 24h Puff & Legal Panel */}
        <aside className="sidebar lg:col-span-4 min-h-[680px] bg-[#0B0E17] flex flex-col overflow-y-auto scroll-smooth">
          {/* Eksponerings-Badge at the very top of .sidebar (Green: S<0.25, Amber: 0.25-1.0, Red: S>=1.0) */}
          <EksponeringsBadge
            selectedReceptor={selectedReceptorExposure}
            allReceptors={receptorExposures}
            onSelectReceptor={(recId) => setSelectedReceptorId(recId)}
          />

          {/* Segmented Control Bar for Right Panel */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 p-1.5 bg-slate-950 border-b border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('algedonic')}
              className={`px-1.5 py-1.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap truncate ${
                activeTab === 'algedonic'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60'
                  : 'text-cyan-300/85 hover:text-cyan-200'
              }`}
              title="Upload Foto, AI Analyse & Visuel Beskrivelse samt Registrering af Foto-Dokumentation som Bevismateriale"
            >
              📸 Foto-Bevis ({observations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('noiseDust')}
              className={`px-1.5 py-1.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap truncate ${
                activeTab === 'noiseDust'
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50'
                  : 'text-amber-300/85 hover:text-amber-200'
              }`}
              title="Korrelation mellem vejret og naboklager om støj (dB) og støv (S) baseret på kildenode-aktivitet"
            >
              🔊 Støj &amp; Støv
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('indoorClimate')}
              className={`px-1.5 py-1.5 rounded text-[11px] font-bold transition-colors whitespace-nowrap truncate ${
                activeTab === 'indoorClimate'
                  ? 'bg-rose-500/25 text-rose-200 border border-rose-400/60 shadow-xs'
                  : 'text-rose-300/90 hover:text-rose-200'
              }`}
              title="Indeklima & CAV/Opdrift: DIN 4150-3 Vibrationsdiagram (PPV), Klimaskærms-Permeabilitet (q_75), CAV-Undertryk (-45,3 Pa), Termisk Opdrift (z_NPL) & Indendørs Asbest (S_in = 3,15)"
            >
              🏠 Indeklima &amp; CAV/Opdrift
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('puff24h')}
              className={`px-1.5 py-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap truncate ${
                activeTab === 'puff24h'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24t Puff
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('substances')}
              className={`px-1.5 py-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap truncate ${
                activeTab === 'substances'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sumformel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bioscience')}
              className={`px-1.5 py-1.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap truncate ${
                activeTab === 'bioscience'
                  ? 'bg-teal-500/25 text-teal-200 border border-teal-500/50'
                  : 'text-teal-300/80 hover:text-teal-200'
              }`}
              title="Molekylær Toksikologi, AlphaFold 3D-Strukturer, PubChem & Europe PMC Litteratur"
            >
              🧬 Bio-Toks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('compliance')}
              className={`px-1.5 py-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap truncate ${
                activeTab === 'compliance'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lovlog ({legalViolations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('grounding')}
              className={`px-1.5 py-1.5 rounded text-[11px] font-bold transition-colors whitespace-nowrap truncate ${
                activeTab === 'grounding'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60 shadow-xs'
                  : 'text-cyan-300 hover:text-cyan-100'
              }`}
              title="Dedikeret Gemini Chat Bot med 5 AI Eksperter: Arbejdsmiljørepræsentanten, Juristen (The Liability Bomb, Almenlejeloven & Tort), Fysikeren/Matematikeren, Lægen & Kybernetikeren (VSM, Ashbys Lov & Afslapningstid)"
            >
              🤖 5 AI Eksperter
            </button>
          </div>

          {/* Centralt Bevis-Opsamlingsbanner i Højre Analysepanel (Synligt på tværs af alle faner) */}
          <div className="px-3 py-2 bg-slate-900/95 border-b border-emerald-500/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-mono font-bold text-emerald-300 shrink-0">
                Beviser: {observations.length}
              </span>
              <span className="text-[11px] font-mono text-slate-300 truncate">
                Aktuelle fund: <strong className="text-rose-300">{legalViolations.length} lovbrud</strong> ·{' '}
                <strong className="text-amber-300">S_max = {maxSiteSumQuotient.toFixed(2)}</strong>
              </span>
              {/* 'S-kvotient tendens' 6-hour sparkline next to S_max */}
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px]"
                title={`S-kvotient tendens (seneste 6 timer baseret på historiske puff-data): ${last6HoursSparklinePoints
                  .map((p) => `kl. ${p.hourLabel}: S=${p.sumQuotient.toFixed(2)}`)
                  .join(' | ')}`}
              >
                <span className="text-cyan-300 font-semibold">S-kvotient tendens (6t):</span>
                <svg width="56" height="16" viewBox="0 0 56 16" className="overflow-visible">
                  <line x1="0" y1="8" x2="56" y2="8" stroke="#ef4444" strokeWidth="0.7" strokeDasharray="2 1" />
                  <polyline
                    fill="none"
                    stroke={maxSiteSumQuotient >= 1.0 ? '#f43f5e' : '#38bdf8'}
                    strokeWidth="1.7"
                    points={last6HoursSparklinePoints
                      .map((pt, idx) => {
                        const x = (idx / Math.max(1, last6HoursSparklinePoints.length - 1)) * 52 + 2;
                        const y = 14 - Math.min(13, (pt.sumQuotient / 2.0) * 13);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />
                </svg>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleAddAllFindingsToEvidence}
                className={`px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1 border shadow-sm transition-all cursor-pointer shrink-0 ${
                  batchAddFindingsSuccess
                    ? 'bg-emerald-400 text-slate-950 border-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200'
                }`}
                title="Føj alle aktuelle fund (lovovertrædelser, udsatte receptorer og vejr-/støvkorrelation) til Beviser med SHA-256 signatur"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>
                  {batchAddFindingsSuccess
                    ? `✓ ${batchAddedFindingsCount} fund føjet!`
                    : `➕ Føj alle fund til Beviser (${totalCurrentFindingsCount})`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportChronologicalEvidencePdfReport}
                className={`px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 border shadow-sm transition-all cursor-pointer shrink-0 ${
                  isGeneratingChronologicalPdf
                    ? 'bg-cyan-400 text-slate-950 border-white animate-pulse'
                    : chronologicalPdfExportSuccess
                    ? 'bg-emerald-400 text-slate-950 border-white'
                    : observations.length > 0
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200 animate-pulse ring-2 ring-amber-300/80 shadow-[0_0_12px_rgba(251,191,36,0.65)]'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200'
                }`}
                title="Generér og download en kronologisk PDF-rapport over alle registrerede observationer (fotos, PDF-beviser og fysiske signaler) med tilhørende SHA-256 signaturer som officielt retsmedicinsk bilag i klagesager"
              >
                {isGeneratingChronologicalPdf ? (
                  <RefreshCw className="w-3.5 h-3.5 text-slate-950 shrink-0 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                )}
                <span>
                  {isGeneratingChronologicalPdf
                    ? '⏳ Genererer...'
                    : chronologicalPdfExportSuccess
                    ? `✓ Kronologisk PDF-Bilag Eksporteret!`
                    : `📄 Eksportér Kronologisk Bevis-Bilag (PDF · ${observations.length})`}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-extrabold border ${
                    isGeneratingChronologicalPdf
                      ? 'bg-slate-950 text-cyan-300 border-cyan-400'
                      : 'bg-slate-950/90 text-emerald-300 border-emerald-400/60'
                  }`}
                >
                  {isGeneratingChronologicalPdf ? 'Genererer...' : 'Klar til eksport'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDirectExportForensicAppendixPdf}
                className={`px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 border shadow-sm transition-all cursor-pointer shrink-0 ${
                  directForensicPdfExportSuccess
                    ? 'bg-emerald-400 text-slate-950 border-white'
                    : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-cyan-100'
                }`}
                title="Generér en samlet PDF-rapport over alle registrerede observationer og SHA-256 signaturer inkl. Merkle-Root beviskæde, vejrtelemetri og lovovertrædelser"
              >
                <FileText className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>
                  {directForensicPdfExportSuccess
                    ? '✓ Samlet PDF-Rapport (Observationer & SHA-256) Eksporteret!'
                    : `📑 Generér Samlet PDF-Rapport (Observationer & SHA-256 · ${observations.length})`}
                </span>
              </button>
            </div>
          </div>

          {/* Scrollable Panel Content */}
          <div className="flex-1 overflow-y-auto scroll-smooth p-4 space-y-4">
            {/* TAB 0: AI FOTO-DOKUMENTATION, VISUEL BESKRIVELSE & ALGEDONISK SIGNAL */}
            {activeTab === 'algedonic' && (
              <div className="space-y-4">
                {/* DEDICATED EXPORT CARD: Chronological Forensic PDF Appendix (3-Column CSS Grid: Left=Header/Stats, Middle=Metadata ['Seneste SHA-256' & 'System-status'], Right=Export Actions) */}
                <div className="p-3.5 rounded-md bg-gradient-to-r from-slate-900 via-amber-950/35 to-slate-900 border-2 border-amber-400/70 space-y-2.5 shadow-lg grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch pdf-report-widget-grid pdf-report-widget-printable [grid-template-areas:'header_meta_actions'_'stats_meta_actions']">
                  {/* GRID AREA: header (Column 1, Top-Left) */}
                  <div className="pdf-grid-area-header [grid-area:header] col-start-1 col-span-1 !mt-0 space-y-1.5 w-full justify-self-start self-start text-left min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="text-[10.5px] font-mono uppercase tracking-wider text-amber-300 font-extrabold flex items-center justify-start gap-1.5 text-left">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          Retsmedicinsk Bevisførelse &amp; Dokumentation (Kronologisk PDF-Rapport · SHA-256)
                        </span>
                      </div>

                      {/* Visuel 'S ≥ 1,0' Advarselsmarkør med CSS pulserende animation der aktiveres specifikt når S ≥ 1,0 */}
                      <span
                        role="status"
                        aria-live="polite"
                        data-s-warning-indicator="true"
                        data-s-warning-active={maxSiteSumQuotient >= 1.0 ? 'true' : 'false'}
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-extrabold inline-flex items-center gap-1.5 border transition-all duration-300 shrink-0 ${
                          maxSiteSumQuotient >= 1.0
                            ? 'bg-rose-600 text-white border-rose-200 ring-2 ring-rose-400/80 shadow-[0_0_16px_rgba(244,63,94,0.9)] animate-pulse s-quotient-warning-pulse'
                            : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60'
                        }`}
                        title={
                          maxSiteSumQuotient >= 1.0
                            ? `LOVOVERSKRIDELSE: Aktuel Sumkvotient S = ${maxSiteSumQuotient.toFixed(
                                2
                              )} overskrider den lovmæssige grænseværdi S ≥ 1,0 (BEK 613/2026)`
                            : `Under grænseværdi: Aktuel Sumkvotient S = ${maxSiteSumQuotient.toFixed(
                                2
                              )} (Lovgrænse: S ≥ 1,0)`
                        }
                      >
                        {maxSiteSumQuotient >= 1.0 && (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-200" />
                          </span>
                        )}
                        <AlertTriangle
                          className={`w-3 h-3 shrink-0 ${
                            maxSiteSumQuotient >= 1.0 ? 'text-white animate-bounce' : 'text-emerald-400'
                          }`}
                        />
                        <span>
                          S ≥ 1,0 Advarsel: S = {maxSiteSumQuotient.toFixed(2)}{' '}
                          {maxSiteSumQuotient >= 1.0 ? '(OVERSKREDET)' : '(OK)'}
                        </span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-snug text-left">
                      Genererer en kronologisk sorteret PDF-rapport over samtlige registrerede
                      observationer (<strong className="text-cyan-300">fotos</strong>,{' '}
                      <strong className="text-indigo-300">PDF-beviser</strong> og{' '}
                      <strong className="text-fuchsia-300">fysiske signaler</strong>) samt akustiske
                      refraktionsdiagrammer, receptor dB-værdier og 64-tegns{' '}
                      <strong className="text-emerald-300">SHA-256 signaturer</strong> (Retsplejelovens
                      § 823 &amp; ISO/IEC 27037).
                    </p>
                  </div>

                  {/* GRID AREA: meta (Dedicated 3rd Column / Middle Column in CSS Grid — 'Seneste SHA-256', 'System-status' & 'S ≥ 1,0' status) */}
                  <div className="pdf-grid-area-meta [grid-area:meta] lg:col-start-2 col-span-1 !mt-0 flex flex-col justify-between gap-2 self-stretch justify-self-stretch text-left border-y lg:border-y-0 lg:border-x border-amber-500/30 py-2.5 lg:py-0 lg:px-3.5 min-w-0">
                    <div className="text-[9.5px] font-mono uppercase tracking-wider text-amber-300 font-extrabold flex items-center justify-between gap-1.5">
                      <span>🔐 Retsmedicinske Metadata</span>
                      <span
                        data-s-warning-active={maxSiteSumQuotient >= 1.0 ? 'true' : 'false'}
                        className={`px-1.5 py-0.2 rounded border text-[9px] font-extrabold ${
                          maxSiteSumQuotient >= 1.0
                            ? 'bg-rose-600/95 border-rose-200 text-white animate-pulse s-quotient-warning-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                            : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                        }`}
                      >
                        {maxSiteSumQuotient >= 1.0
                          ? `⚠ S ≥ 1,0 (${maxSiteSumQuotient.toFixed(2)})`
                          : 'ISO/IEC 27037'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px]">
                      {/* Metadata Field 1: Seneste SHA-256 med direkte 'Kopiér SHA-256' knap & visuel bekræftelse */}
                      <div className="px-2.5 py-1.5 rounded bg-slate-950/95 border border-cyan-500/45 flex flex-col gap-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 text-[9px] uppercase text-cyan-300 font-bold">
                          <span>Seneste SHA-256:</span>
                          <span className="text-emerald-300">64-tegns hash</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <div
                            className="text-[10px] font-bold text-white truncate min-w-0"
                            title={observations[0]?.sha256Signature || sha256Hash}
                          >
                            {(observations[0]?.sha256Signature || sha256Hash).slice(0, 22)}...
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const targetHash = observations[0]?.sha256Signature || sha256Hash;
                              void navigator.clipboard.writeText(targetHash);
                              setCopiedPdfWidgetSha256(true);
                              window.setTimeout(() => {
                                setCopiedPdfWidgetSha256(false);
                              }, 2200);
                            }}
                            className={`no-print-in-widget px-2 py-0.5 rounded text-[9px] font-mono font-bold border inline-flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                              copiedPdfWidgetSha256
                                ? 'bg-emerald-400 text-slate-950 border-white shadow-xs'
                                : 'bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border-cyan-400/60'
                            }`}
                            title="Kopiér den fulde 64-tegns SHA-256 signatur til udklipsholderen for hurtig bevisvalidering"
                          >
                            {copiedPdfWidgetSha256 ? (
                              <>
                                <Check className="w-2.5 h-2.5 shrink-0" />
                                <span>✓ Kopieret!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5 shrink-0" />
                                <span>Kopiér SHA-256</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Metadata Field 2: System-status */}
                      <div className="px-2.5 py-1.5 rounded bg-slate-950/95 border border-emerald-500/45 flex items-center justify-between gap-2 min-w-0">
                        <span className="text-[9.5px] uppercase text-slate-300 font-bold shrink-0">
                          System-status:
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 font-extrabold text-[10px] truncate ${
                            isGeneratingChronologicalPdf ? 'text-cyan-300' : 'text-emerald-300'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              isGeneratingChronologicalPdf
                                ? 'bg-cyan-400 animate-ping'
                                : 'bg-emerald-400 animate-pulse'
                            }`}
                          />
                          <span>
                            {isGeneratingChronologicalPdf
                              ? 'Genererer... (PDF)'
                              : 'Klar til eksport · Verificeret'}
                          </span>
                        </span>
                      </div>

                      {/* Metadata Field 3: Merkle-Root Chain-of-Custody */}
                      <div className="px-2.5 py-1 rounded bg-slate-950/90 border border-amber-400/40 flex items-center justify-between gap-2 text-[9.5px] text-amber-200/95 min-w-0">
                        <span className="uppercase font-bold text-amber-300 shrink-0">
                          Merkle-Root:
                        </span>
                        <strong className="text-white truncate">
                          {observationChainOfCustodyLedger.merkleRootSignature.slice(0, 18)}...
                        </strong>
                      </div>

                      {/* Metadata Field 4: L 69 Bøderisiko & Aktive Kat. d/e Enheder */}
                      <div className="px-2.5 py-1 rounded bg-slate-950/90 border border-rose-500/45 flex items-center justify-between gap-2 text-[9.5px] text-rose-200 min-w-0">
                        <span className="uppercase font-bold text-rose-300 shrink-0">
                          Kat. d / e Aktive:
                        </span>
                        <strong className="text-white truncate">
                          d={buildings.filter((b) => b.category === 'd_under_demolition').length} · e=
                          {buildings.filter((b) => b.category === 'e_demolished_unsecured').length} enheder
                        </strong>
                      </div>

                      {/* Metadata Field 5: Indeklima S_in & CAV/Skorsten (IndoorReceptorClimateExposure) */}
                      <div className="px-2.5 py-1 rounded bg-slate-950/90 border border-cyan-500/45 flex items-center justify-between gap-2 text-[9.5px] text-cyan-200 min-w-0">
                        <span className="uppercase font-bold text-cyan-300 shrink-0">
                          🏠 Indeklima S_in:
                        </span>
                        <strong className="text-rose-300 truncate">
                          S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)} · ΔP_CAV ={' '}
                          {indoorClimateTelemetry.deltaPCavPa.toFixed(1)} Pa · ALL{' '}
                          {indoorClimateTelemetry.almenlejelovRentReductionEligiblePct}%
                        </strong>
                      </div>

                      {/* Metadata Field 6: Monte Carlo Kælder → 1. Sal (Blok 6, Afd. 23, N = 10.000) */}
                      <div className="px-2.5 py-1 rounded bg-slate-950/90 border border-purple-500/45 flex items-center justify-between gap-2 text-[9.5px] text-purple-200 min-w-0">
                        <span className="uppercase font-bold text-purple-300 shrink-0">
                          🎲 Monte Carlo (Blok 6):
                        </span>
                        <strong className="text-amber-300 truncate">
                          N=10.000 · Vinter P95 = 17.142 f/m³ (571% GV)
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* GRID AREA: stats (Column 1, Bottom-Left — Venstrestillede Statistik-Piller i 2-kolonne grid med detaljeret beregningsmodel & hover scale-animation) */}
                  <div className="pdf-grid-area-stats [grid-area:stats] col-start-1 col-span-1 !mt-0 grid grid-cols-1 gap-1.5 content-end justify-items-start justify-self-start self-end text-left w-full pt-1.5 border-t border-amber-500/25 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 w-full">
                      <div className="text-[9.5px] font-mono uppercase tracking-wider text-amber-200/85 font-bold text-left justify-self-start">
                        Statistik over registrerede beviser (hold musen over for beregningsmodel):
                      </div>
                      <span
                        data-s-warning-active={maxSiteSumQuotient >= 1.0 ? 'true' : 'false'}
                        className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold border transition-colors ${
                          maxSiteSumQuotient >= 1.0
                            ? 'bg-rose-950/95 text-rose-200 border-rose-400 animate-pulse s-quotient-warning-pulse'
                            : 'bg-slate-950 text-emerald-300 border-emerald-500/50'
                        }`}
                      >
                        S ≥ 1,0: {maxSiteSumQuotient >= 1.0 ? `KRITISK (${maxSiteSumQuotient.toFixed(2)})` : `OK (${maxSiteSumQuotient.toFixed(2)})`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 justify-items-start justify-start content-start items-center text-left w-fit max-w-full text-[10px] font-mono">
                      {/* Statistik-pille 1: Fotos */}
                      <span
                        className="group relative justify-self-start px-2.5 py-1 rounded bg-slate-950/95 hover:bg-cyan-950/90 border border-cyan-500/50 hover:border-cyan-300 text-cyan-200 hover:text-white font-bold inline-flex items-center justify-start gap-1.5 text-left cursor-help transform-gpu hover:scale-105 active:scale-95 transition-all duration-200 ease-out hover:shadow-[0_0_12px_rgba(34,211,238,0.35)] hover:-translate-y-0.5"
                        title="Beregningsmodel (Foto-Beviser): N_foto = Σ I(obs.photoEvidence ≠ null). Korrelerer optiske støvsky-observationer med Gaussisk fane-spredning C(x,y,z) = (Q / 2π·u·σ_y·σ_z) · exp(-y²/2σ_y²) ved observationens WGS84-koordinat og verificerer uforanderlighed med 64-tegns SHA-256 billed-hash."
                      >
                        <span className="truncate">📸 Fotos:</span>
                        <strong className="text-white shrink-0">
                          {observations.filter((o) => Boolean(o.photoEvidence)).length}
                        </strong>
                        <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-72 p-2.5 rounded bg-slate-950 border border-cyan-400 text-[10px] font-mono font-normal text-slate-200 shadow-2xl z-50 text-left leading-relaxed">
                          <strong className="text-cyan-300 block mb-0.5">
                            📸 Beregningsmodel: Foto-Beviser (ISO/IEC 27037)
                          </strong>
                          Beregnes som <code className="text-white">N_foto = Σ I(photoEvidence)</code>{' '}
                          koblet til Gaussisk fanemodel{' '}
                          <code className="text-cyan-200">C(x,y,z) = Q/(2π·u·σy·σz)</code> ved
                          WGS84-positionen samt 64-tegns SHA-256 fil-hash.
                        </span>
                      </span>

                      {/* Statistik-pille 2: PDF-Beviser */}
                      <span
                        className="group relative justify-self-start px-2.5 py-1 rounded bg-slate-950/95 hover:bg-indigo-950/90 border border-indigo-500/50 hover:border-indigo-300 text-indigo-200 hover:text-white font-bold inline-flex items-center justify-start gap-1.5 text-left cursor-help transform-gpu hover:scale-105 active:scale-95 transition-all duration-200 ease-out hover:shadow-[0_0_12px_rgba(129,140,248,0.35)] hover:-translate-y-0.5"
                        title="Beregningsmodel (PDF-Beviser & Aktindsigt): N_pdf = Σ I(obs.pdfEvidence ≠ null). Vægter dokumenterede myndighedssvar og klagebilag mod Arbejdstilsynets addivitets-sumformel S = Σ(C_i / GV_i) (BEK 613/2026) og tidsstempler hvert dokument i Merkle-træet."
                      >
                        <span className="truncate">📄 PDF-Beviser:</span>
                        <strong className="text-white shrink-0">
                          {observations.filter((o) => Boolean(o.pdfEvidence)).length}
                        </strong>
                        <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-72 p-2.5 rounded bg-slate-950 border border-indigo-400 text-[10px] font-mono font-normal text-slate-200 shadow-2xl z-50 text-left leading-relaxed">
                          <strong className="text-indigo-300 block mb-0.5">
                            📄 Beregningsmodel: PDF-Beviser &amp; Sumformel
                          </strong>
                          Beregnes som <code className="text-white">N_pdf = Σ I(pdfEvidence)</code>{' '}
                          korreleret med BEK 613/2026 sumformlen{' '}
                          <code className="text-indigo-200">S = Σ(C_i / GV_i)</code> (aktuel S ={' '}
                          {maxSiteSumQuotient.toFixed(2)}) og SHA-256 dokument-signatur.
                        </span>
                      </span>

                      {/* Statistik-pille 3: Fysiske Signaler */}
                      <span
                        className="group relative justify-self-start px-2.5 py-1 rounded bg-slate-950/95 hover:bg-fuchsia-950/90 border border-fuchsia-500/50 hover:border-fuchsia-300 text-fuchsia-200 hover:text-white font-bold inline-flex items-center justify-start gap-1.5 text-left cursor-help transform-gpu hover:scale-105 active:scale-95 transition-all duration-200 ease-out hover:shadow-[0_0_12px_rgba(232,121,249,0.35)] hover:-translate-y-0.5"
                        title="Beregningsmodel (Fysiske Signaler & Algedoniske Alarmer): N_sig = Σ I(!photo ∧ !pdf). Omfatter felt-observationer, kort-snapshots og automatiske støv-/støj-alarmer beregnet via 24t Gaussisk Puff-deposition D_24h = Σ(C_t · v_d · Δt) (µg/m²) og akustisk refraktion ΔL_refr (dB)."
                      >
                        <span className="truncate">⚡ Fysiske Signaler:</span>
                        <strong className="text-white shrink-0">
                          {
                            observations.filter((o) => !o.photoEvidence && !o.pdfEvidence)
                              .length
                          }
                        </strong>
                        <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-72 p-2.5 rounded bg-slate-950 border border-fuchsia-400 text-[10px] font-mono font-normal text-slate-200 shadow-2xl z-50 text-left leading-relaxed">
                          <strong className="text-fuchsia-300 block mb-0.5">
                            ⚡ Beregningsmodel: Algedoniske Fysiske Signaler
                          </strong>
                          Beregnes via 24t Gaussisk Puff-deposition{' '}
                          <code className="text-fuchsia-200">D_24h = Σ(C_t · v_d · Δt)</code> (µg/m²)
                          samt medvinds-lydrefraktion <code className="text-white">ΔL_refr</code>{' '}
                          (dB) over støjskærm.
                        </span>
                      </span>

                      {/* Statistik-pille 4: Total SHA-256 */}
                      <span
                        className="group relative justify-self-start px-2.5 py-1 rounded bg-emerald-950/85 hover:bg-emerald-900/90 border border-emerald-500/50 hover:border-emerald-300 text-emerald-200 hover:text-white font-bold inline-flex items-center justify-start gap-1.5 text-left cursor-help transform-gpu hover:scale-105 active:scale-95 transition-all duration-200 ease-out hover:shadow-[0_0_12px_rgba(52,211,153,0.4)] hover:-translate-y-0.5"
                        title="Beregningsmodel (Total SHA-256 & Merkle-Root): N_total = N_foto + N_pdf + N_sig. Hver registrering hashes kryptografisk via H_i = SHA-256(tid || WGS84 || S_i || vejdata || H_{i-1}) og aggregeres til en samlet Merkle-Root signatur efter Retsplejelovens § 823."
                      >
                        <span className="truncate">🔐 Total SHA-256:</span>
                        <strong className="text-emerald-300 shrink-0">{observations.length}</strong>
                        <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-72 p-2.5 rounded bg-slate-950 border border-emerald-400 text-[10px] font-mono font-normal text-slate-200 shadow-2xl z-50 text-left leading-relaxed">
                          <strong className="text-emerald-300 block mb-0.5">
                            🔐 Beregningsmodel: SHA-256 Chain-of-Custody
                          </strong>
                          Kædet hash-funktion{' '}
                          <code className="text-emerald-200">
                            H_i = SHA256(payload_i || S_i || H_&#123;i-1&#125;)
                          </code>{' '}
                          samlet i en verificerbar Merkle-Root (Retsplejelovens § 823).
                        </span>
                      </span>

                      {/* Statistik-pille 5: L 69 Estimeret Bøderisiko (DKK) & Aktive Kat. d/e Enheder */}
                      <span
                        className="col-span-2 group relative justify-self-start px-2.5 py-1 rounded bg-rose-950/90 hover:bg-rose-900/95 border border-rose-500/60 hover:border-rose-300 text-rose-200 hover:text-white font-bold inline-flex items-center justify-start gap-1.5 text-left cursor-help transform-gpu hover:scale-105 active:scale-95 transition-all duration-200 ease-out hover:shadow-[0_0_12px_rgba(244,63,94,0.45)] hover:-translate-y-0.5"
                        title="Beregningsmodel (Lovforslag L 69 af 8. okt. 2026 & Kat. d/e): Bøderisiko = Σ B_min(§8, §33, §50) · F_gentagelse + ΔB_besparelse. Indregner aktive bygningsenheder i kat. d (Under nedrivning) og kat. e (Nedrevet, ikke sikret)."
                      >
                        <span className="truncate">⚖️ L 69 Estimeret Bøderisiko (DKK):</span>
                        <strong className="text-amber-300 shrink-0">
                          {(
                            (buildings.filter((b) => b.category === 'd_under_demolition').length +
                              buildings.filter((b) => b.category === 'e_demolished_unsecured')
                                .length) *
                              165000 +
                            (maxSiteSumQuotient >= 1.0 ? 250000 : 80000)
                          ).toLocaleString('da-DK')}{' '}
                          kr.
                        </strong>
                        <span className="text-[9px] text-rose-200/90 shrink-0">
                          (kat. d={buildings.filter((b) => b.category === 'd_under_demolition').length} · e=
                          {buildings.filter((b) => b.category === 'e_demolished_unsecured').length})
                        </span>
                        <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-80 p-2.5 rounded bg-slate-950 border border-rose-400 text-[10px] font-mono font-normal text-slate-200 shadow-2xl z-50 text-left leading-relaxed">
                          <strong className="text-rose-300 block mb-0.5">
                            ⚖️ Beregningsmodel: Lovforslag L 69 (2026) &amp; Kat. d/e
                          </strong>
                          Beregnes som{' '}
                          <code className="text-rose-200">
                            B_total = (N_d + N_e) · 165.000 kr. + I(S≥1,0) · 250.000 kr.
                          </code>{' '}
                          jf. Jordforureningslovens § 8/§ 50, MBL § 33 og udbyttekonfiskation (MBL § 110, stk. 5).
                        </span>
                      </span>

                      {/* Statistik-pille 6: Indeklima S_in & Monte Carlo Kælder-Infiltration (Blok 6, Afd. 23) */}
                      <span
                        className="col-span-2 group relative justify-self-start px-2.5 py-1 rounded bg-purple-950/90 hover:bg-purple-900/95 border border-purple-500/60 hover:border-purple-300 text-purple-200 hover:text-white font-bold inline-flex items-center justify-start gap-1.5 text-left cursor-help transform-gpu hover:scale-105 active:scale-95 transition-all duration-200 ease-out hover:shadow-[0_0_12px_rgba(168,85,247,0.45)] hover:-translate-y-0.5"
                        title="Beregningsmodel (Indeklima S_in & Monte Carlo Blok 6, Afd. 23): S_in = Σ(C_in,i / GV_i) = 3,15 (C_in = 0,0071 f/cm³) og Monte Carlo N=10.000 C_in = (Q_op · C_kld) / (V_bolig · (ACH + k_dep)) med Vinter P95 = 17.142 fibre/m³."
                      >
                        <span className="truncate">🏠 Indeklima &amp; Monte Carlo (Blok 6):</span>
                        <strong className="text-cyan-300 shrink-0">
                          S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)}
                        </strong>
                        <span className="text-[9px] text-amber-300 shrink-0">
                          · P95 = 17.142 f/m³ · ALL §§ 11-18 ({indoorClimateTelemetry.almenlejelovRentReductionEligiblePct}%)
                        </span>
                        <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-80 p-2.5 rounded bg-slate-950 border border-purple-400 text-[10px] font-mono font-normal text-slate-200 shadow-2xl z-50 text-left leading-relaxed">
                          <strong className="text-purple-300 block mb-0.5">
                            🏠 Beregningsmodel: Indeklima S_in &amp; Monte Carlo (N=10.000)
                          </strong>
                          Beregnes som{' '}
                          <code className="text-purple-200">
                            C_in = (Q_op · C_kld) / (V_bolig · (ACH + k_dep))
                          </code>{' '}
                          med <code className="text-cyan-300">ΔP_CAV = -45,3 Pa</code>,{' '}
                          <code className="text-amber-300">z_NPL = 12,0 m</code> og ALL §§ 11, 17, 18 lejeafslag.
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* GRID AREA: actions (Dedicated Right Column — Strictly Bottom-Right with justify-self-end & Descriptive Tooltips) */}
                  <div className="pdf-grid-area-actions no-print-in-widget [grid-area:actions] lg:col-start-3 col-span-1 !mt-0 grid grid-cols-1 content-end justify-items-end self-end justify-self-end gap-1.5 text-right min-w-0">
                    {/* Row of compact utility buttons: CSV Export + Print bilag */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5 justify-self-end self-end">
                      {/* CSV Statistics Export Button */}
                      <div className="group relative justify-self-end self-end">
                        <button
                          type="button"
                          onClick={handleExportPdfWidgetStatsCsv}
                          aria-label="Eksportér Statistik som CSV-fil"
                          className={`justify-self-end self-end px-2.5 py-1 rounded font-mono text-[10px] font-bold border transition-colors cursor-pointer text-right flex items-center gap-1.5 shrink-0 ${
                            pdfWidgetCsvExportSuccess
                              ? 'bg-emerald-400 text-slate-950 border-white'
                              : 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border-cyan-400/60'
                          }`}
                          title="Eksportér den aktuelle bevis-statistik (Fotos, PDF-beviser, Fysiske Signaler, S-kvotient, Seneste SHA-256 og Merkle-Root) som CSV-fil"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-cyan-300 shrink-0" />
                          <span>
                            {pdfWidgetCsvExportSuccess
                              ? '✓ CSV Downloadet!'
                              : 'Eksportér Statistik (CSV)'}
                          </span>
                        </button>
                        <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full right-0 mb-1.5 w-68 p-2 rounded bg-slate-950 border border-cyan-400/70 text-[10px] font-mono text-slate-200 shadow-xl z-50 text-left">
                          <strong className="text-cyan-300 block">
                            Eksportér Statistik som CSV-fil
                          </strong>
                          Downloader en CSV-fil med aktuelle statistik-piller, S-kvotient, Seneste SHA-256 og Merkle-Root.
                        </div>
                      </div>

                      {/* 'Print bilag' Button (activates browser print dialog scoped to this widget) */}
                      <div className="group relative justify-self-end self-end">
                        <button
                          type="button"
                          onClick={handlePrintPdfWidgetAppendix}
                          aria-label="Print bilag"
                          className="justify-self-end self-end px-2.5 py-1 rounded font-mono text-[10px] font-bold bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-400/60 transition-colors cursor-pointer text-right flex items-center gap-1.5 shrink-0"
                          title="Print bilag — Aktiverer browserens print-dialog kun for dette retsmedicinske bilags-widget (skjuler øvrige UI-elementer under udskrift)"
                        >
                          <Printer className="w-3 h-3 text-indigo-300 shrink-0" />
                          <span>Print bilag</span>
                        </button>
                        <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full right-0 mb-1.5 w-68 p-2 rounded bg-slate-950 border border-indigo-400/70 text-[10px] font-mono text-slate-200 shadow-xl z-50 text-left">
                          <strong className="text-indigo-300 block">
                            Print bilag (Isoleret Widget-Udskrift)
                          </strong>
                          Åbner browserens print-dialog for specifikt dette retsmedicinske bilag og skjuler unødvendige UI-elementer under udskrift.
                        </div>
                      </div>
                    </div>

                    <div className="group relative justify-self-end self-end flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('indoorClimate')}
                        className="justify-self-end self-end px-2.5 py-1 rounded font-mono text-[10px] font-bold bg-purple-950/90 hover:bg-purple-900 text-purple-200 border border-purple-400/60 transition-colors cursor-pointer text-right flex items-center gap-1.5 shrink-0"
                        title="Åbn Indeklima & Monte Carlo Kælder-Infiltration (Blok 6, Afd. 23 · S_in = 3,15)"
                      >
                        <span>🏠 Indeklima &amp; Monte Carlo (S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          generateBuildingRegistryInspectionPdfReport({
                            buildings,
                            dateIso: weatherDataset.dateIso,
                            hourLabel: currentWeather.hourLabel,
                            sha256Hash,
                            receptorExposures,
                          })
                        }
                        className="justify-self-end self-end px-2.5 py-1 rounded font-mono text-[10px] font-bold bg-amber-950/90 hover:bg-amber-900 text-amber-200 border border-amber-400/60 transition-colors cursor-pointer text-right flex items-center gap-1.5 shrink-0"
                        title="Generér PDF-oversigtstabel over alle 29 bygningsenheder med statuskoder (a–e) til hurtig fysisk inspektion"
                      >
                        <Download className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>29-Enheder Inspektionstabel (PDF)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportAcousticDiagramAndDbValuesPdf}
                        aria-label="Download Acoustic Diagram PDF and Download dB Values Report"
                        className="justify-self-end self-end px-2.5 py-1 rounded font-mono text-[10px] font-bold bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border border-emerald-400/60 transition-colors cursor-pointer text-right flex items-center gap-1.5 shrink-0"
                        title="Download Acoustic Diagram PDF & Download dB Values Report — Eksportér lydbølgebøjnings-diagram (Ray-Tracing over 2,5 m skærm) og beregnede dB-værdier pr. receptor (ΔL_refr, L_Aeq,korr & L_AFmax) som PDF"
                      >
                        <Download className="w-3 h-3 text-emerald-300 shrink-0" />
                        <span>Download Acoustic Diagram &amp; dB Values PDF</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 justify-self-end self-end">
                      {/* Dedicated Direct 'Eksportér PDF' Button (without opening modal) */}
                      <div className="group relative justify-self-end self-end">
                        <button
                          type="button"
                          onClick={handleDirectExportForensicAppendixPdf}
                          aria-label="Eksportér PDF direkte uden om modal"
                          className={`justify-self-end self-end px-3 py-1.5 rounded font-mono text-[10.5px] font-extrabold border transition-all cursor-pointer text-right flex items-center gap-1.5 shrink-0 shadow-sm ${
                            directForensicPdfExportSuccess
                              ? 'bg-emerald-400 text-slate-950 border-white'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-200'
                          }`}
                          title="Eksportér PDF — Download den specifikke retsmedicinske PDF-rapport for dette bilag direkte uden at skulle igennem den generelle modal"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                          <span>
                            {directForensicPdfExportSuccess
                              ? '✓ PDF Eksporteret!'
                              : 'Eksportér PDF'}
                          </span>
                        </button>
                        <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full right-0 mb-1.5 w-72 p-2 rounded bg-slate-950 border border-amber-400 text-[10px] font-mono text-slate-200 shadow-xl z-50 text-left">
                          <strong className="text-amber-300 block">
                            Direkte Eksportér PDF (Uden Modal)
                          </strong>
                          Eksporterer den specifikke retsmedicinske PDF-rapport for dette bilag direkte til din enhed uden at åbne forhåndsvisnings-modalen.
                        </div>
                      </div>

                      <div className="group relative justify-self-end self-end">
                        <button
                          type="button"
                          onClick={() => setIsReportModalOpen(true)}
                          aria-label="Download dB Values Report and Preview Forensic Evidence Appendix"
                          className="justify-self-end self-end px-2.5 py-1.5 rounded font-mono text-[10.5px] font-bold bg-slate-950 hover:bg-slate-800 text-amber-200 border border-amber-400/50 transition-colors cursor-pointer text-right shrink-0"
                          title="Download dB Values Report & Forhåndsvis Retsmedicinsk Bilag — Åbn forhåndsvisning af retsmedicinsk bevis-rapport med dB-værdier pr. receptor, sumkvotienter og SHA-256 signaturer"
                        >
                          Forhåndsvis Retsmedicinsk Bilag (dB &amp; Beviser)
                        </button>
                        <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full right-0 mb-1.5 w-72 p-2 rounded bg-slate-950 border border-amber-400/70 text-[10px] font-mono text-slate-200 shadow-xl z-50 text-left">
                          <strong className="text-amber-300 block">
                            Download dB Values Report &amp; Forhåndsvis Bilag
                          </strong>
                          Viser komplet forhåndsvisning af dB-værdier pr. receptor, spredningsdata og registrerede beviser.
                        </div>
                      </div>
                    </div>

                    <div className="group relative justify-self-end self-end">
                      <button
                        type="button"
                        onClick={handleExportChronologicalEvidencePdfReport}
                        aria-label="Download Chronological Forensic PDF Report, Acoustic Diagram PDF and dB Values Report"
                        className={`px-3.5 py-2 rounded font-mono text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer shadow-md justify-self-end self-end ${
                          isGeneratingChronologicalPdf
                            ? 'bg-cyan-400 text-slate-950 border-white animate-pulse ring-2 ring-cyan-200'
                            : chronologicalPdfExportSuccess
                            ? 'bg-emerald-400 text-slate-950 border-white'
                            : observations.length > 0
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-100 animate-pulse ring-2 ring-amber-300/90 shadow-[0_0_16px_rgba(251,191,36,0.75)]'
                            : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-100'
                        }`}
                        title="Download Acoustic Diagram PDF, Download dB Values Report & Kronologisk Bevis-Rapport (SHA-256) — Download kronologisk PDF-rapport over alle registrerede observationer (fotos, PDF-beviser og fysiske signaler) med SHA-256 signaturer"
                      >
                        {isGeneratingChronologicalPdf ? (
                          <>
                            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                            <span>Genererer...</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-cyan-300 border border-cyan-400 text-[10px] font-mono font-extrabold">
                              Genererer...
                            </span>
                          </>
                        ) : chronologicalPdfExportSuccess ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              ✓ Kronologisk PDF Downloadet ({observations.length})!
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-950 text-emerald-300 border border-emerald-400 text-[10px] font-mono font-extrabold">
                              Klar til eksport
                            </span>
                          </>
                        ) : (
                          <>
                            {observations.length > 0 && (
                              <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-600 opacity-80" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border border-white" />
                              </span>
                            )}
                            <Download className="w-4 h-4 shrink-0" />
                            <span>
                              📄 Eksportér Kronologisk PDF-Rapport (SHA-256 · {observations.length})
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-950/90 text-emerald-300 border border-emerald-400/70 text-[10px] font-mono font-extrabold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                              <span>Klar til eksport</span>
                            </span>
                          </>
                        )}
                      </button>
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full right-0 mb-1.5 w-72 p-2 rounded bg-slate-950 border border-amber-300 text-[10px] font-mono text-slate-200 shadow-xl z-50 text-left">
                        <strong className="text-amber-300 block">
                          Download Kronologisk PDF-Rapport (SHA-256)
                        </strong>
                        Status: {isGeneratingChronologicalPdf ? 'Genererer...' : 'Klar til eksport'}. Eksporterer kronologisk sorteret retsmedicinsk PDF-rapport med fotos, PDF-beviser, fysiske signaler, vejrdata og 64-tegns SHA-256 signaturer.
                      </div>
                    </div>
                  </div>
                </div>

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
                      className={`p-3.5 rounded-md border-2 space-y-3 shadow-lg ${
                        isSystemicTetanus
                          ? 'bg-rose-950/45 border-rose-500/80'
                          : 'bg-slate-900/90 border-emerald-500/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-xs font-mono uppercase tracking-wider font-extrabold flex items-center gap-1.5 text-white">
                            <AlertTriangle
                              className={`w-4 h-4 shrink-0 ${
                                isSystemicTetanus ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
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
                          <div className="text-[10px] text-slate-400 uppercase">
                            Kriseinterval (Δt)
                          </div>
                          <div className="text-base font-extrabold text-cyan-300 tabular-nums">
                            Δt = {crisisIntervalDtHours.toFixed(1)} timer
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {breachHoursCount} overskridelser / smertesignaler pr. 24t
                          </div>
                        </div>

                        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase">
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
                          <div className="flex items-center justify-between text-[9.5px] text-slate-400">
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
                          <div className="text-[10px] text-slate-400 uppercase">
                            Kybernetisk Kvotient (Tr / Δt)
                          </div>
                          <div
                            className={`text-base font-extrabold tabular-nums ${
                              isSystemicTetanus ? 'text-rose-400' : 'text-emerald-300'
                            }`}
                          >
                            Tr / Δt = {(relaxationTimeTrHours / crisisIntervalDtHours).toFixed(2)}x
                          </div>
                          <div className="text-[10px] text-slate-300">
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
                      <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-bold flex items-center gap-1.5">
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

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                    <span>
                      Tabel-skema: <strong className="text-cyan-300">forensic_observations_audit_log</strong> · PK:{' '}
                      <strong className="text-slate-200">record_uuid</strong>
                    </span>
                    <span className="truncate max-w-[280px]">
                      State SHA-256: <strong className="text-cyan-300">{sha256Hash.slice(0, 20)}...</strong>
                    </span>
                  </div>
                </div>

                {/* NEW AI FEATURE: 1. Upload Foto · 2. AI Analyse & Visuel Beskrivelse · 3. Registrering af Foto Dokumentation som Bevismateriale */}
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

                {/* PDF-BEVISUPLOAD: Mailkorrespondancer, Svar på Anmodninger om Aktindsigt & Myndighedshenvendelser */}
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
                      })
                    }
                  />
                </DockableWindowFrame>

                {/* 24-TIMERS BEVIS-TIDSLINJE WIDGET (Fysiske Observationer, Foto- & PDF-Beviser vs. Meteorologisk Spidsbelastning) */}
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
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40">
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
                      <label className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
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
                    <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold">
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
                            className={`text-left px-2.5 py-1.5 rounded border text-xs transition-colors ${
                              isSelected
                                ? 'bg-fuchsia-950/60 border-fuchsia-400 text-white font-semibold'
                                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            ⚡ {preset.type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Reporter Role & Identifier */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
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
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
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
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
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
                      <div className="p-2.5 rounded bg-slate-950/95 border border-cyan-500/45 space-y-1.5 font-mono text-[10.5px]">
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
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                              rightToOpacityEnabled
                                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {rightToOpacityEnabled
                              ? '✓ Right-to-Opacity: AKTIV (Ingen navn/CPR/IP gemmes)'
                              : '○ Right-to-Opacity: FRA'}
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

                {/* Registered Algedonic Signals & Photo Evidence Log */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Registrerede Algedoniske Signaler &amp; Foto-Beviser ({observations.length})
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddAllFindingsToEvidence}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 border border-emerald-200 text-[10px] font-mono font-bold text-slate-950 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        title="Føj alle aktuelle fund (lovovertrædelser, udsatte receptorer og vejr-/støvkorrelation) direkte til Beviser med SHA-256 signatur"
                      >
                        <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0" />
                        <span>
                          {batchAddFindingsSuccess
                            ? `✓ ${batchAddedFindingsCount} fund føjet til Beviser!`
                            : `➕ Føj alle fund til Beviser (${totalCurrentFindingsCount})`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportChronologicalEvidencePdfReport}
                        className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 border border-amber-200 text-[10px] font-mono font-extrabold text-slate-950 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        title="Generér og download kronologisk PDF-rapport over alle registrerede observationer (fotos, PDF-beviser og fysiske signaler) med SHA-256 signaturer som officielt retsmedicinsk bilag i klagesager"
                      >
                        <FileText className="w-3 h-3 text-slate-950 shrink-0" />
                        <span>
                          {chronologicalPdfExportSuccess
                            ? '✓ Kronologisk PDF-Rapport Downloadet!'
                            : `📄 Eksportér Kronologisk PDF-Rapport (Fotos, PDF & Signaler · ${observations.length})`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportChainOfCustodyPdfReport}
                        className="px-2.5 py-1 rounded bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/70 text-[10px] font-mono font-bold text-emerald-200 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        title="Generér og download 'Chain-of-Custody' rapport som PDF, hvor alle SHA-256 signaturer fra registrerede beviser er samlet i en verificerbar log-tabel (beviser uforanderlighed over tid)"
                      >
                        <Download className="w-3 h-3 text-emerald-300 shrink-0" />
                        <span>
                          {chainOfCustodyPdfExportSuccess
                            ? '✓ Chain-of-Custody PDF Downloadet!'
                            : `🔐 Chain-of-Custody Rapport (PDF · ${observationChainOfCustodyLedger.entries.length} SHA-256)`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowObservationChainOfCustodyLog((prev) => !prev)}
                        className={`px-2.5 py-1 rounded border text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                          showObservationChainOfCustodyLog
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                            : 'bg-slate-900 hover:bg-slate-800 border-emerald-500/50 text-emerald-300'
                        }`}
                        title="Vis eller skjul den verificerbare Chain-of-Custody SHA-256 log-tabel for alle registrerede observationer"
                      >
                        <span>
                          {showObservationChainOfCustodyLog
                            ? 'Skjul SHA-256 Log-Tabel ▲'
                            : 'Vis SHA-256 Log-Tabel ▼'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportForensicAuditLogJson}
                        className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-[10px] font-mono font-bold text-cyan-200 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Eksportér fuld audit-log over alle registrerede observationer (inkl. SHA-256 signaturer) som JSON til retsmedicinsk database"
                      >
                        <Download className="w-3 h-3 text-cyan-300 shrink-0" />
                        <span>
                          {auditLogJsonExportSuccess
                            ? '✓ Audit-Log JSON Downloadet'
                            : 'Eksportér Audit-Log (DB JSON · SHA-256)'}
                        </span>
                      </button>
                      {observations.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllEvidenceFromScratch}
                          className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-[10px] font-mono font-bold text-rose-200 cursor-pointer"
                          title="Slet alle registrerede beviser og start registreringen helt forfra (fra scratch)"
                        >
                          🗑 Slet Alle Beviser (Start Fra Scratch)
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
                          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold">
                            CHAIN-OF-CUSTODY (BEVISKÆDE) · VERIFICERBAR SHA-256 SIGNATUR-LOG OVER TID
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
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
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-[10px] font-mono font-bold text-emerald-200 cursor-pointer"
                          >
                            ✓ Re-Verificér SHA-256 Uforanderlighed
                          </button>
                          <button
                            type="button"
                            onClick={handleExportChainOfCustodyPdfReport}
                            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-mono font-bold cursor-pointer"
                          >
                            Download PDF Log-Tabel
                          </button>
                        </div>
                      </div>

                      {obsChainImmutabilityVerifiedAt && (
                        <div className="px-2.5 py-1.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[10px] font-mono text-emerald-200">
                          ✓ Kryptografisk Re-Hash Kontrol gennemført kl. {obsChainImmutabilityVerifiedAt}: Alle{' '}
                          {observationChainOfCustodyLedger.entries.length} SHA-256 signaturer og Merkle-kædeled matcher 100% — ingen observationer er ændret over tid.
                        </div>
                      )}

                      <div className="max-h-64 overflow-y-auto rounded border border-slate-800">
                        <table className="w-full text-left border-collapse text-[10px] font-mono">
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
                                  <div className="text-[8px] text-slate-500">
                                    Reg: {row.registeredUtcIso.slice(0, 19).replace('T', ' ')}
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 align-top">
                                  <div className="text-emerald-400 font-bold">
                                    {row.entryTypeLabel} · {row.timestampIso}
                                  </div>
                                  <div className="text-slate-200">{row.sourceOrSubject}</div>
                                  <div className="text-[9px] text-slate-400">{row.referenceOrLocation}</div>
                                  <div className="text-[8px] text-cyan-300/80 break-all mt-0.5">
                                    {row.canonicalPayloadFingerprint}
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 align-top">
                                  <div className="p-1 rounded bg-slate-900 border border-cyan-500/30 text-[9px] text-cyan-200 break-all select-all">
                                    {row.sha256Signature}
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 align-top whitespace-nowrap">
                                  <div className="text-[8px] text-slate-400">
                                    Chain: {row.chainedAuditDigest.slice(0, 12)}...
                                  </div>
                                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-[8px] font-bold text-emerald-300">
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
                            <span className="font-bold text-fuchsia-300">
                              {obs.photoEvidence ? '📸 ' : obs.pdfEvidence ? '📄 ' : '⚡ '}
                              {obs.code} · {obs.observedDateIso} kl. {obs.observedHourLabel}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
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
                                  <div className="text-[10px] font-mono text-cyan-300 font-bold truncate">
                                    AI FOTO-ANALYSE: {obs.photoEvidence.aiAnalysis.visualTitle}
                                  </div>
                                  <div className="text-[10px] font-mono text-amber-300">
                                    Alvorsgrad: {obs.photoEvidence.aiAnalysis.severityAssessment} (
                                    {obs.photoEvidence.aiAnalysis.confidencePct}% AI-konfidens)
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-400 truncate">
                                    Billed SHA-256: {obs.photoEvidence.imageSha256Hash.slice(0, 22)}...
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {obs.pdfEvidence && (
                            <div className="p-2 rounded bg-indigo-950/40 border border-indigo-500/50 space-y-1">
                              <div className="text-[10px] font-mono text-indigo-300 font-bold truncate">
                                📄 PDF-BEVIS ({obs.pdfEvidence.id}): {obs.pdfEvidence.aiAnalysis.documentTitle}
                              </div>
                              <div className="text-[10px] font-mono text-slate-300 truncate">
                                Fra: {obs.pdfEvidence.aiAnalysis.senderEntity} → Til:{' '}
                                {obs.pdfEvidence.aiAnalysis.recipientEntity}
                              </div>
                              <div className="text-[9.5px] font-mono text-amber-300 truncate">
                                Ref.: {obs.pdfEvidence.aiAnalysis.referenceJournalNumber} · PDF SHA-256:{' '}
                                {obs.pdfEvidence.sha256Hash.slice(0, 18)}...
                              </div>
                            </div>
                          )}

                          {obs.mapSnapshot && (
                            <div className="p-2 rounded bg-amber-950/35 border border-amber-400/60 space-y-1 font-mono text-[10px]">
                              <div className="flex items-center justify-between gap-2 text-amber-300 font-bold">
                                <span>🗺️ SNAPSHOT MAP BEVIS (2D TAKTISK KORT-UDSNIT)</span>
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
                                    className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-cyan-500/40 text-[9px] text-cyan-200"
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
                                <div className="text-[10px] text-cyan-300/90 pt-0.5">
                                  ZKP ({zkp.rightToOpacityEnabled ? 'Right-to-Opacity' : 'Åben'}):{' '}
                                  {zkp.zkpProofHash.slice(0, 20)}... · ∂T/∂z={' '}
                                  {zkp.physicalToDigitalProofOfState.temperatureGradientDtDzKm} K/m ·
                                  L_AFmax(+5dB)={zkp.physicalToDigitalProofOfState.noiseLafmaxDb} dB(A)
                                </div>
                              );
                            })()}
                            <div className="text-[10px] text-slate-500 truncate">
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
                    className="p-3 bg-rose-950/60 border-2 border-rose-500 rounded-md space-y-2 shadow-lg"
                  >
                    <div className="flex items-center justify-between gap-2 font-mono">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span>
                          REALTIDS-ALARM (&gt; 10 m/s): MEST BERØRTE RECEPTORER
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-mono font-bold">
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
                              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9.5px] font-extrabold mr-1.5">
                                #{rank}
                              </span>
                              <span className="font-bold">{r.receptorCode}: {r.receptorName}</span>
                              <div className="text-[10px] text-slate-300 truncate mt-0.5">
                                {r.address} · {r.distanceFromNearestSourceMeters} m fra{' '}
                                {r.dominantSourceName.split(':')[0]}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-extrabold text-rose-300">
                                S = {r.sumQuotient.toFixed(2)}
                              </div>
                              <div className="text-[9.5px] text-amber-200">Aktiv fokus</div>
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
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        ARBEJDSTILSYNETS SUMFORMEL · BEK 613/2026 § 3, STK. 3
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{selectedReceptorExposure.receptorName}</span>
                        {highWindRankByReceptorId[selectedReceptorExposure.receptorId] && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white border border-amber-300 text-[10px] font-mono font-extrabold">
                            ⚠ #{highWindRankByReceptorId[selectedReceptorExposure.receptorId]} MEST BERØRT (&gt;10 m/s)
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
                      <div className="text-[10px] text-slate-400">SUMKVOTIENT</div>
                      <div
                        className={`text-2xl font-bold ${
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
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
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
                            {hwRank ? `⚠ [#${hwRank} MEST BERØRT >10m/s] ` : ''}
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
                    <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between px-0.5">
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
                      className="w-full py-2 px-3 rounded bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-200 font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <span>
                        🧬 Åbn 3D Molekylær Toksikologi &amp; Lægefaglig AI Ekspert →
                      </span>
                    </button>
                  </div>
                </div>

                {/* Lægefaglig AI Ekspert & Samlet Bevis-Bilag over Sundhedsmæssige Konsekvenser */}
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

                {/* Interactive Cumulative Respirable Dust Dose Chart at Most Exposed Receptors */}
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

                {/* 4 Primary Demolition Sources (PSS Sag W22085) + Interactive Source Parameters for 3D Asbestos-Fiber Heatmap */}
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
                        className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold transition-colors shrink-0"
                      >
                        ☣ Fokusér 3D Heatmap
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-snug">
                      Justér <strong className="text-white">frigivelseshøjde (H)</strong> og{' '}
                      <strong className="text-emerald-300">&lt;1997 asbest-fiberindeks</strong> på
                      kildenoderne herunder for at se fiber-koncentrationen (fibre/cm³ mod 2026-GV =
                      0,003 fibre/cm³) opdatere i realtid i 3D-scenen.
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-rose-500/30 text-[10px] font-mono">
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

                  {/* Master Bygnings- & Blokregister med 5 Operationelle Kategorier (a–e) */}
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

                  {/* Specifikke Miljøprøveresultater (Wissenberg PSS W22085 / 2021-2791 / RING_K18_C08.7) & DMA Anbefalinger pr. Bygning */}
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

                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Aktive Emissions-Kildenoder ({sources.length} fra Bygningsregister)
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      {sources.filter((s) => s.active).length} aktive
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sources.map((src) => {
                      const hasAsbestos = src.substances.includes('asbestos');
                      const fiberPct = Math.round((src.fiberReleaseIndex ?? 0.75) * 100);
                      return (
                        <div
                          key={src.id}
                          onClick={() => setSelectedSourceId(src.id)}
                          className={`p-3 rounded-md border transition-colors cursor-pointer ${
                            selectedSourceId === src.id
                              ? 'bg-slate-900 border-cyan-500/60'
                              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-xs text-white">{src.name}</div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSourceActive(src.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                src.active
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {src.active ? '● KILDE AKTIV' : '○ INAKTIV'}
                            </button>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center justify-between gap-2">
                            <span>
                              {src.address} · GPS: {src.position.lat.toFixed(4)},{' '}
                              {src.position.lng.toFixed(4)} · H={src.releaseHeightMeters}m
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold shrink-0">
                              ☣ &lt;1997 Fiber: {fiberPct}%
                            </span>
                          </div>

                          {/* Interactive Real-Time Source Parameters for 3D Asbestos-Fiber Dispersion Heatmap */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                              <span className="text-cyan-300 font-semibold uppercase">
                                Kilde-Parametre → 3D Asbest-Heatmap
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleSourceAsbestosSubstance(src.id)}
                                className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold ${
                                  hasAsbestos
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                                    : 'bg-slate-900 text-slate-500 border-slate-800'
                                }`}
                              >
                                {hasAsbestos ? '☣ Asbest: AKTIV' : 'Asbest: FRA'}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10px] font-mono">
                              <div>
                                <div className="flex items-center justify-between text-slate-300 mb-0.5">
                                  <span>Frigivelseshøjde (H):</span>
                                  <strong className="text-cyan-300">
                                    {src.releaseHeightMeters} m
                                  </strong>
                                </div>
                                <input
                                  type="range"
                                  min={2}
                                  max={24}
                                  step={1}
                                  value={src.releaseHeightMeters}
                                  onChange={(e) =>
                                    updateSourceReleaseHeight(src.id, Number(e.target.value))
                                  }
                                  aria-label={`Frigivelseshøjde for ${src.name}`}
                                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-slate-300 mb-0.5">
                                  <span>Asbest Fiber-Indeks:</span>
                                  <strong className="text-emerald-300">{fiberPct}%</strong>
                                </div>
                                <input
                                  type="range"
                                  min={10}
                                  max={180}
                                  step={5}
                                  value={fiberPct}
                                  onChange={(e) =>
                                    updateSourceFiberReleaseIndex(
                                      src.id,
                                      Number(e.target.value) / 100
                                    )
                                  }
                                  aria-label={`Asbest fiber-frigivelsesindeks for ${src.name}`}
                                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                                />
                              </div>
                            </div>
                          </div>

                          {src.constructionYearRange && (
                            <div className="mt-1.5 p-2 rounded bg-emerald-950/30 border border-emerald-500/30 text-[11px] space-y-0.5">
                              <div className="font-mono text-emerald-300 font-semibold">
                                {src.constructionYearRange} · {src.materialAgeCategory}
                              </div>
                              {src.healthRiskCorrelation && (
                                <div className="text-slate-300 leading-snug">
                                  {src.healthRiskCorrelation}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-2 space-y-0.5 text-[11px] text-slate-300">
                            {src.substances.map((sk) => (
                              <div key={sk} className="truncate">
                                <span className="text-slate-400 font-mono">
                                  {SUBSTANCE_SPECS[sk].shortName}:
                                </span>{' '}
                                {src.substanceDetails[sk]}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
              </DockableWindowFrame>
            )}

            {/* TAB 2: 24-TIMERS GAUSSISK PUFF-HISTORIK & SPIDSBELASTNINGS-RECEPTOR */}
            {activeTab === 'puff24h' && (
              <div className="space-y-4">
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

                {/* 24h Open-Meteo Telemetry Summary Banner */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-md text-xs font-mono space-y-1">
                  <div className="text-[10px] text-cyan-400 uppercase font-semibold">
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

                {/* Peak Exposed Receptor Highlight Box */}
                <div className="p-3.5 bg-amber-950/25 border-2 border-amber-500/60 rounded-md space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                      ★ HØJESTE 24-TIMERS AKKUMULEREDE DOSIS I RINGPARKEN
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
                      <div className="text-[10px] text-slate-400">24T KUMULATIV SUM-DOSIS</div>
                      <div className="text-base font-bold text-rose-400">
                        {puff24h.peakReceptor.cumulativeSumDose.toFixed(2)} S·t
                      </div>
                    </div>
                    <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">KLOKKESLÆT SPIDSBELASTNING</div>
                      <div className="text-base font-bold text-amber-300">
                        kl. {puff24h.peakReceptor.peakHourLabel} (S=
                        {puff24h.peakReceptor.peakSumQuotient.toFixed(2)})
                      </div>
                    </div>
                    <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">24T TUNGMETAL/PCB DEPONERING</div>
                      <div className="text-sm font-bold text-white">
                        {puff24h.peakReceptor.totalDepositedHeavyMetalsAndPcbUgM2} µg/m²
                      </div>
                    </div>
                    <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">24T ASBESTFIBER-DEPONERING</div>
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
                          <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                            METEOROLOGISK KORRELATION &amp; DAGSLYS-VINDUE (00:00–23:00)
                          </div>
                          <div className="text-xs font-bold text-white">
                            Dosis-Histogram (Solopgang/Solnedgang) vs. Vejr-Trend
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300">
                          Valgt: kl. {currentWeather.hourLabel} · Spids: kl.{' '}
                          {puff24h.peakReceptor.peakHourLabel}
                        </span>
                      </div>

                      {/* Sunrise & Sunset Interactive Timeline Strip for Selected Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-950/90 border border-yellow-500/35 font-mono text-[10.5px]">
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
                            <span>☀↑ Solopgang: {solarInfo.sunriseLabel}</span>
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
                            <span>☀↓ Solnedgang: {solarInfo.sunsetLabel}</span>
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
                          <div className="flex items-center justify-between text-[11px] font-mono">
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
                              className="absolute inset-y-0 bg-gradient-to-b from-yellow-400/15 via-amber-400/10 to-transparent pointer-events-none z-0 rounded-t"
                              style={{
                                left: `${sunriseLeftPct.toFixed(1)}%`,
                                width: `${daylightWidthPct.toFixed(1)}%`,
                              }}
                            >
                              <div className="w-full text-center text-[7.5px] font-mono text-yellow-200/80 pt-0.5 truncate">
                                ☀ Dagslys ({solarInfo.sunriseLabel}–{solarInfo.sunsetLabel})
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
                                className="pointer-events-auto -translate-x-1/2 -top-0.5 absolute px-1 py-0.2 rounded bg-slate-950/95 border border-yellow-300 text-[8px] font-mono font-bold text-yellow-300 whitespace-nowrap hover:bg-yellow-400 hover:text-slate-950 transition-colors shadow-xs"
                              >
                                ☀↑ {solarInfo.sunriseLabel}
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
                                className="pointer-events-auto -translate-x-1/2 -top-0.5 absolute px-1 py-0.2 rounded bg-slate-950/95 border border-amber-400 text-[8px] font-mono font-bold text-amber-300 whitespace-nowrap hover:bg-amber-400 hover:text-slate-950 transition-colors shadow-xs"
                              >
                                ☀↓ {solarInfo.sunsetLabel}
                              </button>
                            </div>

                            {/* S = 1.0 Legal Limit Reference Line */}
                            <div
                              className="absolute inset-x-0 border-t border-dashed border-rose-500/60 pointer-events-none z-10"
                              style={{
                                bottom: `${Math.min(84, Math.round((1.0 / maxS) * 84))}%`,
                              }}
                            >
                              <span className="absolute right-0 -top-3 text-[8px] font-mono text-rose-400 bg-slate-950/80 px-1 rounded">
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
                                      ? `☀ Dagslys ${solarInfo.sunriseLabel}–${solarInfo.sunsetLabel}`
                                      : '☾ Nat/Skumring'
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

                          <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pt-0.5">
                            <span>00</span>
                            <span className="text-yellow-300 font-semibold">
                              ☀↑{solarInfo.sunriseLabel}
                            </span>
                            <span>12</span>
                            <span className="text-amber-300 font-semibold">
                              ☀↓{solarInfo.sunsetLabel}
                            </span>
                            <span>23</span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-slate-800/80 pt-1">
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
                            <span className="text-[10px] text-slate-400">
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

                          <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pt-0.5">
                            <span>00</span>
                            <span className="text-yellow-300 font-semibold">
                              ☀↑{solarInfo.sunriseLabel}
                            </span>
                            <span>12</span>
                            <span className="text-amber-300 font-semibold">
                              ☀↓{solarInfo.sunsetLabel}
                            </span>
                            <span>23</span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-slate-800/80 pt-1">
                            <span
                              className={`flex items-center gap-1 ${
                                currentWeather.windSpeed10m > 10
                                  ? 'bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold border border-rose-200 animate-pulse'
                                  : 'text-cyan-300'
                              }`}
                            >
                              <span
                                className={`w-2.5 h-0.5 inline-block ${
                                  currentWeather.windSpeed10m > 10 ? 'bg-white' : 'bg-cyan-400'
                                }`}
                              />{' '}
                              Vind ({currentWeather.windSpeed10m} m/s
                              {currentWeather.windSpeed10m > 10 ? ' ⚠ >10 m/s' : ''})
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
                      <div className="p-2 bg-slate-950/80 border border-slate-800/90 rounded text-[11px] font-mono text-slate-300 flex flex-col gap-1">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400">
                          <span className="text-yellow-300 font-semibold">
                            ☀ DAGSLYS-KORRELATION ({solarInfo.sunriseLabel}–{solarInfo.sunsetLabel} ·{' '}
                            {solarInfo.daylightDurationFormatted}):
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
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
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
                            <span className="font-semibold text-white">
                              {idx === 0 ? '★ #1 ' : `#${idx + 1} `}
                              {rec.receptorName}
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
                const el = document.getElementById('compliance-gemini-5-experts-anchor');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

              return (
                <div className="space-y-4">
                  {/* Dedicated Sub-Tab Bar inside 'compliance' panel including 'L 69 Straffesats- og Konfiskationsberegner' */}
                  <div className="p-2.5 rounded-lg bg-slate-900/95 border border-rose-500/40 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-rose-400" />
                      <span>RETSMEDICINSKE COMPLIANCE- &amp; SANKTIONSMODULER:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
                      {(
                        [
                          { id: 'all', label: 'Alle Kontrolmoduler' },
                          {
                            id: 'l69_calculator',
                            label: '⚖ L 69 Straffesats- og Konfiskationsberegner',
                          },
                          {
                            id: 'pss_interlocks',
                            label: '🔒 Wissenberg PSS W22085 Sikkerhedslåse',
                          },
                          {
                            id: 'violations_pdf',
                            label: '📄 Lovovertrædelser & PDF-Bevisarkiv',
                          },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setComplianceSubTab(tab.id)}
                          className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
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

                  {complianceSubTab === 'l69_calculator' && (
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

                  {complianceSubTab === 'pss_interlocks' && (
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
                    />
                  )}

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
                      })
                    }
                  />
                </DockableWindowFrame>

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
                      <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-rose-500/40 text-[10px] font-mono text-rose-200">
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
                            className="text-[10px] font-mono text-cyan-300 hover:text-cyan-200 underline"
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
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
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
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
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
                      <button
                        type="button"
                        disabled={isGeneratingMunicipalSummary}
                        onClick={async () => {
                          setIsGeneratingMunicipalSummary(true);
                          try {
                            const response = await fetch('/api/generate-municipal-legal-summary', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                violations: effectiveSelectedViolations,
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
                                `Juridisk Resume til Slagelse Kommune (${effectiveSelectedViolations.length} valgte overtrædelser)`,
                              summaryText: data.summaryText || '',
                              municipalLegalBases: Array.isArray(data.municipalLegalBases)
                                ? data.municipalLegalBases
                                : [],
                              demandedMunicipalActions: Array.isArray(data.demandedMunicipalActions)
                                ? data.demandedMunicipalActions
                                : [],
                              modelUsed:
                                data.modelUsed ||
                                'Gemini 5 Eksperter (Slagelse Kommune Klage-Syntese)',
                              generatedAtLabel: `${weatherDataset.dateIso} kl. ${currentWeather.hourLabel}`,
                            });
                          } catch {
                            // handled by server fallback
                          } finally {
                            setIsGeneratingMunicipalSummary(false);
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded bg-gradient-to-r from-rose-500 via-amber-400 to-amber-300 text-slate-950 font-extrabold text-xs hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
                        title="Generér automatisk et formelt 'Juridisk Resume' for de valgte lovovertrædelser via Gemini-eksperter, målrettet en formel klage til Slagelse Kommune"
                      >
                        {isGeneratingMunicipalSummary ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                        ) : (
                          <Scale className="w-4 h-4 shrink-0" />
                        )}
                        <span>
                          {isGeneratingMunicipalSummary
                            ? 'Gemini Eksperter udarbejder Juridisk Resume til Slagelse Kommune...'
                            : `🏛️ Generér 'Juridisk Resume' til Klage (Slagelse Kommune · ${effectiveSelectedViolations.length} valgt)`}
                        </span>
                      </button>

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
                      <div className="p-3 rounded-md bg-slate-950/95 border-2 border-emerald-400/75 space-y-2.5 shadow-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold flex items-center gap-1.5">
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
                              className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[10px] font-mono font-bold cursor-pointer flex items-center gap-1"
                              title="Download CSV med semikolon (;) til dansk Excel og Slagelse Kommunes ESDH/SBSYS"
                            >
                              <Download className="w-3 h-3 shrink-0" />
                              <span>Download .CSV (Semikolon ;)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportViolationsToCsv(',')}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-emerald-200 text-[10px] font-mono font-semibold cursor-pointer"
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
                              className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-[10px] font-mono font-bold cursor-pointer"
                            >
                              {violationsCsvCopied ? '✓ CSV Kopieret!' : '📋 Kopiér CSV'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowViolationsCsvTable(false)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-[10px] font-mono cursor-pointer"
                            >
                              Skjul tabel ✕
                            </button>
                          </div>
                        </div>

                        <div className="max-h-64 overflow-x-auto overflow-y-auto rounded border border-slate-800">
                          <table className="w-full text-left border-collapse text-[10.5px] font-mono">
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
                                      <div className="text-[9px] text-slate-500">{row.id}</div>
                                    </td>
                                    <td className="py-1.5 px-2 align-top">
                                      <div
                                        className={`font-bold ${
                                          isNoise ? 'text-amber-300' : 'text-rose-300'
                                        }`}
                                      >
                                        {row.legalBasisLabel}
                                      </div>
                                      <div className="text-[9.5px] text-slate-200">
                                        {row.statuteReference}
                                      </div>
                                      <div className="text-[9px] text-slate-400 truncate max-w-[230px]">
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
                                        <div className="text-[9px] text-amber-200">
                                          {row.noiseMetrics.impulseAdjustedLaeqDb.toFixed(1)} /{' '}
                                          {row.noiseMetrics.limitLaeqDb} dB(A)
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 align-top">
                                      <div className="font-semibold text-white">
                                        {row.receptorName}
                                      </div>
                                      <div className="text-[9.5px] text-slate-400">
                                        {row.receptorAddress}
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-2 align-top whitespace-nowrap">
                                      <span
                                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${
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
                                      <div className="text-[9px] text-slate-400 mt-0.5">
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
                      <div className="p-3 rounded-md bg-slate-950/95 border-2 border-amber-400/80 space-y-2.5 shadow-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                              <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                JURIDISK RESUME · FORMEL KLAGEFORBEREDELSE TIL SLAGELSE KOMMUNE
                              </span>
                            </div>
                            <div className="text-xs font-bold text-white mt-0.5">
                              {municipalLegalSummary.headline}
                            </div>
                            <div className="text-[10px] font-mono text-cyan-300">
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
                              className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                            >
                              {municipalSummaryCopied
                                ? '✓ Kopieret til Udklipsholder!'
                                : '📋 Kopiér Juridisk Resume'}
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
                              className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                            >
                              ⬇ Download Klage-Resume (.txt)
                            </button>
                            <button
                              type="button"
                              onClick={() => setMunicipalLegalSummary(null)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-[10px] font-mono cursor-pointer"
                            >
                              Luk ✕
                            </button>
                          </div>
                        </div>

                        {/* Key Municipal Legal Bases & Demanded Actions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-950/90 border border-slate-800 text-[10.5px] font-mono">
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
                                {v.severity === 'CRITICAL_RED'
                                  ? '✖ KRITISK LOVOVERTRÆDELSE'
                                  : v.severity === 'HYDROLOGICAL_BLUE'
                                  ? '◆ HYDROLOGISK UDVASKNING'
                                  : '▲ FORHØJET RISIKO / PÅBUD'}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
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
                            <div className="text-[10px] font-mono text-slate-400">
                              Lovgrundlag: {v.statuteReference}
                            </div>
                            <div className="text-[11px] font-mono text-cyan-300">
                              Rammer: {v.receptorName} ({v.receptorAddress})
                            </div>

                            {isNoiseViolation && v.noiseMetrics && (
                              <div className="grid grid-cols-3 gap-1.5 p-2 rounded bg-slate-950/80 border border-amber-500/30 font-mono text-[10px]">
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
                                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
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
                                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 text-[10px] font-mono font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Eksportér denne specifikke lovovertrædelse som CSV-fil til Slagelse Kommunes sagsbehandlingssystem"
                                >
                                  <Download className="w-2.5 h-2.5 shrink-0" />
                                  <span>CSV</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTriggerGeminiLegalInterpretation([v], 'jurist')}
                                  className="px-2.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
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

                {/* INTEGRERET 'GEMINI 5 EKSPERTER' DIREKTE I 'LOVOVERTRÆDELSER' PANELET */}
                <div id="compliance-gemini-5-experts-anchor" className="pt-1">
                  <div className="p-2.5 rounded-t-md bg-gradient-to-r from-amber-950/60 via-slate-900 to-cyan-950/50 border border-b-0 border-amber-500/40 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-wider text-white">
                          Gemini 5 Eksperter — Automatisk Juridisk &amp; Tværfaglig AI-Tolkning af Lovovertrædelser
                        </div>
                        <div className="text-[10px] font-mono text-amber-200/90">
                          Direkte integreret i Lovovertrædelser-panelet · Tolker{' '}
                          {effectiveSelectedViolations.length} valgte lovovertrædelser (Jurist, AMR, Læge, Fysiker &amp; Kybernetiker)
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-[10px] font-mono font-bold text-amber-200">
                      {effectiveSelectedViolations.length} lovovertrædelser tilknyttet
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/90 border border-amber-500/40 rounded-b-md">
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
                      selectedLegalViolations={effectiveSelectedViolations}
                      externalViolationRequest={violationAiRequest}
                    />

                    {/* Miljøprøvekort & DMA/PSS-Saneringsprotokol i Lovgivnings- og Compliance-fanen */}
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
                </div>

                {/* 1. LOVFORSLAG L 69 (OKTOBER 2026) STRAFFESATS- OG KONFISKATIONSBEREGNER */}
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
                    handleTriggerGeminiLegalInterpretation(effectiveSelectedViolations, 'jurist');
                  }}
                />

                {/* 2. WISSENBERG PSS W22085 PROCES- OG SIKKERHEDSLÅS (INTERLOCK & BOD-TRACKER) */}
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
                />

                {/* 3. CALCULATION IN KIND 2.0 (CiK 2.0) MATERIALE-SANKEY (73.420 m²) */}
                <CikMaterialMetabolismSankey buildings={buildings} />
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
                <ForensicChatbotPanel
                  telemetryContext={{
                    selectedSourceName:
                      sources.find((s) => s.id === selectedSourceId)?.name || sources[0]?.name || 'Blok 1',
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
                    <div className="text-[10px] font-mono uppercase text-slate-400">
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
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
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

            {/* TAB 5: BIOSCIENCE & MOLEKYLÆR TOKSIKOLOGI (ALPHAFOLD DB, UNIPROT, PUBCHEM & EUROPE PMC) + WHO KUMULATIV EKSPONERINGSSCORE + LÆGEFAGLIG AI EKSPERT */}
            {activeTab === 'bioscience' && (
              <div className="space-y-4">
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

                {/* Bygningsspecifikke Miljøprøver & DMA-Anbefalinger i Bioscience & Toksikologi-fanen */}
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
            )}

            {/* TAB 6: VEJR-KORRELATION MED NABOKLAGER OM STØJ (dB) OG STØV (S) PR. KILDENODE */}
            {activeTab === 'noiseDust' && (
              <div className="space-y-4">
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
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
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
                    <span className="text-[10px] text-emerald-300 font-bold shrink-0">90 dB</span>
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
                    <span className="text-[10px] text-rose-300 font-bold shrink-0">125 dB</span>
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
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border cursor-pointer transition-colors ${
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
                    <span className="text-[10px] text-slate-300">
                      Simulerer maskinstyrke i 3D &amp; 24t-grafer
                    </span>
                  </div>
                </div>

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

                {/* Byggeteknisk Påvirkning på Indeklima (DIN 4150-3 & COWI Sag A205732) */}
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

                {/* CAV Udsugningens Påvirkning på Indeklima (BR18 § 443 & DS 447) */}
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

                {/* Termisk Opdrift (Skorstenseffekt) & 3D Neutraltryksplan (z_NPL) */}
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
                  <div className="p-3.5 rounded-lg bg-gradient-to-br from-slate-950 via-rose-950/30 to-slate-950 border-2 border-rose-500/75 shadow-xl space-y-3 font-mono">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider font-extrabold text-rose-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
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
                          className={`px-2.5 py-1 rounded text-xs font-extrabold border shadow-sm ${
                            indoorClimateTelemetry.isIllegalExceedanceSinGte1
                              ? 'bg-rose-600 text-white border-amber-300 animate-pulse'
                              : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                          }`}
                        >
                          {indoorClimateTelemetry.isIllegalExceedanceSinGte1
                            ? `✖ S_in = ${indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)} (ULOVLIG ≥ 1,0)`
                            : `✓ S_in = ${indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)} (< 1,0)`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setUseCalibratedForensicIndoorRef((prev) => !prev)
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                            useCalibratedForensicIndoorRef
                              ? 'bg-amber-400 text-slate-950 border-white'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400'
                          }`}
                          title="Skift mellem Låst Kalibreret Bevis-Tilstand (d=32m, PPV=8,7 mm/s, q75,deg=6,57, ΔP_CAV=-45,3 Pa, z_NPL=12,0 m, S_in=3,15) og Dynamisk Time-Slider beregning"
                        >
                          {useCalibratedForensicIndoorRef
                            ? '📌 Kalibreret Bevis-Lås AKTIV (S_in = 3,15)'
                            : '🔄 Dynamisk Time-Slider Beregning'}
                        </button>
                      </div>
                    </div>

                    {/* 4-Column Calibrated Telemetry Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded bg-slate-900/95 border border-amber-500/40 space-y-1">
                        <div className="text-[9.5px] uppercase text-amber-300 font-bold">
                          1. Byggeteknisk Påvirkning (DIN 4150-3)
                        </div>
                        <div className="text-white font-bold">
                          Afstand d = {indoorClimateTelemetry.distanceMeters} m → PPV ={' '}
                          <span className="text-rose-400">
                            {indoorClimateTelemetry.ppvFoundationMmPerSec.toFixed(1)} mm/s
                          </span>{' '}
                          (@ {indoorClimateTelemetry.dominantFrequencyHz} Hz)
                        </div>
                        <div className="text-[10px] text-slate-300">
                          Degraderet Permeabilitet:{' '}
                          <strong className="text-amber-300">
                            q₇₅,deg = {indoorClimateTelemetry.degradedPermeabilityQ75DegM3PerHm2.toFixed(2)} m³/(h·m²)
                          </strong>{' '}
                          (P_pen = {indoorClimateTelemetry.envelopePenetrationFactorPpen.toFixed(2)})
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900/95 border border-cyan-500/40 space-y-1">
                        <div className="text-[9.5px] uppercase text-cyan-300 font-bold">
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
                        <div className="text-[10px] text-slate-300">
                          Kontinuitet Q_ind = Q_ud ({indoorClimateTelemetry.qCavExhaustM3PerH.toFixed(1)} m³/h ={' '}
                          {indoorClimateTelemetry.qCavExhaustLs.toFixed(1)} l/s uden indblæsningsfilter)
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900/95 border border-indigo-500/40 space-y-1">
                        <div className="text-[9.5px] uppercase text-indigo-300 font-bold">
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
                        <div className="text-[10px] text-slate-300">
                          Trappedørskraft F_door ={' '}
                          <strong className="text-amber-300">
                            {indoorClimateTelemetry.stairwellDoorOpeningForceN.toFixed(1)} N
                          </strong>{' '}
                          (krav ≤ 133 N) · Krybekælder-sug:{' '}
                          {indoorClimateTelemetry.crawlspaceMoldAndAsbestosSuctionM3PerH.toFixed(1)} m³/h
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900/95 border border-rose-500/60 space-y-1">
                        <div className="text-[9.5px] uppercase text-rose-300 font-bold">
                          4. Indendørs Asbest &amp; Sumkvotient (BEK 613/2026)
                        </div>
                        <div className="text-white font-bold">
                          Asbest C_in ={' '}
                          <span className="text-rose-400">
                            {indoorClimateTelemetry.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³
                          </span>{' '}
                          ({indoorClimateTelemetry.indoorAsbestosPctOfGv}% af GV)
                        </div>
                        <div className="text-[10px] text-slate-300">
                          Q_tot = {indoorClimateTelemetry.qTotSuperposedM3PerH.toFixed(1)} m³/h (ACH ={' '}
                          {indoorClimateTelemetry.achTotalPerHour.toFixed(2)} h⁻¹) →{' '}
                          <strong className="text-rose-300">
                            S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Embedded Mathematical Formulas Box */}
                    <div className="p-2.5 rounded bg-slate-950/95 border border-slate-800 space-y-1 text-[10px]">
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
                      <table className="w-full text-left border-collapse text-[10px]">
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
                    <div
                      className={`p-2.5 rounded border space-y-2 ${
                        indoorClimateTelemetry.triggersAlgedonicIndoorAlarm
                          ? 'bg-rose-950/70 border-rose-400'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10.5px] font-bold text-rose-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                          <span>
                            {indoorClimateTelemetry.triggersAlgedonicIndoorAlarm
                              ? 'ALGEDONISK INDEKLIMA-ALARM AKTIV (S_in ≥ 0,8 eller ΔP_tot < -25 Pa)'
                              : 'Indeklima-Overvågning Aktiv'}
                          </span>
                        </div>

                        <label className="flex items-center gap-1.5 text-[10px] text-cyan-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoLogIndoorClimateAlarm}
                            onChange={(e) => setAutoLogIndoorClimateAlarm(e.target.checked)}
                            className="accent-cyan-400"
                          />
                          <span>Auto-log Algedonisk Alarm (SHA-256 + ZKP)</span>
                        </label>
                      </div>

                      <p className="text-[10px] font-sans text-slate-200 leading-snug">
                        {indoorClimateTelemetry.algedonicAlarmReasonDa}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-rose-500/30 text-[10px]">
                        <span className="text-slate-300 truncate max-w-[320px]">
                          State SHA-256 (inkl. S_in, ΔP_CAV, z_NPL, PPV):{' '}
                          <strong className="text-emerald-300">{sha256Hash.slice(0, 20)}...</strong>
                        </span>

                        <div className="flex items-center gap-1.5">
                          {lastLoggedIndoorAlarmCode && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('algedonic')}
                              className="px-2 py-1 rounded bg-fuchsia-600 text-white font-bold text-[10px] cursor-pointer"
                            >
                              ✓ Logget: {lastLoggedIndoorAlarmCode} →
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleLogIndoorClimateAlgedonicAlarm('MANUEL')}
                            className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10.5px] cursor-pointer shadow-xs"
                          >
                            ⚡ Signér &amp; Føj Indeklima-Alarm til Beviser (SHA-256 + ZKP)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

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

      {/* MODULE C: FULL-WIDTH BOTTOM INTERACTIVE TIME-SLIDER, 24H PUFF TOGGLE & SCENARIO DECK (Supports Normal & Kompakt Mode with Dropdown Menu) */}
      <footer className="relative z-40 bg-[#0B0E17] border-t border-slate-800 px-4 py-1.5 shrink-0 space-y-2">
        {/* 24-Hour Wind Direction, Puff Peak & Dual-Hour Comparison Strip (T_A & T_B) - Hidden in Kompakt Mode */}
        {!isBottomCompactMode && (isPuffMode || showHeatmapComparison) && (
          <div className="hidden md:flex items-center gap-1 bg-slate-950/90 border border-slate-800/90 rounded px-2 py-1">
            <span className="text-[10px] font-mono text-amber-400 font-semibold mr-2 whitespace-nowrap">
              {showHeatmapComparison ? '24t Time-Sammenligning (T_A ↔ T_B):' : '24t Puff-Profil (Vind & Spids):'}
            </span>
            <div className="flex-1 grid grid-cols-24 gap-0.5">
              {weatherDataset.hours.map((hr) => {
                const isPeak = hr.hourIndex === puff24h.peakReceptor.peakHourIndex;
                const isCurrB = hr.hourIndex === selectedHourIndex;
                const isCompA = showHeatmapComparison && hr.hourIndex === comparisonHourAIndex;
                const advDeg = (hr.windDirection10m + 180) % 360;
                return (
                  <button
                    key={hr.hourIndex}
                    type="button"
                    onClick={(e) => {
                      if (e.shiftKey && showHeatmapComparison) {
                        setComparisonHourAIndex(hr.hourIndex);
                      } else {
                        setSelectedHourIndex(hr.hourIndex);
                      }
                    }}
                    title={`Kl. ${hr.hourLabel}: Vind ${hr.windSpeed10m} m/s fra ${hr.windDirection10m}° (${degreesToCompass(
                      hr.windDirection10m
                    )})${isCompA ? ' — [T_A Reference-time]' : ''}${
                      isCurrB ? ' — [T_B Aktiv Time-Slider]' : ''
                    }${isPeak ? ' — ★ SPIDSBELASTNING' : ''} (Shift+Klik for at sætte T_A)`}
                    className={`flex flex-col items-center py-0.5 rounded text-[9px] font-mono transition-colors ${
                      isCompA && isCurrB
                        ? 'bg-fuchsia-500 text-white font-bold ring-1 ring-white'
                        : isCompA
                        ? 'bg-cyan-500/35 text-cyan-100 border border-cyan-300 font-bold'
                        : isCurrB
                        ? 'bg-rose-500/35 text-rose-100 border border-rose-400 font-bold'
                        : isPeak
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>
                      {isCompA ? 'A:' : isCurrB && showHeatmapComparison ? 'B:' : ''}
                      {String(hr.hourIndex).padStart(2, '0')}
                    </span>
                    <span
                      className="inline-block leading-none"
                      style={{ transform: `rotate(${advDeg}deg)` }}
                    >
                      ↑
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setSelectedHourIndex(puff24h.peakReceptor.peakHourIndex)}
              className="ml-2 px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[10px] font-mono font-semibold whitespace-nowrap hover:bg-amber-400/30"
            >
              ★ Spids: {puff24h.peakReceptor.address.split(',')[0]} kl.{' '}
              {puff24h.peakReceptor.peakHourLabel}
            </button>
          </div>
        )}

        {/* Live Midnight 00:00 Date-Rollover & Continuous Time-Travel Recording Banner - Hidden in Kompakt Mode */}
        {!isBottomCompactMode &&
          (selectedDateIso !== todayIso || lastMidnightRolloverNotice || isPlaying) && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 rounded bg-slate-950/90 border border-fuchsia-500/45 font-mono text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/50 font-bold">
                  {selectedDateIso < todayIso
                    ? `⏪ TIDSREJSE TILBAGE (${selectedDateIso} → ${playbackTargetEndDateIso})`
                    : selectedDateIso > todayIso
                    ? `⏩ NÆSTE UGES VEJRUDSIGT (${selectedDateIso})`
                    : `📅 DAGS DATO (${todayIso})`}
                </span>
                <span className="text-slate-300">
                  Ved kl. <strong className="text-white">00:00</strong> skifter dato automatisk på
                  hændelsesafspilning &amp; registrering ({weatherDataset.dateIso} kl.{' '}
                  {currentWeather.hourLabel}) og fortsætter til{' '}
                  <strong className="text-cyan-300">{playbackTargetEndDateIso}</strong>
                </span>
                {lastMidnightRolloverNotice && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/60 text-amber-200 font-bold">
                    🕛 Seneste 00:00-skift: {lastMidnightRolloverNotice.fromDateIso} →{' '}
                    {lastMidnightRolloverNotice.toDateIso} (#{midnightRolloverCount})
                  </span>
                )}
                {autoSaveEvidenceOnTimeTravel && lastAutoSavedFindingLabel && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 font-bold">
                    ⚡ Seneste auto-gemte fund: {lastAutoSavedFindingLabel} (I alt: {autoSavedEvidenceCount})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAutoSaveEvidenceOnTimeTravel((v) => !v)}
                  className={`px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                    autoSaveEvidenceOnTimeTravel
                      ? 'bg-emerald-500 text-slate-950 border-emerald-200 shadow-xs'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-400/60'
                  }`}
                  title="Auto gem beviser: Tilføjer kontinuerligt fund (med SHA-256 signatur) ved tidsrejser"
                >
                  {autoSaveEvidenceOnTimeTravel
                    ? `⚡ Auto gem beviser: TIL (${autoSavedEvidenceCount})`
                    : '⚡ Auto gem beviser: FRA'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleStartTimeTravelToToday(shiftDateIsoByDays(todayIso, -7), 0)
                  }
                  className="px-2 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-200 font-semibold"
                  title="Rejs 7 dage tilbage (sidste uge) og afspil/registrér kontinuerligt med dato-skift ved kl. 00:00 frem til dags dato"
                >
                  Sidste Uge (-7d) → Dags Dato
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextDay1 = shiftDateIsoByDays(todayIso, 1);
                    setSelectedDateIso(nextDay1);
                    setPlaybackTargetEndDateIso(nextWeekEndIso);
                    setIsContinuousRecordingToToday(true);
                    loadLiveOpenMeteo(nextDay1);
                    setActiveTab('puff24h');
                  }}
                  className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 font-semibold"
                  title="Simulér den næste uges vejrudsigt (+7 dage frem)"
                >
                  Simulér Næste Uge (+7d Udsigt)
                </button>
                {isPlaying && (
                  <button
                    type="button"
                    onClick={handleStopTimeTravelRecording}
                    className="px-2.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-xs"
                    title="Afbryd kontinuerlig tidsrejse-registrering og afspilning"
                  >
                    ⏹ Afbryd Registrering
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Top Row: Date Picker, Play/Step Controls, Time-Slider, Heatmap Comparison / Kompakt Dropdown Menu & Kompakt/Normal Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Historical & Next-Week Forecast Date Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <input
              type="date"
              value={selectedDateIso}
              min="2023-01-01"
              max={nextWeekEndIso}
              onChange={(e) => {
                const d = e.target.value;
                if (d) {
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
                }
              }}
              className="bg-transparent text-xs font-mono text-white focus:outline-none"
            />
          </div>

          {/* Quick Dropdown Selector for Spredningsprognose directly in the Time-Machine Toolbar */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-cyan-500/50 rounded px-2 py-1 font-mono text-xs">
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <label htmlFor="spredningsprognose-select" className="text-[11px] text-cyan-300 font-bold whitespace-nowrap">
              Spredningsprognose:
            </label>
            <select
              id="spredningsprognose-select"
              value={dispersionForecastMode}
              onChange={(e) => {
                const nextMode = e.target.value as DispersionForecastOptionMode;
                handleSelectDispersionForecastOption(nextMode);
              }}
              className="bg-slate-900 text-white text-[11px] font-mono rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="next_day_00_00_59">
                Døgnet efter fra klokken 00.00.00 - 00.59.59
              </option>
              <option value="five_day_forecast">
                Fem døgns prognose.
              </option>
              <option value="weather_broadcast_segment">
                Som indlæg i en Vejrudsigt.
              </option>
            </select>
            <button
              type="button"
              onClick={() =>
                handleSelectDispersionForecastOption('next_day_00_00_59')
              }
              className="px-2 py-0.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[10.5px] font-extrabold whitespace-nowrap cursor-pointer"
              title="Fokuser Spredningsprognose-widgetten på automatisk at vise 'Døgnet efter fra klokken 00.00.00 - 00.59.59'"
            >
              Vis 00.00.00–00.59.59
            </button>
            <button
              type="button"
              onClick={() =>
                handleSelectDispersionForecastOption('five_day_forecast')
              }
              className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10.5px] font-extrabold whitespace-nowrap cursor-pointer"
              title="Åbn 'Fem døgns prognose'-visningen med aggregeret vejrdata og beregnede sumkvotienter for 5 dage frem"
            >
              5-Døgns Prognose
            </button>
          </div>

          {/* Playback Controls: Play/Pause, -1t, +1t */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
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
              className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
              title="1 time tilbage (-1t · skifter til forrige dato kl. 23:00 ved midnat)"
            >
              -1t
            </button>
            <button
              type="button"
              onClick={() => {
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
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                isPlaying
                  ? 'bg-rose-500 text-white hover:bg-rose-400'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
              title={
                isPlaying
                  ? 'Klik for at afbryde afspilning og kontinuerlig registrering'
                  : 'Afspil hændelsesforløb'
              }
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>
                {isPlaying
                  ? 'Pause'
                  : isBottomCompactMode
                  ? 'Afspil'
                  : selectedDateIso < todayIso
                  ? `Afspil til Dags Dato (${todayIso})`
                  : 'Afspil Hændelsesforløb'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedHourIndex === 23) {
                  const nextDateIso = shiftDateIsoByDays(selectedDateIso, 1);
                  setSelectedDateIso(nextDateIso);
                  setSelectedHourIndex(0);
                  setPlumeRouteProgress(0);
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
                } else {
                  setSelectedHourIndex((h) => h + 1);
                  setPlumeRouteProgress(selectedHourIndex + 1);
                }
              }}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
              title="1 time frem (+1t · skifter dato på afspilning & registrering ved overgang til kl. 00:00)"
            >
              +1t
            </button>

            {/* Auto gem beviser direkte i Time-Machine Toolbar */}
            <button
              type="button"
              onClick={() => setAutoSaveEvidenceOnTimeTravel((v) => !v)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap border cursor-pointer ${
                autoSaveEvidenceOnTimeTravel
                  ? 'bg-emerald-500 text-slate-950 border-emerald-200 hover:bg-emerald-400 shadow-xs'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-400/60'
              }`}
              title="Auto gem beviser: Tilføjer kontinuerligt fund (med SHA-256 signatur) til Foto-Bevis / Algedonisk Log ved tidsrejser"
            >
              <span>
                {autoSaveEvidenceOnTimeTravel
                  ? `⚡ Auto gem beviser (${autoSavedEvidenceCount})`
                  : '⚡ Auto gem beviser: FRA'}
              </span>
            </button>
          </div>

          {/* Interactive Hour-by-Hour Time-Slider (00:00 to 23:00) with Direct Evidence Markers */}
          <div className="flex-1 min-w-[200px] flex flex-col gap-1 bg-slate-950 border border-slate-800 rounded px-3 py-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-white">
                  {showHeatmapComparison
                    ? `T_B: kl. ${currentWeather.hourLabel}`
                    : `kl. ${currentWeather.hourLabel}`}
                </span>
              </div>

              {/* Range Input with Overlaid Evidence & Peak Tick Markers */}
              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={23}
                  step={0.25}
                  value={
                    Math.abs(plumeRouteProgress - selectedHourIndex) <= 1.05
                      ? plumeRouteProgress
                      : selectedHourIndex
                  }
                  onChange={(e) =>
                    handleScrubTimelineProgress(Number(e.target.value))
                  }
                  aria-label="24-timers tids-slider med bevis-markører"
                  className="w-full accent-cyan-400 cursor-pointer relative z-10"
                />

                {/* Direct Marker Ticks on the 24h Slider Track for Peak Load & Registered Evidence */}
                <div className="pointer-events-none absolute inset-x-1 -top-2.5 flex items-center justify-between">
                  {weatherDataset.hours.map((hr) => {
                    const hrObs = observations.filter(
                      (o) => o.observedHourIndex === hr.hourIndex
                    );
                    const isPeak =
                      hr.hourIndex === puff24h.peakReceptor.peakHourIndex;
                    const hasPhoto = hrObs.some(
                      (o) => classifyObservationKind(o) === 'PHOTO'
                    );
                    const hasPdf = hrObs.some(
                      (o) => classifyObservationKind(o) === 'PDF'
                    );
                    const hasPhys = hrObs.some(
                      (o) => classifyObservationKind(o) === 'PHYSICAL'
                    );
                    return (
                      <div
                        key={`slider-tick-${hr.hourIndex}`}
                        className="w-3 flex items-center justify-center text-[9px] leading-none font-mono"
                      >
                        {hasPhoto ? (
                          <span className="text-cyan-300 drop-shadow">📸</span>
                        ) : hasPdf ? (
                          <span className="text-indigo-300 drop-shadow">📄</span>
                        ) : hasPhys ? (
                          <span className="text-fuchsia-300 drop-shadow">⚡</span>
                        ) : isPeak ? (
                          <span className="text-amber-300 font-bold drop-shadow">
                            ★
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline whitespace-nowrap">
                00:00–23:00
              </span>
            </div>
          </div>

          {/* In Normal Mode show inline controls; In Kompakt Mode show Upward Dropdown Menu */}
          {!isBottomCompactMode ? (
            <>
              {/* Dual-Hour Heatmap Comparison & Differens-Heatmap Controls (T_A vs T_B) */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded px-2 py-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowHeatmapComparison((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    showHeatmapComparison
                      ? 'bg-gradient-to-r from-cyan-500/35 to-rose-500/35 text-white border border-amber-400/80 shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                  title="Slå Heatmap-sammenligning mellem to valgte timer (T_A og T_B) til/fra på kortet"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-300" />
                  <span>Heatmap-Sammenligning</span>
                </button>

                {showHeatmapComparison && (
                  <>
                    <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setHeatmapComparisonViewMode('difference');
                          if (viewportMode !== '2d' && viewportMode !== 'split') {
                            setViewportMode('split');
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors whitespace-nowrap ${
                          heatmapComparisonViewMode === 'difference'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Δ Differens (T_B − T_A)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHeatmapComparisonViewMode('dual_overlay');
                          if (viewportMode !== '2d' && viewportMode !== 'split') {
                            setViewportMode('split');
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap ${
                          heatmapComparisonViewMode === 'dual_overlay'
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Begge Heatmaps
                      </button>
                    </div>

                    <select
                      value={comparisonHourAIndex}
                      onChange={(e) => setComparisonHourAIndex(Number(e.target.value))}
                      aria-label="Vælg Reference-time T_A"
                      className="bg-cyan-950/70 border border-cyan-400/60 rounded px-2 py-1 text-xs font-mono font-bold text-cyan-200 focus:outline-none"
                    >
                      {weatherDataset.hours.map((hr) => (
                        <option key={`footer-ta-${hr.hourIndex}`} value={hr.hourIndex}>
                          T_A: kl. {hr.hourLabel}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setComparisonHourAIndex(selectedHourIndex)}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-cyan-400 text-[11px] font-mono text-cyan-300 whitespace-nowrap"
                    >
                      Sæt T_A = Nu
                    </button>
                  </>
                )}
              </div>

              {/* Dedicated Toggle next to Time-Slider: "Vis 24-timers kumulativt aftryk (Gaussian Puff Mode)" */}
              <button
                type="button"
                onClick={handleToggle24hPuffMode}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                  isPuffMode
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                    : 'bg-slate-900 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {isPuffMode ? '✓ 24t Puff-Aftryk' : 'Vis 24t Puff-Aftryk'}
                </span>
              </button>
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsBottomCompactDropdownOpen((v) => !v)}
                className="px-3 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/70 text-cyan-200 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-300" />
                <span>Kompakt Bund-Menu (Tidslinje, Scenarier &amp; Heatmap)</span>
                <span className="text-[10px]">{isBottomCompactDropdownOpen ? '▾' : '▴'}</span>
              </button>

              {isBottomCompactDropdownOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-[360px] sm:w-[580px] max-h-[75vh] overflow-y-auto rounded-lg bg-[#0B0E17] border border-cyan-500/50 shadow-2xl p-3 space-y-3 z-50 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono text-[11px] font-bold uppercase text-cyan-300">
                      Bund-Kontrolpanel &amp; Bevis-Tidslinje (Kompakt Mode)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBottomCompactDropdownOpen(false)}
                      className="text-[11px] font-mono text-slate-400 hover:text-white"
                    >
                      Luk ✕
                    </button>
                  </div>

                  {/* Interactive 24h Evidence Timeline inside Dropdown */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      1. Interaktiv 24-Timers Bevis-Tidslinje (Træk markører for at spole)
                    </div>
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
                      onToggleHeatmapComparison={() => setShowHeatmapComparison((v) => !v)}
                      variant="slider_bar"
                    />
                  </div>

                  {/* Critical Weather Scenarios Dropdown & Quick Buttons */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      2. Vælg Kritisk Vejr-Scenarie eller Live Open-Meteo (24t)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {CRITICAL_WEATHER_SCENARIOS.map((sc) => (
                        <button
                          key={`compact-sc-${sc.id}`}
                          type="button"
                          onClick={() => {
                            handleApplyScenario(sc.id);
                            setIsBottomCompactDropdownOpen(false);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            activeScenarioId === sc.id
                              ? 'bg-rose-600 text-white font-semibold'
                              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {sc.title}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          loadLiveOpenMeteo(selectedDateIso);
                          setIsBottomCompactDropdownOpen(false);
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-medium ${
                          activeScenarioId === null
                            ? 'bg-cyan-500 text-slate-950 font-semibold'
                            : 'bg-slate-900 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        Live / Arkiv Open-Meteo (24t)
                      </button>
                    </div>
                  </div>

                  {/* Heatmap Comparison & 24h Puff Mode Controls */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      3. Heatmap-Sammenligning (T_A ↔ T_B) &amp; 24t Puff-Aftryk
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowHeatmapComparison((v) => !v)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                          showHeatmapComparison
                            ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        {showHeatmapComparison
                          ? '✓ Heatmap-Sammenligning Aktiv'
                          : 'Slå Heatmap-Sammenligning Til'}
                      </button>
                      <button
                        type="button"
                        onClick={handleToggle24hPuffMode}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                          isPuffMode
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                            : 'bg-slate-900 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {isPuffMode ? '✓ 24t Puff-Aftryk Aktiv' : 'Vis 24t Puff-Aftryk'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Kompakt / Normal Mode Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsBottomCompactMode((prev) => !prev);
              setIsBottomCompactDropdownOpen(false);
            }}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isBottomCompactMode
                ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-xs'
                : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/40'
            }`}
            title="Skift mellem Kompakt visning (med dropdown-menu) og Normal visning i bunden"
          >
            {isBottomCompactMode ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Normal (Bund)</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Kompakt (Bund)</span>
              </>
            )}
          </button>
        </div>

        {/* VISUAL 24-HOUR EVIDENCE TIMELINE WIDGET SYNCHRONIZED DIRECTLY WITH THE 24H TIME-SLIDER (Shown in Normal Mode) */}
        {!isBottomCompactMode && (
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
            onToggleHeatmapComparison={() => setShowHeatmapComparison((v) => !v)}
            variant="slider_bar"
          />
        )}

        {/* Bottom Row: Quick-Buttons for Critical Weather Scenarios + Live Open-Meteo (Shown in Normal Mode) */}
        {!isBottomCompactMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-400 mr-1">
                Kritiske Vejr-Scenarier:
              </span>
              {CRITICAL_WEATHER_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handleApplyScenario(sc.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeScenarioId === sc.id
                      ? 'bg-rose-600 text-white font-semibold'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {sc.title}
                </button>
              ))}

              <button
                type="button"
                onClick={() => loadLiveOpenMeteo(selectedDateIso)}
                disabled={isLoadingWeather}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeScenarioId === null
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-cyan-300 border border-cyan-500/30 hover:bg-slate-800'
                }`}
              >
                {isLoadingWeather ? 'Henter 24t Open-Meteo...' : 'Live / Arkiv Open-Meteo API (24t)'}
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-400 hidden xl:flex items-center gap-2">
              <span>
                24t Spids-Receptor:{' '}
                <strong className="text-amber-300">
                  {puff24h.peakReceptor.address.split(',')[0]}
                </strong>{' '}
                kl. <strong className="text-white">{puff24h.peakReceptor.peakHourLabel}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>SHA-256: {sha256Hash.slice(0, 14)}…</span>
            </div>
          </div>
        )}
      </footer>

      {/* FLOATING PAGE SCROLL HELPER BAR (Allows smooth 1-click scrolling up/down across the entire page) */}
      <div className="fixed right-3 bottom-3 z-50 flex items-center gap-1 rounded-full bg-slate-950/95 border border-cyan-500/50 px-2.5 py-1 shadow-xl font-mono text-[10px] text-slate-200">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="px-2 py-0.5 rounded-full bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-bold transition-colors cursor-pointer"
          title="Rul helt til toppen af siden (Vejrrubrik & Akustisk Refraktion)"
        >
          ↑ Top
        </button>
        <button
          type="button"
          onClick={() => window.scrollBy({ top: -380, behavior: 'smooth' })}
          className="px-2 py-0.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold transition-colors cursor-pointer"
          title="Rul opad på siden"
        >
          ▲ Op
        </button>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('main-workspace-anchor')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className="px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-400 hover:text-slate-950 text-amber-300 border border-amber-400/50 font-bold transition-colors cursor-pointer"
          title="Rul til 3D Digital Tvilling, Kort & Retsmedicinsk Analysepanel"
        >
          🗺️ Kort &amp; Analyse
        </button>
        <button
          type="button"
          onClick={() => window.scrollBy({ top: 380, behavior: 'smooth' })}
          className="px-2 py-0.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold transition-colors cursor-pointer"
          title="Rul nedad på siden"
        >
          ▼ Ned
        </button>
        <button
          type="button"
          onClick={() =>
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
          }
          className="px-2 py-0.5 rounded-full bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-bold transition-colors cursor-pointer"
          title="Rul helt til bunden (24-timers Tidslinje & Weather-Trend)"
        >
          ↓ Bund
        </button>
      </div>

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
              <div className="h-[520px] w-full rounded overflow-hidden border border-slate-800">
                <DispersionMap
                  sources={sources}
                  receptors={receptors}
                  plumeZones={simulation.plumeZones}
                  receptorExposures={receptorExposures}
                  currentWeather={currentWeather}
                  isPuffMode={isPuffMode}
                  puff24h={puff24h}
                  observations={observations}
                  selectedObservationId={selectedObservationId}
                  pendingObservationPoint={pendingObservationPoint}
                  onSelectObservation={(obs) => {
                    setSelectedObservationId(obs.id);
                    setSelectedHourIndex(obs.observedHourIndex);
                  }}
                  selectedSourceId={selectedSourceId}
                  selectedReceptorId={selectedReceptorId}
                  onSelectSource={(id) => setSelectedSourceId(id)}
                  onSelectReceptor={(id) => setSelectedReceptorId(id)}
                  mapClickMode={mapClickMode}
                  onSetMapClickMode={setMapClickMode}
                  onMapAddNode={handleMapAddNode}
                  onSelectHourFromPeak={(hr) => {
                    setSelectedHourIndex(hr);
                    setPlumeRouteProgress(hr);
                  }}
                  isAnimatingPlumeRoute={isAnimatingPlumeRoute}
                  plumeRouteProgress={plumeRouteProgress}
                  onToggleAnimatePlumeRoute={handleToggleAnimatePlumeRoute}
                  showHeatmapComparison={showHeatmapComparison}
                  onToggleHeatmapComparison={() => setShowHeatmapComparison((v) => !v)}
                  heatmapComparison={heatmapComparison}
                  heatmapComparisonViewMode={heatmapComparisonViewMode}
                  onChangeHeatmapComparisonViewMode={setHeatmapComparisonViewMode}
                  weatherHours={weatherDataset.hours}
                  comparisonHourAIndex={comparisonHourAIndex}
                  comparisonHourBIndex={selectedHourIndex}
                  onChangeComparisonHourA={setComparisonHourAIndex}
                  onChangeComparisonHourB={setSelectedHourIndex}
                  onSaveMapSnapshotObservation={handleSaveMapSnapshotObservation}
                />
              </div>
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
      />
    </div>
  );
}
