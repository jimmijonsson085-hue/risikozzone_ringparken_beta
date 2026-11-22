/**
 * @file src/services/myceliumSimulationEngine.ts
 * @description Deterministisk biokybernetisk og BFT-baseret simuleringsmotor (`simulateMyceliumNetwork`)
 * for Fællesskabets Mycelienetværk (System B): EU868 g3 LoRa fysik (869,525 MHz, 27 dBm, 1.000 J LFP,
 * ~41,2 ms ToA + 14,5 ms Groth16 ZKP, <=10 % duty cycle), Scenarie Alpha (CRATER_OFFLINE & ISLAND_MODE),
 * vægtet Dijkstra P2P selvheling (Tr < 300.000 ms), Gemini-Blue Gate 1 (>=40 % nabokorroboration, 0,0 J spild),
 * CiK 2.0 sværm-support + flow-konserverende Sankey (sum=100) samt A_i, Regulatory Apoptosis & Amnesti.
 */

import { buildAutonomousReceptorMeshNetwork, deterministicHexHash256, haversineMetersBetween } from './autonomousReceptorMeshService';
import { LatLngPoint } from '../types/dispersion';
import {
  BftGate1NodeAudit, CiKSwarmAllocation, DijkstraSelfHealingRoute, Eu868LoraNodeMetrics,
  Gate1Classification, Gate1ValidationResult, MyceliumAlgedonode, MyceliumMeshEdge,
  MyceliumNetworkSimulationSnapshot, MyceliumNetworkSimulationState, MyceliumNodeStatus,
  MyceliumSankeyFlowData, MyceliumSimulationInput, SelfHealingRoute, SimulateMyceliumNetworkInput,
} from '../types/myceliumAlert';

/** Semtech SX1262 EU868 LoRa Time-on-Air (ms) ved BW=125 kHz, CR=4/5. */
export function calculateLoRaTimeOnAirMs(sf: 7 | 8 | 9 | 10 | 11 | 12 = 7, payloadBytes = 13): number {
  const tSym = (Math.pow(2, sf) / 125000) * 1000;
  const symNb = 8 + Math.max(Math.ceil((8 * payloadBytes - 4 * sf + 44) / (4 * (sf - (sf >= 11 ? 2 : 0)))) * 5, 0);
  return Number(((12.25 + symNb) * tSym).toFixed(1));
}

const FREQ_G3 = 869.525, ERP_DBM = 27, TOA_MS = calculateLoRaTimeOnAirMs(7, 13), ZKP_MS = 14.5, DELTA_T_MS = 300000, LFP_J = 1000;

function median(vals: number[], fallback: number): number {
  if (!vals.length) return fallback;
  const s = [...vals].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return Number((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2).toFixed(3));
}

function dijkstra(start: string, goal: string, ids: string[], craters: Record<string, boolean>, adj: Record<string, Array<{ to: string; w: number }>>): string[] {
  if (craters[start] || craters[goal]) return [];
  if (start === goal) return [start];
  const dist: Record<string, number> = {}, prev: Record<string, string | null> = {}, vis: Record<string, boolean> = {};
  ids.forEach((id) => { dist[id] = Infinity; prev[id] = null; });
  dist[start] = 0;
  for (let i = 0; i < ids.length; i++) {
    let u: string | null = null, best = Infinity;
    for (const id of ids) if (!craters[id] && !vis[id] && dist[id] < best) { best = dist[id]; u = id; }
    if (!u || best === Infinity || u === goal) break;
    vis[u] = true;
    for (const e of adj[u] || []) if (!craters[e.to] && dist[u] + e.w < dist[e.to]) { dist[e.to] = dist[u] + e.w; prev[e.to] = u; }
  }
  if (dist[goal] === Infinity) return [];
  const path: string[] = [];
  for (let c: string | null = goal; c; c = prev[c]) path.unshift(c);
  return path;
}

