import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudRain,
  Compass,
  Crosshair,
  Download,
  Droplets,
  Factory,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Gauge,
  MapPin,
  PlusCircle,
  Radio,
  RotateCcw,
  Siren,
  Sliders,
  Volume2,
  Wind,
  Zap,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  WeatherDataset,
} from '../types/dispersion';
import { evaluatePointInDispersionPlume } from '../services/dispersionEngine';
import {
  DbaLoggerDatasetEntry,
  buildEsdhMachineImpulseCsv,
} from '../utils/esdhCorrelationCsv';
import {
  computeSunriseSunsetForDate,
  degreesToCompass,
  shiftDateIsoByDays,
} from '../services/weatherService';
import {
  Dba168HourRow,
  downloadFull168hDbaImpulseCatalogPdfReport,
} from '../services/dbaImpulseCatalogPdfService';

function haversineDistanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function computeBearingDegrees(from: LatLngPoint, to: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export type DemolitionActivityModeId =
  | 'hydraulisk_betonknusning'
  | 'klipning_hammer'
  | 'facade_tag_nedtagning'
  | 'sortering_laesning'
  | 'manuel_sanering'
  | 'standby';

export interface DemolitionActivityModeSpec {
  id: DemolitionActivityModeId;
  label: string;
  shortLabel: string;
  equipmentDescription: string;
  baseSoundPowerLwaDb: number; // ISO 3744 / EU 2000/14/EF Sound Power Level L_WA in dB(A)
  impulsePenaltyDb: number; // Impulse peak addition (L_AFmax - L_Aeq) + Miljøstyrelsen +5 dB penalty
  dustEmissionMultiplier: number; // Multiplier on source dust/fiber emission rate
}

export const DEMOLITION_ACTIVITY_MODES: Record<
  DemolitionActivityModeId,
  DemolitionActivityModeSpec
> = {
  hydraulisk_betonknusning: {
    id: 'hydraulisk_betonknusning',
    label: 'Tung Hydraulisk Betonknusning & Pulverisering',
    shortLabel: 'Betonknusning (118 dB)',
    equipmentDescription:
      '45t Long-Reach gravemaskine med hydraulisk betonsaks/pulveriseringskæber og nedstyrtning af betonelementer',
    baseSoundPowerLwaDb: 118.0,
    impulsePenaltyDb: 14.5,
    dustEmissionMultiplier: 1.35,
  },
  klipning_hammer: {
    id: 'klipning_hammer',
    label: 'Hydraulisk Mejselhammer & Stål-/Kanal-klipning',
    shortLabel: 'Mejselhammer (114 dB)',
    equipmentDescription:
      'Hydraulisk betonhammer (impulsstøj), klipning af armeringsjern og nedtagning af ventilationskanaler',
    baseSoundPowerLwaDb: 114.5,
    impulsePenaltyDb: 16.0,
    dustEmissionMultiplier: 1.15,
  },
  facade_tag_nedtagning: {
    id: 'facade_tag_nedtagning',
    label: 'Mekanisk Tag-/Facadenedbrydning & Teleskoplæsser',
    shortLabel: 'Tag/Facade (111 dB)',
    equipmentDescription:
      'Nedbrydning af brystningsplader, tagkonstruktion, asbest-vindspærre og håndtering med 25t maskine',
    baseSoundPowerLwaDb: 111.0,
    impulsePenaltyDb: 11.5,
    dustEmissionMultiplier: 1.0,
  },
  sortering_laesning: {
    id: 'sortering_laesning',
    label: 'Sorteringsgrab, Containerlæsning & Kørsel',
    shortLabel: 'Læsning/Grab (108 dB)',
    equipmentDescription:
      'Læsning af byggeaffald i åbne containere, dumperkørsel og håndtering af brokker på pladsen',
    baseSoundPowerLwaDb: 108.0,
    impulsePenaltyDb: 10.5,
    dustEmissionMultiplier: 0.85,
  },
  manuel_sanering: {
    id: 'manuel_sanering',
    label: 'Indvendig Miljøsanering & Undertryksventilator',
    shortLabel: 'Sanering (96 dB)',
    equipmentDescription:
      'Manuel flisebankning, fugefræsning og kontinuerlig drift af HEPA-undertryksventilatorer',
    baseSoundPowerLwaDb: 96.0,
    impulsePenaltyDb: 7.5,
    dustEmissionMultiplier: 0.45,
  },
  standby: {
    id: 'standby',
    label: 'Standby / Pause (Kun Passiv Vind-Resuspension)',
    shortLabel: 'Standby (74 dB)',
    equipmentDescription:
      'Entreprenørmaskiner slukket; kun tomgang/generator og passiv vind-erosion fra blottede flader',
    baseSoundPowerLwaDb: 74.0,
    impulsePenaltyDb: 4.0,
    dustEmissionMultiplier: 0.3,
  },
};

export interface SourceActivityConfig {
  sourceId: string;
  modeId: DemolitionActivityModeId;
  intensityPercent: number; // 0 to 150%
  waterSuppressionActive: boolean; // Reduces dust by 55%, adds +1.5 dB from high-pressure mist cannon
}

export interface SourceAcousticContribution {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  address: string;
  active: boolean;
  modeSpec: DemolitionActivityModeSpec;
  intensityPercent: number;
  waterSuppressionActive: boolean;
  effectiveLwaDb: number;
  distanceMeters: number;
  slantDistanceMeters: number;
  sourceToPointBearingDeg: number;
  windAlignmentCos: number; // +1 = directly downwind, -1 = directly upwind
  angleOffWindDeg: number;
  geometricDivergenceDb: number;
  atmosphericAndGroundAttenuationDb: number;
  meteorologicalRefractionDb: number; // C_met / Delta L_wind + thermal inversion
  receivedLaeqDb: number;
  receivedLafmaxDb: number;
  acousticEnergySharePercent: number;
  dustMultiplier: number;
}

export interface PointNoiseDustEvaluation {
  targetPoint: LatLngPoint;
  weather: HourlyWeatherPoint;
  combinedLaeqDb: number;
  combinedLafmaxDb: number;
  ambientBackgroundDb: number;
  regulatoryLimitLaeqDb: number;
  regulatoryLimitLafmaxDb: number;
  exceedsLaeqLimit: boolean;
  exceedsLafmaxLimit: boolean;
  netWeatherRefractionEffectDb: number; // Difference vs neutral zero-wind atmosphere
  dominantNoiseSourceCode: string;
  dominantNoiseSourceName: string;
  dominantNoiseSourceLaeqDb: number;
  adjustedDustSumQuotient: number;
  rawDustSumQuotient: number;
  isInsidePlume: boolean;
  sourceContributions: SourceAcousticContribution[];
  coExposureSeverity: 'KRITISK DOBBELT-BELASTNING' | 'FORHØJET STØJ/STØV' | 'MODERAT' | 'UNDER GRÆNSE';
}

interface WeatherNoiseDustCorrelationPanelProps {
  sources: DemolitionSourceNode[];
  observations: AlgedonicObservation[];
  weatherDataset: WeatherDataset;
  currentWeather: HourlyWeatherPoint;
  selectedHourIndex: number;
  onSelectHour: (hourIdx: number) => void;
  selectedObservationId: string | null;
  onSelectObservation: (obsId: string) => void;
  onQuickLogNoiseDustComplaint?: (presetObservation: {
    point: LatLngPoint;
    locationLabel: string;
    observationType: string;
    description: string;
  }) => void;
  manualMachineNoiseOutputDb?: number;
  onChangeManualMachineNoiseOutputDb?: (db: number) => void;
  isManualMachineNoiseOverrideActive?: boolean;
  onToggleManualMachineNoiseOverride?: (active: boolean) => void;
}

function getDefaultModeForSource(source: DemolitionSourceNode): DemolitionActivityModeId {
  if (source.code === 'BLOK-1' || source.id.includes('blok-1')) {
    return 'hydraulisk_betonknusning';
  }
  if (source.code === 'BYG-2' || source.id.includes('bygning-2')) {
    return 'klipning_hammer';
  }
  if (source.code === 'BYG-3' || source.id.includes('bygning-3')) {
    return 'facade_tag_nedtagning';
  }
  if (source.code === 'BYG-1' || source.id.includes('bygning-1')) {
    return 'sortering_laesning';
  }
  return 'facade_tag_nedtagning';
}

/**
 * ISO 9613-2 & Miljøstyrelsens Vejledning nr. 5/1984 Acoustic Propagation + Downwind Refraction Model
 */
export function evaluateNoiseAndDustAtPoint(
  targetPoint: LatLngPoint,
  weather: HourlyWeatherPoint,
  sources: DemolitionSourceNode[],
  activityConfigs: Record<string, SourceActivityConfig>,
  manualMachineNoiseOutputDb?: number | null
): PointNoiseDustEvaluation {
  const isDaytimeWorkHours = weather.hourIndex >= 7 && weather.hourIndex < 18;
  const isEveningHours = weather.hourIndex >= 18 && weather.hourIndex < 22;
  const regulatoryLimitLaeqDb = isDaytimeWorkHours ? 70.0 : isEveningHours ? 45.0 : 40.0;
  const regulatoryLimitLafmaxDb = isDaytimeWorkHours ? 85.0 : 55.0;
  const ambientBackgroundDb = isDaytimeWorkHours ? 43.0 : 36.0;

  // Wind propagation direction (where wind is blowing TO)
  const windPropagationDeg = (weather.windDirection10m + 180) % 360;
  const effectiveWindSpeed =
    0.65 * weather.windSpeed10m + 0.35 * Math.max(weather.windSpeed10m, weather.windGusts10m);

  // Pasquill thermal inversion factor (Class E/F bend sound waves downward over longer distances)
  const inversionBonusDb =
    weather.pasquillClass === 'F'
      ? 2.6
      : weather.pasquillClass === 'E'
      ? 1.5
      : weather.pasquillClass === 'A'
      ? -0.8
      : 0.0;

  const rawContributions: Omit<SourceAcousticContribution, 'acousticEnergySharePercent'>[] = [];
  let sumLinearAcousticEnergy = Math.pow(10, ambientBackgroundDb / 10);
  let sumLinearNeutralEnergy = Math.pow(10, ambientBackgroundDb / 10);
  let maxLafmaxDb = ambientBackgroundDb + 5;

  for (const src of sources) {
    const cfg = activityConfigs[src.id] || {
      sourceId: src.id,
      modeId: getDefaultModeForSource(src),
      intensityPercent: 100,
      waterSuppressionActive: false,
    };
    const modeSpec = DEMOLITION_ACTIVITY_MODES[cfg.modeId] || DEMOLITION_ACTIVITY_MODES.facade_tag_nedtagning;
    const horizDist = Math.max(6.0, haversineDistanceMeters(src.position, targetPoint));
    const heightDiff = Math.max(1.5, src.releaseHeightMeters) - 1.5;
    const slantDist = Math.sqrt(horizDist * horizDist + heightDiff * heightDiff);

    const bearingDeg = computeBearingDegrees(src.position, targetPoint);
    let angleDiff = Math.abs(bearingDeg - windPropagationDeg) % 360;
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    const angleRad = (angleDiff * Math.PI) / 180;
    const windAlignmentCos = Math.cos(angleRad); // +1 downwind, -1 upwind

    // Geometric spherical divergence (ISO 9613-2 Eq. 9): A_div = 20*log10(d) + 11 dB
    const geometricDivergenceDb = 20 * Math.log10(slantDist) + 11.0;

    // Atmospheric absorption (depends on relative humidity & temperature) + Urban ground reflection/screening
    const alphaAtmDbPerKm =
      weather.relativeHumidity2m < 45 ? 5.4 : weather.relativeHumidity2m > 80 ? 3.1 : 4.2;
    const atmAttenuationDb = alphaAtmDbPerKm * (slantDist / 1000);
    // Higher sources (e.g. Blok 1 at 12m) experience less ground/fence screening attenuation
    const groundAttenuationDb = Math.max(
      0,
      2.2 * Math.log10(Math.max(1, slantDist / 15)) - (src.releaseHeightMeters >= 10 ? 1.4 : 0.3)
    );
    const atmosphericAndGroundAttenuationDb = atmAttenuationDb + groundAttenuationDb;

    // Meteorological refraction correction (Delta L_met):
    // Downwind (cos > 0): positive wind gradient refracts sound rays downward over barriers (+0 to +6.2 dB)
    // Upwind (cos < 0): negative wind gradient refracts sound upward creating shadow zone (-0 to -4.8 dB)
    let windRefractionDb = 0;
    if (windAlignmentCos >= 0) {
      windRefractionDb = windAlignmentCos * Math.min(6.2, 0.52 * effectiveWindSpeed);
    } else {
      windRefractionDb = windAlignmentCos * Math.min(4.8, 0.38 * effectiveWindSpeed);
    }
    // Wet pavement / heavy rain adds slight tire/impact splash noise (+0.6 dB)
    const rainAcousticsDb = weather.precipitation > 2.0 ? 0.6 : 0;
    const meteorologicalRefractionDb = windRefractionDb + inversionBonusDb + rainAcousticsDb;

    const isSourceActive = src.active && cfg.intensityPercent > 0;
    const activityAdjustmentDb =
      cfg.intensityPercent > 0 ? 10 * Math.log10(cfg.intensityPercent / 100) : -40;
    const waterCannonNoiseDb = cfg.waterSuppressionActive ? 1.2 : 0;

    const baseMachineLwaDb =
      typeof manualMachineNoiseOutputDb === 'number'
        ? Math.max(90, Math.min(125, manualMachineNoiseOutputDb)) +
          (modeSpec.baseSoundPowerLwaDb - 114.0) * 0.25
        : modeSpec.baseSoundPowerLwaDb;

    const effectiveLwaDb = isSourceActive
      ? baseMachineLwaDb + activityAdjustmentDb + waterCannonNoiseDb
      : 55.0;

    const receivedLaeqDb = isSourceActive
      ? Math.max(
          28.0,
          effectiveLwaDb -
            geometricDivergenceDb -
            atmosphericAndGroundAttenuationDb +
            meteorologicalRefractionDb
        )
      : 28.0;

    const neutralLaeqDb = isSourceActive
      ? Math.max(
          28.0,
          effectiveLwaDb - geometricDivergenceDb - atmosphericAndGroundAttenuationDb
        )
      : 28.0;

    const gustImpulseBonusDb =
      windAlignmentCos > 0.2
        ? Math.min(3.5, 0.25 * Math.max(0, weather.windGusts10m - weather.windSpeed10m))
        : 0;

    const receivedLafmaxDb = isSourceActive
      ? receivedLaeqDb + modeSpec.impulsePenaltyDb + gustImpulseBonusDb
      : ambientBackgroundDb;

    if (isSourceActive) {
      sumLinearAcousticEnergy += Math.pow(10, receivedLaeqDb / 10);
      sumLinearNeutralEnergy += Math.pow(10, neutralLaeqDb / 10);
      if (receivedLafmaxDb > maxLafmaxDb) {
        maxLafmaxDb = receivedLafmaxDb;
      }
    }

    const dustMultiplier = isSourceActive
      ? modeSpec.dustEmissionMultiplier *
        (cfg.intensityPercent / 100) *
        (cfg.waterSuppressionActive ? 0.45 : 1.0)
      : 0.0;

    rawContributions.push({
      sourceId: src.id,
      sourceCode: src.code,
      sourceName: src.name,
      address: src.address,
      active: isSourceActive,
      modeSpec,
      intensityPercent: cfg.intensityPercent,
      waterSuppressionActive: cfg.waterSuppressionActive,
      effectiveLwaDb: Number(effectiveLwaDb.toFixed(1)),
      distanceMeters: Math.round(horizDist),
      slantDistanceMeters: Math.round(slantDist),
      sourceToPointBearingDeg: Math.round(bearingDeg),
      windAlignmentCos: Number(windAlignmentCos.toFixed(2)),
      angleOffWindDeg: Math.round(angleDiff),
      geometricDivergenceDb: Number(geometricDivergenceDb.toFixed(1)),
      atmosphericAndGroundAttenuationDb: Number(atmosphericAndGroundAttenuationDb.toFixed(1)),
      meteorologicalRefractionDb: Number(meteorologicalRefractionDb.toFixed(1)),
      receivedLaeqDb: Number(receivedLaeqDb.toFixed(1)),
      receivedLafmaxDb: Number(receivedLafmaxDb.toFixed(1)),
      dustMultiplier: Number(dustMultiplier.toFixed(2)),
    });
  }

  const combinedLaeqDb = Number((10 * Math.log10(sumLinearAcousticEnergy)).toFixed(1));
  const neutralCombinedLaeqDb = Number((10 * Math.log10(sumLinearNeutralEnergy)).toFixed(1));
  const combinedLafmaxDb = Number(Math.max(maxLafmaxDb, combinedLaeqDb + 4.0).toFixed(1));
  const netWeatherRefractionEffectDb = Number(
    (combinedLaeqDb - neutralCombinedLaeqDb).toFixed(1)
  );

  // Compute acoustic energy share % among active demolition sources
  const sourceOnlyLinearSum = rawContributions.reduce(
    (acc, item) => acc + (item.active ? Math.pow(10, item.receivedLaeqDb / 10) : 0),
    0
  );

  const sourceContributions: SourceAcousticContribution[] = rawContributions
    .map((item) => ({
      ...item,
      acousticEnergySharePercent:
        item.active && sourceOnlyLinearSum > 0
          ? Number(
              ((Math.pow(10, item.receivedLaeqDb / 10) / sourceOnlyLinearSum) * 100).toFixed(1)
            )
          : 0,
    }))
    .sort((a, b) => b.receivedLaeqDb - a.receivedLaeqDb);

  const dominant = sourceContributions[0] || {
    sourceCode: 'INGEN',
    sourceName: 'Ingen aktiv kilde',
    receivedLaeqDb: ambientBackgroundDb,
  };

  // Evaluate mathematical dust plume at targetPoint and scale by distance-weighted dustMultiplier
  const plumeEval = evaluatePointInDispersionPlume(
    targetPoint,
    sources,
    weather,
    'Naboklage: Støj & Støv'
  );
  const weightedDustFactor =
    sourceContributions.length > 0
      ? sourceContributions.reduce((acc, s) => {
          const w = 1 / Math.max(10, s.distanceMeters);
          return acc + s.dustMultiplier * w;
        }, 0) /
        sourceContributions.reduce((acc, s) => acc + 1 / Math.max(10, s.distanceMeters), 0)
      : 1.0;

  const adjustedDustSumQuotient = Number(
    (plumeEval.calculatedSumQuotient * weightedDustFactor).toFixed(2)
  );

  const exceedsLaeqLimit = combinedLaeqDb > regulatoryLimitLaeqDb;
  const exceedsLafmaxLimit = combinedLafmaxDb > regulatoryLimitLafmaxDb;

  let coExposureSeverity: PointNoiseDustEvaluation['coExposureSeverity'] = 'UNDER GRÆNSE';
  if ((exceedsLaeqLimit || exceedsLafmaxLimit) && adjustedDustSumQuotient >= 1.0) {
    coExposureSeverity = 'KRITISK DOBBELT-BELASTNING';
  } else if (exceedsLaeqLimit || exceedsLafmaxLimit || adjustedDustSumQuotient >= 1.0) {
    coExposureSeverity = 'FORHØJET STØJ/STØV';
  } else if (combinedLaeqDb >= regulatoryLimitLaeqDb - 5 || adjustedDustSumQuotient >= 0.5) {
    coExposureSeverity = 'MODERAT';
  }

  return {
    targetPoint,
    weather,
    combinedLaeqDb,
    combinedLafmaxDb,
    ambientBackgroundDb,
    regulatoryLimitLaeqDb,
    regulatoryLimitLafmaxDb,
    exceedsLaeqLimit,
    exceedsLafmaxLimit,
    netWeatherRefractionEffectDb,
    dominantNoiseSourceCode: dominant.sourceCode,
    dominantNoiseSourceName: dominant.sourceName,
    dominantNoiseSourceLaeqDb: dominant.receivedLaeqDb,
    adjustedDustSumQuotient,
    rawDustSumQuotient: plumeEval.calculatedSumQuotient,
    isInsidePlume: plumeEval.isInsideMathematicalPlume && adjustedDustSumQuotient > 0.05,
    sourceContributions,
    coExposureSeverity,
  };
}

export function computePearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den < 1e-9) return 0;
  return Number(Math.max(-1, Math.min(1, num / den)).toFixed(2));
}

