/**
 * @file src/types/myceliumAlert.ts
 * @description Stærkt typede datakontrakter og tilstands-interfaces for
 * Fællesskabets Mycelienetværk (System B) i Ringparken, Slagelse:
 * - System 1 Algedonoder (ESP32 + EU868 g3 LoRa 27 dBm ERP + LFP/solcelle)
 * - Gemini-Blue Gate 1 Neighbor Test (horisontal BFT støj-destruktion & Groth16 ZKP)
 * - Scenarie Alpha (kinetisk krater & suveræn Island Mode) + Dijkstra P2P selvheling
 * - Spinal Refleksbue & Calculation in Kind 2.0 (CiK 2.0) sværm-allokering + Sankey
 * - Autonomi-Indeks (A_i), Regulatory Apoptosis & Algoritmisk Amnesti
 */

import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  ReceptorExposureResult,
  ReceptorZone,
} from './dispersion';
import { AutonomousReceptorMeshNetwork } from '../services/autonomousReceptorMeshService';

/** Driftstilstand for en autonom System 1 Algedonode i Mycelienetværket. */
export type MyceliumNodeStatus = 'NORMAL' | 'ALGEDONIC_PAIN' | 'ISLAND_MODE' | 'CRATER_OFFLINE' | 'BYZANTINE_SPOOF';

/** Biokybernetiske stresstest- og telemetriscenarier for System B. */
export type MyceliumSimulationScenario =
  | 'live_telemetry'
  | 'alpha_kinetic_crater'
  | 'byzantine_cry_wolf'
  | 'acute_asbestos_plume'
  | 'autoimmune_overfilter';

/** Klassifikation fra Gemini-Blue Gate 1 horisontal nabotest. */
export type Gate1Classification = 'VERIFIED_ALGEDONIC_PAIN' | 'VARIANCE_INJECTION_DESTROYED_LOCALLY' | 'HOMEOSTASIS_CALM';

/** Resultat af Gemini-Blue Gate 1 Neighbor Test for en enkelt node. */
export interface Gate1ValidationResult {
  nodeId: string; passed: boolean; corroboratingNeighbors: number; activeNeighbors: number;
  consensusRatio: number; medianNeighborS: number; medianNeighborJoules: number;
  classification: Gate1Classification; zkpProofHash: string; sbtTokenId: string;
}

/** Vægtet Dijkstra P2P selvhelingsrute udenom CRATER_OFFLINE-noder. */
export interface SelfHealingRoute {
  sourceNodeId: string; targetNodeId: string; hopNodeIds: string[]; coordinates: LatLngPoint[];
  hopCount: number; reactionTimeTrMs: number; deadlineDeltaTMs: number; isViable: boolean; bypassedCraterIds: string[];
}

/** Spinal Refleksbue CiK 2.0 fysisk sværm-allokering i eksakte SI-/fysiske enheder. */
export interface CiKSwarmAllocation {
  id: string; donorNodeId: string; donorCode: string; recipientNodeId: string; recipientCode: string;
  energyJoules: number; waterMistKg: number; hepaAirM3h: number; routeCoordinates: LatLngPoint[];
}

/** Overordnet kybernetisk KPI-snapshot for System B Mycelienetværket. */
export interface SystemBKpiSnapshot {
  autonomyIndexAi: number; systemicEntropySigma: number; coercionIndexGamma: number; stabilityFactorPhi: number;
  eu868DutyCyclePct: number; activeKillChainsPct: number; regulatoryApoptosisTriggered: boolean;
  algorithmicAmnestyActive: boolean; realitySummitRequired: boolean;
}

