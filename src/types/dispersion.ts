export type SubstanceKey =
  | 'asbestos'
  | 'pcb'
  | 'heavyMetals'
  | 'quartzWool'
  | 'moldSewer';

export type PasquillClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface SubstanceSpec {
  key: SubstanceKey;
  name: string;
  shortName: string;
  limitValue2026: number;
  actionValue?: number;
  unit: string;
  regulationRef: string;
  description: string;
  baseEmissionFactor: number;
}

export type BuildingOperationalCategory =
  | 'a_inhabited'
  | 'b_vacant'
  | 'c_under_renovation'
  | 'd_under_demolition'
  | 'e_demolished_unsecured';

export interface BuildingCategoryMetadata {
  code: BuildingOperationalCategory;
  labelDa:
    | 'a. Beboet'
    | 'b. Tom'
    | 'c. Under Renovering'
    | 'd. Under nedrivning'
    | 'e. Nedrevet, ikke sikret';
  colorHex: string;
  actsAsSource: boolean;
  sourceEmissionFactor: number;
  actsAsReceptor: boolean;
  defaultReleaseHeightMeters: number;
  buildingHeight3DMeters: number;
}

export interface RingparkenBuildingUnit {
  id: string;
  code: string;
  name: string;
  department:
    | 'FOB Afd. 23'
    | 'FOB Afd. 24'
    | 'FOB Afd. 26'
    | 'FOB Afd. 32'
    | 'SAB Schackenborgvænge'
    | 'Erhverv & Institutioner';
  address: string;
  dwellingsCount: number;
  floors: number;
  constructionYear: number;
  category: BuildingOperationalCategory;
  helhedsplanEtape:
    | 'Etape 1 (Renovering - 587,59 mio. kr.)'
    | 'Etape 2 del 1 (Nedrivning Blok 1 - 17,49 mio. kr.)'
    | 'Etape 2 del 2 (Nedrivning Blok 9-10 - 33,68 mio. kr.)'
    | 'Etape 3 (Udearealer - 72,71 mio. kr.)'
    | 'Etape 4 (Beboerhus - 10,15 mio. kr.)'
    | 'Frasolgt / Ekstern';
  center: LatLngPoint;
  footprint: LatLngPoint[];
  fiberReleaseIndex: number;
  hasCrawlspace: boolean;
  hasUnsealedBasementOrSoil: boolean;
  environmentalReportIds: string[];
}

export interface DemolitionSourceNode {
  id: string;
  code: string;
  name: string;
  address: string;
  position: LatLngPoint;
  footprint: LatLngPoint[];
  releaseHeightMeters: number;
  substances: SubstanceKey[];
  substanceDetails: Record<SubstanceKey, string>;
  pssReference: string;
  constructionYearRange?: string;
  materialAgeCategory?: string;
  asbestosBuildingParts?: string[];
  fiberReleaseIndex?: number; // 0..1 probability/intensity index based on <1997 building components
  healthRiskCorrelation?: string;
  buildingUnitId?: string;
  buildingCategory?: BuildingOperationalCategory;
  sourceEmissionFactor?: number;
  buildingHeight3DMeters?: number;
  isCustom?: boolean;
  active: boolean;
}

export interface ReceptorZone {
  id: string;
  code: string;
  name: string;
  category: 'residential_block' | 'public_road' | 'bike_path' | 'custom_receptor';
  department?: string;
  address: string;
  center: LatLngPoint;
  polygon: LatLngPoint[];
  residentCountEstimate?: number;
  vulnerableGroupNote: string;
  buildingUnitId?: string;
  buildingCategory?: BuildingOperationalCategory;
  buildingHeight3DMeters?: number;
  isCustom?: boolean;
}