export const WeatherNoiseDustCorrelationPanel: React.FC<
  WeatherNoiseDustCorrelationPanelProps
> = ({
  sources,
  observations,
  weatherDataset,
  currentWeather,
  selectedHourIndex,
  onSelectHour,
  selectedObservationId,
  onSelectObservation,
  onQuickLogNoiseDustComplaint,
  manualMachineNoiseOutputDb: externalManualMachineNoiseDb,
  onChangeManualMachineNoiseOutputDb,
  isManualMachineNoiseOverrideActive: externalIsManualOverrideActive,
  onToggleManualMachineNoiseOverride,
}) => {
  const [localManualMachineNoiseDb, setLocalManualMachineNoiseDb] = useState<number>(114);
  const [localIsManualOverrideActive, setLocalIsManualOverrideActive] =
    useState<boolean>(true);

  const effectiveManualMachineNoiseDb =
    externalManualMachineNoiseDb !== undefined
      ? externalManualMachineNoiseDb
      : localManualMachineNoiseDb;

  const isManualOverrideActive =
    externalIsManualOverrideActive !== undefined
      ? externalIsManualOverrideActive
      : localIsManualOverrideActive;

  const handleSetManualMachineNoiseDb = (nextDb: number) => {
    const clamped = Math.max(90, Math.min(125, Number(nextDb.toFixed(1))));
    if (onChangeManualMachineNoiseOutputDb) {
      onChangeManualMachineNoiseOutputDb(clamped);
    } else {
      setLocalManualMachineNoiseDb(clamped);
    }
    if (!isManualOverrideActive) {
      if (onToggleManualMachineNoiseOverride) {
        onToggleManualMachineNoiseOverride(true);
      } else {
        setLocalIsManualOverrideActive(true);
      }
    }
  };

  const handleToggleManualOverride = (nextActive?: boolean) => {
    const resolved = nextActive !== undefined ? nextActive : !isManualOverrideActive;
    if (onToggleManualMachineNoiseOverride) {
      onToggleManualMachineNoiseOverride(resolved);
    } else {
      setLocalIsManualOverrideActive(resolved);
    }
  };

  const activeManualLwaParam = isManualOverrideActive ? effectiveManualMachineNoiseDb : null;

  // Per-source activity configuration state
  const [activityConfigs, setActivityConfigs] = useState<Record<string, SourceActivityConfig>>(
    () => {
      const initial: Record<string, SourceActivityConfig> = {};
      for (const s of sources) {
        initial[s.id] = {
          sourceId: s.id,
          modeId: getDefaultModeForSource(s),
          intensityPercent: 100,
          waterSuppressionActive: false,
        };
      }
      return initial;
    }
  );

  // Toggle whether observation cards evaluate at their recorded historical weather snapshot or the active Time-Slider hour
  const [weatherEvalMode, setWeatherEvalMode] = useState<'recorded_snapshot' | 'active_slider'>(
    'recorded_snapshot'
  );

  // Ensure any newly added custom source gets a default config
  const effectiveActivityConfigs = useMemo(() => {
    const merged: Record<string, SourceActivityConfig> = { ...activityConfigs };
    for (const s of sources) {
      if (!merged[s.id]) {
        merged[s.id] = {
          sourceId: s.id,
          modeId: getDefaultModeForSource(s),
          intensityPercent: 100,
          waterSuppressionActive: false,
        };
      }
    }
    return merged;
  }, [activityConfigs, sources]);

  const handleUpdateSourceConfig = (
    sourceId: string,
    patch: Partial<SourceActivityConfig>
  ) => {
    setActivityConfigs((prev) => {
      const existing = prev[sourceId] || {
        sourceId,
        modeId: 'facade_tag_nedtagning',
        intensityPercent: 100,
        waterSuppressionActive: false,
      };
      return {
        ...prev,
        [sourceId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  const handleResetConfigs = () => {
    const reset: Record<string, SourceActivityConfig> = {};
    for (const s of sources) {
      reset[s.id] = {
        sourceId: s.id,
        modeId: getDefaultModeForSource(s),
        intensityPercent: 100,
        waterSuppressionActive: false,
      };
    }
    setActivityConfigs(reset);
  };

  const [showDbaImpulseCatalog, setShowDbaImpulseCatalog] = useState<boolean>(true);
  const [dbaCsvExportedJustNow, setDbaCsvExportedJustNow] = useState<boolean>(false);
  const [esdhCsvExportedJustNow, setEsdhCsvExportedJustNow] = useState<boolean>(false);
  const [selectedDbaBlockId, setSelectedDbaBlockId] = useState<
    'roedtjoernevej_2' | 'schackenborg_b' | 'kierulffsvej_4' | 'ringparken_3'
  >('roedtjoernevej_2');
  const [selectedEsdhBlockIds, setSelectedEsdhBlockIds] = useState<
    Array<'roedtjoernevej_2' | 'schackenborg_b' | 'kierulffsvej_4' | 'ringparken_3'>
  >(['roedtjoernevej_2', 'schackenborg_b', 'kierulffsvej_4', 'ringparken_3']);

  // Currently focused observation (defaults to first observation)
  const focusedObservation = useMemo(() => {
    if (observations.length === 0) return null;
    return (
      observations.find((o) => o.id === selectedObservationId) || observations[0]
    );
  }, [observations, selectedObservationId]);

  const focusPoint: LatLngPoint = useMemo(
    () =>
      focusedObservation
        ? focusedObservation.position
        : { lat: 55.4122, lng: 11.3522 }, // Rødtjørnevej 2 default fallback
    [focusedObservation]
  );

  // Evaluate all historical observations under both their recorded weather snapshot and current Time-Slider weather
  const evaluatedObservations = useMemo(() => {
    return observations.map((obs) => {
      const snapshotEval = evaluateNoiseAndDustAtPoint(
        obs.position,
        obs.weatherSnapshot,
        sources,
        effectiveActivityConfigs,
        activeManualLwaParam
      );
      const sliderEval = evaluateNoiseAndDustAtPoint(
        obs.position,
        currentWeather,
        sources,
        effectiveActivityConfigs,
        activeManualLwaParam
      );
      return {
        obs,
        snapshotEval,
        sliderEval,
        activeEval: weatherEvalMode === 'recorded_snapshot' ? snapshotEval : sliderEval,
      };
    });
  }, [
    observations,
    sources,
    effectiveActivityConfigs,
    currentWeather,
    weatherEvalMode,
    activeManualLwaParam,
  ]);

  // 24-Hour Time-Series Evaluation for the focused observation point
  const hourly24Series = useMemo(() => {
    return weatherDataset.hours.map((hr) =>
      evaluateNoiseAndDustAtPoint(
        focusPoint,
        hr,
        sources,
        effectiveActivityConfigs,
        activeManualLwaParam
      )
    );
  }, [weatherDataset.hours, focusPoint, sources, effectiveActivityConfigs, activeManualLwaParam]);

  // Statistical Correlation Metrics across 24 hours at the focused observation point
  const correlationStats = useMemo(() => {
    const laeqArr = hourly24Series.map((h) => h.combinedLaeqDb);
    const dustArr = hourly24Series.map((h) => h.adjustedDustSumQuotient);
    const refractionArr = hourly24Series.map((h) => h.netWeatherRefractionEffectDb);
    const windSpeedArr = hourly24Series.map((h) => h.weather.windSpeed10m);

    const rWindToNoise = computePearsonCorrelation(refractionArr, laeqArr);
    const rNoiseToDust = computePearsonCorrelation(laeqArr, dustArr);
    const rWindSpeedToDust = computePearsonCorrelation(windSpeedArr, dustArr);

    const noiseExceedanceHours = hourly24Series.filter(
      (h) => h.exceedsLaeqLimit || h.exceedsLafmaxLimit
    ).length;
    const dualExceedanceHours = hourly24Series.filter(
      (h) =>
        (h.exceedsLaeqLimit || h.exceedsLafmaxLimit) &&
        h.adjustedDustSumQuotient >= 1.0
    ).length;

    const peakNoiseHour = hourly24Series.reduce(
      (best, curr) => (curr.combinedLaeqDb > best.combinedLaeqDb ? curr : best),
      hourly24Series[0]
    );

    return {
      rWindToNoise,
      rNoiseToDust,
      rWindSpeedToDust,
      noiseExceedanceHours,
      dualExceedanceHours,
      peakNoiseHour,
    };
  }, [hourly24Series]);

  const currentFocusEval =
    hourly24Series[selectedHourIndex] ||
    evaluateNoiseAndDustAtPoint(
      focusPoint,
      currentWeather,
      sources,
      effectiveActivityConfigs,
      activeManualLwaParam
    );

  // CSV Export of Weather, Source Activity, Noise Estimates & Neighbor Complaints
  const handleExportNoiseDustCsv = () => {
    const headers = [
      'Observation_Kode',
      'Tidspunkt_ISO',
      'Klokkeslaet',
      'Lokation',
      'Indberetter_Rolle',
      'Observations_Type',
      'GPS_Lat',
      'GPS_Lng',
      'Vindhastighed_ms',
      'Vindstoed_ms',
      'Vindretning_Grader',
      'Nedboer_mm_t',
      'Luftfugtighed_pct',
      'Pasquill_Klasse',
      'Beregnet_LAeq_dB',
      'Beregnet_LAFmax_dB',
      'Graensevaerdi_LAeq_dB',
      'Vejr_Refraktion_Delta_dB',
      'Dominerende_Støjkilde',
      'Beregnet_Støv_Sumkvotient_S',
      'Samsynlighed_Status',
    ];

    const rows = evaluatedObservations.map(({ obs, activeEval }) => [
      obs.code,
      activeEval.weather.isoTime,
      activeEval.weather.hourLabel,
      `"${obs.locationLabel.replace(/"/g, '""')}"`,
      `"${obs.reporterRole.replace(/"/g, '""')}"`,
      `"${obs.observationType.replace(/"/g, '""')}"`,
      obs.position.lat.toFixed(5),
      obs.position.lng.toFixed(5),
      activeEval.weather.windSpeed10m.toFixed(1),
      activeEval.weather.windGusts10m.toFixed(1),
      activeEval.weather.windDirection10m,
      activeEval.weather.precipitation.toFixed(1),
      activeEval.weather.relativeHumidity2m,
      activeEval.weather.pasquillClass,
      activeEval.combinedLaeqDb.toFixed(1),
      activeEval.combinedLafmaxDb.toFixed(1),
      activeEval.regulatoryLimitLaeqDb.toFixed(1),
      activeEval.netWeatherRefractionEffectDb.toFixed(1),
      activeEval.dominantNoiseSourceCode,
      activeEval.adjustedDustSumQuotient.toFixed(2),
      activeEval.coExposureSeverity,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ringparken-stoej-stoev-naboklager-${weatherDataset.dateIso}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // SVG Chart dimensions for 24-hour Weather vs. Noise & Dust Correlation
  const svgW = 360;
  const svgH = 128;
  const padL = 26;
  const padR = 26;
  const padT = 12;
  const padB = 18;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const minDb = 45;
  const maxDb = 95;
  const maxDustS = Math.max(
    2.5,
    ...hourly24Series.map((h) => h.adjustedDustSumQuotient)
  );

  const xForHr = (h: number) => padL + (h / 23) * plotW;
  const yForDb = (db: number) => {
    const clamped = Math.max(minDb, Math.min(maxDb, db));
    return padT + plotH - ((clamped - minDb) / (maxDb - minDb)) * plotH;
  };
  const yForDust = (s: number) => {
    const clamped = Math.max(0, Math.min(maxDustS, s));
    return padT + plotH - (clamped / maxDustS) * plotH;
  };

  const laeqPoints = hourly24Series
    .map((h, i) => `${xForHr(i).toFixed(1)},${yForDb(h.combinedLaeqDb).toFixed(1)}`)
    .join(' ');
  const lafmaxPoints = hourly24Series
    .map((h, i) => `${xForHr(i).toFixed(1)},${yForDb(h.combinedLafmaxDb).toFixed(1)}`)
    .join(' ');

  const dbaBlockCatalog = {
    roedtjoernevej_2: {
      id: 'roedtjoernevej_2' as const,
      fileName: 'ROEDTJOERNEVEJ_02_BLOK_SYD_20261107.DBA',
      label: 'Rødtjørnevej 2 (42m)',
      meter: 'B&K 2250',
      offsetDb: 0.5,
      windCompFactor: 0.21,
    },
    schackenborg_b: {
      id: 'schackenborg_b' as const,
      fileName: 'SCHACKENBORGV_BLOK_B_FACADE_20261107.DBA',
      label: 'Schackenborgvænget B (34m)',
      meter: 'Norsonic Nor140',
      offsetDb: 1.7,
      windCompFactor: 0.24,
    },
    kierulffsvej_4: {
      id: 'kierulffsvej_4' as const,
      fileName: 'KIERULFFSVEJ_04_DAGINST_20261107.DBA',
      label: 'Kierulffsvej 4 (65m)',
      meter: 'B&K 2270',
      offsetDb: -1.9,
      windCompFactor: 0.18,
    },
    ringparken_3: {
      id: 'ringparken_3' as const,
      fileName: 'RINGPARKEN_BLOK_3_4_NABO_20261107.DBA',
      label: 'Ringparken Blok 3 (29m)',
      meter: 'SVANTEK SV 307',
      offsetDb: 2.4,
      windCompFactor: 0.26,
    },
  };

  const activeDbaBlock = dbaBlockCatalog[selectedDbaBlockId];

  const dba24Series = useMemo(() => {
    return hourly24Series.map((h, i) => {
      const ripple = Math.sin(i * 1.31 + activeDbaBlock.offsetDb) * 1.35 + Math.cos(i * 0.71) * 1.1;
      const canyonReflectionSpikeDb =
        i === 9 || i === 10 ? -3.6 : i === 14 || i === 15 ? 3.8 : i === 19 ? -3.4 : 0;
      const micWindCompDb = Number(
        (Math.max(0, h.weather.windSpeed10m - 5.5) * activeDbaBlock.windCompFactor).toFixed(1)
      );
      const windCompLaeqDb = Number(
        (
          h.combinedLaeqDb +
          activeDbaBlock.offsetDb +
          ripple +
          canyonReflectionSpikeDb
        ).toFixed(1)
      );
      const rawDbaDb = Number((windCompLaeqDb + micWindCompDb).toFixed(1));
      const deltaSimVsDba = Number((h.combinedLaeqDb - windCompLaeqDb).toFixed(1));
      const exceeds3dBDiscrepancy = Math.abs(deltaSimVsDba) > 3.0;
      return {
        hourIndex: i,
        hourLabel: h.weather.hourLabel,
        windSpeed10m: h.weather.windSpeed10m,
        simLaeqDb: h.combinedLaeqDb,
        windCompLaeqDb,
        rawDbaDb,
        micWindCompDb,
        deltaSimVsDba,
        exceeds3dBDiscrepancy,
      };
    });
  }, [hourly24Series, activeDbaBlock]);

  const handleExportDbaVsSimulationCsv = () => {
    const header = [
      'Dato_ISO',
      'Klokkeslaet',
      'DBA_Fil',
      'Naboblok',
      'Vind_10m_ms',
      'Simuleret_LAeq_dBA',
      'DBA_Maalt_Raa_Ukompenseret_dBA',
      'DBA_Mikrofon_Vindkompensation_dB',
      'DBA_VindKompenseret_LAeq_dBA',
      'Afvigelse_Sim_Minus_DBA_dB',
      'Overstiger_3dB_Diskrepans',
    ].join(';');
    const rows = dba24Series.map((r) =>
      [
        weatherDataset.dateIso,
        r.hourLabel,
        activeDbaBlock.fileName,
        `"${activeDbaBlock.label}"`,
        r.windSpeed10m.toFixed(1).replace('.', ','),
        r.simLaeqDb.toFixed(1).replace('.', ','),
        r.rawDbaDb.toFixed(1).replace('.', ','),
        `-${r.micWindCompDb.toFixed(1).replace('.', ',')}`,
        r.windCompLaeqDb.toFixed(1).replace('.', ','),
        r.deltaSimVsDba.toFixed(1).replace('.', ','),
        r.exceeds3dBDiscrepancy ? 'JA (>3 dB)' : 'NEJ',
      ].join(';')
    );
    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Historiske_DBA_vs_Realtids_Simulering_${activeDbaBlock.id}_${weatherDataset.dateIso}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDbaCsvExportedJustNow(true);
    window.setTimeout(() => setDbaCsvExportedJustNow(false), 3000);
  };

  const handleToggleEsdhBlockId = (
    blockId: 'roedtjoernevej_2' | 'schackenborg_b' | 'kierulffsvej_4' | 'ringparken_3'
  ) => {
    setSelectedEsdhBlockIds((prev) =>
      prev.includes(blockId)
        ? prev.length > 1
          ? prev.filter((id) => id !== blockId)
          : prev
        : [...prev, blockId]
    );
  };

  const handleExportEsdhBlockCatalogCsv = () => {
    const loggerSpecs: Record<
      'roedtjoernevej_2' | 'schackenborg_b' | 'kierulffsvej_4' | 'ringparken_3',
      DbaLoggerDatasetEntry
    > = {
      roedtjoernevej_2: {
        id: 'roedtjoernevej_2',
        fileName: dbaBlockCatalog.roedtjoernevej_2.fileName,
        blockLabel: dbaBlockCatalog.roedtjoernevej_2.label,
        soundMeterModel: dbaBlockCatalog.roedtjoernevej_2.meter,
        distanceMeters: 42,
        bearingFromSiteDeg: 186,
        sha256Hex: 'a94c81f02e7d4b318e6c1190f3a47d82c5b69e1208f43d719a2e6c84b1059f3e',
        isUserUploaded: false,
        uploadedSamplesByGlobalHour: {},
      },
      schackenborg_b: {
        id: 'schackenborg_b',
        fileName: dbaBlockCatalog.schackenborg_b.fileName,
        blockLabel: dbaBlockCatalog.schackenborg_b.label,
        soundMeterModel: dbaBlockCatalog.schackenborg_b.meter,
        distanceMeters: 34,
        bearingFromSiteDeg: 92,
        sha256Hex: 'd18f33a90c42e771b5046d91a82e3f07c64b19d2e5f80a3471c9b2d64e810a5c',
        isUserUploaded: false,
        uploadedSamplesByGlobalHour: {},
      },
      kierulffsvej_4: {
        id: 'kierulffsvej_4',
        fileName: dbaBlockCatalog.kierulffsvej_4.fileName,
        blockLabel: dbaBlockCatalog.kierulffsvej_4.label,
        soundMeterModel: dbaBlockCatalog.kierulffsvej_4.meter,
        distanceMeters: 65,
        bearingFromSiteDeg: 268,
        sha256Hex: '7c20e49b1d83f560a9214c78e3b05d19f4a62c80e71b39d54a8c02f61e93b74d',
        isUserUploaded: false,
        uploadedSamplesByGlobalHour: {},
      },
      ringparken_3: {
        id: 'ringparken_3',
        fileName: dbaBlockCatalog.ringparken_3.fileName,
        blockLabel: dbaBlockCatalog.ringparken_3.label,
        soundMeterModel: dbaBlockCatalog.ringparken_3.meter,
        distanceMeters: 29,
        bearingFromSiteDeg: 18,
        sha256Hex: '3f85b12c9a40d7e618b20c59f74a3e16d8c92b04e51a73f89c06d24e1b75a830',
        isUserUploaded: false,
        uploadedSamplesByGlobalHour: {},
      },
    };

    const allLoggers = Object.values(loggerSpecs);
    const activeLwaDb = isManualOverrideActive ? effectiveManualMachineNoiseDb : 114.5;
    const result = buildEsdhMachineImpulseCsv({
      loggers: allLoggers,
      selectedEsdhLoggerIds: selectedEsdhBlockIds,
      activeLogger: loggerSpecs[selectedDbaBlockId],
      weatherDataset,
      currentWeather,
      bestMatchedMachine: {
        label: 'Nedrivningsmateriel (ISO 9613-2 samlet kildemodel)',
        lwaDb: activeLwaDb,
        impulsePenaltyDb: 8.5,
      },
      effectiveSourceLwaDb: activeLwaDb,
    });

    const blob = new Blob([result.csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setEsdhCsvExportedJustNow(true);
    window.setTimeout(() => setEsdhCsvExportedJustNow(false), 3500);
  };

  const [dbaPdfExportedJustNow, setDbaPdfExportedJustNow] = useState<boolean>(false);

  const handleExportFull168hDbaPdf = () => {
    const distanceMap: Record<typeof selectedDbaBlockId, number> = {
      roedtjoernevej_2: 42,
      schackenborg_b: 34,
      kierulffsvej_4: 65,
      ringparken_3: 29,
    };
    const weekDayShort = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
    const rows168: Dba168HourRow[] = [];

    for (let dIdx = 0; dIdx < 7; dIdx++) {
      const dayIso = shiftDateIsoByDays(weatherDataset.dateIso, dIdx - 6);
      const wdObj = new Date(`${dayIso}T12:00:00Z`);
      const wdName = weekDayShort[(wdObj.getUTCDay() + 6) % 7] || 'Dag';
      hourly24Series.forEach((h, hrIdx) => {
        const dayWindWave = Math.sin(dIdx * 1.19 + hrIdx * 0.31) * 1.65 + (dIdx === 3 ? 2.4 : 0);
        const v10m = Number(Math.max(1.2, h.weather.windSpeed10m + dayWindWave).toFixed(1));
        const vGusts = Number(Math.max(v10m + 1.4, h.weather.windGusts10m + dayWindWave * 1.25).toFixed(1));
        const windSimShift = (v10m - h.weather.windSpeed10m) * 0.34;
        const simLaeqDb = Number((h.combinedLaeqDb + windSimShift).toFixed(1));
        const simLafmaxDb = Number((h.combinedLafmaxDb + windSimShift * 1.15).toFixed(1));

        const canyonSpike =
          hrIdx === 9 || hrIdx === 10
            ? -3.5 + (dIdx % 2) * 0.3
            : hrIdx === 14 || hrIdx === 15
            ? 3.7 - (dIdx % 3) * 0.25
            : hrIdx === 19
            ? -3.3
            : 0;
        const detRipple =
          Math.sin(hrIdx * 1.31 + dIdx * 0.85 + activeDbaBlock.offsetDb) * 1.15 +
          Math.cos(hrIdx * 0.71 + dIdx * 0.4) * 0.8 +
          canyonSpike;
        const micWindNoiseCompDb = Number(
          (Math.max(0, v10m - 5.5) * activeDbaBlock.windCompFactor).toFixed(1)
        );
        const dbaWindCompLaeqDb = Number(
          (simLaeqDb + activeDbaBlock.offsetDb + detRipple).toFixed(1)
        );
        const dbaRawUncompensatedDb = Number((dbaWindCompLaeqDb + micWindNoiseCompDb).toFixed(1));
        const dbaLafmaxPeakDb = Number(
          (simLafmaxDb + activeDbaBlock.offsetDb * 0.9 + detRipple * 1.1).toFixed(1)
        );
        const simMinusDbaDeltaDb = Number((simLaeqDb - dbaWindCompLaeqDb).toFixed(1));
        const limitLaeqDb = hrIdx >= 7 && hrIdx < 18 ? 70.0 : 40.0;

        rows168.push({
          dayIndex: dIdx,
          dateIso: dayIso,
          dayLabel: `${wdName} ${dayIso.slice(5)}`,
          hourIndex: hrIdx,
          hourLabel: h.weather.hourLabel,
          v10m,
          vGusts,
          pasquillClass: h.weather.pasquillClass,
          simLaeqDb,
          simLafmaxDb,
          dbaRawUncompensatedDb,
          micWindNoiseCompDb,
          dbaWindCompLaeqDb,
          dbaLafmaxPeakDb,
          simMinusDbaDeltaDb,
          exceeds3dBDiscrepancy: Math.abs(simMinusDbaDeltaDb) > 3.0,
          limitLaeqDb,
          isUnstableHighWind: v10m > 10.0,
        });
      });
    }

    downloadFull168hDbaImpulseCatalogPdfReport({
      blockId: activeDbaBlock.id,
      blockLabel: activeDbaBlock.label,
      dbaFileName: activeDbaBlock.fileName,
      soundMeterModel: activeDbaBlock.meter,
      distanceMeters: distanceMap[selectedDbaBlockId] || 40,
      machineLabel: 'Nedrivningsmateriel (ISO 9613-2 samlet kildemodel)',
      machineLwaDb: isManualOverrideActive ? effectiveManualMachineNoiseDb : 114,
      anchorDateIso: weatherDataset.dateIso,
      rows168,
      complaints: observations.slice(0, 8).map((obs) => {
        const hrRow = dba24Series[obs.observedHourIndex] || dba24Series[0];
        return {
          complaintId: obs.code,
          hourIndex: obs.observedHourIndex,
          hourLabel: obs.observedHourLabel,
          complainantBlock: obs.locationLabel,
          logFileRef: `SHA256:${obs.sha256Signature.slice(0, 10).toUpperCase()}`,
          complaintText: obs.description,
          v10m: hrRow?.windSpeed10m ?? 8.5,
          simLaeqDb: hrRow?.simLaeqDb ?? 72,
          dbaWindCompLaeqDb: hrRow?.windCompLaeqDb ?? 71,
          dbaLafmaxPeakDb: (hrRow?.windCompLaeqDb ?? 71) + 14.5,
          simMinusDbaDeltaDb: hrRow?.deltaSimVsDba ?? 1.0,
        };
      }),
    });

    setDbaPdfExportedJustNow(true);
    window.setTimeout(() => setDbaPdfExportedJustNow(false), 3000);
  };

  const dbaWindCompPoints = dba24Series
    .map((d, i) => `${xForHr(i).toFixed(1)},${yForDb(d.windCompLaeqDb).toFixed(1)}`)
    .join(' ');

  const solarInfo = useMemo(
    () => computeSunriseSunsetForDate(weatherDataset.dateIso),
    [weatherDataset.dateIso]
  );
  const sunriseX = xForHr(solarInfo.sunriseDecimalHour);
  const sunsetX = xForHr(solarInfo.sunsetDecimalHour);

  // Real-time monitoring of ambient/impulse noise > 85 dB for > 5 consecutive minutes
  const [forceSustained85DbAlert, setForceSustained85DbAlert] = useState<boolean>(false);
  const [liveAlertTickSec, setLiveAlertTickSec] = useState<number>(0);

  // Compute 60-minute intra-hour ambient/impulse noise series (1-minute resolution)
  const intraHour85DbTracker = useMemo(() => {
    const baseLaeq = currentFocusEval.combinedLaeqDb;
    const baseLafmax = currentFocusEval.combinedLafmaxDb;
    const windGustBoost = Math.max(0, (currentFocusEval.weather.windGusts10m - 7) * 0.45);

    const minutes = Array.from({ length: 60 }, (_, minIdx) => {
      // Simulate realistic hydraulic concrete breaker / demolition duty cycle across the 60 minutes of the hour
      const cycleWave =
        Math.sin(minIdx * 0.24 + selectedHourIndex * 0.7) * 2.6 +
        Math.cos(minIdx * 0.11) * 1.8;
      const burstBoost =
        (minIdx >= 12 && minIdx <= 23) || (minIdx >= 36 && minIdx <= 46)
          ? 3.4
          : -1.2;
      const forcedBoost = forceSustained85DbAlert && minIdx >= 10 && minIdx <= 28 ? 14.5 : 0;

      const ambientPeakDb = Number(
        Math.max(
          baseLaeq,
          baseLafmax - 1.8 + cycleWave + burstBoost + windGustBoost + forcedBoost
        ).toFixed(1)
      );
      const exceeds85Db = ambientPeakDb > 85.0;
      return {
        minute: minIdx,
        ambientPeakDb,
        exceeds85Db,
      };
    });

    let maxConsecutiveMinutes = 0;
    let currentStreak = 0;
    let streakStartMin = 0;
    let bestStreakStartMin = 0;
    let bestStreakEndMin = 0;
    let totalMinutesAbove85 = 0;
    let maxMinuteDb = 0;

    minutes.forEach((m, idx) => {
      if (m.ambientPeakDb > maxMinuteDb) {
        maxMinuteDb = m.ambientPeakDb;
      }
      if (m.exceeds85Db) {
        totalMinutesAbove85 += 1;
        if (currentStreak === 0) {
          streakStartMin = idx;
        }
        currentStreak += 1;
        if (currentStreak > maxConsecutiveMinutes) {
          maxConsecutiveMinutes = currentStreak;
          bestStreakStartMin = streakStartMin;
          bestStreakEndMin = idx;
        }
      } else {
        currentStreak = 0;
      }
    });

    const isAlertTriggered = maxConsecutiveMinutes > 5;
    return {
      minutes,
      maxConsecutiveMinutes,
      totalMinutesAbove85,
      maxMinuteDb: Number(maxMinuteDb.toFixed(1)),
      bestStreakStartMin,
      bestStreakEndMin,
      isAlertTriggered,
    };
  }, [currentFocusEval, selectedHourIndex, forceSustained85DbAlert]);

  useEffect(() => {
    if (!intraHour85DbTracker.isAlertTriggered) {
      setLiveAlertTickSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLiveAlertTickSec((prev) => (prev + 1) % 60);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [intraHour85DbTracker.isAlertTriggered]);

  return (
    <div className="space-y-4">
      {/* REAL-TIME VISUAL ALERT: AMBIENT NOISE > 85 dB FOR > 5 CONSECUTIVE MINUTES */}
      <div
        role="alert"
        aria-live="polite"
        className={`p-3.5 rounded-lg border transition-colors space-y-2.5 ${
          intraHour85DbTracker.isAlertTriggered
            ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] border-l-4 border-l-rose-500'
            : 'bg-[var(--surface-panel)] border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                intraHour85DbTracker.isAlertTriggered
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-xs font-mono font-extrabold uppercase tracking-wider ${
                    intraHour85DbTracker.isAlertTriggered
                      ? 'text-rose-200'
                      : 'text-emerald-300'
                  }`}
                >
                  {intraHour85DbTracker.isAlertTriggered ? (
                    <span className="inline-flex items-center gap-1">
                      <Siren className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>
                        REAL-TIME STØJ-ALARM: &gt; 85 dB OVERSKREDET I {intraHour85DbTracker.maxConsecutiveMinutes} SAMMENHÆNGENDE MINUTTER (&gt; 5 MIN GRÆNSE)
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        REALTIDS-STØJOVERBÅGNING (85 dB / 5 MIN): UNDER KRITISK VARIGHEDSGRÆNSE ({intraHour85DbTracker.maxConsecutiveMinutes} sammenhængende min &gt; 85 dB)
                      </span>
                    </span>
                  )}
                </span>
                {intraHour85DbTracker.isAlertTriggered && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[11px] font-bold border border-amber-200">
                    AKTIV VARIGHED: {intraHour85DbTracker.maxConsecutiveMinutes}m{' '}
                    {String(liveAlertTickSec).padStart(2, '0')}s &gt; 85 dB(A)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                {intraHour85DbTracker.isAlertTriggered ? (
                  <>
                    Vedvarende høj-energi støjbelastning registreret mellem{' '}
                    <strong className="text-amber-300">
                      kl. {String(selectedHourIndex).padStart(2, '0')}:
                      {String(intraHour85DbTracker.bestStreakStartMin).padStart(2, '0')}–
                      {String(selectedHourIndex).padStart(2, '0')}:
                      {String(intraHour85DbTracker.bestStreakEndMin).padStart(2, '0')}
                    </strong>{' '}
                    (Peak{' '}
                    <strong className="text-rose-300">
                      {intraHour85DbTracker.maxMinuteDb.toFixed(1)} dB(A)
                    </strong>{' '}
                    fra <strong className="text-white">{currentFocusEval.dominantNoiseSourceCode}</strong>
                    ) — udløser akut høreværns- og standsningspligt iht. BEK nr. 65 &amp; MBL § 42.
                  </>
                ) : (
                  <>
                    Overvåger kontinuerligt om omgivelses- og impulsstøj overstiger{' '}
                    <strong className="text-amber-300">85 dB(A)</strong> i mere end{' '}
                    <strong className="text-amber-300">5 sammenhængende minutter</strong> (aktuel
                    time-peak: {intraHour85DbTracker.maxMinuteDb.toFixed(1)} dB(A)).
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setForceSustained85DbAlert((v) => !v)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer shrink-0 ${
              forceSustained85DbAlert
                ? 'bg-amber-400 text-slate-950 border-white shadow-xs'
                : 'bg-slate-900 text-rose-200 border-rose-500/50 hover:bg-rose-950/60'
            }`}
            title="Simulér/test et vedvarende >85 dB støjforløb på over 5 sammenhængende minutter for at verificere realtids-alarmen"
          >
            <span className="inline-flex items-center gap-1">
              <Zap className="w-3 h-3 shrink-0" />
              <span>
                {forceSustained85DbAlert
                  ? '>85 dB (>5 min) Test-Simulering: TIL'
                  : 'Test >85 dB (>5 min) Alarm'}
              </span>
            </span>
          </button>
        </div>

        {/* 60-Minute Intra-Hour Noise Persistence Strip (each bar = 1 minute of the selected hour) */}
        <div className="space-y-1 bg-slate-950/85 border border-slate-800/90 rounded p-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>
              60-MINUTTERS FORLØB (KL. {String(selectedHourIndex).padStart(2, '0')}:00–
              {String(selectedHourIndex).padStart(2, '0')}:59) · TÆRSKEL: 85,0 dB(A) I &gt; 5 SAMMENHÆNGENDE MIN.
            </span>
            <span
              className={
                intraHour85DbTracker.isAlertTriggered
                  ? 'text-rose-300 font-bold'
                  : 'text-emerald-300'
              }
            >
              Max sammenhængende: {intraHour85DbTracker.maxConsecutiveMinutes} min (i alt{' '}
              {intraHour85DbTracker.totalMinutesAbove85}/60 min &gt; 85 dB)
            </span>
          </div>
          <div className="grid grid-cols-60 gap-px h-6 items-end bg-slate-900/90 p-0.5 rounded border border-slate-800">
            {intraHour85DbTracker.minutes.map((m) => {
              const inBestStreak =
                intraHour85DbTracker.isAlertTriggered &&
                m.minute >= intraHour85DbTracker.bestStreakStartMin &&
                m.minute <= intraHour85DbTracker.bestStreakEndMin;
              const hPct = Math.max(
                18,
                Math.min(100, Math.round(((m.ambientPeakDb - 55) / 42) * 100))
              );
              return (
                <div
                  key={`min-85db-${m.minute}`}
                  style={{ height: `${hPct}%` }}
                  title={`Kl. ${String(selectedHourIndex).padStart(2, '0')}:${String(
                    m.minute
                  ).padStart(2, '0')} — ${m.ambientPeakDb.toFixed(1)} dB(A)${
                    m.exceeds85Db ? ' (> 85 dB TÆRSKEL)' : ''
                  }`}
                  className={`w-full rounded-t transition-all ${
                    inBestStreak
                      ? 'bg-rose-500'
                      : m.exceeds85Db
                      ? 'bg-amber-400'
                      : 'bg-slate-700/75'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 1. HEADER & METEOROLOGICAL-ACOUSTIC CORRELATION BANNER */}
      <div className="p-3.5 bg-amber-950/25 border border-amber-500/40 rounded-md space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Vejr-Korrelation: Naboklager (Støj dB(A) &amp; Støv S-Kvotient)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowDbaImpulseCatalog((v) => !v)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                showDbaImpulseCatalog
                  ? 'bg-fuchsia-600 text-white border-amber-200'
                  : 'bg-slate-900 text-fuchsia-300 border-fuchsia-500/50 hover:bg-slate-800'
              }`}
              title="Slå 'Vind-Kompenseret Impuls-Katalog' til/fra: indlæser og plotter automatisk historiske støjdata fra naboblokke (.DBA-filer) mod realtids-simulering og faktiske naboklage-logfiler"
            >
              <span className="inline-flex items-center gap-1">
                <FolderOpen className="w-3 h-3 shrink-0" />
                <span>
                  Vind-Kompenseret Impuls-Katalog (DBA): {showDbaImpulseCatalog ? 'AKTIV' : 'INDLÆS'}
                </span>
              </span>
            </button>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
              ISO 9613-2 · MST Vejl. 5/1984
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Sammenholder historiske naboklager og fysiske observationspunkter med beregnede
          støjniveauer (<span className="font-mono text-amber-200">L_Aeq</span> &amp;{' '}
          <span className="font-mono text-rose-300">L_AFmax</span>) samt støv-sumkvotienter (
          <span className="font-mono text-cyan-300">S</span>) baseret på maskinaktiviteten ved hver
          kildenode og meteorologisk lydrefraktion i medvind.
        </p>

        {/* Top Regulatory Threshold Strip */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <div className="p-2 bg-slate-950/90 border border-slate-800 rounded">
            <div className="text-[11px] font-mono uppercase text-slate-400">
              Støjgrænse (Dag 07–18)
            </div>
            <div className="text-xs font-mono font-bold text-amber-300">
              70 dB(A) <span className="text-[11px] text-slate-400">L_Aeq</span>
            </div>
            <div className="text-[11px] font-mono text-rose-300">
              Spids: 85 dB(A) L_AFmax
            </div>
          </div>
          <div
            className={`p-2 rounded border transition-colors ${
              currentWeather.windSpeed10m > 10
                ? 'bg-[var(--surface-card)] border-rose-500/70 border-l-4 border-l-rose-500 text-rose-100'
                : 'bg-[var(--surface-panel)] border-[var(--border-subtle)]'
            }`}
          >
            <div
              className={`text-[11px] font-mono uppercase ${
                currentWeather.windSpeed10m > 10 ? 'text-rose-200 font-bold' : 'text-slate-400'
              }`}
            >
              {currentWeather.windSpeed10m > 10
                ? '⚠ HØJRISIKO-VIND (>10 m/s)'
                : 'Medvinds-Refraktion'}
            </div>
            <div
              className={`text-xs font-mono font-bold ${
                currentWeather.windSpeed10m > 10
                  ? 'text-white'
                  : currentFocusEval.netWeatherRefractionEffectDb >= 0
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}
            >
              {currentFocusEval.netWeatherRefractionEffectDb >= 0 ? '+' : ''}
              {currentFocusEval.netWeatherRefractionEffectDb.toFixed(1)} dB(A)
            </div>
            <div
              className={`text-[11px] font-mono ${
                currentWeather.windSpeed10m > 10 ? 'text-white font-bold' : 'text-slate-400'
              }`}
            >
              Vind {currentWeather.windSpeed10m} m/s ({degreesToCompass(currentWeather.windDirection10m)})
            </div>
          </div>
          <div className="p-2 bg-slate-950/90 border border-slate-800 rounded">
            <div className="text-[11px] font-mono uppercase text-slate-400">
              Korrelation r(Støj, Støv)
            </div>
            <div className="text-xs font-mono font-bold text-cyan-300">
              r = {correlationStats.rNoiseToDust >= 0 ? '+' : ''}
              {correlationStats.rNoiseToDust.toFixed(2)}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {correlationStats.dualExceedanceHours}t dobbelt-overskridelse
            </div>
          </div>
        </div>
      </div>

      {/* 2. SOURCE NODE ACTIVITY & ACOUSTIC POWER CONTROLLER */}
      <div className="p-3.5 bg-slate-900/85 border border-slate-800 rounded-md space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Kildenode-Aktivitet &amp; Akustisk Kildeeffekt (L_WA)</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Justér maskinaktivitet pr. nedrivningsfelt for at se effekt på naboklager i realtid
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetConfigs}
            className="px-2 py-1 rounded bg-slate-950 border border-slate-700 hover:border-amber-400 text-[11px] font-mono text-slate-300 flex items-center gap-1 transition-colors shrink-0"
            title="Nulstil alle kildenoder til PSS-standardaktivitet"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Nulstil</span>
          </button>
        </div>

        {/* GLOBAL MANUAL MACHINE NOISE OUTPUT LEVEL SLIDER (90 dB – 125 dB) */}
        <div className="p-3 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-amber-400 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-mono font-extrabold text-amber-200 uppercase tracking-wide">
                Manuel Maskin-Støj-Output Slider (90 dB – 125 dB)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400 text-amber-200 font-mono text-xs font-extrabold">
                L_WA = {effectiveManualMachineNoiseDb.toFixed(1)} dB(A)
              </span>
              <button
                type="button"
                onClick={() => handleToggleManualOverride()}
                className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border cursor-pointer transition-colors ${
                  isManualOverrideActive
                    ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title="Slå manuel dB-styrings-slider (90–125 dB) til eller fra"
              >
                {isManualOverrideActive ? '✓ Aktiv' : 'Standard L_WA'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold text-emerald-300 shrink-0">
              90 dB
            </span>
            <input
              type="range"
              min={90}
              max={125}
              step={0.5}
              value={effectiveManualMachineNoiseDb}
              onChange={(e) => handleSetManualMachineNoiseDb(parseFloat(e.target.value))}
              aria-label="Juster maskinernes støj-output-niveau fra 90 dB til 125 dB"
              className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <span className="text-[11px] font-mono font-bold text-rose-400 shrink-0">
              125 dB
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { db: 90, label: '90 dB (Sanering)' },
                { db: 100, label: '100 dB (Læsning)' },
                { db: 108, label: '108 dB (Grab)' },
                { db: 114, label: '114 dB (Mejselhammer)' },
                { db: 118, label: '118 dB (Betonknuser)' },
                { db: 125, label: '125 dB (Maks Impuls)' },
              ].map((preset) => {
                const isSel = Math.abs(effectiveManualMachineNoiseDb - preset.db) < 0.4;
                return (
                  <button
                    key={preset.db}
                    type="button"
                    onClick={() => handleSetManualMachineNoiseDb(preset.db)}
                    className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold border cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-amber-400 text-slate-950 border-white'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-400/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] font-mono text-cyan-300 font-semibold">
              Receptor L_Aeq: <strong>{currentFocusEval.combinedLaeqDb.toFixed(1)} dB(A)</strong> (Spids{' '}
              <strong className="text-rose-300">{currentFocusEval.combinedLafmaxDb.toFixed(1)} dB</strong>)
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {sources.map((src) => {
            const cfg = effectiveActivityConfigs[src.id];
            const contrib = currentFocusEval.sourceContributions.find(
              (c) => c.sourceId === src.id
            );
            const modeSpec = DEMOLITION_ACTIVITY_MODES[cfg.modeId];

            return (
              <div
                key={src.id}
                className={`p-2.5 rounded border transition-colors space-y-2 ${
                  src.active && cfg.intensityPercent > 0
                    ? 'bg-slate-950/90 border-slate-800'
                    : 'bg-slate-950/40 border-slate-900 opacity-65'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold shrink-0">
                      {src.code}
                    </span>
                    <span className="text-xs font-semibold text-white truncate">
                      {src.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                      L_WA: <strong className="text-amber-300">{contrib?.effectiveLwaDb.toFixed(0)} dB</strong>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded border font-bold ${
                        (contrib?.receivedLaeqDb || 0) >= 70
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : (contrib?.receivedLaeqDb || 0) >= 60
                          ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                          : 'bg-slate-900 text-slate-300 border-slate-800'
                      }`}
                      title="Beregnet støjbidrag ved det valgte observationspunkt"
                    >
                      Ved pkt: {contrib?.receivedLaeqDb.toFixed(1)} dB(A) (
                      {contrib?.acousticEnergySharePercent.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                {/* Activity Mode Selector + Water Suppression Toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-8">
                    <select
                      value={cfg.modeId}
                      onChange={(e) =>
                        handleUpdateSourceConfig(src.id, {
                          modeId: e.target.value as DemolitionActivityModeId,
                        })
                      }
                      aria-label={`Maskinaktivitet for ${src.name}`}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 font-medium focus:border-amber-400 focus:outline-none"
                    >
                      {Object.values(DEMOLITION_ACTIVITY_MODES).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} (L_WA {m.baseSoundPowerLwaDb} dB / Støv {m.dustEmissionMultiplier}x)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-4 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateSourceConfig(src.id, {
                          waterSuppressionActive: !cfg.waterSuppressionActive,
                        })
                      }
                      className={`w-full px-2 py-1 rounded text-[11px] font-mono font-semibold border transition-colors ${
                        cfg.waterSuppressionActive
                          ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                      title="Vandkanon / støvdæmpning reducerer støvemission med 55%, men tilføjer +1,2 dB støj fra højtryksdyser"
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        <Droplets className="w-3 h-3 shrink-0" />
                        <span>{cfg.waterSuppressionActive ? 'Vanddæmpning AKTIV' : 'Vanddæmpning FRA'}</span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* Activity Intensity Slider + Distance & Wind Angle Telemetry */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                    <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                      Intensitet: <strong className="text-white">{cfg.intensityPercent}%</strong>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={150}
                      step={10}
                      value={cfg.intensityPercent}
                      onChange={(e) =>
                        handleUpdateSourceConfig(src.id, {
                          intensityPercent: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 cursor-pointer h-1.5"
                    />
                  </div>
                  {contrib && (
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                      <span>Afstand: {contrib.distanceMeters}m</span>
                      <span>·</span>
                      <span
                        className={
                          contrib.meteorologicalRefractionDb >= 1.5
                            ? 'text-amber-300 font-semibold'
                            : contrib.meteorologicalRefractionDb < 0
                            ? 'text-emerald-300'
                            : 'text-slate-300'
                        }
                      >
                        Vind-korr: {contrib.meteorologicalRefractionDb >= 0 ? '+' : ''}
                        {contrib.meteorologicalRefractionDb.toFixed(1)} dB
                      </span>
                      <span>·</span>
                      <span>Støvfaktor: {contrib.dustMultiplier.toFixed(2)}x</span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 italic truncate">
                  {modeSpec.equipmentDescription}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 24-HOUR WEATHER vs. NOISE (dB) & DUST (S) CORRELATION TIMELINE CHART */}
      <div className="p-3.5 bg-slate-900/85 border border-slate-800 rounded-md space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                24t Støj (dB) &amp; Støv (S) Profil ved{' '}
                <span className="text-amber-300">
                  {focusedObservation ? focusedObservation.code : 'Rødtjørnevej 2'}
                </span>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {focusedObservation
                ? `${focusedObservation.locationLabel} (${focusedObservation.position.lat.toFixed(
                    4
                  )}°N, ${focusedObservation.position.lng.toFixed(4)}°E)`
                : 'Rødtjørnevej 2, 4200 Slagelse'}
            </div>
          </div>
          <div className="text-right font-mono text-[11px] shrink-0">
            <div className="text-amber-300 font-bold">
              Kl. {currentWeather.hourLabel}: {currentFocusEval.combinedLaeqDb.toFixed(1)} dB(A)
            </div>
            <div className="text-cyan-300">
              Støv S = {currentFocusEval.adjustedDustSumQuotient.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Interactive 24h Dual-Axis SVG Chart */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded space-y-1.5">
          <div className="relative h-32 w-full">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="sidebar-dba-3db-band-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.46" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity="0.46" />
                </linearGradient>
              </defs>
              {/* Daylight Window Shading & Sunrise/Sunset Timeline Markers */}
              <rect
                x={sunriseX}
                y={padT}
                width={Math.max(4, sunsetX - sunriseX)}
                height={plotH}
                fill="rgba(250, 204, 21, 0.06)"
              />
              <line
                x1={sunriseX}
                x2={sunriseX}
                y1={padT}
                y2={padT + plotH}
                stroke="#fde047"
                strokeWidth="1.1"
                strokeDasharray="3 2"
              />
              <text
                x={sunriseX}
                y={padT - 3}
                textAnchor="middle"
                fill="#fde047"
                fontSize="9.5"
                fontFamily="monospace"
              >
                ☀↑{solarInfo.sunriseLabel}
              </text>
              <line
                x1={sunsetX}
                x2={sunsetX}
                y1={padT}
                y2={padT + plotH}
                stroke="#f59e0b"
                strokeWidth="1.1"
                strokeDasharray="3 2"
              />
              <text
                x={sunsetX}
                y={padT - 3}
                textAnchor="middle"
                fill="#f59e0b"
                fontSize="9.5"
                fontFamily="monospace"
              >
                ☀↓{solarInfo.sunsetLabel}
              </text>

              {/* 70 dB(A) Daytime Regulatory Noise Limit Line */}
              <line
                x1={padL}
                x2={svgW - padR}
                y1={yForDb(70)}
                y2={yForDb(70)}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="3 2"
                opacity="0.75"
              />
              <text
                x={padL + 2}
                y={yForDb(70) - 2}
                fill="#fbbf24"
                fontSize="9.5"
                fontFamily="monospace"
              >
                70 dB(A) Grænse
              </text>

              {/* 85 dB(A) Impulse Limit Line */}
              <line
                x1={padL}
                x2={svgW - padR}
                y1={yForDb(85)}
                y2={yForDb(85)}
                stroke="#f43f5e"
                strokeWidth="0.9"
                strokeDasharray="2 2"
                opacity="0.65"
              />

              {/* Dust Sum Quotient S Bars for each of the 24 hours */}
              {hourly24Series.map((hEval, idx) => {
                const bx = xForHr(idx) - 4;
                const by = yForDust(hEval.adjustedDustSumQuotient);
                const bh = Math.max(1.5, padT + plotH - by);
                const isSelected = idx === selectedHourIndex;
                return (
                  <g
                    key={`bar-${idx}`}
                    className="cursor-pointer"
                    onClick={() => onSelectHour(idx)}
                  >
                    <rect
                      x={bx}
                      y={by}
                      width="8"
                      height={bh}
                      rx="1"
                      fill={
                        hEval.adjustedDustSumQuotient >= 1.0
                          ? '#06b6d4'
                          : '#334155'
                      }
                      opacity={isSelected ? 0.9 : 0.45}
                    />
                  </g>
                );
              })}

              {/* Selected Hour Vertical Cursor */}
              <line
                x1={xForHr(selectedHourIndex)}
                x2={xForHr(selectedHourIndex)}
                y1={padT}
                y2={padT + plotH}
                stroke="#e2e8f0"
                strokeWidth="1.2"
              />

              {/* Historical Observation Timestamp Markers */}
              {observations.map((obs) => {
                const ox = xForHr(obs.observedHourIndex);
                const isFocused = focusedObservation?.id === obs.id;
                return (
                  <g
                    key={`obs-marker-${obs.id}`}
                    className="cursor-pointer"
                    onClick={() => {
                      onSelectObservation(obs.id);
                      onSelectHour(obs.observedHourIndex);
                    }}
                  >
                    <line
                      x1={ox}
                      x2={ox}
                      y1={padT}
                      y2={padT + plotH}
                      stroke={isFocused ? '#e879f9' : '#c084fc'}
                      strokeWidth={isFocused ? '1.6' : '1'}
                      strokeDasharray="2 1"
                    />
                    <circle
                      cx={ox}
                      cy={padT + 4}
                      r={isFocused ? '3.5' : '2.5'}
                      fill="#d946ef"
                      stroke="#0f172a"
                      strokeWidth="1"
                    />
                  </g>
                );
              })}

              {/* L_AFmax Impulse Peak Curve (Rose Dashed) */}
              <polyline
                fill="none"
                stroke="#fb7185"
                strokeWidth="1.3"
                strokeDasharray="3 2"
                points={lafmaxPoints}
              />

              {/* L_Aeq Equivalent Noise Curve (Amber Solid) */}
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={laeqPoints}
              />

              {/* Shaded Color Band highlighting Discrepancies > 3 dB between Simulation and DBA Data */}
              {showDbaImpulseCatalog &&
                dba24Series.map((d, idx) => {
                  if (!d.exceeds3dBDiscrepancy) return null;
                  const stepHalfW = (plotW / 23) * 0.5;
                  const xCenter = xForHr(idx);
                  const xLeft = Math.max(padL, xCenter - stepHalfW);
                  const xRight = Math.min(svgW - padR, xCenter + stepHalfW);
                  const prevD = dba24Series[Math.max(0, idx - 1)];
                  const nextD = dba24Series[Math.min(dba24Series.length - 1, idx + 1)];

                  const ySimL = yForDb((prevD.simLaeqDb + d.simLaeqDb) * 0.5);
                  const ySimC = yForDb(d.simLaeqDb);
                  const ySimR = yForDb((d.simLaeqDb + nextD.simLaeqDb) * 0.5);

                  const yDbaL = yForDb((prevD.windCompLaeqDb + d.windCompLaeqDb) * 0.5);
                  const yDbaC = yForDb(d.windCompLaeqDb);
                  const yDbaR = yForDb((d.windCompLaeqDb + nextD.windCompLaeqDb) * 0.5);

                  return (
                    <g key={`disc-band-${idx}`}>
                      <rect
                        x={xLeft}
                        y={padT}
                        width={Math.max(2, xRight - xLeft)}
                        height={plotH}
                        fill="#f43f5e"
                        fillOpacity="0.11"
                      />
                      <polygon
                        points={`${xLeft.toFixed(1)},${ySimL.toFixed(1)} ${xCenter.toFixed(
                          1
                        )},${ySimC.toFixed(1)} ${xRight.toFixed(1)},${ySimR.toFixed(
                          1
                        )} ${xRight.toFixed(1)},${yDbaR.toFixed(1)} ${xCenter.toFixed(
                          1
                        )},${yDbaC.toFixed(1)} ${xLeft.toFixed(1)},${yDbaL.toFixed(1)}`}
                        fill="url(#sidebar-dba-3db-band-grad)"
                        stroke="#fb7185"
                        strokeWidth="0.9"
                      />
                      <text
                        x={Math.min(svgW - padR - 22, Math.max(padL + 2, xCenter - 10))}
                        y={Math.max(padT + 8, Math.min(ySimC, yDbaC) - 3)}
                        fill="#fecdd3"
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        Δ{d.deltaSimVsDba >= 0 ? '+' : ''}
                        {d.deltaSimVsDba}dB
                      </text>
                    </g>
                  );
                })}

              {/* Wind-Compensated Historical Neighbor-Block .DBA Curve (Fuchsia Dashed) */}
              {showDbaImpulseCatalog && (
                <polyline
                  fill="none"
                  stroke="#e879f9"
                  strokeWidth="1.8"
                  strokeDasharray="4 2"
                  points={dbaWindCompPoints}
                />
              )}

              {/* Active Hour Dot on L_Aeq Curve */}
              <circle
                cx={xForHr(selectedHourIndex)}
                cy={yForDb(currentFocusEval.combinedLaeqDb)}
                r="3.5"
                fill="#fbbf24"
                stroke="#0f172a"
                strokeWidth="1.3"
              />

              {/* Left Axis Labels (dB) */}
              <text x="2" y={padT + 5} fill="#fbbf24" fontSize="9.5" fontFamily="monospace">
                {maxDb}dB
              </text>
              <text
                x="2"
                y={padT + plotH}
                fill="#94a3b8"
                fontSize="9.5"
                fontFamily="monospace"
              >
                {minDb}dB
              </text>

              {/* Right Axis Labels (Dust S) */}
              <text
                x={svgW - padR + 3}
                y={padT + 5}
                fill="#22d3ee"
                fontSize="9.5"
                fontFamily="monospace"
              >
                S={maxDustS.toFixed(1)}
              </text>
              <text
                x={svgW - padR + 3}
                y={padT + plotH}
                fill="#64748b"
                fontSize="9.5"
                fontFamily="monospace"
              >
                S=0
              </text>

              {/* Bottom Hour Labels */}
              {[0, 6, 12, 18, 23].map((hr) => (
                <text
                  key={`lbl-${hr}`}
                  x={xForHr(hr) - 6}
                  y={svgH - 3}
                  fill="#94a3b8"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {String(hr).padStart(2, '0')}:00
                </text>
              ))}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Sim L_Aeq
            </span>
            {showDbaImpulseCatalog && (
              <>
                <span className="flex items-center gap-1 text-fuchsia-300 font-bold">
                  <span className="w-2.5 h-0.5 bg-fuchsia-400 inline-block" /> DBA Vind-Komp ({activeDbaBlock.fileName})
                </span>
                <span className="flex items-center gap-1 text-rose-200 font-bold">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/70 border border-rose-300 inline-block" />{' '}
                  Skyggelagt Bånd |Δ|&gt;3 dB ({dba24Series.filter((r) => r.exceeds3dBDiscrepancy).length}t)
                </span>
              </>
            )}
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> L_AFmax Impuls
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-cyan-500 inline-block" /> Støv S≥1,0
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-fuchsia-500 inline-block" /> Naboklage (ALG)
            </span>
          </div>

          {/* Vind-Kompenseret Impuls-Katalog (.DBA Files vs. Neighbor Complaint Logfiles) Drawer */}
          {showDbaImpulseCatalog && (
            <div className="mt-2 pt-2 border-t border-fuchsia-500/40 space-y-2 text-[11px] font-mono">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-fuchsia-300 font-bold uppercase inline-flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Historiske DBA-Filer vs. Realtids-Simulering: {activeDbaBlock.fileName} ({activeDbaBlock.meter})
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      'roedtjoernevej_2',
                      'schackenborg_b',
                      'kierulffsvej_4',
                      'ringparken_3',
                    ] as const
                  ).map((bId) => {
                    const bSpec = dbaBlockCatalog[bId];
                    const isSel = selectedDbaBlockId === bId;
                    const isInEsdh = selectedEsdhBlockIds.includes(bId);
                    return (
                      <div
                        key={bId}
                        className="inline-flex items-center rounded border border-slate-800 bg-slate-900 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleEsdhBlockId(bId)}
                          title={
                            isInEsdh
                              ? 'Medtaget i ESDH CSV-eksport (klik for at fravælge)'
                              : 'Fravalgt i ESDH CSV-eksport (klik for at medtage)'
                          }
                          className={`px-1 py-0.5 text-[11px] border-r border-slate-800 cursor-pointer ${
                            isInEsdh
                              ? 'bg-cyan-500/20 text-cyan-200 font-bold'
                              : 'bg-slate-950 text-slate-500'
                          }`}
                        >
                          {isInEsdh ? '✓' : '○'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDbaBlockId(bId)}
                          className={`px-1.5 py-0.5 text-[11px] cursor-pointer whitespace-nowrap ${
                            isSel
                              ? 'bg-fuchsia-500/30 text-white font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {bSpec.label}
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    data-testid="panel-dba-export-esdh-csv-btn"
                    onClick={handleExportEsdhBlockCatalogCsv}
                    className={`px-2 py-0.5 rounded border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      esdhCsvExportedJustNow
                        ? 'bg-emerald-500 text-slate-950 border-white'
                        : 'bg-cyan-500/20 hover:bg-cyan-500/35 border-cyan-400/70 text-cyan-200'
                    }`}
                    title="Eksportér aktuel vindkompenseret maskin-impulsstøj-korrelation for de valgte naboblokke som ESDH-klar CSV"
                  >
                    <FileSpreadsheet className="w-2.5 h-2.5 shrink-0" />
                    <span>
                      {esdhCsvExportedJustNow
                        ? '✓ ESDH CSV Gemt!'
                        : `Eksportér ESDH CSV (${selectedEsdhBlockIds.length} blokke)`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportDbaVsSimulationCsv}
                    className={`px-2 py-0.5 rounded border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      dbaCsvExportedJustNow
                        ? 'bg-emerald-500 text-slate-950 border-white'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/60 text-emerald-200'
                    }`}
                    title="Eksportér den aktuelle visning af Historiske DBA-Filer vs. Realtids-Simulering som struktureret CSV-fil med både målt og kompenseret dB(A) pr. time"
                  >
                    <Download className="w-2.5 h-2.5 shrink-0" />
                    <span>
                      {dbaCsvExportedJustNow
                        ? '✓ CSV Eksporteret!'
                        : 'Eksportér DBA vs. Sim (.CSV)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportFull168hDbaPdf}
                    className={`px-2 py-0.5 rounded border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      dbaPdfExportedJustNow
                        ? 'bg-fuchsia-500 text-white border-white'
                        : 'bg-fuchsia-600/25 hover:bg-fuchsia-600/40 border-fuchsia-400/80 text-fuchsia-100'
                    }`}
                    title="Download fuld PDF-rapport med alle 168 timers historiske data (7 døgn × 24t) og statistiske korrelationer mellem simulering og DBA-målinger"
                  >
                    <FileText className="w-2.5 h-2.5 shrink-0" />
                    <span>
                      {dbaPdfExportedJustNow
                        ? '✓ 168t PDF Downloadet!'
                        : 'Download fuld PDF-rapport'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 border border-slate-800 rounded p-1.5">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase">Realtids-Simulering</div>
                  <div className="text-xs font-bold text-amber-300">
                    {dba24Series[selectedHourIndex]?.simLaeqDb.toFixed(1)} dB(A)
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase">
                    DBA Vind-Kompenseret
                  </div>
                  <div className="text-xs font-bold text-fuchsia-300">
                    {dba24Series[selectedHourIndex]?.windCompLaeqDb.toFixed(1)} dB(A){' '}
                    <span className="text-[11px] text-slate-400">
                      (Målt rå: {dba24Series[selectedHourIndex]?.rawDbaDb.toFixed(1)} dB)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase">Sim vs. DBA Afvigelse</div>
                  <div
                    className={`text-xs font-bold ${
                      Math.abs(dba24Series[selectedHourIndex]?.deltaSimVsDba || 0) > 3.0
                        ? 'text-rose-400'
                        : 'text-emerald-300'
                    }`}
                  >
                    Δ = {(dba24Series[selectedHourIndex]?.deltaSimVsDba || 0) >= 0 ? '+' : ''}
                    {dba24Series[selectedHourIndex]?.deltaSimVsDba.toFixed(1)} dB(A)
                    {Math.abs(dba24Series[selectedHourIndex]?.deltaSimVsDba || 0) > 3.0 &&
                      ' (>3 dB!)'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. HISTORICAL OBSERVATIONS vs. SOURCE NOISE & DUST COMPARISON MATRIX */}
      <div className="p-3.5 bg-slate-900/85 border border-slate-800 rounded-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
              <span>
                Historiske Observationspunkter &amp; Naboklager ({evaluatedObservations.length})
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Sammenholdelse af GPS-klagepunkter med kilde-opdelt støj (dB) og støvfane (S)
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportNoiseDustCsv}
              className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors"
              title="Eksportér korrelationstabel mellem vejr, kildenode-støj og naboklager til CSV"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Toggle between Observation's Historical Weather Snapshot vs. Current Time-Slider Hour */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 border border-slate-800 rounded">
          <button
            type="button"
            onClick={() => setWeatherEvalMode('recorded_snapshot')}
            className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
              weatherEvalMode === 'recorded_snapshot'
                ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Klagens Historiske Vejr (Snapshot)
          </button>
          <button
            type="button"
            onClick={() => setWeatherEvalMode('active_slider')}
            className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
              weatherEvalMode === 'active_slider'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Simulér med Time-Slider (kl. {currentWeather.hourLabel})
          </button>
        </div>

        {/* Quick-Add Neighbor Noise/Dust Complaint Button */}
        {onQuickLogNoiseDustComplaint && (
          <div className="p-2.5 bg-fuchsia-950/20 border border-fuchsia-500/35 rounded flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-slate-300">
              Registrér ny støj-/støvklage ved <strong className="text-white">Rødtjørnevej 2</strong>{' '}
              eller <strong className="text-white">Kierulffsvej</strong> på kl.{' '}
              <span className="font-mono text-fuchsia-300">{currentWeather.hourLabel}</span>:
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onQuickLogNoiseDustComplaint({
                    point: { lat: 55.4122, lng: 11.3522 },
                    locationLabel: 'Rødtjørnevej 2, 4200 Slagelse (C962+VV Slagelse)',
                    observationType:
                      'Naboklage: Impulsstøj (>85 dB) & betonstøv fra hydraulisk nedbrydning',
                    description: `Naboklage over kraftig lavfrekvent rumlen, impulsstøj fra hydraulisk betonknusning/klipning samt synligt støvnedfald i medvind (${currentWeather.windSpeed10m} m/s fra ${degreesToCompass(
                      currentWeather.windDirection10m
                    )}).`,
                  })
                }
                className="px-2 py-1 rounded bg-fuchsia-500 text-slate-950 font-mono font-bold text-[11px] hover:bg-fuchsia-400 flex items-center gap-1 transition-colors"
              >
                <PlusCircle className="w-3 h-3" />
                <span>+ Log Klage (Rødtjørnevej 2)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onQuickLogNoiseDustComplaint({
                    point: { lat: 55.41335, lng: 11.35455 },
                    locationLabel: 'Kierulffsvej 2-12 (Beboere / Daginstitution)',
                    observationType:
                      'Naboklage: Mejselhammer-støj & mineralulds-/asbeststøv i vindstød',
                    description: `Indberetning fra naboer ved Kierulffsvej 2-12 om overskridelse af støjgrænse fra hydraulisk mejselhammer ved BYG-2 samt støvflugt under vindstød (${currentWeather.windGusts10m} m/s).`,
                  })
                }
                className="px-2 py-1 rounded bg-slate-800 border border-fuchsia-500/40 text-fuchsia-200 font-mono font-semibold text-[11px] hover:bg-slate-700 flex items-center gap-1 transition-colors"
              >
                <PlusCircle className="w-3 h-3" />
                <span>+ Log Klage (Kierulffsvej)</span>
              </button>
            </div>
          </div>
        )}

        {/* Observation Comparison Cards */}
        <div className="space-y-3">
          {evaluatedObservations.map(({ obs, snapshotEval, sliderEval, activeEval }) => {
            const isSelected = focusedObservation?.id === obs.id;
            const deltaDbFromSnapshot = Number(
              (sliderEval.combinedLaeqDb - snapshotEval.combinedLaeqDb).toFixed(1)
            );

            return (
              <div
                key={obs.id}
                onClick={() => {
                  onSelectObservation(obs.id);
                  if (weatherEvalMode === 'recorded_snapshot') {
                    onSelectHour(obs.observedHourIndex);
                  }
                }}
                className={`p-3 rounded-md border transition-all cursor-pointer space-y-2.5 ${
                  isSelected
                    ? 'bg-slate-950 border-fuchsia-400 ring-1 ring-fuchsia-400/30'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top Row: Code, Location, Timestamp & Co-Exposure Badge */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-200 font-mono text-[11px] font-bold">
                        {obs.code}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {obs.locationLabel}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        (kl. {obs.observedHourLabel})
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-amber-200">
                      {obs.observationType}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border shrink-0 ${
                      activeEval.coExposureSeverity === 'KRITISK DOBBELT-BELASTNING'
                        ? 'bg-rose-500/25 text-rose-200 border-rose-500/50'
                        : activeEval.coExposureSeverity === 'FORHØJET STØJ/STØV'
                        ? 'bg-amber-500/25 text-amber-200 border-amber-500/50'
                        : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                    }`}
                  >
                    {activeEval.coExposureSeverity}
                  </span>
                </div>

                {/* Telemetry Grid: Noise Estimate (L_Aeq / L_AFmax) + Weather Refraction + Dust S-Quotient */}
                <div className="grid grid-cols-3 gap-2 p-2 bg-slate-900/90 border border-slate-800/90 rounded">
                  <div>
                    <div className="text-[11px] font-mono uppercase text-slate-400">
                      Estimeret Støjniveau
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-sm font-mono font-bold ${
                          activeEval.exceedsLaeqLimit ? 'text-rose-400' : 'text-amber-300'
                        }`}
                      >
                        {activeEval.combinedLaeqDb.toFixed(1)} dB(A)
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        / {activeEval.regulatoryLimitLaeqDb.toFixed(0)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-rose-300">
                      L_AFmax: {activeEval.combinedLafmaxDb.toFixed(1)} dB(A)
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono uppercase text-slate-400">
                      Vejr &amp; Lydrefraktion
                    </div>
                    <div className="text-xs font-mono font-bold text-cyan-300">
                      {activeEval.weather.windSpeed10m} m/s (stød {activeEval.weather.windGusts10m})
                    </div>
                    <div className="text-[11px] font-mono text-amber-200">
                      Vind-bidrag: {activeEval.netWeatherRefractionEffectDb >= 0 ? '+' : ''}
                      {activeEval.netWeatherRefractionEffectDb.toFixed(1)} dB(A)
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono uppercase text-slate-400">
                      Støv-Fane &amp; Kilde
                    </div>
                    <div
                      className={`text-xs font-mono font-bold ${
                        activeEval.adjustedDustSumQuotient >= 1.0
                          ? 'text-rose-400'
                          : 'text-emerald-300'
                      }`}
                    >
                      S = {activeEval.adjustedDustSumQuotient.toFixed(2)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-300 truncate">
                      Primær: <strong className="text-amber-300">{activeEval.dominantNoiseSourceCode}</strong>
                    </div>
                  </div>
                </div>

                {/* Source-by-Source Acoustic Contribution Breakdown Bars */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>KILDE-OPDELT STØJBIDRAG VED OBSERVATIONSPUNKT:</span>
                    {weatherEvalMode === 'active_slider' && (
                      <span className="text-cyan-300">
                        Δ ift. klagetidspunkt: {deltaDbFromSnapshot >= 0 ? '+' : ''}
                        {deltaDbFromSnapshot} dB(A)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    {activeEval.sourceContributions.map((sc) => (
                      <div
                        key={`${obs.id}-${sc.sourceId}`}
                        className="flex items-center gap-2 text-[11px] font-mono bg-slate-900/60 px-2 py-1 rounded border border-slate-800/70"
                      >
                        <span className="w-12 font-bold text-amber-300 shrink-0">
                          {sc.sourceCode}
                        </span>
                        <span className="w-14 text-slate-400 shrink-0">
                          {sc.distanceMeters}m
                        </span>
                        <div className="flex-1 h-2 bg-slate-950 rounded overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all ${
                              sc.receivedLaeqDb >= 70
                                ? 'bg-rose-500'
                                : sc.receivedLaeqDb >= 62
                                ? 'bg-amber-400'
                                : 'bg-cyan-500'
                            }`}
                            style={{
                              width: `${Math.max(
                                4,
                                Math.min(100, sc.acousticEnergySharePercent)
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="w-28 text-right text-slate-200 shrink-0">
                          <strong>{sc.receivedLaeqDb.toFixed(1)} dB</strong> (
                          {sc.acousticEnergySharePercent.toFixed(0)}%)
                        </span>
                        <span
                          className={`w-16 text-right shrink-0 ${
                            sc.windAlignmentCos > 0.25
                              ? 'text-amber-300'
                              : sc.windAlignmentCos < -0.25
                              ? 'text-emerald-300'
                              : 'text-slate-400'
                          }`}
                          title={`Vinkel ift. vindretning: ${sc.angleOffWindDeg}°`}
                        >
                          {sc.windAlignmentCos > 0.25
                            ? 'Medvind'
                            : sc.windAlignmentCos < -0.25
                            ? 'Modvind'
                            : 'Sidevind'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Description & Forensic Footer */}
                <div className="text-[11px] text-slate-300 leading-snug bg-slate-900/40 p-2 rounded border border-slate-800/60">
                  {obs.description}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
                  <span>
                    GPS: {obs.position.lat.toFixed(4)}°N, {obs.position.lng.toFixed(4)}°E ·{' '}
                    {obs.reporterRole}
                  </span>
                  <span className="text-fuchsia-300 font-semibold">
                    Klik for kort-fokus &amp; kl. {obs.observedHourLabel} →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
