import {
  INITIAL_RECEPTOR_ZONES,
  RINGPARKEN_CENTER,
  RINGPARKEN_MASTER_BUILDINGS,
} from '../data/ringparkenData';
import {
  MATERIAL_SAMPLES,
  PROTECTED_FEATURES,
  RINGPARKEN_BUILDINGS,
  getSamplesForBuilding,
} from '../constants/ringparkenData';
import {
  MaterialSample,
  ProtectedFeature,
  RingparkenBuilding,
  SubstanceCode,
  WasteClass,
} from '../types';
import {
  BuildingOperationalCategory,
  LatLngPoint,
  ReceptorZone,
  RingparkenBuildingUnit,
} from '../types/dispersion';

/**
 * Lovgivningsmæssige tærskelværdier & konstanter for Ringparken, 4200 Slagelse
 */
export const BEK_496_2024_AREA_THRESHOLD_M2 = 250;
export const BEK_1399_2021_MINERAL_WOOL_CUTOFF_YEAR = 1997;
export const LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA = 2.0;

export const BEK_613_2026_LIMITS = {
  asbestosFibersPerCm3: 0.003,
  leadMgPerM3: 0.03,
  respirableQuartzMgPerM3: 0.1,
  pcbActionNgPerM3: 300,
  pcbLimitNgPerM3: 3000,
  moldCfuPerM3: 500,
} as const;

/**
 * Deterministisk Haversine-afstand i meter mellem to WGS84-koordinater
 */
export function haversineDistanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Normaliserer dansk tekst til lokal fuzzy-søgning uden brug af nedlukkede DAWA/Dataforsyningen-API'er
 */
export function normalizeDanishSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'aa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Beregner deterministisk fuzzy-match-score (0..100) mellem dansk søgestreng og måltekst
 */
export function computeFuzzySearchScore(query: string, target: string): number {
  const nq = normalizeDanishSearchText(query);
  const nt = normalizeDanishSearchText(target);
  if (!nq) return 50;
  if (!nt) return 0;
  if (nt === nq) return 100;
  if (nt.startsWith(nq)) return 94;
  if (nt.includes(nq)) return 86;

  const queryTokens = nq.split(' ').filter(Boolean);
  const targetTokens = nt.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return 0;

  let matchedTokenSum = 0;
  for (const qt of queryTokens) {
    let bestTokenScore = 0;
    for (const tt of targetTokens) {
      if (tt === qt) {
        bestTokenScore = 1.0;
        break;
      }
      if (tt.startsWith(qt)) {
        bestTokenScore = Math.max(bestTokenScore, 0.92);
      } else if (tt.includes(qt)) {
        bestTokenScore = Math.max(bestTokenScore, 0.8);
      } else if (qt.length >= 3) {
        const dist = levenshteinDistance(qt, tt);
        const maxLen = Math.max(qt.length, tt.length);
        const sim = Math.max(0, 1 - dist / maxLen);
        if (sim >= 0.62) {
          bestTokenScore = Math.max(bestTokenScore, sim * 0.78);
        }
      }
    }
    matchedTokenSum += bestTokenScore;
  }

  return Math.round((matchedTokenSum / queryTokens.length) * 85);
}

export interface RingparkenRegistryMatch {
  id: string;
  code: string;
  name: string;
  address: string;
  kind: 'building' | 'receptor';
  category?: BuildingOperationalCategory;
  coordinates: LatLngPoint;
  distanceFromCenterMeters: number;
  fuzzyScore: number;
}

/**
 * Lokal fuzzy-søgning i Ringparkens verificerede koordinatregister (4200 Slagelse).
 * Bruger udelukkende internt geokoderegister (ingen eksterne nedlukkede danske adresseservices).
 */
export function fuzzySearchRingparkenRegistry(
  query: string,
  buildings: RingparkenBuildingUnit[] = RINGPARKEN_MASTER_BUILDINGS,
  receptors: ReceptorZone[] = INITIAL_RECEPTOR_ZONES,
  limit = 12
): RingparkenRegistryMatch[] {
  const candidates: RingparkenRegistryMatch[] = [];

  for (const b of buildings) {
    const searchable = `${b.code} ${b.name} ${b.address} ${b.department} ${b.helhedsplanEtape}`;
    const fuzzyScore = computeFuzzySearchScore(query, searchable);
    if (!query.trim() || fuzzyScore >= 32) {
      candidates.push({
        id: b.id,
        code: b.code,
        name: b.name,
        address: b.address,
        kind: 'building',
        category: b.category,
        coordinates: b.center,
        distanceFromCenterMeters: Math.round(haversineDistanceMeters(RINGPARKEN_CENTER, b.center)),
        fuzzyScore,
      });
    }
  }

  for (const r of receptors) {
    if (r.buildingUnitId) continue;
    const searchable = `${r.code} ${r.name} ${r.address} ${r.vulnerableGroupNote}`;
    const fuzzyScore = computeFuzzySearchScore(query, searchable);
    if (!query.trim() || fuzzyScore >= 32) {
      candidates.push({
        id: r.id,
        code: r.code,
        name: r.name,
        address: r.address,
        kind: 'receptor',
        coordinates: r.center,
        distanceFromCenterMeters: Math.round(haversineDistanceMeters(RINGPARKEN_CENTER, r.center)),
        fuzzyScore,
      });
    }
  }

  return candidates
    .sort((a, b) => b.fuzzyScore - a.fuzzyScore || a.distanceFromCenterMeters - b.distanceFromCenterMeters)
    .slice(0, Math.max(1, limit));
}

export interface WasteClassificationInput {
  constructionYear: number;
  asbestosDetected: boolean;
  asbestosTonnes?: number;
  mineralWoolPre1997Tonnes?: number;
  pcbMgPerKg: number;
  leadMgPerKg: number;
  pahMgPerKg: number;
  cadmiumMgPerKg?: number;
  zincMgPerKg?: number;
  grossConcreteTonnes?: number;
}

export type WasteClassificationTier =
  | 'FARLIGT_AFFALD'
  | 'FORURENET_AFFALD'
  | 'IKKE_FARLIGT_AFFALD';

export interface WasteClassificationResult {
  classification: WasteClassificationTier;
  classificationLabelDa: string;
  hp14WeightedSumPercent: number;
  hp14ThresholdQuotient: number;
  hp14ExceedsHazardousThreshold: boolean;
  bek1328AsbestosTriggered: boolean;
  bek1399MineralWoolTriggered: boolean;
  pcbThresholdTriggered: boolean;
  triggeredRulesDa: string[];
  statutoryReferences: string[];
  handlingDirectiveDa: string;
}

/**
 * Deterministisk affaldsklassificering og HP14-økotoksicitetssummering
 * iht. EU-forordning 2017/997 (HP14), BEK nr. 1328/2025 (asbest) og BEK nr. 1399/2021 (<1997 mineraluld).
 */