export interface HourlyWeatherPoint {
  isoTime: string;
  hourIndex: number; // 0..23
  hourLabel: string; // "00:00" .. "23:00"
  temperature2m: number; // °C
  relativeHumidity2m: number; // %
  precipitation: number; // mm/h
  cloudCover: number; // %
  windSpeed10m: number; // m/s
  windDirection10m: number; // deg (0..360, meteorological: direction wind blows FROM)
  windGusts10m: number; // m/s
  soilMoisture0To7cm: number; // m³/m³
  directRadiation: number; // W/m²
  weatherCode: number;
  pasquillClass: PasquillClass;
  hadRecentFreezeThaw: boolean;
}

export interface WeatherDataset {
  dateIso: string; // YYYY-MM-DD
  sourceApi: string;
  fetchedAtIso: string;
  isScenarioOverride: boolean;
  scenarioName?: string;
  hours: HourlyWeatherPoint[];
}

export type RiskZoneLevel = 'red' | 'orange' | 'yellow' | 'blue';

export interface PlumePolygonZone {
  id: string;
  sourceId: string;
  sourceName: string;
  level: RiskZoneLevel;
  label: string;
  sumQuotientRange: string;
  maxSumQuotient: number;
  downwindDistanceMeters: number;
  crosswindWidthMeters: number;
  plumeDirectionDeg: number; // (W + 180) mod 360
  polygon: LatLngPoint[];
  hourLabel?: string;
}

export interface SubstanceConcentrationBreakdown {
  key: SubstanceKey;
  name: string;
  unit: string;
  concentration: number;
  limitValue: number;
  quotient: number; // C_i / GV_i
  weatherTriggerNote: string;
  isExceedingIndividual: boolean;
}

export interface ReceptorExposureResult {
  receptorId: string;
  receptorName: string;
  receptorCode: string;
  address: string;
  category: ReceptorZone['category'];
  position: LatLngPoint;
  distanceFromNearestSourceMeters: number;
  dominantSourceName: string;
  sumQuotient: number; // S = Sum(C_i / GV_i)
  riskLevel: RiskZoneLevel | 'safe';
  hydrologicalRunoffActive: boolean;
  substances: SubstanceConcentrationBreakdown[];
}

export type LegalBasisFilterCategory = 'BEK_613_2026_ASBESTOS' | 'MST_NOISE_LIMITS';

export interface LegalViolationEntry {
  id: string;
  severity: 'CRITICAL_RED' | 'ELEVATED_ORANGE' | 'HYDROLOGICAL_BLUE';
  legalBasisCategory: LegalBasisFilterCategory;
  legalBasisLabel: 'BEK 613/2026 (Asbest)' | 'Miljøstyrelsens vejledende støjgrænser';
  timestampIso: string;
  receptorName: string;
  receptorAddress: string;
  sumQuotient: number;
  statuteTitle: string;
  statuteReference: string;
  legalConsequence: string;
  technicalEvidence: string;
  noiseMetrics?: {
    laeqDb: number;
    lafmaxDb: number;
    impulseAdjustedLaeqDb: number;
    limitLaeqDb: number;
    limitLafmaxDb: number;
    windRefractionDb: number;
    dominantSourceName: string;
    distanceMeters: number;
  };
}


export interface HourlyReceptorPuffDose {
  hourIndex: number;
  hourLabel: string;
  sumQuotient: number;
  windDirectionFromDeg: number;
  plumeDirectionToDeg: number;
  windSpeedMs: number;
  windGustsMs: number;
  depositedDustUgM2: number;
  depositedAsbestosFibersM2: number;
}

export interface Receptor24hCumulativeSummary {
  receptorId: string;
  receptorName: string;
  receptorCode: string;
  address: string;
  position: LatLngPoint;
  nearestSourceName: string;
  distanceToNearestSourceMeters: number;
  cumulativeSumDose: number; // Integrated S * dt over 24h
  meanSumQuotient: number;
  peakSumQuotient: number;
  peakHourIndex: number;
  peakHourLabel: string; // e.g. "14:00"
  peakWindDirectionFromDeg: number;
  peakPlumeDirectionToDeg: number;
  peakWindSpeedMs: number;
  peakWindGustsMs: number;
  totalDepositedHeavyMetalsAndPcbUgM2: number;
  totalDepositedAsbestosFibersM2: number;
  hoursInRedZone: number;
  hoursInOrangeZone: number;
  hourlyProfile: HourlyReceptorPuffDose[];
  dominantSubstanceName: string;
}

