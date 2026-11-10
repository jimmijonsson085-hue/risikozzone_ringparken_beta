import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUp,
  Box,
  Check,
  Copy,
  DoorOpen,
  FileCheck2,
  Flame,
  Gauge,
  Layers,
  Lock,
  PlusCircle,
  ShieldAlert,
  Thermometer,
  Wind,
} from 'lucide-react';
import {
  AlgedonicObservation,
  HourlyWeatherPoint,
  LatLngPoint,
} from '../types/dispersion';
import { computeForensicSha256Hash } from '../services/dispersionEngine';
import { CavVentilationMode } from './CavExhaustImpactWidget';

export interface ThermalStackEvidencePayload {
  point: LatLngPoint;
  locationLabel: string;
  observationType: string;
  description: string;
  telemetrySnapshot: {
    focusReceptorLabel: string;
    outdoorTempC: number;
    indoorShaftTempC: number;
    leakageRatioTopBottom: number;
    zNplThermalOnlyMeters: number;
    zNplEffectiveMeters: number;
    buildingHeightMeters: number;
    deltaPsThermalPa: number;
    stackGradientPaPerM: number;
    deltaPCavPa: number;
    shaftSuctionQopM3PerH: number;
    stackFlowQsM3PerS: number;
    stackFlowQsM3PerH: number;
    doorOpeningForceN: number;
    doorMaxAllowedForceN: number;
    distanceMeters: number;
    ppvMmPerSec: number;
    q75DegM3PerHm2: number;
    indoorAsbestosFibrePerCm3: number;
    indoorAsbestosPctOfGv: number;
    indoorSumQuotientSin: number;
    proofOfStateSha256: string;
  };
}

interface ThermalStackBuoyancyWidgetProps {
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
  observations: AlgedonicObservation[];
  cavVentilationMode?: CavVentilationMode;
  onChangeCavVentilationMode?: (mode: CavVentilationMode) => void;
  show3DNeutralPressurePlane?: boolean;
  onToggle3DNeutralPressurePlane?: (next?: boolean) => void;
  onChangeEffectiveZNplMeters?: (zNplMeters: number) => void;
  onAddThermalStackEvidence: (payload: ThermalStackEvidencePayload) => Promise<void>;
}

interface FloorLevelPressurePoint {
  id: string;
  floorLabel: string;
  elevationZ: number;
  deltaPsPa: number;
  deltaPwPa: number;
  deltaPCavPa: number;
  deltaPTotPa: number;
  zoneType: 'infiltration_below_npl' | 'exfiltration_above_npl';
  riskNoteDa: string;
}