export function evaluateWasteAndHp14Classification(
  input: WasteClassificationInput
): WasteClassificationResult {
  const pcb = Math.max(0, input.pcbMgPerKg);
  const lead = Math.max(0, input.leadMgPerKg);
  const pah = Math.max(0, input.pahMgPerKg);
  const cadmium = Math.max(0, input.cadmiumMgPerKg ?? 0);
  const zinc = Math.max(0, input.zincMgPerKg ?? 0);
  const asbestosTonnes = Math.max(0, input.asbestosTonnes ?? 0);
  const woolTonnes = Math.max(0, input.mineralWoolPre1997Tonnes ?? 0);

  // EU 2017/997 HP14 vægtet kronisk akvatisk summering (c_i i % = mg/kg / 10.000):
  // PCB (M=100), Cadmium (M=100), Bly (M=10), PAH (M=10), Zink (M=1) mod 25 %-tærsklen
  const pcbWeightedPct = (pcb / 10_000) * 100;
  const cadmiumWeightedPct = (cadmium / 10_000) * 100;
  const leadWeightedPct = (lead / 10_000) * 10;
  const pahWeightedPct = (pah / 10_000) * 10;
  const zincWeightedPct = (zinc / 10_000) * 1;

  const hp14WeightedSumPercent = Number(
    (
      pcbWeightedPct +
      cadmiumWeightedPct +
      leadWeightedPct +
      pahWeightedPct +
      zincWeightedPct
    ).toFixed(3)
  );
  const hp14ThresholdQuotient = Number((hp14WeightedSumPercent / 25).toFixed(4));
  const hp14ExceedsHazardousThreshold = hp14WeightedSumPercent >= 25.0;

  const bek1328AsbestosTriggered = input.asbestosDetected || asbestosTonnes > 0;
  const bek1399MineralWoolTriggered =
    input.constructionYear < BEK_1399_2021_MINERAL_WOOL_CUTOFF_YEAR && woolTonnes > 0;
  const pcbThresholdTriggered = pcb >= 50; // Affaldsbekendtgørelsens grænse for PCB-farligt affald
  const heavyMetalHazardous = lead >= 1000 || cadmium >= 100 || pah >= 100;

  const triggeredRulesDa: string[] = [];
  const statutoryReferences = new Set<string>([
    'BEK nr. 496 af 21/05/2024 (Affald og selektiv nedrivning)',
  ]);

  if (bek1328AsbestosTriggered) {
    triggeredRulesDa.push(
      'Asbest påvist/forudsat — kræver autoriseret sanering og støvtæt emballering'
    );
    statutoryReferences.add('BEK nr. 1328 af 19/11/2025 (Asbest i arbejdsmiljøet)');
  }
  if (bek1399MineralWoolTriggered) {
    triggeredRulesDa.push(
      `Mineraluld fra opførelsesår ${input.constructionYear} (<1997) klassificeres som farligt affald (${woolTonnes.toFixed(1)} t)`
    );
    statutoryReferences.add(
      'BEK nr. 1399 af 25/06/2021 (Mineraluld før 1997 som farligt affald)'
    );
  }
  if (pcbThresholdTriggered) {
    triggeredRulesDa.push(
      `PCB-koncentration ${pcb.toFixed(1)} mg/kg ≥ 50 mg/kg (kræver særskilt bortrensning før knusning)`
    );
    statutoryReferences.add('Den gule PCB-vejledning (2019) & AT IN-9-3');
  }
  if (hp14ExceedsHazardousThreshold || heavyMetalHazardous) {
    triggeredRulesDa.push(
      `HP14-økotoksicitetssum ${hp14WeightedSumPercent.toFixed(2)} % (kvotient ${hp14ThresholdQuotient.toFixed(2)}) eller tungmetal-/PAH-tærskel overskredet`
    );
    statutoryReferences.add('EU-forordning 2017/997 (HP14 Økotoksisk affald)');
  }

  let classification: WasteClassificationTier = 'IKKE_FARLIGT_AFFALD';
  let classificationLabelDa = 'Ikke-farligt affald (egnet til nyttiggørelse efter kontrol)';
  let handlingDirectiveDa =
    'Materialefraktionen kan kildesorteres til dokumenteret genbrug/nyttiggørelse uden særlige farligt-affaldstillæg.';

  if (
    bek1328AsbestosTriggered ||
    bek1399MineralWoolTriggered ||
    pcbThresholdTriggered ||
    hp14ExceedsHazardousThreshold ||
    heavyMetalHazardous
  ) {
    classification = 'FARLIGT_AFFALD';
    classificationLabelDa = 'Farligt Affald (Krav om udsortering & lukket deponi/destruktion)';
    handlingDirectiveDa =
      'Skal kildesorteres separat før mekanisk nedbrydning, emballeres støvtæt og anmeldes til Slagelse Kommune med fuld sporbarhed.';
  } else if (pcb >= 0.1 || lead >= 40 || pah >= 4) {
    classification = 'FORURENET_AFFALD';
    classificationLabelDa = 'Forurenet Affald (Klasse 2–3 · Begrænset nyttiggørelse)';
    triggeredRulesDa.push(
      'Lettere forhøjet PCB (≥0,1 mg/kg), bly (≥40 mg/kg) eller PAH (≥4 mg/kg) — må ikke nyttiggøres frit som ren jord/beton.'
    );
    handlingDirectiveDa =
      'Må ikke knuses ukontrolleret på matriklen; kræver afgrænset genanvendelse eller deponering iht. anvisning fra Slagelse Kommune.';
  }

  return {
    classification,
    classificationLabelDa,
    hp14WeightedSumPercent,
    hp14ThresholdQuotient,
    hp14ExceedsHazardousThreshold,
    bek1328AsbestosTriggered,
    bek1399MineralWoolTriggered,
    pcbThresholdTriggered,
    triggeredRulesDa,
    statutoryReferences: Array.from(statutoryReferences),
    handlingDirectiveDa,
  };
}

export interface DemolitionLcaInput {
  cleanReuseConcreteTonnes: number;
  crossContaminatedConcreteTonnes: number;
  asbestosTonnes: number;
  pcbTonnes: number;
  heavyMetalPaintTonnes: number;
  mineralWoolPre1997Tonnes: number;
  affectedFloorAreaM2: number;
}

export interface DemolitionLcaResult {
  grossEmissionsKgCo2e: number;
  circularCreditKgCo2e: number;
  netEmissionsKgCo2e: number;
  netEmissionsTonnesCo2e: number;
  intensityKgCo2ePerM2: number;
  avoidedBySelectiveDemolitionKgCo2e: number;
  recyclingRatePercent: number;
}

/**
 * Deterministisk CO2e-livscyklusberegning (EN 15978 moduler C1-C4 & D)
 * baseret på reelle fysiske massestrømme i Ringparken.
 */
export function computeDemolitionCo2eKg(input: DemolitionLcaInput): DemolitionLcaResult {
  const clean = Math.max(0, input.cleanReuseConcreteTonnes);
  const cross = Math.max(0, input.crossContaminatedConcreteTonnes);
  const asbestos = Math.max(0, input.asbestosTonnes);
  const pcb = Math.max(0, input.pcbTonnes);
  const heavyMetals = Math.max(0, input.heavyMetalPaintTonnes);
  const mineralWool = Math.max(0, input.mineralWoolPre1997Tonnes);
  const areaM2 = Math.max(1, input.affectedFloorAreaM2);

  // Emissionsfaktorer (kg CO2e pr. ton håndteret fraktion):
  const grossEmissionsKgCo2e = Math.round(
    clean * 14.0 + // Selektiv nedtagning + lokal knusning/sortering
      cross * 68.0 + // Bortkørsel og deponering af krydskontamineret beton
      asbestos * 95.0 + // Lukket emballering + transport + specialdeponi
      pcb * 480.0 + // Termisk destruktion af PCB-fuger/beton
      heavyMetals * 145.0 + // Stabilisering og deponering af tungmetalaffald
      mineralWool * 110.0 // Specialdeponi af <1997 mineraluld (BEK 1399/2021)
  );

  // Modul D cirkulær erstatningskredit for ren genbrugsbeton/natursten (-52 kg CO2e/t)
  const circularCreditKgCo2e = Math.round(clean * 52.0);
  const netEmissionsKgCo2e = grossEmissionsKgCo2e - circularCreditKgCo2e;
  const netEmissionsTonnesCo2e = Number((netEmissionsKgCo2e / 1000).toFixed(1));
  const intensityKgCo2ePerM2 = Number((netEmissionsKgCo2e / areaM2).toFixed(2));

  // Sammenligning med 100% ikke-selektiv deponering af al konkret masse (68 + 52 = 120 kg CO2e/t ekstra belastning)
  const avoidedBySelectiveDemolitionKgCo2e = Math.round(clean * (68.0 - 14.0 + 52.0));

  const totalMass = clean + cross + asbestos + pcb + heavyMetals + mineralWool;
  const recyclingRatePercent =
    totalMass > 0 ? Number(((clean / totalMass) * 100).toFixed(1)) : 0;

  return {
    grossEmissionsKgCo2e,
    circularCreditKgCo2e,
    netEmissionsKgCo2e,
    netEmissionsTonnesCo2e,
    intensityKgCo2ePerM2,
    avoidedBySelectiveDemolitionKgCo2e,
    recyclingRatePercent,
  };
}

export interface ReceptorRiskScoreInput {
  sumQuotient: number;
  distanceMeters: number;
  laeqDb: number;
  precipitationMmH?: number;
  receptorCategory?: ReceptorZone['category'];
  isVulnerableInstitution?: boolean;
}

export interface ReceptorRiskScoreResult {
  score: number; // 0..100
  tier: 'KRITISK' | 'HØJ' | 'MODERAT' | 'LAV';
  tierLabelDa: string;
  sumQuotientExceeded: boolean;
  noiseThresholdExceeded: boolean;
}

