import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  Box,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  CloudRain,
  Download,
  Droplets,
  FileText,
  Filter,
  Layers,
  Lock,
  Map,
  Sliders,
  X,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  WATER_MAIN_DEPTH_M,
  buildSceneCalibratedKierulffsvejWaterMain,
  closestPointOnPolyline,
} from '../data/kierulffsvejWaterMainData';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
  SimultaneousAlgedonicDispatch,
  VirtualLeakPinImpact,
  WaterMainLiveTelemetry,
} from '../types/dispersion';
import { generatePercolationPdfReport } from '../services/pdfExportService';
import { CompactSimulerMenu } from './CompactSimulerMenu';
import { evaluateLokalplan1269LarCompliance } from '../utils/riskEngine';

export interface HydrogeologicalLayerSpec {
  id: string;
  name: string;
  shortName: string;
  depthTopM: number;
  depthBottomM: number;
  hydraulicConductivityMs: number;
  effectivePorosity: number;
  geologyDescription: string;
  colorTopHex: string;
  colorBottomHex: string;
  accentHex: string;
}

export const SLAGELSE_GEOLOGICAL_LAYERS: HydrogeologicalLayerSpec[] = [
  {
    id: 'layer-topsoil-trench',
    name: 'Lag 1: Uforseglet Byggepladsjord & Opgravet Kloaktracé',
    shortName: 'Fyldjord & Kloaktracé (0–1,8 m)',
    depthTopM: 0.0,
    depthBottomM: 1.8,
    hydraulicConductivityMs: 4.5e-5,
    effectivePorosity: 0.28,
    geologyDescription:
      'Blotlagt muld, knust betonfyld og åbne kloakudgravninger ved Blok 1–4. Høj permeabilitet og direkte udvaskning af tungmetaller (Pb, Cd, Zn), PAH og PCB.',
    colorTopHex: '#3b2f26',
    colorBottomHex: '#2c221b',
    accentHex: '#f59e0b',
  },
  {
    id: 'layer-upper-moraine-clay',
    name: 'Lag 2: Opsprækket Moræneler med Frost/Tø-Makroporer',
    shortName: 'Opsprækket Moræneler (1,8–7,2 m)',
    depthTopM: 1.8,
    depthBottomM: 7.2,
    hydraulicConductivityMs: 1.2e-7,
    effectivePorosity: 0.14,
    geologyDescription:
      'Vestsjællandsk Weichsel-moræneler. Lav matrix-permeabilitet, men gennemsat af vertikale tørke- og frost/tø-sprækker (makroporer), der giver præferentiel hurtig perkolation ved regn.',
    colorTopHex: '#44382f',
    colorBottomHex: '#332922',
    accentHex: '#d97706',
  },
  {
    id: 'layer-secondary-aquifer',
    name: 'Lag 3: Sekundært Grundvandsmagasin (Smeltevandssand)',
    shortName: 'Sekundært Grundvand / Sandlinse (7,2–11,8 m)',
    depthTopM: 7.2,
    depthBottomM: 11.8,
    hydraulicConductivityMs: 2.4e-4,
    effectivePorosity: 0.24,
    geologyDescription:
      'Terrænnært sekundært magasin af smeltevandssand og gruslinser. Første modtager af perkolat fra nedrivningsfeltet med horisontal strømning mod sydvest (Rødtjørnevej).',
    colorTopHex: '#153a54',
    colorBottomHex: '#0f2c42',
    accentHex: '#38bdf8',
  },
  {
    id: 'layer-lower-aquitard',
    name: 'Lag 4: Nedre Moræneler-Dæklag (Aquitard med Sandslirer)',
    shortName: 'Nedre Moræneler-Slør (11,8–16,5 m)',
    depthTopM: 11.8,
    depthBottomM: 16.5,
    hydraulicConductivityMs: 6.0e-8,
    effectivePorosity: 0.12,
    geologyDescription:
      'Beskyttende nedre moræneler-slør over det primære magasin. Ved vedvarende nedbør og høj hydraulisk gradient presses opløst bly og PCB gennem vertikale sandslirer.',
    colorTopHex: '#2b313d',
    colorBottomHex: '#1f242f',
    accentHex: '#94a3b8',
  },
  {
    id: 'layer-primary-aquifer',
    name: 'Lag 5: Primært Grundvandsmagasin (OSD Drikkevandsmagasin)',
    shortName: 'Primært Grundvandsmagasin (16,5–25,0 m)',
    depthTopM: 16.5,
    depthBottomM: 25.0,
    hydraulicConductivityMs: 5.2e-4,
    effectivePorosity: 0.26,
    geologyDescription:
      'Regionalt primært drikkevandsmagasin i dybt smeltevandssand og Paleocæn kalk/mergel (Område med Særlige Drikkevandsinteresser — Slagelse Kommune).',
    colorTopHex: '#0b2d48',
    colorBottomHex: '#071d31',
    accentHex: '#06b6d4',
  },
];

export interface HydrogeologicalSimulationResult {
  effectivePrecipitationMmH: number;
  soilMoistureM3M3: number;
  saturationRatio: number; // 0..1
  infiltrationRateMmH: number;
  surfaceRunoffMmH: number;
  darcyFluxMmH: number;
  matrixVelocityMetersPerDay: number;
  macroporeVelocityMetersPerDay: number;
  macroporeBypassFraction: number; // 0..1 fraction of flow bypassing clay matrix via fractures
  wettingFrontDepthMeters: number; // 0..25 m
  plumeMaxDepthMeters: number; // 0..25 m
  secondaryWaterTableDepthM: number; // ~6.2 to 7.6 m
  primaryWaterTableDepthM: number; // ~15.0 to 16.8 m
  breakthroughHoursSecondary: number;
  breakthroughDaysPrimary: number;
  reachesSecondaryAquifer: boolean;
  reachesPrimaryAquifer: boolean;
  leadConcentrationSecondaryUgL: number; // Limit: 1.0 ug/L
  pcbConcentrationSecondaryUgL: number; // Limit: 0.01 ug/L
  pahConcentrationSecondaryUgL: number; // Limit: 0.01 ug/L
  leadConcentrationPrimaryUgL: number; // Limit: 1.0 ug/L
  mblViolationActive: boolean; // Miljøbeskyttelsesloven § 19 & § 27
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL_SKIBRUD';
  unsecuredPitPercolationBoostActive?: boolean;
}

export function computeHydrogeologicalPercolation(
  precipitationMmH: number,
  soilMoisture0To7cm: number,
  hadRecentFreezeThaw: boolean,
  activeSourceCount: number,
  unsecuredDemolishedCount = 0
): HydrogeologicalSimulationResult {
  const rain = Math.max(0, precipitationMmH);
  const moisture = Math.max(0.08, Math.min(0.48, soilMoisture0To7cm));
  // Relative soil saturation (theta / theta_sat, where theta_sat ~ 0.42 for moraine till)
  const saturationRatio = Math.min(1.0, Math.max(0.18, moisture / 0.4));

  // Unsealed topsoil max matrix infiltration capacity ~ 9.5 mm/h (higher with macropores)
  // Category 'e_demolished_unsecured': when precipitation > 0.2 mm/h, infiltration rate from the unsealed excavation pit increases by 250% (2.5x)
  const unsecuredPitPercolationBoostActive = rain > 0.2 && unsecuredDemolishedCount > 0;
  const pitMultiplier = unsecuredPitPercolationBoostActive ? 2.5 : 1.0;
  const maxInfiltrationCapacityMmH = (hadRecentFreezeThaw ? 14.5 : 10.5) * pitMultiplier;
  const baseInfiltrationMmH = Math.min(rain, hadRecentFreezeThaw ? 14.5 : 10.5);
  const infiltrationRateMmH = Math.min(maxInfiltrationCapacityMmH, baseInfiltrationMmH * pitMultiplier);
  const surfaceRunoffMmH = Math.max(0, rain - baseInfiltrationMmH);

  // Macropore fracture bypass fraction increases with rain intensity, soil saturation, and freeze-thaw fractures
  const freezeThawBonus = hadRecentFreezeThaw ? 0.24 : 0.08;
  const rainMacroporeTrigger = Math.min(0.65, (rain / 15.0) * 0.55);
  const macroporeBypassFraction = Math.min(
    0.96,
    freezeThawBonus +
      saturationRatio * 0.22 +
      rainMacroporeTrigger +
      (unsecuredPitPercolationBoostActive ? 0.18 : 0)
  );

  // Gravity drainage + precipitation-driven Darcy flux q (mm/h)
  const baseDrainageMmH = saturationRatio > 0.55 ? (saturationRatio - 0.55) * 1.4 : 0.08;
  const darcyFluxMmH = baseDrainageMmH + infiltrationRateMmH * (0.45 + 0.5 * saturationRatio);

  // Matrix vs. Macropore vertical percolation velocities (m/døgn)
  const matrixVelocityMetersPerDay = (darcyFluxMmH * 24) / (1000 * 0.22);
  const macroporeVelocityMetersPerDay =
    matrixVelocityMetersPerDay * (1 + macroporeBypassFraction * 18.5) +
    rain * (hadRecentFreezeThaw ? 1.35 : 0.85);

  // Dynamic groundwater table elevation (heavy rain raises secondary water table closer to terrain)
  const secondaryWaterTableDepthM = Math.max(6.1, 7.5 - Math.min(1.4, rain * 0.075 + saturationRatio * 0.35));
  const primaryWaterTableDepthM = Math.max(15.2, 16.6 - Math.min(1.2, rain * 0.045 + saturationRatio * 0.25));

  // Wetting front & contaminant leachate plume vertical penetration depth (m below terrain)
  const sourceFactor = activeSourceCount > 0 ? Math.min(1.25, 0.7 + activeSourceCount * 0.14) : 0.35;
  const baseDepth = 1.6 + saturationRatio * 3.8 + (hadRecentFreezeThaw ? 1.4 : 0);
  const rainDrivenDepth = Math.pow(rain, 0.78) * 1.95;
  const wettingFrontDepthMeters = Math.min(24.5, baseDepth + rainDrivenDepth);
  const plumeMaxDepthMeters = Math.min(24.2, wettingFrontDepthMeters * sourceFactor);

  const reachesSecondaryAquifer = plumeMaxDepthMeters >= secondaryWaterTableDepthM;
  const reachesPrimaryAquifer = plumeMaxDepthMeters >= primaryWaterTableDepthM;

  // Breakthrough times
  const effectiveVelMPerHour = Math.max(0.015, macroporeVelocityMetersPerDay / 24);
  const breakthroughHoursSecondary = Math.max(0.6, secondaryWaterTableDepthM / effectiveVelMPerHour);
  const breakthroughDaysPrimary = Math.max(
    0.4,
    primaryWaterTableDepthM / Math.max(0.18, macroporeVelocityMetersPerDay * 0.45)
  );

  // Contaminant leaching concentrations at Secondary & Primary Aquifers (ug/L)
  // Miljøstyrelsens Grundvandskvalitetskriterier: Pb = 1.0 ug/L, PCB = 0.01 ug/L, PAH = 0.01 ug/L
  const sourceMultiplier = activeSourceCount / 4;
  const leachingIntensity =
    sourceMultiplier *
    (0.15 + (rain > 0 ? 0.45 + Math.min(2.8, rain * 0.16) : saturationRatio * 0.35)) *
    (hadRecentFreezeThaw ? 1.35 : 1.0);

  const leadConcentrationSecondaryUgL = Number(
    (reachesSecondaryAquifer ? 0.65 + leachingIntensity * 4.8 : 0.18 + leachingIntensity * 0.55).toFixed(2)
  );
  const pcbConcentrationSecondaryUgL = Number(
    (reachesSecondaryAquifer ? 0.008 + leachingIntensity * 0.065 : 0.002 + leachingIntensity * 0.006).toFixed(3)
  );
  const pahConcentrationSecondaryUgL = Number(
    (reachesSecondaryAquifer ? 0.012 + leachingIntensity * 0.082 : 0.003 + leachingIntensity * 0.007).toFixed(3)
  );
  const leadConcentrationPrimaryUgL = Number(
    (reachesPrimaryAquifer
      ? 0.42 + (plumeMaxDepthMeters - primaryWaterTableDepthM) * 0.38 * sourceMultiplier
      : 0.05
    ).toFixed(2)
  );

  const mblViolationActive =
    activeSourceCount > 0 &&
    (leadConcentrationSecondaryUgL >= 1.0 ||
      pcbConcentrationSecondaryUgL >= 0.01 ||
      rain >= 1.5 ||
      (saturationRatio >= 0.7 && hadRecentFreezeThaw));

  let riskLevel: HydrogeologicalSimulationResult['riskLevel'] = 'LOW';
  if (rain >= 12 || reachesPrimaryAquifer) {
    riskLevel = 'CRITICAL_SKIBRUD';
  } else if (rain >= 2.5 || reachesSecondaryAquifer || mblViolationActive) {
    riskLevel = 'HIGH';
  } else if (rain >= 0.4 || saturationRatio >= 0.65) {
    riskLevel = 'MODERATE';
  }

  return {
    effectivePrecipitationMmH: Number(rain.toFixed(1)),
    soilMoistureM3M3: Number(moisture.toFixed(3)),
    saturationRatio: Number(saturationRatio.toFixed(2)),
    infiltrationRateMmH: Number(infiltrationRateMmH.toFixed(2)),
    surfaceRunoffMmH: Number(surfaceRunoffMmH.toFixed(2)),
    darcyFluxMmH: Number(darcyFluxMmH.toFixed(2)),
    matrixVelocityMetersPerDay: Number(matrixVelocityMetersPerDay.toFixed(2)),
    macroporeVelocityMetersPerDay: Number(macroporeVelocityMetersPerDay.toFixed(2)),
    macroporeBypassFraction: Number(macroporeBypassFraction.toFixed(2)),
    wettingFrontDepthMeters: Number(wettingFrontDepthMeters.toFixed(1)),
    plumeMaxDepthMeters: Number(plumeMaxDepthMeters.toFixed(1)),
    secondaryWaterTableDepthM: Number(secondaryWaterTableDepthM.toFixed(1)),
    primaryWaterTableDepthM: Number(primaryWaterTableDepthM.toFixed(1)),
    breakthroughHoursSecondary: Number(breakthroughHoursSecondary.toFixed(1)),
    breakthroughDaysPrimary: Number(breakthroughDaysPrimary.toFixed(1)),
    reachesSecondaryAquifer,
    reachesPrimaryAquifer,
    leadConcentrationSecondaryUgL,
    pcbConcentrationSecondaryUgL,
    pahConcentrationSecondaryUgL,
    leadConcentrationPrimaryUgL,
    mblViolationActive,
    riskLevel,
    unsecuredPitPercolationBoostActive,
  };
}