/** Komplet tilstand for en System 1 Algedonode (ESP32 + LoRa 869,4–869,65 MHz). */
export interface MyceliumAlgedonode {
  nodeId: string; hardwareId: string; receptorId: string; code: string; name: string; address: string;
  position: LatLngPoint; status: MyceliumNodeStatus; isIslandOffGrid: boolean;
  physicalSumQuotientS: number; reportedSumQuotientS: number; asbestosFibersCm3: number;
  noiseLafmaxDb: number; windSpeedMs: number; energyReserveJoules: number; reputationScorePs: number;
  frequencyMhz: number; erpDbm: number; packetAirtimeMs: number; groth16VerifyMs: number; dutyCyclePct: number;
  connectedNeighborIds: string[]; zkpProofHash: string; sbtTokenId: string;
}

/** P2P-forbindelseskant i Mycelie-mesh-grafen. */
export interface MyceliumMeshEdge {
  edgeId: string; fromNodeId: string; toNodeId: string; fromCode: string; toCode: string;
  fromPos: LatLngPoint; toPos: LatLngPoint; distanceMeters: number; isSpanningBackbone: boolean;
  weightMs: number; linkState: 'ACTIVE_P2P' | 'ISLAND_LINK' | 'SEVERED_CRATER' | 'SELF_HEALING_BYPASS';
}

/** Node i den flow-konserverende 3-kolonners CiK 2.0 Sankey-struktur (sum = 100 enheder). */
export interface MyceliumSankeyNode {
  id: string; column: 0 | 1 | 2; labelDa: string; valueNormalized: number; physicalSummaryDa: string; colorHex: string;
}

/** Flow-link i den 3-kolonners CiK 2.0 Sankey-struktur. */
export interface MyceliumSankeyLink {
  id: string; sourceId: string; targetId: string; valueNormalized: number; colorHex: string;
}

/** Flow-konserverende 3-kolonners metabolisk Sankey-model (Total = 100,0 enheder). */
export interface MyceliumSankeyFlowData {
  totalNormalizedUnits: 100; nodes: MyceliumSankeyNode[]; links: MyceliumSankeyLink[];
  totalAllocatedJoules: number; totalAllocatedWaterMistKg: number; totalAllocatedHepaM3h: number;
  destroyedSpoofEnergySavedJoules: number;
}

/** Input-kontrakt til den deterministiske simuleringsmotor `simulateMyceliumNetwork`. */
export interface SimulateMyceliumNetworkInput {
  receptors: ReceptorZone[]; sources: DemolitionSourceNode[]; receptorExposures: ReceptorExposureResult[];
  observations: AlgedonicObservation[]; currentWeather: HourlyWeatherPoint; scenario: MyceliumSimulationScenario;
  manualCraterNodeIds?: string[]; manualSpoofNodeIds?: string[]; previousAiHistory?: number[]; realitySummitOverride?: boolean;
}

/** Samlet state-kontrakt for Fællesskabets Mycelienetværk (System B). */
export interface MyceliumNetworkSimulationState {
  scenario: MyceliumSimulationScenario;
  timestampIso: string;
  merkleRootHash: string;
  zkpChainRootHash?: string;
  nodes: MyceliumAlgedonode[];
  nodesById: Record<string, MyceliumAlgedonode>;
  edges: MyceliumMeshEdge[];
  gate1Results: Gate1ValidationResult[];
  gate1ByNodeId: Record<string, Gate1ValidationResult>;
  activeSelfHealingRoute: SelfHealingRoute | null;
  allSelfHealingRoutes: SelfHealingRoute[];
  swarmAllocations: CiKSwarmAllocation[];
  sankeyFlow: MyceliumSankeyFlowData;
  kpis: SystemBKpiSnapshot;
  aiHistory: number[];
  forensicAuditTrailDa: string[];
}

/** Kilde-kategori i den uforanderlige SHA-256 Chain-of-Custody ZKP-log. */
export type MyceliumZkpSignalSourceType = 'FIELD_OBSERVATION' | 'GATE1_NODE_PAIN' | 'LIVE_ALERT_EVENT';