/**
 * Deterministisk risikoscore (0-100) for en receptorzone ud fra Sumformel S (BEK 613/2026),
 * Haversine-afstand, akustisk støjbelastning (dB(A)) og sårbarhedskategori.
 */
export function computeDeterministicReceptorRiskScore(
  input: ReceptorRiskScoreInput
): ReceptorRiskScoreResult {
  const s = Math.max(0, input.sumQuotient);
  const dist = Math.max(5, input.distanceMeters);
  const db = Math.max(30, input.laeqDb);
  const rain = Math.max(0, input.precipitationMmH ?? 0);

  // Kemisk/fiber komponente (0..55 point)
  const chemicalComponent = Math.min(55, s * 36);
  // Afstandsnærheds-komponent (0..15 point, kraftigst inden for 150 m)
  const proximityComponent = Math.max(0, Math.min(15, (1 - Math.min(dist, 450) / 450) * 15));
  // Akustisk komponent over 55 dB(A) (0..20 point)
  const noiseComponent = db > 55 ? Math.min(20, ((db - 55) / 25) * 20) : 0;
  // Hydrologisk perkolations-komponent (0..10 point)
  const hydroComponent = rain > 0.5 ? Math.min(10, rain * 1.1) : 0;

  const vulnerabilityMultiplier = input.isVulnerableInstitution
    ? 1.12
    : input.receptorCategory === 'residential_block'
    ? 1.06
    : 1.0;

  const rawScore =
    (chemicalComponent + proximityComponent + noiseComponent + hydroComponent) *
    vulnerabilityMultiplier;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let tier: ReceptorRiskScoreResult['tier'] = 'LAV';
  let tierLabelDa = 'Lav eksponeringsrisiko';
  if (score >= 75 || s >= 1.2) {
    tier = 'KRITISK';
    tierLabelDa = 'Kritisk sundheds- & miljørisiko (Straksindgreb påkrævet)';
  } else if (score >= 50 || s >= 0.85) {
    tier = 'HØJ';
    tierLabelDa = 'Forhøjet risiko (Skærpet støv- og støjkontrol påkrævet)';
  } else if (score >= 25 || s >= 0.4) {
    tier = 'MODERAT';
    tierLabelDa = 'Moderat risiko (Løbende overvågning)';
  }

  return {
    score,
    tier,
    tierLabelDa,
    sumQuotientExceeded: s >= 1.0,
    noiseThresholdExceeded: db >= 55,
  };
}

export interface Bek496Input {
  affectedFloorAreaM2: number;
  hasStandardizedDemolitionPlan: boolean;
  hasPreDemolitionResourceMapping: boolean;
  hasCertifiedDemolitionManager: boolean;
  hasAuthorizedAsbestosContractor: boolean;
  hasSeparatePre1997MineralWoolPlan: boolean;
  municipalityNotifiedTwoWeeksPrior: boolean;
}

export interface Bek496ComplianceResult {
  selectiveDemolitionMandatory: boolean;
  thresholdAreaM2: number;
  affectedFloorAreaM2: number;
  status: 'OVERHOLDT' | 'MANGLER_DOKUMENTATION' | 'IKKE_PÅKRÆVET_UNDER_250M2';
  statusLabelDa: string;
  missingRequirementsDa: string[];
  statutoryReferences: string[];
}

/**
 * Evaluerer compliance med BEK nr. 496 af 21/05/2024 om håndtering af affald og
 * materialer fra bygge- og nedrivningsarbejde (obligatorisk selektiv nedrivning > 250 m²).
 */
export function evaluateBek496SelectiveDemolition(
  input: Bek496Input
): Bek496ComplianceResult {
  const area = Math.max(0, input.affectedFloorAreaM2);
  const selectiveDemolitionMandatory = area > BEK_496_2024_AREA_THRESHOLD_M2;

  const statutoryReferences = [
    'BEK nr. 496 af 21/05/2024 (Standardiseret nedrivningsplan & selektiv nedrivning > 250 m²)',
    'BEK nr. 1328 af 19/11/2025 (Autoriseret asbestfjernelse)',
    'BEK nr. 1399 af 25/06/2021 (Mineraluld før 1997 som farligt affald)',
  ];

  if (!selectiveDemolitionMandatory) {
    return {
      selectiveDemolitionMandatory: false,
      thresholdAreaM2: BEK_496_2024_AREA_THRESHOLD_M2,
      affectedFloorAreaM2: area,
      status: 'IKKE_PÅKRÆVET_UNDER_250M2',
      statusLabelDa: `Under 250 m²-grænsen (${area.toLocaleString('da-DK')} m²) — almindelig affaldssortering`,
      missingRequirementsDa: [],
      statutoryReferences,
    };
  }

  const missingRequirementsDa: string[] = [];
  if (!input.hasStandardizedDemolitionPlan) {
    missingRequirementsDa.push(
      'Manglende standardiseret nedrivningsplan jf. BEK nr. 496/2024 §§ 7–11'
    );
  }
  if (!input.hasPreDemolitionResourceMapping) {
    missingRequirementsDa.push(
      'Manglende fuldstændig miljø- og ressourcekortlægning før selektiv nedtagning'
    );
  }
  if (!input.hasCertifiedDemolitionManager) {
    missingRequirementsDa.push(
      'Manglende uddannet/certificeret miljø- og ressourcekoordinator tilknyttet pladsen'
    );
  }
  if (!input.hasAuthorizedAsbestosContractor) {
    missingRequirementsDa.push(
      'Manglende dokumentation for autoriseret asbestvirksomhed jf. BEK nr. 1328/2025'
    );
  }
  if (!input.hasSeparatePre1997MineralWoolPlan) {
    missingRequirementsDa.push(
      'Manglende særskilt udsorteringsprotokol for <1997 mineraluld jf. BEK nr. 1399/2021'
    );
  }
  if (!input.municipalityNotifiedTwoWeeksPrior) {
    missingRequirementsDa.push(
      'Manglende rettidig anmeldelse til Slagelse Kommune senest 2 uger før opstart'
    );
  }

  const compliant = missingRequirementsDa.length === 0;
  return {
    selectiveDemolitionMandatory: true,
    thresholdAreaM2: BEK_496_2024_AREA_THRESHOLD_M2,
    affectedFloorAreaM2: area,
    status: compliant ? 'OVERHOLDT' : 'MANGLER_DOKUMENTATION',
    statusLabelDa: compliant
      ? `BEK 496/2024 Overholdt (${area.toLocaleString('da-DK')} m² > 250 m²)`
      : `BEK 496/2024 Afvigelse: ${missingRequirementsDa.length} mangler (${area.toLocaleString('da-DK')} m²)`,
    missingRequirementsDa,
    statutoryReferences,
  };
}

export interface Lokalplan1269LarInput {
  catchmentAreaHa: number; // f.eks. 4.8 ha for Ringparken-etape eller befæstet areal
  imperviousShare: number; // 0..1 befæstelsesgrad (f.eks. 0.58)
  precipitationMmPerHour: number;
  stormDurationMinutes?: number; // standard 60 min dimensionerende regnhændelse
  availableLarDetentionM3?: number; // eksisterende regnbede/faskiner/bassiner i m³
}

export interface Lokalplan1269LarResult {
  maxAllowedRunoffLPerSecPerHa: number;
  allowedSiteRunoffLPerSec: number;
  actualSpecificRunoffLPerSecPerHa: number;
  actualTotalRunoffLPerSec: number;
  excessRunoffLPerSec: number;
  requiredDetentionVolumeM3: number;
  detentionDeficitM3: number;
  isCompliant: boolean;
  statusLabelDa: string;
  statutoryReference: string;
}

/**
 * Evaluerer regnvandsafledning og LAR-forsinkelsesbehov iht. Lokalplan 1269
 * (Ringparken, Slagelse — maksimal afledning maks. 2 l/s/ha).
 * Bruger rationel metode: 1 mm/t på 1 ha = 10.000 L / 3600 s = 2,7778 l/s/ha.
 */
