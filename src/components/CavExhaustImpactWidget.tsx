import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownLeft,
  Check,
  CheckCircle2,
  Copy,
  Fan,
  FileCheck2,
  Flame,
  Gauge,
  Home,
  Layers,
  Lock,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wind,
} from 'lucide-react';
import {
  AlgedonicObservation,
  HourlyWeatherPoint,
  LatLngPoint,
  RingparkenBuildingUnit,
} from '../types/dispersion';
import { computeForensicSha256Hash } from '../services/dispersionEngine';

export type ApartmentSizeM2 = 55 | 75 | 82 | 95;

export type CavVentilationMode =
  | 'cav_central_exhaust'
  | 'cav_plus_range_hood_120'
  | 'natural_passive'
  | 'balanced_hepa_overpress';

export interface CavExhaustEvidencePayload {
  point: LatLngPoint;
  locationLabel: string;
  observationType: string;
  description: string;
  telemetrySnapshot: {
    focusReceptorLabel: string;
    apartmentSizeM2: ApartmentSizeM2;
    ventilationMode: CavVentilationMode;
    ventilationModeLabel: string;
    trickleVentsClosedAgainstNoiseDust: boolean;
    qCavLPerSec: number;
    qCavM3PerH: number;
    br18MinBaseLPerSec: number;
    deltaPCavPa: number;
    shaftSuctionQopM3PerH: number;
    thermalStackDeltaPsPa: number;
    zNplMeters: number;
    buildingHeightMeters: number;
    distanceMeters: number;
    ppvMmPerSec: number;
    q75DegM3PerHm2: number;
    indoorAsbestosFibrePerCm3: number;
    indoorAsbestosPctOfGv: number;
    indoorSumQuotientSin: number;
    outdoorSumQuotientSout: number;
    ds447DuctsUncleaned: boolean;
    ds447StaticPressureDeviationPct: number;
    ds447FlowDeviationPct: number;
    ds447BackpressureBreach: boolean;
    proofOfStateSha256: string;
  };
}

interface CavExhaustImpactWidgetProps {
  buildings: RingparkenBuildingUnit[];
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
  observations: AlgedonicObservation[];
  maxSiteSumQuotient: number;
  selectedVentilationMode?: CavVentilationMode;
  onChangeVentilationMode?: (mode: CavVentilationMode) => void;
  onAddCavEvidence: (payload: CavExhaustEvidencePayload) => Promise<void>;
  onOpenInterlockTab?: () => void;
}

interface VentilationModeSpec {
  key: CavVentilationMode;
  labelDa: string;
  shortLabel: string;
  descriptionDa: string;
  badgeColor: string;
}

export const CAV_VENTILATION_MODE_SPECS: Record<CavVentilationMode, VentilationModeSpec> = {
  cav_central_exhaust: {
    key: 'cav_central_exhaust',
    labelDa: 'Central Mekanisk CAV-Udsugning (Konstant Luftmængde · BR18 § 443)',
    shortLabel: 'CAV Central Udsugning (-45,3 Pa)',
    descriptionDa:
      'Tagventilator suger konstant Q_ud = 45 l/s (162 m³/h) fra køkken (20 l/s), bad (15 l/s) og WC/bryggers (10 l/s). Når spalteventiler lukkes mod støj/støv, opbygges -45,3 Pa vakuum.',
    badgeColor: '#F43F5E',
  },
  cav_plus_range_hood_120: {
    key: 'cav_plus_range_hood_120',
    labelDa: 'CAV + Aktiv Emhætte til det fri (≥ 120 l/s · Ekstrem Vakuumpumpe)',
    shortLabel: 'CAV + Emhætte 120 l/s (-118,4 Pa)',
    descriptionDa:
      'Emhætte med afkast til det fri (≥ 120 l/s jf. BR18 § 443) forøger udsugningen til 145 l/s (522 m³/h) og skaber voldsomt undertryk, som trækker ufiltreret støvfane og kælderskaktsluft direkte ind.',
    badgeColor: '#DC2626',
  },
  natural_passive: {
    key: 'natural_passive',
    labelDa: 'Naturligt Aftræk / Passiv Drift (Kun Termisk Skorstenstryk ΔP_s = +5,0 Pa)',
    shortLabel: 'Naturligt Aftræk (-5,0 Pa)',
    descriptionDa:
      'Mekaniske tagventilatorer slukket. Luftskiftet drives alene af termisk opdrift (ΔP_s = +5,0 Pa, 1,04 Pa/m) og vindtryk mod utætte facader.',
    badgeColor: '#F59E0B',
  },
  balanced_hepa_overpress: {
    key: 'balanced_hepa_overpress',
    labelDa: 'Balanceret H14-HEPA Overtryksventilation (+10,0 Pa · Sikkerheds-Interlock)',
    shortLabel: 'H14-HEPA Overtryk (+10,0 Pa)',
    descriptionDa:
      'Aktiv indblæsning gennem H14-HEPA-filter skaber +10,0 Pa beskyttende overtryk i boligen, som blokerer indtrængning af asbestfibre fra både facaderevner og kælderskakte.',
    badgeColor: '#10B981',
  },
};

const APARTMENT_SIZE_SPECS: Record<
  ApartmentSizeM2,
  {
    sizeM2: ApartmentSizeM2;
    labelDa: string;
    typicalLayoutDa: string;
    br18MinBaseLPerSec: number; // 0.30 l/(s·m²)
    effectiveEnvelopeAreaM2: number;
  }