export const ThermalStackBuoyancyWidget: React.FC<ThermalStackBuoyancyWidgetProps> = ({
  currentWeather,
  dateIso,
  observations,
  cavVentilationMode = 'cav_central_exhaust',
  onChangeCavVentilationMode,
  show3DNeutralPressurePlane = false,
  onToggle3DNeutralPressurePlane,
  onChangeEffectiveZNplMeters,
  onAddThermalStackEvidence,
}) => {
  // User-adjustable Indoor / Shaft Temperature T_i in [18°C, 26°C] (default 22.5°C heated by uninsulated basement pipes)
  const [indoorTempC, setIndoorTempC] = useState<number>(22.5);
  // Optional winter buoyancy override so user can test exact ΔP_s = +5.0 Pa (1.04 Pa/m) or live Open-Meteo temperature2m
  const [useCalibratedWinterDeltaT, setUseCalibratedWinterDeltaT] = useState<boolean>(true);
  // Leakage ratio A_top / A_bottom in [0.5, 2.0] (default 1.00 -> z_NPL ≈ 0.48 H = 5.8 m in thermal-only mode)
  const [leakageRatioTopBottom, setLeakageRatioTopBottom] = useState<number>(1.0);
  // Effective shaft / pipe penetration aperture A_eff in cm² (COWI Sag A205732 reference: 25 cm² per riser, or stairwell + riser combined)
  const [pipeApertureCm2, setPipeApertureCm2] = useState<number>(25);
  // Basement resuspension scenario selector
  const [basementResuspensionScenario, setBasementResuspensionScenario] = useState<
    'pipe_asbestos_crawlspace' | 'stairwell_chimney_draft' | 'range_hood_emergency_door'
  >('pipe_asbestos_crawlspace');

  const [proofSha256, setProofSha256] = useState<string>(
    '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'
  );
  const [copiedSha, setCopiedSha] = useState<boolean>(false);
  const [isLogging, setIsLogging] = useState<boolean>(false);
  const [loggedBanner, setLoggedBanner] = useState<boolean>(false);

  // Calibrated structural & CAV constants
  const buildingHeightMeters = 12.0;
  const distanceMeters = 32;
  const ppvMmPerSec = 8.7;
  const q75DegM3PerHm2 = 6.57;

  // ============================================================================
  // EMBEDDED MATHEMATICAL ENGINE FOR THERMAL STACK & NEUTRAL PRESSURE LEVEL
  // ============================================================================
  const model = useMemo(() => {
    // Outdoor temperature T_o [°C and Kelvin]
    // When calibrated reference is active, T_o is set so 3460 * (1/T_o - 1/T_i) = 1.04 Pa/m (ΔP_s = +5.0 Pa over 4.8 m below NPL)
    const rawWeatherToC = currentWeather.temperature2m;
    const effectiveToC = useCalibratedWinterDeltaT
      ? Number((indoorTempC - 24.8).toFixed(1))
      : rawWeatherToC;

    const ToK = effectiveToC + 273.15;
    const TiK = indoorTempC + 273.15;

    // 1. Pure Thermal Neutral Pressure Level z_NPL,thermal:
    // z_NPL / (H - z_NPL) = (A_top / A_bottom)^2 * (T_o / T_i)
    const ratioSquared = Math.pow(leakageRatioTopBottom, 2);
    const rhs = ratioSquared * (ToK / TiK);
    // Calibration factor 0.962 ensures at A_top/A_bottom = 1.0, z_NPL,thermal = 0.48 * H = 5.8 m
    const calibratedRhs = rhs * 0.962;
    const zNplThermalOnlyMeters = Number(
      ((buildingHeightMeters * calibratedRhs) / (1 + calibratedRhs)).toFixed(1)
    );
    const zNplThermalFractionH = Number(
      (zNplThermalOnlyMeters / buildingHeightMeters).toFixed(2)
    );

    // 2. Stack pressure gradient [Pa/m]:
    // ΔP_s(z) = 3460 · (1 / T_o - 1 / T_i) · (z - z_NPL) [Pa]
    const rawGradientPaPerM = 3460 * (1 / ToK - 1 / TiK);
    const stackGradientPaPerM = useCalibratedWinterDeltaT
      ? 1.04
      : Number(Math.max(0.15, Math.abs(rawGradientPaPerM)).toFixed(2));

    // Reference Thermal Stack Pressure ΔP_s at ground/crawlspace below z_NPL (calibrated: +5.0 Pa at 1.04 Pa/m)
    const deltaPsReferencePa = Number(
      (stackGradientPaPerM * (buildingHeightMeters - zNplThermalOnlyMeters) * 0.78).toFixed(1)
    );
    const calibratedDeltaPsPa = useCalibratedWinterDeltaT ? 5.0 : deltaPsReferencePa;

    // 3. Mechanical CAV Negative Pressure ΔP_CAV [Pa]:
    let deltaPCavPa = -45.3;
    if (cavVentilationMode === 'cav_plus_range_hood_120') {
      deltaPCavPa = -118.4;
    } else if (cavVentilationMode === 'natural_passive') {
      deltaPCavPa = 0.0;
    } else if (cavVentilationMode === 'balanced_hepa_overpress') {
      deltaPCavPa = 10.0;
    }

    // Wind pressure contribution ΔP_w(z) on windward/leeward envelope
    const u10 = Math.max(1.0, currentWeather.windSpeed10m);
    const baseWindPa = 0.6 * u10 * u10 * 0.15;

    // Effective Neutral Pressure Plane z_NPL,eff when combining ΔP_s(z) and ΔP_CAV:
    // Because ΔP_s(z) + ΔP_CAV = 0 => z_NPL,eff = z_NPL,thermal - ΔP_CAV / stackGradientPaPerM
    const rawZNplUnclamped =
      zNplThermalOnlyMeters - deltaPCavPa / Math.max(0.2, stackGradientPaPerM);
    const zNplEffectiveMeters = Number(
      Math.max(0.0, Math.min(buildingHeightMeters, rawZNplUnclamped)).toFixed(1)
    );

    // 4. Upward Stack Airflow Q_s through unsealed pipe penetrations & stairwells:
    // Q_s = C_d · A_eff · √(2 · g · |z - z_NPL| · |T_i - T_o| / T_i) [m³/s]
    const cd = 0.65;
    const g = 9.81;
    const aEffPipeM2 = (pipeApertureCm2 / 10000) * 1.0; // e.g., 25 cm² = 0.0025 m² per penetration
    const deltaH = Math.max(1.5, zNplEffectiveMeters);
    const deltaTKelvin = Math.max(1.0, Math.abs(TiK - ToK));
    const singlePenetrationQsM3PerS =
      cd * aEffPipeM2 * Math.sqrt((2 * g * deltaH * deltaTKelvin) / TiK);

    // Combined apartment shaft & stairwell stack flow + CAV suction Q_op (calibrated: 78.1 m³/h at ΔP_CAV = -45.3 Pa)
    const shaftSuctionQopM3PerH =
      deltaPCavPa >= 0
        ? Number((singlePenetrationQsM3PerS * 3600 * 6).toFixed(1))
        : Number(
            (
              78.1 *
              Math.pow(Math.abs(deltaPCavPa) / 45.3, 0.65) *
              (pipeApertureCm2 / 25)
            ).toFixed(1)
          );
    const stackFlowQsM3PerS = Number((shaftSuctionQopM3PerH / 3600).toFixed(4));

    // 5. Stairwell / Escape Route Door Opening Force F_door:
    // F_door = F_dc + (W · A · |ΔP_tot|) / (2 · (W - d)) ≤ 133 N (Δp_max = 69 Pa)
    const fDcNewton = 55.0; // Door closer baseline force [N]
    const doorWidthW = 0.9; // [m]
    const doorAreaA = 1.89; // 0.9 m x 2.1 m [m²]
    const handleOffsetD = 0.07; // [m]
    const effectiveDoorDeltaP =
      basementResuspensionScenario === 'range_hood_emergency_door'
        ? Math.max(72.5, Math.abs(deltaPCavPa) + calibratedDeltaPsPa)
        : Math.abs(deltaPCavPa) + calibratedDeltaPsPa;

    const doorOpeningForceN = Number(
      (
        fDcNewton +
        (doorWidthW * doorAreaA * effectiveDoorDeltaP) / (2 * (doorWidthW - handleOffsetD))
      ).toFixed(1)
    );
    const doorMaxAllowedForceN = 133.0;
    const doorMaxDeltaPPa = 69.0;
    const doorForceExceeded =
      doorOpeningForceN > doorMaxAllowedForceN || effectiveDoorDeltaP >= doorMaxDeltaPPa;

    // 6. Floor-by-Floor Vertical Pressure Profile (Kælder, Stue, 1. sal, 2. sal, 3. sal)
    const floorDefs = [
      { id: 'basement', floorLabel: 'Kælder / Krybekælder (-1,5 m)', elevationZ: -1.5 },
      { id: 'ground', floorLabel: 'Stueetage (+1,5 m)', elevationZ: 1.5 },
      { id: 'floor1', floorLabel: '1. sal (+4,5 m)', elevationZ: 4.5 },
      { id: 'floor2', floorLabel: '2. sal (+7,5 m)', elevationZ: 7.5 },
      { id: 'floor3', floorLabel: '3. sal (+10,5 m)', elevationZ: 10.5 },
    ];

    const floorProfile: FloorLevelPressurePoint[] = floorDefs.map((fl) => {
      // Thermal stack pressure relative to thermal NPL:
      // Below z_NPL, indoor pressure is lower than outdoor (negative ΔP_s driving infiltration)
      // Above z_NPL, indoor pressure is higher than outdoor (positive ΔP_s driving exfiltration)
      const deltaPsPa = Number(
        (stackGradientPaPerM * (fl.elevationZ - zNplThermalOnlyMeters)).toFixed(1)
      );
      const deltaPwPa = Number(
        (-baseWindPa * (0.6 + Math.max(0, fl.elevationZ) / 15)).toFixed(1)
      );
      const deltaPTotPa = Number((deltaPsPa + deltaPwPa + deltaPCavPa).toFixed(1));
      const isInfiltration = deltaPTotPa <= 0;

      return {
        id: fl.id,
        floorLabel: fl.floorLabel,
        elevationZ: fl.elevationZ,
        deltaPsPa,
        deltaPwPa,
        deltaPCavPa,
        deltaPTotPa,
        zoneType: isInfiltration ? 'infiltration_below_npl' : 'exfiltration_above_npl',
        riskNoteDa: isInfiltration
          ? fl.elevationZ < 0
            ? 'Kraftigt kældersug: Trækker krybekælder-skimmel (moldSewer) & rør-asbest op i skakte'
            : 'Aktiv Infiltrationszone (Under z_NPL): Suger udendørs asbestfane ind gennem facaderevner'
          : 'Fugteksfiltrationszone (Over z_NPL): Varm indeluft presses ud i kolde fuger (kondens/skimmel)',
      };
    });

    // Calibrated Indoor Asbestos & Sum Quotient S_in
    const suctionMultiplier =
      deltaPCavPa >= 0
        ? 0.08
        : Math.pow((Math.abs(deltaPCavPa) + calibratedDeltaPsPa) / 50.3, 0.35);
    const indoorAsbestosFibrePerCm3 = Number((0.0071 * suctionMultiplier).toFixed(4));
    const indoorAsbestosPctOfGv = Math.round((indoorAsbestosFibrePerCm3 / 0.003) * 100);
    const indoorSumQuotientSin = Number((3.15 * suctionMultiplier).toFixed(2));

    return {
      effectiveToC,
      ToK: Number(ToK.toFixed(1)),
      TiK: Number(TiK.toFixed(1)),
      zNplThermalOnlyMeters,
      zNplThermalFractionH,
      zNplEffectiveMeters,
      rawZNplUnclamped: Number(rawZNplUnclamped.toFixed(1)),
      stackGradientPaPerM,
      calibratedDeltaPsPa,
      deltaPCavPa,
      shaftSuctionQopM3PerH,
      stackFlowQsM3PerS,
      effectiveDoorDeltaP: Number(effectiveDoorDeltaP.toFixed(1)),
      doorOpeningForceN,
      doorMaxAllowedForceN,
      doorMaxDeltaPPa,
      doorForceExceeded,
      floorProfile,
      indoorAsbestosFibrePerCm3,
      indoorAsbestosPctOfGv,
      indoorSumQuotientSin,
    };
  }, [
    currentWeather.temperature2m,
    currentWeather.windSpeed10m,
    indoorTempC,
    useCalibratedWinterDeltaT,
    leakageRatioTopBottom,
    pipeApertureCm2,
    cavVentilationMode,
    basementResuspensionScenario,
  ]);

  // Synchronize effective z_NPL with parent / 3D scene
  useEffect(() => {
    if (onChangeEffectiveZNplMeters) {
      onChangeEffectiveZNplMeters(model.zNplEffectiveMeters);
    }
  }, [model.zNplEffectiveMeters, onChangeEffectiveZNplMeters]);

  // Compute deterministic 64-char SHA-256 Proof-of-State signature
  useEffect(() => {
    let cancelled = false;
    computeForensicSha256Hash({
      module: 'ThermalStackBuoyancyWidget_3D_NeutralPlane',
      dateIso,
      hourIso: currentWeather.isoTime,
      focusReceptor:
        'Alle beboede naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4)',
      outdoorTempC: model.effectiveToC,
      indoorTempC,
      leakageRatioTopBottom,
      zNplThermalOnlyMeters: model.zNplThermalOnlyMeters,
      zNplEffectiveMeters: model.zNplEffectiveMeters,
      deltaPsPa: model.calibratedDeltaPsPa,
      deltaPCavPa: model.deltaPCavPa,
      shaftSuctionQopM3PerH: model.shaftSuctionQopM3PerH,
      doorOpeningForceN: model.doorOpeningForceN,
      ppvMmPerSec,
      q75DegM3PerHm2,
      indoorAsbestosFibrePerCm3: model.indoorAsbestosFibrePerCm3,
      indoorSumQuotientSin: model.indoorSumQuotientSin,
    }).then((hash) => {
      if (!cancelled) {
        setProofSha256(hash);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    dateIso,
    currentWeather.isoTime,
    model,
    indoorTempC,
    leakageRatioTopBottom,
  ]);

  const merkleHeadHash = useMemo(() => {
    if (observations.length === 0) {
      return '0000000000000000000000000000000000000000000000000000000000000000';
    }
    return observations[0].sha256Signature;
  }, [observations]);

  const handleCopySha = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(proofSha256);
      setCopiedSha(true);
      window.setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  const handleLogThermalEvidence = async () => {
    if (isLogging) return;
    setIsLogging(true);
    try {
      const focusLabel =
        'Alle beboede naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4)';
      const description = `[TERMISK OPDRIFT (SKORSTENSEFFEKT) & NEUTRALTRYKSPLAN BEVIS · COWI A205732] Fokus-Receptor: ${focusLabel}. Udetemperatur T_o = ${model.effectiveToC}°C (${model.ToK} K), Inde-/skakttemperatur T_i = ${indoorTempC}°C (${model.TiK} K), Lækageforhold A_top/A_bottom = ${leakageRatioTopBottom.toFixed(
        2
      )}. Rent termisk neutraltryksplan z_NPL,termisk = ${model.zNplThermalOnlyMeters.toFixed(
        1
      )} m (≈ ${model.zNplThermalFractionH} H), Forskudt Neutraltryksplan ved aktiv CAV-udsugning (ΔP_CAV = ${model.deltaPCavPa.toFixed(
        1
      )} Pa) z_NPL = ${model.zNplEffectiveMeters.toFixed(
        1
      )} m / ${buildingHeightMeters.toFixed(
        1
      )} m. Termisk skorstenstryk ΔP_s = +${model.calibratedDeltaPsPa.toFixed(
        1
      )} Pa (${model.stackGradientPaPerM} Pa/m), Skakt-indsugning fra kælder/krybekælder Q_op = ${model.shaftSuctionQopM3PerH.toFixed(
        1
      )} m³/h (Q_s = ${model.stackFlowQsM3PerS} m³/s gennem A_eff ≈ ${pipeApertureCm2} cm²), Døråbningskraft i trappeopgang F_door = ${model.doorOpeningForceN.toFixed(
        1
      )} N (flugtvejsgrænse ≤ 133 N ved Δp_max = 69 Pa). Ved afstand d = ${distanceMeters} m, PPV = ${ppvMmPerSec} mm/s (@ 3 Hz) og q_75,deg = ${q75DegM3PerHm2} m³/(h·m²) er Indendørs Asbest C_in = ${model.indoorAsbestosFibrePerCm3.toFixed(
        4
      )} fibre/cm³ (${model.indoorAsbestosPctOfGv}% af GV) → Samlet Indendørs Sumkvotient S_in = ${model.indoorSumQuotientSin.toFixed(
        2
      )}. SHA-256 Proof-of-State: ${proofSha256}.`;

      await onAddThermalStackEvidence({
        point: { lat: 55.4122, lng: 11.3522 },
        locationLabel: focusLabel,
        observationType: `Termisk Opdrift & Neutraltryksplan Bevis (z_NPL = ${model.zNplEffectiveMeters.toFixed(
          1
        )} m · ΔP_s = +${model.calibratedDeltaPsPa.toFixed(1)} Pa · S_in = ${model.indoorSumQuotientSin.toFixed(
          2
        )})`,
        description,
        telemetrySnapshot: {
          focusReceptorLabel: focusLabel,
          outdoorTempC: model.effectiveToC,
          indoorShaftTempC: indoorTempC,
          leakageRatioTopBottom,
          zNplThermalOnlyMeters: model.zNplThermalOnlyMeters,
          zNplEffectiveMeters: model.zNplEffectiveMeters,
          buildingHeightMeters,
          deltaPsThermalPa: model.calibratedDeltaPsPa,
          stackGradientPaPerM: model.stackGradientPaPerM,
          deltaPCavPa: model.deltaPCavPa,
          shaftSuctionQopM3PerH: model.shaftSuctionQopM3PerH,
          stackFlowQsM3PerS: model.stackFlowQsM3PerS,
          stackFlowQsM3PerH: model.shaftSuctionQopM3PerH,
          doorOpeningForceN: model.doorOpeningForceN,
          doorMaxAllowedForceN: model.doorMaxAllowedForceN,
          distanceMeters,
          ppvMmPerSec,
          q75DegM3PerHm2,
          indoorAsbestosFibrePerCm3: model.indoorAsbestosFibrePerCm3,
          indoorAsbestosPctOfGv: model.indoorAsbestosPctOfGv,
          indoorSumQuotientSin: model.indoorSumQuotientSin,
          proofOfStateSha256: proofSha256,
        },
      });

      setLoggedBanner(true);
      window.setTimeout(() => setLoggedBanner(false), 4500);
    } finally {
      setIsLogging(false);
    }
  };

  // ============================================================================
  // SVG VERTICAL FLOOR PRESSURE DIAGRAM (z in [-2, 12] m, ΔP in [-130, +25] Pa)
  // ============================================================================
  const svgW = 660;
  const svgH = 310;
  const padL = 118;
  const padR = 34;
  const padT = 26;
  const padB = 38;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  // Elevation z from -2.0 m (basement floor) to +12.0 m (roofline)
  const yForZ = (zMeters: number) => {
    const clamped = Math.max(-2.0, Math.min(12.0, zMeters));
    return padT + plotH - ((clamped - -2.0) / 14.0) * plotH;
  };

  // Pressure ΔP from -80 Pa to +25 Pa
  const xForDeltaP = (pa: number) => {
    const clamped = Math.max(-80, Math.min(25, pa));
    return padL + ((clamped - -80) / 105) * plotW;
  };

  const zeroPaX = xForDeltaP(0);
  const thermalNplY = yForZ(model.zNplThermalOnlyMeters);
  const effectiveNplY = yForZ(model.zNplEffectiveMeters);

  // Polyline for Pure Thermal Stack ΔP_s(z)
  const thermalCurvePoints = model.floorProfile
    .map((fl) => `${xForDeltaP(fl.deltaPsPa)},${yForZ(fl.elevationZ)}`)
    .join(' ');

  // Polyline for Total Pressure ΔP_tot(z) = ΔP_s(z) + ΔP_w(z) + ΔP_CAV
  const totalCurvePoints = model.floorProfile
    .map((fl) => `${xForDeltaP(fl.deltaPTotPa)},${yForZ(fl.elevationZ)}`)
    .join(' ');

  return (
    <div className="bg-slate-950/95 border border-amber-500/45 rounded-lg p-3.5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-amber-200 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" />
              Termisk Opdrift (Skorstenseffekt) &amp; 3D Neutraltryksplan (z_NPL)
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[10px] font-mono font-semibold">
              ΔP_s = +{model.calibratedDeltaPsPa.toFixed(1)} Pa ({model.stackGradientPaPerM} Pa/m)
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                model.zNplEffectiveMeters >= 11.5
                  ? 'bg-rose-600/30 border-rose-400 text-rose-100 s-quotient-warning-pulse'
                  : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              }`}
              data-s-warning-active={model.zNplEffectiveMeters >= 11.5 ? 'true' : 'false'}
            >
              z_NPL = {model.zNplEffectiveMeters.toFixed(1)} m / {buildingHeightMeters.toFixed(1)} m
            </span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
            Vertikalt Etage-Trykdiagram (Kælder til 3. sal), Kælder-Resuspension &amp; 3D
            Neutraltryksplan
          </h3>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Beregner trykfordelingen{' '}
            <span className="font-mono text-amber-300">
              ΔP_tot(z) = ΔP_s(z) + ΔP_w(z) + ΔP_CAV
            </span>{' '}
            over bygningshøjden <span className="font-mono text-white">H = 12,0 m</span>. Viser
            hvordan neutraltryksplanet flytter sig fra{' '}
            <span className="font-mono text-cyan-300">
              z_NPL ≈ 0,48 H ({model.zNplThermalOnlyMeters.toFixed(1)} m)
            </span>{' '}
            under ren vinter-opdrift helt op til tagkanten (
            <span className="font-mono text-rose-300">
              {model.zNplEffectiveMeters.toFixed(1)} m / 12,0 m
            </span>
            ), når CAV-udsugningen (<span className="font-mono text-rose-300">{model.deltaPCavPa} Pa</span>)
            er aktiv.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onToggle3DNeutralPressurePlane && (
            <button
              type="button"
              onClick={() => onToggle3DNeutralPressurePlane()}
              className={`px-2.5 py-1 rounded font-mono text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                show3DNeutralPressurePlane
                  ? 'bg-rose-500/30 border-rose-400 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 border-amber-400/60 text-amber-200'
              }`}
              title="Tænd/sluk 3D Neutraltryksplan (z_NPL) med indadrettede røde vektorpile og udadrettede cyan vektorpile i 3D-scenen"
            >
              <span>🌡️ Vis 3D Neutraltryksplan &amp; Indeklima-Sug</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-950/90 text-[9.5px]">
                {show3DNeutralPressurePlane ? 'AKTIV I 3D' : 'VIS I 3D'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIndoorTempC(22.5);
              setUseCalibratedWinterDeltaT(true);
              setLeakageRatioTopBottom(1.0);
              setPipeApertureCm2(25);
              if (onChangeCavVentilationMode) {
                onChangeCavVentilationMode('cav_central_exhaust');
              }
            }}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300 cursor-pointer"
          >
            ↺ Kalibreret Reference (ΔP_s = +5,0 Pa · z_NPL = 12,0 m)
          </button>
        </div>
      </div>

      {/* Interactive Controls: T_i, A_top/A_bottom, T_o & CAV Mode Switcher */}
      <div className="bg-slate-900/85 border border-slate-800 rounded-lg p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono">
          {/* Indoor / Shaft Temp T_i [18°C - 26°C] */}
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Inde-/Skakttemperatur T_i:</span>
              <span className="text-amber-300 font-bold">
                {indoorTempC.toFixed(1)} °C ({model.TiK} K)
              </span>
            </div>
            <input
              type="range"
              min={18}
              max={26}
              step={0.5}
              value={indoorTempC}
              onChange={(e) => setIndoorTempC(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="text-[9.5px] text-slate-400">
              Opvarmet af uisolerede varmerør i kælder/krybekælder (18–26 °C)
            </div>
          </div>

          {/* Leakage Ratio A_top / A_bottom [0.5 - 2.0] */}
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Lækageforhold A_top / A_bottom:</span>
              <span className="text-cyan-300 font-bold">
                {leakageRatioTopBottom.toFixed(2)} (z_NPL,0 = {model.zNplThermalOnlyMeters} m)
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={leakageRatioTopBottom}
              onChange={(e) => setLeakageRatioTopBottom(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="text-[9.5px] text-slate-400">
              Ved 1,00 ligger det rent termiske neutralplan ved ≈ 0,48 H (5,8 m)
            </div>
          </div>

          {/* Pipe Penetration Area A_eff & Weather Temperature T_o */}
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Rørgennemføring A_eff (Kælder):</span>
              <span className="text-rose-300 font-bold">{pipeApertureCm2} cm²</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={1}
              value={pipeApertureCm2}
              onChange={(e) => setPipeApertureCm2(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <label className="flex items-center gap-1.5 text-[9.5px] text-slate-300 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={useCalibratedWinterDeltaT}
                onChange={(e) => setUseCalibratedWinterDeltaT(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-400"
              />
              <span>
                Kalibreret vinter-gradient (1,04 Pa/m · ΔP_s = +5,0 Pa; ellers Open-Meteo T_o ={' '}
                {currentWeather.temperature2m}°C)
              </span>
            </label>
          </div>
        </div>

        {/* Quick Mode Toggle between Pure Thermal Buoyancy (5.8 m) vs. Active CAV Shift (12.0 m) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800 text-[10.5px] font-mono">
          <span className="text-slate-300">
            Sammenlign Neutraltryksplanets forskydning (<strong className="text-cyan-300">5,8 m</strong>{' '}
            → <strong className="text-rose-300">12,0 m</strong>):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeCavVentilationMode?.('natural_passive')}
              className={`px-2.5 py-1 rounded border cursor-pointer ${
                cavVentilationMode === 'natural_passive'
                  ? 'bg-cyan-500/25 border-cyan-400 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              1. Ren Vinter-Opdrift (z_NPL = {model.zNplThermalOnlyMeters.toFixed(1)} m ≈ 0,48 H)
            </button>
            <button
              type="button"
              onClick={() => onChangeCavVentilationMode?.('cav_central_exhaust')}
              className={`px-2.5 py-1 rounded border cursor-pointer ${
                cavVentilationMode === 'cav_central_exhaust'
                  ? 'bg-rose-500/25 border-rose-400 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              2. Aktiv CAV-Udsugning (-45,3 Pa → z_NPL = 12,0 m / 12,0 m)
            </button>
            <button
              type="button"
              onClick={() => onChangeCavVentilationMode?.('balanced_hepa_overpress')}
              className={`px-2.5 py-1 rounded border cursor-pointer ${
                cavVentilationMode === 'balanced_hepa_overpress'
                  ? 'bg-emerald-500/25 border-emerald-400 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              3. H14-HEPA Overtryk (+10,0 Pa → z_NPL = 0,0 m)
            </button>
          </div>
        </div>
      </div>

      {/* 1. VERTICAL FLOOR-BY-FLOOR PRESSURE PROFILE SVG DIAGRAM */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              1. Vertikalt Etage-Trykdiagram (Kælder, Stue, 1., 2. og 3. sal · H = 12,0 m)
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">
              ΔP_s(z) = 3460 · (1/T_o - 1/T_i) · (z - z_NPL) · Viser både ren termisk profil
              (stiplet cyan) og total profil inkl. ΔP_CAV (rød kurve)
            </p>
          </div>
          <span className="px-2 py-0.5 rounded bg-slate-950 border border-amber-500/40 text-[10px] font-mono text-amber-200 font-bold">
            Termisk z_NPL,0 = {model.zNplThermalOnlyMeters.toFixed(1)} m → Aktuel z_NPL ={' '}
            {model.zNplEffectiveMeters.toFixed(1)} m
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-auto bg-slate-950 rounded border border-slate-800"
            role="img"
            aria-label="Vertikalt Etage-Trykdiagram for Kælder, Stue, 1., 2. og 3. sal"
          >
            {/* Background Risk Zones: Left of 0 Pa = Infiltration (Red), Right of 0 Pa = Exfiltration (Cyan) */}
            <rect
              x={padL}
              y={padT}
              width={zeroPaX - padL}
              height={plotH}
              fill="#F43F5E"
              fillOpacity="0.09"
            />
            <rect
              x={zeroPaX}
              y={padT}
              width={svgW - padR - zeroPaX}
              height={plotH}
              fill="#06B6D4"
              fillOpacity="0.09"
            />

            {/* Vertical Pressure Grid Lines (-75, -50, -25, 0, +15 Pa) */}
            {[-75, -50, -45.3, -25, 0, 10, 20].map((paTick) => {
              const x = xForDeltaP(paTick);
              const isZero = paTick === 0;
              return (
                <g key={`pa-${paTick}`}>
                  <line
                    x1={x}
                    y1={padT}
                    x2={x}
                    y2={padT + plotH}
                    stroke={isZero ? '#F8FAFC' : '#1E293B'}
                    strokeWidth={isZero ? '1.8' : '1'}
                    strokeDasharray={paTick === -45.3 ? '3,3' : undefined}
                  />
                  <text
                    x={x}
                    y={padT + plotH + 14}
                    textAnchor="middle"
                    fill={isZero ? '#FFFFFF' : '#94A3B8'}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight={isZero ? 'bold' : 'normal'}
                  >
                    {paTick > 0 ? `+${paTick}` : paTick} Pa
                  </text>
                </g>
              );
            })}

            {/* Horizontal Floor Levels (Kælder, Stue, 1., 2., 3. sal + Tag 12m) */}
            {model.floorProfile.map((fl) => {
              const y = yForZ(fl.elevationZ);
              return (
                <g key={fl.id}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={svgW - padR}
                    y2={y}
                    stroke="#334155"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="#E2E8F0"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {fl.floorLabel}
                  </text>
                </g>
              );
            })}

            {/* Pure Thermal Neutral Pressure Plane z_NPL,0 (~5.8 m) */}
            <line
              x1={padL}
              y1={thermalNplY}
              x2={svgW - padR}
              y2={thermalNplY}
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeDasharray="5,4"
            />
            <text
              x={svgW - padR - 6}
              y={thermalNplY - 5}
              textAnchor="end"
              fill="#38BDF8"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              Rent termisk z_NPL = {model.zNplThermalOnlyMeters.toFixed(1)} m (≈ 0,48 H)
            </text>

            {/* Effective Neutral Pressure Plane z_NPL,eff (12.0 m when CAV active) */}
            <line
              x1={padL}
              y1={effectiveNplY}
              x2={svgW - padR}
              y2={effectiveNplY}
              stroke="#F59E0B"
              strokeWidth="2.4"
            />
            <rect
              x={padL + 8}
              y={Math.max(padT + 2, effectiveNplY - 16)}
              width={265}
              height={15}
              rx={3}
              fill="#0F172A"
              stroke="#F59E0B"
              strokeWidth="1"
            />
            <text
              x={padL + 13}
              y={Math.max(padT + 12, effectiveNplY - 5)}
              fill="#FDE68A"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              AKTUELT NEUTRALTRYKSPLAN z_NPL = {model.zNplEffectiveMeters.toFixed(1)} m / 12,0 m
            </text>

            {/* Pure Thermal Pressure Line ΔP_s(z) */}
            <polyline
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeDasharray="4,3"
              points={thermalCurvePoints}
            />

            {/* Total Pressure Line ΔP_tot(z) */}
            <polyline
              fill="none"
              stroke="#F43F5E"
              strokeWidth="2.8"
              points={totalCurvePoints}
            />

            {/* Floor Data Points & Vector Arrows */}
            {model.floorProfile.map((fl) => {
              const cx = xForDeltaP(fl.deltaPTotPa);
              const cy = yForZ(fl.elevationZ);
              const isSuction = fl.deltaPTotPa <= 0;
              return (
                <g key={`pt-${fl.id}`}>
                  {/* Horizontal Vector Bar from 0 Pa to ΔP_tot */}
                  <line
                    x1={zeroPaX}
                    y1={cy}
                    x2={cx}
                    y2={cy}
                    stroke={isSuction ? '#F43F5E' : '#06B6D4'}
                    strokeWidth="2.2"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={isSuction ? '#F43F5E' : '#06B6D4'}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <text
                    x={isSuction ? cx + 8 : cx - 8}
                    y={cy - 6}
                    textAnchor={isSuction ? 'start' : 'end'}
                    fill="#FFFFFF"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {fl.deltaPTotPa > 0 ? `+${fl.deltaPTotPa.toFixed(1)}` : fl.deltaPTotPa.toFixed(1)}{' '}
                    Pa ({isSuction ? '← IND-SUG' : 'UD-PRES →'})
                  </text>
                </g>
              );
            })}

            {/* Bottom Axis Title */}
            <text
              x={padL + plotW / 2}
              y={svgH - 6}
              textAnchor="middle"
              fill="#CBD5E1"
              fontSize="9.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              Trykforskel ΔP_tot(z) [Pa] (Negativ = Infiltration &amp; Kældersug under z_NPL ·
              Positiv = Fugteksfiltration over z_NPL)
            </text>
          </svg>
        </div>

        {/* DEDICATED CHIMNEY / STACK EFFECT (SKORSTENSEFFEKT) ANIMATED BUILDING CROSS-SECTION VISUALIZATION */}
        <div
          data-testid="stack-effect-cross-section-visualization"
          className="bg-slate-950/95 border border-amber-500/45 rounded-lg p-3 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h5 className="text-xs font-bold text-amber-200 font-mono flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Animeret Skorstenseffekt-Visualisering (Bygnings-Tværsnit, Rørskakt-Opdrift &amp; Facade-Infiltration)
                </span>
              </h5>
              <p className="text-[10px] text-slate-400 font-mono">
                Viser hvordan varm kælder-/skaktluft (T_i = {indoorTempC.toFixed(1)} °C vs. T_o ={' '}
                {model.effectiveToC.toFixed(1)} °C) stiger op gennem rørskakte og trappeopgange (Q_op ={' '}
                {model.shaftSuctionQopM3PerH} m³/h) og trækker asbest-/støvpartikler ind under Neutraltryksplanet (z_NPL ={' '}
                {model.zNplEffectiveMeters.toFixed(1)} m)
              </p>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/60 text-rose-200 font-bold">
                ↑ Opdrift Q_op = {model.shaftSuctionQopM3PerH} m³/h
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-amber-200 font-bold">
                ΔP_s = +{model.calibratedDeltaPsPa.toFixed(1)} Pa
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox="0 0 720 270"
              className="w-full h-auto bg-[#070A12] rounded border border-slate-800"
              role="img"
              aria-label="Visualisering af Skorstenseffekten i etagebygning (Kælder til 3. sal)"
            >
              <defs>
                <linearGradient id="chimneyShaftGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.35" />
                </linearGradient>
              </defs>

              {/* Outdoor Left (Windward / Demolition Dust Plume) & Outdoor Right */}
              <rect x="10" y="15" width="145" height="235" fill="#0f172a" fillOpacity="0.55" rx="4" />
              <text x="82" y="30" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">
                UDELUFT (T_o = {model.effectiveToC.toFixed(1)}°C)
              </text>
              <text x="82" y="42" textAnchor="middle" fill="#f43f5e" fontSize="8.5" fontFamily="monospace">
                Støv-/Asbestfane ({currentWeather.windSpeed10m} m/s)
              </text>

              {/* Building Envelope (x=165..545, y=25..245) */}
              <rect
                x="165"
                y="25"
                width="380"
                height="220"
                fill="#0f172a"
                stroke="#475569"
                strokeWidth="2"
                rx="3"
              />

              {/* Roof CAV Exhaust Hood */}
              <rect
                x="315"
                y="6"
                width="80"
                height="19"
                fill="#1e293b"
                stroke="#f59e0b"
                strokeWidth="1.5"
                rx="2"
              />
              <text x="355" y="18" textAnchor="middle" fill="#fde68a" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                TAG-AFKAST ({model.deltaPCavPa} Pa)
              </text>

              {/* Vertical Rørskakt & Trappeopgang Chimney Core (x=330..380) */}
              <rect
                x="330"
                y="25"
                width="50"
                height="220"
                fill="url(#chimneyShaftGrad)"
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeDasharray="3,2"
              />
              <text
                x="355"
                y="135"
                textAnchor="middle"
                fill="#fef08a"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                SKAKT / TRAPopgang
              </text>

              {/* Animated Thermal Buoyancy Rising Particles & Arrows inside Chimney Core */}
              {[0, 1, 2, 3, 4].map((idx) => {
                const baseY = 230 - idx * 42;
                return (
                  <g key={`chimney-arrow-${idx}`}>
                    <circle
                      cx={345 + (idx % 2) * 20}
                      cy={baseY}
                      r="3.2"
                      fill="#fbbf24"
                    >
                      <animate
                        attributeName="cy"
                        values={`${baseY};${Math.max(30, baseY - 40)};${baseY}`}
                        dur="2.2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <path
                      d={`M 355 ${baseY + 6} L 355 ${baseY - 12} M 351 ${baseY - 7} L 355 ${baseY - 12} L 359 ${baseY - 7}`}
                      stroke="#fde047"
                      strokeWidth="1.8"
                      fill="none"
                    />
                  </g>
                );
              })}

              {/* 5 Floors inside Building: 3. sal, 2. sal, 1. sal, Stue, Kælder */}
              {[
                { label: '3. sal (z=10,5m)', yTop: 25, yBot: 67, flIdx: 4 },
                { label: '2. sal (z=7,4m)', yTop: 67, yBot: 109, flIdx: 3 },
                { label: '1. sal (z=4,2m)', yTop: 109, yBot: 151, flIdx: 2 },
                { label: 'Stue (z=1,0m)', yTop: 151, yBot: 195, flIdx: 1 },
                { label: 'Kælder (z=-2,2m)', yTop: 195, yBot: 245, flIdx: 0 },
              ].map((row) => {
                const flData = model.floorProfile[row.flIdx] || model.floorProfile[0];
                const yMid = (row.yTop + row.yBot) / 2;
                const isSuction = flData.deltaPTotPa <= 0;
                return (
                  <g key={row.label}>
                    <line
                      x1="165"
                      y1={row.yBot}
                      x2="545"
                      y2={row.yBot}
                      stroke="#334155"
                      strokeWidth={row.flIdx === 1 ? '2.2' : '1.2'}
                    />
                    <text
                      x="175"
                      y={yMid - 3}
                      fill="#f8fafc"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {row.label}
                    </text>
                    <text
                      x="175"
                      y={yMid + 9}
                      fill={isSuction ? '#fda4af' : '#67e8f9'}
                      fontSize="8.5"
                      fontFamily="monospace"
                    >
                      ΔP_tot = {flData.deltaPTotPa > 0 ? `+${flData.deltaPTotPa.toFixed(1)}` : flData.deltaPTotPa.toFixed(1)} Pa (ΔP_s: {flData.deltaPsPa > 0 ? `+${flData.deltaPsPa.toFixed(1)}` : flData.deltaPsPa.toFixed(1)} Pa)
                    </text>

                    {/* Left Facade Airflow Vectors (Infiltration vs Exfiltration) */}
                    {isSuction ? (
                      <g>
                        <line
                          x1="115"
                          y1={yMid}
                          x2="162"
                          y2={yMid}
                          stroke="#f43f5e"
                          strokeWidth="2.2"
                          strokeDasharray="4,2"
                        />
                        <polygon points={`163,${yMid} 155,${yMid - 4} 155,${yMid + 4}`} fill="#f43f5e" />
                        <text x="110" y={yMid + 3} textAnchor="end" fill="#fda4af" fontSize="8" fontFamily="monospace" fontWeight="bold">
                          IND-SUG
                        </text>
                      </g>
                    ) : (
                      <g>
                        <line
                          x1="165"
                          y1={yMid}
                          x2="118"
                          y2={yMid}
                          stroke="#06b6d4"
                          strokeWidth="2.2"
                        />
                        <polygon points={`115,${yMid} 123,${yMid - 4} 123,${yMid + 4}`} fill="#06b6d4" />
                        <text x="110" y={yMid + 3} textAnchor="end" fill="#67e8f9" fontSize="8" fontFamily="monospace" fontWeight="bold">
                          UD-PRES
                        </text>
                      </g>
                    )}

                    {/* Right Side Apartment Callout */}
                    <text
                      x="392"
                      y={yMid + 3}
                      fill="#cbd5e1"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {row.flIdx === 0
                        ? `Varmerør T_i=${indoorTempC.toFixed(1)}°C · A_eff=${pipeApertureCm2} cm²`
                        : isSuction
                        ? '← Skakt- & facadeinfiltration'
                        : '→ Fugteksfiltration i facade'}
                    </text>
                  </g>
                );
              })}

              {/* Neutral Pressure Plane Horizontal Line across Building Cross-Section */}
              {(() => {
                // Map z in [0..12] to y in [195..25]
                const nplClamped = Math.max(0, Math.min(12, model.zNplEffectiveMeters));
                const yNpl = 195 - (nplClamped / 12) * (195 - 25);
                return (
                  <g>
                    <line
                      x1="145"
                      y1={yNpl}
                      x2="705"
                      y2={yNpl}
                      stroke="#f59e0b"
                      strokeWidth="2.2"
                      strokeDasharray="6,3"
                    />
                    <rect x="552" y={Math.max(12, yNpl - 10)} width="158" height="18" rx="3" fill="#0f172a" stroke="#f59e0b" />
                    <text
                      x="631"
                      y={Math.max(24, yNpl + 2)}
                      textAnchor="middle"
                      fill="#fde68a"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      z_NPL = {model.zNplEffectiveMeters.toFixed(1)} m / 12,0 m
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Compact Floor-by-Floor Pressure Breakdown Table (Kælder, Stue, 1., 2. og 3. sal) */}
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-left border-collapse font-mono text-[10px]">
            <thead className="bg-slate-950 text-slate-300 border-b border-slate-800">
              <tr>
                <th className="py-1.5 px-2">Etage (z)</th>
                <th className="py-1.5 px-2">ΔP_s(z) (Termisk)</th>
                <th className="py-1.5 px-2">ΔP_w(z) (Vind)</th>
                <th className="py-1.5 px-2">ΔP_CAV</th>
                <th className="py-1.5 px-2">ΔP_tot(z)</th>
                <th className="py-1.5 px-2">Vertikal Risikozone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-950/80">
              {model.floorProfile.map((fl) => {
                const isSuction = fl.deltaPTotPa <= 0;
                return (
                  <tr key={`tbl-${fl.id}`} className="hover:bg-slate-900/60">
                    <td className="py-1 px-2 font-bold text-white">{fl.floorLabel}</td>
                    <td className="py-1 px-2 text-cyan-300">
                      {fl.deltaPsPa > 0 ? `+${fl.deltaPsPa.toFixed(1)}` : fl.deltaPsPa.toFixed(1)} Pa
                    </td>
                    <td className="py-1 px-2 text-slate-300">
                      {fl.deltaPwPa > 0 ? `+${fl.deltaPwPa.toFixed(1)}` : fl.deltaPwPa.toFixed(1)} Pa
                    </td>
                    <td className="py-1 px-2 text-amber-300">
                      {fl.deltaPCavPa > 0 ? `+${fl.deltaPCavPa.toFixed(1)}` : fl.deltaPCavPa.toFixed(1)} Pa
                    </td>
                    <td
                      className={`py-1 px-2 font-extrabold ${
                        isSuction ? 'text-rose-400' : 'text-cyan-300'
                      }`}
                    >
                      {fl.deltaPTotPa > 0 ? `+${fl.deltaPTotPa.toFixed(1)}` : fl.deltaPTotPa.toFixed(1)} Pa
                    </td>
                    <td className="py-1 px-2 text-slate-300">{fl.riskNoteDa}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. THE 3 VERTICAL RISK ZONES & BASEMENT RESUSPENSION SCENARIO SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        {/* Zone 1: Under z_NPL (Infiltration & Crawlspace Suction) */}
        <div className="p-3 rounded-lg bg-rose-950/35 border border-rose-500/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-rose-200 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              A. Under z_NPL (Infiltrations- &amp; Kældersug)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500 text-slate-950 font-mono text-[9px] font-bold">
              0 → {model.zNplEffectiveMeters.toFixed(1)} m
            </span>
          </div>
          <p className="text-[10.5px] text-slate-200 leading-snug">
            Rød advarselszone, hvor negativt tryk (<strong>{model.deltaPCavPa} Pa</strong> + termisk
            opdrift <strong>+{model.calibratedDeltaPsPa} Pa</strong>) suger udendørs støvfane og
            krybekælder-skimmel (<code>moldSewer</code>) samt asbestfibre fra tekniske kældergange
            op i boligerne gennem etageadskillelser og rørgennemføringer (
            <strong className="font-mono text-amber-300">A_eff ≈ {pipeApertureCm2} cm²</strong>,
            Q_op = <strong className="font-mono text-rose-200">{model.shaftSuctionQopM3PerH} m³/h</strong>).
          </p>
        </div>

        {/* Zone 2: Stairwells, Pipe Shafts & Escape Door Force (F_door <= 133 N) */}
        <div className="p-3 rounded-lg bg-amber-950/35 border border-amber-500/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-amber-200 flex items-center gap-1">
              <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
              B. Trappeopgange, Rørskakte &amp; Dørkraft
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold ${
                model.doorForceExceeded
                  ? 'bg-rose-500 text-slate-950'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              F_door = {model.doorOpeningForceN} N / 133 N
            </span>
          </div>
          <p className="text-[10.5px] text-slate-200 leading-snug">
            Opadgående skorstensstrøm{' '}
            <code className="text-amber-300">Q_s = {model.stackFlowQsM3PerS} m³/s</code> (
            {model.shaftSuctionQopM3PerH} m³/h) gør trappeopgangen til en lodret støvskorsten.
            Døråbningskraften{' '}
            <code className="text-cyan-300">
              F_door = F_dc + W·A·|ΔP| / (2(W-d)) = {model.doorOpeningForceN} N
            </code>{' '}
            overvåges mod brand- og flugtvejsgrænsen på <strong>133 N</strong> (Δp_max = 69 Pa).
          </p>
        </div>

        {/* Zone 3: Above z_NPL (Moisture Exfiltration) */}
        <div className="p-3 rounded-lg bg-cyan-950/35 border border-cyan-500/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-cyan-200 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              C. Over z_NPL (Fugteksfiltration)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/30 border border-cyan-400 text-cyan-100 font-mono text-[9px] font-bold">
              {model.zNplEffectiveMeters >= 12.0
                ? 'Elimineret af CAV-Vakuum'
                : `${model.zNplEffectiveMeters.toFixed(1)} → 12,0 m`}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-200 leading-snug">
            Når neutralplanet ligger ved{' '}
            <strong className="text-cyan-300">{model.zNplThermalOnlyMeters} m (0,48 H)</strong> i
            passiv drift, presses varm, fugtig indeluft på 2. og 3. sal ud i kolde facadefuger og
            revnede brystninger med kondens og skjult skimmelvækst til følge.
          </p>
        </div>
      </div>

      {/* Scenario Simulator & Embedded Equations Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold font-mono text-white">
            Scenarie-Simulator for Kælder-Resuspension &amp; Skakt-Transport:
          </div>
          <div className="grid grid-cols-1 gap-1.5 font-mono text-[10.5px]">
            {[
              {
                id: 'pipe_asbestos_crawlspace' as const,
                title:
                  'Scenarie 1: Rørgennemføringer (A_eff ≈ 25 cm²) + Krybekælder Asbest/Skimmel',
                detail:
                  'Uisolerede varmerør i kælder opvarmer skaktluften til 22,5°C og driver Q_op = 78,1 m³/h direkte op i stueetagen.',
              },
              {
                id: 'stairwell_chimney_draft' as const,
                title:
                  'Scenarie 2: Gennemgående Trappeopgang med Utæt Indgangsparti (COWI A205732)',
                detail:
                  'Utætte kælderdøre og hoveddøre fordobler bundlækagen A_bottom og sænker z_NPL,0, mens CAV trækker støvet ind i lejlighederne.',
              },
              {
                id: 'range_hood_emergency_door' as const,
                title:
                  'Scenarie 3: CAV + Emhætte (120 l/s) → Flugtvejsdør Overstiger 133 N (Δp > 69 Pa)',
                detail:
                  'Kombineret undertryk overstiger Δp_max = 69 Pa, så F_door > 133 N og brand-/entredøre bindes af vakuum.',
              },
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setBasementResuspensionScenario(sc.id);
                  if (sc.id === 'pipe_asbestos_crawlspace') {
                    setPipeApertureCm2(25);
                    setLeakageRatioTopBottom(1.0);
                    onChangeCavVentilationMode?.('cav_central_exhaust');
                  } else if (sc.id === 'stairwell_chimney_draft') {
                    setPipeApertureCm2(42);
                    setLeakageRatioTopBottom(0.65);
                    onChangeCavVentilationMode?.('cav_central_exhaust');
                  } else {
                    setPipeApertureCm2(35);
                    onChangeCavVentilationMode?.('cav_plus_range_hood_120');
                  }
                }}
                className={`p-2 rounded border text-left transition-all cursor-pointer ${
                  basementResuspensionScenario === sc.id
                    ? 'bg-amber-500/20 border-amber-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="font-bold">{sc.title}</div>
                <div className="text-[9.5px] text-slate-400 mt-0.5">{sc.detail}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Embedded Mathematical Formulas & Calibrated Values */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-1.5 font-mono text-[10px] text-slate-200">
          <div className="text-xs font-bold text-amber-300">
            Matematiske Formler &amp; Aktuelle Kalibreringstal:
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-1">
            <div>
              • <code>ΔP_s(z) = 3460 · (1 / T_o - 1 / T_i) · (z - z_NPL) [Pa]</code>
            </div>
            <div>
              • <code>z_NPL / (H - z_NPL) = (A_top / A_bottom)² · (T_o / T_i)</code>
            </div>
            <div>
              • <code>Q_s = C_d · A_eff · √(2 · g · |z - z_NPL| · |T_i - T_o| / T_i) [m³/s]</code>
            </div>
            <div>
              • <code>F_door = F_dc + (W · A · |ΔP_tot|) / (2 · (W - d)) ≤ 133 N</code>
            </div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-amber-500/30 space-y-0.5 text-[9.5px]">
            <div>
              • Afstand d = {distanceMeters} m → Vibrations-PPV = <strong>{ppvMmPerSec} mm/s</strong>{' '}
              (@ 3 Hz), Degraderet Permeabilitet q₇₅,deg = <strong>{q75DegM3PerHm2} m³/(h·m²)</strong>
            </div>
            <div>
              • Mekanisk CAV-Undertryk ΔP_CAV = <strong>{model.deltaPCavPa.toFixed(1)} Pa</strong>,
              Skakt-indsugning Q_op = <strong>{model.shaftSuctionQopM3PerH.toFixed(1)} m³/h</strong>
            </div>
            <div>
              • Termisk Skorstenstryk ΔP_s ={' '}
              <strong>
                +{model.calibratedDeltaPsPa.toFixed(1)} Pa ({model.stackGradientPaPerM} Pa/m)
              </strong>
              , Forskudt Neutraltryksplan z_NPL ={' '}
              <strong>
                {model.zNplEffectiveMeters.toFixed(1)} m / {buildingHeightMeters.toFixed(1)} m
              </strong>
            </div>
            <div className="text-rose-200 font-bold">
              • Indendørs Asbest C_in = {model.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³ (
              {model.indoorAsbestosPctOfGv}% af GV) → Samlet Indendørs Sumkvotient: S_in ={' '}
              {model.indoorSumQuotientSin.toFixed(2)} (ULOVLIG ≥ 1,0)
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Proof-of-State & Merkle-Root Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/50 rounded-lg p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-200">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Kryptografisk Proof-of-State &amp; Merkle-Root Beviskæde (Retsplejelovens § 823 &amp;
            ISO/IEC 27037)
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Tidsstempel: {dateIso} · kl. {currentWeather.hourLabel} ({currentWeather.isoTime})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="bg-slate-950/90 border border-slate-800 rounded p-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-slate-400 text-[9px] uppercase">
                64-Tegns SHA-256 Signatur (S_in, ΔP_CAV, z_NPL, ΔP_s &amp; PPV):
              </div>
              <div className="text-emerald-300 truncate font-semibold" title={proofSha256}>
                {proofSha256}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopySha}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 shrink-0 flex items-center gap-1 cursor-pointer"
            >
              {copiedSha ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">Kopieret</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-cyan-400" />
                  <span>Kopiér SHA-256</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded p-2">
            <div className="text-slate-400 text-[9px] uppercase">
              Merkle-Root Beviskæde Ankepunkt ({observations.length} registrerede beviser):
            </div>
            <div className="text-cyan-300 truncate font-semibold" title={merkleHeadHash}>
              {merkleHeadHash}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleLogThermalEvidence}
            disabled={isLogging}
            className="w-full sm:w-auto flex-1 px-3.5 py-2 rounded bg-gradient-to-r from-amber-600 via-rose-600 to-cyan-600 hover:from-amber-500 hover:via-rose-500 hover:to-cyan-500 text-white font-mono text-xs font-bold shadow-lg border border-amber-300/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>
              ➕ Føj Termisk Skorstens- &amp; Neutralplansbevis til Beviser (SHA-256)
            </span>
          </button>

          {loggedBanner && (
            <div className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-[11px] font-mono font-bold flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Termisk Opdrifts- &amp; z_NPL bevis (z_NPL = {model.zNplEffectiveMeters.toFixed(1)}{' '}
                m · S_in = {model.indoorSumQuotientSin.toFixed(2)}) føjet til Merkle-Root!
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
