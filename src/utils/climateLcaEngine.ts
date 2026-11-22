export interface DemolitionScopeProfile {
  id: 'etape1_erhverv' | 'blok1_aktiv' | 'etape1_3_fuld';
  labelDa: string;
  descriptionDa: string;
  commercialAreaM2: number;
  residentialUnits: number;
  residentialAreaM2: number;
  totalAreaM2: number;
  concreteTonnesAvailable: number;
  highRiskBuildingsIncluded: string[];
}

export const RINGPARKEN_DEMOLITION_SCOPES: Record<
  DemolitionScopeProfile['id'],
  DemolitionScopeProfile
> = {
  etape1_erhverv: {
    id: 'etape1_erhverv',
    labelDa: 'Etape 1: Erhverv & Institutioner (1.959 m²)',
    descriptionDa:
      'Kierulffsvej 2 (387 m² stue), Kierulffsvej 12 (798 m²) og Valbyvej 58 (774 m²) ekskl. kældre.',
    commercialAreaM2: 1959,
    residentialUnits: 0,
    residentialAreaM2: 0,
    totalAreaM2: 1959,
    concreteTonnesAvailable: 1665,
    highRiskBuildingsIncluded: [
      'Kierulffsvej 2 (Bygning 1)',
      'Kierulffsvej 12 (Bygning 2)',
      'Valbyvej 58 (Bygning 3)',
    ],
  },
  blok1_aktiv: {
    id: 'blok1_aktiv',
    labelDa: 'Etape 1 inkl. Blok 1 (5.159 m² · 40 boliger)',
    descriptionDa:
      'Erhvervsbygninger (1.959 m²) samt aktiv nedrivning af Blok 1 på Kierulffsvej 14-22 (3.200 m², 40 boliger).',
    commercialAreaM2: 1959,
    residentialUnits: 40,
    residentialAreaM2: 3200,
    totalAreaM2: 5159,
    concreteTonnesAvailable: 4385,
    highRiskBuildingsIncluded: [
      'Blok 1 (Kierulffsvej 14-22)',
      'Kierulffsvej 2 (Bygning 1)',
      'Kierulffsvej 12 (Bygning 2)',
      'Valbyvej 58 (Bygning 3)',
    ],
  },
  etape1_3_fuld: {
    id: 'etape1_3_fuld',
    labelDa: 'Fuld Etape 1–3 (11.559 m² · 120 boliger)',
    descriptionDa:
      'Erhvervsbygninger (387 + 798 + 774 = 1.959 m²) samt op til 120 almene boliger i Blok 1, 9 og 10 (~9.600 m²).',
    commercialAreaM2: 1959,
    residentialUnits: 120,
    residentialAreaM2: 9600,
    totalAreaM2: 11559,
    concreteTonnesAvailable: 9825,
    highRiskBuildingsIncluded: [
      'Blok 1 (Kierulffsvej 14-22)',
      'Blok 9 & Blok 10 (Etape 2/3)',
      'Kierulffsvej 2 (Bygning 1)',
      'Kierulffsvej 12 (Bygning 2)',
      'Valbyvej 58 (Bygning 3)',
    ],
  },
};

/**
 * Danske LCAbyg-referencefaktorer & STED-infrastrukturdata (Ringparken, Slagelse)
 */
export const LCABYG_REFERENCE_FACTORS = {
  lostEmbodiedCarbonTonPerM2: 0.31, // 310 kg CO2e/m² indlejret i 1960-70'er betonelementer
  baselineDemolitionC1C4TonPerM2: 0.048, // 48 kg CO2e/m² ved konventionel nedrivning/bortskaffelse
  replacementNewBuildA1A5TonPerM2: 0.42, // 420 kg CO2e/m² A1-A5 erstatningsnybyggeri iht. dansk LCAbyg-benchmark
  pavingSlabReuseStockTonnes: 460, // 1990'er betonfliser (>20 års restlevetid), ~4.200 m²
  pavingSlabSavingsTonCo2ePerTonne: 0.145, // Undgået ny produktion af betonbelægningssten + transport
  graniteCurbReuseStockTonnes: 290, // Granitelementer/kantsten (ubegrænset restlevetid), ~1.450 lbm
  graniteSavingsTonCo2ePerTonne: 0.19, // Undgået ny granitbrydning, forarbejdning & fragt
  crushedConcreteSubbaseSavingsTonCo2ePerTonne: 0.038, // Erstatter jomfrueligt stabilgrus + reduceret deponi
  matureTreeMaxCount: 48, // Antal kortlagte 30+ år gamle træer i anlægs-/randzoner
  matureTreeStoredBiogenicTonCo2eEach: 1.15, // Lagret kulstof der bevares i stedet for fældning/afbrænding
  matureTreeAnnualSequestrationTonCo2eEach: 0.042, // Netto-positiv årlig optagelse (ton CO2e/træ/år)
  matureTreeEvapotranspirationKwhPerSummerEach: 185, // Latent varmeoptagelse pr. modent træ om sommeren
} as const;