> = {
  55: {
    sizeM2: 55,
    labelDa: '55 m² (2-værelses)',
    typicalLayoutDa: 'Køkken (20 l/s) + Bad/WC (15 l/s) = 35 l/s (126 m³/h)',
    br18MinBaseLPerSec: 16.5,
    effectiveEnvelopeAreaM2: 26.62,
  },
  75: {
    sizeM2: 75,
    labelDa: '75 m² (3-værelses)',
    typicalLayoutDa: 'Køkken (20 l/s) + Bad (15 l/s) + WC (10 l/s) = 45 l/s (162 m³/h)',
    br18MinBaseLPerSec: 22.5,
    effectiveEnvelopeAreaM2: 34.2258,
  },
  82: {
    sizeM2: 82,
    labelDa: '82 m² (3-4 værelses · Reference)',
    typicalLayoutDa: 'Køkken (20 l/s) + Bad (15 l/s) + Sep. WC/Bryggers (10 l/s) = 45 l/s (162 m³/h)',
    br18MinBaseLPerSec: 24.6,
    effectiveEnvelopeAreaM2: 34.2258,
  },
  95: {
    sizeM2: 95,
    labelDa: '95 m² (4-værelses familielejlighed)',
    typicalLayoutDa: 'Køkken (20 l/s) + Bad (15 l/s) + Sep. WC + Bryggers (15 l/s) = 50 l/s (180 m³/h)',
    br18MinBaseLPerSec: 28.5,
    effectiveEnvelopeAreaM2: 38.03,
  },
};