export function evaluateLokalplan1269LarCompliance(
  input: Lokalplan1269LarInput
): Lokalplan1269LarResult {
  const areaHa = Math.max(0.05, input.catchmentAreaHa);
  const runoffCoeff = Math.max(0.05, Math.min(1.0, input.imperviousShare));
  const rainMmH = Math.max(0, input.precipitationMmPerHour);
  const durationSec = Math.max(300, (input.stormDurationMinutes ?? 60) * 60);
  const availableM3 = Math.max(0, input.availableLarDetentionM3 ?? 0);

  // 1 mm/t over 1 ha = 10 m³/t = 2.77778 l/s/ha
  const specificRunoffLPerSecPerHa = Number((rainMmH * 2.777778 * runoffCoeff).toFixed(2));
  const actualTotalRunoffLPerSec = Number((specificRunoffLPerSecPerHa * areaHa).toFixed(2));
  const allowedSiteRunoffLPerSec = Number(
    (LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA * areaHa).toFixed(2)
  );
  const excessRunoffLPerSec = Number(
    Math.max(0, actualTotalRunoffLPerSec - allowedSiteRunoffLPerSec).toFixed(2)
  );

  // Nødvendigt LAR-forsinkelsesvolumen (m³) = overskydende afstrømning (l/s) * varighed (s) / 1000
  const requiredDetentionVolumeM3 = Number(
    ((excessRunoffLPerSec * durationSec) / 1000).toFixed(1)
  );
  const detentionDeficitM3 = Number(
    Math.max(0, requiredDetentionVolumeM3 - availableM3).toFixed(1)
  );

  const isCompliant =
    specificRunoffLPerSecPerHa <= LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA ||
    detentionDeficitM3 <= 0;

  const statusLabelDa =
    specificRunoffLPerSecPerHa <= LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA
      ? `Lokalplan 1269 Overholdt (${specificRunoffLPerSecPerHa.toFixed(1)} ≤ 2,0 l/s/ha)`
      : detentionDeficitM3 <= 0
      ? `Lokalplan 1269 Tilbageholdt via LAR (${requiredDetentionVolumeM3.toFixed(0)} m³ bassin dækket)`
      : `Lokalplan 1269 Overskridelse: ${specificRunoffLPerSecPerHa.toFixed(1)} l/s/ha (kræver +${detentionDeficitM3.toFixed(0)} m³ LAR)`;

  return {
    maxAllowedRunoffLPerSecPerHa: LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA,
    allowedSiteRunoffLPerSec,
    actualSpecificRunoffLPerSecPerHa: specificRunoffLPerSecPerHa,
    actualTotalRunoffLPerSec,
    excessRunoffLPerSec,
    requiredDetentionVolumeM3,
    detentionDeficitM3,
    isCompliant,
    statusLabelDa,
    statutoryReference:
      'Lokalplan 1269 (Slagelse Kommune) — LAR regnvandsforsinkelse maks. 2,0 l/s/ha',
  };
}

export interface SubstanceThresholdSpec {
  code: SubstanceCode;
  labelDa: string;
  cleanMaxExclusive: number; // < cleanMaxExclusive -> Uforurenet
  hazardousThreshold: number; // >= hazardousThreshold (or > for SCCP_MCCP) -> Farligt
  hazardousStrictGreater?: boolean;
}

export const DANISH_WASTE_THRESHOLDS: Record<
  Exclude<SubstanceCode, 'ASBESTOS'>,
  SubstanceThresholdSpec
> = {
  PCB: {
    code: 'PCB',
    labelDa: 'PCB total',
    cleanMaxExclusive: 0.1,
    hazardousThreshold: 50,
  },
  SCCP_MCCP: {
    code: 'SCCP_MCCP',
    labelDa: 'SCCP/MCCP (kort-/mellemkædede klorparaffiner)',
    cleanMaxExclusive: 1000,
    hazardousThreshold: 2500,
    hazardousStrictGreater: true,
  },
  AS: {
    code: 'AS',
    labelDa: 'Arsen (As)',
    cleanMaxExclusive: 20,
    hazardousThreshold: 1000,
  },
  PB: {
    code: 'PB',
    labelDa: 'Bly (Pb)',
    cleanMaxExclusive: 40,
    hazardousThreshold: 2500,
  },
  CD: {
    code: 'CD',
    labelDa: 'Cadmium (Cd)',
    cleanMaxExclusive: 0.5,
    hazardousThreshold: 1000,
  },
  CR: {
    code: 'CR',
    labelDa: 'Chrom total (Cr)',
    cleanMaxExclusive: 500,
    hazardousThreshold: 1000,
  },
  CU: {
    code: 'CU',
    labelDa: 'Kobber (Cu)',
    cleanMaxExclusive: 500,
    hazardousThreshold: 2500,
  },
  HG: {
    code: 'HG',
    labelDa: 'Kviksølv (Hg)',
    cleanMaxExclusive: 1,
    hazardousThreshold: 2500,
  },
  NI: {
    code: 'NI',
    labelDa: 'Nikkel (Ni)',
    cleanMaxExclusive: 30,
    hazardousThreshold: 1000,
  },
  ZN: {
    code: 'ZN',
    labelDa: 'Zink (Zn)',
    cleanMaxExclusive: 500,
    hazardousThreshold: 2500,
  },
  PAH: {
    code: 'PAH',
    labelDa: 'PAH sum',
    cleanMaxExclusive: 4.0,
    hazardousThreshold: 1000,
  },
  THC: {
    code: 'THC',
    labelDa: 'Kulbrinter total (THC)',
    cleanMaxExclusive: 100,
    hazardousThreshold: 10000,
  },
};

export const SJAELLAND_PAH_SINGLE_COMPOUND_LIMITS = {
  cleanMaxExclusiveMgKg: 0.3,
  hazardousMinInclusiveMgKg: 1000,
} as const;

export const HP14_ELIGIBLE_SUBSTANCES: ReadonlyArray<
  Extract<SubstanceCode, 'PB' | 'CU' | 'ZN' | 'HG' | 'SCCP_MCCP'>
> = ['PB', 'CU', 'ZN', 'HG', 'SCCP_MCCP'];

export interface ClassifyMaterialSampleOptions {
  benzoAPyrenMgKg?: number;
  dibenzoAhAnthracenMgKg?: number;
  isWholeWrappedAsbestosPlates?: boolean;
  isPre1997MineralWool?: boolean;
  constructionYear?: number;
}

export interface MaterialSampleClassificationResult {
  sampleId: string;
  wasteClass: WasteClass;
  eakCode: string;
  eakCodes: string[];
  hp14SumMgKg: number;
  hp14ContributingParameters: Array<{ code: SubstanceCode; mgKg: number }>;
  upgradedByHp14: boolean;
  exceedanceRatio: number;
  exceedanceDetailDa: string;
  triggeredSubstances: Array<{
    code: string;
    valueMgKg: number;
    tier: WasteClass;
    ratioToHazardous: number;
  }>;
  safetyRequirements2026: string[];
  statutoryReferences: string[];
  reasonsDa: string[];
}

function extractBenzoAPyrenFromText(text: string): number | undefined {
  const match = text.match(/benzo\(a\)pyren\s+([\d.]+)\s*mg\/kg/i);
  if (!match) return undefined;
  const normalized = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : undefined;
}

function extractDibenzoAhFromText(text: string): number | undefined {
  const match = text.match(/dibenzo\(a,h\)anthracen\s+([\d.]+)\s*mg\/kg/i);
  if (!match) return undefined;
  const normalized = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : undefined;
}

/**
 * 100 % deterministisk dansk affaldsklassificering, HP14-summering (EU 2017/997),
 * Sjællandsnetværkets trinvise PAH-vurdering, BEK 1399/2021 (<1997 mineraluld)
 * og lovpligtige 2026-arbejdsmiljøkrav (BEK 1328/2025, BEK 613/2026, IN-9-3).
 */