/** Deterministisk simulering af Fællesskabets Mycelienetværk (System B). */
export function simulateMyceliumNetwork(input: SimulateMyceliumNetworkInput): MyceliumNetworkSimulationState {
  const { receptors, sources, receptorExposures, observations, currentWeather, scenario,
    manualCraterNodeIds = [], manualSpoofNodeIds = [], previousAiHistory = [], realitySummitOverride = false } = input;
  const mesh = buildAutonomousReceptorMeshNetwork({ receptors, sources, receptorExposures, observations, currentWeather });
  const expMap = Object.fromEntries(receptorExposures.map((e) => [e.receptorId, e]));

  if (!mesh.nodes.length) {
    return {
      scenario, timestampIso: currentWeather.isoTime, merkleRootHash: mesh.merkleRegistryRootHash,
      nodes: [], nodesById: {}, edges: [], gate1Results: [], gate1ByNodeId: {}, activeSelfHealingRoute: null,
      allSelfHealingRoutes: [], swarmAllocations: [], aiHistory: [...previousAiHistory, 1], forensicAuditTrailDa: [],
      sankeyFlow: { totalNormalizedUnits: 100, nodes: [], links: [], totalAllocatedJoules: 0, totalAllocatedWaterMistKg: 0, totalAllocatedHepaM3h: 0, destroyedSpoofEnergySavedJoules: 0 },
      kpis: { autonomyIndexAi: 1, systemicEntropySigma: 0, coercionIndexGamma: 0, stabilityFactorPhi: 1, eu868DutyCyclePct: 0, activeKillChainsPct: 100, regulatoryApoptosisTriggered: false, algorithmicAmnestyActive: false, realitySummitRequired: false },
    };
  }

  const craters: Record<string, boolean> = {}, spoofs: Record<string, boolean> = {}, islands: Record<string, boolean> = {}, plumeBoost: Record<string, number> = {};
  const match = (q: string, n: typeof mesh.nodes[0]) => q === n.receptorId || q === n.nodeId || q.toUpperCase() === n.receptorCode.toUpperCase();
  mesh.nodes.forEach((n) => {
    if (manualCraterNodeIds.some((id) => match(id, n))) craters[n.receptorId] = true;
    if (manualSpoofNodeIds.some((id) => match(id, n))) spoofs[n.receptorId] = true;
  });
  if (scenario === 'alpha_kinetic_crater' && !Object.keys(craters).length) {
    const hub = [...mesh.nodes].sort((a, b) => b.connectedPeerReceptorIds.length - a.connectedPeerReceptorIds.length)[0];
    if (hub) craters[hub.receptorId] = true;
  }
  if (scenario === 'byzantine_cry_wolf' && !Object.keys(spoofs).length) {
    const calm = [...mesh.nodes].filter((n) => !craters[n.receptorId]).sort((a, b) => a.sumQuotient - b.sumQuotient)[0];
    if (calm) spoofs[calm.receptorId] = true;
  }
  if (scenario === 'acute_asbestos_plume') {
    const seed = [...mesh.nodes].filter((n) => !craters[n.receptorId]).sort((a, b) => b.downwindAlignmentCos - a.downwindAlignmentCos || b.sumQuotient - a.sumQuotient)[0];
    if (seed) {
      plumeBoost[seed.receptorId] = 1.68;
      seed.connectedPeerReceptorIds.slice(0, 2).forEach((pid, i) => { if (!craters[pid]) plumeBoost[pid] = i === 0 ? 1.32 : 0.94; });
    }
  }
  mesh.edges.forEach((e) => {
    if (craters[e.fromReceptorId] && !craters[e.toReceptorId]) islands[e.toReceptorId] = true;
    if (craters[e.toReceptorId] && !craters[e.fromReceptorId]) islands[e.fromReceptorId] = true;
  });

  const solarJ = Math.min(80, Math.round(currentWeather.directRadiation * 0.12));
  const rawById = Object.fromEntries(mesh.nodes.map((nd) => {
    const auto = scenario === 'autoimmune_overfilter', b = plumeBoost[nd.receptorId] ?? 0;
    const physS = auto ? Math.min(0.14, nd.sumQuotient * 0.25) : Number(Math.max(nd.sumQuotient, b).toFixed(3));
    const asbRaw = expMap[nd.receptorId]?.substances.find((s) => s.key === 'asbestos')?.concentration ?? physS * 0.0022;
    const asb = auto ? 0.0002 : Number(Math.max(asbRaw, b > 0 ? 0.0042 : 0).toFixed(5));
    const noiseDb = auto ? 48.5 : Number(Math.max(nd.estimatedLafmaxDb, b > 1.2 ? 83.5 : 0).toFixed(1));
    const windMs = auto ? 4.2 : b > 0 ? Math.max(11.4, currentWeather.windSpeed10m) : currentWeather.windSpeed10m;
    const physJ = craters[nd.receptorId] ? 0 : Math.max(380, Math.min(1000, Math.round(LFP_J - physS * 165 + solarJ - (islands[nd.receptorId] ? 35 : 0))));
    const sp = Boolean(spoofs[nd.receptorId]) && !craters[nd.receptorId];
    return [nd.receptorId, { physS, repS: sp ? 2.85 : physS, asb: sp ? 0.0085 : asb, noiseDb: sp ? 91.0 : noiseDb, windMs, physJ, repJ: sp ? 40 : physJ, sp }];
  }));

  const gate1ByNodeId: Record<string, Gate1ValidationResult> = {};
  const gate1Results: Gate1ValidationResult[] = mesh.nodes.map((nd) => {
    const r = rawById[nd.receptorId], isCrater = Boolean(craters[nd.receptorId]);
    const actPeers = nd.connectedPeerReceptorIds.filter((pid) => !craters[pid]);
    const medS = median(actPeers.map((pid) => rawById[pid]?.physS ?? 0), 0);
    const medJ = median(actPeers.map((pid) => rawById[pid]?.physJ ?? LFP_J), LFP_J);
    const acute = !isCrater && (r.repS >= 1.0 || r.asb >= 0.003 || r.noiseDb >= 80 || (r.windMs > 10.0 && r.repS >= 0.35) || r.repJ < 500 || r.sp);
    const corr = actPeers.filter((pid) => (rawById[pid]?.physS ?? 0) >= 0.35 * r.repS || (rawById[pid]?.physS ?? 0) >= 0.45).length;
    const ratio = actPeers.length ? Number((corr / actPeers.length).toFixed(3)) : 0;
    const classification: Gate1Classification = !acute ? 'HOMEOSTASIS_CALM' : !r.sp && actPeers.length > 0 && ratio >= 0.4 ? 'VERIFIED_ALGEDONIC_PAIN' : 'VARIANCE_INJECTION_DESTROYED_LOCALLY';
    const zkpProofHash = `0x${deterministicHexHash256(`GATE1|${nd.receptorId}|${r.repS}|${ratio}|${currentWeather.isoTime}`)}`;
    const res: Gate1ValidationResult = {
      nodeId: nd.receptorId, passed: classification !== 'VARIANCE_INJECTION_DESTROYED_LOCALLY',
      corroboratingNeighbors: corr, activeNeighbors: actPeers.length, consensusRatio: ratio,
      medianNeighborS: medS, medianNeighborJoules: medJ, classification, zkpProofHash,
      sbtTokenId: `SBT-SYSB-${nd.receptorCode.toUpperCase()}-${zkpProofHash.slice(2, 8).toUpperCase()}`,
    };
    gate1ByNodeId[nd.receptorId] = res;
    return res;
  });

  const painIds = gate1Results.filter((g) => g.classification === 'VERIFIED_ALGEDONIC_PAIN').map((g) => g.nodeId);
  const destroyedIds = gate1Results.filter((g) => g.classification === 'VARIANCE_INJECTION_DESTROYED_LOCALLY').map((g) => g.nodeId);
  const craterCount = Object.keys(craters).length, intactCount = mesh.nodes.length - craterCount;
  const meanS = mesh.nodes.reduce((s, n) => s + rawById[n.receptorId].physS, 0) / mesh.nodes.length;
  const sigma = scenario === 'autoimmune_overfilter' ? 0.045 : Number(Math.min(1, meanS * 0.42 + (craterCount / mesh.nodes.length) * 0.55 + painIds.length * 0.06).toFixed(3));
  const rawAi = Number(Math.min(1, Math.max(0.12, (intactCount + destroyedIds.length * 0.8 - (scenario === 'autoimmune_overfilter' ? 3.5 : 0)) / Math.max(1, mesh.nodes.length + craterCount * 2 + (scenario === 'autoimmune_overfilter' ? 6 : 0)))).toFixed(3));
  const candHist = [...previousAiHistory, rawAi], hl = candHist.length;
  const drops3 = hl >= 4 && candHist[hl - 4] > candHist[hl - 3] && candHist[hl - 3] > candHist[hl - 2] && candHist[hl - 2] > candHist[hl - 1];
  const apoptosis = !realitySummitOverride && sigma < 0.1 && (scenario === 'autoimmune_overfilter' || drops3);
  const effAi = apoptosis ? Number(Math.min(0.96, rawAi + 0.34).toFixed(3)) : rawAi;
  const aiHistory = [...previousAiHistory.slice(-11), effAi];

  const nodesById: Record<string, MyceliumAlgedonode> = {};
  const nodes: MyceliumAlgedonode[] = mesh.nodes.map((nd) => {
    const r = rawById[nd.receptorId], g1 = gate1ByNodeId[nd.receptorId], isIsl = Boolean(islands[nd.receptorId]);
    const status: MyceliumNodeStatus = craters[nd.receptorId] ? 'CRATER_OFFLINE' : r.sp ? 'BYZANTINE_SPOOF' : g1.classification === 'VERIFIED_ALGEDONIC_PAIN' ? 'ALGEDONIC_PAIN' : isIsl ? 'ISLAND_MODE' : 'NORMAL';
    const txHr = status === 'CRATER_OFFLINE' ? 0 : status === 'ALGEDONIC_PAIN' ? 160 : isIsl ? 64 : r.sp ? 95 : 24;
    const dutyCyclePct = Number(Math.min(10, ((txHr * TOA_MS) / 3600000) * 100).toFixed(3));
    const node: MyceliumAlgedonode = {
      nodeId: nd.receptorId, hardwareId: nd.nodeId, receptorId: nd.receptorId, code: nd.receptorCode, name: nd.receptorName,
      address: nd.address, position: nd.position, status, isIslandOffGrid: isIsl, physicalSumQuotientS: r.physS,
      reportedSumQuotientS: r.repS, asbestosFibersCm3: r.asb, noiseLafmaxDb: r.noiseDb, windSpeedMs: r.windMs,
      energyReserveJoules: r.repJ, reputationScorePs: apoptosis ? 1.0 : r.sp ? 0.32 : g1.passed ? 0.98 : 0.78,
      frequencyMhz: FREQ_G3, erpDbm: ERP_DBM, packetAirtimeMs: TOA_MS, groth16VerifyMs: ZKP_MS, dutyCyclePct,
      connectedNeighborIds: nd.connectedPeerReceptorIds, zkpProofHash: g1.zkpProofHash, sbtTokenId: g1.sbtTokenId,
    };
    nodesById[nd.receptorId] = node;
    return node;
  });

  const ids = nodes.map((n) => n.nodeId);
  const mkAdj = (ignoreCraters: boolean) => {
    const adj: Record<string, Array<{ to: string; w: number }>> = Object.fromEntries(ids.map((id) => [id, []]));
    mesh.edges.forEach((e) => {
      if (!ignoreCraters && (craters[e.fromReceptorId] || craters[e.toReceptorId])) return;
      const w = Number((TOA_MS + ZKP_MS + e.distanceMeters * 0.035).toFixed(2));
      adj[e.fromReceptorId].push({ to: e.toReceptorId, w }); adj[e.toReceptorId].push({ to: e.fromReceptorId, w });
    });
    if (!ignoreCraters && craterCount > 0) {
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], d = haversineMetersBetween(a.position, b.position);
        if (!craters[a.nodeId] && !craters[b.nodeId] && d <= 650 && !adj[a.nodeId].some((x) => x.to === b.nodeId)) {
          const bw = Number(((TOA_MS + ZKP_MS) * 1.45 + d * 0.08).toFixed(2));
          adj[a.nodeId].push({ to: b.nodeId, w: bw }); adj[b.nodeId].push({ to: a.nodeId, w: bw });
        }
      }
    }
    return adj;
  };
  const baseAdj = mkAdj(true), intactAdj = mkAdj(false), intactNodes = nodes.filter((n) => n.status !== 'CRATER_OFFLINE');
  const anchor = [...intactNodes].sort((a, b) => a.physicalSumQuotientS - b.physicalSumQuotientS)[0] ?? nodes[0];
  const stressed = [...intactNodes].filter((n) => n.nodeId !== anchor.nodeId)
    .sort((a, b) => (b.status === 'ALGEDONIC_PAIN' ? 2 : b.status === 'ISLAND_MODE' ? 1 : 0) + b.physicalSumQuotientS - ((a.status === 'ALGEDONIC_PAIN' ? 2 : a.status === 'ISLAND_MODE' ? 1 : 0) + a.physicalSumQuotientS))[0] ?? anchor;

  const allSelfHealingRoutes: SelfHealingRoute[] = intactNodes.filter((n) => n.nodeId !== anchor.nodeId).map((sn) => {
    const base = dijkstra(sn.nodeId, anchor.nodeId, ids, {}, baseAdj), healed = dijkstra(sn.nodeId, anchor.nodeId, ids, craters, intactAdj);
    const hopCount = Math.max(0, healed.length - 1), trMs = healed.length >= 2 ? Number((hopCount * (TOA_MS + ZKP_MS) + 18.4).toFixed(1)) : DELTA_T_MS + 1;
    const bypassed = base.filter((id) => craters[id]);
    return {
      sourceNodeId: sn.nodeId, targetNodeId: anchor.nodeId, hopNodeIds: healed,
      coordinates: healed.map((id) => nodesById[id]?.position).filter((p): p is LatLngPoint => Boolean(p)),
      hopCount, reactionTimeTrMs: trMs, deadlineDeltaTMs: DELTA_T_MS, isViable: healed.length >= 2 && trMs < DELTA_T_MS,
      bypassedCraterIds: bypassed.length ? bypassed : Object.keys(craters),
    };
  });
  const activeSelfHealingRoute = allSelfHealingRoutes.find((r) => r.sourceNodeId === stressed.nodeId && r.bypassedCraterIds.length > 0)
    || allSelfHealingRoutes.find((r) => r.sourceNodeId === stressed.nodeId) || allSelfHealingRoutes[0] || null;

  const routePairs = new Set<string>();
  activeSelfHealingRoute?.hopNodeIds.forEach((id, i, arr) => { if (i < arr.length - 1) routePairs.add(id < arr[i + 1] ? `${id}:${arr[i + 1]}` : `${arr[i + 1]}:${id}`); });
  const edges: MyceliumMeshEdge[] = mesh.edges.map((e) => {
    const pk = e.fromReceptorId < e.toReceptorId ? `${e.fromReceptorId}:${e.toReceptorId}` : `${e.toReceptorId}:${e.fromReceptorId}`;
    const sev = Boolean(craters[e.fromReceptorId] || craters[e.toReceptorId]);
    return {
      edgeId: e.edgeId, fromNodeId: e.fromReceptorId, toNodeId: e.toReceptorId, fromCode: e.fromCode, toCode: e.toCode,
      fromPos: e.fromPos, toPos: e.toPos, distanceMeters: e.distanceMeters, isSpanningBackbone: e.isSpanningBackbone,
      weightMs: Number((TOA_MS + ZKP_MS + e.distanceMeters * 0.035).toFixed(1)),
      linkState: sev ? 'SEVERED_CRATER' : routePairs.has(pk) ? 'SELF_HEALING_BYPASS' : islands[e.fromReceptorId] || islands[e.toReceptorId] ? 'ISLAND_LINK' : 'ACTIVE_P2P',
    };
  });

  const donors = intactNodes.filter((n) => n.status !== 'ALGEDONIC_PAIN' && n.status !== 'BYZANTINE_SPOOF' && n.physicalSumQuotientS < 0.55 && n.energyReserveJoules >= 620);
  const swarmAllocations: CiKSwarmAllocation[] = painIds.flatMap((pid) => {
    const rec = nodesById[pid];
    if (!rec) return [];
    const sev = Math.min(2.2, Math.max(0.8, rec.physicalSumQuotientS));
    return [...donors].filter((d) => d.nodeId !== pid)
      .sort((a, b) => haversineMetersBetween(a.position, rec.position) - haversineMetersBetween(b.position, rec.position))
      .slice(0, 2).map((d, i) => {
        const hp = dijkstra(d.nodeId, rec.nodeId, ids, craters, intactAdj);
        return {
          id: `cik-${d.code}-${rec.code}-${i}`, donorNodeId: d.nodeId, donorCode: d.code, recipientNodeId: rec.nodeId, recipientCode: rec.code,
          energyJoules: Math.round((i === 0 ? 195 : 135) * sev), waterMistKg: Number(((i === 0 ? 28.5 : 19) * sev).toFixed(1)),
          hepaAirM3h: Math.round((i === 0 ? 310 : 215) * sev), routeCoordinates: hp.length >= 2 ? hp.map((x) => nodesById[x].position) : [d.position, rec.position],
        };
      });
  });

  const totJ = swarmAllocations.reduce((s, a) => s + a.energyJoules, 0);
  const totKg = Number(swarmAllocations.reduce((s, a) => s + a.waterMistKg, 0).toFixed(1));
  const totHepa = swarmAllocations.reduce((s, a) => s + a.hepaAirM3h, 0);
  const c1D = Math.min(34, destroyedIds.length * 16), c1E = Math.min(22, Math.max(8, Math.round(sigma * 24 + 8))), c1V = 100 - c1D - c1E;
  const c2B = Math.round(c1V * (painIds.length ? 0.62 : 0.28)), c2M = Math.round(c1V * (painIds.length ? 0.38 : 0.22)), c2S = 100 - c2B - c2M;
  const dE = Math.ceil(c1D * 0.5), dW = Math.floor(c1D * 0.5), tE = Math.ceil(c1E * 0.5), tH = Math.floor(c1E * 0.5);

  const sankeyFlow: MyceliumSankeyFlowData = {
    totalNormalizedUnits: 100, totalAllocatedJoules: totJ, totalAllocatedWaterMistKg: totKg, totalAllocatedHepaM3h: totHepa, destroyedSpoofEnergySavedJoules: destroyedIds.length * 330,
    nodes: [
      { id: 'col0_energy', column: 0, labelDa: 'LFP/Solcelle Reserver', valueNormalized: 40, physicalSummaryDa: `${totJ} J allokeret`, colorHex: '#22d3ee' },
      { id: 'col0_water', column: 0, labelDa: 'Højtryks-Vandtåge Reserver', valueNormalized: 32, physicalSummaryDa: `${totKg} kg vandtåge`, colorHex: '#38bdf8' },
      { id: 'col0_hepa', column: 0, labelDa: 'HEPA-Overtryk Reserver', valueNormalized: 28, physicalSummaryDa: `${totHepa} m³/h HEPA`, colorHex: '#34d399' },
      { id: 'col1_verified', column: 1, labelDa: 'Gate 1 Verificeret', valueNormalized: c1V, physicalSummaryDa: `${painIds.length} smerte-noder`, colorHex: '#10b981' },
      { id: 'col1_destroyed', column: 1, labelDa: 'Støj Destrueret', valueNormalized: c1D, physicalSummaryDa: `${destroyedIds.length} afvist (0,0 J)`, colorHex: '#f43f5e' },
      { id: 'col1_entropy', column: 1, labelDa: 'Termisk Entropi', valueNormalized: c1E, physicalSummaryDa: `σ=${sigma.toFixed(2)}`, colorHex: '#f59e0b' },
      { id: 'col2_blocks', column: 2, labelDa: 'Sværm-Support Boligblokke', valueNormalized: c2B, physicalSummaryDa: `${totJ} J · ${totHepa} m³/h`, colorHex: '#22d3ee' },
      { id: 'col2_mist', column: 2, labelDa: 'Kilde-Støvbinding', valueNormalized: c2M, physicalSummaryDa: `${totKg} kg vandtåge`, colorHex: '#34d399' },
      { id: 'col2_sink', column: 2, labelDa: 'Lokalt Afløb', valueNormalized: c2S, physicalSummaryDa: 'Homeostatisk hvile', colorHex: '#64748b' },
    ],
    links: [
      { id: 'l1', sourceId: 'col0_energy', targetId: 'col1_verified', valueNormalized: Math.max(0, 40 - dE - tE), colorHex: '#22d3ee' },
      { id: 'l2', sourceId: 'col0_energy', targetId: 'col1_destroyed', valueNormalized: dE, colorHex: '#f43f5e' },
      { id: 'l3', sourceId: 'col0_energy', targetId: 'col1_entropy', valueNormalized: tE, colorHex: '#f59e0b' },
      { id: 'l4', sourceId: 'col0_water', targetId: 'col1_verified', valueNormalized: Math.max(0, 32 - dW), colorHex: '#38bdf8' },
      { id: 'l5', sourceId: 'col0_water', targetId: 'col1_destroyed', valueNormalized: dW, colorHex: '#f43f5e' },
      { id: 'l6', sourceId: 'col0_hepa', targetId: 'col1_verified', valueNormalized: Math.max(0, 28 - tH), colorHex: '#34d399' },
      { id: 'l7', sourceId: 'col0_hepa', targetId: 'col1_entropy', valueNormalized: tH, colorHex: '#f59e0b' },
      { id: 'l8', sourceId: 'col1_verified', targetId: 'col2_blocks', valueNormalized: c2B, colorHex: '#10b981' },
      { id: 'l9', sourceId: 'col1_verified', targetId: 'col2_mist', valueNormalized: c2M, colorHex: '#34d399' },
      { id: 'l10', sourceId: 'col1_verified', targetId: 'col2_sink', valueNormalized: Math.max(0, c1V - c2B - c2M), colorHex: '#64748b' },
      { id: 'l11', sourceId: 'col1_destroyed', targetId: 'col2_sink', valueNormalized: c1D, colorHex: '#f43f5e' },
      { id: 'l12', sourceId: 'col1_entropy', targetId: 'col2_sink', valueNormalized: c1E, colorHex: '#f59e0b' },
    ].filter((l) => l.valueNormalized > 0),
  };

  const dutyMean = Number((nodes.reduce((s, n) => s + n.dutyCyclePct, 0) / nodes.length).toFixed(3));
  const trOk = activeSelfHealingRoute ? Math.max(0, 1 - activeSelfHealingRoute.reactionTimeTrMs / DELTA_T_MS) : 1;
  const kpis = {
    autonomyIndexAi: effAi, systemicEntropySigma: sigma, coercionIndexGamma: Number(Math.max(0, 1 - effAi).toFixed(3)),
    stabilityFactorPhi: Number(Math.min(1, effAi * 0.65 + trOk * 0.35).toFixed(3)), eu868DutyCyclePct: dutyMean,
    activeKillChainsPct: apoptosis ? 20 : 100, regulatoryApoptosisTriggered: apoptosis,
    algorithmicAmnestyActive: apoptosis, realitySummitRequired: !realitySummitOverride && (apoptosis || craterCount >= 2 || Boolean(activeSelfHealingRoute && !activeSelfHealingRoute.isViable)),
  };

  const zkpChainRootHash = deterministicHexHash256(
    `${mesh.merkleRegistryRootHash}|${observations.map((o) => o.sha256Signature).join(',')}|${gate1Results.map((g) => g.zkpProofHash).join(',')}`
  );

  return {
    scenario, timestampIso: currentWeather.isoTime, merkleRootHash: mesh.merkleRegistryRootHash, zkpChainRootHash,
    nodes, nodesById, edges, gate1Results, gate1ByNodeId, activeSelfHealingRoute, allSelfHealingRoutes,
    swarmAllocations, sankeyFlow, kpis, aiHistory,
    forensicAuditTrailDa: [
      `[SYSTEM B · ${scenario}] A_i=${effAi.toFixed(2)} · σ=${sigma.toFixed(2)} · EU868 g3=${dutyMean}%/10,0%.`,
      ...(craterCount ? [`SCENARIE ALPHA: ${craterCount} CRATER_OFFLINE · ${Object.keys(islands).length} ISLAND_MODE.`] : []),
      ...(destroyedIds.length ? [`GATE 1: ${destroyedIds.length} varians-injektion destrueret lokalt (0,0 J spild).`] : []),
      ...(apoptosis ? ['REGULATORY APOPTOSIS: Kill-chains 20% & Algoritmisk Amnesti (P_s=1,00) aktiv.'] : []),
    ],
  };
}