export interface PuffTrajectoryPoint {
  hourIndex: number;
  hourLabel: string;
  sourceId: string;
  sourceCode: string;
  origin: LatLngPoint;
  puffCenterEnd: LatLngPoint;
  windSpeedMs: number;
  windDirectionFromDeg: number;
  advectionDirectionToDeg: number;
  depositionIntensityUgM2: number;
}

export interface PuffAccumulationResult {
  dateIso: string;
  hourlyPuffPolygons: PlumePolygonZone[]; // 24h directional puff lobes
  mergedEnvelopePolygons: PlumePolygonZone[]; // 24h cumulative risk envelope
  puffTrajectories: PuffTrajectoryPoint[]; // 24h hourly puff advection vectors
  receptorSummaries: Receptor24hCumulativeSummary[];
  streetPointSummaries: Receptor24hCumulativeSummary[]; // Discrete street-level probe points along Kierulffsvej, Valbyvej, etc.
  peakReceptor: Receptor24hCumulativeSummary; // Exact highest-dose point in Ringparken over 24h
  total24hRedZoneAreaM2: number;
  dominantWindSectorText: string;
  minWindSpeedMs: number;
  maxWindSpeedMs: number;
  maxWindGustsMs: number;
}

export interface DispersionSimulationState {
  currentWeather: HourlyWeatherPoint;
  plumeZones: PlumePolygonZone[];
  receptorExposures: ReceptorExposureResult[];
  maxSiteSumQuotient: number;
  worstExposedReceptor: ReceptorExposureResult;
  legalViolations: LegalViolationEntry[];
  puff24h: PuffAccumulationResult;
}

export type ReporterRole =
  | 'Beboer (Ringparken)'
  | 'Arbejdsmiljørepræsentant (AMR)'
  | 'Tilsynsførende (Arbejdstilsynet / Kommune)'
  | 'Byggerådgiver / Miljøtekniker';

export interface PlumeCorroborationResult {
  isInsideMathematicalPlume: boolean;
  matchedZoneLevel: RiskZoneLevel | 'outside';
  zoneLabel: string;
  calculatedSumQuotient: number;
  nearestSourceId: string;
  nearestSourceName: string;
  distanceFromSourceMeters: number;
  bearingFromSourceDeg: number;
  plumeDirectionDeg: number;
  angularDeviationDeg: number;
  corroborationSummary: string;
  violatedRegulations: string[];
}

export interface ForensicPhotoAnalysis {
  visualTitle: string;
  visualDescription: string;
  detectedHazards: string[];
  suspectedSubstances: SubstanceKey[];
  severityAssessment: 'KRITISK' | 'FORHØJET' | 'MODERAT';
  confidencePct: number;
  recommendedObservationType: string;
  statutoryReferences: string[];
  forensicConclusion: string;
  analyzedAtIso: string;
  modelUsed: string;
}

export type ForensicEvidenceCategoryTag =
  | 'Myndighedskorrespondance'
  | 'Beboerklage'
  | 'Tilsynsrapport'
  | 'Laboratorieanalyse'
  | 'AMR-Observation';

export interface ForensicPhotoEvidence {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  dataUrl: string;
  imageSha256Hash: string;
  capturedAtIso: string;
  evidenceCategory?: ForensicEvidenceCategoryTag;
  aiAnalysis: ForensicPhotoAnalysis;
}

export type AuthorityDocumentCategory =
  | 'mail_korrespondance'
  | 'aktindsigt_svar'
  | 'myndighedshenvendelse'
  | 'teknisk_rapport_bilag';

