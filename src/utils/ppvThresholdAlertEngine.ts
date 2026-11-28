/**
 * @file src/utils/ppvThresholdAlertEngine.ts
 * @description Real-time DIN 4150-3 Peak Particle Velocity (PPV) beregningsmotor
 * baseret på afstand til aktive nedrivningskilder og Bornitz jordvibrationsdæmpning.
 * Udløser visuel advarsel når 25 mm/s grænsen (DIN 4150-3) nærmer sig eller overskrides.
 */

import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
} from '../types/dispersion';
import { distanceBetweenPointsMeters } from '../services/dispersionEngine';

export const DIN_4150_3_PPV_LIMIT_MM_S = 25.0;
/** Advarselstærskel når PPV nærmer sig 25 mm/s (72% = 18,0 mm/s jf. DIN 4150-3 varsling) */
export const PPV_APPROACHING_THRESHOLD_MM_S = 18.0;
export const PPV_ELEVATED_THRESHOLD_MM_S = 12.5;

export type SoilVibrationProfileKey =
  | 'moraine_clay'
  | 'sandy_till'
  | 'saturated_peat'
  | 'compact_gravel';

export interface SoilVibrationProfileSpec {
  key: SoilVibrationProfileKey;
  labelDa: string;
  alphaPerM: number; // Bornitz absorptionskoefficient α (1/m)
  geometricExpN: number; // Geometrisk spredningseksponent n (Rayleigh / rum-bølger)
  moistureSensitivity: number;
  descriptionDa: string;
}

export const SOIL_VIBRATION_PROFILES: Record<
  SoilVibrationProfileKey,
  SoilVibrationProfileSpec
> = {
  moraine_clay: {
    key: 'moraine_clay',
    labelDa: 'Slagelse Moræneler (Standard)',
    alphaPerM: 0.036,
    geometricExpN: 0.55,
    moistureSensitivity: 1.0,
    descriptionDa:
      'Vandmættet moræneler under Ringparken/Kierulffsvej (α = 0,036 m⁻¹, n = 0,55).',
  },
  sandy_till: {
    key: 'sandy_till',
    labelDa: 'Sandet Moræne / Tør Ler',
    alphaPerM: 0.048,
    geometricExpN: 0.6,
    moistureSensitivity: 0.85,
    descriptionDa:
      'Højere indre friktion og hurtigere bølgedæmpning med afstand (α = 0,048 m⁻¹, n = 0,60).',
  },
  saturated_peat: {
    key: 'saturated_peat',
    labelDa: 'Blød Fyld / Høj Vandstand',
    alphaPerM: 0.024,
    geometricExpN: 0.5,
    moistureSensitivity: 1.25,
    descriptionDa:
      'Lav jorddæmpning med langtrækkende overfladebølger i blød/våd undergrund (α = 0,024 m⁻¹).',
  },
  compact_gravel: {
    key: 'compact_gravel',
    labelDa: 'Kompakt Grus / Bærelag',
    alphaPerM: 0.055,
    geometricExpN: 0.65,
    moistureSensitivity: 0.7,
    descriptionDa:
      'Kraftig geometrisk og viskoelastisk dæmpning i fast gruslag (α = 0,055 m⁻¹).',
  },
};

export type PpvAlertLevel = 'EXCEEDED' | 'APPROACHING' | 'ELEVATED' | 'NOMINAL';

export interface ReceptorPpvRiskItem {
  targetId: string;
  targetCode: string;
  targetName: string;
  targetKind: 'receptor' | 'water_main';
  nearestSourceId: string;
  nearestSourceCode: string;
  nearestSourceName: string;
  distanceMeters: number;
  soilAttenuationPct: number;
  ppvMmPerSec: number;
  pctOf25Limit: number;
  alertLevel: PpvAlertLevel;
}

export interface PpvAttenuationCurvePoint {
  distanceMeters: number;
  ppvMmPerSec: number;
}

