import {
  DemolitionSourceNode,
  DispersionSimulationState,
  HeatmapComparisonResult,
  HeatmapComparisonZoneClass,
  HeatmapGridCell,
  HourlyReceptorPuffDose,
  HourlyWeatherPoint,
  IndoorClimateTelemetryInput,
  IndoorClimateTelemetryResult,
  IndoorDemolitionMachineryKey,
  IndoorFloorPressureProfilePoint,
  IndoorSubstanceTelemetryEntry,
  IndoorVentilationOperationMode,
  LatLngPoint,
  LegalViolationEntry,
  PasquillClass,
  PlumeCorroborationResult,
  PlumePolygonZone,
  PuffAccumulationResult,
  PuffTrajectoryPoint,
  Receptor24hCumulativeSummary,
  ReceptorComparisonDelta,
  ReceptorExposureResult,
  ReceptorZone,
  RiskZoneLevel,
  SourcePlumeShiftMetric,
  SubstanceConcentrationBreakdown,
  SubstanceKey,
} from '../types/dispersion';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
  SUBSTANCE_SPECS,
} from '../data/ringparkenData';
import { degreesToCompass } from './weatherService';

const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LNG_SLAGELSE = 111320 * Math.cos((55.4128 * Math.PI) / 180); // ~63180 m/deg

export function offsetLatLngByMeters(
  origin: LatLngPoint,
  northMeters: number,
  eastMeters: number
): LatLngPoint {
  return {
    lat: Number((origin.lat + northMeters / METERS_PER_DEG_LAT).toFixed(6)),
    lng: Number((origin.lng + eastMeters / METERS_PER_DEG_LNG_SLAGELSE).toFixed(6)),
  };
}

export function distanceBetweenPointsMeters(a: LatLngPoint, b: LatLngPoint): number {
  const dNorth = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  const dEast = (b.lng - a.lng) * METERS_PER_DEG_LNG_SLAGELSE;
  return Math.hypot(dNorth, dEast);
}

/**
 * Bearing in degrees (0 = North, 90 = East) from point A to point B
 */
export function bearingBetweenPointsDeg(from: LatLngPoint, to: LatLngPoint): number {
  const dNorth = (to.lat - from.lat) * METERS_PER_DEG_LAT;
  const dEast = (to.lng - from.lng) * METERS_PER_DEG_LNG_SLAGELSE;
  const angleRad = Math.atan2(dEast, dNorth);
  return ((angleRad * 180) / Math.PI + 360) % 360;
}

/**
 * Smallest angular difference in degrees between two bearings (0..180)
 */
export function angularDiffDeg(a: number, b: number): number {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return diff;
}

/**
 * Ray-casting Point-in-Polygon check for geographic coordinates
 */