export interface ForensicPdfDocumentAnalysis {
  documentTitle: string;
  detectedCategory: AuthorityDocumentCategory;
  senderEntity: string;
  recipientEntity: string;
  documentDateDetected: string;
  referenceJournalNumber: string;
  executiveSummary: string;
  keyStatementsAndAdmissions: string[];
  contradictionsWithTelemetry: string[];
  legalAndEvidentiarySignificance: string;
  statutoryReferences: string[];
  severityAssessment: 'KRITISK' | 'FORHØJET' | 'MODERAT';
  confidencePct: number;
  recommendedObservationType: string;
  analyzedAtIso: string;
  modelUsed: string;
}

export interface ForensicPdfEvidence {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  pageCountEstimate: number;
  sha256Hash: string;
  uploadedAtIso: string;
  category: AuthorityDocumentCategory;
  evidenceCategory?: ForensicEvidenceCategoryTag;
  pdfDataUrl?: string;
  aiAnalysis: ForensicPdfDocumentAnalysis;
}

export interface ForensicMapSnapshotMetadata {
  zoom: number;
  center: LatLngPoint;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  activeLayers: string[];
  modeDescriptor: string;
  capturedAtIso: string;
}

export interface PhysicalToDigitalProofOfState {
  windDirectionDeg: number;
  temperatureGradientDtDzKm: number; // ∂T/∂z in K/m
  sumQuotientS: number;
  noiseLafmaxDb: number; // L_AFmax including +5.0 dB(A) impulse surcharge
  impulseSurchargeDb: number; // +5.0 dB(A)
  anchoredTimestampIso: string;
  stateAnchorHash: string;
}

export interface ZkpVerificationMetadata {
  zkpProofHash: string;
  rightToOpacityEnabled: boolean;
  geofenceVerified: boolean;
  anonymizedRoleCommitment: string;
  physicalToDigitalProofOfState: PhysicalToDigitalProofOfState;
}

export interface AlgedonicObservation {
  id: string;
  code: string;
  createdAtIso: string;
  observedDateIso: string;
  observedHourIndex: number;
  observedHourLabel: string;
  observedTimestampIso: string;
  position: LatLngPoint;
  locationLabel: string;
  reporterRole: ReporterRole;
  reporterIdentifier: string;
  evidenceCategory?: ForensicEvidenceCategoryTag;
  observationType: string;
  description: string;
  weatherSnapshot: HourlyWeatherPoint;
  plumeCorroboration: PlumeCorroborationResult;
  sha256Signature: string;
  zkpVerification?: ZkpVerificationMetadata;
  photoEvidence?: ForensicPhotoEvidence;
  pdfEvidence?: ForensicPdfEvidence;
  mapSnapshot?: ForensicMapSnapshotMetadata;
}

export interface MapsGroundingPlace {
  title: string;
  uri: string;
  snippet?: string;
}

export type HeatmapComparisonZoneClass = 'only_A' | 'only_B' | 'overlap_AB';

export type HeatmapComparisonViewMode = 'difference' | 'dual_overlay';

export type DifferenceHeatmapMetric = 'sum_quotient' | 'dust_ug_m3';

export interface HeatmapGridCell {
  id: string;
  center: LatLngPoint;
  polygon: LatLngPoint[];
  sumQuotientA: number;
  sumQuotientB: number;
  deltaS: number;
  dustConcAUgM3: number;
  dustConcBUgM3: number;
  deltaDustUgM3: number;
  zoneClass: HeatmapComparisonZoneClass;
  intensityNormalized: number; // 0..1
  deltaNormalizedSigned: number; // -1..+1 (direct diverging concentration difference)
}

export interface SourcePlumeShiftMetric {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  sourcePosition: LatLngPoint;
  centroidA: LatLngPoint;
  centroidB: LatLngPoint;
  tipA: LatLngPoint;
  tipB: LatLngPoint;
  plumeDirectionADeg: number;
  plumeDirectionBDeg: number;
  rotationSignedDeg: number;
  rotationAbsDeg: number;
  centroidShiftMeters: number;
  shiftBearingDeg: number;
  shiftCompass: string;
  areaAM2: number;
  areaBM2: number;
  newlyExposedAreaM2: number;
  retreatedAreaM2: number;
  persistentOverlapAreaM2: number;
  maxSumQuotientA: number;
  maxSumQuotientB: number;
}