export interface PpvThresholdAlertEvaluation {
  alertLevel: PpvAlertLevel;
  isVisualWarningTriggered: boolean;
  isLimitExceeded: boolean;
  isApproachingLimit: boolean;
  peakPpvMmPerSec: number;
  din4150LimitMmPerSec: number;
  approachingThresholdMmPerSec: number;
  pctOfDin4150Limit: number;
  marginTo25MmPerSec: number;
  worstTargetCode: string;
  worstTargetName: string;
  worstTargetId: string;
  nearestSourceCode: string;
  nearestSourceName: string;
  nearestDistanceMeters: number;
  effectiveAlphaPerM: number;
  soilAttenuationPct: number;
  safeSetback25Meters: number;
  soilProfile: SoilVibrationProfileSpec;
  activeSourcesCount: number;
  effectiveMachineLwaDb: number;
  hasSteelRoadPlates: boolean;
  isSimulatedProximityActive: boolean;
  receptorRisks: ReceptorPpvRiskItem[];
  attenuationCurve: PpvAttenuationCurvePoint[];
  guidanceDa: string;
}

const REFERENCE_DISTANCE_R0_M = 2.0;
const BASE_V0_AT_2M_MM_S = 26.5;

/**
 * Bornitz jordvibrationsmodel for nedrivningsmateriel:
 * v(r) = v0 * (r0 / r)^n * exp(-alpha * (r - r0))
 */
export function computeBornitzPpvMmPerSec(params: {
  distanceMeters: number;
  sourceLwaDb: number;
  sourceEmissionFactor?: number;
  soilProfile: SoilVibrationProfileSpec;
  soilMoisture0To7cm?: number;
  precipitationMm?: number;
  hasSteelRoadPlates?: boolean;
}): {
  ppvMmPerSec: number;
  soilAttenuationPct: number;
  effectiveAlphaPerM: number;
} {
  const {
    distanceMeters,
    sourceLwaDb,
    sourceEmissionFactor = 1.0,
    soilProfile,
    soilMoisture0To7cm = 0.22,
    precipitationMm = 0,
    hasSteelRoadPlates = false,
  } = params;

  const rSlant = Math.max(
    REFERENCE_DISTANCE_R0_M,
    Math.hypot(Math.max(0.5, distanceMeters), 1.5)
  );

  // Våd/vandmættet jord mindsker effektiv absorptionsdæmpning og øger poretryks-kobling let
  const wetnessFactor =
    (precipitationMm > 2.0 ? 0.1 : 0) +
    Math.max(0, Math.min(0.12, (soilMoisture0To7cm - 0.2) * 0.6));
  const soilSaturationAmplifier =
    1.0 + wetnessFactor * soilProfile.moistureSensitivity;

  const effectiveAlphaPerM = Number(
    Math.max(
      0.015,
      soilProfile.alphaPerM * (1 - Math.min(0.18, wetnessFactor * 0.8))
    ).toFixed(4)
  );

  const dbScale = Math.pow(10, (Math.max(85, sourceLwaDb) - 114) / 22);
  const intensityScale = Math.max(0.55, Math.min(1.45, sourceEmissionFactor));
  // Køreplader (Wissenberg PSS) dæmper højfrekvent overfladeimpuls ca. 14%
  const plateFactor = hasSteelRoadPlates ? 0.86 : 1.0;

  const geometricDecay = Math.pow(
    REFERENCE_DISTANCE_R0_M / rSlant,
    soilProfile.geometricExpN
  );
  const materialDecay = Math.exp(
    -effectiveAlphaPerM * Math.max(0, rSlant - REFERENCE_DISTANCE_R0_M)
  );
  const totalTransmission = geometricDecay * materialDecay;

  const rawPpv =
    BASE_V0_AT_2M_MM_S *
    dbScale *
    intensityScale *
    soilSaturationAmplifier *
    plateFactor *
    totalTransmission;

  const ppvMmPerSec = Number(Math.max(0.1, Math.min(98, rawPpv)).toFixed(2));
  const soilAttenuationPct = Number(
    Math.max(0, Math.min(99.5, (1 - totalTransmission) * 100)).toFixed(1)
  );

  return { ppvMmPerSec, soilAttenuationPct, effectiveAlphaPerM };
}

export function classifyPpvAlertLevel(ppvMmPerSec: number): PpvAlertLevel {
  if (ppvMmPerSec >= DIN_4150_3_PPV_LIMIT_MM_S) return 'EXCEEDED';
  if (ppvMmPerSec >= PPV_APPROACHING_THRESHOLD_MM_S) return 'APPROACHING';
  if (ppvMmPerSec >= PPV_ELEVATED_THRESHOLD_MM_S) return 'ELEVATED';
  return 'NOMINAL';
}