export const CONTAMINATION_MAXIMA_RINGPARKEN = {
  pcbMaxMgKg: 28000,
  pcbHazardousThresholdMgKg: 50,
  leadMaxMgKg: 39000,
  leadHazardousThresholdMgKg: 2500,
  asbestosConfirmedInBasementAndPipes: true,
} as const;

export interface EmbodiedCarbonLcaInput {
  scopeId: DemolitionScopeProfile['id'];
  reusedMaterialPct: number; // 0..100 % genbrugt/nedknust materiale
  preservedMatureTreesCount: number; // 0..48 stk 30+ år gamle træer
  hasDocumentedBek496Plan: boolean; // Status for selektiv nedrivningsplan & miljøsanering iht. BEK 496/2024
  includeReplacementNewBuild?: boolean;
}

export interface CircularContaminationInterlock {
  isBlocked: boolean;
  severity: 'KRITISK_SPÆRRE' | 'BETINGET_FRIGIVET';
  titleDa: string;
  warningMessageDa: string;
  blockedConcreteTonnes: number;
  affectedHighRiskBuildings: string[];
  contaminantEvidence: Array<{
    substance: string;
    measuredPeakDa: string;
    statutoryLimitDa: string;
  }>;
  mandatoryChecklistDa: string[];
}

export interface EmbodiedCarbonLcaResult {
  scope: DemolitionScopeProfile;
  lostEmbodiedCarbonTonCo2e: number;
  demolitionProcessTonCo2e: number;
  replacementNewBuildTonCo2e: number;
  totalLinearCarbonImpactTonCo2e: number;
  pavingAndGraniteReuseSavingsTonCo2e: number;
  crushedConcreteTheoreticalSavingsTonCo2e: number;
  crushedConcreteVerifiedSavingsTonCo2e: number;
  crushedConcreteTonnesUsed: number;
  treeStoredCarbonProtectedTonCo2e: number;
  treeAnnualSequestrationTonCo2ePerYear: number;
  treeAnnualEvapotranspirationMwh: number;
  estimatedLocalUhiCoolingDegC: number;
  totalCircularSavingsTonCo2e: number;
  netCarbonBalanceTonCo2e: number;
  contaminationInterlock: CircularContaminationInterlock;
}

/**
 * Beregner indlejret kulstof (LCA), STED-genanvendelsesbesparelser, træ-mikroklima
 * samt den kritiske "Cirkulær Kontaminerings-spærre" iht. BEK nr. 496/2024.
 */