/** Enkelt hash-kædet post i Mycelium Chain-of-Custody SHA-256 ZKP-tabellen. */
export interface MyceliumZkpChainEntry {
  seqNo: number;
  entryId: string;
  signalCode: string;
  sourceType: MyceliumZkpSignalSourceType;
  timestampLabel: string;
  nodeOrLocationLabel: string;
  sumQuotientS: number;
  canonicalPayload: string;
  sha256Signature: string;
  zkpProofHash: string;
  sbtTokenId: string;
  previousChainHash: string;
  chainedDigestHash: string;
  isImmutableVerified: boolean;
}

/** Samlet verificerbar Chain-of-Custody SHA-256 ledger for alle algedoniske signaler. */
export interface MyceliumZkpAuditLedger {
  genesisHash: string;
  merkleRootHash: string;
  totalEntries: number;
  allVerifiedIntact: boolean;
  entries: MyceliumZkpChainEntry[];
}

/* -------------------------------------------------------------------------- */
/*  ISA-18.2 Live Alerting & Kompatibilitets-kontrakter (Trin 2 / Eksisterende) */
/* -------------------------------------------------------------------------- */

export type MyceliumAlarmPriority =
  | 'P1_KRITISK_ALGEDONISK'
  | 'P2_FORHØJET_VARSEL'
  | 'P3_ADVISERING'
  | 'NORMAL_HOMEOSTASE';

export type BftGate1Verdict =
  | 'BFT_KONSENSUS_GODKENDT'
  | 'BFT_BYZANTINSK_AFVIST'
  | 'BFT_AFVENTER_KVORUM'
  | 'BFT_NOMINEL';

export type Eu868SubBandMode = 'G1_868_1MHZ_1PCT' | 'G3_869_525MHZ_10PCT_ALGEDONIC';
export type Eu868DutyStatus = 'NOMINAL_1PCT' | 'ADAPTIVE_SF_THROTTLE' | 'G3_ALGEDONIC_EMERGENCY_BYPASS';
export type CikResourceKey = 'water_mist_l_min' | 'hepa_h14_m3_h' | 'acoustic_barriers_m2' | 'crawlspace_membrane_m2' | 'rehousing_units';
export type ApoptosisLifecycleStage = 'AKTIV_NØDPROTOKOL' | 'NEDTÆLLING_TIL_APOPTOSE' | 'APOPTOSE_GENNEMFØRT_HOMEOSTASE' | 'DISPENSATION_OPHÆVET_STRAKS';

export interface BftGate1NodeAudit {
  nodeId: string; receptorId: string; receptorCode: string; receptorName: string; position: LatLngPoint;
  isDisabledOffline: boolean; hasInjectedByzantineFault: boolean; reportedSumQuotient: number;
  physicalExpectedSumQuotient: number; reportedLafmaxDb: number; totalCommitteePeers: number;
  maxToleratedFaultsF: number; corroboratingHonestPeers: number; quorumRequiredCount: number;
  verdict: BftGate1Verdict; verdictLabelDa: string; forensicAuditDa: string;
}

export interface Eu868LoraNodeMetrics {
  nodeId: string; receptorId: string; receptorCode: string; spreadingFactor: 7 | 8 | 9 | 10 | 11 | 12;
  bandwidthKhz: 125; payloadBytes: number; timeOnAirMs: number; packetsPerHour: number;
  airtimeUsedMsPerHour: number; dutyCycleLimitPct: number; dutyCycleUtilizedPct: number;
  subBand: Eu868SubBandMode; dutyStatus: Eu868DutyStatus; rssiDbm: number; snrDb: number;
}

export interface DijkstraSelfHealingRoute {
  originNodeId: string; originReceptorId: string; originCode: string; gatewayNodeId: string;
  gatewayReceptorId: string; gatewayCode: string; isReachable: boolean; hopCount: number;
  pathReceptorIds: string[]; pathCodes: string[]; pathCoordinates: LatLngPoint[];
  totalDistanceMeters: number; etxTotalCost: number; endToEndLatencyMs: number;
  isSelfHealedReroute: boolean; bypassedFailedNodeCodes: string[];
}