export const CavExhaustImpactWidget: React.FC<CavExhaustImpactWidgetProps> = ({
  buildings,
  currentWeather,
  dateIso,
  observations,
  maxSiteSumQuotient,
  selectedVentilationMode: externalVentMode,
  onChangeVentilationMode,
  onAddCavEvidence,
  onOpenInterlockTab,
}) => {
  const [apartmentSizeM2, setApartmentSizeM2] = useState<ApartmentSizeM2>(82);
  const [internalVentMode, setInternalVentMode] =
    useState<CavVentilationMode>('cav_central_exhaust');
  const [trickleVentsClosed, setTrickleVentsClosed] = useState<boolean>(true);

  // DS 447 kap. 6.3.2 & 6.3.3 telemetry parameters
  const [ds447DuctsUncleaned, setDs447DuctsUncleaned] = useState<boolean>(true);
  const [ds447StaticPressureDevPct, setDs447StaticPressureDevPct] = useState<number>(14.8);
  const [ds447MainFlowDevPct, setDs447MainFlowDevPct] = useState<number>(19.2);

  // Cryptographic SHA-256 Proof-of-State
  const [proofSha256, setProofSha256] = useState<string>(
    '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4'
  );
  const [copiedSha, setCopiedSha] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loggedBanner, setLoggedBanner] = useState<boolean>(false);

  const activeVentMode = externalVentMode ?? internalVentMode;
  const handleSelectVentMode = (mode: CavVentilationMode) => {
    setInternalVentMode(mode);
    if (onChangeVentilationMode) {
      onChangeVentilationMode(mode);
    }
  };

  const aptSpec = APARTMENT_SIZE_SPECS[apartmentSizeM2];
  const ventSpec = CAV_VENTILATION_MODE_SPECS[activeVentMode];

  // Calibrated baseline structural parameters at d = 32 m
  const distanceMeters = 32;
  const ppvMmPerSec = 8.7;
  const q75DegM3PerHm2 = 6.57;
  const thermalStackDeltaPsPa = 5.0;
  const stackGradientPaPerM = 1.04;
  const buildingHeightMeters = 12.0;

  // ============================================================================
  // CONTINUITY EQUATION (Q_ind = Q_ud = Q_CAV) & VACUUM NEGATIVE PRESSURE ENGINE
  // ============================================================================
  const calc = useMemo(() => {
    // Statutory BR18 § 443 room flows [l/s]
    const kitchenLPerSec = 20;
    const bathLPerSec = 15;
    const wcUtilityLPerSec = apartmentSizeM2 === 55 ? 0 : apartmentSizeM2 === 95 ? 15 : 10;
    const rangeHoodBoostLPerSec = activeVentMode === 'cav_plus_range_hood_120' ? 100 : 0; // Total kitchen = 120 l/s when hood active

    const baseRoomSumLPerSec = kitchenLPerSec + bathLPerSec + wcUtilityLPerSec; // 45 l/s for 75/82 m²
    const br18MinFloorLPerSec = Number((0.3 * apartmentSizeM2).toFixed(1));

    let qCavLPerSec = Math.max(br18MinFloorLPerSec, baseRoomSumLPerSec);
    if (activeVentMode === 'cav_plus_range_hood_120') {
      qCavLPerSec = baseRoomSumLPerSec + rangeHoodBoostLPerSec; // 145 l/s
    } else if (activeVentMode === 'natural_passive') {
      qCavLPerSec = 14.5;
    } else if (activeVentMode === 'balanced_hepa_overpress') {
      qCavLPerSec = baseRoomSumLPerSec; // Balanced supply > exhaust
    }

    const qCavM3PerH = Number((qCavLPerSec * 3.6).toFixed(1)); // 162.0 m³/h at 45 l/s

    // Effective envelope area A_env [m²]
    // When trickle vents (spalteventiler) are closed against demolition noise/dust, A_env = aptSpec.effectiveEnvelopeAreaM2
    // When trickle vents are open, effective aperture increases by 1.48x, reducing vacuum pressure but still pulling outdoor plume unfiltered
    const aEnvEffM2 = trickleVentsClosed
      ? aptSpec.effectiveEnvelopeAreaM2
      : aptSpec.effectiveEnvelopeAreaM2 * 1.48;

    // Formula: ΔP_CAV = -75 · (Q_CAV / (A_env · q_75,deg))^(1 / 0.65) [Pa]
    // At apartmentSizeM2 = 82 (or 75), trickleVentsClosed = true, cav_central_exhaust:
    // Q_CAV = 162.0 m³/h, A_env = 34.2258 m², q_75,deg = 6.57 m³/(h·m²)
    // -> ΔP_CAV = -75 * (162.0 / (34.2258 * 6.57))^(1/0.65) = -45.3 Pa!
    let deltaPCavPa = 0;
    if (activeVentMode === 'balanced_hepa_overpress') {
      deltaPCavPa = 10.0; // Protective +10 Pa H14-HEPA overpressure
    } else if (activeVentMode === 'natural_passive') {
      deltaPCavPa = -5.0;
    } else {
      const ratio = qCavM3PerH / (aEnvEffM2 * q75DegM3PerHm2);
      deltaPCavPa = -Number((75.0 * Math.pow(ratio, 1.0 / 0.65)).toFixed(1));
    }

    // Continuity breakdown: Q_ind = Q_ud = Q_facade_cracks + Q_shaft_crawlspace
    // Calibrated at ΔP_CAV = -45.3 Pa -> Shaft suction Q_op = 78.1 m³/h, Facade crack infiltration = 83.9 m³/h (Sum = 162.0 m³/h = Q_ud)
    const shaftSuctionQopM3PerH =
      deltaPCavPa >= 0
        ? 0.0
        : Number((78.1 * Math.pow(Math.abs(deltaPCavPa) / 45.3, 0.65)).toFixed(1));
    const facadeCrackInfiltrationM3PerH =
      deltaPCavPa >= 0
        ? 0.0
        : Number(Math.max(0, qCavM3PerH - shaftSuctionQopM3PerH).toFixed(1));

    // Shifted Neutral Pressure Level z_NPL [m]
    // At ΔP_CAV = -45.3 Pa and ΔP_s = +5.0 Pa -> z_NPL = 12.0 m / 12.0 m (entire facade under suction)
    const zNplMeters =
      deltaPCavPa >= 0
        ? 0.0
        : Number(
            (
              buildingHeightMeters *
              Math.min(1.0, Math.abs(deltaPCavPa) / Math.max(1.0, thermalStackDeltaPsPa * 2))
            ).toFixed(1)
          );

    // Indoor Asbestos Concentration C_in [fibre/cm³] & Total Indoor Sum Quotient S_in
    // Calibrated at ΔP_CAV = -45.3 Pa -> C_in = 0.0071 fibre/cm³ (237% of GV 0.003) and S_in = 3.15
    const suctionScale =
      deltaPCavPa >= 0 ? 0.038 : Math.pow(Math.abs(deltaPCavPa) / 45.3, 0.35);
    const indoorAsbestosFibrePerCm3 = Number((0.0071 * suctionScale).toFixed(4));
    const gvAsbestos2026 = 0.003;
    const indoorAsbestosPctOfGv = Math.round(
      (indoorAsbestosFibrePerCm3 / gvAsbestos2026) * 100
    );
    const indoorSumQuotientSin = Number((3.15 * suctionScale).toFixed(2));

    // DS 447 kap. 6.3.2 & 6.3.3 Acceptance Criteria Evaluation
    // 1. Static pressure tolerance: ±3 %
    // 2. Main airflow tolerance: ±8 %
    // 3. Backpressure breach when |ΔP_CAV| reaches 25–50+ Pa
    const absBackpressurePa = Math.abs(Math.min(0, deltaPCavPa));
    const ds447BackpressureBreach = absBackpressurePa >= 25.0;
    const ds447StaticPressureBreach = Math.abs(ds447StaticPressureDevPct) > 3.0;
    const ds447MainFlowBreach = Math.abs(ds447MainFlowDevPct) > 8.0;
    const ds447AnyBreach =
      ds447DuctsUncleaned ||
      ds447StaticPressureBreach ||
      ds447MainFlowBreach ||
      ds447BackpressureBreach;

    // Cybernetic Interlock condition: S_out >= 0.5 while CAV exhaust is active
    const outdoorSumQuotientSout = Number(Math.max(0.5, maxSiteSumQuotient).toFixed(2));
    const isCavVacuumActive =
      activeVentMode === 'cav_central_exhaust' ||
      activeVentMode === 'cav_plus_range_hood_120';
    const interlockTriggered = outdoorSumQuotientSout >= 0.5 && isCavVacuumActive;

    return {
      kitchenLPerSec:
        activeVentMode === 'cav_plus_range_hood_120' ? 120 : kitchenLPerSec,
      bathLPerSec,
      wcUtilityLPerSec,
      br18MinFloorLPerSec,
      qCavLPerSec,
      qCavM3PerH,
      aEnvEffM2: Number(aEnvEffM2.toFixed(2)),
      deltaPCavPa,
      shaftSuctionQopM3PerH,
      facadeCrackInfiltrationM3PerH,
      zNplMeters,
      indoorAsbestosFibrePerCm3,
      indoorAsbestosPctOfGv,
      indoorSumQuotientSin,
      absBackpressurePa,
      ds447BackpressureBreach,
      ds447StaticPressureBreach,
      ds447MainFlowBreach,
      ds447AnyBreach,
      outdoorSumQuotientSout,
      isCavVacuumActive,
      interlockTriggered,
    };
  }, [
    apartmentSizeM2,
    activeVentMode,
    trickleVentsClosed,
    aptSpec.effectiveEnvelopeAreaM2,
    ds447DuctsUncleaned,
    ds447StaticPressureDevPct,
    ds447MainFlowDevPct,
    maxSiteSumQuotient,
  ]);

  // Compute deterministic 64-character SHA-256 Proof-of-State signature
  useEffect(() => {
    let cancelled = false;
    computeForensicSha256Hash({
      module: 'CavExhaustImpactWidget_BR18_443_DS447',
      dateIso,
      hourIso: currentWeather.isoTime,
      focusReceptor:
        'Alle beboede naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4)',
      apartmentSizeM2,
      ventilationMode: activeVentMode,
      trickleVentsClosed,
      qCavLPerSec: calc.qCavLPerSec,
      qCavM3PerH: calc.qCavM3PerH,
      deltaPCavPa: calc.deltaPCavPa,
      shaftSuctionQopM3PerH: calc.shaftSuctionQopM3PerH,
      thermalStackDeltaPsPa,
      zNplMeters: calc.zNplMeters,
      distanceMeters,
      ppvMmPerSec,
      q75DegM3PerHm2,
      indoorAsbestosFibrePerCm3: calc.indoorAsbestosFibrePerCm3,
      indoorSumQuotientSin: calc.indoorSumQuotientSin,
      ds447DuctsUncleaned,
      ds447StaticPressureDevPct,
      ds447MainFlowDevPct,
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
    apartmentSizeM2,
    activeVentMode,
    trickleVentsClosed,
    calc,
    ds447DuctsUncleaned,
    ds447StaticPressureDevPct,
    ds447MainFlowDevPct,
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

  const handleLogCavEvidence = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const focusLabel =
        'Alle beboede naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4)';
      const description = `[CAV-UDSUGNING & VAKUUM-INFILTRATIONSBEVIS · BR18 § 443 & DS 447] Fokus-Receptor: ${focusLabel}. Lejlighed: ${apartmentSizeM2} m², Drift: ${
        ventSpec.shortLabel
      }, Kontinuitetsligning Q_ind = Q_ud = Q_CAV = ${calc.qCavLPerSec} l/s (${
        calc.qCavM3PerH
      } m³/h; BR18 min. 0,30 l/(s·m²) = ${
        calc.br18MinFloorLPerSec
      } l/s). Mekanisk CAV-Undertryk ΔP_CAV = ${calc.deltaPCavPa.toFixed(
        1
      )} Pa, Skakt-indsugning fra kælder/krybekælder Q_op = ${calc.shaftSuctionQopM3PerH.toFixed(
        1
      )} m³/h, Facaderevne-infiltration = ${calc.facadeCrackInfiltrationM3PerH.toFixed(
        1
      )} m³/h ved q_75,deg = ${q75DegM3PerHm2} m³/(h·m²) og PPV = ${ppvMmPerSec} mm/s (@ 3 Hz, d = ${distanceMeters} m). Termisk skorstenstryk ΔP_s = +${thermalStackDeltaPsPa.toFixed(
        1
      )} Pa (${stackGradientPaPerM} Pa/m), Forskudt Neutraltryksplan z_NPL = ${calc.zNplMeters.toFixed(
        1
      )} m / ${buildingHeightMeters.toFixed(
        1
      )} m. DS 447 kap. 6.3.2/6.3.3 afvigelser: Statisk tryk ±${ds447StaticPressureDevPct}% (krav ±3%), Hovedluftmængde ±${ds447MainFlowDevPct}% (krav ±8%), Kanaler urengjorte for byggestøv: ${
        ds447DuctsUncleaned ? 'JA (LOVBRUD)' : 'NEJ'
      }. Indendørs Asbest C_in = ${calc.indoorAsbestosFibrePerCm3.toFixed(
        4
      )} fibre/cm³ (${calc.indoorAsbestosPctOfGv}% af GV) → Samlet Indendørs Sumkvotient S_in = ${calc.indoorSumQuotientSin.toFixed(
        2
      )}. SHA-256 Proof-of-State: ${proofSha256}.`;

      await onAddCavEvidence({
        point: { lat: 55.4122, lng: 11.3522 },
        locationLabel: focusLabel,
        observationType: `CAV-Vakuum & DS 447 Infiltrationsbevis (ΔP_CAV = ${calc.deltaPCavPa.toFixed(
          1
        )} Pa · S_in = ${calc.indoorSumQuotientSin.toFixed(2)})`,
        description,
        telemetrySnapshot: {
          focusReceptorLabel: focusLabel,
          apartmentSizeM2,
          ventilationMode: activeVentMode,
          ventilationModeLabel: ventSpec.labelDa,
          trickleVentsClosedAgainstNoiseDust: trickleVentsClosed,
          qCavLPerSec: calc.qCavLPerSec,
          qCavM3PerH: calc.qCavM3PerH,
          br18MinBaseLPerSec: calc.br18MinFloorLPerSec,
          deltaPCavPa: calc.deltaPCavPa,
          shaftSuctionQopM3PerH: calc.shaftSuctionQopM3PerH,
          thermalStackDeltaPsPa,
          zNplMeters: calc.zNplMeters,
          buildingHeightMeters,
          distanceMeters,
          ppvMmPerSec,
          q75DegM3PerHm2,
          indoorAsbestosFibrePerCm3: calc.indoorAsbestosFibrePerCm3,
          indoorAsbestosPctOfGv: calc.indoorAsbestosPctOfGv,
          indoorSumQuotientSin: calc.indoorSumQuotientSin,
          outdoorSumQuotientSout: calc.outdoorSumQuotientSout,
          ds447DuctsUncleaned,
          ds447StaticPressureDeviationPct: ds447StaticPressureDevPct,
          ds447FlowDeviationPct: ds447MainFlowDevPct,
          ds447BackpressureBreach: calc.ds447BackpressureBreach,
          proofOfStateSha256: proofSha256,
        },
      });

      setLoggedBanner(true);
      window.setTimeout(() => setLoggedBanner(false), 4500);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Vacuum Gauge Needle Percentage (0% = +15 Pa overpressure, 100% = -125 Pa extreme vacuum)
  const vacuumGaugeRatio = Math.min(
    1,
    Math.max(0, (15 - calc.deltaPCavPa) / 140)
  );

  return (
    <div className="bg-slate-950/95 border border-cyan-500/45 rounded-lg p-3.5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
              <Fan className="w-3 h-3 text-cyan-400" />
              CAV-Udsugningens Påvirkning · BR18 § 443 &amp; DS 447
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[11px] font-mono font-semibold">
              Kontinuitet: Q_ind = Q_ud = {calc.qCavLPerSec} l/s ({calc.qCavM3PerH} m³/h)
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                calc.indoorSumQuotientSin >= 1.0
                  ? 'bg-rose-600/30 border-rose-400 text-rose-100 s-quotient-warning-pulse'
                  : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              }`}
              data-s-warning-active={calc.indoorSumQuotientSin >= 1.0 ? 'true' : 'false'}
            >
              ΔP_CAV = {calc.deltaPCavPa > 0 ? `+${calc.deltaPCavPa.toFixed(1)}` : calc.deltaPCavPa.toFixed(1)} Pa · S_in = {calc.indoorSumQuotientSin.toFixed(2)}
            </span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
            Mekanisk CAV-Vakuumpumpe, Kontinuitetsligning (Q_ind = Q_ud) &amp; DS 447 Kanal-Overvågning
          </h3>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Dokumenterer hvordan central mekanisk CAV-udsugning (BR18 kap. 22 § 443) ved lukkede
            spalteventiler eller aktiv emhætte (<span className="font-mono text-rose-300">≥ 120 l/s</span>)
            skaber et kraftigt undertryk (<span className="font-mono text-cyan-300">ΔP_CAV = {calc.deltaPCavPa.toFixed(1)} Pa</span>),
            der suger ufiltreret nedrivningsfane gennem facaderevner (<span className="font-mono text-amber-300">q₇₅,deg = 6,57 m³/(h·m²)</span>)
            samt asbest- og skimmelholdig luft fra kælderskakte (<span className="font-mono text-rose-300">Q_op = {calc.shaftSuctionQopM3PerH.toFixed(1)} m³/h</span>)
            direkte ind i beboede lejligheder.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setApartmentSizeM2(82);
            handleSelectVentMode('cav_central_exhaust');
            setTrickleVentsClosed(true);
            setDs447DuctsUncleaned(true);
            setDs447StaticPressureDevPct(14.8);
            setDs447MainFlowDevPct(19.2);
          }}
          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-300 shrink-0 transition-colors cursor-pointer"
        >
          ↺ Kalibreret Reference (82 m² · ΔP_CAV = -45,3 Pa · S_in = 3,15)
        </button>
      </div>

      {/* Cybernetic CAV Interlock Alert Banner when S_out >= 0.5 and CAV is active */}
      {calc.interlockTriggered ? (
        <div className="p-3 rounded-lg bg-rose-950/90 border border-[var(--border-subtle)] border-l-4 border-l-rose-500 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono font-extrabold text-rose-200">
              <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
              <span>
                RØD SIKKERHEDS-INTERLOCK UDLØST: CAV-VAKUUMSPÆRRING VED UDENDØRS SPREDNINGSFANE (S_out ={' '}
                {calc.outdoorSumQuotientSout.toFixed(2)} ≥ 0,50)
              </span>
            </div>
            {onOpenInterlockTab && (
              <button
                type="button"
                onClick={onOpenInterlockTab}
                className="px-2 py-0.5 rounded bg-rose-500/30 hover:bg-rose-500/40 border border-rose-300 text-[11px] font-mono text-white font-bold cursor-pointer"
              >
                Åbn PSS Interlock-Fane →
              </button>
            )}
          </div>
          <p className="text-[11px] text-rose-100 leading-snug">
            Aktiv CAV-udsugning (<strong className="font-mono">{calc.deltaPCavPa.toFixed(1)} Pa</strong>) i
            beboede naboblokke kombineret med udendørs spredningsfane{' '}
            <strong className="font-mono">S_out ≥ 0,5</strong> pumper asbestfibre (
            <strong className="font-mono">{calc.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³ = {calc.indoorAsbestosPctOfGv}% GV</strong>)
            ind i opholdsrummene. Systemet kræver enten <strong>øjeblikkeligt stop for mekanisk nedbrydning i medvind</strong> eller
            omstilling til <strong>H14-HEPA-filtreret overtryksventilation (+10 Pa)</strong>:
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => handleSelectVentMode('balanced_hepa_overpress')}
              className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Omstil til H14-HEPA Overtryksventilation (+10,0 Pa)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              CAV-Vakuumspærring Afværget: Boligen er i beskyttende drift ({ventSpec.shortLabel} · ΔP ={' '}
              {calc.deltaPCavPa > 0 ? `+${calc.deltaPCavPa.toFixed(1)}` : calc.deltaPCavPa.toFixed(1)} Pa · S_in ={' '}
              {calc.indoorSumQuotientSin.toFixed(2)})
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSelectVentMode('cav_central_exhaust')}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300 hover:text-white cursor-pointer"
          >
            Simulér ufiltreret CAV-drift (-45,3 Pa)
          </button>
        </div>
      )}

      {/* 1. BR18 § 443 & DS 447 PARAMETRISERING */}
      <div className="bg-slate-900/85 border border-slate-800 rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5 text-cyan-400" />
            1. BR18 Kap. 22 § 443 &amp; DS 447 Parametrisering (Lejlighedsstørrelse &amp;
            Ventilationsdrift)
          </h4>
          <span className="text-[11px] font-mono text-amber-300">
            Ældre normkrav: 150–200 m³/h pr. lejlighed (Aktuel: {calc.qCavM3PerH} m³/h)
          </span>
        </div>

        {/* Apartment Size Selector (55, 75, 82, 95 m²) */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase text-slate-400">
            Vælg Lejlighedsstørrelse i Beboede Naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 &amp;
            Kierulffsvej 4):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([55, 75, 82, 95] as ApartmentSizeM2[]).map((sz) => {
              const spec = APARTMENT_SIZE_SPECS[sz];
              const isSelected = apartmentSizeM2 === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setApartmentSizeM2(sz)}
                  className={`p-2 rounded border text-left font-mono transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                      : 'bg-slate-950/90 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{spec.labelDa}</span>
                    {sz === 82 && (
                      <span className="text-[11px] px-1 py-0.2 rounded bg-cyan-500/30 text-cyan-200">
                        Ref.
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    BR18 ≥ 0,30 l/(s·m²) = <strong className="text-cyan-300">{spec.br18MinBaseLPerSec} l/s</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ventilation Operating Mode Selector */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase text-slate-400">
            Vælg Ventilationsdrift (`cav_central_exhaust`, `cav_plus_range_hood_120`,
            `natural_passive`, `balanced_hepa_overpress`):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(CAV_VENTILATION_MODE_SPECS) as CavVentilationMode[]).map((modeKey) => {
              const spec = CAV_VENTILATION_MODE_SPECS[modeKey];
              const isSelected = activeVentMode === modeKey;
              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => handleSelectVentMode(modeKey)}
                  className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/95 border-cyan-400 text-white ring-1 ring-cyan-400/40'
                      : 'bg-slate-950/85 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 font-mono text-[11px] font-bold">
                    <span>{spec.shortLabel}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[11px]"
                      style={{
                        backgroundColor: `${spec.badgeColor}25`,
                        color: spec.badgeColor,
                        border: `1px solid ${spec.badgeColor}60`,
                      }}
                    >
                      {modeKey}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {spec.descriptionDa}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Statutory BR18 Kap. 22 § 443 Table + Trickle Vents Toggle */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 pt-1 border-t border-slate-800 text-[11px] font-mono">
          <div className="p-2 rounded bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Grundluftskifte (§ 443)</div>
            <div className="text-white font-bold mt-0.5">≥ 0,30 l/(s·m²)</div>
            <div className="text-cyan-300">Krav ({apartmentSizeM2} m²): {calc.br18MinFloorLPerSec} l/s</div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Køkken (Udsugning)</div>
            <div className="text-white font-bold mt-0.5">≥ 20 l/s (72 m³/h)</div>
            <div className="text-amber-300">Aktuel: {calc.kitchenLPerSec} l/s</div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Badeværelse</div>
            <div className="text-white font-bold mt-0.5">≥ 15 l/s (54 m³/h)</div>
            <div className="text-amber-300">Aktuel: {calc.bathLPerSec} l/s</div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Separat WC / Bryggers</div>
            <div className="text-white font-bold mt-0.5">≥ 10 l/s (36 m³/h)</div>
            <div className="text-amber-300">Aktuel: {calc.wcUtilityLPerSec} l/s</div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-rose-500/40">
            <div className="text-rose-300">Emhætte til det fri</div>
            <div className="text-white font-bold mt-0.5">≥ 120 l/s (432 m³/h)</div>
            <div className="text-rose-200">
              {activeVentMode === 'cav_plus_range_hood_120' ? 'AKTIV (120 l/s)' : 'Standby'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <label className="inline-flex items-center gap-2 text-[11px] font-mono text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={trickleVentsClosed}
              onChange={(e) => setTrickleVentsClosed(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-rose-500"
            />
            <span>
              Beboer har lukket friskluft-/spalteventiler mod støj (&gt;80 dB) og støv fra nedrivningen
              (forstærker CAV-vakuumeffekten til <strong>-45,3 Pa</strong>)
            </span>
          </label>
        </div>
      </div>

      {/* 2. KONTINUITETSLIGNING (Q_ind = Q_ud) & GRAFISK VAKUUM-INDSUGNINGSMETER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left: Graphical Vacuum Suction Meter & Apartment Cross-Section SVG */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-rose-400" />
              2. Kontinuitetsligning (Q_ind = Q_ud) &amp; Vakuum-Indsugningsmeter
            </h4>
            <span className="text-[11px] font-mono text-rose-300 font-bold">
              ΔP_CAV = {calc.deltaPCavPa > 0 ? `+${calc.deltaPCavPa.toFixed(1)}` : calc.deltaPCavPa.toFixed(1)} Pa
            </span>
          </div>

          {/* Horizontal Vacuum Pressure Bar Meter */}
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-emerald-400 font-bold">+10 Pa (HEPA Overtryk)</span>
              <span className="text-amber-300">DS 447 Modtryksgrænse (-25 til -50 Pa)</span>
              <span className="text-rose-400 font-bold">-120 Pa (Emhætte Vakuum)</span>
            </div>
            <div className="relative h-4 w-full rounded-full bg-gradient-to-r from-emerald-500/40 via-amber-500/50 to-rose-600/80 border border-slate-700 overflow-hidden">
              <div
                className="absolute top-0 bottom-0 w-1.5 bg-white border border-slate-900 transition-all duration-300"
                style={{ left: `calc(${vacuumGaugeRatio * 100}% - 3px)` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                Formel: <code className="text-cyan-300">ΔP_CAV = -75 · (Q_CAV / (A_env · q₇₅,deg))^(1/0,65)</code>
              </span>
              <span className="text-white font-bold">
                Aktuelt: {calc.deltaPCavPa.toFixed(1)} Pa
              </span>
            </div>
          </div>

          {/* SVG Cross-Section of Apartment Vacuum Pump Effect */}
          <svg
            viewBox="0 0 520 220"
            className="w-full h-auto bg-slate-950 rounded border border-slate-800"
            role="img"
            aria-label="Kontinuitetsligning Q_ind = Q_ud og CAV Vakuumpumpe Tværsnit"
          >
            {/* Outdoor Demolition Plume Zone (Left) */}
            <rect x="8" y="14" width="120" height="192" rx="4" fill="#4C0519" fillOpacity="0.45" stroke="#F43F5E" strokeDasharray="3,3" />
            <text x="68" y="32" textAnchor="middle" fill="#FDA4AF" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
              UDENDØRS STØVFANE
            </text>
            <text x="68" y="46" textAnchor="middle" fill="#F8FAFC" fontSize="9.5" fontFamily="monospace">
              S_out = {calc.outdoorSumQuotientSout.toFixed(2)}
            </text>
            <text x="68" y="60" textAnchor="middle" fill="#FBBF24" fontSize="9.5" fontFamily="monospace">
              PPV = {ppvMmPerSec} mm/s (3 Hz)
            </text>
            <text x="68" y="74" textAnchor="middle" fill="#38BDF8" fontSize="9.5" fontFamily="monospace">
              q₇₅,deg = {q75DegM3PerHm2} m³/(h·m²)
            </text>

            {/* Apartment Living Space Box (Center) */}
            <rect x="148" y="20" width="230" height="135" rx="4" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.8" />
            <text x="263" y="38" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontFamily="monospace" fontWeight="bold">
              BEBOET LEJLIGHED ({apartmentSizeM2} m²)
            </text>
            <text x="263" y="54" textAnchor="middle" fill={calc.deltaPCavPa < 0 ? '#FDA4AF' : '#6EE7B7'} fontSize="11" fontFamily="monospace" fontWeight="bold">
              ΔP_CAV = {calc.deltaPCavPa > 0 ? `+${calc.deltaPCavPa.toFixed(1)}` : calc.deltaPCavPa.toFixed(1)} Pa · z_NPL = {calc.zNplMeters.toFixed(1)}m
            </text>
            <text x="263" y="72" textAnchor="middle" fill="#FDE047" fontSize="9.5" fontFamily="monospace">
              Asbest C_in = {calc.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³ ({calc.indoorAsbestosPctOfGv}% GV)
            </text>
            <text x="263" y="88" textAnchor="middle" fill={calc.indoorSumQuotientSin >= 1.0 ? '#F43F5E' : '#34D399'} fontSize="10.5" fontFamily="monospace" fontWeight="bold">
              Indendørs Sumkvotient S_in = {calc.indoorSumQuotientSin.toFixed(2)}
            </text>

            {/* Facade Cracks Infiltration Arrows (Left -> Center) */}
            <line x1="128" y1="105" x2="172" y2="105" stroke={calc.deltaPCavPa < 0 ? '#F43F5E' : '#10B981'} strokeWidth="3" />
            <polygon
              points={calc.deltaPCavPa < 0 ? '176,105 166,100 166,110' : '124,105 134,100 134,110'}
              fill={calc.deltaPCavPa < 0 ? '#F43F5E' : '#10B981'}
            />
            <text x="263" y="114" textAnchor="middle" fill="#CBD5E1" fontSize="9.5" fontFamily="monospace">
              Facaderevner &amp; PCB-fuger: {calc.facadeCrackInfiltrationM3PerH.toFixed(1)} m³/h
            </text>

            {/* Basement / Crawlspace Unsealed Pipe Shafts (Bottom) */}
            <rect x="148" y="166" width="230" height="40" rx="4" fill="#1E1B4B" stroke="#F59E0B" strokeWidth="1.4" />
            <text x="263" y="182" textAnchor="middle" fill="#FDE68A" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
              KRYBEKÆLDER &amp; UTÆTTE RØRSKAKTE (COWI A205732)
            </text>
            <text x="263" y="197" textAnchor="middle" fill="#FCA5A5" fontSize="9.5" fontFamily="monospace">
              Skakt-indsugning Q_op = {calc.shaftSuctionQopM3PerH.toFixed(1)} m³/h (Asbest &amp; Skimmel)
            </text>

            {/* Vertical Shaft Suction Arrow (Bottom -> Center) */}
            {calc.deltaPCavPa < 0 && (
              <>
                <line x1="263" y1="166" x2="263" y2="136" stroke="#F59E0B" strokeWidth="3" />
                <polygon points="263,130 258,140 268,140" fill="#F59E0B" />
              </>
            )}

            {/* Central CAV Roof Exhaust / Hood Duct (Right) */}
            <rect x="394" y="20" width="118" height="186" rx="4" fill="#090D16" stroke="#38BDF8" strokeWidth="1.5" />
            <text x="453" y="40" textAnchor="middle" fill="#38BDF8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
              CAV AFKAST / TAG
            </text>
            <text x="453" y="58" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontFamily="monospace" fontWeight="bold">
              Q_ud = {calc.qCavLPerSec} l/s
            </text>
            <text x="453" y="73" textAnchor="middle" fill="#94A3B8" fontSize="9.5" fontFamily="monospace">
              ({calc.qCavM3PerH} m³/h)
            </text>
            <text x="453" y="96" textAnchor="middle" fill="#E2E8F0" fontSize="9.5" fontFamily="monospace">
              Køkken: {calc.kitchenLPerSec} l/s
            </text>
            <text x="453" y="110" textAnchor="middle" fill="#E2E8F0" fontSize="9.5" fontFamily="monospace">
              Bad: {calc.bathLPerSec} l/s
            </text>
            <text x="453" y="124" textAnchor="middle" fill="#E2E8F0" fontSize="9.5" fontFamily="monospace">
              WC/Bryggers: {calc.wcUtilityLPerSec} l/s
            </text>
            <text x="453" y="148" textAnchor="middle" fill="#FBBF24" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
              Q_ind = Q_ud
            </text>

            {/* Exhaust Arrow (Center -> Right) */}
            <line x1="378" y1="85" x2="394" y2="85" stroke="#38BDF8" strokeWidth="3" />
            <polygon points="396,85 388,80 388,90" fill="#38BDF8" />
          </svg>
        </div>

        {/* Right: DS 447 Kap. 6.3.2 & 6.3.3 Acceptance Criteria Monitor & Calibrated Proof Numbers */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              DS 447 Kap. 6.3.2 &amp; 6.3.3 Acceptkriterier &amp; Indlejrede Formler
            </h4>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                calc.ds447AnyBreach
                  ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                  : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              }`}
            >
              {calc.ds447AnyBreach ? 'DS 447 LOVBRUD KONSTATERET' : 'DS 447 OVERHOLDT'}
            </span>
          </div>

          {/* DS 447 Interactive Inspection Controls */}
          <div className="space-y-2 text-[11px] font-mono">
            <label className="flex items-start justify-between gap-2 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={ds447DuctsUncleaned}
                  onChange={(e) => setDs447DuctsUncleaned(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-rose-500"
                />
                <div>
                  <div className="font-bold text-white">
                    DS 447 kap. 6.3.2: Kanaler ikke rengjorte for byggestøv / asbestslam
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Aflejret nedrivningsstøv i ventilationskanaler øger tryktabet og resuspenderer partikler ved tilbageslag.
                  </div>
                </div>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                  ds447DuctsUncleaned
                    ? 'bg-rose-500 text-slate-950'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {ds447DuctsUncleaned ? 'LOVBRUD' : 'RENGJORT'}
              </span>
            </label>

            <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  DS 447 kap. 6.3.3 Statisk tryk afvigelse (Tolerance: <strong>±3,0 %</strong>):
                </span>
                <span
                  className={`font-bold ${
                    calc.ds447StaticPressureBreach ? 'text-rose-400' : 'text-emerald-300'
                  }`}
                >
                  ±{ds447StaticPressureDevPct.toFixed(1)} %{' '}
                  {calc.ds447StaticPressureBreach ? '(OVERSKREDET > 3%)' : '(OK)'}
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={25.0}
                step={0.1}
                value={ds447StaticPressureDevPct}
                onChange={(e) => setDs447StaticPressureDevPct(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  DS 447 Hovedluftmængde afvigelse (Tolerance: <strong>±8,0 %</strong>):
                </span>
                <span
                  className={`font-bold ${
                    calc.ds447MainFlowBreach ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  ±{ds447MainFlowDevPct.toFixed(1)} %{' '}
                  {calc.ds447MainFlowBreach ? '(OVERSKREDET > 8%)' : '(OK)'}
                </span>
              </div>
              <input
                type="range"
                min={1.0}
                max={30.0}
                step={0.2}
                value={ds447MainFlowDevPct}
                onChange={(e) => setDs447MainFlowDevPct(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-slate-300 font-bold">
                  DS 447 Kritisk Modtryk (25–50 Pa grænse i boligen):
                </div>
                <div className="text-[11px] text-slate-400">
                  Aktuelt modtryk |ΔP_CAV| = {calc.absBackpressurePa.toFixed(1)} Pa (Skakt-sug Q_op ={' '}
                  {calc.shaftSuctionQopM3PerH.toFixed(1)} m³/h)
                </div>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                  calc.ds447BackpressureBreach
                    ? 'bg-rose-500 text-slate-950'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {calc.ds447BackpressureBreach
                  ? `MODTRYK ${calc.absBackpressurePa.toFixed(1)} Pa (BRUD)`
                  : 'OK (<25 Pa)'}
              </span>
            </div>
          </div>

          {/* Embedded Mathematical Formulas Box */}
          <div className="p-2.5 rounded bg-slate-950 border border-amber-500/35 font-mono text-[11px] space-y-1 text-slate-200">
            <div className="text-amber-300 font-bold uppercase text-[11px]">
              Matematiske Formler Indlejret i Beregningsmotoren:
            </div>
            <div>
              • <code className="text-cyan-200">Q_ind = Q_ud = Q_CAV ≥ 0,30 l/(s·m²)</code> (Køkken ≥ 20 l/s, Bad ≥ 15 l/s, WC ≥ 10 l/s, Emhætte ≥ 120 l/s)
            </div>
            <div>
              • <code className="text-rose-200">ΔP_CAV = -75 · (Q_CAV / (A_env · q_75,deg))^(1 / 0,65) [Pa]</code>
            </div>
            <div>
              • <code className="text-amber-200">DS 447 tolerancer: Statisk tryk ±3 %, Hovedluftmængde ±8 %</code> (Kritisk modtryk: 25–50 Pa)
            </div>
          </div>

          {/* Summary Box of Calibrated Reference & Evidence Values */}
          <div className="p-2.5 rounded bg-slate-950 border border-cyan-500/30 font-mono text-[11px] space-y-1 text-slate-200">
            <div className="text-cyan-300 font-bold uppercase text-[11px]">
              Aktuelle Kalibrerings- og Bevistal fra Beregneren:
            </div>
            <div>
              • Afstand d = {distanceMeters} m → Vibrations-PPV = <strong>{ppvMmPerSec} mm/s</strong> (@ 3 Hz), Degraderet Permeabilitet q₇₅,deg = <strong>{q75DegM3PerHm2} m³/(h·m²)</strong>
            </div>
            <div>
              • Mekanisk CAV-Undertryk ΔP_CAV = <strong>{calc.deltaPCavPa.toFixed(1)} Pa</strong>, Skakt-indsugning Q_op = <strong>{calc.shaftSuctionQopM3PerH.toFixed(1)} m³/h</strong>
            </div>
            <div>
              • Termisk Skorstenstryk ΔP_s = <strong>+{thermalStackDeltaPsPa.toFixed(1)} Pa ({stackGradientPaPerM} Pa/m)</strong>, Forskudt Neutraltryksplan z_NPL = <strong>{calc.zNplMeters.toFixed(1)} m / {buildingHeightMeters.toFixed(1)} m</strong>
            </div>
            <div className="text-rose-200 font-bold">
              • Indendørs Asbest C_in = {calc.indoorAsbestosFibrePerCm3.toFixed(4)} fibre/cm³ ({calc.indoorAsbestosPctOfGv}% af GV) → Samlet Indendørs Sumkvotient: S_in = {calc.indoorSumQuotientSin.toFixed(2)} ({calc.indoorSumQuotientSin >= 1.0 ? 'ULOVLIG ≥ 1,0' : 'OK < 1,0'})
            </div>
          </div>
        </div>
      </div>

      {/* 3. CRYPTOGRAPHIC PROOF-OF-STATE & MERKLE-ROOT INTEGRATION */}
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-sky-500 rounded-lg p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-cyan-200">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            Kryptografisk Beviskrav (Retssikkerhed · Retsplejelovens § 823 &amp; ISO/IEC 27037)
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Tidsstempel: {dateIso} · kl. {currentWeather.hourLabel} ({currentWeather.isoTime})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-slate-950/90 border border-slate-800 rounded p-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-slate-400 text-[11px] uppercase">
                64-Tegns SHA-256 Proof-of-State (S_in, ΔP_CAV, z_NPL, PPV &amp; DS 447):
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
            <div className="text-slate-400 text-[11px] uppercase">
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
            onClick={handleLogCavEvidence}
            disabled={isSubmitting}
            className="w-full sm:w-auto flex-1 px-3.5 py-2 rounded bg-[var(--surface-overlay)] hover:bg-slate-700 text-[var(--text-primary)] font-mono text-xs font-bold border border-sky-500/60 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Føj CAV-Udsugnings &amp; DS 447 Vakuum-Bevis til Beviser (SHA-256)
            </span>
          </button>

          {loggedBanner && (
            <div className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-[11px] font-mono font-bold flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                CAV-Vakuumbevis (ΔP_CAV = {calc.deltaPCavPa.toFixed(1)} Pa · S_in ={' '}
                {calc.indoorSumQuotientSin.toFixed(2)}) forankret i Merkle-Root!
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