export function calculateEmbodiedCarbonAndCircularLca(
  input: EmbodiedCarbonLcaInput
): EmbodiedCarbonLcaResult {
  const scope = RINGPARKEN_DEMOLITION_SCOPES[input.scopeId];
  const reuseRatio = Math.max(0, Math.min(100, input.reusedMaterialPct)) / 100;
  const treesCount = Math.max(
    0,
    Math.min(
      LCABYG_REFERENCE_FACTORS.matureTreeMaxCount,
      Math.round(input.preservedMatureTreesCount)
    )
  );
  const includeNewBuild = input.includeReplacementNewBuild ?? true;

  const lostEmbodiedCarbonTonCo2e = Number(
    (scope.totalAreaM2 * LCABYG_REFERENCE_FACTORS.lostEmbodiedCarbonTonPerM2).toFixed(1)
  );
  const demolitionProcessTonCo2e = Number(
    (scope.totalAreaM2 * LCABYG_REFERENCE_FACTORS.baselineDemolitionC1C4TonPerM2).toFixed(1)
  );
  const replacementNewBuildTonCo2e = includeNewBuild
    ? Number(
        (scope.totalAreaM2 * LCABYG_REFERENCE_FACTORS.replacementNewBuildA1A5TonPerM2).toFixed(1)
      )
    : 0;

  const totalLinearCarbonImpactTonCo2e = Number(
    (
      lostEmbodiedCarbonTonCo2e +
      demolitionProcessTonCo2e +
      replacementNewBuildTonCo2e
    ).toFixed(1)
  );

  // STED infrastrukturplan (s. 16-17): direkte genbrug af 1990'er betonfliser + granitkantsten
  const pavingSavings =
    LCABYG_REFERENCE_FACTORS.pavingSlabReuseStockTonnes *
    reuseRatio *
    LCABYG_REFERENCE_FACTORS.pavingSlabSavingsTonCo2ePerTonne;
  const graniteSavings =
    LCABYG_REFERENCE_FACTORS.graniteCurbReuseStockTonnes *
    reuseRatio *
    LCABYG_REFERENCE_FACTORS.graniteSavingsTonCo2ePerTonne;
  const pavingAndGraniteReuseSavingsTonCo2e = Number(
    (pavingSavings + graniteSavings).toFixed(1)
  );

  // Nedknust beton som bundopbygning under veje og stier
  const crushedConcreteTonnesUsed = Number(
    (scope.concreteTonnesAvailable * reuseRatio).toFixed(0)
  );
  const crushedConcreteTheoreticalSavingsTonCo2e = Number(
    (
      crushedConcreteTonnesUsed *
      LCABYG_REFERENCE_FACTORS.crushedConcreteSubbaseSavingsTonCo2ePerTonne
    ).toFixed(1)
  );

  // Cirkulær Kontaminerings-spærre: Uden dokumenteret BEK 496/2024 selektiv nedrivning & miljøsanering
  // må nedknust beton fra Blok 1, Kierulffsvej 2, 12 og Valbyvej 58 IKKE frigives til bundopbygning!
  const isBlocked = !input.hasDocumentedBek496Plan;
  const crushedConcreteVerifiedSavingsTonCo2e = isBlocked
    ? 0
    : crushedConcreteTheoreticalSavingsTonCo2e;

  // Bevarede/flyttede 30+ år gamle træer: bevaret biogent kulstof + løbende CO2-optag + UHI-køling
  const treeStoredCarbonProtectedTonCo2e = Number(
    (
      treesCount * LCABYG_REFERENCE_FACTORS.matureTreeStoredBiogenicTonCo2eEach
    ).toFixed(1)
  );
  const treeAnnualSequestrationTonCo2ePerYear = Number(
    (
      treesCount * LCABYG_REFERENCE_FACTORS.matureTreeAnnualSequestrationTonCo2eEach
    ).toFixed(2)
  );
  const treeAnnualEvapotranspirationMwh = Number(
    (
      (treesCount * LCABYG_REFERENCE_FACTORS.matureTreeEvapotranspirationKwhPerSummerEach) /
      1000
    ).toFixed(2)
  );
  // Mikroklima/albedo-estimat: op til -2,1 °C ved fuld træbevaring og lys belægningsalbedo
  const estimatedLocalUhiCoolingDegC = Number(
    (
      (treesCount / LCABYG_REFERENCE_FACTORS.matureTreeMaxCount) * 1.65 +
      reuseRatio * 0.45
    ).toFixed(2)
  );

  const totalCircularSavingsTonCo2e = Number(
    (
      pavingAndGraniteReuseSavingsTonCo2e +
      crushedConcreteVerifiedSavingsTonCo2e +
      treeStoredCarbonProtectedTonCo2e
    ).toFixed(1)
  );

  const netCarbonBalanceTonCo2e = Number(
    (totalLinearCarbonImpactTonCo2e - totalCircularSavingsTonCo2e).toFixed(1)
  );

  const contaminationInterlock: CircularContaminationInterlock = {
    isBlocked,
    severity: isBlocked ? 'KRITISK_SPÆRRE' : 'BETINGET_FRIGIVET',
    titleDa: isBlocked
      ? 'CIRKULÆR KONTAMINERINGS-SPÆRRE AKTIVERET: Nedknust beton tilbageholdt jf. BEK 496/2024'
      : 'Cirkulær betonanvendelse betinget frigivet (kræver 100 % dokumenteret sanering pr. batch)',
    warningMessageDa: isBlocked
      ? `STED's dispositionsforslag (side 16–17) planlægger at genanvende ${crushedConcreteTonnesUsed.toLocaleString('da-DK')} ton nedknust beton som bundopbygning under veje/stier og genbruge 1990'er-fliser (teoretisk CO2e-besparelse: ${crushedConcreteTheoreticalSavingsTonCo2e.toLocaleString('da-DK')} ton CO2e). Uden godkendt standardiseret nedrivningsplan og 100 % dokumenteret miljøsanering jf. BEK 496/2024 er genanvendelse SPÆRRET, da PCB (op til 28.000 mg/kg), bly (op til 39.000 mg/kg) og asbest fra Blok 1, Kierulffsvej 2, 12 og Valbyvej 58 ellers spredes diffust i vej- og stiopbygninger.`
      : `Dokumenteret BEK 496/2024 selektiv nedrivningsplan markeret som opfyldt: ${crushedConcreteTonnesUsed.toLocaleString('da-DK')} ton renset beton kan indgå som bundopbygning, forudsat at hver fraktion fra Blok 1, Kierulffsvej 2, 12 og Valbyvej 58 har bestået uafhængig saneringskontrol og bortskaffelse af PCB-fuger/blymaling/asbest.`,
    blockedConcreteTonnes: isBlocked ? crushedConcreteTonnesUsed : 0,
    affectedHighRiskBuildings: scope.highRiskBuildingsIncluded,
    contaminantEvidence: [
      {
        substance: 'PCB (fuger & tilstødende beton)',
        measuredPeakDa: `${CONTAMINATION_MAXIMA_RINGPARKEN.pcbMaxMgKg.toLocaleString('da-DK')} mg/kg`,
        statutoryLimitDa: `≥ 50 mg/kg = Farligt affald (Ren < 0,1 mg/kg)`,
      },
      {
        substance: 'Bly (Pb i maling & puds)',
        measuredPeakDa: `${CONTAMINATION_MAXIMA_RINGPARKEN.leadMaxMgKg.toLocaleString('da-DK')} mg/kg`,
        statutoryLimitDa: `≥ 2.500 mg/kg = Farligt affald (Ren < 40 mg/kg)`,
      },
      {
        substance: 'Asbest (Amosit / Chrysotil / kiselgur)',
        measuredPeakDa: 'Påvist i 11 kældre & rørinstallationer',
        statutoryLimitDa: 'BEK 1328/2025 totaludsortering før knusning',
      },
    ],
    mandatoryChecklistDa: [
      '100 % bortrensning af PCB-holdige fuger og 20–50 mm kontamineret randbeton før nedknusning.',
      'Afslibning/udsortering af blyholdig overflademaling (> 40 / 2.500 mg/kg) jf. BEK 613/2026.',
      'Autoriseret asbestsanering af kælderstøv, rørkiselgur og eternit (BEK 1328/2025) før mekanisk nedbrydning.',
      'Batch-analyser for restkoncentrationer under Restproduktbekendtgørelsen (Kat. 1/2) før udlægning under veje og stier.',
    ],
  };

  return {
    scope,
    lostEmbodiedCarbonTonCo2e,
    demolitionProcessTonCo2e,
    replacementNewBuildTonCo2e,
    totalLinearCarbonImpactTonCo2e,
    pavingAndGraniteReuseSavingsTonCo2e,
    crushedConcreteTheoreticalSavingsTonCo2e,
    crushedConcreteVerifiedSavingsTonCo2e,
    crushedConcreteTonnesUsed,
    treeStoredCarbonProtectedTonCo2e,
    treeAnnualSequestrationTonCo2ePerYear,
    treeAnnualEvapotranspirationMwh,
    estimatedLocalUhiCoolingDegC,
    totalCircularSavingsTonCo2e,
    netCarbonBalanceTonCo2e,
    contaminationInterlock,
  };
}