export interface Cik20ResourcePoolSpec {
  key: CikResourceKey; labelDa: string; unit: string; totalAvailableCapacity: number;
  allocatedAmount: number; reserveAmount: number; colorHex: string;
}

export interface Cik20SectorAllocationLink {
  linkId: string; resourceKey: CikResourceKey; resourceLabelDa: string; unit: string;
  targetReceptorId: string; targetCode: string; targetName: string; allocatedPhysicalUnits: number;
  shareOfPoolPct: number; urgencyWeight: number; colorHex: string;
}

export interface Cik20AllocationState {
  activeUrgentReceptorCount: number; systemEfficiencyPct: number; pools: Cik20ResourcePoolSpec[];
  links: Cik20SectorAllocationLink[]; summaryDa: string;
}

export interface RegulatoryApoptosisRule {
  ruleId: string; titleDa: string; statutoryRefDa: string; stage: ApoptosisLifecycleStage;
  triggerConditionDa: string; dissolutionConditionDa: string; stabilityProgressPct: number;
  remainingRelaxationHours: number; forensicNoteDa: string;
}

export interface RegulatoryApoptosisState {
  overallStage: ApoptosisLifecycleStage; consecutiveHomeostasisHours: number;
  requiredHomeostasisHours: number; dryDemolitionPermitRevoked: boolean; rules: RegulatoryApoptosisRule[];
}

export interface MyceliumSimulationInput {
  mesh: AutonomousReceptorMeshNetwork; receptors: ReceptorZone[]; sources: DemolitionSourceNode[];
  receptorExposures: ReceptorExposureResult[]; observations: AlgedonicObservation[];
  currentWeather: HourlyWeatherPoint; weatherHours?: HourlyWeatherPoint[]; machineNoiseOutputDb: number;
  disabledNodeIds: Record<string, boolean>; byzantineFaultNodeIds: Record<string, boolean>;
}

export interface MyceliumNetworkSimulationSnapshot {
  gatewayReceptorId: string; gatewayCode: string; gatewayPosition: LatLngPoint;
  onlineNodeCount: number; offlineNodeCount: number; selfHealedRouteCount: number;
  bftApprovedAlertCount: number; bftRejectedByzantineCount: number; meanEu868DutyUtilizedPct: number;
  bftAudits: BftGate1NodeAudit[]; bftByReceptorId: Record<string, BftGate1NodeAudit>;
  loraMetrics: Eu868LoraNodeMetrics[]; loraByReceptorId: Record<string, Eu868LoraNodeMetrics>;
  dijkstraRoutes: DijkstraSelfHealingRoute[]; cik20: Cik20AllocationState;
  apoptosis: RegulatoryApoptosisState; biocyberneticState?: MyceliumNetworkSimulationState;
}

export interface Isa182HysteresisConfig {
  p1TriggerS: number; p1ClearS: number; p2TriggerS: number; p2ClearS: number;
  p1TriggerLafmaxDb: number; p1ClearLafmaxDb: number; cooldownMs: number; scrubbingSettleMs: number;
}

/** Varslingsprofil for Management by Exception (Calmer Defaults vs. Strict Forensic). */
export type MyceliumAlertProfile = 'calmer_defaults' | 'strict_forensic';

/** Kategorier af overvågede farer pr. node i ISA-18.2 hysterese-latchen. */
export type MyceliumHazardType =
  | 'sum_quotient_s'
  | 'airborne_asbestos'
  | 'high_wind'
  | 'crater_offline'
  | 'regulatory_apoptosis'
  | 'byzantine_spoof_blocked';

/** Alvorlighedsgrad for en live Mycelie-notifikation. */
export type MyceliumLiveNotificationSeverity = 'CRITICAL_P1' | 'ELEVATED_ORANGE' | 'CYBERNETIC_INFO';

/** Filtrerings- og støjelimineringstællere for ISA-18.2 & Gate 1. */
export interface MyceliumSuppressedStats {
  emittedCount: number;
  destroyedByGate1Count: number;
  suppressedByHysteresisCount: number;
  suppressedByScrubbingCount: number;
}