export function computeSafeSetbackMeters25MmS(params: {
  sourceLwaDb: number;
  sourceEmissionFactor?: number;
  soilProfile: SoilVibrationProfileSpec;
  soilMoisture0To7cm?: number;
  precipitationMm?: number;
  hasSteelRoadPlates?: boolean;
}): number {
  for (let d = 2; d <= 80; d += 0.5) {
    const res = computeBornitzPpvMmPerSec({
      ...params,
      distanceMeters: d,
    });
    if (res.ppvMmPerSec < DIN_4150_3_PPV_LIMIT_MM_S) {
      return Number(d.toFixed(1));
    }
  }
  return 80;
}

export function evaluatePpvThresholdAlert(params: {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  currentWeather: HourlyWeatherPoint;
  precipitationOverrideMm?: number | null;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  soilProfileKey?: SoilVibrationProfileKey;
  hasSteelRoadPlates?: boolean;
  simulatedProximityOverrideM?: number | null;
  waterMainPipePpvMmPerSec?: number;
}): PpvThresholdAlertEvaluation {
  const {
    sources,
    receptors,
    currentWeather,
    precipitationOverrideMm = null,
    manualMachineNoiseOutputDb = 114,
    isManualMachineNoiseOverrideActive = false,
    soilProfileKey = 'moraine_clay',
    hasSteelRoadPlates = false,
    simulatedProximityOverrideM = null,
    waterMainPipePpvMmPerSec,
  } = params;

  const soilProfile =
    SOIL_VIBRATION_PROFILES[soilProfileKey] || SOIL_VIBRATION_PROFILES.moraine_clay;
  const activeSources = sources.filter((s) => s.active);
  const effectivePrecipMm =
    precipitationOverrideMm !== null
      ? Math.max(0, precipitationOverrideMm)
      : Math.max(0, currentWeather.precipitation);

  const effectiveMachineLwaDb = isManualMachineNoiseOverrideActive
    ? manualMachineNoiseOutputDb
    : 114;

  const isSimulatedProximityActive =
    typeof simulatedProximityOverrideM === 'number' &&
    Number.isFinite(simulatedProximityOverrideM) &&
    simulatedProximityOverrideM > 0;

  // Hvis ingen aktive kilder er slået til, returneres sikker nul-baseline
  if (activeSources.length === 0) {
    const curve: PpvAttenuationCurvePoint[] = Array.from(
      { length: 14 },
      (_, idx) => ({
        distanceMeters: idx === 0 ? 2 : idx * 5,
        ppvMmPerSec: 0,
      })
    );
    return {
      alertLevel: 'NOMINAL',
      isVisualWarningTriggered: false,
      isLimitExceeded: false,
      isApproachingLimit: false,
      peakPpvMmPerSec: 0,
      din4150LimitMmPerSec: DIN_4150_3_PPV_LIMIT_MM_S,
      approachingThresholdMmPerSec: PPV_APPROACHING_THRESHOLD_MM_S,
      pctOfDin4150Limit: 0,
      marginTo25MmPerSec: DIN_4150_3_PPV_LIMIT_MM_S,
      worstTargetCode: receptors[0]?.code ?? 'RING-01',
      worstTargetName: receptors[0]?.name ?? 'Ingen aktive kilder',
      worstTargetId: receptors[0]?.id ?? 'none',
      nearestSourceCode: '—',
      nearestSourceName: 'Alle kilder inaktive',
      nearestDistanceMeters: 0,
      effectiveAlphaPerM: soilProfile.alphaPerM,
      soilAttenuationPct: 100,
      safeSetback25Meters: 2,
      soilProfile,
      activeSourcesCount: 0,
      effectiveMachineLwaDb,
      hasSteelRoadPlates,
      isSimulatedProximityActive,
      receptorRisks: [],
      attenuationCurve: curve,
      guidanceDa:
        'Alle nedrivningskilder er inaktive — jordvibrationer er på baggrundsniveau (< 0,5 mm/s).',
    };
  }

  // Find global nærmeste kilde-receptor par (hvis proximity-override bruges)
  let globalMinPairKey = '';
  let globalMinDist = Infinity;
  receptors.forEach((rec) => {
    activeSources.forEach((src) => {
      const d = distanceBetweenPointsMeters(src.position, rec.center);
      if (d < globalMinDist) {
        globalMinDist = d;
        globalMinPairKey = `${rec.id}::${src.id}`;
      }
    });
  });

  const receptorRisks: ReceptorPpvRiskItem[] = receptors.map((rec) => {
    let sumSqPpv = 0;
    let nearestSource = activeSources[0];
    let minSourceDist = Infinity;
    let nearestAttenPct = 0;

    activeSources.forEach((src) => {
      const rawDist = Math.max(2, distanceBetweenPointsMeters(src.position, rec.center));
      const useOverride =
        isSimulatedProximityActive && `${rec.id}::${src.id}` === globalMinPairKey;
      const distM = useOverride ? Math.max(1.5, simulatedProximityOverrideM!) : rawDist;

      const srcLwa = isManualMachineNoiseOverrideActive
        ? manualMachineNoiseOutputDb
        : src.baseSoundPowerLwaDb ?? 114;

      const { ppvMmPerSec, soilAttenuationPct } = computeBornitzPpvMmPerSec({
        distanceMeters: distM,
        sourceLwaDb: srcLwa,
        sourceEmissionFactor: src.sourceEmissionFactor ?? 1.0,
        soilProfile,
        soilMoisture0To7cm: currentWeather.soilMoisture0To7cm,
        precipitationMm: effectivePrecipMm,
        hasSteelRoadPlates,
      });

      sumSqPpv += ppvMmPerSec * ppvMmPerSec;
      if (distM < minSourceDist) {
        minSourceDist = distM;
        nearestSource = src;
        nearestAttenPct = soilAttenuationPct;
      }
    });

    const combinedPpv = Number(Math.min(98, Math.sqrt(sumSqPpv)).toFixed(2));
    const pctOf25Limit = Math.round((combinedPpv / DIN_4150_3_PPV_LIMIT_MM_S) * 100);

    return {
      targetId: rec.id,
      targetCode: rec.code,
      targetName: rec.name,
      targetKind: 'receptor',
      nearestSourceId: nearestSource.id,
      nearestSourceCode: nearestSource.code,
      nearestSourceName: nearestSource.name,
      distanceMeters: Number(minSourceDist.toFixed(1)),
      soilAttenuationPct: nearestAttenPct,
      ppvMmPerSec: combinedPpv,
      pctOf25Limit,
      alertLevel: classifyPpvAlertLevel(combinedPpv),
    };
  });

  // Inkluder DN200 hovedvandledning på Kierulffsvej hvis den er angivet (eller ved simuleret nærhed)
  if (
    typeof waterMainPipePpvMmPerSec === 'number' &&
    Number.isFinite(waterMainPipePpvMmPerSec)
  ) {
    const primarySrc = activeSources[0];
    const wmPpv = Number(Math.max(0.1, waterMainPipePpvMmPerSec).toFixed(2));
    receptorRisks.push({
      targetId: 'kierulffsvej-dn200',
      targetCode: 'DN200',
      targetName: 'Kierulffsvej Hovedvandledning (1964 Eternit)',
      targetKind: 'water_main',
      nearestSourceId: primarySrc.id,
      nearestSourceCode: primarySrc.code,
      nearestSourceName: primarySrc.name,
      distanceMeters: 6.5,
      soilAttenuationPct: 58.0,
      ppvMmPerSec: wmPpv,
      pctOf25Limit: Math.round((wmPpv / DIN_4150_3_PPV_LIMIT_MM_S) * 100),
      alertLevel: classifyPpvAlertLevel(wmPpv),
    });
  }

  receptorRisks.sort((a, b) => b.ppvMmPerSec - a.ppvMmPerSec);
  const worst = receptorRisks[0];

  const peakPpvMmPerSec = worst?.ppvMmPerSec ?? 0;
  const alertLevel = classifyPpvAlertLevel(peakPpvMmPerSec);
  const isLimitExceeded = alertLevel === 'EXCEEDED';
  const isApproachingLimit = alertLevel === 'APPROACHING';
  const isVisualWarningTriggered = isLimitExceeded || isApproachingLimit;

  const pctOfDin4150Limit = Math.round(
    (peakPpvMmPerSec / DIN_4150_3_PPV_LIMIT_MM_S) * 100
  );
  const marginTo25MmPerSec = Number(
    (DIN_4150_3_PPV_LIMIT_MM_S - peakPpvMmPerSec).toFixed(1)
  );

  const dominantSrc =
    activeSources.find((s) => s.id === worst?.nearestSourceId) || activeSources[0];
  const dominantLwa = isManualMachineNoiseOverrideActive
    ? manualMachineNoiseOutputDb
    : dominantSrc?.baseSoundPowerLwaDb ?? 114;

  const safeSetback25Meters = computeSafeSetbackMeters25MmS({
    sourceLwaDb: dominantLwa,
    sourceEmissionFactor: dominantSrc?.sourceEmissionFactor ?? 1.0,
    soilProfile,
    soilMoisture0To7cm: currentWeather.soilMoisture0To7cm,
    precipitationMm: effectivePrecipMm,
    hasSteelRoadPlates,
  });

  const sampleDistances = [2, 4, 6, 8, 10, 14, 18, 22, 28, 35, 45, 55, 65];
  let effectiveAlphaPerM = soilProfile.alphaPerM;
  const attenuationCurve: PpvAttenuationCurvePoint[] = sampleDistances.map((d) => {
    const res = computeBornitzPpvMmPerSec({
      distanceMeters: d,
      sourceLwaDb: dominantLwa,
      sourceEmissionFactor: dominantSrc?.sourceEmissionFactor ?? 1.0,
      soilProfile,
      soilMoisture0To7cm: currentWeather.soilMoisture0To7cm,
      precipitationMm: effectivePrecipMm,
      hasSteelRoadPlates,
    });
    effectiveAlphaPerM = res.effectiveAlphaPerM;
    return {
      distanceMeters: d,
      ppvMmPerSec: res.ppvMmPerSec,
    };
  });

  const guidanceDa = isLimitExceeded
    ? `Øjeblikkelig maskinstop eller forøgelse af afstand til mindst ${safeSetback25Meters.toFixed(
        1
      )} m påkrævet ved ${worst.targetName}: PPV (${peakPpvMmPerSec.toFixed(
        1
      )} mm/s) overskrider DIN 4150-3 grænsen på 25,0 mm/s.`
    : isApproachingLimit
    ? `Advarsel: PPV (${peakPpvMmPerSec.toFixed(
        1
      )} mm/s · ${pctOfDin4150Limit}%) nærmer sig DIN 4150-3 grænsen på 25,0 mm/s ved ${
        worst.targetName
      }. Hold minimum ${safeSetback25Meters.toFixed(
        1
      )} m afstand, udlæg stålplader eller skift til vibrationsdæmpet betonklipper.`
    : alertLevel === 'ELEVATED'
    ? `Forhøjet vibrationsniveau ved ${worst.targetName} (${peakPpvMmPerSec.toFixed(
        1
      )} mm/s) — følg afstandsgrænse (${safeSetback25Meters.toFixed(1)} m) under tung mejsling.`
    : `Jordvibrationer inden for DIN 4150-3 sikkerhedsmargin (${peakPpvMmPerSec.toFixed(
        1
      )} / 25,0 mm/s).`;

  return {
    alertLevel,
    isVisualWarningTriggered,
    isLimitExceeded,
    isApproachingLimit,
    peakPpvMmPerSec,
    din4150LimitMmPerSec: DIN_4150_3_PPV_LIMIT_MM_S,
    approachingThresholdMmPerSec: PPV_APPROACHING_THRESHOLD_MM_S,
    pctOfDin4150Limit,
    marginTo25MmPerSec,
    worstTargetCode: worst?.targetCode ?? '—',
    worstTargetName: worst?.targetName ?? '—',
    worstTargetId: worst?.targetId ?? 'none',
    nearestSourceCode: worst?.nearestSourceCode ?? '—',
    nearestSourceName: worst?.nearestSourceName ?? '—',
    nearestDistanceMeters: worst?.distanceMeters ?? 0,
    effectiveAlphaPerM,
    soilAttenuationPct: worst?.soilAttenuationPct ?? 0,
    safeSetback25Meters,
    soilProfile,
    activeSourcesCount: activeSources.length,
    effectiveMachineLwaDb: dominantLwa,
    hasSteelRoadPlates,
    isSimulatedProximityActive,
    receptorRisks,
    attenuationCurve,
    guidanceDa,
  };
}
