/**
 * @file src/components/NoiseComplianceLogPanel.tsx
 * @description Realtids støj-overholdelseslog (L_Aeq & L_AFmax > 55 dB(A)) for valgt receptor
 * med direkte CSV-eksport i Slagelse Kommune ESDH-format.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FastForward,
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LegalViolationEntry,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';
import {
  angularDiffDeg,
  bearingBetweenPointsDeg,
  distanceBetweenPointsMeters,
} from '../services/dispersionEngine';
import { exportSlagelseViolationsEsdhCsv } from '../services/exportHubHelpers';
import {
  NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
  NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB,
  NoiseComplianceHysteresisState,
  createInitialNoiseHysteresisState,
  evaluateNoiseComplianceHysteresisStep,
  formatDurationMmSs,
} from '../utils/noiseComplianceHysteresis';
import {
  IMPULSE_85DB_MIN_DURATION_MS,
  IMPULSE_85DB_THRESHOLD_DB,
  Impulse85DbNoiseEvent,
  Impulse85DbTrackerState,
  createInitialImpulse85DbTrackerState,
  createSignedImpulse85DbEventAndObservation,
  evaluateImpulse85DbStep,
} from '../utils/impulseNoiseEventTracker';
import { useAcousticWeighting } from '../context/AcousticWeightingContext';
import {
  computeMeteorologicalRefractionContext,
  generateImpulseNoiseEventPdfReport,
} from '../services/meteorologicalRefractionPdfContext';

export interface NoiseComplianceLogEntry {
  id: string;
  loggedAtIso: string;
  dateIso: string;
  hourIndex: number;
  hourLabel: string;
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  receptorAddress: string;
  laeqDb: number;
  impulseAdjustedLaeqDb: number;
  lafmaxDb: number;
  exceedanceDb: number;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
  windRefractionDb: number;
  dominantSourceName: string;
  distanceMeters: number;
  sumQuotient: number;
}

export interface NoiseComplianceLogPanelProps {
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  weatherHours: HourlyWeatherPoint[];
  selectedHourIndex: number;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  selectedReceptorExposure: ReceptorExposureResult;
  manualMachineNoiseOutputDb: number;
  isManualMachineNoiseOverrideActive: boolean;
  plumeDirectionDeg: number;
  sha256Hash: string;
  onSelectHour?: (hourIndex: number) => void;
  onAppendImpulseNoiseEvidence?: (observation: AlgedonicObservation) => void;
}

const NOISE_COMPLIANCE_THRESHOLD_DB = 55.0;

function computeReceptorNoiseSnapshot(params: {
  weather: HourlyWeatherPoint;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposure: ReceptorExposureResult;
  manualMachineNoiseOutputDb: number;
  isManualMachineNoiseOverrideActive: boolean;
}): {
  laeqDb: number;
  impulseAdjustedLaeqDb: number;
  lafmaxDb: number;
  windRefractionDb: number;
  dominantSourceName: string;
  distanceMeters: number;
} {
  const {
    weather,
    sources,
    receptors,
    receptorExposure,
    manualMachineNoiseOutputDb,
    isManualMachineNoiseOverrideActive,
  } = params;

  const activeSources = sources.filter((s) => s.active);
  const recDef = receptors.find((r) => r.id === receptorExposure.receptorId);
  const targetPt = recDef?.center || receptorExposure.position;

  const isDaytimeWorkHours = weather.hourIndex >= 7 && weather.hourIndex < 18;
  const isEveningHours = weather.hourIndex >= 18 && weather.hourIndex < 22;
  const ambientDb = isDaytimeWorkHours ? 47.0 : isEveningHours ? 42.0 : 38.0;
  const effectiveWindSpeed = Math.max(weather.windSpeed10m, weather.windGusts10m * 0.72);
  const windPropagationDeg = (weather.windDirection10m + 180) % 360;
  const inversionBonusDb =
    weather.pasquillClass === 'E' || weather.pasquillClass === 'F'
      ? 2.2
      : weather.pasquillClass === 'A' || weather.pasquillClass === 'B'
      ? -0.8
      : 0.0;

  const demolishedUnsecuredCount = activeSources.filter(
    (s) => s.buildingCategory === 'e_demolished_unsecured' || s.buildingHeight3DMeters === 0
  ).length;
  const lostBarrierShieldingDb = Math.min(7.0, demolishedUnsecuredCount * 3.5);

  const getSourceLwaAndImpulse = (src: DemolitionSourceNode) => {
    if (isManualMachineNoiseOverrideActive) {
      const scaledImpulse = Math.max(
        6.0,
        Math.min(18.0, (manualMachineNoiseOutputDb - 88) * 0.45 + 6.0)
      );
      return {
        lwaDb: manualMachineNoiseOutputDb,
        impulseDb: isDaytimeWorkHours ? scaledImpulse : scaledImpulse * 0.75,
      };
    }
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

    if (src.buildingCategory === 'b_vacant') return applyOverride(68.0, 4.0);
    if (src.buildingCategory === 'e_demolished_unsecured') {
      return applyOverride(isDaytimeWorkHours ? 98.5 : 88.0, 8.5);
    }
    if (src.buildingCategory === 'c_under_renovation') {
      return applyOverride(isDaytimeWorkHours ? 108.5 : 86.0, 12.0);
    }
    if (!isDaytimeWorkHours) {
      const windRattleBoost = Math.min(7.5, Math.max(0, weather.windGusts10m - 6) * 0.65);
      return applyOverride(
        (src.id === 'src-blok-1' ? 96.5 : 93.0) + windRattleBoost,
        src.id === 'src-blok-1' ? 12.5 : 10.5
      );
    }
    if (src.id === 'src-blok-1') return applyOverride(118.5, 15.0);
    if (src.id === 'src-bygning-2') return applyOverride(115.0, 16.0);
    if (src.id === 'src-bygning-3') return applyOverride(112.0, 12.5);
    return applyOverride(114.0, 14.0);
  };

  let sumLinearAcoustic = Math.pow(10, ambientDb / 10);
  let maxLafmaxDb = ambientDb + 5;
  let dominantSourceName = receptorExposure.dominantSourceName;
  let maxSingleSrcLaeq = -Infinity;
  let dominantDistM = receptorExposure.distanceFromNearestSourceMeters;
  let dominantWindRefractionDb = 0;

  for (const src of activeSources) {
    const { lwaDb, impulseDb } = getSourceLwaAndImpulse(src);
    const horizDist = Math.max(8, distanceBetweenPointsMeters(src.position, targetPt));
    const heightDiff = Math.max(1.0, src.releaseHeightMeters) - 1.5;
    const slantDist = Math.sqrt(horizDist * horizDist + heightDiff * heightDiff);

    const bearingDeg = bearingBetweenPointsDeg(src.position, targetPt);
    const angleDiff = angularDiffDeg(bearingDeg, windPropagationDeg);
    const windCos = Math.cos((angleDiff * Math.PI) / 180);

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
      dominantSourceName = src.name;
      dominantDistM = Math.round(horizDist);
      dominantWindRefractionDb = Number(metCorrectionDb.toFixed(1));
    }
  }

  const laeqDb = Number((10 * Math.log10(sumLinearAcoustic)).toFixed(1));
  const impulseAdjustedLaeqDb = Number((laeqDb + 5.0).toFixed(1));
  const lafmaxDb = Number(maxLafmaxDb.toFixed(1));

  return {
    laeqDb,
    impulseAdjustedLaeqDb,
    lafmaxDb,
    windRefractionDb: dominantWindRefractionDb,
    dominantSourceName,
    distanceMeters: dominantDistM,
  };
}

export const NoiseComplianceLogPanel: React.FC<NoiseComplianceLogPanelProps> = ({
  dateIso,
  currentWeather,
  weatherHours,
  selectedHourIndex,
  sources,
  receptors,
  selectedReceptorExposure,
  manualMachineNoiseOutputDb,
  isManualMachineNoiseOverrideActive,
  plumeDirectionDeg,
  sha256Hash,
  onSelectHour,
  onAppendImpulseNoiseEvidence,
}) => {
  const { convertDb, unitLabel, labels } = useAcousticWeighting();
  const [logEntries, setLogEntries] = useState<NoiseComplianceLogEntry[]>([]);
  const [esdhExportedJustNow, setEsdhExportedJustNow] = useState(false);
  const [hysteresisByReceptorId, setHysteresisByReceptorId] = useState<
    Record<string, NoiseComplianceHysteresisState>
  >({});
  const [simulatedOffsetMs, setSimulatedOffsetMs] = useState<number>(0);
  const [tickerMs, setTickerMs] = useState<number>(() => Date.now());
  const hysteresisRef = useRef<Record<string, NoiseComplianceHysteresisState>>({});
  const lastReadingSigRef = useRef<string>('');

  // Automatisk >85 dB(A) (> 5 min) Impulsstøj Hændelseslog + SHA-256 Bevisførelse
  const [impulse85Events, setImpulse85Events] = useState<Impulse85DbNoiseEvent[]>([]);
  const [impulseTrackerByReceptorId, setImpulseTrackerByReceptorId] = useState<
    Record<string, Impulse85DbTrackerState>
  >({});
  const impulseTrackerRef = useRef<Record<string, Impulse85DbTrackerState>>({});
  const recordedImpulseKeysRef = useRef<Set<string>>(new Set());
  const [impulse85JustSavedBadge, setImpulse85JustSavedBadge] = useState<string | null>(null);

  const liveReading = useMemo(
    () =>
      computeReceptorNoiseSnapshot({
        weather: currentWeather,
        sources,
        receptors,
        receptorExposure: selectedReceptorExposure,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
      }),
    [
      currentWeather,
      sources,
      receptors,
      selectedReceptorExposure,
      manualMachineNoiseOutputDb,
      isManualMachineNoiseOverrideActive,
    ]
  );

  const currentMaxDb = Number(
    Math.max(liveReading.laeqDb, liveReading.lafmaxDb).toFixed(1)
  );

  const isCurrentExceeding55 =
    liveReading.laeqDb > NOISE_COMPLIANCE_THRESHOLD_DB ||
    liveReading.lafmaxDb > NOISE_COMPLIANCE_THRESHOLD_DB;

  const activeReceptorId = selectedReceptorExposure.receptorId;
  const activeHysteresis =
    hysteresisByReceptorId[activeReceptorId] ??
    createInitialNoiseHysteresisState(activeReceptorId, tickerMs);

  const recoveryProgress = useMemo(() => {
    if (activeHysteresis.phase !== 'COMPLIANCE_RECOVERY') {
      return {
        elapsedMs: 0,
        remainingMs:
          activeHysteresis.phase === 'ALARM_LATCHED'
            ? NOISE_HYSTERESIS_RESET_COMPLIANCE_MS
            : 0,
        progressPct: activeHysteresis.phase === 'MONITORING_IDLE' ? 100 : 0,
      };
    }
    const startedAt = activeHysteresis.complianceStartedAtMs ?? tickerMs;
    const elapsedMs = Math.max(0, tickerMs - startedAt);
    const remainingMs = Math.max(0, NOISE_HYSTERESIS_RESET_COMPLIANCE_MS - elapsedMs);
    const progressPct = Math.min(
      100,
      Math.round((elapsedMs / NOISE_HYSTERESIS_RESET_COMPLIANCE_MS) * 100)
    );
    return { elapsedMs, remainingMs, progressPct };
  }, [activeHysteresis, tickerMs]);

  const readingSig = `${activeReceptorId}|${dateIso}|${selectedHourIndex}|${currentMaxDb.toFixed(1)}`;

  // Avanceret støjalarm-hysterese: låser ved >55 dB, dæmper fluktuationer, og nulstiller først efter 15 min overholdelse
  useEffect(() => {
    if (lastReadingSigRef.current === readingSig) return;
    lastReadingSigRef.current = readingSig;

    const nowMs = Date.now() + simulatedOffsetMs;
    const prevHys =
      hysteresisRef.current[activeReceptorId] ??
      createInitialNoiseHysteresisState(activeReceptorId, nowMs);

    const step = evaluateNoiseComplianceHysteresisStep(prevHys, {
      currentMaxDb,
      nowMs,
      hourLabel: currentWeather.hourLabel,
      receptorId: activeReceptorId,
      receptorCode: selectedReceptorExposure.receptorCode,
      thresholdDb: NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB,
      complianceResetMs: NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
    });

    hysteresisRef.current = {
      ...hysteresisRef.current,
      [activeReceptorId]: step.nextState,
    };
    setHysteresisByReceptorId((prev) => ({
      ...prev,
      [activeReceptorId]: step.nextState,
    }));
    setTickerMs(nowMs);

    if (!step.shouldEmitAlarmNotification || !isCurrentExceeding55) return;

    const exceedanceDb = Number(
      (currentMaxDb - NOISE_COMPLIANCE_THRESHOLD_DB).toFixed(1)
    );
    const entryId = `ncl-${dateIso}-${selectedHourIndex}-${activeReceptorId}-${liveReading.laeqDb.toFixed(
      1
    )}-${liveReading.lafmaxDb.toFixed(1)}-r${step.nextState.resetCount}`;

    setLogEntries((prev) => {
      if (prev.some((item) => item.id === entryId)) {
        return prev;
      }
      const nextItem: NoiseComplianceLogEntry = {
        id: entryId,
        loggedAtIso: new Date().toISOString(),
        dateIso,
        hourIndex: selectedHourIndex,
        hourLabel: currentWeather.hourLabel,
        receptorId: activeReceptorId,
        receptorCode: selectedReceptorExposure.receptorCode,
        receptorName: selectedReceptorExposure.receptorName,
        receptorAddress: selectedReceptorExposure.address,
        laeqDb: liveReading.laeqDb,
        impulseAdjustedLaeqDb: liveReading.impulseAdjustedLaeqDb,
        lafmaxDb: liveReading.lafmaxDb,
        exceedanceDb,
        windSpeedMs: currentWeather.windSpeed10m,
        windGustsMs: currentWeather.windGusts10m,
        windDirectionDeg: currentWeather.windDirection10m,
        windRefractionDb: liveReading.windRefractionDb,
        dominantSourceName: liveReading.dominantSourceName,
        distanceMeters: liveReading.distanceMeters,
        sumQuotient: selectedReceptorExposure.sumQuotient,
      };
      return [nextItem, ...prev].slice(0, 72);
    });
  }, [
    readingSig,
    simulatedOffsetMs,
    activeReceptorId,
    currentMaxDb,
    isCurrentExceeding55,
    dateIso,
    selectedHourIndex,
    currentWeather.hourLabel,
    currentWeather.windSpeed10m,
    currentWeather.windGusts10m,
    currentWeather.windDirection10m,
    selectedReceptorExposure,
    liveReading,
  ]);

  // 1-sekunds live overholdelsestimer under COMPLIANCE_RECOVERY (nulstiller automatisk ved >= 15 min <= 55 dB)
  useEffect(() => {
    if (activeHysteresis.phase !== 'COMPLIANCE_RECOVERY') return;
    const id = window.setInterval(() => {
      const nowMs = Date.now() + simulatedOffsetMs;
      setTickerMs(nowMs);
      const curr = hysteresisRef.current[activeReceptorId];
      if (!curr || curr.phase !== 'COMPLIANCE_RECOVERY') return;
      const startedAt = curr.complianceStartedAtMs ?? nowMs;
      if (nowMs - startedAt >= NOISE_HYSTERESIS_RESET_COMPLIANCE_MS) {
        const step = evaluateNoiseComplianceHysteresisStep(curr, {
          currentMaxDb,
          nowMs,
          hourLabel: currentWeather.hourLabel,
          receptorId: activeReceptorId,
          receptorCode: selectedReceptorExposure.receptorCode,
          thresholdDb: NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB,
          complianceResetMs: NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
        });
        hysteresisRef.current = {
          ...hysteresisRef.current,
          [activeReceptorId]: step.nextState,
        };
        setHysteresisByReceptorId((prev) => ({
          ...prev,
          [activeReceptorId]: step.nextState,
        }));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    activeHysteresis.phase,
    activeReceptorId,
    simulatedOffsetMs,
    currentMaxDb,
    currentWeather.hourLabel,
    selectedReceptorExposure.receptorCode,
  ]);

  const handleSimulate15MinComplianceReset = () => {
    const curr =
      hysteresisRef.current[activeReceptorId] ??
      createInitialNoiseHysteresisState(activeReceptorId, Date.now());
    const jumpMs = NOISE_HYSTERESIS_RESET_COMPLIANCE_MS + 1000;
    const nextOffset = simulatedOffsetMs + jumpMs;
    const targetNowMs = Date.now() + nextOffset;

    let working = curr;
    if (working.phase === 'ALARM_LATCHED') {
      working = evaluateNoiseComplianceHysteresisStep(working, {
        currentMaxDb: Math.min(currentMaxDb, 52.0),
        nowMs: targetNowMs - jumpMs,
        hourLabel: currentWeather.hourLabel,
        receptorId: activeReceptorId,
        receptorCode: selectedReceptorExposure.receptorCode,
        thresholdDb: NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB,
        complianceResetMs: NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
      }).nextState;
    }
    const resetStep = evaluateNoiseComplianceHysteresisStep(working, {
      currentMaxDb: Math.min(currentMaxDb, 52.0),
      nowMs: targetNowMs,
      hourLabel: currentWeather.hourLabel,
      receptorId: activeReceptorId,
      receptorCode: selectedReceptorExposure.receptorCode,
      thresholdDb: NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB,
      complianceResetMs: NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
    });
    hysteresisRef.current = {
      ...hysteresisRef.current,
      [activeReceptorId]: resetStep.nextState,
    };
    setHysteresisByReceptorId((prev) => ({
      ...prev,
      [activeReceptorId]: resetStep.nextState,
    }));
    setSimulatedOffsetMs(nextOffset);
    setTickerMs(targetNowMs);
  };

  // Evaluate live >85 dB(A) sustained (>5 min) impulse noise tracker
  const activeImpulseTracker =
    impulseTrackerByReceptorId[activeReceptorId] ??
    createInitialImpulse85DbTrackerState(activeReceptorId);
  const isExceeding85Live = liveReading.lafmaxDb > IMPULSE_85DB_THRESHOLD_DB;
  const impulse85ElapsedMs =
    isExceeding85Live && activeImpulseTracker.startedAtMs !== null
      ? Math.max(0, tickerMs - activeImpulseTracker.startedAtMs)
      : 0;
  const impulse85RemainingMs = Math.max(0, IMPULSE_85DB_MIN_DURATION_MS - impulse85ElapsedMs);
  const impulse85ProgressPct = isExceeding85Live
    ? Math.min(100, Math.round((impulse85ElapsedMs / IMPULSE_85DB_MIN_DURATION_MS) * 100))
    : 0;

  const commitImpulse85DbEvent = async (params: {
    weather: HourlyWeatherPoint;
    laeqDb: number;
    peakLafmaxDb: number;
    durationSeconds: number;
    dominantSourceName: string;
    distanceMeters: number;
    dedupKey: string;
  }) => {
    if (recordedImpulseKeysRef.current.has(params.dedupKey)) return;
    recordedImpulseKeysRef.current.add(params.dedupKey);

    const { event, observation } = await createSignedImpulse85DbEventAndObservation({
      eventNumber: impulse85Events.length + recordedImpulseKeysRef.current.size,
      dateIso,
      weather: params.weather,
      receptorExposure: selectedReceptorExposure,
      receptorAddress: selectedReceptorExposure.address,
      laeqDb: params.laeqDb,
      peakLafmaxDb: params.peakLafmaxDb,
      durationSeconds: params.durationSeconds,
      dominantSourceName: params.dominantSourceName,
      distanceMeters: params.distanceMeters,
    });

    setImpulse85Events((prev) => [event, ...prev].slice(0, 48));
    onAppendImpulseNoiseEvidence?.(observation);
    setImpulse85JustSavedBadge(`${event.eventCode} · SHA-256: ${event.sha256Signature.slice(0, 14)}...`);
    window.setTimeout(() => setImpulse85JustSavedBadge(null), 4200);
  };

  useEffect(() => {
    const nowMs = Date.now() + simulatedOffsetMs;
    const prevTracker =
      impulseTrackerRef.current[activeReceptorId] ??
      createInitialImpulse85DbTrackerState(activeReceptorId);
    const step = evaluateImpulse85DbStep(prevTracker, {
      receptorId: activeReceptorId,
      currentLafmaxDb: liveReading.lafmaxDb,
      nowMs,
      dateIso,
      hourIndex: selectedHourIndex,
    });
    impulseTrackerRef.current = {
      ...impulseTrackerRef.current,
      [activeReceptorId]: step.nextState,
    };
    setImpulseTrackerByReceptorId((prev) => ({
      ...prev,
      [activeReceptorId]: step.nextState,
    }));

    if (step.shouldAutoRecord && step.cycleKey) {
      void commitImpulse85DbEvent({
        weather: currentWeather,
        laeqDb: liveReading.laeqDb,
        peakLafmaxDb: step.nextState.peakLafmaxDb,
        durationSeconds: Math.max(301, Math.round(step.elapsedMs / 1000)),
        dominantSourceName: liveReading.dominantSourceName,
        distanceMeters: liveReading.distanceMeters,
        dedupKey: step.cycleKey,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReceptorId, dateIso, selectedHourIndex, liveReading.lafmaxDb]);

  // 1-second timer while live impulse noise exceeds 85 dB(A) -> auto-saves to evidence log at > 5 min
  useEffect(() => {
    if (!isExceeding85Live) return;
    const id = window.setInterval(() => {
      const nowMs = Date.now() + simulatedOffsetMs;
      setTickerMs(nowMs);
      const curr =
        impulseTrackerRef.current[activeReceptorId] ??
        createInitialImpulse85DbTrackerState(activeReceptorId);
      const step = evaluateImpulse85DbStep(curr, {
        receptorId: activeReceptorId,
        currentLafmaxDb: liveReading.lafmaxDb,
        nowMs,
        dateIso,
        hourIndex: selectedHourIndex,
      });
      if (step.shouldAutoRecord && step.cycleKey) {
        impulseTrackerRef.current = {
          ...impulseTrackerRef.current,
          [activeReceptorId]: step.nextState,
        };
        setImpulseTrackerByReceptorId((prev) => ({
          ...prev,
          [activeReceptorId]: step.nextState,
        }));
        void commitImpulse85DbEvent({
          weather: currentWeather,
          laeqDb: liveReading.laeqDb,
          peakLafmaxDb: step.nextState.peakLafmaxDb,
          durationSeconds: Math.max(301, Math.round(step.elapsedMs / 1000)),
          dominantSourceName: liveReading.dominantSourceName,
          distanceMeters: liveReading.distanceMeters,
          dedupKey: step.cycleKey,
        });
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExceeding85Live, activeReceptorId, simulatedOffsetMs, dateIso, selectedHourIndex, liveReading.lafmaxDb]);

  const handleSimulate5MinAbove85Db = async () => {
    const simulatedDurationMs = IMPULSE_85DB_MIN_DURATION_MS + 15_000; // 5m 15s (> 5 min)
    const nextOffset = simulatedOffsetMs + simulatedDurationMs;
    const targetNowMs = Date.now() + nextOffset;
    const prevTracker =
      impulseTrackerRef.current[activeReceptorId] ??
      createInitialImpulse85DbTrackerState(activeReceptorId);
    const effectiveLafmax = Math.max(liveReading.lafmaxDb, 88.4);

    const seededState: Impulse85DbTrackerState = {
      ...prevTracker,
      receptorId: activeReceptorId,
      startedAtMs: prevTracker.startedAtMs ?? targetNowMs - simulatedDurationMs,
      peakLafmaxDb: Math.max(prevTracker.peakLafmaxDb, effectiveLafmax),
    };
    const step = evaluateImpulse85DbStep(seededState, {
      receptorId: activeReceptorId,
      currentLafmaxDb: effectiveLafmax,
      nowMs: targetNowMs,
      dateIso,
      hourIndex: selectedHourIndex,
    });
    impulseTrackerRef.current = {
      ...impulseTrackerRef.current,
      [activeReceptorId]: step.nextState,
    };
    setImpulseTrackerByReceptorId((prev) => ({
      ...prev,
      [activeReceptorId]: step.nextState,
    }));
    setSimulatedOffsetMs(nextOffset);
    setTickerMs(targetNowMs);

    const key = step.cycleKey ?? `sim-${dateIso}-h${selectedHourIndex}-${activeReceptorId}-${targetNowMs}`;
    await commitImpulse85DbEvent({
      weather: currentWeather,
      laeqDb: liveReading.laeqDb,
      peakLafmaxDb: effectiveLafmax,
      durationSeconds: Math.max(315, Math.round(step.elapsedMs / 1000)),
      dominantSourceName: liveReading.dominantSourceName,
      distanceMeters: liveReading.distanceMeters,
      dedupKey: key,
    });
  };

  const handleScan24HoursForReceptor = () => {
    const scanned: NoiseComplianceLogEntry[] = [];
    weatherHours.slice(0, 24).forEach((hr) => {
      const snap = computeReceptorNoiseSnapshot({
        weather: hr,
        sources,
        receptors,
        receptorExposure: selectedReceptorExposure,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
      });
      if (
        snap.laeqDb > NOISE_COMPLIANCE_THRESHOLD_DB ||
        snap.lafmaxDb > NOISE_COMPLIANCE_THRESHOLD_DB
      ) {
        const maxVal = Math.max(snap.laeqDb, snap.lafmaxDb);
        scanned.push({
          id: `ncl-${dateIso}-${hr.hourIndex}-${selectedReceptorExposure.receptorId}-${snap.laeqDb.toFixed(
            1
          )}-${snap.lafmaxDb.toFixed(1)}`,
          loggedAtIso: new Date().toISOString(),
          dateIso,
          hourIndex: hr.hourIndex,
          hourLabel: hr.hourLabel,
          receptorId: selectedReceptorExposure.receptorId,
          receptorCode: selectedReceptorExposure.receptorCode,
          receptorName: selectedReceptorExposure.receptorName,
          receptorAddress: selectedReceptorExposure.address,
          laeqDb: snap.laeqDb,
          impulseAdjustedLaeqDb: snap.impulseAdjustedLaeqDb,
          lafmaxDb: snap.lafmaxDb,
          exceedanceDb: Number((maxVal - NOISE_COMPLIANCE_THRESHOLD_DB).toFixed(1)),
          windSpeedMs: hr.windSpeed10m,
          windGustsMs: hr.windGusts10m,
          windDirectionDeg: hr.windDirection10m,
          windRefractionDb: snap.windRefractionDb,
          dominantSourceName: snap.dominantSourceName,
          distanceMeters: snap.distanceMeters,
          sumQuotient: selectedReceptorExposure.sumQuotient,
        });
      }
    });

    if (scanned.length === 0) return;
    setLogEntries((prev) => {
      const map = new Map<string, NoiseComplianceLogEntry>();
      prev.forEach((p) => map.set(p.id, p));
      scanned.forEach((s) => map.set(s.id, s));
      return Array.from(map.values())
        .sort((a, b) => b.hourIndex - a.hourIndex)
        .slice(0, 72);
    });
  };

  const handleExportToSlagelseEsdh = () => {
    const entriesToExport: NoiseComplianceLogEntry[] =
      logEntries.length > 0
        ? logEntries
        : [
            {
              id: `ncl-snapshot-${dateIso}-${selectedHourIndex}`,
              loggedAtIso: new Date().toISOString(),
              dateIso,
              hourIndex: selectedHourIndex,
              hourLabel: currentWeather.hourLabel,
              receptorId: selectedReceptorExposure.receptorId,
              receptorCode: selectedReceptorExposure.receptorCode,
              receptorName: selectedReceptorExposure.receptorName,
              receptorAddress: selectedReceptorExposure.address,
              laeqDb: liveReading.laeqDb,
              impulseAdjustedLaeqDb: liveReading.impulseAdjustedLaeqDb,
              lafmaxDb: liveReading.lafmaxDb,
              exceedanceDb: Number(
                Math.max(
                  0,
                  Math.max(liveReading.laeqDb, liveReading.lafmaxDb) -
                    NOISE_COMPLIANCE_THRESHOLD_DB
                ).toFixed(1)
              ),
              windSpeedMs: currentWeather.windSpeed10m,
              windGustsMs: currentWeather.windGusts10m,
              windDirectionDeg: currentWeather.windDirection10m,
              windRefractionDb: liveReading.windRefractionDb,
              dominantSourceName: liveReading.dominantSourceName,
              distanceMeters: liveReading.distanceMeters,
              sumQuotient: selectedReceptorExposure.sumQuotient,
            },
          ];

    const violations: LegalViolationEntry[] = entriesToExport.map((entry) => {
      const isCrit = entry.laeqDb >= 70 || entry.lafmaxDb >= 70;
      return {
        id: entry.id,
        severity: isCrit ? 'CRITICAL_RED' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'MST_NOISE_LIMITS',
        legalBasisLabel: 'Miljøstyrelsens vejledende støjgrænser',
        timestampIso: `${entry.dateIso}T${entry.hourLabel}:00`,
        receptorName: entry.receptorName,
        receptorAddress: entry.receptorAddress,
        sumQuotient: entry.sumQuotient,
        statuteTitle:
          'Miljøstyrelsens vejledning nr. 5/1984 & Bygge-/Anlægsstøj (55 dB(A) overvågningstærskel)',
        statuteReference: 'Miljøbeskyttelsesloven § 42 · MST Vejl. 5/1984 (55 dB(A) L_Aeq / L_AFmax)',
        legalConsequence: `Realtids støjlog overskrider 55,0 dB(A) med +${entry.exceedanceDb.toFixed(
          1
        )} dB ved ${entry.receptorName} (kl. ${entry.hourLabel}). Påbud om støjdæmpning eller driftstidsbegrænsning.`,
        technicalEvidence: `L_Aeq=${entry.laeqDb.toFixed(
          1
        )} dB(A) (L_Aeq,korr=${entry.impulseAdjustedLaeqDb.toFixed(
          1
        )} dB(A)) · L_AFmax=${entry.lafmaxDb.toFixed(1)} dB(A) · Kilde: ${
          entry.dominantSourceName
        } (${entry.distanceMeters} m) · Vind: ${entry.windSpeedMs.toFixed(
          1
        )} m/s (${entry.windDirectionDeg}°) · Refraktionsbidrag ΔL=${
          entry.windRefractionDb >= 0 ? '+' : ''
        }${entry.windRefractionDb.toFixed(1)} dB`,
        noiseMetrics: {
          laeqDb: entry.laeqDb,
          lafmaxDb: entry.lafmaxDb,
          impulseAdjustedLaeqDb: entry.impulseAdjustedLaeqDb,
          limitLaeqDb: NOISE_COMPLIANCE_THRESHOLD_DB,
          limitLafmaxDb: NOISE_COMPLIANCE_THRESHOLD_DB,
          windRefractionDb: entry.windRefractionDb,
          dominantSourceName: entry.dominantSourceName,
          distanceMeters: entry.distanceMeters,
        },
      };
    });

    exportSlagelseViolationsEsdhCsv({
      violations,
      dateIso,
      currentWeather,
      plumeDirectionDeg,
      sha256Hash,
      delimiter: ';',
    });

    setEsdhExportedJustNow(true);
    window.setTimeout(() => setEsdhExportedJustNow(false), 3000);
  };

  const selectedReceptorLogCount = logEntries.filter(
    (e) => e.receptorId === selectedReceptorExposure.receptorId
  ).length;

  const windWeightCtx = {
    windSpeedMs: currentWeather.windSpeed10m,
    windGustMs: currentWeather.windGusts10m,
  };
  const displayThreshold55 = convertDb(NOISE_COMPLIANCE_THRESHOLD_DB, windWeightCtx);
  const displayThreshold85 = convertDb(IMPULSE_85DB_THRESHOLD_DB, {
    ...windWeightCtx,
    isImpulse: true,
  });
  const displayLiveEq = convertDb(liveReading.laeqDb, windWeightCtx);
  const displayLiveMax = convertDb(liveReading.lafmaxDb, {
    ...windWeightCtx,
    isImpulse: true,
  });

  return (
    <div
      data-testid="noise-compliance-log-panel"
      className="p-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3 font-mono text-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] uppercase tracking-wide">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Realtids Støj-Overholdelseslog (&gt; {displayThreshold55.toFixed(1)} {unitLabel})
            </span>
          </div>
          <p className="text-[11px] font-sans text-[var(--text-secondary)]">
            Automatisk logning ({labels.standardShortLabel}) med 15-min. alarm-hysterese for valgt receptor:{' '}
            <strong className="text-[var(--text-primary)]">
              {selectedReceptorExposure.receptorCode} ({selectedReceptorExposure.receptorName})
            </strong>
          </p>
        </div>

        <button
          type="button"
          data-testid="export-noise-compliance-esdh-csv-btn"
          onClick={handleExportToSlagelseEsdh}
          className={`px-2.5 py-1.5 rounded text-[11px] font-bold border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            esdhExportedJustNow
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
              : 'bg-[var(--surface-overlay)] hover:bg-slate-700 text-sky-300 border-sky-500/50'
          }`}
          title={`Eksportér loggede støjoverskridelser (>${displayThreshold55.toFixed(1)} ${unitLabel}) i Slagelse Kommune ESDH CSV-format (semikolonsepareret UTF-8)`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
          <span>
            {esdhExportedJustNow
              ? '✓ ESDH CSV Eksporteret!'
              : 'Export to Slagelse-Kommune-ESDH'}
          </span>
        </button>
      </div>

      {/* Live Receptor Reading Strip */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="p-2 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)]">
          <div className="text-[var(--text-secondary)]">{labels.leqLabel} (Valgt)</div>
          <div
            data-testid="noise-compliance-live-leq"
            className={`text-sm font-bold tabular-nums mt-0.5 ${
              liveReading.laeqDb > NOISE_COMPLIANCE_THRESHOLD_DB
                ? 'text-[var(--status-critical-text)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {displayLiveEq.toFixed(1)} {unitLabel}
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)]">
          <div className="text-[var(--text-secondary)]">{labels.lmaxLabel} (Spids)</div>
          <div
            data-testid="noise-compliance-live-lmax"
            className={`text-sm font-bold tabular-nums mt-0.5 ${
              liveReading.lafmaxDb > NOISE_COMPLIANCE_THRESHOLD_DB
                ? 'text-[var(--status-critical-text)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {displayLiveMax.toFixed(1)} {unitLabel}
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)]">
          <div className="text-[var(--text-secondary)]">Logget (&gt;{displayThreshold55.toFixed(0)} {unitLabel})</div>
          <div className="text-sm font-bold tabular-nums text-[var(--status-warning-text)] mt-0.5">
            {logEntries.length} stk. ({selectedReceptorLogCount} her)
          </div>
        </div>
      </div>

      {/* Avanceret 15-minutters Støjalarm-Hysterese Kontrolkort */}
      <div
        data-testid="noise-hysteresis-status-card"
        className={`p-2.5 rounded-md border space-y-2 text-[11px] tabular-nums ${
          activeHysteresis.phase === 'ALARM_LATCHED'
            ? 'bg-rose-950/35 border-rose-500/60 text-rose-100'
            : activeHysteresis.phase === 'COMPLIANCE_RECOVERY'
            ? 'bg-amber-950/35 border-amber-500/60 text-amber-100'
            : 'bg-emerald-950/25 border-emerald-500/45 text-emerald-100'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold">
            {activeHysteresis.phase === 'ALARM_LATCHED' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : activeHysteresis.phase === 'COMPLIANCE_RECOVERY' ? (
              <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span>
              Hysterese (15 min.):{' '}
              {activeHysteresis.phase === 'ALARM_LATCHED'
                ? 'ALARM LÅST · FLUKTUATIONSSIKRET'
                : activeHysteresis.phase === 'COMPLIANCE_RECOVERY'
                ? `OVERHOLDELSESTIMER (${formatDurationMmSs(recoveryProgress.remainingMs)} tilbage)`
                : `KLAR · OVERHOLDELSE (<= ${displayThreshold55.toFixed(0)} ${unitLabel})`}
            </span>
          </div>

          <button
            type="button"
            data-testid="simulate-15m-compliance-reset-btn"
            disabled={activeHysteresis.phase === 'MONITORING_IDLE'}
            onClick={handleSimulate15MinComplianceReset}
            className="px-2 py-0.5 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] disabled:opacity-45 border border-[var(--border-subtle)] text-[10px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            title={`Simulér 15 minutters uafbrudt overholdelse (<= ${displayThreshold55.toFixed(1)} ${unitLabel}) for at nulstille støjalarm-hysteresen`}
          >
            <FastForward className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Simulér +15 min overholdelse</span>
          </button>
        </div>

        {/* 15-min Overholdelses-fremdrift */}
        <div className="space-y-1">
          <div className="w-full h-1.5 rounded-full bg-slate-950/80 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                activeHysteresis.phase === 'ALARM_LATCHED'
                  ? 'bg-rose-500'
                  : activeHysteresis.phase === 'COMPLIANCE_RECOVERY'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{
                width: `${
                  activeHysteresis.phase === 'ALARM_LATCHED'
                    ? 100
                    : recoveryProgress.progressPct
                }%`,
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] opacity-90">
            <span>
              Dæmpede fluktuationer:{' '}
              <strong>{activeHysteresis.suppressedFluctuationCount}</strong> · 15-min. nulstillinger:{' '}
              <strong>{activeHysteresis.resetCount}</strong>
            </span>
            <span>
              {activeHysteresis.phase === 'COMPLIANCE_RECOVERY'
                ? `Nulstilles ved 00:00 (${formatDurationMmSs(recoveryProgress.elapsedMs)} / 15:00)`
                : activeHysteresis.phase === 'ALARM_LATCHED'
                ? `Kræver 15:00 <= ${displayThreshold55.toFixed(0)} ${unitLabel} før ny alarm kan udløses`
                : 'Klar til næste enkeltstående hændelse'}
            </span>
          </div>
        </div>

        {activeHysteresis.historyEvents.length > 0 && (
          <div className="pt-1.5 border-t border-white/10 space-y-0.5 text-[10px] font-sans">
            {activeHysteresis.historyEvents.slice(0, 2).map((ev) => (
              <div key={ev.id} className="flex items-start justify-between gap-2 opacity-90">
                <span className="truncate">• {ev.messageDa}</span>
                <span className="font-mono shrink-0 opacity-75">{ev.timeLabel}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Automatisk Støj-Hændelseslog (> 85 dB(A) / vægtet i > 5 minutter) med direkte SHA-256 Bevis-Log */}
      <div
        data-testid="impulse-85db-auto-event-log-card"
        className={`p-2.5 rounded-md border space-y-2 text-[11px] tabular-nums ${
          isExceeding85Live
            ? 'bg-rose-950/45 border-rose-500/75 text-rose-100'
            : 'bg-slate-900/90 border-amber-500/40 text-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle
              className={`w-3.5 h-3.5 shrink-0 ${
                isExceeding85Live ? 'text-rose-400 animate-pulse' : 'text-amber-400'
              }`}
            />
            <span>
              Automatisk Støj-Hændelseslog (&gt; {displayThreshold85.toFixed(1)} {unitLabel} i &gt; 5 min.)
            </span>
          </div>

          <button
            type="button"
            data-testid="simulate-5min-85db-event-btn"
            onClick={() => {
              void handleSimulate5MinAbove85Db();
            }}
            className="px-2 py-0.5 rounded bg-rose-600/85 hover:bg-rose-500 border border-rose-300 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            title={`Simulér/registrér vedvarende impulsstøj > ${displayThreshold85.toFixed(1)} ${unitLabel} i > 5 min. og tilføj direkte til Bevis-loggen med SHA-256 signatur`}
          >
            <FastForward className="w-3 h-3 shrink-0" />
            <span>Simulér +5 min (&gt;{displayThreshold85.toFixed(0)} → Bevis-log)</span>
          </button>
        </div>

        <div className="space-y-1">
          <div className="w-full h-1.5 rounded-full bg-slate-950/90 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isExceeding85Live ? 'bg-rose-500' : 'bg-slate-700'
              }`}
              style={{ width: `${impulse85ProgressPct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span>
              Aktuel spids:{' '}
              <strong className={isExceeding85Live ? 'text-rose-300' : 'text-slate-200'}>
                {displayLiveMax.toFixed(1)} {unitLabel}
              </strong>{' '}
              (grænse {displayThreshold85.toFixed(1)} {unitLabel})
            </span>
            <span>
              {isExceeding85Live
                ? `Varighed >${displayThreshold85.toFixed(0)} ${unitLabel}: ${formatDurationMmSs(impulse85ElapsedMs)} / 05:00 (${formatDurationMmSs(
                    impulse85RemainingMs
                  )} til auto-SHA-256 log)`
                : `Auto-logger til Bevis-log med SHA-256 ved >${displayThreshold85.toFixed(0)} ${unitLabel} i >05:00`}
            </span>
          </div>
        </div>

        {impulse85JustSavedBadge && (
          <div className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/70 text-emerald-200 font-bold text-[10.5px]">
            ✓ Auto-gemt til Bevis-loggen: {impulse85JustSavedBadge}
          </div>
        )}

        {impulse85Events.length > 0 && (
          <div className="max-h-44 overflow-y-auto space-y-1 pt-1 border-t border-white/10">
            {impulse85Events.map((ev) => {
              const evWeather =
                weatherHours.find((h) => h.hourIndex === ev.hourIndex) ?? currentWeather;
              const evRefr = computeMeteorologicalRefractionContext({
                windSpeed10m: evWeather.windSpeed10m,
                windGusts10m: evWeather.windGusts10m,
                windDirection10m: evWeather.windDirection10m,
                temperature2m: evWeather.temperature2m,
                pasquillClass: evWeather.pasquillClass,
                precipitation: evWeather.precipitation,
              });
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectHour?.(ev.hourIndex)}
                  className="p-1.5 rounded bg-slate-950/90 border border-rose-500/40 hover:border-rose-400 cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 font-bold">
                    <span className="text-rose-300">
                      {ev.eventCode} · {ev.receptorCode} ({convertDb(ev.peakLafmaxDb, { isImpulse: true }).toFixed(1)} {unitLabel})
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-emerald-300 text-[10px]">
                        ✓ I Bevis-log ({Math.round(ev.durationSeconds / 60)} min.)
                      </span>
                      <button
                        type="button"
                        data-testid={`export-impulse-refraction-pdf-${ev.eventCode}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateImpulseNoiseEventPdfReport({
                            eventCode: ev.eventCode,
                            dateIso: ev.dateIso,
                            hourLabel: ev.hourLabel,
                            receptorCode: ev.receptorCode,
                            receptorName: ev.receptorName,
                            receptorAddress: ev.receptorAddress,
                            dominantSourceName: ev.dominantSourceName,
                            distanceMeters: ev.distanceMeters,
                            laeqDb: convertDb(ev.laeqDb, windWeightCtx),
                            peakLafmaxDb: convertDb(ev.peakLafmaxDb, {
                              ...windWeightCtx,
                              isImpulse: true,
                            }),
                            durationSeconds: ev.durationSeconds,
                            sumQuotient: ev.sumQuotient,
                            weather: evWeather,
                            sha256Signature: ev.sha256Signature,
                            unitLabel,
                          });
                        }}
                        className="px-1.5 py-0.5 rounded bg-sky-700/80 hover:bg-sky-600 border border-sky-400/70 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        title="Eksporter PDF med automatisk Meteorological Refraction Context"
                      >
                        <FileDown className="w-3 h-3 shrink-0" />
                        <span>PDF + Refraktion</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Kl. {ev.hourLabel} · {ev.dominantSourceName} · SHA-256: {ev.sha256Signature.slice(0, 20)}...
                  </div>
                  <div className="text-[10px] text-sky-300/90 truncate">
                    Meteorological Refraction Context: ∂u/∂z +{evRefr.windGradientDuDzPerSec.toFixed(3)} s⁻¹ · ∂T/∂z {evRefr.tempGradientDtDzKPer100m >= 0 ? '+' : ''}{evRefr.tempGradientDtDzKPer100m.toFixed(1)} K/100m · Netto lydudbredelse {evRefr.netDownwindPropagationDeltaDb >= 0 ? '+' : ''}{evRefr.netDownwindPropagationDeltaDb.toFixed(1)} dB
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          {isCurrentExceeding55 ? (
            <span className="inline-flex items-center gap-1 text-[var(--status-critical-text)] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Overskridelse aktiv kl. {currentWeather.hourLabel} (+
                {Math.max(
                  liveReading.laeqDb - NOISE_COMPLIANCE_THRESHOLD_DB,
                  liveReading.lafmaxDb - NOISE_COMPLIANCE_THRESHOLD_DB
                ).toFixed(1)}{' '}
                dB)
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Under {displayThreshold55.toFixed(1)} {unitLabel} tærskel kl. {currentWeather.hourLabel}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleScan24HoursForReceptor}
            className="px-2 py-1 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            title={`Scan alle 24 timer på den valgte dato for overskridelser > ${displayThreshold55.toFixed(1)} ${unitLabel} ved denne receptor`}
          >
            <RefreshCw className="w-3 h-3 text-sky-400" />
            <span>Scan 24t</span>
          </button>
          {logEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setLogEntries([])}
              className="px-2 py-1 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-rose-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Ryd støjloggen"
            >
              <Trash2 className="w-3 h-3" />
              <span>Ryd</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Compliance Log Table */}
      {logEntries.length === 0 ? (
        <div className="p-2.5 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
          Ingen støjhændelser over {displayThreshold55.toFixed(1)} {unitLabel} logget endnu. Flyt tidsslideren eller klik &quot;Scan 24t&quot;.
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)]">
          <table className="w-full text-left border-collapse text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-[var(--surface-overlay)] text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
              <tr>
                <th className="py-1.5 px-2 font-semibold">Tid</th>
                <th className="py-1.5 px-2 font-semibold">Receptor</th>
                <th className="py-1.5 px-2 font-semibold text-right">{labels.leqLabel}</th>
                <th className="py-1.5 px-2 font-semibold text-right">{labels.lmaxLabel}</th>
                <th className="py-1.5 px-2 font-semibold text-right">&gt;{displayThreshold55.toFixed(0)} {unitLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {logEntries.map((entry) => {
                const rowCtx = { windSpeedMs: entry.windSpeedMs, windGustMs: entry.windGustsMs };
                const rowEq = convertDb(entry.laeqDb, rowCtx);
                const rowMax = convertDb(entry.lafmaxDb, { ...rowCtx, isImpulse: true });
                return (
                <tr
                  key={entry.id}
                  onClick={() => onSelectHour?.(entry.hourIndex)}
                  className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  title={`${entry.dominantSourceName} (${entry.distanceMeters} m) · Vind ${entry.windSpeedMs.toFixed(1)} m/s (${entry.windDirectionDeg}°)`}
                >
                  <td className="py-1.5 px-2 text-sky-300 font-semibold whitespace-nowrap">
                    {entry.hourLabel}
                  </td>
                  <td className="py-1.5 px-2 text-[var(--text-primary)] truncate max-w-[115px]">
                    {entry.receptorCode}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-bold ${
                      entry.laeqDb > NOISE_COMPLIANCE_THRESHOLD_DB
                        ? 'text-[var(--status-warning-text)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {rowEq.toFixed(1)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-bold ${
                      entry.lafmaxDb > NOISE_COMPLIANCE_THRESHOLD_DB
                        ? 'text-[var(--status-critical-text)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {rowMax.toFixed(1)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-bold text-[var(--status-critical-text)]">
                    +{entry.exceedanceDb.toFixed(1)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