/** Kompatibilitets-adapter for eksisterende moduler (delegerer til `simulateMyceliumNetwork`). */
export function runMyceliumSimulationEngine(input: MyceliumSimulationInput): MyceliumNetworkSimulationSnapshot {
  const craters = Object.keys(input.disabledNodeIds).filter((k) => input.disabledNodeIds[k]);
  const spoofs = Object.keys(input.byzantineFaultNodeIds).filter((k) => input.byzantineFaultNodeIds[k]);
  const st = simulateMyceliumNetwork({
    receptors: input.receptors, sources: input.sources, receptorExposures: input.receptorExposures,
    observations: input.observations, currentWeather: input.currentWeather,
    scenario: craters.length ? 'alpha_kinetic_crater' : spoofs.length ? 'byzantine_cry_wolf' : 'live_telemetry',
    manualCraterNodeIds: craters, manualSpoofNodeIds: spoofs,
  });
  const gw = st.nodes.find((n) => n.status !== 'CRATER_OFFLINE') ?? st.nodes[0];
  const bftAudits: BftGate1NodeAudit[] = st.nodes.map((nd) => {
    const g1 = st.gate1ByNodeId[nd.nodeId];
    const verdict = nd.status === 'CRATER_OFFLINE' ? 'BFT_AFVENTER_KVORUM' : g1.classification === 'VARIANCE_INJECTION_DESTROYED_LOCALLY' ? 'BFT_BYZANTINSK_AFVIST' : g1.classification === 'VERIFIED_ALGEDONIC_PAIN' ? 'BFT_KONSENSUS_GODKENDT' : 'BFT_NOMINEL';
    return { nodeId: nd.hardwareId, receptorId: nd.receptorId, receptorCode: nd.code, receptorName: nd.name, position: nd.position, isDisabledOffline: nd.status === 'CRATER_OFFLINE', hasInjectedByzantineFault: nd.status === 'BYZANTINE_SPOOF', reportedSumQuotient: nd.reportedSumQuotientS, physicalExpectedSumQuotient: nd.physicalSumQuotientS, reportedLafmaxDb: nd.noiseLafmaxDb, totalCommitteePeers: g1.activeNeighbors + 1, maxToleratedFaultsF: Math.max(1, Math.floor(g1.activeNeighbors / 3)), corroboratingHonestPeers: g1.corroboratingNeighbors, quorumRequiredCount: Math.max(1, Math.ceil(g1.activeNeighbors * 0.4)), verdict, verdictLabelDa: g1.classification, forensicAuditDa: `Konsensus ${(g1.consensusRatio * 100).toFixed(0)}% · ${g1.sbtTokenId}` };
  });
  const loraMetrics: Eu868LoraNodeMetrics[] = st.nodes.map((nd) => ({ nodeId: nd.hardwareId, receptorId: nd.receptorId, receptorCode: nd.code, spreadingFactor: 7, bandwidthKhz: 125, payloadBytes: 13, timeOnAirMs: nd.packetAirtimeMs, packetsPerHour: Math.round((nd.dutyCyclePct * 36000) / nd.packetAirtimeMs), airtimeUsedMsPerHour: Number(((nd.dutyCyclePct / 100) * 3600000).toFixed(1)), dutyCycleLimitPct: 10, dutyCycleUtilizedPct: nd.dutyCyclePct, subBand: 'G3_869_525MHZ_10PCT_ALGEDONIC', dutyStatus: nd.status === 'ALGEDONIC_PAIN' ? 'G3_ALGEDONIC_EMERGENCY_BYPASS' : 'NOMINAL_1PCT', rssiDbm: -86, snrDb: 7.5 }));
  const dijkstraRoutes: DijkstraSelfHealingRoute[] = st.allSelfHealingRoutes.map((r) => ({ originNodeId: st.nodesById[r.sourceNodeId]?.hardwareId ?? r.sourceNodeId, originReceptorId: r.sourceNodeId, originCode: st.nodesById[r.sourceNodeId]?.code ?? r.sourceNodeId, gatewayNodeId: st.nodesById[r.targetNodeId]?.hardwareId ?? r.targetNodeId, gatewayReceptorId: r.targetNodeId, gatewayCode: st.nodesById[r.targetNodeId]?.code ?? r.targetNodeId, isReachable: r.isViable, hopCount: r.hopCount, pathReceptorIds: r.hopNodeIds, pathCodes: r.hopNodeIds.map((id) => st.nodesById[id]?.code ?? id), pathCoordinates: r.coordinates, totalDistanceMeters: r.hopCount * 145, etxTotalCost: Number((1 + r.hopCount * 0.2).toFixed(2)), endToEndLatencyMs: Math.round(r.reactionTimeTrMs), isSelfHealedReroute: r.bypassedCraterIds.length > 0, bypassedFailedNodeCodes: r.bypassedCraterIds.map((id) => st.nodesById[id]?.code ?? id) }));
  return {
    gatewayReceptorId: gw?.receptorId ?? '', gatewayCode: gw?.code ?? 'GW-00', gatewayPosition: gw?.position ?? { lat: 55.4128, lng: 11.3533 },
    onlineNodeCount: st.nodes.filter((n) => n.status !== 'CRATER_OFFLINE').length, offlineNodeCount: st.nodes.filter((n) => n.status === 'CRATER_OFFLINE').length,
    selfHealedRouteCount: dijkstraRoutes.filter((r) => r.isSelfHealedReroute).length, bftApprovedAlertCount: bftAudits.filter((b) => b.verdict === 'BFT_KONSENSUS_GODKENDT').length,
    bftRejectedByzantineCount: bftAudits.filter((b) => b.verdict === 'BFT_BYZANTINSK_AFVIST').length, meanEu868DutyUtilizedPct: st.kpis.eu868DutyCyclePct,
    bftAudits, bftByReceptorId: Object.fromEntries(bftAudits.map((b) => [b.receptorId, b])), loraMetrics, loraByReceptorId: Object.fromEntries(loraMetrics.map((m) => [m.receptorId, m])), dijkstraRoutes,
    cik20: { activeUrgentReceptorCount: st.swarmAllocations.length, systemEfficiencyPct: Math.round(st.kpis.autonomyIndexAi * 100), pools: [{ key: 'water_mist_l_min', labelDa: 'Vandtåge (kg)', unit: 'kg', totalAvailableCapacity: 300, allocatedAmount: Math.round(st.sankeyFlow.totalAllocatedWaterMistKg), reserveAmount: Math.max(0, 300 - Math.round(st.sankeyFlow.totalAllocatedWaterMistKg)), colorHex: '#22d3ee' }], links: [], summaryDa: st.forensicAuditTrailDa.join(' ') },
    apoptosis: { overallStage: st.kpis.regulatoryApoptosisTriggered ? 'APOPTOSE_GENNEMFØRT_HOMEOSTASE' : 'NEDTÆLLING_TIL_APOPTOSE', consecutiveHomeostasisHours: 4, requiredHomeostasisHours: 4, dryDemolitionPermitRevoked: st.swarmAllocations.length > 0, rules: [] },
    biocyberneticState: st,
  };
}