export const COWI_2021_VENTILATION_BASELINE = {
  totalBlocks: 20,
  totalApartments: 732,
  avgHeatedAreaPerApartmentM2: 80,
  exhaustFlowLPerSecPerApartment: 26, // ~0,325 l/s pr. m²
  heatingHoursPerYear: 5400,
  meanSeasonalDeltaTK: 15.8, // 21,0 °C inde vs. 5,2 °C ude i fyringssæsonen
  airVolumetricHeatCapacityKjPerM3K: 1.22,
  districtHeatingCo2eTonPerMwh: 0.082, // 82 kg CO2e/MWh vægtet varmeproduktionsaftryk
  electricityCo2eTonPerMwh: 0.115, // Dansk elnet-gennemsnit for hjælpe-el
  addedSupplyFanKwhPerApartmentYear: 165, // Ekstra tilluftsventilator-forbrug ved balanceret anlæg
} as const;

export interface CavVentilationEnergyInput {
  heatRecoveryEfficiencyPct: number; // 80..85 % (kan også testes lavere/højere)
  apartmentCount?: number; // default 732 boliger (alle 20 blokke)
}

export interface CavVentilationEnergyResult {
  apartmentCount: number;
  blockCount: number;
  totalAirflowM3PerSec: number;
  annualVentilationHeatLossMwh: number;
  annualDirectHeatLossGj: number;
  recoveredHeatMwhPerYear: number;
  addedSupplyFanElectricityMwhPerYear: number;
  netEnergySavedMwhPerYear: number;
  grossHeatCo2eSavedTonPerYear: number;
  netCo2eSavedTonPerYear: number;
  negativePressureEliminated: boolean;
  indoorHealthAndClimateNoteDa: string;
}

/**
 * Beregner årligt varmetab (MWh/år), termisk strålings-/konvektionstab over tag
 * samt CO2e-reduktion ved udskiftning af COWI (2021) CAV-udsugning uden varmegenvinding
 * på alle 20 blokke (732 boliger) til balanceret ventilation med 80-85 % varmegenvinding.
 */