/** Struktureret live-notifikation til Dual-Channel Dispatcher & Toast Overlay. */
export interface MyceliumLiveNotification {
  id: string; createdAtMs: number; timestampIso: string;
  nodeId: string; nodeCode: string; nodeName: string;
  hazardType: MyceliumHazardType; severity: MyceliumLiveNotificationSeverity;
  titleDa: string; messageDa: string;
  zkpProofHash: string; sbtTokenId: string; gate1Passed: boolean;
  measuredSumQuotientS: number; measuredAsbestosFibersCm3: number; measuredWindSpeedMs: number;
  allocatedEnergyJoules: number; allocatedWaterMistKg: number; allocatedHepaM3h: number;
  acknowledged: boolean;
}

export interface MyceliumLiveAlertItem {
  id: string; createdAtMs: number; timestampIso: string; hourLabel: string; priority: MyceliumAlarmPriority;
  receptorId: string; receptorCode: string; receptorName: string; sumQuotient: number; lafmaxDb: number;
  bftVerdict: BftGate1Verdict; loraSubBand: Eu868SubBandMode; hopCount: number; isSelfHealedRoute: boolean;
  headlineDa: string; detailDa: string; statutoryRefDa: string; acknowledged: boolean; resolvedByHysteresis: boolean;
}

export interface MyceliumNotificationChannelStatus {
  isCrossOriginIframe: boolean; browserNotificationSupported: boolean;
  browserPermission: 'granted' | 'denied' | 'default' | 'iframe_blocked';
  webAudioAvailable: boolean; audioMuted: boolean; isScrubbingSuppressed: boolean;
}

/** 3 prækonfigurerede Algedoniske Simultan-Simuleringsscenarier (S1 + S3) + Live Auto-Trigger. */
export type AlgedonicTestScenarioId =
  | 'kierulffsvej_eternit_rupture'
  | 'asbestos_plume_cav_vacuum'
  | 'combined_vibration_rupture_plume';

export interface AlgedonicScenarioSpec {
  id: AlgedonicTestScenarioId;
  shortTitleDa: string;
  titleDa: string;
  subtitleDa: string;
  statutoryRefDa: string;
}

export interface SimultaneousAlgedonicTriggerConditions {
  anyTriggered: boolean;
  triggerCount: number;
  outdoorSumQuotientBreach: boolean; // a) S_out >= 0.8 (BEK 613/2026)
  outdoorSumQuotientValue: number;
  indoorCavVacuumBreach: boolean; // b) S_in >= 0.8 eller ΔP_CAV < -25 Pa
  indoorSumQuotientValue: number;
  deltaPCavPa: number;
  highWindImpulseNoiseBreach: boolean; // c) L_AFmax > 85 dB(A) under højvind
  impulseLafmaxDb: number;
  windSpeedMs: number;
  waterMainRuptureOrVibrationBreach: boolean; // d) Tryk < 1.5 bar, brud eller kritisk PPV
  waterMainPressureBar: number;
  waterMainPpvMmS: number;
  activeTriggerReasonsDa: string[];
}

export interface Gate1ConsensusValidationSummary {
  passed: boolean;
  byzantineFaultToleranceFormula: 'n >= 3f + 1';
  totalNodes: number;
  corroboratingNodes: number;
  corroborationPct: number;
  maxToleratedFaultsF: number;
  rejectedCryWolfCount: number;
  rejectedStatusCode: 'VARIANCE_INJECTION_DESTROYED_LOCALLY';
  zkpRightToOpacityHash: string;
  zkpAnonymousReporterCount: number;
  summaryDa: string;
}

export interface SimultaneousAlgedonicEscapeVector {
  id: string;
  labelDa: string;
  streetName: string;
  origin: LatLngPoint;
  targetMusterPoint: LatLngPoint;
  distanceMeters: number;
  bearingDeg: number;
}