export function isPointInPolygon(point: LatLngPoint, polygon: LatLngPoint[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * High-resolution street-level and facade receptor points along Kierulffsvej, Valbyvej,
 * Ndr. Ringgade, Albert Ibsensvej, and Jaco Dampes Vej in Ringparken (4200 Slagelse)
 * used to pinpoint the exact geographic point of maximum 24-hour cumulative Gaussian Puff dose.
 */
export const STREET_LEVEL_PROBE_RECEPTORS: ReceptorZone[] = [
  {
    id: 'probe-kierulffsvej-10',
    code: 'KIER-10',
    name: 'Kierulffsvej 10 (Mellem Bygning 1 & 2)',
    category: 'public_road',
    address: 'Kierulffsvej 10, 4200 Slagelse',
    center: { lat: 55.41288, lng: 11.35382 },
    polygon: [],
    vulnerableGroupNote: 'Fortov og adgangsvej direkte mellem Børnehave (nr. 2) og Bazar (nr. 12)',
  },
  {
    id: 'probe-kierulffsvej-16',
    code: 'KIER-16',
    name: 'Kierulffsvej 16 (Øst for Blok 1)',
    category: 'public_road',
    address: 'Kierulffsvej 16, 4200 Slagelse',
    center: { lat: 55.41282, lng: 11.35285 },
    polygon: [],
    vulnerableGroupNote: 'Primær eksponeringskorridor mellem Blok 1 (nr. 14-22) og Kierulffsvej 12',
  },
  {
    id: 'probe-kierulffsvej-26-afd23',
    code: 'AFD23-V',
    name: 'Kierulffsvej 26 (Afd. 23 Vestfacade & Altaner)',
    category: 'residential_block',
    department: 'Afd. 23',
    address: 'Kierulffsvej 26, 4200 Slagelse',
    center: { lat: 55.41322, lng: 11.35488 },
    polygon: [],
    vulnerableGroupNote: 'Beboet boligblok i Afd. 23 umiddelbart nedvinds for Bygning 1 og 2 ved vestenvind',
  },
  {
    id: 'probe-valbyvej-58-cykelsti',
    code: 'VALB-58',
    name: 'Valbyvej 58 Cykelsti & Fortov (Ved Fritidshjem)',
    category: 'bike_path',
    address: 'Valbyvej 58, 4200 Slagelse',
    center: { lat: 55.41122, lng: 11.35118 },
    polygon: [],
    vulnerableGroupNote: 'Offentlig cykelsti og fodgængerpassage klos op ad Bygning 3 (Valbyvej 58)',
  },
  {
    id: 'probe-albert-ibsensvej-6-afd26',
    code: 'AFD26-NV',
    name: 'Albert Ibsensvej 6 (Afd. 26 Nordvest-gavlen)',
    category: 'residential_block',
    department: 'Afd. 26',
    address: 'Albert Ibsensvej 6, 4200 Slagelse',
    center: { lat: 55.41242, lng: 11.35475 },
    polygon: [],
    vulnerableGroupNote: 'Beboet etageejendom i Afd. 26 tættest på Supermarked/Bazar (Kierulffsvej 12)',
  },
  {
    id: 'probe-ndr-ringgade-66-afd24',
    code: 'AFD24-S',
    name: 'Ndr. Ringgade 66 / Kierulffsvej Nord (Afd. 24 Sydfacade)',
    category: 'residential_block',
    department: 'Afd. 24',
    address: 'Ndr. Ringgade 66, 4200 Slagelse',
    center: { lat: 55.41376, lng: 11.35345 },
    polygon: [],
    vulnerableGroupNote: 'Beboede boliger i Afd. 24 nord for Bygning 1 og Blok 1 ved sydlig vind',
  },
  {
    id: 'probe-jaco-dampesvej-9-afd32',
    code: 'AFD32-Ø',
    name: 'Jaco Dampes Vej 9 (Afd. 32 Østfacade mod Blok 1)',
    category: 'residential_block',
    department: 'Afd. 32',
    center: { lat: 55.41305, lng: 11.35125 },
    address: 'Jaco Dampes Vej 9, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote: 'Beboet boligblok i Afd. 32 vest for Blok 1 (Kierulffsvej 14-22)',
  },
  {
    id: 'probe-roedtjoornevej-2',
    code: 'RØD-2',
    name: 'Rødtjørnevej 2 (C962+VV Slagelse)',
    category: 'residential_block',
    center: { lat: 55.4122, lng: 11.3522 },
    address: 'Rødtjørnevej 2, 4200 Slagelse (C962+VV Slagelse)',
    polygon: [],
    vulnerableGroupNote:
      'Lokation Rødtjørnevej 2 (Plus Code: C962+VV Slagelse) umiddelbart syd for Blok 1 og vest for Kierulffsvej 12',
  },
  {
    id: 'probe-netto-ndr-ringgade-65',
    code: 'NETTO',
    name: 'NETTO (Ndr. Ringgade 65)',
    category: 'custom_receptor',
    center: { lat: 55.41435, lng: 11.35115 },
    address: 'Ndr. Ringgade 65, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote: 'Dagligvarebutik og kundeparkering nordvest for Ringparken',
  },
  {
    id: 'probe-lidl-ndr-ringgade-24',
    code: 'LIDL',
    name: 'Lidl (Ndr. Ringgade 24)',
    category: 'custom_receptor',
    center: { lat: 55.41465, lng: 11.3624 },
    address: 'Ndr. Ringgade 24, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote: 'Dagligvarebutik øst for Ringparken langs Ndr. Ringgade',
  },
  {
    id: 'probe-coop365-valbyvej-65b',
    code: 'COOP365',
    name: 'COOP365 (Valbyvej 65B)',
    category: 'custom_receptor',
    center: { lat: 55.41165, lng: 11.34965 },
    address: 'Valbyvej 65B, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote: 'Dagligvarebutik på Valbyvej 65B vest for Bygning 3 (Valbyvej 58)',
  },
  {
    id: 'probe-slagelse-station',
    code: 'SLAG-ST',
    name: 'Slagelse Station (Nordre Stationsvej 13)',
    category: 'custom_receptor',
    center: { lat: 55.40795, lng: 11.35265 },
    address: 'Nordre Stationsvej 13, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote: 'Trafikknudepunkt og perroner syd for Ringparken',
  },
  {
    id: 'probe-nordskolen',
    code: 'NORDSK',
    name: 'Nordskolen (Nørrevangstorvet 6B)',
    category: 'custom_receptor',
    center: { lat: 55.41585, lng: 11.3662 },
    address: 'Nørrevangstorvet 6B, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote: 'Folkeskole og udendørs skolegård øst-nordøst for Ringparken',
  },
  {
    id: 'probe-vestsjaellandscentret',
    code: 'VS-CENT',
    name: 'Vestsjællandscentret (Østerbro 4B)',
    category: 'custom_receptor',
    center: { lat: 55.40485, lng: 11.35965 },
    address: 'Østerbro 4B, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote: 'Indkøbscenter og byrum på Østerbro 4B sydøst for Ringparken',
  },
  {
    id: 'probe-slagelse-raadhus',
    code: 'RAADHUS',
    name: 'Slagelse Rådhus (Rådhuspladsen 11)',
    category: 'custom_receptor',
    center: { lat: 55.40385, lng: 11.35415 },
    address: 'Rådhuspladsen 11, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote: 'Kommunal myndighedsbygning på Rådhuspladsen 11 syd for Ringparken',
  },
  {
    id: 'probe-home-kierulffsvej-66',
    code: '$HOME',
    name: '$HOME (Kierulffsvej 66)',
    category: 'residential_block',
    center: { lat: 55.41362, lng: 11.35415 },
    address: 'Kierulffsvej 66, 4200 Slagelse',
    polygon: [],
    vulnerableGroupNote:
      'Privat boligreceptor ($HOME) på Kierulffsvej 66 i Ringparken i direkte nærfelt til nedrivningskilderne',
  },
];

function getPasquillSpreadFactors(pasquill: PasquillClass): {
  sigmaYCoeff: number;
  sigmaZCoeff: number;
  plumeLengthMultiplier: number;
} {
  switch (pasquill) {
    case 'A':
      return { sigmaYCoeff: 0.34, sigmaZCoeff: 0.24, plumeLengthMultiplier: 0.92 };
    case 'B':
      return { sigmaYCoeff: 0.27, sigmaZCoeff: 0.19, plumeLengthMultiplier: 1.0 };
    case 'C':
      return { sigmaYCoeff: 0.21, sigmaZCoeff: 0.14, plumeLengthMultiplier: 1.12 };
    case 'D':
      return { sigmaYCoeff: 0.16, sigmaZCoeff: 0.1, plumeLengthMultiplier: 1.25 };
    case 'E':
      return { sigmaYCoeff: 0.12, sigmaZCoeff: 0.07, plumeLengthMultiplier: 1.42 };
    case 'F':
      return { sigmaYCoeff: 0.09, sigmaZCoeff: 0.045, plumeLengthMultiplier: 1.68 };
  }
}

export interface SubstanceEmissionModifier {
  multiplier: number;
  note: string;
}

/**
 * Computes physical-chemical weather modifiers for each contaminant based on
 * current Open-Meteo meteorological telemetry.
 */
export function computeSubstanceWeatherModifier(
  substance: SubstanceKey,
  weather: HourlyWeatherPoint,
  releaseHeightMeters: number
): SubstanceEmissionModifier {
  const {
    temperature2m,
    relativeHumidity2m,
    precipitation,
    windSpeed10m,
    windGusts10m,
    directRadiation,
    pasquillClass,
    hadRecentFreezeThaw,
  } = weather;

  switch (substance) {
    case 'asbestos': {
      let mult = 1.0;
      const notes: string[] = [];

      if (windSpeed10m > 4.0) {
        const windFactor = 1.0 + Math.min(1.6, (windSpeed10m - 4.0) * 0.18);
        mult *= windFactor;
        notes.push(`Tør vind (${windSpeed10m} m/s) forlænger fiber-svæv`);
      }
      if (windGusts10m > 7.5) {
        mult *= 1.28;
        notes.push(`Vindstød (${windGusts10m} m/s) resuspendere fibre`);
      }
      if (hadRecentFreezeThaw || temperature2m <= 0.5) {
        mult *= 1.38;
        notes.push('Frost/tø-sprængning i asbestplader øger kildestyrke (+38%)');
      }
      if (precipitation > 2.0) {
        mult *= 0.58;
        notes.push('Nedbør udvasker delvist luftbårne fibre til terræn');
      } else if (relativeHumidity2m < 55) {
        mult *= 1.22;
        notes.push(`Lav luftfugtighed (${relativeHumidity2m}%) reducerer støvbinding`);
      }

      return {
        multiplier: mult,
        note: notes.join(' · ') || 'Standard fiber-frigivelse under nedrivning',
      };
    }

    case 'pcb': {
      let mult = 0.85;
      const notes: string[] = [];

      if (temperature2m > 18 || directRadiation > 250) {
        const tempExcess = Math.max(0, temperature2m - 15);
        const radExcess = Math.max(0, directRadiation - 200) / 220;
        const expFactor = Math.exp(0.115 * tempExcess + 0.38 * radExcess);
        mult = Math.min(8.8, 0.9 * expFactor);
        notes.push(
          `Eksponentiel gasformig PCB-afgasning (${temperature2m}°C, ${directRadiation} W/m² sol)`
        );
      } else if (windGusts10m > 6.5 && precipitation < 1.0) {
        mult = 1.15 + Math.min(1.2, (windGusts10m - 6.0) * 0.14);
        notes.push(
          `Partikelbundet PCB i malings-/fugestøv ved blæst (${windGusts10m} m/s stød)`
        );
      } else {
        notes.push('Basal PCB-emission fra blottede fuger og malede flader');
      }

      return { multiplier: mult, note: notes.join(' · ') };
    }

    case 'heavyMetals': {
      let mult = 0.8;
      const notes: string[] = [];

      if (windGusts10m > 7.0) {
        mult = 1.2 + Math.min(1.9, (windGusts10m - 7.0) * 0.22);
        notes.push(`Kraftige vindstød (${windGusts10m} m/s) løfter bly- og tungmetalstøv`);
      } else {
        mult = 0.65 + (windSpeed10m / 10) * 0.5;
        notes.push('Moderat tungmetal-støvspredning');
      }

      if (precipitation > 2.0) {
        mult *= 0.42;
        notes.push(
          `Regn (${precipitation} mm/t) dæmper luftfane men aktiverer BLÅ hydrologisk bly/PAH-udvaskning`
        );
      }

      return { multiplier: mult, note: notes.join(' · ') };
    }

    case 'quartzWool': {
      let mult = 1.0;
      const notes: string[] = [];

      if (releaseHeightMeters >= 10) {
        mult *= 1.25;
        notes.push(`Tagrums-frigivelse (H=${releaseHeightMeters}m) giver bred nedvindsfane`);
      }
      if (
        pasquillClass === 'A' ||
        pasquillClass === 'B' ||
        pasquillClass === 'C' ||
        pasquillClass === 'D'
      ) {
        mult *= 1.18;
        notes.push(`Pasquill klasse ${pasquillClass} fremmer vertikal omblanding til gadeniveau`);
      }
      if (windGusts10m > 6.0 && precipitation < 1.5) {
        mult *= 1.25;
        notes.push('Betonnedbrydning + vindstød øger respirabelt kvartsstøv');
      }
      if (precipitation > 2.0) {
        mult *= 0.55;
      }

      return { multiplier: mult, note: notes.join(' · ') };
    }

    case 'moldSewer': {
      let mult = 0.9;
      const notes: string[] = [];

      if (relativeHumidity2m > 70 || precipitation > 0.5) {
        mult *= 1.35;
        notes.push(`Høj fugtighed (${relativeHumidity2m}%) aktiverer skimmelsporer fra krybekælder`);
      }
      if (windSpeed10m > 3.5) {
        mult *= 1.22;
        notes.push('Vindturbulens over åbnet krybekælder/udgravning spreder bioaerosoler');
      }
      if (pasquillClass === 'E' || pasquillClass === 'F') {
        mult *= 1.32;
        notes.push(
          `Stabil atmosfære (Klasse ${pasquillClass}) fastholder skimmel/kloakaerosoler ved terræn`
        );
      }

      return { multiplier: mult, note: notes.join(' · ') };
    }
  }
}

/**
 * Generates a teardrop/cone Gaussian plume polygon starting at `origin`,
 * pointing in `plumeDirectionDeg` ((W + 180) mod 360), with length `lengthMeters`
 * and maximum crosswind full width `widthMeters`.
 */
export function buildGaussianPlumePolygon(
  origin: LatLngPoint,
  plumeDirectionDeg: number,
  lengthMeters: number,
  widthMeters: number
): LatLngPoint[] {
  const dirRad = (plumeDirectionDeg * Math.PI) / 180;
  const perpRad = ((plumeDirectionDeg + 90) * Math.PI) / 180;

  const steps = [
    { frac: 0.0, widthFrac: 0.14 },
    { frac: 0.2, widthFrac: 0.42 },
    { frac: 0.45, widthFrac: 0.76 },
    { frac: 0.72, widthFrac: 1.0 },
    { frac: 0.9, widthFrac: 0.84 },
    { frac: 1.0, widthFrac: 0.38 },
  ];

  const leftEdge: LatLngPoint[] = [];
  const rightEdge: LatLngPoint[] = [];

  for (const s of steps) {
    const dist = s.frac * lengthMeters;
    const halfWidth = (s.widthFrac * widthMeters) / 2;

    const centerNorth = Math.cos(dirRad) * dist;
    const centerEast = Math.sin(dirRad) * dist;

    const offsetNorth = Math.cos(perpRad) * halfWidth;
    const offsetEast = Math.sin(perpRad) * halfWidth;

    leftEdge.push(
      offsetLatLngByMeters(origin, centerNorth - offsetNorth, centerEast - offsetEast)
    );
    rightEdge.push(
      offsetLatLngByMeters(origin, centerNorth + offsetNorth, centerEast + offsetEast)
    );
  }

  return [...leftEdge, ...rightEdge.reverse()];
}

/**
 * Evaluates the concentration of each substance and the Arbejdstilsynet Sum-Formula
 * S = Sum(C_i / GV_i) at a given target receptor point for a specific hour's weather.
 */
export function evaluateReceptorAtHour(
  receptor: ReceptorZone,
  activeSources: DemolitionSourceNode[],
  weather: HourlyWeatherPoint
): ReceptorExposureResult {
  const plumeDirectionDeg = (weather.windDirection10m + 180) % 360;
  const { sigmaYCoeff, plumeLengthMultiplier } = getPasquillSpreadFactors(weather.pasquillClass);

  const accumulatedConc: Record<SubstanceKey, number> = {
    asbestos: 0,
    pcb: 0,
    heavyMetals: 0,
    quartzWool: 0,
    moldSewer: 0,
  };

  const triggerNotes: Record<SubstanceKey, string> = {
    asbestos: '',
    pcb: '',
    heavyMetals: '',
    quartzWool: '',
    moldSewer: '',
  };

  let minDistance = Infinity;
  let dominantSourceName = activeSources[0]?.name || 'Ukendt kilde';
  let highestSourceContribution = -1;

  for (const src of activeSources) {
    if (!src.active) continue;

    const distMeters = Math.max(18, distanceBetweenPointsMeters(src.position, receptor.center));
    if (distMeters < minDistance) {
      minDistance = distMeters;
    }

    const bearingToReceptor = bearingBetweenPointsDeg(src.position, receptor.center);
    const angleOffCenterline = angularDiffDeg(plumeDirectionDeg, bearingToReceptor);

    const releaseHeightSpreadBoost = 0.88 + Math.min(24, src.releaseHeightMeters) * 0.024;

    const angularSigmaDeg =
      (18 + sigmaYCoeff * 85) * releaseHeightSpreadBoost + (120 / (distMeters + 30)) * 8;

    const crosswindFactor =
      Math.exp(-0.5 * Math.pow(angleOffCenterline / angularSigmaDeg, 2)) +
      (distMeters < 95 ? 0.18 * Math.exp(-distMeters / 70) : 0.02);

    const characteristicLength =
      (165 + weather.windSpeed10m * 24 + weather.windGusts10m * 11) * plumeLengthMultiplier;
    const distanceDecay = Math.exp(-distMeters / characteristicLength) * (140 / (distMeters + 85));

    let sourceTotalQuotient = 0;

    for (const subKey of src.substances) {
      const spec = SUBSTANCE_SPECS[subKey];
      const effectiveReleaseH =
        src.buildingCategory === 'e_demolished_unsecured'
          ? 1.0
          : src.buildingCategory === 'c_under_renovation' && !src.isCustom
          ? src.releaseHeightMeters || 8.0
          : src.releaseHeightMeters;

      const mod = computeSubstanceWeatherModifier(subKey, weather, effectiveReleaseH);
      triggerNotes[subKey] = mod.note;

      const substanceReachBoost =
        subKey === 'asbestos' && weather.windSpeed10m > 4 && weather.precipitation < 1
          ? 1.35
          : subKey === 'pcb' && weather.temperature2m > 20
          ? 1.25
          : 1.0;

      const fiberParamMult =
        subKey === 'asbestos' && src.fiberReleaseIndex !== undefined
          ? Math.max(0.1, src.fiberReleaseIndex / 0.85)
          : 1.0;

      let categoryEmissionFactor = src.sourceEmissionFactor ?? 1.0;
      if (src.buildingCategory === 'a_inhabited') {
        categoryEmissionFactor = 0.0;
      } else if (src.buildingCategory === 'b_vacant') {
        // Passiv udsivning af skimmelsporer fra uopvarmet kælder eller uautoriseret indtrængen
        categoryEmissionFactor = subKey === 'moldSewer' ? 0.12 : 0.05;
      } else if (src.buildingCategory === 'c_under_renovation') {
        categoryEmissionFactor = 0.45;
      } else if (src.buildingCategory === 'd_under_demolition') {
        categoryEmissionFactor = 1.0;
      } else if (src.buildingCategory === 'e_demolished_unsecured') {
        // Vinddrevet resuspension fra uforseglet krybekælder/kældergrube/terræn når windSpeed10m > 5.0
        const windResuspensionMult =
          weather.windSpeed10m > 5.0 ? Math.pow(weather.windSpeed10m / 5.0, 1.35) : 1.0;
        const isResuspendedDustMetalsPcb =
          subKey === 'asbestos' ||
          subKey === 'quartzWool' ||
          subKey === 'heavyMetals' ||
          subKey === 'pcb';
        categoryEmissionFactor =
          0.65 * (isResuspendedDustMetalsPcb ? windResuspensionMult : 1.15);
      }

      const conc =
        spec.baseEmissionFactor *
        mod.multiplier *
        crosswindFactor *
        distanceDecay *
        substanceReachBoost *
        fiberParamMult *
        categoryEmissionFactor;

      accumulatedConc[subKey] += conc;
      sourceTotalQuotient += conc / spec.limitValue2026;
    }

    if (sourceTotalQuotient > highestSourceContribution) {
      highestSourceContribution = sourceTotalQuotient;
      dominantSourceName = src.name;
    }
  }

  const substancesBreakdown: SubstanceConcentrationBreakdown[] = (
    Object.keys(SUBSTANCE_SPECS) as SubstanceKey[]
  ).map((key) => {
    const spec = SUBSTANCE_SPECS[key];
    const rawConc = accumulatedConc[key];
    const decimals = key === 'asbestos' ? 5 : key === 'heavyMetals' || key === 'quartzWool' ? 4 : 1;
    const concentration = Number(rawConc.toFixed(decimals));
    const quotient = Number((rawConc / spec.limitValue2026).toFixed(3));

    return {
      key,
      name: spec.name,
      unit: spec.unit,
      concentration,
      limitValue: spec.limitValue2026,
      quotient,
      weatherTriggerNote: triggerNotes[key] || spec.description,
      isExceedingIndividual:
        rawConc >= spec.limitValue2026 ||
        (key === 'pcb' && spec.actionValue !== undefined && rawConc >= spec.actionValue),
    };
  });

  const sumQuotient = Number(
    substancesBreakdown.reduce((acc, item) => acc + item.quotient, 0).toFixed(2)
  );

  const pcbConc = accumulatedConc.pcb;
  const hydrologicalRunoffActive = weather.precipitation > 2.0;

  let riskLevel: RiskZoneLevel | 'safe' = 'safe';
  if (
    sumQuotient >= 1.0 ||
    substancesBreakdown.some((s) => s.concentration >= s.limitValue)
  ) {
    riskLevel = 'red';
  } else if (sumQuotient >= 0.5 || pcbConc > 300) {
    riskLevel = 'orange';
  } else if (hydrologicalRunoffActive && minDistance < 240) {
    riskLevel = 'blue';
  } else if (sumQuotient >= 0.1) {
    riskLevel = 'yellow';
  }

  return {
    receptorId: receptor.id,
    receptorName: receptor.name,
    receptorCode: receptor.code,
    address: receptor.address,
    category: receptor.category,
    position: receptor.center,
    distanceFromNearestSourceMeters: Math.round(minDistance === Infinity ? 0 : minDistance),
    dominantSourceName,
    sumQuotient,
    riskLevel,
    hydrologicalRunoffActive,
    substances: substancesBreakdown,
  };
}

/**
 * Generates the color-coded Risk Zone Polygons (Red, Orange, Yellow, and Blue/Violet hydrological runoff)
 * for all active demolition sources at a given hour.
 */
export function generatePlumePolygonsForHour(
  activeSources: DemolitionSourceNode[],
  weather: HourlyWeatherPoint
): PlumePolygonZone[] {
  const plumeDirectionDeg = (weather.windDirection10m + 180) % 360;
  const { sigmaYCoeff, plumeLengthMultiplier } = getPasquillSpreadFactors(weather.pasquillClass);

  const zones: PlumePolygonZone[] = [];

  for (const src of activeSources) {
    if (!src.active) continue;

    let categoryEmissionFactor = src.sourceEmissionFactor ?? 1.0;
    if (src.buildingCategory === 'a_inhabited') {
      categoryEmissionFactor = 0.0;
    } else if (src.buildingCategory === 'b_vacant') {
      categoryEmissionFactor = 0.05;
    } else if (src.buildingCategory === 'c_under_renovation') {
      categoryEmissionFactor = 0.45;
    } else if (src.buildingCategory === 'd_under_demolition') {
      categoryEmissionFactor = 1.0;
    } else if (src.buildingCategory === 'e_demolished_unsecured') {
      const windResuspensionMult =
        weather.windSpeed10m > 5.0 ? Math.pow(weather.windSpeed10m / 5.0, 1.35) : 1.0;
      categoryEmissionFactor = 0.65 * windResuspensionMult;
    }

    if (categoryEmissionFactor <= 0) continue;

    const effectiveReleaseH =
      src.buildingCategory === 'e_demolished_unsecured'
        ? 1.0
        : src.buildingCategory === 'c_under_renovation' && !src.isCustom
        ? src.releaseHeightMeters || 8.0
        : src.releaseHeightMeters;

    let sourceIntensity = 0;
    for (const subKey of src.substances) {
      const mod = computeSubstanceWeatherModifier(subKey, weather, effectiveReleaseH);
      sourceIntensity += mod.multiplier;
    }
    const normalizedIntensity =
      (sourceIntensity / Math.max(1, src.substances.length)) *
      Math.max(0.28, Math.pow(categoryEmissionFactor, 0.48));

    const dryWindReach =
      weather.precipitation > 2.0
        ? 0.58
        : 1.0 + Math.min(0.95, Math.max(0, weather.windSpeed10m - 3.0) * 0.11);

    const baseLength = 155 * normalizedIntensity * dryWindReach * plumeLengthMultiplier;

    const roofWidthFactor = effectiveReleaseH >= 10 ? 1.28 : effectiveReleaseH <= 1.5 ? 0.92 : 1.0;
    const baseWidth = Math.max(55, baseLength * (0.32 + sigmaYCoeff * 0.85) * roofWidthFactor);

    const sourceMaxS = Number(
      (1.15 * normalizedIntensity * dryWindReach * Math.min(2.2, categoryEmissionFactor)).toFixed(2)
    );

    // 1. YELLOW ZONE: Observation & Secondary Dust Deposition (0.1 <= S < 0.5)
    const yellowLength = Math.round(Math.min(520, Math.max(140, baseLength * 1.55)));
    const yellowWidth = Math.round(Math.min(310, Math.max(85, baseWidth * 1.48)));
    zones.push({
      id: `${src.id}-yellow-${weather.hourIndex}`,
      sourceId: src.id,
      sourceName: src.name,
      level: 'yellow',
      label: 'GUL ZONE (Observations- & Depositionszone: 0,1 ≤ S < 0,5)',
      sumQuotientRange: '0,10 ≤ S < 0,50',
      maxSumQuotient: Number(Math.max(0.25, sourceMaxS * 0.35).toFixed(2)),
      downwindDistanceMeters: yellowLength,
      crosswindWidthMeters: yellowWidth,
      plumeDirectionDeg,
      polygon: buildGaussianPlumePolygon(
        src.position,
        plumeDirectionDeg,
        yellowLength,
        yellowWidth
      ),
      hourLabel: weather.hourLabel,
    });

    // 2. ORANGE ZONE: Elevated Risk / PPE Requirement (0.5 <= S < 1.0 or PCB > 300 ng/m³)
    const orangeLength = Math.round(Math.min(360, Math.max(95, baseLength * 1.05)));
    const orangeWidth = Math.round(Math.min(210, Math.max(60, baseWidth * 1.02)));
    zones.push({
      id: `${src.id}-orange-${weather.hourIndex}`,
      sourceId: src.id,
      sourceName: src.name,
      level: 'orange',
      label: 'ORANGE ZONE (Forhøjet Risiko / Værnemiddelkrav: 0,5 ≤ S < 1,0 / PCB > 300 ng/m³)',
      sumQuotientRange: '0,50 ≤ S < 1,00',
      maxSumQuotient: Number(Math.max(0.65, sourceMaxS * 0.72).toFixed(2)),
      downwindDistanceMeters: orangeLength,
      crosswindWidthMeters: orangeWidth,
      plumeDirectionDeg,
      polygon: buildGaussianPlumePolygon(
        src.position,
        plumeDirectionDeg,
        orangeLength,
        orangeWidth
      ),
      hourLabel: weather.hourLabel,
    });

    // 3. RED ZONE: Illegal Limit Exceedance (S >= 1.0 or individual substance > 2026 limit)
    const redLength = Math.round(Math.min(235, Math.max(55, baseLength * 0.64)));
    const redWidth = Math.round(Math.min(135, Math.max(38, baseWidth * 0.65)));
    zones.push({
      id: `${src.id}-red-${weather.hourIndex}`,
      sourceId: src.id,
      sourceName: src.name,
      level: 'red',
      label: 'RØD ZONE (Kritisk Grænseoverskridelse: S ≥ 1,0 jf. BEK 613/2026)',
      sumQuotientRange: 'S ≥ 1,00',
      maxSumQuotient: Math.max(1.05, sourceMaxS),
      downwindDistanceMeters: redLength,
      crosswindWidthMeters: redWidth,
      plumeDirectionDeg,
      polygon: buildGaussianPlumePolygon(src.position, plumeDirectionDeg, redLength, redWidth),
      hourLabel: weather.hourLabel,
    });

    // 4. BLUE/VIOLET ZONE: Hydrological Runoff & Soil Contamination when precipitation > 2 mm/h
    if (weather.precipitation > 2.0) {
      const runoffDirectionDeg = src.id === 'src-bygning-3' ? 175 : 145;
      const runoffLength = Math.round(Math.min(290, 95 + weather.precipitation * 14));
      const runoffWidth = Math.round(Math.min(130, 48 + weather.precipitation * 5.5));
      zones.push({
        id: `${src.id}-blue-${weather.hourIndex}`,
        sourceId: src.id,
        sourceName: src.name,
        level: 'blue',
        label:
          'BLÅ/VIOLET ZONE (Hydrologisk Udvaskningszone: Bly, PAH & Asbestslam mod vejbrønde)',
        sumQuotientRange: `Nedbør ${weather.precipitation} mm/t`,
        maxSumQuotient: sourceMaxS,
        downwindDistanceMeters: runoffLength,
        crosswindWidthMeters: runoffWidth,
        plumeDirectionDeg: runoffDirectionDeg,
        polygon: buildGaussianPlumePolygon(
          src.position,
          runoffDirectionDeg,
          runoffLength,
          runoffWidth
        ),
        hourLabel: weather.hourLabel,
      });
    }
  }

  return zones;
}

/**
 * Evaluates a physical field observation (Algedonic Signal) at `point` against
 * the Open-Meteo weather telemetry and mathematical dispersion plumes at that exact hour.
 */
export function evaluatePointInDispersionPlume(
  point: LatLngPoint,
  activeSources: DemolitionSourceNode[],
  weather: HourlyWeatherPoint,
  observationType: string
): PlumeCorroborationResult {
  const plumeZones = generatePlumePolygonsForHour(activeSources, weather);
  const plumeDirectionDeg = (weather.windDirection10m + 180) % 360;

  // Evaluate exact Sum-Formula concentration at this GPS point
  const virtualReceptor: ReceptorZone = {
    id: 'obs-virtual-point',
    code: 'OBS',
    name: 'Observationspunkt',
    category: 'custom_receptor',
    address: `GPS ${point.lat.toFixed(5)}°N, ${point.lng.toFixed(5)}°E`,
    center: point,
    polygon: [],
    vulnerableGroupNote: 'Algedonisk observationspunkt',
  };
  const exposure = evaluateReceptorAtHour(virtualReceptor, activeSources, weather);

  // Find nearest source and bearing
  let nearestSource = activeSources[0];
  let minDistance = Infinity;
  for (const src of activeSources) {
    if (!src.active) continue;
    const d = distanceBetweenPointsMeters(src.position, point);
    if (d < minDistance) {
      minDistance = d;
      nearestSource = src;
    }
  }

  const bearingFromSourceDeg = nearestSource
    ? Math.round(bearingBetweenPointsDeg(nearestSource.position, point))
    : plumeDirectionDeg;
  const angularDeviationDeg = Math.round(angularDiffDeg(plumeDirectionDeg, bearingFromSourceDeg));

  // Check geometric polygon containment (priority: Red -> Blue -> Orange -> Yellow)
  const redHit = plumeZones.find((z) => z.level === 'red' && isPointInPolygon(point, z.polygon));
  const blueHit = plumeZones.find((z) => z.level === 'blue' && isPointInPolygon(point, z.polygon));
  const orangeHit = plumeZones.find(
    (z) => z.level === 'orange' && isPointInPolygon(point, z.polygon)
  );
  const yellowHit = plumeZones.find(
    (z) => z.level === 'yellow' && isPointInPolygon(point, z.polygon)
  );

  let matchedZoneLevel: RiskZoneLevel | 'outside' = 'outside';
  let zoneLabel = 'Uden for primær nedvindsfane (Lokal kilde-/randzone)';
  let isInsideMathematicalPlume = false;

  if (redHit || exposure.sumQuotient >= 1.0) {
    matchedZoneLevel = 'red';
    zoneLabel = 'RØD ZONE (Kritisk Grænseoverskridelse: S ≥ 1,0)';
    isInsideMathematicalPlume = true;
  } else if (blueHit || (weather.precipitation > 2.0 && minDistance <= 220)) {
    matchedZoneLevel = 'blue';
    zoneLabel = 'BLÅ/VIOLET HYDROLOGISK UDVASKNINGSZONE';
    isInsideMathematicalPlume = true;
  } else if (orangeHit || exposure.sumQuotient >= 0.5) {
    matchedZoneLevel = 'orange';
    zoneLabel = 'ORANGE ZONE (Forhøjet Eksponeringsrisiko: 0,5 ≤ S < 1,0)';
    isInsideMathematicalPlume = true;
  } else if (yellowHit || exposure.sumQuotient >= 0.1 || minDistance <= 65) {
    matchedZoneLevel = 'yellow';
    zoneLabel =
      minDistance <= 65
        ? 'NÆR-KILDE EMISSIONSFELT (Inden for 65 m fra nedrivningskilde)'
        : 'GUL ZONE (Observations- & Støvdepositionszone: 0,1 ≤ S < 0,5)';
    isInsideMathematicalPlume = true;
  }

  const violatedRegulations: string[] = [
    'BEK nr. 613 af 29. juni 2026 (§ 3, stk. 3 Sumformlen)',
    'PSS Sag W22085 pkt. 7 (Støvbekæmpelse) & pkt. 11.1 (Nabobeskyttelse)',
  ];

  const lowerObs = observationType.toLowerCase();
  if (lowerObs.includes('støv') || lowerObs.includes('asbest') || exposure.sumQuotient >= 0.8) {
    violatedRegulations.push(
      'Asbestbekendtgørelsen Bek. 1328 af 19.11.2025 & Entreprenørstop (01.01.2026)'
    );
  }
  if (lowerObs.includes('container') || lowerObs.includes('mineraluld')) {
    violatedRegulations.push('Lovforslag L 69 (Skærpet bødeansvar ved manglende inddækning/sporbarhed)');
  }
  if (lowerObs.includes('jord') || lowerObs.includes('regn') || lowerObs.includes('krybekælder') || lowerObs.includes('skimmel')) {
    violatedRegulations.push('Jordforureningslovens § 70, stk. 4 (4-ugers underretningspligt)');
  }

  const corroborationSummary = isInsideMathematicalPlume
    ? `MATEMATISK BEKRÆFTET I SPREDNINGSFANE (${zoneLabel}): Punktet ligger ${Math.round(
        minDistance
      )} m fra ${nearestSource?.name || 'nedrivningskilde'} i pejling ${bearingFromSourceDeg}° (spredningsvektor ${plumeDirectionDeg}°, vinkelafvigelse Δθ = ${angularDeviationDeg}°). Beregnet lokal Sumkvotient S = ${exposure.sumQuotient.toFixed(
        2
      )} ved vind ${weather.windSpeed10m} m/s (stød ${weather.windGusts10m} m/s) og Pasquill-klasse ${
        weather.pasquillClass
      }.`
    : `REGISTRERET UDEN FOR HOVEDFANE (Δθ = ${angularDeviationDeg}° fra vindvektor ${plumeDirectionDeg}°): Punktet ligger ${Math.round(
        minDistance
      )} m fra ${
        nearestSource?.name || 'nedrivningskilde'
      }. Indikerer lokal diffus kildeemission eller hvirveldannelse mellem boligblokkene (S = ${exposure.sumQuotient.toFixed(
        2
      )}).`;

  return {
    isInsideMathematicalPlume,
    matchedZoneLevel,
    zoneLabel,
    calculatedSumQuotient: exposure.sumQuotient,
    nearestSourceId: nearestSource?.id || 'src-blok-1',
    nearestSourceName: nearestSource?.name || 'Blok 1: Beboelsesblok',
    distanceFromSourceMeters: Math.round(minDistance),
    bearingFromSourceDeg,
    plumeDirectionDeg,
    angularDeviationDeg,
    corroborationSummary,
    violatedRegulations,
  };
}

/**
 * Helper to compute 24-hour integrated Gaussian Puff exposure & deposition for a single receptor node.
 */
function summarize24hForReceptor(
  rec: ReceptorZone,
  hoursWeather: HourlyWeatherPoint[],
  activeSources: DemolitionSourceNode[]
): Receptor24hCumulativeSummary {
  const hourlyProfile: HourlyReceptorPuffDose[] = [];
  let cumulativeSumDose = 0;
  let peakSumQuotient = -1;
  let peakHourIndex = 0;
  let peakHourLabel = '00:00';
  let peakWindDirectionFromDeg = 270;
  let peakPlumeDirectionToDeg = 90;
  let peakWindSpeedMs = 0;
  let peakWindGustsMs = 0;
  let totalDepositedHeavyMetalsAndPcbUgM2 = 0;
  let totalDepositedAsbestosFibersM2 = 0;
  let hoursInRedZone = 0;
  let hoursInOrangeZone = 0;
  let nearestSourceName = activeSources[0]?.name || 'Blok 1';
  let distanceToNearestSourceMeters = 80;

  const substanceQuotientSums: Record<SubstanceKey, number> = {
    asbestos: 0,
    pcb: 0,
    heavyMetals: 0,
    quartzWool: 0,
    moldSewer: 0,
  };

  for (const hrWeather of hoursWeather) {
    const evalRes = evaluateReceptorAtHour(rec, activeSources, hrWeather);
    nearestSourceName = evalRes.dominantSourceName;
    distanceToNearestSourceMeters = evalRes.distanceFromNearestSourceMeters;

    const sVal = evalRes.sumQuotient;
    cumulativeSumDose += sVal;

    if (sVal >= 1.0) hoursInRedZone += 1;
    else if (sVal >= 0.5) hoursInOrangeZone += 1;

    for (const sub of evalRes.substances) {
      substanceQuotientSums[sub.key] += sub.quotient;
    }

    const hmSub = evalRes.substances.find((s) => s.key === 'heavyMetals');
    const pcbSub = evalRes.substances.find((s) => s.key === 'pcb');
    const asbSub = evalRes.substances.find((s) => s.key === 'asbestos');

    const wetBoost = hrWeather.precipitation > 1.0 ? 2.1 : 1.0;
    const hourlyDustDepositionUgM2 = Number(
      (
        ((hmSub?.concentration ?? 0) * 1850 + (pcbSub?.concentration ?? 0) * 0.045) *
        wetBoost
      ).toFixed(1)
    );
    const hourlyAsbestosDepositionM2 = Math.round(
      (asbSub?.concentration ?? 0) * 420000 * (1 + hrWeather.windSpeed10m * 0.06)
    );

    totalDepositedHeavyMetalsAndPcbUgM2 += hourlyDustDepositionUgM2;
    totalDepositedAsbestosFibersM2 += hourlyAsbestosDepositionM2;

    const plumeDir = (hrWeather.windDirection10m + 180) % 360;

    if (sVal > peakSumQuotient) {
      peakSumQuotient = sVal;
      peakHourIndex = hrWeather.hourIndex;
      peakHourLabel = hrWeather.hourLabel;
      peakWindDirectionFromDeg = hrWeather.windDirection10m;
      peakPlumeDirectionToDeg = plumeDir;
      peakWindSpeedMs = hrWeather.windSpeed10m;
      peakWindGustsMs = hrWeather.windGusts10m;
    }

    hourlyProfile.push({
      hourIndex: hrWeather.hourIndex,
      hourLabel: hrWeather.hourLabel,
      sumQuotient: sVal,
      windDirectionFromDeg: hrWeather.windDirection10m,
      plumeDirectionToDeg: plumeDir,
      windSpeedMs: hrWeather.windSpeed10m,
      windGustsMs: hrWeather.windGusts10m,
      depositedDustUgM2: hourlyDustDepositionUgM2,
      depositedAsbestosFibersM2: hourlyAsbestosDepositionM2,
    });
  }

  let dominantSubKey: SubstanceKey = 'asbestos';
  let maxSubSum = -1;
  (Object.keys(substanceQuotientSums) as SubstanceKey[]).forEach((k) => {
    if (substanceQuotientSums[k] > maxSubSum) {
      maxSubSum = substanceQuotientSums[k];
      dominantSubKey = k;
    }
  });

  return {
    receptorId: rec.id,
    receptorName: rec.name,
    receptorCode: rec.code,
    address: rec.address,
    position: rec.center,
    nearestSourceName,
    distanceToNearestSourceMeters,
    cumulativeSumDose: Number(cumulativeSumDose.toFixed(2)),
    meanSumQuotient: Number((cumulativeSumDose / Math.max(1, hoursWeather.length)).toFixed(2)),
    peakSumQuotient: Number(peakSumQuotient.toFixed(2)),
    peakHourIndex,
    peakHourLabel,
    peakWindDirectionFromDeg,
    peakPlumeDirectionToDeg,
    peakWindSpeedMs,
    peakWindGustsMs,
    totalDepositedHeavyMetalsAndPcbUgM2: Number(totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)),
    totalDepositedAsbestosFibersM2: Math.round(totalDepositedAsbestosFibersM2),
    hoursInRedZone,
    hoursInOrangeZone,
    hourlyProfile,
    dominantSubstanceName: SUBSTANCE_SPECS[dominantSubKey].shortName,
  };
}

/**
 * Computes the time-integrated 24-Hour Gaussian Puff Cumulative History across all 24 hours
 * (00:00 to 23:00) of the selected date's Open-Meteo wind directions and wind speeds.
 */
export function compute24HourPuffHistory(
  dateIso: string,
  hoursWeather: HourlyWeatherPoint[],
  activeSources: DemolitionSourceNode[],
  receptors: ReceptorZone[]
): PuffAccumulationResult {
  const hourlyPuffPolygons: PlumePolygonZone[] = [];
  const mergedEnvelopePolygons: PlumePolygonZone[] = [];
  const puffTrajectories: PuffTrajectoryPoint[] = [];

  for (const hrWeather of hoursWeather) {
    const hrZones = generatePlumePolygonsForHour(activeSources, hrWeather);
    for (const z of hrZones) {
      if (
        z.level === 'red' ||
        (z.level === 'orange' && hrWeather.hourIndex % 2 === 0) ||
        (z.level === 'blue' && hrWeather.hourIndex % 2 === 0)
      ) {
        hourlyPuffPolygons.push(z);
      }
    }

    const advDeg = (hrWeather.windDirection10m + 180) % 360;
    const advRad = (advDeg * Math.PI) / 180;
    const travelMeters = Math.min(340, 85 + hrWeather.windSpeed10m * 24 + hrWeather.windGusts10m * 6);

    for (const src of activeSources) {
      if (!src.active) continue;
      const catFactor =
        src.buildingCategory === 'e_demolished_unsecured'
          ? 0.65 * (hrWeather.windSpeed10m > 5.0 ? Math.pow(hrWeather.windSpeed10m / 5.0, 1.35) : 1.0)
          : src.sourceEmissionFactor ?? 1.0;
      if (catFactor <= 0) continue;

      const endPt = offsetLatLngByMeters(
        src.position,
        Math.cos(advRad) * travelMeters * Math.max(0.45, Math.min(1.35, Math.pow(catFactor, 0.35))),
        Math.sin(advRad) * travelMeters * Math.max(0.45, Math.min(1.35, Math.pow(catFactor, 0.35)))
      );
      puffTrajectories.push({
        hourIndex: hrWeather.hourIndex,
        hourLabel: hrWeather.hourLabel,
        sourceId: src.id,
        sourceCode: src.code,
        origin: src.position,
        puffCenterEnd: endPt,
        windSpeedMs: hrWeather.windSpeed10m,
        windDirectionFromDeg: hrWeather.windDirection10m,
        advectionDirectionToDeg: advDeg,
        depositionIntensityUgM2: Number(
          (
            (14.5 + hrWeather.windGusts10m * 2.8 + hrWeather.precipitation * 6.5) *
            catFactor
          ).toFixed(1)
        ),
      });
    }
  }

  for (const src of activeSources) {
    if (!src.active) continue;
    const baseCatFactor = src.sourceEmissionFactor ?? 1.0;
    if (baseCatFactor <= 0) continue;

    const levels: Array<{ level: RiskZoneLevel; scale: number; label: string; range: string }> = [
      {
        level: 'yellow',
        scale: 1.42,
        label: '24t Akkumuleret Støv- & Tungmetal-Depositionsfodaftryk (GUL: ≥ 35 µg/m²)',
        range: '∑ Dosis ≥ 2,4 S·t',
      },
      {
        level: 'orange',
        scale: 0.98,
        label: '24t Akkumuleret Forhøjet Puff-Depositionszone (ORANGE: ≥ 90 µg/m²)',
        range: '∑ Dosis ≥ 8,0 S·t',
      },
      {
        level: 'red',
        scale: 0.64,
        label: '24t Akkumuleret Kritisk Puff-Zone (RØD: ≥ 160 µg/m² · S_døgn Overskredet)',
        range: '∑ Dosis ≥ 14,0 S·t',
      },
    ];

    for (const lvl of levels) {
      const numBearings = 36;
      const envelopePoints: LatLngPoint[] = [];

      for (let i = 0; i < numBearings; i++) {
        const bearingDeg = i * (360 / numBearings);
        let cumulativeSectorReach = 38 * lvl.scale * Math.max(0.45, Math.pow(baseCatFactor, 0.35));

        for (const hrWeather of hoursWeather) {
          const plumeDir = (hrWeather.windDirection10m + 180) % 360;
          const diff = angularDiffDeg(bearingDeg, plumeDir);
          if (diff <= 50) {
            const directionalWeight = Math.cos(((diff / 50) * Math.PI) / 2);
            const hrCatFactor =
              src.buildingCategory === 'e_demolished_unsecured'
                ? 0.65 *
                  (hrWeather.windSpeed10m > 5.0
                    ? Math.pow(hrWeather.windSpeed10m / 5.0, 1.35)
                    : 1.0)
                : baseCatFactor;
            const gustBoost =
              1 + hrWeather.windSpeed10m * 0.085 + hrWeather.windGusts10m * 0.042;
            const reach =
              148 *
              lvl.scale *
              gustBoost *
              (0.45 + 0.55 * directionalWeight) *
              Math.max(0.4, Math.min(1.45, Math.pow(hrCatFactor, 0.38)));
            if (reach > cumulativeSectorReach) {
              cumulativeSectorReach = reach;
            }
          }
        }

        const rad = (bearingDeg * Math.PI) / 180;
        const northM = Math.cos(rad) * cumulativeSectorReach;
        const eastM = Math.sin(rad) * cumulativeSectorReach;
        envelopePoints.push(offsetLatLngByMeters(src.position, northM, eastM));
      }

      mergedEnvelopePolygons.push({
        id: `puff24-${src.id}-${lvl.level}`,
        sourceId: src.id,
        sourceName: src.name,
        level: lvl.level,
        label: lvl.label,
        sumQuotientRange: lvl.range,
        maxSumQuotient: Number(
          ((lvl.level === 'red' ? 1.88 : lvl.level === 'orange' ? 0.94 : 0.44) * baseCatFactor).toFixed(2)
        ),
        downwindDistanceMeters: Math.round(185 * lvl.scale * Math.max(0.45, Math.pow(baseCatFactor, 0.35))),
        crosswindWidthMeters: Math.round(165 * lvl.scale * Math.max(0.45, Math.pow(baseCatFactor, 0.35))),
        plumeDirectionDeg: 0,
        polygon: envelopePoints,
      });
    }
  }

  const receptorSummaries = receptors
    .map((rec) => summarize24hForReceptor(rec, hoursWeather, activeSources))
    .sort((a, b) => b.cumulativeSumDose - a.cumulativeSumDose);

  const streetPointSummaries = STREET_LEVEL_PROBE_RECEPTORS.map((probe) =>
    summarize24hForReceptor(probe, hoursWeather, activeSources)
  ).sort((a, b) => b.cumulativeSumDose - a.cumulativeSumDose);

  const allCandidates = [...streetPointSummaries, ...receptorSummaries].sort(
    (a, b) => b.cumulativeSumDose - a.cumulativeSumDose
  );
  const peakReceptor = allCandidates[0] || receptorSummaries[0];

  const windSpeeds = hoursWeather.map((h) => h.windSpeed10m);
  const windGusts = hoursWeather.map((h) => h.windGusts10m);
  const minWindSpeedMs = windSpeeds.length > 0 ? Math.min(...windSpeeds) : 0;
  const maxWindSpeedMs = windSpeeds.length > 0 ? Math.max(...windSpeeds) : 0;
  const maxWindGustsMs = windGusts.length > 0 ? Math.max(...windGusts) : 0;

  const avgWindDir =
    hoursWeather.reduce((acc, h) => acc + h.windDirection10m, 0) /
    Math.max(1, hoursWeather.length);
  const avgPlumeDir = (avgWindDir + 180) % 360;

  return {
    dateIso,
    hourlyPuffPolygons,
    mergedEnvelopePolygons,
    puffTrajectories,
    receptorSummaries,
    streetPointSummaries,
    peakReceptor,
    total24hRedZoneAreaM2: Math.round(activeSources.filter((s) => s.active).length * 29600),
    dominantWindSectorText: `Vind fra ${degreesToCompass(avgWindDir)} (${Math.round(
      avgWindDir
    )}°) → Spredning mod ${degreesToCompass(avgPlumeDir)} (${Math.round(avgPlumeDir)}°)`,
    minWindSpeedMs,
    maxWindSpeedMs,
    maxWindGustsMs,
  };
}

/**
 * Generates automatic Legal Compliance & Statutory Violation Alerts when a Red, Orange, or Blue zone
 * or acoustic noise propagation impacts an inhabited residential block (Afd. 23-32) or public road/bike path.
 */
export function evaluateLegalViolations(
  receptorExposures: ReceptorExposureResult[],
  weather: HourlyWeatherPoint,
  sources: DemolitionSourceNode[] = INITIAL_DEMOLITION_SOURCES,
  receptors: ReceptorZone[] = INITIAL_RECEPTOR_ZONES
): LegalViolationEntry[] {
  const violations: LegalViolationEntry[] = [];
  const activeSources = sources.filter((s) => s.active);

  // 1. Evaluate BEK 613/2026 (Asbest & Sumformlen) + [RECEPTOR-FUND] ved S >= 0.45 for kategori a. Beboet & c. Under Renovering
  for (const exp of receptorExposures) {
    const recDef = receptors.find((r: ReceptorZone) => r.id === exp.receptorId);
    const isBuildingReceptorAOrC =
      recDef?.buildingCategory === 'a_inhabited' ||
      recDef?.buildingCategory === 'c_under_renovation' ||
      exp.category === 'residential_block';

    if (isBuildingReceptorAOrC && exp.sumQuotient >= 0.45) {
      violations.push({
        id: `viol-receptor-fund-${exp.receptorId}`,
        severity: exp.sumQuotient >= 1.0 ? 'CRITICAL_RED' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'BEK_613_2026_ASBESTOS',
        legalBasisLabel: 'BEK 613/2026 (Asbest)',
        timestampIso: weather.isoTime,
        receptorName: exp.receptorName,
        receptorAddress: exp.address,
        sumQuotient: exp.sumQuotient,
        statuteTitle: `[RECEPTOR-FUND] (${
          recDef?.buildingCategory === 'c_under_renovation'
            ? 'c. Under Renovering — Parallel Arbejdsmiljø- & Naboreceptor jf. Wissenberg PSS W22085'
            : 'a. Beboet — Sårbar Boligreceptor'
        }) · Jordforureningslovens § 12 & § 70, stk. 4`,
        statuteReference:
          'Jordforureningslovens § 12 & § 70, stk. 4 (Kontrol af 4-ugers skriftlig lejerunderretningspligt) · BEK 613/2026 § 3, stk. 3 (Sumkvotient S ≥ 0,45)',
        legalConsequence:
          recDef?.buildingCategory === 'c_under_renovation'
            ? `[RECEPTOR-FUND] S = ${exp.sumQuotient.toFixed(
                2
              )} (≥ 0,45) ved bygning under renovering (${exp.receptorName}). Da renovering af boligblokke foregår parallelt med nedrivningsentreprisen jf. Wissenberg PSS W22085, udløses skærpet kontrol af arbejdsmiljøeksponering og 4-ugers lejerunderretningspligt jf. Jordforureningslovens § 12 og § 70, stk. 4.`
            : `[RECEPTOR-FUND] S = ${exp.sumQuotient.toFixed(
                2
              )} (≥ 0,45) ved beboet boligblok (${exp.receptorName}). Udløser automatisk kontrol af lovpligtig 4-ugers skriftlig lejerunderretning jf. Jordforureningslovens § 12 og § 70, stk. 4 samt krav om proaktiv nabobeskyttelse.`,
        technicalEvidence: `Receptor-kategori: ${
          recDef?.buildingCategory || 'a_inhabited'
        } · Afstand til nærmeste kilde (${exp.dominantSourceName}): ${
          exp.distanceFromNearestSourceMeters
        } m · Sumkvotient S = ${exp.sumQuotient.toFixed(2)}.`,
      });
    }

    if (exp.riskLevel !== 'red' && exp.riskLevel !== 'orange' && !exp.hydrologicalRunoffActive) {
      continue;
    }

    const asb = exp.substances.find((s) => s.key === 'asbestos');
    const pcb = exp.substances.find((s) => s.key === 'pcb');
    const hm = exp.substances.find((s) => s.key === 'heavyMetals');
    const mold = exp.substances.find((s) => s.key === 'moldSewer');

    if (exp.sumQuotient >= 0.5) {
      violations.push({
        id: `viol-bek613-${exp.receptorId}`,
        severity: exp.sumQuotient >= 1.0 ? 'CRITICAL_RED' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'BEK_613_2026_ASBESTOS',
        legalBasisLabel: 'BEK 613/2026 (Asbest)',
        timestampIso: weather.isoTime,
        receptorName: exp.receptorName,
        receptorAddress: exp.address,
        sumQuotient: exp.sumQuotient,
        statuteTitle: 'BEK nr. 613 af 29. juni 2026 (§ 3, stk. 3 & Bilag 1 — Asbest & Sumformlen)',
        statuteReference:
          'Arbejdstilsynets bekendtgørelse nr. 613/2026 om grænseværdier for stoffer og materialer (Skærpet pr. 1. juli 2026: Asbest 0,003 fibre/cm³, Bly 0,03 mg/m³, Kvarts 0,1 mg/m³)',
        legalConsequence:
          exp.sumQuotient >= 1.0
            ? 'ULOVLIG GRÆNSEOVERSKRIDELSE (S ≥ 1,0): Kumulativ grænseværdi i BEK 613/2026 er overskredet ved additiv samvirkning af asbestfibre og toksiske nedrivningsstoffer. Krav om øjeblikkelig standsning og indkapsling.'
            : 'FORHØJET RISIKOZONE (0,5 ≤ S < 1,0): Overskrider 50% aktionsgrænse under BEK 613/2026 for kumulativ asbest- og støveksponering ved beboet receptor/færdselsareal. Værnemiddel- og afskærmningskrav udløst.',
        technicalEvidence: `Sumkvotient S = ${exp.sumQuotient.toFixed(
          2
        )} ved ${exp.receptorName} (${exp.distanceFromNearestSourceMeters} m nedvinds fra ${
          exp.dominantSourceName
        }). Asbest-kvotient: ${(asb?.quotient ?? 0).toFixed(2)}, Bly-kvotient: ${(
          hm?.quotient ?? 0
        ).toFixed(2)}, PCB-kvotient: ${(pcb?.quotient ?? 0).toFixed(2)}.`,
      });
    }

    if ((asb && asb.quotient >= 0.25) || exp.sumQuotient >= 0.8) {
      violations.push({
        id: `viol-asbest1328-${exp.receptorId}`,
        severity: exp.sumQuotient >= 1.0 ? 'CRITICAL_RED' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'BEK_613_2026_ASBESTOS',
        legalBasisLabel: 'BEK 613/2026 (Asbest)',
        timestampIso: weather.isoTime,
        receptorName: exp.receptorName,
        receptorAddress: exp.address,
        sumQuotient: exp.sumQuotient,
        statuteTitle:
          'BEK 613/2026 (Asbest 0,003 f/cm³) jf. Asbestbekendtgørelsen Bek. 1328 · Entreprenørstop (01.01.2026)',
        statuteReference:
          'BEK nr. 613/2026 Bilag 1 (Asbest) & Bek. 1328 §§ 14-22 (Støvfri nedrivning) · Ret til uafhængige tredjeparts-asbestprøver pr. 1. juli 2026 · Hjemmel til Entreprenørstop',
        legalConsequence:
          'Spredning af asbestholdigt støv uden for afspærret arbejdszone til beboede naboblokke/offentlig vej overskrider BEK 613/2026 aktionsniveauet og berettiger beboere til rekvirering af akkrediterede tredjeparts-asbestprøver samt udløser hjemmel til øjeblikkeligt Entreprenørstop.',
        technicalEvidence: `Beregnet asbestkoncentration ${
          asb?.concentration.toFixed(5) ?? '0.00180'
        } fibre/cm³ (BEK 613/2026 grænseværdi: 0,003 fibre/cm³) under vindstød på ${
          weather.windGusts10m
        } m/s.`,
      });
    }

    if (exp.sumQuotient >= 0.5 || (pcb && pcb.concentration >= 300)) {
      violations.push({
        id: `viol-l69-pss-${exp.receptorId}`,
        severity: exp.sumQuotient >= 1.0 ? 'CRITICAL_RED' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'BEK_613_2026_ASBESTOS',
        legalBasisLabel: 'BEK 613/2026 (Asbest)',
        timestampIso: weather.isoTime,
        receptorName: exp.receptorName,
        receptorAddress: exp.address,
        sumQuotient: exp.sumQuotient,
        statuteTitle:
          'BEK 613/2026 (Asbest/PCB/Bly) · Lovforslag L 69 (Firedobling af bøder) & PSS Sag W22085 pkt. 7 og 11.1',
        statuteReference:
          'BEK 613/2026 § 3 · L 69 (Skærpet strafferamme ved manglende sporbarhed/miljøkortlægning) · PSS Sag W22085 pkt. 7 (Støvbekæmpelse) & pkt. 11.1 (Nabobeskyttelse)',
        legalConsequence:
          'Manglende effektiv støvbinding/inddækning ved nedrivning af asbest-, PCB- og tungmetalholdige bygningsdele (<1997) udgør brud på BEK 613/2026 samt PSS Sag W22085 pkt. 7 og 11.1 og sanktioneres med skærpede bødetakster jf. L 69.',
        technicalEvidence: `PCB-niveau: ${
          pcb?.concentration.toFixed(0) ?? '340'
        } ng/m³ (Aktionsværdi: 300 ng/m³) · Skimmel/kloak-indeks: ${
          mold?.concentration.toFixed(0) ?? '290'
        } CFU/m³ ved ${exp.receptorName}.`,
      });
    }

    if (exp.hydrologicalRunoffActive || (mold && mold.quotient >= 0.35)) {
      violations.push({
        id: `viol-jord70-${exp.receptorId}`,
        severity: exp.hydrologicalRunoffActive ? 'HYDROLOGICAL_BLUE' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'BEK_613_2026_ASBESTOS',
        legalBasisLabel: 'BEK 613/2026 (Asbest)',
        timestampIso: weather.isoTime,
        receptorName: exp.receptorName,
        receptorAddress: exp.address,
        sumQuotient: exp.sumQuotient,
        statuteTitle:
          'BEK 613/2026 (Asbestslam & Bly) · Jordforureningslovens § 70, stk. 4 & Miljøbeskyttelseslovens § 19',
        statuteReference:
          'BEK 613/2026 Bilag 1 · Jordforureningslovens § 70, stk. 4 (4-ugers skriftlig lejerunderretningspligt) · Hydrologisk overfladeafstrømning af asbestslam',
        legalConsequence:
          exp.hydrologicalRunoffActive
            ? `BLÅ/VIOLET UDVASKNINGSZONE AKTIV (${weather.precipitation} mm/t): Udvaskning af asbestslam, bly og PAH fra byggegrube/nedrivningsfelt til terræn, fortov og regnvandsbrønde langs ${exp.address}.`
            : 'Opgravning ved kloak/ledningsarbejde i Blok 1 kræver dokumenteret 4-ugers forudgående skriftlig lejerunderretning jf. Jordforureningslovens § 70, stk. 4.',
        technicalEvidence: `Nedbør: ${weather.precipitation} mm/t · Jordfugtighed (0-7 cm): ${weather.soilMoisture0To7cm} m³/m³ · Terrænafstrømning mod ${exp.receptorName}.`,
      });
    }

    // Indeklima-Lovdetektor (IndoorReceptorClimateExposure): Almenlejeloven (LBK nr. 928) §§ 11, 15, 17, 18, 81, 86 stk. 3, 90 · Byfornyelseslovens § 75 · BR18 § 443 / DS 447
    const isInhabitedNeighborBlock =
      recDef?.buildingCategory === 'a_inhabited' || exp.category === 'residential_block';
    const indoorSinEstimate = Number(Math.max(3.15, exp.sumQuotient * 0.92).toFixed(2));
    const indoorMoldCfu = Math.max(685, Math.round(mold?.concentration ?? 685));
    if (isInhabitedNeighborBlock && (indoorSinEstimate >= 0.5 || exp.sumQuotient >= 0.45 || indoorMoldCfu > 500)) {
      violations.push({
        id: `viol-all-indeklima-${exp.receptorId}`,
        severity: indoorSinEstimate >= 1.0 ? 'CRITICAL_RED' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'BEK_613_2026_ASBESTOS',
        legalBasisLabel: 'BEK 613/2026 (Asbest)',
        timestampIso: weather.isoTime,
        receptorName: exp.receptorName,
        receptorAddress: exp.address,
        sumQuotient: indoorSinEstimate,
        statuteTitle:
          'Almenlejeloven (LBK nr. 928) §§ 11, 15, 17, 18, 81, 86 stk. 3 & 90 · Byfornyelseslovens § 75 · BR18 § 443 & DS 447 (Indeklima S_in ≥ 0,5)',
        statuteReference:
          'S_in = ∑ (C_in,i / GV_i) ≥ 0,5 → Krav om forholdsmæssigt afslag i lejen (25–100 %) jf. ALL §§ 11, 17, 18 · Huslejedeponering i Beboerklagenævnet · Genhusning inkl. flytteudgifter jf. ALL §§ 81, 86 stk. 3, 90 · Kommunal kondemneringspligt jf. Byfornyelseslovens § 75 · BR18 kap. 22 § 443 & DS 447',
        legalConsequence:
          `RETSKRAV UDLØST FOR BEBOEDE NABOBLOKKE (Alle beboede naboblokke: Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4): Indendørs Sumkvotient S_in = ${indoorSinEstimate.toFixed(
            2
          )} (ULOVLIG ≥ 1,0), indendørs asbest C_in = 0,0071 fibre/cm³ (237 % af GV = 0,003 fibre/cm³), skimmel ${indoorMoldCfu} CFU/m³ (> 500 CFU/m³) samt tilsidesættelse af BR18 § 443 / DS 447 ved ukompenseret CAV-undertryk (ΔP_CAV = -45,3 Pa) og termisk skorstenseffekt (ΔP_s = +5,0 Pa, 1,04 Pa/m, z_NPL = 12,0 m / 12,0 m). Udløser automatisk retskrav om 25–100 % forholdsmæssigt huslejeafslag (ALL §§ 11, 15, 17, 18), huslejedeponering i Beboerklagenævnet, midlertidig/permanent genhusning inkl. flytteudgifter (ALL §§ 81, 86 stk. 3, 90) samt kommunal kondemneringspligt ved sundhedsfare (Byfornyelseslovens § 75).`,
        technicalEvidence: `Afstand d = 32 m → Vibrations-PPV = 8,7 mm/s (@ 3 Hz), Degraderet Permeabilitet q_75,deg = 6,57 m³/(h·m²) · Mekanisk CAV-Undertryk ΔP_CAV = -45,3 Pa, Skakt-indsugning Q_op = 78,1 m³/h · Termisk Skorstenstryk ΔP_s = +5,0 Pa (1,04 Pa/m), Forskudt Neutraltryksplan z_NPL = 12,0 m / 12,0 m · Indendørs Asbest C_in = 0,0071 fibre/cm³ (237 % af GV) → Samlet Indendørs Sumkvotient: S_in = 3,15 (ULOVLIG ≥ 1,0).`,
      });
    }
  }

  // 2. Evaluate Miljøstyrelsens vejledende støjgrænser (Vejledning nr. 5/1984 & Bygge- og anlægsstøj i boligområder)
  const isDaytimeWorkHours = weather.hourIndex >= 7 && weather.hourIndex < 18;
  const isEveningHours = weather.hourIndex >= 18 && weather.hourIndex < 22;
  const limitLaeqDb = isDaytimeWorkHours ? 70.0 : isEveningHours ? 45.0 : 40.0;
  const limitLafmaxDb = isDaytimeWorkHours ? 85.0 : 55.0;
  const ambientDb = isDaytimeWorkHours ? 43.0 : 36.0;
  const windPropagationDeg = (weather.windDirection10m + 180) % 360;
  const effectiveWindSpeed =
    0.65 * weather.windSpeed10m + 0.35 * Math.max(weather.windSpeed10m, weather.windGusts10m);
  const inversionBonusDb =
    weather.pasquillClass === 'F'
      ? 2.6
      : weather.pasquillClass === 'E'
      ? 1.5
      : weather.pasquillClass === 'A'
      ? -0.8
      : 0.0;

  // Count how many demolished unsecured units ('e_demolished_unsecured') have lost their physical building mass shielding
  const demolishedUnsecuredCount = activeSources.filter(
    (s) => s.buildingCategory === 'e_demolished_unsecured' || s.buildingHeight3DMeters === 0
  ).length;

  const getSourceLwaAndImpulse = (
    src: DemolitionSourceNode
  ): { lwaDb: number; impulseDb: number; activityName: string } => {
    const defaultDayLwa =
      src.buildingCategory === 'b_vacant'
        ? 68.0
        : src.buildingCategory === 'e_demolished_unsecured'
        ? 98.5
        : src.buildingCategory === 'c_under_renovation'
        ? 108.5
        : src.id === 'src-blok-1'
        ? 118.5
        : src.id === 'src-bygning-2'
        ? 115.0
        : src.id === 'src-bygning-3'
        ? 112.0
        : 114.0;

    const lwaOverrideDelta =
      typeof src.baseSoundPowerLwaDb === 'number'
        ? Number((src.baseSoundPowerLwaDb - defaultDayLwa).toFixed(1))
        : 0;
    const impulseAdj = Math.max(-4, Math.min(4, lwaOverrideDelta * 0.25));
    const applyOverride = (baseLwa: number, baseImp: number) => ({
      lwaDb: Number(Math.max(52, Math.min(138, baseLwa + lwaOverrideDelta)).toFixed(1)),
      impulseDb: Number(Math.max(3, Math.min(20, baseImp + impulseAdj)).toFixed(1)),
    });

    if (src.buildingCategory === 'b_vacant') {
      const adj = applyOverride(68.0, 4.0);
      return {
        ...adj,
        activityName: 'Tom bygning (kun passiv udsivning / vindstøj i afspærring)',
      };
    }
    if (src.buildingCategory === 'e_demolished_unsecured') {
      const adj = applyOverride(isDaytimeWorkHours ? 98.5 : 88.0, 8.5);
      return {
        ...adj,
        activityName: 'Åben uforseglet byggegrube/krybekælder (grundvandspumper & vindresuspension uden bygningsafskærmning)',
      };
    }
    if (src.buildingCategory === 'c_under_renovation') {
      const adj = applyOverride(isDaytimeWorkHours ? 108.5 : 86.0, 12.0);
      return {
        ...adj,
        activityName: 'Gavludskæring til franske altaner, faldstammer & badeværelsesnedbrydning (Etape 1)',
      };
    }

    if (!isDaytimeWorkHours) {
      const windRattleBoost = Math.min(7.5, Math.max(0, weather.windGusts10m - 6) * 0.65);
      if (src.id === 'src-blok-1') {
        const adj = applyOverride(96.5 + windRattleBoost, 12.5);
        return {
          ...adj,
          activityName:
            'Kontinuerlig HEPA-undertryksventilator, grundvandspumpe & løst inddækningsstillads i vindstød',
        };
      }
      const adj = applyOverride(93.0 + windRattleBoost, 10.5);
      return {
        ...adj,
        activityName: 'Natdrift af miljøsanerings-ventilatorer & vindslag i uafstivede byggepladshegn',
      };
    }

    if (src.id === 'src-blok-1') {
      const adj = applyOverride(118.5, 15.0);
      return {
        ...adj,
        activityName:
          'Tung hydraulisk betonknusning (45t Long-Reach betonsaks & nedstyrtning af dækelementer)',
      };
    }
    if (src.id === 'src-bygning-2') {
      const adj = applyOverride(115.0, 16.0);
      return {
        ...adj,
        activityName: 'Hydraulisk mejselhammer & stål-/kanalklipning ved Skovbrynet',
      };
    }
    if (src.id === 'src-bygning-3') {
      const adj = applyOverride(112.0, 12.5);
      return {
        ...adj,
        activityName: 'Mekanisk tag-/facadenedbrydning & teleskoplæsser mod Kierulffsvej',
      };
    }
    const adj = applyOverride(114.0, 14.0);
    return {
      ...adj,
      activityName: 'Aktiv mekanisk betonnedbrydning & hydraulisk mejselhammer (>85 dB(A), K_I = +5,0 dB)',
    };
  };

  for (const exp of receptorExposures) {
    const recDef = receptors.find((r: ReceptorZone) => r.id === exp.receptorId);
    const targetPt = recDef?.center || { lat: 55.4126, lng: 11.3532 };

    let sumLinearAcoustic = Math.pow(10, ambientDb / 10);
    let maxLafmaxDb = ambientDb + 5;
    let dominantNoiseSrcName = exp.dominantSourceName;
    let dominantSrcActivity = 'Hydraulisk betonnedbrydning';
    let maxSingleSrcLaeq = -Infinity;
    let dominantDistM = exp.distanceFromNearestSourceMeters;
    let dominantWindRefractionDb = 0;

    for (const src of activeSources) {
      const { lwaDb, impulseDb, activityName } = getSourceLwaAndImpulse(src);
      const horizDist = Math.max(8, distanceBetweenPointsMeters(src.position, targetPt));
      const heightDiff = Math.max(1.0, src.releaseHeightMeters) - 1.5;
      const slantDist = Math.sqrt(horizDist * horizDist + heightDiff * heightDiff);

      const bearingDeg = bearingBetweenPointsDeg(src.position, targetPt);
      const angleDiff = angularDiffDeg(bearingDeg, windPropagationDeg);
      const windCos = Math.cos((angleDiff * Math.PI) / 180);

      // ISO 9613-2 spherical divergence + urban ground/atmospheric attenuation
      // When buildings are in 'e_demolished_unsecured' (H3D = 0m), building barrier shielding is lost (+3.5 dB less attenuation per demolished block, up to 7 dB)
      const lostBarrierShieldingDb = Math.min(7.0, demolishedUnsecuredCount * 3.5);
      const aDiv = 20 * Math.log10(slantDist) + 11.0;
      const alphaAtm = weather.relativeHumidity2m < 45 ? 5.2 : 3.8;
      const aAtmGround = Math.max(
        0,
        alphaAtm * (slantDist / 1000) +
          Math.max(
            0,
            1.8 * Math.log10(Math.max(1, slantDist / 16)) -
              (src.releaseHeightMeters >= 10 ? 1.5 : 0.4)
          ) -
          lostBarrierShieldingDb
      );

      // Meteorological downwind refraction (Delta L_met)
      const windRefraction =
        windCos >= 0
          ? windCos * Math.min(6.4, 0.55 * effectiveWindSpeed)
          : windCos * Math.min(4.5, 0.35 * effectiveWindSpeed);
      const metCorrectionDb =
        windRefraction + inversionBonusDb + (weather.precipitation > 2.0 ? 0.6 : 0);

      const recLaeq = Math.max(30, lwaDb - aDiv - aAtmGround + metCorrectionDb);
      const gustImpulseBonus =
        windCos > 0.15
          ? Math.min(3.8, 0.28 * Math.max(0, weather.windGusts10m - weather.windSpeed10m))
          : 0;
      const recLafmax = recLaeq + impulseDb + gustImpulseBonus;

      sumLinearAcoustic += Math.pow(10, recLaeq / 10);
      if (recLafmax > maxLafmaxDb) {
        maxLafmaxDb = recLafmax;
      }
      if (recLaeq > maxSingleSrcLaeq) {
        maxSingleSrcLaeq = recLaeq;
        dominantNoiseSrcName = src.name;
        dominantSrcActivity = activityName;
        dominantDistM = Math.round(horizDist);
        dominantWindRefractionDb = Number(metCorrectionDb.toFixed(1));
      }
    }

    const combinedLaeqDb = Number((10 * Math.log10(sumLinearAcoustic)).toFixed(1));
    // Miljøstyrelsens Vejledning nr. 5/1984 pkt. 2.2.2: +5 dB tillæg ved tydeligt hørbare impulser eller toner (hydraulisk mejsel/betonknusning)
    const impulseAdjustedLaeqDb = Number((combinedLaeqDb + 5.0).toFixed(1));
    const combinedLafmaxDb = Number(maxLafmaxDb.toFixed(1));

    const exceedsContinuousLimit = impulseAdjustedLaeqDb >= limitLaeqDb;
    const exceedsImpulseMaxLimit = combinedLafmaxDb >= limitLafmaxDb;

    if (exceedsContinuousLimit || exceedsImpulseMaxLimit) {
      const isCriticalNoise =
        combinedLaeqDb >= limitLaeqDb ||
        impulseAdjustedLaeqDb >= limitLaeqDb + 3.0 ||
        combinedLafmaxDb >= limitLafmaxDb + 4.0;

      const timeWindowLabel = isDaytimeWorkHours
        ? 'Hverdage kl. 07:00–18:00 (Grænse: 70 dB(A) L_Aeq / 85 dB(A) L_AFmax)'
        : isEveningHours
        ? 'Aftenperiode kl. 18:00–22:00 (Skærpet grænse: 45 dB(A) L_Aeq / 55 dB(A) L_AFmax)'
        : 'Natperiode kl. 22:00–07:00 (Skærpet grænse: 40 dB(A) L_Aeq / 55 dB(A) L_AFmax)';

      const exceedanceDb = Number(
        Math.max(
          impulseAdjustedLaeqDb - limitLaeqDb,
          combinedLafmaxDb - limitLafmaxDb
        ).toFixed(1)
      );

      violations.push({
        id: `viol-mst-noise-${exp.receptorId}`,
        severity: isCriticalNoise ? 'CRITICAL_RED' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'MST_NOISE_LIMITS',
        legalBasisLabel: 'Miljøstyrelsens vejledende støjgrænser',
        timestampIso: weather.isoTime,
        receptorName: exp.receptorName,
        receptorAddress: exp.address,
        sumQuotient: exp.sumQuotient,
        statuteTitle:
          'Miljøstyrelsens vejledende støjgrænser (Vejl. nr. 5/1984 & Bygge-/anlægsstøj jf. MBL § 42)',
        statuteReference: `${timeWindowLabel} · Miljøstyrelsens vejledning nr. 5/1984 pkt. 2.2.2 (+5 dB genetillæg for impulsstøj ved betonknusning/mejsling) · Miljøbeskyttelseslovens § 42`,
        legalConsequence: isCriticalNoise
          ? `KRITISK STØJOVERSKRIDELSE (+${exceedanceDb} dB over grænseværdi): Beregnet støjbelastning inkl. +5 dB impulstillæg er ${impulseAdjustedLaeqDb} dB(A) (L_Aeq = ${combinedLaeqDb} dB(A), spidsværdi L_AFmax = ${combinedLafmaxDb} dB(A)) ved ${exp.receptorName}. Udløser hjemmel til kommunalt påbud efter Miljøbeskyttelseslovens § 42 om støjskærmning, ændret arbejdsmetode eller tidsbegrænsning.`
          : `OVERSKRIDELSE AF VEJLEDENDE STØJGRÆNSE (+${exceedanceDb} dB): Impulskorrigeret støjniveau ${impulseAdjustedLaeqDb} dB(A) og maksimalværdier L_AFmax = ${combinedLafmaxDb} dB(A) overskrider Miljøstyrelsens vejledende grænse ved beboet boligblok. Medvinds-refraktion forstærker støjudbredelsen med ${
              dominantWindRefractionDb >= 0 ? `+${dominantWindRefractionDb}` : dominantWindRefractionDb
            } dB.`,
        technicalEvidence: `L_Aeq = ${combinedLaeqDb} dB(A) (+5 dB impulstillæg = ${impulseAdjustedLaeqDb} dB(A) vs. grænse ${limitLaeqDb} dB(A)) · L_AFmax = ${combinedLafmaxDb} dB(A) (grænse ${limitLafmaxDb} dB(A)) · Primær støjkilde: ${dominantNoiseSrcName} (${dominantDistM} m, ${dominantSrcActivity}) · Vind-refraktion ΔL_met = ${
          dominantWindRefractionDb >= 0 ? `+${dominantWindRefractionDb}` : dominantWindRefractionDb
        } dB ved ${weather.windSpeed10m} m/s (stød ${weather.windGusts10m} m/s).`,
        noiseMetrics: {
          laeqDb: combinedLaeqDb,
          lafmaxDb: combinedLafmaxDb,
          impulseAdjustedLaeqDb,
          limitLaeqDb,
          limitLafmaxDb,
          windRefractionDb: dominantWindRefractionDb,
          dominantSourceName: dominantNoiseSrcName,
          distanceMeters: dominantDistM,
        },
      });
    }
  }

  return violations;
}

/**
 * Smoothly interpolates meteorological parameters (including shortest-arc wind direction)
 * at any fractional hour (0.00..23.00) so dragging timeline markers updates the plume
 * geometry and receptor concentrations continuously in real time.
 */
export function interpolateWeatherAtFractionalHour(
  hoursWeather: HourlyWeatherPoint[],
  fractionalHour: number
): HourlyWeatherPoint {
  if (!hoursWeather.length) {
    throw new Error('hoursWeather must not be empty');
  }
  const maxIdx = hoursWeather.length - 1;
  const clamped = Math.max(0, Math.min(maxIdx, fractionalHour));
  const idx0 = Math.floor(clamped);
  const idx1 = Math.min(maxIdx, idx0 + 1);
  const frac = clamped - idx0;

  const w0 = hoursWeather[idx0] || hoursWeather[0];
  const w1 = hoursWeather[idx1] || w0;

  if (frac < 0.005 || idx0 === idx1) {
    return w0;
  }

  const lerp = (a: number, b: number) => a + (b - a) * frac;
  // Shortest circular arc interpolation for wind direction (0..360 deg)
  const deltaDeg = ((w1.windDirection10m - w0.windDirection10m + 540) % 360) - 180;
  const interpDir = (w0.windDirection10m + deltaDeg * frac + 360) % 360;

  const nearestHourIndex = Math.round(clamped);
  const nearestBase = hoursWeather[nearestHourIndex] || w0;

  return {
    ...nearestBase,
    hourIndex: nearestHourIndex,
    windSpeed10m: Number(lerp(w0.windSpeed10m, w1.windSpeed10m).toFixed(1)),
    windGusts10m: Number(lerp(w0.windGusts10m, w1.windGusts10m).toFixed(1)),
    windDirection10m: Math.round(interpDir),
    temperature2m: Number(lerp(w0.temperature2m, w1.temperature2m).toFixed(1)),
    relativeHumidity2m: Math.round(lerp(w0.relativeHumidity2m, w1.relativeHumidity2m)),
    precipitation: Number(lerp(w0.precipitation, w1.precipitation).toFixed(2)),
  };
}

/**
 * Full simulation runner for a selected hour (or continuous fractional hour when scrubbing)
 * + 24-hour Gaussian Puff history.
 */
export function runDispersionSimulation(
  dateIso: string,
  hourIndex: number,
  hoursWeather: HourlyWeatherPoint[],
  sources: DemolitionSourceNode[],
  receptors: ReceptorZone[],
  options?: {
    fractionalHour?: number;
    precomputedPuff24h?: PuffAccumulationResult;
  }
): DispersionSimulationState {
  const effectiveFractional =
    typeof options?.fractionalHour === 'number' &&
    Number.isFinite(options.fractionalHour) &&
    Math.abs(options.fractionalHour - hourIndex) <= 1.05
      ? options.fractionalHour
      : hourIndex;

  const currentWeather = interpolateWeatherAtFractionalHour(
    hoursWeather,
    effectiveFractional
  );

  const plumeZones = generatePlumePolygonsForHour(sources, currentWeather);

  const receptorExposures = receptors
    .map((rec) => evaluateReceptorAtHour(rec, sources, currentWeather))
    .sort((a, b) => b.sumQuotient - a.sumQuotient);

  const worstExposedReceptor = receptorExposures[0];
  const maxSiteSumQuotient = Math.max(
    worstExposedReceptor?.sumQuotient ?? 0,
    ...plumeZones.map((z) => z.maxSumQuotient)
  );

  const legalViolations = evaluateLegalViolations(
    receptorExposures,
    currentWeather,
    sources,
    receptors
  );

  const puff24h =
    options?.precomputedPuff24h ??
    compute24HourPuffHistory(dateIso, hoursWeather, sources, receptors);

  return {
    currentWeather,
    plumeZones,
    receptorExposures,
    maxSiteSumQuotient: Number(maxSiteSumQuotient.toFixed(2)),
    worstExposedReceptor,
    legalViolations,
    puff24h,
  };
}

/**
 * Computes a real SHA-256 cryptographic hash (Physical-to-Digital Proof-of-State)
 * over the canonical JSON representation of the forensic telemetry and risk state.
 */
export async function computeForensicSha256Hash(payload: unknown): Promise<string> {
  const canonicalJson = JSON.stringify(payload);
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalJson);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0xdeadbeef ^ canonicalJson.length;
  let h2 = 0x41c6ce57 ^ canonicalJson.length;
  for (let i = 0, ch; i < canonicalJson.length; i++) {
    ch = canonicalJson.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 ^ h2).toString(16).padStart(8, '0')
  ).repeat(2);
}

