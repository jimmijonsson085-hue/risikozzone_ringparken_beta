/**
 * @file src/hooks/useMyceliumLiveAlerts.ts
 * @description Stateful React-hook for automatiseret varsling i Fællesskabets Mycelienetværk
 * efter Management by Exception, Calmer Defaults og ISA-18.2 alarm-rationalisering:
 * - localStorage-persistens ('ringparken_mycelium_live_alerts_v1') i try/catch
 * - ISA-18.2 Hysterese-Latch pr. (nodeId, hazardType) + 45s Cooldown + 600ms Scrubbing Guard
 * - Gate 1 støj-eliminering (0 toast/lyd ved VARIANCE_INJECTION_DESTROYED_LOCALLY i calmer_defaults)
 * - Cross-origin iframe-sikker Dual-Channel Dispatcher + klik-fri 528->660 Hz Web Audio syntese
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  IndoorClimateTelemetryResult,
  ReceptorExposureResult,
  ReceptorZone,
  RingparkenBuildingUnit,
  WaterMainLiveTelemetry,
} from '../types/dispersion';
import { AutonomousReceptorMeshNetwork } from '../services/autonomousReceptorMeshService';
import { evaluateSimultaneousAlgedonicDispatch } from '../services/myceliumSimulationEngine';
import {
  AlgedonicTestScenarioId,
  Isa182HysteresisConfig, MyceliumAlgedonode, MyceliumAlertProfile, MyceliumHazardType,
  MyceliumLiveAlertItem, MyceliumLiveNotification, MyceliumLiveNotificationSeverity,
  MyceliumNetworkSimulationSnapshot, MyceliumNetworkSimulationState,
  MyceliumNotificationChannelStatus, MyceliumSuppressedStats,
  SimultaneousAlgedonicDispatch,
} from '../types/myceliumAlert';

const STORAGE_KEY = 'ringparken_mycelium_live_alerts_v1';
const COOLDOWN_MS = 45000, SCRUBBING_GUARD_MS = 600, TOAST_AUTO_DISMISS_MS = 8000;

export const DEFAULT_ISA182_HYSTERESIS: Isa182HysteresisConfig = {
  p1TriggerS: 1.0, p1ClearS: 0.85, p2TriggerS: 0.5, p2ClearS: 0.4,
  p1TriggerLafmaxDb: 80.0, p1ClearLafmaxDb: 75.0, cooldownMs: COOLDOWN_MS, scrubbingSettleMs: SCRUBBING_GUARD_MS,
};

interface StoredAlertState {
  isLiveEnabled: boolean; alertProfile: MyceliumAlertProfile; isAudioChimeEnabled: boolean; eventLog: MyceliumLiveNotification[];
}

function detectIframeSafe(): boolean {
  try { return typeof window !== 'undefined' && window.self !== window.top; } catch { return true; }
}

function readPermSafe(isIframe: boolean): 'granted' | 'denied' | 'default' | 'iframe_blocked' {
  if (isIframe) return 'iframe_blocked';
  try { return typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'iframe_blocked'; }
  catch { return 'iframe_blocked'; }
}

function loadStoredSafe(): StoredAlertState {
  try {
    const p = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as Partial<StoredAlertState> | null;
    if (!p) return { isLiveEnabled: true, alertProfile: 'calmer_defaults', isAudioChimeEnabled: false, eventLog: [] };
    return {
      isLiveEnabled: typeof p.isLiveEnabled === 'boolean' ? p.isLiveEnabled : true,
      alertProfile: p.alertProfile === 'strict_forensic' ? 'strict_forensic' : 'calmer_defaults',
      isAudioChimeEnabled: typeof p.isAudioChimeEnabled === 'boolean' ? p.isAudioChimeEnabled : false,
      eventLog: Array.isArray(p.eventLog) ? p.eventLog.slice(0, 50) : [],
    };
  } catch { return { isLiveEnabled: true, alertProfile: 'calmer_defaults', isAudioChimeEnabled: false, eventLog: [] }; }
}

export interface UseMyceliumLiveAlertsParams {
  simulationState?: MyceliumNetworkSimulationState;
  snapshot?: MyceliumNetworkSimulationSnapshot;
  currentWeather?: HourlyWeatherPoint;
  dateIso?: string;
  selectedHourIndex?: number;
  timelineProgress?: number;
  isPlayingTimeline?: boolean;
  onFocusNodeOnMap?: (nodeId: string) => void;
}

export function useMyceliumLiveAlerts({
  simulationState, snapshot, currentWeather, dateIso = '', selectedHourIndex = 0, timelineProgress = 0, isPlayingTimeline = false, onFocusNodeOnMap,
}: UseMyceliumLiveAlertsParams) {
  const simState = simulationState ?? snapshot?.biocyberneticState ?? null;
  const isCrossOriginIframe = useMemo(() => detectIframeSafe(), []);
  const initial = useMemo(() => loadStoredSafe(), []);

  const [isLiveEnabled, setIsLiveEnabled] = useState<boolean>(initial.isLiveEnabled);
  const [alertProfile, setAlertProfile] = useState<MyceliumAlertProfile>(initial.alertProfile);
  const [isAudioChimeEnabled, setIsAudioChimeEnabled] = useState<boolean>(initial.isAudioChimeEnabled);
  const [eventLog, setEventLog] = useState<MyceliumLiveNotification[]>(initial.eventLog);
  const [activeToastQueue, setActiveToastQueue] = useState<MyceliumLiveNotification[]>([]);
  const [hoveredToastId, setHoveredToastId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isScrubbingSuppressed, setIsScrubbingSuppressed] = useState<boolean>(false);
  const [browserPermission, setBrowserPermission] = useState(() => readPermSafe(isCrossOriginIframe));
  const [suppressedStats, setSuppressedStats] = useState<MyceliumSuppressedStats>({
    emittedCount: initial.eventLog.length, destroyedByGate1Count: 0, suppressedByHysteresisCount: 0, suppressedByScrubbingCount: 0,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const userInteractedRef = useRef<boolean>(false);
  const latchRef = useRef<Record<string, boolean>>({});
  const gate1CountedRef = useRef<Record<string, boolean>>({});
  const cooldownRef = useRef<Record<string, number>>({});
  const scrubTimerRef = useRef<number | null>(null);
  const scrubUntilMsRef = useRef<number>(0);
  const prevHourRef = useRef<number>(selectedHourIndex);
  const prevProgRef = useRef<number>(timelineProgress);
  const prevPlayingRef = useRef<boolean>(isPlayingTimeline);
  const lastScrubStatsSigRef = useRef<string | null>(null);

  useEffect(() => {
    const unlock = () => { userInteractedRef.current = true; };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      if (scrubTimerRef.current !== null) window.clearTimeout(scrubTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ isLiveEnabled, alertProfile, isAudioChimeEnabled, eventLog: eventLog.slice(0, 50) })); }
    catch { /* Sandbox-safe ignore */ }
  }, [isLiveEnabled, alertProfile, isAudioChimeEnabled, eventLog]);

  /** Synkron 600 ms Tidslinje-Scrubbing Guard mod alarm-spam under træk i 24t- og +6t-slidere. */
  const notifyTimelineScrub = useCallback(() => {
    scrubUntilMsRef.current = Date.now() + SCRUBBING_GUARD_MS;
    setIsScrubbingSuppressed((prev) => (prev ? prev : true));
    if (scrubTimerRef.current !== null) window.clearTimeout(scrubTimerRef.current);
    scrubTimerRef.current = window.setTimeout(() => {
      scrubUntilMsRef.current = 0;
      if (!isPlayingTimeline) setIsScrubbingSuppressed((prev) => (prev ? false : prev));
    }, SCRUBBING_GUARD_MS);
  }, [isPlayingTimeline]);

  useEffect(() => {
    if (
      prevHourRef.current !== selectedHourIndex ||
      prevProgRef.current !== timelineProgress ||
      prevPlayingRef.current !== isPlayingTimeline
    ) {
      prevHourRef.current = selectedHourIndex;
      prevProgRef.current = timelineProgress;
      prevPlayingRef.current = isPlayingTimeline;
      notifyTimelineScrub();
    }
  }, [selectedHourIndex, timelineProgress, isPlayingTimeline, notifyTimelineScrub]);

  /** Klik-fri to-tonet biokybernetisk 528 Hz -> 660 Hz puls (aldrig <= 0 i exponentialRampToValueAtTime). */
  const playBiocyberneticChime = useCallback((forcePlay = false) => {
    if (!forcePlay && (!isAudioChimeEnabled || !userInteractedRef.current)) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const now = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(528, now);
      osc.frequency.setValueAtTime(660, now + 0.16);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.36);
    } catch { /* Sandbox-safe audio fallback */ }
  }, [isAudioChimeEnabled]);

  const dispatchOsNotification = useCallback((title: string, body: string) => {
    if (isCrossOriginIframe || detectIframeSafe() || browserPermission !== 'granted') return;
    try { if (typeof window !== 'undefined' && 'Notification' in window) new window.Notification(title, { body, silent: true }); }
    catch { /* Silent sandbox fallback */ }
  }, [isCrossOriginIframe, browserPermission]);

  // Auto-dismiss synlige toasts efter 8 sek., medmindre brugeren holder musen over
  useEffect(() => {
    if (!activeToastQueue.length || hoveredToastId !== null) return undefined;
    const t = window.setInterval(() => {
      const now = Date.now();
      setActiveToastQueue((prev) => prev.filter((item) => now - item.createdAtMs < TOAST_AUTO_DISMISS_MS));
    }, 500);
    return () => window.clearInterval(t);
  }, [activeToastQueue.length, hoveredToastId]);

  // ISA-18.2 Hysterese-Latch, 45s Cooldown, 600ms Scrubbing Guard & Gate 1 Filter
  useEffect(() => {
    if (!simState || !isLiveEnabled) return;
    const now = Date.now();
    if (prevHourRef.current !== selectedHourIndex || prevProgRef.current !== timelineProgress || isPlayingTimeline) {
      prevHourRef.current = selectedHourIndex;
      prevProgRef.current = timelineProgress;
      scrubUntilMsRef.current = now + SCRUBBING_GUARD_MS;
    }
    const activelyScrubbing = isScrubbingSuppressed || isPlayingTimeline || now < scrubUntilMsRef.current;
    const sOn = alertProfile === 'strict_forensic' ? 0.5 : 1.0, sOff = alertProfile === 'strict_forensic' ? 0.4 : 0.85;
    let gate1Inc = 0, hystInc = 0, scrubInc = 0;
    const emitted: MyceliumLiveNotification[] = [];

    const check = (
      nd: Pick<MyceliumAlgedonode, 'nodeId' | 'code' | 'name' | 'zkpProofHash' | 'sbtTokenId' | 'physicalSumQuotientS' | 'reportedSumQuotientS' | 'asbestosFibersCm3' | 'windSpeedMs'>,
      hazard: MyceliumHazardType, isOn: boolean, isOff: boolean, severity: MyceliumLiveNotificationSeverity,
      titleDa: string, messageDa: string, alloc: { j: number; kg: number; hepa: number }, gate1Passed = true, useRepS = false
    ) => {
      const key = `${nd.nodeId}:${hazard}`;
      if (latchRef.current[key]) {
        if (isOff) latchRef.current[key] = false; else if (isOn) hystInc++;
        return;
      }
      if (!isOn) return;
      if (activelyScrubbing) { scrubInc++; return; }
      if (now - (cooldownRef.current[key] ?? 0) < COOLDOWN_MS) { hystInc++; return; }
      latchRef.current[key] = true; cooldownRef.current[key] = now;
      emitted.push({
        id: `myc-live-${key}-${now}`, createdAtMs: now, timestampIso: simState.timestampIso,
        nodeId: nd.nodeId, nodeCode: nd.code, nodeName: nd.name, hazardType: hazard, severity, titleDa, messageDa,
        zkpProofHash: nd.zkpProofHash, sbtTokenId: nd.sbtTokenId, gate1Passed,
        measuredSumQuotientS: useRepS ? nd.reportedSumQuotientS : nd.physicalSumQuotientS,
        measuredAsbestosFibersCm3: nd.asbestosFibersCm3, measuredWindSpeedMs: nd.windSpeedMs,
        allocatedEnergyJoules: alloc.j, allocatedWaterMistKg: alloc.kg, allocatedHepaM3h: alloc.hepa, acknowledged: false,
      });
    };

    for (const nd of simState.nodes) {
      const g1 = simState.gate1ByNodeId[nd.nodeId];
      const al = simState.swarmAllocations.filter((a) => a.recipientNodeId === nd.nodeId);
      const alloc = {
        j: al.reduce((s, a) => s + a.energyJoules, 0),
        kg: Number(al.reduce((s, a) => s + a.waterMistKg, 0).toFixed(1)),
        hepa: al.reduce((s, a) => s + a.hepaAirM3h, 0),
      };

      if (nd.status === 'CRATER_OFFLINE') {
        check(nd, 'crater_offline', true, false, 'CRITICAL_P1', `KRATER-NEDBRUD (${nd.code})`,
          'Node offline — naboer i suveræn Island Mode & Dijkstra P2P selvheling aktiv.', alloc);
        continue;
      }
      latchRef.current[`${nd.nodeId}:crater_offline`] = false;

      if (nd.status === 'BYZANTINE_SPOOF' || g1?.classification === 'VARIANCE_INJECTION_DESTROYED_LOCALLY') {
        if (!gate1CountedRef.current[nd.nodeId]) { gate1CountedRef.current[nd.nodeId] = true; gate1Inc++; }
        if (alertProfile === 'strict_forensic') {
          check(nd, 'byzantine_spoof_blocked', true, false, 'CYBERNETIC_INFO', `GATE 1 AFVISTE CRY-WOLF (${nd.code})`,
            `Rapporteret S=${nd.reportedSumQuotientS.toFixed(2)} destrueret lokalt (0,0 J spild).`, { j: 0, kg: 0, hepa: 0 }, false, true);
        }
        continue;
      }
      gate1CountedRef.current[nd.nodeId] = false;
      latchRef.current[`${nd.nodeId}:byzantine_spoof_blocked`] = false;

      const gateOk = g1?.classification === 'VERIFIED_ALGEDONIC_PAIN' || (alertProfile === 'strict_forensic' && nd.physicalSumQuotientS >= 0.5);
      check(nd, 'sum_quotient_s', gateOk && nd.physicalSumQuotientS >= sOn, nd.physicalSumQuotientS <= sOff,
        nd.physicalSumQuotientS >= 1.0 ? 'CRITICAL_P1' : 'ELEVATED_ORANGE',
        `ALGEDONISK EKSPONERING: ${nd.code} (S=${nd.physicalSumQuotientS.toFixed(2)})`,
        `Gate 1 konsensus ${Math.round((g1?.consensusRatio ?? 0) * 100)}% · CiK sværm ${alloc.j} J / ${alloc.kg} kg vandtåge.`, alloc);
      check(nd, 'airborne_asbestos', gateOk && nd.asbestosFibersCm3 >= 0.003, nd.asbestosFibersCm3 <= 0.0025, 'CRITICAL_P1',
        `AKUT ASBESTFANE: ${nd.code} (${nd.asbestosFibersCm3.toFixed(4)} fibre/cm³)`,
        `BEK 613/2026 grænse overskredet · HEPA ${alloc.hepa} m³/h & ${alloc.kg} kg vandtåge aktiveret.`, alloc);
      check(nd, 'high_wind', gateOk && nd.windSpeedMs > 10.0, nd.windSpeedMs <= 8.8, 'CRITICAL_P1',
        `KRITISK VINDSTØD & STØVFLUGT: ${nd.code} (${nd.windSpeedMs.toFixed(1)} m/s)`,
        'Vind > 10,0 m/s med aktiv eksponering · vådnedbrydnings-interlock påkrævet.', alloc);
    }

    check({
      nodeId: 'SYSTEM_B', code: 'SYS-B', name: 'Mycelienetværk System B', zkpProofHash: `0x${simState.merkleRootHash}`,
      sbtTokenId: 'SBT-SYSB-APOPTOSIS', physicalSumQuotientS: 0, reportedSumQuotientS: 0, asbestosFibersCm3: 0, windSpeedMs: currentWeather?.windSpeed10m ?? 0,
    }, 'regulatory_apoptosis', simState.kpis.regulatoryApoptosisTriggered, !simState.kpis.regulatoryApoptosisTriggered, 'CRITICAL_P1',
    'REGULATORY APOPTOSIS & AMNESTI UDLØST',
    `Kill-chains sænket til ${simState.kpis.activeKillChainsPct}% & Algoritmisk Amnesti (P_s=1,00) aktiv ved σ=${simState.kpis.systemicEntropySigma.toFixed(2)}.`, { j: 0, kg: 0, hepa: 0 });

    const scrubSig = `${selectedHourIndex}::${isScrubbingSuppressed}::${isPlayingTimeline}`;
    const shouldCountSuppressionStats = !activelyScrubbing || lastScrubStatsSigRef.current !== scrubSig;
    if (activelyScrubbing) {
      lastScrubStatsSigRef.current = scrubSig;
    } else {
      lastScrubStatsSigRef.current = null;
    }

    if ((gate1Inc || (shouldCountSuppressionStats && (hystInc || scrubInc)) || emitted.length)) {
      const effHystInc = shouldCountSuppressionStats ? hystInc : 0;
      const effScrubInc = shouldCountSuppressionStats ? scrubInc : 0;
      if (gate1Inc || effHystInc || effScrubInc || emitted.length) {
        setSuppressedStats((p) => ({
          emittedCount: p.emittedCount + emitted.length, destroyedByGate1Count: p.destroyedByGate1Count + gate1Inc,
          suppressedByHysteresisCount: p.suppressedByHysteresisCount + effHystInc, suppressedByScrubbingCount: p.suppressedByScrubbingCount + effScrubInc,
        }));
      }
    }
    if (emitted.length > 0) {
      setEventLog((prev) => [...emitted, ...prev].slice(0, 50));
      setActiveToastQueue((prev) => [...emitted, ...prev].slice(0, 3));
      playBiocyberneticChime(false);
      dispatchOsNotification(emitted[0].titleDa, emitted[0].messageDa);
    }
  }, [simState, isLiveEnabled, alertProfile, isScrubbingSuppressed, selectedHourIndex, isPlayingTimeline, currentWeather?.windSpeed10m, playBiocyberneticChime, dispatchOsNotification]);

  const dismissToast = useCallback((id: string) => setActiveToastQueue((p) => p.filter((t) => t.id !== id)), []);
  const acknowledgeAlert = useCallback((id: string) => {
    setActiveToastQueue((p) => p.filter((t) => t.id !== id));
    setEventLog((p) => p.map((i) => (i.id === id ? { ...i, acknowledged: true } : i)));
  }, []);
  const acknowledgeAllAlerts = useCallback(() => {
    setActiveToastQueue([]);
    setEventLog((p) => p.map((i) => ({ ...i, acknowledged: true })));
  }, []);
  const clearResolvedAlerts = useCallback(() => setEventLog((p) => p.filter((i) => !i.acknowledged)), []);

  const requestBrowserNotificationSafe = useCallback(async () => {
    userInteractedRef.current = true;
    if (isCrossOriginIframe || detectIframeSafe() || typeof window === 'undefined' || !('Notification' in window)) { setBrowserPermission('iframe_blocked'); return; }
    try { setBrowserPermission(await Promise.resolve(window.Notification.requestPermission()).catch(() => 'iframe_blocked' as const)); }
    catch { setBrowserPermission('iframe_blocked'); }
  }, [isCrossOriginIframe]);

  const triggerManualAlgedonicTest = useCallback(() => {
    userInteractedRef.current = true;
    playBiocyberneticChime(true);
    const now = Date.now(), f = simState?.nodes[0];
    const n: MyceliumLiveNotification = {
      id: `myc-test-${now}`, createdAtMs: now, timestampIso: simState?.timestampIso || `${dateIso}T12:00:00`,
      nodeId: f?.nodeId || 'rec-blok-2', nodeCode: f?.code || 'B2', nodeName: f?.name || 'Blok 2 Receptor',
      hazardType: 'sum_quotient_s', severity: 'CRITICAL_P1', titleDa: `TEST VARSLING: ${f?.code || 'B2'} (Gate 1 Verificeret)`,
      messageDa: 'Biokybernetisk 528->660 Hz puls & In-App Taktisk Kanal verificeret.',
      zkpProofHash: f?.zkpProofHash || '0x8f94e2c1a04d7b319c5e20f1a6b8d4e291c3a5f708b2d4e619a3c5e7f9b1d3e5',
      sbtTokenId: f?.sbtTokenId || 'SBT-SYSB-TEST', gate1Passed: true,
      measuredSumQuotientS: Math.max(1.18, f?.physicalSumQuotientS ?? 1.18),
      measuredAsbestosFibersCm3: Math.max(0.0034, f?.asbestosFibersCm3 ?? 0.0034),
      measuredWindSpeedMs: Math.max(10.6, f?.windSpeedMs ?? 10.6),
      allocatedEnergyJoules: 210, allocatedWaterMistKg: 31.5, allocatedHepaM3h: 340, acknowledged: false,
    };
    setEventLog((p) => [n, ...p].slice(0, 50));
    setActiveToastQueue((p) => [n, ...p].slice(0, 3));
    setSuppressedStats((p) => ({ ...p, emittedCount: p.emittedCount + 1 }));
    dispatchOsNotification(n.titleDa, n.messageDa);
  }, [simState, dateIso, playBiocyberneticChime, dispatchOsNotification]);

  const focusNodeOnMap = useCallback((nodeId: string) => {
    if (onFocusNodeOnMap && nodeId !== 'SYSTEM_B') onFocusNodeOnMap(nodeId);
  }, [onFocusNodeOnMap]);

  const channelBadgeLabelDa = isCrossOriginIframe || browserPermission === 'iframe_blocked'
    ? 'In-App Taktisk Kanal (AI Studio Sandbox-sikker)'
    : browserPermission === 'granted' ? 'Dual-Channel Aktiv (In-App + OS Notifikation)' : 'In-App Taktisk Kanal Aktiv';

  const legacyAlerts: MyceliumLiveAlertItem[] = useMemo(() => eventLog.map((n) => ({
    id: n.id, createdAtMs: n.createdAtMs, timestampIso: n.timestampIso, hourLabel: n.timestampIso.slice(11, 16) || '12:00',
    priority: n.severity === 'CRITICAL_P1' ? 'P1_KRITISK_ALGEDONISK' : n.severity === 'ELEVATED_ORANGE' ? 'P2_FORHØJET_VARSEL' : 'P3_ADVISERING',
    receptorId: n.nodeId, receptorCode: n.nodeCode, receptorName: n.nodeName, sumQuotient: n.measuredSumQuotientS, lafmaxDb: 82,
    bftVerdict: n.gate1Passed ? 'BFT_KONSENSUS_GODKENDT' : 'BFT_BYZANTINSK_AFVIST', loraSubBand: 'G3_869_525MHZ_10PCT_ALGEDONIC',
    hopCount: 2, isSelfHealedRoute: false, headlineDa: n.titleDa, detailDa: n.messageDa, statutoryRefDa: n.sbtTokenId,
    acknowledged: n.acknowledged, resolvedByHysteresis: false,
  })), [eventLog]);

  const channelStatus: MyceliumNotificationChannelStatus = useMemo(() => ({
    isCrossOriginIframe, browserNotificationSupported: !isCrossOriginIframe && typeof window !== 'undefined' && 'Notification' in window,
    browserPermission, webAudioAvailable: typeof window !== 'undefined' && Boolean(window.AudioContext),
    audioMuted: !isAudioChimeEnabled, isScrubbingSuppressed,
  }), [isCrossOriginIframe, browserPermission, isAudioChimeEnabled, isScrubbingSuppressed]);

  return {
    isLiveEnabled, setIsLiveEnabled, toggleLiveEnabled: () => setIsLiveEnabled((v) => !v),
    alertProfile, setAlertProfile, isAudioChimeEnabled, setIsAudioChimeEnabled, toggleAudioMuted: () => setIsAudioChimeEnabled((v) => !v),
    notifyTimelineScrub, suppressedStats, channelBadgeLabelDa,
    visibleToasts: isLiveEnabled ? activeToastQueue.slice(0, 3) : [], eventLog,
    hoveredToastId, setHoveredToastId, dismissToast, focusNodeOnMap,
    enableOsBrowserNotification: requestBrowserNotificationSafe, triggerTestAlert: triggerManualAlgedonicTest,
    alerts: legacyAlerts, activeToastAlerts: isLiveEnabled ? legacyAlerts.filter((a) => activeToastQueue.some((t) => t.id === a.id)) : [],
    unacknowledgedCount: eventLog.filter((e) => !e.acknowledged).length, channelStatus,
    isDrawerOpen, setIsDrawerOpen, acknowledgeAlert, acknowledgeAllAlerts, clearResolvedAlerts,
    requestBrowserNotificationSafe, triggerManualAlgedonicTest,
  };
}