export interface SimultaneousAlgedonicSystem1State {
  status: 'ACTIVE_EVACUATE_SHELTER' | 'ACKNOWLEDGED_SOLID' | 'STANDBY';
  epicenter: LatLngPoint;
  epicenterLabelDa: string;
  dangerRadiusMeters: number;
  dangerPolygon: LatLngPoint[];
  plumeDirectionDeg: number;
  upwindEscapeBearingDeg: number;
  escapeVectors: SimultaneousAlgedonicEscapeVector[];
  islandModeBlockIds: string[];
  islandModeBlockLabels: string[];
  workerOrderDa: string;
  residentOrdersDa: string[];
  isa182ShapeTag: 'INVERTED_OCTAGON_P1';
}

export interface SimultaneousAlgedonicTankerCorridor {
  id: string;
  streetName: string;
  status: 'OPEN_INGRESS' | 'BLOCKED_CLOSED';
  waypoints: LatLngPoint[];
  noteDa: string;
}

export interface SimultaneousAlgedonicStatutoryNotice {
  id: string;
  authorityDa: string;
  statuteRef: string;
  titleDa: string;
  summaryDa: string;
  deadlineDa: string;
}

export interface SimultaneousAlgedonicHaltedMachine {
  id: string;
  nameDa: string;
  interlockRuleDa: string;
  status: 'LOCKED_OUT';
}

export interface SimultaneousAlgedonicSystem3State {
  status: 'ACTIVE_BRAKE_LOCKOUT' | 'STANDBY';
  lockedValveCodes: Array<'V-VEST' | 'V-MIDT'>;
  sectioningStatuteDa: string;
  waterLossPreventedM3: number;
  haltedMachines: SimultaneousAlgedonicHaltedMachine[];
  cavForcedSafeMode: 'balanced_hepa_overpress';
  cavPreviousModeLabelDa: string;
  tankerIngressCorridors: SimultaneousAlgedonicTankerCorridor[];
  statutoryNotices: SimultaneousAlgedonicStatutoryNotice[];
  linkedSha256ObservationCode?: string;
  linkedSha256Signature?: string;
}

export interface SimultaneousAlgedonicDispatch {
  eventId: string;
  scenarioId: AlgedonicTestScenarioId | 'live_auto_trigger';
  scenarioTitleDa: string;
  active: boolean;
  acknowledged: boolean;
  acknowledgedAtIso: string | null;
  isBlinkingP1: boolean;
  t0DetectedIso: string;
  t0EpochMs: number;
  t1DispatchedIso: string;
  t1DispatchedEpochMs: number;
  latencyMs: number;
  bureaucraticDelayDeltaTMs: 0;
  relaxationTimeBeforeHours: 18.5;
  relaxationTimeAfterHours: number;
  crisisIntervalDtHours: number;
  systemicTetanusEliminated: boolean;
  triggers: SimultaneousAlgedonicTriggerConditions;
  gate1Validation: Gate1ConsensusValidationSummary;
  system1State: SimultaneousAlgedonicSystem1State;
  system3State: SimultaneousAlgedonicSystem3State;
}

/** Tidsstemplet historikpost for aktiverede System B Mycelium nødbremse-hændelser (S1+S3 simultan-dispatch). */
export interface SimultaneousEmergencyBrakeLogEntry {
  id: string;
  observationCode: string;
  eventId: string;
  scenarioId: AlgedonicTestScenarioId | 'live_auto_trigger';
  scenarioTitleDa: string;
  t0DetectedIso: string;
  t1DispatchedIso: string;
  dispatchedTimeLabel: string;
  latencyMs: number;
  bureaucraticDelayDeltaTMs: 0;
  corroboratingNodes: number;
  totalNodes: number;
  corroborationPct: number;
  lockedValveCodes: Array<'V-VEST' | 'V-MIDT'>;
  islandModeBlockCount: number;
  haltedMachineCount: number;
  zkpRightToOpacityHash: string;
  sha256Signature: string;
  triggerReasonsDa: string[];
  acknowledged: boolean;
  acknowledgedAtIso: string | null;
}