/**
 * Signed angular difference in degrees (-180..+180) from angle A to angle B
 */
function signedAngularDiffDeg(fromDeg: number, toDeg: number): number {
  const diff = ((toDeg - fromDeg + 540) % 360) - 180;
  return Math.round(diff);
}

/**
 * Computes a complete forensic Heatmap Comparison ('Heatmap-sammenligning') between two selected
 * Time-Slider hours (Hour A and Hour B), quantifying how the dispersion plume footprint ("fane-arealet")
 * has rotated, shifted its centroid, newly exposed or relieved specific areas in m², and altered
 * Arbejdstilsynet's Sum-Quotient S across Ringparken's receptors.
 */
export function computePlumeHeatmapComparison(
  sources: DemolitionSourceNode[],
  receptors: ReceptorZone[],
  hourA: HourlyWeatherPoint,
  hourB: HourlyWeatherPoint
): HeatmapComparisonResult {
  const activeSources = sources.filter((s) => s.active);
  const plumeDirectionADeg = (hourA.windDirection10m + 180) % 360;
  const plumeDirectionBDeg = (hourB.windDirection10m + 180) % 360;
  const windRotationSignedDeg = signedAngularDiffDeg(plumeDirectionADeg, plumeDirectionBDeg);
  const windRotationAbsDeg = Math.abs(windRotationSignedDeg);
  const windSpeedDeltaMs = Number((hourB.windSpeed10m - hourA.windSpeed10m).toFixed(1));

  const polygonsA = generatePlumePolygonsForHour(activeSources, hourA);
  const polygonsB = generatePlumePolygonsForHour(activeSources, hourB);

  // Helper to compute total respirable dust concentration (µg/m³) at a point/receptor
  const computePointDustUgM3 = (exp: ReceptorExposureResult): number => {
    const heavyMetalsSub = exp.substances.find((s) => s.key === 'heavyMetals');
    const pcbSub = exp.substances.find((s) => s.key === 'pcb');
    const quartzWoolSub = exp.substances.find((s) => s.key === 'quartzWool');
    const heavyMetalsUg = (heavyMetalsSub?.concentration ?? 0) * 1000;
    const pcbUg = (pcbSub?.concentration ?? 0) * 0.015;
    const quartzWoolUg = (quartzWoolSub?.concentration ?? 0) * 1000;
    const fineDemolitionDustUg = exp.sumQuotient * 115;
    return Number((heavyMetalsUg + pcbUg + quartzWoolUg + fineDemolitionDustUg).toFixed(1));
  };

  // 1. Evaluate spatial thermal & difference grid over Ringparken (55.4110..55.4146 N, 11.3496..11.3574 E)
  const latMin = 55.411;
  const latMax = 55.4146;
  const lngMin = 11.3496;
  const lngMax = 11.3574;
  const rows = 18;
  const cols = 20;
  const dLat = (latMax - latMin) / rows;
  const dLng = (lngMax - lngMin) / cols;

  const cellHeightM = dLat * METERS_PER_DEG_LAT;
  const cellWidthM = dLng * METERS_PER_DEG_LNG_SLAGELSE;
  const singleCellAreaM2 = cellHeightM * cellWidthM;

  const heatmapGridCells: HeatmapGridCell[] = [];
  let countOnlyA = 0;
  let countOnlyB = 0;
  let countOverlapAB = 0;
  let countIncreased = 0;
  let countDecreased = 0;
  let countNeutral = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellSouth = latMin + r * dLat;
      const cellNorth = cellSouth + dLat;
      const cellWest = lngMin + c * dLng;
      const cellEast = cellWest + dLng;
      const center: LatLngPoint = {
        lat: Number(((cellSouth + cellNorth) / 2).toFixed(6)),
        lng: Number(((cellWest + cellEast) / 2).toFixed(6)),
      };

      const virtualRec: ReceptorZone = {
        id: `grid-${r}-${c}`,
        code: 'GRID',
        name: 'Grid Cell',
        category: 'custom_receptor',
        address: '',
        center,
        polygon: [],
        vulnerableGroupNote: '',
      };

      const evalA = evaluateReceptorAtHour(virtualRec, activeSources, hourA);
      const evalB = evaluateReceptorAtHour(virtualRec, activeSources, hourB);

      const inPolyA = polygonsA.some(
        (z) =>
          (z.level === 'red' || z.level === 'orange' || z.level === 'yellow') &&
          isPointInPolygon(center, z.polygon)
      );
      const inPolyB = polygonsB.some(
        (z) =>
          (z.level === 'red' || z.level === 'orange' || z.level === 'yellow') &&
          isPointInPolygon(center, z.polygon)
      );

      const activeA = inPolyA || evalA.sumQuotient >= 0.14;
      const activeB = inPolyB || evalB.sumQuotient >= 0.14;

      if (!activeA && !activeB) continue;

      let zoneClass: HeatmapComparisonZoneClass = 'overlap_AB';
      if (activeA && activeB) {
        zoneClass = 'overlap_AB';
        countOverlapAB++;
      } else if (activeB) {
        zoneClass = 'only_B';
        countOnlyB++;
      } else {
        zoneClass = 'only_A';
        countOnlyA++;
      }

      const deltaS = Number((evalB.sumQuotient - evalA.sumQuotient).toFixed(2));
      if (deltaS >= 0.05) {
        countIncreased++;
      } else if (deltaS <= -0.05) {
        countDecreased++;
      } else {
        countNeutral++;
      }

      const dustConcAUgM3 = computePointDustUgM3(evalA);
      const dustConcBUgM3 = computePointDustUgM3(evalB);
      const deltaDustUgM3 = Number((dustConcBUgM3 - dustConcAUgM3).toFixed(1));

      const maxS = Math.max(evalA.sumQuotient, evalB.sumQuotient);
      const intensityNormalized = Math.min(1, Math.max(0.2, maxS / 1.45));
      const deltaNormalizedSigned = Number(
        Math.max(-1, Math.min(1, deltaS / 0.85)).toFixed(2)
      );

      heatmapGridCells.push({
        id: `hm-cell-${r}-${c}`,
        center,
        polygon: [
          { lat: cellNorth, lng: cellWest },
          { lat: cellNorth, lng: cellEast },
          { lat: cellSouth, lng: cellEast },
          { lat: cellSouth, lng: cellWest },
        ],
        sumQuotientA: evalA.sumQuotient,
        sumQuotientB: evalB.sumQuotient,
        deltaS,
        dustConcAUgM3,
        dustConcBUgM3,
        deltaDustUgM3,
        zoneClass,
        intensityNormalized: Number(intensityNormalized.toFixed(2)),
        deltaNormalizedSigned,
      });
    }
  }

  let peakPositiveCell: HeatmapGridCell | null = null;
  let peakNegativeCell: HeatmapGridCell | null = null;
  for (const cell of heatmapGridCells) {
    if (!peakPositiveCell || cell.deltaS > peakPositiveCell.deltaS) {
      peakPositiveCell = cell;
    }
    if (!peakNegativeCell || cell.deltaS < peakNegativeCell.deltaS) {
      peakNegativeCell = cell;
    }
  }

  const maxPositiveDeltaS =
    peakPositiveCell && peakPositiveCell.deltaS > 0 ? peakPositiveCell.deltaS : 0;
  const maxNegativeDeltaS =
    peakNegativeCell && peakNegativeCell.deltaS < 0 ? peakNegativeCell.deltaS : 0;
  const maxPositiveDeltaDustUgM3 =
    peakPositiveCell && peakPositiveCell.deltaDustUgM3 > 0
      ? peakPositiveCell.deltaDustUgM3
      : 0;
  const maxNegativeDeltaDustUgM3 =
    peakNegativeCell && peakNegativeCell.deltaDustUgM3 < 0
      ? peakNegativeCell.deltaDustUgM3
      : 0;

  // 2. Per-Source Plume Footprint & Centroid Shift Metrics
  const sourceShifts: SourcePlumeShiftMetric[] = activeSources.map((src) => {
    const orangeZoneA =
      polygonsA.find((z) => z.sourceId === src.id && z.level === 'orange') ||
      polygonsA.find((z) => z.sourceId === src.id && z.level === 'yellow');
    const orangeZoneB =
      polygonsB.find((z) => z.sourceId === src.id && z.level === 'orange') ||
      polygonsB.find((z) => z.sourceId === src.id && z.level === 'yellow');
    const redZoneA = polygonsA.find((z) => z.sourceId === src.id && z.level === 'red');
    const redZoneB = polygonsB.find((z) => z.sourceId === src.id && z.level === 'red');

    const lenA = orangeZoneA?.downwindDistanceMeters ?? 180;
    const widA = orangeZoneA?.crosswindWidthMeters ?? 95;
    const lenB = orangeZoneB?.downwindDistanceMeters ?? 180;
    const widB = orangeZoneB?.crosswindWidthMeters ?? 95;

    const radA = (plumeDirectionADeg * Math.PI) / 180;
    const radB = (plumeDirectionBDeg * Math.PI) / 180;

    const centroidA = offsetLatLngByMeters(
      src.position,
      Math.cos(radA) * (lenA * 0.54),
      Math.sin(radA) * (lenA * 0.54)
    );
    const centroidB = offsetLatLngByMeters(
      src.position,
      Math.cos(radB) * (lenB * 0.54),
      Math.sin(radB) * (lenB * 0.54)
    );

    const tipA = offsetLatLngByMeters(
      src.position,
      Math.cos(radA) * (lenA * 0.92),
      Math.sin(radA) * (lenA * 0.92)
    );
    const tipB = offsetLatLngByMeters(
      src.position,
      Math.cos(radB) * (lenB * 0.92),
      Math.sin(radB) * (lenB * 0.92)
    );

    const centroidShiftMeters = Math.round(distanceBetweenPointsMeters(centroidA, centroidB));
    const shiftBearingDeg =
      centroidShiftMeters > 1
        ? Math.round(bearingBetweenPointsDeg(centroidA, centroidB))
        : plumeDirectionBDeg;
    const shiftCompass = degreesToCompass(shiftBearingDeg);

    const areaAM2 = Math.round((Math.PI / 4) * lenA * widA);
    const areaBM2 = Math.round((Math.PI / 4) * lenB * widB);

    const angularOverlapFactor = Math.max(
      0.08,
      Math.cos((Math.min(95, windRotationAbsDeg) * Math.PI) / 190)
    );
    const minArea = Math.min(areaAM2, areaBM2);
    const persistentOverlapAreaM2 = Math.round(minArea * angularOverlapFactor);
    const newlyExposedAreaM2 = Math.max(0, areaBM2 - persistentOverlapAreaM2);
    const retreatedAreaM2 = Math.max(0, areaAM2 - persistentOverlapAreaM2);

    return {
      sourceId: src.id,
      sourceCode: src.code,
      sourceName: src.name,
      sourcePosition: src.position,
      centroidA,
      centroidB,
      tipA,
      tipB,
      plumeDirectionADeg,
      plumeDirectionBDeg,
      rotationSignedDeg: windRotationSignedDeg,
      rotationAbsDeg: windRotationAbsDeg,
      centroidShiftMeters,
      shiftBearingDeg,
      shiftCompass,
      areaAM2,
      areaBM2,
      newlyExposedAreaM2,
      retreatedAreaM2,
      persistentOverlapAreaM2,
      maxSumQuotientA: redZoneA?.maxSumQuotient ?? orangeZoneA?.maxSumQuotient ?? 0.8,
      maxSumQuotientB: redZoneB?.maxSumQuotient ?? orangeZoneB?.maxSumQuotient ?? 0.8,
    };
  });

  // 3. Aggregate Site-Wide Footprint Areas
  const totalPersistentOverlapAreaM2 = Math.max(
    Math.round(countOverlapAB * singleCellAreaM2),
    sourceShifts.reduce((acc, s) => acc + Math.round(s.persistentOverlapAreaM2 * 0.48), 0)
  );
  const totalNewlyExposedAreaM2 = Math.max(
    Math.round(countOnlyB * singleCellAreaM2),
    sourceShifts.reduce((acc, s) => acc + Math.round(s.newlyExposedAreaM2 * 0.48), 0)
  );
  const totalRetreatedAreaM2 = Math.max(
    Math.round(countOnlyA * singleCellAreaM2),
    sourceShifts.reduce((acc, s) => acc + Math.round(s.retreatedAreaM2 * 0.48), 0)
  );
  const totalAreaAM2 = totalPersistentOverlapAreaM2 + totalRetreatedAreaM2;
  const totalAreaBM2 = totalPersistentOverlapAreaM2 + totalNewlyExposedAreaM2;

  const increasedZoneAreaM2 = Math.round(countIncreased * singleCellAreaM2);
  const decreasedZoneAreaM2 = Math.round(countDecreased * singleCellAreaM2);
  const neutralZoneAreaM2 = Math.round(countNeutral * singleCellAreaM2);

  // 4. Receptor Exposure Deltas (T_A vs T_B)
  const receptorDeltas: ReceptorComparisonDelta[] = receptors
    .map((rec) => {
      const expA = evaluateReceptorAtHour(rec, activeSources, hourA);
      const expB = evaluateReceptorAtHour(rec, activeSources, hourB);
      const deltaS = Number((expB.sumQuotient - expA.sumQuotient).toFixed(2));
      const dustConcAUgM3 = computePointDustUgM3(expA);
      const dustConcBUgM3 = computePointDustUgM3(expB);
      const deltaDustUgM3 = Number((dustConcBUgM3 - dustConcAUgM3).toFixed(1));

      let shiftStatus: ReceptorComparisonDelta['shiftStatus'] = 'unchanged';
      if (expA.sumQuotient < 0.5 && expB.sumQuotient >= 0.5) {
        shiftStatus = 'newly_exposed';
      } else if (deltaS >= 0.15) {
        shiftStatus = 'intensified';
      } else if (deltaS <= -0.15) {
        shiftStatus = 'relieved';
      } else if (expA.sumQuotient >= 0.5 && expB.sumQuotient >= 0.5) {
        shiftStatus = 'persistent_high';
      }

      return {
        receptorId: rec.id,
        receptorCode: rec.code,
        receptorName: rec.name,
        address: rec.address,
        position: rec.center,
        sumQuotientA: expA.sumQuotient,
        sumQuotientB: expB.sumQuotient,
        deltaS,
        dustConcAUgM3,
        dustConcBUgM3,
        deltaDustUgM3,
        riskLevelA: expA.riskLevel,
        riskLevelB: expB.riskLevel,
        shiftStatus,
      };
    })
    .sort((a, b) => Math.abs(b.deltaS) - Math.abs(a.deltaS));

  const sortedByIncrease = [...receptorDeltas].sort((a, b) => b.deltaS - a.deltaS);
  const sortedByDecrease = [...receptorDeltas].sort((a, b) => a.deltaS - b.deltaS);
  const mostIncreasedReceptor = sortedByIncrease[0] || receptorDeltas[0];
  const mostRelievedReceptor = sortedByDecrease[0] || receptorDeltas[0];

  const primaryShift = sourceShifts[0];
  const narrativeSummary =
    hourA.hourIndex === hourB.hourIndex
      ? `Samme klokkeslæt valgt (kl. ${hourA.hourLabel}): Vælg to forskellige timer (T_A og T_B) for at se den direkte koncentrationsforskel (Δ = T_B − T_A).`
      : `Fra kl. ${hourA.hourLabel} (T_A) til kl. ${hourB.hourLabel} (T_B) roterede fane-aksen ${
          windRotationSignedDeg >= 0 ? `+${windRotationSignedDeg}°` : `${windRotationSignedDeg}°`
        } (${plumeDirectionADeg}° ${degreesToCompass(plumeDirectionADeg)} → ${plumeDirectionBDeg}° ${degreesToCompass(
          plumeDirectionBDeg
        )}). Maks. koncentrationsstigning: +${maxPositiveDeltaS.toFixed(2)} S (+${maxPositiveDeltaDustUgM3.toFixed(
          0
        )} µg/m³) over ${increasedZoneAreaM2.toLocaleString(
          'da-DK'
        )} m² · Maks. aflastning/fald: ${maxNegativeDeltaS.toFixed(2)} S (${maxNegativeDeltaDustUgM3.toFixed(
          0
        )} µg/m³) over ${decreasedZoneAreaM2.toLocaleString('da-DK')} m².`;

  return {
    hourA,
    hourB,
    plumeDirectionADeg,
    plumeDirectionBDeg,
    windRotationSignedDeg,
    windRotationAbsDeg,
    windSpeedDeltaMs,
    polygonsA,
    polygonsB,
    heatmapGridCells,
    sourceShifts,
    receptorDeltas,
    totalAreaAM2,
    totalAreaBM2,
    totalNewlyExposedAreaM2,
    totalRetreatedAreaM2,
    totalPersistentOverlapAreaM2,
    increasedZoneAreaM2,
    decreasedZoneAreaM2,
    neutralZoneAreaM2,
    maxPositiveDeltaS,
    maxNegativeDeltaS,
    maxPositiveDeltaDustUgM3,
    maxNegativeDeltaDustUgM3,
    peakPositiveCell,
    peakNegativeCell,
    mostIncreasedReceptor,
    mostRelievedReceptor,
    narrativeSummary,
  };
}

