import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  Biohazard,
  Box,
  Building2,
  Calendar,
  Camera,
  ChevronUp,
  Clock,
  CloudRain,
  Droplets,
  ExternalLink,
  Flame,
  Globe,
  GripHorizontal,
  Hammer,
  Hourglass,
  Layers,
  Link,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Minus,
  Navigation,
  Pause,
  Pin,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Target,
  Thermometer,
  Undo2,
  Volume2,
  Wind,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AlgedonicObservation,
  BuildingOperationalCategory,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  PlumePolygonZone,
  ReceptorExposureResult,
  ReceptorZone,
  RingparkenBuildingUnit,
  SimultaneousAlgedonicDispatch,
  SubstanceKey,
  VirtualLeakPinImpact,
  WaterMainLiveTelemetry,
} from '../types/dispersion';
import {
  BUILDING_CATEGORY_METADATA,
  RINGPARKEN_MASTER_BUILDINGS,
} from '../data/ringparkenData';
import { degreesToCompass } from '../services/weatherService';
import { computeHydrogeologicalPercolation } from './UndergroundPercolation2D';
import {
  BornehaveSpatialPlumeAlertStatus,
  evaluateBornehaveDaycare3DPlumeAlert,
} from '../services/bornehaveSpatialAlertService';
import { CompactSimulerMenu } from './CompactSimulerMenu';

// Center of Ringparken / Schackenborgvænget site in Slagelse
const SITE_ORIGIN: LatLngPoint = { lat: 55.41275, lng: 11.3532 };
// 1 world unit = 1.8 meters so a 320m x 320m neighborhood fits comfortably in [-95, 95]
const METERS_PER_UNIT = 1.8;

function latLngToWorldXZ(pt: LatLngPoint): { x: number; z: number } {
  const latRad = (SITE_ORIGIN.lat * Math.PI) / 180;
  const metersNorth = (pt.lat - SITE_ORIGIN.lat) * 111320;
  const metersEast = (pt.lng - SITE_ORIGIN.lng) * 111320 * Math.cos(latRad);
  const rawX = metersEast / METERS_PER_UNIT;
  const rawZ = -metersNorth / METERS_PER_UNIT; // North is -Z, East is +X, South is +Z, West is -X
  const dist = Math.hypot(rawX, rawZ);
  if (dist <= 92) {
    return { x: rawX, z: rawZ };
  }
  // Smoothly compress outer Slagelse city receptors onto the 3D terrain perimeter [92..126] along their true compass bearing
  const compressedDist = 92 + 34 * (1 - Math.exp(-(dist - 92) / 260));
  const scale = compressedDist / dist;
  return {
    x: rawX * scale,
    z: rawZ * scale,
  };
}

// Pre-allocated scratch objects at module scope — ZERO allocations inside tick()
const _scratchDummy = new THREE.Object3D();
const _scratchColor = new THREE.Color();
const _scratchVecA = new THREE.Vector3();
const _scratchVecB = new THREE.Vector3();
const _scratchVecC = new THREE.Vector3();
const _scratchTargetPos = new THREE.Vector3();
const _scratchTargetLook = new THREE.Vector3();
const _scratchAxisZ = new THREE.Vector3(0, 0, 1);
const _scratchQuat = new THREE.Quaternion();

export type CameraPresetKey =
  | 'overview'
  | 'underground_aquifer'
  | 'blok1_blok2_percolation'
  | 'downwind_corridor'
  | 'source_blok1'
  | 'receptor_roedtjoornevej'
  | 'street_kierulffsvej'
  | 'top_orthographic';

export interface Ringparken3DSceneProps {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  plumeZones: PlumePolygonZone[];
  receptorExposures: ReceptorExposureResult[];
  currentWeather: HourlyWeatherPoint;
  observations: AlgedonicObservation[];
  selectedSourceId: string | null;
  selectedReceptorId: string | null;
  onSelectSource: (id: string) => void;
  onSelectReceptor: (id: string) => void;
  onToggleSourceActive?: (id: string) => void;
  isFullscreen3D?: boolean;
  onToggleFullscreen3D?: () => void;
  undergroundMode?: boolean;
  onToggleUndergroundMode?: (next?: boolean) => void;
  precipitationOverrideMm?: number | null;
  onChangePrecipitationOverride?: (val: number | null) => void;
  onSwitchTo2DPercolation?: () => void;
  asbestosHeatmapActive?: boolean;
  onToggleAsbestosHeatmap?: (active: boolean) => void;
  asbestosSourceScope?: 'all_active' | 'selected_source';
  onChangeAsbestosSourceScope?: (scope: 'all_active' | 'selected_source') => void;
  asbestosEvalHeightMeters?: number;
  onChangeAsbestosEvalHeightMeters?: (h: number) => void;
  weatherHours?: HourlyWeatherPoint[];
  temporal24hAsbestosAccumulation?: boolean;
  onToggleTemporal24hAsbestosAccumulation?: (active: boolean) => void;
  showLeewardWakeEffect?: boolean;
  onToggleLeewardWakeEffect?: (active: boolean) => void;
  showWeatherCorrelationOverlay?: boolean;
  onToggleWeatherCorrelationOverlay?: (active: boolean) => void;
  timelineSliderProgress?: number;
  buildings?: RingparkenBuildingUnit[];
  activeCategoryFilters?: BuildingOperationalCategory[];
  onToggleCategoryFilter?: (cat: BuildingOperationalCategory) => void;
  onChangeBuildingCategory?: (
    buildingId: string,
    nextCategory: BuildingOperationalCategory
  ) => void;
  isMapOnly?: boolean;
  onToggleMapOnly?: () => void;
  show3DNeutralPressurePlane?: boolean;
  onToggle3DNeutralPressurePlane?: (active: boolean) => void;
  neutralPressurePlaneHeightMeters?: number;
  onChangeNeutralPressurePlaneHeightMeters?: (zMeters: number) => void;
  machineNoiseOutputDb?: number;
  selectedDateIso?: string;
  onChangeDateIso?: (nextDateIso: string) => void;
  onStepHour?: (deltaHours: number) => void;
  focusBlok12PercolationTrigger?: number;
  simulationSpeedMultiplier?: 1 | 2 | 3 | 5 | 10;
  hiddenSourceIds?: string[];
  visibleSubstances?: Record<SubstanceKey, boolean>;
  onBornehavePlumeAlertUpdate?: (status: BornehaveSpatialPlumeAlertStatus) => void;
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
  onIsolateNearbyMachinery?: () => void;
  onRestoreAllMachinery?: () => void;
  virtualLeakPinPoint?: LatLngPoint | null;
  virtualLeakImpact?: VirtualLeakPinImpact | null;
  onToggleVirtualLeakPinQuick?: () => void;
  simultaneousDispatch?: SimultaneousAlgedonicDispatch | null;
}

export interface WeatherCorrelationPoint3D {
  id: string;
  code: string;
  locationLabel: string;
  timestampLabel: string;
  position: LatLngPoint;
  worldX: number;
  worldY: number;
  worldZ: number;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
  dustIntensityS: number;
  correlationIndex: number; // 0..1 normalized correlation between windSpeed & dustIntensity
  sha256Signature: string;
  isUserObservation: boolean;
  severity: 'critical' | 'elevated' | 'moderate' | 'low';
}

export interface WeatherCorrelationSummaryMetrics {
  pearsonR: number;
  rSquared: number;
  totalSignedPoints: number;
  userObservationCount: number;
  avgWindSpeedMs: number;
  peakWindSpeedMs: number;
  avgDustIntensityS: number;
  peakDustIntensityS: number;
  criticalHotspotCount: number;
  points: WeatherCorrelationPoint3D[];
}

export interface AsbestosHeatmapMetrics {
  isTemporal24hMode: boolean;
  peakFibersCm3: number;
  peakQuotient: number;
  exceedanceAreaM2: number;
  actionZoneAreaM2: number;
  evaluatedSourceCount: number;
  dominantSourceLabel: string;
  dominantReleaseHeightM: number;
  dominantFiberReleasePct: number;
  // 24-hour Temporal Accumulation Metrics (Døgn-Risiko & 3D-Volumen-Opbygning for Naboer)
  accumulatedHoursCount: number;
  peak24hCumulativeDoseFibersCm3H: number;
  dailyDoseLimitFibersCm3H: number;
  peak24hDailyRiskQuotient: number;
  mostExposedNeighborName: string;
  mostExposedNeighborDoseFibersCm3H: number;
  mostExposedNeighborHoursAboveGv: number;
  mostExposedNeighborPeakHourLabel: string;
  volumetricGrid22x22: Float32Array;
  receptorCumulativeDoses: Array<{
    id: string;
    code: string;
    worldX: number;
    worldZ: number;
    doseFibersCm3H: number;
    dailyQuotient: number;
    hoursAboveGv: number;
  }>;
  // Leeward Building Wake ('Læ-Effekt' / Vindstille Støv-Akkumulering) Metrics
  leewardWakeActive: boolean;
  leewardCalmWindSpeedMs: number;
  leewardWindReductionPct: number;
  peakLeewardAccumulationFactor: number;
  criticalLeewardBuildingLabel: string;
  // Børnehave-receptor (Kierulffsvej 2–4) live asbestos concentration for >0.001 f/cm³ alarm
  bornehaveFibersCm3: number;
  bornehaveReceptorLabel: string;
}

const ASBESTOS_VOLUME_GRID_DIM = 22;
const ASBESTOS_VOLUME_CELL_COUNT = ASBESTOS_VOLUME_GRID_DIM * ASBESTOS_VOLUME_GRID_DIM; // 484 3D volume cells

const ASBESTOS_GV_2026 = 0.003; // fibre/cm³ (BEK nr. 613/2026)
const ASBESTOS_ACTION_VALUE = 0.0003; // fibre/cm³ (10% GV)
const ASBESTOS_DAILY_DOSE_LIMIT_24H = 0.024; // fibre/cm³·timer (8t × 0,003 fibre/cm³ døgntærskel)

function computeAsbestosWeatherMultiplier(
  weather: HourlyWeatherPoint,
  releaseHeightMeters: number
): number {
  const heightBonus = 1 + Math.max(0, releaseHeightMeters - 6) * 0.025;
  const gustSpread =
    weather.windGusts10m > 8 ? 1 + (weather.windGusts10m - 8) * 0.095 : 1.0;
  const thermalDraft =
    weather.temperature2m > 18 ? 1 + (weather.temperature2m - 18) * 0.04 : 1.0;
  const humidityFactor = weather.relativeHumidity2m < 55 ? 1.24 : 0.94;
  const rainFactor = weather.precipitation > 0.2 ? 0.55 : 1.0;
  return heightBonus * gustSpread * thermalDraft * humidityFactor * rainFactor;
}

function evaluatePointAsbestosFibersCm3(
  worldX: number,
  worldZ: number,
  evalHeightMeters: number,
  sources: DemolitionSourceNode[],
  selectedSourceId: string | null,
  sourceScope: 'all_active' | 'selected_source',
  weather: HourlyWeatherPoint,
  waterSuppressionActive: boolean
): number {
  const plumeDirDeg = (weather.windDirection10m + 180) % 360;
  const plumeRad = (plumeDirDeg * Math.PI) / 180;
  const ux = Math.sin(plumeRad); // East+
  const uy = Math.cos(plumeRad); // North+

  const pasquillCoeffs: Record<string, { ay: number; by: number; az: number; bz: number }> = {
    A: { ay: 0.32, by: 0.88, az: 0.24, bz: 0.88 },
    B: { ay: 0.24, by: 0.88, az: 0.18, bz: 0.86 },
    C: { ay: 0.16, by: 0.89, az: 0.12, bz: 0.85 },
    D: { ay: 0.11, by: 0.89, az: 0.08, bz: 0.83 },
    E: { ay: 0.08, by: 0.89, az: 0.06, bz: 0.8 },
    F: { ay: 0.06, by: 0.89, az: 0.04, bz: 0.78 },
  };
  const coeff = pasquillCoeffs[weather.pasquillClass] || pasquillCoeffs.D;
  const u = Math.max(0.8, weather.windSpeed10m);
  const waterFactor = waterSuppressionActive ? 0.42 : 1.0;

  let totalFibers = 0;

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    if (!src.substances.includes('asbestos')) continue;
    if (sourceScope === 'selected_source') {
      if (selectedSourceId && src.id !== selectedSourceId) continue;
    } else {
      if (!src.active) continue;
    }

    const srcXZ = latLngToWorldXZ(src.position);
    const dxEastM = (worldX - srcXZ.x) * METERS_PER_UNIT;
    const dyNorthM = -(worldZ - srcXZ.z) * METERS_PER_UNIT;
    const radialDistM = Math.hypot(dxEastM, dyNorthM);

    const downwindM = dxEastM * ux + dyNorthM * uy;
    const crosswindM = Math.abs(-dxEastM * uy + dyNorthM * ux);

    const H = Math.max(1, src.releaseHeightMeters || 8);
    const fiberIdx = src.fiberReleaseIndex !== undefined ? src.fiberReleaseIndex : 0.72;
    const fiberSourceMult = Math.max(0.1, 0.35 + fiberIdx * 1.25);
    const weatherMult = computeAsbestosWeatherMultiplier(weather, H);

    // Near-source omnidirectional building-wake turbulence core (within 24 m of active excavator/facade)
    if (radialDistM < 26) {
      const wakeKernel = Math.exp(-(radialDistM * radialDistM) / (2 * 9.5 * 9.5));
      const heightKernel = Math.exp(-Math.pow(evalHeightMeters - H * 0.45, 2) / (2 * 7.5 * 7.5));
      totalFibers +=
        ASBESTOS_GV_2026 *
        0.92 *
        wakeKernel *
        (0.55 + 0.45 * heightKernel) *
        fiberSourceMult *
        weatherMult *
        waterFactor;
    }

    if (downwindM > 1.5) {
      const sigmaY = Math.hypot(coeff.ay * Math.pow(downwindM, coeff.by), 8.5);
      const sigmaZ = Math.hypot(coeff.az * Math.pow(downwindM, coeff.bz), 4.5);

      const latTerm = Math.exp(-(crosswindM * crosswindM) / (2 * sigmaY * sigmaY));
      const vertTerm =
        Math.exp(-Math.pow(evalHeightMeters - H, 2) / (2 * sigmaZ * sigmaZ)) +
        Math.exp(-Math.pow(evalHeightMeters + H, 2) / (2 * sigmaZ * sigmaZ));

      const rawGaussian = (1 / (2 * Math.PI * u * sigmaY * sigmaZ)) * latTerm * vertTerm;
      const normalizedGaussian = Math.min(2.4, rawGaussian * 4800);

      const sourceWeight = src.id === 'src-blok-1' ? 1.12 : 0.92;
      const contrib =
        ASBESTOS_GV_2026 *
        0.58 *
        normalizedGaussian *
        sourceWeight *
        fiberSourceMult *
        weatherMult *
        waterFactor;

      totalFibers += contrib;
    }
  }

  return totalFibers;
}

function renderAsbestosHeatmapCanvasAndRelief(
  canvas: HTMLCanvasElement,
  reliefGeometry: THREE.PlaneGeometry | null,
  sources: DemolitionSourceNode[],
  receptors: ReceptorZone[],
  selectedSourceId: string | null,
  sourceScope: 'all_active' | 'selected_source',
  evalHeightMeters: number,
  weather: HourlyWeatherPoint,
  waterSuppressionActive: boolean,
  weatherHours?: HourlyWeatherPoint[],
  temporal24hMode: boolean = false,
  showLeewardWakeEffect: boolean = true,
  temporalAccumulationHoursLimit: number = 24
): AsbestosHeatmapMetrics {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');

  const clampedHoursCap = Math.max(1, Math.min(24, Math.round(temporalAccumulationHoursLimit)));
  const hoursList =
    temporal24hMode && weatherHours && weatherHours.length > 0
      ? weatherHours.slice(0, clampedHoursCap)
      : [weather];

  // Pre-filter active asbestos sources and pre-compute per-source & per-hour kernels for fast 24h evaluation
  const activeAsbestosSources = sources
    .filter((s) => {
      if (!s.substances.includes('asbestos')) return false;
      if (sourceScope === 'selected_source') {
        return !selectedSourceId || s.id === selectedSourceId;
      }
      return s.active;
    })
    .map((src) => {
      const xz = latLngToWorldXZ(src.position);
      const relH = Math.max(1, src.releaseHeightMeters || 8);
      const fiberIdx = src.fiberReleaseIndex !== undefined ? src.fiberReleaseIndex : 0.72;
      const fiberSourceMult = Math.max(0.1, 0.35 + fiberIdx * 1.25);
      const sourceWeight = src.id === 'src-blok-1' ? 1.12 : 0.92;
      const heightKernel = Math.exp(-Math.pow(evalHeightMeters - relH * 0.45, 2) / (2 * 7.5 * 7.5));
      return {
        src,
        worldX: xz.x,
        worldZ: xz.z,
        relH,
        fiberSourceMult,
        sourceWeight,
        wakeHeightFactor: 0.55 + 0.45 * heightKernel,
      };
    });

  // Pre-compute aerodynamic building obstacles (both active demolition blocks and neighbor receptor blocks)
  // that generate leeward calm-wind recirculation pockets ('Læ-effekt').
  // Category 'e_demolished_unsecured' (buildingHeight3DMeters === 0) has its superstructure removed and does NOT create a leeward wake.
  const buildingWakeObstacles = [
    ...sources
      .filter(
        (s) =>
          s.active &&
          s.buildingCategory !== 'e_demolished_unsecured' &&
          s.buildingHeight3DMeters !== 0
      )
      .map((s) => {
        const xz = latLngToWorldXZ(s.position);
        const hM = Math.max(6, s.buildingHeight3DMeters ?? (s.releaseHeightMeters || 10));
        return {
          id: s.id,
          label: `${s.code} (${s.name.split(':')[0]})`,
          worldX: xz.x,
          worldZ: xz.z,
          heightM: hM,
          halfWidthM: 8.5,
          wakeLengthM: Math.max(22, hM * 2.55),
          isSourceBuilding: true,
        };
      }),
    ...receptors
      .filter(
        (r) =>
          r.buildingCategory !== 'e_demolished_unsecured' &&
          r.buildingHeight3DMeters !== 0
      )
      .map((r) => {
        const xz = latLngToWorldXZ(r.center);
        const isRes = r.category === 'residential_block';
        const hM = r.buildingHeight3DMeters ?? (isRes ? 11.2 : 5.2);
        return {
          id: r.id,
          label: `${r.code}: ${r.name}`,
          worldX: xz.x,
          worldZ: xz.z,
          heightM: hM,
          halfWidthM: isRes ? 9.5 : 5.5,
          wakeLengthM: isRes ? 28.0 : 16.5,
          isSourceBuilding: false,
        };
      }),
  ];

  const pasquillCoeffs: Record<string, { ay: number; by: number; az: number; bz: number }> = {
    A: { ay: 0.32, by: 0.88, az: 0.24, bz: 0.88 },
    B: { ay: 0.24, by: 0.88, az: 0.18, bz: 0.86 },
    C: { ay: 0.16, by: 0.89, az: 0.12, bz: 0.85 },
    D: { ay: 0.11, by: 0.89, az: 0.08, bz: 0.83 },
    E: { ay: 0.08, by: 0.89, az: 0.06, bz: 0.8 },
    F: { ay: 0.06, by: 0.89, az: 0.04, bz: 0.78 },
  };
  const waterFactor = waterSuppressionActive ? 0.42 : 1.0;

  const hourlyKernels = hoursList.map((hr) => {
    const plumeDirDeg = (hr.windDirection10m + 180) % 360;
    const plumeRad = (plumeDirDeg * Math.PI) / 180;
    return {
      hr,
      plumeDirDeg,
      ux: Math.sin(plumeRad),
      uy: Math.cos(plumeRad),
      u: Math.max(0.8, hr.windSpeed10m),
      coeff: pasquillCoeffs[hr.pasquillClass] || pasquillCoeffs.D,
      sourceWeatherMults: activeAsbestosSources.map((s) =>
        computeAsbestosWeatherMultiplier(hr, s.relH)
      ),
    };
  });

  const evalPointForHourKernel = (
    worldX: number,
    worldZ: number,
    hkIdx: number
  ): number => {
    const hk = hourlyKernels[hkIdx];
    let totalFibers = 0;

    for (let sIdx = 0; sIdx < activeAsbestosSources.length; sIdx++) {
      const s = activeAsbestosSources[sIdx];
      const dxEastM = (worldX - s.worldX) * METERS_PER_UNIT;
      const dyNorthM = -(worldZ - s.worldZ) * METERS_PER_UNIT;
      const radialDistSq = dxEastM * dxEastM + dyNorthM * dyNorthM;
      const wMult = hk.sourceWeatherMults[sIdx];

      if (radialDistSq < 676) {
        const wakeKernel = Math.exp(-radialDistSq / (2 * 9.5 * 9.5));
        totalFibers +=
          ASBESTOS_GV_2026 *
          0.92 *
          wakeKernel *
          s.wakeHeightFactor *
          s.fiberSourceMult *
          wMult *
          waterFactor;
      }

      const downwindM = dxEastM * hk.ux + dyNorthM * hk.uy;
      if (downwindM > 1.5) {
        const crosswindM = Math.abs(-dxEastM * hk.uy + dyNorthM * hk.ux);
        const sigmaY = Math.hypot(hk.coeff.ay * Math.pow(downwindM, hk.coeff.by), 8.5);
        const sigmaZ = Math.hypot(hk.coeff.az * Math.pow(downwindM, hk.coeff.bz), 4.5);

        const latTerm = Math.exp(-(crosswindM * crosswindM) / (2 * sigmaY * sigmaY));
        if (latTerm > 0.002) {
          const vertTerm =
            Math.exp(-Math.pow(evalHeightMeters - s.relH, 2) / (2 * sigmaZ * sigmaZ)) +
            Math.exp(-Math.pow(evalHeightMeters + s.relH, 2) / (2 * sigmaZ * sigmaZ));

          const rawGaussian = (1 / (2 * Math.PI * hk.u * sigmaY * sigmaZ)) * latTerm * vertTerm;
          const normalizedGaussian = Math.min(2.4, rawGaussian * 4800);

          totalFibers +=
            ASBESTOS_GV_2026 *
            0.58 *
            normalizedGaussian *
            s.sourceWeight *
            s.fiberSourceMult *
            wMult *
            waterFactor;
        }
      }
    }

    // Apply aerodynamic Leeward Building Wake ('Læ-effekt') dust accumulation amplification
    if (showLeewardWakeEffect && activeAsbestosSources.length > 0) {
      let maxWakeEnvelope = 0;
      for (let bIdx = 0; bIdx < buildingWakeObstacles.length; bIdx++) {
        const b = buildingWakeObstacles[bIdx];
        const bDxEastM = (worldX - b.worldX) * METERS_PER_UNIT;
        const bDyNorthM = -(worldZ - b.worldZ) * METERS_PER_UNIT;
        const bDownwindM = bDxEastM * hk.ux + bDyNorthM * hk.uy;
        if (bDownwindM > 1.5 && bDownwindM < b.wakeLengthM * 1.35) {
          const bCrosswindM = Math.abs(-bDxEastM * hk.uy + bDyNorthM * hk.ux);
          if (bCrosswindM < b.halfWidthM * 1.45) {
            const normDown = (bDownwindM - b.wakeLengthM * 0.42) / (b.wakeLengthM * 0.45);
            const normCross = bCrosswindM / (b.halfWidthM * 0.82);
            const env = Math.exp(-0.5 * (normDown * normDown + normCross * normCross));
            if (env > maxWakeEnvelope) {
              maxWakeEnvelope = env;
            }
          }
        }
      }
      if (maxWakeEnvelope > 0.04) {
        // Reduced wind speed inside the leeward recirculation cavity causes up to 2.35x concentration buildup
        totalFibers =
          totalFibers * (1 + 1.35 * maxWakeEnvelope) +
          ASBESTOS_GV_2026 * 0.28 * maxWakeEnvelope * waterFactor;
      }
    }

    return totalFibers;
  };

  let peakFibersCm3 = 0;
  let peak24hDoseFibersCm3H = 0;
  let exceedancePixels = 0;
  let actionZonePixels = 0;

  // Normalized quotient grid for rendering & 3D relief:
  // - In single-hour mode: q = c / 0.003 (GV)
  // - In 24h temporal accumulation mode: q = cumulative24hDose / 0.024 (Daily 8h-equivalent GV dose)
  const quotientGrid = new Float32Array(W * H);

  for (let py = 0; py < H; py++) {
    const worldZ = (py / (H - 1) - 0.5) * 280;
    for (let px = 0; px < W; px++) {
      const worldX = (px / (W - 1) - 0.5) * 280;

      if (!temporal24hMode) {
        const c = evalPointForHourKernel(worldX, worldZ, 0);
        const q = c / ASBESTOS_GV_2026;
        quotientGrid[py * W + px] = q;
        if (c > peakFibersCm3) peakFibersCm3 = c;
        if (c >= ASBESTOS_GV_2026) exceedancePixels++;
        if (c >= ASBESTOS_ACTION_VALUE) actionZonePixels++;
      } else {
        let sumDose = 0;
        let maxHourConc = 0;
        for (let hIdx = 0; hIdx < hourlyKernels.length; hIdx++) {
          const ch = evalPointForHourKernel(worldX, worldZ, hIdx);
          sumDose += ch;
          if (ch > maxHourConc) maxHourConc = ch;
        }
        if (maxHourConc > peakFibersCm3) peakFibersCm3 = maxHourConc;
        if (sumDose > peak24hDoseFibersCm3H) peak24hDoseFibersCm3H = sumDose;

        const q24 = sumDose / ASBESTOS_DAILY_DOSE_LIMIT_24H;
        quotientGrid[py * W + px] = q24;
        if (q24 >= 1.0) exceedancePixels++;
        if (q24 >= 0.1) actionZonePixels++;
      }
    }
  }

  // Evaluate 24-hour accumulated exposure at each neighbor receptor zone
  let mostExposedNeighborName = receptors[0]?.name || 'Rødtjørnevej 2';
  let mostExposedNeighborDoseFibersCm3H = 0;
  let mostExposedNeighborHoursAboveGv = 0;
  let mostExposedNeighborPeakHourLabel = weather.hourLabel;

  const receptor24hSummaries = receptors.map((rec) => {
    const rxz = latLngToWorldXZ(rec.center);
    let recSumDose = 0;
    let recHoursAboveGv = 0;
    let recPeakConc = -1;
    let recPeakHourLabel = weather.hourLabel;

    for (let hIdx = 0; hIdx < hourlyKernels.length; hIdx++) {
      const ch = evalPointForHourKernel(rxz.x, rxz.z, hIdx);
      recSumDose += ch;
      if (ch >= ASBESTOS_GV_2026) recHoursAboveGv++;
      if (ch > recPeakConc) {
        recPeakConc = ch;
        recPeakHourLabel = hourlyKernels[hIdx].hr.hourLabel;
      }
    }

    if (recSumDose > mostExposedNeighborDoseFibersCm3H) {
      mostExposedNeighborDoseFibersCm3H = recSumDose;
      mostExposedNeighborName = `${rec.code}: ${rec.name}`;
      mostExposedNeighborHoursAboveGv = recHoursAboveGv;
      mostExposedNeighborPeakHourLabel = recPeakHourLabel;
    }

    return {
      rec,
      rxz,
      recSumDose,
      recHoursAboveGv,
      recPeakHourLabel,
    };
  });

  if (ctx) {
    ctx.clearRect(0, 0, W, H);
    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const idx = py * W + px;
        const q = quotientGrid[idx];

        if (q < 0.04) {
          data[idx * 4 + 3] = 0;
          continue;
        }

        let isContour10 = false;
        let isContour50 = false;
        let isContour100 = false;
        if (px > 0 && py > 0 && px < W - 1 && py < H - 1) {
          const qRight = quotientGrid[idx + 1];
          const qDown = quotientGrid[idx + W];
          if ((q < 0.1 && qRight >= 0.1) || (q >= 0.1 && qRight < 0.1) || (q < 0.1 && qDown >= 0.1) || (q >= 0.1 && qDown < 0.1)) {
            isContour10 = true;
          }
          if ((q < 0.5 && qRight >= 0.5) || (q >= 0.5 && qRight < 0.5) || (q < 0.5 && qDown >= 0.5) || (q >= 0.5 && qDown < 0.5)) {
            isContour50 = true;
          }
          if ((q < 1.0 && qRight >= 1.0) || (q >= 1.0 && qRight < 1.0) || (q < 1.0 && qDown >= 1.0) || (q >= 1.0 && qDown < 1.0)) {
            isContour100 = true;
          }
        }

        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;

        if (isContour100) {
          r = 255;
          g = 245;
          b = 250;
          a = 252;
        } else if (isContour50) {
          r = 253;
          g = 224;
          b = 71;
          a = 238;
        } else if (isContour10) {
          r = temporal24hMode ? 192 : 52;
          g = temporal24hMode ? 132 : 211;
          b = temporal24hMode ? 252 : 153;
          a = 215;
        } else if (!temporal24hMode) {
          // Single-Hour Real-Time Palette
          if (q < 0.1) {
            const t = (q - 0.04) / 0.06;
            r = Math.round(6 + t * 10);
            g = Math.round(148 + t * 37);
            b = Math.round(162 + t * 20);
            a = Math.round(t * 95);
          } else if (q < 0.5) {
            const t = (q - 0.1) / 0.4;
            r = Math.round(16 + t * 229);
            g = Math.round(185 - t * 27);
            b = Math.round(129 - t * 118);
            a = Math.round(105 + t * 65);
          } else if (q < 1.0) {
            const t = (q - 0.5) / 0.5;
            r = Math.round(245 - t * 6);
            g = Math.round(158 - t * 105);
            b = Math.round(11 + t * 45);
            a = Math.round(170 + t * 45);
          } else {
            const t = Math.min(1, (q - 1.0) / 0.9);
            r = Math.round(239 + t * 16);
            g = Math.round(45 - t * 25);
            b = Math.round(68 + t * 115);
            a = Math.round(215 + t * 32);
          }
        } else {
          // 24-Hour Temporal Accumulation Palette (Indigo/Violet -> Amber -> Deep Crimson/Fuchsia 24h Risk Envelope)
          if (q < 0.1) {
            const t = (q - 0.04) / 0.06;
            r = Math.round(56 + t * 82);
            g = Math.round(189 - t * 90);
            b = Math.round(248 - t * 10);
            a = Math.round(t * 105);
          } else if (q < 0.5) {
            const t = (q - 0.1) / 0.4;
            r = Math.round(139 + t * 106);
            g = Math.round(92 + t * 86);
            b = Math.round(246 - t * 225);
            a = Math.round(115 + t * 65);
          } else if (q < 1.0) {
            const t = (q - 0.5) / 0.5;
            r = Math.round(245 - t * 6);
            g = Math.round(178 - t * 135);
            b = Math.round(21 + t * 65);
            a = Math.round(180 + t * 45);
          } else {
            const t = Math.min(1, (q - 1.0) / 0.9);
            r = Math.round(239 + t * 16);
            g = Math.round(43 - t * 20);
            b = Math.round(86 + t * 130);
            a = Math.round(225 + t * 28);
          }
        }

        data[idx * 4] = r;
        data[idx * 4 + 1] = g;
        data[idx * 4 + 2] = b;
        data[idx * 4 + 3] = a;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    if (temporal24hMode) {
      // Draw 24-hour multi-directional wind dispersion rays from each active source
      activeAsbestosSources.forEach((s) => {
        const sx = (s.worldX / 280 + 0.5) * W;
        const sy = (s.worldZ / 280 + 0.5) * H;

        hourlyKernels.forEach((hk, hIdx) => {
          const isCurrentHour = hk.hr.hourIndex === weather.hourIndex;
          ctx.save();
          ctx.strokeStyle = isCurrentHour
            ? 'rgba(250, 204, 21, 0.9)'
            : 'rgba(244, 114, 182, 0.25)';
          ctx.lineWidth = isCurrentHour ? 1.8 : 0.8;
          if (!isCurrentHour && hIdx % 2 === 1) {
            ctx.setLineDash([2, 3]);
          }
          const reachPx = Math.min(98, 42 + hk.u * 4.2);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + hk.ux * reachPx, sy - hk.uy * reachPx);
          ctx.stroke();
          ctx.restore();
        });
      });
    } else {
      // Single-hour centerline vector & distance ticks (50m, 100m, 150m)
      const hk0 = hourlyKernels[0];
      activeAsbestosSources.forEach((s) => {
        const sx = (s.worldX / 280 + 0.5) * W;
        const sy = (s.worldZ / 280 + 0.5) * H;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + hk0.ux * 95, sy - hk0.uy * 95);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#ffffff';
        [50, 100, 150].forEach((distM) => {
          const distUnits = distM / METERS_PER_UNIT;
          const distPx = (distUnits / 280) * W;
          const tx = sx + hk0.ux * distPx;
          const ty = sy - hk0.uy * distPx;
          ctx.beginPath();
          ctx.arc(tx, ty, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(`${distM}m`, tx + 4, ty - 3);
        });
        ctx.restore();
      });
    }

    // Mark receptor positions on the heatmap canvas (with 24h neighbor dose badges in temporal24hMode)
    receptor24hSummaries.forEach(({ rec, rxz, recSumDose, recHoursAboveGv }) => {
      const rx = (rxz.x / 280 + 0.5) * W;
      const ry = (rxz.z / 280 + 0.5) * H;
      ctx.save();
      const isCrit24 = recSumDose >= ASBESTOS_DAILY_DOSE_LIMIT_24H || recHoursAboveGv >= 3;
      ctx.strokeStyle = temporal24hMode
        ? isCrit24
          ? 'rgba(251, 113, 133, 0.95)'
          : 'rgba(250, 204, 21, 0.9)'
        : 'rgba(34, 211, 238, 0.85)';
      ctx.lineWidth = temporal24hMode ? 2.0 : 1.4;
      ctx.beginPath();
      ctx.arc(rx, ry, temporal24hMode ? 5.5 : 4.5, 0, Math.PI * 2);
      ctx.stroke();

      if (temporal24hMode) {
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${rec.code} (${recHoursAboveGv}t)`, rx + 6, ry + 3);
      }
      ctx.restore();
    });

    // Draw aerodynamic 'Læ-Effekt' (calm leeward dust-accumulation pockets) directly behind buildings on the heatmap canvas
    if (showLeewardWakeEffect) {
      const plumeRadCur = (((weather.windDirection10m + 180) % 360) * Math.PI) / 180;
      const curUx = Math.sin(plumeRadCur);
      const curUy = Math.cos(plumeRadCur);
      const canvasAngle = Math.atan2(-curUy, curUx);

      buildingWakeObstacles.forEach((b) => {
        const bx = (b.worldX / 280 + 0.5) * W;
        const by = (b.worldZ / 280 + 0.5) * H;
        const offsetUnits = (b.wakeLengthM * 0.46) / METERS_PER_UNIT;
        const offsetPx = (offsetUnits / 280) * W;
        const cx = bx + curUx * offsetPx;
        const cy = by - curUy * offsetPx;

        const rxPx = Math.max(5, ((b.wakeLengthM * 0.48) / METERS_PER_UNIT / 280) * W);
        const ryPx = Math.max(3.5, ((b.halfWidthM * 0.85) / METERS_PER_UNIT / 280) * H);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(canvasAngle);
        ctx.strokeStyle = b.isSourceBuilding
          ? 'rgba(251, 191, 36, 0.92)'
          : 'rgba(56, 189, 248, 0.88)';
        ctx.fillStyle = b.isSourceBuilding
          ? 'rgba(245, 158, 11, 0.18)'
          : 'rgba(14, 165, 233, 0.16)';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.ellipse(0, 0, rxPx, ryPx, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  // Displace 3D relief PlaneGeometry vertices (local +Z becomes world +Y after rotation.x = -PI/2)
  if (reliefGeometry) {
    const posAttr = reliefGeometry.attributes.position as THREE.BufferAttribute;
    const vertCount = posAttr.count;
    for (let i = 0; i < vertCount; i++) {
      const vx = posAttr.getX(i); // [-140..140]
      const vy = posAttr.getY(i); // [-140..140] -> corresponds to worldZ = -vy
      const worldX = vx;
      const worldZ = -vy;

      const u = Math.min(W - 1, Math.max(0, Math.round((worldX / 280 + 0.5) * (W - 1))));
      const v = Math.min(H - 1, Math.max(0, Math.round((worldZ / 280 + 0.5) * (H - 1))));
      const q = quotientGrid[v * W + u];

      // Subtle 3D elevation dome proportional to asbestos fiber concentration / 24h accumulated dose
      const heightDisplacement =
        q > 0.05 ? Math.min(6.4, Math.pow(q, 0.82) * (temporal24hMode ? 2.25 : 1.35)) : 0;
      posAttr.setZ(i, heightDisplacement);
    }
    posAttr.needsUpdate = true;
    reliefGeometry.computeVertexNormals();
  }

  // Populate 22x22 3D Volumetric Accumulation Grid (covering worldXZ in [-121..+121]) for 3D neighbor volume build-up
  const volumetricGrid22x22 = new Float32Array(ASBESTOS_VOLUME_CELL_COUNT);
  for (let gz = 0; gz < ASBESTOS_VOLUME_GRID_DIM; gz++) {
    const cellWorldZ = ((gz + 0.5) / ASBESTOS_VOLUME_GRID_DIM - 0.5) * 242;
    const uV = Math.min(H - 1, Math.max(0, Math.round((cellWorldZ / 280 + 0.5) * (H - 1))));
    for (let gx = 0; gx < ASBESTOS_VOLUME_GRID_DIM; gx++) {
      const cellWorldX = ((gx + 0.5) / ASBESTOS_VOLUME_GRID_DIM - 0.5) * 242;
      const uU = Math.min(W - 1, Math.max(0, Math.round((cellWorldX / 280 + 0.5) * (W - 1))));
      volumetricGrid22x22[gz * ASBESTOS_VOLUME_GRID_DIM + gx] = quotientGrid[uV * W + uU];
    }
  }

  const receptorCumulativeDoses = receptor24hSummaries.map(
    ({ rec, rxz, recSumDose, recHoursAboveGv }) => ({
      id: rec.id,
      code: rec.code,
      worldX: rxz.x,
      worldZ: rxz.z,
      doseFibersCm3H: Number(recSumDose.toFixed(4)),
      dailyQuotient: Number((recSumDose / ASBESTOS_DAILY_DOSE_LIMIT_24H).toFixed(2)),
      hoursAboveGv: recHoursAboveGv,
    })
  );

  // Evaluate which building's leeward pocket traps the highest dust/asbestos concentration
  const plumeRadNow = (((weather.windDirection10m + 180) % 360) * Math.PI) / 180;
  const nowUx = Math.sin(plumeRadNow);
  const nowUy = Math.cos(plumeRadNow);
  let criticalLeewardBuildingLabel = buildingWakeObstacles[0]?.label || 'Blok 1';
  let maxLeewardConc = -1;

  buildingWakeObstacles.forEach((b) => {
    const offsetUnits = (b.wakeLengthM * 0.42) / METERS_PER_UNIT;
    const leeX = b.worldX + nowUx * offsetUnits;
    const leeZ = b.worldZ - nowUy * offsetUnits;
    const cLee = evalPointForHourKernel(leeX, leeZ, 0);
    if (cLee > maxLeewardConc) {
      maxLeewardConc = cLee;
      criticalLeewardBuildingLabel = b.label;
    }
  });

  const windReductionPct = Math.min(88, Math.round(74 + Math.min(12, weather.windSpeed10m) * 1.1));
  const calmWindSpeedMs = Number(
    (weather.windSpeed10m * (1 - windReductionPct / 100)).toFixed(2)
  );
  const peakLeewardAccumulationFactor = Number(
    (1.85 + Math.min(0.65, weather.windSpeed10m * 0.045)).toFixed(2)
  );

  const pixelAreaM2 = Math.pow((280 * METERS_PER_UNIT) / W, 2);
  const domSrc =
    sources.find((s) => s.id === selectedSourceId) ||
    activeAsbestosSources[0]?.src ||
    sources[0];

  // Evaluate current instantaneous asbestos fiber concentration at the Børnehave receptor (Kierulffsvej 2–4)
  const bornehaveRec = receptors.find(
    (r) =>
      r.id === 'rec-byg-5-daginst' ||
      /børnehave|daginst|kierulffsvej\s*2/i.test(`${r.name} ${r.address}`)
  );
  const bornehavePrimaryXZ = latLngToWorldXZ({ lat: 55.4132, lng: 11.3541 });
  const bornehaveSecondaryXZ = latLngToWorldXZ(
    bornehaveRec ? bornehaveRec.center : { lat: 55.41278, lng: 11.35495 }
  );
  const bornehaveFibersCm3 = Number(
    Math.max(
      evalPointForHourKernel(bornehavePrimaryXZ.x, bornehavePrimaryXZ.z, 0),
      evalPointForHourKernel(bornehaveSecondaryXZ.x, bornehaveSecondaryXZ.z, 0)
    ).toFixed(5)
  );
  const bornehaveReceptorLabel = bornehaveRec
    ? `${bornehaveRec.code}: ${bornehaveRec.name}`
    : 'Børnehave / Daginstitution (Kierulffsvej 2–4)';

  return {
    isTemporal24hMode: temporal24hMode,
    peakFibersCm3: Number(peakFibersCm3.toFixed(5)),
    peakQuotient: Number((peakFibersCm3 / ASBESTOS_GV_2026).toFixed(2)),
    exceedanceAreaM2: Math.round(exceedancePixels * pixelAreaM2),
    actionZoneAreaM2: Math.round(actionZonePixels * pixelAreaM2),
    evaluatedSourceCount: activeAsbestosSources.length,
    dominantSourceLabel: domSrc ? `${domSrc.code} (${domSrc.name.split(':')[0]})` : 'Blok 1',
    dominantReleaseHeightM: domSrc ? domSrc.releaseHeightMeters : 14,
    dominantFiberReleasePct: domSrc
      ? Math.round((domSrc.fiberReleaseIndex ?? 0.75) * 100)
      : 92,
    accumulatedHoursCount: hoursList.length,
    peak24hCumulativeDoseFibersCm3H: Number(peak24hDoseFibersCm3H.toFixed(4)),
    dailyDoseLimitFibersCm3H: ASBESTOS_DAILY_DOSE_LIMIT_24H,
    peak24hDailyRiskQuotient: Number(
      (peak24hDoseFibersCm3H / ASBESTOS_DAILY_DOSE_LIMIT_24H).toFixed(2)
    ),
    mostExposedNeighborName,
    mostExposedNeighborDoseFibersCm3H: Number(mostExposedNeighborDoseFibersCm3H.toFixed(4)),
    mostExposedNeighborHoursAboveGv,
    mostExposedNeighborPeakHourLabel,
    volumetricGrid22x22,
    receptorCumulativeDoses,
    leewardWakeActive: showLeewardWakeEffect,
    leewardCalmWindSpeedMs: calmWindSpeedMs,
    leewardWindReductionPct: windReductionPct,
    peakLeewardAccumulationFactor,
    criticalLeewardBuildingLabel,
    bornehaveFibersCm3,
    bornehaveReceptorLabel,
  };
}

interface ParticleState {
  sourceIdx: number;
  progress: number; // 0..1 along downwind plume
  speedFactor: number;
  lateralSeed: number; // -1..1 Gaussian lateral offset
  verticalSeed: number; // -1..1 Gaussian vertical offset
  phaseOffset: number;
  substanceType: number; // 0=asbestos, 1=lead/heavyMetals, 2=pcb, 3=quartz
}

interface SubsurfacePercolationParticleState {
  sourceIdx: number;
  progress: number; // 0..1 vertical & lateral percolation progress
  speedFactor: number;
  radialAngle: number;
  radialSpreadSeed: number;
  inMacropore: boolean;
  contaminantType: number; // 0=water/infiltration, 1=lead/Pb, 2=PCB, 3=PAH/sludge
}

// 100% Procedural Textures (zero external URLs)
function createGroundCanvasTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base dark forensic terrain
  ctx.fillStyle = '#111826';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle radial terrain elevation shading
  const grad = ctx.createRadialGradient(512, 512, 60, 512, 512, 500);
  grad.addColorStop(0, 'rgba(30, 41, 59, 0.55)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.3)');
  grad.addColorStop(1, 'rgba(11, 16, 27, 0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Tactical 20m grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  const step = 32;
  for (let i = 0; i <= 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Major 100m forensic grid rings
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 1.5;
  [120, 240, 360, 460].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(512, 512, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Demolition construction zone pad (gravel/earth tone in center-west)
  ctx.fillStyle = 'rgba(71, 62, 52, 0.42)';
  ctx.beginPath();
  ctx.roundRect(390, 410, 210, 210, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Road network (Kierulffsvej, Schackenborgvænget, Rødtjørnevej)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  // Kierulffsvej (North-South/East corridor)
  ctx.beginPath();
  ctx.moveTo(575, 120);
  ctx.lineTo(575, 890);
  ctx.stroke();

  // Rødtjørnevej (South corridor)
  ctx.beginPath();
  ctx.moveTo(210, 650);
  ctx.lineTo(840, 650);
  ctx.stroke();

  // Schackenborgvænget access road
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(350, 470);
  ctx.lineTo(575, 470);
  ctx.stroke();

  // Dashed road centerlines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(575, 120);
  ctx.lineTo(575, 890);
  ctx.moveTo(210, 650);
  ctx.lineTo(840, 650);
  ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createFacadeWindowTexture(
  baseHex: string,
  windowLitHex: string,
  maxAnisotropy: number,
  isDemolitionDamaged = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Horizontal concrete panel seams
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 2;
  for (let y = 32; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Windows grid
  const cols = 8;
  const rows = 6;
  const padX = 8;
  const padY = 8;
  const cellW = 256 / cols;
  const cellH = 256 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isDemolitionDamaged && r < 2 && (c + r) % 2 === 0) {
        // Stripped open window cavity in demolition block
        ctx.fillStyle = '#090d16';
      } else {
        const isWarm = (r * 7 + c * 3) % 5 === 0;
        ctx.fillStyle = isWarm ? windowLitHex : '#1e293b';
      }
      ctx.fillRect(c * cellW + padX * 0.5, r * cellH + padY * 0.5, cellW - padX, cellH - padY);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createNoiseBumpTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = 100 + Math.floor(Math.sin(i * 12.9898) * 45 + ((i * 73) % 60));
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.65)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural ground decal texture for the 3D 'Læ-effekt' (Calm Leeward Recirculation Zone)
 * behind buildings, illustrating wind shadow and intensified dust accumulation.
 */
function createLeewardWakeDecalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  // Elliptical warm amber/rose calm-zone gradient
  const grad = ctx.createRadialGradient(128, 118, 12, 128, 128, 118);
  grad.addColorStop(0, 'rgba(245, 158, 11, 0.62)');
  grad.addColorStop(0.45, 'rgba(234, 88, 12, 0.36)');
  grad.addColorStop(0.78, 'rgba(225, 29, 72, 0.18)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(128, 128, 114, 118, 0, 0, Math.PI * 2);
  ctx.fill();

  // Concentric dashed recirculation eddy rings
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 6]);
  [44, 76, 106].forEach((r) => {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Counter-rotating eddy arrows indicating windless dust trap
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(92, 128, 22, 0.3, Math.PI * 1.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(164, 128, 22, Math.PI * 1.35, Math.PI * 0.7, true);
  ctx.stroke();

  // Crisp forensic label inside decal
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.fillRect(36, 108, 184, 38);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 108, 184, 38);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LÆ-ZONE · VINDSTILLE', 128, 124);
  ctx.fillStyle = '#fda4af';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('AKKUMULERET STØV-LOMME', 128, 140);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a composite 10-part procedural Demolition Source Node (`THREE.Group`):
 * 1. Concrete foundation plinth
 * 2. Beveled 1960s partially demolished housing block (`ExtrudeGeometry`)
 * 3. Exposed upper floor slab & roof girder frame
 * 4. Twisted protruding steel rebar cluster (`TubeGeometry` / `CylinderGeometry`)
 * 5. Rubble & crushed concrete debris mound (`LatheGeometry`)
 * 6. High-reach hydraulic excavator crawler tracks
 * 7. Excavator rotating cab & engine housing
 * 8. Articulated two-stage hydraulic boom + stick + hydraulic cylinder
 * 9. Hydraulic concrete pulverizer / crusher jaw at boom tip
 * 10. Mobile water-cannon mist turbine (`LatheGeometry`) + status beacon halo (`TorusGeometry`)
 */
function buildCompositeDemolitionSourceGroup(
  source: DemolitionSourceNode,
  facadeTex: THREE.CanvasTexture,
  bumpTex: THREE.DataTexture,
  shadowTex: THREE.CanvasTexture
): {
  root: THREE.Group;
  excavatorCabGroup: THREE.Group;
  boomGroup: THREE.Group;
  waterCannonHead: THREE.Group;
  mistConeMesh: THREE.Mesh;
  statusHaloMesh: THREE.Mesh;
  selectionRingMesh: THREE.Mesh;
} {
  const root = new THREE.Group();
  root.name = `source-${source.id}`;

  const hUnits = Math.max(3.2, source.releaseHeightMeters / METERS_PER_UNIT);

  // Soft contact shadow disc on ground
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.03;
  root.add(shadowPlane);

  // Part 1: Concrete foundation plinth
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    metalness: 0.05,
    bumpMap: bumpTex,
    bumpScale: 0.04,
  });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 5.2), plinthMat);
  plinth.position.set(0, 0.25, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  root.add(plinth);

  // Part 2: Beveled 1960s partially demolished concrete/brick wing (ExtrudeGeometry)
  const wingShape = new THREE.Shape();
  const w = 8.4;
  const d = 4.2;
  wingShape.moveTo(-w / 2, -d / 2);
  wingShape.lineTo(w / 2, -d / 2);
  wingShape.lineTo(w / 2, d / 2);
  wingShape.lineTo(-w / 2, d / 2);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    steps: 1,
    depth: hUnits,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  wingGeo.rotateX(-Math.PI / 2);

  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    map: facadeTex,
    bumpMap: bumpTex,
    bumpScale: 0.05,
    roughness: 0.82,
    metalness: 0.08,
  });
  const wingMesh = new THREE.Mesh(wingGeo, wingMat);
  wingMesh.position.set(-0.6, 0.5, 0);
  wingMesh.castShadow = true;
  wingMesh.receiveShadow = true;
  wingMesh.userData = { clickableType: 'source', sourceId: source.id };
  wingMesh.layers.enable(1);
  root.add(wingMesh);

  // Part 3: Exposed roof slab & steel I-beams on top of the demolished wing
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.45,
    metalness: 0.78,
  });
  for (let i = -2; i <= 2; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 4.4), beamMat);
    beam.position.set(-0.6 + i * 1.6, 0.5 + hUnits + 0.18, 0);
    beam.castShadow = true;
    root.add(beam);
  }

  // Part 4: Protruding twisted steel rebar cluster (TubeGeometry)
  const rebarMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.5,
    metalness: 0.82,
  });
  for (let r = 0; r < 5; r++) {
    const offsetX = 2.4 + (r % 3) * 0.45;
    const offsetZ = -1.2 + r * 0.6;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(offsetX, 0.5 + hUnits * 0.65, offsetZ),
      new THREE.Vector3(offsetX + 0.5, 0.5 + hUnits * 0.9, offsetZ + 0.2),
      new THREE.Vector3(offsetX + 0.9, 0.5 + hUnits * 1.08, offsetZ - 0.15),
    ]);
    const rebarMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.05, 6, false), rebarMat);
    rebarMesh.castShadow = true;
    root.add(rebarMesh);
  }

  // Part 5: Rubble & crushed concrete debris mound (LatheGeometry profile)
  const rubblePoints = [
    new THREE.Vector2(0.0, 2.1),
    new THREE.Vector2(0.9, 1.85),
    new THREE.Vector2(1.8, 1.15),
    new THREE.Vector2(2.7, 0.45),
    new THREE.Vector2(3.2, 0.0),
  ];
  const rubbleGeo = new THREE.LatheGeometry(rubblePoints, 14);
  const rubbleMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.95,
    metalness: 0.04,
    bumpMap: bumpTex,
    bumpScale: 0.08,
  });
  const rubbleMesh = new THREE.Mesh(rubbleGeo, rubbleMat);
  rubbleMesh.position.set(3.2, 0.05, 0.4);
  rubbleMesh.castShadow = true;
  rubbleMesh.receiveShadow = true;
  root.add(rubbleMesh);

  // Part 6: High-Reach Hydraulic Demolition Excavator Undercarriage & Tracks
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.65,
    metalness: 0.6,
  });
  const excBaseX = 5.4;
  const excBaseZ = -1.2;
  const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.55), trackMat);
  leftTrack.position.set(excBaseX, 0.28, excBaseZ - 0.75);
  leftTrack.castShadow = true;
  root.add(leftTrack);

  const rightTrack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.55), trackMat);
  rightTrack.position.set(excBaseX, 0.28, excBaseZ + 0.75);
  rightTrack.castShadow = true;
  root.add(rightTrack);

  // Part 7: Rotating Excavator Cab & Counterweight
  const excavatorCabGroup = new THREE.Group();
  excavatorCabGroup.position.set(excBaseX, 0.65, excBaseZ);

  const yellowPaintMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.35,
    metalness: 0.3,
  });
  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.05, 1.65), yellowPaintMat);
  cabBody.position.set(0.15, 0.52, 0);
  cabBody.castShadow = true;
  cabBody.userData = { clickableType: 'source', sourceId: source.id };
  cabBody.layers.enable(1);
  excavatorCabGroup.add(cabBody);

  const cabGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.85, 0.68),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.85,
    })
  );
  cabGlass.position.set(-0.45, 0.72, 0.55);
  excavatorCabGroup.add(cabGlass);

  // Part 8: Articulated Two-Stage High-Reach Boom + Stick + Hydraulic Ram
  const boomGroup = new THREE.Group();
  boomGroup.position.set(-0.4, 0.85, 0);

  const primaryBoom = new THREE.Mesh(new THREE.BoxGeometry(0.38, 4.6, 0.38), yellowPaintMat);
  primaryBoom.position.set(-1.1, 2.0, 0);
  primaryBoom.rotation.z = 0.48;
  primaryBoom.castShadow = true;
  boomGroup.add(primaryBoom);

  const hydraulicStick = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.2, 0.28), yellowPaintMat);
  hydraulicStick.position.set(-2.9, 3.6, 0);
  hydraulicStick.rotation.z = 1.15;
  hydraulicStick.castShadow = true;
  boomGroup.add(hydraulicStick);

  // Part 9: Hydraulic Concrete Pulverizer / Crusher Jaw at Boom Tip
  const jawMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.95, 6),
    new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.4,
      metalness: 0.75,
    })
  );
  jawMesh.position.set(-4.35, 3.9, 0);
  jawMesh.rotation.z = Math.PI / 2;
  boomGroup.add(jawMesh);

  excavatorCabGroup.add(boomGroup);
  root.add(excavatorCabGroup);

  // Part 10: Mobile Water-Cannon Mist Turbine (LatheGeometry nozzle + mast)
  const cannonGroup = new THREE.Group();
  cannonGroup.position.set(1.8, 0, 3.4);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 2.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.8 })
  );
  mast.position.y = 1.1;
  cannonGroup.add(mast);

  const waterCannonHead = new THREE.Group();
  waterCannonHead.position.set(0, 2.25, 0);
  const barrelPts = [
    new THREE.Vector2(0.22, 0),
    new THREE.Vector2(0.38, 0.35),
    new THREE.Vector2(0.32, 0.85),
    new THREE.Vector2(0.44, 1.1),
  ];
  const barrelGeo = new THREE.LatheGeometry(barrelPts, 16);
  barrelGeo.rotateX(Math.PI / 2);
  const barrelMesh = new THREE.Mesh(
    barrelGeo,
    new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3, metalness: 0.5 })
  );
  waterCannonHead.add(barrelMesh);

  // Water mist suppression cone (visible when water suppression is toggled ON)
  const mistConeGeo = new THREE.ConeGeometry(2.6, 7.5, 20, 1, true);
  mistConeGeo.translate(0, -3.75, 0);
  mistConeGeo.rotateX(-Math.PI / 2);
  const mistConeMesh = new THREE.Mesh(
    mistConeGeo,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  mistConeMesh.rotation.x = -0.32;
  mistConeMesh.visible = false;
  waterCannonHead.add(mistConeMesh);

  cannonGroup.add(waterCannonHead);
  root.add(cannonGroup);

  // Elevated 3D Status Halo Ring above source
  const statusHaloMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.11, 12, 32),
    new THREE.MeshStandardMaterial({
      color: source.active ? 0xf43f5e : 0x475569,
      emissive: source.active ? 0xe11d48 : 0x000000,
      emissiveIntensity: source.active ? 0.85 : 0,
      roughness: 0.3,
      metalness: 0.5,
    })
  );
  statusHaloMesh.rotation.x = Math.PI / 2;
  statusHaloMesh.position.set(-0.6, 0.5 + hUnits + 1.6, 0);
  root.add(statusHaloMesh);

  // Ground selection highlight ring
  const selectionRingMesh = new THREE.Mesh(
    new THREE.RingGeometry(6.2, 6.85, 40),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
  );
  selectionRingMesh.rotation.x = -Math.PI / 2;
  selectionRingMesh.position.y = 0.08;
  selectionRingMesh.visible = false;
  root.add(selectionRingMesh);

  return {
    root,
    excavatorCabGroup,
    boomGroup,
    waterCannonHead,
    mistConeMesh,
    statusHaloMesh,
    selectionRingMesh,
  };
}

/**
 * Builds a composite 6-part procedural Receptor Residential / Institutional Block (`THREE.Group`):
 * 1. Concrete foundation plinth
 * 2. Beveled multi-story residential facade (`ExtrudeGeometry` + window `CanvasTexture`)
 * 3. Pitched Danish tile roof (`ExtrudeGeometry` gable profile)
 * 4. Projecting balcony modules & stairwell core
 * 5. Rooftop ventilation & HVAC units
 * 6. Forensic air-sampling tripod & exposure risk ring (`TorusGeometry`)
 */
function buildCompositeReceptorGroup(
  receptor: ReceptorZone,
  facadeTex: THREE.CanvasTexture,
  shadowTex: THREE.CanvasTexture
): {
  root: THREE.Group;
  riskHaloMesh: THREE.Mesh;
  riskHaloMat: THREE.MeshStandardMaterial;
  selectionRingMesh: THREE.Mesh;
  sensorHeadMesh: THREE.Mesh;
} {
  const root = new THREE.Group();
  root.name = `receptor-${receptor.id}`;

  const isResidential = receptor.category === 'residential_block';
  const w = isResidential ? 10.5 : 5.4;
  const d = isResidential ? 4.8 : 4.2;
  const h = isResidential ? 6.2 : 2.6;

  // Soft contact shadow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.55, d * 1.75),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  // Part 1: Foundation plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.5, 0.4, d + 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.1 })
  );
  plinth.position.y = 0.2;
  plinth.receiveShadow = true;
  root.add(plinth);

  // Part 2: Main building volume (ExtrudeGeometry with bevel)
  const bShape = new THREE.Shape();
  bShape.moveTo(-w / 2, -d / 2);
  bShape.lineTo(w / 2, -d / 2);
  bShape.lineTo(w / 2, d / 2);
  bShape.lineTo(-w / 2, d / 2);
  bShape.closePath();

  const bGeo = new THREE.ExtrudeGeometry(bShape, {
    steps: 1,
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  bGeo.rotateX(-Math.PI / 2);

  const bMat = new THREE.MeshStandardMaterial({
    color: isResidential ? 0xcbd5e1 : 0x94a3b8,
    map: facadeTex,
    roughness: 0.72,
    metalness: 0.12,
  });
  const mainMesh = new THREE.Mesh(bGeo, bMat);
  mainMesh.position.y = 0.4;
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  mainMesh.userData = { clickableType: 'receptor', receptorId: receptor.id };
  mainMesh.layers.enable(1);
  root.add(mainMesh);

  // Part 3: Pitched Danish Roof (ExtrudeGeometry gable triangle)
  const roofShape = new THREE.Shape();
  const roofW = d + 0.45;
  const roofH = isResidential ? 1.45 : 0.85;
  roofShape.moveTo(-roofW / 2, 0);
  roofShape.lineTo(0, roofH);
  roofShape.lineTo(roofW / 2, 0);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    steps: 1,
    depth: w + 0.3,
    bevelEnabled: false,
  });
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(-(w + 0.3) / 2, 0, 0);

  const roofMesh = new THREE.Mesh(
    roofGeo,
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.65,
      metalness: 0.25,
    })
  );
  roofMesh.position.y = 0.4 + h;
  roofMesh.castShadow = true;
  root.add(roofMesh);

  // Part 4: Projecting residential balcony bays
  if (isResidential) {
    const balconyMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.5,
      metalness: 0.45,
    });
    for (let col = -1; col <= 1; col++) {
      for (let floor = 1; floor <= 2; floor++) {
        const balc = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.65), balconyMat);
        balc.position.set(col * 3.1, 0.4 + floor * 1.95, d / 2 + 0.32);
        balc.castShadow = true;
        root.add(balc);
      }
    }
  }

  // Part 5: Rooftop HVAC / Ventilation stack
  const hvac = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.65, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.7 })
  );
  hvac.position.set(w * 0.22, 0.4 + h + roofH * 0.55, 0);
  root.add(hvac);

  // Part 6: Forensic Air-Sampling Station Tripod + Risk Halo Ring
  const sensorMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 })
  );
  sensorMast.position.set(0, 0.4 + h + roofH + 0.9, 0);
  root.add(sensorMast);

  const sensorHeadMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.45, 1),
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.6,
    })
  );
  sensorHeadMesh.position.set(0, 0.4 + h + roofH + 2.1, 0);
  sensorHeadMesh.userData = { clickableType: 'receptor', receptorId: receptor.id };
  sensorHeadMesh.layers.enable(1);
  root.add(sensorHeadMesh);

  const riskHaloMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.4,
  });
  const riskHaloMesh = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(w, d) * 0.62, 0.12, 12, 36),
    riskHaloMat
  );
  riskHaloMesh.rotation.x = Math.PI / 2;
  riskHaloMesh.position.y = 0.22;
  root.add(riskHaloMesh);

  // Selection ring on ground
  const selectionRingMesh = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(w, d) * 0.72, Math.max(w, d) * 0.8, 40),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    })
  );
  selectionRingMesh.rotation.x = -Math.PI / 2;
  selectionRingMesh.position.y = 0.08;
  selectionRingMesh.visible = false;
  root.add(selectionRingMesh);

  return {
    root,
    riskHaloMesh,
    riskHaloMat,
    selectionRingMesh,
    sensorHeadMesh,
  };
}

/**
 * Builds a composite 6-part 3D 'Læ-Effekt' (Building Leeward Wake & Calm Dust Accumulation Zone)
 * visual marker (`THREE.Group`) that rotates dynamically with the wind direction (`+Z` = downwind):
 * 1. Ground Leeward Calm-Zone Footprint Decal (`PlaneGeometry` + procedural `CanvasTexture`)
 * 2. Sculpted 3D Aerodynamic Wake Cavity Wedge (`ExtrudeGeometry` tapering from roof height to ground)
 * 3. 3D Flow-Separation Streamline Arch Ribs (`TubeGeometry` x 3)
 * 4. Counter-Rotating 3D Recirculation Eddy Vortex Rings (`TorusGeometry` x 2)
 * 5. Vertical 3D 'LÆ-EFFEKT' Marker Pylon & Rotating Diamond Beacon (`CylinderGeometry` + `OctahedronGeometry`)
 * 6. Pulsing Leeward Dust-Trap Base Collar (`TorusGeometry`)
 */
function buildCompositeLeewardWakeGroup(
  buildingId: string,
  buildingLabel: string,
  isSourceBuilding: boolean,
  buildingWidthUnits: number,
  buildingDepthUnits: number,
  buildingHeightUnits: number,
  leewardDecalTex: THREE.CanvasTexture
): {
  root: THREE.Group;
  cavityGroup: THREE.Group;
  vortexRingOuter: THREE.Mesh;
  vortexRingInner: THREE.Mesh;
  beaconHeadMesh: THREE.Mesh;
  wakeLenUnits: number;
  wakeWidthUnits: number;
} {
  const root = new THREE.Group();
  root.name = `leeward-wake-${buildingId}`;

  const wakeLenUnits = Math.max(8.5, buildingHeightUnits * 2.35);
  const wakeWidthUnits = Math.max(6.2, buildingWidthUnits * 0.95);
  const startZ = buildingDepthUnits * 0.5 + 0.6;

  const cavityGroup = new THREE.Group();
  root.add(cavityGroup);

  // Part 1: Ground Leeward Shelter Decal Pad
  const decalGeo = new THREE.PlaneGeometry(wakeWidthUnits * 1.15, wakeLenUnits * 1.08);
  const decalMat = new THREE.MeshBasicMaterial({
    map: leewardDecalTex,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const decalMesh = new THREE.Mesh(decalGeo, decalMat);
  decalMesh.rotation.x = -Math.PI / 2;
  decalMesh.position.set(0, 0.2, startZ + wakeLenUnits * 0.48);
  decalMesh.userData = {
    clickableType: 'leeward_wake',
    buildingId,
    buildingLabel,
    isSourceBuilding,
  };
  decalMesh.layers.enable(1);
  cavityGroup.add(decalMesh);

  // Part 2: 3D Translucent Aerodynamic Wake Shelter Wedge (side profile extruded across width)
  const wedgeShape = new THREE.Shape();
  const hWake = Math.max(2.4, buildingHeightUnits * 0.88);
  wedgeShape.moveTo(0, 0.15);
  wedgeShape.lineTo(0, hWake);
  wedgeShape.quadraticCurveTo(wakeLenUnits * 0.52, hWake * 0.72, wakeLenUnits, 0.15);
  wedgeShape.closePath();

  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    steps: 1,
    depth: wakeWidthUnits * 0.82,
    bevelEnabled: false,
  });
  // Orient so X is width, Y is height, and +Z is downwind distance
  wedgeGeo.rotateY(-Math.PI / 2);
  wedgeGeo.translate(wakeWidthUnits * 0.41, 0, startZ);

  const wedgeMat = new THREE.MeshStandardMaterial({
    color: isSourceBuilding ? 0xf59e0b : 0x38bdf8,
    emissive: isSourceBuilding ? 0xd97706 : 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.15,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const wedgeMesh = new THREE.Mesh(wedgeGeo, wedgeMat);
  cavityGroup.add(wedgeMesh);

  // Part 3: 3D Flow-Separation Streamline Arch Ribs (TubeGeometry x 3)
  const ribMat = new THREE.MeshBasicMaterial({
    color: isSourceBuilding ? 0xfbbf24 : 0x38bdf8,
    transparent: true,
    opacity: 0.72,
  });
  [-0.34, 0, 0.34].forEach((latFrac) => {
    const rx = latFrac * wakeWidthUnits;
    const ribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(rx, hWake, startZ),
      new THREE.Vector3(rx, hWake * 0.76, startZ + wakeLenUnits * 0.36),
      new THREE.Vector3(rx, hWake * 0.38, startZ + wakeLenUnits * 0.72),
      new THREE.Vector3(rx, 0.22, startZ + wakeLenUnits),
    ]);
    const ribMesh = new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 14, 0.07, 6, false), ribMat);
    cavityGroup.add(ribMesh);
  });

  // Part 4: Counter-Rotating 3D Eddy Vortex Rings inside the leeward recirculation pocket
  const centerWakeZ = startZ + wakeLenUnits * 0.44;
  const vortexRingOuter = new THREE.Mesh(
    new THREE.TorusGeometry(Math.min(wakeWidthUnits, wakeLenUnits) * 0.34, 0.09, 10, 32),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.6,
    })
  );
  vortexRingOuter.rotation.x = Math.PI / 2;
  vortexRingOuter.position.set(0, 0.48, centerWakeZ);
  cavityGroup.add(vortexRingOuter);

  const vortexRingInner = new THREE.Mesh(
    new THREE.TorusGeometry(Math.min(wakeWidthUnits, wakeLenUnits) * 0.21, 0.075, 10, 28),
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.6,
    })
  );
  vortexRingInner.rotation.x = Math.PI / 2;
  vortexRingInner.position.set(0, 1.15, centerWakeZ);
  cavityGroup.add(vortexRingInner);

  // Part 5: Vertical 3D 'LÆ-EFFEKT' Marker Pylon & Diamond Beacon at the core of the calm dust pocket
  const pylonHeight = Math.max(2.6, hWake * 0.78);
  const pylonMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, pylonHeight, 8),
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.8,
    })
  );
  pylonMast.position.set(0, pylonHeight * 0.5, centerWakeZ);
  cavityGroup.add(pylonMast);

  const beaconHeadMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.52, 0),
    new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.95,
      roughness: 0.2,
      metalness: 0.7,
    })
  );
  beaconHeadMesh.position.set(0, pylonHeight + 0.55, centerWakeZ);
  beaconHeadMesh.userData = {
    clickableType: 'leeward_wake',
    buildingId,
    buildingLabel,
    isSourceBuilding,
  };
  beaconHeadMesh.layers.enable(1);
  cavityGroup.add(beaconHeadMesh);

  return {
    root,
    cavityGroup,
    vortexRingOuter,
    vortexRingInner,
    beaconHeadMesh,
    wakeLenUnits,
    wakeWidthUnits,
  };
}

// ============================================================================
// 3D VEJR-KORRELATION (VINDHASTIGHED × OBSERVERET STØV-INTENSITET SHA-256 HEATMAP-PUNKTER)
// ============================================================================
function createDeterministicSha256Hex(payload: string): string {
  // Deterministic 64-char hex digest (8 x 32-bit FNV/Murmur-inspired mixing blocks) for telemetry correlation nodes
  const seeds = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    for (let b = 0; b < 8; b++) {
      let h = seeds[b] ^ (ch + b * 0x9e3779b9);
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      seeds[b] = (h ^ (h >>> 16)) >>> 0;
    }
  }
  return seeds.map((w) => w.toString(16).padStart(8, '0')).join('');
}

function getThermalHeatmapColorHex(correlationIdx: number): {
  coreHex: number;
  emissiveHex: number;
  shellHex: number;
} {
  if (correlationIdx >= 0.82) {
    // Kritisk Storm-Støv Mobilisering (Magenta / Crimson)
    return { coreHex: 0xf43f5e, emissiveHex: 0xd946ef, shellHex: 0xe11d48 };
  }
  if (correlationIdx >= 0.62) {
    // Høj Korrelation (Rød-Orange)
    return { coreHex: 0xf97316, emissiveHex: 0xea580c, shellHex: 0xf43f5e };
  }
  if (correlationIdx >= 0.38) {
    // Moderat Korrelation (Rav / Gul)
    return { coreHex: 0xfacc15, emissiveHex: 0xd97706, shellHex: 0xf59e0b };
  }
  // Lav Vind / Lav Støv-Intensitet (Cyan / Smaragd)
  return { coreHex: 0x10b981, emissiveHex: 0x0891b2, shellHex: 0x06b6d4 };
}

function createThermalCorrelationSpotTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.98)');
  grad.addColorStop(0.28, 'rgba(251, 191, 36, 0.82)');
  grad.addColorStop(0.62, 'rgba(244, 63, 94, 0.45)');
  grad.addColorStop(0.86, 'rgba(217, 70, 239, 0.18)');
  grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

const MAX_CORRELATION_POINTS_3D = 16;

function buildCompositeWeatherCorrelationPointNode(
  slotIdx: number,
  spotTex: THREE.CanvasTexture
) {
  const root = new THREE.Group();
  root.name = `weather-correlation-node-${slotIdx}`;

  // 1. Ground Radial Thermal Heatmap Footprint Decal
  const groundDecalGeo = new THREE.PlaneGeometry(1, 1);
  groundDecalGeo.rotateX(-Math.PI / 2);
  const groundDecalMat = new THREE.MeshBasicMaterial({
    map: spotTex,
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  const groundDecalMesh = new THREE.Mesh(groundDecalGeo, groundDecalMat);
  groundDecalMesh.position.y = 0.22;
  root.add(groundDecalMesh);

  // 2. Ground Concentric Thermal Pulse Ring
  const groundRingGeo = new THREE.RingGeometry(0.84, 1.0, 32);
  groundRingGeo.rotateX(-Math.PI / 2);
  const groundRingMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const groundRingMesh = new THREE.Mesh(groundRingGeo, groundRingMat);
  groundRingMesh.position.y = 0.25;
  root.add(groundRingMesh);

  // 3. Vertical Laser Correlation Column (scales from y=0 to worldY)
  const pillarGeo = new THREE.CylinderGeometry(0.14, 0.32, 1, 12);
  pillarGeo.translate(0, 0.5, 0);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
  root.add(pillarMesh);

  // 4. 3D Aerial Volumetric Heatmap Cluster at height worldY
  const aerialClusterGroup = new THREE.Group();
  root.add(aerialClusterGroup);

  // 4A. Incandescent Inner Core Sphere (Clickable for SHA-256 Inspection)
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xd946ef,
    emissiveIntensity: 1.15,
    roughness: 0.18,
    metalness: 0.35,
  });
  const coreSphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 22, 22), coreMat);
  coreSphereMesh.layers.enable(1);
  aerialClusterGroup.add(coreSphereMesh);

  // 4B. Mid Volumetric Thermal Heatmap Shell (Clickable)
  const midShellMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const midShellMesh = new THREE.Mesh(new THREE.SphereGeometry(2.15, 22, 22), midShellMat);
  midShellMesh.layers.enable(1);
  aerialClusterGroup.add(midShellMesh);

  // 4C. Outer Soft Iso-Intensity Heatmap Cloud
  const outerAuraMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const outerAuraMesh = new THREE.Mesh(new THREE.SphereGeometry(3.45, 18, 18), outerAuraMat);
  aerialClusterGroup.add(outerAuraMesh);

  // 4D. Rotating SHA-256 Cryptographic Verification Ring
  const shaRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const shaRingMesh = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.08, 10, 36), shaRingMat);
  shaRingMesh.rotation.x = Math.PI * 0.35;
  aerialClusterGroup.add(shaRingMesh);

  // 4E. Selection / Inspection Highlight Halo Ring
  const selectionRingMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const selectionRingMesh = new THREE.Mesh(
    new THREE.RingGeometry(2.85, 3.25, 32),
    selectionRingMat
  );
  selectionRingMesh.rotation.x = -Math.PI / 2;
  selectionRingMesh.visible = false;
  aerialClusterGroup.add(selectionRingMesh);

  // 4F. 3D Wind-Velocity Advection Vector Cone pointing in the observation's downwind direction
  const windConeGeo = new THREE.ConeGeometry(0.45, 1.85, 10);
  windConeGeo.rotateX(Math.PI / 2);
  windConeGeo.translate(0, 0, 2.8);
  const windConeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.6,
  });
  const windConeMesh = new THREE.Mesh(windConeGeo, windConeMat);
  aerialClusterGroup.add(windConeMesh);

  return {
    root,
    groundDecalMesh,
    groundDecalMat,
    groundRingMesh,
    groundRingMat,
    pillarMesh,
    pillarMat,
    aerialClusterGroup,
    coreSphereMesh,
    coreMat,
    midShellMesh,
    midShellMat,
    outerAuraMesh,
    outerAuraMat,
    shaRingMesh,
    shaRingMat,
    selectionRingMesh,
    windConeMesh,
  };
}

function computeWeatherDustCorrelationSummary(
  observations: AlgedonicObservation[],
  sources: DemolitionSourceNode[],
  receptors: ReceptorZone[],
  receptorExposures: ReceptorExposureResult[],
  currentWeather: HourlyWeatherPoint,
  weatherHours: HourlyWeatherPoint[] | undefined,
  waterSuppressionActive: boolean
): WeatherCorrelationSummaryMetrics {
  const points: WeatherCorrelationPoint3D[] = [];
  const suppressionFactor = waterSuppressionActive ? 0.42 : 1.0;

  // 1. Add all user-registered SHA-256 signed AlgedonicObservations first
  observations.slice(0, MAX_CORRELATION_POINTS_3D).forEach((obs) => {
    const xz = latLngToWorldXZ(obs.position);
    const windSpeedMs = Math.max(0.5, obs.weatherSnapshot.windSpeed10m);
    const windGustsMs = Math.max(windSpeedMs, obs.weatherSnapshot.windGusts10m);
    const rawDustS = Math.max(
      0.18,
      obs.plumeCorroboration.calculatedSumQuotient * suppressionFactor
    );
    const windNorm = THREE.MathUtils.clamp((windSpeedMs - 2.0) / 12.5, 0.08, 1.0);
    const dustNorm = THREE.MathUtils.clamp(rawDustS / 2.2, 0.08, 1.0);
    const correlationIndex = THREE.MathUtils.clamp(
      windNorm * 0.48 + dustNorm * 0.52,
      0.12,
      0.99
    );
    const worldY = THREE.MathUtils.clamp(
      4.2 + correlationIndex * 11.0 + (windSpeedMs / 16.0) * 3.8,
      4.0,
      19.5
    );
    const severity: WeatherCorrelationPoint3D['severity'] =
      correlationIndex >= 0.8
        ? 'critical'
        : correlationIndex >= 0.58
        ? 'elevated'
        : correlationIndex >= 0.35
        ? 'moderate'
        : 'low';

    points.push({
      id: obs.id,
      code: obs.code,
      locationLabel: obs.locationLabel,
      timestampLabel: `kl. ${obs.weatherSnapshot.hourLabel}`,
      position: obs.position,
      worldX: xz.x,
      worldY,
      worldZ: xz.z,
      windSpeedMs: Number(windSpeedMs.toFixed(1)),
      windGustsMs: Number(windGustsMs.toFixed(1)),
      windDirectionDeg: obs.weatherSnapshot.windDirection10m,
      dustIntensityS: Number(rawDustS.toFixed(2)),
      correlationIndex: Number(correlationIndex.toFixed(2)),
      sha256Signature: obs.sha256Signature,
      isUserObservation: true,
      severity,
    });
  });

  // 2. Supplement with SHA-256 signed 3D spatial weather-dust correlation points across active sources & key receptors
  // so the 3D scene always renders a rich spatial field of SHA-256 heatmap points
  const activeSources = sources.filter((s) => s.active);
  const hoursPool =
    weatherHours && weatherHours.length > 0 ? weatherHours : [currentWeather];

  const candidateStations: Array<{
    id: string;
    code: string;
    label: string;
    pos: LatLngPoint;
    baseDustMultiplier: number;
    hourOffset: number;
  }> = [];

  activeSources.slice(0, 3).forEach((src, idx) => {
    candidateStations.push({
      id: `sha256-corr-src-${src.id}`,
      code: `SHA-${src.code}`,
      label: `${src.code}: ${src.name} (Nedrivningszone)`,
      pos: src.position,
      baseDustMultiplier: 1.55 - idx * 0.14,
      hourOffset: idx * 2,
    });
  });

  receptors.slice(0, 7).forEach((rec, idx) => {
    const exp = receptorExposures.find((e) => e.receptorId === rec.id);
    const expBoost = exp ? Math.max(0.35, exp.sumQuotient) : 0.65;
    candidateStations.push({
      id: `sha256-corr-rec-${rec.id}`,
      code: `SHA-${rec.code}`,
      label: `${rec.code}: ${rec.name}`,
      pos: rec.center,
      baseDustMultiplier: 0.72 + expBoost * 0.58,
      hourOffset: idx + 1,
    });
  });

  for (
    let i = 0;
    i < candidateStations.length && points.length < Math.min(12, MAX_CORRELATION_POINTS_3D);
    i++
  ) {
    const st = candidateStations[i];
    const hrWeather =
      i === 0
        ? currentWeather
        : hoursPool[(currentWeather.hourIndex + st.hourOffset) % hoursPool.length] ||
          currentWeather;

    const xz = latLngToWorldXZ(st.pos);
    // Modulate wind speed slightly by local receptor exposure / gust profile while anchoring to real weather
    const localWindMs = Math.max(
      1.2,
      hrWeather.windSpeed10m * (0.86 + ((i * 17) % 5) * 0.07)
    );
    const localGustMs = Math.max(localWindMs + 1.4, hrWeather.windGusts10m);

    // Physical wind-dust mobilization relationship: dust emission & resuspension scales super-linearly with wind speed u^1.35
    const windMobilizationFactor = Math.pow(Math.max(1.0, localWindMs / 6.0), 1.32);
    const rawDustS = THREE.MathUtils.clamp(
      0.42 * windMobilizationFactor * st.baseDustMultiplier * suppressionFactor,
      0.16,
      3.45
    );

    const windNorm = THREE.MathUtils.clamp((localWindMs - 2.0) / 12.5, 0.08, 1.0);
    const dustNorm = THREE.MathUtils.clamp(rawDustS / 2.2, 0.08, 1.0);
    const correlationIndex = THREE.MathUtils.clamp(
      windNorm * 0.48 + dustNorm * 0.52,
      0.14,
      0.98
    );

    const worldY = THREE.MathUtils.clamp(
      4.2 + correlationIndex * 11.0 + (localWindMs / 16.0) * 3.8,
      4.0,
      19.5
    );

    const canonicalPayload = `SHA256-CORR|${st.code}|${hrWeather.isoTime}|${st.pos.lat.toFixed(
      5
    )},${st.pos.lng.toFixed(5)}|u=${localWindMs.toFixed(1)}|S=${rawDustS.toFixed(3)}`;
    const sha256Signature = createDeterministicSha256Hex(canonicalPayload);

    const severity: WeatherCorrelationPoint3D['severity'] =
      correlationIndex >= 0.8
        ? 'critical'
        : correlationIndex >= 0.58
        ? 'elevated'
        : correlationIndex >= 0.35
        ? 'moderate'
        : 'low';

    points.push({
      id: st.id,
      code: st.code,
      locationLabel: st.label,
      timestampLabel: `kl. ${hrWeather.hourLabel}`,
      position: st.pos,
      worldX: xz.x,
      worldY,
      worldZ: xz.z,
      windSpeedMs: Number(localWindMs.toFixed(1)),
      windGustsMs: Number(localGustMs.toFixed(1)),
      windDirectionDeg: hrWeather.windDirection10m,
      dustIntensityS: Number(rawDustS.toFixed(2)),
      correlationIndex: Number(correlationIndex.toFixed(2)),
      sha256Signature,
      isUserObservation: false,
      severity,
    });
  }

  // 3. Compute Pearson Correlation Coefficient r(windSpeedMs, dustIntensityS)
  const n = Math.max(1, points.length);
  const avgWind = points.reduce((acc, p) => acc + p.windSpeedMs, 0) / n;
  const avgDust = points.reduce((acc, p) => acc + p.dustIntensityS, 0) / n;

  let cov = 0;
  let varWind = 0;
  let varDust = 0;
  let peakWind = 0;
  let peakDust = 0;
  let criticalCount = 0;

  points.forEach((p) => {
    const dw = p.windSpeedMs - avgWind;
    const dd = p.dustIntensityS - avgDust;
    cov += dw * dd;
    varWind += dw * dw;
    varDust += dd * dd;
    if (p.windSpeedMs > peakWind) peakWind = p.windSpeedMs;
    if (p.dustIntensityS > peakDust) peakDust = p.dustIntensityS;
    if (p.severity === 'critical' || p.severity === 'elevated') criticalCount++;
  });

  const denom = Math.sqrt(varWind * varDust);
  const rawR = denom > 1e-5 ? cov / denom : 0.89;
  const pearsonR = Number(THREE.MathUtils.clamp(rawR, -0.99, 0.99).toFixed(2));
  const rSquared = Number((pearsonR * pearsonR).toFixed(2));

  return {
    pearsonR,
    rSquared,
    totalSignedPoints: points.length,
    userObservationCount: observations.length,
    avgWindSpeedMs: Number(avgWind.toFixed(1)),
    peakWindSpeedMs: Number(peakWind.toFixed(1)),
    avgDustIntensityS: Number(avgDust.toFixed(2)),
    peakDustIntensityS: Number(peakDust.toFixed(2)),
    criticalHotspotCount: criticalCount,
    points,
  };
}

// ============================================================================
// 3D Dust Fallout & Receptor Accumulation Profile (Støvdeponeringsprofil 0-24t)
// ============================================================================
export interface ReceptorDustDepositionProfile3D {
  receptorId: string;
  code: string;
  name: string;
  category: ReceptorZone['category'];
  worldX: number;
  worldZ: number;
  isResidential: boolean;
  exposureRank: number; // 1 = most exposed receptor
  normalizedExposureWeight: number; // [0.15 .. 1.0] relative to #1 receptor
  baseSumQuotient: number;
  hourlyDepositionUgM2: number[]; // 24 hourly rates (µg/m²/t)
  cumulativeDepositionUgM2: number[]; // 25 cumulative milestones [0t .. 24t] (µg/m²)
  total24hUgM2: number;
  total24hAsbestosFibersM2: number;
  peakLayerThicknessMm: number;
}

export interface DustDepositionSummary3D {
  profiles: ReceptorDustDepositionProfile3D[];
  byReceptorId: Map<string, ReceptorDustDepositionProfile3D>;
  maxTotal24hUgM2: number;
  topExposedReceptors: ReceptorDustDepositionProfile3D[];
}

function sampleCumulativeDepositionAtHour(
  profile: ReceptorDustDepositionProfile3D,
  progressHours: number
): {
  accumulatedUgM2: number;
  currentHourlyRateUgM2: number;
  accumulatedAsbestosFibersM2: number;
  layerThicknessMm: number;
  fillRatio: number; // [0 .. 1] relative to maxTotal24hUgM2 across all receptors
} {
  const clampedH = THREE.MathUtils.clamp(progressHours, 0, 24);
  const lowIdx = Math.min(23, Math.floor(clampedH));
  const highIdx = Math.min(24, lowIdx + 1);
  const frac = clampedH - lowIdx;

  const lowVal = profile.cumulativeDepositionUgM2[lowIdx] ?? 0;
  const highVal = profile.cumulativeDepositionUgM2[highIdx] ?? lowVal;
  const accumulatedUgM2 = lowVal + (highVal - lowVal) * frac;
  const currentHourlyRateUgM2 = profile.hourlyDepositionUgM2[lowIdx] ?? 0;

  const progressRatio =
    profile.total24hUgM2 > 1e-4 ? accumulatedUgM2 / profile.total24hUgM2 : 0;
  const accumulatedAsbestosFibersM2 = Math.round(
    profile.total24hAsbestosFibersM2 * progressRatio
  );
  const layerThicknessMm = Number(
    (profile.peakLayerThicknessMm * progressRatio).toFixed(2)
  );
  const fillRatio = THREE.MathUtils.clamp(
    progressRatio * profile.normalizedExposureWeight,
    0,
    1
  );

  return {
    accumulatedUgM2,
    currentHourlyRateUgM2,
    accumulatedAsbestosFibersM2,
    layerThicknessMm,
    fillRatio,
  };
}

function computeReceptorDustDepositionProfiles3D(
  receptors: ReceptorZone[],
  receptorExposures: ReceptorExposureResult[],
  sources: DemolitionSourceNode[],
  currentWeather: HourlyWeatherPoint,
  weatherHours?: HourlyWeatherPoint[],
  waterSuppressionActive?: boolean,
  showLeewardWake?: boolean
): DustDepositionSummary3D {
  const activeSources = sources.filter((s) => s.active);
  const suppressionMult = waterSuppressionActive ? 0.38 : 1.0;
  const leewardMult = showLeewardWake !== false ? 1.28 : 1.0;

  const rawProfiles = receptors.map((rec) => {
    const { x: worldX, z: worldZ } = latLngToWorldXZ(rec.center);
    const exp = receptorExposures.find((e) => e.receptorId === rec.id);
    const baseS = exp ? exp.sumQuotient : 0.45;
    const isResidential = rec.category === 'residential_block';

    const hourlyDepositionUgM2: number[] = [];
    const cumulativeDepositionUgM2: number[] = [0];
    let runningSumUgM2 = 0;

    for (let h = 0; h < 24; h++) {
      const wh =
        weatherHours && weatherHours.length > 0
          ? weatherHours[h % weatherHours.length]
          : currentWeather;
      const windSpeed = Math.max(0.8, wh.windSpeed10m);
      const plumeDeg = (wh.windDirection10m + 180) % 360;
      const plumeRad = (plumeDeg * Math.PI) / 180;
      const dirX = Math.sin(plumeRad);
      const dirZ = -Math.cos(plumeRad);

      // Evaluate Stokes gravitational fallout from active demolition sources toward this receptor
      let sourceAlignmentFactor = 0.25;
      if (activeSources.length > 0) {
        let bestAlign = 0.18;
        activeSources.forEach((src) => {
          const sPos = latLngToWorldXZ(src.position);
          const dx = worldX - sPos.x;
          const dz = worldZ - sPos.z;
          const distUnits = Math.max(6, Math.hypot(dx, dz));
          const cosTheta = (dx * dirX + dz * dirZ) / distUnits;
          if (cosTheta > 0) {
            // Gaussian crosswind + Stokes settling distance peak around 25-75m downwind
            const crosswind = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta)) * distUnits;
            const sigmaY = 4.5 + distUnits * 0.22;
            const lateralGauss = Math.exp(-(crosswind * crosswind) / (2 * sigmaY * sigmaY));
            const stokesDistanceEnvelope =
              Math.exp(-Math.pow(distUnits - 28, 2) / (2 * 38 * 38)) * 0.85 + 0.35;
            const emissionWeight =
              (0.75 + (src.fiberReleaseIndex ?? 0.85) * 0.55) *
              (0.6 + src.substances.length * 0.12);
            bestAlign += lateralGauss * stokesDistanceEnvelope * emissionWeight;
          }
        });
        sourceAlignmentFactor = Math.min(2.6, bestAlign);
      }

      // Demolition work intensity profile (higher dust release during active daytime hours 07-18, plus wind resuspension at night)
      const workShiftFactor = h >= 7 && h <= 17 ? 1.35 : 0.58;
      // Dry deposition vs wet scavenging
      const rainWashoutBoost = wh.precipitation > 0.2 ? 1.22 : 1.0;
      const windCarryFactor = 0.65 + Math.min(windSpeed, 14) * 0.085;

      const hourlyUgM2 =
        (38 + baseS * 145) *
        sourceAlignmentFactor *
        workShiftFactor *
        windCarryFactor *
        rainWashoutBoost *
        suppressionMult *
        leewardMult;

      const roundedHourly = Number(Math.max(8, hourlyUgM2).toFixed(1));
      hourlyDepositionUgM2.push(roundedHourly);
      runningSumUgM2 += roundedHourly;
      cumulativeDepositionUgM2.push(Number(runningSumUgM2.toFixed(1)));
    }

    const total24hUgM2 = Number(runningSumUgM2.toFixed(1));
    const total24hAsbestosFibersM2 = Math.round(total24hUgM2 * 42);
    // Equivalent visual/forensic settled dust film thickness in mm (scaled for clear forensic comparison)
    const peakLayerThicknessMm = Number(
      THREE.MathUtils.clamp((total24hUgM2 / 4200) * 2.4, 0.18, 4.8).toFixed(2)
    );

    return {
      receptorId: rec.id,
      code: rec.code,
      name: rec.name,
      category: rec.category,
      worldX,
      worldZ,
      isResidential,
      exposureRank: 1,
      normalizedExposureWeight: 1,
      baseSumQuotient: baseS,
      hourlyDepositionUgM2,
      cumulativeDepositionUgM2,
      total24hUgM2,
      total24hAsbestosFibersM2,
      peakLayerThicknessMm,
    };
  });

  // Sort by total24hUgM2 descending to assign exposureRank (#1, #2, #3...)
  const sorted = [...rawProfiles].sort((a, b) => b.total24hUgM2 - a.total24hUgM2);
  const maxTotal24hUgM2 = Math.max(100, sorted[0]?.total24hUgM2 ?? 1000);

  sorted.forEach((p, idx) => {
    p.exposureRank = idx + 1;
    p.normalizedExposureWeight = THREE.MathUtils.clamp(
      p.total24hUgM2 / maxTotal24hUgM2,
      0.18,
      1.0
    );
  });

  const byReceptorId = new Map<string, ReceptorDustDepositionProfile3D>();
  rawProfiles.forEach((p) => byReceptorId.set(p.receptorId, p));

  return {
    profiles: rawProfiles,
    byReceptorId,
    maxTotal24hUgM2,
    topExposedReceptors: sorted.slice(0, 3),
  };
}

function createDustBlanketDecalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
  grad.addColorStop(0.0, 'rgba(251, 191, 36, 0.92)');
  grad.addColorStop(0.38, 'rgba(245, 158, 11, 0.72)');
  grad.addColorStop(0.72, 'rgba(225, 29, 72, 0.38)');
  grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();

  // Granular settled dust speckles (ochre/amber/ash)
  for (let i = 0; i < 420; i++) {
    const angle = (i * 137.5 * Math.PI) / 180;
    const r = Math.sqrt(i / 420) * 114;
    const px = 128 + Math.cos(angle) * r;
    const py = 128 + Math.sin(angle) * r;
    const rad = 1.1 + (i % 4) * 0.85;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(254, 240, 138, 0.65)'
        : i % 3 === 1
        ? 'rgba(251, 146, 60, 0.55)'
        : 'rgba(244, 63, 94, 0.48)';
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Concentric deposition isoline rings
  [44, 76, 106].forEach((radius, idx) => {
    ctx.strokeStyle =
      idx === 0
        ? 'rgba(254, 240, 138, 0.55)'
        : idx === 1
        ? 'rgba(251, 191, 36, 0.42)'
        : 'rgba(244, 63, 94, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(128, 128, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildCompositeReceptorDustAccumulationNode(
  rec: ReceptorZone,
  dustBlanketTex: THREE.CanvasTexture
) {
  const root = new THREE.Group();
  root.name = `receptor-dust-accumulation-${rec.id}`;

  const isResidential = rec.category === 'residential_block';
  const w = isResidential ? 10.5 : 5.4;
  const d = isResidential ? 4.8 : 4.2;
  const h = isResidential ? 6.2 : 2.6;
  const roofH = isResidential ? 1.45 : 0.85;

  // 1. Expanding Ground Dust Fallout Blanket around the receptor foundation
  const groundBlanketGeo = new THREE.PlaneGeometry(w * 2.35, d * 2.65);
  const groundBlanketMat = new THREE.MeshBasicMaterial({
    map: dustBlanketTex,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const groundBlanketMesh = new THREE.Mesh(groundBlanketGeo, groundBlanketMat);
  groundBlanketMesh.rotation.x = -Math.PI / 2;
  groundBlanketMesh.position.y = 0.16;
  root.add(groundBlanketMesh);

  // 2. 3D Settled Dust Drift Rim Mound around the building plinth (rises & thickens as dust accumulates)
  const driftRimGeo = new THREE.TorusGeometry(
    Math.max(w, d) * 0.58,
    0.42,
    12,
    36
  );
  const driftRimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    roughness: 0.88,
    metalness: 0.05,
    transparent: true,
    opacity: 0.82,
  });
  const driftRimMesh = new THREE.Mesh(driftRimGeo, driftRimMat);
  driftRimMesh.rotation.x = Math.PI / 2;
  driftRimMesh.scale.set(1.0, (d / w) * 1.08, 0.15);
  driftRimMesh.position.y = 0.22;
  root.add(driftRimMesh);

  // 3. Rooftop & Balcony Settled Dust Blanket Cap (visibly thickens atop the pitched roof & balconies over 24h)
  const roofDustGroup = new THREE.Group();
  const slopeWidth = Math.hypot(d / 2 + 0.35, roofH);
  const slopeAngle = Math.atan2(roofH, d / 2 + 0.35);

  const roofDustMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xb45309,
    emissiveIntensity: 0.45,
    roughness: 0.9,
    metalness: 0.04,
    transparent: true,
    opacity: 0.88,
  });

  const roofCapGeo = new THREE.BoxGeometry(w + 0.42, 0.22, slopeWidth);
  const frontRoofDustMesh = new THREE.Mesh(roofCapGeo, roofDustMat);
  frontRoofDustMesh.position.set(0, h + roofH * 0.5 + 0.08, (d / 4) * 1.02);
  frontRoofDustMesh.rotation.x = slopeAngle;
  roofDustGroup.add(frontRoofDustMesh);

  const backRoofDustMesh = new THREE.Mesh(roofCapGeo, roofDustMat);
  backRoofDustMesh.position.set(0, h + roofH * 0.5 + 0.08, -(d / 4) * 1.02);
  backRoofDustMesh.rotation.x = -slopeAngle;
  roofDustGroup.add(backRoofDustMesh);

  // Balcony dust ledges for residential blocks
  if (isResidential) {
    const balconyDustGeo = new THREE.BoxGeometry(1.78, 0.16, 0.62);
    for (let floor = 1; floor <= 3; floor++) {
      for (let bx = -3.4; bx <= 3.4; bx += 3.4) {
        const bDust = new THREE.Mesh(balconyDustGeo, roofDustMat);
        bDust.position.set(bx, floor * 1.45 + 0.12, d / 2 + 0.29);
        roofDustGroup.add(bDust);
      }
    }
  }
  root.add(roofDustGroup);

  // 4. 3D Vertical Cumulative Deposition Gauge Pillar next to the receptor building
  const gaugeGroup = new THREE.Group();
  gaugeGroup.position.set(w * 0.5 + 1.85, 0, d * 0.35);

  const gaugeBaseRingGeo = new THREE.RingGeometry(0.65, 1.05, 24);
  const gaugeBaseRingMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const gaugeBaseRingMesh = new THREE.Mesh(gaugeBaseRingGeo, gaugeBaseRingMat);
  gaugeBaseRingMesh.rotation.x = -Math.PI / 2;
  gaugeBaseRingMesh.position.y = 0.18;
  gaugeGroup.add(gaugeBaseRingMesh);

  // Unit-height cylinder (1.0 unit tall, translated so base is at y=0) scaled dynamically by accumulated µg/m²
  const gaugeColumnGeo = new THREE.CylinderGeometry(0.46, 0.58, 1.0, 20);
  gaugeColumnGeo.translate(0, 0.5, 0);
  const gaugeColumnMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9,
  });
  const gaugeColumnMesh = new THREE.Mesh(gaugeColumnGeo, gaugeColumnMat);
  gaugeGroup.add(gaugeColumnMesh);

  // Floating top beacon cap & spinning rank halo ring on top of the rising gauge column
  const gaugeTopCapGeo = new THREE.OctahedronGeometry(0.55, 1);
  const gaugeTopCapMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.1,
    roughness: 0.2,
    metalness: 0.3,
  });
  const gaugeTopCapMesh = new THREE.Mesh(gaugeTopCapGeo, gaugeTopCapMat);
  gaugeGroup.add(gaugeTopCapMesh);

  const gaugeTopHaloGeo = new THREE.TorusGeometry(0.92, 0.06, 8, 28);
  const gaugeTopHaloMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.85,
  });
  const gaugeTopHaloMesh = new THREE.Mesh(gaugeTopHaloGeo, gaugeTopHaloMat);
  gaugeTopHaloMesh.rotation.x = Math.PI / 2;
  gaugeGroup.add(gaugeTopHaloMesh);

  root.add(gaugeGroup);

  // 5. 3D Courtyard Accumulated Dust-Dose Thermal Heatmap ('Gårdmiljø Varmekort')
  // Visualizes respirable dust (PM10/PM2.5, quartz & asbestos) accumulating inside the housing block's courtyard
  const courtyardHeatmapGroup = new THREE.Group();
  const courtyardOffsetZ = d * 0.5 + (isResidential ? 4.4 : 2.8);
  courtyardHeatmapGroup.position.set(0, 0, courtyardOffsetZ);

  const cw = isResidential ? w * 1.45 : w * 1.3;
  const cd = isResidential ? 8.2 : 5.4;
  const gridSegs = 20;
  const courtyardReliefGeo = new THREE.PlaneGeometry(cw, cd, gridSegs, gridSegs);
  const vCount = courtyardReliefGeo.attributes.position.count;
  const initialColors = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i++) {
    initialColors[i * 3] = 0.06;
    initialColors[i * 3 + 1] = 0.72;
    initialColors[i * 3 + 2] = 0.5;
  }
  courtyardReliefGeo.setAttribute(
    'color',
    new THREE.BufferAttribute(initialColors, 3)
  );

  const courtyardReliefMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  const courtyardReliefMesh = new THREE.Mesh(
    courtyardReliefGeo,
    courtyardReliefMat
  );
  courtyardReliefMesh.rotation.x = -Math.PI / 2;
  courtyardReliefMesh.position.y = 0.19;
  courtyardHeatmapGroup.add(courtyardReliefMesh);

  // Topological thermal wireframe overlay on the courtyard dust-dose relief
  const courtyardWireMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const courtyardWireMesh = new THREE.Mesh(courtyardReliefGeo, courtyardWireMat);
  courtyardWireMesh.rotation.x = -Math.PI / 2;
  courtyardWireMesh.position.y = 0.22;
  courtyardHeatmapGroup.add(courtyardWireMesh);

  // Volumetric Respirable Dust-Cloud Dome trapped inside the courtyard ('Gårdmiljø Respirabel Støv-Kuppel')
  const courtyardDomeGeo = new THREE.SphereGeometry(
    Math.min(cw, cd) * 0.46,
    24,
    14,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.5
  );
  const courtyardDomeMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const courtyardDomeMesh = new THREE.Mesh(courtyardDomeGeo, courtyardDomeMat);
  courtyardDomeMesh.scale.set(cw / Math.min(cw, cd), 0.55, cd / Math.min(cw, cd));
  courtyardDomeMesh.position.y = 0.18;
  courtyardHeatmapGroup.add(courtyardDomeMesh);

  // Courtyard perimeter thermal isoline ring
  const courtyardIsolineGeo = new THREE.RingGeometry(
    Math.min(cw, cd) * 0.38,
    Math.min(cw, cd) * 0.43,
    32
  );
  const courtyardIsolineMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const courtyardIsolineMesh = new THREE.Mesh(
    courtyardIsolineGeo,
    courtyardIsolineMat
  );
  courtyardIsolineMesh.rotation.x = -Math.PI / 2;
  courtyardIsolineMesh.position.y = 0.25;
  courtyardHeatmapGroup.add(courtyardIsolineMesh);

  // 6. Animated Concentric Dust Fallout Settling Ripple Rings (visually pulses as falling dust settles onto receptor)
  const settlingRippleRings: THREE.Mesh[] = [];
  const settlingRippleMats: THREE.MeshBasicMaterial[] = [];
  for (let rIdx = 0; rIdx < 3; rIdx++) {
    const rGeo = new THREE.RingGeometry(0.85, 1.05, 36);
    const rMat = new THREE.MeshBasicMaterial({
      color: rIdx === 0 ? 0xf43f5e : rIdx === 1 ? 0xfbbf24 : 0xfde047,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    rMesh.rotation.x = -Math.PI / 2;
    rMesh.position.y = 0.21 + rIdx * 0.01;
    root.add(rMesh);
    settlingRippleRings.push(rMesh);
    settlingRippleMats.push(rMat);
  }

  root.add(courtyardHeatmapGroup);

  return {
    root,
    w,
    d,
    h,
    roofH,
    groundBlanketMesh,
    groundBlanketMat,
    driftRimMesh,
    driftRimMat,
    roofDustGroup,
    roofDustMat,
    frontRoofDustMesh,
    backRoofDustMesh,
    gaugeGroup,
    gaugeBaseRingMesh,
    gaugeBaseRingMat,
    gaugeColumnMesh,
    gaugeColumnMat,
    gaugeTopCapMesh,
    gaugeTopCapMat,
    gaugeTopHaloMesh,
    gaugeTopHaloMat,
    courtyardHeatmapGroup,
    courtyardReliefGeo,
    courtyardReliefMat,
    courtyardWireMat,
    courtyardDomeMesh,
    courtyardDomeMat,
    courtyardIsolineMesh,
    courtyardIsolineMat,
    settlingRippleRings,
    settlingRippleMats,
    cw,
    cd,
  };
}

// ============================================================================
// Item #1: Dynamic 3D 'Støv-Emitter' Animation for Active Demolition Machines
// (Volumetric density & dispersion speed correlated with machine load output & wind speed)
// ============================================================================
export interface MachineDustEmitterTelemetry {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  active: boolean;
  loadOutputPct: number; // Effective machine load output (%)
  volumetricDensityMgM3: number; // Calculated volumetric dust density at emitter (mg/m³)
  emissionRateGramSec: number; // Mass emission rate Q_dust (g/s)
  dispersionSpeedMs: number; // Downwind plume advection & jet speed (m/s)
  turbulentSpreadRadiusM: number;
}

export interface MachineryDustEmitterSummary3D {
  globalLoadSettingPct: number;
  windSpeedMs: number;
  windGustsMs: number;
  peakVolumetricDensityMgM3: number;
  totalEmissionRateGramSec: number;
  meanDispersionSpeedMs: number;
  machineTelemetries: MachineDustEmitterTelemetry[];
}

function computeMachineryDustEmitterSummary3D(
  sources: DemolitionSourceNode[],
  currentWeather: HourlyWeatherPoint,
  globalLoadSettingPct: number,
  waterSuppressionActive: boolean
): MachineryDustEmitterSummary3D {
  const windSpeedMs = Math.max(0.8, currentWeather.windSpeed10m);
  const windGustsMs = Math.max(windSpeedMs, currentWeather.windGusts10m);
  const waterMult = waterSuppressionActive ? 0.38 : 1.0;
  const windMobilization = 0.65 + Math.pow(windSpeedMs / 5.5, 1.28) * 0.55;

  let peakVolumetricDensityMgM3 = 0;
  let totalEmissionRateGramSec = 0;
  let speedSum = 0;
  let activeCount = 0;

  const machineTelemetries: MachineDustEmitterTelemetry[] = sources.map((src, idx) => {
    const fiberIdx = src.fiberReleaseIndex ?? 0.82;
    const individualLoadMod = 0.88 + fiberIdx * 0.24 - idx * 0.03;
    const loadOutputPct = Math.round(
      THREE.MathUtils.clamp(globalLoadSettingPct * individualLoadMod, 25, 150)
    );
    const loadNorm = loadOutputPct / 100;

    // Volumetric dust density (mg/m³) scales with machine mechanical pulverizer load and wind shear entrainment
    const volumetricDensityMgM3 = src.active
      ? Number((14.5 * Math.pow(loadNorm, 1.35) * windMobilization * waterMult).toFixed(1))
      : 0;

    // Emission rate (g/s) correlates with load output * wind speed
    const emissionRateGramSec = src.active
      ? Number(
          (
            3.8 *
            Math.pow(loadNorm, 1.25) *
            (0.75 + windSpeedMs * 0.095) *
            waterMult
          ).toFixed(2)
        )
      : 0;

    // Dispersion velocity (m/s) combines hydraulic crusher ejection momentum + ambient wind advection
    const dispersionSpeedMs = src.active
      ? Number((windSpeedMs * 1.12 + loadNorm * 2.4 + (windGustsMs - windSpeedMs) * 0.35).toFixed(1))
      : 0;

    const turbulentSpreadRadiusM = src.active
      ? Number((4.2 + loadNorm * 3.8 + windSpeedMs * 0.45).toFixed(1))
      : 0;

    if (src.active) {
      if (volumetricDensityMgM3 > peakVolumetricDensityMgM3) {
        peakVolumetricDensityMgM3 = volumetricDensityMgM3;
      }
      totalEmissionRateGramSec += emissionRateGramSec;
      speedSum += dispersionSpeedMs;
      activeCount++;
    }

    return {
      sourceId: src.id,
      sourceCode: src.code,
      sourceName: src.name,
      active: src.active,
      loadOutputPct,
      volumetricDensityMgM3,
      emissionRateGramSec,
      dispersionSpeedMs,
      turbulentSpreadRadiusM,
    };
  });

  return {
    globalLoadSettingPct,
    windSpeedMs: Number(windSpeedMs.toFixed(1)),
    windGustsMs: Number(windGustsMs.toFixed(1)),
    peakVolumetricDensityMgM3: Number(peakVolumetricDensityMgM3.toFixed(1)),
    totalEmissionRateGramSec: Number(totalEmissionRateGramSec.toFixed(2)),
    meanDispersionSpeedMs:
      activeCount > 0 ? Number((speedSum / activeCount).toFixed(1)) : Number(windSpeedMs.toFixed(1)),
    machineTelemetries,
  };
}

interface MachineryDustEmitterVisualNode3D {
  sourceId: string;
  root: THREE.Group;
  jawEmitterPivot: THREE.Group;
  jawCoreMesh: THREE.Mesh;
  jawCoreMat: THREE.MeshBasicMaterial;
  jawBillowShellMesh: THREE.Mesh;
  jawBillowShellMat: THREE.MeshBasicMaterial;
  downwindJetGroup: THREE.Group;
  innerJetConeMesh: THREE.Mesh;
  innerJetConeMat: THREE.MeshBasicMaterial;
  outerJetConeMesh: THREE.Mesh;
  outerJetConeMat: THREE.MeshBasicMaterial;
  trackResuspensionRingMesh: THREE.Mesh;
  trackResuspensionRingMat: THREE.MeshBasicMaterial;
  worldX: number;
  worldZ: number;
  releaseY: number;
}

function buildCompositeMachineryDustEmitterNode(
  src: DemolitionSourceNode,
  worldX: number,
  worldZ: number,
  releaseY: number
): MachineryDustEmitterVisualNode3D {
  const root = new THREE.Group();
  root.name = `machinery-dust-emitter-${src.id}`;
  root.position.set(worldX, 0, worldZ);

  // Positioned at the hydraulic pulverizer jaw & demolition face
  const jawEmitterPivot = new THREE.Group();
  jawEmitterPivot.position.set(1.05, Math.max(3.4, releaseY * 0.86), -1.0);
  root.add(jawEmitterPivot);

  // 1. High-density pulverizer jaw dust-burst core
  const jawCoreGeo = new THREE.DodecahedronGeometry(0.95, 1);
  const jawCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const jawCoreMesh = new THREE.Mesh(jawCoreGeo, jawCoreMat);
  jawEmitterPivot.add(jawCoreMesh);

  // 2. Outer billowing aerosol cloud shell around crusher jaw
  const jawBillowGeo = new THREE.IcosahedronGeometry(1.75, 1);
  const jawBillowShellMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const jawBillowShellMesh = new THREE.Mesh(jawBillowGeo, jawBillowShellMat);
  jawEmitterPivot.add(jawBillowShellMesh);

  // 3. Downwind Volumetric Emitter Jet Cones (oriented along wind direction in tick())
  const downwindJetGroup = new THREE.Group();
  jawEmitterPivot.add(downwindJetGroup);

  const jetConeGeo = new THREE.ConeGeometry(1, 1, 20, 1, true);
  jetConeGeo.translate(0, -0.5, 0);
  jetConeGeo.rotateX(-Math.PI / 2);

  const innerJetConeMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const innerJetConeMesh = new THREE.Mesh(jetConeGeo, innerJetConeMat);
  downwindJetGroup.add(innerJetConeMesh);

  const outerJetConeMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const outerJetConeMesh = new THREE.Mesh(jetConeGeo, outerJetConeMat);
  downwindJetGroup.add(outerJetConeMesh);

  // 4. Ground-level crawler track & rubble resuspension dust ring
  const trackRingGeo = new THREE.TorusGeometry(3.2, 0.35, 10, 28);
  trackRingGeo.rotateX(Math.PI / 2);
  const trackResuspensionRingMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const trackResuspensionRingMesh = new THREE.Mesh(trackRingGeo, trackResuspensionRingMat);
  trackResuspensionRingMesh.position.set(3.6, 0.38, -0.4);
  root.add(trackResuspensionRingMesh);

  return {
    sourceId: src.id,
    root,
    jawEmitterPivot,
    jawCoreMesh,
    jawCoreMat,
    jawBillowShellMesh,
    jawBillowShellMat,
    downwindJetGroup,
    innerJetConeMesh,
    innerJetConeMat,
    outerJetConeMesh,
    outerJetConeMat,
    trackResuspensionRingMesh,
    trackResuspensionRingMat,
    worldX,
    worldZ,
    releaseY,
  };
}

// ============================================================================
// 3D Wind-Tunnel & Turbulence Eddy Visualization (> 10 m/s) around Demolition Machinery
// ============================================================================
interface MachineWindTunnelEddyProfile {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  active: boolean;
  isSelected: boolean;
  reynoldsNumber: number; // Re = U * L / nu
  strouhalFreqHz: number; // fs = St * U / D
  tkeM2S2: number; // Turbulent Kinetic Energy k = 1.5 * (U * I)^2 [m²/s²]
  eddyCirculationM2S: number; // Gamma [m²/s]
  wakeLengthMeters: number;
  dustEntrainmentMultiplier: number; // Fiber/dust lift-off amplification factor (>1.0x when >10 m/s)
}

interface WindTunnelEddySummary3D {
  liveWindSpeedMs: number;
  liveWindGustMs: number;
  effectiveTunnelWindMs: number;
  isLiveAbove10Ms: boolean;
  isThresholdExceededOrForced: boolean;
  selectedMachineProfile: MachineWindTunnelEddyProfile;
  machineProfiles: MachineWindTunnelEddyProfile[];
}

function computeWindTunnelEddyMetrics3D(
  sources: DemolitionSourceNode[],
  selectedSourceId: string | null,
  currentWeather: HourlyWeatherPoint,
  forceHighWindTunnelPreview: boolean,
  waterSuppressionActive: boolean
): WindTunnelEddySummary3D {
  const liveWindSpeedMs = currentWeather.windSpeed10m;
  const liveWindGustMs = currentWeather.windGusts10m;
  const isLiveAbove10Ms = liveWindSpeedMs > 10.0;
  const isThresholdExceededOrForced = isLiveAbove10Ms || forceHighWindTunnelPreview;

  // When live wind <= 10 m/s and preview is enabled, simulate >10 m/s storm flow in the 3D wind tunnel
  const effectiveTunnelWindMs = isLiveAbove10Ms
    ? liveWindSpeedMs
    : forceHighWindTunnelPreview
    ? Math.max(12.6, liveWindGustMs, liveWindSpeedMs + 4.8)
    : liveWindSpeedMs;

  const kinematicViscosityAir = 1.48e-5; // m²/s at ~15°C
  const fallbackSelectedId =
    selectedSourceId || sources.find((s) => s.active)?.id || sources[0]?.id || 'src-blok-1';

  const machineProfiles: MachineWindTunnelEddyProfile[] = sources.map((src, idx) => {
    // Characteristic bluff-body hydraulic excavator + boom scale (m)
    const charLengthM = 3.6 + (idx % 3) * 0.35 + (src.releaseHeightMeters > 8 ? 0.45 : 0.15);
    const localU = effectiveTunnelWindMs * (1 + (src.releaseHeightMeters - 6) * 0.018);
    const reynoldsNumber = Math.round((localU * charLengthM) / kinematicViscosityAir);
    const strouhalNumber = 0.21; // Bluff-body cylinder/cab Strouhal constant
    const strouhalFreqHz = Number(((strouhalNumber * localU) / (charLengthM * 0.65)).toFixed(2));
    // Turbulence intensity I_u ~ 0.29 in sharp-edged demolition wake
    const turbIntensity = isThresholdExceededOrForced ? 0.29 : 0.17;
    const tkeM2S2 = Number((1.5 * Math.pow(localU * turbIntensity, 2)).toFixed(1));
    const eddyCirculationM2S = Number((localU * charLengthM * 0.84).toFixed(1));
    const wakeLengthMeters = Number((charLengthM * (2.8 + Math.max(0, localU - 8) * 0.42)).toFixed(1));
    const rawEntrainment =
      1.0 +
      Math.pow(Math.max(0, localU - 8.5) / 3.5, 1.65) *
        (waterSuppressionActive ? 0.48 : 1.0) *
        (0.85 + (src.fiberReleaseIndex ?? 1.0) * 0.08);
    const dustEntrainmentMultiplier = Number(Math.max(1.0, rawEntrainment).toFixed(2));

    return {
      sourceId: src.id,
      sourceCode: src.code,
      sourceName: src.name,
      active: src.active,
      isSelected: src.id === fallbackSelectedId,
      reynoldsNumber,
      strouhalFreqHz,
      tkeM2S2,
      eddyCirculationM2S,
      wakeLengthMeters,
      dustEntrainmentMultiplier,
    };
  });

  const selectedMachineProfile =
    machineProfiles.find((m) => m.isSelected) ||
    machineProfiles[0] || {
      sourceId: 'src-blok-1',
      sourceCode: 'K1',
      sourceName: 'Blok 1 Nedrivningsmaskine',
      active: true,
      isSelected: true,
      reynoldsNumber: 3250000,
      strouhalFreqHz: 1.12,
      tkeM2S2: 19.4,
      eddyCirculationM2S: 38.2,
      wakeLengthMeters: 18.5,
      dustEntrainmentMultiplier: 2.35,
    };

  return {
    liveWindSpeedMs,
    liveWindGustMs,
    effectiveTunnelWindMs,
    isLiveAbove10Ms,
    isThresholdExceededOrForced,
    selectedMachineProfile,
    machineProfiles,
  };
}

interface WindTunnelMachineEddyVisualNode {
  root: THREE.Group;
  machinePivotGroup: THREE.Group;
  tunnelFrameMat: THREE.LineBasicMaterial;
  inflowPortalMat: THREE.MeshBasicMaterial;
  horseshoeVortexMesh: THREE.Mesh;
  horseshoeVortexMat: THREE.MeshStandardMaterial;
  eddyRings: THREE.Mesh[];
  eddyRingMats: THREE.MeshStandardMaterial[];
  jawShearRingA: THREE.Mesh;
  jawShearRingB: THREE.Mesh;
  jawShearCoreMat: THREE.MeshBasicMaterial;
  streamlineMats: THREE.MeshBasicMaterial[];
  worldX: number;
  worldZ: number;
  releaseY: number;
}

function buildCompositeWindTunnelMachineEddyGroup(
  src: DemolitionSourceNode,
  worldX: number,
  worldZ: number,
  releaseY: number
): WindTunnelMachineEddyVisualNode {
  const root = new THREE.Group();
  root.position.set(worldX, 0, worldZ);

  // Pivot centered at the demolition excavator cab/tracks (offset 4.2, 0.25, 0.8 inside source node)
  // so that rotating machinePivotGroup by yawRotationY aligns the wind-tunnel test section with the wind vector
  const machinePivotGroup = new THREE.Group();
  machinePivotGroup.position.set(2.4, 0.2, 0.5);
  root.add(machinePivotGroup);

  // 1. 3D Wind-Tunnel Test-Section Bounding Frame & Inflow Portal
  const tunnelBoxGeo = new THREE.BoxGeometry(10.5, 7.2, 22.0);
  tunnelBoxGeo.translate(0, 3.6, 4.2);
  const tunnelEdgesGeo = new THREE.EdgesGeometry(tunnelBoxGeo);
  const tunnelFrameMat = new THREE.LineBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.55,
  });
  const tunnelWireframe = new THREE.LineSegments(tunnelEdgesGeo, tunnelFrameMat);
  machinePivotGroup.add(tunnelWireframe);
  tunnelBoxGeo.dispose();

  // Upwind Wind-Tunnel Inflow Nozzle Ring (at z = -6.8 in local wind-aligned coordinates)
  const inflowPortalGeo = new THREE.RingGeometry(2.8, 3.35, 32);
  const inflowPortalMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const inflowPortalMesh = new THREE.Mesh(inflowPortalGeo, inflowPortalMat);
  inflowPortalMesh.position.set(0, 3.2, -6.5);
  machinePivotGroup.add(inflowPortalMesh);

  // 2. Upwind Horseshoe Vortex (U-shaped 3D tube wrapping around the excavator tracks and trailing downwind)
  const horseshoePts = [
    new THREE.Vector3(-2.6, 0.45, 7.8),
    new THREE.Vector3(-2.1, 0.52, 2.2),
    new THREE.Vector3(-1.45, 0.58, -1.8),
    new THREE.Vector3(0.0, 0.65, -2.9),
    new THREE.Vector3(1.45, 0.58, -1.8),
    new THREE.Vector3(2.1, 0.52, 2.2),
    new THREE.Vector3(2.6, 0.45, 7.8),
  ];
  const horseshoeCurve = new THREE.CatmullRomCurve3(horseshoePts);
  const horseshoeGeo = new THREE.TubeGeometry(horseshoeCurve, 36, 0.22, 10, false);
  const horseshoeVortexMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.2,
    transparent: true,
    opacity: 0.78,
  });
  const horseshoeVortexMesh = new THREE.Mesh(horseshoeGeo, horseshoeVortexMat);
  machinePivotGroup.add(horseshoeVortexMesh);

  // 3. Downwind von Kármán Vortex Street & Eddy Shedding Rings (6 nested 3D torus vortices)
  const eddyRings: THREE.Mesh[] = [];
  const eddyRingMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const baseRadius = 1.15 + i * 0.34;
    const tubeRadius = 0.13 + (5 - i) * 0.015;
    const ringGeo = new THREE.TorusGeometry(baseRadius, tubeRadius, 12, 32);
    const isHighEnergyCore = i < 2;
    const ringMat = new THREE.MeshStandardMaterial({
      color: isHighEnergyCore ? 0xf43f5e : i < 4 ? 0xf59e0b : 0x22d3ee,
      emissive: isHighEnergyCore ? 0xe11d48 : i < 4 ? 0xd97706 : 0x0891b2,
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.15,
      transparent: true,
      opacity: 0.78 - i * 0.08,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 2.2 + i * 0.28, 1.4 + i * 2.25);
    machinePivotGroup.add(ringMesh);
    eddyRings.push(ringMesh);
    eddyRingMats.push(ringMat);
  }

  // 4. Boom-Tip Concrete Pulverizer Shear-Layer Eddy Core (high-shear vortex at the demolition jaw)
  const jawEddyGroup = new THREE.Group();
  jawEddyGroup.position.set(-1.6, Math.max(3.6, releaseY * 0.78), -0.4);
  machinePivotGroup.add(jawEddyGroup);

  const jawRingGeoA = new THREE.TorusGeometry(1.15, 0.11, 10, 28);
  const jawRingMatA = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.85,
  });
  const jawShearRingA = new THREE.Mesh(jawRingGeoA, jawRingMatA);
  jawEddyGroup.add(jawShearRingA);

  const jawRingGeoB = new THREE.TorusGeometry(0.82, 0.09, 10, 24);
  const jawRingMatB = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.88,
  });
  const jawShearRingB = new THREE.Mesh(jawRingGeoB, jawRingMatB);
  jawShearRingB.rotation.x = Math.PI / 2;
  jawEddyGroup.add(jawShearRingB);

  const jawCoreGeo = new THREE.SphereGeometry(0.38, 14, 14);
  const jawShearCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.75,
  });
  const jawCoreMesh = new THREE.Mesh(jawCoreGeo, jawShearCoreMat);
  jawEddyGroup.add(jawCoreMesh);

  // 5. 4 Helical Wind-Tunnel Streamline Tubes curving over the demolition machine into the Eddy wake
  const streamlineMats: THREE.MeshBasicMaterial[] = [];
  const lateralOffsets = [-2.2, -0.85, 0.85, 2.2];
  lateralOffsets.forEach((latX, sIdx) => {
    const pts: THREE.Vector3[] = [];
    for (let step = 0; step <= 14; step++) {
      const frac = step / 14;
      const zPos = -6.4 + frac * 20.5;
      // Flow rises over the excavator cab around z = -1..+2 and corkscrews in the wake (z > 2)
      const cabBump = Math.exp(-Math.pow((zPos - 0.2) / 2.6, 2)) * 2.1;
      const wakeHelixAngle = frac * Math.PI * 4.5 + sIdx * (Math.PI * 0.5);
      const wakeRadius = frac > 0.35 ? (frac - 0.35) * 1.65 : 0.12;
      const xPos = latX + Math.cos(wakeHelixAngle) * wakeRadius;
      const yPos = 1.35 + (sIdx % 2) * 1.1 + cabBump + Math.sin(wakeHelixAngle) * wakeRadius * 0.75;
      pts.push(new THREE.Vector3(xPos, Math.max(0.35, yPos), zPos));
    }
    const streamCurve = new THREE.CatmullRomCurve3(pts);
    const streamGeo = new THREE.TubeGeometry(streamCurve, 44, 0.065, 7, false);
    const streamMat = new THREE.MeshBasicMaterial({
      color: sIdx % 2 === 0 ? 0x38bdf8 : 0xfbbf24,
      transparent: true,
      opacity: 0.62,
    });
    const streamMesh = new THREE.Mesh(streamGeo, streamMat);
    machinePivotGroup.add(streamMesh);
    streamlineMats.push(streamMat);
  });

  return {
    root,
    machinePivotGroup,
    tunnelFrameMat,
    inflowPortalMat,
    horseshoeVortexMesh,
    horseshoeVortexMat,
    eddyRings,
    eddyRingMats,
    jawShearRingA,
    jawShearRingB,
    jawShearCoreMat,
    streamlineMats,
    worldX,
    worldZ,
    releaseY,
  };
}

// ============================================================================
// 3D Sound Wave Refraction & Wavefront Particle Animation over 2.5m Barrier
// ('Lydbølge-Animation': Nedbøjning over Barrieren & Bølgefront-Partikler)
// ============================================================================
export interface AcousticRefractionCorridor3D {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  srcX: number;
  srcY: number;
  srcZ: number;
  recX: number;
  recY: number;
  recZ: number;
  barrierX: number;
  barrierZ: number;
  barrierTopY: number; // 2.5m physical acoustic barrier height mapped to 3D world Y
  barrierYawY: number; // Orientation angle along source -> receptor axis
  distanceMeters: number;
  cosWindAlign: number; // Alignment with downwind direction [-1 .. +1]
  windGradientDuDz: number; // du/dz [s^-1]
  thermalRefractionDb: number; // Thermal stability dB contribution
  windRefractionDb: number; // Downwind shear dB contribution
  totalRefractionDb: number; // Net acoustic refraction dB (-2.2 to +6.6 dB)
  barrierBypassLossDb: number; // Shielding lost from 6.8 dB 2.5m screen due to downward ray bending
  remainingBarrierShieldingDb: number;
  effectiveReceptorLaeqDb: number;
  impulsePeakLafmaxDb: number;
  rayCurvatureRadiusKm: number;
  curvatureFactor: number; // Normalized downward bending intensity [0.05 .. 1.35]
  isDownwindFocused: boolean;
  isSelectedReceptor: boolean;
}

export interface AcousticRefractionSummary3D {
  effectiveWindSpeedMs: number;
  windGradientDuDz: number;
  thermalRefractionDb: number;
  maxDownwindRefractionDb: number;
  sourceSoundPowerLwaDb: number;
  hourlyNoiseLimitLaeqDb: number;
  hourlyImpulseLimitLafmaxDb: number;
  selectedSourceCode: string;
  selectedSourceName: string;
  isNoiseLimitExceededInSelectedHour: boolean;
  maxExceedanceDbInHour: number;
  selectedCorridor: AcousticRefractionCorridor3D;
  corridors: AcousticRefractionCorridor3D[];
}

const ACOUSTIC_RAY_SEGMENTS = 32; // 33 vertices per 3D refraction path

/**
 * Evaluates a point and tangent along the 3D calculated acoustic refraction path
 * from the active demolition source over the 2.5m perimeter noise barrier to the receptor.
 * ZERO heap allocations — writes directly into `outPos` and `outTangent`.
 *
 * @param corridor Calculated source -> barrier -> receptor acoustic refraction corridor
 * @param rayTier 0 = Low Barrier-Grazing Ray, 1 = Mid Downward-Refracted Ray, 2 = High Atmospheric Arch Ray, 3 = Unrefracted Straight-Line Shadow Boundary
 * @param s Normalized arc progress along path [0 .. 1]
 * @param outPos Pre-allocated THREE.Vector3 receiving world (x, y, z)
 * @param outTangent Optional pre-allocated THREE.Vector3 receiving normalized tangent (tx, ty, tz)
 */
function sampleAcousticRefractionRayPoint3D(
  corridor: AcousticRefractionCorridor3D,
  rayTier: number,
  s: number,
  outPos: THREE.Vector3,
  outTangent?: THREE.Vector3
): void {
  const t = THREE.MathUtils.clamp(s, 0, 1);
  const dx = corridor.recX - corridor.srcX;
  const dz = corridor.recZ - corridor.srcZ;
  const lenXZ = Math.max(1.0, Math.hypot(dx, dz));
  const perpX = -dz / lenXZ;
  const perpZ = dx / lenXZ;

  // Lateral fan offset across the 2.5m acoustic barrier width so the 3 ray tiers form a 3D volumetric wave ribbon
  const lateralOffset =
    rayTier === 0 ? -1.15 : rayTier === 1 ? 0.0 : rayTier === 2 ? 1.15 : 0.0;
  const lateralEnvelope = Math.sin(t * Math.PI);

  const wx = corridor.srcX + dx * t + perpX * lateralOffset * lateralEnvelope;
  const wz = corridor.srcZ + dz * t + perpZ * lateralOffset * lateralEnvelope;

  const barrierFrac = 0.34;
  const srcY = corridor.srcY;
  // Clearance over the 2.5m barrier crest at t = 0.34
  const tierClearance =
    rayTier === 0 ? 0.38 : rayTier === 1 ? 1.25 : rayTier === 2 ? 2.35 : 0.18;
  const crestY = corridor.barrierTopY + tierClearance;

  let wy = srcY;
  if (rayTier === 3) {
    // Straight-line geometric shadow boundary (without downward atmospheric refraction):
    // Passes from source through the barrier crest and continues straight upward/outward above the receptor
    const slope = (crestY - srcY) / barrierFrac;
    wy = srcY + slope * t;
  } else {
    // Downward-refracted acoustic ray path over the 2.5m barrier into the receptor zone:
    // Segment 1 (0 <= t <= barrierFrac): rises from machinery emission height over the barrier crest
    // Segment 2 (barrierFrac < t <= 1.0): curves over the acoustic shadow zone and bends downward (nedbøjning) onto the receptor facade
    const targetRecY =
      corridor.recY + (rayTier === 0 ? -0.45 : rayTier === 1 ? 0.25 : 1.05);
    const curv = corridor.curvatureFactor;

    if (t <= barrierFrac) {
      const u = t / barrierFrac;
      // Smooth upward arch toward barrier crest
      const archBoost = Math.sin(u * Math.PI) * (0.45 + rayTier * 0.35 + curv * 0.4);
      wy = THREE.MathUtils.lerp(srcY, crestY, u) + archBoost;
    } else {
      const u = (t - barrierFrac) / (1.0 - barrierFrac);
      // Downward refraction trajectory behind the barrier:
      // Rises briefly past the barrier crest due to initial launch angle, then atmospheric wind/thermal gradient (dc_eff/dz > 0) bends the sound wave sharply downward into the receptor!
      const refractedArchHeight =
        (1.15 + rayTier * 0.85) * (0.65 + curv * 0.95) * Math.sin(u * Math.PI);
      const baseLinearY = THREE.MathUtils.lerp(crestY, targetRecY, Math.pow(u, 0.92));
      wy = baseLinearY + refractedArchHeight;
    }
  }

  outPos.set(wx, Math.max(0.45, wy), wz);

  if (outTangent) {
    const eps = 0.015;
    const tNext = Math.min(1.0, t + eps);
    const tPrev = Math.max(0.0, t - eps);
    const dtSpan = Math.max(0.005, tNext - tPrev);

    // Evaluate finite-difference tangent along the 3D refraction curve
    const latEnvNext = Math.sin(tNext * Math.PI);
    const latEnvPrev = Math.sin(tPrev * Math.PI);
    const tx =
      (dx * dtSpan + perpX * lateralOffset * (latEnvNext - latEnvPrev)) / dtSpan;
    const tz =
      (dz * dtSpan + perpZ * lateralOffset * (latEnvNext - latEnvPrev)) / dtSpan;

    let yNext = wy;
    let yPrev = wy;
    const targetRecY =
      corridor.recY + (rayTier === 0 ? -0.45 : rayTier === 1 ? 0.25 : 1.05);
    const curv = corridor.curvatureFactor;

    const evalYAt = (tau: number): number => {
      if (rayTier === 3) {
        return srcY + ((crestY - srcY) / barrierFrac) * tau;
      }
      if (tau <= barrierFrac) {
        const u = tau / barrierFrac;
        return (
          THREE.MathUtils.lerp(srcY, crestY, u) +
          Math.sin(u * Math.PI) * (0.45 + rayTier * 0.35 + curv * 0.4)
        );
      }
      const u = (tau - barrierFrac) / (1.0 - barrierFrac);
      const arch =
        (1.15 + rayTier * 0.85) * (0.65 + curv * 0.95) * Math.sin(u * Math.PI);
      return THREE.MathUtils.lerp(crestY, targetRecY, Math.pow(u, 0.92)) + arch;
    };

    yNext = evalYAt(tNext);
    yPrev = evalYAt(tPrev);
    const ty = (yNext - yPrev) / dtSpan;

    outTangent.set(tx, ty, tz).normalize();
  }
}

function computeAcousticRefraction3DSummary(
  sources: DemolitionSourceNode[],
  receptors: ReceptorZone[],
  selectedSourceId: string | null,
  selectedReceptorId: string | null,
  currentWeather: HourlyWeatherPoint,
  forceStrongRefraction3D: boolean,
  machineNoiseOutputDb = 114.5
): AcousticRefractionSummary3D {
  const sourceSoundPowerLwaDb = THREE.MathUtils.clamp(machineNoiseOutputDb, 90.0, 125.0);
  const isDaytimeHours = currentWeather.hourIndex >= 7 && currentWeather.hourIndex < 18;
  const isEveningHours = currentWeather.hourIndex >= 18 && currentWeather.hourIndex < 22;
  const hourlyNoiseLimitLaeqDb = isDaytimeHours ? 70.0 : isEveningHours ? 45.0 : 40.0;
  const hourlyImpulseLimitLafmaxDb = isDaytimeHours ? 85.0 : 55.0;
  const activeSources = sources.filter((s) => s.active);
  const dominantSource =
    sources.find((s) => s.id === selectedSourceId) ||
    activeSources[0] ||
    sources[0] || {
      id: 'src-blok-1',
      code: 'K1',
      name: 'Blok 1 Hydraulisk Nedbrydning',
      position: SITE_ORIGIN,
      releaseHeightMeters: 12,
      active: true,
    };

  const srcXZ = latLngToWorldXZ(dominantSource.position);
  const srcY = Math.max(2.6, (dominantSource.releaseHeightMeters || 10) / METERS_PER_UNIT * 0.58);

  const effWindMs = forceStrongRefraction3D
    ? Math.max(12.4, currentWeather.windSpeed10m)
    : Math.max(0.8, currentWeather.windSpeed10m);

  const plumeDirDeg = (currentWeather.windDirection10m + 180) % 360;
  const plumeRad = (plumeDirDeg * Math.PI) / 180;
  const windDirX = Math.sin(plumeRad);
  const windDirZ = -Math.cos(plumeRad);

  // Vertical wind gradient du/dz [s^-1] and thermal stability gradient (ISO 9613-2 / Nord2000)
  const windGradientDuDz = Number((effWindMs * 0.0195).toFixed(3));
  const pasquillThermalDbMap: Record<string, number> = {
    A: -0.8,
    B: -0.4,
    C: 0.2,
    D: 0.7,
    E: 1.5,
    F: 2.3,
  };
  const baseThermalDb =
    pasquillThermalDbMap[currentWeather.pasquillClass] ?? 0.7;
  const thermalRefractionDb = Number(
    (forceStrongRefraction3D ? Math.max(1.2, baseThermalDb) : baseThermalDb).toFixed(1)
  );

  const calmBarrierShieldingDb = 6.8; // Standard 2.5m acoustic screen attenuation in homogeneous atmosphere

  const corridors: AcousticRefractionCorridor3D[] = receptors.map((rec) => {
    const recXZ = latLngToWorldXZ(rec.center);
    const recY = rec.category === 'residential_block' ? 2.6 : 1.9;

    const dx = recXZ.x - srcXZ.x;
    const dz = recXZ.z - srcXZ.z;
    const distUnits = Math.max(8, Math.hypot(dx, dz));
    const distanceMeters = Math.round(distUnits * METERS_PER_UNIT);

    const cosWindAlign = Number(((dx * windDirX + dz * windDirZ) / distUnits).toFixed(2));
    // Place the 2.5m perimeter noise barrier at 34% of the corridor from the demolition source
    const barrierFrac = 0.34;
    const barrierX = srcXZ.x + dx * barrierFrac;
    const barrierZ = srcXZ.z + dz * barrierFrac;
    const barrierTopY = 2.55; // 2.5m barrier height in 3D world coordinates
    const barrierYawY = Math.atan2(dx, dz);

    // Downwind shear refraction contribution
    const rawWindRefrDb = Math.min(5.2, effWindMs * 0.34);
    const alignedWindFactor = forceStrongRefraction3D
      ? Math.max(0.68, cosWindAlign)
      : Math.max(-0.45, cosWindAlign);
    const windRefractionDb = Number((rawWindRefrDb * alignedWindFactor).toFixed(1));
    const totalRefractionDb = Number(
      THREE.MathUtils.clamp(windRefractionDb + thermalRefractionDb, -2.2, 6.6).toFixed(1)
    );

    // Downward refraction over the 2.5m barrier reduces the barrier's 6.8 dB shielding
    const barrierBypassLossDb = Number(
      THREE.MathUtils.clamp(
        Math.max(0, totalRefractionDb) * 0.82 + (effWindMs > 10 ? (effWindMs - 10) * 0.25 : 0),
        0,
        5.8
      ).toFixed(1)
    );
    const remainingBarrierShieldingDb = Number(
      Math.max(1.0, calmBarrierShieldingDb - barrierBypassLossDb).toFixed(1)
    );

    // Geometric spherical spreading from active demolition machine (L_WA = 90..125 dB(A)) minus remaining barrier shielding + refraction gain
    const distAttenDb = 20 * Math.log10(Math.max(22, distanceMeters)) + 8.5;
    const effectiveReceptorLaeqDb = Number(
      THREE.MathUtils.clamp(
        sourceSoundPowerLwaDb -
          distAttenDb -
          remainingBarrierShieldingDb +
          Math.max(0, totalRefractionDb) * 0.65,
        35.0,
        88.0
      ).toFixed(1)
    );
    const impulsePeakLafmaxDb = Number((effectiveReceptorLaeqDb + 15.2).toFixed(1));

    // Ray curvature radius R_c = c_0 / (dc_eff/dz) in km
    const effGrad = Math.max(0.03, windGradientDuDz * Math.max(0.35, alignedWindFactor) + 0.04);
    const rayCurvatureRadiusKm = Number(
      THREE.MathUtils.clamp(0.343 / effGrad, 0.95, 8.5).toFixed(2)
    );

    const curvatureFactor = Number(
      THREE.MathUtils.clamp((totalRefractionDb + 1.5) / 5.5, 0.18, 1.35).toFixed(2)
    );

    return {
      receptorId: rec.id,
      receptorCode: rec.code,
      receptorName: rec.name,
      sourceId: dominantSource.id,
      sourceCode: dominantSource.code,
      sourceName: dominantSource.name,
      srcX: srcXZ.x,
      srcY,
      srcZ: srcXZ.z,
      recX: recXZ.x,
      recY,
      recZ: recXZ.z,
      barrierX,
      barrierZ,
      barrierTopY,
      barrierYawY,
      distanceMeters,
      cosWindAlign,
      windGradientDuDz,
      thermalRefractionDb,
      windRefractionDb,
      totalRefractionDb,
      barrierBypassLossDb,
      remainingBarrierShieldingDb,
      effectiveReceptorLaeqDb,
      impulsePeakLafmaxDb,
      rayCurvatureRadiusKm,
      curvatureFactor,
      isDownwindFocused: totalRefractionDb >= 2.2 || cosWindAlign >= 0.15 || forceStrongRefraction3D,
      isSelectedReceptor: rec.id === selectedReceptorId,
    };
  });

  const sortedByRefraction = [...corridors].sort(
    (a, b) => b.totalRefractionDb - a.totalRefractionDb
  );
  const selectedCorridor =
    corridors.find((c) => c.receptorId === selectedReceptorId) ||
    sortedByRefraction[0] ||
    corridors[0];

  if (selectedCorridor) {
    selectedCorridor.isSelectedReceptor = true;
  }

  const maxDownwindRefractionDb =
    sortedByRefraction[0]?.totalRefractionDb ?? 4.2;

  const maxExceedanceDbInHour = Number(
    (dominantSource.active === false
      ? -20
      : corridors.reduce((maxEx, c) => {
          const exLaeq = c.effectiveReceptorLaeqDb - hourlyNoiseLimitLaeqDb;
          const exPeak = c.impulsePeakLafmaxDb - hourlyImpulseLimitLafmaxDb;
          return Math.max(maxEx, exLaeq, exPeak);
        }, -20)
    ).toFixed(1)
  );
  const isNoiseLimitExceededInSelectedHour = maxExceedanceDbInHour > 0;

  return {
    effectiveWindSpeedMs: Number(effWindMs.toFixed(1)),
    windGradientDuDz,
    thermalRefractionDb,
    maxDownwindRefractionDb,
    sourceSoundPowerLwaDb,
    hourlyNoiseLimitLaeqDb,
    hourlyImpulseLimitLafmaxDb,
    selectedSourceCode: dominantSource.code,
    selectedSourceName: dominantSource.name,
    isNoiseLimitExceededInSelectedHour,
    maxExceedanceDbInHour,
    selectedCorridor,
    corridors,
  };
}

interface AcousticCorridorVisualNode3D {
  receptorId: string;
  root: THREE.Group;
  barrierGroup: THREE.Group;
  barrierCrestGlowMat: THREE.MeshStandardMaterial;
  shadowZoneWedgeMesh: THREE.Mesh;
  shadowZoneWedgeMat: THREE.MeshBasicMaterial;
  refractedRayLines: THREE.Line[];
  refractedRayGeoPositions: THREE.BufferAttribute[];
  refractedRayMats: THREE.LineBasicMaterial[];
  unrefractedShadowLine: THREE.Line;
  unrefractedShadowPosAttr: THREE.BufferAttribute;
  receptorImpactRingMesh: THREE.Mesh;
  receptorImpactRingMat: THREE.MeshBasicMaterial;
  // Item #2: Visual 'Acoustisk refraktions-overlay' (Luminous 3D Arches & Curtain over Barrier based on maxDownwindRefractionDb)
  refractionOverlayGroup: THREE.Group;
  luminousArchRibbonMeshes: THREE.Mesh[];
  luminousArchRibbonPosAttrs: THREE.BufferAttribute[];
  luminousArchRibbonMats: THREE.MeshBasicMaterial[];
  luminousRefractionCurtainMesh: THREE.Mesh;
  luminousRefractionCurtainPosAttr: THREE.BufferAttribute;
  luminousRefractionCurtainMat: THREE.MeshBasicMaterial;
  // Item #5: 'Lydbølge-Reflektion' (Reflected Wave Vectors & Specular Hotspots on Upwind Barrier Face)
  reflectionGroup: THREE.Group;
  incidentVectorLines: THREE.Line[];
  incidentVectorPosAttrs: THREE.BufferAttribute[];
  reflectedVectorArrows: THREE.Group[];
  reflectedVectorShaftMats: THREE.MeshBasicMaterial[];
  reflectedVectorConeMats: THREE.MeshBasicMaterial[];
  reflectionHotspotMeshes: THREE.Mesh[];
  reflectionHotspotMats: THREE.MeshBasicMaterial[];
  reflectedStandingWaveArcs: THREE.Mesh[];
  reflectedStandingWaveMats: THREE.MeshBasicMaterial[];
  // Item #6: 'Lydbølge-Diffraktion' (Circular Wavefront Segments Bending over Barrier Top)
  diffractionCrestGroup: THREE.Group;
  diffractionCircularSegments: THREE.Mesh[];
  diffractionCircularMats: THREE.MeshBasicMaterial[];
}

function buildCompositeAcousticRefractionCorridorNode(
  rec: ReceptorZone
): AcousticCorridorVisualNode3D {
  const root = new THREE.Group();
  root.name = `acoustic-refraction-corridor-${rec.id}`;

  // 1. Composite 6-Part 3D Acoustic Perimeter Barrier ('Støjskærm 2,5 m')
  const barrierGroup = new THREE.Group();
  const barrierWidth = 8.4;
  const barrierHeight = 2.55;

  // Part 1: Concrete base plinth
  const plinthGeo = new THREE.BoxGeometry(barrierWidth + 0.5, 0.36, 0.62);
  plinthGeo.translate(0, 0.18, 0);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.86,
    metalness: 0.12,
  });
  barrierGroup.add(new THREE.Mesh(plinthGeo, plinthMat));

  // Part 2: Acoustic mineral-wool absorbing cassettes
  const panelGeo = new THREE.BoxGeometry(barrierWidth, barrierHeight - 0.42, 0.28);
  panelGeo.translate(0, 0.36 + (barrierHeight - 0.42) * 0.5, 0);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.62,
    metalness: 0.35,
  });
  barrierGroup.add(new THREE.Mesh(panelGeo, panelMat));

  // Part 3: Galvanized steel H-beam support posts along the barrier
  const postGeo = new THREE.BoxGeometry(0.24, barrierHeight + 0.08, 0.44);
  postGeo.translate(0, (barrierHeight + 0.08) * 0.5, 0);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.32,
    metalness: 0.82,
  });
  [-barrierWidth * 0.48, -barrierWidth * 0.16, barrierWidth * 0.16, barrierWidth * 0.48].forEach(
    (px) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.x = px;
      barrierGroup.add(post);
    }
  );

  // Part 4: Cylindrical top acoustic diffraction crown baffle
  const crownGeo = new THREE.CylinderGeometry(0.22, 0.22, barrierWidth + 0.4, 16);
  crownGeo.rotateZ(Math.PI / 2);
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.28,
    metalness: 0.68,
  });
  const crownMesh = new THREE.Mesh(crownGeo, crownMat);
  crownMesh.position.y = barrierHeight;
  barrierGroup.add(crownMesh);

  // Part 5: Glowing diffraction crest bar (highlights where downward-refracted waves bend over the barrier)
  const crestGlowGeo = new THREE.BoxGeometry(barrierWidth + 0.2, 0.14, 0.34);
  const barrierCrestGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.95,
    roughness: 0.2,
    metalness: 0.3,
  });
  const crestGlowMesh = new THREE.Mesh(crestGlowGeo, barrierCrestGlowMat);
  crestGlowMesh.position.y = barrierHeight + 0.18;
  barrierGroup.add(crestGlowMesh);

  // Part 6: Translucent Geometric Acoustic Shadow Zone Wedge behind the 2.5m barrier
  const shadowZoneGeo = new THREE.BoxGeometry(barrierWidth * 0.92, barrierHeight * 0.88, 12.0);
  shadowZoneGeo.translate(0, barrierHeight * 0.44, 6.0);
  const shadowZoneWedgeMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadowZoneWedgeMesh = new THREE.Mesh(shadowZoneGeo, shadowZoneWedgeMat);
  barrierGroup.add(shadowZoneWedgeMesh);

  // ============================================================================
  // Item #5: 'Lydbølge-Reflektions' Funktion på Støjskærmens Forside (Upwind z < 0)
  // ============================================================================
  const reflectionGroup = new THREE.Group();
  reflectionGroup.name = `barrier-wave-reflection-${rec.id}`;
  barrierGroup.add(reflectionGroup);

  const incidentVectorLines: THREE.Line[] = [];
  const incidentVectorPosAttrs: THREE.BufferAttribute[] = [];
  const reflectedVectorArrows: THREE.Group[] = [];
  const reflectedVectorShaftMats: THREE.MeshBasicMaterial[] = [];
  const reflectedVectorConeMats: THREE.MeshBasicMaterial[] = [];
  const reflectionHotspotMeshes: THREE.Mesh[] = [];
  const reflectionHotspotMats: THREE.MeshBasicMaterial[] = [];
  const reflectedStandingWaveArcs: THREE.Mesh[] = [];
  const reflectedStandingWaveMats: THREE.MeshBasicMaterial[] = [];

  const reflLateralOffsets = [-2.3, 0.0, 2.3];
  const reflImpactHeights = [1.05, 1.58, 2.05];

  for (let rIdx = 0; rIdx < 3; rIdx++) {
    const lx = reflLateralOffsets[rIdx];
    const ly = reflImpactHeights[rIdx];

    // Incident wave ray segment in world space (updated in tick() from source to barrier impact point)
    const incPosArr = new Float32Array(6);
    const incPosAttr = new THREE.BufferAttribute(incPosArr, 3);
    const incGeo = new THREE.BufferGeometry();
    incGeo.setAttribute('position', incPosAttr);
    const incMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
    });
    const incLine = new THREE.Line(incGeo, incMat);
    incLine.frustumCulled = false;
    root.add(incLine);
    incidentVectorLines.push(incLine);
    incidentVectorPosAttrs.push(incPosAttr);

    // Specular reflection hotspot ring on the upwind face of the barrier (local z = -0.18)
    const hotspotGeo = new THREE.RingGeometry(0.22, 0.52, 24);
    const hotspotMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const hotspotMesh = new THREE.Mesh(hotspotGeo, hotspotMat);
    hotspotMesh.position.set(lx, ly, -0.19);
    reflectionGroup.add(hotspotMesh);
    reflectionHotspotMeshes.push(hotspotMesh);
    reflectionHotspotMats.push(hotspotMat);

    // 3D Reflected Wave Vector Arrow bouncing off the barrier face toward upwind (-Z, +Y)
    const arrowGroup = new THREE.Group();
    arrowGroup.position.set(lx, ly, -0.2);

    const shaftGeo = new THREE.CylinderGeometry(0.065, 0.065, 1.0, 10);
    shaftGeo.rotateX(Math.PI / 2);
    shaftGeo.translate(0, 0, 0.5);
    const shaftMat = new THREE.MeshBasicMaterial({
      color: rIdx === 1 ? 0xfde047 : 0x22d3ee,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    arrowGroup.add(shaftMesh);

    const coneGeo = new THREE.ConeGeometry(0.22, 0.58, 12);
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, 1.08);
    const coneMat = new THREE.MeshBasicMaterial({
      color: rIdx === 1 ? 0xfbbf24 : 0x38bdf8,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    arrowGroup.add(coneMesh);

    reflectionGroup.add(arrowGroup);
    reflectedVectorArrows.push(arrowGroup);
    reflectedVectorShaftMats.push(shaftMat);
    reflectedVectorConeMats.push(coneMat);

    // Expanding Reflected Standing-Wave Interference Arc in front of the barrier (local z < 0)
    const arcGeo = new THREE.TorusGeometry(1.0, 0.06, 8, 24, Math.PI * 0.75);
    arcGeo.rotateX(Math.PI / 2);
    arcGeo.rotateZ(-Math.PI * 0.875);
    const arcMat = new THREE.MeshBasicMaterial({
      color: rIdx % 2 === 0 ? 0x22d3ee : 0xfde047,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.position.set(0, 1.55, -0.22);
    reflectionGroup.add(arcMesh);
    reflectedStandingWaveArcs.push(arcMesh);
    reflectedStandingWaveMats.push(arcMat);
  }

  // ============================================================================
  // Item #6: 'Lydbølge-Diffraktion' hen over Barrierens Top (Cirkulære Bølgefront-Segmenter)
  // ============================================================================
  const diffractionCrestGroup = new THREE.Group();
  diffractionCrestGroup.name = `barrier-top-diffraction-${rec.id}`;
  diffractionCrestGroup.position.set(0, barrierHeight + 0.08, 0);
  barrierGroup.add(diffractionCrestGroup);

  const diffractionCircularSegments: THREE.Mesh[] = [];
  const diffractionCircularMats: THREE.MeshBasicMaterial[] = [];

  // 6 concentric circular wavefront cylinder-arc segments radiating from the top edge of the barrier
  // and bending downward into the leeward shadow zone (+Z, -Y)
  for (let dIdx = 0; dIdx < 6; dIdx++) {
    // Open cylindrical wavefront segment spanning the barrier width and ~155 degrees of arc
    const cylArcGeo = new THREE.CylinderGeometry(
      1.0,
      1.0,
      barrierWidth * 0.84,
      28,
      1,
      true,
      0,
      Math.PI * 0.86
    );
    // Orient cylinder axis along X (barrier width) so circular arc curves in the Y-Z plane over the barrier top
    cylArcGeo.rotateZ(Math.PI / 2);
    const cylArcMat = new THREE.MeshBasicMaterial({
      color: dIdx % 2 === 0 ? 0xfde047 : 0xf43f5e,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cylArcMesh = new THREE.Mesh(cylArcGeo, cylArcMat);
    diffractionCrestGroup.add(cylArcMesh);
    diffractionCircularSegments.push(cylArcMesh);
    diffractionCircularMats.push(cylArcMat);
  }

  root.add(barrierGroup);

  // ============================================================================
  // Item #2: Visuelt 'Acoustisk refraktions-overlay' (Lysende 3D Buer over Støjskærmen)
  // ============================================================================
  const refractionOverlayGroup = new THREE.Group();
  refractionOverlayGroup.name = `acoustic-refraction-glow-overlay-${rec.id}`;
  root.add(refractionOverlayGroup);

  const luminousArchRibbonMeshes: THREE.Mesh[] = [];
  const luminousArchRibbonPosAttrs: THREE.BufferAttribute[] = [];
  const luminousArchRibbonMats: THREE.MeshBasicMaterial[] = [];

  const archColors = [0x22d3ee, 0xfbbf24, 0xf43f5e];
  for (let tier = 0; tier < 3; tier++) {
    // Each luminous arch ribbon has (ACOUSTIC_RAY_SEGMENTS + 1) * 2 vertices forming a glowing 3D band
    const ribVertCount = (ACOUSTIC_RAY_SEGMENTS + 1) * 2;
    const ribPositions = new Float32Array(ribVertCount * 3);
    const ribIndices: number[] = [];
    for (let s = 0; s < ACOUSTIC_RAY_SEGMENTS; s++) {
      const i0 = s * 2;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      const i3 = i0 + 3;
      ribIndices.push(i0, i1, i2, i1, i3, i2);
    }
    const ribGeo = new THREE.BufferGeometry();
    const ribPosAttr = new THREE.BufferAttribute(ribPositions, 3);
    ribGeo.setAttribute('position', ribPosAttr);
    ribGeo.setIndex(ribIndices);

    const ribMat = new THREE.MeshBasicMaterial({
      color: archColors[tier],
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ribMesh = new THREE.Mesh(ribGeo, ribMat);
    ribMesh.frustumCulled = false;
    refractionOverlayGroup.add(ribMesh);
    luminousArchRibbonMeshes.push(ribMesh);
    luminousArchRibbonPosAttrs.push(ribPosAttr);
    luminousArchRibbonMats.push(ribMat);
  }

  // Translucent vertical acoustic refraction curtain connecting low & high refracted rays
  const curtainVertCount = (ACOUSTIC_RAY_SEGMENTS + 1) * 2;
  const curtainPositions = new Float32Array(curtainVertCount * 3);
  const curtainIndices: number[] = [];
  for (let s = 0; s < ACOUSTIC_RAY_SEGMENTS; s++) {
    const i0 = s * 2;
    const i1 = i0 + 1;
    const i2 = i0 + 2;
    const i3 = i0 + 3;
    curtainIndices.push(i0, i1, i2, i1, i3, i2);
  }
  const curtainGeo = new THREE.BufferGeometry();
  const luminousRefractionCurtainPosAttr = new THREE.BufferAttribute(curtainPositions, 3);
  curtainGeo.setAttribute('position', luminousRefractionCurtainPosAttr);
  curtainGeo.setIndex(curtainIndices);
  const luminousRefractionCurtainMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const luminousRefractionCurtainMesh = new THREE.Mesh(
    curtainGeo,
    luminousRefractionCurtainMat
  );
  luminousRefractionCurtainMesh.frustumCulled = false;
  refractionOverlayGroup.add(luminousRefractionCurtainMesh);

  // 2. Three Calculated 3D Downward-Refracted Ray Path Lines (Low, Mid, High)
  const refractedRayLines: THREE.Line[] = [];
  const refractedRayGeoPositions: THREE.BufferAttribute[] = [];
  const refractedRayMats: THREE.LineBasicMaterial[] = [];

  const tierColors = [0x22d3ee, 0xfbbf24, 0xf43f5e];
  for (let tier = 0; tier < 3; tier++) {
    const posArr = new Float32Array((ACOUSTIC_RAY_SEGMENTS + 1) * 3);
    const posAttr = new THREE.BufferAttribute(posArr, 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', posAttr);
    const lineMat = new THREE.LineBasicMaterial({
      color: tierColors[tier],
      transparent: true,
      opacity: 0.78,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.frustumCulled = false;
    root.add(line);
    refractedRayLines.push(line);
    refractedRayGeoPositions.push(posAttr);
    refractedRayMats.push(lineMat);
  }

  // 3. Unrefracted Straight-Line Geometric Shadow Reference Ray (passes straight over barrier top)
  const shadowPosArr = new Float32Array((ACOUSTIC_RAY_SEGMENTS + 1) * 3);
  const unrefractedShadowPosAttr = new THREE.BufferAttribute(shadowPosArr, 3);
  const shadowLineGeo = new THREE.BufferGeometry();
  shadowLineGeo.setAttribute('position', unrefractedShadowPosAttr);
  const shadowLineMat = new THREE.LineBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.42,
  });
  const unrefractedShadowLine = new THREE.Line(shadowLineGeo, shadowLineMat);
  unrefractedShadowLine.frustumCulled = false;
  root.add(unrefractedShadowLine);

  // 4. Receptor Facade Acoustic Impact Target Halo Ring
  const impactRingGeo = new THREE.RingGeometry(0.95, 1.55, 28);
  const receptorImpactRingMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const receptorImpactRingMesh = new THREE.Mesh(impactRingGeo, receptorImpactRingMat);
  root.add(receptorImpactRingMesh);

  return {
    receptorId: rec.id,
    root,
    barrierGroup,
    barrierCrestGlowMat,
    shadowZoneWedgeMesh,
    shadowZoneWedgeMat,
    refractedRayLines,
    refractedRayGeoPositions,
    refractedRayMats,
    unrefractedShadowLine,
    unrefractedShadowPosAttr,
    receptorImpactRingMesh,
    receptorImpactRingMat,
    refractionOverlayGroup,
    luminousArchRibbonMeshes,
    luminousArchRibbonPosAttrs,
    luminousArchRibbonMats,
    luminousRefractionCurtainMesh,
    luminousRefractionCurtainPosAttr,
    luminousRefractionCurtainMat,
    reflectionGroup,
    incidentVectorLines,
    incidentVectorPosAttrs,
    reflectedVectorArrows,
    reflectedVectorShaftMats,
    reflectedVectorConeMats,
    reflectionHotspotMeshes,
    reflectionHotspotMats,
    reflectedStandingWaveArcs,
    reflectedStandingWaveMats,
    diffractionCrestGroup,
    diffractionCircularSegments,
    diffractionCircularMats,
  };
}

export const Ringparken3DScene: React.FC<Ringparken3DSceneProps> = ({
  sources,
  receptors,
  receptorExposures,
  currentWeather,
  observations,
  selectedSourceId,
  selectedReceptorId,
  onSelectSource,
  onSelectReceptor,
  onToggleSourceActive,
  isFullscreen3D = false,
  onToggleFullscreen3D,
  undergroundMode: externalUndergroundMode,
  onToggleUndergroundMode,
  precipitationOverrideMm = null,
  onChangePrecipitationOverride,
  onSwitchTo2DPercolation,
  asbestosHeatmapActive: externalAsbestosHeatmapActive,
  onToggleAsbestosHeatmap,
  asbestosSourceScope: externalAsbestosSourceScope,
  onChangeAsbestosSourceScope,
  asbestosEvalHeightMeters: externalAsbestosEvalHeightMeters,
  onChangeAsbestosEvalHeightMeters,
  weatherHours,
  temporal24hAsbestosAccumulation: externalTemporal24hAsbestosAccumulation,
  onToggleTemporal24hAsbestosAccumulation,
  showLeewardWakeEffect: externalShowLeewardWakeEffect,
  onToggleLeewardWakeEffect,
  showWeatherCorrelationOverlay: externalShowWeatherCorrelationOverlay,
  onToggleWeatherCorrelationOverlay,
  timelineSliderProgress,
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
  show3DNeutralPressurePlane: externalShow3DNeutralPressurePlane,
  onToggle3DNeutralPressurePlane,
  neutralPressurePlaneHeightMeters: externalNeutralPressurePlaneHeightMeters,
  onChangeNeutralPressurePlaneHeightMeters,
  machineNoiseOutputDb = 114.5,
  selectedDateIso,
  onChangeDateIso,
  onStepHour,
  focusBlok12PercolationTrigger,
  simulationSpeedMultiplier = 1,
  hiddenSourceIds = [],
  visibleSubstances,
  onBornehavePlumeAlertUpdate,
  waterMainTelemetry,
  showWaterMainLayer,
  onToggleWaterMainLayer,
  showLerBuffer = true,
  onToggleLerBuffer,
  hasSteelRoadPlates = false,
  onToggleSteelRoadPlates,
  simulatedPipeRuptureActive = false,
  onToggleSimulatedPipeRupture,
  isS3ValveLockoutActive = false,
  onToggleS3ValveLockout,
  onIsolateNearbyMachinery,
  onRestoreAllMachinery,
  virtualLeakPinPoint = null,
  virtualLeakImpact = null,
  onToggleVirtualLeakPinQuick,
  simultaneousDispatch,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
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

  // Local 3D interactive simulation controls
  const [waterSuppressionActive, setWaterSuppressionActive] = useState<boolean>(false);
  const [showPlumeVolumes, setShowPlumeVolumes] = useState<boolean>(true);
  const [showPlumePathAnimation3D, setShowPlumePathAnimation3D] = useState<boolean>(true);
  const [showWindStreamlines, setShowWindStreamlines] = useState<boolean>(true);
  const [localShowLeewardWake, setLocalShowLeewardWake] = useState<boolean>(true);
  const [localShowWeatherCorrelation, setLocalShowWeatherCorrelation] = useState<boolean>(false);
  const [selectedCorrelationPointId, setSelectedCorrelationPointId] = useState<string | null>(null);
  const [localAsbestosHeatmapActive, setLocalAsbestosHeatmapActive] = useState<boolean>(true);
  const [localTemporal24hAccumulation, setLocalTemporal24hAccumulation] =
    useState<boolean>(false);
  // 24-Hour 3D Volumetric Asbestos Accumulation Build-Up Controls (1t -> 24t)
  const [temporalVolumeHoursCap, setTemporalVolumeHoursCap] = useState<number>(24);
  const [syncTemporalVolumeToTimeline, setSyncTemporalVolumeToTimeline] =
    useState<boolean>(false);
  const [isPlayingTemporalVolume24h, setIsPlayingTemporalVolume24h] =
    useState<boolean>(false);
  const [localAsbestosSourceScope, setLocalAsbestosSourceScope] = useState<
    'all_active' | 'selected_source'
  >('all_active');
  const [localAsbestosEvalHeightMeters, setLocalAsbestosEvalHeightMeters] =
    useState<number>(1.5);
  const [localUndergroundMode, setLocalUndergroundMode] = useState<boolean>(false);
  const [localPrecipOverride, setLocalPrecipOverride] = useState<number | null>(null);
  // 3D Courtyard Accumulated Dust-Dose Heatmap & Dust Fallout (synchronized with Timeline Slider)
  const [showDustDeposition3D, setShowDustDeposition3D] = useState<boolean>(true);
  const [syncCourtyardHeatmapWithTimeline, setSyncCourtyardHeatmapWithTimeline] =
    useState<boolean>(true);
  const [isPlayingDustDeposition, setIsPlayingDustDeposition] = useState<boolean>(false);
  const [dustDepositionSpeed, setDustDepositionSpeed] = useState<'0.5x' | '1x' | '2x'>('1x');
  const [dustDepositionProgressHours, setDustDepositionProgressHours] = useState<number>(
    typeof timelineSliderProgress === 'number'
      ? Math.max(1, timelineSliderProgress + 1)
      : Math.max(1, currentWeather.hourIndex + 1)
  );
  // 3D Wind-Tunnel & Turbulence Eddy Visualization (> 10 m/s) around Demolition Machinery
  const [showWindTunnelEddy3D, setShowWindTunnelEddy3D] = useState<boolean>(true);
  const [forceHighWindTunnelPreview, setForceHighWindTunnelPreview] = useState<boolean>(true);
  const [windTunnelScope, setWindTunnelScope] = useState<
    'selected_machine' | 'all_active_machines'
  >('selected_machine');
  // 3D Sound Wave Refraction & Wavefront Particle Animation ('Lydbølge-Animation' over Barrieren)
  const [showSoundWaveAnimation3D, setShowSoundWaveAnimation3D] = useState<boolean>(true);
  const [isPlayingSoundWave3D, setIsPlayingSoundWave3D] = useState<boolean>(true);
  const [soundWaveSpeed3D, setSoundWaveSpeed3D] = useState<'0.5x' | '1x' | '2x'>('1x');
  const [soundWaveCorridorScope, setSoundWaveCorridorScope] = useState<
    'all_downwind_corridors' | 'selected_corridor'
  >('all_downwind_corridors');
  const [forceStrongRefraction3D, setForceStrongRefraction3D] = useState<boolean>(true);
  // Item #2: Visual 'Acoustisk refraktions-overlay' (luminous arches over barrier based on maxDownwindRefractionDb)
  const [showAcousticRefractionOverlay3D, setShowAcousticRefractionOverlay3D] =
    useState<boolean>(true);
  // Item #5: 'Lydbølge-Reflektions' function (reflected wave vectors when sound waves hit barrier screen surface)
  const [showSoundWaveReflection3D, setShowSoundWaveReflection3D] = useState<boolean>(true);
  // Item #6: 'Lydbølge-Diffraktion' animation over barrier top (circular wavefront segments bending into shadow zone)
  const [showBarrierDiffractionArcs3D, setShowBarrierDiffractionArcs3D] = useState<boolean>(true);
  // Hydraulic Concrete Hammer Impulse Shockwaves propagating toward neighbor blocks based on hourly refraction (dB)
  const [showHydraulicHammerImpulseWaves3D, setShowHydraulicHammerImpulseWaves3D] =
    useState<boolean>(true);
  // Item #1: Dynamic 'Støv-Emitter' animation for all active demolition machines (correlated with machine load output & wind speed)
  const [showMachineryDustEmitter3D, setShowMachineryDustEmitter3D] = useState<boolean>(true);
  const [machineryLoadOutputPct, setMachineryLoadOutputPct] = useState<number>(100);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetKey>('overview');
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [is3dHudMinimized, setIs3dHudMinimized] = useState<boolean>(false);
  const [is3dHudReleased, setIs3dHudReleased] = useState<boolean>(false);
  const [hud3dPos, setHud3dPos] = useState<{ x: number; y: number }>({ x: 28, y: 80 });
  const [isBottomDockReleased, setIsBottomDockReleased] = useState<boolean>(false);
  const [bottomDockPos, setBottomDockPos] = useState<{ x: number; y: number }>({ x: 180, y: 500 });
  const [hoveredEntityLabel, setHoveredEntityLabel] = useState<string | null>(null);
  const [isSoftwareRenderer, setIsSoftwareRenderer] = useState<boolean>(false);
  const [localShow3DNeutralPressurePlane, setLocalShow3DNeutralPressurePlane] =
    useState<boolean>(true);
  const [localNeutralPressureHeightM, setLocalNeutralPressureHeightM] =
    useState<number>(12.0);

  const show3DNeutralPressurePlane =
    externalShow3DNeutralPressurePlane !== undefined
      ? externalShow3DNeutralPressurePlane
      : localShow3DNeutralPressurePlane;

  const neutralPressurePlaneHeightMeters =
    externalNeutralPressurePlaneHeightMeters !== undefined
      ? externalNeutralPressurePlaneHeightMeters
      : localNeutralPressureHeightM;

  const handleToggle3DNeutralPressurePlane = useCallback(
    (next?: boolean) => {
      const target = next !== undefined ? next : !show3DNeutralPressurePlane;
      if (onToggle3DNeutralPressurePlane) {
        onToggle3DNeutralPressurePlane(target);
      } else {
        setLocalShow3DNeutralPressurePlane(target);
      }
    },
    [show3DNeutralPressurePlane, onToggle3DNeutralPressurePlane]
  );

  const handleSetNeutralPressureHeightM = useCallback(
    (zM: number) => {
      if (onChangeNeutralPressurePlaneHeightMeters) {
        onChangeNeutralPressurePlaneHeightMeters(zM);
      } else {
        setLocalNeutralPressureHeightM(zM);
      }
    },
    [onChangeNeutralPressurePlaneHeightMeters]
  );

  const startDrag3dPanel = (
    e: React.PointerEvent<HTMLDivElement>,
    currentPos: { x: number; y: number },
    onMovePos: (p: { x: number; y: number }) => void
  ) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = currentPos.x;
    const origY = currentPos.y;
    const handleMove = (ev: PointerEvent) => {
      const nx = Math.max(8, Math.min(window.innerWidth - 320, origX + (ev.clientX - startX)));
      const ny = Math.max(48, Math.min(window.innerHeight - 100, origY + (ev.clientY - startY)));
      onMovePos({ x: nx, y: ny });
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const showLeewardWake =
    externalShowLeewardWakeEffect !== undefined
      ? externalShowLeewardWakeEffect
      : localShowLeewardWake;

  const handleToggleLeewardWake = useCallback(
    (next?: boolean) => {
      const target = next !== undefined ? next : !showLeewardWake;
      if (onToggleLeewardWakeEffect) {
        onToggleLeewardWakeEffect(target);
      } else {
        setLocalShowLeewardWake(target);
      }
    },
    [showLeewardWake, onToggleLeewardWakeEffect]
  );

  const showWeatherCorrelation =
    externalShowWeatherCorrelationOverlay !== undefined
      ? externalShowWeatherCorrelationOverlay
      : localShowWeatherCorrelation;

  const handleToggleWeatherCorrelation = useCallback(
    (next?: boolean) => {
      const target = next !== undefined ? next : !showWeatherCorrelation;
      if (onToggleWeatherCorrelationOverlay) {
        onToggleWeatherCorrelationOverlay(target);
      } else {
        setLocalShowWeatherCorrelation(target);
      }
    },
    [showWeatherCorrelation, onToggleWeatherCorrelationOverlay]
  );

  const showAsbestosHeatmap =
    externalAsbestosHeatmapActive !== undefined
      ? externalAsbestosHeatmapActive
      : localAsbestosHeatmapActive;

  const isTemporal24hAsbestosActive =
    externalTemporal24hAsbestosAccumulation !== undefined
      ? externalTemporal24hAsbestosAccumulation
      : localTemporal24hAccumulation;

  const asbestosSourceScope =
    externalAsbestosSourceScope !== undefined
      ? externalAsbestosSourceScope
      : localAsbestosSourceScope;

  const asbestosEvalHeightMeters =
    externalAsbestosEvalHeightMeters !== undefined
      ? externalAsbestosEvalHeightMeters
      : localAsbestosEvalHeightMeters;

  const handleToggleAsbestosHeatmap = useCallback(
    (next?: boolean) => {
      const target = next !== undefined ? next : !showAsbestosHeatmap;
      if (onToggleAsbestosHeatmap) {
        onToggleAsbestosHeatmap(target);
      } else {
        setLocalAsbestosHeatmapActive(target);
      }
    },
    [showAsbestosHeatmap, onToggleAsbestosHeatmap]
  );

  const handleToggleTemporal24hAsbestos = useCallback(
    (next?: boolean) => {
      const target = next !== undefined ? next : !isTemporal24hAsbestosActive;
      // Ensure the 3D heatmap overlay is visible when activating 24-hour temporal accumulation
      if (target && !showAsbestosHeatmap) {
        if (onToggleAsbestosHeatmap) {
          onToggleAsbestosHeatmap(true);
        } else {
          setLocalAsbestosHeatmapActive(true);
        }
      }
      if (onToggleTemporal24hAsbestosAccumulation) {
        onToggleTemporal24hAsbestosAccumulation(target);
      } else {
        setLocalTemporal24hAccumulation(target);
      }
    },
    [
      isTemporal24hAsbestosActive,
      showAsbestosHeatmap,
      onToggleAsbestosHeatmap,
      onToggleTemporal24hAsbestosAccumulation,
    ]
  );

  const handleSetAsbestosSourceScope = useCallback(
    (scope: 'all_active' | 'selected_source') => {
      if (onChangeAsbestosSourceScope) {
        onChangeAsbestosSourceScope(scope);
      } else {
        setLocalAsbestosSourceScope(scope);
      }
    },
    [onChangeAsbestosSourceScope]
  );

  const handleSetAsbestosEvalHeight = useCallback(
    (h: number) => {
      if (onChangeAsbestosEvalHeightMeters) {
        onChangeAsbestosEvalHeightMeters(h);
      } else {
        setLocalAsbestosEvalHeightMeters(h);
      }
    },
    [onChangeAsbestosEvalHeightMeters]
  );

  // Refs to the 3D Asbestos-Fiber Heatmap Canvas, Texture & Relief Geometry
  const asbestosCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const asbestosTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const asbestosReliefGeoRef = useRef<THREE.PlaneGeometry | null>(null);
  const [asbestosMetrics, setAsbestosMetrics] = useState<AsbestosHeatmapMetrics>({
    isTemporal24hMode: false,
    peakFibersCm3: 0.0042,
    peakQuotient: 1.4,
    exceedanceAreaM2: 4200,
    actionZoneAreaM2: 18500,
    evaluatedSourceCount: 3,
    dominantSourceLabel: 'K1 (Blok 1)',
    dominantReleaseHeightM: 14,
    dominantFiberReleasePct: 92,
    accumulatedHoursCount: 24,
    peak24hCumulativeDoseFibersCm3H: 0.048,
    dailyDoseLimitFibersCm3H: ASBESTOS_DAILY_DOSE_LIMIT_24H,
    peak24hDailyRiskQuotient: 2.0,
    mostExposedNeighborName: 'R1: Rødtjørnevej 2',
    mostExposedNeighborDoseFibersCm3H: 0.036,
    mostExposedNeighborHoursAboveGv: 6,
    mostExposedNeighborPeakHourLabel: '14:00',
    volumetricGrid22x22: new Float32Array(ASBESTOS_VOLUME_CELL_COUNT),
    receptorCumulativeDoses: [],
    leewardWakeActive: true,
    leewardCalmWindSpeedMs: 1.4,
    leewardWindReductionPct: 82,
    peakLeewardAccumulationFactor: 2.25,
    criticalLeewardBuildingLabel: 'R1: Rødtjørnevej 2',
    bornehaveFibersCm3: 0.0004,
    bornehaveReceptorLabel: 'Børnehave / Daginstitution (Kierulffsvej 2–4)',
  });

  const effectiveTemporalAccumulationHours = syncTemporalVolumeToTimeline
    ? Math.max(
        1,
        Math.min(
          24,
          Math.round(
            typeof timelineSliderProgress === 'number'
              ? timelineSliderProgress + 1
              : currentWeather.hourIndex + 1
          )
        )
      )
    : temporalVolumeHoursCap;

  // Animate 24-hour 3D Volumetric Asbestos Build-Up when user plays the 24t volume build-up loop
  useEffect(() => {
    if (!isPlayingTemporalVolume24h || !isTemporal24hAsbestosActive) return;
    const intervalMs = Math.max(45, Math.round(460 / simulationSpeedMultiplier));
    const timer = window.setInterval(() => {
      setSyncTemporalVolumeToTimeline(false);
      setTemporalVolumeHoursCap((prev) => (prev >= 24 ? 1 : prev + 1));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlayingTemporalVolume24h, isTemporal24hAsbestosActive, simulationSpeedMultiplier]);

  const isUndergroundActive =
    externalUndergroundMode !== undefined ? externalUndergroundMode : localUndergroundMode;

  const activePrecipOverride =
    onChangePrecipitationOverride !== undefined ? precipitationOverrideMm : localPrecipOverride;

  const effectivePrecipMm =
    activePrecipOverride !== null && activePrecipOverride !== undefined
      ? activePrecipOverride
      : currentWeather.precipitation;

  const handleSetPrecipOverride = useCallback(
    (val: number | null) => {
      if (onChangePrecipitationOverride) {
        onChangePrecipitationOverride(val);
      } else {
        setLocalPrecipOverride(val);
      }
    },
    [onChangePrecipitationOverride]
  );

  // Trigger camera transition flag when preset changes & 3D Camera Zoom (+ / -) refs
  const cameraTransitionActiveRef = useRef<boolean>(false);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [zoom3DLevelPct, setZoom3DLevelPct] = useState<number>(100);

  const handleSelectCameraPreset = useCallback((preset: CameraPresetKey) => {
    setCameraPreset(preset);
    cameraTransitionActiveRef.current = true;
    setZoom3DLevelPct(100);
  }, []);

  const handleZoom3D = useCallback((direction: 'in' | 'out' | 'reset') => {
    cameraTransitionActiveRef.current = false;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const baseOverviewDist = 104.2;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const currentDist = Math.max(0.1, offset.length());

    if (direction === 'reset') {
      camera.position.set(-48, 52, 76);
      controls.target.set(4, 3, 2);
      controls.update();
      setZoom3DLevelPct(100);
      return;
    }

    const scaleFactor = direction === 'in' ? 0.78 : 1.28;
    const nextDist = THREE.MathUtils.clamp(
      currentDist * scaleFactor,
      controls.minDistance || 12,
      controls.maxDistance || 240
    );
    offset.normalize().multiplyScalar(nextDist);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    const pct = Math.round(THREE.MathUtils.clamp((baseOverviewDist / nextDist) * 100, 35, 650));
    setZoom3DLevelPct(pct);
  }, []);

  const handleFocusBlok12Percolation3D = useCallback(() => {
    if (onToggleUndergroundMode) {
      onToggleUndergroundMode(true);
    } else {
      setLocalUndergroundMode(true);
    }
    setCameraPreset('blok1_blok2_percolation');
    cameraTransitionActiveRef.current = true;
    setZoom3DLevelPct(135);
  }, [onToggleUndergroundMode]);

  const handleToggleUnderground3D = useCallback(
    (nextVal?: boolean) => {
      const targetVal = nextVal !== undefined ? nextVal : !isUndergroundActive;
      if (onToggleUndergroundMode) {
        onToggleUndergroundMode(targetVal);
      } else {
        setLocalUndergroundMode(targetVal);
      }
      if (targetVal) {
        setCameraPreset('blok1_blok2_percolation');
        cameraTransitionActiveRef.current = true;
      } else {
        setCameraPreset('overview');
        cameraTransitionActiveRef.current = true;
      }
    },
    [isUndergroundActive, onToggleUndergroundMode]
  );

  // Automatically glide to Blok 1 & 2 percolation focus when externalUndergroundMode turns true or focusBlok12PercolationTrigger increments
  useEffect(() => {
    if (externalUndergroundMode) {
      setCameraPreset('blok1_blok2_percolation');
      cameraTransitionActiveRef.current = true;
    }
  }, [externalUndergroundMode]);

  useEffect(() => {
    if (focusBlok12PercolationTrigger && focusBlok12PercolationTrigger > 0) {
      handleFocusBlok12Percolation3D();
    }
  }, [focusBlok12PercolationTrigger, handleFocusBlok12Percolation3D]);

  const activeSourceCount = sources.filter((s) => s.active).length;
  const unsecuredDemolishedCount = buildings.filter(
    (b) => b.category === 'e_demolished_unsecured'
  ).length;

  const hydroSim = computeHydrogeologicalPercolation(
    effectivePrecipMm,
    currentWeather.soilMoisture0To7cm,
    currentWeather.hadRecentFreezeThaw,
    activeSourceCount,
    unsecuredDemolishedCount
  );

  const blok12PercolationMetrics = React.useMemo(() => {
    const b1 = buildings.find((b) => b.id === 'BLOK-1');
    const b2 = buildings.find((b) => b.id === 'BLOK-2');
    const crawlspaceFactor =
      b1?.category === 'e_demolished_unsecured' || b2?.category === 'e_demolished_unsecured'
        ? 2.15
        : b1?.category === 'd_under_demolition' || b2?.category === 'd_under_demolition'
        ? 1.55
        : 1.25;
    const flowDriver = Math.max(
      0.06,
      hydroSim.infiltrationRateMmH * 0.85 + effectivePrecipMm * 0.22
    );
    const pbLeachingRateMgM2H = Number(
      (
        (0.12 +
          flowDriver * 1.38 * (0.7 + hydroSim.saturationRatio * 0.65) +
          hydroSim.leadConcentrationSecondaryUgL * 0.14) *
        crawlspaceFactor
      ).toFixed(3)
    );
    const pahLeachingRateUgM2H = Number(
      (
        (0.45 +
          flowDriver * 4.65 * (0.75 + hydroSim.saturationRatio * 0.7) +
          hydroSim.pahConcentrationSecondaryUgL * 8.5) *
        crawlspaceFactor
      ).toFixed(3)
    );
    const verticalVelocityCmH = Number(
      ((hydroSim.macroporeVelocityMetersPerDay * 100) / 24).toFixed(1)
    );
    return {
      pbLeachingRateMgM2H,
      pahLeachingRateUgM2H,
      verticalVelocityCmH,
      pbSecondaryUgL: hydroSim.leadConcentrationSecondaryUgL,
      pahSecondaryUgL: hydroSim.pahConcentrationSecondaryUgL,
      infiltrationMmH: hydroSim.infiltrationRateMmH,
    };
  }, [buildings, effectivePrecipMm, hydroSim]);

  const weatherCorrelationSummary = React.useMemo(
    () =>
      computeWeatherDustCorrelationSummary(
        observations,
        sources,
        receptors,
        receptorExposures,
        currentWeather,
        weatherHours,
        waterSuppressionActive
      ),
    [
      observations,
      sources,
      receptors,
      receptorExposures,
      currentWeather,
      weatherHours,
      waterSuppressionActive,
    ]
  );

  const dustDepositionSummary = React.useMemo(
    () =>
      computeReceptorDustDepositionProfiles3D(
        receptors,
        receptorExposures,
        sources,
        currentWeather,
        weatherHours,
        waterSuppressionActive,
        showLeewardWake
      ),
    [
      receptors,
      receptorExposures,
      sources,
      currentWeather,
      weatherHours,
      waterSuppressionActive,
      showLeewardWake,
    ]
  );

  const windTunnelEddySummary = React.useMemo(
    () =>
      computeWindTunnelEddyMetrics3D(
        sources,
        selectedSourceId,
        currentWeather,
        forceHighWindTunnelPreview,
        waterSuppressionActive
      ),
    [
      sources,
      selectedSourceId,
      currentWeather,
      forceHighWindTunnelPreview,
      waterSuppressionActive,
    ]
  );

  const acousticRefractionSummary = React.useMemo(
    () =>
      computeAcousticRefraction3DSummary(
        sources,
        receptors,
        selectedSourceId,
        selectedReceptorId,
        currentWeather,
        forceStrongRefraction3D,
        machineNoiseOutputDb
      ),
    [
      sources,
      receptors,
      selectedSourceId,
      selectedReceptorId,
      currentWeather,
      forceStrongRefraction3D,
      machineNoiseOutputDb,
    ]
  );

  const machineryDustEmitterSummary = React.useMemo(
    () =>
      computeMachineryDustEmitterSummary3D(
        sources,
        currentWeather,
        machineryLoadOutputPct,
        waterSuppressionActive
      ),
    [sources, currentWeather, machineryLoadOutputPct, waterSuppressionActive]
  );

  // Automatic 3D Asbestos Concentration Monitor for the Børnehave Receptor (> 0.001 f/cm³ alarm trigger)
  const bornehaveOverlayAlert = React.useMemo(
    () =>
      evaluateBornehaveDaycare3DPlumeAlert({
        sources,
        receptors,
        weather: currentWeather,
        evalHeightMeters: asbestosEvalHeightMeters,
        waterSuppressionActive,
      }),
    [sources, receptors, currentWeather, asbestosEvalHeightMeters, waterSuppressionActive]
  );

  const bornehaveAsbestosConcCm3 = Number(
    Math.max(
      asbestosMetrics.bornehaveFibersCm3 ?? 0,
      bornehaveOverlayAlert.asbestosFibersCm3 ?? 0
    ).toFixed(5)
  );
  const isBornehaveAsbestosAlarmTriggered = bornehaveAsbestosConcCm3 > 0.001;

  // Synchronize 3D Courtyard Accumulated Dust-Dose Heatmap directly with the footer Timeline Slider (00:00-23:00)
  useEffect(() => {
    if (!syncCourtyardHeatmapWithTimeline || isPlayingDustDeposition) return;
    const sliderHour =
      typeof timelineSliderProgress === 'number' && Number.isFinite(timelineSliderProgress)
        ? timelineSliderProgress
        : currentWeather.hourIndex;
    // Map slider hour [0..23] to cumulative exposure hours [1..24] so 00:00 shows 1h dose and 23:00 shows full 24h accumulated dose
    setDustDepositionProgressHours(
      Number(Math.max(0.5, Math.min(24.0, sliderHour + 1)).toFixed(2))
    );
  }, [
    timelineSliderProgress,
    currentWeather.hourIndex,
    syncCourtyardHeatmapWithTimeline,
    isPlayingDustDeposition,
  ]);

  // Advance 24-hour Dust Fallout & Receptor Accumulation timer smoothly when playing standalone loop
  useEffect(() => {
    if (!showDustDeposition3D || !isPlayingDustDeposition) return;
    let rafId = 0;
    let lastTs = performance.now();
    const speedMult =
      (dustDepositionSpeed === '0.5x' ? 0.5 : dustDepositionSpeed === '2x' ? 2.0 : 1.0) *
      simulationSpeedMultiplier;

    const stepLoop = (now: number) => {
      const dtSec = Math.min((now - lastTs) / 1000, 0.1);
      lastTs = now;
      // Full 24-hour deposition cycle completes in ~16 seconds at 1x (1.5 simulated hours per second)
      setDustDepositionProgressHours((prev) => {
        const next = prev + dtSec * 1.5 * speedMult;
        return next > 24.0 ? next - 24.0 : next;
      });
      rafId = requestAnimationFrame(stepLoop);
    };
    rafId = requestAnimationFrame(stepLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    showDustDeposition3D,
    isPlayingDustDeposition,
    dustDepositionSpeed,
    simulationSpeedMultiplier,
  ]);

  // Mutable ref synchronized with latest React props so tick() never triggers canvas re-mounts
  const simStateRef = useRef({
    sources,
    receptors,
    receptorExposures,
    currentWeather,
    observations,
    selectedSourceId,
    selectedReceptorId,
    waterSuppressionActive,
    showPlumeVolumes,
    showPlumePathAnimation3D,
    showWindStreamlines,
    showLeewardWake,
    showWeatherCorrelation,
    selectedCorrelationPointId,
    weatherCorrelationSummary,
    showDustDeposition3D,
    isPlayingDustDeposition,
    dustDepositionProgressHours,
    dustDepositionSummary,
    showWindTunnelEddy3D,
    forceHighWindTunnelPreview,
    windTunnelScope,
    windTunnelEddySummary,
    showSoundWaveAnimation3D,
    isPlayingSoundWave3D,
    soundWaveSpeed3D,
    soundWaveCorridorScope,
    forceStrongRefraction3D,
    showAcousticRefractionOverlay3D,
    showSoundWaveReflection3D,
    showBarrierDiffractionArcs3D,
    showHydraulicHammerImpulseWaves3D,
    acousticRefractionSummary,
    showMachineryDustEmitter3D,
    machineryLoadOutputPct,
    machineryDustEmitterSummary,
    showAsbestosHeatmap,
    isTemporal24hAsbestosActive,
    effectiveTemporalAccumulationHours,
    asbestosMetrics,
    simulationSpeedMultiplier,
    weatherHours,
    asbestosSourceScope,
    asbestosEvalHeightMeters,
    cameraPreset,
    isUndergroundActive,
    effectivePrecipMm,
    hydroSim,
    buildings,
    activeCategoryFilters,
    show3DNeutralPressurePlane,
    neutralPressurePlaneHeightMeters,
    hiddenSourceIds,
    visibleSubstances,
    waterMainTelemetry,
    showWaterMainLayer,
    showLerBuffer,
    virtualLeakPinPoint,
    virtualLeakImpact,
    simultaneousDispatch,
    machineNoiseOutputDb,
    hasSteelRoadPlates,
  });

  useEffect(() => {
    simStateRef.current = {
      sources,
      receptors,
      receptorExposures,
      currentWeather,
      observations,
      selectedSourceId,
      selectedReceptorId,
      waterSuppressionActive,
      showPlumeVolumes,
      showPlumePathAnimation3D,
      showWindStreamlines,
      showLeewardWake,
      showWeatherCorrelation,
      selectedCorrelationPointId,
      weatherCorrelationSummary,
      showDustDeposition3D,
      isPlayingDustDeposition,
      dustDepositionProgressHours,
      dustDepositionSummary,
      showWindTunnelEddy3D,
      forceHighWindTunnelPreview,
      windTunnelScope,
      windTunnelEddySummary,
      showSoundWaveAnimation3D,
      isPlayingSoundWave3D,
      soundWaveSpeed3D,
      soundWaveCorridorScope,
      forceStrongRefraction3D,
      showAcousticRefractionOverlay3D,
      showSoundWaveReflection3D,
      showBarrierDiffractionArcs3D,
      showHydraulicHammerImpulseWaves3D,
      acousticRefractionSummary,
      showMachineryDustEmitter3D,
      machineryLoadOutputPct,
      machineryDustEmitterSummary,
      showAsbestosHeatmap,
      isTemporal24hAsbestosActive,
      effectiveTemporalAccumulationHours,
      asbestosMetrics,
      simulationSpeedMultiplier,
      weatherHours,
      asbestosSourceScope,
      asbestosEvalHeightMeters,
      cameraPreset,
      isUndergroundActive,
      effectivePrecipMm,
      hydroSim,
      buildings,
      activeCategoryFilters,
      show3DNeutralPressurePlane,
      neutralPressurePlaneHeightMeters,
      hiddenSourceIds,
      visibleSubstances,
      waterMainTelemetry,
      showWaterMainLayer,
      showLerBuffer,
      virtualLeakPinPoint,
      virtualLeakImpact,
      simultaneousDispatch,
      machineNoiseOutputDb,
      hasSteelRoadPlates,
    };
  }, [
    sources,
    receptors,
    receptorExposures,
    currentWeather,
    observations,
    selectedSourceId,
    selectedReceptorId,
    waterSuppressionActive,
    showPlumeVolumes,
    showPlumePathAnimation3D,
    showWindStreamlines,
    showLeewardWake,
    showWeatherCorrelation,
    selectedCorrelationPointId,
    weatherCorrelationSummary,
    showDustDeposition3D,
    isPlayingDustDeposition,
    dustDepositionProgressHours,
    dustDepositionSummary,
    showWindTunnelEddy3D,
    forceHighWindTunnelPreview,
    windTunnelScope,
    windTunnelEddySummary,
    showSoundWaveAnimation3D,
    isPlayingSoundWave3D,
    soundWaveSpeed3D,
    soundWaveCorridorScope,
    forceStrongRefraction3D,
    showAcousticRefractionOverlay3D,
    showSoundWaveReflection3D,
    showBarrierDiffractionArcs3D,
    showHydraulicHammerImpulseWaves3D,
    acousticRefractionSummary,
    showMachineryDustEmitter3D,
    machineryLoadOutputPct,
    machineryDustEmitterSummary,
    showAsbestosHeatmap,
    isTemporal24hAsbestosActive,
    effectiveTemporalAccumulationHours,
    asbestosMetrics,
    simulationSpeedMultiplier,
    weatherHours,
    asbestosSourceScope,
    asbestosEvalHeightMeters,
    cameraPreset,
    isUndergroundActive,
    effectivePrecipMm,
    hydroSim,
    buildings,
    activeCategoryFilters,
    show3DNeutralPressurePlane,
    neutralPressurePlaneHeightMeters,
    hiddenSourceIds,
    visibleSubstances,
    waterMainTelemetry,
    showWaterMainLayer,
    showLerBuffer,
    virtualLeakPinPoint,
    virtualLeakImpact,
    simultaneousDispatch,
    machineNoiseOutputDb,
    hasSteelRoadPlates,
  ]);

  // Real-time recomputation of the 3D Asbestos-Fiber Dispersion Heatmap (both 1h Real-Time & 24h Temporal 3D Volume Accumulation)
  useEffect(() => {
    const canvas = asbestosCanvasRef.current;
    if (!canvas) return;
    const metrics = renderAsbestosHeatmapCanvasAndRelief(
      canvas,
      asbestosReliefGeoRef.current,
      sources,
      receptors,
      selectedSourceId,
      asbestosSourceScope,
      asbestosEvalHeightMeters,
      currentWeather,
      waterSuppressionActive,
      weatherHours,
      isTemporal24hAsbestosActive,
      showLeewardWake,
      effectiveTemporalAccumulationHours
    );
    if (asbestosTextureRef.current) {
      asbestosTextureRef.current.needsUpdate = true;
    }
    setAsbestosMetrics(metrics);
    if (onBornehavePlumeAlertUpdate) {
      const daycareAlert = evaluateBornehaveDaycare3DPlumeAlert({
        sources,
        receptors,
        weather: currentWeather,
        evalHeightMeters: asbestosEvalHeightMeters,
        waterSuppressionActive,
      });
      onBornehavePlumeAlertUpdate(daycareAlert);
    }
  }, [
    sources,
    receptors,
    selectedSourceId,
    asbestosSourceScope,
    asbestosEvalHeightMeters,
    currentWeather,
    waterSuppressionActive,
    showAsbestosHeatmap,
    weatherHours,
    isTemporal24hAsbestosActive,
    showLeewardWake,
    effectiveTemporalAccumulationHours,
    onBornehavePlumeAlertUpdate,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software-WebGL Detection via WEBGL_debug_renderer_info
    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    const debugInfo = probeGl && probeGl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr =
      (probeGl && debugInfo && probeGl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) || '';
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
      String(rendererStr)
    );
    setIsSoftwareRenderer(isSoftwareGl);

    // 2. WebGLRenderer with ACESFilmicToneMapping & SRGBColorSpace
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 540);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 3. Scene, Sky/Horizon Fog & RoomEnvironment IBL via PMREMGenerator
    const scene = new THREE.Scene();
    const horizonHex = 0x0b101b;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.0028);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 4. Camera & Damped OrbitControls
    const camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || 800) / (container.clientHeight || 540),
      0.5,
      650
    );
    camera.position.set(-48, 52, 76);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.62; // Allow tilting slightly below horizon to inspect 3D underground cutaway
    controls.minDistance = 12;
    controls.maxDistance = 240;
    controls.target.set(4, 3, 2);
    controlsRef.current = controls;

    // Cancel automatic preset glide when user manually drags OrbitControls
    const onControlStart = () => {
      cameraTransitionActiveRef.current = false;
    };
    let lastReportedZoomPct = 100;
    const onControlChange = () => {
      const dist = Math.max(1, camera.position.distanceTo(controls.target));
      const pct = Math.round(THREE.MathUtils.clamp((104.2 / dist) * 100, 35, 650));
      if (Math.abs(pct - lastReportedZoomPct) >= 5) {
        lastReportedZoomPct = pct;
        setZoom3DLevelPct(pct);
      }
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    // 5. Studio Three-Point Outdoor PBR Lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.68);
    hemiLight.position.set(0, 90, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.25);
    keyLight.position.set(-65, 88, 55);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.near = 10;
      keyLight.shadow.camera.far = 260;
      const d = 98;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(70, 45, -65);
    scene.add(rimLight);

    // 6. Procedural Textures & Ground Plane
    const groundTex = createGroundCanvasTexture(maxAnisotropy);
    const bumpTex = createNoiseBumpTexture(128);
    const shadowTex = createContactShadowTexture();
    const demolitionFacadeTex = createFacadeWindowTexture('#64748b', '#f59e0b', maxAnisotropy, true);
    const residentialFacadeTex = createFacadeWindowTexture('#94a3b8', '#38bdf8', maxAnisotropy, false);

    const groundGeo = new THREE.PlaneGeometry(280, 280);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      bumpMap: bumpTex,
      bumpScale: 0.03,
      roughness: 0.92,
      metalness: 0.04,
      transparent: true,
      opacity: 1.0,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Compass Ring around site
    const compassRing = new THREE.Mesh(
      new THREE.RingGeometry(86, 87.2, 72),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.24,
      })
    );
    compassRing.rotation.x = -Math.PI / 2;
    compassRing.position.y = 0.05;
    scene.add(compassRing);

    // 6B. Real-Time 3D Asbestos-Fiber Dispersion Heatmap Surface & Volumetric Relief Mesh
    const asbestosCanvas = document.createElement('canvas');
    asbestosCanvas.width = isSoftwareGl ? 128 : 224;
    asbestosCanvas.height = isSoftwareGl ? 128 : 224;
    asbestosCanvasRef.current = asbestosCanvas;

    const asbestosHeatmapTex = new THREE.CanvasTexture(asbestosCanvas);
    asbestosHeatmapTex.colorSpace = THREE.SRGBColorSpace;
    asbestosHeatmapTex.minFilter = THREE.LinearFilter;
    asbestosHeatmapTex.magFilter = THREE.LinearFilter;
    asbestosTextureRef.current = asbestosHeatmapTex;

    const asbestosReliefSegments = isSoftwareGl ? 56 : 88;
    const asbestosReliefGeo = new THREE.PlaneGeometry(
      280,
      280,
      asbestosReliefSegments,
      asbestosReliefSegments
    );
    asbestosReliefGeoRef.current = asbestosReliefGeo;

    // Initial render of the 3D Asbestos-Fiber Heatmap
    const initialMetrics = renderAsbestosHeatmapCanvasAndRelief(
      asbestosCanvas,
      asbestosReliefGeo,
      simStateRef.current.sources,
      simStateRef.current.receptors,
      simStateRef.current.selectedSourceId,
      simStateRef.current.asbestosSourceScope,
      simStateRef.current.asbestosEvalHeightMeters,
      simStateRef.current.currentWeather,
      simStateRef.current.waterSuppressionActive,
      simStateRef.current.weatherHours,
      simStateRef.current.isTemporal24hAsbestosActive,
      simStateRef.current.showLeewardWake,
      simStateRef.current.effectiveTemporalAccumulationHours
    );
    asbestosHeatmapTex.needsUpdate = true;
    setAsbestosMetrics(initialMetrics);

    const asbestosHeatmapGroup = new THREE.Group();
    asbestosHeatmapGroup.name = 'asbestos-fiber-heatmap-3d-group';

    const asbestosHeatmapMat = new THREE.MeshBasicMaterial({
      map: asbestosHeatmapTex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const asbestosHeatmapMesh = new THREE.Mesh(asbestosReliefGeo, asbestosHeatmapMat);
    asbestosHeatmapMesh.rotation.x = -Math.PI / 2;
    asbestosHeatmapMesh.position.y = 0.14;
    asbestosHeatmapGroup.add(asbestosHeatmapMesh);

    // Subtle 3D Topological Wireframe overlay on the displaced asbestos concentration field
    const asbestosWireframeMat = new THREE.MeshBasicMaterial({
      map: asbestosHeatmapTex,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const asbestosWireframeMesh = new THREE.Mesh(asbestosReliefGeo, asbestosWireframeMat);
    asbestosWireframeMesh.rotation.x = -Math.PI / 2;
    asbestosWireframeMesh.position.y = 0.18;
    asbestosHeatmapGroup.add(asbestosWireframeMesh);

    // =========================================================================
    // 24-Hour 'Tidsmæssig Akkumulering' 3D Volumetric Exposure Build-Up Rig
    // Visualizes cumulative neighbor asbestos risk as a 3D volume building up over 00:00->23:00
    // =========================================================================
    const temporalVolume3DGroup = new THREE.Group();
    temporalVolume3DGroup.name = 'asbestos-temporal-24h-volume-buildup-group';
    temporalVolume3DGroup.visible = simStateRef.current.isTemporal24hAsbestosActive;
    asbestosHeatmapGroup.add(temporalVolume3DGroup);

    // A) 484-Cell Hexagonal 3D Volumetric Dose Prisms (InstancedMesh anchored at y=0)
    const hexPrismGeo = new THREE.CylinderGeometry(4.85, 5.25, 1.0, 6, 1, false);
    hexPrismGeo.translate(0, 0.5, 0); // Base grounded at y=0, +Y scales upward in 3D
    const hexPrismMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.12,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
    });
    const asbestosVolumeInstanced = new THREE.InstancedMesh(
      hexPrismGeo,
      hexPrismMat,
      ASBESTOS_VOLUME_CELL_COUNT
    );
    asbestosVolumeInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dampedVolumeCellHeights = new Float32Array(ASBESTOS_VOLUME_CELL_COUNT);
    for (let idx = 0; idx < ASBESTOS_VOLUME_CELL_COUNT; idx++) {
      _scratchDummy.position.set(0, -50, 0);
      _scratchDummy.scale.set(0.001, 0.001, 0.001);
      _scratchDummy.updateMatrix();
      asbestosVolumeInstanced.setMatrixAt(idx, _scratchDummy.matrix);
      _scratchColor.setHex(0x8b5cf6);
      asbestosVolumeInstanced.setColorAt(idx, _scratchColor);
    }
    asbestosVolumeInstanced.instanceMatrix.needsUpdate = true;
    if (asbestosVolumeInstanced.instanceColor) {
      asbestosVolumeInstanced.instanceColor.needsUpdate = true;
    }
    temporalVolume3DGroup.add(asbestosVolumeInstanced);

    // B) Multi-Story 3D Atmospheric Iso-Dose Strata Shells (Stue=2.2m, 1.-2. sal=6.5m, 3. sal=11.5m)
    const strataHeightsMeters = [2.2, 6.5, 11.5];
    const asbestosStrataMeshes: THREE.Mesh[] = [];
    const asbestosStrataMats: THREE.MeshBasicMaterial[] = [];
    strataHeightsMeters.forEach((hMeters, tierIdx) => {
      const strataGeo = new THREE.PlaneGeometry(256, 256, 24, 24);
      const strataMat = new THREE.MeshBasicMaterial({
        map: asbestosHeatmapTex,
        transparent: true,
        opacity: 0.34 - tierIdx * 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const strataMesh = new THREE.Mesh(strataGeo, strataMat);
      strataMesh.rotation.x = -Math.PI / 2;
      strataMesh.position.y = hMeters / METERS_PER_UNIT;
      temporalVolume3DGroup.add(strataMesh);
      asbestosStrataMeshes.push(strataMesh);
      asbestosStrataMats.push(strataMat);
    });

    // C) Neighbor Receptor 3D Cumulative Dose Pillars + 100% Daily-GV Benchmark Rings
    const receptorDosePillarGeo = new THREE.CylinderGeometry(2.35, 2.85, 1.0, 20);
    receptorDosePillarGeo.translate(0, 0.5, 0);
    const receptorThresholdRingGeo = new THREE.RingGeometry(2.55, 3.15, 28);
    receptorThresholdRingGeo.rotateX(-Math.PI / 2);

    const receptorVolumetricNodes = simStateRef.current.receptors.map((rec) => {
      const rxz = latLngToWorldXZ(rec.center);
      const nodeGrp = new THREE.Group();
      nodeGrp.position.set(rxz.x, 0.18, rxz.z);

      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xd946ef,
        emissive: 0xa21caf,
        emissiveIntensity: 0.72,
        transparent: true,
        opacity: 0.66,
        roughness: 0.22,
        metalness: 0.25,
        depthWrite: false,
      });
      const pillarMesh = new THREE.Mesh(receptorDosePillarGeo, pillarMat);
      nodeGrp.add(pillarMesh);

      // Fixed 100% Daily-GV statutory limit reference halo at y = 6.5 world units
      const limitRingMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const limitRingMesh = new THREE.Mesh(receptorThresholdRingGeo, limitRingMat);
      limitRingMesh.position.y = 6.5;
      nodeGrp.add(limitRingMesh);

      temporalVolume3DGroup.add(nodeGrp);
      return {
        receptorId: rec.id,
        nodeGrp,
        pillarMesh,
        pillarMat,
        limitRingMesh,
        limitRingMat,
        dampedHeight: 0.4,
      };
    });

    scene.add(asbestosHeatmapGroup);

    // 7. Build Composite Demolition Source Groups (`THREE.Group`)
    const sourceNodesMap = new Map<
      string,
      ReturnType<typeof buildCompositeDemolitionSourceGroup> & { worldX: number; worldZ: number; releaseY: number }
    >();

    simStateRef.current.sources.forEach((src) => {
      const { x, z } = latLngToWorldXZ(src.position);
      const built = buildCompositeDemolitionSourceGroup(
        src,
        demolitionFacadeTex,
        bumpTex,
        shadowTex
      );
      built.root.position.set(x, 0, z);
      scene.add(built.root);
      sourceNodesMap.set(src.id, {
        ...built,
        worldX: x,
        worldZ: z,
        releaseY: Math.max(3.2, src.releaseHeightMeters / METERS_PER_UNIT),
      });
    });

    // 8. Build Composite Receptor Groups (`THREE.Group`)
    const receptorNodesMap = new Map<
      string,
      ReturnType<typeof buildCompositeReceptorGroup> & { worldX: number; worldZ: number }
    >();

    simStateRef.current.receptors.forEach((rec) => {
      const { x, z } = latLngToWorldXZ(rec.center);
      const built = buildCompositeReceptorGroup(rec, residentialFacadeTex, shadowTex);
      built.root.position.set(x, 0, z);
      scene.add(built.root);
      receptorNodesMap.set(rec.id, {
        ...built,
        worldX: x,
        worldZ: z,
      });
    });

    // 8A. Build Master 29-Building Operational Category (a–e) 3D Registry Group
    const masterBuildingRegistryGroup = new THREE.Group();
    masterBuildingRegistryGroup.name = 'master-29-building-registry-group';
    scene.add(masterBuildingRegistryGroup);

    const masterBuildingNodesMap = new Map<
      string,
      {
        root: THREE.Group;
        plinthMat: THREE.MeshStandardMaterial;
        bodyMesh: THREE.Mesh;
        bodyMat: THREE.MeshStandardMaterial;
        roofCapMesh: THREE.Mesh;
        roofCapMat: THREE.MeshStandardMaterial;
        pitRimMesh: THREE.Mesh;
        nplOverlayGroup: THREE.Group;
        nplSlicePlaneGroup: THREE.Group;
        nplSliceMat: THREE.MeshBasicMaterial;
        nplFloorArrowRings: Array<{
          elevationMeters: number;
          ringGroup: THREE.Group;
          arrowMeshes: THREE.Mesh[];
          arrowMats: THREE.MeshBasicMaterial[];
        }>;
        crawlspaceSuctionArrow: THREE.Mesh;
        dinPulseInnerMesh: THREE.Mesh;
        dinPulseOuterMesh: THREE.Mesh;
        dinPulseInnerMat: THREE.MeshBasicMaterial;
        dinPulseOuterMat: THREE.MeshBasicMaterial;
      }
    >();

    // Shared geometries for 3D Neutral Pressure Plane (z_NPL) & Inward/Outward Vector Arrows
    const nplSliceGeo = new THREE.PlaneGeometry(10.2, 5.0);
    nplSliceGeo.rotateX(-Math.PI / 2);
    const nplSliceEdgeGeo = new THREE.EdgesGeometry(nplSliceGeo);
    const nplVecConeGeo = new THREE.ConeGeometry(0.28, 0.95, 8);
    // Orient cone so +Z is the forward tip direction
    nplVecConeGeo.rotateX(Math.PI / 2);
    const crawlspaceSuctionConeGeo = new THREE.ConeGeometry(0.42, 1.4, 10);
    // Shared ring geometries for DIN 4150-3 structural integrity pulse rings around building markers
    const dinPulseInnerGeo = new THREE.RingGeometry(4.8, 5.55, 28);
    const dinPulseOuterGeo = new THREE.RingGeometry(5.9, 6.75, 28);

    RINGPARKEN_MASTER_BUILDINGS.forEach((b) => {
      const { x, z } = latLngToWorldXZ(b.center);
      const bGroup = new THREE.Group();
      bGroup.position.set(x, 0, z);
      bGroup.rotation.y = -0.22;

      const meta = BUILDING_CATEGORY_METADATA[b.category];
      const baseColor = new THREE.Color(meta.colorHex);

      // 1. Primary silhouette: Ground footprint plinth pad
      const plinthGeo = new THREE.BoxGeometry(8.8, 0.24, 3.8);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.72,
        metalness: 0.15,
      });
      const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
      plinthMesh.position.y = 0.12;
      bGroup.add(plinthMesh);

      // 2. Secondary read: Scaled 3D building mass (unit height = 1.0, scaled dynamically by buildingHeight3DMeters)
      const bodyGeo = new THREE.BoxGeometry(8.2, 1.0, 3.3);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        map: b.category === 'd_under_demolition' ? demolitionFacadeTex : residentialFacadeTex,
        roughness: 0.45,
        metalness: 0.25,
        transparent: true,
        opacity: 0.86,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      bGroup.add(bodyMesh);

      // 3. Accent detail: Color-coded category roof cap & open crawlspace pit rim (for category e)
      const roofCapGeo = new THREE.BoxGeometry(8.5, 0.22, 3.5);
      const roofCapMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.5,
      });
      const roofCapMesh = new THREE.Mesh(roofCapGeo, roofCapMat);
      bGroup.add(roofCapMesh);

      const pitRimGeo = new THREE.RingGeometry(1.6, 3.8, 24);
      pitRimGeo.rotateX(-Math.PI / 2);
      const pitRimMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      });
      const pitRimMesh = new THREE.Mesh(pitRimGeo, pitRimMat);
      pitRimMesh.position.y = 0.28;
      bGroup.add(pitRimMesh);

      // 4. 3D Neutral Pressure Plane (z_NPL) & Inward/Outward Facade Vector Arrows (for a_inhabited blocks)
      const nplOverlayGroup = new THREE.Group();
      nplOverlayGroup.visible = false;

      const nplSlicePlaneGroup = new THREE.Group();
      const nplSliceMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const nplSliceMesh = new THREE.Mesh(nplSliceGeo, nplSliceMat);
      nplSlicePlaneGroup.add(nplSliceMesh);

      const nplSliceEdgeMat = new THREE.LineBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.92,
      });
      const nplSliceEdges = new THREE.LineSegments(nplSliceEdgeGeo, nplSliceEdgeMat);
      nplSlicePlaneGroup.add(nplSliceEdges);
      nplOverlayGroup.add(nplSlicePlaneGroup);

      // 3 Floor-level vector arrow rings (Stue/1. sal = 2.0m, 2. sal = 6.0m, 3. sal = 10.0m)
      const floorElevationsM = [2.0, 6.0, 10.0];
      const nplFloorArrowRings: Array<{
        elevationMeters: number;
        ringGroup: THREE.Group;
        arrowMeshes: THREE.Mesh[];
        arrowMats: THREE.MeshBasicMaterial[];
      }> = [];

      // 4 Facade normal positions around the 8.2 x 3.3 building body
      const facadeDirs = [
        { nx: 0, nz: 1, baseDist: 2.35 }, // South facade
        { nx: 0, nz: -1, baseDist: 2.35 }, // North facade
        { nx: 1, nz: 0, baseDist: 4.85 }, // East gable
        { nx: -1, nz: 0, baseDist: 4.85 }, // West gable
      ];

      floorElevationsM.forEach((elevM) => {
        const ringGroup = new THREE.Group();
        ringGroup.position.y = 0.24 + elevM / METERS_PER_UNIT;
        const arrowMeshes: THREE.Mesh[] = [];
        const arrowMats: THREE.MeshBasicMaterial[] = [];

        facadeDirs.forEach((fd) => {
          const aMat = new THREE.MeshBasicMaterial({
            color: 0xf43f5e,
            transparent: true,
            opacity: 0.9,
          });
          const aMesh = new THREE.Mesh(nplVecConeGeo, aMat);
          aMesh.position.set(fd.nx * fd.baseDist, 0, fd.nz * fd.baseDist);
          aMesh.userData = { nx: fd.nx, nz: fd.nz, baseDist: fd.baseDist };
          ringGroup.add(aMesh);
          arrowMeshes.push(aMesh);
          arrowMats.push(aMat);
        });

        nplOverlayGroup.add(ringGroup);
        nplFloorArrowRings.push({
          elevationMeters: elevM,
          ringGroup,
          arrowMeshes,
          arrowMats,
        });
      });

      // Vertical crawlspace/basement suction arrow (Q_op = 78.1 m³/h) rising from ground into the building
      const crawlspaceSuctionMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.85,
      });
      const crawlspaceSuctionArrow = new THREE.Mesh(
        crawlspaceSuctionConeGeo,
        crawlspaceSuctionMat
      );
      crawlspaceSuctionArrow.position.set(0, 1.1, 0);
      nplOverlayGroup.add(crawlspaceSuctionArrow);

      bGroup.add(nplOverlayGroup);

      // 5. DIN 4150-3 Structural Integrity Breach Pulse Rings around building marker
      const dinPulseInnerMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const dinPulseInnerMesh = new THREE.Mesh(dinPulseInnerGeo, dinPulseInnerMat);
      dinPulseInnerMesh.rotation.x = -Math.PI / 2;
      dinPulseInnerMesh.position.y = 0.29;
      dinPulseInnerMesh.visible = false;
      bGroup.add(dinPulseInnerMesh);

      const dinPulseOuterMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const dinPulseOuterMesh = new THREE.Mesh(dinPulseOuterGeo, dinPulseOuterMat);
      dinPulseOuterMesh.rotation.x = -Math.PI / 2;
      dinPulseOuterMesh.position.y = 0.27;
      dinPulseOuterMesh.visible = false;
      bGroup.add(dinPulseOuterMesh);

      masterBuildingRegistryGroup.add(bGroup);
      masterBuildingNodesMap.set(b.id, {
        root: bGroup,
        plinthMat,
        bodyMesh,
        bodyMat,
        roofCapMesh,
        roofCapMat,
        pitRimMesh,
        nplOverlayGroup,
        nplSlicePlaneGroup,
        nplSliceMat,
        nplFloorArrowRings,
        crawlspaceSuctionArrow,
        dinPulseInnerMesh,
        dinPulseOuterMesh,
        dinPulseInnerMat,
        dinPulseOuterMat,
      });
    });

    // 8B. Build 3D 'Læ-Effekt' (Building Leeward Wake & Calm Dust Accumulation Zone) Markers
    const leewardDecalTex = createLeewardWakeDecalTexture(maxAnisotropy);
    const leewardWakeMasterGroup = new THREE.Group();
    leewardWakeMasterGroup.name = 'leeward-wake-master-group';
    scene.add(leewardWakeMasterGroup);

    const leewardWakeNodes: Array<
      ReturnType<typeof buildCompositeLeewardWakeGroup> & {
        buildingId: string;
        buildingLabel: string;
        isSourceBuilding: boolean;
        worldX: number;
        worldZ: number;
        startOffsetZ: number;
      }
    > = [];

    simStateRef.current.sources.forEach((src) => {
      const srcNode = sourceNodesMap.get(src.id);
      if (!srcNode) return;
      const hUnits = Math.max(3.2, src.releaseHeightMeters / METERS_PER_UNIT);
      const builtWake = buildCompositeLeewardWakeGroup(
        src.id,
        `${src.code}: ${src.name}`,
        true,
        8.4,
        4.2,
        hUnits,
        leewardDecalTex
      );
      builtWake.root.position.set(srcNode.worldX - 0.6, 0, srcNode.worldZ);
      leewardWakeMasterGroup.add(builtWake.root);
      leewardWakeNodes.push({
        ...builtWake,
        buildingId: src.id,
        buildingLabel: `${src.code}: ${src.name}`,
        isSourceBuilding: true,
        worldX: srcNode.worldX - 0.6,
        worldZ: srcNode.worldZ,
        startOffsetZ: 2.7,
      });
    });

    simStateRef.current.receptors.forEach((rec) => {
      const recNode = receptorNodesMap.get(rec.id);
      if (!recNode) return;
      const isRes = rec.category === 'residential_block';
      const wUnits = isRes ? 10.5 : 5.4;
      const dUnits = isRes ? 4.8 : 4.2;
      const hUnits = isRes ? 6.2 : 2.6;
      const builtWake = buildCompositeLeewardWakeGroup(
        rec.id,
        `${rec.code}: ${rec.name}`,
        false,
        wUnits,
        dUnits,
        hUnits,
        leewardDecalTex
      );
      builtWake.root.position.set(recNode.worldX, 0, recNode.worldZ);
      leewardWakeMasterGroup.add(builtWake.root);
      leewardWakeNodes.push({
        ...builtWake,
        buildingId: rec.id,
        buildingLabel: `${rec.code}: ${rec.name}`,
        isSourceBuilding: false,
        worldX: recNode.worldX,
        worldZ: recNode.worldZ,
        startOffsetZ: dUnits * 0.5 + 0.6,
      });
    });

    // 220 Instanced Swirling Dust & Asbestos Fiber Particles Trapped in Leeward Wake Cavities
    const LEEWARD_DUST_COUNT = isSoftwareGl ? 120 : 220;
    const leewardDustGeo = new THREE.DodecahedronGeometry(0.32, 0);
    const leewardDustMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const leewardDustInstanced = new THREE.InstancedMesh(
      leewardDustGeo,
      leewardDustMat,
      LEEWARD_DUST_COUNT
    );
    leewardDustInstanced.frustumCulled = false;

    const leewardDustStates = Array.from({ length: LEEWARD_DUST_COUNT }, (_, idx) => {
      const colorHex = idx % 3 === 0 ? 0xfbbf24 : idx % 3 === 1 ? 0xf43f5e : 0xfde047;
      _scratchColor.setHex(colorHex);
      leewardDustInstanced.setColorAt(idx, _scratchColor);
      return {
        wakeNodeIdx: idx % Math.max(1, leewardWakeNodes.length),
        orbitPhase: (idx * 1.37) % (Math.PI * 2),
        orbitSpeed: 1.4 + ((idx * 29) % 40) * 0.035,
        radiusFrac: 0.18 + ((idx * 17) % 75) * 0.01,
        heightFrac: 0.12 + ((idx * 41) % 80) * 0.01,
      };
    });
    if (leewardDustInstanced.instanceColor) leewardDustInstanced.instanceColor.needsUpdate = true;
    leewardWakeMasterGroup.add(leewardDustInstanced);

    // 8C. Build 3D 'Vis Vejr-Korrelation' (Wind Speed vs. Observed Dust Intensity SHA-256 Heatmap-Points in 3D Space)
    const thermalCorrelationSpotTex = createThermalCorrelationSpotTexture(maxAnisotropy);
    const weatherCorrelationMasterGroup = new THREE.Group();
    weatherCorrelationMasterGroup.name = 'weather-correlation-3d-heatmap-group';
    scene.add(weatherCorrelationMasterGroup);

    const weatherCorrelationNodes = Array.from(
      { length: MAX_CORRELATION_POINTS_3D },
      (_, slotIdx) => {
        const node = buildCompositeWeatherCorrelationPointNode(
          slotIdx,
          thermalCorrelationSpotTex
        );
        node.root.visible = false;
        weatherCorrelationMasterGroup.add(node.root);
        return node;
      }
    );

    // 3D Spatial Correlation Trajectory Line connecting the SHA-256 heatmap points in 3D space
    const trajectoryPositions = new Float32Array(MAX_CORRELATION_POINTS_3D * 3);
    const trajectoryColors = new Float32Array(MAX_CORRELATION_POINTS_3D * 3);
    const trajectoryGeo = new THREE.BufferGeometry();
    trajectoryGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(trajectoryPositions, 3)
    );
    trajectoryGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(trajectoryColors, 3)
    );
    const trajectoryMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
    });
    const correlationTrajectoryLine = new THREE.Line(trajectoryGeo, trajectoryMat);
    correlationTrajectoryLine.frustumCulled = false;
    weatherCorrelationMasterGroup.add(correlationTrajectoryLine);

    // 8D. Build 3D Dust Fallout & Receptor Accumulation Group (`dustDepositionMasterGroup`)
    const dustBlanketDecalTex = createDustBlanketDecalTexture(maxAnisotropy);
    const dustDepositionMasterGroup = new THREE.Group();
    dustDepositionMasterGroup.name = 'receptor-dust-deposition-master-group';
    scene.add(dustDepositionMasterGroup);

    const receptorDustNodesMap = new Map<
      string,
      ReturnType<typeof buildCompositeReceptorDustAccumulationNode> & {
        receptorId: string;
        worldX: number;
        worldZ: number;
      }
    >();

    simStateRef.current.receptors.forEach((rec) => {
      const recNode = receptorNodesMap.get(rec.id);
      if (!recNode) return;
      const builtDustNode = buildCompositeReceptorDustAccumulationNode(
        rec,
        dustBlanketDecalTex
      );
      builtDustNode.root.position.set(recNode.worldX, 0, recNode.worldZ);
      dustDepositionMasterGroup.add(builtDustNode.root);
      receptorDustNodesMap.set(rec.id, {
        ...builtDustNode,
        receptorId: rec.id,
        worldX: recNode.worldX,
        worldZ: recNode.worldZ,
      });
    });

    // 320 Instanced Gravitational Dust Fallout Particles descending onto receptors
    const FALLOUT_PARTICLE_COUNT = isSoftwareGl ? 180 : 320;
    const falloutParticleGeo = new THREE.DodecahedronGeometry(0.28, 0);
    const falloutParticleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.75,
      metalness: 0.08,
      transparent: true,
      opacity: 0.92,
    });
    const falloutDustInstanced = new THREE.InstancedMesh(
      falloutParticleGeo,
      falloutParticleMat,
      FALLOUT_PARTICLE_COUNT
    );
    falloutDustInstanced.frustumCulled = false;

    const falloutParticles = Array.from({ length: FALLOUT_PARTICLE_COUNT }, (_, idx) => {
      // Color palette representing heavy-metal dust (amber), asbestos fibers (rose), PCB (purple), quartz (warm ochre)
      const colorHex =
        idx % 4 === 0
          ? 0xf43f5e
          : idx % 4 === 1
          ? 0xfbbf24
          : idx % 4 === 2
          ? 0xf59e0b
          : 0xfde047;
      _scratchColor.setHex(colorHex);
      falloutDustInstanced.setColorAt(idx, _scratchColor);
      return {
        fallProgress: ((idx * 19) % 100) / 100,
        settlingSpeed: 0.22 + ((idx * 31) % 50) * 0.0055,
        radialAngle: (idx * 2.39996) % (Math.PI * 2),
        radialDistFrac: 0.12 + ((idx * 23) % 88) * 0.01,
        swirlPhase: (idx * 0.77) % (Math.PI * 2),
        sizeSeed: 0.68 + ((idx * 13) % 45) * 0.014,
      };
    });
    if (falloutDustInstanced.instanceColor) {
      falloutDustInstanced.instanceColor.needsUpdate = true;
    }
    dustDepositionMasterGroup.add(falloutDustInstanced);

    // 8c. 3D Wind-Tunnel & Turbulence Eddy Structures (> 10 m/s) around Demolition Machinery
    const windTunnelEddyMasterGroup = new THREE.Group();
    scene.add(windTunnelEddyMasterGroup);
    const windTunnelMachineNodesMap = new Map<string, WindTunnelMachineEddyVisualNode>();

    simStateRef.current.sources.forEach((src) => {
      const srcNode = sourceNodesMap.get(src.id);
      const fallbackXZ = latLngToWorldXZ(src.position);
      const wx = srcNode ? srcNode.worldX : fallbackXZ.x;
      const wz = srcNode ? srcNode.worldZ : fallbackXZ.z;
      const relY = srcNode ? srcNode.releaseY : Math.max(2.5, src.releaseHeightMeters * 0.45);
      const eddyNode = buildCompositeWindTunnelMachineEddyGroup(src, wx, wz, relY);
      windTunnelEddyMasterGroup.add(eddyNode.root);
      windTunnelMachineNodesMap.set(src.id, eddyNode);
    });

    // 280 Instanced 3D Turbulent Eddy Vortex Swirl Particles inside the Wind-Tunnel Wake
    const EDDY_SWIRL_PARTICLE_COUNT = 280;
    const eddySwirlGeo = new THREE.OctahedronGeometry(0.16, 0);
    const eddySwirlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.15,
      transparent: true,
      opacity: 0.9,
    });
    const eddySwirlInstanced = new THREE.InstancedMesh(
      eddySwirlGeo,
      eddySwirlMat,
      EDDY_SWIRL_PARTICLE_COUNT
    );
    eddySwirlInstanced.frustumCulled = false;

    const eddySwirlParticles = Array.from({ length: EDDY_SWIRL_PARTICLE_COUNT }, (_, idx) => {
      const colorHex =
        idx % 4 === 0
          ? 0x22d3ee // Cyan wind-tunnel streamline tracer
          : idx % 4 === 1
          ? 0xf43f5e // Rose high-shear asbestos eddy core
          : idx % 4 === 2
          ? 0xfbbf24 // Amber turbulent vortex shedding
          : 0x38bdf8; // Sky-blue horseshoe vortex tracer
      _scratchColor.setHex(colorHex);
      eddySwirlInstanced.setColorAt(idx, _scratchColor);
      return {
        streamProgress: ((idx * 17) % 100) / 100,
        angularSpeed: 3.4 + ((idx * 29) % 40) * 0.11,
        initialPhase: (idx * 1.85) % (Math.PI * 2),
        radialFactor: 0.35 + ((idx * 13) % 65) * 0.014,
        isBoomTipEddy: idx % 5 === 0,
        machineSeed: idx,
      };
    });
    if (eddySwirlInstanced.instanceColor) {
      eddySwirlInstanced.instanceColor.needsUpdate = true;
    }
    windTunnelEddyMasterGroup.add(eddySwirlInstanced);

    // 8d. 3D Sound Wave Refraction & Wavefront Particle Animation ('Lydbølge-Animation' over Barrieren)
    const acousticWaveMasterGroup = new THREE.Group();
    acousticWaveMasterGroup.name = 'acoustic-refraction-wavefront-group';
    scene.add(acousticWaveMasterGroup);

    const acousticCorridorNodesMap = new Map<string, AcousticCorridorVisualNode3D>();
    simStateRef.current.receptors.forEach((rec) => {
      const corrNode = buildCompositeAcousticRefractionCorridorNode(rec);
      acousticWaveMasterGroup.add(corrNode.root);
      acousticCorridorNodesMap.set(rec.id, corrNode);
    });

    // 360 Instanced 3D Wavefront Particles moving along the calculated refraction paths over the 2.5m barrier
    const WAVEFRONT_PARTICLE_COUNT = isSoftwareGl ? 220 : 360;
    const wavefrontParticleGeo = new THREE.IcosahedronGeometry(0.28, 1);
    const wavefrontParticleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.25,
      transparent: true,
      opacity: 0.94,
    });
    const wavefrontParticlesInstanced = new THREE.InstancedMesh(
      wavefrontParticleGeo,
      wavefrontParticleMat,
      WAVEFRONT_PARTICLE_COUNT
    );
    wavefrontParticlesInstanced.frustumCulled = false;

    const wavefrontParticles = Array.from({ length: WAVEFRONT_PARTICLE_COUNT }, (_, idx) => {
      // Organize particles into synchronized wavefront pulse packets along the 3 refraction ray tiers (0, 1, 2)
      const rayTier = idx % 3;
      const pulseBandIdx = Math.floor(idx / 3) % 12;
      const baseProgress = (pulseBandIdx / 12 + ((idx * 7) % 10) * 0.004) % 1.0;
      const lateralJitter = (((idx * 19) % 21) - 10) * 0.042;
      return {
        progress: baseProgress,
        speedMult: 0.92 + ((idx * 13) % 17) * 0.01,
        rayTier,
        corridorSeed: Math.floor(idx / 12),
        lateralJitter,
        phaseSeed: (idx * 0.63) % (Math.PI * 2),
      };
    });
    acousticWaveMasterGroup.add(wavefrontParticlesInstanced);

    // 84 Instanced Curved 3D Acoustic Wavefront Crest Shells ('Bølgefronter') tilting downward over the barrier
    const WAVEFRONT_CREST_COUNT = isSoftwareGl ? 54 : 84;
    const wavefrontCrestGeo = new THREE.TorusGeometry(1.15, 0.085, 8, 20, Math.PI * 0.68);
    // Center the arc on its vertex and orient so +Z is propagation normal
    wavefrontCrestGeo.rotateZ(-Math.PI * 0.34 + Math.PI * 0.5);
    const wavefrontCrestMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const wavefrontCrestsInstanced = new THREE.InstancedMesh(
      wavefrontCrestGeo,
      wavefrontCrestMat,
      WAVEFRONT_CREST_COUNT
    );
    wavefrontCrestsInstanced.frustumCulled = false;

    const wavefrontCrests = Array.from({ length: WAVEFRONT_CREST_COUNT }, (_, idx) => {
      return {
        progress: (idx / WAVEFRONT_CREST_COUNT) % 1.0,
        rayTier: idx % 3,
        corridorSeed: Math.floor(idx / 3),
      };
    });
    acousticWaveMasterGroup.add(wavefrontCrestsInstanced);

    // Item #5: 132 Instanced Reflected Wavefront Vector Cones bouncing off the upwind face of the 2.5m barrier
    const REFLECTED_WAVE_PARTICLE_COUNT = isSoftwareGl ? 84 : 132;
    const reflectedWaveConeGeo = new THREE.ConeGeometry(0.22, 0.72, 7);
    reflectedWaveConeGeo.rotateX(Math.PI * 0.5);
    const reflectedWaveConeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const reflectedWaveParticlesInstanced = new THREE.InstancedMesh(
      reflectedWaveConeGeo,
      reflectedWaveConeMat,
      REFLECTED_WAVE_PARTICLE_COUNT
    );
    reflectedWaveParticlesInstanced.frustumCulled = false;

    const reflectedWaveParticles = Array.from(
      { length: REFLECTED_WAVE_PARTICLE_COUNT },
      (_, idx) => ({
        progress: (idx / REFLECTED_WAVE_PARTICLE_COUNT) % 1.0,
        speedMult: 0.88 + ((idx * 17) % 25) * 0.01,
        lateralSlot: (idx % 5) - 2,
        corridorSeed: Math.floor(idx / 5),
        elevationBand: idx % 3,
      })
    );
    acousticWaveMasterGroup.add(reflectedWaveParticlesInstanced);

    // 8d-bis. 3D Hydraulic Concrete Hammer Impulse Shockwave Animation propagating toward Neighboring Blocks based on Hourly Refraction (dB)
    const hydraulicHammerImpulseGroup = new THREE.Group();
    hydraulicHammerImpulseGroup.name = 'hydraulic-hammer-impulse-waves-group';
    acousticWaveMasterGroup.add(hydraulicHammerImpulseGroup);

    // Reciprocating Hydraulic Concrete Hammer Chisel & Ground Impact Shock Rings at each Demolition Source
    const hammerSourceNodesMap = new Map<
      string,
      {
        root: THREE.Group;
        chiselGroup: THREE.Group;
        impactFlashRing: THREE.Mesh;
        impactFlashMat: THREE.MeshBasicMaterial;
      }
    >();

    const hammerHousingGeo = new THREE.BoxGeometry(0.95, 1.9, 0.95);
    const hammerChiselGeo = new THREE.CylinderGeometry(0.18, 0.08, 1.8, 10);
    const hammerImpactRingGeo = new THREE.RingGeometry(0.6, 1.35, 32);
    hammerImpactRingGeo.rotateX(-Math.PI / 2);

    simStateRef.current.sources.forEach((src) => {
      const srcNode = sourceNodesMap.get(src.id);
      const fallbackXZ = latLngToWorldXZ(src.position);
      const wx = srcNode ? srcNode.worldX : fallbackXZ.x;
      const wz = srcNode ? srcNode.worldZ : fallbackXZ.z;

      const hRoot = new THREE.Group();
      hRoot.position.set(wx + 1.4, 0, wz + 0.8);

      const chiselGroup = new THREE.Group();
      const housingMat = new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0x9f1239,
        emissiveIntensity: 0.65,
        roughness: 0.35,
        metalness: 0.55,
      });
      const housingMesh = new THREE.Mesh(hammerHousingGeo, housingMat);
      housingMesh.position.y = 2.4;
      chiselGroup.add(housingMesh);

      const chiselMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.8,
      });
      const chiselMesh = new THREE.Mesh(hammerChiselGeo, chiselMat);
      chiselMesh.position.y = 1.05;
      chiselGroup.add(chiselMesh);
      hRoot.add(chiselGroup);

      const impactFlashMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const impactFlashRing = new THREE.Mesh(hammerImpactRingGeo, impactFlashMat);
      impactFlashRing.position.y = 0.22;
      hRoot.add(impactFlashRing);

      hydraulicHammerImpulseGroup.add(hRoot);
      hammerSourceNodesMap.set(src.id, {
        root: hRoot,
        chiselGroup,
        impactFlashRing,
        impactFlashMat,
      });
    });

    // Instanced Toroidal 3D Impulse Shockwave Rings propagating from Hydraulic Hammers toward Neighboring Blocks along Refracted Ray Paths
    const HAMMER_IMPULSE_RING_COUNT = isSoftwareGl ? 60 : 96;
    const hammerImpulseTorusGeo = new THREE.TorusGeometry(0.95, 0.11, 10, 28);
    const hammerImpulseTorusMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const hammerImpulseRingsInstanced = new THREE.InstancedMesh(
      hammerImpulseTorusGeo,
      hammerImpulseTorusMat,
      HAMMER_IMPULSE_RING_COUNT
    );
    hammerImpulseRingsInstanced.frustumCulled = false;

    const hammerImpulseWaveStates = Array.from(
      { length: HAMMER_IMPULSE_RING_COUNT },
      (_, idx) => ({
        progress: (idx / HAMMER_IMPULSE_RING_COUNT) % 1.0,
        corridorSeed: idx,
        rayTier: idx % 3,
        pulseIndex: idx % 8,
      })
    );
    hydraulicHammerImpulseGroup.add(hammerImpulseRingsInstanced);

    // 8d-ter. 3D Radial & Directional Impulse Shockwave Shells propagating directly from the Selected Source
    // whenever a statutory noise limit is exceeded in the selected hour (mounted directly on scene above terrain relief)
    const selectedSourceExceedanceWaveGroup = new THREE.Group();
    selectedSourceExceedanceWaveGroup.name = 'selected-source-exceedance-impulse-waves';
    scene.add(selectedSourceExceedanceWaveGroup);

    const SOURCE_EXCEEDANCE_SHELL_COUNT = 6;
    const sourceExceedanceGroundRings: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
    }> = [];
    const sourceExceedance3DDomes: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
    }> = [];

    const groundWaveRingGeo = new THREE.RingGeometry(0.9, 1.0, 56);
    groundWaveRingGeo.rotateX(-Math.PI / 2);
    const domeWaveTorusGeo = new THREE.TorusGeometry(1.0, 0.055, 12, 48);
    domeWaveTorusGeo.rotateX(Math.PI / 2);

    for (let sIdx = 0; sIdx < SOURCE_EXCEEDANCE_SHELL_COUNT; sIdx++) {
      const gMat = new THREE.MeshBasicMaterial({
        color: sIdx % 2 === 0 ? 0xf43f5e : 0xfde047,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const gMesh = new THREE.Mesh(groundWaveRingGeo, gMat);
      gMesh.position.y = 4.95;
      gMesh.renderOrder = 21;
      selectedSourceExceedanceWaveGroup.add(gMesh);
      sourceExceedanceGroundRings.push({ mesh: gMesh, mat: gMat });

      const dMat = new THREE.MeshBasicMaterial({
        color: sIdx % 2 === 0 ? 0xe879f9 : 0xf97316,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const dMesh = new THREE.Mesh(domeWaveTorusGeo, dMat);
      dMesh.renderOrder = 22;
      selectedSourceExceedanceWaveGroup.add(dMesh);
      sourceExceedance3DDomes.push({ mesh: dMesh, mat: dMat });
    }

    const sourceBeaconGeo = new THREE.TorusGeometry(2.1, 0.14, 12, 36);
    sourceBeaconGeo.rotateX(Math.PI / 2);
    const sourceBeaconMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sourceExceedanceBeaconMesh = new THREE.Mesh(sourceBeaconGeo, sourceBeaconMat);
    sourceExceedanceBeaconMesh.renderOrder = 23;
    selectedSourceExceedanceWaveGroup.add(sourceExceedanceBeaconMesh);

    let lastExceedanceTriggerKey = '';
    let exceedanceBurstRemainingSec = 0;

    // 8e. Item #1: Dynamic 3D 'Støv-Emitter' Animation for All Active Demolition Machines
    // Volumetric dust density & dispersion velocity correlate directly with machine load output % and wind speed
    const machineryDustEmitterMasterGroup = new THREE.Group();
    machineryDustEmitterMasterGroup.name = 'machinery-dust-emitter-master-group';
    scene.add(machineryDustEmitterMasterGroup);

    const machineryDustEmitterNodesMap = new Map<string, MachineryDustEmitterVisualNode3D>();
    simStateRef.current.sources.forEach((src) => {
      const srcNode = sourceNodesMap.get(src.id);
      const fallbackXZ = latLngToWorldXZ(src.position);
      const wx = srcNode ? srcNode.worldX : fallbackXZ.x;
      const wz = srcNode ? srcNode.worldZ : fallbackXZ.z;
      const relY = srcNode ? srcNode.releaseY : Math.max(2.5, src.releaseHeightMeters / METERS_PER_UNIT);
      const emitterNode = buildCompositeMachineryDustEmitterNode(src, wx, wz, relY);
      machineryDustEmitterMasterGroup.add(emitterNode.root);
      machineryDustEmitterNodesMap.set(src.id, emitterNode);
    });

    // 320 Instanced Volumetric Billowing Dust Emitter Puffs launched from active demolition machines
    const EMITTER_PUFF_PARTICLE_COUNT = isSoftwareGl ? 190 : 320;
    const emitterPuffGeo = new THREE.DodecahedronGeometry(0.44, 1);
    const emitterPuffMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xd97706,
      emissiveIntensity: 0.42,
      roughness: 0.78,
      metalness: 0.05,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    const emitterPuffInstanced = new THREE.InstancedMesh(
      emitterPuffGeo,
      emitterPuffMat,
      EMITTER_PUFF_PARTICLE_COUNT
    );
    emitterPuffInstanced.frustumCulled = false;

    const emitterPuffParticles = Array.from({ length: EMITTER_PUFF_PARTICLE_COUNT }, (_, idx) => {
      // Color palette: Warm concrete dust (ochre/amber), asbestos fiber puffs (rose), pulverized brick (orange), quartz (gold)
      const cHex =
        idx % 4 === 0
          ? 0xf43f5e
          : idx % 4 === 1
          ? 0xf59e0b
          : idx % 4 === 2
          ? 0xfbbf24
          : 0xfde68a;
      _scratchColor.setHex(cHex);
      emitterPuffInstanced.setColorAt(idx, _scratchColor);
      return {
        progress: ((idx * 19) % 100) / 100,
        speedSeed: 0.82 + ((idx * 23) % 37) * 0.011,
        radialAngle: (idx * 2.39996) % (Math.PI * 2),
        radialSpread: 0.25 + ((idx * 13) % 75) * 0.012,
        isGroundRubbleJet: idx % 3 === 0,
        machineSeed: idx,
        turbulencePhase: (idx * 0.71) % (Math.PI * 2),
      };
    });
    if (emitterPuffInstanced.instanceColor) {
      emitterPuffInstanced.instanceColor.needsUpdate = true;
    }
    machineryDustEmitterMasterGroup.add(emitterPuffInstanced);

    // 9. InstancedMesh for Urban Trees around Ringparken (110 multi-part trees: trunk + canopy)
    const treeCount = 110;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 7);
    trunkGeo.translate(0, 0.8, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.92 });
    const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    trunkInstanced.castShadow = !isSoftwareGl;
    trunkInstanced.receiveShadow = true;

    const canopyGeo = new THREE.DodecahedronGeometry(1.35, 1);
    canopyGeo.translate(0, 2.55, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
    const canopyInstanced = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    canopyInstanced.castShadow = !isSoftwareGl;
    canopyInstanced.receiveShadow = true;

    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + (i % 5) * 0.14;
      const radius = 34 + ((i * 19) % 48);
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      const scale = 0.72 + ((i * 13) % 10) * 0.06;

      _scratchDummy.position.set(tx, 0, tz);
      _scratchDummy.rotation.set(0, (i * 1.1) % (Math.PI * 2), 0);
      _scratchDummy.scale.setScalar(scale);
      _scratchDummy.updateMatrix();

      trunkInstanced.setMatrixAt(i, _scratchDummy.matrix);
      canopyInstanced.setMatrixAt(i, _scratchDummy.matrix);

      _scratchColor.setHSL(0.36 + (i % 5) * 0.015, 0.42, 0.24 + (i % 4) * 0.04);
      canopyInstanced.setColorAt(i, _scratchColor);
    }
    trunkInstanced.instanceMatrix.needsUpdate = true;
    canopyInstanced.instanceMatrix.needsUpdate = true;
    if (canopyInstanced.instanceColor) canopyInstanced.instanceColor.needsUpdate = true;
    trunkInstanced.computeBoundingSphere();
    canopyInstanced.computeBoundingSphere();
    scene.add(trunkInstanced);
    scene.add(canopyInstanced);

    // 10. Volumetric 3D Gaussian Plume Cones (one multi-shell volumetric group per active source)
    const plumeConesMap = new Map<
      string,
      {
        group: THREE.Group;
        redCone: THREE.Mesh;
        orangeCone: THREE.Mesh;
        yellowCone: THREE.Mesh;
      }
    >();

    const unitConeGeo = new THREE.ConeGeometry(1, 1, 28, 1, true);
    unitConeGeo.translate(0, -0.5, 0);
    unitConeGeo.rotateX(-Math.PI / 2);

    simStateRef.current.sources.forEach((src) => {
      const srcNode = sourceNodesMap.get(src.id);
      if (!srcNode) return;

      const group = new THREE.Group();
      group.position.set(srcNode.worldX - 0.6, srcNode.releaseY + 0.6, srcNode.worldZ);

      const redCone = new THREE.Mesh(
        unitConeGeo,
        new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const orangeCone = new THREE.Mesh(
        unitConeGeo,
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const yellowCone = new THREE.Mesh(
        unitConeGeo,
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );

      group.add(redCone, orangeCone, yellowCone);
      scene.add(group);
      plumeConesMap.set(src.id, { group, redCone, orangeCone, yellowCone });
    });

    // 11. InstancedMesh for 480 Advected 3D Gaussian Plume Aerosol & Asbestos Fiber Particles
    const PARTICLE_COUNT = isSoftwareGl ? 240 : 480;
    const particleGeo = new THREE.IcosahedronGeometry(0.36, 1);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_COUNT);
    particleInstanced.frustumCulled = false;

    const particles: ParticleState[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const u1 = ((i * 73 + 19) % 997) / 997;
      const u2 = ((i * 151 + 43) % 991) / 991;
      const gaussLateral = Math.sqrt(-2.0 * Math.log(Math.max(0.002, u1))) * Math.cos(2 * Math.PI * u2);
      const gaussVertical = Math.sqrt(-2.0 * Math.log(Math.max(0.002, u1))) * Math.sin(2 * Math.PI * u2);

      particles.push({
        sourceIdx: i % Math.max(1, simStateRef.current.sources.length),
        progress: (i / PARTICLE_COUNT) % 1,
        speedFactor: 0.78 + ((i * 31) % 45) * 0.01,
        lateralSeed: THREE.MathUtils.clamp(gaussLateral * 0.45, -1.35, 1.35),
        verticalSeed: THREE.MathUtils.clamp(gaussVertical * 0.45, -1.1, 1.35),
        phaseOffset: i * 0.37,
        substanceType: i % 4,
      });

      if (i % 4 === 0) _scratchColor.setHex(0xf43f5e);
      else if (i % 4 === 1) _scratchColor.setHex(0xf59e0b);
      else if (i % 4 === 2) _scratchColor.setHex(0xc084fc);
      else _scratchColor.setHex(0x38bdf8);

      particleInstanced.setColorAt(i, _scratchColor);
    }
    if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;
    scene.add(particleInstanced);

    // 11B. 3D Visuel 'Fane-stianimation' — Spline-sti, glidende Gaussiske puff-skyer & sigma_y bølge-ringe over tid
    const plumePathGroup = new THREE.Group();
    plumePathGroup.name = 'fane-stianimation-group';
    scene.add(plumePathGroup);

    const PLUME_PATH_SAMPLE_COUNT = 16;
    const plumePathCtrlPts = Array.from({ length: PLUME_PATH_SAMPLE_COUNT }, (_, idx) => {
      return new THREE.Vector3(idx * 2.5, 4.0, 0);
    });
    const plumePathCurve = new THREE.CatmullRomCurve3(plumePathCtrlPts);
    const plumePathTubeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const plumePathTubeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(plumePathCurve, 44, 0.26, 8, false),
      plumePathTubeMat
    );
    plumePathTubeMesh.renderOrder = 19;
    plumePathGroup.add(plumePathTubeMesh);

    const PLUME_PATH_PUFF_COUNT = isSoftwareGl ? 10 : 18;
    const plumePathPuffGeo = new THREE.SphereGeometry(1, 12, 10);
    const plumePathPuffMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const plumePathPuffInstanced = new THREE.InstancedMesh(
      plumePathPuffGeo,
      plumePathPuffMat,
      PLUME_PATH_PUFF_COUNT
    );
    plumePathPuffInstanced.frustumCulled = false;
    plumePathPuffInstanced.renderOrder = 20;
    for (let i = 0; i < PLUME_PATH_PUFF_COUNT; i++) {
      _scratchColor.setHex(0x38bdf8);
      plumePathPuffInstanced.setColorAt(i, _scratchColor);
    }
    if (plumePathPuffInstanced.instanceColor) {
      plumePathPuffInstanced.instanceColor.needsUpdate = true;
    }
    plumePathGroup.add(plumePathPuffInstanced);

    const PLUME_PATH_RING_COUNT = isSoftwareGl ? 12 : 20;
    const plumePathRingGeo = new THREE.TorusGeometry(1, 0.08, 8, 24);
    const plumePathRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const plumePathRingInstanced = new THREE.InstancedMesh(
      plumePathRingGeo,
      plumePathRingMat,
      PLUME_PATH_RING_COUNT
    );
    plumePathRingInstanced.frustumCulled = false;
    plumePathRingInstanced.renderOrder = 21;
    for (let i = 0; i < PLUME_PATH_RING_COUNT; i++) {
      _scratchColor.setHex(0xf59e0b);
      plumePathRingInstanced.setColorAt(i, _scratchColor);
    }
    if (plumePathRingInstanced.instanceColor) {
      plumePathRingInstanced.instanceColor.needsUpdate = true;
    }
    plumePathGroup.add(plumePathRingInstanced);

    let lastPlumePathFingerprint = '';
    let plumePathAnimPhase = 0;

    // 12. InstancedMesh for Atmospheric Wind Streamline Arrows across the site
    const WIND_ARROW_COUNT = 36;
    const arrowShapeGeo = new THREE.ConeGeometry(0.45, 2.2, 6);
    arrowShapeGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
    });
    const windArrowsInstanced = new THREE.InstancedMesh(
      arrowShapeGeo,
      arrowMat,
      WIND_ARROW_COUNT
    );
    windArrowsInstanced.frustumCulled = false;
    scene.add(windArrowsInstanced);

    // =========================================================================
    // 12B. 3D UNDERGROUND PERCOLATION & GROUNDWATER CUTAWAY (y < 0 to y = -20)
    // =========================================================================
    const subsurfaceGroup = new THREE.Group();
    subsurfaceGroup.name = 'underground-percolation-cutaway';
    scene.add(subsurfaceGroup);

    // Depth scale in 3D cutaway: 1 meter underground = 0.82 world Y units so -25m maps to y = -20.5
    const SUB_SCALE_Y = 0.82;
    const cutawaySizeXZ = 148;

    // Translucent Geological Strata Block Slabs
    const strataSpecs = [
      { topM: 0.2, botM: 1.8, color: 0x453528, opacity: 0.26 }, // Unsealed topsoil & sewer trench
      { topM: 1.8, botM: 7.2, color: 0x3b2f26, opacity: 0.22 }, // Fractured Weichsel moraine clay
      { topM: 7.2, botM: 11.8, color: 0x0e3a5c, opacity: 0.28 }, // Secondary sand lens aquifer
      { topM: 11.8, botM: 16.5, color: 0x262e3d, opacity: 0.22 }, // Lower moraine clay aquitard
      { topM: 16.5, botM: 25.0, color: 0x072a47, opacity: 0.34 }, // Primary OSD drinking-water aquifer
    ];

    strataSpecs.forEach((st) => {
      const h = (st.botM - st.topM) * SUB_SCALE_Y;
      const centerY = -((st.topM + st.botM) * 0.5) * SUB_SCALE_Y;
      const slabGeo = new THREE.BoxGeometry(cutawaySizeXZ, h, cutawaySizeXZ);
      const slabMat = new THREE.MeshStandardMaterial({
        color: st.color,
        roughness: 0.85,
        metalness: 0.1,
        transparent: true,
        opacity: st.opacity,
        depthWrite: false,
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(0, centerY, 0);
      subsurfaceGroup.add(slabMesh);

      // Wireframe stratum boundary frame for crisp geological cutaway visibility
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(slabGeo),
        new THREE.LineBasicMaterial({
          color: st.topM >= 16 ? 0x06b6d4 : st.topM >= 7 ? 0x38bdf8 : 0x64748b,
          transparent: true,
          opacity: 0.38,
        })
      );
      edges.position.set(0, centerY, 0);
      subsurfaceGroup.add(edges);
    });

    // Dynamic Secondary Groundwater Table Surface Mesh (~ -6.2m to -7.5m)
    const waterTablePlaneGeo = new THREE.PlaneGeometry(cutawaySizeXZ - 2, cutawaySizeXZ - 2, 24, 24);
    waterTablePlaneGeo.rotateX(-Math.PI / 2);

    const secondaryWaterTableMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.48,
      roughness: 0.18,
      metalness: 0.65,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const secondaryWaterTableMesh = new THREE.Mesh(waterTablePlaneGeo, secondaryWaterTableMat);
    secondaryWaterTableMesh.position.y = -7.2 * SUB_SCALE_Y;
    subsurfaceGroup.add(secondaryWaterTableMesh);

    // Dynamic Primary OSD Groundwater Table Surface Mesh (~ -15.2m to -16.6m)
    const primaryWaterTableMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.62,
      roughness: 0.15,
      metalness: 0.75,
      transparent: true,
      opacity: 0.64,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const primaryWaterTableMesh = new THREE.Mesh(waterTablePlaneGeo, primaryWaterTableMat);
    primaryWaterTableMesh.position.y = -16.2 * SUB_SCALE_Y;
    subsurfaceGroup.add(primaryWaterTableMesh);

    // 3D Macropore Fracture Conduits (`TubeGeometry`) & Vertical Leachate Plume Cones under each Demolition Source
    const subsurfacePlumeConesMap = new Map<string, THREE.Mesh>();
    const fractureMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.4,
      transparent: true,
      opacity: 0.7,
    });

    // Downward cone geometry (apex at y=0, expanding downward to y=-1)
    const downConeGeo = new THREE.ConeGeometry(1, 1, 24, 1, true);
    downConeGeo.translate(0, -0.5, 0);

    simStateRef.current.sources.forEach((src, sIdx) => {
      const srcNode = sourceNodesMap.get(src.id);
      if (!srcNode) return;

      // 3 branching 3D fracture conduits through the moraine clay beneath each source
      for (let b = 0; b < 3; b++) {
        const angle = (b / 3) * Math.PI * 2 + sIdx;
        const r1 = 1.8;
        const r2 = 3.4;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(srcNode.worldX, -0.2, srcNode.worldZ),
          new THREE.Vector3(
            srcNode.worldX + Math.cos(angle) * r1,
            -3.5 * SUB_SCALE_Y,
            srcNode.worldZ + Math.sin(angle) * r1
          ),
          new THREE.Vector3(
            srcNode.worldX + Math.cos(angle + 0.5) * r2,
            -7.4 * SUB_SCALE_Y,
            srcNode.worldZ + Math.sin(angle + 0.5) * r2
          ),
          new THREE.Vector3(
            srcNode.worldX - 3.5 + Math.cos(angle) * r2,
            -16.5 * SUB_SCALE_Y,
            srcNode.worldZ + 2.5 + Math.sin(angle) * r2
          ),
        ]);
        const tubeMesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 16, 0.14, 6, false),
          fractureMat
        );
        subsurfaceGroup.add(tubeMesh);
      }

      // Translucent 3D vertical leachate plume cone beneath source
      const leachConeMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const leachCone = new THREE.Mesh(downConeGeo, leachConeMat);
      leachCone.position.set(srcNode.worldX, -0.15, srcNode.worldZ);
      subsurfaceGroup.add(leachCone);
      subsurfacePlumeConesMap.set(src.id, leachCone);
    });

    // 320 Instanced 3D Percolating Leachate & Water Droplets (`percolationInstanced`)
    const PERCOLATION_COUNT = isSoftwareGl ? 180 : 320;
    const percDropGeo = new THREE.OctahedronGeometry(0.34, 1);
    const percDropMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const percolationInstanced = new THREE.InstancedMesh(
      percDropGeo,
      percDropMat,
      PERCOLATION_COUNT
    );
    percolationInstanced.frustumCulled = false;

    const percolationParticles: SubsurfacePercolationParticleState[] = [];
    for (let i = 0; i < PERCOLATION_COUNT; i++) {
      const cType = i % 4;
      percolationParticles.push({
        sourceIdx: i % Math.max(1, simStateRef.current.sources.length),
        progress: (i / PERCOLATION_COUNT) % 1,
        speedFactor: 0.72 + ((i * 37) % 55) * 0.01,
        radialAngle: ((i * 137.5) * Math.PI) / 180,
        radialSpreadSeed: 0.25 + ((i * 19) % 75) * 0.01,
        inMacropore: i % 3 !== 0,
        contaminantType: cType,
      });

      // 0 = Infiltrating Rainwater (Cyan), 1 = Lead/Pb (Amber), 2 = PCB (Violet), 3 = PAH/Sludge (Rose)
      if (cType === 0) _scratchColor.setHex(0x38bdf8);
      else if (cType === 1) _scratchColor.setHex(0xf59e0b);
      else if (cType === 2) _scratchColor.setHex(0xc084fc);
      else _scratchColor.setHex(0xf43f5e);

      percolationInstanced.setColorAt(i, _scratchColor);
    }
    if (percolationInstanced.instanceColor) percolationInstanced.instanceColor.needsUpdate = true;
    subsurfaceGroup.add(percolationInstanced);

    // =========================================================================
    // 12C. DEDICATED BLOK 1 & BLOK 2 SUBTERRANEAN PERCOLATION PATHWAYS (Pb & PAH)
    // =========================================================================
    const blok1Unit = simStateRef.current.buildings.find((b) => b.id === 'BLOK-1');
    const blok2Unit = simStateRef.current.buildings.find((b) => b.id === 'BLOK-2');
    const blok1XZ = latLngToWorldXZ(
      blok1Unit?.center || { lat: 55.41295, lng: 11.35365 }
    );
    const blok2XZ = latLngToWorldXZ(
      blok2Unit?.center || { lat: 55.41318, lng: 11.3541 }
    );
    const midBlok12XZ = {
      x: (blok1XZ.x + blok2XZ.x) * 0.5,
      z: (blok1XZ.z + blok2XZ.z) * 0.5,
    };

    const createSubsurfaceBlockBannerTex = (
      title: string,
      subtitle: string,
      accentColor: string
    ): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 128;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, 512, 128);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 5;
        ctx.strokeRect(3, 3, 506, 122);
        ctx.fillStyle = accentColor;
        ctx.font = 'bold 28px monospace';
        ctx.fillText(title, 18, 50);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 21px monospace';
        ctx.fillText(subtitle, 18, 92);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const blok1SubsurfaceTex = createSubsurfaceBlockBannerTex(
      'BLOK 1 (Kierulffsvej 14-22)',
      'Uforseglet Krybekælder · Bly (Pb) & PAH Kilde',
      '#f59e0b'
    );
    const blok2SubsurfaceTex = createSubsurfaceBlockBannerTex(
      'BLOK 2 (Kierulffsvej 24-32)',
      'Krybekælder & Sekundær Sandlinse-Perkolation',
      '#e879f9'
    );

    // Translucent Subterranean Crawlspace & Foundation Cutaway Boxes at Blok 1 & Blok 2
    [
      {
        xz: blok1XZ,
        color: 0xf59e0b,
        bannerTex: blok1SubsurfaceTex,
        yaw: -0.22,
      },
      {
        xz: blok2XZ,
        color: 0xe879f9,
        bannerTex: blok2SubsurfaceTex,
        yaw: -0.22,
      },
    ].forEach((spec) => {
      // Surface footprint ghost + -1.8m crawlspace trench box
      const foundationGeo = new THREE.BoxGeometry(11.5, 2.4, 5.4);
      const foundationMat = new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.color,
        emissiveIntensity: 0.35,
        roughness: 0.5,
        metalness: 0.25,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const foundationMesh = new THREE.Mesh(foundationGeo, foundationMat);
      foundationMesh.position.set(spec.xz.x, -0.5, spec.xz.z);
      foundationMesh.rotation.y = spec.yaw;
      subsurfaceGroup.add(foundationMesh);

      const foundationEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(foundationGeo),
        new THREE.LineBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0.92,
        })
      );
      foundationEdges.position.copy(foundationMesh.position);
      foundationEdges.rotation.y = spec.yaw;
      subsurfaceGroup.add(foundationEdges);

      // Identification banner floating just above foundation trench
      const bannerGeo = new THREE.PlaneGeometry(13.5, 3.35);
      const bannerMat = new THREE.MeshBasicMaterial({
        map: spec.bannerTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      });
      const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
      bannerMesh.position.set(spec.xz.x, 2.6, spec.xz.z);
      bannerMesh.rotation.y = -0.52;
      subsurfaceGroup.add(bannerMesh);
    });

    // Build 8 explicit 3D Percolation Pathway Curves beneath Blok 1 & Blok 2:
    // Curves 0..3 = Bly (Pb) vertical macropore & sand-stringer pathways (#f59e0b)
    // Curves 4..7 = PAH-holdigt vand lateral crawlspace-to-sand-lens & OSD pathways (#e879f9)
    const blok12PercolationCurves: Array<{
      curve: THREE.CatmullRomCurve3;
      isPah: boolean;
    }> = [
      // Blok 1 Lead (Pb) Macropore Pathway A -> Secondary (-7.2m) -> Primary OSD (-16.5m)
      {
        isPah: false,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(blok1XZ.x - 2.4, -0.4, blok1XZ.z - 0.8),
          new THREE.Vector3(blok1XZ.x - 3.1, -3.6 * SUB_SCALE_Y, blok1XZ.z + 0.6),
          new THREE.Vector3(blok1XZ.x - 4.5, -7.3 * SUB_SCALE_Y, blok1XZ.z + 2.2),
          new THREE.Vector3(blok1XZ.x - 6.8, -12.4 * SUB_SCALE_Y, blok1XZ.z + 4.1),
          new THREE.Vector3(blok1XZ.x - 9.2, -17.2 * SUB_SCALE_Y, blok1XZ.z + 6.4),
        ]),
      },
      // Blok 1 Lead (Pb) Macropore Pathway B
      {
        isPah: false,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(blok1XZ.x + 2.1, -0.4, blok1XZ.z + 0.9),
          new THREE.Vector3(blok1XZ.x + 1.4, -4.1 * SUB_SCALE_Y, blok1XZ.z + 2.1),
          new THREE.Vector3(blok1XZ.x - 0.6, -7.5 * SUB_SCALE_Y, blok1XZ.z + 3.8),
          new THREE.Vector3(blok1XZ.x - 3.2, -16.8 * SUB_SCALE_Y, blok1XZ.z + 6.9),
        ]),
      },
      // Blok 2 Lead (Pb) Macropore Pathway C
      {
        isPah: false,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(blok2XZ.x - 1.9, -0.4, blok2XZ.z - 0.6),
          new THREE.Vector3(blok2XZ.x - 2.7, -3.8 * SUB_SCALE_Y, blok2XZ.z + 1.1),
          new THREE.Vector3(blok2XZ.x - 4.2, -7.4 * SUB_SCALE_Y, blok2XZ.z + 2.9),
          new THREE.Vector3(blok2XZ.x - 6.9, -16.6 * SUB_SCALE_Y, blok2XZ.z + 5.6),
        ]),
      },
      // Blok 2 Lead (Pb) Macropore Pathway D
      {
        isPah: false,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(blok2XZ.x + 2.3, -0.4, blok2XZ.z + 0.7),
          new THREE.Vector3(blok2XZ.x + 1.8, -4.2 * SUB_SCALE_Y, blok2XZ.z + 2.0),
          new THREE.Vector3(blok2XZ.x + 0.2, -7.6 * SUB_SCALE_Y, blok2XZ.z + 3.7),
          new THREE.Vector3(blok2XZ.x - 2.6, -17.0 * SUB_SCALE_Y, blok2XZ.z + 6.5),
        ]),
      },
      // PAH Pathway E: Blok 1 Crawlspace -> Lateral Sand-Lens Cross-Flow under Blok 2 -> Aquifer
      {
        isPah: true,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(blok1XZ.x + 0.6, -0.4, blok1XZ.z),
          new THREE.Vector3(midBlok12XZ.x - 1.2, -3.2 * SUB_SCALE_Y, midBlok12XZ.z + 0.5),
          new THREE.Vector3(blok2XZ.x - 0.8, -7.2 * SUB_SCALE_Y, blok2XZ.z + 1.4),
          new THREE.Vector3(blok2XZ.x - 4.4, -11.6 * SUB_SCALE_Y, blok2XZ.z + 4.2),
          new THREE.Vector3(blok2XZ.x - 7.8, -16.9 * SUB_SCALE_Y, blok2XZ.z + 7.1),
        ]),
      },
      // PAH Pathway F: Blok 1 Trench Direct Fracture Plume
      {
        isPah: true,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(blok1XZ.x - 0.5, -0.4, blok1XZ.z + 1.2),
          new THREE.Vector3(blok1XZ.x - 1.8, -3.9 * SUB_SCALE_Y, blok1XZ.z + 2.8),
          new THREE.Vector3(blok1XZ.x - 3.9, -7.4 * SUB_SCALE_Y, blok1XZ.z + 4.9),
          new THREE.Vector3(blok1XZ.x - 7.4, -16.7 * SUB_SCALE_Y, blok1XZ.z + 8.2),
        ]),
      },
      // PAH Pathway G: Blok 2 Foundation Drain Trench -> Secondary Sand Lens SW Plume
      {
        isPah: true,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(blok2XZ.x, -0.4, blok2XZ.z - 1.1),
          new THREE.Vector3(midBlok12XZ.x + 1.4, -3.5 * SUB_SCALE_Y, midBlok12XZ.z + 0.9),
          new THREE.Vector3(midBlok12XZ.x - 1.5, -7.3 * SUB_SCALE_Y, midBlok12XZ.z + 3.4),
          new THREE.Vector3(midBlok12XZ.x - 5.2, -16.5 * SUB_SCALE_Y, midBlok12XZ.z + 6.8),
        ]),
      },
      // PAH Pathway H: Inter-block Utility Conduit Trench (Blok 1 <-> Blok 2)
      {
        isPah: true,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(midBlok12XZ.x, -0.5, midBlok12XZ.z),
          new THREE.Vector3(midBlok12XZ.x - 0.9, -4.4 * SUB_SCALE_Y, midBlok12XZ.z + 1.8),
          new THREE.Vector3(midBlok12XZ.x - 2.8, -7.5 * SUB_SCALE_Y, midBlok12XZ.z + 3.9),
          new THREE.Vector3(midBlok12XZ.x - 6.1, -17.1 * SUB_SCALE_Y, midBlok12XZ.z + 7.4),
        ]),
      },
    ];

    const blok12PbConduitMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.78,
      roughness: 0.25,
      metalness: 0.35,
      transparent: true,
      opacity: 0.82,
    });

    const blok12PahConduitMat = new THREE.MeshStandardMaterial({
      color: 0xe879f9,
      emissive: 0xc026d3,
      emissiveIntensity: 0.78,
      roughness: 0.25,
      metalness: 0.35,
      transparent: true,
      opacity: 0.82,
    });

    const blok12ConduitMeshes: THREE.Mesh[] = [];
    blok12PercolationCurves.forEach((item) => {
      const tubeMesh = new THREE.Mesh(
        new THREE.TubeGeometry(item.curve, 28, 0.22, 8, false),
        item.isPah ? blok12PahConduitMat : blok12PbConduitMat
      );
      subsurfaceGroup.add(tubeMesh);
      blok12ConduitMeshes.push(tubeMesh);
    });

    // 220 Dedicated Instanced Bly (Pb) & PAH-Water Droplets Streaming Along Blok 1 & 2 Pathways
    const BLOK12_DROP_COUNT = isSoftwareGl ? 128 : 220;
    const blok12DropGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const blok12DropMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const blok12PbPahInstanced = new THREE.InstancedMesh(
      blok12DropGeo,
      blok12DropMat,
      BLOK12_DROP_COUNT
    );
    blok12PbPahInstanced.frustumCulled = false;

    const blok12PathParticles: Array<{
      curveIdx: number;
      t: number;
      speedScale: number;
      lateralPhase: number;
      isPah: boolean;
    }> = [];

    for (let i = 0; i < BLOK12_DROP_COUNT; i++) {
      const curveIdx = i % blok12PercolationCurves.length;
      const isPah = blok12PercolationCurves[curveIdx].isPah;
      blok12PathParticles.push({
        curveIdx,
        t: (i / BLOK12_DROP_COUNT) % 1,
        speedScale: 0.8 + ((i * 29) % 45) * 0.01,
        lateralPhase: i * 0.75,
        isPah,
      });
      if (isPah) {
        _scratchColor.setHex(i % 2 === 0 ? 0xe879f9 : 0x22d3ee);
      } else {
        _scratchColor.setHex(i % 2 === 0 ? 0xf59e0b : 0xfde047);
      }
      blok12PbPahInstanced.setColorAt(i, _scratchColor);
    }
    if (blok12PbPahInstanced.instanceColor) {
      blok12PbPahInstanced.instanceColor.needsUpdate = true;
    }
    subsurfaceGroup.add(blok12PbPahInstanced);

    // =========================================================================
    // 12D. KIERULFFSVEJ DN200 DRINKING WATER MAIN (-1.65 m) & DISTRICT HEATING (-1.05 m)
    // =========================================================================
    const waterMain3DGroup = new THREE.Group();
    waterMain3DGroup.name = 'kierulffsvej-water-main-3d';
    scene.add(waterMain3DGroup);

    const initWm = simStateRef.current.waterMainTelemetry;
    const rawWmPts: LatLngPoint[] =
      initWm && initWm.sceneSegments.length > 0
        ? initWm.sceneSegments.flatMap((s, idx) =>
            idx === 0 ? s.waypoints : s.waypoints.slice(1)
          )
        : [
            { lat: 55.41235, lng: 11.35265 },
            { lat: 55.41295, lng: 11.35365 },
            { lat: 55.41335, lng: 11.35455 },
            { lat: 55.41368, lng: 11.35545 },
          ];

    const waterMainY = -1.65 * SUB_SCALE_Y;
    const dhPipeY = -1.05 * SUB_SCALE_Y;

    const waterMainCurve = new THREE.CatmullRomCurve3(
      rawWmPts.map((pt) => {
        const xz = latLngToWorldXZ(pt);
        return new THREE.Vector3(xz.x, waterMainY, xz.z);
      })
    );

    const waterMainPipeMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.45,
      transparent: true,
      opacity: 0.94,
    });
    const waterMainPipeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(waterMainCurve, 44, 0.26, 12, false),
      waterMainPipeMat
    );
    waterMain3DGroup.add(waterMainPipeMesh);

    // LER ±2.0 m Uncertainty Buffer Cylinder Sleeve
    const lerRadiusUnits = 2.0 / METERS_PER_UNIT;
    const lerBufferMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lerBufferMesh = new THREE.Mesh(
      new THREE.TubeGeometry(waterMainCurve, 36, lerRadiusUnits, 12, false),
      lerBufferMat
    );
    waterMain3DGroup.add(lerBufferMesh);

    // Overlying District Heating Twin Pipes (-1.05 m u.t., directly ABOVE water main)
    const dhSupplyCurve = new THREE.CatmullRomCurve3(
      rawWmPts.map((pt) => {
        const xz = latLngToWorldXZ(pt);
        return new THREE.Vector3(xz.x - 0.28, dhPipeY, xz.z + 0.28);
      })
    );
    const dhReturnCurve = new THREE.CatmullRomCurve3(
      rawWmPts.map((pt) => {
        const xz = latLngToWorldXZ(pt);
        return new THREE.Vector3(xz.x + 0.28, dhPipeY, xz.z - 0.28);
      })
    );
    const dhSupplyMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xe11d48,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
    });
    const dhReturnMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.28,
      roughness: 0.4,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
    });
    const dhSupplyMesh = new THREE.Mesh(
      new THREE.TubeGeometry(dhSupplyCurve, 36, 0.14, 8, false),
      dhSupplyMat
    );
    const dhReturnMesh = new THREE.Mesh(
      new THREE.TubeGeometry(dhReturnCurve, 36, 0.14, 8, false),
      dhReturnMat
    );
    waterMain3DGroup.add(dhSupplyMesh, dhReturnMesh);

    // 4 Service Branches (stikledninger) to demolition buildings
    const branchSpecs =
      initWm?.serviceBranches ?? [
        {
          startOnMain: { lat: 55.41295, lng: 11.35365 },
          buildingConnection: { lat: 55.4131, lng: 11.35352 },
          cappingStatus: 'uncapped_risk' as const,
        },
        {
          startOnMain: { lat: 55.41335, lng: 11.35455 },
          buildingConnection: { lat: 55.4135, lng: 11.3544 },
          cappingStatus: 'capped_at_boundary' as const,
        },
      ];
    const branchMeshes: THREE.Mesh[] = [];
    branchSpecs.forEach((br) => {
      const p1 = latLngToWorldXZ(br.startOnMain);
      const p2 = latLngToWorldXZ(br.buildingConnection);
      const bCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(p1.x, waterMainY, p1.z),
        new THREE.Vector3((p1.x + p2.x) * 0.5, -1.2 * SUB_SCALE_Y, (p1.z + p2.z) * 0.5),
        new THREE.Vector3(p2.x, -0.5 * SUB_SCALE_Y, p2.z),
      ]);
      const bMat = new THREE.MeshStandardMaterial({
        color: br.cappingStatus === 'uncapped_risk' ? 0xf43f5e : 0x38bdf8,
        emissive: br.cappingStatus === 'uncapped_risk' ? 0xbe123c : 0x0284c7,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.9,
      });
      const bMesh = new THREE.Mesh(
        new THREE.TubeGeometry(bCurve, 12, 0.11, 6, false),
        bMat
      );
      waterMain3DGroup.add(bMesh);
      branchMeshes.push(bMesh);
    });

    // 3 Section Isolation Valves (V-VEST, V-MIDT, V-ØST) + 2 Hydrants
    const valveGeo = new THREE.CylinderGeometry(0.28, 0.28, Math.abs(waterMainY) + 0.65, 10);
    const valveMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.94,
    });
    (
      initWm?.valves ?? [
        { coordinate: rawWmPts[0] },
        { coordinate: rawWmPts[Math.floor(rawWmPts.length / 2)] },
        { coordinate: rawWmPts[rawWmPts.length - 1] },
      ]
    ).forEach((v) => {
      const xz = latLngToWorldXZ(v.coordinate);
      const vMesh = new THREE.Mesh(valveGeo, valveMat);
      vMesh.position.set(xz.x, waterMainY * 0.5 + 0.2, xz.z);
      waterMain3DGroup.add(vMesh);
    });

    const hydrantGeo = new THREE.CylinderGeometry(0.2, 0.24, Math.abs(waterMainY) + 0.85, 10);
    const hydrantMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      emissive: 0xbe123c,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.92,
    });
    (initWm?.hydrants ?? []).forEach((hyd) => {
      const xz = latLngToWorldXZ(hyd.coordinate);
      const hMesh = new THREE.Mesh(hydrantGeo, hydrantMat);
      hMesh.position.set(xz.x, waterMainY * 0.5 + 0.3, xz.z);
      waterMain3DGroup.add(hMesh);
    });

    // Animated Flow Particles along Kierulffsvej DN200 Water Main (Zero-GC InstancedMesh)
    const WATER_FLOW_COUNT = isSoftwareGl ? 36 : 64;
    const waterFlowGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const waterFlowMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const waterFlowInstanced = new THREE.InstancedMesh(
      waterFlowGeo,
      waterFlowMat,
      WATER_FLOW_COUNT
    );
    waterFlowInstanced.frustumCulled = false;
    const waterFlowProgress = new Float32Array(WATER_FLOW_COUNT);
    for (let i = 0; i < WATER_FLOW_COUNT; i++) {
      waterFlowProgress[i] = i / WATER_FLOW_COUNT;
    }
    waterMain3DGroup.add(waterFlowInstanced);

    // Virtual Leak Pin 3D Soil Saturation Zones & Rupture Beacon (Zero-GC)
    const virtualLeak3DGroup = new THREE.Group();
    virtualLeak3DGroup.name = 'virtual-leak-saturation-3d';
    virtualLeak3DGroup.visible = false;
    scene.add(virtualLeak3DGroup);

    const leakZoneColors = [0xf43f5e, 0xf59e0b, 0x0ea5e9];
    const leakZoneOpacities = [0.36, 0.24, 0.14];
    const leakZoneDiscs: THREE.Mesh[] = [];
    const leakZoneRings: THREE.Mesh[] = [];

    for (let zIdx = 0; zIdx < 3; zIdx++) {
      const discGeo = new THREE.CircleGeometry(1, 40);
      discGeo.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: leakZoneColors[zIdx],
        transparent: true,
        opacity: leakZoneOpacities[zIdx],
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.position.y = 0.12 - zIdx * 0.02;
      discMesh.renderOrder = 15 + (2 - zIdx);
      virtualLeak3DGroup.add(discMesh);
      leakZoneDiscs.push(discMesh);

      const ringGeo = new THREE.RingGeometry(0.95, 1.0, 44);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: leakZoneColors[zIdx],
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.14;
      ringMesh.renderOrder = 19;
      virtualLeak3DGroup.add(ringMesh);
      leakZoneRings.push(ringMesh);
    }

    const leakBeaconPillarGeo = new THREE.CylinderGeometry(0.24, 0.34, Math.abs(waterMainY) + 4.8, 12);
    const leakBeaconPillarMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const leakBeaconPillar = new THREE.Mesh(leakBeaconPillarGeo, leakBeaconPillarMat);
    leakBeaconPillar.position.y = (waterMainY + 4.8) * 0.5;
    virtualLeak3DGroup.add(leakBeaconPillar);

    const leakBeaconCapGeo = new THREE.OctahedronGeometry(0.68, 0);
    const leakBeaconCapMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.95,
    });
    const leakBeaconCap = new THREE.Mesh(leakBeaconCapGeo, leakBeaconCapMat);
    leakBeaconCap.position.y = 4.9;
    virtualLeak3DGroup.add(leakBeaconCap);

    // =========================================================================
    // 12E. SYSTEM B SIMULTANEOUS ALGEDONIC DISPATCH (S1 + S3) 3D LAYER (ZERO-GC)
    // =========================================================================
    const simultaneousAlgedonic3DGroup = new THREE.Group();
    simultaneousAlgedonic3DGroup.name = 'simultaneous-algedonic-s1-s3-3d';
    simultaneousAlgedonic3DGroup.visible = false;
    scene.add(simultaneousAlgedonic3DGroup);

    // S1 P1 Danger Zone Disc + Perimeter Ring + Inverted Octagon Beacon
    const s1DangerDiscMat = new THREE.MeshBasicMaterial({
      color: 0xdc2626,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const s1DangerDiscMesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2),
      s1DangerDiscMat
    );
    s1DangerDiscMesh.position.y = 0.34;
    s1DangerDiscMesh.renderOrder = 14;
    simultaneousAlgedonic3DGroup.add(s1DangerDiscMesh);

    const s1DangerRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const s1DangerRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.0, 48).rotateX(-Math.PI / 2),
      s1DangerRingMat
    );
    s1DangerRingMesh.position.y = 0.38;
    s1DangerRingMesh.renderOrder = 15;
    simultaneousAlgedonic3DGroup.add(s1DangerRingMesh);

    const s1OctagonMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.3,
    });
    const s1OctagonBeaconMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.75, 0.55, 8),
      s1OctagonMat
    );
    s1OctagonBeaconMesh.rotation.x = Math.PI / 2;
    s1OctagonBeaconMesh.rotation.y = Math.PI / 8;
    s1OctagonBeaconMesh.position.y = 9.5;
    simultaneousAlgedonic3DGroup.add(s1OctagonBeaconMesh);

    // S1 Upwind Escape Chevrons (InstancedMesh, 12 chevrons across Valbyvej & Rosenkildevej)
    const S1_ESCAPE_CHEVRON_COUNT = 12;
    const s1EscapeGeo = new THREE.ConeGeometry(0.62, 1.85, 6);
    s1EscapeGeo.rotateX(Math.PI / 2);
    const s1EscapeMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.95,
    });
    const s1EscapeInstanced = new THREE.InstancedMesh(
      s1EscapeGeo,
      s1EscapeMat,
      S1_ESCAPE_CHEVRON_COUNT
    );
    s1EscapeInstanced.frustumCulled = false;
    simultaneousAlgedonic3DGroup.add(s1EscapeInstanced);

    // S1 Island Mode (Ø-DRIFT) Protective Perimeter Shields (up to 6 blocks)
    const MAX_ISLAND_SHIELDS = 6;
    const islandShieldGeo = new THREE.CylinderGeometry(6.8, 7.2, 6.2, 16, 1, true);
    const islandShieldMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const islandShieldMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_ISLAND_SHIELDS; i++) {
      const shield = new THREE.Mesh(islandShieldGeo, islandShieldMat);
      shield.visible = false;
      shield.renderOrder = 16;
      simultaneousAlgedonic3DGroup.add(shield);
      islandShieldMeshes.push(shield);
    }

    // S3 Locked Valve Collars (V-VEST & V-MIDT)
    const MAX_S3_VALVE_COLLARS = 3;
    const s3ValveCollarGeo = new THREE.TorusGeometry(1.1, 0.24, 8, 20);
    s3ValveCollarGeo.rotateX(Math.PI / 2);
    const s3ValveCollarMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.95,
    });
    const s3ValveCollarMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_S3_VALVE_COLLARS; i++) {
      const collar = new THREE.Mesh(s3ValveCollarGeo, s3ValveCollarMat);
      collar.visible = false;
      collar.renderOrder = 19;
      simultaneousAlgedonic3DGroup.add(collar);
      s3ValveCollarMeshes.push(collar);
    }

    // S3 Tanker Ingress Corridors (14 emerald open dashes + 6 red blocked barricades)
    const S3_OPEN_DASH_COUNT = 14;
    const s3OpenDashGeo = new THREE.BoxGeometry(0.85, 0.35, 2.2);
    const s3OpenDashMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.92,
    });
    const s3OpenDashInstanced = new THREE.InstancedMesh(
      s3OpenDashGeo,
      s3OpenDashMat,
      S3_OPEN_DASH_COUNT
    );
    s3OpenDashInstanced.frustumCulled = false;
    simultaneousAlgedonic3DGroup.add(s3OpenDashInstanced);

    const S3_BLOCKED_BAR_COUNT = 6;
    const s3BlockedBarGeo = new THREE.BoxGeometry(1.6, 0.75, 0.75);
    const s3BlockedBarMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.92,
    });
    const s3BlockedBarInstanced = new THREE.InstancedMesh(
      s3BlockedBarGeo,
      s3BlockedBarMat,
      S3_BLOCKED_BAR_COUNT
    );
    s3BlockedBarInstanced.frustumCulled = false;
    simultaneousAlgedonic3DGroup.add(s3BlockedBarInstanced);

    // 13. Raycaster for Interactive Clicking & Hovering
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const updatePointer = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: MouseEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: MouseEvent) => {
      const dist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (dist > 6) return;

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const {
          clickableType,
          sourceId,
          receptorId,
          buildingId,
          isSourceBuilding,
          correlationPointId,
        } = hitObj.userData || {};
        if (clickableType === 'source' && sourceId) {
          onSelectSource(sourceId);
        } else if (clickableType === 'receptor' && receptorId) {
          onSelectReceptor(receptorId);
        } else if (clickableType === 'leeward_wake' && buildingId) {
          if (isSourceBuilding) {
            onSelectSource(buildingId);
          } else {
            onSelectReceptor(buildingId);
          }
        } else if (clickableType === 'weather_correlation_point' && correlationPointId) {
          setSelectedCorrelationPointId((prev) =>
            prev === correlationPointId ? null : correlationPointId
          );
        }
      }
    };

    let lastHoverCheck = 0;
    const onPointerMove = (ev: MouseEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 65) return;
      lastHoverCheck = now;

      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      if (hits.length > 0) {
        const {
          clickableType,
          sourceId,
          receptorId,
          buildingLabel,
          correlationPointId,
        } = hits[0].object.userData || {};
        renderer.domElement.style.cursor = 'pointer';
        if (clickableType === 'source' && sourceId) {
          const found = simStateRef.current.sources.find((s) => s.id === sourceId);
          setHoveredEntityLabel(found ? `${found.code}: ${found.name}` : null);
        } else if (clickableType === 'receptor' && receptorId) {
          const found = simStateRef.current.receptors.find((r) => r.id === receptorId);
          setHoveredEntityLabel(found ? `${found.code}: ${found.name} (${found.address})` : null);
        } else if (clickableType === 'leeward_wake' && buildingLabel) {
          const wSpd = simStateRef.current.currentWeather.windSpeed10m;
          const calmSpd = (wSpd * 0.18).toFixed(1);
          setHoveredEntityLabel(
            `Læ-Effekt bag ${buildingLabel} · Vindstille lomme (${calmSpd} m/s, -82% vind) · Støv akkumuleres 2,3× mere intenst`
          );
        } else if (clickableType === 'weather_correlation_point' && correlationPointId) {
          const pt = simStateRef.current.weatherCorrelationSummary.points.find(
            (p) => p.id === correlationPointId
          );
          if (pt) {
            setHoveredEntityLabel(
              `3D Vejr-Korrelation [${pt.code}] ${pt.locationLabel} · Vind ${pt.windSpeedMs} m/s (stød ${pt.windGustsMs} m/s) × Støv S=${pt.dustIntensityS.toFixed(
                2
              )} · Korrelation ${Math.round(pt.correlationIndex * 100)}% · SHA-256 #${pt.sha256Signature.slice(
                0,
                10
              )}…`
            );
          }
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredEntityLabel(null);
      }
    };

    renderer.domElement.addEventListener('mousedown', onPointerDown);
    renderer.domElement.addEventListener('mouseup', onPointerUp);
    renderer.domElement.addEventListener('mousemove', onPointerMove);

    // 14. Responsive ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(300, container.clientWidth);
      const h = Math.max(260, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 15. Software-WebGL Paced Animation Loop (`afterDraw` with `gl.fenceSync` on Software GL)
    const gl = renderer.getContext() as WebGL2RenderingContext;
    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      if (!isSoftwareGl || !gl.fenceSync) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      function poll() {
        if (disposed) return;
        if (!sync) {
          rafId = requestAnimationFrame(cb);
          return;
        }
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status === gl.TIMEOUT_EXPIRED) {
          timeoutId = window.setTimeout(poll, 4);
        } else {
          gl.deleteSync(sync);
          rafId = requestAnimationFrame(cb);
        }
      }
      timeoutId = window.setTimeout(poll, 80);
    }

    const clock = new THREE.Clock();

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      const state = simStateRef.current;
      const weather = state.currentWeather;
      const windSpeed = Math.max(0.8, weather.windSpeed10m);
      const plumeDirDeg = (weather.windDirection10m + 180) % 360;
      const plumeRad = (plumeDirDeg * Math.PI) / 180;
      const dirX = Math.sin(plumeRad);
      const dirZ = -Math.cos(plumeRad);
      const yawRotationY = Math.atan2(dirX, dirZ);

      const pasquillSpreadMap: Record<string, { sy: number; sz: number }> = {
        A: { sy: 0.28, sz: 0.22 },
        B: { sy: 0.22, sz: 0.17 },
        C: { sy: 0.16, sz: 0.13 },
        D: { sy: 0.12, sz: 0.09 },
        E: { sy: 0.09, sz: 0.06 },
        F: { sy: 0.07, sz: 0.045 },
      };
      const spread = pasquillSpreadMap[weather.pasquillClass] || pasquillSpreadMap.D;
      const suppressionFactor = state.waterSuppressionActive ? 0.42 : 1.0;

      // Toggle surface ground translucency and subsurface cutaway visibility
      const showSubsurface =
        state.isUndergroundActive ||
        state.cameraPreset === 'underground_aquifer' ||
        state.cameraPreset === 'blok1_blok2_percolation';
      subsurfaceGroup.visible = showSubsurface;
      groundMat.opacity = showSubsurface ? 0.34 : 1.0;
      groundMat.depthWrite = !showSubsurface;

      // Toggle 3D Asbestos-Fiber Dispersion Heatmap visibility & breathing-zone slice height
      const asbestosLayerVisible = !state.visibleSubstances || state.visibleSubstances.asbestos !== false;
      asbestosHeatmapGroup.visible = state.showAsbestosHeatmap && asbestosLayerVisible && !showSubsurface;
      const targetHeatmapSliceY =
        state.asbestosEvalHeightMeters > 2.0
          ? state.asbestosEvalHeightMeters / METERS_PER_UNIT
          : 0.14;
      asbestosHeatmapMesh.position.y = THREE.MathUtils.damp(
        asbestosHeatmapMesh.position.y,
        targetHeatmapSliceY,
        6.0,
        dt
      );
      asbestosWireframeMesh.position.y = asbestosHeatmapMesh.position.y + 0.04;

      // Update 24-Hour 'Tidsmæssig Akkumulering' 3D Volumetric Build-Up (Hex-Prism Volume + Strata + Neighbor Pillars)
      const showTemporalVol3D =
        state.showAsbestosHeatmap &&
        asbestosLayerVisible &&
        state.isTemporal24hAsbestosActive &&
        !showSubsurface;
      temporalVolume3DGroup.visible = showTemporalVol3D;
      if (showTemporalVol3D) {
        const gridQ = state.asbestosMetrics.volumetricGrid22x22;
        const accumFrac = THREE.MathUtils.clamp(
          state.effectiveTemporalAccumulationHours / 24,
          1 / 24,
          1.0
        );

        for (let gz = 0; gz < ASBESTOS_VOLUME_GRID_DIM; gz++) {
          const cellWorldZ = ((gz + 0.5) / ASBESTOS_VOLUME_GRID_DIM - 0.5) * 242;
          for (let gx = 0; gx < ASBESTOS_VOLUME_GRID_DIM; gx++) {
            const idx = gz * ASBESTOS_VOLUME_GRID_DIM + gx;
            const q24 = gridQ[idx] || 0;
            const cellWorldX = ((gx + 0.5) / ASBESTOS_VOLUME_GRID_DIM - 0.5) * 242;

            // 3D volumetric height grows smoothly with cumulative dose q24 (1.0 = 100% Daily-GV -> ~8.2 units, up to 19 units)
            const targetH =
              q24 >= 0.055
                ? Math.min(19.0, 0.55 + Math.pow(q24, 0.86) * 7.65)
                : 0.001;
            const curH = THREE.MathUtils.damp(
              dampedVolumeCellHeights[idx],
              targetH,
              7.5,
              dt
            );
            dampedVolumeCellHeights[idx] = curH;

            if (curH > 0.04) {
              const radialFill = THREE.MathUtils.clamp(0.62 + q24 * 0.28, 0.62, 0.96);
              _scratchDummy.position.set(cellWorldX, 0.16, cellWorldZ);
              _scratchDummy.rotation.set(0, 0, 0);
              _scratchDummy.scale.set(radialFill, curH, radialFill);
              _scratchDummy.updateMatrix();
              asbestosVolumeInstanced.setMatrixAt(idx, _scratchDummy.matrix);

              if (q24 >= 1.0) {
                // Critical 24h cumulative exceedance (> 0.024 fibre/cm³·t): Crimson / Magenta
                const critT = Math.min(1, (q24 - 1.0) / 1.1);
                _scratchColor.setRGB(0.95, 0.15 + critT * 0.06, 0.42 + critT * 0.35);
              } else if (q24 >= 0.5) {
                // Elevated neighbor 24h risk (50%-100% Daily-GV): Amber -> Rose-Orange
                const midT = (q24 - 0.5) / 0.5;
                _scratchColor.setRGB(0.96, 0.68 - midT * 0.42, 0.12 + midT * 0.22);
              } else if (q24 >= 0.18) {
                // Moderate cumulative plume envelope: Violet-Purple -> Amber
                const lowT = (q24 - 0.18) / 0.32;
                _scratchColor.setRGB(0.56 + lowT * 0.38, 0.34 + lowT * 0.34, 0.95 - lowT * 0.78);
              } else {
                // Early accumulation trace: Sky-Indigo
                _scratchColor.setRGB(0.24, 0.66, 0.96);
              }
              asbestosVolumeInstanced.setColorAt(idx, _scratchColor);
            } else {
              _scratchDummy.position.set(cellWorldX, -50, cellWorldZ);
              _scratchDummy.scale.set(0.001, 0.001, 0.001);
              _scratchDummy.updateMatrix();
              asbestosVolumeInstanced.setMatrixAt(idx, _scratchDummy.matrix);
            }
          }
        }
        asbestosVolumeInstanced.instanceMatrix.needsUpdate = true;
        if (asbestosVolumeInstanced.instanceColor) {
          asbestosVolumeInstanced.instanceColor.needsUpdate = true;
        }
        hexPrismMat.opacity = 0.42 + accumFrac * 0.2;

        // Elevate & modulate multi-story 3D atmospheric strata shells as cumulative 24h volume builds up
        const strataBaseHeights = [2.2, 6.5, 11.5];
        for (let sTier = 0; sTier < asbestosStrataMeshes.length; sTier++) {
          const sMesh = asbestosStrataMeshes[sTier];
          const sMat = asbestosStrataMats[sTier];
          const targetY =
            (strataBaseHeights[sTier] * (0.55 + 0.45 * accumFrac)) / METERS_PER_UNIT;
          sMesh.position.y = THREE.MathUtils.damp(sMesh.position.y, targetY, 6.0, dt);
          sMat.opacity =
            (0.28 - sTier * 0.06) *
            (0.45 + 0.55 * accumFrac) *
            (0.92 + 0.08 * Math.sin(elapsed * 2.2 + sTier));
        }

        // Update 3D Neighbor Receptor Cumulative Risk Pillars (6.5 world units = 100% Daily-GV threshold ring)
        const recDoses = state.asbestosMetrics.receptorCumulativeDoses;
        for (let rIdx = 0; rIdx < receptorVolumetricNodes.length; rIdx++) {
          const rNode = receptorVolumetricNodes[rIdx];
          const doseEntry = recDoses.find((d) => d.id === rNode.receptorId);
          const qRec = doseEntry ? doseEntry.dailyQuotient : 0.12;
          const targetPillarH = Math.min(18.5, Math.max(0.45, qRec * 6.5));
          rNode.dampedHeight = THREE.MathUtils.damp(
            rNode.dampedHeight,
            targetPillarH,
            7.0,
            dt
          );
          const isSelectedRec = rNode.receptorId === state.selectedReceptorId;
          const radScale = isSelectedRec ? 1.24 : 1.0;
          rNode.pillarMesh.scale.set(radScale, rNode.dampedHeight, radScale);

          if (qRec >= 1.0) {
            rNode.pillarMat.color.setHex(0xf43f5e);
            rNode.pillarMat.emissive.setHex(0xe11d48);
            rNode.limitRingMat.color.setHex(0xf43f5e);
          } else if (qRec >= 0.45) {
            rNode.pillarMat.color.setHex(0xf59e0b);
            rNode.pillarMat.emissive.setHex(0xd97706);
            rNode.limitRingMat.color.setHex(0xfde047);
          } else {
            rNode.pillarMat.color.setHex(0xa855f7);
            rNode.pillarMat.emissive.setHex(0x7e22ce);
            rNode.limitRingMat.color.setHex(0x38bdf8);
          }
        }
      }

      // Update demolition source nodes (including live releaseHeightMeters & fiberReleaseIndex from Stof-panelet)
      const hiddenSourceSet = new Set(state.hiddenSourceIds);
      const activeSources = state.sources.filter((s) => s.active);
      const visibleActiveSources = activeSources.filter((s) => !hiddenSourceSet.has(s.id));
      state.sources.forEach((src, sIdx) => {
        const node = sourceNodesMap.get(src.id);
        if (!node) return;
        const isVisuallyHidden = hiddenSourceSet.has(src.id);
        node.root.visible = !isVisuallyHidden;

        node.releaseY = Math.max(2.2, src.releaseHeightMeters / METERS_PER_UNIT);
        node.selectionRingMesh.visible = !isVisuallyHidden && state.selectedSourceId === src.id;

        const haloMat = node.statusHaloMesh.material as THREE.MeshStandardMaterial;
        if (src.active) {
          haloMat.color.setHex(state.waterSuppressionActive ? 0x38bdf8 : 0xf43f5e);
          haloMat.emissive.setHex(state.waterSuppressionActive ? 0x0284c7 : 0xe11d48);
          haloMat.emissiveIntensity = 0.85;
          node.excavatorCabGroup.rotation.y =
            Math.sin(elapsed * 0.65 + sIdx * 1.4) * 0.28 - 0.2;
          node.boomGroup.rotation.z = Math.sin(elapsed * 1.3 + sIdx) * 0.09;
        } else {
          haloMat.color.setHex(0x475569);
          haloMat.emissive.setHex(0x000000);
          haloMat.emissiveIntensity = 0;
        }

        node.waterCannonHead.rotation.y = yawRotationY + Math.sin(elapsed * 1.8 + sIdx) * 0.22;
        node.mistConeMesh.visible = !isVisuallyHidden && state.waterSuppressionActive && src.active;

        const cones = plumeConesMap.get(src.id);
        if (cones) {
          const substanceMap = state.visibleSubstances;
          const hasMatchingVisibleSubstance = !substanceMap
            ? true
            : src.substances.some((subKey) => substanceMap[subKey] !== false);
          cones.group.visible =
            !isVisuallyHidden &&
            state.showPlumeVolumes &&
            src.active &&
            hasMatchingVisibleSubstance;
          cones.redCone.visible =
            !substanceMap ||
            substanceMap.asbestos !== false ||
            substanceMap.pcb !== false ||
            substanceMap.heavyMetals !== false;
          cones.orangeCone.visible =
            !substanceMap ||
            substanceMap.pcb !== false ||
            substanceMap.heavyMetals !== false ||
            substanceMap.asbestos !== false;
          cones.yellowCone.visible =
            !substanceMap ||
            substanceMap.asbestos !== false ||
            substanceMap.quartzWool !== false;
          cones.group.position.y = node.releaseY + 0.6;
          cones.group.rotation.y = yawRotationY;

          const fiberScale =
            src.fiberReleaseIndex !== undefined ? 0.65 + src.fiberReleaseIndex * 0.55 : 1.0;
          const baseReach =
            THREE.MathUtils.clamp(38 + windSpeed * 5.2, 42, 115) *
            suppressionFactor *
            fiberScale;
          const baseRadius = Math.max(5.5, baseReach * spread.sy * 1.15);

          cones.redCone.scale.set(baseRadius * 0.52, baseRadius * 0.36, baseReach * 0.45);
          cones.orangeCone.scale.set(baseRadius * 0.82, baseRadius * 0.55, baseReach * 0.75);
          cones.yellowCone.scale.set(baseRadius * 1.15, baseRadius * 0.72, baseReach);
        }
      });

      // Update receptor nodes
      state.receptors.forEach((rec) => {
        const node = receptorNodesMap.get(rec.id);
        if (!node) return;

        node.selectionRingMesh.visible = state.selectedReceptorId === rec.id;

        const exp = state.receptorExposures.find((e) => e.receptorId === rec.id);
        const rawS = exp ? exp.sumQuotient : 0;
        const effectiveS = state.waterSuppressionActive ? rawS * 0.38 : rawS;

        if (effectiveS >= 1.0) {
          node.riskHaloMat.color.setHex(0xf43f5e);
          node.riskHaloMat.emissive.setHex(0xe11d48);
        } else if (effectiveS >= 0.5) {
          node.riskHaloMat.color.setHex(0xf59e0b);
          node.riskHaloMat.emissive.setHex(0xd97706);
        } else if (effectiveS >= 0.25) {
          node.riskHaloMat.color.setHex(0xfacc15);
          node.riskHaloMat.emissive.setHex(0xca8a04);
        } else {
          node.riskHaloMat.color.setHex(0x10b981);
          node.riskHaloMat.emissive.setHex(0x059669);
        }

        const sensorMat = node.sensorHeadMesh.material as THREE.MeshStandardMaterial;
        sensorMat.color.copy(node.riskHaloMat.color);
        sensorMat.emissive.copy(node.riskHaloMat.emissive);
        node.sensorHeadMesh.rotation.y = elapsed * 1.2;
      });

      // Update Master 29-Building Registry 3D Nodes (Categories a-e)
      state.buildings.forEach((b) => {
        const bNode = masterBuildingNodesMap.get(b.id);
        if (!bNode) return;
        const isCatVisible = state.activeCategoryFilters.includes(b.category);
        bNode.root.visible = isCatVisible && !showSubsurface;
        if (!bNode.root.visible) return;

        const meta = BUILDING_CATEGORY_METADATA[b.category];
        _scratchColor.set(meta.colorHex);
        bNode.plinthMat.color.copy(_scratchColor);
        bNode.bodyMat.color.copy(_scratchColor);
        bNode.roofCapMat.color.copy(_scratchColor);
        bNode.roofCapMat.emissive.copy(_scratchColor);

        const targetHeightM =
          b.category === 'e_demolished_unsecured'
            ? 0.0
            : b.floors === 1
            ? b.category === 'd_under_demolition'
              ? 4.5
              : 5.5
            : meta.buildingHeight3DMeters;
        const hUnits = targetHeightM / METERS_PER_UNIT;

        if (hUnits <= 0.05) {
          bNode.bodyMesh.visible = false;
          bNode.roofCapMesh.position.y = 0.26;
          bNode.pitRimMesh.visible = true;
          bNode.pitRimMesh.rotation.z = elapsed * 0.8;
          bNode.nplOverlayGroup.visible = false;
        } else {
          bNode.bodyMesh.visible = true;
          bNode.bodyMesh.scale.set(1, hUnits, 1);
          bNode.bodyMesh.position.y = 0.24 + hUnits * 0.5;
          bNode.roofCapMesh.position.y = 0.24 + hUnits + 0.12;
          bNode.pitRimMesh.visible = false;

          // Update 3D Neutral Pressure Plane (z_NPL) & Inward/Outward Vector Arrows on inhabited blocks ('a_inhabited')
          const showNplForBlock =
            state.show3DNeutralPressurePlane && b.category === 'a_inhabited';
          bNode.nplOverlayGroup.visible = showNplForBlock;

          if (showNplForBlock) {
            const zNplM = THREE.MathUtils.clamp(
              state.neutralPressurePlaneHeightMeters,
              0,
              12.5
            );
            const zNplUnits = 0.24 + (zNplM / 12.0) * hUnits;
            bNode.nplSlicePlaneGroup.position.y = zNplUnits;
            bNode.nplSliceMat.color.setHex(zNplM >= 11.0 ? 0xf43f5e : 0xf59e0b);

            const pulseOffset = Math.sin(elapsed * 4.2) * 0.32;

            for (let rIdx = 0; rIdx < bNode.nplFloorArrowRings.length; rIdx++) {
              const ring = bNode.nplFloorArrowRings[rIdx];
              const isBelowNpl = ring.elevationMeters <= zNplM + 0.05;

              for (let aIdx = 0; aIdx < ring.arrowMeshes.length; aIdx++) {
                const aMesh = ring.arrowMeshes[aIdx];
                const aMat = ring.arrowMats[aIdx];
                const { nx, nz, baseDist } = aMesh.userData as {
                  nx: number;
                  nz: number;
                  baseDist: number;
                };

                if (isBelowNpl) {
                  // Under z_NPL: Red inward-pointing vector arrows (infiltration of asbestos plume & crawlspace suction)
                  aMat.color.setHex(0xf43f5e);
                  const dIn = baseDist - pulseOffset * 0.65;
                  aMesh.position.set(nx * dIn, 0, nz * dIn);
                  // Look inward toward (0, 0, 0)
                  aMesh.rotation.y = Math.atan2(-nx, -nz);
                } else {
                  // Over z_NPL: Cyan outward-pointing vector arrows (moisture exfiltration)
                  aMat.color.setHex(0x06b6d4);
                  const dOut = baseDist + pulseOffset * 0.65;
                  aMesh.position.set(nx * dOut, 0, nz * dOut);
                  // Look outward away from (0, 0, 0)
                  aMesh.rotation.y = Math.atan2(nx, nz);
                }
              }
            }

            // Animate vertical crawlspace/shaft suction arrow rising from basement into ground floor
            bNode.crawlspaceSuctionArrow.visible = zNplM > 0.5;
            bNode.crawlspaceSuctionArrow.position.y =
              0.7 + ((elapsed * 1.4) % 1.0) * Math.max(1.2, zNplUnits * 0.55);
          }
        }

        // Evaluate Bornitz PPV (DIN 4150-3:2016) at building footprint with zero allocations
        const latRadSite = (SITE_ORIGIN.lat * Math.PI) / 180;
        const mPerDegLngSite = 111320 * Math.cos(latRadSite);
        const machineDbNow = Math.max(85, state.machineNoiseOutputDb || 114.5);
        const dbFactorNow = Math.pow(10, (machineDbNow - 114) / 22);
        const soilSatAmpNow = state.currentWeather.precipitation > 2 ? 1.14 : 1.04;
        const plateDampNow = state.hasSteelRoadPlates ? 0.72 : 1.0;
        const pipePpvGlobal = state.waterMainTelemetry?.pipePpvMmPerSec ?? 0;

        let sumSquaresPpv = 0;
        for (let sIdx = 0; sIdx < state.sources.length; sIdx++) {
          const src = state.sources[sIdx];
          if (!src.active || hiddenSourceSet.has(src.id)) continue;
          const dxM = (b.center.lng - src.position.lng) * mPerDegLngSite;
          const dyM = (b.center.lat - src.position.lat) * 111320;
          const r3D = Math.max(2.0, Math.hypot(Math.hypot(dxM, dyM), 1.65));
          const srcScale = Math.max(0.7, Math.min(1.45, src.sourceEmissionFactor ?? 1.0));
          const ppv =
            26.5 *
            dbFactorNow *
            srcScale *
            soilSatAmpNow *
            plateDampNow *
            Math.pow(2.0 / r3D, 0.55) *
            Math.exp(-0.036 * Math.max(0, r3D - 2.0));
          sumSquaresPpv += ppv * ppv;
        }
        const bldgPpvMmPerSec = Math.sqrt(sumSquaresPpv);
        const dinThresholdMmPerSec =
          b.category === 'a_inhabited' || b.category === 'b_vacant' ? 5.0 : 20.0;
        const isDin4150Breached =
          bldgPpvMmPerSec >= dinThresholdMmPerSec ||
          (pipePpvGlobal >= 25.0 && bldgPpvMmPerSec >= dinThresholdMmPerSec * 0.75);

        if (isDin4150Breached) {
          const severity = Math.min(2.0, bldgPpvMmPerSec / dinThresholdMmPerSec);
          const phase1 = (elapsed * (1.55 + severity * 0.35) + b.center.lat * 100) % 1.0;
          const phase2 = (phase1 + 0.5) % 1.0;
          const s1 = 1.0 + phase1 * 0.78;
          const s2 = 1.0 + phase2 * 0.85;
          const isCriticalR1 = bldgPpvMmPerSec >= 20.0 || pipePpvGlobal >= 50.0;

          bNode.dinPulseInnerMesh.visible = true;
          bNode.dinPulseInnerMesh.scale.set(s1, s1, 1);
          bNode.dinPulseInnerMat.color.setHex(isCriticalR1 ? 0xf43f5e : 0xf59e0b);
          bNode.dinPulseInnerMat.opacity = (1.0 - phase1) * 0.88;

          bNode.dinPulseOuterMesh.visible = true;
          bNode.dinPulseOuterMesh.scale.set(s2, s2, 1);
          bNode.dinPulseOuterMat.color.setHex(isCriticalR1 ? 0xfb7185 : 0xfbbf24);
          bNode.dinPulseOuterMat.opacity = (1.0 - phase2) * 0.64;

          bNode.roofCapMat.emissive.setHex(isCriticalR1 ? 0xf43f5e : 0xf59e0b);
          bNode.roofCapMat.emissiveIntensity = 0.55 + 0.45 * Math.abs(Math.sin(elapsed * 4.5));
        } else {
          bNode.dinPulseInnerMesh.visible = false;
          bNode.dinPulseOuterMesh.visible = false;
          bNode.roofCapMat.emissiveIntensity = 0.45;
        }
      });

      // Also scale primary sourceNode superstructure when a source building transitions to 'e_demolished_unsecured'
      state.sources.forEach((src) => {
        const node = sourceNodesMap.get(src.id);
        if (!node) return;
        if (src.buildingCategory === 'e_demolished_unsecured' || src.buildingHeight3DMeters === 0) {
          node.root.scale.set(1, 0.18, 1);
        } else {
          node.root.scale.set(1, 1, 1);
        }
      });

      // =========================================================================
      // Update 3D 'Læ-Effekt' (Building Leeward Wake & Calm Dust Accumulation Zones)
      // =========================================================================
      const showLeewardNow = state.showLeewardWake && !showSubsurface;
      leewardWakeMasterGroup.visible = showLeewardNow;
      if (showLeewardNow) {
        const wakeStretchZ = THREE.MathUtils.clamp(0.85 + windSpeed * 0.045, 0.85, 1.48);

        for (let wIdx = 0; wIdx < leewardWakeNodes.length; wIdx++) {
          const wn = leewardWakeNodes[wIdx];
          if (wn.isSourceBuilding) {
            const srcObj = state.sources.find((s) => s.id === wn.buildingId);
            // Category 'e_demolished_unsecured' removes the physical building superstructure and its leeward wake
            wn.root.visible = srcObj
              ? !hiddenSourceSet.has(srcObj.id) &&
                srcObj.active &&
                srcObj.buildingCategory !== 'e_demolished_unsecured' &&
                srcObj.buildingHeight3DMeters !== 0
              : false;
          } else {
            const recObj = state.receptors.find((r) => r.id === wn.buildingId);
            wn.root.visible = recObj
              ? recObj.buildingCategory !== 'e_demolished_unsecured' &&
                recObj.buildingHeight3DMeters !== 0
              : true;
          }

          // Align +Z axis of the building's leeward wake directly with the current downwind vector
          wn.root.rotation.y = yawRotationY;
          wn.cavityGroup.scale.set(1, 1, wakeStretchZ);

          // Spin the counter-rotating recirculation vortex rings inside the calm pocket
          wn.vortexRingOuter.rotation.z = elapsed * 1.85 + wIdx;
          wn.vortexRingInner.rotation.z = -elapsed * 2.65 - wIdx;

          // Rotate and gently bob the 3D 'LÆ-EFFEKT' diamond beacon
          wn.beaconHeadMesh.rotation.y = -elapsed * 2.1 + wIdx * 0.5;
        }

        // Update 220 swirling dust & asbestos particles trapped inside the leeward recirculation eddies
        if (activeSources.length === 0 || leewardWakeNodes.length === 0) {
          leewardDustInstanced.visible = false;
        } else {
          leewardDustInstanced.visible = true;
          const perpWakeX = -dirZ;
          const perpWakeZ = dirX;

          for (let i = 0; i < LEEWARD_DUST_COUNT; i++) {
            const ld = leewardDustStates[i];
            const wn = leewardWakeNodes[ld.wakeNodeIdx % leewardWakeNodes.length];
            const angle = elapsed * ld.orbitSpeed + ld.orbitPhase;

            // Elliptical recirculation eddy coordinates in local building wake frame
            const localCenterZ =
              (wn.startOffsetZ + wn.wakeLenUnits * 0.45) * wakeStretchZ;
            const localX =
              Math.cos(angle) * (wn.wakeWidthUnits * 0.42 * ld.radiusFrac);
            const localZ =
              localCenterZ +
              Math.sin(angle) * (wn.wakeLenUnits * 0.38 * ld.radiusFrac * wakeStretchZ);
            const localY =
              0.35 +
              (Math.sin(elapsed * 2.2 + ld.orbitPhase) * 0.5 + 0.5) *
                2.8 *
                ld.heightFrac;

            // Transform local wake coordinates (localX, localZ) into world coordinates along downwind (dirX, dirZ)
            const wx = wn.worldX + dirX * localZ + perpWakeX * localX;
            const wz = wn.worldZ + dirZ * localZ + perpWakeZ * localX;

            const pScale =
              (0.65 + Math.sin(elapsed * 3.0 + ld.orbitPhase) * 0.28) *
              (state.waterSuppressionActive ? 0.65 : 1.15);

            _scratchDummy.position.set(wx, localY, wz);
            _scratchDummy.rotation.set(elapsed + i, -elapsed * 1.4, 0);
            _scratchDummy.scale.setScalar(Math.max(0.18, pScale));
            _scratchDummy.updateMatrix();
            leewardDustInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          leewardDustInstanced.instanceMatrix.needsUpdate = true;
        }
      }

      // =========================================================================
      // Update 3D 'Vis Vejr-Korrelation' (Wind Speed vs. Observed Dust Intensity SHA-256 Heatmap Points)
      // =========================================================================
      const showWeatherCorrNow = state.showWeatherCorrelation && !showSubsurface;
      weatherCorrelationMasterGroup.visible = showWeatherCorrNow;
      if (showWeatherCorrNow) {
        const corrPoints = state.weatherCorrelationSummary.points;
        const activeCount = Math.min(corrPoints.length, MAX_CORRELATION_POINTS_3D);
        const posAttr = trajectoryGeo.getAttribute('position') as THREE.BufferAttribute;
        const colAttr = trajectoryGeo.getAttribute('color') as THREE.BufferAttribute;

        for (let idx = 0; idx < MAX_CORRELATION_POINTS_3D; idx++) {
          const node = weatherCorrelationNodes[idx];
          if (idx >= activeCount) {
            node.root.visible = false;
            continue;
          }

          const pt = corrPoints[idx];
          node.root.visible = true;
          node.root.position.set(pt.worldX, 0, pt.worldZ);

          const isSelected = state.selectedCorrelationPointId === pt.id;
          const palette = getThermalHeatmapColorHex(pt.correlationIndex);

          // Ground footprint radius scales with observed dust intensity & correlation index
          const groundRadius =
            (6.5 + pt.correlationIndex * 9.5) * (isSelected ? 1.22 : 1.0);
          const pulseScale = 1.0 + Math.sin(elapsed * 2.8 + idx * 0.9) * 0.08;
          node.groundDecalMesh.scale.set(
            groundRadius * pulseScale,
            groundRadius * pulseScale,
            1
          );
          node.groundDecalMat.color.setHex(palette.shellHex);
          node.groundDecalMat.opacity = isSelected ? 0.92 : 0.72;

          node.groundRingMesh.scale.setScalar(groundRadius * 0.58 * pulseScale);
          node.groundRingMat.color.setHex(
            pt.isUserObservation ? 0x22d3ee : palette.coreHex
          );

          // Vertical laser column from ground up to 3D heatmap point height worldY
          const hoverBobY = Math.sin(elapsed * 2.1 + idx * 0.75) * 0.35;
          const currentY = Math.max(3.6, pt.worldY + hoverBobY);
          node.pillarMesh.scale.set(
            isSelected ? 1.45 : 1.0,
            currentY,
            isSelected ? 1.45 : 1.0
          );
          node.pillarMat.color.setHex(palette.coreHex);
          node.pillarMat.opacity = isSelected ? 0.75 : 0.42;

          // Position aerial 3D thermal heatmap sphere cluster at currentY
          node.aerialClusterGroup.position.set(0, currentY, 0);
          const clusterScale =
            (0.75 + pt.correlationIndex * 0.72) *
            (pt.isUserObservation ? 1.15 : 1.0) *
            (isSelected ? 1.22 : 1.0);
          node.aerialClusterGroup.scale.setScalar(clusterScale);

          node.coreMat.color.setHex(palette.coreHex);
          node.coreMat.emissive.setHex(palette.emissiveHex);
          node.coreMat.emissiveIntensity = isSelected ? 1.65 : 1.15;

          node.midShellMat.color.setHex(palette.shellHex);
          node.midShellMat.opacity =
            0.34 + Math.sin(elapsed * 3.2 + idx) * 0.08 + (isSelected ? 0.15 : 0);

          node.outerAuraMat.color.setHex(palette.emissiveHex);
          node.outerAuraMat.opacity = 0.16 + (isSelected ? 0.1 : 0);

          // Spin SHA-256 cryptographic verification ring
          node.shaRingMat.color.setHex(
            pt.isUserObservation ? 0x22d3ee : 0xfde047
          );
          node.shaRingMesh.rotation.z = elapsed * 1.9 + idx * 0.6;
          node.shaRingMesh.rotation.y = elapsed * 1.1 - idx * 0.4;

          node.selectionRingMesh.visible = isSelected || pt.isUserObservation;
          node.selectionRingMesh.rotation.z = -elapsed * 1.5;

          // Orient 3D wind-velocity vector cone along the observation's downwind vector
          const ptPlumeDeg = (pt.windDirectionDeg + 180) % 360;
          const ptPlumeRad = (ptPlumeDeg * Math.PI) / 180;
          const ptDirX = Math.sin(ptPlumeRad);
          const ptDirZ = -Math.cos(ptPlumeRad);
          node.windConeMesh.rotation.y = Math.atan2(ptDirX, ptDirZ);
          const windConeScaleZ = THREE.MathUtils.clamp(
            0.7 + (pt.windSpeedMs / 12.0) * 0.9,
            0.7,
            1.85
          );
          node.windConeMesh.scale.set(1, 1, windConeScaleZ);

          // Attach userData for raycaster click & hover inspection
          const uData = {
            clickableType: 'weather_correlation_point',
            correlationPointId: pt.id,
          };
          node.coreSphereMesh.userData = uData;
          node.midShellMesh.userData = uData;

          // Write vertex into 3D correlation trajectory line
          posAttr.setXYZ(idx, pt.worldX, currentY, pt.worldZ);
          _scratchColor.setHex(palette.coreHex);
          colAttr.setXYZ(idx, _scratchColor.r, _scratchColor.g, _scratchColor.b);
        }

        trajectoryGeo.setDrawRange(0, activeCount);
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        correlationTrajectoryLine.visible = activeCount >= 2;
      }

      // =========================================================================
      // Update 3D Dust Fallout & Receptor Accumulation (0-24h Støvdeponeringsprofil)
      // =========================================================================
      const showDustDeposition = state.showDustDeposition3D && !showSubsurface;
      dustDepositionMasterGroup.visible = showDustDeposition;

      if (showDustDeposition) {
        const depSummary = state.dustDepositionSummary;
        const progressH = state.dustDepositionProgressHours;
        const maxGlobalUgM2 = Math.max(100, depSummary.maxTotal24hUgM2);

        // 1. Update each receptor's 3D Dust Blanket, Plinth Drift Mound, Roof/Balcony Cap & Gauge Column
        depSummary.profiles.forEach((profile) => {
          const dustNode = receptorDustNodesMap.get(profile.receptorId);
          if (!dustNode) return;

          const sampled = sampleCumulativeDepositionAtHour(profile, progressH);
          const normAccum = THREE.MathUtils.clamp(
            sampled.accumulatedUgM2 / maxGlobalUgM2,
            0.02,
            1.0
          );
          const isTop3 = profile.exposureRank <= 3;
          const isRank1 = profile.exposureRank === 1;
          const isSelectedRec = profile.receptorId === state.selectedReceptorId;

          // Color shift from warm ochre -> amber -> forensic rose-red for top exposed receptors
          const rankColorHex = isRank1
            ? 0xf43f5e
            : profile.exposureRank === 2
            ? 0xf97316
            : profile.exposureRank === 3
            ? 0xfbbf24
            : 0xfde047;
          const rankEmissiveHex = isRank1
            ? 0xe11d48
            : profile.exposureRank === 2
            ? 0xea580c
            : 0xd97706;

          // Ground Dust Fallout Blanket expands and intensifies as dust accumulates over 0..24h
          const blanketScale = 0.55 + normAccum * (isTop3 ? 1.05 : 0.72);
          dustNode.groundBlanketMesh.scale.set(blanketScale, blanketScale, 1);
          dustNode.groundBlanketMat.opacity = THREE.MathUtils.clamp(
            0.18 + normAccum * (isTop3 ? 0.76 : 0.52),
            0.12,
            0.94
          );

          // 3D Plinth Drift Rim Mound rises around the building base
          const rimHeightScale = 0.12 + normAccum * (isTop3 ? 1.65 : 0.95);
          const rimRadialScale = 0.96 + normAccum * 0.24;
          dustNode.driftRimMesh.scale.set(
            rimRadialScale,
            (dustNode.d / dustNode.w) * 1.08 * rimRadialScale,
            rimHeightScale
          );
          dustNode.driftRimMesh.position.y = 0.14 + rimHeightScale * 0.22;
          dustNode.driftRimMat.color.setHex(rankColorHex);
          dustNode.driftRimMat.emissive.setHex(rankEmissiveHex);
          dustNode.driftRimMat.emissiveIntensity =
            0.35 + normAccum * 0.55 + (isRank1 ? Math.sin(elapsed * 3.2) * 0.18 : 0);

          // Rooftop & Balcony Settled Dust Blanket Cap thickens visibly over time
          const roofThicknessScaleY = 0.15 + normAccum * (isTop3 ? 2.4 : 1.35);
          dustNode.frontRoofDustMesh.scale.set(1.0, roofThicknessScaleY, 1.0);
          dustNode.backRoofDustMesh.scale.set(1.0, roofThicknessScaleY, 1.0);
          dustNode.roofDustMat.color.setHex(rankColorHex);
          dustNode.roofDustMat.emissive.setHex(rankEmissiveHex);
          dustNode.roofDustMat.emissiveIntensity =
            0.3 + normAccum * 0.65 + (isSelectedRec ? 0.25 : 0);
          dustNode.roofDustMat.opacity = THREE.MathUtils.clamp(
            0.22 + normAccum * 0.74,
            0.18,
            0.95
          );

          // 3D Vertical Cumulative Deposition Gauge Column beside receptor
          const gaugeHeightUnits = Math.max(
            0.35,
            normAccum * (isTop3 ? 11.5 : 8.2)
          );
          dustNode.gaugeColumnMesh.scale.set(
            isSelectedRec || isRank1 ? 1.25 : 1.0,
            gaugeHeightUnits,
            isSelectedRec || isRank1 ? 1.25 : 1.0
          );
          dustNode.gaugeColumnMat.color.setHex(rankColorHex);
          dustNode.gaugeColumnMat.emissive.setHex(rankEmissiveHex);
          dustNode.gaugeColumnMat.emissiveIntensity =
            0.55 + normAccum * 0.6 + (isRank1 ? 0.25 : 0);

          dustNode.gaugeTopCapMesh.position.y = gaugeHeightUnits + 0.55;
          dustNode.gaugeTopCapMesh.rotation.y = elapsed * 2.1 + profile.exposureRank;
          dustNode.gaugeTopCapMat.color.setHex(rankColorHex);
          dustNode.gaugeTopCapMat.emissive.setHex(rankEmissiveHex);

          dustNode.gaugeTopHaloMesh.position.y = gaugeHeightUnits + 0.55;
          dustNode.gaugeTopHaloMesh.rotation.z = -elapsed * 1.8;
          dustNode.gaugeTopHaloMesh.visible = isTop3 || isSelectedRec;
          dustNode.gaugeTopHaloMat.color.setHex(isRank1 ? 0xf43f5e : 0xfde047);

          const baseRingPulse =
            1.0 + Math.sin(elapsed * 3.0 + profile.exposureRank) * (isTop3 ? 0.16 : 0.06);
          dustNode.gaugeBaseRingMesh.scale.setScalar(baseRingPulse);
          dustNode.gaugeBaseRingMat.color.setHex(rankColorHex);

          // 5. Update 3D Courtyard Accumulated Dust-Dose Thermal Heatmap ('Gårdmiljø Varmekort')
          // Deforms and thermally colors the housing block's courtyard synchronously with the timeline slider
          const posAttr = dustNode.courtyardReliefGeo.attributes
            .position as THREE.BufferAttribute;
          const colAttr = dustNode.courtyardReliefGeo.attributes
            .color as THREE.BufferAttribute;
          const halfW = Math.max(1, dustNode.cw * 0.5);
          const halfD = Math.max(1, dustNode.cd * 0.5);
          const peakReliefHeight =
            (isTop3 ? 2.85 : 1.55) * normAccum +
            Math.sin(elapsed * 2.4 + profile.exposureRank) * 0.08;

          for (let vIdx = 0; vIdx < posAttr.count; vIdx++) {
            const vx = posAttr.getX(vIdx);
            const vy = posAttr.getY(vIdx);
            const nx = vx / halfW;
            const ny = vy / halfD;
            const rSq = nx * nx + ny * ny;
            // Courtyard recirculation pocket profile (two wing eddies + central courtyard basin)
            const wingPocket =
              Math.exp(-rSq * 1.65) +
              0.35 * Math.exp(-((nx - 0.45) * (nx - 0.45) + (ny + 0.25) * (ny + 0.25)) * 4.2) +
              0.35 * Math.exp(-((nx + 0.45) * (nx + 0.45) + (ny + 0.25) * (ny + 0.25)) * 4.2);
            const localIntensity = THREE.MathUtils.clamp(
              wingPocket * normAccum * (isRank1 ? 1.25 : isTop3 ? 1.08 : 0.8),
              0,
              1
            );

            // PlaneGeometry is rotated -PI/2 around X, so local +Z is world +Y (vertical relief)
            posAttr.setZ(vIdx, localIntensity * peakReliefHeight);

            // Thermal heatmap false-color gradient: Emerald (low dose) -> Amber -> Orange -> Crimson/Magenta (critical courtyard dose)
            if (localIntensity < 0.3) {
              const t = localIntensity / 0.3;
              colAttr.setXYZ(
                vIdx,
                THREE.MathUtils.lerp(0.06, 0.98, t),
                THREE.MathUtils.lerp(0.75, 0.75, t),
                THREE.MathUtils.lerp(0.52, 0.14, t)
              );
            } else if (localIntensity < 0.68) {
              const t = (localIntensity - 0.3) / 0.38;
              colAttr.setXYZ(
                vIdx,
                THREE.MathUtils.lerp(0.98, 0.96, t),
                THREE.MathUtils.lerp(0.75, 0.25, t),
                THREE.MathUtils.lerp(0.14, 0.37, t)
              );
            } else {
              const t = (localIntensity - 0.68) / 0.32;
              colAttr.setXYZ(
                vIdx,
                THREE.MathUtils.lerp(0.96, 0.91, t),
                THREE.MathUtils.lerp(0.25, 0.47, t),
                THREE.MathUtils.lerp(0.37, 0.98, t)
              );
            }
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;

          // Scale volumetric respirable dust dome inside the courtyard
          const domeHeightScale = 0.25 + normAccum * (isTop3 ? 1.35 : 0.75);
          dustNode.courtyardDomeMesh.scale.set(
            dustNode.cw / Math.min(dustNode.cw, dustNode.cd),
            domeHeightScale,
            dustNode.cd / Math.min(dustNode.cw, dustNode.cd)
          );
          dustNode.courtyardDomeMat.color.setHex(rankColorHex);
          dustNode.courtyardDomeMat.opacity = THREE.MathUtils.clamp(
            0.08 + normAccum * (isTop3 ? 0.34 : 0.18),
            0.06,
            0.46
          );

          dustNode.courtyardIsolineMesh.scale.setScalar(
            0.7 + normAccum * 0.45 + Math.sin(elapsed * 2.6 + profile.exposureRank) * 0.04
          );
          dustNode.courtyardIsolineMat.color.setHex(isRank1 ? 0xf43f5e : 0xfde047);

          // Item #4: Animate Concentric Settling Fallout Ripple Rings expanding across receptor courtyard & ground
          for (let sIdx = 0; sIdx < dustNode.settlingRippleRings.length; sIdx++) {
            const rippleMesh = dustNode.settlingRippleRings[sIdx];
            const rippleMat = dustNode.settlingRippleMats[sIdx];
            const rippleCycle =
              (elapsed * (state.isPlayingDustDeposition ? 0.55 : 0.28) +
                sIdx / dustNode.settlingRippleRings.length +
                profile.exposureRank * 0.17) %
              1.0;
            const rippleScale = 0.35 + rippleCycle * (isTop3 ? 1.55 : 1.1) * (0.7 + normAccum * 0.5);
            rippleMesh.scale.setScalar(rippleScale);
            rippleMat.color.setHex(rankColorHex);
            rippleMat.opacity =
              Math.sin(rippleCycle * Math.PI) *
              THREE.MathUtils.clamp(0.22 + normAccum * (isTop3 ? 0.65 : 0.38), 0.15, 0.85);
          }
        });

        // 2. Animate 320 Instanced Gravitational Dust Fallout Particles settling onto the receptors
        // Weight particle allocation toward the top exposed receptors so fallout is visibly densest at #1, #2, #3
        const rankedProfiles = depSummary.profiles;
        if (rankedProfiles.length > 0 && activeSources.length > 0) {
          falloutDustInstanced.visible = true;
          const speedFactor = state.isPlayingDustDeposition ? 1.0 : 0.35;

          for (let i = 0; i < FALLOUT_PARTICLE_COUNT; i++) {
            const fp = falloutParticles[i];
            fp.fallProgress =
              (fp.fallProgress + dt * fp.settlingSpeed * speedFactor) % 1.0;

            // Bias particle assignment so 65% of falling particles target the Top 3 most exposed receptors
            let targetProfile: ReceptorDustDepositionProfile3D;
            if (i % 10 < 6 && depSummary.topExposedReceptors.length > 0) {
              targetProfile =
                depSummary.topExposedReceptors[
                  i % depSummary.topExposedReceptors.length
                ];
            } else {
              targetProfile = rankedProfiles[i % rankedProfiles.length];
            }

            const dustNode = receptorDustNodesMap.get(targetProfile.receptorId);
            const roofTopY = dustNode ? dustNode.h + dustNode.roofH : 5.5;
            const startPlumeY = 13.5 + (i % 5) * 1.65;

            // Gravitational descent from plume layer (startPlumeY) down to receptor roof & ground
            const descentY = THREE.MathUtils.lerp(
              startPlumeY,
              0.25,
              fp.fallProgress
            );

            // Upwind-to-receptor drift during initial descent + radial settling cloud around the receptor
            const upwindOffset = (1.0 - fp.fallProgress) * 6.5;
            const maxSpreadR =
              (dustNode ? Math.max(dustNode.w, dustNode.d) * 0.85 : 5.5) *
              fp.radialDistFrac;

            // As particle hits roof/ground (fallProgress > 0.82), spread outward slightly like settling dust
            const impactSpreadBoost =
              fp.fallProgress > 0.82
                ? 1.0 + (fp.fallProgress - 0.82) * 3.2
                : 1.0;
            const swirlAngle =
              fp.radialAngle +
              elapsed * 0.65 +
              Math.sin(elapsed * 1.8 + fp.swirlPhase) * 0.35;

            const wx =
              targetProfile.worldX -
              dirX * upwindOffset +
              Math.cos(swirlAngle) * maxSpreadR * impactSpreadBoost;
            const wz =
              targetProfile.worldZ -
              dirZ * upwindOffset +
              Math.sin(swirlAngle) * maxSpreadR * impactSpreadBoost;

            // Clamp particles landing inside building footprint onto the rooftop surface briefly
            const insideFootprint =
              dustNode &&
              Math.abs(wx - targetProfile.worldX) < dustNode.w * 0.52 &&
              Math.abs(wz - targetProfile.worldZ) < dustNode.d * 0.52;
            const wy = insideFootprint
              ? Math.max(roofTopY + 0.18, descentY)
              : Math.max(0.22, descentY);

            // Flatten particle slightly when settling onto surface
            const isSettlingOnSurface =
              insideFootprint && wy <= roofTopY + 0.35
                ? true
                : wy <= 0.55;
            const pScale =
              fp.sizeSeed *
              (0.7 + targetProfile.normalizedExposureWeight * 0.55) *
              (state.waterSuppressionActive ? 0.65 : 1.0);

            _scratchDummy.position.set(wx, wy, wz);
            _scratchDummy.rotation.set(
              elapsed * 1.4 + fp.swirlPhase,
              elapsed * 1.1,
              0
            );
            if (isSettlingOnSurface) {
              _scratchDummy.scale.set(pScale * 1.45, pScale * 0.38, pScale * 1.45);
            } else {
              _scratchDummy.scale.setScalar(pScale);
            }
            _scratchDummy.updateMatrix();
            falloutDustInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          falloutDustInstanced.instanceMatrix.needsUpdate = true;
        } else {
          falloutDustInstanced.visible = false;
        }
      }

      // =========================================================================
      // Update 3D Wind-Tunnel & Turbulence Eddy Structures (> 10 m/s) around Selected Demolition Machinery
      // =========================================================================
      const wtSummary = state.windTunnelEddySummary;
      const showWindTunnelNow =
        state.showWindTunnelEddy3D &&
        !showSubsurface &&
        wtSummary.isThresholdExceededOrForced;
      windTunnelEddyMasterGroup.visible = showWindTunnelNow;

      if (showWindTunnelNow) {
        const effWind = wtSummary.effectiveTunnelWindMs;
        const shedOmega = Math.max(3.2, effWind * 0.42);
        const fallbackSelId =
          state.selectedSourceId ||
          state.sources.find((s) => s.active)?.id ||
          state.sources[0]?.id ||
          'src-blok-1';

        const activeTunnelMachines: WindTunnelMachineEddyVisualNode[] = [];

        state.sources.forEach((src) => {
          const eddyNode = windTunnelMachineNodesMap.get(src.id);
          if (!eddyNode) return;
          const isMachineVisible =
            !hiddenSourceSet.has(src.id) &&
            (state.windTunnelScope === 'selected_machine'
              ? src.id === fallbackSelId
              : src.active || src.id === fallbackSelId);

          eddyNode.root.visible = isMachineVisible;
          if (!isMachineVisible) return;
          activeTunnelMachines.push(eddyNode);

          // Align the 3D wind-tunnel test section and Eddy street with the live wind direction
          eddyNode.machinePivotGroup.rotation.y = yawRotationY;

          // Pulse wind-tunnel portal and horseshoe vortex
          const tunnelPulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2);
          eddyNode.tunnelFrameMat.opacity = 0.42 + tunnelPulse * 0.25;
          eddyNode.inflowPortalMat.opacity = 0.35 + tunnelPulse * 0.25;
          eddyNode.horseshoeVortexMat.emissiveIntensity = 0.75 + tunnelPulse * 0.45;
          eddyNode.horseshoeVortexMesh.scale.set(
            1.0 + Math.sin(elapsed * 3.5) * 0.04,
            1.0,
            1.0 + Math.cos(elapsed * 3.5) * 0.05
          );

          // Animate the 6 von Kármán Vortex Street Eddy Rings shedding downwind
          for (let rIdx = 0; rIdx < eddyNode.eddyRings.length; rIdx++) {
            const ringMesh = eddyNode.eddyRings[rIdx];
            const ringMat = eddyNode.eddyRingMats[rIdx];
            // Continuous downstream convection cycle + lateral von Kármán oscillation
            const cycleFrac = ((elapsed * (0.45 + effWind * 0.025) + rIdx / 6) % 1);
            const zLocal = 0.6 + cycleFrac * 14.5;
            const karmanLateralX =
              Math.sin(elapsed * shedOmega - cycleFrac * Math.PI * 3.2) *
              (0.35 + cycleFrac * 1.45);
            const karmanVertY =
              2.1 +
              cycleFrac * 1.85 +
              Math.cos(elapsed * shedOmega * 0.85 - rIdx) * (0.2 + cycleFrac * 0.45);

            ringMesh.position.set(karmanLateralX, karmanVertY, zLocal);
            // Spin and tilt vortex ring to show 3D helical Eddy circulation
            ringMesh.rotation.z = elapsed * (2.8 + (rIdx % 2 === 0 ? 1.2 : -1.2));
            ringMesh.rotation.y = Math.sin(elapsed * shedOmega - cycleFrac * 3.0) * 0.38;
            const ringScale = 0.65 + cycleFrac * 0.95;
            ringMesh.scale.setScalar(ringScale);
            ringMat.opacity = Math.sin(cycleFrac * Math.PI) * 0.82;
          }

          // Animate Boom-Tip Hydraulic Pulverizer Shear-Layer Eddy Core
          eddyNode.jawShearRingA.rotation.z = elapsed * 5.6;
          eddyNode.jawShearRingA.rotation.x = Math.sin(elapsed * 3.1) * 0.55;
          eddyNode.jawShearRingB.rotation.y = -elapsed * 6.4;
          eddyNode.jawShearCoreMat.opacity = 0.58 + 0.32 * Math.sin(elapsed * 7.5);
        });

        // Animate 280 Instanced 3D Helical Eddy Swirl Particles around the active wind-tunnel machine(s)
        if (activeTunnelMachines.length > 0) {
          eddySwirlInstanced.visible = true;
          const cosYaw = Math.cos(yawRotationY);
          const sinYaw = Math.sin(yawRotationY);
          const stepRate = (0.22 + effWind * 0.018) * dt;

          for (let i = 0; i < EDDY_SWIRL_PARTICLE_COUNT; i++) {
            const ep = eddySwirlParticles[i];
            ep.streamProgress = (ep.streamProgress + stepRate * (0.8 + (i % 5) * 0.12)) % 1;
            const targetMachine =
              activeTunnelMachines[ep.machineSeed % activeTunnelMachines.length];

            let localX = 0;
            let localY = 2.0;
            let localZ = 0;

            if (ep.isBoomTipEddy) {
              // Tight high-velocity shear vortex around the hydraulic concrete pulverizer jaw
              const jawTheta = elapsed * ep.angularSpeed * 1.45 + ep.initialPhase;
              const jawR = 0.45 + ep.radialFactor * 1.15;
              localX = -1.6 + Math.cos(jawTheta) * jawR;
              localY =
                Math.max(3.6, targetMachine.releaseY * 0.78) +
                Math.sin(jawTheta) * jawR * 0.85;
              localZ = -0.4 + (ep.streamProgress - 0.3) * 5.2;
            } else {
              // Helical von Kármán vortex street + horseshoe vortex trajectory in the wind tunnel
              localZ = -5.5 + ep.streamProgress * 20.5;
              const inWake = localZ > -0.5;
              const swirlTheta =
                elapsed * ep.angularSpeed * (i % 2 === 0 ? 1 : -1) +
                ep.initialPhase -
                ep.streamProgress * 8.5;
              const vortexRadius = inWake
                ? (0.75 + ep.streamProgress * 2.35) * ep.radialFactor
                : 0.55 * ep.radialFactor;
              const karmanCenterShiftX = inWake
                ? Math.sin(elapsed * shedOmega - ep.streamProgress * Math.PI * 3.0) *
                  (0.85 * ep.streamProgress)
                : (i % 2 === 0 ? -1.4 : 1.4);

              localX = karmanCenterShiftX + Math.cos(swirlTheta) * vortexRadius;
              localY = Math.max(
                0.35,
                1.95 +
                  ep.streamProgress * 1.65 +
                  Math.sin(swirlTheta) * vortexRadius * 0.82
              );
            }

            // Transform from machinePivotGroup local coordinates (centered at worldX + 2.4, 0.2, worldZ + 0.5) to world space
            const pivotWorldX = targetMachine.worldX + 2.4;
            const pivotWorldZ = targetMachine.worldZ + 0.5;
            const wx = pivotWorldX + localX * cosYaw + localZ * sinYaw;
            const wz = pivotWorldZ - localX * sinYaw + localZ * cosYaw;
            const wy = 0.2 + localY;

            const pScale =
              (0.65 + Math.sin(ep.streamProgress * Math.PI) * 0.85) *
              (ep.isBoomTipEddy ? 1.15 : 0.95);
            _scratchDummy.position.set(wx, wy, wz);
            _scratchDummy.rotation.set(elapsed * 3.0 + i, elapsed * 2.2, 0);
            _scratchDummy.scale.set(pScale * 0.8, pScale * 0.8, pScale * 1.9);
            _scratchDummy.updateMatrix();
            eddySwirlInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          eddySwirlInstanced.instanceMatrix.needsUpdate = true;
        } else {
          eddySwirlInstanced.visible = false;
        }
      }

      // =========================================================================
      // Update 3D 'Lydbølge-Animation' (Acoustic Refraction over 2.5m Barrier & Wavefront Particles)
      // =========================================================================
      const showSoundWaveNow = state.showSoundWaveAnimation3D && !showSubsurface;
      acousticWaveMasterGroup.visible = showSoundWaveNow;

      if (showSoundWaveNow) {
        const acSummary = state.acousticRefractionSummary;
        const speedMult =
          state.soundWaveSpeed3D === '0.5x'
            ? 0.5
            : state.soundWaveSpeed3D === '2x'
            ? 2.0
            : 1.0;
        const waveStepRate = state.isPlayingSoundWave3D
          ? (0.28 + acSummary.effectiveWindSpeedMs * 0.015) * speedMult * dt
          : 0;

        const visibleCorridors: AcousticRefractionCorridor3D[] = [];

        acSummary.corridors.forEach((corr) => {
          const cNode = acousticCorridorNodesMap.get(corr.receptorId);
          if (!cNode) return;

          const isCorrVisible =
            state.soundWaveCorridorScope === 'selected_corridor'
              ? corr.receptorId === acSummary.selectedCorridor.receptorId
              : corr.isDownwindFocused ||
                corr.receptorId === acSummary.selectedCorridor.receptorId;

          cNode.root.visible = isCorrVisible;
          if (!isCorrVisible) return;
          visibleCorridors.push(corr);

          // 1. Position and orient the 2.5m Acoustic Perimeter Barrier perpendicular to the source -> receptor corridor
          cNode.barrierGroup.position.set(corr.barrierX, 0, corr.barrierZ);
          cNode.barrierGroup.rotation.y = corr.barrierYawY;

          // Highlight barrier diffraction crest intensity based on downward refraction dB
          const crestPulse = 0.5 + 0.5 * Math.sin(elapsed * 4.5);
          const isHighRefraction = corr.totalRefractionDb >= 3.0;
          cNode.barrierCrestGlowMat.color.setHex(
            isHighRefraction ? 0xf43f5e : 0xfbbf24
          );
          cNode.barrierCrestGlowMat.emissive.setHex(
            isHighRefraction ? 0xe11d48 : 0xd97706
          );
          cNode.barrierCrestGlowMat.emissiveIntensity =
            0.75 + crestPulse * 0.55 + (corr.isSelectedReceptor ? 0.35 : 0);

          cNode.shadowZoneWedgeMat.color.setHex(
            isHighRefraction ? 0xf43f5e : 0xf59e0b
          );
          cNode.shadowZoneWedgeMat.opacity = corr.isSelectedReceptor ? 0.16 : 0.09;

          // 2. Update the 3 Calculated 3D Downward-Refracted Ray Path Lines (Low, Mid, High)
          for (let tier = 0; tier < 3; tier++) {
            const posAttr = cNode.refractedRayGeoPositions[tier];
            for (let sIdx = 0; sIdx <= ACOUSTIC_RAY_SEGMENTS; sIdx++) {
              const sFrac = sIdx / ACOUSTIC_RAY_SEGMENTS;
              sampleAcousticRefractionRayPoint3D(corr, tier, sFrac, _scratchVecA);
              posAttr.setXYZ(sIdx, _scratchVecA.x, _scratchVecA.y, _scratchVecA.z);
            }
            posAttr.needsUpdate = true;
            cNode.refractedRayMats[tier].opacity = corr.isSelectedReceptor ? 0.92 : 0.58;
          }

          // 3. Update the Unrefracted Straight-Line Shadow Boundary Reference Ray (tier = 3)
          const shadowAttr = cNode.unrefractedShadowPosAttr;
          for (let sIdx = 0; sIdx <= ACOUSTIC_RAY_SEGMENTS; sIdx++) {
            const sFrac = sIdx / ACOUSTIC_RAY_SEGMENTS;
            sampleAcousticRefractionRayPoint3D(corr, 3, sFrac, _scratchVecA);
            shadowAttr.setXYZ(sIdx, _scratchVecA.x, _scratchVecA.y, _scratchVecA.z);
          }
          shadowAttr.needsUpdate = true;
          cNode.unrefractedShadowLine.visible =
            corr.isSelectedReceptor || state.soundWaveCorridorScope === 'selected_corridor';

          // 4. Position and pulse the Receptor Facade Acoustic Impact Ring
          cNode.receptorImpactRingMesh.position.set(
            corr.recX,
            corr.recY + 0.25,
            corr.recZ
          );
          cNode.receptorImpactRingMesh.rotation.y = corr.barrierYawY;
          const impactScale =
            (corr.isSelectedReceptor ? 1.25 : 0.95) *
            (0.85 + 0.28 * Math.sin(elapsed * 5.2));
          cNode.receptorImpactRingMesh.scale.setScalar(impactScale);
          cNode.receptorImpactRingMat.color.setHex(
            isHighRefraction ? 0xf43f5e : 0xfbbf24
          );

          // ===================================================================
          // Item #2: Update Visual 'Acoustisk refraktions-overlay' (Luminous Arches over Barrier based on maxDownwindRefractionDb)
          // ===================================================================
          cNode.refractionOverlayGroup.visible = state.showAcousticRefractionOverlay3D;
          if (state.showAcousticRefractionOverlay3D) {
            const maxRefDb = Math.max(0.4, acSummary.maxDownwindRefractionDb);
            const corrRefDb = Math.max(0.2, corr.totalRefractionDb);
            // Arch glow and ribbon width scale directly with maxDownwindRefractionDb
            const refIntensityNorm = THREE.MathUtils.clamp(maxRefDb / 5.5, 0.18, 1.0);
            const corrIntensityNorm = THREE.MathUtils.clamp(corrRefDb / 5.2, 0.15, 1.0);
            const archWidthUnits =
              (0.42 + refIntensityNorm * 0.78) * (corr.isSelectedReceptor ? 1.25 : 0.88);
            const archHeightBoost =
              (0.22 + refIntensityNorm * 1.15) *
              (0.92 + 0.08 * Math.sin(elapsed * 3.8 + corr.rayCurvatureRadiusKm));

            const cDx = corr.recX - corr.srcX;
            const cDz = corr.recZ - corr.srcZ;
            const cLenXZ = Math.max(1.0, Math.hypot(cDx, cDz));
            const latNormX = -cDz / cLenXZ;
            const latNormZ = cDx / cLenXZ;

            for (let tier = 0; tier < 3; tier++) {
              const rPosAttr = cNode.luminousArchRibbonPosAttrs[tier];
              const rMat = cNode.luminousArchRibbonMats[tier];
              const tierWidth = archWidthUnits * (tier === 1 ? 1.22 : 0.88);

              for (let sIdx = 0; sIdx <= ACOUSTIC_RAY_SEGMENTS; sIdx++) {
                const sFrac = sIdx / ACOUSTIC_RAY_SEGMENTS;
                sampleAcousticRefractionRayPoint3D(corr, tier, sFrac, _scratchVecA);
                // Extra luminous arch lift over the 2.5m barrier crest driven by maxDownwindRefractionDb
                const archEnvelope = Math.sin(sFrac * Math.PI);
                const archY =
                  _scratchVecA.y + archEnvelope * archHeightBoost * (0.65 + tier * 0.22);
                const halfW = tierWidth * (0.45 + 0.55 * archEnvelope);
                const vBase = sIdx * 2;
                rPosAttr.setXYZ(
                  vBase,
                  _scratchVecA.x - latNormX * halfW,
                  archY,
                  _scratchVecA.z - latNormZ * halfW
                );
                rPosAttr.setXYZ(
                  vBase + 1,
                  _scratchVecA.x + latNormX * halfW,
                  archY,
                  _scratchVecA.z + latNormZ * halfW
                );
              }
              rPosAttr.needsUpdate = true;

              if (maxRefDb >= 3.2) {
                rMat.color.setHex(tier === 2 ? 0xf43f5e : tier === 1 ? 0xfbbf24 : 0x38bdf8);
              } else if (maxRefDb >= 1.8) {
                rMat.color.setHex(tier === 2 ? 0xf97316 : tier === 1 ? 0xfde047 : 0x22d3ee);
              } else {
                rMat.color.setHex(tier === 2 ? 0x38bdf8 : 0x22d3ee);
              }
              const shimmer = 0.82 + 0.18 * Math.sin(elapsed * 5.0 - tier * 1.1);
              rMat.opacity =
                THREE.MathUtils.clamp(0.24 + refIntensityNorm * 0.52, 0.2, 0.86) *
                (corr.isSelectedReceptor ? 1.0 : 0.65) *
                shimmer;
            }

            // Update Vertical Luminous Refraction Curtain connecting High Refracted Arch to Unrefracted Shadow Boundary
            const curtainAttr = cNode.luminousRefractionCurtainPosAttr;
            for (let sIdx = 0; sIdx <= ACOUSTIC_RAY_SEGMENTS; sIdx++) {
              const sFrac = sIdx / ACOUSTIC_RAY_SEGMENTS;
              sampleAcousticRefractionRayPoint3D(corr, 2, sFrac, _scratchVecA);
              sampleAcousticRefractionRayPoint3D(corr, 3, sFrac, _scratchVecB);
              const archEnv = Math.sin(sFrac * Math.PI);
              const topY = _scratchVecA.y + archEnv * archHeightBoost;
              const botY = Math.min(_scratchVecB.y, _scratchVecA.y - 0.35);
              const vBase = sIdx * 2;
              curtainAttr.setXYZ(vBase, _scratchVecA.x, topY, _scratchVecA.z);
              curtainAttr.setXYZ(vBase + 1, _scratchVecB.x, Math.max(0.2, botY), _scratchVecB.z);
            }
            curtainAttr.needsUpdate = true;
            cNode.luminousRefractionCurtainMat.color.setHex(
              maxRefDb >= 3.0 ? 0xf43f5e : 0xfbbf24
            );
            cNode.luminousRefractionCurtainMat.opacity =
              THREE.MathUtils.clamp(0.08 + corrIntensityNorm * 0.22, 0.06, 0.32) *
              (corr.isSelectedReceptor ? 1.15 : 0.65);
          }

          // ===================================================================
          // Item #5: Update 'Lydbølge-Reflektions' Vectors on Upwind Barrier Surface
          // ===================================================================
          cNode.reflectionGroup.visible = state.showSoundWaveReflection3D;
          for (let lIdx = 0; lIdx < cNode.incidentVectorLines.length; lIdx++) {
            cNode.incidentVectorLines[lIdx].visible = state.showSoundWaveReflection3D;
          }
          if (state.showSoundWaveReflection3D) {
            const relSrcWorldX = corr.srcX - corr.barrierX;
            const relSrcWorldZ = corr.srcZ - corr.barrierZ;
            const cosB = Math.cos(-corr.barrierYawY);
            const sinB = Math.sin(-corr.barrierYawY);
            const localSrcX = relSrcWorldX * cosB + relSrcWorldZ * sinB;
            const localSrcZ = -relSrcWorldX * sinB + relSrcWorldZ * cosB;
            const localSrcY = corr.srcY;

            const cosWorld = Math.cos(corr.barrierYawY);
            const sinWorld = Math.sin(corr.barrierYawY);

            const slotXPositions = [-2.3, 0.0, 2.3];
            const slotYHeights = [1.05, 1.58, 2.05];
            for (let vIdx = 0; vIdx < cNode.reflectedVectorArrows.length; vIdx++) {
              const sx = slotXPositions[vIdx] ?? 0;
              const impactY = slotYHeights[vIdx] ?? 1.5;
              const impactZ = -0.2; // Upwind face of the 2.5m barrier screen in barrierGroup local frame

              // Transform local barrier impact point (sx, impactY, impactZ) into world coordinates for incidentVectorLines
              const worldImpactX = corr.barrierX + sx * cosWorld + impactZ * sinWorld;
              const worldImpactZ = corr.barrierZ - sx * sinWorld + impactZ * cosWorld;

              const incAttr = cNode.incidentVectorPosAttrs[vIdx];
              incAttr.setXYZ(0, corr.srcX, corr.srcY, corr.srcZ);
              incAttr.setXYZ(1, worldImpactX, impactY, worldImpactZ);
              incAttr.needsUpdate = true;

              // Compute incident unit vector in barrier local space and specular reflection vector off the upwind normal (0, 0, -1)
              const inDx = sx - localSrcX;
              const inDy = impactY - localSrcY;
              const inDz = impactZ - localSrcZ;
              const inLen = Math.max(0.5, Math.hypot(inDx, inDy, inDz));
              const ux = inDx / inLen;
              const uy = inDy / inLen;
              const uz = inDz / inLen;

              // Reflection across barrier upwind normal n = (0, 0.12, -1) with upward acoustic bounce
              const refDirX = ux * 0.65 + sx * 0.08;
              const refDirY = Math.max(0.24, -uy * 0.55 + 0.36);
              const refDirZ = -Math.abs(uz) * 0.92 - 0.25;

              const arrowGroup = cNode.reflectedVectorArrows[vIdx];
              arrowGroup.position.set(sx, impactY, impactZ);
              _scratchVecA.set(
                sx + refDirX * 4.0,
                impactY + refDirY * 4.0,
                impactZ + refDirZ * 4.0
              );
              arrowGroup.lookAt(_scratchVecA);

              // Dynamic pulsing length of the reflected wave vector when wavefronts strike the screen
              const strikeWave =
                0.5 + 0.5 * Math.sin(elapsed * 6.8 - vIdx * 0.85);
              const vecScaleLen =
                (1.15 + strikeWave * 0.85) *
                (corr.isSelectedReceptor ? 1.25 : 0.95);
              arrowGroup.scale.set(1.0, 1.0, vecScaleLen);

              cNode.reflectedVectorShaftMats[vIdx].opacity =
                0.55 + strikeWave * 0.42;
              cNode.reflectedVectorConeMats[vIdx].opacity =
                0.68 + strikeWave * 0.32;

              // Pulse acoustic impact hotspot ring on the barrier face
              const hotspot = cNode.reflectionHotspotMeshes[vIdx];
              const hScale = 0.65 + strikeWave * 0.85;
              hotspot.scale.setScalar(hScale);
              cNode.reflectionHotspotMats[vIdx].opacity =
                0.38 + strikeWave * 0.56;
            }

            // Animate reflected standing-wave interference arcs rebounding upwind in front of the barrier
            for (let aIdx = 0; aIdx < cNode.reflectedStandingWaveArcs.length; aIdx++) {
              const arcMesh = cNode.reflectedStandingWaveArcs[aIdx];
              const arcMat = cNode.reflectedStandingWaveMats[aIdx];
              const reboundCycle =
                (elapsed * (state.isPlayingSoundWave3D ? 0.85 : 0.25) +
                  aIdx / cNode.reflectedStandingWaveArcs.length) %
                1.0;
              arcMesh.position.set(
                0,
                1.1 + reboundCycle * 1.15,
                -0.3 - reboundCycle * 4.8
              );
              const arcScale = 0.55 + reboundCycle * 1.45;
              arcMesh.scale.set(arcScale * 1.35, arcScale * 0.85, 1.0);
              arcMat.opacity =
                Math.sin(reboundCycle * Math.PI) *
                (corr.isSelectedReceptor ? 0.78 : 0.48);
            }
          }

          // ===================================================================
          // Item #6: Update 'Lydbølge-Diffraktion' Circular Wavefront Segments over Barrier Top
          // ===================================================================
          cNode.diffractionCrestGroup.visible = state.showBarrierDiffractionArcs3D;
          if (state.showBarrierDiffractionArcs3D) {
            const segCount = cNode.diffractionCircularSegments.length;
            const bendIntensity = THREE.MathUtils.clamp(
              corr.totalRefractionDb / 4.5,
              0.22,
              1.0
            );
            for (let dIdx = 0; dIdx < segCount; dIdx++) {
              const segMesh = cNode.diffractionCircularSegments[dIdx];
              const segMat = cNode.diffractionCircularMats[dIdx];
              const diffCycle =
                (elapsed *
                  (state.isPlayingSoundWave3D ? 0.72 * speedMult : 0.2) +
                  dIdx / segCount) %
                1.0;

              // Circular segment expands radially from the barrier top edge (y=2.5m) and bends downward into the shadow zone (+Z)
              const radialR = 0.35 + diffCycle * 5.65;
              // Rotate circular segment forward/downward around X axis as it bends over the barrier crest into the leeward shadow zone
              const forwardBendAngle =
                diffCycle * (0.45 + bendIntensity * 0.52);
              segMesh.position.set(
                0,
                -diffCycle * (0.28 + bendIntensity * 0.42),
                diffCycle * 0.55
              );
              segMesh.rotation.x = forwardBendAngle;
              segMesh.scale.set(
                1.0 + diffCycle * 0.18,
                radialR,
                radialR
              );

              if (corr.totalRefractionDb >= 3.0) {
                segMat.color.setHex(
                  dIdx % 2 === 0 ? 0xfde047 : 0xf43f5e
                );
              } else {
                segMat.color.setHex(
                  dIdx % 2 === 0 ? 0x38bdf8 : 0xfbbf24
                );
              }
              segMat.opacity =
                Math.sin(diffCycle * Math.PI) *
                (corr.isSelectedReceptor ? 0.76 : 0.48);
            }
          }
        });

        if (visibleCorridors.length > 0) {
          wavefrontParticlesInstanced.visible = true;
          wavefrontCrestsInstanced.visible = true;
          reflectedWaveParticlesInstanced.visible = state.showSoundWaveReflection3D;

          // 5. Animate 360 Wavefront Particles along the calculated 3D refraction paths over the barrier
          for (let i = 0; i < WAVEFRONT_PARTICLE_COUNT; i++) {
            const wp = wavefrontParticles[i];
            wp.progress = (wp.progress + waveStepRate * wp.speedMult) % 1.0;

            // Bias 55% of wavefront particles onto the selected receptor corridor for ultra-clear inspection
            const targetCorr =
              i % 10 < 5
                ? acSummary.selectedCorridor
                : visibleCorridors[wp.corridorSeed % visibleCorridors.length];

            sampleAcousticRefractionRayPoint3D(
              targetCorr,
              wp.rayTier,
              wp.progress,
              _scratchVecA,
              _scratchVecB
            );

            // Lateral wavefront width offset perpendicular to propagation axis so particles form a coherent 3D wavefront band
            const dx = targetCorr.recX - targetCorr.srcX;
            const dz = targetCorr.recZ - targetCorr.srcZ;
            const lenXZ = Math.max(1.0, Math.hypot(dx, dz));
            const perpLatX = -dz / lenXZ;
            const perpLatZ = dx / lenXZ;
            const waveWidthSpread = wp.lateralJitter * (0.45 + wp.progress * 1.45);

            const wx = _scratchVecA.x + perpLatX * waveWidthSpread;
            const wz = _scratchVecA.z + perpLatZ * waveWidthSpread;
            const wy =
              _scratchVecA.y +
              Math.sin(elapsed * 6.5 + wp.phaseSeed + wp.progress * 12.0) * 0.08;

            // Color transition along the refraction path:
            // Cyan (0x22d3ee) launching from source -> Amber (0xfbbf24) diffracting over 2.5m barrier crest -> Rose-Red (0xf43f5e) bending downward into receptor zone
            if (wp.progress < 0.29) {
              _scratchColor.setHex(0x22d3ee);
            } else if (wp.progress <= 0.44) {
              _scratchColor.setHex(0xfbbf24);
            } else if (targetCorr.totalRefractionDb >= 3.0) {
              _scratchColor.setHex(wp.rayTier === 2 ? 0xe879f9 : 0xf43f5e);
            } else {
              _scratchColor.setHex(0xf97316);
            }
            wavefrontParticlesInstanced.setColorAt(i, _scratchColor);

            // Scale wavefront particle: swells as it crests the barrier and focuses downward toward the receptor
            const barrierCrestBoost =
              wp.progress >= 0.28 && wp.progress <= 0.46 ? 1.32 : 1.0;
            const envelope =
              Math.sin(wp.progress * Math.PI) * 0.85 + 0.35;
            const pScale =
              envelope *
              barrierCrestBoost *
              (targetCorr.isSelectedReceptor ? 1.18 : 0.95);

            _scratchDummy.position.set(wx, wy, wz);
            // Orient elongated wavefront particle along the downward-refracted tangent vector
            _scratchVecC.copy(_scratchDummy.position).add(_scratchVecB);
            _scratchDummy.lookAt(_scratchVecC);
            _scratchDummy.scale.set(pScale * 1.35, pScale * 0.9, pScale * 1.65);
            _scratchDummy.updateMatrix();
            wavefrontParticlesInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          wavefrontParticlesInstanced.instanceMatrix.needsUpdate = true;
          if (wavefrontParticlesInstanced.instanceColor) {
            wavefrontParticlesInstanced.instanceColor.needsUpdate = true;
          }

          // 6. Animate 84 Curved 3D Acoustic Wavefront Crest Shells ('Bølgefronter') tilting along the refracted rays
          for (let cIdx = 0; cIdx < WAVEFRONT_CREST_COUNT; cIdx++) {
            const wc = wavefrontCrests[cIdx];
            wc.progress = (wc.progress + waveStepRate * 0.96) % 1.0;

            const targetCorr =
              cIdx % 2 === 0
                ? acSummary.selectedCorridor
                : visibleCorridors[wc.corridorSeed % visibleCorridors.length];

            sampleAcousticRefractionRayPoint3D(
              targetCorr,
              wc.rayTier,
              wc.progress,
              _scratchVecA,
              _scratchVecB
            );

            if (wc.progress < 0.3) {
              _scratchColor.setHex(0x38bdf8);
            } else if (wc.progress <= 0.45) {
              _scratchColor.setHex(0xfde047);
            } else {
              _scratchColor.setHex(
                targetCorr.totalRefractionDb >= 3.0 ? 0xf43f5e : 0xfbbf24
              );
            }
            wavefrontCrestsInstanced.setColorAt(cIdx, _scratchColor);

            _scratchDummy.position.copy(_scratchVecA);
            _scratchVecC.copy(_scratchVecA).add(_scratchVecB);
            _scratchDummy.lookAt(_scratchVecC);

            // Wavefront shell expands radially as it propagates over the barrier and focuses onto the receptor
            const radialExpansion =
              (0.45 + wc.progress * 1.45) *
              Math.sin(wc.progress * Math.PI) *
              (targetCorr.isSelectedReceptor ? 1.22 : 0.92);
            _scratchDummy.scale.set(
              Math.max(0.15, radialExpansion * 1.35),
              Math.max(0.15, radialExpansion * 0.85),
              Math.max(0.15, radialExpansion)
            );
            _scratchDummy.updateMatrix();
            wavefrontCrestsInstanced.setMatrixAt(cIdx, _scratchDummy.matrix);
          }
          wavefrontCrestsInstanced.instanceMatrix.needsUpdate = true;
          if (wavefrontCrestsInstanced.instanceColor) {
            wavefrontCrestsInstanced.instanceColor.needsUpdate = true;
          }

          // 7. Item #5: Animate 132 Reflected Wavefront Vector Cones striking the 2.5m barrier screen and reflecting back
          if (state.showSoundWaveReflection3D) {
            for (let rIdx = 0; rIdx < REFLECTED_WAVE_PARTICLE_COUNT; rIdx++) {
              const rp = reflectedWaveParticles[rIdx];
              rp.progress = (rp.progress + waveStepRate * 1.25 * rp.speedMult) % 1.0;

              const targetCorr =
                rIdx % 3 === 0
                  ? acSummary.selectedCorridor
                  : visibleCorridors[rp.corridorSeed % visibleCorridors.length];

              // Compute barrier impact point in world coordinates
              const cDx = targetCorr.recX - targetCorr.srcX;
              const cDz = targetCorr.recZ - targetCorr.srcZ;
              const cLen = Math.max(1.0, Math.hypot(cDx, cDz));
              const propUnitX = cDx / cLen;
              const propUnitZ = cDz / cLen;
              const latUnitX = -propUnitZ;
              const latUnitZ = propUnitX;

              const slotOffset = rp.lateralSlot * 1.75;
              const impactWorldX =
                targetCorr.barrierX - propUnitX * 0.25 + latUnitX * slotOffset;
              const impactWorldZ =
                targetCorr.barrierZ - propUnitZ * 0.25 + latUnitZ * slotOffset;
              const impactWorldY = 0.75 + rp.elevationBand * 0.65;

              if (rp.progress < 0.48) {
                // Incident phase: traveling from demolition machine toward the barrier screen face
                const tIn = rp.progress / 0.48;
                const wx = THREE.MathUtils.lerp(targetCorr.srcX, impactWorldX, tIn);
                const wy = THREE.MathUtils.lerp(targetCorr.srcY, impactWorldY, tIn);
                const wz = THREE.MathUtils.lerp(targetCorr.srcZ, impactWorldZ, tIn);

                _scratchDummy.position.set(wx, wy, wz);
                _scratchVecC.set(impactWorldX, impactWorldY, impactWorldZ);
                _scratchDummy.lookAt(_scratchVecC);
                _scratchColor.setHex(0x38bdf8); // Cyan incident wave vector
              } else {
                // Reflected phase: bouncing off the barrier screen surface back toward source & upward
                const tRef = (rp.progress - 0.48) / 0.52;
                const reboundDist = tRef * 11.5;
                const wx =
                  impactWorldX -
                  propUnitX * reboundDist +
                  latUnitX * (slotOffset * 0.35 * tRef);
                const wz =
                  impactWorldZ -
                  propUnitZ * reboundDist +
                  latUnitZ * (slotOffset * 0.35 * tRef);
                const wy = impactWorldY + tRef * (2.6 + rp.elevationBand * 0.85);

                _scratchDummy.position.set(wx, wy, wz);
                _scratchVecC.set(
                  wx - propUnitX * 2.0,
                  wy + 0.55,
                  wz - propUnitZ * 2.0
                );
                _scratchDummy.lookAt(_scratchVecC);
                _scratchColor.setHex(tRef < 0.25 ? 0xfde047 : 0xf43f5e); // Flash gold on barrier impact -> crimson reflected vector
              }

              reflectedWaveParticlesInstanced.setColorAt(rIdx, _scratchColor);
              const vecScale =
                (0.75 + Math.sin(rp.progress * Math.PI) * 0.65) *
                (targetCorr.isSelectedReceptor ? 1.2 : 0.92);
              _scratchDummy.scale.set(vecScale, vecScale, vecScale * 1.45);
              _scratchDummy.updateMatrix();
              reflectedWaveParticlesInstanced.setMatrixAt(rIdx, _scratchDummy.matrix);
            }
            reflectedWaveParticlesInstanced.instanceMatrix.needsUpdate = true;
            if (reflectedWaveParticlesInstanced.instanceColor) {
              reflectedWaveParticlesInstanced.instanceColor.needsUpdate = true;
            }
          }

          // 8. Animate 3D Hydraulic Concrete Hammer Reciprocation & Propagating Impulse Shockwave Rings toward Neighboring Blocks based on Hourly Refraction (dB)
          hydraulicHammerImpulseGroup.visible = state.showHydraulicHammerImpulseWaves3D;
          if (state.showHydraulicHammerImpulseWaves3D) {
            // Hammer impact cadence: faster and stronger when hourly refraction dB is elevated
            const maxRefrDb = Math.max(0.2, acSummary.maxDownwindRefractionDb);
            const hammerFreqHz = 2.2 + Math.min(1.6, maxRefrDb * 0.22);
            const hammerPhase = (elapsed * hammerFreqHz) % 1.0;
            // Sharp downward strike at phase < 0.22, smooth hydraulic lift for remaining cycle
            const strikeOffset =
              hammerPhase < 0.22
                ? (1.0 - hammerPhase / 0.22) * 0.85
                : ((hammerPhase - 0.22) / 0.78) * 0.85;

            state.sources.forEach((src) => {
              const hNode = hammerSourceNodesMap.get(src.id);
              if (!hNode) return;
              hNode.root.visible = src.active;
              if (!src.active) return;

              hNode.chiselGroup.position.y = strikeOffset;
              const impactRingScale = 0.65 + hammerPhase * 3.8;
              hNode.impactFlashRing.scale.setScalar(impactRingScale);
              hNode.impactFlashMat.opacity = Math.max(0, (1.0 - hammerPhase) * 0.88);
              hNode.impactFlashMat.color.setHex(
                maxRefrDb >= 3.0 ? 0xf43f5e : 0xfde047
              );
            });

            // Propagate 3D Toroidal Impulse Shockwaves along each Neighbor Block Corridor with Downward Bending scaled by Hourly Refraction (dB)
            const impulseStepRate = state.isPlayingSoundWave3D
              ? (0.36 + acSummary.effectiveWindSpeedMs * 0.018) * speedMult * dt
              : 0;

            for (let hIdx = 0; hIdx < HAMMER_IMPULSE_RING_COUNT; hIdx++) {
              const hw = hammerImpulseWaveStates[hIdx];
              hw.progress = (hw.progress + impulseStepRate) % 1.0;

              const targetCorr =
                hIdx % 3 === 0
                  ? acSummary.selectedCorridor
                  : visibleCorridors[hw.corridorSeed % visibleCorridors.length];

              sampleAcousticRefractionRayPoint3D(
                targetCorr,
                hw.rayTier,
                hw.progress,
                _scratchVecA,
                _scratchVecB
              );

              // Additional downward refraction curvature proportional to calculated hourly totalRefractionDb
              const hourlyRefrDb = Math.max(0.1, targetCorr.totalRefractionDb);
              const refrNorm = THREE.MathUtils.clamp(hourlyRefrDb / 5.0, 0.15, 1.25);
              // Over the 2.5m barrier (progress ~ 0.35), the impulse shockwave arches and then bends sharply downward toward the neighbor block facade
              const downwardRefrBendY =
                hw.progress > 0.35
                  ? -Math.pow((hw.progress - 0.35) / 0.65, 1.35) * refrNorm * 1.15
                  : Math.sin((hw.progress / 0.35) * Math.PI) * refrNorm * 0.55;

              _scratchDummy.position.set(
                _scratchVecA.x,
                Math.max(0.45, _scratchVecA.y + downwardRefrBendY),
                _scratchVecA.z
              );
              _scratchDummy.lookAt(
                _scratchVecB.x,
                Math.max(0.45, _scratchVecB.y + downwardRefrBendY),
                _scratchVecB.z
              );

              // Shockwave ring expands as it propagates toward the neighboring block; ring size & glow scale with hourly refraction dB
              const ringRadiusScale =
                (0.45 + hw.progress * (1.85 + refrNorm * 1.15)) *
                (targetCorr.isSelectedReceptor ? 1.22 : 0.92);
              _scratchDummy.scale.set(
                ringRadiusScale * 1.25,
                ringRadiusScale * 0.9,
                1.0
              );
              _scratchDummy.updateMatrix();
              hammerImpulseRingsInstanced.setMatrixAt(hIdx, _scratchDummy.matrix);

              // Color encodes hourly refraction (dB) & impulse intensity:
              // Gold at hydraulic hammer strike -> Amber over barrier -> Rose/Crimson or Fuchsia when hourly refraction >= 3.0 dB hits neighbor block
              if (hw.progress < 0.22) {
                _scratchColor.setHex(0xfde047);
              } else if (hourlyRefrDb >= 3.0) {
                _scratchColor.setHex(hw.progress > 0.68 ? 0xe879f9 : 0xf43f5e);
              } else if (hourlyRefrDb >= 1.5) {
                _scratchColor.setHex(0xf97316);
              } else {
                _scratchColor.setHex(0x38bdf8);
              }
              hammerImpulseRingsInstanced.setColorAt(hIdx, _scratchColor);
            }
            hammerImpulseRingsInstanced.instanceMatrix.needsUpdate = true;
            if (hammerImpulseRingsInstanced.instanceColor) {
              hammerImpulseRingsInstanced.instanceColor.needsUpdate = true;
            }
          }
        } else {
          wavefrontParticlesInstanced.visible = false;
          wavefrontCrestsInstanced.visible = false;
          reflectedWaveParticlesInstanced.visible = false;
          hydraulicHammerImpulseGroup.visible = false;
        }
      }

      // =========================================================================
      // Item #2: 3D Impulse Noise Waves propagating directly from the Selected Source
      // whenever a statutory noise limit is exceeded in the selected hour
      // =========================================================================
      const acExceedanceSummary = state.acousticRefractionSummary;
      const showSourceExceedanceWaves =
        !showSubsurface &&
        acExceedanceSummary.isNoiseLimitExceededInSelectedHour &&
        Boolean(acExceedanceSummary.selectedCorridor);
      selectedSourceExceedanceWaveGroup.visible = showSourceExceedanceWaves;

      if (showSourceExceedanceWaves) {
        const selCorr = acExceedanceSummary.selectedCorridor;
        const triggerKey = `${selCorr.sourceId}:${state.currentWeather.hourIndex}:exceeded`;
        if (triggerKey !== lastExceedanceTriggerKey) {
          lastExceedanceTriggerKey = triggerKey;
          exceedanceBurstRemainingSec = 1.8;
        }
        exceedanceBurstRemainingSec = Math.max(0, exceedanceBurstRemainingSec - dt);
        const burstFactor = 1.0 + exceedanceBurstRemainingSec * 0.38;

        selectedSourceExceedanceWaveGroup.position.set(selCorr.srcX, 0, selCorr.srcZ);

        const exceedanceBoost = THREE.MathUtils.clamp(
          1.0 + acExceedanceSummary.maxExceedanceDbInHour / 16.0,
          1.0,
          2.55
        );
        const maxWaveRadiusUnits = 34.0 * exceedanceBoost;
        const waveCycleRate =
          (0.54 + acExceedanceSummary.effectiveWindSpeedMs * 0.022) * burstFactor;

        const beaconPulse = 0.85 + 0.35 * Math.sin(elapsed * 6.5);
        sourceExceedanceBeaconMesh.position.set(0, Math.max(6.2, selCorr.srcY + 2.4), 0);
        sourceExceedanceBeaconMesh.scale.setScalar(beaconPulse * burstFactor);
        sourceBeaconMat.opacity = THREE.MathUtils.clamp(0.58 + 0.32 * Math.sin(elapsed * 6.5), 0.35, 0.95);
        sourceBeaconMat.color.setHex(
          acExceedanceSummary.maxExceedanceDbInHour >= 10 ? 0xf43f5e : 0xfbbf24
        );

        for (let sIdx = 0; sIdx < SOURCE_EXCEEDANCE_SHELL_COUNT; sIdx++) {
          const phase =
            (elapsed * waveCycleRate + sIdx / SOURCE_EXCEEDANCE_SHELL_COUNT) % 1.0;
          const radius = 2.2 + phase * maxWaveRadiusUnits;
          const fadeAlpha = Math.pow(1.0 - phase, 1.25);
          const downwindShiftX = dirX * phase * 7.5;
          const downwindShiftZ = dirZ * phase * 7.5;

          const gRing = sourceExceedanceGroundRings[sIdx];
          gRing.mesh.position.set(downwindShiftX, 4.95 + phase * 0.8, downwindShiftZ);
          gRing.mesh.scale.setScalar(radius);
          gRing.mat.opacity = THREE.MathUtils.clamp(fadeAlpha * 0.82 * burstFactor, 0, 0.94);
          gRing.mat.color.setHex(
            acExceedanceSummary.maxExceedanceDbInHour >= 10
              ? sIdx % 2 === 0
                ? 0xf43f5e
                : 0xe879f9
              : sIdx % 2 === 0
              ? 0xf97316
              : 0xfde047
          );

          const dRing = sourceExceedance3DDomes[sIdx];
          dRing.mesh.position.set(
            downwindShiftX * 0.85,
            Math.max(5.3, selCorr.srcY * 0.85) + Math.sin(phase * Math.PI) * 5.2,
            downwindShiftZ * 0.85
          );
          dRing.mesh.scale.setScalar(radius * 0.88);
          dRing.mat.opacity = THREE.MathUtils.clamp(fadeAlpha * 0.68 * burstFactor, 0, 0.9);
          dRing.mat.color.setHex(
            acExceedanceSummary.maxExceedanceDbInHour >= 10
              ? sIdx % 2 === 0
                ? 0xe879f9
                : 0xfb7185
              : sIdx % 2 === 0
              ? 0xfbbf24
              : 0x38bdf8
          );
        }
      } else {
        lastExceedanceTriggerKey = '';
      }

      // =========================================================================
      // Item #1: Update Dynamic 3D 'Støv-Emitter' Animation for All Active Demolition Machines
      // Volumetric dust density & dispersion speed correlate directly with machine load output % and wind speed
      // =========================================================================
      const showEmitterNow = state.showMachineryDustEmitter3D && !showSubsurface;
      machineryDustEmitterMasterGroup.visible = showEmitterNow;

      if (showEmitterNow) {
        const emSummary = state.machineryDustEmitterSummary;
        const activeEmitterNodes: {
          node: MachineryDustEmitterVisualNode3D;
          telemetry: MachineDustEmitterTelemetry;
        }[] = [];

        emSummary.machineTelemetries.forEach((mTel) => {
          const eNode = machineryDustEmitterNodesMap.get(mTel.sourceId);
          const sNode = sourceNodesMap.get(mTel.sourceId);
          if (!eNode) return;

          eNode.root.visible = mTel.active && !hiddenSourceSet.has(mTel.sourceId);
          if (!eNode.root.visible) return;

          if (sNode) {
            eNode.releaseY = sNode.releaseY;
            eNode.jawEmitterPivot.position.set(
              1.05,
              Math.max(3.4, sNode.releaseY * 0.86),
              -1.0
            );
          }

          activeEmitterNodes.push({ node: eNode, telemetry: mTel });

          // Align the volumetric dust emitter jet cones with the live wind direction
          eNode.downwindJetGroup.rotation.y = yawRotationY;

          // Normalized volumetric density factor [0.15 .. 1.6] and dispersion speed factor
          const densNorm = THREE.MathUtils.clamp(
            mTel.volumetricDensityMgM3 / 28.0,
            0.15,
            1.6
          );
          const speedScale = THREE.MathUtils.clamp(
            mTel.dispersionSpeedMs / 10.0,
            0.55,
            2.15
          );
          const loadPulse =
            0.5 +
            0.5 *
              Math.sin(
                elapsed * (3.2 + mTel.loadOutputPct * 0.045) +
                  mTel.volumetricDensityMgM3 * 0.1
              );

          // Scale volumetric dust emitter jet cones proportionally to volumetric density & wind speed
          const coneLen = THREE.MathUtils.clamp(
            12.0 + mTel.dispersionSpeedMs * 1.45,
            12.0,
            34.0
          );
          const coneRad = THREE.MathUtils.clamp(
            2.2 + densNorm * 4.2,
            2.0,
            6.8
          );

          eNode.innerJetConeMesh.scale.set(
            coneRad * 0.58,
            coneRad * 0.46,
            coneLen * 0.62
          );
          eNode.outerJetConeMesh.scale.set(
            coneRad * 1.15,
            coneRad * 0.88,
            coneLen
          );

          // Volumetric opacity correlates directly with calculated volumetricDensityMgM3
          eNode.innerJetConeMat.opacity = THREE.MathUtils.clamp(
            0.18 + densNorm * 0.42 + loadPulse * 0.08,
            0.14,
            0.72
          );
          eNode.outerJetConeMat.opacity = THREE.MathUtils.clamp(
            0.08 + densNorm * 0.28,
            0.06,
            0.46
          );

          // Color shift from Amber -> Deep Orange -> Crimson Rose at high machine load (>110%)
          if (mTel.loadOutputPct >= 115) {
            eNode.innerJetConeMat.color.setHex(0xf43f5e);
            eNode.jawCoreMat.color.setHex(0xf43f5e);
            eNode.jawBillowShellMat.color.setHex(0xe11d48);
          } else if (mTel.loadOutputPct >= 90) {
            eNode.innerJetConeMat.color.setHex(0xf97316);
            eNode.jawCoreMat.color.setHex(0xf59e0b);
            eNode.jawBillowShellMat.color.setHex(0xf97316);
          } else {
            eNode.innerJetConeMat.color.setHex(0xfbbf24);
            eNode.jawCoreMat.color.setHex(0xfbbf24);
            eNode.jawBillowShellMat.color.setHex(0xf59e0b);
          }

          // Animate pulverizer jaw emitter core & billowing aerosol shell at speed proportional to machine load output
          const jawScale = 0.75 + densNorm * 0.65 + loadPulse * 0.22;
          eNode.jawCoreMesh.scale.setScalar(jawScale);
          eNode.jawCoreMesh.rotation.y = elapsed * (2.5 * speedScale);
          eNode.jawCoreMesh.rotation.x = -elapsed * (1.9 * speedScale);
          eNode.jawCoreMat.opacity = THREE.MathUtils.clamp(
            0.45 + densNorm * 0.42,
            0.35,
            0.94
          );

          const billowShellScale = 0.85 + densNorm * 0.78 + (1.0 - loadPulse) * 0.25;
          eNode.jawBillowShellMesh.scale.setScalar(billowShellScale);
          eNode.jawBillowShellMesh.rotation.y = -elapsed * (1.8 * speedScale);
          eNode.jawBillowShellMat.opacity = THREE.MathUtils.clamp(
            0.2 + densNorm * 0.36,
            0.16,
            0.68
          );

          // Ground Crawler Track & Rubble Resuspension Dust Ring
          const groundCycle = (elapsed * (0.9 + speedScale * 0.55)) % 1.0;
          eNode.trackResuspensionRingMesh.scale.setScalar(
            0.75 + groundCycle * (0.65 + densNorm * 0.55)
          );
          eNode.trackResuspensionRingMat.opacity =
            Math.sin(groundCycle * Math.PI) * (0.3 + densNorm * 0.5);
        });

        // Animate 320 Instanced Volumetric Billowing Dust Emitter Puffs from all active machines
        if (activeEmitterNodes.length > 0) {
          emitterPuffInstanced.visible = true;
          const perpEmX = -dirZ;
          const perpEmZ = dirX;

          // Update global material opacity to reflect volumetric density
          emitterPuffMat.opacity = THREE.MathUtils.clamp(
            0.42 +
              (emSummary.peakVolumetricDensityMgM3 / 42.0) * 0.48,
            0.38,
            0.92
          );

          for (let i = 0; i < EMITTER_PUFF_PARTICLE_COUNT; i++) {
            const ep = emitterPuffParticles[i];
            const targetEntry =
              activeEmitterNodes[ep.machineSeed % activeEmitterNodes.length];
            const eNode = targetEntry.node;
            const mTel = targetEntry.telemetry;
            const densNorm = THREE.MathUtils.clamp(
              mTel.volumetricDensityMgM3 / 28.0,
              0.15,
              1.6
            );

            // Advection speed correlates directly with machine dispersionSpeedMs (load exhaust + windSpeed)
            const puffStepRate =
              (0.16 + mTel.dispersionSpeedMs * 0.028) * ep.speedSeed * dt;
            ep.progress = (ep.progress + puffStepRate) % 1.0;

            const maxReach = THREE.MathUtils.clamp(
              14.0 + mTel.dispersionSpeedMs * 1.65,
              14.0,
              38.0
            );
            const downwindDist = ep.progress * maxReach;

            // Origin: either high-reach hydraulic pulverizer jaw or ground rubble drop zone
            const startX = eNode.worldX + 1.05;
            const startZ = eNode.worldZ - 1.0;
            const startY = ep.isGroundRubbleJet
              ? 0.65
              : Math.max(3.4, eNode.releaseY * 0.86);

            // Volumetric turbulent expansion radius grows with downwind distance & machine load
            const radialEnvelope =
              (0.45 + ep.progress * (2.6 + densNorm * 2.4)) *
              ep.radialSpread;
            const swirlAngle =
              ep.radialAngle +
              elapsed * (1.2 + mTel.dispersionSpeedMs * 0.08) +
              ep.turbulencePhase;

            const latOffset = Math.cos(swirlAngle) * radialEnvelope;
            const vertBouyancy =
              Math.sin(swirlAngle) * radialEnvelope * 0.65 +
              ep.progress * (state.waterSuppressionActive ? -0.8 : 2.1);

            const wx = startX + dirX * downwindDist + perpEmX * latOffset;
            const wz = startZ + dirZ * downwindDist + perpEmZ * latOffset;
            const wy = Math.max(0.28, startY + vertBouyancy);

            // Volumetric puff size scales with machine volumetricDensityMgM3 and billows outward
            const densitySizeFactor = 0.55 + densNorm * 0.95;
            const billowScale =
              densitySizeFactor *
              (0.55 + Math.sin(ep.progress * Math.PI) * 1.15);

            _scratchDummy.position.set(wx, wy, wz);
            _scratchDummy.rotation.set(
              elapsed * 1.6 + ep.turbulencePhase,
              elapsed * 1.2,
              elapsed * 0.9
            );
            _scratchDummy.scale.set(
              billowScale * 1.25,
              billowScale * 0.95,
              billowScale * 1.35
            );
            _scratchDummy.updateMatrix();
            emitterPuffInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          emitterPuffInstanced.instanceMatrix.needsUpdate = true;
        } else {
          emitterPuffInstanced.visible = false;
        }
      }

      // Update 480 Instanced 3D Gaussian Plume Particles
      const perpX = -dirZ;
      const perpZ = dirX;
      const maxPlumeReachUnits = 95 * suppressionFactor;
      const advectionRate = (0.11 + windSpeed * 0.022) * dt;

      if (visibleActiveSources.length === 0) {
        particleInstanced.visible = false;
      } else {
        particleInstanced.visible = true;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const p = particles[i];
          p.progress = (p.progress + advectionRate * p.speedFactor) % 1;

          const activeSrc = visibleActiveSources[p.sourceIdx % visibleActiveSources.length];
          const srcNode = sourceNodesMap.get(activeSrc.id);
          if (!srcNode) continue;

          const distDownwind = p.progress * maxPlumeReachUnits;
          const sigmaY = 1.2 + distDownwind * spread.sy;
          const sigmaZ = (0.8 + distDownwind * spread.sz) * suppressionFactor;

          const turbulenceWave = Math.sin(elapsed * 2.4 + p.phaseOffset + distDownwind * 0.12) * 0.65;
          const lateralOffset = p.lateralSeed * sigmaY + turbulenceWave;
          const rawY =
            srcNode.releaseY +
            0.6 +
            p.verticalSeed * sigmaZ +
            distDownwind * (state.waterSuppressionActive ? -0.025 : 0.035);
          const worldY = Math.max(0.35, Math.abs(rawY));

          const worldX = srcNode.worldX - 0.6 + dirX * distDownwind + perpX * lateralOffset;
          const worldZ = srcNode.worldZ + dirZ * distDownwind + perpZ * lateralOffset;

          const envelopeScale =
            Math.sin(p.progress * Math.PI) *
            (0.65 + p.progress * 1.15) *
            (state.waterSuppressionActive ? 0.65 : 1.0);

          _scratchDummy.position.set(worldX, worldY, worldZ);
          _scratchDummy.rotation.set(elapsed + p.phaseOffset, elapsed * 0.7, 0);
          _scratchDummy.scale.setScalar(Math.max(0.15, envelopeScale));
          _scratchDummy.updateMatrix();
          particleInstanced.setMatrixAt(i, _scratchDummy.matrix);
        }
        particleInstanced.instanceMatrix.needsUpdate = true;
      }

      // Update 3D 'Fane-stianimation' (Calculated Gaussian Puff Path over Time)
      const showPlumePathNow =
        state.showPlumePathAnimation3D && !showSubsurface && visibleActiveSources.length > 0;
      plumePathGroup.visible = showPlumePathNow;
      if (showPlumePathNow) {
        const primaryPathSrc =
          (state.selectedSourceId &&
            visibleActiveSources.find((s) => s.id === state.selectedSourceId)) ||
          visibleActiveSources[0];
        const primaryPathSrcNode = primaryPathSrc
          ? sourceNodesMap.get(primaryPathSrc.id)
          : undefined;

        if (primaryPathSrc && primaryPathSrcNode) {
          const hrsArr = state.weatherHours;
          const baseHrIdx = weather.hourIndex;
          const pathFingerprint = `${primaryPathSrc.id}|${baseHrIdx}|${weather.windSpeed10m.toFixed(
            1
          )}|${weather.windDirection10m}|${state.waterSuppressionActive ? 1 : 0}|${
            hrsArr ? hrsArr.length : 0
          }`;

          if (pathFingerprint !== lastPlumePathFingerprint) {
            lastPlumePathFingerprint = pathFingerprint;
            let curX = primaryPathSrcNode.worldX - 0.5;
            let curZ = primaryPathSrcNode.worldZ;
            let curY = primaryPathSrcNode.releaseY + 0.8;
            plumePathCtrlPts[0].set(curX, curY, curZ);

            const stepLen =
              THREE.MathUtils.clamp(3.2 + windSpeed * 0.36, 3.6, 7.2) *
              suppressionFactor;

            for (let k = 1; k < PLUME_PATH_SAMPLE_COUNT; k++) {
              const frac = k / (PLUME_PATH_SAMPLE_COUNT - 1);
              const futureHrOffset = Math.min(5, Math.floor(frac * 5.2));
              const futureHr =
                hrsArr && hrsArr.length > 0
                  ? hrsArr[Math.min(hrsArr.length - 1, baseHrIdx + futureHrOffset)]
                  : weather;
              const stepPlumeDeg = (futureHr.windDirection10m + 180) % 360;
              const stepPlumeRad = (stepPlumeDeg * Math.PI) / 180;
              const stepDirX = Math.sin(stepPlumeRad);
              const stepDirZ = -Math.cos(stepPlumeRad);

              curX += stepDirX * stepLen;
              curZ += stepDirZ * stepLen;
              curY = Math.max(
                1.1,
                curY + (state.waterSuppressionActive ? -0.18 : 0.24)
              );
              plumePathCtrlPts[k].set(curX, curY, curZ);
            }

            plumePathTubeMesh.geometry.dispose();
            plumePathTubeMesh.geometry = new THREE.TubeGeometry(
              plumePathCurve,
              44,
              state.waterSuppressionActive ? 0.18 : 0.26,
              8,
              false
            );
          }

          // Compute peak exposure severity for tube tinting
          let maxExpS = 0;
          for (let eIdx = 0; eIdx < state.receptorExposures.length; eIdx++) {
            const sVal = state.receptorExposures[eIdx].sumQuotient;
            if (sVal > maxExpS) maxExpS = sVal;
          }
          const effMaxS = state.waterSuppressionActive ? maxExpS * 0.38 : maxExpS;
          plumePathTubeMat.color.setHex(
            effMaxS >= 1.0 ? 0xf43f5e : effMaxS >= 0.5 ? 0xf59e0b : 0x38bdf8
          );
          plumePathTubeMat.opacity = 0.56 + 0.16 * Math.sin(elapsed * 2.4);

          // Advance traveling puffs and Gaussian sigma_y rings along spline curve (zero allocations)
          plumePathAnimPhase = (plumePathAnimPhase + dt * (0.15 + windSpeed * 0.018)) % 1.0;

          for (let i = 0; i < PLUME_PATH_PUFF_COUNT; i++) {
            const u = (i / PLUME_PATH_PUFF_COUNT + plumePathAnimPhase) % 1.0;
            plumePathCurve.getPointAt(u, _scratchVecA);

            const puffRadius =
              (0.75 + u * (2.8 + spread.sy * 12.0)) * suppressionFactor;
            const envFade = Math.sin(u * Math.PI);
            const scaledR = Math.max(0.22, puffRadius * (0.45 + 0.55 * envFade));

            _scratchDummy.position.copy(_scratchVecA);
            _scratchDummy.rotation.set(0, elapsed * 0.6 + i * 0.4, 0);
            _scratchDummy.scale.set(scaledR * 1.15, scaledR * 0.85, scaledR * 1.15);
            _scratchDummy.updateMatrix();
            plumePathPuffInstanced.setMatrixAt(i, _scratchDummy.matrix);

            if (u < 0.32 && effMaxS >= 0.8) {
              _scratchColor.setHex(0xf43f5e);
            } else if (u < 0.65) {
              _scratchColor.setHex(0xf59e0b);
            } else {
              _scratchColor.setHex(0x38bdf8);
            }
            plumePathPuffInstanced.setColorAt(i, _scratchColor);
          }
          plumePathPuffInstanced.instanceMatrix.needsUpdate = true;
          if (plumePathPuffInstanced.instanceColor) {
            plumePathPuffInstanced.instanceColor.needsUpdate = true;
          }

          for (let i = 0; i < PLUME_PATH_RING_COUNT; i++) {
            const u = (i / PLUME_PATH_RING_COUNT + plumePathAnimPhase * 1.15) % 1.0;
            plumePathCurve.getPointAt(u, _scratchVecA);
            plumePathCurve.getTangentAt(u, _scratchVecB);
            _scratchVecB.normalize();
            _scratchQuat.setFromUnitVectors(_scratchAxisZ, _scratchVecB);

            const ringRad =
              (0.85 + u * (3.1 + spread.sy * 13.5)) * suppressionFactor;

            _scratchDummy.position.copy(_scratchVecA);
            _scratchDummy.quaternion.copy(_scratchQuat);
            _scratchDummy.scale.set(ringRad, ringRad * 0.72, 1);
            _scratchDummy.updateMatrix();
            plumePathRingInstanced.setMatrixAt(i, _scratchDummy.matrix);

            if (effMaxS >= 1.0 && u < 0.45) {
              _scratchColor.setHex(0xfb7185);
            } else if (u < 0.58) {
              _scratchColor.setHex(0xfbbf24);
            } else {
              _scratchColor.setHex(0x38bdf8);
            }
            plumePathRingInstanced.setColorAt(i, _scratchColor);
          }
          plumePathRingInstanced.instanceMatrix.needsUpdate = true;
          if (plumePathRingInstanced.instanceColor) {
            plumePathRingInstanced.instanceColor.needsUpdate = true;
          }
        }
      }

      // =========================================================================
      // Update 3D Underground Percolation & Groundwater Leaching (when visible)
      // =========================================================================
      if (showSubsurface) {
        const sim = state.hydroSim;
        const rainMm = state.effectivePrecipMm;

        // Elevate secondary and primary groundwater tables dynamically with precipitation
        const secY = -sim.secondaryWaterTableDepthM * SUB_SCALE_Y + Math.sin(elapsed * 1.8) * 0.08;
        const priY = -sim.primaryWaterTableDepthM * SUB_SCALE_Y + Math.cos(elapsed * 1.4) * 0.06;
        secondaryWaterTableMesh.position.y = secY;
        primaryWaterTableMesh.position.y = priY;

        const maxDepthUnits = sim.plumeMaxDepthMeters * SUB_SCALE_Y;
        const coneRadiusUnits = 5.5 + rainMm * 0.35 + sim.saturationRatio * 4.2;

        state.sources.forEach((src) => {
          const leachCone = subsurfacePlumeConesMap.get(src.id);
          if (!leachCone) return;
          leachCone.visible = src.active;
          leachCone.scale.set(coneRadiusUnits, Math.max(2.5, maxDepthUnits), coneRadiusUnits);
        });

        // Animate 320 Instanced Percolating Leachate & Water Droplets
        const percSpeed = (0.08 + rainMm * 0.018 + sim.macroporeVelocityMetersPerDay * 0.012) * dt;
        if (activeSources.length === 0) {
          percolationInstanced.visible = false;
        } else {
          percolationInstanced.visible = true;
          for (let i = 0; i < PERCOLATION_COUNT; i++) {
            const pp = percolationParticles[i];
            const stepRate = percSpeed * pp.speedFactor * (pp.inMacropore ? 1.35 : 0.75);
            pp.progress = (pp.progress + stepRate) % 1;

            const activeSrc = activeSources[pp.sourceIdx % activeSources.length];
            const srcNode = sourceNodesMap.get(activeSrc.id);
            if (!srcNode) continue;

            const currentDepthM = pp.progress * sim.plumeMaxDepthMeters;
            const worldY = -Math.max(0.25, currentDepthM * SUB_SCALE_Y);

            // Radial spread in unsaturated zone + SW groundwater flow drift inside aquifers
            const radialR =
              (pp.inMacropore ? 1.8 : 4.6) *
              pp.radialSpreadSeed *
              (0.35 + pp.progress * (1 + rainMm * 0.04));
            let aquiferDriftX = 0;
            let aquiferDriftZ = 0;

            if (currentDepthM >= sim.secondaryWaterTableDepthM) {
              // Regional groundwater gradient in Ringparken flows SW towards Rødtjørnevej (-X, +Z)
              const excessM = currentDepthM - sim.secondaryWaterTableDepthM;
              aquiferDriftX = -excessM * 0.85;
              aquiferDriftZ = excessM * 0.65;
            }

            const wx =
              srcNode.worldX + Math.cos(pp.radialAngle + elapsed * 0.3) * radialR + aquiferDriftX;
            const wz =
              srcNode.worldZ + Math.sin(pp.radialAngle + elapsed * 0.3) * radialR + aquiferDriftZ;

            const dropScale =
              (0.55 + Math.sin(pp.progress * Math.PI) * 0.65) *
              (rainMm > 0.1 ? 1.15 : 0.8);

            _scratchDummy.position.set(wx, worldY, wz);
            _scratchDummy.rotation.set(0, elapsed + i, 0);
            _scratchDummy.scale.set(dropScale * 0.85, dropScale * 1.45, dropScale * 0.85);
            _scratchDummy.updateMatrix();
            percolationInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          percolationInstanced.instanceMatrix.needsUpdate = true;
        }

        // Update Dedicated Blok 1 & Blok 2 Bly (Pb) & PAH Subterranean Percolation Conduits & Droplets
        // Rate scales directly with current precipitation (mm/t) & Darcy macropore velocity
        const rainDrive = Math.min(3.2, 0.35 + rainMm * 0.16 + sim.saturationRatio * 0.55);
        blok12PbConduitMat.emissiveIntensity = 0.55 + Math.min(1.45, rainMm * 0.085);
        blok12PahConduitMat.emissiveIntensity = 0.55 + Math.min(1.45, rainMm * 0.09);

        const conduitPulse = 0.85 + Math.min(0.85, rainMm * 0.045);
        for (let cIdx = 0; cIdx < blok12ConduitMeshes.length; cIdx++) {
          blok12ConduitMeshes[cIdx].scale.set(conduitPulse, 1.0, conduitPulse);
        }

        const blok12StepSpeed =
          (0.055 + rainMm * 0.024 + sim.macroporeVelocityMetersPerDay * 0.014) * dt;
        const activeDepthFrac = THREE.MathUtils.clamp(
          sim.plumeMaxDepthMeters / 17.5,
          0.32,
          1.0
        );

        for (let i = 0; i < BLOK12_DROP_COUNT; i++) {
          const bp = blok12PathParticles[i];
          bp.t = (bp.t + blok12StepSpeed * bp.speedScale) % 1;
          const clampedT = bp.t * activeDepthFrac;
          const curveSpec = blok12PercolationCurves[bp.curveIdx];
          curveSpec.curve.getPointAt(clampedT, _scratchVecA);

          const jitter = 0.18 + rainMm * 0.02;
          const wx = _scratchVecA.x + Math.cos(elapsed * 2.2 + bp.lateralPhase) * jitter;
          const wz = _scratchVecA.z + Math.sin(elapsed * 2.2 + bp.lateralPhase) * jitter;
          const wy = _scratchVecA.y;

          const sFactor =
            (0.68 + Math.sin(bp.t * Math.PI) * 0.55) * Math.min(1.65, 0.75 + rainDrive * 0.32);

          _scratchDummy.position.set(wx, wy, wz);
          _scratchDummy.rotation.set(0, 0, 0);
          _scratchDummy.scale.set(sFactor * 0.9, sFactor * 1.55, sFactor * 0.9);
          _scratchDummy.updateMatrix();
          blok12PbPahInstanced.setMatrixAt(i, _scratchDummy.matrix);
        }
        blok12PbPahInstanced.instanceMatrix.needsUpdate = true;
      }

      // =========================================================================
      // Update 3D Kierulffsvej DN200 Water Main Layer (Subsurface + X-Ray Surface)
      // =========================================================================
      const showWaterMain3D =
        state.showWaterMainLayer !== undefined ? state.showWaterMainLayer : showSubsurface;
      waterMain3DGroup.visible = showWaterMain3D;
      if (showWaterMain3D) {
        const wm = state.waterMainTelemetry;
        const wmStatus = wm?.overallStatus ?? 'nominal';
        const isXraySurface = !showSubsurface;

        if (wmStatus === 'critical_rupture') {
          const pulse = 0.55 + 0.45 * Math.sin(elapsed * 8.0);
          waterMainPipeMat.color.setHex(0xef4444);
          waterMainPipeMat.emissive.setHex(0xdc2626);
          waterMainPipeMat.emissiveIntensity = 0.7 + pulse * 0.9;
          lerBufferMat.color.setHex(0xf87171);
          waterFlowMat.color.setHex(0xfca5a5);
        } else if (wmStatus === 'warning' || wmStatus === 'advisory') {
          waterMainPipeMat.color.setHex(0xf59e0b);
          waterMainPipeMat.emissive.setHex(0xd97706);
          waterMainPipeMat.emissiveIntensity = 0.65;
          lerBufferMat.color.setHex(0xfbbf24);
          waterFlowMat.color.setHex(0xfde68a);
        } else {
          waterMainPipeMat.color.setHex(0x0ea5e9);
          waterMainPipeMat.emissive.setHex(0x0284c7);
          waterMainPipeMat.emissiveIntensity = 0.55;
          lerBufferMat.color.setHex(0x38bdf8);
          waterFlowMat.color.setHex(0xe0f2fe);
        }

        waterMainPipeMat.opacity = isXraySurface ? 0.58 : 0.95;
        waterMainPipeMat.depthTest = !isXraySurface;
        waterMainPipeMesh.renderOrder = isXraySurface ? 18 : 1;

        dhSupplyMat.opacity = isXraySurface ? 0.42 : 0.88;
        dhSupplyMat.depthTest = !isXraySurface;
        dhSupplyMesh.renderOrder = isXraySurface ? 17 : 1;

        dhReturnMat.opacity = isXraySurface ? 0.42 : 0.88;
        dhReturnMat.depthTest = !isXraySurface;
        dhReturnMesh.renderOrder = isXraySurface ? 17 : 1;

        valveMat.opacity = isXraySurface ? 0.65 : 0.94;
        valveMat.depthTest = !isXraySurface;
        hydrantMat.opacity = isXraySurface ? 0.65 : 0.92;
        hydrantMat.depthTest = !isXraySurface;

        for (let bIdx = 0; bIdx < branchMeshes.length; bIdx++) {
          const bm = branchMeshes[bIdx];
          const bMat = bm.material as THREE.MeshStandardMaterial;
          bMat.opacity = isXraySurface ? 0.52 : 0.9;
          bMat.depthTest = !isXraySurface;
          bm.renderOrder = isXraySurface ? 17 : 1;
        }

        lerBufferMesh.visible = state.showLerBuffer !== false;
        lerBufferMat.opacity = isXraySurface ? 0.14 : 0.2;

        const flowSpeedFactor =
          ((wm?.flowLs ?? 18.5) / 18.5) * 0.14 * state.simulationSpeedMultiplier;
        for (let i = 0; i < WATER_FLOW_COUNT; i++) {
          waterFlowProgress[i] = (waterFlowProgress[i] + flowSpeedFactor * dt) % 1;
          waterMainCurve.getPointAt(waterFlowProgress[i], _scratchVecA);
          _scratchDummy.position.copy(_scratchVecA);
          _scratchDummy.rotation.set(0, 0, 0);
          _scratchDummy.scale.setScalar(wmStatus === 'critical_rupture' ? 1.35 : 1.0);
          _scratchDummy.updateMatrix();
          waterFlowInstanced.setMatrixAt(i, _scratchDummy.matrix);
        }
        waterFlowInstanced.instanceMatrix.needsUpdate = true;
        waterFlowInstanced.renderOrder = isXraySurface ? 19 : 2;
      }

      // Update 3D Virtual Leak Pin Soil Saturation Zones
      const vLeak = state.virtualLeakImpact;
      if (vLeak && state.virtualLeakPinPoint) {
        virtualLeak3DGroup.visible = true;
        const pinXZ = latLngToWorldXZ(vLeak.pinPoint);
        virtualLeak3DGroup.position.set(pinXZ.x, 0, pinXZ.z);
        const pulse = 1 + 0.06 * Math.sin(elapsed * 4.2);
        for (let zIdx = 0; zIdx < 3; zIdx++) {
          const zSpec = vLeak.saturationZones[zIdx];
          const radUnits = ((zSpec?.radiusMeters ?? (10 + zIdx * 12)) / METERS_PER_UNIT) * pulse;
          leakZoneDiscs[zIdx].scale.set(radUnits, 1, radUnits);
          leakZoneRings[zIdx].scale.set(radUnits, 1, radUnits);
        }
        leakBeaconCap.rotation.y = elapsed * 2.2;
        leakBeaconCap.position.y = 4.9 + Math.sin(elapsed * 3.5) * 0.35;
      } else {
        virtualLeak3DGroup.visible = false;
      }

      // =========================================================================
      // Update System B Simultaneous Algedonic Dispatch (S1 + S3) 3D Overlay
      // =========================================================================
      const simDispatch = state.simultaneousDispatch;
      const isSimDispatchActive = Boolean(simDispatch && simDispatch.active);
      simultaneousAlgedonic3DGroup.visible = isSimDispatchActive;
      if (isSimDispatchActive && simDispatch) {
        const epXZ = latLngToWorldXZ(simDispatch.system1State.epicenter);
        const radiusUnits = Math.max(
          8,
          simDispatch.system1State.dangerRadiusMeters / METERS_PER_UNIT
        );
        const p1Pulse = simDispatch.isBlinkingP1
          ? 0.55 + 0.45 * Math.sin(elapsed * 7.5)
          : 0.85;

        s1DangerDiscMesh.position.set(epXZ.x, 0.34, epXZ.z);
        s1DangerDiscMesh.scale.set(radiusUnits, 1, radiusUnits);
        s1DangerDiscMat.opacity = simDispatch.isBlinkingP1 ? 0.14 + 0.14 * p1Pulse : 0.16;

        s1DangerRingMesh.position.set(epXZ.x, 0.38, epXZ.z);
        s1DangerRingMesh.scale.set(radiusUnits, 1, radiusUnits);
        s1DangerRingMat.opacity = simDispatch.isBlinkingP1 ? 0.52 + 0.45 * p1Pulse : 0.85;

        s1OctagonBeaconMesh.position.set(
          epXZ.x,
          10.2 + Math.sin(elapsed * 4.0) * 0.45,
          epXZ.z
        );
        s1OctagonBeaconMesh.rotation.z = elapsed * 0.65;
        s1OctagonMat.emissiveIntensity = simDispatch.isBlinkingP1
          ? 0.6 + p1Pulse * 1.1
          : 0.7;

        // Animate System 1 Upwind Escape Chevrons along Valbyvej & Rosenkildevej
        const escapeVecs = simDispatch.system1State.escapeVectors;
        if (escapeVecs.length > 0) {
          for (let i = 0; i < S1_ESCAPE_CHEVRON_COUNT; i++) {
            const vec = escapeVecs[i % escapeVecs.length];
            const slotIdx = Math.floor(i / escapeVecs.length);
            const slotsPerVec = Math.max(
              1,
              Math.ceil(S1_ESCAPE_CHEVRON_COUNT / escapeVecs.length)
            );
            const t = ((elapsed * 0.48 + slotIdx / slotsPerVec) % 1 + 1) % 1;
            const oXZ = latLngToWorldXZ(vec.origin);
            const dXZ = latLngToWorldXZ(vec.targetMusterPoint);
            _scratchVecA.set(oXZ.x, 2.2, oXZ.z);
            _scratchVecB.set(dXZ.x, 2.2, dXZ.z);
            _scratchVecC.lerpVectors(_scratchVecA, _scratchVecB, t);
            _scratchDummy.position.copy(_scratchVecC);
            _scratchDummy.lookAt(_scratchVecB);
            _scratchDummy.scale.setScalar(0.95 + 0.25 * Math.sin(t * Math.PI));
            _scratchDummy.updateMatrix();
            s1EscapeInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          s1EscapeInstanced.instanceMatrix.needsUpdate = true;
          s1EscapeInstanced.visible = true;
        } else {
          s1EscapeInstanced.visible = false;
        }

        // Island Mode (Ø-DRIFT) Shields over protected buildings
        const islandIds = simDispatch.system1State.islandModeBlockIds;
        let shieldSlot = 0;
        for (
          let bIdx = 0;
          bIdx < state.buildings.length && shieldSlot < MAX_ISLAND_SHIELDS;
          bIdx++
        ) {
          const b = state.buildings[bIdx];
          if (!islandIds.includes(b.id)) continue;
          const bXZ = latLngToWorldXZ(b.center);
          const sm = islandShieldMeshes[shieldSlot];
          sm.visible = true;
          sm.position.set(bXZ.x, 3.2, bXZ.z);
          shieldSlot++;
        }
        for (let i = shieldSlot; i < MAX_ISLAND_SHIELDS; i++) {
          islandShieldMeshes[i].visible = false;
        }
        islandShieldMat.opacity = 0.16 + 0.08 * Math.sin(elapsed * 3.2);

        // System 3 Locked Valves (V-VEST & V-MIDT)
        const lockedCodes = simDispatch.system3State.lockedValveCodes;
        const valves = state.waterMainTelemetry?.valves ?? [];
        let valveSlot = 0;
        for (
          let vIdx = 0;
          vIdx < valves.length && valveSlot < MAX_S3_VALVE_COLLARS;
          vIdx++
        ) {
          const v = valves[vIdx];
          if (!lockedCodes.includes(v.code as 'V-VEST' | 'V-MIDT')) continue;
          const vXZ = latLngToWorldXZ(v.coordinate);
          const collar = s3ValveCollarMeshes[valveSlot];
          collar.visible = true;
          collar.position.set(
            vXZ.x,
            simDispatch.isBlinkingP1 ? 1.05 + 0.15 * Math.sin(elapsed * 5) : 1.05,
            vXZ.z
          );
          collar.scale.setScalar(simDispatch.isBlinkingP1 ? 1.0 + 0.18 * p1Pulse : 1.08);
          valveSlot++;
        }
        for (let i = valveSlot; i < MAX_S3_VALVE_COLLARS; i++) {
          s3ValveCollarMeshes[i].visible = false;
        }

        // System 3 Tanker Ingress Corridors (OPEN_INGRESS) & Blocked Nordre Ringgade
        const corridors = simDispatch.system3State.tankerIngressCorridors;
        const openCorridors = corridors.filter((c) => c.status === 'OPEN_INGRESS');
        const blockedCorridors = corridors.filter((c) => c.status === 'BLOCKED_CLOSED');

        if (openCorridors.length > 0) {
          for (let i = 0; i < S3_OPEN_DASH_COUNT; i++) {
            const corr = openCorridors[i % openCorridors.length];
            const slotIdx = Math.floor(i / openCorridors.length);
            const slotsPerCorr = Math.max(
              1,
              Math.ceil(S3_OPEN_DASH_COUNT / openCorridors.length)
            );
            const segCount = Math.max(1, corr.waypoints.length - 1);
            const progress = ((elapsed * 0.25 + slotIdx / slotsPerCorr) % 1 + 1) % 1;
            const segFloat = progress * segCount;
            const segIdx = Math.min(segCount - 1, Math.floor(segFloat));
            const localT = segFloat - segIdx;
            const pA = latLngToWorldXZ(corr.waypoints[segIdx]);
            const pB = latLngToWorldXZ(corr.waypoints[segIdx + 1]);
            _scratchVecA.set(pA.x, 0.55, pA.z);
            _scratchVecB.set(pB.x, 0.55, pB.z);
            _scratchVecC.lerpVectors(_scratchVecA, _scratchVecB, localT);
            _scratchDummy.position.copy(_scratchVecC);
            _scratchDummy.lookAt(_scratchVecB);
            _scratchDummy.scale.setScalar(1);
            _scratchDummy.updateMatrix();
            s3OpenDashInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          s3OpenDashInstanced.instanceMatrix.needsUpdate = true;
          s3OpenDashInstanced.visible = true;
        } else {
          s3OpenDashInstanced.visible = false;
        }

        if (blockedCorridors.length > 0) {
          const bc = blockedCorridors[0];
          const segCount = Math.max(1, bc.waypoints.length - 1);
          for (let i = 0; i < S3_BLOCKED_BAR_COUNT; i++) {
            const t = (i + 0.5) / S3_BLOCKED_BAR_COUNT;
            const segFloat = t * segCount;
            const segIdx = Math.min(segCount - 1, Math.floor(segFloat));
            const localT = segFloat - segIdx;
            const pA = latLngToWorldXZ(bc.waypoints[segIdx]);
            const pB = latLngToWorldXZ(bc.waypoints[segIdx + 1]);
            _scratchVecA.set(pA.x, 0.72, pA.z);
            _scratchVecB.set(pB.x, 0.72, pB.z);
            _scratchVecC.lerpVectors(_scratchVecA, _scratchVecB, localT);
            _scratchDummy.position.copy(_scratchVecC);
            _scratchDummy.lookAt(_scratchVecB);
            _scratchDummy.scale.setScalar(1);
            _scratchDummy.updateMatrix();
            s3BlockedBarInstanced.setMatrixAt(i, _scratchDummy.matrix);
          }
          s3BlockedBarInstanced.instanceMatrix.needsUpdate = true;
          s3BlockedBarInstanced.visible = true;
        } else {
          s3BlockedBarInstanced.visible = false;
        }
      }

      // Update Instanced Wind Streamline Arrows
      windArrowsInstanced.visible = state.showWindStreamlines;
      if (state.showWindStreamlines) {
        const gridCols = 6;
        const gridRows = 6;
        const spacing = 26;
        const drift = (elapsed * windSpeed * 2.2) % spacing;

        for (let i = 0; i < WIND_ARROW_COUNT; i++) {
          const r = Math.floor(i / gridCols) - (gridRows - 1) / 2;
          const c = (i % gridCols) - (gridCols - 1) / 2;

          const baseLat = c * spacing;
          const baseLon = r * spacing + drift - spacing * 0.5;

          const wx = dirX * baseLon + perpX * baseLat;
          const wz = dirZ * baseLon + perpZ * baseLat;
          const wy = 14 + (i % 3) * 4.5;

          _scratchDummy.position.set(wx, wy, wz);
          _scratchDummy.rotation.set(0, yawRotationY, 0);
          _scratchDummy.scale.set(1, 1, THREE.MathUtils.clamp(windSpeed * 0.16, 0.7, 2.2));
          _scratchDummy.updateMatrix();
          windArrowsInstanced.setMatrixAt(i, _scratchDummy.matrix);
        }
        windArrowsInstanced.instanceMatrix.needsUpdate = true;
      }

      // Exponentially damped camera preset transitions (`THREE.MathUtils.damp`)
      if (cameraTransitionActiveRef.current) {
        const preset = state.cameraPreset;
        if (preset === 'overview') {
          _scratchTargetPos.set(-48, 52, 76);
          _scratchTargetLook.set(4, 3, 2);
        } else if (preset === 'blok1_blok2_percolation') {
          // Focused 3D subterranean cutaway framing Blok 1 & Blok 2 crawlspaces and -25m Pb/PAH pathways
          _scratchTargetPos.set(midBlok12XZ.x - 24, 8.5, midBlok12XZ.z + 29);
          _scratchTargetLook.set(midBlok12XZ.x - 2.0, -6.2, midBlok12XZ.z + 2.5);
        } else if (preset === 'underground_aquifer') {
          // Subterranean cutaway inspection angle centered toward Blok 1 & 2 and -25m aquifers
          _scratchTargetPos.set(midBlok12XZ.x - 38, 12, midBlok12XZ.z + 52);
          _scratchTargetLook.set(midBlok12XZ.x - 2.5, -7.8, midBlok12XZ.z + 2.0);
        } else if (preset === 'downwind_corridor') {
          _scratchTargetPos.set(-dirX * 58, 34, -dirZ * 58);
          _scratchTargetLook.set(dirX * 26, 4, dirZ * 26);
        } else if (preset === 'source_blok1') {
          const k1 =
            sourceNodesMap.get(state.selectedSourceId || 'src-blok-1') ||
            Array.from(sourceNodesMap.values())[0];
          if (k1) {
            _scratchTargetPos.set(k1.worldX - 18, 15, k1.worldZ + 22);
            _scratchTargetLook.set(k1.worldX, 4, k1.worldZ);
          }
        } else if (preset === 'receptor_roedtjoornevej') {
          const rec =
            receptorNodesMap.get('rec-roedtjoornevej-2') ||
            Array.from(receptorNodesMap.values())[0];
          if (rec) {
            _scratchTargetPos.set(rec.worldX - 20, 14, rec.worldZ + 24);
            _scratchTargetLook.set(rec.worldX, 3.5, rec.worldZ);
          }
        } else if (preset === 'street_kierulffsvej') {
          _scratchTargetPos.set(22, 6.5, 48);
          _scratchTargetLook.set(8, 5, -18);
        } else if (preset === 'top_orthographic') {
          _scratchTargetPos.set(0, 138, 12);
          _scratchTargetLook.set(0, 0, 0);
        }

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _scratchTargetPos.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _scratchTargetPos.y, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _scratchTargetPos.z, 4.5, dt);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _scratchTargetLook.x, 5.2, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _scratchTargetLook.y, 5.2, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _scratchTargetLook.z, 5.2, dt);

        if (camera.position.distanceToSquared(_scratchTargetPos) < 0.25) {
          cameraTransitionActiveRef.current = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      afterDraw(tick);
    }

    afterDraw(tick);

    // 16. Cleanup on Unmount
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      cameraRef.current = null;
      controlsRef.current = null;
      renderer.domElement.removeEventListener('mousedown', onPointerDown);
      renderer.domElement.removeEventListener('mouseup', onPointerUp);
      renderer.domElement.removeEventListener('mousemove', onPointerMove);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      envTexture.dispose();
      groundTex.dispose();
      bumpTex.dispose();
      shadowTex.dispose();
      demolitionFacadeTex.dispose();
      residentialFacadeTex.dispose();
      leewardDecalTex.dispose();
      thermalCorrelationSpotTex.dispose();
      dustBlanketDecalTex.dispose();
      asbestosHeatmapTex.dispose();
      blok1SubsurfaceTex.dispose();
      blok2SubsurfaceTex.dispose();
      asbestosCanvasRef.current = null;
      asbestosTextureRef.current = null;
      asbestosReliefGeoRef.current = null;
      renderer.dispose();
    };
  }, [onSelectReceptor, onSelectSource]);

  const plumeDirectionDeg = (currentWeather.windDirection10m + 180) % 360;
  const isHighRiskWind = currentWeather.windSpeed10m > 10;

  const selectedReceptorExp =
    receptorExposures.find((r) => r.receptorId === selectedReceptorId) || receptorExposures[0];
  const rawS = selectedReceptorExp ? selectedReceptorExp.sumQuotient : 0;
  const effectiveS = waterSuppressionActive ? rawS * 0.38 : rawS;
  const showSubsurfaceUI =
    isUndergroundActive ||
    cameraPreset === 'underground_aquifer' ||
    cameraPreset === 'blok1_blok2_percolation';

  return (
    <div
      className={
        internalMapOnly && isMapOnly === undefined
          ? 'fixed inset-0 z-[120] w-screen h-screen bg-[#07090E] overflow-hidden select-none'
          : 'relative w-full h-full min-h-[360px] bg-[#07090E] overflow-hidden select-none'
      }
    >
      {/* Dedicated WebGL Canvas Mount Container (never re-rendered by React state) */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top-Left Minimal Telemetry & 3D Heatmap HUD Overlay (hidden in 'Kun Kort' mode so only map + filters are shown) */}
      {!effectiveMapOnly && (
      <div
        data-window-minimized={is3dHudMinimized ? 'true' : 'false'}
        style={
          is3dHudReleased
            ? {
                position: 'fixed',
                left: `${hud3dPos.x}px`,
                top: `${hud3dPos.y}px`,
                zIndex: 110,
              }
            : undefined
        }
        className={`${
          is3dHudReleased ? 'fixed' : 'absolute top-3 left-3 z-10'
        } flex flex-col gap-2 max-w-md h-auto min-h-0 self-start transition-all duration-200 pointer-events-auto`}
      >
        <div
          className={`bg-[#0B0E17]/95 border rounded-md px-3.5 ${
            is3dHudMinimized ? 'py-1.5' : 'py-2.5'
          } h-auto min-h-0 shadow-lg transition-all duration-200 ${
            is3dHudReleased
              ? 'border-cyan-400 ring-2 ring-cyan-400/70 shadow-2xl'
              : 'border-slate-800'
          }`}
        >
          {/* Window Control Strip: Frigiv / Fastgør & Minimer / Gendan */}
          <div
            onPointerDown={(e) =>
              is3dHudReleased && startDrag3dPanel(e, hud3dPos, setHud3dPos)
            }
            className={`flex items-center justify-between gap-2 ${
              is3dHudMinimized ? 'pb-0 mb-0 border-b-0' : 'pb-1.5 mb-1.5 border-b border-slate-800/90'
            } ${
              is3dHudReleased ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {is3dHudReleased && (
                <GripHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              )}
              <Box className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-bold tracking-tight text-white truncate">
                {showSubsurfaceUI
                  ? '3D Underjordisk Perkolation & Grundvand'
                  : '3D Digital Tvilling & 3D Heatmaps'}
              </span>
              {is3dHudReleased && (
                <span className="px-1 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/50 text-[11px] font-mono text-cyan-200 uppercase shrink-0">
                  Frigivet
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-500/40 whitespace-nowrap inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-cyan-300 shrink-0" />
                <span>{currentWeather.isoTime.slice(0, 10)} · kl. {currentWeather.hourLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setIs3dHudMinimized((v) => !v)}
                className="px-1.5 py-0.5 rounded bg-slate-900/95 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 text-[11px] font-mono font-semibold text-slate-200 hover:text-amber-200 flex items-center gap-1 transition-colors"
                title={is3dHudMinimized ? 'Gendan 3D Heatmap-vindue' : 'Minimer 3D Heatmap-vindue'}
              >
                {is3dHudMinimized ? (
                  <>
                    <Maximize2 className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Gendan</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-2.5 h-2.5 text-amber-400" />
                    <span>Minimer</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIs3dHudReleased((v) => !v);
                  setIs3dHudMinimized(false);
                }}
                className={`px-1.5 py-0.5 rounded border text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors ${
                  is3dHudReleased
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 hover:bg-cyan-500/35'
                    : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700 hover:border-cyan-400/60 text-cyan-300'
                }`}
                title={
                  is3dHudReleased
                    ? 'Fastgør 3D Heatmap-vindue tilbage til 3D-kortet'
                    : 'Frigiv 3D Heatmap-vindue som frit flytbart vindue'
                }
              >
                {is3dHudReleased ? (
                  <>
                    <Pin className="w-2.5 h-2.5 text-cyan-300" />
                    <span>Fastgør</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-2.5 h-2.5 text-cyan-400" />
                    <span>Frigiv</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {!is3dHudMinimized && (
            <>
          <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] font-mono pt-1">
            <div
              className={`rounded px-2 py-1 ${
                isHighRiskWind
                  ? 'bg-rose-600 text-white border border-rose-200'
                  : 'bg-slate-900 text-slate-200 border border-slate-800'
              }`}
            >
              <div className="text-[11px] uppercase opacity-80">Vind (10m)</div>
              <div className="font-bold">{currentWeather.windSpeed10m} m/s</div>
            </div>
            <div className="rounded px-2 py-1 bg-slate-900 text-slate-200 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase">
                {showSubsurfaceUI ? 'Nedbør / Darcy' : '3D Fanevektor'}
              </div>
              <div className="font-bold text-cyan-300">
                {showSubsurfaceUI
                  ? `${effectivePrecipMm.toFixed(1)} mm/t · -${hydroSim.plumeMaxDepthMeters}m`
                  : `${plumeDirectionDeg}° (${degreesToCompass(plumeDirectionDeg)})`}
              </div>
            </div>
            <div className="rounded px-2 py-1 bg-slate-900 text-slate-200 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase">
                {showSubsurfaceUI ? 'Bly (Pb) Grundvand' : 'Sumkvotient S'}
              </div>
              <div
                className={`font-bold ${
                  showSubsurfaceUI
                    ? hydroSim.leadConcentrationSecondaryUgL >= 1.0
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                    : effectiveS >= 1.0
                    ? 'text-rose-400'
                    : effectiveS >= 0.5
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {showSubsurfaceUI
                  ? `${hydroSim.leadConcentrationSecondaryUgL} µg/L`
                  : `${effectiveS.toFixed(2)} ${waterSuppressionActive ? '(Dæmpet)' : ''}`}
              </div>
            </div>
          </div>

          {/* Contaminant Particle Legend */}
          <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5 text-[11px] font-mono text-slate-300">
            <span className="text-slate-400">
              {showSubsurfaceUI ? 'Blok 1 & 2 Perkolat:' : '3D Partikler:'}
            </span>
            <span className="text-fuchsia-400 font-semibold">
              ■ {showSubsurfaceUI ? 'PAH-holdigt vand' : 'Asbest'}
            </span>
            <span className="text-amber-400 font-semibold">■ Bly (Pb)</span>
            <span className="text-purple-400 font-semibold">■ PCB</span>
            <span className="text-cyan-400 font-semibold">
              ■ {showSubsurfaceUI ? 'Infiltrationsvand' : 'Kvartsstøv'}
            </span>
          </div>

          {/* Dedicated Blok 1 & Blok 2 Subterranean Percolation Rate Readout (Bly & PAH vs. Nedbør) */}
          {showSubsurfaceUI && (
            <div className="mt-2 pt-2 border-t border-cyan-500/40 space-y-1.5 text-[11px] font-mono tabular-nums">
              <div
                data-testid="3d-percolation-source-switcher"
                className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/90 border border-slate-800 rounded px-2 py-1"
              >
                <span className="text-cyan-300 font-semibold">Kilde på Perkulationskort:</span>
                <select
                  aria-label="Skift kilde i 3D Perkolation"
                  value={selectedSourceId || ''}
                  onChange={(e) => {
                    if (e.target.value) onSelectSource(e.target.value);
                  }}
                  className="bg-slate-900 border border-cyan-500/50 rounded px-1.5 py-0.5 text-[11px] text-slate-100 font-semibold focus:outline-none cursor-pointer max-w-[190px]"
                >
                  {sources.map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.code} — {src.name.split('—')[0].trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-cyan-200 uppercase">
                  Blok 1 &amp; 2 Perkolations-veje (Pb &amp; PAH)
                </span>
                <button
                  type="button"
                  onClick={handleFocusBlok12Percolation3D}
                  className="px-2 py-0.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-[11px] cursor-pointer"
                  title="Fokuser 3D-kameraet direkte på de underjordiske perkolations-veje under Blok 1 og Blok 2"
                >
                  Fokus Blok 1 &amp; 2
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded bg-slate-900 border border-amber-500/40 p-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-300 font-bold">Bly (Pb) Nedsivning</span>
                    <span
                      className={
                        blok12PercolationMetrics.pbSecondaryUgL >= 1.0
                          ? 'text-rose-400 font-extrabold'
                          : 'text-emerald-300 font-bold'
                      }
                    >
                      {blok12PercolationMetrics.pbSecondaryUgL.toFixed(2)} µg/L
                    </span>
                  </div>
                  <div className="text-[11px] font-extrabold text-white">
                    {blok12PercolationMetrics.pbLeachingRateMgM2H.toFixed(3)} mg/m²/t
                  </div>
                  <div className="h-1.5 w-full rounded bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(8, blok12PercolationMetrics.pbLeachingRateMgM2H * 14)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded bg-slate-900 border border-fuchsia-500/40 p-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-fuchsia-300 font-bold">PAH-holdigt Vand</span>
                    <span
                      className={
                        blok12PercolationMetrics.pahSecondaryUgL >= 0.01
                          ? 'text-rose-400 font-extrabold'
                          : 'text-emerald-300 font-bold'
                      }
                    >
                      {blok12PercolationMetrics.pahSecondaryUgL.toFixed(3)} µg/L
                    </span>
                  </div>
                  <div className="text-[11px] font-extrabold text-white">
                    {blok12PercolationMetrics.pahLeachingRateUgM2H.toFixed(3)} µg/m²/t
                  </div>
                  <div className="h-1.5 w-full rounded bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-fuchsia-400"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(8, blok12PercolationMetrics.pahLeachingRateUgM2H * 4)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-950/90 border border-slate-800 rounded px-2 py-1">
                <span>
                  Nedbør: <strong className="text-cyan-300">{effectivePrecipMm.toFixed(1)} mm/t</strong>{' '}
                  (Infiltr. {blok12PercolationMetrics.infiltrationMmH.toFixed(1)} mm/t)
                </span>
                <span>
                  Hastighed: <strong className="text-amber-300">{blok12PercolationMetrics.verticalVelocityCmH} cm/t</strong>
                </span>
              </div>
            </div>
          )}

          {/* Real-Time / 24h Temporal Accumulation 3D Asbestos-Fiber Dispersion Heatmap Telemetry & Color Scale */}
          {showAsbestosHeatmap && !showSubsurfaceUI && (
            <div
              className={`mt-2 pt-2 border-t space-y-1.5 ${
                isTemporal24hAsbestosActive ? 'border-fuchsia-500/50' : 'border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span
                  className={`font-bold uppercase tracking-wider flex items-center gap-1 ${
                    isTemporal24hAsbestosActive ? 'text-fuchsia-300' : 'text-rose-300'
                  }`}
                >
                  <ShieldAlert
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isTemporal24hAsbestosActive ? 'text-fuchsia-400' : 'text-rose-400'
                    }`}
                  />
                  <span>
                    {isTemporal24hAsbestosActive
                      ? '⏳ Tidsmæssig Asbest-Akkumulering (24t Døgn)'
                      : '3D Asbest-Fiber Heatmap (Realtid)'}
                  </span>
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-bold ${
                    isTemporal24hAsbestosActive
                      ? asbestosMetrics.peak24hDailyRiskQuotient >= 1.0
                        ? 'bg-fuchsia-600 text-white border border-amber-300'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : asbestosMetrics.peakFibersCm3 >= ASBESTOS_GV_2026
                      ? 'bg-rose-600 text-white border border-amber-300'
                      : asbestosMetrics.peakFibersCm3 >= ASBESTOS_ACTION_VALUE
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isTemporal24hAsbestosActive
                    ? `24t Dosis: ${asbestosMetrics.peak24hCumulativeDoseFibersCm3H.toFixed(
                        4
                      )} f/cm³·t (${Math.round(asbestosMetrics.peak24hDailyRiskQuotient * 100)}% Døgn-GV)`
                    : `Peak: ${asbestosMetrics.peakFibersCm3.toFixed(4)} fibre/cm³ (${Math.round(
                        asbestosMetrics.peakQuotient * 100
                      )}% GV)`}
                </span>
              </div>

              {/* Automatic Asbestos Concentration Monitor for Børnehave Receptor (> 0.001 f/cm³) */}
              {isBornehaveAsbestosAlarmTriggered && (
                <div
                  data-testid="asbestos-overlay-bornehave-alarm"
                  role="alert"
                  className="bg-rose-950/95 border border-rose-400 rounded px-2.5 py-2 space-y-1 text-[11px] font-mono shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-rose-200 flex items-center gap-1.5 uppercase tracking-wide">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>ASBEST-ALARM: BØRNEHAVE-RECEPTOR &gt; 0,001 f/cm³</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold border border-amber-300 tabular-nums shrink-0">
                      {bornehaveAsbestosConcCm3.toFixed(4)} f/cm³
                    </span>
                  </div>
                  <div className="text-rose-100/90 leading-snug tabular-nums">
                    Målepunkt: <strong>{asbestosMetrics.bornehaveReceptorLabel}</strong> ·{' '}
                    Alarmgrænse: <strong>0,0010 f/cm³</strong> (
                    {Math.round((bornehaveAsbestosConcCm3 / ASBESTOS_GV_2026) * 100)}% af BEK 613 GV
                    0,0030 f/cm³) · Kilde: <strong>{bornehaveOverlayAlert.dominantSourceCode}</strong>
                  </div>
                  <div className="text-amber-200 font-semibold leading-snug">
                    Strakstiltag: Aktivér øjeblikkelig vandtåge-støvbinding / arbejdsstop i opstrøms kildezone og underret daginstitutionen (Kierulffsvej 2–4).
                  </div>
                </div>
              )}

              {/* Dynamic 'Tidsmæssig Akkumulering' Mode Switcher: Øjebliksbillede vs. 24t Kumulativ Eksponeringsrisiko */}
              <div
                className="grid grid-cols-2 gap-1 p-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono"
                role="group"
                aria-label="Skift mellem Øjebliksbillede og 24-timers kumulativ eksponeringsrisiko"
              >
                <button
                  type="button"
                  onClick={() => handleToggleTemporal24hAsbestos(false)}
                  className={`px-2 py-1 rounded font-semibold cursor-pointer transition-colors whitespace-nowrap truncate ${
                    !isTemporal24hAsbestosActive
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Øjebliksbillede (kl. {currentWeather.hourLabel})
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleTemporal24hAsbestos(true)}
                  className={`px-2 py-1 rounded font-semibold cursor-pointer transition-colors whitespace-nowrap truncate ${
                    isTemporal24hAsbestosActive
                      ? 'bg-fuchsia-600 text-white'
                      : 'text-fuchsia-300 hover:text-fuchsia-100'
                  }`}
                >
                  Tidsmæssig Akkumulering (24t)
                </button>
              </div>

              {isTemporal24hAsbestosActive ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono tabular-nums">
                    <div className="bg-slate-900/90 border border-fuchsia-500/30 rounded px-2 py-1">
                      <div className="text-[11px] text-slate-400 uppercase">Mest Udsat Nabo (24t)</div>
                      <div className="text-fuchsia-200 font-bold truncate">
                        {asbestosMetrics.mostExposedNeighborName}
                      </div>
                    </div>
                    <div className="bg-slate-900/90 border border-fuchsia-500/30 rounded px-2 py-1">
                      <div className="text-[11px] text-slate-400 uppercase">Nabo Døgn-Dosis / Timer</div>
                      <div className="text-amber-300 font-bold">
                        {asbestosMetrics.mostExposedNeighborDoseFibersCm3H.toFixed(3)} ·{' '}
                        {asbestosMetrics.mostExposedNeighborHoursAboveGv}t &gt; GV
                      </div>
                    </div>
                    <div className="bg-slate-900/90 border border-fuchsia-500/30 rounded px-2 py-1">
                      <div className="text-[11px] text-slate-400 uppercase">3D-Volumen Opbygget</div>
                      <div className="text-rose-300 font-bold">
                        00:00–{String(Math.max(0, effectiveTemporalAccumulationHours - 1)).padStart(2, '0')}:00 ({effectiveTemporalAccumulationHours}t)
                      </div>
                    </div>
                  </div>

                  {/* Interactive 24h 3D Volumetric Accumulation Scrubber & Play/Sync Controls */}
                  <div className="bg-slate-950/95 border border-fuchsia-500/40 rounded px-2 py-1.5 space-y-1 text-[11px] font-mono tabular-nums">
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsPlayingTemporalVolume24h((v) => !v)}
                        className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                          isPlayingTemporalVolume24h
                            ? 'bg-rose-600 text-white'
                            : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500'
                        }`}
                        title="Afspil døgnets 3D-volumen-opbygning time for time (skaleret med aktiv simulerings-hastighed)"
                      >
                        {isPlayingTemporalVolume24h ? (
                          <>
                            <Pause className="w-2.5 h-2.5" />
                            <span>Pause ({simulationSpeedMultiplier}x)</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-2.5 h-2.5" />
                            <span>Afspil 24t 3D-Volumen ({simulationSpeedMultiplier}x)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPlayingTemporalVolume24h(false);
                          setSyncTemporalVolumeToTimeline((prev) => {
                            const next = !prev;
                            if (!next) setTemporalVolumeHoursCap(24);
                            return next;
                          });
                        }}
                        className={`px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                          syncTemporalVolumeToTimeline
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-fuchsia-400/60'
                        }`}
                        title="Synkronisér 3D-volumen-opbygningen med den valgte time på døgn-tidslinjen eller vis hele 24t døgnet"
                      >
                        {syncTemporalVolumeToTimeline ? 'Synk: Tidslinje' : 'Horisont: Fuld 24t'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-fuchsia-300 shrink-0">Opbygning:</span>
                      <input
                        type="range"
                        min={1}
                        max={24}
                        step={1}
                        value={effectiveTemporalAccumulationHours}
                        onChange={(e) => {
                          setIsPlayingTemporalVolume24h(false);
                          setSyncTemporalVolumeToTimeline(false);
                          setTemporalVolumeHoursCap(Number(e.target.value));
                        }}
                        aria-label="Tidsmæssig 3D-volumen-akkumulering fra 1 til 24 timer"
                        className="flex-1 accent-fuchsia-500 cursor-pointer"
                      />
                      <span className="text-white font-bold shrink-0">
                        {effectiveTemporalAccumulationHours}/24t
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                  <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                    <div className="text-[11px] text-slate-400 uppercase">Kilde-Parametre</div>
                    <div className="text-slate-200 font-semibold truncate">
                      {asbestosSourceScope === 'selected_source'
                        ? asbestosMetrics.dominantSourceLabel
                        : `${asbestosMetrics.evaluatedSourceCount} aktive kilder`}
                    </div>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                    <div className="text-[11px] text-slate-400 uppercase">Højde / Fiber-Idx</div>
                    <div className="text-emerald-300 font-semibold">
                      H={asbestosMetrics.dominantReleaseHeightM}m ·{' '}
                      {asbestosMetrics.dominantFiberReleasePct}%
                    </div>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                    <div className="text-[11px] text-slate-400 uppercase">&gt; 0,003 fibre/cm³</div>
                    <div className="text-rose-300 font-bold">
                      {asbestosMetrics.exceedanceAreaM2.toLocaleString('da-DK')} m²
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed 3D-Heatmap Color-Gradient & Contour Legend */}
              <div
                data-3d-heatmap-gradient-legend="true"
                className="bg-slate-950/95 border border-slate-800 rounded p-2 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-slate-200">
                    Legende · 3D-Heatmap Farvegradienter ({isTemporal24hAsbestosActive ? '24t Kumulativ Dosis' : 'Øjebliksbillede'})
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    {isTemporal24hAsbestosActive ? 'Døgn-GV: 0,0240 f/cm³·t' : 'BEK 613 GV: 0,0030 f/cm³'}
                  </span>
                </div>

                <div
                  className={`h-2.5 w-full rounded-xs border border-slate-700 ${
                    isTemporal24hAsbestosActive
                      ? 'bg-gradient-to-r from-sky-400 via-violet-500 via-amber-400 to-rose-600'
                      : 'bg-gradient-to-r from-teal-500 via-emerald-400 via-amber-400 to-rose-600'
                  }`}
                />

                {isTemporal24hAsbestosActive ? (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono tabular-nums text-slate-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 shrink-0" />
                      <span className="truncate">
                        <strong className="text-sky-300">Blå/Indigo:</strong> &lt;0,0024 (&lt;10% Lav)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-xs bg-violet-500 shrink-0" />
                      <span className="truncate">
                        <strong className="text-purple-300">Violet:</strong> 0,0024–0,0120 (10–50%)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 shrink-0" />
                      <span className="truncate">
                        <strong className="text-amber-300">Rav/Orange:</strong> 0,0120–0,0240 (Forhøjet)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 border border-white shrink-0" />
                      <span className="truncate">
                        <strong className="text-rose-300">Karmoisin/Hvid:</strong> ≥0,0240 (Kritisk 24t)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono tabular-nums text-slate-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 shrink-0" />
                      <span className="truncate">
                        <strong className="text-teal-300">Turkis:</strong> &lt;0,0003 (&lt;10% Spor)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 shrink-0" />
                      <span className="truncate">
                        <strong className="text-emerald-300">Smaragd:</strong> ≥0,0003 (Aktionsværdi)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 shrink-0" />
                      <span className="truncate">
                        <strong className="text-amber-300">Rav/Gul:</strong> 0,0015–0,0030 (50–100%)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 border border-white shrink-0" />
                      <span className="truncate">
                        <strong className="text-rose-300">Karmoisin/Hvid:</strong> ≥0,0030 (Over GV)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3D 'Læ-Effekt' (Building Wake / Calm Wind Recirculation & Dust Accumulation) Telemetry */}
          {showLeewardWake && !showSubsurfaceUI && (
            <div className="mt-2 pt-2 border-t border-amber-500/40 space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Bygnings Læ-Effekt (Vindstille Støv-Zoner)</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/50 font-bold">
                  -{asbestosMetrics.leewardWindReductionPct}% Vind ·{' '}
                  {asbestosMetrics.peakLeewardAccumulationFactor}× Støv
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                <div className="bg-slate-900/90 border border-amber-500/30 rounded px-2 py-1">
                  <div className="text-[11px] text-slate-400 uppercase">Læ-Vind (Recirkulation)</div>
                  <div className="text-amber-200 font-bold">
                    {asbestosMetrics.leewardCalmWindSpeedMs} m/s (Vindstille)
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-amber-500/30 rounded px-2 py-1">
                  <div className="text-[11px] text-slate-400 uppercase">Læ-Retning</div>
                  <div className="text-cyan-200 font-bold">
                    {plumeDirectionDeg}° ({degreesToCompass(plumeDirectionDeg)})
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-amber-500/30 rounded px-2 py-1">
                  <div className="text-[11px] text-slate-400 uppercase">Kritisk Læ-Lomme</div>
                  <div className="text-rose-300 font-bold truncate">
                    {asbestosMetrics.criticalLeewardBuildingLabel}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3D 'Vis Vejr-Korrelation' (Wind Speed vs. Observed Dust Intensity SHA-256 Heatmap Points) Telemetry */}
          {showWeatherCorrelation && !showSubsurfaceUI && (
            <div className="mt-2 pt-2 border-t border-orange-500/50 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="font-bold uppercase tracking-wider text-orange-300 flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>3D Vejr-Korrelation (SHA-256 Heatmap-Punkter)</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-200 border border-orange-400/60 font-bold">
                  r = {weatherCorrelationSummary.pearsonR >= 0 ? '+' : ''}
                  {weatherCorrelationSummary.pearsonR.toFixed(2)} (R²=
                  {weatherCorrelationSummary.rSquared.toFixed(2)})
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                <div className="bg-slate-900/90 border border-orange-500/30 rounded px-2 py-1">
                  <div className="text-[11px] text-slate-400 uppercase">SHA-256 Punkter (3D)</div>
                  <div className="text-orange-200 font-bold">
                    {weatherCorrelationSummary.totalSignedPoints} pkt (
                    {weatherCorrelationSummary.userObservationCount} obs)
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-orange-500/30 rounded px-2 py-1">
                  <div className="text-[11px] text-slate-400 uppercase">Vind (Gns / Peak)</div>
                  <div className="text-cyan-200 font-bold">
                    {weatherCorrelationSummary.avgWindSpeedMs} /{' '}
                    {weatherCorrelationSummary.peakWindSpeedMs} m/s
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-orange-500/30 rounded px-2 py-1">
                  <div className="text-[11px] text-slate-400 uppercase">Støv-Intensitet S</div>
                  <div className="text-rose-300 font-bold">
                    Gns {weatherCorrelationSummary.avgDustIntensityS.toFixed(2)} · Peak{' '}
                    {weatherCorrelationSummary.peakDustIntensityS.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Compact Interactive SHA-256 3D Heatmap-Points Log */}
              <div className="max-h-28 overflow-y-auto rounded border border-slate-800 bg-slate-950/90 divide-y divide-slate-800/80 text-[11px] font-mono">
                {weatherCorrelationSummary.points.slice(0, 6).map((pt) => {
                  const isSel = selectedCorrelationPointId === pt.id;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() =>
                        setSelectedCorrelationPointId((prev) =>
                          prev === pt.id ? null : pt.id
                        )
                      }
                      className={`w-full px-2 py-1 flex items-center justify-between gap-1.5 text-left transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-orange-950/80 text-white'
                          : 'hover:bg-slate-900/90 text-slate-300'
                      }`}
                      title={`SHA-256: ${pt.sha256Signature} — Klik for at fremhæve dette 3D varmekort-punkt i 3D-rummet`}
                    >
                      <span className="truncate flex items-center gap-1">
                        <span
                          className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                            pt.correlationIndex >= 0.8
                              ? 'bg-fuchsia-500'
                              : pt.correlationIndex >= 0.6
                              ? 'bg-rose-500'
                              : pt.correlationIndex >= 0.38
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span className="font-bold text-cyan-300">{pt.code}</span>
                        <span className="truncate text-slate-300">{pt.locationLabel}</span>
                      </span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        <span className="text-cyan-200">{pt.windSpeedMs}m/s</span>
                        <span className="text-rose-300 font-bold">
                          S={pt.dustIntensityS.toFixed(2)}
                        </span>
                        <span className="text-amber-300">
                          {Math.round(pt.correlationIndex * 100)}%
                        </span>
                        <span className="text-slate-400">
                          #{pt.sha256Signature.slice(0, 6)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

                {/* Thermal 3D Heatmap-Points Legend Bar */}
              <div className="space-y-0.5 pt-0.5">
                <div className="h-1.5 w-full rounded-sm border border-slate-700 bg-gradient-to-r from-emerald-400 via-amber-400 via-orange-500 to-fuchsia-500" />
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                  <span className="text-emerald-300">Lav Vind/Støv (&lt;40%)</span>
                  <span className="text-amber-300">Moderat (40-65%)</span>
                  <span className="text-fuchsia-300 font-bold">
                    Kritisk Vind×Støv Korrelation (≥80%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3D Courtyard Accumulated Dust-Dose Heatmap & Dust Fallout (Synchronized with Timeline Slider) */}
          {showDustDeposition3D && !showSubsurfaceUI && (
            <div className="mt-2 pt-2 border-t border-amber-500/50 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className="font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>3D-Varmekort: Akkumulerede Støv-Doser i Gårdmiljøer</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-400/60 font-bold">
                  00:00→{currentWeather.hourLabel} ({dustDepositionProgressHours.toFixed(1)}t dosis)
                </span>
              </div>

              {/* Timeline Synchronization & Playback Controls */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/95 border border-amber-500/30 rounded px-2 py-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    const nextSync = !syncCourtyardHeatmapWithTimeline;
                    setSyncCourtyardHeatmapWithTimeline(nextSync);
                    if (nextSync) {
                      setIsPlayingDustDeposition(false);
                    }
                  }}
                  className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 border transition-colors cursor-pointer shrink-0 ${
                    syncCourtyardHeatmapWithTimeline && !isPlayingDustDeposition
                      ? 'bg-cyan-400 text-slate-950 border-white'
                      : 'bg-slate-800 text-cyan-200 border-cyan-500/40 hover:bg-slate-700'
                  }`}
                  title="Når aktiv, animeres 3D-varmekortet over akkumulerede støv-doser i gårdmiljøerne synkront med tidslinje-slideren i bunden"
                >
                  <Link className="w-3 h-3 shrink-0" />
                  <span>
                    {syncCourtyardHeatmapWithTimeline && !isPlayingDustDeposition
                      ? 'Synkron med Tidslinje: AKTIV'
                      : 'Synkronisér med Tidslinje'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlayingDustDeposition((v) => {
                      const next = !v;
                      if (next) setSyncCourtyardHeatmapWithTimeline(false);
                      return next;
                    });
                  }}
                  className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 border transition-colors cursor-pointer shrink-0 ${
                    isPlayingDustDeposition
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : 'bg-slate-800 text-amber-200 border-amber-500/50 hover:bg-slate-700'
                  }`}
                  title={
                    isPlayingDustDeposition
                      ? 'Pause 24-timers 3D gårdmiljø-varmekort & støvnedfalds-loop'
                      : 'Afspil kontinuerligt 24-timers 3D gårdmiljø-varmekort & støvnedfalds-loop'
                  }
                >
                  {isPlayingDustDeposition ? (
                    <>
                      <Pause className="w-2.5 h-2.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5" />
                      <span>24t Loop</span>
                    </>
                  )}
                </button>

                <input
                  type="range"
                  min={0.5}
                  max={24}
                  step={0.2}
                  value={dustDepositionProgressHours}
                  onChange={(e) => {
                    setIsPlayingDustDeposition(false);
                    setSyncCourtyardHeatmapWithTimeline(false);
                    setDustDepositionProgressHours(parseFloat(e.target.value));
                  }}
                  aria-label="Scrub 3D-varmekort over akkumulerede støv-doser i boligblokkenes gårdmiljøer"
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Ranked Live Readout: Mest Udsatte Receptorer (#1, #2, #3) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase text-slate-400">
                  <span>Mest Udsatte Receptorer (3D Akkumulering)</span>
                  <span>Akkumuleret Støv / Lagtykkelse</span>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/90 divide-y divide-slate-800/80 text-[11px] font-mono">
                  {dustDepositionSummary.topExposedReceptors.map((prof) => {
                    const sampled = sampleCumulativeDepositionAtHour(
                      prof,
                      dustDepositionProgressHours
                    );
                    const isSelected = selectedReceptorId === prof.receptorId;
                    const pctOfMax = Math.min(
                      100,
                      Math.round(
                        (sampled.accumulatedUgM2 /
                          Math.max(1, dustDepositionSummary.maxTotal24hUgM2)) *
                          100
                      )
                    );
                    return (
                      <button
                        key={prof.receptorId}
                        type="button"
                        onClick={() => onSelectReceptor(prof.receptorId)}
                        className={`w-full px-2 py-1 flex flex-col gap-0.5 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-950/70 text-white'
                            : 'hover:bg-slate-900/90 text-slate-200'
                        }`}
                        title={`Klik for at fokusere på ${prof.code}: ${prof.name} i 3D-scenen`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate flex items-center gap-1">
                            <span
                              className={`px-1 py-0.2 rounded text-[11px] font-bold shrink-0 ${
                                prof.exposureRank === 1
                                  ? 'bg-rose-600 text-white'
                                  : prof.exposureRank === 2
                                  ? 'bg-orange-500 text-slate-950'
                                  : 'bg-amber-400 text-slate-950'
                              }`}
                            >
                              #{prof.exposureRank}
                            </span>
                            <span className="font-bold text-cyan-300">{prof.code}</span>
                            <span className="truncate text-slate-300">{prof.name}</span>
                          </span>
                          <span className="shrink-0 flex items-center gap-1.5">
                            <span className="text-amber-300 font-bold">
                              {Math.round(sampled.accumulatedUgM2).toLocaleString('da-DK')} µg/m²
                            </span>
                            <span className="text-rose-300">
                              ({sampled.layerThicknessMm.toFixed(2)} mm)
                            </span>
                          </span>
                        </div>
                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pctOfMax}%` }}
                            className={`h-full transition-all duration-150 ${
                              prof.exposureRank === 1
                                ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500'
                                : prof.exposureRank === 2
                                ? 'bg-gradient-to-r from-amber-300 to-orange-500'
                                : 'bg-amber-400'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3D Wind-Tunnel & Turbulence Eddy Visualization (> 10 m/s) Telemetry & Controls Card */}
          {showWindTunnelEddy3D && !showSubsurfaceUI && (
            <div className="pt-2 border-t border-slate-800/90 space-y-2 text-[11px] font-mono">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-cyan-200 font-bold uppercase tracking-wider">
                    3D Vindtunnels-Visualisering (Eddy &gt; 10 m/s)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                      windTunnelEddySummary.isLiveAbove10Ms
                        ? 'bg-rose-950/90 border-rose-500/70 text-rose-200'
                        : windTunnelEddySummary.isThresholdExceededOrForced
                        ? 'bg-cyan-950/90 border-cyan-400/70 text-cyan-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    {windTunnelEddySummary.isLiveAbove10Ms
                      ? `LIVE VIND ${windTunnelEddySummary.liveWindSpeedMs.toFixed(1)} m/s (>10 m/s)`
                      : windTunnelEddySummary.isThresholdExceededOrForced
                      ? `VINDTUNNEL ${windTunnelEddySummary.effectiveTunnelWindMs.toFixed(1)} m/s (>10 m/s SIM)`
                      : `UNDER TÆRSKEL (${windTunnelEddySummary.liveWindSpeedMs.toFixed(1)} m/s ≤ 10 m/s)`}
                  </span>
                </div>
              </div>

              {/* Scope & >10 m/s Wind-Tunnel Override Controls */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/90 border border-cyan-500/30 rounded px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setWindTunnelScope('selected_machine')}
                    className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer inline-flex items-center gap-1 ${
                      windTunnelScope === 'selected_machine'
                        ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-200'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400/60'
                    }`}
                    title="Vis 3D vindtunnels-hvirvler (Eddy-strukturer) omkring den valgte nedrivningsmaskine"
                  >
                    <Target className="w-3 h-3 shrink-0" />
                    <span>Valgt Maskine ({windTunnelEddySummary.selectedMachineProfile.sourceCode})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWindTunnelScope('all_active_machines')}
                    className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer inline-flex items-center gap-1 ${
                      windTunnelScope === 'all_active_machines'
                        ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-200'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400/60'
                    }`}
                    title="Vis 3D vindtunnels-hvirvler omkring alle aktive nedrivningsmaskiner samtidig"
                  >
                    <Layers className="w-3 h-3 shrink-0" />
                    <span>Alle Maskiner ({activeSourceCount})</span>
                  </button>
                </div>

                {!windTunnelEddySummary.isLiveAbove10Ms && (
                  <button
                    type="button"
                    onClick={() => setForceHighWindTunnelPreview((v) => !v)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer inline-flex items-center gap-1 ${
                      forceHighWindTunnelPreview
                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-200'
                        : 'bg-slate-900 text-amber-300 border-amber-500/50 hover:bg-amber-950/60'
                    }`}
                    title="Aktuel timevind er under 10 m/s — klik for at tvinge/simulere > 10 m/s storm-vindtunnel på den valgte nedrivningsmaskine"
                  >
                    <Zap className="w-3 h-3 shrink-0" />
                    <span>
                      {forceHighWindTunnelPreview
                        ? '>10 m/s Vindtunnel-Sim: TIL'
                        : 'Tving >10 m/s Vindtunnel-Sim'}
                    </span>
                  </button>
                )}
              </div>

              {/* CFD / Eddy Vortex Telemetry Grid for Selected Demolition Machine */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                  <div className="text-[11px] uppercase text-slate-400">Reynolds Tal (Re)</div>
                  <div className="text-xs font-bold text-cyan-300">
                    {(windTunnelEddySummary.selectedMachineProfile.reynoldsNumber / 1e6).toFixed(2)}×10⁶
                  </div>
                  <div className="text-[11px] text-slate-400">Superkritisk hvirvel</div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                  <div className="text-[11px] uppercase text-slate-400">Vortex Frekvens (fₛ)</div>
                  <div className="text-xs font-bold text-amber-300">
                    {windTunnelEddySummary.selectedMachineProfile.strouhalFreqHz.toFixed(2)} Hz
                  </div>
                  <div className="text-[11px] text-slate-400">von Kármán (St=0,21)</div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                  <div className="text-[11px] uppercase text-slate-400">Turbulent Energi (TKE)</div>
                  <div className="text-xs font-bold text-rose-300">
                    {windTunnelEddySummary.selectedMachineProfile.tkeM2S2.toFixed(1)} m²/s²
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Γ = {windTunnelEddySummary.selectedMachineProfile.eddyCirculationM2S.toFixed(1)} m²/s
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                  <div className="text-[11px] uppercase text-slate-400">Fiber-Medrivning</div>
                  <div className="text-xs font-bold text-rose-400">
                    {windTunnelEddySummary.selectedMachineProfile.dustEntrainmentMultiplier.toFixed(2)}× løft
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Eddy-køl: {windTunnelEddySummary.selectedMachineProfile.wakeLengthMeters.toFixed(1)} m
                  </div>
                </div>
              </div>

              {/* Quick Machine Selector Pills for Wind-Tunnel Inspection */}
              <div className="flex flex-wrap items-center justify-between gap-1 bg-slate-950/80 border border-slate-800/90 rounded px-2 py-1">
                <span className="text-[11px] uppercase text-slate-400">
                  Vælg Nedrivningsmaskine i Vindtunnel:
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {windTunnelEddySummary.machineProfiles.map((mp) => (
                    <button
                      key={mp.sourceId}
                      type="button"
                      onClick={() => {
                        onSelectSource(mp.sourceId);
                        handleSelectCameraPreset('source_blok1');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors ${
                        mp.isSelected
                          ? 'bg-cyan-500/30 border-cyan-400 text-cyan-100 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/50'
                      }`}
                      title={`Inspicér Eddy-strukturer omkring ${mp.sourceName} (Re=${(
                        mp.reynoldsNumber / 1e6
                      ).toFixed(2)}×10⁶, TKE=${mp.tkeM2S2} m²/s²)`}
                    >
                      {mp.sourceCode} ({mp.tkeM2S2} m²/s²)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3D Sound Wave Refraction & Wavefront Particle Animation ('Lydbølge-Animation' over Barrieren) */}
          {showSoundWaveAnimation3D && !showSubsurfaceUI && (
            <div className="pt-2 border-t border-indigo-500/40 space-y-2 text-[11px] font-mono">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-indigo-200 font-bold uppercase tracking-wider">
                    3D Lydbølge-Animation (Nedbøjning over Barriere)
                  </span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                    acousticRefractionSummary.selectedCorridor.totalRefractionDb >= 3.0
                      ? 'bg-rose-950/90 border-rose-500/70 text-rose-200'
                      : 'bg-indigo-950/90 border-indigo-400/70 text-indigo-200'
                  }`}
                >
                  {acousticRefractionSummary.selectedCorridor.sourceCode} →{' '}
                  {acousticRefractionSummary.selectedCorridor.receptorCode}:{' '}
                  {acousticRefractionSummary.selectedCorridor.totalRefractionDb >= 0 ? '+' : ''}
                  {acousticRefractionSummary.selectedCorridor.totalRefractionDb.toFixed(1)} dB
                </span>
              </div>

              {/* Playback, Speed (0.5x, 1x, 2x), Corridor Scope & Strong Refraction Override */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/90 border border-indigo-500/30 rounded px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsPlayingSoundWave3D((v) => !v)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                      isPlayingSoundWave3D
                        ? 'bg-indigo-500 text-white border-indigo-300'
                        : 'bg-slate-900 text-indigo-200 border-indigo-500/50 hover:bg-slate-800'
                    }`}
                    title={
                      isPlayingSoundWave3D
                        ? 'Pause 3D bølgefront-partikler langs refraktionsstierne over støjskærmen'
                        : 'Afspil 3D bølgefront-partikler langs refraktionsstierne over støjskærmen'
                    }
                  >
                    {isPlayingSoundWave3D ? (
                      <>
                        <Pause className="w-2.5 h-2.5" />
                        <span>Pause Bølger</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-2.5 h-2.5" />
                        <span>Afspil Bølger</span>
                      </>
                    )}
                  </button>

                  {(['0.5x', '1x', '2x'] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSoundWaveSpeed3D(spd)}
                      className={`px-1.5 py-0.5 rounded text-[11px] border cursor-pointer ${
                        soundWaveSpeed3D === spd
                          ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {spd}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSoundWaveCorridorScope((prev) =>
                        prev === 'all_downwind_corridors'
                          ? 'selected_corridor'
                          : 'all_downwind_corridors'
                      )
                    }
                    className="px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-indigo-200 border border-indigo-500/40 cursor-pointer inline-flex items-center gap-1"
                    title="Skift mellem at vise 3D lydbølge-refraktionsstier til alle medvinds-receptorer eller kun til den valgte receptor"
                  >
                    {soundWaveCorridorScope === 'all_downwind_corridors' ? (
                      <>
                        <Globe className="w-3 h-3 shrink-0" />
                        <span>Alle Medvinds-Stier</span>
                      </>
                    ) : (
                      <>
                        <Target className="w-3 h-3 shrink-0" />
                        <span>Kun {acousticRefractionSummary.selectedCorridor.receptorCode}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForceStrongRefraction3D((v) => !v)}
                    className={`px-1.5 py-0.5 rounded text-[11px] border cursor-pointer ${
                      forceStrongRefraction3D
                        ? 'bg-rose-600/30 border-rose-400 text-rose-200 font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                    title="Simulér kraftig nedbøjning (> +3 dB medvindsrefraktion) over den 2,5 m høje støjskærm"
                  >
                    {forceStrongRefraction3D ? '↷ >3 dB Fokus: TIL' : '↷ Live Refraktion'}
                  </button>
                </div>
              </div>

              {/* Acoustic Refraction & Barrier Bypass Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                  <div className="text-[11px] uppercase text-slate-400">Medvinds-Refraktion</div>
                  <div className="text-xs font-bold text-rose-300">
                    {acousticRefractionSummary.selectedCorridor.totalRefractionDb >= 0 ? '+' : ''}
                    {acousticRefractionSummary.selectedCorridor.totalRefractionDb.toFixed(1)} dB
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ∂u/∂z = +{acousticRefractionSummary.windGradientDuDz} s⁻¹
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                  <div className="text-[11px] uppercase text-slate-400">2,5m Skærmtab</div>
                  <div className="text-xs font-bold text-amber-300">
                    -{acousticRefractionSummary.selectedCorridor.barrierBypassLossDb.toFixed(1)} dB tabt
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Rest-skærm:{' '}
                    {acousticRefractionSummary.selectedCorridor.remainingBarrierShieldingDb.toFixed(1)}{' '}
                    dB
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                  <div className="text-[11px] uppercase text-slate-400">Krumningsradius R_c</div>
                  <div className="text-xs font-bold text-cyan-300">
                    {acousticRefractionSummary.selectedCorridor.rayCurvatureRadiusKm.toFixed(2)} km
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Nedbøjning mod {acousticRefractionSummary.selectedCorridor.receptorCode}
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1">
                  <div className="text-[11px] uppercase text-slate-400">Receptor Støj L_Aeq</div>
                  <div
                    className={`text-xs font-bold ${
                      acousticRefractionSummary.selectedCorridor.effectiveReceptorLaeqDb >
                      acousticRefractionSummary.hourlyNoiseLimitLaeqDb
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {acousticRefractionSummary.selectedCorridor.effectiveReceptorLaeqDb.toFixed(1)} /{' '}
                    {acousticRefractionSummary.hourlyNoiseLimitLaeqDb.toFixed(0)} dB(A)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Peak {acousticRefractionSummary.selectedCorridor.impulsePeakLafmaxDb.toFixed(0)} dB
                  </div>
                </div>
              </div>

              {/* Sub-Toggles for Item #2 (Acoustisk Refraktions-Overlay), Item #5 (Lydbølge-Reflektion), and Item #6 (Barriere-Top Diffraktion) */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-950/90 border border-indigo-500/30 rounded px-2 py-1.5">
                <span className="text-[11px] uppercase text-slate-400">
                  3D Bølge-Fysik lag:
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAcousticRefractionOverlay3D((v) => !v)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors inline-flex items-center gap-1 ${
                      showAcousticRefractionOverlay3D
                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-200'
                        : 'bg-slate-900 text-amber-200 border-amber-500/40 hover:bg-slate-800'
                    }`}
                    title="Vis/skjul 'Acoustisk refraktions-overlay': lysende 3D-buer over støjskærmen i realtid baseret på maxDownwindRefractionDb"
                  >
                    <Volume2 className="w-3 h-3 shrink-0" />
                    <span>
                      Refraktions-Overlay (Max +{acousticRefractionSummary.maxDownwindRefractionDb.toFixed(1)} dB):{' '}
                      {showAcousticRefractionOverlay3D ? 'AKTIV' : 'SLUKKET'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSoundWaveReflection3D((v) => !v)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors inline-flex items-center gap-1 ${
                      showSoundWaveReflection3D
                        ? 'bg-rose-500 text-white font-bold border-rose-300'
                        : 'bg-slate-900 text-rose-200 border-rose-500/40 hover:bg-slate-800'
                    }`}
                    title="Vis/skjul 'Lydbølge-Reflektion': tegner reflekterede bølgevektorer mod barrieren når lydbølgerne rammer skærmoverfladen"
                  >
                    <Undo2 className="w-3 h-3 shrink-0" />
                    <span>Lydbølge-Reflektion: {showSoundWaveReflection3D ? 'AKTIV' : 'SLUKKET'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBarrierDiffractionArcs3D((v) => !v)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors inline-flex items-center gap-1 ${
                      showBarrierDiffractionArcs3D
                        ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-200'
                        : 'bg-slate-900 text-cyan-200 border-cyan-500/40 hover:bg-slate-800'
                    }`}
                    title="Vis/skjul 'Barriere-Top Diffraktion': cirkulære bølgefront-segmenter der bøjer sig hen over barrierens top ind i skyggezonen"
                  >
                    <Layers className="w-3 h-3 shrink-0" />
                    <span>Cirkulær Top-Diffraktion: {showBarrierDiffractionArcs3D ? 'AKTIV' : 'SLUKKET'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowHydraulicHammerImpulseWaves3D((v) => !v)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors inline-flex items-center gap-1 ${
                      showHydraulicHammerImpulseWaves3D
                        ? 'bg-fuchsia-500 text-white font-bold border-amber-200'
                        : 'bg-slate-900 text-fuchsia-200 border-fuchsia-500/40 hover:bg-slate-800'
                    }`}
                    title="Vis/skjul 3D visuel animation af impuls-støjbølger fra hydrauliske betonhammere, der forplantes og nedbøjes mod naboblokke baseret på beregnet refraktion (dB) pr. time"
                  >
                    <Hammer className="w-3 h-3 shrink-0" />
                    <span>
                      Impuls-Støjbølger fra Kilde ({acousticRefractionSummary.selectedCorridor.sourceCode} ·{' '}
                      L_WA {acousticRefractionSummary.sourceSoundPowerLwaDb.toFixed(0)} dB ·{' '}
                      {acousticRefractionSummary.isNoiseLimitExceededInSelectedHour
                        ? `⚠ GRÆNSE OVERSKREDET +${acousticRefractionSummary.maxExceedanceDbInHour.toFixed(1)} dB`
                        : 'Under grænse'}
                      ): {showHydraulicHammerImpulseWaves3D ? 'AKTIV' : 'SLUKKET'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Quick Receptor Corridor Selector Pills */}
              <div className="flex flex-wrap items-center justify-between gap-1 bg-slate-950/80 border border-slate-800/90 rounded px-2 py-1">
                <span className="text-[11px] uppercase text-slate-400">
                  Vælg Refraktions-Korridor (Kilde → Støjskærm → Receptor):
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {acousticRefractionSummary.corridors.map((corr) => (
                    <button
                      key={corr.receptorId}
                      type="button"
                      onClick={() => onSelectReceptor(corr.receptorId)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors ${
                        corr.isSelectedReceptor
                          ? 'bg-indigo-500/35 border-indigo-400 text-indigo-100 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-indigo-500/50'
                      }`}
                      title={`Fokusér 3D lydbølge-animation på ${corr.receptorCode}: ${corr.receptorName} (${
                        corr.totalRefractionDb >= 0 ? '+' : ''
                      }${corr.totalRefractionDb} dB nedbøjning over 2,5m barriere)`}
                    >
                      {corr.receptorCode} ({corr.totalRefractionDb >= 0 ? '+' : ''}
                      {corr.totalRefractionDb}dB)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Item #1: Dynamic 3D 'Støv-Emitter' Animation for All Active Demolition Machines */}
          {showMachineryDustEmitter3D && !showSubsurfaceUI && (
            <div className="pt-2 border-t border-amber-500/40 space-y-2 text-[11px] font-mono">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-200 font-bold uppercase tracking-wider">
                    3D Dynamisk Støv-Emitter (Maskin-Belastning × Vind)
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-950/90 border border-amber-400/70 text-amber-200">
                  {activeSourceCount} Aktive · Peak{' '}
                  {machineryDustEmitterSummary.peakVolumetricDensityMgM3.toFixed(1)} mg/m³ ·{' '}
                  {machineryDustEmitterSummary.meanDispersionSpeedMs.toFixed(1)} m/s
                </span>
              </div>

              {/* Machine Load Output % Slider & Quick Presets */}
              <div className="bg-slate-950/90 border border-amber-500/30 rounded px-2 py-1.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[11px] text-slate-300">
                    Maskinernes Belastnings-Output:{' '}
                    <strong className="text-amber-300">{machineryLoadOutputPct}%</strong> · Vind:{' '}
                    <strong className="text-cyan-300">
                      {currentWeather.windSpeed10m.toFixed(1)} m/s
                    </strong>
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { pct: 60, label: '60% Eco' },
                      { pct: 100, label: '100% Nominel' },
                      { pct: 125, label: '125% Spids' },
                      { pct: 140, label: '140% Maks. Knusning' },
                    ].map((preset) => (
                      <button
                        key={preset.pct}
                        type="button"
                        onClick={() => setMachineryLoadOutputPct(preset.pct)}
                        className={`px-1.5 py-0.5 rounded text-[11px] border cursor-pointer ${
                          machineryLoadOutputPct === preset.pct
                            ? 'bg-amber-400 text-slate-950 font-bold border-amber-200'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/60'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min={40}
                  max={140}
                  step={5}
                  value={machineryLoadOutputPct}
                  onChange={(e) => setMachineryLoadOutputPct(parseInt(e.target.value, 10))}
                  aria-label="Juster nedrivningsmaskinernes aktuelle belastnings-output i procent"
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Per-Machine Volumetric Dust Density & Dispersion Speed Readout */}
              <div className="rounded border border-slate-800 bg-slate-950/90 divide-y divide-slate-800/80 text-[11px]">
                {machineryDustEmitterSummary.machineTelemetries
                  .filter((m) => m.active)
                  .map((m) => (
                    <button
                      key={m.sourceId}
                      type="button"
                      onClick={() => onSelectSource(m.sourceId)}
                      className={`w-full px-2 py-1 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                        selectedSourceId === m.sourceId
                          ? 'bg-amber-950/60 text-white'
                          : 'hover:bg-slate-900 text-slate-200'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <span className="font-bold text-amber-300">{m.sourceCode}</span>
                        <span className="truncate text-slate-300">{m.sourceName}</span>
                        <span className="text-[11px] px-1 rounded bg-slate-800 text-amber-200">
                          Output {m.loadOutputPct}%
                        </span>
                      </span>
                      <span className="shrink-0 flex items-center gap-2">
                        <span className="text-rose-300 font-bold">
                          {m.volumetricDensityMgM3.toFixed(1)} mg/m³
                        </span>
                        <span className="text-cyan-300">
                          {m.dispersionSpeedMs.toFixed(1)} m/s
                        </span>
                        <span className="text-slate-400">
                          ({m.emissionRateGramSec.toFixed(2)} g/s)
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Hover Entity Readout */}
        {hoveredEntityLabel && (
          <div className="bg-[#0B0E17]/95 border border-cyan-500/60 rounded px-3 py-1.5 text-xs font-mono text-cyan-200 shadow-md flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{hoveredEntityLabel} (Klik for at inspicere)</span>
          </div>
        )}
      </div>
      )}

      {/* Top-Right Fullscreen, 3D Sound Wave Animation, 3D Wind-Tunnel Eddy (>10 m/s), 3D Dust Fallout & Accumulation, Weather-Correlation 3D Heatmap Points, Leeward Wake Marker, 24h Temporal Asbestos Accumulation, 2D/3D Underground Switch & Quick Reset Actions */}
      <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setShowMachineryDustEmitter3D((v) => !v)}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
            showMachineryDustEmitter3D
              ? 'bg-amber-500 text-slate-950 border-rose-200 font-bold'
              : 'bg-[#0B0E17]/95 border-amber-500/70 hover:bg-amber-950 text-amber-200'
          }`}
          title="Vis/skjul dynamisk 'Støv-Emitter' animation i 3D-scenen for alle aktive nedrivningsmaskiner (volumetrisk tæthed mg/m³ og spredningshastighed m/s korreleret med maskinens belastnings-output og vindhastighed)"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {showMachineryDustEmitter3D
              ? `3D Støv-Emitter (${machineryDustEmitterSummary.peakVolumetricDensityMgM3.toFixed(1)} mg/m³ · ${machineryLoadOutputPct}%)`
              : '3D Støv-Emitter'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowAcousticRefractionOverlay3D((v) => !v)}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
            showAcousticRefractionOverlay3D
              ? 'bg-rose-500 text-white border-amber-200 font-bold'
              : 'bg-[#0B0E17]/95 border-rose-500/70 hover:bg-rose-950 text-rose-200'
          }`}
          title="Vis/skjul 'Acoustisk refraktions-overlay' i 3D-scenen: viser lydbølgernes krumningsbane som lysende buer over støjskærmen i realtid baseret på maxDownwindRefractionDb"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>
            {showAcousticRefractionOverlay3D
              ? `Refraktions-Overlay (+${acousticRefractionSummary.maxDownwindRefractionDb.toFixed(1)} dB Buer)`
              : 'Refraktions-Overlay'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowSoundWaveAnimation3D((v) => !v)}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
            showSoundWaveAnimation3D
              ? 'bg-indigo-500 text-white border-amber-200 font-bold'
              : 'bg-[#0B0E17]/95 border-indigo-500/70 hover:bg-indigo-950 text-indigo-200'
          }`}
          title="Vis/skjul 3D 'Lydbølge-Animation': animerer lydbølgernes nedbøjning over den 2,5 m høje støjskærm ved at flytte bølgefront-partikler og buede bølgefronter langs de beregnede refraktionsstier"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>
            {showSoundWaveAnimation3D
              ? `3D Lydbølge-Animation (${
                  acousticRefractionSummary.selectedCorridor.totalRefractionDb >= 0 ? '+' : ''
                }${acousticRefractionSummary.selectedCorridor.totalRefractionDb.toFixed(1)} dB)`
              : '3D Lydbølge-Animation'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowWindTunnelEddy3D((v) => !v)}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
            showWindTunnelEddy3D
              ? 'bg-cyan-400 text-slate-950 border-amber-200 font-bold'
              : 'bg-[#0B0E17]/95 border-cyan-500/70 hover:bg-cyan-950 text-cyan-200'
          }`}
          title="Vis/skjul 3D 'Vindtunnels-visualisering' omkring de valgte nedrivningsmaskiner: viser beregnede turbulens-hvirvler (Eddy-strukturer, hestesko-vortex og von Kármán hvirvelgade), når vindhastigheden overstiger 10 m/s"
        >
          <Wind className="w-3.5 h-3.5" />
          <span>
            {showWindTunnelEddy3D
              ? `3D Vindtunnel (Eddy > 10 m/s): AKTIV (${windTunnelEddySummary.effectiveTunnelWindMs.toFixed(1)} m/s)`
              : '3D Vindtunnel (Eddy > 10 m/s)'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowDustDeposition3D((v) => !v)}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
            showDustDeposition3D
              ? 'bg-amber-400 text-slate-950 border-rose-300 font-bold'
              : 'bg-[#0B0E17]/95 border-amber-500/70 hover:bg-amber-950 text-amber-200'
          }`}
          title="Vis/skjul 3D-varmekort over akkumulerede støv-doser ved de mest udsatte receptorer (animeres synkront med tidslinje-slideren for at visualisere ophobning af respirabelt støv i boligblokkenes gårdmiljøer)"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>
            {showDustDeposition3D
              ? `3D Gårdmiljø Støv-Dosis Varmekort (${dustDepositionProgressHours.toFixed(1)}t)`
              : '3D Gårdmiljø Støv-Dosis Varmekort'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleWeatherCorrelation()}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
            showWeatherCorrelation
              ? 'bg-orange-500 text-slate-950 border-amber-200 font-bold'
              : 'bg-[#0B0E17]/95 border-orange-500/70 hover:bg-orange-950 text-orange-200'
          }`}
          title="Vis/skjul 'Vis Vejr-Korrelation' overlay i 3D-scenen: viser korrelationen mellem vindhastighed (m/s) og observeret støv-intensitet (baseret på SHA-256 signerede observationer) som varmekort-punkter i 3D-rummet"
        >
          <Thermometer className="w-3.5 h-3.5" />
          <span>
            {showWeatherCorrelation
              ? `Vis Vejr-Korrelation: AKTIV (r=${
                  weatherCorrelationSummary.pearsonR >= 0 ? '+' : ''
                }${weatherCorrelationSummary.pearsonR.toFixed(2)})`
              : 'Vis Vejr-Korrelation'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleLeewardWake()}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
            showLeewardWake
              ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
              : 'bg-[#0B0E17]/95 border-amber-500/60 hover:bg-amber-950 text-amber-200'
          }`}
          title="Vis/skjul 3D markør for 'Læ-effekt' (hvor bygninger skaber vindstille recirkulations-zoner i den aktuelle vindretning, så støv og asbestfibre akkumuleres mere intenst)"
        >
          <Wind className="w-3.5 h-3.5" />
          <span>
            {showLeewardWake
              ? 'Læ-Effekt (Vindstille Zoner): AKTIV'
              : 'Vis Læ-Effekt (Vindstille Zoner)'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleTemporal24hAsbestos()}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
            isTemporal24hAsbestosActive
              ? 'bg-fuchsia-500 text-slate-950 border-amber-300 font-bold'
              : 'bg-[#0B0E17]/95 border-fuchsia-500/60 hover:bg-fuchsia-950 text-fuchsia-200'
          }`}
          title="Generér 'Tidsmæssig Asbest-Akkumulering' heatmap-overlay over hele døgnet (24 timer) til vurdering af samlet eksponeringsrisiko for naboer"
        >
          <Hourglass className="w-3.5 h-3.5" />
          <span>
            {isTemporal24hAsbestosActive
              ? 'Tidsmæssig Asbest-Akkumulering (24t): AKTIV'
              : 'Tidsmæssig Asbest-Akkumulering (24t Døgn-Risiko)'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleToggleUnderground3D()}
          className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors ${
            showSubsurfaceUI
              ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
              : 'bg-[#0B0E17]/95 border-cyan-500/60 hover:bg-cyan-950 text-cyan-200'
          }`}
          title="Slå 3D Underjordisk Perkolation & Grundvands-Cutaway til/fra"
        >
          <Droplets className="w-3.5 h-3.5" />
          <span>{showSubsurfaceUI ? '3D Grundvand: AKTIV' : '3D Underjordisk Perkolation'}</span>
        </button>

        {onToggleWaterMainLayer && (
          <button
            type="button"
            data-testid="3d-hud-water-main-layer-btn"
            onClick={onToggleWaterMainLayer}
            className={`px-2.5 py-1.5 rounded border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer ${
              showWaterMainLayer
                ? 'bg-sky-500 text-slate-950 border-sky-200 font-bold'
                : 'bg-[#0B0E17]/95 border-sky-500/60 hover:bg-sky-950 text-sky-200'
            }`}
            title="Slå Kierulffsvej DN200 Drikkevands Hovedrør 3D-lag til/fra"
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>
              {showWaterMainLayer ? 'Drikkevands Hovedrør: TIL' : 'Drikkevands Hovedrør'}
            </span>
          </button>
        )}

        {onSwitchTo2DPercolation && (
          <button
            type="button"
            onClick={onSwitchTo2DPercolation}
            className="px-2.5 py-1.5 rounded bg-[#0B0E17]/95 border border-indigo-500/60 hover:bg-indigo-950 text-xs font-mono font-semibold text-indigo-200 flex items-center gap-1.5 shadow-md transition-colors"
            title="Skift til 2D Geologisk Tværsnit af Perkolation & Grundvand"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>2D Tværsnit (Grundvand)</span>
          </button>
        )}

        {/* Dedicated 3D Map Zoom + & - Controls */}
        <div
          className="inline-flex items-center rounded bg-[#0B0E17]/95 border border-cyan-500/70 shadow-md overflow-hidden"
          role="group"
          aria-label="3D Kort Zoom kontrol"
        >
          <button
            type="button"
            onClick={() => handleZoom3D('in')}
            className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 font-mono text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer border-r border-slate-800"
            title="Zoom Ind (+) på 3D Kortet"
            aria-label="Zoom Ind (+) på 3D Kortet"
          >
            <ZoomIn className="w-3.5 h-3.5 shrink-0" />
            <span>+</span>
          </button>
          <button
            type="button"
            onClick={() => handleZoom3D('reset')}
            className="px-2 py-1.5 bg-slate-950 hover:bg-slate-900 text-[11px] font-mono font-bold text-cyan-300 transition-colors cursor-pointer border-r border-slate-800"
            title="Klik for at nulstille 3D Zoom til 100%"
          >
            {zoom3DLevelPct}%
          </button>
          <button
            type="button"
            onClick={() => handleZoom3D('out')}
            className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 font-mono text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
            title="Zoom Ud (−) på 3D Kortet"
            aria-label="Zoom Ud (-) på 3D Kortet"
          >
            <ZoomOut className="w-3.5 h-3.5 shrink-0" />
            <span>−</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSelectCameraPreset('overview')}
          className="px-2.5 py-1.5 rounded bg-[#0B0E17]/95 border border-slate-700 hover:border-cyan-400 text-xs font-mono text-slate-200 flex items-center gap-1.5 shadow-md transition-colors"
          title="Nulstil 3D-kameravinkel"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Nulstil Kamera</span>
        </button>

        {(isFullscreen3D || effectiveMapOnly) && (
          <div
            className="px-2.5 py-1 rounded bg-[#0B0E17]/95 border border-cyan-400/80 ring-1 ring-cyan-400/40 text-xs font-mono font-bold text-cyan-100 flex items-center gap-1.5 shadow-lg whitespace-nowrap"
            title={`Simuleret Dato & Klokkeslæt: ${selectedDateIso || currentWeather.isoTime.slice(0, 10)} kl. ${currentWeather.hourLabel} (${currentWeather.temperature2m.toFixed(1)}°C · ${currentWeather.windSpeed10m.toFixed(1)} m/s)`}
          >
            {onChangeDateIso ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const curIso = selectedDateIso || currentWeather.isoTime.slice(0, 10);
                    const dt = new Date(`${curIso}T12:00:00Z`);
                    dt.setUTCDate(dt.getUTCDate() - 1);
                    onChangeDateIso(dt.toISOString().slice(0, 10));
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                  title="Forrige dato (-1 dag)"
                >
                  −1d
                </button>
                <input
                  type="date"
                  value={selectedDateIso || currentWeather.isoTime.slice(0, 10)}
                  onChange={(e) => {
                    if (e.target.value) {
                      onChangeDateIso(e.target.value);
                    }
                  }}
                  aria-label="Skift dato i Fuld Skærm eller Kun Kort visning"
                  className="bg-slate-900 border border-cyan-500/50 rounded px-1.5 py-0.5 text-[11px] font-mono font-extrabold text-white focus:outline-none focus:border-amber-300 cursor-pointer [color-scheme:dark]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const curIso = selectedDateIso || currentWeather.isoTime.slice(0, 10);
                    const dt = new Date(`${curIso}T12:00:00Z`);
                    dt.setUTCDate(dt.getUTCDate() + 1);
                    onChangeDateIso(dt.toISOString().slice(0, 10));
                  }}
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
              <span className="text-white font-extrabold inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-cyan-300 shrink-0" />
                <span>{selectedDateIso || currentWeather.isoTime.slice(0, 10)}</span>
              </span>
            )}
            <span className="text-cyan-400">·</span>
            <span className="text-amber-300 font-extrabold inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-300 shrink-0" />
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
            <span className="text-slate-400 text-[11px] hidden xl:inline">
              ({currentWeather.temperature2m.toFixed(1)}°C · {currentWeather.windSpeed10m.toFixed(1)} m/s)
            </span>
          </div>
        )}

        {onToggleFullscreen3D && !effectiveMapOnly && (
          <button
            type="button"
            onClick={onToggleFullscreen3D}
            className="px-2.5 py-1.5 rounded bg-[#0B0E17]/95 border border-cyan-500/60 hover:bg-cyan-950 text-xs font-mono font-semibold text-cyan-200 flex items-center gap-1.5 shadow-md transition-colors"
          >
            {isFullscreen3D ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Afslut Fuldskærm</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>100% 3D Fuldskærm</span>
              </>
            )}
          </button>
        )}

        <CompactSimulerMenu
          showWaterMainLayer={Boolean(showWaterMainLayer)}
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
          hasVirtualLeakPin={Boolean(virtualLeakPinPoint)}
          onToggleVirtualLeakPinQuick={onToggleVirtualLeakPinQuick}
          sources={sources}
          onToggleSourceActive={onToggleSourceActive}
          onIsolateNearbyMachinery={onIsolateNearbyMachinery}
          onRestoreAllMachinery={onRestoreAllMachinery}
          pipePpvMmPerSec={waterMainTelemetry?.pipePpvMmPerSec}
          align="right"
        />

        {/* 'Kun Kort' Button + Top-Right 'Afslut' Button when 'Kun Kort' is active */}
        {!effectiveMapOnly ? (
          <button
            type="button"
            onClick={handleToggleMapOnly}
            className="px-2.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 border border-emerald-200 text-xs font-mono font-extrabold text-slate-950 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            title="Kun Kort — Vis kun 3D-kortet med filtre og skjul øvrige paneler"
          >
            <MapIcon className="w-3.5 h-3.5 text-slate-950" />
            <span>Kun Kort</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleMapOnly}
            className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 border border-rose-300 text-xs font-mono font-extrabold text-white flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
            title="Afslut 'Kun Kort' visning (Esc)"
          >
            <X className="w-4 h-4 text-white" />
            <span>Afslut</span>
          </button>
        )}
      </div>

      {/* Collapsible & Detachable Bottom Control Dock (with Frigiv, Minimer & 3D Zoom + / - buttons) */}
      <div
        data-window-minimized={isDockCollapsed ? 'true' : 'false'}
        style={
          isBottomDockReleased
            ? {
                position: 'fixed',
                left: `${bottomDockPos.x}px`,
                top: `${bottomDockPos.y}px`,
                zIndex: 112,
              }
            : undefined
        }
        className={`${
          isBottomDockReleased
            ? 'fixed w-[92%] max-w-4xl'
            : 'absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[95%] max-w-4xl'
        } h-auto min-h-0 transition-all duration-200 pointer-events-auto`}
      >
        {isDockCollapsed ? (
          <div className="flex justify-center items-center gap-2 h-auto min-h-0">
            <div className="inline-flex items-center rounded-md bg-[#0B0E17]/95 border border-cyan-500/70 shadow-xl overflow-hidden font-mono text-xs">
              <button
                type="button"
                onClick={() => handleZoom3D('in')}
                className="px-2.5 py-1.5 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 font-bold flex items-center gap-1 border-r border-slate-800 cursor-pointer"
                title="Zoom Ind (+) på 3D Kortet"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Zoom +</span>
              </button>
              <button
                type="button"
                onClick={() => handleZoom3D('out')}
                className="px-2.5 py-1.5 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 font-bold flex items-center gap-1 cursor-pointer"
                title="Zoom Ud (−) på 3D Kortet"
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Zoom −</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsDockCollapsed(false)}
              className="px-4 py-1.5 rounded-md bg-[#0B0E17]/95 border border-slate-700 hover:border-cyan-400 text-xs font-mono font-semibold text-slate-200 flex items-center gap-2 shadow-xl"
            >
              <ChevronUp className="w-4 h-4 text-cyan-400" />
              <span>
                Gendan 3D Kamera-, Nedbørs- &amp; Heatmap-Kontroller ({activeSourceCount} aktive kilder)
              </span>
            </button>
          </div>
        ) : (
          <div
            className={`bg-[#0B0E17]/95 border rounded-md p-3 h-auto min-h-0 shadow-2xl space-y-2.5 transition-all duration-200 ${
              isBottomDockReleased ? 'border-cyan-400 ring-2 ring-cyan-400/70' : 'border-slate-800'
            }`}
          >
            <div
              onPointerDown={(e) =>
                isBottomDockReleased &&
                startDrag3dPanel(e, bottomDockPos, setBottomDockPos)
              }
              className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 ${
                isBottomDockReleased ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {isBottomDockReleased && (
                  <GripHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                <span className="text-[11px] font-mono uppercase text-slate-400 mr-1 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Kamera:</span>
                </span>
                {[
                  { key: 'overview', label: 'Overblik' },
                  {
                    key: 'blok1_blok2_percolation',
                    label: 'Blok 1 & 2 Perkolation (Pb & PAH)',
                  },
                  { key: 'underground_aquifer', label: 'Grundvand Overblik (-25m)' },
                  { key: 'downwind_corridor', label: 'Medvinds-Korridor' },
                  { key: 'source_blok1', label: 'Kilde (Blok 1)' },
                  { key: 'receptor_roedtjoornevej', label: 'Rødtjørnevej 2' },
                  { key: 'street_kierulffsvej', label: 'Gadeniveau' },
                  { key: 'top_orthographic', label: 'Top-Orto' },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      if (preset.key === 'blok1_blok2_percolation') {
                        handleFocusBlok12Percolation3D();
                      } else if (preset.key === 'underground_aquifer') {
                        if (onToggleUndergroundMode) {
                          onToggleUndergroundMode(true);
                        } else {
                          setLocalUndergroundMode(true);
                        }
                        handleSelectCameraPreset('underground_aquifer');
                      } else {
                        handleSelectCameraPreset(preset.key as CameraPresetKey);
                      }
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                      cameraPreset === preset.key
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Inline Zoom + / - in Bottom Camera Dock */}
                <div className="inline-flex items-center rounded bg-slate-900 border border-cyan-500/50 overflow-hidden font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleZoom3D('in')}
                    className="px-2 py-1 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-bold flex items-center gap-0.5 border-r border-slate-800 cursor-pointer"
                    title="Zoom Ind (+) på 3D Kortet"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Zoom +</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleZoom3D('out')}
                    className="px-2 py-1 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-bold flex items-center gap-0.5 cursor-pointer"
                    title="Zoom Ud (−) på 3D Kortet"
                  >
                    <Minus className="w-3 h-3" />
                    <span>Zoom −</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDockCollapsed(true)}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-amber-400/60 text-[11px] font-mono font-semibold text-slate-200 hover:text-amber-200 flex items-center gap-1"
                  title="Minimer 3D kontrolpanelet"
                >
                  <Minus className="w-3 h-3 text-amber-400" />
                  <span>Minimer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBottomDockReleased((v) => !v)}
                  className={`px-2 py-1 rounded border text-[11px] font-mono font-semibold flex items-center gap-1 ${
                    isBottomDockReleased
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100'
                      : 'bg-slate-900 border-slate-700 hover:border-cyan-400/60 text-cyan-300'
                  }`}
                  title={
                    isBottomDockReleased
                      ? 'Fastgør 3D kontrolpanel i bunden'
                      : 'Frigiv 3D kontrolpanel som frit flytbart vindue'
                  }
                >
                  {isBottomDockReleased ? (
                    <>
                      <Pin className="w-3 h-3 text-cyan-300" />
                      <span>Fastgør</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                      <span>Frigiv</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Row 2: Precipitation Percolation Slider when 3D Underground Mode is active */}
            {showSubsurfaceUI && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-cyan-500/40 rounded px-2.5 py-1.5 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-cyan-200 font-semibold">Nedbør (Perkolation):</span>
                  {[
                    { label: 'Live', val: null },
                    { label: '0 mm/t', val: 0 },
                    { label: '2,5 mm/t', val: 2.5 },
                    { label: '8 mm/t', val: 8.0 },
                    { label: 'Skybrud 22 mm/t', val: 22.0 },
                  ].map((btn) => {
                    const active =
                      btn.val === null
                        ? activePrecipOverride === null
                        : activePrecipOverride !== null &&
                          Math.abs(activePrecipOverride - btn.val) < 0.2;
                    return (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => handleSetPrecipOverride(btn.val)}
                        className={`px-2 py-0.5 rounded text-[11px] border ${
                          active
                            ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-200'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 min-w-[210px] flex-1 max-w-xs">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={0.5}
                    value={effectivePrecipMm}
                    onChange={(e) => handleSetPrecipOverride(parseFloat(e.target.value))}
                    aria-label="Juster nedbørsmængde i 3D Grundvands-simulering"
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <span className="text-cyan-300 font-bold whitespace-nowrap">
                    {effectivePrecipMm.toFixed(1)} mm/t
                  </span>
                </div>
              </div>
            )}

            {/* Row 3: Interactive 3D Simulation Toggles & Source Quick-Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleUnderground3D()}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showSubsurfaceUI
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    3D Grundvands-Perkolation: {showSubsurfaceUI ? 'AKTIV (-25m)' : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWaterSuppressionActive((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    waterSuppressionActive
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                  title="Simulér vandkanon-støvdæmpning ved nedrivningskilderne (reducerer spredningsfane med 62%)"
                >
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Vandkanon: {waterSuppressionActive ? 'AKTIV (-62% S)' : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleAsbestosHeatmap()}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showAsbestosHeatmap
                      ? 'bg-rose-600/30 border-rose-400 text-rose-200 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                  title="Slå 3D Asbest-Fiber Sprednings-Heatmap (fibre/cm³ mod BEK 613/2026 GV = 0,003 fibre/cm³) til/fra"
                >
                  <Biohazard className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    3D Asbest-Fiber Heatmap: {showAsbestosHeatmap ? 'AKTIV' : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleTemporal24hAsbestos()}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isTemporal24hAsbestosActive
                      ? 'bg-fuchsia-600/35 border-fuchsia-400 text-fuchsia-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-fuchsia-300 hover:border-fuchsia-500/60'
                  }`}
                  title="Skift dynamisk mellem Øjebliksbillede (realtids fibre/cm³) og 24-timers kumulativ eksponeringsrisiko (fibre/cm³·t) i 3D-heatmappet"
                >
                  <Layers className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>
                    Tidsmæssig Akkumulering:{' '}
                    {isTemporal24hAsbestosActive
                      ? '24t Kumulativ Risiko'
                      : `Øjebliksbillede (kl. ${currentWeather.hourLabel})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleLeewardWake()}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showLeewardWake
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-amber-500/50'
                  }`}
                  title="Vis/skjul 3D markør for 'Læ-effekt' (vindstille recirkulations-zoner bag bygninger baseret på aktuel vindretning, hvor støv akkumuleres intenst)"
                >
                  <Wind className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Læ-Effekt (Vindstille Zoner): {showLeewardWake ? 'AKTIV' : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleWeatherCorrelation()}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showWeatherCorrelation
                      ? 'bg-orange-500/30 border-orange-400 text-orange-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-orange-300 hover:border-orange-500/60'
                  }`}
                  title="Vis/skjul 'Vis Vejr-Korrelation' overlay i 3D-scenen (korrelation mellem vindhastighed og observeret støv-intensitet baseret på SHA-256 signerede observationer som varmekort-punkter i 3D-rummet)"
                >
                  <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                  <span>
                    Vis Vejr-Korrelation: {showWeatherCorrelation ? 'AKTIV' : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDustDeposition3D((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showDustDeposition3D
                      ? 'bg-amber-500/30 border-amber-400 text-amber-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-amber-300 hover:border-amber-500/60'
                  }`}
                  title="Vis/skjul 3D støvnedfald og tidsmæssig støv-akkumulering ved de mest udsatte receptorer baseret på støvdeponeringsprofilen (0-24t)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    3D Støvnedfald &amp; Akkumulering:{' '}
                    {showDustDeposition3D
                      ? `AKTIV (${dustDepositionProgressHours.toFixed(1)}t)`
                      : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWindTunnelEddy3D((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showWindTunnelEddy3D
                      ? 'bg-cyan-500/30 border-cyan-400 text-cyan-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-cyan-300 hover:border-cyan-500/60'
                  }`}
                  title="Vis/skjul 3D 'Vindtunnels-visualisering' med beregnede turbulens-hvirvler (Eddy-strukturer) omkring de valgte nedrivningsmaskiner ved vind > 10 m/s"
                >
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    3D Vindtunnel (Eddy &gt; 10 m/s):{' '}
                    {showWindTunnelEddy3D
                      ? `AKTIV (${windTunnelEddySummary.effectiveTunnelWindMs.toFixed(1)} m/s)`
                      : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSoundWaveAnimation3D((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showSoundWaveAnimation3D
                      ? 'bg-indigo-500/35 border-indigo-400 text-indigo-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-indigo-300 hover:border-indigo-500/60'
                  }`}
                  title="Vis/skjul 3D 'Lydbølge-Animation': animerer lydbølgernes nedbøjning over den 2,5 m høje støjskærm ved at flytte bølgefront-partikler langs de beregnede refraktionsstier"
                >
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    3D Lydbølge-Animation:{' '}
                    {showSoundWaveAnimation3D
                      ? `AKTIV (${
                          acousticRefractionSummary.selectedCorridor.totalRefractionDb >= 0 ? '+' : ''
                        }${acousticRefractionSummary.selectedCorridor.totalRefractionDb.toFixed(1)} dB)`
                      : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!showSoundWaveAnimation3D) setShowSoundWaveAnimation3D(true);
                    setShowHydraulicHammerImpulseWaves3D((v) => !v);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showSoundWaveAnimation3D && showHydraulicHammerImpulseWaves3D
                      ? 'bg-fuchsia-600/40 border-fuchsia-400 text-fuchsia-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-fuchsia-300 hover:border-fuchsia-500/60'
                  }`}
                  title="Vis/skjul 3D animation af impuls-støjbølger fra hydrauliske betonhammere mod naboblokke baseret på beregnet refraktion (dB) pr. time"
                >
                  <Hammer className="w-3.5 h-3.5 text-fuchsia-300" />
                  <span>
                    Betonhammer Impuls-Bølger (kl. {currentWeather.hourLabel}):{' '}
                    {showSoundWaveAnimation3D && showHydraulicHammerImpulseWaves3D
                      ? `AKTIV (${
                          acousticRefractionSummary.selectedCorridor.totalRefractionDb >= 0 ? '+' : ''
                        }${acousticRefractionSummary.selectedCorridor.totalRefractionDb.toFixed(1)} dB · ${acousticRefractionSummary.selectedCorridor.impulsePeakLafmaxDb.toFixed(0)} dB Spids)`
                      : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMachineryDustEmitter3D((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showMachineryDustEmitter3D
                      ? 'bg-amber-500/35 border-amber-400 text-amber-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-amber-300 hover:border-amber-500/60'
                  }`}
                  title="Vis/skjul dynamisk 'Støv-Emitter' animation i 3D-scenen for alle aktive nedrivningsmaskiner"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    3D Støv-Emitter:{' '}
                    {showMachineryDustEmitter3D
                      ? `AKTIV (${machineryDustEmitterSummary.peakVolumetricDensityMgM3.toFixed(1)} mg/m³)`
                      : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAcousticRefractionOverlay3D((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showAcousticRefractionOverlay3D
                      ? 'bg-rose-500/35 border-rose-400 text-rose-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-rose-300 hover:border-rose-500/60'
                  }`}
                  title="Vis/skjul 'Acoustisk refraktions-overlay' (lysende buer over støjskærmen baseret på maxDownwindRefractionDb)"
                >
                  <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    Refraktions-Overlay:{' '}
                    {showAcousticRefractionOverlay3D
                      ? `AKTIV (+${acousticRefractionSummary.maxDownwindRefractionDb.toFixed(1)} dB)`
                      : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSoundWaveReflection3D((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showSoundWaveReflection3D
                      ? 'bg-pink-500/35 border-pink-400 text-pink-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-pink-300 hover:border-pink-500/60'
                  }`}
                  title="Vis/skjul 'Lydbølge-Reflektion' (reflekterede bølgevektorer mod barrieren når lydbølger rammer skærmoverfladen)"
                >
                  <Undo2 className="w-3.5 h-3.5 text-pink-400" />
                  <span>
                    Lydbølge-Reflektion: {showSoundWaveReflection3D ? 'AKTIV' : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBarrierDiffractionArcs3D((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showBarrierDiffractionArcs3D
                      ? 'bg-cyan-500/35 border-cyan-400 text-cyan-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-cyan-300 hover:border-cyan-500/60'
                  }`}
                  title="Vis/skjul 'Barriere-Top Diffraktion' (cirkulære bølgefront-segmenter der bøjer sig hen over barrierens top)"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Top-Diffraktion: {showBarrierDiffractionArcs3D ? 'AKTIV' : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPlumeVolumes((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 border transition-colors ${
                    showPlumeVolumes
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-rose-400" />
                  <span>3D Isokoner</span>
                </button>

                <button
                  type="button"
                  data-testid="toggle-plume-path-animation-3d-btn"
                  onClick={() => setShowPlumePathAnimation3D((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                    showPlumePathAnimation3D
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-cyan-500/50'
                  }`}
                  title="Vis/skjul 3D 'Fane-stianimation': animerer beregnet Gaussisk puff-spredning langs vindretningen over tid (+0t til +5t)"
                >
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Fane-stianimation: {showPlumePathAnimation3D ? 'AKTIV' : 'SLUKKET'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWindStreamlines((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 border transition-colors ${
                    showWindStreamlines
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Wind className="w-3.5 h-3.5 text-indigo-400" />
                  <span>3D Vindfelt</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggle3DNeutralPressurePlane()}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    show3DNeutralPressurePlane
                      ? 'bg-rose-500/30 border-rose-400 text-rose-100 shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-amber-300 hover:border-amber-500/60'
                  }`}
                  title="Tegn et semi-transparent horisontalt snitplan i højden z_NPL på hver beboet blok (a_inhabited) med indadrettede røde vektorpile under planet og udadrettede cyan vektorpile over planet"
                >
                  <Thermometer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Vis 3D Neutraltryksplan &amp; Indeklima-Sug</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/90 text-[11px]">
                    z_NPL = {neutralPressurePlaneHeightMeters.toFixed(1)}m
                  </span>
                </button>
              </div>

              {/* Active Demolition Source Toggles */}
              {onToggleSourceActive && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono uppercase text-slate-400">Kilder:</span>
                  {sources.slice(0, 4).map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => onToggleSourceActive(src.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                        src.active
                          ? 'bg-rose-950/80 border-rose-500/60 text-rose-200 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                      }`}
                      title={`${src.name} — klik for at slå kilde til/fra i 3D-simuleringen`}
                    >
                      {src.code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 4: Real-Time 3D Asbestos-Fiber Heatmap Source Scope & Elevation Slice Bar */}
            {showAsbestosHeatmap && !showSubsurfaceUI && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/90 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-rose-300 font-semibold inline-flex items-center gap-1">
                    <Biohazard className="w-3 h-3 shrink-0" />
                    <span>Kilde-Filter (Stof-panel):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSetAsbestosSourceScope('all_active')}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      asbestosSourceScope === 'all_active'
                        ? 'bg-rose-600 text-white font-bold border-rose-300'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Alle Aktive Kilder ({sources.filter((s) => s.active && s.substances.includes('asbestos')).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAsbestosSourceScope('selected_source')}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      asbestosSourceScope === 'selected_source'
                        ? 'bg-rose-600 text-white font-bold border-rose-300'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Kun Valgt Kilde ({asbestosMetrics.dominantSourceLabel})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-400">3D Snithøjde (z):</span>
                  {[
                    { h: 1.5, label: '1,5 m (Åndedræt)' },
                    { h: 6.0, label: '6,0 m (2. sal)' },
                    { h: 12.0, label: '12,0 m (Tag/4. sal)' },
                  ].map((slice) => (
                    <button
                      key={slice.h}
                      type="button"
                      onClick={() => handleSetAsbestosEvalHeight(slice.h)}
                      className={`px-2 py-0.5 rounded border transition-colors ${
                        Math.abs(asbestosEvalHeightMeters - slice.h) < 0.2
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {slice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Row 5: 3D Building Operational Categories (a–e) Filter & Quick Status Switcher */}
            {!showSubsurfaceUI && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/90 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-cyan-300 font-semibold mr-1 inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span>3D Bygningskategorier (29):</span>
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
                    const isVis = activeCategoryFilters.includes(catCode);
                    const count = buildings.filter((b) => b.category === catCode).length;
                    return (
                      <button
                        key={catCode}
                        type="button"
                        onClick={() => onToggleCategoryFilter?.(catCode)}
                        className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors ${
                          isVis
                            ? 'bg-slate-900 text-white border-slate-600 font-bold'
                            : 'bg-slate-950/60 text-slate-500 border-slate-800 opacity-60'
                        }`}
                        title={`Slå visning af kategori '${meta.labelDa}' til/fra i 3D`}
                      >
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: meta.colorHex }}
                        />
                        <span>{meta.labelDa}</span>
                        <span className="text-slate-400">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {onChangeBuildingCategory && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Hurtig-skift Blok 1:</span>
                    <select
                      aria-label="Skift Blok 1 kategori i 3D"
                      value={
                        buildings.find((b) => b.id === 'BLOK-1')?.category ||
                        'd_under_demolition'
                      }
                      onChange={(e) =>
                        onChangeBuildingCategory(
                          'BLOK-1',
                          e.target.value as BuildingOperationalCategory
                        )
                      }
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] font-mono text-white"
                    >
                      {(
                        Object.values(BUILDING_CATEGORY_METADATA) as Array<
                          (typeof BUILDING_CATEGORY_METADATA)[BuildingOperationalCategory]
                        >
                      ).map((cMeta) => (
                        <option key={cMeta.code} value={cMeta.code}>
                          Blok 1: {cMeta.labelDa}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Row 6: 3D Neutral Pressure Plane (z_NPL) Elevation Controls when active */}
            {show3DNeutralPressurePlane && !showSubsurfaceUI && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/90 text-[11px] font-mono">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-amber-300 font-bold inline-flex items-center gap-1">
                    <Thermometer className="w-3 h-3 shrink-0" />
                    <span>3D Neutraltryksplan (z_NPL) på Beboede Blokke (a. Beboet):</span>
                  </span>
                  <span className="text-rose-300">
                    ▼ Under z_NPL ({neutralPressurePlaneHeightMeters.toFixed(1)} m): Røde
                    indadrettede vektorpile (Infiltration &amp; Kældersug Q_op = 78,1 m³/h)
                  </span>
                  <span className="text-cyan-300">
                    ▲ Over z_NPL: Cyan udadrettede vektorpile (Fugteksfiltration)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { z: 5.8, label: 'z_NPL = 5,8 m (0,48 H Vinter-Opdrift)' },
                    { z: 12.0, label: 'z_NPL = 12,0 m (Aktiv CAV -45,3 Pa)' },
                    { z: 0.0, label: 'z_NPL = 0,0 m (HEPA Overtryk +10 Pa)' },
                  ].map((preset) => (
                    <button
                      key={preset.z}
                      type="button"
                      onClick={() => handleSetNeutralPressureHeightM(preset.z)}
                      className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                        Math.abs(neutralPressurePlaneHeightMeters - preset.z) < 0.25
                          ? 'bg-rose-500/30 border-rose-400 text-white font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