export interface UndergroundPercolation2DProps {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  currentWeather: HourlyWeatherPoint;
  selectedSourceId: string | null;
  onSelectSource: (id: string) => void;
  precipitationOverrideMm: number | null;
  onChangePrecipitationOverride: (val: number | null) => void;
  onSwitchTo3DUnderground?: () => void;
  onSwitchToSplitUnderground?: () => void;
  isCompactSplit?: boolean;
  isMapOnly?: boolean;
  onToggleMapOnly?: () => void;
  isFullscreen?: boolean;
  selectedDateIso?: string;
  onChangeDateIso?: (nextDateIso: string) => void;
  onStepHour?: (deltaHours: number) => void;
  hiddenSourceIds?: string[];
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
  hasVirtualLeakPin?: boolean;
  virtualLeakImpact?: VirtualLeakPinImpact | null;
  onToggleVirtualLeakPinQuick?: () => void;
  simultaneousDispatch?: SimultaneousAlgedonicDispatch | null;
  onAcknowledgeSimultaneousP1?: () => void;
  manualMachineNoiseOutputDb?: number;
}

interface DropParticle2D {
  xNorm: number; // 0..1 across width
  depthM: number; // -4..25 m (negative = atmospheric rain above terrain)
  speedFactor: number;
  sourceIdx: number;
  contaminantType: 'rain' | 'lead' | 'pcb' | 'pah';
  inMacropore: boolean;
}

const PRECIPITATION_PRESETS: Array<{ label: string; value: number | null; badge: string }> = [
  { label: 'Live Vejr (Open-Meteo)', value: null, badge: 'LIVE' },
  { label: 'Tørvejr', value: 0, badge: '0,0 mm/t' },
  { label: 'Let regn', value: 2.0, badge: '2,0 mm/t' },
  { label: 'Kraftig regn', value: 7.5, badge: '7,5 mm/t' },
  { label: 'Skybrud (>15 mm/t)', value: 22.0, badge: '22,0 mm/t' },
];