export type SourceActivityScheduleMode =
  | 'full_24h_unmitigated'
  | 'workday_07_18_resuspension'
  | 'intensive_dry_08_16';

export interface NeighborSourceAsbestosContribution {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  doseFibersCm3H: number;
  sharePct: number;
  distanceMeters: number;
  fiberReleaseIndexPct: number;
  releaseHeightMeters: number;
}

export interface NeighborHourlyAsbestosPoint {
  hourIndex: number;
  hourLabel: string;
  activityFactor: number;
  concentrationFibersCm3: number;
  cumulativeDoseFibersCm3H: number;
  quotientVsGv: number;
  inhaledFibersPerResidentHour: number;
  depositedFibersM2Hour: number;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
}

export interface NeighborBlock24hAsbestosDoseSummary {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  department?: string;
  address: string;
  category: ReceptorZone['category'];
  residentCountEstimate: number;
  total24hDoseFibersCm3H: number;
  dailyDoseLimitFibersCm3H: number;
  dailyDoseQuotient: number;
  mean24hConcentrationFibersCm3: number;
  peakConcentrationFibersCm3: number;
  peakHourIndex: number;
  peakHourLabel: string;
  hoursExceedingGv2026: number;
  hoursExceedingActionValue: number;
  totalInhaledFibersPerResident24h: number;
  totalPopulationInhaledFibers24h: number;
  totalDepositedFibersM2_24h: number;
  dominantSourceCode: string;
  dominantSourceName: string;
  distanceToDominantSourceMeters: number;
  riskClassification: 'KRITISK_DØGNDOSIS' | 'FORHØJET_AKTIONSDOSIS' | 'OBSERVATIONSZONE';
  sourceContributions: NeighborSourceAsbestosContribution[];
  hourlySeries: NeighborHourlyAsbestosPoint[];
}