export interface ReceptorComparisonDelta {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  position: LatLngPoint;
  sumQuotientA: number;
  sumQuotientB: number;
  deltaS: number;
  dustConcAUgM3: number;
  dustConcBUgM3: number;
  deltaDustUgM3: number;
  riskLevelA: RiskZoneLevel | 'safe';
  riskLevelB: RiskZoneLevel | 'safe';
  shiftStatus:
    | 'newly_exposed'
    | 'intensified'
    | 'relieved'
    | 'persistent_high'
    | 'unchanged';
}

export interface HeatmapComparisonResult {
  hourA: HourlyWeatherPoint;
  hourB: HourlyWeatherPoint;
  plumeDirectionADeg: number;
  plumeDirectionBDeg: number;
  windRotationSignedDeg: number;
  windRotationAbsDeg: number;
  windSpeedDeltaMs: number;
  polygonsA: PlumePolygonZone[];
  polygonsB: PlumePolygonZone[];
  heatmapGridCells: HeatmapGridCell[];
  sourceShifts: SourcePlumeShiftMetric[];
  receptorDeltas: ReceptorComparisonDelta[];
  totalAreaAM2: number;
  totalAreaBM2: number;
  totalNewlyExposedAreaM2: number;
  totalRetreatedAreaM2: number;
  totalPersistentOverlapAreaM2: number;
  increasedZoneAreaM2: number;
  decreasedZoneAreaM2: number;
  neutralZoneAreaM2: number;
  maxPositiveDeltaS: number;
  maxNegativeDeltaS: number;
  maxPositiveDeltaDustUgM3: number;
  maxNegativeDeltaDustUgM3: number;
  peakPositiveCell: HeatmapGridCell | null;
  peakNegativeCell: HeatmapGridCell | null;
  mostIncreasedReceptor: ReceptorComparisonDelta;
  mostRelievedReceptor: ReceptorComparisonDelta;
  narrativeSummary: string;
}

export type IndoorDemolitionMachineryKey =
  | 'concrete_crusher'
  | 'hydraulic_hammer'
  | 'steel_shear_impact';

export type IndoorVentilationOperationMode =
  | 'cav_central_exhaust'
  | 'cav_plus_range_hood_120'
  | 'natural_passive'
  | 'balanced_hepa_overpress';

export interface IndoorSubstanceTelemetryEntry {
  key: SubstanceKey;
  name: string;
  unit: string;
  limitValueGv: number;
  outdoorConcentration: number;
  indoorConcentrationCin: number;
  penetrationFactorPpen: number;
  crawlspaceGenerationRateGcrawl: number;
  depositionDecayRateKdep: number;
  indoorQuotient: number;
  indoorPctOfGv: number;
}

export interface IndoorFloorPressureProfilePoint {
  floorId: string;
  floorLabel: string;
  elevationZ: number;
  deltaPsPa: number;
  deltaPwPa: number;
  deltaPCavPa: number;
  deltaPTotPa: number;
  isBelowNeutralPressurePlane: boolean;
  flowRegimeLabel: string;
}

export interface IndoorClimateTelemetryInput {
  receptor: ReceptorZone;
  outdoorExposure: ReceptorExposureResult;
  activeSources: DemolitionSourceNode[];
  weather: HourlyWeatherPoint;
  machineryKey?: IndoorDemolitionMachineryKey;
  ventilationMode?: IndoorVentilationOperationMode;
  apartmentAreaM2?: number;
  indoorTempC?: number;
  leakageRatioTopBottom?: number;
  distanceOverrideMeters?: number;
  useCalibratedForensicReference?: boolean;
}