export function calculateCavVentilationEnergyLossAndRecovery(
  input: CavVentilationEnergyInput
): CavVentilationEnergyResult {
  const apartments = Math.max(1, Math.round(input.apartmentCount ?? COWI_2021_VENTILATION_BASELINE.totalApartments));
  const blockCount = Math.max(1, Math.round((apartments / 732) * 20));
  const efficiency = Math.max(0.5, Math.min(0.95, input.heatRecoveryEfficiencyPct / 100));

  const totalAirflowM3PerSec = Number(
    ((apartments * COWI_2021_VENTILATION_BASELINE.exhaustFlowLPerSecPerApartment) / 1000).toFixed(2)
  );

  // P (kW) = V_dot (m³/s) * rho*cp (kJ/m³K) * deltaT (K)
  const meanHeatLossKw =
    totalAirflowM3PerSec *
    COWI_2021_VENTILATION_BASELINE.airVolumetricHeatCapacityKjPerM3K *
    COWI_2021_VENTILATION_BASELINE.meanSeasonalDeltaTK;

  const annualVentilationHeatLossMwh = Number(
    ((meanHeatLossKw * COWI_2021_VENTILATION_BASELINE.heatingHoursPerYear) / 1000).toFixed(1)
  );
  const annualDirectHeatLossGj = Number((annualVentilationHeatLossMwh * 3.6).toFixed(0));

  const recoveredHeatMwhPerYear = Number(
    (annualVentilationHeatLossMwh * efficiency).toFixed(1)
  );
  const addedSupplyFanElectricityMwhPerYear = Number(
    ((apartments * COWI_2021_VENTILATION_BASELINE.addedSupplyFanKwhPerApartmentYear) / 1000).toFixed(1)
  );
  const netEnergySavedMwhPerYear = Number(
    (recoveredHeatMwhPerYear - addedSupplyFanElectricityMwhPerYear).toFixed(1)
  );

  const grossHeatCo2eSavedTonPerYear = Number(
    (
      recoveredHeatMwhPerYear *
      COWI_2021_VENTILATION_BASELINE.districtHeatingCo2eTonPerMwh
    ).toFixed(1)
  );
  const fanPenaltyCo2eTon =
    addedSupplyFanElectricityMwhPerYear *
    COWI_2021_VENTILATION_BASELINE.electricityCo2eTonPerMwh;
  const netCo2eSavedTonPerYear = Number(
    Math.max(0, grossHeatCo2eSavedTonPerYear - fanPenaltyCo2eTon).toFixed(1)
  );

  return {
    apartmentCount: apartments,
    blockCount,
    totalAirflowM3PerSec,
    annualVentilationHeatLossMwh,
    annualDirectHeatLossGj,
    recoveredHeatMwhPerYear,
    addedSupplyFanElectricityMwhPerYear,
    netEnergySavedMwhPerYear,
    grossHeatCo2eSavedTonPerYear,
    netCo2eSavedTonPerYear,
    negativePressureEliminated: true,
    indoorHealthAndClimateNoteDa:
      'Balanceret ventilation med varmegenvinding fjerner det skadelige CAV-undertryk i boligerne (COWI 2021) og reducerer derved indsugning af asbeststøv fra kældre, PCB-afgasning fra nedbrudte fuger samt jordradon fra moræneleret.',
  };
}

export const RINGPARKEN_LAR_CONSTANTS = {
  maxAllowedSpecificRunoffLPerSecHa: 2.0, // Lokalplan 1269
  existingGrassGridParkingSpaces: 760,
  plannedGrassGridParkingSpaces: 209,
  totalGrassGridParkingSpaces: 969,
  areaPerParkingSpaceM2: 12.5,
  effectiveGrassGridRetentionM3PerSpace: 0.42, // Tæt dræn-buffer i bærelag (ikke fri nedsivning pga. moræneler)
  winterGroundwaterDepthRangeDa: '0,8–2,1 m under terræn (vintergrundvand)',
  soilPermeabilityNoteDa: 'Lavpermeabelt moræneler (125–150 mm/dag); nedsivning forbudt mellem sydlige blokke.',
} as const;

export type RainEventPresetId = '10_year' | '100_year_climate' | 'custom';

export interface HydrologicalLarInput {
  presetId: RainEventPresetId;
  areaHa: number; // valgt delareal i hektar
  imperviousSharePct: number; // 20..95 %
  rainIntensityMmPerHour: number; // mm/time
  stormDurationMinutes?: number; // standard 60 min
  climateFactor?: number; // anvendt klimafaktor (f.eks. 1.0 ved 10-års, 1.35 ved 100-års skybrud)
  activeGrassGridSpaces?: number; // op til 760 + 209 = 969 P-pladser
}

export interface HydrologicalLarResult {
  areaHa: number;
  effectiveIntensityMmPerHour: number;
  climateFactor: number;
  maxAllowedRunoffLPerSecPerHa: number;
  maxAllowedTotalOutflowLPerSec: number;
  peakInflowLPerSec: number;
  excessFlowToDetainLPerSec: number;
  requiredTotalDetentionM3: number;
  grassGridRetentionM3: number;
  roadCassettesRequiredM3: number;
  openSealedSwaleRequiredM3: number;
  overflowToSeparateSewerLPerSec: number;
  infiltrationProhibitedWarningDa: string;
  complianceStatusDa: string;
}