export function classifyMaterialSample(
  sample: MaterialSample,
  options: ClassifyMaterialSampleOptions = {}
): MaterialSampleClassificationResult {
  const c = sample.concentrationsMgKg;
  const combinedText = `${sample.material} ${sample.wholeElementDowngradedNote ?? ''}`;
  const lowerText = combinedText.toLowerCase();

  let hasHazardousSingle = false;
  let hasContaminatedSingle = false;
  let maxRatio = 0;
  let maxRatioLabelDa = 'Ingen grænseværdioverskridelse';

  const triggeredSubstances: MaterialSampleClassificationResult['triggeredSubstances'] = [];
  const reasonsDa: string[] = [];
  const safetyRequirements2026 = new Set<string>();
  const statutoryReferences = new Set<string>([
    'BEK nr. 496 af 21/05/2024 (Affald og selektiv nedrivning)',
  ]);
  const eakCodes = new Set<string>();

  // 1. Enkeltstofgrænser (mg/kg)
  (Object.keys(DANISH_WASTE_THRESHOLDS) as Array<keyof typeof DANISH_WASTE_THRESHOLDS>).forEach(
    (code) => {
      const value = c[code];
      if (value === undefined || value === null || !Number.isFinite(value)) return;
      const spec = DANISH_WASTE_THRESHOLDS[code];
      const isHazardous = spec.hazardousStrictGreater
        ? value > spec.hazardousThreshold
        : value >= spec.hazardousThreshold;
      const isContaminated = !isHazardous && value >= spec.cleanMaxExclusive;
      const ratio = value / spec.hazardousThreshold;

      if (ratio > maxRatio) {
        maxRatio = ratio;
        maxRatioLabelDa = `${spec.labelDa}: ${value.toLocaleString('da-DK')} / ${spec.hazardousThreshold.toLocaleString('da-DK')} mg/kg (${ratio.toFixed(1)}x)`;
      }

      const tier: WasteClass = isHazardous
        ? 'Farligt affald'
        : isContaminated
        ? 'Forurenet affald'
        : 'Uforurenet affald';

      if (isHazardous || isContaminated) {
        triggeredSubstances.push({
          code,
          valueMgKg: value,
          tier,
          ratioToHazardous: Number(ratio.toFixed(3)),
        });
      }

      if (isHazardous) {
        hasHazardousSingle = true;
        reasonsDa.push(
          `${spec.labelDa} = ${value.toLocaleString('da-DK')} mg/kg overskrider grænsen for Farligt affald (${spec.hazardousStrictGreater ? '>' : '≥'} ${spec.hazardousThreshold.toLocaleString('da-DK')} mg/kg).`
        );
      } else if (isContaminated) {
        hasContaminatedSingle = true;
        reasonsDa.push(
          `${spec.labelDa} = ${value.toLocaleString('da-DK')} mg/kg ligger i kategorien Forurenet affald (≥ ${spec.cleanMaxExclusive.toLocaleString('da-DK')} mg/kg).`
        );
      }
    }
  );

  // 2. Sjællandsnetværkets trinvise PAH-enkeltstofvurdering (Benzo(a)pyren & Dibenzo(a,h)anthracen)
  const bapMgKg =
    options.benzoAPyrenMgKg ?? extractBenzoAPyrenFromText(combinedText);
  const dbaMgKg =
    options.dibenzoAhAnthracenMgKg ?? extractDibenzoAhFromText(combinedText);

  const singlePahChecks: Array<{ label: string; value?: number }> = [
    { label: 'Benzo(a)pyren', value: bapMgKg },
    { label: 'Dibenzo(a,h)anthracen', value: dbaMgKg },
  ];
  for (const item of singlePahChecks) {
    if (item.value === undefined || !Number.isFinite(item.value)) continue;
    const ratio = item.value / SJAELLAND_PAH_SINGLE_COMPOUND_LIMITS.hazardousMinInclusiveMgKg;
    if (ratio > maxRatio) {
      maxRatio = ratio;
      maxRatioLabelDa = `${item.label}: ${item.value.toLocaleString('da-DK')} / 1.000 mg/kg (${ratio.toFixed(1)}x)`;
    }
    if (item.value >= SJAELLAND_PAH_SINGLE_COMPOUND_LIMITS.hazardousMinInclusiveMgKg) {
      hasHazardousSingle = true;
      triggeredSubstances.push({
        code: item.label,
        valueMgKg: item.value,
        tier: 'Farligt affald',
        ratioToHazardous: Number(ratio.toFixed(3)),
      });
      reasonsDa.push(
        `Sjællandsnetværket trinvis PAH-vurdering: ${item.label} = ${item.value.toLocaleString('da-DK')} mg/kg ≥ 1.000 mg/kg -> Farligt affald.`
      );
      statutoryReferences.add('Sjællandsnetværket: Trinvis vurdering af PAH og kulbrinter');
    } else if (item.value >= SJAELLAND_PAH_SINGLE_COMPOUND_LIMITS.cleanMaxExclusiveMgKg) {
      hasContaminatedSingle = true;
      triggeredSubstances.push({
        code: item.label,
        valueMgKg: item.value,
        tier: 'Forurenet affald',
        ratioToHazardous: Number(ratio.toFixed(3)),
      });
      reasonsDa.push(
        `Sjællandsnetværket trinvis PAH-vurdering: ${item.label} = ${item.value.toLocaleString('da-DK')} mg/kg ≥ 0,3 mg/kg -> Forurenet affald.`
      );
      statutoryReferences.add('Sjællandsnetværket: Trinvis vurdering af PAH og kulbrinter');
    }
  }

  // 3. Asbest & EAK-koder + BEK nr. 1328 af 19.11.2025
  if (sample.asbestosDetected) {
    hasHazardousSingle = true;
    const isKiselgurOrPipeInsulation =
      lowerText.includes('kiselgur') || lowerText.includes('isolering');
    const isWholeWrappedPlates =
      Boolean(options.isWholeWrappedAsbestosPlates) ||
      ((lowerText.includes('eternit') || lowerText.includes('plade')) &&
        sample.dustIntensity === 'Ingen');

    if (isKiselgurOrPipeInsulation) {
      eakCodes.add('17 06 01*');
      eakCodes.add('17 06 06*');
    } else if (isWholeWrappedPlates) {
      eakCodes.add('17 06 05');
    } else {
      eakCodes.add('17 06 06*');
    }

    if (maxRatio < 1) {
      maxRatio = 1;
      maxRatioLabelDa = `Asbest påvist (${sample.asbestosTypes.join(', ') || 'Ukendt fiber'})`;
    }

    reasonsDa.push(
      `Asbest påvist (${sample.asbestosTypes.join(', ') || 'Ukendt type'}; støvintensitet: ${sample.dustIntensity}) -> Farligt affald (EAK ${Array.from(eakCodes).join(' / ')}).`
    );

    statutoryReferences.add('BEK nr. 1328 af 19/11/2025 (Asbest i arbejdsmiljøet)');
    safetyRequirements2026.add(
      'Virksomhedsautorisation fra Sikkerhedsstyrelsen samt gyldigt 4-dages AMU-kursusbevis (obligatorisk fra 21.12.2025 jf. BEK nr. 1328 af 19.11.2025).'
    );
    safetyRequirements2026.add(
      'AT-anmeldelse til Arbejdstilsynet senest 3 dage før opstart; luftgrænseværdi 0,003 fibre/cm³.'
    );
    safetyRequirements2026.add(
      'Etablering af støvtæt inddækning/telt med 3-kammer luftsluse, konstant undertryk og H-klasse HEPA-afkast til det fri.'
    );
    safetyRequirements2026.add(
      'Maks. 4 timers dagligt nedrivningsarbejde med luftforsynet/turbomaske (obligatorisk pause senest hver 2. time).'
    );
    safetyRequirements2026.add(
      'Totalforbud mod højtryksspuling af asbestholdige materialer (alle dispensationer bortfaldet pr. 01.07.2026).'
    );
  }

  // 4. Syntetiske mineralfibre før 1997 (BEK nr. 1399 af 25/06/2021)
  const isMineralWoolSample =
    Boolean(options.isPre1997MineralWool) ||
    ((lowerText.includes('mineraluld') ||
      lowerText.includes('stenuld') ||
      lowerText.includes('glasuld')) &&
      ((options.constructionYear !== undefined && options.constructionYear < 1997) ||
        lowerText.includes('1997') ||
        lowerText.includes('tagrum') ||
        lowerText.includes('tekniske installationer')));

  if (isMineralWoolSample) {
    hasHazardousSingle = true;
    eakCodes.add('17 06 03*');
    if (maxRatio < 1) {
      maxRatio = 1;
      maxRatioLabelDa = 'Syntetiske mineralfibre < 1997 (BEK nr. 1399/2021)';
    }
    reasonsDa.push(
      'Syntetiske mineralfibre/mineraluld fra før 1997 i tagrum eller omkring tekniske installationer klassificeres som farligt affald jf. BEK nr. 1399 af 25/06/2021.'
    );
    statutoryReferences.add(
      'BEK nr. 1399 af 25/06/2021 (Syntetiske mineralfibre før 1997 som farligt affald)'
    );
    safetyRequirements2026.add(
      'Mineraluld < 1997 (BEK nr. 1399 af 25/06/2021): Særskilt støvdæmpet nedtagning i lukkede poser, P2/P3-åndedrætsværn og engangsdragt.'
    );
  }

  // 5. HP14-summeringsregel (EU-forordning 2017/997)
  const hp14ContributingParameters: Array<{ code: SubstanceCode; mgKg: number }> = [];
  let computedHp14Sum = 0;
  for (const code of HP14_ELIGIBLE_SUBSTANCES) {
    const val = c[code];
    if (val !== undefined && Number.isFinite(val) && val >= 1000) {
      hp14ContributingParameters.push({ code, mgKg: val });
      computedHp14Sum += val;
    }
  }

  const hp14SumMgKg =
    sample.reportedHp14SumMgKg !== null && sample.reportedHp14SumMgKg !== undefined
      ? sample.reportedHp14SumMgKg
      : computedHp14Sum;

  const hp14Triggered = hp14SumMgKg > 2500;
  const upgradedByHp14 = hp14Triggered && !hasHazardousSingle;

  if (hp14Triggered) {
    const hp14Ratio = hp14SumMgKg / 2500;
    if (hp14Ratio > maxRatio) {
      maxRatio = hp14Ratio;
      maxRatioLabelDa = `HP14-sum: ${hp14SumMgKg.toLocaleString('da-DK')} / 2.500 mg/kg (${hp14Ratio.toFixed(2)}x)`;
    }
    statutoryReferences.add('EU-forordning 2017/997 (HP14 Økotoksisk affald)');
    reasonsDa.push(
      upgradedByHp14
        ? `Opklassificeret til Farligt affald via HP14-summeringsregel (sum = ${hp14SumMgKg.toLocaleString('da-DK')} mg/kg > 2.500 mg/kg), selvom intet enkeltstof alene overskred farlighedsgrænsen.`
        : `HP14-økotoksicitetssum = ${hp14SumMgKg.toLocaleString('da-DK')} mg/kg > 2.500 mg/kg (supplerer enkeltstof-overskridelse).`
    );
  }

  // 6. Kemiske arbejdsmiljøkrav (2026-regler) for PCB/SCCP_MCCP og Bly
  const pcbVal = c.PCB ?? 0;
  const mccpVal = c.SCCP_MCCP ?? 0;
  const pbVal = c.PB ?? 0;

  if (pcbVal >= 50 || mccpVal > 2500) {
    statutoryReferences.add('Arbejdstilsynets IN-9-3 / "Den gule" PCB-vejledning');
    safetyRequirements2026.add(
      'PCB ≥ 50 mg/kg / SCCP_MCCP > 2.500 mg/kg: Følg IN-9-3 / "Den gule" PCB-vejledning med kombinationsfilter A2P3 eller friskluftforsynet maske, kemikaliehandsker, heldragt type 4/5 og effektivt procesudsug.'
    );
  }

  if (pbVal >= 40) {
    statutoryReferences.add('BEK nr. 613 pr. 01/07/2026 (Skærpet blygrænseværdi)');
    safetyRequirements2026.add(
      'Bly ≥ 40 mg/kg (BEK nr. 613 pr. 01.07.2026): Skærpet luftgrænseværdi 0,03 mg Pb/m³; arbejdsmedicinsk helbredsundersøgelse/blodprøve ved > 0,015 mg Pb/m³ i luft eller > 4,5 µg Pb/100 ml blod for kvinder i fødedygtig alder (> 9 µg Pb/100 ml generelt; biologisk grænseværdi 20 µg Pb/100 ml).'
    );
  }

  // 7. Samlet klassifikation & EAK-fallback
  let wasteClass: WasteClass = 'Uforurenet affald';
  if (hasHazardousSingle || hp14Triggered) {
    wasteClass = 'Farligt affald';
    if (eakCodes.size === 0) {
      eakCodes.add('17 09 03*');
    }
  } else if (hasContaminatedSingle) {
    wasteClass = 'Forurenet affald';
    eakCodes.add('17 09 04');
  } else {
    eakCodes.add('17 01 07');
  }

  const eakList = Array.from(eakCodes);

  return {
    sampleId: sample.id,
    wasteClass,
    eakCode: eakList[0],
    eakCodes: eakList,
    hp14SumMgKg,
    hp14ContributingParameters,
    upgradedByHp14,
    exceedanceRatio: Number(maxRatio.toFixed(2)),
    exceedanceDetailDa: maxRatioLabelDa,
    triggeredSubstances,
    safetyRequirements2026: Array.from(safetyRequirements2026),
    statutoryReferences: Array.from(statutoryReferences),
    reasonsDa: Array.from(new Set(reasonsDa)),
  };
}