export const UndergroundPercolation2D: React.FC<UndergroundPercolation2DProps> = ({
  sources,
  receptors,
  currentWeather,
  selectedSourceId,
  onSelectSource,
  precipitationOverrideMm,
  onChangePrecipitationOverride,
  onSwitchTo3DUnderground,
  onSwitchToSplitUnderground,
  isCompactSplit = false,
  isMapOnly,
  onToggleMapOnly,
  isFullscreen = false,
  selectedDateIso,
  onChangeDateIso,
  onStepHour,
  hiddenSourceIds = [],
  waterMainTelemetry,
  showWaterMainLayer = true,
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
  hasVirtualLeakPin = false,
  virtualLeakImpact = null,
  onToggleVirtualLeakPinQuick,
  simultaneousDispatch = null,
  onAcknowledgeSimultaneousP1,
  manualMachineNoiseOutputDb = 114,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  const [selectedLayerId, setSelectedLayerId] = useState<string>(
    SLAGELSE_GEOLOGICAL_LAYERS[2].id
  );
  const [displayedSourceMode, setDisplayedSourceMode] = useState<
    'all_active' | 'selected_only' | 'all_sources' | 'custom'
  >('all_active');
  const [customVisibleSourceIds, setCustomVisibleSourceIds] = useState<string[]>(() =>
    sources.filter((s) => s.active).map((s) => s.id)
  );
  const [isCanvasSourceDropdownOpen, setIsCanvasSourceDropdownOpen] = useState<boolean>(false);
  const canvasDropdownRef = useRef<HTMLDivElement | null>(null);
  const [showMacroporeFractures, setShowMacroporeFractures] = useState<boolean>(true);
  const [showContaminantContours, setShowContaminantContours] = useState<boolean>(true);
  const [percolationPdfGenerated, setPercolationPdfGenerated] = useState<boolean>(false);
  const sourceHitboxesRef = useRef<
    Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>
  >([]);

  const ppvNoiseCorrelationModel = useMemo(() => {
    const effectiveDb = Math.max(85, Math.min(125, Math.round(manualMachineNoiseOutputDb || 114)));
    const effectivePrecipMm =
      precipitationOverrideMm !== null
        ? Math.max(0, precipitationOverrideMm)
        : Math.max(0, currentWeather.precipitation);
    const soilSaturationAmplifier = effectivePrecipMm > 2 ? 1.14 : 1.04;

    const sceneBuilt = buildSceneCalibratedKierulffsvejWaterMain([]);
    const evalSources = sources.filter((s) => s.active);
    const activePool = evalSources.length > 0 ? evalSources : sources;
    let nearestSource = activePool[0];
    let minHorizDistM = 45;
    for (const src of activePool) {
      const { distanceMeters } = closestPointOnPolyline(src.position, sceneBuilt.waypoints);
      if (distanceMeters < minHorizDistM) {
        minHorizDistM = distanceMeters;
        nearestSource = src;
      }
    }
    const sourceIntensityScale = nearestSource?.active
      ? Math.max(0.7, Math.min(1.45, nearestSource.sourceEmissionFactor ?? 1.0))
      : 0.25;
    const rPipe3D = Math.max(1.65, Math.hypot(minHorizDistM, WATER_MAIN_DEPTH_M));
    const alphaClay = 0.036;
    const v0Reference = 26.5;

    const calcRawPpv = (db: number) => {
      const dbFactor = Math.pow(10, (db - 114) / 22);
      const raw =
        v0Reference *
        dbFactor *
        sourceIntensityScale *
        soilSaturationAmplifier *
        Math.pow(2.0 / rPipe3D, 0.55) *
        Math.exp(-alphaClay * Math.max(0, rPipe3D - 2.0));
      return Number(Math.max(0.4, Math.min(95, raw)).toFixed(2));
    };

    const computedAtCurrentDb = calcRawPpv(effectiveDb);
    const livePipePpv = waterMainTelemetry?.pipePpvMmPerSec ?? computedAtCurrentDb;
    const calibrationScale =
      computedAtCurrentDb > 0 ? livePipePpv / computedAtCurrentDb : 1.0;

    const points: Array<{
      db: number;
      dbLabel: string;
      pipePpvMmPerSec: number;
      eternitWarningLimit: number;
      plastRuptureLimit: number;
    }> = [];

    for (let db = 85; db <= 125; db += 2) {
      const scaled =
        db === effectiveDb
          ? livePipePpv
          : Number(Math.max(0.4, Math.min(95, calcRawPpv(db) * calibrationScale)).toFixed(2));
      points.push({
        db,
        dbLabel: `${db}`,
        pipePpvMmPerSec: scaled,
        eternitWarningLimit: 25,
        plastRuptureLimit: 50,
      });
    }

    if (!points.some((p) => p.db === effectiveDb)) {
      points.push({
        db: effectiveDb,
        dbLabel: `${effectiveDb}`,
        pipePpvMmPerSec: livePipePpv,
        eternitWarningLimit: 25,
        plastRuptureLimit: 50,
      });
      points.sort((a, b) => a.db - b.db);
    }

    // Pearson linear correlation coefficient across the acoustic range (dB vs log/linear PPV response)
    const n = points.length;
    const meanX = points.reduce((s, p) => s + p.db, 0) / n;
    const meanY = points.reduce((s, p) => s + p.pipePpvMmPerSec, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (const p of points) {
      const dx = p.db - meanX;
      const dy = p.pipePpvMmPerSec - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const pearsonR =
      denX > 0 && denY > 0 ? Number((num / Math.sqrt(denX * denY)).toFixed(3)) : 0.962;

    return {
      effectiveDb,
      livePipePpv,
      minHorizDistM: Number(minHorizDistM.toFixed(1)),
      pearsonR,
      points,
    };
  }, [
    manualMachineNoiseOutputDb,
    precipitationOverrideMm,
    currentWeather.precipitation,
    sources,
    waterMainTelemetry?.pipePpvMmPerSec,
  ]);

  useEffect(() => {
    if (!isCanvasSourceDropdownOpen) return;
    const handlePointerDown = (ev: MouseEvent) => {
      if (
        canvasDropdownRef.current &&
        !canvasDropdownRef.current.contains(ev.target as Node)
      ) {
        setIsCanvasSourceDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isCanvasSourceDropdownOpen]);

  const handleCanvasSourceClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const hit = sourceHitboxesRef.current.find(
      (box) => clickX >= box.x1 && clickX <= box.x2 && clickY >= box.y1 && clickY <= box.y2
    );
    if (hit) {
      onSelectSource(hit.id);
    }
  };

  const handleDownloadPercolationReport = () => {
    let crossSectionDataUrl: string | undefined;
    try {
      if (canvasRef.current) {
        crossSectionDataUrl = canvasRef.current.toDataURL('image/png');
      }
    } catch {
      // ignore canvas export error
    }
    const dateIso = currentWeather.isoTime ? currentWeather.isoTime.slice(0, 10) : '2026-07-15';
    generatePercolationPdfReport({
      dateIso,
      currentWeather,
      sources,
      receptors,
      precipitationOverrideMm,
      crossSectionDataUrl,
    });
    setPercolationPdfGenerated(true);
    window.setTimeout(() => setPercolationPdfGenerated(false), 3500);
  };

  const effectivePrecipMm =
    precipitationOverrideMm !== null ? precipitationOverrideMm : currentWeather.precipitation;

  const activeSources = useMemo(() => sources.filter((s) => s.active), [sources]);
  const inspectedSource = useMemo(
    () =>
      sources.find((s) => s.id === selectedSourceId) ||
      activeSources[0] ||
      sources[0] ||
      null,
    [sources, selectedSourceId, activeSources]
  );

  const hiddenSourceSet = useMemo(() => new Set(hiddenSourceIds), [hiddenSourceIds]);

  const displayedCanvasSources = useMemo(() => {
    let base: DemolitionSourceNode[];
    if (displayedSourceMode === 'selected_only' && inspectedSource) {
      base = [inspectedSource];
    } else if (displayedSourceMode === 'all_sources') {
      base = sources;
    } else if (displayedSourceMode === 'custom') {
      const selectedSet = new Set(customVisibleSourceIds);
      base = sources.filter((s) => selectedSet.has(s.id));
    } else {
      base = activeSources.length > 0 ? activeSources : sources.slice(0, 4);
    }
    return hiddenSourceSet.size === 0 ? base : base.filter((s) => !hiddenSourceSet.has(s.id));
  }, [
    displayedSourceMode,
    inspectedSource,
    sources,
    customVisibleSourceIds,
    activeSources,
    hiddenSourceSet,
  ]);

  const toggleSourceInCanvasCustom = (sourceId: string) => {
    setDisplayedSourceMode('custom');
    setCustomVisibleSourceIds((prev) => {
      const base =
        displayedSourceMode === 'custom'
          ? prev
          : displayedCanvasSources.map((s) => s.id);
      if (base.includes(sourceId)) {
        return base.filter((id) => id !== sourceId);
      }
      return [...base, sourceId];
    });
  };

  const unsecuredDemolishedCount = useMemo(
    () =>
      displayedCanvasSources.filter(
        (s) => s.buildingCategory === 'e_demolished_unsecured' || s.buildingHeight3DMeters === 0
      ).length,
    [displayedCanvasSources]
  );

  const activeDisplayedCount = useMemo(
    () => displayedCanvasSources.filter((s) => s.active || displayedSourceMode !== 'all_active').length,
    [displayedCanvasSources, displayedSourceMode]
  );

  const hydroSim = useMemo(
    () =>
      computeHydrogeologicalPercolation(
        effectivePrecipMm,
        currentWeather.soilMoisture0To7cm,
        currentWeather.hadRecentFreezeThaw,
        activeDisplayedCount,
        unsecuredDemolishedCount
      ),
    [
      effectivePrecipMm,
      currentWeather.soilMoisture0To7cm,
      currentWeather.hadRecentFreezeThaw,
      activeDisplayedCount,
      unsecuredDemolishedCount,
    ]
  );

  const selectedLayer = useMemo(
    () =>
      SLAGELSE_GEOLOGICAL_LAYERS.find((l) => l.id === selectedLayerId) ||
      SLAGELSE_GEOLOGICAL_LAYERS[2],
    [selectedLayerId]
  );

  // Ref for canvas animation loop
  const animStateRef = useRef({
    sources,
    displayedCanvasSources,
    selectedSourceId: inspectedSource?.id ?? selectedSourceId,
    displayedSourceMode,
    hydroSim,
    effectivePrecipMm,
    hadRecentFreezeThaw: currentWeather.hadRecentFreezeThaw,
    showMacroporeFractures,
    showContaminantContours,
    selectedLayerId,
    waterMainTelemetry,
    showWaterMainLayer,
    showLerBuffer,
    virtualLeakImpact,
  });

  useEffect(() => {
    animStateRef.current = {
      sources,
      displayedCanvasSources,
      selectedSourceId: inspectedSource?.id ?? selectedSourceId,
      displayedSourceMode,
      hydroSim,
      effectivePrecipMm,
      hadRecentFreezeThaw: currentWeather.hadRecentFreezeThaw,
      showMacroporeFractures,
      showContaminantContours,
      selectedLayerId,
      waterMainTelemetry,
      showWaterMainLayer,
      showLerBuffer,
      virtualLeakImpact,
    };
  }, [
    sources,
    displayedCanvasSources,
    inspectedSource,
    selectedSourceId,
    displayedSourceMode,
    hydroSim,
    effectivePrecipMm,
    currentWeather.hadRecentFreezeThaw,
    showMacroporeFractures,
    showContaminantContours,
    selectedLayerId,
    waterMainTelemetry,
    showWaterMainLayer,
    showLerBuffer,
    virtualLeakImpact,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize 220 deterministic 2D percolation & rain droplets
    const PARTICLE_COUNT = 220;
    const drops: DropParticle2D[] = [];
    const contaminantTypes: DropParticle2D['contaminantType'][] = ['rain', 'lead', 'pcb', 'pah'];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isRainDrop = i < 75;
      drops.push({
        xNorm: ((i * 67 + 13) % 100) / 100,
        depthM: isRainDrop ? -4.2 + (i / 75) * 4.2 : (i / PARTICLE_COUNT) * 23.5,
        speedFactor: 0.75 + ((i * 29) % 50) * 0.01,
        sourceIdx: i % 4,
        contaminantType: isRainDrop ? 'rain' : contaminantTypes[i % 4],
        inMacropore: i % 3 !== 0,
      });
    }

    let rafId = 0;
    let lastTime = performance.now();

    const resizeObserver = new ResizeObserver(() => {
      if (!canvas.parentElement) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, canvas.parentElement.clientWidth);
      const h = Math.max(260, canvas.parentElement.clientHeight);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    function renderFrame(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = now * 0.001;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas!.width / dpr;
      const height = canvas!.height / dpr;

      ctx!.save();
      ctx!.scale(dpr, dpr);

      const st = animStateRef.current;
      const sim = st.hydroSim;

      // Coordinate mapping:
      // Top atmospheric band: -4.5m to 0.0m
      // Underground geological profile: 0.0m to 25.0m
      const leftMargin = 56;
      const rightMargin = 18;
      const plotW = Math.max(200, width - leftMargin - rightMargin);
      const topPad = 14;
      const bottomPad = 18;
      const plotH = Math.max(180, height - topPad - bottomPad);

      const minDepthM = -4.5;
      const maxDepthM = 25.0;
      const depthToY = (depthM: number) =>
        topPad + ((depthM - minDepthM) / (maxDepthM - minDepthM)) * plotH;

      const surfaceY = depthToY(0);

      // 1. Sky / Surface Atmosphere background (-4.5m to 0m)
      const skyGrad = ctx!.createLinearGradient(0, 0, 0, surfaceY);
      skyGrad.addColorStop(0, '#070b14');
      skyGrad.addColorStop(1, st.effectivePrecipMm > 5 ? '#111c2d' : '#0d1524');
      ctx!.fillStyle = skyGrad;
      ctx!.fillRect(0, 0, width, surfaceY);

      // 2. Draw the 5 Geological Layers (0m to 25m)
      SLAGELSE_GEOLOGICAL_LAYERS.forEach((layer) => {
        const yTop = depthToY(layer.depthTopM);
        const yBot = depthToY(layer.depthBottomM);
        const layerH = Math.max(2, yBot - yTop);

        const grad = ctx!.createLinearGradient(0, yTop, 0, yBot);
        grad.addColorStop(0, layer.colorTopHex);
        grad.addColorStop(1, layer.colorBottomHex);
        ctx!.fillStyle = grad;
        ctx!.fillRect(leftMargin, yTop, plotW, layerH);

        // Highlight selected layer border
        if (st.selectedLayerId === layer.id) {
          ctx!.strokeStyle = layer.accentHex;
          ctx!.lineWidth = 1.8;
          ctx!.strokeRect(leftMargin + 1, yTop + 1, plotW - 2, layerH - 2);
        }

        // Layer interface dashed boundary line
        ctx!.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx!.lineWidth = 1;
        ctx!.setLineDash([5, 5]);
        ctx!.beginPath();
        ctx!.moveTo(leftMargin, yBot);
        ctx!.lineTo(leftMargin + plotW, yBot);
        ctx!.stroke();
        ctx!.setLineDash([]);

        // Layer title tag on right side
        ctx!.fillStyle = 'rgba(226, 232, 240, 0.86)';
        ctx!.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx!.textAlign = 'right';
        ctx!.fillText(layer.shortName, leftMargin + plotW - 8, yTop + 13);
      });

      // 3. Draw Dynamic Secondary & Primary Groundwater Tables (Rippling Piezometric Surfaces)
      const drawWaterTable = (
        depthM: number,
        label: string,
        fillRgba: string,
        strokeHex: string,
        bottomDepthM: number
      ) => {
        const baseY = depthToY(depthM);
        const botY = depthToY(bottomDepthM);

        ctx!.save();
        ctx!.beginPath();
        ctx!.moveTo(leftMargin, baseY);
        const waveSteps = 36;
        for (let i = 0; i <= waveSteps; i++) {
          const frac = i / waveSteps;
          const x = leftMargin + frac * plotW;
          const wave =
            Math.sin(frac * Math.PI * 6 - elapsed * 2.4) *
            (1.2 + Math.min(2.5, st.effectivePrecipMm * 0.12));
          ctx!.lineTo(x, baseY + wave);
        }
        ctx!.lineTo(leftMargin + plotW, botY);
        ctx!.lineTo(leftMargin, botY);
        ctx!.closePath();
        ctx!.fillStyle = fillRgba;
        ctx!.fill();

        // Glowing piezometric line
        ctx!.strokeStyle = strokeHex;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        for (let i = 0; i <= waveSteps; i++) {
          const frac = i / waveSteps;
          const x = leftMargin + frac * plotW;
          const wave =
            Math.sin(frac * Math.PI * 6 - elapsed * 2.4) *
            (1.2 + Math.min(2.5, st.effectivePrecipMm * 0.12));
          if (i === 0) ctx!.moveTo(x, baseY + wave);
          else ctx!.lineTo(x, baseY + wave);
        }
        ctx!.stroke();

        // Groundwater table badge
        ctx!.fillStyle = strokeHex;
        ctx!.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx!.textAlign = 'left';
        ctx!.fillText(`▼ ${label} (-${depthM.toFixed(1)} m)`, leftMargin + 8, baseY - 5);
        ctx!.restore();
      };

      drawWaterTable(
        sim.secondaryWaterTableDepthM,
        'Sekundært Grundvandsspejl',
        'rgba(56, 189, 248, 0.22)',
        '#38bdf8',
        11.8
      );
      drawWaterTable(
        sim.primaryWaterTableDepthM,
        'Primært Drikkevandsmagasin (OSD)',
        'rgba(6, 182, 212, 0.28)',
        '#22d3ee',
        25.0
      );

      // 4. Source Nodes along Terrain Surface (0.0 m) + Subsurface Leachate Plume Contours
      const displaySources = st.displayedCanvasSources.slice(0, 10);
      const stepSpan = displaySources.length > 1 ? 0.72 / (displaySources.length - 1) : 0;
      const sourcePositionsX = displaySources.map((_, idx) =>
        displaySources.length === 1
          ? leftMargin + plotW * 0.5
          : leftMargin + plotW * (0.16 + idx * stepSpan)
      );

      const isSourceSimulatedInScope = (src: DemolitionSourceNode) =>
        st.displayedSourceMode === 'selected_only'
          ? src.id === st.selectedSourceId
          : st.displayedSourceMode === 'custom' || st.displayedSourceMode === 'all_sources'
          ? true
          : src.active;

      if (st.showContaminantContours) {
        displaySources.forEach((src, idx) => {
          if (!isSourceSimulatedInScope(src)) return;
          const isSelected = st.selectedSourceId === src.id;
          const sx = sourcePositionsX[idx];
          const maxPlumeY = depthToY(sim.plumeMaxDepthMeters);
          const plumeHeight = Math.max(12, maxPlumeY - surfaceY);
          const plumeRadiusX =
            (28 + sim.effectivePrecipitationMmH * 1.45 + sim.saturationRatio * 18) *
            (isSelected ? 1.12 : 0.92);

          const plumeGrad = ctx!.createRadialGradient(
            sx,
            surfaceY + plumeHeight * 0.35,
            4,
            sx,
            surfaceY + plumeHeight * 0.55,
            Math.max(plumeRadiusX, plumeHeight * 0.72)
          );
          plumeGrad.addColorStop(0, isSelected ? 'rgba(34, 211, 238, 0.42)' : 'rgba(244, 63, 94, 0.40)');
          plumeGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.28)');
          plumeGrad.addColorStop(0.8, 'rgba(192, 132, 252, 0.14)');
          plumeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

          ctx!.save();
          ctx!.fillStyle = plumeGrad;
          ctx!.beginPath();
          ctx!.ellipse(
            sim.reachesSecondaryAquifer ? sx - 6 : sx,
            surfaceY + plumeHeight * 0.45,
            plumeRadiusX,
            plumeHeight * 0.58,
            0,
            0,
            Math.PI * 2
          );
          ctx!.fill();
          ctx!.restore();
        });
      }

      // 5. Macropore Desiccation & Freeze-Thaw Fracture Conduits through Moraine Clay
      if (st.showMacroporeFractures) {
        displaySources.forEach((src, idx) => {
          const sx = sourcePositionsX[idx];
          const fractureActive =
            isSourceSimulatedInScope(src) &&
            (st.effectivePrecipMm > 0.2 || st.hadRecentFreezeThaw);
          ctx!.save();
          ctx!.strokeStyle =
            st.selectedSourceId === src.id && fractureActive
              ? 'rgba(34, 211, 238, 0.8)'
              : fractureActive
              ? 'rgba(56, 189, 248, 0.52)'
              : 'rgba(148, 163, 184, 0.22)';
          ctx!.lineWidth = st.selectedSourceId === src.id ? 2.4 : fractureActive ? 1.8 : 1.1;

          // Left & right branching fracture paths through Layer 2 (1.8m to 7.2m) and Layer 4 (11.8m to 16.5m)
          [-10, 8].forEach((offsetX, branchIdx) => {
            ctx!.beginPath();
            ctx!.moveTo(sx + offsetX * 0.4, depthToY(1.2));
            ctx!.lineTo(sx + offsetX, depthToY(3.4));
            ctx!.lineTo(sx + offsetX * 0.5, depthToY(5.3));
            ctx!.lineTo(sx + offsetX * 1.2, depthToY(7.3));
            if (branchIdx === 0) {
              // Deep sand stringer conduit through lower aquitard into Primary Aquifer
              ctx!.moveTo(sx - 6, depthToY(11.8));
              ctx!.lineTo(sx - 12, depthToY(14.2));
              ctx!.lineTo(sx - 8, depthToY(16.6));
            }
            ctx!.stroke();
          });
          ctx!.restore();
        });
      }

      // 6. Wetting Front Depth Line
      const wettingY = depthToY(sim.wettingFrontDepthMeters);
      ctx!.save();
      ctx!.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx!.lineWidth = 1.5;
      ctx!.setLineDash([4, 4]);
      ctx!.beginPath();
      ctx!.moveTo(leftMargin, wettingY);
      ctx!.lineTo(leftMargin + plotW, wettingY);
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.fillStyle = '#fde047';
      ctx!.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx!.textAlign = 'left';
      ctx!.fillText(
        `⚡ Perkolations- & Vædningsfront: -${sim.wettingFrontDepthMeters.toFixed(1)} m`,
        leftMargin + 8,
        wettingY - 4
      );
      ctx!.restore();

      // 7. Animate Percolating Droplets & Contaminant Particles
      const rainSpeedMPerSec = 4.5 + st.effectivePrecipMm * 0.35;
      const subsurfaceSpeedMPerSec =
        0.45 + sim.macroporeVelocityMetersPerDay * 0.08 + st.effectivePrecipMm * 0.14;

      drops.forEach((d) => {
        if (d.contaminantType === 'rain') {
          if (st.effectivePrecipMm <= 0.05) return; // No falling rain in dry weather
          d.depthM += rainSpeedMPerSec * d.speedFactor * dt;
          if (d.depthM >= 0.2) {
            d.depthM = -4.4;
          }
          const rx = leftMargin + d.xNorm * plotW;
          const ry = depthToY(d.depthM);
          ctx!.strokeStyle = 'rgba(125, 211, 252, 0.65)';
          ctx!.lineWidth = 1.3;
          ctx!.beginPath();
          ctx!.moveTo(rx, ry);
          ctx!.lineTo(rx - 1.5, ry + 7);
          ctx!.stroke();
          return;
        }

        if (displaySources.length === 0) return;

        // Subsurface leachate / pore-water particle associated with a demolition source
        const srcIdxMapped =
          st.displayedSourceMode === 'selected_only'
            ? Math.max(
                0,
                displaySources.findIndex((s) => s.id === st.selectedSourceId)
              )
            : d.sourceIdx % displaySources.length;
        const src = displaySources[srcIdxMapped];
        if (!src || !isSourceSimulatedInScope(src)) return;

        const baseSourceX = sourcePositionsX[srcIdxMapped];
        d.depthM += subsurfaceSpeedMPerSec * d.speedFactor * (d.inMacropore ? 1.35 : 0.65) * dt;

        const maxAllowedDepth = Math.max(2.5, sim.plumeMaxDepthMeters);
        if (d.depthM > maxAllowedDepth) {
          d.depthM = 0.25 + (d.speedFactor - 0.75) * 2.0;
        }

        // Lateral drift when inside Secondary Aquifer (7.2–11.8m) or Primary Aquifer (16.5–25m)
        let lateralDriftPx = Math.sin(d.depthM * 1.6 + d.sourceIdx) * (d.inMacropore ? 7 : 15);
        if (d.depthM >= sim.secondaryWaterTableDepthM && d.depthM <= 11.8) {
          // Advect leftwards (towards SW / Rødtjørnevej 2) in secondary sand lens
          lateralDriftPx -= (d.depthM - sim.secondaryWaterTableDepthM) * 9.5;
        } else if (d.depthM >= sim.primaryWaterTableDepthM) {
          lateralDriftPx -= (d.depthM - sim.primaryWaterTableDepthM) * 11.0;
        }

        const px = baseSourceX + lateralDriftPx;
        const py = depthToY(d.depthM);

        if (d.contaminantType === 'lead') ctx!.fillStyle = '#f59e0b'; // Amber: Bly (Pb) / Tungmetaller
        else if (d.contaminantType === 'pcb') ctx!.fillStyle = '#c084fc'; // Purple: PCB
        else ctx!.fillStyle = '#f43f5e'; // Rose: PAH / Asbestslam-kolloider

        ctx!.beginPath();
        ctx!.arc(px, py, d.inMacropore ? 2.6 : 2.0, 0, Math.PI * 2);
        ctx!.fill();
      });

      // 8. Draw Terrain Horizon (0.0 m) & Demolition Source Blocks on Surface
      ctx!.strokeStyle = '#64748b';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(leftMargin, surfaceY);
      ctx!.lineTo(leftMargin + plotW, surfaceY);
      ctx!.stroke();

      const nextHitboxes: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
      displaySources.forEach((src, idx) => {
        const sx = sourcePositionsX[idx];
        const isSelected = st.selectedSourceId === src.id;
        const boxW = displaySources.length > 5 ? 40 : 48;
        const boxH = 22;

        // Trench excavation under building (0 to 1.6m)
        ctx!.fillStyle =
          isSelected
            ? 'rgba(34, 211, 238, 0.28)'
            : src.active
            ? 'rgba(245, 158, 11, 0.22)'
            : 'rgba(51, 65, 85, 0.25)';
        ctx!.fillRect(sx - boxW * 0.55, surfaceY, boxW * 1.1, depthToY(1.6) - surfaceY);

        // Above-ground demolition structure
        ctx!.fillStyle = isSelected ? '#0f293a' : src.active ? '#1e293b' : '#0f172a';
        ctx!.strokeStyle = isSelected ? '#22d3ee' : src.active ? '#f43f5e' : '#475569';
        ctx!.lineWidth = isSelected ? 2.4 : 1.4;
        ctx!.fillRect(sx - boxW / 2, surfaceY - boxH, boxW, boxH);
        ctx!.strokeRect(sx - boxW / 2, surfaceY - boxH, boxW, boxH);

        if (isSelected) {
          ctx!.fillStyle = '#22d3ee';
          ctx!.font = 'bold 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx!.textAlign = 'center';
          ctx!.fillText('▼ VALGT', sx, surfaceY - boxH - 4);
        }

        ctx!.fillStyle = isSelected ? '#22d3ee' : '#f8fafc';
        ctx!.font = 'bold 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx!.textAlign = 'center';
        ctx!.fillText(src.code, sx, surfaceY - boxH + 13);

        nextHitboxes.push({
          id: src.id,
          x1: sx - boxW / 2 - 4,
          y1: surfaceY - boxH - 14,
          x2: sx + boxW / 2 + 4,
          y2: depthToY(1.8),
        });
      });
      sourceHitboxesRef.current = nextHitboxes;

      // Receptor Rødtjørnevej 2 marker on down-gradient left side (SW)
      const recX = leftMargin + 26;
      ctx!.fillStyle = '#0f172a';
      ctx!.strokeStyle = sim.mblViolationActive ? '#f43f5e' : '#10b981';
      ctx!.lineWidth = 1.5;
      ctx!.fillRect(recX - 20, surfaceY - 18, 40, 18);
      ctx!.strokeRect(recX - 20, surfaceY - 18, 40, 18);
      ctx!.fillStyle = '#e2e8f0';
      ctx!.font = '600 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText('REC-RØD2', recX, surfaceY - 6);

      // 8B. Kierulffsvej Underground Utility Corridor: District Heating (-1.05 m) & DN200 Drinking Water Main (-1.65 m)
      if (st.showWaterMainLayer) {
        const wm = st.waterMainTelemetry;
        const pipeDepthM = wm?.burialDepthMeters ?? 1.65;
        const dhDepthM = wm?.districtHeatingDepthMeters ?? 1.05;
        const gwKierulffM = wm?.effectiveGroundwaterDepthMeters ?? 1.2;
        const yDh = depthToY(dhDepthM);
        const yWater = depthToY(pipeDepthM);
        const yGwKierulff = depthToY(gwKierulffM);
        const corrX = leftMargin + plotW * 0.48;
        const corrSpanLeft = leftMargin + plotW * 0.14;
        const corrSpanRight = leftMargin + plotW * 0.88;

        ctx!.save();

        // Shallow Kierulffsvej winter groundwater horizon (0.8–1.4m)
        ctx!.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx!.lineWidth = 1.2;
        ctx!.setLineDash([3, 3]);
        ctx!.beginPath();
        ctx!.moveTo(corrSpanLeft, yGwKierulff);
        ctx!.lineTo(corrSpanRight, yGwKierulff);
        ctx!.stroke();
        ctx!.setLineDash([]);
        ctx!.fillStyle = '#7dd3fc';
        ctx!.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx!.textAlign = 'right';
        ctx!.fillText(
          `Kierulffsvej GW (-${gwKierulffM.toFixed(2)} m)`,
          corrSpanRight,
          yGwKierulff - 3
        );

        // LER 2.0 ±2.0 m Uncertainty Buffer around pipe crown/axis
        if (st.showLerBuffer) {
          const lerTopY = depthToY(Math.max(0.2, pipeDepthM - 0.5));
          const lerBotY = depthToY(pipeDepthM + 0.5);
          ctx!.fillStyle =
            wm?.overallStatus === 'critical_rupture'
              ? 'rgba(239, 68, 68, 0.12)'
              : 'rgba(14, 165, 233, 0.11)';
          ctx!.strokeStyle =
            wm?.overallStatus === 'critical_rupture'
              ? 'rgba(248, 113, 113, 0.7)'
              : 'rgba(56, 189, 248, 0.65)';
          ctx!.lineWidth = 1.2;
          ctx!.setLineDash([4, 4]);
          ctx!.fillRect(corrX - 36, lerTopY, 72, Math.max(12, lerBotY - lerTopY));
          ctx!.strokeRect(corrX - 36, lerTopY, 72, Math.max(12, lerBotY - lerTopY));
          ctx!.setLineDash([]);
          ctx!.fillStyle = '#bae6fd';
          ctx!.font = '600 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx!.textAlign = 'left';
          ctx!.fillText('LER ±2,0m', corrX + 40, yWater + 12);
        }

        // Boussinesq load stress cone from road surface (0.0m) down to pipe crown (-1.65m)
        ctx!.beginPath();
        ctx!.moveTo(corrX - 18, surfaceY + 2);
        ctx!.lineTo(corrX + 18, surfaceY + 2);
        ctx!.lineTo(corrX + 34, yWater);
        ctx!.lineTo(corrX - 34, yWater);
        ctx!.closePath();
        ctx!.fillStyle = wm?.hasSteelRoadPlates
          ? 'rgba(16, 185, 129, 0.14)'
          : 'rgba(245, 158, 11, 0.16)';
        ctx!.fill();
        if (wm?.hasSteelRoadPlates) {
          // Steel Road Plate (PSS W22085) on surface
          ctx!.fillStyle = '#34d399';
          ctx!.fillRect(corrX - 28, surfaceY - 3, 56, 4);
        }

        // Overlying District Heating Twin Pipes at -1.05 m (placed ABOVE water main)
        ctx!.strokeStyle = 'rgba(251, 113, 133, 0.55)';
        ctx!.lineWidth = 2.5;
        ctx!.beginPath();
        ctx!.moveTo(corrSpanLeft, yDh);
        ctx!.lineTo(corrSpanRight, yDh);
        ctx!.stroke();

        [-11, 11].forEach((dx, i) => {
          ctx!.beginPath();
          ctx!.arc(corrX + dx, yDh, 5, 0, Math.PI * 2);
          ctx!.fillStyle = i === 0 ? '#fb7185' : '#38bdf8';
          ctx!.fill();
          ctx!.strokeStyle = '#e2e8f0';
          ctx!.lineWidth = 1.4;
          ctx!.stroke();
        });
        ctx!.fillStyle = '#fda4af';
        ctx!.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx!.textAlign = 'left';
        ctx!.fillText(`Fjernvarme (-${dhDepthM.toFixed(2)} m)`, corrX + 22, yDh + 3);

        // Primary DN200 Drinking Water Main at -1.65 m (directly UNDER district heating)
        const isCritical = wm?.overallStatus === 'critical_rupture';
        const isWarn =
          wm?.overallStatus === 'warning' || wm?.overallStatus === 'advisory';
        const pulseAlpha = isCritical ? 0.65 + 0.35 * Math.sin(elapsed * 8) : 0.92;
        const pipeStrokeHex = isCritical
          ? `rgba(239, 68, 68, ${pulseAlpha.toFixed(2)})`
          : isWarn
          ? '#f59e0b'
          : '#0ea5e9';

        // Longitudinal trace across Kierulffsvej
        ctx!.strokeStyle = pipeStrokeHex;
        ctx!.lineWidth = 5;
        ctx!.beginPath();
        ctx!.moveTo(corrSpanLeft, yWater);
        ctx!.lineTo(corrSpanRight, yWater);
        ctx!.stroke();

        // DN200 pipe cross-section ring
        ctx!.beginPath();
        ctx!.arc(corrX, yWater, 8.5, 0, Math.PI * 2);
        ctx!.fillStyle =
          wm?.intrusionRiskLevel === 'active_backsiphonage' ? '#881337' : '#0369a1';
        ctx!.fill();
        ctx!.strokeStyle = isCritical ? '#fca5a5' : isWarn ? '#fde68a' : '#7dd3fc';
        ctx!.lineWidth = 2.4;
        ctx!.stroke();

        ctx!.fillStyle = isCritical ? '#fecaca' : isWarn ? '#fde68a' : '#38bdf8';
        ctx!.font = 'bold 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx!.textAlign = 'left';
        ctx!.fillText(
          `SK Vand DN200 (-${pipeDepthM.toFixed(2)} m) · ${
            wm ? `${wm.pressureBar.toFixed(1)} bar · PPV ${wm.pipePpvMmPerSec.toFixed(1)} mm/s` : 'Eternit/PE100'
          }`,
          corrX + 16,
          yWater + 3
        );

        // Groundwater intrusion / backsiphonage indicator if pressure drops or GW is above pipe crown
        if (wm && (wm.intrusionRiskLevel === 'active_backsiphonage' || wm.groundwaterAbovePipeCrownMeters > 0)) {
          const isBack = wm.intrusionRiskLevel === 'active_backsiphonage';
          ctx!.fillStyle = isBack ? '#fda4af' : '#fbbf24';
          ctx!.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx!.fillText(
            isBack
              ? `✖ TILBAGESUGNING: Pb ${wm.estimatedLeadIntrusionUgL} µg/L · PAH ${wm.estimatedPah4SumUgL} µg/L`
              : `▲ Grundvand +${wm.groundwaterAbovePipeCrownMeters.toFixed(2)}m over rørtop`,
            corrX + 16,
            yWater + 15
          );
        }

        // Virtual Leak Pin Saturation Bulb in 2D Cross-Section
        if (st.virtualLeakImpact) {
          const leakPulse = 1 + 0.08 * Math.sin(elapsed * 4.5);
          [
            { r: 58 * leakPulse, fill: 'rgba(14, 165, 233, 0.14)', stroke: '#38bdf8' },
            { r: 38 * leakPulse, fill: 'rgba(245, 158, 11, 0.20)', stroke: '#f59e0b' },
            { r: 20 * leakPulse, fill: 'rgba(244, 63, 94, 0.30)', stroke: '#f43f5e' },
          ].forEach((b) => {
            ctx!.beginPath();
            ctx!.arc(corrX, yWater, b.r, 0, Math.PI * 2);
            ctx!.fillStyle = b.fill;
            ctx!.fill();
            ctx!.strokeStyle = b.stroke;
            ctx!.lineWidth = 1.2;
            ctx!.stroke();
          });
          ctx!.fillStyle = '#fecaca';
          ctx!.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx!.textAlign = 'center';
          ctx!.fillText(
            `LÆKAGEPUNKT ${st.virtualLeakImpact.dischargeLs.toFixed(1)} L/s · MÆTNINGSZONE`,
            corrX,
            yWater - 24
          );
        }

        ctx!.restore();
      }

      // 9. Left Depth Axis Ruler (0 m to -25 m)
      ctx!.fillStyle = '#0B0E17';
      ctx!.fillRect(0, 0, leftMargin - 2, height);
      ctx!.strokeStyle = '#334155';
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(leftMargin, topPad);
      ctx!.lineTo(leftMargin, height - bottomPad);
      ctx!.stroke();

      [0, 2, 5, 7.5, 10, 12, 15, 16.5, 20, 25].forEach((dVal) => {
        const y = depthToY(dVal);
        ctx!.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx!.beginPath();
        ctx!.moveTo(leftMargin - 5, y);
        ctx!.lineTo(leftMargin, y);
        ctx!.stroke();

        ctx!.fillStyle = dVal === 0 ? '#38bdf8' : '#94a3b8';
        ctx!.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx!.textAlign = 'right';
        ctx!.fillText(dVal === 0 ? '0 m (Terræn)' : `-${dVal} m`, leftMargin - 7, y + 3);
      });

      ctx!.restore();
      rafId = requestAnimationFrame(renderFrame);
    }

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className={
        internalMapOnly && isMapOnly === undefined
          ? 'fixed inset-0 z-[120] w-screen h-screen bg-[#07090E] text-slate-100 flex flex-col overflow-hidden select-none'
          : 'w-full h-full bg-[#07090E] text-slate-100 flex flex-col overflow-hidden select-none'
      }
    >
      {/* Top Hydrogeological & Precipitation Control Header */}
      <div className="bg-[#0B0E17] border-b border-slate-800 px-3.5 py-2.5 shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <h2 className="text-xs font-bold tracking-tight text-white flex items-center gap-2">
                <span>2D Underjordisk Perkolation &amp; Grundvands-Nedsivning (0 til -25 m)</span>
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                    hydroSim.mblViolationActive
                      ? 'bg-rose-950/90 text-rose-200 border-rose-500/70'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                  }`}
                >
                  {hydroSim.mblViolationActive
                    ? '⚠ MBL § 19 & § 27 GRUNDVANDSRISIKO'
                    : '✓ UNDER GRUNDVANDSKRITERIUM'}
                </span>
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Darcy-perkolation &amp; makropore-transport gennem opsprækket moræneler ved Ringparken /
                Schackenborgvænget
              </p>
            </div>
          </div>

          {/* Quick 2D / 3D / Split Underground View Switcher + Perkolationsrapport PDF Download */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownloadPercolationReport}
              className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Generér og download hydrogeologisk perkolationsrapport (Darcy-nedsivning, makropore-transport, lagprofil 0-25 m og MBL § 19 & § 27 vurdering) som PDF"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>
                {percolationPdfGenerated
                  ? '✓ Perkolationsrapport Downloadet!'
                  : 'Generér & Download Perkolationsrapport (PDF)'}
              </span>
            </button>
            {onSwitchTo3DUnderground && (
              <button
                type="button"
                onClick={onSwitchTo3DUnderground}
                className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                title="Skift til interaktiv 3D Underjordisk Grundvands-Cutaway i Three.js"
              >
                <Box className="w-3.5 h-3.5 text-cyan-400" />
                <span>Skift til 3D Underjordisk Grundvand</span>
              </button>
            )}
            {onSwitchToSplitUnderground && !isCompactSplit && !effectiveMapOnly && (
              <button
                type="button"
                onClick={onSwitchToSplitUnderground}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Split 2D + 3D Grundvand</span>
              </button>
            )}
            {(effectiveMapOnly || isFullscreen) && (() => {
              const activeDateIso =
                selectedDateIso ||
                (currentWeather.isoTime ? currentWeather.isoTime.slice(0, 10) : '2026-11-10');
              const shiftDate = (deltaDays: number) => {
                if (!onChangeDateIso) return;
                const dt = new Date(`${activeDateIso}T12:00:00Z`);
                if (Number.isNaN(dt.getTime())) return;
                dt.setUTCDate(dt.getUTCDate() + deltaDays);
                onChangeDateIso(dt.toISOString().slice(0, 10));
              };
              return (
                <div className="px-2.5 py-1 rounded bg-[#0B0E17]/95 border border-cyan-400/80 ring-1 ring-cyan-400/40 text-xs font-mono font-bold text-white flex items-center gap-1.5 shadow-md">
                  {onChangeDateIso ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => shiftDate(-1)}
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
                        onClick={() => shiftDate(1)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                        title="Næste dato (+1 dag)"
                      >
                        +1d
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-300 shrink-0" />
                      <span>{activeDateIso}</span>
                    </span>
                  )}
                  <span className="text-cyan-400">·</span>
                  <span className="text-amber-300 font-extrabold inline-flex items-center gap-1 tabular-nums">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>kl. {currentWeather.hourLabel}</span>
                  </span>
                  {onStepHour && (
                    <div className="flex items-center gap-1 ml-0.5 pl-1 border-l border-cyan-500/40">
                      <button
                        type="button"
                        onClick={() => onStepHour(-1)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                        title="Forrige time (-1t)"
                      >
                        −1t
                      </button>
                      <button
                        type="button"
                        onClick={() => onStepHour(1)}
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
            {onToggleWaterMainLayer && (
              <button
                type="button"
                data-testid="2d-percolation-water-main-btn"
                onClick={onToggleWaterMainLayer}
                className={`px-2 py-1 rounded border text-xs font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  showWaterMainLayer
                    ? 'bg-sky-500 text-slate-950 border-sky-200 font-bold'
                    : 'bg-slate-900 text-sky-200 border-sky-500/60 hover:bg-sky-950'
                }`}
              >
                <Droplets className="w-3.5 h-3.5 shrink-0" />
                <span>Drikkevands Hovedrør</span>
              </button>
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
                  waterMainTelemetry?.valves.some(
                    (v) => v.code === 'V-VEST' && v.status === 'closed'
                  )
                )
              }
              onToggleS3ValveLockout={onToggleS3ValveLockout}
              hasVirtualLeakPin={hasVirtualLeakPin}
              onToggleVirtualLeakPinQuick={onToggleVirtualLeakPinQuick}
              sources={sources}
              onToggleSourceActive={onToggleSourceActive}
              onIsolateNearbyMachinery={onIsolateNearbyMachinery}
              onRestoreAllMachinery={onRestoreAllMachinery}
              pipePpvMmPerSec={waterMainTelemetry?.pipePpvMmPerSec}
              align="right"
            />
            {!effectiveMapOnly ? (
              <button
                type="button"
                onClick={handleToggleMapOnly}
                className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 border border-emerald-200 text-slate-950 text-xs font-mono font-extrabold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="Kun Kort — Vis kun 2D perkolationskortet med filtre"
              >
                <Map className="w-3.5 h-3.5 text-slate-950" />
                <span>Kun Kort</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleMapOnly}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 border border-rose-300 text-white text-xs font-mono font-extrabold flex items-center gap-1.5 transition-colors shadow-lg cursor-pointer"
                title="Afslut 'Kun Kort' visning (Esc)"
              >
                <X className="w-4 h-4 text-white" />
                <span>Afslut</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Precipitation Amount Controls (Nedbørsmængde mm/t) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded px-3 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-semibold text-cyan-300 flex items-center gap-1">
              <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
              <span>Nedbørsmængde:</span>
            </span>

            {PRECIPITATION_PRESETS.map((preset) => {
              const isSelected =
                preset.value === null
                  ? precipitationOverrideMm === null
                  : precipitationOverrideMm !== null &&
                    Math.abs(precipitationOverrideMm - preset.value) < 0.2;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChangePrecipitationOverride(preset.value)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {preset.label}{' '}
                  <span className="opacity-80">
                    ({preset.value === null ? `${currentWeather.precipitation} mm/t` : preset.badge})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 flex-1 min-w-[220px] max-w-xs">
            <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={effectivePrecipMm}
              onChange={(e) => onChangePrecipitationOverride( parseFloat(e.target.value) )}
              aria-label="Simulér nedbørsmængde i mm pr. time"
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="text-xs font-mono font-bold text-cyan-300 whitespace-nowrap min-w-[66px] text-right">
              {effectivePrecipMm.toFixed(1)} mm/t
            </span>
          </div>
        </div>

        {/* Dedicated Percolation Map Source Switcher & Scope Selector */}
        <div
          data-testid="percolation-source-switcher"
          className="bg-slate-900/90 border border-slate-800 rounded px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-cyan-300 font-semibold flex items-center gap-1 shrink-0">
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Kilde på Perkulationskort:</span>
            </span>

            <select
              data-testid="percolation-source-select"
              aria-label="Skift kilde på Perkulationskortet"
              value={inspectedSource?.id || ''}
              onChange={(e) => {
                if (e.target.value) onSelectSource(e.target.value);
              }}
              className="px-2 py-0.5 rounded bg-slate-950 border border-cyan-500/50 text-slate-100 text-[11px] font-semibold focus:outline-none focus:border-cyan-300 cursor-pointer max-w-[260px]"
            >
              {sources.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.code} — {src.name.split('—')[0].trim()} ({src.active ? 'Aktiv' : 'Inaktiv'})
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-1">
              {sources.slice(0, 6).map((src) => {
                const isSelected = inspectedSource?.id === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => onSelectSource(src.id)}
                    className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                        : src.active
                        ? 'bg-slate-950 text-slate-200 border-slate-700 hover:border-cyan-400'
                        : 'bg-slate-950/60 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                    title={`${src.name} (${src.address}) — klik for at skifte kilde`}
                  >
                    {src.code}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div
              className="inline-flex items-center rounded bg-slate-950 border border-slate-800 p-0.5"
              role="group"
              aria-label="Beregningsomfang for perkolation"
            >
              <button
                type="button"
                onClick={() => setDisplayedSourceMode('all_active')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                  displayedSourceMode === 'all_active'
                    ? 'bg-cyan-500/20 text-cyan-200 font-bold border border-cyan-400/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Alle Aktive ({activeSources.length})
              </button>
              <button
                type="button"
                onClick={() => setDisplayedSourceMode('selected_only')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                  displayedSourceMode === 'selected_only'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Kun Valgt ({inspectedSource?.code || '—'})
              </button>
            </div>
            {inspectedSource && (
              <span className="text-slate-400 hidden lg:inline truncate max-w-[220px]">
                {inspectedSource.address} · H={inspectedSource.releaseHeightMeters}m
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Interactive 2D Cross-Section Canvas + Quantitative Hydrogeology Telemetry */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 overflow-hidden">
        {/* Left/Center: 2D Stratigraphy Cross-Section Canvas */}
        <div
          className={`${
            effectiveMapOnly ? 'xl:col-span-12' : 'xl:col-span-8 xl:border-r'
          } h-full min-h-[260px] relative flex flex-col border-b xl:border-b-0 border-slate-800`}
        >
          <div className="flex-1 relative min-h-[240px]">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasSourceClick}
              title="Klik på en bygningskilde i tværsnittet for at skifte valgt kilde"
              className="w-full h-full block cursor-pointer"
            />

            {/* Top-Right Date & Time + Exit Button overlay inside canvas when in 'Kun Kort' mode */}
            {effectiveMapOnly && (() => {
              const activeDateIso = selectedDateIso || (currentWeather.isoTime ? currentWeather.isoTime.slice(0, 10) : '2026-07-15');
              const shiftDateByDays = (deltaDays: number) => {
                if (!onChangeDateIso) return;
                const base = new Date(`${activeDateIso}T12:00:00Z`);
                if (Number.isNaN(base.getTime())) return;
                base.setUTCDate(base.getUTCDate() + deltaDays);
                onChangeDateIso(base.toISOString().slice(0, 10));
              };
              return (
              <div className="absolute top-2.5 right-3 z-20 flex items-center gap-2">
                <div className="px-2.5 py-1 rounded bg-[#0B0E17]/95 border border-cyan-400/80 ring-1 ring-cyan-400/40 text-xs font-mono font-bold text-white flex items-center gap-1.5 shadow-xl">
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
                          aria-label="Skift dato i Kun Kort"
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
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-300 shrink-0" />
                      <span>{activeDateIso}</span>
                    </span>
                  )}
                  <span className="text-cyan-400">·</span>
                  <span className="text-amber-300 font-extrabold inline-flex items-center gap-1 tabular-nums">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>kl. {currentWeather.hourLabel}</span>
                  </span>
                </div>
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
                      waterMainTelemetry?.valves.some(
                        (v) => v.code === 'V-VEST' && v.status === 'closed'
                      )
                    )
                  }
                  onToggleS3ValveLockout={onToggleS3ValveLockout}
                  hasVirtualLeakPin={hasVirtualLeakPin}
                  onToggleVirtualLeakPinQuick={onToggleVirtualLeakPinQuick}
                  sources={sources}
                  onToggleSourceActive={onToggleSourceActive}
                  onIsolateNearbyMachinery={onIsolateNearbyMachinery}
                  onRestoreAllMachinery={onRestoreAllMachinery}
                  pipePpvMmPerSec={waterMainTelemetry?.pipePpvMmPerSec}
                  align="right"
                />
                <button
                  type="button"
                  onClick={handleToggleMapOnly}
                  className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 border border-rose-300 text-white text-xs font-mono font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
                  title="Afslut 'Kun Kort' visning (Esc)"
                >
                  <X className="w-4 h-4 text-white" />
                  <span>Afslut</span>
                </button>
              </div>
              );
            })()}

            {/* Floating Legend + Canvas Dropdown Menu for Viste Kilder inside 2D Cross-Section */}
            <div className="absolute top-2.5 left-16 z-20 flex flex-wrap items-start gap-2">
              <div className="bg-[#0B0E17]/95 border border-slate-800 rounded px-2.5 py-1.5 flex flex-wrap items-center gap-3 text-[11px] font-mono shadow-md">
                <span className="text-slate-400">Nedsivning:</span>
                <span className="text-sky-300">● Regnvand ({effectivePrecipMm.toFixed(1)} mm/t)</span>
                <span className="text-amber-400">● Bly (Pb) &amp; Tungmetal</span>
                <span className="text-purple-400">● PCB-perkolat</span>
                <span className="text-rose-400">● PAH &amp; Asbestslam</span>
              </div>

              <div ref={canvasDropdownRef} className="relative">
                <button
                  type="button"
                  data-testid="canvas-visible-sources-dropdown-btn"
                  aria-haspopup="menu"
                  aria-expanded={isCanvasSourceDropdownOpen}
                  onClick={() => setIsCanvasSourceDropdownOpen((v) => !v)}
                  className="px-2.5 py-1.5 rounded bg-[#0B0E17]/95 hover:bg-slate-900 border border-cyan-500/60 hover:border-cyan-300 text-cyan-200 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                  title="Vælg hvilke kilder der skal vises i dette perkolationstværsnit"
                >
                  <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Viste kilder ({displayedCanvasSources.length}/{sources.length})
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-cyan-300 transition-transform ${
                      isCanvasSourceDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isCanvasSourceDropdownOpen && (
                  <div
                    data-testid="canvas-visible-sources-dropdown-menu"
                    role="menu"
                    aria-label="Skift viste kilder på perkulationskortet"
                    className="absolute left-0 top-full mt-1.5 w-80 max-w-[88vw] rounded-lg bg-[#0F172A] border border-cyan-500/60 shadow-2xl p-2.5 z-40 font-mono text-[11px] space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-cyan-200 uppercase">
                        Skift viste kilder på kortet
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCanvasSourceDropdownOpen(false)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                        aria-label="Luk kildemenu"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setDisplayedSourceMode('all_active')}
                        className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer transition-colors ${
                          displayedSourceMode === 'all_active'
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500/50'
                        }`}
                      >
                        Aktive ({activeSources.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisplayedSourceMode('all_sources')}
                        className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer transition-colors ${
                          displayedSourceMode === 'all_sources'
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500/50'
                        }`}
                      >
                        Alle ({sources.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisplayedSourceMode('selected_only')}
                        className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer transition-colors ${
                          displayedSourceMode === 'selected_only'
                            ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/50'
                        }`}
                      >
                        Kun valgt
                      </button>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
                      {sources.map((src) => {
                        const isVisibleOnCanvas = displayedCanvasSources.some(
                          (d) => d.id === src.id
                        );
                        const isFocused = inspectedSource?.id === src.id;
                        return (
                          <div
                            key={src.id}
                            className={`flex items-center justify-between gap-2 px-2 py-1 rounded border transition-colors ${
                              isFocused
                                ? 'bg-cyan-950/60 border-cyan-500/60'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isVisibleOnCanvas}
                                onChange={() => toggleSourceInCanvasCustom(src.id)}
                                className="accent-cyan-400 rounded cursor-pointer shrink-0"
                              />
                              <span className="font-bold text-slate-100 shrink-0">
                                {src.code}
                              </span>
                              <span className="text-slate-300 truncate">
                                {src.name.split('—')[0].trim()}
                              </span>
                              {!src.active && (
                                <span className="text-slate-500 text-[11px] shrink-0">
                                  (Inaktiv)
                                </span>
                              )}
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectSource(src.id);
                                if (
                                  displayedSourceMode === 'custom' &&
                                  !customVisibleSourceIds.includes(src.id)
                                ) {
                                  setCustomVisibleSourceIds((prev) => [...prev, src.id]);
                                }
                              }}
                              className={`px-1.5 py-0.5 rounded text-[11px] border shrink-0 cursor-pointer ${
                                isFocused
                                  ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
                                  : 'bg-slate-950 text-cyan-300 border-slate-700 hover:border-cyan-400'
                              }`}
                            >
                              {isFocused ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <Check className="w-3 h-3" />
                                  <span>Valgt</span>
                                </span>
                              ) : (
                                'Fokus'
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomVisibleSourceIds(sources.map((s) => s.id));
                          setDisplayedSourceMode('all_sources');
                        }}
                        className="text-cyan-300 hover:text-cyan-200 font-semibold cursor-pointer"
                      >
                        Vis alle ({sources.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCanvasSourceDropdownOpen(false)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                      >
                        Færdig
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Bar: LayerToggles & Active Demolition Sources */}
          <div className="bg-[#0B0E17] border-t border-slate-800 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMacroporeFractures((v) => !v)}
                className={`px-2 py-0.5 rounded border ${
                  showMacroporeFractures
                    ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                Frost/Tø-Makroporer: {showMacroporeFractures ? 'VIS' : 'SKJUL'}
              </button>
              <button
                type="button"
                onClick={() => setShowContaminantContours((v) => !v)}
                className={`px-2 py-0.5 rounded border ${
                  showContaminantContours
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                Perkolations-Faner: {showContaminantContours ? 'VIS' : 'SKJUL'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400">Kilde-inspektion (klik på kort eller knap):</span>
              {sources.slice(0, 8).map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => onSelectSource(src.id)}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    inspectedSource?.id === src.id
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {src.code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Hydrogeological Metrics, Groundwater Quality Criteria & Layer Inspector */}
        {!effectiveMapOnly && (
        <div className="xl:col-span-4 h-full overflow-y-auto p-3 space-y-3 bg-[#0B0E17]/90 text-xs">
          {/* Darcy & Percolation KPIs */}
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
              <div className="text-[11px] text-slate-400 uppercase">Infiltration / Darcy-flux</div>
              <div className="text-sm font-bold text-cyan-300 mt-0.5">
                {hydroSim.infiltrationRateMmH} / {hydroSim.darcyFluxMmH} mm/t
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Overflade-afstrømning: {hydroSim.surfaceRunoffMmH} mm/t
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
              <div className="text-[11px] text-slate-400 uppercase">Makropore-hastighed</div>
              <div className="text-sm font-bold text-amber-300 mt-0.5">
                {hydroSim.macroporeVelocityMetersPerDay} m/døgn
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Sprække-bypass: {(hydroSim.macroporeBypassFraction * 100).toFixed(0)}% (Jordfugt:{' '}
                {hydroSim.soilMoistureM3M3} m³/m³)
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
              <div className="text-[11px] text-slate-400 uppercase">Nedtrængningsdybde</div>
              <div className="text-sm font-bold text-rose-300 mt-0.5">
                -{hydroSim.plumeMaxDepthMeters} m u.t.
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {hydroSim.reachesPrimaryAquifer
                  ? '✖ Når primært magasin (-16,5 m)'
                  : hydroSim.reachesSecondaryAquifer
                  ? '⚠ Når sekundært magasin (-7,2 m)'
                  : 'I moræneler-zone'}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
              <div className="text-[11px] text-slate-400 uppercase">Gennembrudstid</div>
              <div className="text-sm font-bold text-indigo-300 mt-0.5">
                {hydroSim.breakthroughHoursSecondary} t (Sek.)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Primært magasin: ~{hydroSim.breakthroughDaysPrimary} døgn
              </div>
            </div>
          </div>

          {/* Groundwater Quality Criteria Table (Miljøstyrelsen) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-200">
                Udvaskning vs. Grundvandskvalitetskriterier
              </span>
              <span className="text-[11px] font-mono text-slate-400">MST / GEUS</span>
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-amber-300">Bly (Pb) — Sekundært grundvand</span>
                <span
                  className={`font-bold ${
                    hydroSim.leadConcentrationSecondaryUgL >= 1.0
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {hydroSim.leadConcentrationSecondaryUgL} µg/L{' '}
                  <span className="text-slate-400 font-normal">(Krav: 1,0 µg/L)</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-purple-300">PCB — Sekundært grundvand</span>
                <span
                  className={`font-bold ${
                    hydroSim.pcbConcentrationSecondaryUgL >= 0.01
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {hydroSim.pcbConcentrationSecondaryUgL} µg/L{' '}
                  <span className="text-slate-400 font-normal">(Krav: 0,01 µg/L)</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-rose-300">PAH (Benzo(a)pyren-ækv.)</span>
                <span
                  className={`font-bold ${
                    hydroSim.pahConcentrationSecondaryUgL >= 0.01
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {hydroSim.pahConcentrationSecondaryUgL} µg/L{' '}
                  <span className="text-slate-400 font-normal">(Krav: 0,01 µg/L)</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                <span className="text-cyan-300">Bly (Pb) — Primært magasin (-16,5 m)</span>
                <span
                  className={`font-bold ${
                    hydroSim.leadConcentrationPrimaryUgL >= 1.0
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {hydroSim.leadConcentrationPrimaryUgL} µg/L{' '}
                  <span className="text-slate-400 font-normal">(Krav: 1,0 µg/L)</span>
                </span>
              </div>

              {(() => {
                const lar1269 = evaluateLokalplan1269LarCompliance({
                  catchmentAreaHa: 4.8,
                  imperviousShare: 0.58,
                  precipitationMmPerHour: effectivePrecipMm,
                  stormDurationMinutes: 60,
                  availableLarDetentionM3: 180,
                });
                return (
                  <div
                    data-testid="lokalplan-1269-lar-readout"
                    className="flex items-center justify-between gap-2 pt-1.5"
                  >
                    <span className="text-sky-300">
                      Lokalplan 1269 LAR (Maks 2,0 l/s/ha)
                    </span>
                    <span
                      className={`font-bold text-right ${
                        lar1269.isCompliant ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {lar1269.actualSpecificRunoffLPerSecPerHa.toFixed(2)} l/s/ha
                      {lar1269.detentionDeficitM3 > 0
                        ? ` (+${lar1269.detentionDeficitM3.toFixed(0)} m³ bassin)`
                        : ' (OK)'}
                    </span>
                  </div>
                );
              })()}
            </div>

            {showWaterMainLayer && waterMainTelemetry && (
              <div
                data-testid="underground2d-water-main-card"
                className={`mt-2 p-2 rounded border font-mono text-[11px] space-y-1 ${
                  waterMainTelemetry.pipePpvMmPerSec > 50 ||
                  waterMainTelemetry.simulatedPipeRuptureActive
                    ? 'bg-rose-950/70 border-rose-500 text-rose-100 water-main-tooltip-critical-pulse'
                    : waterMainTelemetry.overallStatus === 'critical_rupture'
                    ? 'bg-rose-950/60 border-rose-500/70 text-rose-100'
                    : waterMainTelemetry.overallStatus === 'warning' ||
                      waterMainTelemetry.overallStatus === 'advisory'
                    ? 'bg-amber-950/50 border-amber-500/60 text-amber-100'
                    : 'bg-sky-950/40 border-sky-500/50 text-sky-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span className="text-sky-300 uppercase">
                    {waterMainTelemetry.ownerName} · DN200 (-1,65 m / 1,45–1,80 m)
                  </span>
                  <span className="text-[11px]">
                    {waterMainTelemetry.waterHardnessDh.toFixed(2)} °dH
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Eternit (1964) + PE100 · LIGE UNDER fjernvarme (~1,05 m) · 7. juni 2018 brud (60 m / ~180 m³)
                </div>
                <div className="text-[11px] text-slate-300">
                  Tryk: <strong className="text-white">{waterMainTelemetry.pressureBar.toFixed(2)} bar</strong> ·
                  Flow: <strong className="text-white">{waterMainTelemetry.flowLs.toFixed(1)} L/s</strong> ·
                  Effekt: <strong className="text-cyan-300">{waterMainTelemetry.hydraulicPowerWatts.toFixed(0)} W</strong>
                </div>
                <div className="text-[11px] text-slate-300">
                  DIN 4150-3 Tabel 3: <strong>{waterMainTelemetry.pipePpvMmPerSec.toFixed(1)} mm/s</strong> (Eternit &ge;25 / Plast 50 / Metal 80) ·
                  Boussinesq: <strong>{waterMainTelemetry.crownStressKpa.toFixed(1)} kPa</strong>{' '}
                  ({waterMainTelemetry.hasSteelRoadPlates ? 'm/ køreplader' : 'uden plader'})
                </div>
                <div className="text-[11px] text-slate-300">
                  BEK 1272/2025 &amp; VFL § 62: Bly &le; 5,0 µg/L (est. {waterMainTelemetry.estimatedLeadIntrusionUgL}) · 4-PAH &le; 0,10 µg/L (est. {waterMainTelemetry.estimatedPah4SumUgL})
                </div>
                {waterMainTelemetry.intrusionRiskLevel === 'active_backsiphonage' && (
                  <div className="text-[11px] font-bold text-rose-300">
                    ✖ Tilbagesugning aktiv: Bly {waterMainTelemetry.estimatedLeadIntrusionUgL} µg/L · Sum 4 PAH{' '}
                    {waterMainTelemetry.estimatedPah4SumUgL} µg/L
                  </div>
                )}
              </div>
            )}

            <div
              data-testid="underground2d-ppv-noise-correlation-chart"
              className="mt-2 p-2.5 rounded border border-cyan-500/40 bg-[#0A101B] font-mono text-[11px] space-y-2 tabular-nums"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 font-bold text-cyan-200 uppercase">
                  <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Korrelation: Maskin-LwA (dB) vs. Kierulffsvej PPV (mm/s)</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded border font-bold ${
                    ppvNoiseCorrelationModel.livePipePpv >= 50
                      ? 'bg-rose-950/80 border-rose-400 text-rose-200'
                      : ppvNoiseCorrelationModel.livePipePpv >= 25
                      ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                      : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                  }`}
                >
                  Live: {ppvNoiseCorrelationModel.effectiveDb} dB(A) →{' '}
                  {ppvNoiseCorrelationModel.livePipePpv.toFixed(1)} mm/s
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                <span>
                  Afstand kilde → DN200: <strong className="text-white">{ppvNoiseCorrelationModel.minHorizDistM} m</strong>
                </span>
                <span>
                  Korrelation r = <strong className="text-cyan-300">{ppvNoiseCorrelationModel.pearsonR.toFixed(3)}</strong> (Bornitz α=0,036 m⁻¹)
                </span>
              </div>

              <div className="h-[155px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={ppvNoiseCorrelationModel.points}
                    margin={{ top: 8, right: 12, left: -14, bottom: 2 }}
                  >
                    <defs>
                      <linearGradient id="ppvNoiseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.38} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="db"
                      type="number"
                      domain={[85, 125]}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(v) => `${v}`}
                      label={{
                        value: 'LwA dB(A)',
                        position: 'insideBottomRight',
                        offset: -2,
                        fill: '#64748b',
                        fontSize: 10,
                      }}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      domain={[0, (max: number) => Math.max(60, Math.ceil(max * 1.15))]}
                      tickFormatter={(v) => `${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090d16',
                        borderColor: '#334155',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                      formatter={(val) => [
                        `${typeof val === 'number' ? val.toFixed(2) : Number(val ?? 0).toFixed(2)} mm/s`,
                        'Rør-PPV (DIN 4150-3)',
                      ]}
                      labelFormatter={(label) => `Maskin-støj: ${label} dB(A)`}
                    />
                    <ReferenceLine
                      y={25}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                      label={{
                        value: 'Eternit 25 mm/s',
                        position: 'insideTopLeft',
                        fill: '#fbbf24',
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      y={50}
                      stroke="#f43f5e"
                      strokeDasharray="4 3"
                      label={{
                        value: 'Brudgrænse 50 mm/s',
                        position: 'insideTopRight',
                        fill: '#fda4af',
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      x={ppvNoiseCorrelationModel.effectiveDb}
                      stroke="#22d3ee"
                      strokeDasharray="3 3"
                    />
                    <Area
                      type="monotone"
                      dataKey="pipePpvMmPerSec"
                      stroke="none"
                      fill="url(#ppvNoiseAreaGrad)"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="pipePpvMmPerSec"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <ReferenceDot
                      x={ppvNoiseCorrelationModel.effectiveDb}
                      y={ppvNoiseCorrelationModel.livePipePpv}
                      r={5}
                      fill={
                        ppvNoiseCorrelationModel.livePipePpv >= 50
                          ? '#f43f5e'
                          : ppvNoiseCorrelationModel.livePipePpv >= 25
                          ? '#f59e0b'
                          : '#22d3ee'
                      }
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {simultaneousDispatch?.active && (
              <div
                data-testid="underground2d-simultaneous-s1s3-card"
                className={`mt-2 p-2 rounded border-2 font-mono text-[11px] space-y-1 transition-colors ${
                  simultaneousDispatch.isBlinkingP1
                    ? 'bg-rose-950/85 border-rose-400 text-rose-100 animate-pulse'
                    : 'bg-rose-950/60 border-rose-700 text-rose-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span className="flex items-center gap-1 text-amber-200">
                    <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {simultaneousDispatch.isBlinkingP1
                        ? 'P1 S1+S3 NØDBREMSE (UKVITTERET)'
                        : 'P1 S1+S3 NØDBREMSE (KVITTERET)'}
                    </span>
                  </span>
                  {simultaneousDispatch.isBlinkingP1 && onAcknowledgeSimultaneousP1 && (
                    <button
                      type="button"
                      onClick={onAcknowledgeSimultaneousP1}
                      className="px-1.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                    >
                      Kvittér P1
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 text-slate-200">
                  <Lock className="w-3 h-3 text-cyan-300 shrink-0" />
                  <span>
                    {simultaneousDispatch.system3State.lockedValveCodes.join(' + ')} LUKKET (T0→T1{' '}
                    {simultaneousDispatch.latencyMs} ms) · CAV → H14-HEPA
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownloadPercolationReport}
              className="w-full mt-2 px-3 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>
                {percolationPdfGenerated
                  ? '✓ Hydrogeologisk Perkolationsrapport Downloadet'
                  : 'Download Komplet Perkolationsrapport (PDF)'}
              </span>
            </button>
          </div>

          {/* Interactive Geological Layer Selector */}
          <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5 space-y-2">
            <div className="text-[11px] font-mono font-bold uppercase text-slate-200">
              Geologisk Lagprofil (Klik for lag-detaljer)
            </div>
            <div className="space-y-1">
              {SLAGELSE_GEOLOGICAL_LAYERS.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded font-mono text-[11px] border transition-colors flex items-center justify-between ${
                    selectedLayerId === layer.id
                      ? 'bg-slate-800 border-cyan-400 text-white'
                      : 'bg-slate-950/80 border-slate-800/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="truncate">{layer.shortName}</span>
                  <span className="text-[11px] text-cyan-300 shrink-0 ml-2">
                    K = {layer.hydraulicConductivityMs.toExponential(1)} m/s
                  </span>
                </button>
              ))}
            </div>

            <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
              <div className="font-mono font-bold text-cyan-300 mb-0.5">{selectedLayer.name}</div>
              <p>{selectedLayer.geologyDescription}</p>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