/**
 * Hydrologisk skybruds- og LAR-beregner iht. Lokalplan 1269 (maks. 2,0 l/s/ha).
 * Beregner forsinkelsesbehov i permeabel græsarmering (760+209 P-pladser),
 * tætte nedgravede vejkassetter samt åbne tætte LAR-grøfter med drosslet overløb til separatkloak.
 */
export function calculateHydrologicalLarDetention(
  input: HydrologicalLarInput
): HydrologicalLarResult {
  const areaHa = Math.max(0.2, Math.min(20, input.areaHa));
  const runoffCoeff = Math.max(0.15, Math.min(0.95, input.imperviousSharePct / 100));
  const durationMin = Math.max(15, Math.min(240, input.stormDurationMinutes ?? 60));
  const durationSec = durationMin * 60;
  const climateFactor = Math.max(
    1.0,
    Math.min(1.6, input.climateFactor ?? (input.presetId === '100_year_climate' ? 1.35 : 1.0))
  );

  // Ved custom tages slideren direkte; ved 100_year_climate medregnes klimafaktor hvis rå intensitet gives
  const effectiveIntensityMmPerHour = Number(
    (
      input.presetId === '100_year_climate'
        ? input.rainIntensityMmPerHour
        : input.rainIntensityMmPerHour * (climateFactor > 1 && input.presetId === 'custom' ? 1 : 1)
    ).toFixed(1)
  );

  // 1 mm/time over 1 ha = 10.000 L / 3600 s = 2,77778 l/s/ha
  const peakInflowLPerSec = Number(
    (effectiveIntensityMmPerHour * 2.777778 * runoffCoeff * areaHa).toFixed(1)
  );
  const maxAllowedTotalOutflowLPerSec = Number(
    (RINGPARKEN_LAR_CONSTANTS.maxAllowedSpecificRunoffLPerSecHa * areaHa).toFixed(1)
  );
  const excessFlowToDetainLPerSec = Number(
    Math.max(0, peakInflowLPerSec - maxAllowedTotalOutflowLPerSec).toFixed(1)
  );

  const requiredTotalDetentionM3 = Number(
    ((excessFlowToDetainLPerSec * durationSec) / 1000).toFixed(1)
  );

  const spaces = Math.max(
    0,
    Math.min(
      RINGPARKEN_LAR_CONSTANTS.totalGrassGridParkingSpaces,
      Math.round(
        input.activeGrassGridSpaces ??
          RINGPARKEN_LAR_CONSTANTS.totalGrassGridParkingSpaces
      )
    )
  );
  // Skaler P-pladskvote proportionalt med valgt delareal ift. Ringparkens samlede 11,4 ha
  const areaShare = Math.min(1, areaHa / 11.4);
  const rawGrassRetentionM3 =
    spaces *
    areaShare *
    RINGPARKEN_LAR_CONSTANTS.effectiveGrassGridRetentionM3PerSpace;
  const grassGridRetentionM3 = Number(
    Math.min(requiredTotalDetentionM3, rawGrassRetentionM3).toFixed(1)
  );

  const remainingDetentionM3 = Math.max(
    0,
    requiredTotalDetentionM3 - grassGridRetentionM3
  );
  // 55 % tætte nedgravede vejkassetter + 45 % åbne tætte LAR-grøfter med overløb til separatkloak
  const roadCassettesRequiredM3 = Number((remainingDetentionM3 * 0.55).toFixed(1));
  const openSealedSwaleRequiredM3 = Number(
    (remainingDetentionM3 - roadCassettesRequiredM3).toFixed(1)
  );

  const overflowToSeparateSewerLPerSec = Number(
    Math.min(peakInflowLPerSec, maxAllowedTotalOutflowLPerSec).toFixed(1)
  );

  const complianceStatusDa =
    excessFlowToDetainLPerSec <= 0
      ? `Direkte under Lokalplan 1269-krav (${peakInflowLPerSec.toFixed(1)} ≤ ${maxAllowedTotalOutflowLPerSec.toFixed(1)} l/s)`
      : `Kræver ${requiredTotalDetentionM3.toLocaleString('da-DK')} m³ tæt LAR-forsinkelse for at drossle til 2,0 l/s/ha`;

  return {
    areaHa,
    effectiveIntensityMmPerHour,
    climateFactor,
    maxAllowedRunoffLPerSecPerHa: RINGPARKEN_LAR_CONSTANTS.maxAllowedSpecificRunoffLPerSecHa,
    maxAllowedTotalOutflowLPerSec,
    peakInflowLPerSec,
    excessFlowToDetainLPerSec,
    requiredTotalDetentionM3,
    grassGridRetentionM3,
    roadCassettesRequiredM3,
    openSealedSwaleRequiredM3,
    overflowToSeparateSewerLPerSec,
    infiltrationProhibitedWarningDa:
      'Nedsivning forbudt mellem de sydlige blokke: Vintergrundvand står 0,8–2,1 m under terræn på lavpermeabelt moræneler (125–150 mm/dag). Alle vejkassetter og LAR-grøfter skal udføres med tæt bundmembran og kontrolleret overløb til separatkloak.',
    complianceStatusDa,
  };
}