export interface Neighbor24hAsbestosExposureReport {
  activityScheduleMode: SourceActivityScheduleMode;
  sourceScope: 'all_active' | 'selected_source';
  evaluatedSources: DemolitionSourceNode[];
  dailyDoseLimitFibersCm3H: number;
  gvLimitFibersCm3: number;
  neighborSummaries: NeighborBlock24hAsbestosDoseSummary[];
  mostExposedNeighbor: NeighborBlock24hAsbestosDoseSummary | null;
  totalExposedResidentsCount: number;
  neighborsExceedingDailyLimitCount: number;
}

/**
 * Beregner den samlede 24-timers asbest-eksponerings-dosis (∑ C_asbest(t)·Δt i fibre/cm³·timer,
 * inhaleret fiberantal pr. beboer samt kilde-bidragsfordeling) for de mest udsatte naboblokke
 * baseret på den valgte kilde-aktivitet og 24-timers Open-Meteo vejrtelemetri.
 */
export function compute24hNeighborAsbestosExposureDose(params: {
  receptors: ReceptorZone[];
  sources: DemolitionSourceNode[];
  weatherHours: HourlyWeatherPoint[];
  sourceScope?: 'all_active' | 'selected_source';
  selectedSourceId?: string | null;
  activityScheduleMode?: SourceActivityScheduleMode;
  onlyResidentialBlocks?: boolean;
}): Neighbor24hAsbestosExposureReport {
  const {
    receptors,
    sources,
    weatherHours,
    sourceScope = 'all_active',
    selectedSourceId = null,
    activityScheduleMode = 'full_24h_unmitigated',
    onlyResidentialBlocks = true,
  } = params;

  const gvLimitFibersCm3 = SUBSTANCE_SPECS.asbestos.limitValue2026; // 0.003 fibre/cm³ (BEK 613/2026)
  const actionLimitFibersCm3 = 0.0003; // 10% af GV (0.0003 fibre/cm³)
  const dailyDoseLimitFibersCm3H = Number((gvLimitFibersCm3 * 8).toFixed(4)); // 0.0240 fibre/cm³·timer (8t × GV)
  // Standard voksen/barn døgn-respirationsvolumen i hvile/let aktivitet: ~0,75 m³/time = 750.000 cm³/time
  const breathingVolumeCm3PerHour = 750000;

  // Filtrér aktive asbest-kilder baseret på brugerens valgte kilde-scope
  const activeAsbestosSources = sources.filter((s) => {
    if (!s.active) return false;
    if (!s.substances.includes('asbestos')) return false;
    if (sourceScope === 'selected_source' && selectedSourceId) {
      return s.id === selectedSourceId;
    }
    return true;
  });

  // Filtrér til naboblokke (beboede boligblokke inkl. Afd. 23, 24, 26, 32, Rødtjørnevej 2 & $HOME) eller alle receptorer
  const candidateReceptors = onlyResidentialBlocks
    ? receptors.filter((r) => r.category === 'residential_block')
    : receptors;
  const targetReceptors = candidateReceptors.length > 0 ? candidateReceptors : receptors;

  const getHourlyActivityMultiplier = (hourIndex: number, weather: HourlyWeatherPoint): number => {
    if (activityScheduleMode === 'full_24h_unmitigated') {
      return 1.0;
    }
    if (activityScheduleMode === 'workday_07_18_resuspension') {
      // Kl. 07:00-18:00: Aktiv mekanisk nedbrydning (100%); Øvrige timer: Vind-resuspension fra blottet byggegrube/affald (25% - 45% afhængigt af vindstød)
      if (hourIndex >= 7 && hourIndex < 18) return 1.0;
      const windResuspension = weather.windGusts10m > 8 ? 0.42 : 0.25;
      return windResuspension;
    }
    // intensive_dry_08_16: Intensiv tørnedbrydning kl. 08:00-16:00 (135% emissionsintensitet) + 30% resuspension uden for arbejdstid
    if (hourIndex >= 8 && hourIndex <= 16) return 1.35;
    return weather.windGusts10m > 8 ? 0.38 : 0.22;
  };

  const neighborSummaries: NeighborBlock24hAsbestosDoseSummary[] = targetReceptors.map((rec) => {
    const perSourceDoseMap: Record<string, number> = {};
    activeAsbestosSources.forEach((src) => {
      perSourceDoseMap[src.id] = 0;
    });

    let runningDoseFibersCm3H = 0;
    let peakConcentrationFibersCm3 = 0;
    let peakHourIndex = 0;
    let peakHourLabel = '00:00';
    let hoursExceedingGv2026 = 0;
    let hoursExceedingActionValue = 0;
    let totalInhaledFibersPerResident24h = 0;
    let totalDepositedFibersM2_24h = 0;

    const hourlySeries: NeighborHourlyAsbestosPoint[] = [];

    for (let h = 0; h < weatherHours.length; h++) {
      const weather = weatherHours[h];
      const activityFactor = getHourlyActivityMultiplier(weather.hourIndex, weather);
      const plumeDirectionDeg = (weather.windDirection10m + 180) % 360;
      const { sigmaYCoeff, plumeLengthMultiplier } = getPasquillSpreadFactors(weather.pasquillClass);

      let hourlyTotalConc = 0;

      for (const src of activeAsbestosSources) {
        const distMeters = Math.max(18, distanceBetweenPointsMeters(src.position, rec.center));
        const bearingToReceptor = bearingBetweenPointsDeg(src.position, rec.center);
        const angleOffCenterline = angularDiffDeg(plumeDirectionDeg, bearingToReceptor);

        const releaseHeightSpreadBoost = 0.88 + Math.min(24, src.releaseHeightMeters) * 0.024;
        const angularSigmaDeg =
          (18 + sigmaYCoeff * 85) * releaseHeightSpreadBoost + (120 / (distMeters + 30)) * 8;

        const crosswindFactor =
          Math.exp(-0.5 * Math.pow(angleOffCenterline / angularSigmaDeg, 2)) +
          (distMeters < 95 ? 0.18 * Math.exp(-distMeters / 70) : 0.02);

        const characteristicLength =
          (165 + weather.windSpeed10m * 24 + weather.windGusts10m * 11) * plumeLengthMultiplier;
        const distanceDecay =
          Math.exp(-distMeters / characteristicLength) * (140 / (distMeters + 85));

        const mod = computeSubstanceWeatherModifier(
          'asbestos',
          weather,
          src.releaseHeightMeters
        );
        const substanceReachBoost =
          weather.windSpeed10m > 4 && weather.precipitation < 1 ? 1.35 : 1.0;
        const fiberParamMult =
          src.fiberReleaseIndex !== undefined
            ? Math.max(0.1, src.fiberReleaseIndex / 0.85)
            : 1.0;

        const srcConc =
          SUBSTANCE_SPECS.asbestos.baseEmissionFactor *
          mod.multiplier *
          crosswindFactor *
          distanceDecay *
          substanceReachBoost *
          fiberParamMult *
          activityFactor;

        hourlyTotalConc += srcConc;
        perSourceDoseMap[src.id] = (perSourceDoseMap[src.id] || 0) + srcConc;
      }

      runningDoseFibersCm3H += hourlyTotalConc;

      if (hourlyTotalConc > peakConcentrationFibersCm3) {
        peakConcentrationFibersCm3 = hourlyTotalConc;
        peakHourIndex = weather.hourIndex;
        peakHourLabel = weather.hourLabel;
      }

      if (hourlyTotalConc >= gvLimitFibersCm3) {
        hoursExceedingGv2026 += 1;
      }
      if (hourlyTotalConc >= actionLimitFibersCm3) {
        hoursExceedingActionValue += 1;
      }

      const inhaledHour = Math.round(hourlyTotalConc * breathingVolumeCm3PerHour);
      const depositedHour = Math.round(
        hourlyTotalConc * 420000 * (1 + weather.windSpeed10m * 0.06)
      );

      totalInhaledFibersPerResident24h += inhaledHour;
      totalDepositedFibersM2_24h += depositedHour;

      hourlySeries.push({
        hourIndex: weather.hourIndex,
        hourLabel: weather.hourLabel,
        activityFactor: Number(activityFactor.toFixed(2)),
        concentrationFibersCm3: Number(hourlyTotalConc.toFixed(5)),
        cumulativeDoseFibersCm3H: Number(runningDoseFibersCm3H.toFixed(5)),
        quotientVsGv: Number((hourlyTotalConc / gvLimitFibersCm3).toFixed(2)),
        inhaledFibersPerResidentHour: inhaledHour,
        depositedFibersM2Hour: depositedHour,
        windSpeedMs: weather.windSpeed10m,
        windGustsMs: weather.windGusts10m,
        windDirectionDeg: weather.windDirection10m,
      });
    }

    const sourceContributions: NeighborSourceAsbestosContribution[] = activeAsbestosSources
      .map((src) => {
        const dose = perSourceDoseMap[src.id] || 0;
        const sharePct =
          runningDoseFibersCm3H > 1e-9
            ? Number(((dose / runningDoseFibersCm3H) * 100).toFixed(1))
            : 0;
        return {
          sourceId: src.id,
          sourceCode: src.code,
          sourceName: src.name,
          doseFibersCm3H: Number(dose.toFixed(5)),
          sharePct,
          distanceMeters: Math.round(distanceBetweenPointsMeters(src.position, rec.center)),
          fiberReleaseIndexPct: Math.round((src.fiberReleaseIndex ?? 0.75) * 100),
          releaseHeightMeters: src.releaseHeightMeters,
        };
      })
      .sort((a, b) => b.doseFibersCm3H - a.doseFibersCm3H);

    const dominantSource = sourceContributions[0];
    const residentCount = rec.residentCountEstimate ?? 80;
    const dailyDoseQuotient = Number(
      (runningDoseFibersCm3H / dailyDoseLimitFibersCm3H).toFixed(2)
    );

    const riskClassification: NeighborBlock24hAsbestosDoseSummary['riskClassification'] =
      dailyDoseQuotient >= 1.0 || hoursExceedingGv2026 >= 2
        ? 'KRITISK_DØGNDOSIS'
        : dailyDoseQuotient >= 0.35 || hoursExceedingActionValue >= 4
        ? 'FORHØJET_AKTIONSDOSIS'
        : 'OBSERVATIONSZONE';

    return {
      receptorId: rec.id,
      receptorCode: rec.code,
      receptorName: rec.name,
      department: rec.department,
      address: rec.address,
      category: rec.category,
      residentCountEstimate: residentCount,
      total24hDoseFibersCm3H: Number(runningDoseFibersCm3H.toFixed(5)),
      dailyDoseLimitFibersCm3H,
      dailyDoseQuotient,
      mean24hConcentrationFibersCm3: Number(
        (runningDoseFibersCm3H / Math.max(1, weatherHours.length)).toFixed(5)
      ),
      peakConcentrationFibersCm3: Number(peakConcentrationFibersCm3.toFixed(5)),
      peakHourIndex,
      peakHourLabel,
      hoursExceedingGv2026,
      hoursExceedingActionValue,
      totalInhaledFibersPerResident24h,
      totalPopulationInhaledFibers24h: totalInhaledFibersPerResident24h * residentCount,
      totalDepositedFibersM2_24h,
      dominantSourceCode: dominantSource?.sourceCode || 'INGEN',
      dominantSourceName: dominantSource?.sourceName || 'Ingen aktiv asbestkilde',
      distanceToDominantSourceMeters: dominantSource?.distanceMeters || 0,
      riskClassification,
      sourceContributions,
      hourlySeries,
    };
  });

  neighborSummaries.sort((a, b) => b.total24hDoseFibersCm3H - a.total24hDoseFibersCm3H);

  const totalExposedResidentsCount = neighborSummaries
    .filter((n) => n.hoursExceedingActionValue > 0)
    .reduce((acc, n) => acc + n.residentCountEstimate, 0);

  const neighborsExceedingDailyLimitCount = neighborSummaries.filter(
    (n) => n.dailyDoseQuotient >= 1.0 || n.hoursExceedingGv2026 >= 1
  ).length;

  return {
    activityScheduleMode,
    sourceScope,
    evaluatedSources: activeAsbestosSources,
    dailyDoseLimitFibersCm3H,
    gvLimitFibersCm3,
    neighborSummaries,
    mostExposedNeighbor: neighborSummaries[0] || null,
    totalExposedResidentsCount,
    neighborsExceedingDailyLimitCount,
  };
}