export interface UseSimultaneousAlgedonicDispatchParams {
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
  selectedHourIndex: number;
  timelineProgress: number;
  isPlayingTimeline: boolean;
  audioMuted?: boolean;
  linkedSha256ObservationCode?: string;
  linkedSha256Signature?: string;
  byzantineSpoofNodeCount?: number;
  onAtomicSimultaneousDispatch?: (dispatch: SimultaneousAlgedonicDispatch) => void;
}

/**
 * Atomar Simultanitets-Hook (Stafford Beers System B + ANSI/ISA-18.2):
 * Genererer ét fælles synkroniseret `SimultaneousAlgedonicDispatch`-objekt der aktiverer
 * både System 1 (Beboere & Arbejdere < 5s) og System 3 (Beredskab, SK Vand & Tilsyn)
 * i nøjagtig samme render-tick (T0 -> T1, Δt = 0 ms bureaukratisk bypass).
 */
export function useSimultaneousAlgedonicDispatch({
  sources,
  receptors,
  buildings,
  receptorExposures,
  mesh,
  currentWeather,
  maxSiteSumQuotient,
  indoorClimateTelemetry,
  waterMainTelemetry,
  machineNoiseOutputDb,
  cavVentilationModeLabelDa,
  selectedHourIndex,
  timelineProgress,
  isPlayingTimeline,
  audioMuted = false,
  linkedSha256ObservationCode,
  linkedSha256Signature,
  byzantineSpoofNodeCount = 0,
  onAtomicSimultaneousDispatch,
}: UseSimultaneousAlgedonicDispatchParams) {
  const [manualScenarioOverride, setManualScenarioOverride] =
    useState<AlgedonicTestScenarioId | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState<boolean>(false);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [acknowledgedAtIso, setAcknowledgedAtIso] = useState<string | null>(null);
  const [t0EpochMs, setT0EpochMs] = useState<number>(() => Date.now());
  const [autoLatched, setAutoLatched] = useState<boolean>(false);
  const [localAudioMuted, setLocalAudioMuted] = useState<boolean>(audioMuted);

  const scrubUntilMsRef = useRef<number>(0);
  const prevHourRef = useRef<number>(selectedHourIndex);
  const prevProgressRef = useRef<number>(timelineProgress);
  const lastCommittedKeyRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chimeIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalAudioMuted(audioMuted);
  }, [audioMuted]);

  useEffect(() => {
    if (
      prevHourRef.current !== selectedHourIndex ||
      prevProgressRef.current !== timelineProgress ||
      isPlayingTimeline
    ) {
      prevHourRef.current = selectedHourIndex;
      prevProgressRef.current = timelineProgress;
      scrubUntilMsRef.current = Date.now() + 650;
    }
  }, [selectedHourIndex, timelineProgress, isPlayingTimeline]);

  const playDualToneP1 = useCallback(
    (force = false) => {
      if (!force && localAudioMuted) return;
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => undefined);
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(528, now);
        osc.frequency.setValueAtTime(660, now + 0.16);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.37);
      } catch {
        // Sandbox-safe WebAudio fallback
      }
    },
    [localAudioMuted]
  );

  // Compute live evaluation before applying hysteresis latch
  const rawEval = useMemo(
    () =>
      evaluateSimultaneousAlgedonicDispatch({
        sources,
        receptors,
        buildings,
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
        existingT0EpochMs: t0EpochMs,
        linkedSha256ObservationCode,
        linkedSha256Signature,
        byzantineSpoofNodeCount,
      }),
    [
      sources,
      receptors,
      buildings,
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
      t0EpochMs,
      linkedSha256ObservationCode,
      linkedSha256Signature,
      byzantineSpoofNodeCount,
    ]
  );

  const onAtomicDispatchRef = useRef(onAtomicSimultaneousDispatch);
  onAtomicDispatchRef.current = onAtomicSimultaneousDispatch;

  // Hysteresis latch + scrubbing suppression for automatic triggers
  useEffect(() => {
    if (manualScenarioOverride !== null) {
      if (!autoLatched) setAutoLatched(true);
      return;
    }
    const isScrubbing =
      isPlayingTimeline || Date.now() < scrubUntilMsRef.current;
    if (isScrubbing) return;

    if (rawEval.triggers.anyTriggered && rawEval.gate1Validation.passed) {
      if (!autoLatched) {
        setT0EpochMs(Date.now());
        setAcknowledged(false);
        setAcknowledgedAtIso(null);
        setAutoLatched(true);
      }
    } else if (
      autoLatched &&
      rawEval.triggers.outdoorSumQuotientValue < 0.65 &&
      rawEval.triggers.indoorSumQuotientValue < 0.65 &&
      rawEval.triggers.waterMainPressureBar >= 2.2 &&
      rawEval.triggers.waterMainPpvMmS < 18.0
    ) {
      setAutoLatched(false);
      setAcknowledged(false);
      setAcknowledgedAtIso(null);
      lastCommittedKeyRef.current = null;
    }
  }, [
    manualScenarioOverride,
    isPlayingTimeline,
    rawEval.triggers.anyTriggered,
    rawEval.triggers.outdoorSumQuotientValue,
    rawEval.triggers.indoorSumQuotientValue,
    rawEval.triggers.waterMainPressureBar,
    rawEval.triggers.waterMainPpvMmS,
    rawEval.gate1Validation.passed,
    autoLatched,
  ]);

  const dispatch: SimultaneousAlgedonicDispatch = useMemo(() => {
    const isActive =
      manualScenarioOverride !== null ||
      (autoLatched && rawEval.gate1Validation.passed);
    if (!isActive) {
      return {
        ...rawEval,
        active: false,
        isBlinkingP1: false,
        system1State: {
          ...rawEval.system1State,
          status: 'STANDBY',
        },
        system3State: {
          ...rawEval.system3State,
          status: 'STANDBY',
        },
      };
    }
    return {
      ...rawEval,
      active: true,
      isBlinkingP1: !acknowledged,
    };
  }, [rawEval, manualScenarioOverride, autoLatched, acknowledged]);

  // Atomic commit effect (fires once per new active T0->T1 event to lock S3 & sign SHA-256)
  useEffect(() => {
    if (!dispatch.active) return;
    const commitKey = `${dispatch.scenarioId}::${dispatch.t0EpochMs}`;
    if (lastCommittedKeyRef.current === commitKey) return;
    lastCommittedKeyRef.current = commitKey;
    playDualToneP1(false);
    onAtomicDispatchRef.current?.(dispatch);
  }, [dispatch, playDualToneP1]);

  // Discrete ISA-18.2 reminder pulse every 6s while unacknowledged & not muted
  useEffect(() => {
    if (chimeIntervalRef.current !== null) {
      window.clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
    }
    if (!dispatch.isBlinkingP1 || localAudioMuted) return;
    chimeIntervalRef.current = window.setInterval(() => {
      playDualToneP1(false);
    }, 6500);
    return () => {
      if (chimeIntervalRef.current !== null) {
        window.clearInterval(chimeIntervalRef.current);
        chimeIntervalRef.current = null;
      }
    };
  }, [dispatch.isBlinkingP1, localAudioMuted, playDualToneP1]);

  const triggerScenarioSimulation = useCallback(
    (scenarioId: AlgedonicTestScenarioId, openSplitModal = true) => {
      const now = Date.now();
      setT0EpochMs(now);
      setAcknowledged(false);
      setAcknowledgedAtIso(null);
      setManualScenarioOverride(scenarioId);
      setAutoLatched(true);
      lastCommittedKeyRef.current = null;
      if (openSplitModal) {
        setIsSplitModalOpen(true);
      }
      playDualToneP1(true);
    },
    [playDualToneP1]
  );

  const acknowledgeP1 = useCallback(() => {
    setAcknowledged(true);
    setAcknowledgedAtIso(new Date().toISOString());
  }, []);

  const clearSimultaneousSimulation = useCallback(() => {
    setManualScenarioOverride(null);
    setAutoLatched(false);
    setAcknowledged(false);
    setAcknowledgedAtIso(null);
    lastCommittedKeyRef.current = null;
  }, []);

  const toggleAudioMuted = useCallback(() => {
    setLocalAudioMuted((v) => !v);
  }, []);

  return {
    dispatch,
    manualScenarioOverride,
    isSplitModalOpen,
    setIsSplitModalOpen,
    audioMuted: localAudioMuted,
    toggleAudioMuted,
    triggerScenarioSimulation,
    acknowledgeP1,
    clearSimultaneousSimulation,
  };
}