export interface EmbodiedCarbonBarDatum {
  key: string;
  labelDa: string;
  tonCo2e: number;
  category: 'emission' | 'saving' | 'net';
}

export interface EmbodiedCarbonCalculationResult {
  scopeId: DemolitionScopeProfile['id'];
  commercialAreaM2: number;
  residentialAreaM2: number;
  residentialUnits: number;
  commercialEmbodiedTonCo2e: number;
  residentialEmbodiedTonCo2e: number;
  demolitionProcessTonCo2e: number;
  replacementNewBuildTonCo2e: number;
  totalGrossTonCo2e: number;
  circularSavingsTonCo2e: number;
  netCarbonBalanceTonCo2e: number;
  isConcreteSavingsBlocked: boolean;
  fullLcaResult: EmbodiedCarbonLcaResult;
  chartBreakdown: EmbodiedCarbonBarDatum[];
}

/**
 * Deterministisk beregning af indlejret kulstof (ton CO2e) for nedrivning af
 * erhvervsbygninger (387 + 798 + 774 = 1.959 m²) og boligblokke (Blok 1, 9 og 10 op til 9.600 m²),
 * inkl. diagram-serier til direkte visualisering i søjlediagram.
 */
export function calculateEmbodiedCarbon(
  input: Partial<EmbodiedCarbonLcaInput> & {
    commercialAreaM2?: number;
    residentialAreaM2?: number;
  } = {}
): EmbodiedCarbonCalculationResult {
  const scopeId = input.scopeId ?? 'etape1_3_fuld';
  const baseLca = calculateEmbodiedCarbonAndCircularLca({
    scopeId,
    reusedMaterialPct: input.reusedMaterialPct ?? 75,
    preservedMatureTreesCount: input.preservedMatureTreesCount ?? 36,
    hasDocumentedBek496Plan: input.hasDocumentedBek496Plan ?? false,
    includeReplacementNewBuild: input.includeReplacementNewBuild ?? true,
  });

  const commercialAreaM2 = input.commercialAreaM2 ?? baseLca.scope.commercialAreaM2;
  const residentialAreaM2 = input.residentialAreaM2 ?? baseLca.scope.residentialAreaM2;
  const effectiveTotalAreaM2 = commercialAreaM2 + residentialAreaM2;
  const includeNewBuild = input.includeReplacementNewBuild ?? true;

  const commercialEmbodiedTonCo2e = Number(
    (commercialAreaM2 * LCABYG_REFERENCE_FACTORS.lostEmbodiedCarbonTonPerM2).toFixed(1)
  );
  const residentialEmbodiedTonCo2e = Number(
    (residentialAreaM2 * LCABYG_REFERENCE_FACTORS.lostEmbodiedCarbonTonPerM2).toFixed(1)
  );
  const demolitionProcessTonCo2e = Number(
    (effectiveTotalAreaM2 * LCABYG_REFERENCE_FACTORS.baselineDemolitionC1C4TonPerM2).toFixed(1)
  );
  const replacementNewBuildTonCo2e = includeNewBuild
    ? Number(
        (effectiveTotalAreaM2 * LCABYG_REFERENCE_FACTORS.replacementNewBuildA1A5TonPerM2).toFixed(1)
      )
    : 0;

  const totalGrossTonCo2e = Number(
    (
      commercialEmbodiedTonCo2e +
      residentialEmbodiedTonCo2e +
      demolitionProcessTonCo2e +
      replacementNewBuildTonCo2e
    ).toFixed(1)
  );
  const circularSavingsTonCo2e = baseLca.totalCircularSavingsTonCo2e;
  const netCarbonBalanceTonCo2e = Number(
    (totalGrossTonCo2e - circularSavingsTonCo2e).toFixed(1)
  );

  const chartBreakdown: EmbodiedCarbonBarDatum[] = [
    {
      key: 'commercial',
      labelDa: 'Erhverv (1.959 m²)',
      tonCo2e: commercialEmbodiedTonCo2e,
      category: 'emission',
    },
    {
      key: 'residential',
      labelDa: `Bolig (${baseLca.scope.residentialUnits} lejl.)`,
      tonCo2e: residentialEmbodiedTonCo2e,
      category: 'emission',
    },
    {
      key: 'demolition_c1c4',
      labelDa: 'Nedrivning C1–C4',
      tonCo2e: demolitionProcessTonCo2e,
      category: 'emission',
    },
    {
      key: 'replacement_a1a5',
      labelDa: 'Nybyg A1–A5',
      tonCo2e: replacementNewBuildTonCo2e,
      category: 'emission',
    },
    {
      key: 'circular_savings',
      labelDa: 'STED Besparelse',
      tonCo2e: -circularSavingsTonCo2e,
      category: 'saving',
    },
    {
      key: 'net_balance',
      labelDa: 'Netto CO₂e',
      tonCo2e: netCarbonBalanceTonCo2e,
      category: 'net',
    },
  ];

  return {
    scopeId,
    commercialAreaM2,
    residentialAreaM2,
    residentialUnits: baseLca.scope.residentialUnits,
    commercialEmbodiedTonCo2e,
    residentialEmbodiedTonCo2e,
    demolitionProcessTonCo2e,
    replacementNewBuildTonCo2e,
    totalGrossTonCo2e,
    circularSavingsTonCo2e,
    netCarbonBalanceTonCo2e,
    isConcreteSavingsBlocked: baseLca.contaminationInterlock.isBlocked,
    fullLcaResult: baseLca,
    chartBreakdown,
  };
}