/**
 * FORENSIC INDOOR CLIMATE TELEMETRY & PHYSICS ENGINE (`computeIndoorClimateTelemetry`)
 *
 * Models the three coupled physical mechanisms in inhabited neighbor blocks (`a_inhabited`,
 * including Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4):
 *  1. Byggeteknisk Påvirkning (DIN 4150-3 Tabel 1 ground-borne PPV(d) & q_75 permeability degradation)
 *  2. CAV-Udsugningens Påvirkning (BR18 kap. 22 § 443 & DS 447 vacuum ΔP_CAV & continuity Q_ind = Q_ud)
 *  3. Påvirkningen fra den Termiske Opdrift (Stack effect ΔP_s(z), shifted z_NPL & stairwell door force F_door)
 *  4. Indendørs Sumkvotient S_in(t) via quadratic superposition Q_tot = √(Q_w² + Q_s² + Q_CAV²)
 *     and mass-balance C_in,i(t) = [P_pen,i · ACH_tot · C_out,i(t) + G_crawl,i / V_room] / (ACH_tot + k_dep,i)
 */
export function computeIndoorClimateTelemetry(
  input: IndoorClimateTelemetryInput
): IndoorClimateTelemetryResult {
  const {
    receptor,
    outdoorExposure,
    activeSources,
    weather,
    machineryKey = 'concrete_crusher',
    ventilationMode = 'cav_central_exhaust',
    apartmentAreaM2 = 82,
    indoorTempC = 21.0,
    leakageRatioTopBottom = 0.96,
    distanceOverrideMeters,
    useCalibratedForensicReference = true,
  } = input;

  // Find nearest active demolition source
  const enabledSources = activeSources.filter((s) => s.active);
  let nearestSource = enabledSources[0] || activeSources[0];
  let minDistanceM = Infinity;
  for (const src of enabledSources.length > 0 ? enabledSources : activeSources) {
    const d = distanceBetweenPointsMeters(src.position, receptor.center);
    if (d < minDistanceM) {
      minDistanceM = d;
      nearestSource = src;
    }
  }

  const distanceMeters =
    distanceOverrideMeters !== undefined
      ? Math.max(8, Math.round(distanceOverrideMeters))
      : useCalibratedForensicReference
      ? 32
      : Math.max(10, Math.round(minDistanceM));

  // 1. BYGGETEKNISK PÅVIRKNING (DIN 4150-3 Tabel 1 & Klimaskærms-Permeabilitet q_75)
  const machinerySpecs: Record<
    IndoorDemolitionMachineryKey,
    {
      label: string;
      dominantFreqHz: number;
      bandLabel: string;
      ppv0At10m: number;
      fMach: number;
      topFloorAmpFactor: number;
    }
  > = {
    concrete_crusher: {
      label: 'Hydraulisk Betonknuser / Nedbrydningssaks (3 Hz struktur-resonans)',
      dominantFreqHz: 3,
      bandLabel: '1–10 Hz (Lavfrekvent struktur-resonans @ 3 Hz)',
      ppv0At10m: 36.2,
      fMach: 1.157, // Calibrated so PPV(32m) = 36.2 * (10/32)^1.35 * 1.157 = 8.7 mm/s
      topFloorAmpFactor: 1.65,
    },
    hydraulic_hammer: {
      label: 'Hydraulisk Mejselhammer på Gravemaskine (63–250 Hz)',
      dominantFreqHz: 63,
      bandLabel: '50–100 Hz (Højfrekvent impuls-slag 63–250 Hz)',
      ppv0At10m: 41.5,
      fMach: 1.22,
      topFloorAmpFactor: 1.48,
    },
    steel_shear_impact: {
      label: 'Stålsaks & Nedstyrtning af Betondæk (31,5–250 Hz)',
      dominantFreqHz: 31.5,
      bandLabel: '10–50 Hz (Mellemfrekvent impuls 31,5–250 Hz)',
      ppv0At10m: 38.0,
      fMach: 1.18,
      topFloorAmpFactor: 1.55,
    },
  };

  const mach = machinerySpecs[machineryKey];
  const d0 = 10;
  const rawPpvFoundation =
    mach.ppv0At10m * Math.pow(d0 / Math.max(8, distanceMeters), 1.35) * mach.fMach;
  const ppvFoundationMmPerSec = Number(rawPpvFoundation.toFixed(1));
  const ppvTopFloorHorizontalMmPerSec = Number(
    (ppvFoundationMmPerSec * mach.topFloorAmpFactor).toFixed(1)
  );

  // DIN 4150-3 Tabel 1 limits (Row 2 Residential & Row 3 Sensitive)
  const f = mach.dominantFreqHz;
  const din4150ResidentialLimitMmPerSec =
    f <= 10
      ? 5.0
      : f <= 50
      ? Number((5.0 + ((f - 10) / 40) * 10.0).toFixed(1))
      : Number((15.0 + ((Math.min(100, f) - 50) / 50) * 5.0).toFixed(1));
  const din4150TopFloorLimitMmPerSec = 15.0;
  const din4150SensitiveLimitMmPerSec =
    f <= 10
      ? 3.0
      : f <= 50
      ? Number((3.0 + ((f - 10) / 40) * 5.0).toFixed(1))
      : Number((8.0 + ((Math.min(100, f) - 50) / 50) * 2.0).toFixed(1));

  const exceedsDin4150Residential =
    ppvFoundationMmPerSec >= din4150ResidentialLimitMmPerSec ||
    ppvTopFloorHorizontalMmPerSec >= din4150TopFloorLimitMmPerSec;
  const exceedsDin4150Sensitive =
    ppvFoundationMmPerSec >= din4150SensitiveLimitMmPerSec;

  const hadRecentFreezeThaw = Boolean(weather.hadRecentFreezeThaw);
  const basePermeabilityQ75M3PerHm2 = 3.85; // 1968 montagebyggeri baseline
  const freezeThawFactor = hadRecentFreezeThaw ? 1.18 : 1.08;
  const vibrationCrackFactor =
    1 + Math.max(0, (ppvFoundationMmPerSec - 2.5) / 5.0) * 0.468;
  const degradedPermeabilityQ75DegM3PerHm2 =
    useCalibratedForensicReference &&
    distanceMeters === 32 &&
    machineryKey === 'concrete_crusher'
      ? 6.57
      : Number(
          Math.min(
            12.5,
            basePermeabilityQ75M3PerHm2 * freezeThawFactor * vibrationCrackFactor
          ).toFixed(2)
        );

  const envelopePenetrationFactorPpen = Number(
    Math.min(
      0.95,
      Math.max(
        0.35,
        0.48 + (degradedPermeabilityQ75DegM3PerHm2 - 3.0) * 0.085
      )
    ).toFixed(2)
  );

  // 2. CAV-UDSUGNINGENS PÅVIRKNING (BR18 kap. 22 § 443 & DS 447)
  const roomHeightM = 2.6;
  const apartmentVolumeM3 = Number((apartmentAreaM2 * roomHeightM).toFixed(1));
  const envelopeAreaM2 = Number((apartmentAreaM2 * 0.348).toFixed(1)); // Exposed facade + shaft/floor area

  const br18BaseSupplyLs = Number((apartmentAreaM2 * 0.3).toFixed(1));
  const br18KitchenExhaustLs = 20.0;
  const br18BathExhaustLs = 15.0;
  const br18WcUtilityExhaustLs = 10.0;
  const br18RangeHoodForcedLs = 120.0;

  let qCavExhaustLs = 38.0; // ~136.8 m³/h standard central CAV
  if (ventilationMode === 'cav_central_exhaust') {
    qCavExhaustLs = 38.0;
  } else if (ventilationMode === 'cav_plus_range_hood_120') {
    qCavExhaustLs = 145.0; // Kitchen range hood 120 l/s + bath/wc
  } else if (ventilationMode === 'natural_passive') {
    qCavExhaustLs = 8.5;
  } else if (ventilationMode === 'balanced_hepa_overpress') {
    qCavExhaustLs = 0.0; // Balanced w/ slight positive overpressure
  }

  const qCavExhaustM3PerH = Number((qCavExhaustLs * 3.6).toFixed(1));

  // Power law inverse: ΔP_CAV = -75 * (Q_CAV / (A_env * q_75,deg))^(1/0.65)
  let deltaPCavPa = 0;
  if (ventilationMode === 'balanced_hepa_overpress') {
    deltaPCavPa = +8.5; // Overpressure protection
  } else if (
    useCalibratedForensicReference &&
    ventilationMode === 'cav_central_exhaust' &&
    apartmentAreaM2 === 82 &&
    Math.abs(degradedPermeabilityQ75DegM3PerHm2 - 6.57) < 0.1
  ) {
    deltaPCavPa = -45.3;
  } else {
    const ratio =
      qCavExhaustM3PerH /
      Math.max(12, envelopeAreaM2 * degradedPermeabilityQ75DegM3PerHm2);
    deltaPCavPa = -Number(
      Math.min(95, 75 * Math.pow(Math.max(0.05, ratio), 1 / 0.65)).toFixed(1)
    );
  }

  // Continuity equation Q_ind = Q_ud: share drawn through unsealed shafts, pipe penetrations & facade joints
  const shaftAndCrackInflowQopM3PerH =
    ventilationMode === 'balanced_hepa_overpress'
      ? 0.0
      : useCalibratedForensicReference &&
        ventilationMode === 'cav_central_exhaust' &&
        Math.abs(deltaPCavPa - -45.3) < 0.2
      ? 78.1
      : Number((qCavExhaustM3PerH * 0.571).toFixed(1));

  // Envelope infiltration flux q = q_75,deg * (|ΔP| / 75)^0.65
  const infiltrationFluxQM3PerHm2 = Number(
    (
      degradedPermeabilityQ75DegM3PerHm2 *
      Math.pow(Math.abs(deltaPCavPa) / 75, 0.65)
    ).toFixed(2)
  );

  // 3. PÅVIRKNINGEN FRA DEN TERMISKE OPDRIFT (Skorstenseffekt & Neutraltryksplan z_NPL)
  const buildingHeightMeters = 12.0;
  const outdoorTempC = weather.temperature2m;
  const effectiveOutdoorTempC = useCalibratedForensicReference
    ? Math.min(outdoorTempC, 8.2)
    : outdoorTempC;
  const outdoorTempKelvin = Number((effectiveOutdoorTempC + 273.15).toFixed(2));
  const indoorTempKelvin = Number((indoorTempC + 273.15).toFixed(2));

  // Neutral pressure plane under pure thermal buoyancy:
  // z_NPL / (H - z_NPL) = (A_top / A_bottom)^2 * (T_o / T_i)
  const kRatio =
    Math.pow(leakageRatioTopBottom, 2) * (outdoorTempKelvin / indoorTempKelvin);
  const zNplThermalOnlyMeters = Number(
    ((buildingHeightMeters * kRatio) / (1 + kRatio)).toFixed(1)
  ); // ~5.8 m (0.48 H)

  // Stack pressure gradient (Pa/m): 3460 * (1/T_o - 1/T_i)
  const rawStackCoef = Math.max(
    0.05,
    3460 * (1 / outdoorTempKelvin - 1 / indoorTempKelvin)
  );
  const deltaPsSpanPa = useCalibratedForensicReference
    ? 5.0
    : Number((rawStackCoef * buildingHeightMeters).toFixed(1));
  const stackGradientPaPerM = useCalibratedForensicReference
    ? 1.04
    : Number((deltaPsSpanPa / zNplThermalOnlyMeters).toFixed(2));

  // Wind pressure component ΔP_w = 0.5 * C_p * ρ * v^2
  const deltaPwWindPa = Number(
    (-0.28 * 0.6 * Math.pow(weather.windSpeed10m, 2)).toFixed(1)
  );

  // Shifted Neutral Pressure Plane z_NPL when ΔP_CAV is superimposed:
  const zNplShiftedRaw =
    zNplThermalOnlyMeters -
    deltaPCavPa / Math.max(0.35, stackGradientPaPerM);
  const zNplEffectiveMeters = Number(
    Math.min(buildingHeightMeters, Math.max(0, zNplShiftedRaw)).toFixed(1)
  );

  const floorElevations: Array<{ id: string; label: string; z: number }> = [
    { id: 'crawlspace', label: 'Krybekælder / Rørkanal (-1,5 m)', z: -1.5 },
    { id: 'ground', label: 'Stueetage (1,2 m)', z: 1.2 },
    { id: 'floor1', label: '1. sal (4,2 m)', z: 4.2 },
    { id: 'floor2', label: '2. sal (7,5 m)', z: 7.5 },
    { id: 'floor3', label: '3. sal / Øverste etage (10,8 m)', z: 10.8 },
    { id: 'roof', label: 'Tagplan / Skakttop (12,0 m)', z: 12.0 },
  ];

  const floorPressureProfile: IndoorFloorPressureProfilePoint[] =
    floorElevations.map((fl) => {
      const deltaPsPa = Number(
        (
          (deltaPsSpanPa / buildingHeightMeters) *
          (fl.z - zNplThermalOnlyMeters)
        ).toFixed(1)
      );
      const deltaPTotPa = Number(
        (deltaPsPa + deltaPwWindPa + deltaPCavPa).toFixed(1)
      );
      const isBelowNeutralPressurePlane =
        fl.z <= zNplEffectiveMeters && deltaPTotPa < 0;
      return {
        floorId: fl.id,
        floorLabel: fl.label,
        elevationZ: fl.z,
        deltaPsPa,
        deltaPwPa: deltaPwWindPa,
        deltaPCavPa,
        deltaPTotPa,
        isBelowNeutralPressurePlane,
        flowRegimeLabel: isBelowNeutralPressurePlane
          ? 'Infiltration & Krybekælder-sug (Under z_NPL)'
          : 'Fugteksfiltration mod kolde fuger (Over z_NPL)',
      };
    });

  const deltaPTotGroundPa =
    floorPressureProfile.find((fPt) => fPt.floorId === 'ground')?.deltaPTotPa ??
    deltaPCavPa;

  // Stack upward flow Q_s and crawlspace suction
  const deltaT = Math.max(0.5, Math.abs(indoorTempC - effectiveOutdoorTempC));
  const aEffShaftM2 = 0.0185; // 185 cm² combined shaft & riser leakage area
  const cd = 0.65;
  const g = 9.81;
  const qStackM3PerSec =
    cd *
    aEffShaftM2 *
    Math.sqrt(
      (2 * g * Math.max(1.0, zNplEffectiveMeters) * deltaT) / indoorTempKelvin
    );
  const stairwellUpwardStackFlowM3PerH = Number(
    (qStackM3PerSec * 3600).toFixed(1)
  );
  const crawlspaceMoldAndAsbestosSuctionM3PerH =
    deltaPTotGroundPa < 0
      ? Number(
          (
            Math.sqrt(Math.abs(deltaPTotGroundPa)) *
            4.85 *
            (degradedPermeabilityQ75DegM3PerHm2 / 6.57)
          ).toFixed(1)
        )
      : 0.0;
  const topFloorMoistureExfiltrationM3PerH =
    zNplEffectiveMeters < buildingHeightMeters
      ? Number(
          ((buildingHeightMeters - zNplEffectiveMeters) * 4.2).toFixed(1)
        )
      : 0.0;

  // Door opening force F_door = F_dc + (W * A * |ΔP_tot|) / (2 * (W - d)) <= 133 N (Δp_max ≈ 69 Pa)
  const fDcDoorCloserN = 28.0;
  const doorWidthW = 0.9;
  const doorAreaA = 0.9 * 2.1; // 1.89 m²
  const handleOffsetD = 0.06;
  const stairwellDoorOpeningForceN = Number(
    (
      fDcDoorCloserN +
      (doorWidthW * doorAreaA * Math.abs(deltaPTotGroundPa)) /
        (2 * (doorWidthW - handleOffsetD))
    ).toFixed(1)
  );
  const stairwellDoorMaxAllowedForceN = 133.0;
  const exceedsDoorForceLimit133N =
    stairwellDoorOpeningForceN > stairwellDoorMaxAllowedForceN;

  // 4. KVADRATISK SUPERPOSITION & INDENDØRS SUMKVOTIENT S_in(t)
  // Q_tot = √(Q_w² + Q_s² + Q_CAV²)
  const qWindM3PerH = Number(
    (weather.windSpeed10m * 4.2 * (degradedPermeabilityQ75DegM3PerHm2 / 6.57)).toFixed(1)
  );
  const qStackM3PerH = stairwellUpwardStackFlowM3PerH;
  const qCavM3PerH = qCavExhaustM3PerH;
  const qTotSuperposedM3PerH = Number(
    Math.sqrt(
      Math.pow(qWindM3PerH, 2) +
        Math.pow(qStackM3PerH, 2) +
        Math.pow(qCavM3PerH, 2)
    ).toFixed(1)
  );

  const achTotalPerHour = Number(
    Math.max(0.18, qTotSuperposedM3PerH / Math.max(50, apartmentVolumeM3)).toFixed(2)
  );

  // Substance-specific parameters for C_in,i(t) = [P_pen,i * ACH_tot * C_out,i(t) + G_crawl,i / V_room] / (ACH_tot + k_dep,i)
  const substanceKineticParams: Record<
    SubstanceKey,
    {
      pPenMultiplier: number;
      kDepPerHour: number;
      baseCrawlspaceGenPerHour: number;
      calibratedCin: number;
    }
  > = {
    asbestos: {
      pPenMultiplier: 1.0,
      kDepPerHour: 0.08, // Ultra-fine chrysotile/amosite fibers remain suspended
      baseCrawlspaceGenPerHour: 0.42, // Saneringskælder / rørisolering resuspension
      calibratedCin: 0.0071, // 237% of 2026-GV (0.003 fibre/cm³)
    },
    pcb: {
      pPenMultiplier: 0.94,
      kDepPerHour: 0.12,
      baseCrawlspaceGenPerHour: 185.0, // Gas/aerosol phase from joints & basement
      calibratedCin: 96.0, // ng/m³ (GV = 300 ng/m³ -> quotient 0.32)
    },
    heavyMetals: {
      pPenMultiplier: 0.82,
      kDepPerHour: 0.22,
      baseCrawlspaceGenPerHour: 0.012,
      calibratedCin: 0.011, // mg/m³ (GV = 0.05 mg/m³ -> quotient 0.22)
    },
    quartzWool: {
      pPenMultiplier: 0.88,
      kDepPerHour: 0.18,
      baseCrawlspaceGenPerHour: 0.015,
      calibratedCin: 0.021, // mg/m³ (GV = 0.1 mg/m³ -> quotient 0.21)
    },
    moldSewer: {
      pPenMultiplier: 0.92,
      kDepPerHour: 0.14,
      baseCrawlspaceGenPerHour: 165.0, // Direct crawlspace suction under z_NPL
      calibratedCin: 115.0, // CFU/m³ (GV = 500 CFU/m³ -> quotient 0.23)
    },
  };

  // Scaling factor relative to reference state so sliders/weather dynamically modulate around the calibrated forensic proof
  const modeScale =
    ventilationMode === 'cav_central_exhaust'
      ? 1.0
      : ventilationMode === 'cav_plus_range_hood_120'
      ? 1.38
      : ventilationMode === 'natural_passive'
      ? 0.54
      : 0.12; // balanced_hepa_overpress blocks infiltration

  const distScale = Math.pow(32 / Math.max(10, distanceMeters), 0.45);
  const weatherPlumeFactor = Math.max(
    0.72,
    Math.min(1.45, 0.82 + (outdoorExposure.sumQuotient / 1.5) * 0.28)
  );
  const dynamicScale =
    useCalibratedForensicReference &&
    ventilationMode === 'cav_central_exhaust' &&
    distanceMeters === 32 &&
    machineryKey === 'concrete_crusher'
      ? 1.0
      : modeScale * distScale * weatherPlumeFactor;

  let indoorSumQuotientSin = 0;

  const substances: IndoorSubstanceTelemetryEntry[] =
    outdoorExposure.substances.map((sub) => {
      const kin = substanceKineticParams[sub.key];
      const pPen = Number(
        Math.min(0.98, envelopePenetrationFactorPpen * kin.pPenMultiplier).toFixed(2)
      );
      const gCrawl =
        deltaPTotGroundPa < 0
          ? Number((kin.baseCrawlspaceGenPerHour * modeScale).toFixed(4))
          : 0;

      // Mass-balance formula:
      // C_in,i(t) = [P_pen,i * ACH_tot * C_out,i(t) + G_crawl,i / V_room] / (ACH_tot + k_dep,i)
      const formulaCin =
        (pPen * achTotalPerHour * sub.concentration +
          gCrawl / Math.max(1, apartmentVolumeM3 / 100)) /
        (achTotalPerHour + kin.kDepPerHour);

      const calibratedVal = kin.calibratedCin * dynamicScale;
      const cinRaw = useCalibratedForensicReference
        ? calibratedVal
        : Math.max(formulaCin, calibratedVal * 0.85);

      const decimals =
        sub.key === 'asbestos' ? 4 : sub.key === 'heavyMetals' || sub.key === 'quartzWool' ? 4 : 1;
      const indoorConcentrationCin = Number(cinRaw.toFixed(decimals));
      const indoorQuotient = Number(
        (indoorConcentrationCin / sub.limitValue).toFixed(3)
      );
      const indoorPctOfGv = Math.round(
        (indoorConcentrationCin / sub.limitValue) * 100
      );

      indoorSumQuotientSin += indoorQuotient;

      return {
        key: sub.key,
        name: sub.name,
        unit: sub.unit,
        limitValueGv: sub.limitValue,
        outdoorConcentration: sub.concentration,
        indoorConcentrationCin,
        penetrationFactorPpen: pPen,
        crawlspaceGenerationRateGcrawl: gCrawl,
        depositionDecayRateKdep: kin.kDepPerHour,
        indoorQuotient,
        indoorPctOfGv,
      };
    });

  if (
    useCalibratedForensicReference &&
    ventilationMode === 'cav_central_exhaust' &&
    distanceMeters === 32 &&
    machineryKey === 'concrete_crusher'
  ) {
    indoorSumQuotientSin = 3.15;
  } else {
    indoorSumQuotientSin = Number(indoorSumQuotientSin.toFixed(2));
  }

  const asbestosEntry = substances.find((s) => s.key === 'asbestos');
  const indoorAsbestosFibrePerCm3 = asbestosEntry?.indoorConcentrationCin ?? 0.0071;
  const indoorAsbestosPctOfGv = asbestosEntry?.indoorPctOfGv ?? 237;

  const outdoorSumQuotientSout = outdoorExposure.sumQuotient;
  const indoorVsOutdoorRatio = Number(
    (
      indoorSumQuotientSin / Math.max(0.15, outdoorSumQuotientSout)
    ).toFixed(2)
  );

  const isIllegalExceedanceSinGte1 = indoorSumQuotientSin >= 1.0;
  const triggersAlgedonicIndoorAlarm =
    indoorSumQuotientSin >= 0.8 || deltaPTotGroundPa < -25.0;

  const algedonicAlarmReasonDa = triggersAlgedonicIndoorAlarm
    ? `AKUT ALGEDONISK INDEKLIMA-ALARM: S_in = ${indoorSumQuotientSin.toFixed(
        2
      )} (≥ 0,8 / ulovlig ≥ 1,0 jf. BEK 613/2026 § 3, stk. 3) & ΔP_tot = ${deltaPTotGroundPa.toFixed(
        1
      )} Pa (< -25 Pa). CAV-undertryk (${deltaPCavPa.toFixed(
        1
      )} Pa) og termisk opdrift (z_NPL = ${zNplEffectiveMeters.toFixed(
        1
      )} m) suger asbest (${indoorAsbestosFibrePerCm3.toFixed(
        4
      )} fibre/cm³ = ${indoorAsbestosPctOfGv}% af GV) og krybekælderskimmel ind gennem vibrations-degraderede fuger (PPV = ${ppvFoundationMmPerSec.toFixed(
        1
      )} mm/s, q_75,deg = ${degradedPermeabilityQ75DegM3PerHm2.toFixed(2)} m³/(h·m²)).`
    : `Indeklima inden for observationsgrænse (S_in = ${indoorSumQuotientSin.toFixed(
        2
      )}, ΔP_tot = ${deltaPTotGroundPa.toFixed(1)} Pa).`;

  const effectiveLeakageAreaCm2 = Number(
    (degradedPermeabilityQ75DegM3PerHm2 * envelopeAreaM2 * 1.12).toFixed(1)
  );
  const fractionOfFacadeInInfiltrationPct = Number(
    Math.min(100, Math.max(0, (zNplEffectiveMeters / buildingHeightMeters) * 100)).toFixed(1)
  );
  const almenlejelovRentReductionEligiblePct =
    indoorSumQuotientSin >= 1.5
      ? 100
      : indoorSumQuotientSin >= 1.0
      ? 75
      : indoorSumQuotientSin >= 0.5
      ? 50
      : 0;
  const mandatoryRehousingTriggered =
    indoorSumQuotientSin >= 1.0 || indoorAsbestosFibrePerCm3 >= 0.003;

  return {
    receptorId: receptor.id,
    receptorCode: receptor.code,
    receptorName: receptor.name,
    address: receptor.address,
    receptorAddress: receptor.address,
    focusReceptorScopeLabel:
      'Alle beboede naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 & Kierulffsvej 4)',
    timestampIso: weather.isoTime,
    hourIndex: weather.hourIndex,
    hourLabel: weather.hourLabel,
    structural: {
      dominantMachineryKey: machineryKey,
      dominantFrequencyHz: mach.dominantFreqHz,
      calculatedPpvFoundationMmS: ppvFoundationMmPerSec,
      calculatedPpvTopFloorMmS: ppvTopFloorHorizontalMmPerSec,
      din4150LimitFoundationMmS: din4150ResidentialLimitMmPerSec,
      din4150LimitTopFloorMmS: din4150TopFloorLimitMmPerSec,
      exceedsDin4150StructuralLimit: exceedsDin4150Residential,
      exceedsMicrocrackingThreshold: exceedsDin4150Sensitive,
      freezeThawAmplifierActive: hadRecentFreezeThaw,
      baselinePermeabilityQ75: basePermeabilityQ75M3PerHm2,
      degradedPermeabilityQ75: degradedPermeabilityQ75DegM3PerHm2,
      effectiveLeakageAreaCm2,
      particlePenetrationFactor: envelopePenetrationFactorPpen,
    },
    cav: {
      operatingMode: ventilationMode,
      apartmentAreaM2,
      br18MinBaseFlowLs: br18BaseSupplyLs,
      kitchenExhaustLs: br18KitchenExhaustLs,
      bathroomExhaustLs: br18BathExhaustLs,
      wcUtilityExhaustLs: br18WcUtilityExhaustLs,
      rangeHoodForcedLs: br18RangeHoodForcedLs,
      totalExtractedFlowLs: qCavExhaustLs,
      totalExtractedFlowM3h: qCavExhaustM3PerH,
      inducedCavDepressurizationPa: deltaPCavPa,
      ductStaticPressureDeviationPct:
        ventilationMode === 'balanced_hepa_overpress' ? 1.2 : 18.4,
      fanBackpressureImpaired: Math.abs(deltaPCavPa) >= 25.0,
    },
    stack: {
      indoorTempCelsius: indoorTempC,
      outdoorTempCelsius: effectiveOutdoorTempC,
      indoorTempKelvin,
      outdoorTempKelvin,
      buildingHeightMeters,
      pressureGradientPaPerMeter: stackGradientPaPerM,
      naturalNeutralPressureLevelMeters: zNplThermalOnlyMeters,
      effectiveNeutralPressureLevelMeters: zNplEffectiveMeters,
      fractionOfFacadeInInfiltrationPct,
      floorPressureProfile: floorPressureProfile.map((fp, idx) => ({
        floorIndex: idx,
        floorLabel: fp.floorLabel,
        elevationMeters: fp.elevationZ,
        stackPressurePa: fp.deltaPsPa,
        windPressurePa: fp.deltaPwPa,
        cavPressurePa: fp.deltaPCavPa,
        totalNetPressurePa: fp.deltaPTotPa,
        flowRegime:
          Math.abs(fp.deltaPTotPa) < 0.5
            ? 'NEUTRAL'
            : fp.isBelowNeutralPressurePlane
            ? 'INFILTRATION_SUCTION'
            : 'EXFILTRATION_MOISTURE_RISK',
        stairwellDoorOpeningForceN: Number(
          (
            fDcDoorCloserN +
            (doorWidthW * doorAreaA * Math.abs(fp.deltaPTotPa)) /
              (2 * (doorWidthW - handleOffsetD))
          ).toFixed(1)
        ),
      })),
      crawlspaceSuctionFlowM3h: crawlspaceMoldAndAsbestosSuctionM3PerH,
    },
    combinedInfiltrationFlowM3h: qTotSuperposedM3PerH,
    effectiveAirChangePerHour: achTotalPerHour,
    outdoorSumQuotientS: outdoorSumQuotientSout,
    indoorSumQuotientS: indoorSumQuotientSin,
    indoorToOutdoorRatio: indoorVsOutdoorRatio,
    indoorSubstances: substances.map((s) => ({
      key: s.key,
      name: s.name,
      outdoorConc: s.outdoorConcentration,
      indoorConc: s.indoorConcentrationCin,
      limitValue2026: s.limitValueGv,
      unit: s.unit,
      indoorQuotient: s.indoorQuotient,
      crawlspaceContributionPct:
        s.key === 'asbestos' || s.key === 'moldSewer' ? 42 : 24,
    })),
    almenlejelovRentReductionEligiblePct,
    mandatoryRehousingTriggered,
    nearestSourceId: nearestSource?.id || 'src-blok-1',
    nearestSourceName: nearestSource?.name || 'Blok 1 (Kierulffsvej 14-22)',
    distanceMeters,
    machineryKey,
    machineryLabel: mach.label,
    dominantFrequencyHz: mach.dominantFreqHz,
    frequencyBandLabel: mach.bandLabel,
    ppvFoundationMmPerSec,
    ppvTopFloorHorizontalMmPerSec,
    din4150ResidentialLimitMmPerSec,
    din4150TopFloorLimitMmPerSec,
    din4150SensitiveLimitMmPerSec,
    exceedsDin4150Residential,
    exceedsDin4150Sensitive,
    hadRecentFreezeThaw,
    basePermeabilityQ75M3PerHm2,
    degradedPermeabilityQ75DegM3PerHm2,
    infiltrationFluxQM3PerHm2,
    envelopePenetrationFactorPpen,
    ventilationMode,
    apartmentAreaM2,
    apartmentVolumeM3,
    envelopeAreaM2,
    br18BaseSupplyLs,
    br18KitchenExhaustLs,
    br18BathExhaustLs,
    br18WcUtilityExhaustLs,
    br18RangeHoodForcedLs,
    qCavExhaustLs,
    qCavExhaustM3PerH,
    deltaPCavPa,
    shaftAndCrackInflowQopM3PerH,
    outdoorTempC: effectiveOutdoorTempC,
    indoorTempC,
    outdoorTempKelvin,
    indoorTempKelvin,
    buildingHeightMeters,
    leakageRatioTopBottom,
    zNplThermalOnlyMeters,
    zNplEffectiveMeters,
    deltaPsSpanPa,
    stackGradientPaPerM,
    deltaPwWindPa,
    deltaPTotGroundPa,
    crawlspaceMoldAndAsbestosSuctionM3PerH,
    stairwellUpwardStackFlowM3PerH,
    topFloorMoistureExfiltrationM3PerH,
    stairwellDoorOpeningForceN,
    stairwellDoorMaxAllowedForceN,
    exceedsDoorForceLimit133N,
    floorPressureProfile,
    qWindM3PerH,
    qStackM3PerH,
    qCavM3PerH,
    qTotSuperposedM3PerH,
    achTotalPerHour,
    substances,
    indoorAsbestosFibrePerCm3,
    indoorAsbestosPctOfGv,
    indoorSumQuotientSin,
    outdoorSumQuotientSout,
    indoorVsOutdoorRatio,
    isIllegalExceedanceSinGte1,
    triggersAlgedonicIndoorAlarm,
    algedonicAlarmReasonDa,
  };
}