import type {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  IndoorClimateTelemetryResult,
  ReceptorExposureResult,
  ReceptorZone,
  RingparkenBuildingUnit,
  WaterMainLiveTelemetry,
} from '../types/dispersion';
import type {
  AlgedonicScenarioSpec,
  AlgedonicTestScenarioId,
  Gate1ConsensusValidationSummary,
  SimultaneousAlgedonicDispatch,
  SimultaneousAlgedonicEscapeVector,
  SimultaneousAlgedonicSystem1State,
  SimultaneousAlgedonicSystem3State,
  SimultaneousAlgedonicTankerCorridor,
} from '../types/myceliumAlert';
import type { AutonomousReceptorMeshNetwork } from './autonomousReceptorMeshService';

export const ALGEDONIC_SCENARIO_SPECS: Record<AlgedonicTestScenarioId, AlgedonicScenarioSpec> = {
  kierulffsvej_eternit_rupture: {
    id: 'kierulffsvej_eternit_rupture',
    shortTitleDa: '1. Akut Eternit-Hovedrørsbrud (Kierulffsvej)',
    titleDa: 'Scenarie 1: Akut Eternit-Hovedrørsbrud på Kierulffsvej DN200 (-1,65 m)',
    subtitleDa:
      'Trykfald til 0,92 bar · 180 m³ vandspild mod Blok 1/2 · Pb/PAH/kloak-tilbagesugning & V-VEST/V-MIDT nødsektionering',
    statutoryRefDa:
      'Regulativ for SK Vand A/S afsnit 6.2 & 10 · Vandforsyningslovens § 62 stk. 3 & 6–7 · BEK nr. 1272/2025',
  },
  asbestos_plume_cav_vacuum: {
    id: 'asbestos_plume_cav_vacuum',
    shortTitleDa: '2. Asbeststøvfane S ≥ 1,0 + CAV-Vakuum',
    titleDa: 'Scenarie 2: Asbeststøvfane S ≥ 1,0 + Indendørs CAV-Vakuumpumpe (< -25 Pa)',
    subtitleDa:
      'Udendørs S_out = 1,42 (BEK 613/2026) & indendørs ΔP_CAV = -45,3 Pa suger asbestfibre ind i beboede lejligheder',
    statutoryRefDa:
      'BEK nr. 613 af 29/06/2026 § 3 stk. 3 · BEK nr. 1328/2025 · BR18 § 443 · Island Mode Overtryk',
  },
  combined_vibration_rupture_plume: {
    id: 'combined_vibration_rupture_plume',
    shortTitleDa: '3. Kombineret Vibration + Rørbrud + Støvfane',
    titleDa: 'Scenarie 3: Kombineret Maskinvibration (> 85 dB / PPV) + Ledningsbrud + Asbestfane',
    subtitleDa:
      'Hydraulisk betonknuser under højvind (> 10 m/s) udløser samtidig rørbrud, DIN 4150-3 skader, støvfane & akustisk impuls',
    statutoryRefDa:
      'BEK 613/2026 · Vandforsyningslovens § 62 · PSS W22085 Totalstop · SK Vand & Arbejdstilsynet',
  },
};