export interface DistanceAndBearingResult {
  distanceMeters: number;
  bearingDeg: number;
  compassDirectionDa: string;
}

const COMPASS_POINTS_DA = [
  'N',
  'NNØ',
  'NØ',
  'ØNØ',
  'Ø',
  'ØSØ',
  'SØ',
  'SSØ',
  'S',
  'SSV',
  'SV',
  'VSV',
  'V',
  'VNV',
  'NV',
  'NNV',
] as const;

/**
 * Præcis Haversine-afstand i meter samt kompasretning i grader (0-360°).
 */
export function calculateDistanceAndBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): DistanceAndBearingResult {
  const distanceMeters = haversineDistanceMeters(
    { lat: lat1, lng: lng1 },
    { lat: lat2, lng: lng2 }
  );

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lng2 - lng1);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  const rawBearing = (Math.atan2(y, x) * 180) / Math.PI;
  const bearingDeg =
    distanceMeters === 0 ? 0 : Number((((rawBearing % 360) + 360) % 360).toFixed(2));
  const compassIdx = Math.round(bearingDeg / 22.5) % 16;

  return {
    distanceMeters: Number(distanceMeters.toFixed(2)),
    bearingDeg,
    compassDirectionDa: COMPASS_POINTS_DA[compassIdx],
  };
}

export interface ReceptorExposureResultDetails {
  receptorId: string;
  nearestSourceId: string | null;
  nearestSourceName: string | null;
  minDistM: number;
  bearingFromSourceToReceptorDeg: number;
  downwindDirectionDeg: number;
  downwindFactor: number;
  proximityScore: number;
  windPlumeScore: number;
  envelopeInfiltrationScore: number;
  internalBurdenScore: number;
  receptorRiskScore: number;
  riskLevel: 'KRITISK' | 'HØJ' | 'MODERAT' | 'LAV';
  recommendationsDa: string[];
}

/**
 * Deterministisk beregning af vindafhængig spredning og bygningsfysisk receptor-eksponering (0-100).
 */