export type VentilationOperatingMode =
  | 'cav_central_exhaust'      // Konstant udsugning fra køkken/bad uden filtreret indblæsning
  | 'cav_plus_range_hood_120'  // CAV + aktiv emhætte (120 l/s forcering jf. BR18 § 443)
  | 'natural_passive'          // Naturlig ventilation gennem spalteventiler og skakte
  | 'balanced_hepa_overpress'; // Sanerings-tilstand: Balanceret H14-HEPA indblæsning (+10 Pa overtryk)

export interface StructuralVibrationAndEnvelopeMetrics {
  dominantMachineryKey: 'hydraulic_hammer' | 'concrete_crusher' | 'steel_shear_impact';
  dominantFrequencyHz: number;
  calculatedPpvFoundationMmS: number;
  calculatedPpvTopFloorMmS: number;
  din4150LimitFoundationMmS: number;
  din4150LimitTopFloorMmS: number;
  exceedsDin4150StructuralLimit: boolean;
  exceedsMicrocrackingThreshold: boolean;
  freezeThawAmplifierActive: boolean;
  baselinePermeabilityQ75: number;     // m³/(h·m²) @ 75 Pa
  degradedPermeabilityQ75: number;     // Øget permeabilitet pga. vibrationer & frost/tø
  effectiveLeakageAreaCm2: number;     // A_L i cm²
  particlePenetrationFactor: number;   // P_pen (0.0 - 1.0)
}

export interface CavExhaustMetrics {
  operatingMode: VentilationOperatingMode;
  apartmentAreaM2: number;
  br18MinBaseFlowLs: number;           // 0.30 l/s pr. m² jf. BR18 § 443, stk. 1
  kitchenExhaustLs: number;            // >= 20 l/s jf. BR18 § 443, stk. 5
  bathroomExhaustLs: number;           // >= 15 l/s jf. BR18 § 443, stk. 5
  wcUtilityExhaustLs: number;          // >= 10 l/s jf. BR18 § 443, stk. 5
  rangeHoodForcedLs: number;           // 120 l/s ved aktiv emhætte jf. BR18 § 443, stk. 3
  totalExtractedFlowLs: number;
  totalExtractedFlowM3h: number;
  inducedCavDepressurizationPa: number; // Negativt tryk ΔP_CAV i Pa
  ductStaticPressureDeviationPct: number; // Afvigelse ift. DS 447 +/- 3% krav
  fanBackpressureImpaired: boolean;    // True hvis modtryk er 25-50 Pa (ASHRAE)
}

export interface ThermalStackBuoyancyMetrics {
  indoorTempCelsius: number;
  outdoorTempCelsius: number;
  indoorTempKelvin: number;
  outdoorTempKelvin: number;
  buildingHeightMeters: number;
  pressureGradientPaPerMeter: number;  // 3460 * (1/To - 1/Ti)
  naturalNeutralPressureLevelMeters: number; // z_NPL uden CAV
  effectiveNeutralPressureLevelMeters: number; // z_NPL forskudt opad af CAV-udsugning
  fractionOfFacadeInInfiltrationPct: number;
  floorPressureProfile: Array<{
    floorIndex: number;
    floorLabel: string;
    elevationMeters: number;
    stackPressurePa: number;
    windPressurePa: number;
    cavPressurePa: number;
    totalNetPressurePa: number;
    flowRegime: 'INFILTRATION_SUCTION' | 'NEUTRAL' | 'EXFILTRATION_MOISTURE_RISK';
    stairwellDoorOpeningForceN: number;
  }>;
  crawlspaceSuctionFlowM3h: number;
}

export interface IndoorReceptorClimateExposure {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  structural: StructuralVibrationAndEnvelopeMetrics;
  cav: CavExhaustMetrics;
  stack: ThermalStackBuoyancyMetrics;
  combinedInfiltrationFlowM3h: number;
  effectiveAirChangePerHour: number;
  outdoorSumQuotientS: number;
  indoorSumQuotientS: number;
  indoorToOutdoorRatio: number;
  indoorSubstances: Array<{
    key: SubstanceKey;
    name: string;
    outdoorConc: number;
    indoorConc: number;
    limitValue2026: number;
    unit: string;
    indoorQuotient: number;
    crawlspaceContributionPct: number;
  }>;
  almenlejelovRentReductionEligiblePct: number;
  mandatoryRehousingTriggered: boolean;
}