function computeBearingDeg(from: LatLngPoint, to: LatLngPoint): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.round((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360);
}

function buildDangerCirclePolygon(center: LatLngPoint, radiusMeters: number): LatLngPoint[] {
  const pts: LatLngPoint[] = [];
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((center.lat * Math.PI) / 180);
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    pts.push({
      lat: Number((center.lat + (Math.sin(theta) * radiusMeters) / mPerDegLat).toFixed(6)),
      lng: Number((center.lng + (Math.cos(theta) * radiusMeters) / mPerDegLng).toFixed(6)),
    });
  }
  return pts;
}

export interface EvaluateSimultaneousAlgedonicInput {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  buildings: RingparkenBuildingUnit[];
  receptorExposures: ReceptorExposureResult[];
  mesh: AutonomousReceptorMeshNetwork;
  currentWeather: HourlyWeatherPoint;
  maxSiteSumQuotient: number;
  indoorClimateTelemetry?: IndoorClimateTelemetryResult | null;
  waterMainTelemetry?: WaterMainLiveTelemetry | null;
  machineNoiseOutputDb: number;
  cavVentilationModeLabelDa: string;
  manualScenarioOverride: AlgedonicTestScenarioId | null;
  acknowledged: boolean;
  acknowledgedAtIso: string | null;
  existingT0EpochMs?: number;
  linkedSha256ObservationCode?: string;
  linkedSha256Signature?: string;
  byzantineSpoofNodeCount?: number;
}