export function calculateReceptorExposure(
  receptor: RingparkenBuilding,
  activeSources: RingparkenBuilding[],
  windFromDeg: number,
  windSpeedMs: number,
  isDryWeather: boolean
): ReceptorExposureResultDetails {
  const downwindDirectionDeg = ((windFromDeg + 180) % 360 + 360) % 360;

  let nearestSource: RingparkenBuilding | null = null;
  let minDistM = Number.POSITIVE_INFINITY;
  let bearingFromSourceToReceptorDeg = 0;

  for (const src of activeSources) {
    if (src.id === receptor.id) continue;
    const vec = calculateDistanceAndBearing(
      src.coordinates.lat,
      src.coordinates.lng,
      receptor.coordinates.lat,
      receptor.coordinates.lng
    );
    if (vec.distanceMeters < minDistM) {
      minDistM = vec.distanceMeters;
      nearestSource = src;
      bearingFromSourceToReceptorDeg = vec.bearingDeg;
    }
  }

  let downwindFactor = 0;
  let proximityScore = 0;
  let windPlumeScore = 0;

  if (nearestSource && Number.isFinite(minDistM)) {
    const angularDiff = Math.abs(
      ((bearingFromSourceToReceptorDeg - downwindDirectionDeg + 540) % 360) - 180
    );
    const coneWeight =
      angularDiff <= 45 ? Math.cos((angularDiff / 45) * (Math.PI / 2)) : 0;
    const speedScale = Math.min(1, Math.max(0, windSpeedMs) / 8);
    const moistureMultiplier = isDryWeather ? 1 : 0.4; // 60 % reduktion ved regn/våd støvdæmpning

    downwindFactor = Math.max(
      0,
      Math.min(1, Number((coneWeight * speedScale * moistureMultiplier).toFixed(4)))
    );

    proximityScore = 40 * Math.exp(-Math.max(0, minDistM - 35) / 180);
    windPlumeScore = 25 * downwindFactor * Math.exp(-minDistM / 350);
  } else {
    minDistM = 0;
  }

  const envelopeInfiltrationScore =
    (receptor.hasCavNegativePressure ? 8 : 2) +
    12 * (Math.max(0, Math.min(100, receptor.cowiJointFailurePct)) / 100);
  const internalBurdenScore = receptor.hasBasementAsbestosDust ? 15 : 4;

  const rawTotal =
    proximityScore + windPlumeScore + envelopeInfiltrationScore + internalBurdenScore;
  const receptorRiskScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

  let riskLevel: ReceptorExposureResultDetails['riskLevel'] = 'LAV';
  if (receptorRiskScore >= 75) riskLevel = 'KRITISK';
  else if (receptorRiskScore >= 50) riskLevel = 'HØJ';
  else if (receptorRiskScore >= 25) riskLevel = 'MODERAT';

  const recommendationsDa: string[] = [];
  if (nearestSource && minDistM <= 65) {
    recommendationsDa.push(
      `Kort sikkerhedsafstand (${Math.round(minDistM)} m fra ${nearestSource.name}): Etabler støvvæg, spær nærliggende gangstier og intensiver vandforstøvning.`
    );
  }
  if (downwindFactor >= 0.45 && isDryWeather) {
    recommendationsDa.push(
      `Bygningen ligger direkte i vindretningen (${Math.round(downwindDirectionDeg)}° i læ af kilden) i tørt vejr: Påbud øjeblikkelig våd støvdæmpning eller midlertidigt arbejdsstop ved vindstød.`
    );
  }
  if (receptor.hasCavNegativePressure && receptor.cowiJointFailurePct >= 40) {
    recommendationsDa.push(
      `CAV-undertryk uden varmegenvinding kombineret med ${receptor.cowiJointFailurePct} % nedbrudte facade-/vinduesfuger (COWI 2021): Indstil mekanisk udsugning under støvende aktiviteter og luk udeluftventiler mod nedrivningsfeltet.`
    );
  }
  if (receptor.hasBasementAsbestosDust) {
    recommendationsDa.push(
      'Konstateret asbeststøv i kælder: Oprethold låst adgangsbegrænsning, HEPA-støvsugning og spær for intern luftopdrift til beboede opgange.'
    );
  }
  if (recommendationsDa.length === 0) {
    recommendationsDa.push(
      'Fortsæt rutinemæssig støv-, støj- og vindovervågning samt kontrol af lukkede vinduer i arbejdsperioden.'
    );
  }

  return {
    receptorId: receptor.id,
    nearestSourceId: nearestSource?.id ?? null,
    nearestSourceName: nearestSource?.name ?? null,
    minDistM: Number(minDistM.toFixed(1)),
    bearingFromSourceToReceptorDeg,
    downwindDirectionDeg,
    downwindFactor,
    proximityScore: Number(proximityScore.toFixed(2)),
    windPlumeScore: Number(windPlumeScore.toFixed(2)),
    envelopeInfiltrationScore: Number(envelopeInfiltrationScore.toFixed(2)),
    internalBurdenScore,
    receptorRiskScore,
    riskLevel,
    recommendationsDa,
  };
}

export interface WorkHoursCheckOptions {
  timeZone?: string;
  isPublicHoliday?: boolean;
}

export interface WorkHoursComplianceResult {
  isAllowed: boolean;
  dayType: 'HVERDAG' | 'LØRDAG' | 'SØN_ELLER_HELLIGDAG';
  localHour: number;
  localMinute: number;
  allowedWindowLabelDa: string;
  maxBoundaryNoiseDbA: number;
  internalPssLimitDbA: number;
  heavyBreakingNoticeWorkdays: number;
  statusLabelDa: string;
  directiveDa: string;
  statutoryReference: string;
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isDanishPublicHoliday(year: number, month1To12: number, day: number): boolean {
  const fixedHolidays = new Set([
    '1-1', // Nytårsdag
    '12-25', // 1. juledag
    '12-26', // 2. juledag
  ]);
  if (fixedHolidays.has(`${month1To12}-${day}`)) return true;

  const easterUtc = getEasterSunday(year);
  const movableOffsetsDays = [-3, -2, 0, 1, 39, 49, 50]; // Skærtorsdag, Langfredag, Påske, 2. påskedag, Kr. Himmelfart, Pinse, 2. pinsedag
  for (const offset of movableOffsetsDays) {
    const d = new Date(easterUtc.getTime() + offset * 86_400_000);
    if (d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month1To12 && d.getUTCDate() === day) {
      return true;
    }
  }
  return false;
}

/**
 * Validerer tidspunkt mod nedrivningstilladelsen og Slagelse Kommunes forskrift:
 * - Ma-Fr kl. 07:00-18:00 (maks. 70 dB(A) i skel)
 * - Lørdage kl. 07:00-14:00 (maks. 64 dB(A) i skel)
 * - Søn- og helligdage: Arbejdsforbud
 * - Intern PSS-grænse: 80 dB samt 5 arbejdsdages varsel ved diamantskæring/opbrydningshammer
 */
export function checkWorkHoursCompliance(
  date: Date,
  options: WorkHoursCheckOptions = {}
): WorkHoursComplianceResult {
  let dayOfWeek = date.getDay();
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let dayOfMonth = date.getDate();
  let hour = date.getHours();
  let minute = date.getMinutes();

  if (options.timeZone) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: options.timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    dayOfWeek = weekdayMap[map.weekday] ?? dayOfWeek;
    year = Number(map.year) || year;
    month = Number(map.month) || month;
    dayOfMonth = Number(map.day) || dayOfMonth;
    hour = Number(map.hour) % 24;
    minute = Number(map.minute) || 0;
  }

  const isHoliday =
    options.isPublicHoliday ?? isDanishPublicHoliday(year, month, dayOfMonth);

  const internalPssLimitDbA = 80;
  const heavyBreakingNoticeWorkdays = 5;
  const statutoryReference =
    'Slagelse Kommunes forskrift for bygge- og anlægsaktiviteter samt Wissenberg PSS W22085';

  if (dayOfWeek === 0 || isHoliday) {
    return {
      isAllowed: false,
      dayType: 'SØN_ELLER_HELLIGDAG',
      localHour: hour,
      localMinute: minute,
      allowedWindowLabelDa: 'Forbudt på søn- og helligdage',
      maxBoundaryNoiseDbA: 0,
      internalPssLimitDbA,
      heavyBreakingNoticeWorkdays,
      statusLabelDa: 'ARBEJDSFORBUD (Søn-/helligdag)',
      directiveDa:
        'Støjende nedrivnings- og entreprenørarbejde er strengt forbudt på søn- og helligdage jf. Slagelse Kommunes forskrift.',
      statutoryReference,
    };
  }

  const timeDecimal = hour + minute / 60;

  if (dayOfWeek === 6) {
    const inSatWindow = timeDecimal >= 7 && timeDecimal < 14;
    return {
      isAllowed: inSatWindow,
      dayType: 'LØRDAG',
      localHour: hour,
      localMinute: minute,
      allowedWindowLabelDa: 'Lørdag kl. 07:00–14:00 (maks. 64 dB(A) i skel)',
      maxBoundaryNoiseDbA: inSatWindow ? 64 : 0,
      internalPssLimitDbA,
      heavyBreakingNoticeWorkdays,
      statusLabelDa: inSatWindow
        ? 'TILLADT LØRDAGSVINDUE (Maks. 64 dB(A) i skel)'
        : 'UDEN FOR LØRDAGSARBEJDSTID (Forbudt efter kl. 14:00 / før 07:00)',
      directiveDa: inSatWindow
        ? 'Arbejde tilladt kl. 07:00–14:00 med maksimalt 64 dB(A) i skel. Intern PSS-grænse er 80 dB; diamantskæring/opbrydningshammer kræver 5 arbejdsdages forudgående varsel.'
        : 'Støjende arbejder er forbudt lørdag før kl. 07:00 og efter kl. 14:00 jf. Slagelse Kommunes forskrift.',
      statutoryReference,
    };
  }

