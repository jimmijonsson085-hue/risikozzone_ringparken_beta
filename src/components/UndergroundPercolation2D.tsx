import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Box,
  CheckCircle2,
  CloudRain,
  Download,
  Droplets,
  FileText,
  Gauge,
  Layers,
  Maximize2,
  RefreshCw,
  ShieldAlert,
  Sliders,
  X,
} from 'lucide-react';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
} from '../types/dispersion';
import { generatePercolationPdfReport } from '../services/pdfExportService';

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
  const [showMacroporeFractures, setShowMacroporeFractures] = useState<boolean>(true);
  const [showContaminantContours, setShowContaminantContours] = useState<boolean>(true);
  const [percolationPdfGenerated, setPercolationPdfGenerated] = useState<boolean>(false);

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

  const unsecuredDemolishedCount = useMemo(
    () =>
      activeSources.filter(
        (s) => s.buildingCategory === 'e_demolished_unsecured' || s.buildingHeight3DMeters === 0
      ).length,
    [activeSources]
  );

  const hydroSim = useMemo(
    () =>
      computeHydrogeologicalPercolation(
        effectivePrecipMm,
        currentWeather.soilMoisture0To7cm,
        currentWeather.hadRecentFreezeThaw,
        activeSources.length,
        unsecuredDemolishedCount
      ),
    [
      effectivePrecipMm,
      currentWeather.soilMoisture0To7cm,
      currentWeather.hadRecentFreezeThaw,
      activeSources.length,
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
    selectedSourceId,
    hydroSim,
    effectivePrecipMm,
    hadRecentFreezeThaw: currentWeather.hadRecentFreezeThaw,
    showMacroporeFractures,
    showContaminantContours,
    selectedLayerId,
  });

  useEffect(() => {
    animStateRef.current = {
      sources,
      selectedSourceId,
      hydroSim,
      effectivePrecipMm,
      hadRecentFreezeThaw: currentWeather.hadRecentFreezeThaw,
      showMacroporeFractures,
      showContaminantContours,
      selectedLayerId,
    };
  }, [
    sources,
    selectedSourceId,
    hydroSim,
    effectivePrecipMm,
    currentWeather.hadRecentFreezeThaw,
    showMacroporeFractures,
    showContaminantContours,
    selectedLayerId,
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
      const displaySources = st.sources.slice(0, 4);
      const sourcePositionsX = displaySources.map(
        (_, idx) => leftMargin + plotW * (0.16 + idx * 0.21)
      );

      if (st.showContaminantContours) {
        displaySources.forEach((src, idx) => {
          if (!src.active) return;
          const sx = sourcePositionsX[idx];
          const maxPlumeY = depthToY(sim.plumeMaxDepthMeters);
          const plumeHeight = Math.max(12, maxPlumeY - surfaceY);
          const plumeRadiusX = 28 + sim.effectivePrecipitationMmH * 1.45 + sim.saturationRatio * 18;

          const plumeGrad = ctx!.createRadialGradient(
            sx,
            surfaceY + plumeHeight * 0.35,
            4,
            sx,
            surfaceY + plumeHeight * 0.55,
            Math.max(plumeRadiusX, plumeHeight * 0.72)
          );
          plumeGrad.addColorStop(0, 'rgba(244, 63, 94, 0.44)');
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
          const fractureActive = src.active && (st.effectivePrecipMm > 0.2 || st.hadRecentFreezeThaw);
          ctx!.save();
          ctx!.strokeStyle = fractureActive
            ? 'rgba(56, 189, 248, 0.55)'
            : 'rgba(148, 163, 184, 0.22)';
          ctx!.lineWidth = fractureActive ? 2.0 : 1.1;

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

        // Subsurface leachate / pore-water particle associated with a demolition source
        const src = displaySources[d.sourceIdx % Math.max(1, displaySources.length)];
        if (!src || !src.active) return;

        const baseSourceX = sourcePositionsX[d.sourceIdx % sourcePositionsX.length];
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

      displaySources.forEach((src, idx) => {
        const sx = sourcePositionsX[idx];
        const isSelected = st.selectedSourceId === src.id;
        const boxW = 46;
        const boxH = 22;

        // Trench excavation under building (0 to 1.6m)
        ctx!.fillStyle = src.active ? 'rgba(245, 158, 11, 0.22)' : 'rgba(51, 65, 85, 0.25)';
        ctx!.fillRect(sx - boxW * 0.55, surfaceY, boxW * 1.1, depthToY(1.6) - surfaceY);

        // Above-ground demolition structure
        ctx!.fillStyle = src.active ? '#1e293b' : '#0f172a';
        ctx!.strokeStyle = isSelected ? '#22d3ee' : src.active ? '#f43f5e' : '#475569';
        ctx!.lineWidth = isSelected ? 2 : 1.4;
        ctx!.fillRect(sx - boxW / 2, surfaceY - boxH, boxW, boxH);
        ctx!.strokeRect(sx - boxW / 2, surfaceY - boxH, boxW, boxH);

        ctx!.fillStyle = isSelected ? '#22d3ee' : '#f8fafc';
        ctx!.font = 'bold 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx!.textAlign = 'center';
        ctx!.fillText(src.code, sx, surfaceY - boxH + 13);
      });

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
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
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
              <p className="text-[10px] font-mono text-slate-400">
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
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                        title="Forrige dato (−1 dag)"
                      >
                        −1d
                      </button>
                      <label className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-cyan-400/60 hover:border-cyan-300 cursor-pointer">
                        <span className="text-[11px]">📅</span>
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
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                        title="Næste dato (+1 dag)"
                      >
                        +1d
                      </button>
                    </div>
                  ) : (
                    <span>📅 {activeDateIso}</span>
                  )}
                  <span className="text-cyan-400">·</span>
                  <span className="text-amber-300 font-extrabold">🕒 kl. {currentWeather.hourLabel}</span>
                  {onStepHour && (
                    <div className="flex items-center gap-1 ml-0.5 pl-1 border-l border-cyan-500/40">
                      <button
                        type="button"
                        onClick={() => onStepHour(-1)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                        title="Forrige time (-1t)"
                      >
                        −1t
                      </button>
                      <button
                        type="button"
                        onClick={() => onStepHour(1)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                        title="Næste time (+1t)"
                      >
                        +1t
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
            {!effectiveMapOnly ? (
              <button
                type="button"
                onClick={handleToggleMapOnly}
                className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 border border-emerald-200 text-slate-950 text-xs font-mono font-extrabold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="Kun Kort — Vis kun 2D perkolationskortet med filtre"
              >
                <Maximize2 className="w-3.5 h-3.5 text-slate-950" />
                <span>🗺️ Kun Kort</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleMapOnly}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 border-2 border-rose-200 text-white text-xs font-mono font-extrabold flex items-center gap-1.5 transition-colors shadow-xl cursor-pointer"
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
            <canvas ref={canvasRef} className="w-full h-full block" />

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
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                        title="Forrige dato (−1 dag)"
                      >
                        −1d
                      </button>
                      <label className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-cyan-400/60 hover:border-cyan-300 cursor-pointer">
                        <span className="text-[11px]">📅</span>
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
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-[10px] font-bold text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
                        title="Næste dato (+1 dag)"
                      >
                        +1d
                      </button>
                    </div>
                  ) : (
                    <span>📅 {activeDateIso}</span>
                  )}
                  <span className="text-cyan-400">·</span>
                  <span className="text-amber-300 font-extrabold">🕒 kl. {currentWeather.hourLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleMapOnly}
                  className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 border-2 border-rose-200 text-white text-xs font-mono font-extrabold flex items-center gap-1.5 shadow-xl cursor-pointer"
                  title="Afslut 'Kun Kort' visning (Esc)"
                >
                  <X className="w-4 h-4 text-white" />
                  <span>Afslut</span>
                </button>
              </div>
              );
            })()}

            {/* Floating Legend inside 2D Cross-Section */}
            <div className="absolute top-2.5 left-16 z-10 bg-[#0B0E17]/95 border border-slate-800 rounded px-2.5 py-1.5 flex flex-wrap items-center gap-3 text-[10px] font-mono shadow-md">
              <span className="text-slate-400">Nedsivning:</span>
              <span className="text-sky-300">● Regnvand ({effectivePrecipMm.toFixed(1)} mm/t)</span>
              <span className="text-amber-400">● Bly (Pb) &amp; Tungmetal</span>
              <span className="text-purple-400">● PCB-perkolat</span>
              <span className="text-rose-400">● PAH &amp; Asbestslam</span>
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

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Kilde-inspektion:</span>
              {sources.slice(0, 4).map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => onSelectSource(src.id)}
                  className={`px-2 py-0.5 rounded border ${
                    selectedSourceId === src.id
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
              <div className="text-[10px] text-slate-400 uppercase">Infiltration / Darcy-flux</div>
              <div className="text-sm font-bold text-cyan-300 mt-0.5">
                {hydroSim.infiltrationRateMmH} / {hydroSim.darcyFluxMmH} mm/t
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Overflade-afstrømning: {hydroSim.surfaceRunoffMmH} mm/t
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">Makropore-hastighed</div>
              <div className="text-sm font-bold text-amber-300 mt-0.5">
                {hydroSim.macroporeVelocityMetersPerDay} m/døgn
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Sprække-bypass: {(hydroSim.macroporeBypassFraction * 100).toFixed(0)}% (Jordfugt:{' '}
                {hydroSim.soilMoistureM3M3} m³/m³)
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">Nedtrængningsdybde</div>
              <div className="text-sm font-bold text-rose-300 mt-0.5">
                -{hydroSim.plumeMaxDepthMeters} m u.t.
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {hydroSim.reachesPrimaryAquifer
                  ? '✖ Når primært magasin (-16,5 m)'
                  : hydroSim.reachesSecondaryAquifer
                  ? '⚠ Når sekundært magasin (-7,2 m)'
                  : 'I moræneler-zone'}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">Gennembrudstid</div>
              <div className="text-sm font-bold text-indigo-300 mt-0.5">
                {hydroSim.breakthroughHoursSecondary} t (Sek.)
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
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
              <span className="text-[10px] font-mono text-slate-400">MST / GEUS</span>
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

              <div className="flex items-center justify-between py-1">
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
            </div>

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
                  <span className="text-[10px] text-cyan-300 shrink-0 ml-2">
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