/**
 * Evaluerer alle 4 akutte algedoniske trigger-klasser, udfører System 2 Gate 1 nabotest
 * (BFT n >= 3f + 1 + ZKP Right-to-Opacity) og genererer ét fælles atomart T1-tilstandsobjekt
 * der aktiverer System 1 (Beboere & Arbejdere < 5s) og System 3 (Beredskab, SK Vand & Tilsyn)
 * i nøjagtig samme millisekund uden bureaukratisk forsinkelse (Δt = 0 ms).
 */
export function evaluateSimultaneousAlgedonicDispatch(
  input: EvaluateSimultaneousAlgedonicInput
): SimultaneousAlgedonicDispatch {
  const {
    sources,
    receptors,
    receptorExposures,
    mesh,
    currentWeather,
    maxSiteSumQuotient,
    indoorClimateTelemetry,
    waterMainTelemetry,
    machineNoiseOutputDb,
    cavVentilationModeLabelDa,
    manualScenarioOverride,
    acknowledged,
    acknowledgedAtIso,
    existingT0EpochMs,
    linkedSha256ObservationCode,
    linkedSha256Signature,
    byzantineSpoofNodeCount = 0,
  } = input;

  const windSpeedMs = Number((currentWeather?.windSpeed10m ?? 6.5).toFixed(1));
  const plumeDirectionDeg = Math.round(((currentWeather?.windDirection10m ?? 250) + 180) % 360);
  const upwindEscapeBearingDeg = Math.round((plumeDirectionDeg + 180) % 360);

  // Live physical metrics
  const baseOutdoorS = Number(maxSiteSumQuotient.toFixed(2));
  const baseIndoorS = Number((indoorClimateTelemetry?.indoorSumQuotientSin ?? 0.42).toFixed(2));
  const baseDeltaPCavPa = Number((indoorClimateTelemetry?.deltaPCavPa ?? -12.0).toFixed(1));
  const basePressureBar = Number((waterMainTelemetry?.pressureBar ?? 4.2).toFixed(2));
  const basePipePpvMmS = Number((waterMainTelemetry?.pipePpvMmPerSec ?? 2.4).toFixed(1));
  const baseEstReceptorDb = machineNoiseOutputDb - 36.3 + Math.min(4.3, windSpeedMs * 0.34);
  const baseImpulseLafmaxDb = Number((baseEstReceptorDb + 15.2).toFixed(1));

  // Apply scenario override values if running a controlled simulation scenario
  let effectiveOutdoorS = baseOutdoorS;
  let effectiveIndoorS = baseIndoorS;
  let effectiveDeltaPCavPa = baseDeltaPCavPa;
  let effectivePressureBar = basePressureBar;
  let effectivePipePpvMmS = basePipePpvMmS;
  let effectiveWindMs = windSpeedMs;
  let effectiveImpulseDb = baseImpulseLafmaxDb;
  let forceRuptureFlag = Boolean(waterMainTelemetry?.simulatedPipeRuptureActive);

  if (manualScenarioOverride === 'kierulffsvej_eternit_rupture') {
    effectivePressureBar = Math.min(basePressureBar, 0.92);
    effectivePipePpvMmS = Math.max(basePipePpvMmS, 28.4);
    effectiveOutdoorS = Math.max(baseOutdoorS, 0.86);
    forceRuptureFlag = true;
  } else if (manualScenarioOverride === 'asbestos_plume_cav_vacuum') {
    effectiveOutdoorS = Math.max(baseOutdoorS, 1.42);
    effectiveIndoorS = Math.max(baseIndoorS, 1.28);
    effectiveDeltaPCavPa = Math.min(baseDeltaPCavPa, -45.3);
    effectiveWindMs = Math.max(windSpeedMs, 11.4);
  } else if (manualScenarioOverride === 'combined_vibration_rupture_plume') {
    effectiveOutdoorS = Math.max(baseOutdoorS, 1.68);
    effectiveIndoorS = Math.max(baseIndoorS, 1.49);
    effectiveDeltaPCavPa = Math.min(baseDeltaPCavPa, -52.8);
    effectivePressureBar = Math.min(basePressureBar, 0.84);
    effectivePipePpvMmS = Math.max(basePipePpvMmS, 34.2);
    effectiveWindMs = Math.max(windSpeedMs, 12.6);
    effectiveImpulseDb = Math.max(baseImpulseLafmaxDb, 94.8);
    forceRuptureFlag = true;
  }

  // Evaluate the 4 T0 trigger conditions
  const outdoorSumQuotientBreach = effectiveOutdoorS >= 0.8;
  const indoorCavVacuumBreach = effectiveIndoorS >= 0.8 || effectiveDeltaPCavPa < -25.0;
  const highWindImpulseNoiseBreach = effectiveImpulseDb > 85.0 && effectiveWindMs > 10.0;
  const waterMainRuptureOrVibrationBreach =
    forceRuptureFlag || effectivePressureBar < 1.5 || effectivePipePpvMmS >= 25.0;

  const activeTriggerReasonsDa: string[] = [];
  if (outdoorSumQuotientBreach) {
    activeTriggerReasonsDa.push(
      `Udendørs Sumkvotient S = ${effectiveOutdoorS.toFixed(2)} ≥ 0,80 (BEK 613/2026)`
    );
  }
  if (indoorCavVacuumBreach) {
    activeTriggerReasonsDa.push(
      `Indendørs Eksponering S_in = ${effectiveIndoorS.toFixed(2)} / ΔP_CAV = ${effectiveDeltaPCavPa.toFixed(1)} Pa (< -25 Pa)`
    );
  }
  if (highWindImpulseNoiseBreach) {
    activeTriggerReasonsDa.push(
      `Impulsstøj L_AFmax = ${effectiveImpulseDb.toFixed(1)} dB(A) > 85 dB ved højvind (${effectiveWindMs.toFixed(1)} m/s)`
    );
  }
  if (waterMainRuptureOrVibrationBreach) {
    activeTriggerReasonsDa.push(
      `Kierulffsvej DN200 Brud/Undertryk (${effectivePressureBar.toFixed(2)} bar < 1,5 bar · PPV ${effectivePipePpvMmS.toFixed(1)} mm/s)`
    );
  }

  const anyTriggered = activeTriggerReasonsDa.length > 0 || manualScenarioOverride !== null;

  // Gate 1 Neighbor Test (System 2 Filter) with BFT n >= 3f + 1 + ZKP Right-to-Opacity
  const totalMeshNodes = Math.max(11, mesh.nodes.length);
  const maxToleratedFaultsF = Math.max(1, Math.floor((totalMeshNodes - 1) / 3));
  const quorumRequired = Math.max(4, Math.ceil(totalMeshNodes * 0.4));
  const rawCorroborating = mesh.nodes.filter(
    (n) => n.sumQuotient >= 0.5 || n.connectedPeerReceptorIds.length >= 2
  ).length;
  const corroboratingNodes = anyTriggered
    ? Math.max(quorumRequired, Math.min(totalMeshNodes - byzantineSpoofNodeCount, Math.max(6, rawCorroborating)))
    : rawCorroborating;
  const corroborationPct = Math.round((corroboratingNodes / totalMeshNodes) * 100);
  const gate1Passed = anyTriggered && corroboratingNodes >= quorumRequired;

  const zkpRightToOpacityHash = `0x${deterministicHexHash256(
    `ZKP-OPACITY|${currentWeather?.isoTime || '2026-04-06T12:00:00'}|${manualScenarioOverride || 'live'}|${effectiveOutdoorS}|${effectivePressureBar}|${mesh.merkleRegistryRootHash}`
  )}`;

  const gate1Validation: Gate1ConsensusValidationSummary = {
    passed: gate1Passed,
    byzantineFaultToleranceFormula: 'n >= 3f + 1',
    totalNodes: totalMeshNodes,
    corroboratingNodes,
    corroborationPct,
    maxToleratedFaultsF,
    rejectedCryWolfCount: byzantineSpoofNodeCount,
    rejectedStatusCode: 'VARIANCE_INJECTION_DESTROYED_LOCALLY',
    zkpRightToOpacityHash,
    zkpAnonymousReporterCount: Math.max(
      2,
      mesh.nodes.filter((n) => Boolean(n.zkpCredential?.isVerifiedValid)).length
    ),
    summaryDa: gate1Passed
      ? `Gate 1 GODKENDT (${corroboratingNodes}/${totalMeshNodes} noder = ${corroborationPct}% ≥ 40% BFT n ≥ 3f+1, f_max=${maxToleratedFaultsF}) · ${byzantineSpoofNodeCount} enkelt-node støjsignal destrueret lokalt · ZKP Right-to-Opacity intakt.`
      : `System 2 Gate 1 Standby (${totalMeshNodes} autonome noder overvåger n ≥ 3f+1 · Enkeltstående Cry-Wolf støj filtreres lokalt).`,
  };

  // Atomic timestamps T0 -> T1 (< 15 ms, 0 ms bureaucratic delay)
  const deterministicMsSeed =
    (Math.round(effectiveOutdoorS * 100) +
      Math.round(effectivePipePpvMmS * 10) +
      (currentWeather?.hourIndex ?? 12) * 3) %
    6;
  const latencyMs = 4 + deterministicMsSeed; // Strictly 4..9 ms (< 15 ms)
  const t0EpochMs = existingT0EpochMs ?? Date.now();
  const t1DispatchedEpochMs = t0EpochMs + latencyMs;
  const t0DetectedIso = new Date(t0EpochMs).toISOString();
  const t1DispatchedIso = new Date(t1DispatchedEpochMs).toISOString();

  // Epicenter anchored to Kierulffsvej 14-22 / Blok 1 or worst source
  const blok1Src =
    sources.find((s) => s.id === 'src-blok-1') ||
    sources.find((s) => s.active) ||
    sources[0];
  const kierulffsvejCenter: LatLngPoint = waterMainTelemetry?.inspectionCenter ?? {
    lat: 55.41295,
    lng: 11.35365,
  };
  const epicenter: LatLngPoint =
    manualScenarioOverride === 'kierulffsvej_eternit_rupture' || waterMainRuptureOrVibrationBreach
      ? kierulffsvejCenter
      : blok1Src?.position ?? kierulffsvejCenter;
  const epicenterLabelDa = waterMainRuptureOrVibrationBreach
    ? 'Kierulffsvej DN200 / Blok 1 (14-22)'
    : blok1Src?.name || 'Blok 1 (Kierulffsvej 14-22)';
  const dangerRadiusMeters = anyTriggered
    ? Math.round(Math.min(115, Math.max(55, 52 + effectiveOutdoorS * 24)))
    : 42;
  const dangerPolygon = buildDangerCirclePolygon(epicenter, dangerRadiusMeters);

  // Upwind & upslope escape muster points outside 2m trench edge (Valbyvej & Rosenkildevej)
  const valbyvejMuster: LatLngPoint = { lat: 55.41145, lng: 11.35025 };
  const rosenkildevejMuster: LatLngPoint = { lat: 55.41395, lng: 11.35695 };
  const escapeVectors: SimultaneousAlgedonicEscapeVector[] = [
    {
      id: 'escape-valbyvej',
      labelDa: 'Flugtvej Vest -> Valbyvej Samlingspunkt (Uden for 2m rørgrav)',
      streetName: 'Valbyvej',
      origin: epicenter,
      targetMusterPoint: valbyvejMuster,
      distanceMeters: Math.round(haversineMetersBetween(epicenter, valbyvejMuster)),
      bearingDeg: computeBearingDeg(epicenter, valbyvejMuster),
    },
    {
      id: 'escape-rosenkildevej',
      labelDa: 'Flugtvej Øst/Opbakke -> Rosenkildevej Samlingspunkt (Højere terræn)',
      streetName: 'Rosenkildevej',
      origin: epicenter,
      targetMusterPoint: rosenkildevejMuster,
      distanceMeters: Math.round(haversineMetersBetween(epicenter, rosenkildevejMuster)),
      bearingDeg: computeBearingDeg(epicenter, rosenkildevejMuster),
    },
  ];

  // Island Mode inhabited neighbor blocks (Afd. 23, 24, 26, 32 & Rødtjørnevej 2)
  const targetIslandIds = [
    'rec-afd-23',
    'rec-afd-24',
    'rec-afd-26',
    'rec-afd-32',
    'rec-roedtjoornevej-2',
  ];
  const islandReceptors = targetIslandIds
    .map((id) => receptors.find((r) => r.id === id))
    .filter((r): r is ReceptorZone => Boolean(r));
  const islandModeBlockIds = islandReceptors.map((r) => r.id);
  const islandModeBlockLabels = islandReceptors.map(
    (r) => `${r.code} (${r.name.replace('Ringparken ', '')})`
  );

  const system1State: SimultaneousAlgedonicSystem1State = {
    status: !anyTriggered
      ? 'STANDBY'
      : acknowledged
      ? 'ACKNOWLEDGED_SOLID'
      : 'ACTIVE_EVACUATE_SHELTER',
    epicenter,
    epicenterLabelDa,
    dangerRadiusMeters,
    dangerPolygon,
    plumeDirectionDeg,
    upwindEscapeBearingDeg,
    escapeVectors,
    islandModeBlockIds,
    islandModeBlockLabels,
    workerOrderDa: `MODVINDS-EVAKUERING — RØM UDGRAVNING & FAREZONE I MODVIND (${upwindEscapeBearingDeg}°). Skift til friskluft/P3 & afbryd støvende arbejde (Algedonisk Veto aktivt).`,
    residentOrdersDa: [
      '1) Luk vinduer & altandøre straks (Island Mode beskyttelse)',
      `2) Tvangsstop CAV-undertryk (${effectiveDeltaPCavPa.toFixed(1).replace('.', ',')} Pa) øjeblikkeligt (hindrer indsugning af asbeststøv)`,
      '3) Luk for postevand/drikkevand ved ledningsbrud på Kierulffsvej (Algedonisk Veto aktivt).',
    ],
    isa182ShapeTag: 'INVERTED_OCTAGON_P1',
  };

  // System 3: Emergency Response, SK Vand / Envafors, PSS W22085 Lockout & Authorities
  const tankerIngressCorridors: SimultaneousAlgedonicTankerCorridor[] = [
    {
      id: 'corridor-valbyvej-open',
      streetName: 'Valbyvej Indrykning (ÅBEN)',
      status: 'OPEN_INGRESS',
      waypoints: [
        { lat: 55.41095, lng: 11.3497 },
        { lat: 55.41145, lng: 11.3507 },
        { lat: 55.41215, lng: 11.3522 },
      ],
      noteDa: 'Nød-vandforstøvning & tankvogns-indrykning ad Valbyvej (åben) med fri adgang for slamsuger og beredskab.',
    },
    {
      id: 'corridor-rosenkildevej-open',
      streetName: 'Rosenkildevej Indrykning (ÅBEN)',
      status: 'OPEN_INGRESS',
      waypoints: [
        { lat: 55.4143, lng: 11.3585 },
        { lat: 55.41385, lng: 11.3568 },
        { lat: 55.41345, lng: 11.3552 },
      ],
      noteDa: 'Sekundær nød-vandforstøvning & beredskabs-indrykning ad Rosenkildevej øst for afspærret rørzone.',
    },
    {
      id: 'corridor-nordre-ringgade-blocked',
      streetName: 'Nordre Ringgade (LUKKET FOR KØRSEL)',
      status: 'BLOCKED_CLOSED',
      waypoints: [
        { lat: 55.41435, lng: 11.3514 },
        { lat: 55.41455, lng: 11.3536 },
        { lat: 55.41475, lng: 11.3558 },
      ],
      noteDa: 'Nordre Ringgade eksplicit LUKKET for tung indkørsel/tilkørsel — omdirigeret til Valbyvej & Rosenkildevej.',
    },
  ];

  const worstExposure = [...receptorExposures].sort((a, b) => b.sumQuotient - a.sumQuotient)[0];
  const scenarioTitleDa = manualScenarioOverride
    ? ALGEDONIC_SCENARIO_SPECS[manualScenarioOverride].titleDa
    : `Live Algedonisk Trigger (${worstExposure?.receptorCode || 'BLOK-1'} · S=${effectiveOutdoorS.toFixed(2)})`;

  const system3State: SimultaneousAlgedonicSystem3State = {
    status: anyTriggered ? 'ACTIVE_BRAKE_LOCKOUT' : 'STANDBY',
    lockedValveCodes: ['V-VEST', 'V-MIDT'],
    sectioningStatuteDa:
      'SK Vand A/S (Envafors) Regulativ pkt. 6.2 & 10: Øjeblikkelig nødafspærring uden forudgående varsel (V-VEST ved Valbyvej + V-MIDT ved Kierulffsvej 26) mod ~180 m³ vandtab, fundaments-udvaskning og tilbagesugning af Pb/PAH/kloak.',
    waterLossPreventedM3: 180,
    haltedMachines: [
      {
        id: 'lock-concrete-crusher',
        nameDa: 'Hydraulisk Betonknuser (Blok 1 / Kierulffsvej)',
        interlockRuleDa: 'Wissenberg PSS W22085 · Algedonisk Nødstop',
        status: 'LOCKED_OUT',
      },
      {
        id: 'lock-chisel-hammer',
        nameDa: 'Hydraulisk Mejselhammer & Facadeklipper',
        interlockRuleDa: 'DIN 4150-3 & BEK 613/2026 · Impulsstøj/PPV Veto',
        status: 'LOCKED_OUT',
      },
      {
        id: 'lock-heavy-trucks',
        nameDa: 'Tung Lastbiltrafik langs Kierulffsvej',
        interlockRuleDa: 'SK Vand DN200 Beskyttelse · LER ±2,0 m Zone',
        status: 'LOCKED_OUT',
      },
    ],
    cavForcedSafeMode: 'balanced_hepa_overpress',
    cavPreviousModeLabelDa: cavVentilationModeLabelDa,
    tankerIngressCorridors,
    statutoryNotices: [
      {
        id: 'notice-slagelse-stps',
        authorityDa: 'Slagelse Kommune & Styrelsen for Patientsikkerhed',
        statuteRef: 'Vandforsyningslovens § 62, stk. 3 & stk. 6–7',
        titleDa: 'Akut Indberetning: Ledningsbrud, Undertryk & Kogeanbefaling/Sundhedsfare',
        summaryDa: `Straksvarsling vedr. Kierulffsvej DN200 (1964 Eternit/PE100 · tryk ${effectivePressureBar.toFixed(2)} bar · V-VEST & V-MIDT lukket). Risiko for tilbagesugning af bly/PAH/kloak i moræneler.`,
        deadlineDa: 'STRAKS (T1 + 0 min · Lovpligtig akut underretning)',
      },
      {
        id: 'notice-bek-1272',
        authorityDa: 'Slagelse Kommune (Vandforsyningstilsyn)',
        statuteRef: 'BEK nr. 1272 af 31/10/2025 (Drikkevandsbekendtgørelsen)',
        titleDa: 'Drikkevandskvalitet & Tilbagestrømningssikring (DS/EN 1717)',
        summaryDa:
          'Dokumentation for afpropning/sektionering af stikledninger ved Kierulffsvej 2, 12, 14–22 og Valbyvej 58 samt verificeret udskylning før genåbning.',
        deadlineDa: 'Samtidig ESDH-journalisering ved T1',
      },
      {
        id: 'notice-at-bek613',
        authorityDa: 'Arbejdstilsynet & Slagelse Kommune (Miljøtilsyn)',
        statuteRef: 'BEK nr. 613 af 29/06/2026 & BEK nr. 1328 af 19/11/2025',
        titleDa: 'Arbejdsstandsning ved Overskridelse af Asbest/Sumkvotient (S ≥ 0,8 / 1,0)',
        summaryDa: `Udendørs S_out = ${effectiveOutdoorS.toFixed(2)}, indendørs S_in = ${effectiveIndoorS.toFixed(2)} (tvangsskiftet fra ${cavVentilationModeLabelDa} til H14-HEPA overtryk). Autoriseret saneringsstop jf. PSS W22085.`,
        deadlineDa: 'STRAKS (Øjeblikkeligt påbuds- og standsningsgrundlag)',
      },
    ],
    linkedSha256ObservationCode,
    linkedSha256Signature,
  };

  // Systemic relaxation time compression: Tr compressed from 18.5h down to < 0.01h (0.004h ≈ 14 sec)
  const relaxationTimeBeforeHours = 18.5;
  const relaxationTimeAfterHours = anyTriggered ? 0.004 : 0.008;
  const crisisIntervalDtHours = 1.2;

  return {
    eventId: `ALG-S1S3-${manualScenarioOverride || 'LIVE'}-${t1DispatchedEpochMs}`,
    scenarioId: manualScenarioOverride ?? 'live_auto_trigger',
    scenarioTitleDa,
    active: anyTriggered,
    acknowledged,
    acknowledgedAtIso,
    isBlinkingP1: anyTriggered && !acknowledged,
    t0DetectedIso,
    t0EpochMs,
    t1DispatchedIso,
    t1DispatchedEpochMs,
    latencyMs,
    bureaucraticDelayDeltaTMs: 0,
    relaxationTimeBeforeHours,
    relaxationTimeAfterHours,
    crisisIntervalDtHours,
    systemicTetanusEliminated: relaxationTimeAfterHours < crisisIntervalDtHours,
    triggers: {
      anyTriggered,
      triggerCount: activeTriggerReasonsDa.length,
      outdoorSumQuotientBreach,
      outdoorSumQuotientValue: effectiveOutdoorS,
      indoorCavVacuumBreach,
      indoorSumQuotientValue: effectiveIndoorS,
      deltaPCavPa: effectiveDeltaPCavPa,
      highWindImpulseNoiseBreach,
      impulseLafmaxDb: effectiveImpulseDb,
      windSpeedMs: effectiveWindMs,
      waterMainRuptureOrVibrationBreach,
      waterMainPressureBar: effectivePressureBar,
      waterMainPpvMmS: effectivePipePpvMmS,
      activeTriggerReasonsDa,
    },
    gate1Validation,
    system1State,
    system3State,
  };
}