  const inWeekdayWindow = timeDecimal >= 7 && timeDecimal < 18;
  return {
    isAllowed: inWeekdayWindow,
    dayType: 'HVERDAG',
    localHour: hour,
    localMinute: minute,
    allowedWindowLabelDa: 'Hverdage ma–fr kl. 07:00–18:00 (maks. 70 dB(A) i skel)',
    maxBoundaryNoiseDbA: inWeekdayWindow ? 70 : 0,
    internalPssLimitDbA,
    heavyBreakingNoticeWorkdays,
    statusLabelDa: inWeekdayWindow
      ? 'TILLADT HVERDAGSVINDUE (Maks. 70 dB(A) i skel)'
      : 'UDEN FOR HVERDAGSARBEJDSTID (Forbudt før 07:00 / efter 18:00)',
    directiveDa: inWeekdayWindow
      ? 'Arbejde tilladt kl. 07:00–18:00 med maksimalt 70 dB(A) i skel og intern PSS-grænse på 80 dB. Diamantskæring/opbrydningshammer kræver minimum 5 arbejdsdages varsel.'
      : 'Støjende arbejder er forbudt på hverdage uden for tidsrummet kl. 07:00–18:00 jf. nedrivningstilladelsen og Slagelse Kommunes forskrift.',
    statutoryReference,
  };
}

export interface CanonicalSampleClassificationResult {
  sampleId: string;
  wasteClass: WasteClass;
  hp14WeightedSumPercent: number;
  reportedHp14SumMgKg: number | null;
  reasonsDa: string[];
  requiresSpecialAsbestosHandling: boolean;
}

/**
 * Bagudkompatibel wrapper omkring `classifyMaterialSample` til bygningsoversigter.
 */
export function classifyCanonicalMaterialSample(
  sample: MaterialSample,
  constructionYear = 1971
): CanonicalSampleClassificationResult {
  const res = classifyMaterialSample(sample, { constructionYear });
  const c = sample.concentrationsMgKg;
  const baseEval = evaluateWasteAndHp14Classification({
    constructionYear,
    asbestosDetected: sample.asbestosDetected,
    pcbMgPerKg: c.PCB ?? 0,
    leadMgPerKg: c.PB ?? 0,
    pahMgPerKg: c.PAH ?? 0,
    cadmiumMgPerKg: c.CD ?? 0,
    zincMgPerKg: c.ZN ?? 0,
  });

  return {
    sampleId: res.sampleId,
    wasteClass: res.wasteClass,
    hp14WeightedSumPercent: baseEval.hp14WeightedSumPercent,
    reportedHp14SumMgKg: sample.reportedHp14SumMgKg,
    reasonsDa: res.reasonsDa,
    requiresSpecialAsbestosHandling: sample.asbestosDetected,
  };
}

export interface CanonicalBuildingComplianceSummary {
  buildingId: string;
  sampleCount: number;
  hazardousSampleCount: number;
  contaminatedSampleCount: number;
  asbestosSampleCount: number;
  requiresSelectiveDemolitionPlan: boolean;
  cavNegativePressureStackRisk: boolean;
  highestWasteClass: WasteClass;
}

/**
 * Evaluerer en kanonisk `RingparkenBuilding` deterministisk mod BEK 496/2024,
 * BEK 1328/2025 og bygningens tilknyttede laboratorieprøver i `MATERIAL_SAMPLES`.
 */
export function evaluateCanonicalBuildingCompliance(
  building: RingparkenBuilding,
  samples: MaterialSample[] = MATERIAL_SAMPLES
): CanonicalBuildingComplianceSummary {
  const linkedSamples =
    samples === MATERIAL_SAMPLES
      ? getSamplesForBuilding(building.id)
      : samples.filter((s) => s.buildingId === building.id);

  let hazardousSampleCount = 0;
  let contaminatedSampleCount = 0;
  let asbestosSampleCount = 0;

  for (const s of linkedSamples) {
    const res = classifyCanonicalMaterialSample(s);
    if (res.wasteClass === 'Farligt affald') hazardousSampleCount += 1;
    else if (res.wasteClass === 'Forurenet affald') contaminatedSampleCount += 1;
    if (s.asbestosDetected) asbestosSampleCount += 1;
  }

  const isDemolitionStage =
    building.stage === 'Aktiv nedrivning (2026)' ||
    building.stage === 'Planlagt nedrivning (Etape 2/3)';
  const requiresSelectiveDemolitionPlan =
    building.requiresSelectiveDemolitionPlan ||
    (isDemolitionStage && (building.areaM2 ?? 0) > BEK_496_2024_AREA_THRESHOLD_M2);

  const highestWasteClass: WasteClass =
    hazardousSampleCount > 0
      ? 'Farligt affald'
      : contaminatedSampleCount > 0
      ? 'Forurenet affald'
      : 'Uforurenet affald';

  return {
    buildingId: building.id,
    sampleCount: linkedSamples.length,
    hazardousSampleCount,
    contaminatedSampleCount,
    asbestosSampleCount,
    requiresSelectiveDemolitionPlan,
    cavNegativePressureStackRisk:
      building.hasCavNegativePressure && building.hasBasementAsbestosDust,
    highestWasteClass,
  };
}

export interface CanonicalRegistrySearchMatch {
  id: string;
  kind: 'building' | 'protected_feature';
  title: string;
  subtitle: string;
  coordinates: LatLngPoint;
  distanceFromCenterMeters: number;
  fuzzyScore: number;
}

/**
 * Lokal fuzzy-søgning på tværs af det nye kanoniske datasæt (`RINGPARKEN_BUILDINGS` & `PROTECTED_FEATURES`)
 * uden eksterne kald til nedlukkede danske adresseservices.
 */
export function fuzzySearchCanonicalRingparken(
  query: string,
  buildings: RingparkenBuilding[] = RINGPARKEN_BUILDINGS,
  protectedFeatures: ProtectedFeature[] = PROTECTED_FEATURES,
  limit = 12
): CanonicalRegistrySearchMatch[] {
  const results: CanonicalRegistrySearchMatch[] = [];

  for (const b of buildings) {
    const searchable = [
      b.name,
      b.fobDepartment,
      b.fobBlockNumber !== null ? `FOB Blok ${b.fobBlockNumber}` : '',
      b.dmaBlockNumber !== null ? `DMA Blok ${b.dmaBlockNumber}` : '',
      ...b.canonicalAddresses,
      b.permitCaseNumber ?? '',
      b.hydrologyNote ?? '',
    ].join(' ');
    const fuzzyScore = computeFuzzySearchScore(query, searchable);
    if (!query.trim() || fuzzyScore >= 30) {
      results.push({
        id: b.id,
        kind: 'building',
        title: b.name,
        subtitle: `${b.canonicalAddresses[0] ?? b.name} · ${b.stage}`,
        coordinates: { lat: b.coordinates.lat, lng: b.coordinates.lng },
        distanceFromCenterMeters: Math.round(
          haversineDistanceMeters(RINGPARKEN_CENTER, {
            lat: b.coordinates.lat,
            lng: b.coordinates.lng,
          })
        ),
        fuzzyScore,
      });
    }
  }

  for (const pf of protectedFeatures) {
    const searchable = `${pf.title} ${pf.category} ${pf.locationDescription} ${pf.statutoryBasis}`;
    const fuzzyScore = computeFuzzySearchScore(query, searchable);
    if (!query.trim() || fuzzyScore >= 30) {
      results.push({
        id: pf.id,
        kind: 'protected_feature',
        title: pf.title,
        subtitle: `${pf.category} · ${pf.statutoryBasis}`,
        coordinates: { lat: pf.coordinates.lat, lng: pf.coordinates.lng },
        distanceFromCenterMeters: Math.round(
          haversineDistanceMeters(RINGPARKEN_CENTER, {
            lat: pf.coordinates.lat,
            lng: pf.coordinates.lng,
          })
        ),
        fuzzyScore,
      });
    }
  }

  return results
    .sort(
      (a, b) =>
        b.fuzzyScore - a.fuzzyScore ||
        a.distanceFromCenterMeters - b.distanceFromCenterMeters
    )
    .slice(0, Math.max(1, limit));
}