export interface IndoorClimateTelemetryResult extends IndoorReceptorClimateExposure {
  receptorAddress: string;
  focusReceptorScopeLabel: string;
  timestampIso: string;
  hourIndex: number;
  hourLabel: string;

  // 1. Structural Envelope & Vibration (DIN 4150-3 Tabel 1)
  nearestSourceId: string;
  nearestSourceName: string;
  distanceMeters: number;
  machineryKey: IndoorDemolitionMachineryKey;
  machineryLabel: string;
  dominantFrequencyHz: number;
  frequencyBandLabel: string;
  ppvFoundationMmPerSec: number;
  ppvTopFloorHorizontalMmPerSec: number;
  din4150ResidentialLimitMmPerSec: number;
  din4150TopFloorLimitMmPerSec: number;
  din4150SensitiveLimitMmPerSec: number;
  exceedsDin4150Residential: boolean;
  exceedsDin4150Sensitive: boolean;
  hadRecentFreezeThaw: boolean;
  basePermeabilityQ75M3PerHm2: number;
  degradedPermeabilityQ75DegM3PerHm2: number;
  infiltrationFluxQM3PerHm2: number;
  envelopePenetrationFactorPpen: number;

  // 2. CAV Mechanical Exhaust Vacuum (BR18 § 443 & DS 447)
  ventilationMode: IndoorVentilationOperationMode;
  apartmentAreaM2: number;
  apartmentVolumeM3: number;
  envelopeAreaM2: number;
  br18BaseSupplyLs: number;
  br18KitchenExhaustLs: number;
  br18BathExhaustLs: number;
  br18WcUtilityExhaustLs: number;
  br18RangeHoodForcedLs: number;
  qCavExhaustLs: number;
  qCavExhaustM3PerH: number;
  deltaPCavPa: number;
  shaftAndCrackInflowQopM3PerH: number;

  // 3. Thermal Stack Buoyancy (Skorstenseffekt) & Neutral Pressure Plane (z_NPL)
  outdoorTempC: number;
  indoorTempC: number;
  outdoorTempKelvin: number;
  indoorTempKelvin: number;
  buildingHeightMeters: number;
  leakageRatioTopBottom: number;
  zNplThermalOnlyMeters: number;
  zNplEffectiveMeters: number;
  deltaPsSpanPa: number;
  stackGradientPaPerM: number;
  deltaPwWindPa: number;
  deltaPTotGroundPa: number;
  crawlspaceMoldAndAsbestosSuctionM3PerH: number;
  stairwellUpwardStackFlowM3PerH: number;
  topFloorMoistureExfiltrationM3PerH: number;
  stairwellDoorOpeningForceN: number;
  stairwellDoorMaxAllowedForceN: number;
  exceedsDoorForceLimit133N: boolean;
  floorPressureProfile: IndoorFloorPressureProfilePoint[];

  // 4. Quadratic Superposition & Indoor Sum Quotient (S_in, BEK 613/2026 § 3, stk. 3)
  qWindM3PerH: number;
  qStackM3PerH: number;
  qCavM3PerH: number;
  qTotSuperposedM3PerH: number;
  achTotalPerHour: number;
  substances: IndoorSubstanceTelemetryEntry[];
  indoorAsbestosFibrePerCm3: number;
  indoorAsbestosPctOfGv: number;
  indoorSumQuotientSin: number;
  outdoorSumQuotientSout: number;
  indoorVsOutdoorRatio: number;
  isIllegalExceedanceSinGte1: boolean;
  triggersAlgedonicIndoorAlarm: boolean;
  algedonicAlarmReasonDa: string;
  moldCfuPerM3?: number;
  br18Section443Compliant?: boolean;
}