export interface CavAnnualHeatLossSummary {
  apartmentCount: number;
  annualHeatLossMwh: number;
  recoveredHeatMwh: number;
  netEnergySavedMwh: number;
  netCo2eSavedTonPerYear: number;
}

/**
 * Deterministisk funktion for årligt varmetab (MWh/år) fra CAV-udsugning (COWI 2021)
 * samt nettobesparelse ved konvertering til balanceret ventilation med varmegenvinding.
 */
export function calculateCavAnnualHeatLossMwh(params?: {
  apartmentCount?: number;
  heatRecoveryEfficiencyPct?: number;
}): CavAnnualHeatLossSummary {
  const res = calculateCavVentilationEnergyLossAndRecovery({
    apartmentCount: params?.apartmentCount ?? COWI_2021_VENTILATION_BASELINE.totalApartments,
    heatRecoveryEfficiencyPct: params?.heatRecoveryEfficiencyPct ?? 82.5,
  });
  return {
    apartmentCount: res.apartmentCount,
    annualHeatLossMwh: res.annualVentilationHeatLossMwh,
    recoveredHeatMwh: res.recoveredHeatMwhPerYear,
    netEnergySavedMwh: res.netEnergySavedMwhPerYear,
    netCo2eSavedTonPerYear: res.netCo2eSavedTonPerYear,
  };
}

export interface LarDetentionVolumeSummary {
  areaHa: number;
  imperviousSharePct: number;
  rainIntensityMmPerHour: number;
  stormDurationMinutes: number;
  maxAllowedOutflowLPerSec: number;
  peakInflowLPerSec: number;
  excessFlowLPerSec: number;
  requiredDetentionM3: number;
  grassGridRetentionM3: number;
  roadCassettesRequiredM3: number;
  openSealedSwaleRequiredM3: number;
}

/**
 * Deterministisk beregning af nødvendigt LAR-forsinkelsesvolumen (m³) for et valgt delareal,
 * givet Lokalplan 1269's maksimale specifikke afledning på 2,0 l/s/ha.
 */
export function calculateLarDetentionVolume(params: {
  areaHa: number;
  rainIntensityMmPerHour: number;
  imperviousSharePct?: number;
  stormDurationMinutes?: number;
  climateFactor?: number;
  activeGrassGridSpaces?: number;
}): LarDetentionVolumeSummary {
  const res = calculateHydrologicalLarDetention({
    presetId: 'custom',
    areaHa: params.areaHa,
    imperviousSharePct: params.imperviousSharePct ?? 58,
    rainIntensityMmPerHour: params.rainIntensityMmPerHour,
    stormDurationMinutes: params.stormDurationMinutes ?? 60,
    climateFactor: params.climateFactor ?? 1.0,
    activeGrassGridSpaces: params.activeGrassGridSpaces,
  });

  return {
    areaHa: res.areaHa,
    imperviousSharePct: params.imperviousSharePct ?? 58,
    rainIntensityMmPerHour: res.effectiveIntensityMmPerHour,
    stormDurationMinutes: params.stormDurationMinutes ?? 60,
    maxAllowedOutflowLPerSec: res.maxAllowedTotalOutflowLPerSec,
    peakInflowLPerSec: res.peakInflowLPerSec,
    excessFlowLPerSec: res.excessFlowToDetainLPerSec,
    requiredDetentionM3: res.requiredTotalDetentionM3,
    grassGridRetentionM3: res.grassGridRetentionM3,
    roadCassettesRequiredM3: res.roadCassettesRequiredM3,
    openSealedSwaleRequiredM3: res.openSealedSwaleRequiredM3,
  };
}
