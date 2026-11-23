/**
 * @file src/utils/noiseComplianceHysteresis.ts
 * @description Avanceret ISA-18.2 / Miljøtilsyn støjalarm-hysterese til NoiseComplianceLogPanel.
 * Låser alarmtilstanden ved overskridelse (> 55 dB(A)), undertrykker konstante notifikationer
 * under fluktuerende støjniveauer og nulstiller først hysteresen efter 15 minutters uafbrudt
 * overholdelse (<= 55 dB(A)).
 */

export const NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB = 55.0;
export const NOISE_HYSTERESIS_RESET_COMPLIANCE_MS = 15 * 60 * 1000; // 15 minutter (900.000 ms)

export type NoiseHysteresisPhase =
  | 'MONITORING_IDLE'
  | 'ALARM_LATCHED'
  | 'COMPLIANCE_RECOVERY';

export interface NoiseHysteresisAuditEvent {
  id: string;
  timestampMs: number;
  timeLabel: string;
  hourLabel: string;
  receptorCode: string;
  kind: 'ALARM_LATCHED' | 'FLUCTUATION_SUPPRESSED' | 'COMPLIANCE_STARTED' | 'HYSTERESIS_RESET_15M';
  measuredDb: number;
  messageDa: string;
}

export interface NoiseComplianceHysteresisState {
  receptorId: string;
  phase: NoiseHysteresisPhase;
  latchedAtMs: number | null;
  complianceStartedAtMs: number | null;
  lastEvaluatedAtMs: number;
  lastTriggerDb: number | null;
  lastTriggerHourLabel: string | null;
  suppressedFluctuationCount: number;
  resetCount: number;
  lastResetAtMs: number | null;
  historyEvents: NoiseHysteresisAuditEvent[];
}

export interface EvaluateNoiseHysteresisStepInput {
  currentMaxDb: number;
  nowMs: number;
  hourLabel: string;
  receptorId: string;
  receptorCode: string;
  thresholdDb?: number;
  complianceResetMs?: number;
}

export interface EvaluateNoiseHysteresisStepResult {
  nextState: NoiseComplianceHysteresisState;
  shouldEmitAlarmNotification: boolean;
  wasSuppressedFluctuation: boolean;
  wasResetAfter15MinCompliance: boolean;
  complianceElapsedMs: number;
  complianceRemainingMs: number;
  complianceProgressPct: number;
  statusLabelDa: string;
}

export function createInitialNoiseHysteresisState(
  receptorId: string,
  nowMs = Date.now()
): NoiseComplianceHysteresisState {
  return {
    receptorId,
    phase: 'MONITORING_IDLE',
    latchedAtMs: null,
    complianceStartedAtMs: null,
    lastEvaluatedAtMs: nowMs,
    lastTriggerDb: null,
    lastTriggerHourLabel: null,
    suppressedFluctuationCount: 0,
    resetCount: 0,
    lastResetAtMs: null,
    historyEvents: [],
  };
}

function formatTimeDa(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString('da-DK');
  } catch {
    return '--:--:--';
  }
}

export function formatDurationMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Evaluerer ét skridt i støjalarm-hysteresen:
 * - MONITORING_IDLE + > 55 dB -> ALARM_LATCHED (udløser én notifikation/log)
 * - ALARM_LATCHED + > 55 dB -> forbliver låst, undertrykker fluktuations-notifikation
 * - ALARM_LATCHED + <= 55 dB -> COMPLIANCE_RECOVERY (starter 15 min overholdelsestimer)
 * - COMPLIANCE_RECOVERY + > 55 dB (før 15 min) -> tilbage til ALARM_LATCHED uden ny notifikation
 * - COMPLIANCE_RECOVERY + <= 55 dB i >= 15 min -> nulstiller til MONITORING_IDLE
 */
export function evaluateNoiseComplianceHysteresisStep(
  prevState: NoiseComplianceHysteresisState,
  input: EvaluateNoiseHysteresisStepInput
): EvaluateNoiseHysteresisStepResult {
  const {
    currentMaxDb,
    nowMs,
    hourLabel,
    receptorId,
    receptorCode,
    thresholdDb = NOISE_HYSTERESIS_TRIGGER_THRESHOLD_DB,
    complianceResetMs = NOISE_HYSTERESIS_RESET_COMPLIANCE_MS,
  } = input;

  const baseState =
    prevState.receptorId === receptorId
      ? prevState
      : createInitialNoiseHysteresisState(receptorId, nowMs);

  const isExceeding = currentMaxDb > thresholdDb;
  const roundedDb = Number(currentMaxDb.toFixed(1));
  const timeLabel = formatTimeDa(nowMs);

  const pushEvent = (
    events: NoiseHysteresisAuditEvent[],
    kind: NoiseHysteresisAuditEvent['kind'],
    messageDa: string
  ): NoiseHysteresisAuditEvent[] => [
    {
      id: `nhys-${receptorId}-${kind}-${nowMs}-${events.length}`,
      timestampMs: nowMs,
      timeLabel,
      hourLabel,
      receptorCode,
      kind,
      measuredDb: roundedDb,
      messageDa,
    },
    ...events,
  ].slice(0, 25);

  if (baseState.phase === 'MONITORING_IDLE') {
    if (isExceeding) {
      const nextState: NoiseComplianceHysteresisState = {
        ...baseState,
        phase: 'ALARM_LATCHED',
        latchedAtMs: nowMs,
        complianceStartedAtMs: null,
        lastEvaluatedAtMs: nowMs,
        lastTriggerDb: roundedDb,
        lastTriggerHourLabel: hourLabel,
        historyEvents: pushEvent(
          baseState.historyEvents,
          'ALARM_LATCHED',
          `Alarm låst ved ${roundedDb.toFixed(1)} dB(A) (> ${thresholdDb.toFixed(
            0
          )} dB) kl. ${hourLabel} — kræver 15 min. overholdelse før nulstilling.`
        ),
      };
      return {
        nextState,
        shouldEmitAlarmNotification: true,
        wasSuppressedFluctuation: false,
        wasResetAfter15MinCompliance: false,
        complianceElapsedMs: 0,
        complianceRemainingMs: complianceResetMs,
        complianceProgressPct: 0,
        statusLabelDa: 'ALARM LÅST · FLUKTUATIONSSIKRET',
      };
    }

    return {
      nextState: {
        ...baseState,
        lastEvaluatedAtMs: nowMs,
      },
      shouldEmitAlarmNotification: false,
      wasSuppressedFluctuation: false,
      wasResetAfter15MinCompliance: false,
      complianceElapsedMs: 0,
      complianceRemainingMs: 0,
      complianceProgressPct: 100,
      statusLabelDa: 'KLAR · OVERHOLDELSE (<= 55 dB)',
    };
  }

  if (baseState.phase === 'ALARM_LATCHED') {
    if (isExceeding) {
      const isNewSpike =
        baseState.lastTriggerHourLabel !== hourLabel ||
        Math.abs((baseState.lastTriggerDb ?? 0) - roundedDb) >= 0.4;
      const nextState: NoiseComplianceHysteresisState = {
        ...baseState,
        lastEvaluatedAtMs: nowMs,
        lastTriggerDb: roundedDb,
        lastTriggerHourLabel: hourLabel,
        suppressedFluctuationCount:
          baseState.suppressedFluctuationCount + (isNewSpike ? 1 : 0),
        historyEvents: isNewSpike
          ? pushEvent(
              baseState.historyEvents,
              'FLUCTUATION_SUPPRESSED',
              `Fluktuerende overskridelse (${roundedDb.toFixed(
                1
              )} dB kl. ${hourLabel}) dæmpet under aktiv hysterese-lås.`
            )
          : baseState.historyEvents,
      };
      return {
        nextState,
        shouldEmitAlarmNotification: false,
        wasSuppressedFluctuation: isNewSpike,
        wasResetAfter15MinCompliance: false,
        complianceElapsedMs: 0,
        complianceRemainingMs: complianceResetMs,
        complianceProgressPct: 0,
        statusLabelDa: 'ALARM LÅST · DÆMPER FLUKTUATIONER',
      };
    }

    // Støj faldet til <= 55 dB(A): start 15 minutters overholdelses-nedtælling
    const nextState: NoiseComplianceHysteresisState = {
      ...baseState,
      phase: 'COMPLIANCE_RECOVERY',
      complianceStartedAtMs: nowMs,
      lastEvaluatedAtMs: nowMs,
      historyEvents: pushEvent(
        baseState.historyEvents,
        'COMPLIANCE_STARTED',
        `Støj under ${thresholdDb.toFixed(0)} dB(A) (${roundedDb.toFixed(
          1
        )} dB) — 15 min. overholdelsestimer startet.`
      ),
    };
    return {
      nextState,
      shouldEmitAlarmNotification: false,
      wasSuppressedFluctuation: false,
      wasResetAfter15MinCompliance: false,
      complianceElapsedMs: 0,
      complianceRemainingMs: complianceResetMs,
      complianceProgressPct: 0,
      statusLabelDa: '15-MIN. NULSTILLING IGANGSAT',
    };
  }

  // phase === 'COMPLIANCE_RECOVERY'
  if (isExceeding) {
    // Støj steg igen før 15 minutter var gået -> genlås uden ny alarm-notifikation!
    const nextState: NoiseComplianceHysteresisState = {
      ...baseState,
      phase: 'ALARM_LATCHED',
      complianceStartedAtMs: null,
      lastEvaluatedAtMs: nowMs,
      lastTriggerDb: roundedDb,
      lastTriggerHourLabel: hourLabel,
      suppressedFluctuationCount: baseState.suppressedFluctuationCount + 1,
      historyEvents: pushEvent(
        baseState.historyEvents,
        'FLUCTUATION_SUPPRESSED',
        `Tilbagefald (${roundedDb.toFixed(
          1
        )} dB) før 15 min. overholdelse — timer nulstillet, notifikation undertrykt.`
      ),
    };
    return {
      nextState,
      shouldEmitAlarmNotification: false,
      wasSuppressedFluctuation: true,
      wasResetAfter15MinCompliance: false,
      complianceElapsedMs: 0,
      complianceRemainingMs: complianceResetMs,
      complianceProgressPct: 0,
      statusLabelDa: 'ALARM GENLÅST · NY 15-MIN. KRÆVES',
    };
  }

  const startedAt = baseState.complianceStartedAtMs ?? nowMs;
  const elapsedMs = Math.max(0, nowMs - startedAt);
  if (elapsedMs >= complianceResetMs) {
    // 15 minutters uafbrudt overholdelse opnået -> nulstil hysterese!
    const nextState: NoiseComplianceHysteresisState = {
      ...baseState,
      phase: 'MONITORING_IDLE',
      latchedAtMs: null,
      complianceStartedAtMs: null,
      lastEvaluatedAtMs: nowMs,
      lastTriggerDb: null,
      lastTriggerHourLabel: null,
      resetCount: baseState.resetCount + 1,
      lastResetAtMs: nowMs,
      historyEvents: pushEvent(
        baseState.historyEvents,
        'HYSTERESIS_RESET_15M',
        `Hysterese nulstillet efter 15 min. uafbrudt overholdelse (<= ${thresholdDb.toFixed(
          0
        )} dB(A)).`
      ),
    };
    return {
      nextState,
      shouldEmitAlarmNotification: false,
      wasSuppressedFluctuation: false,
      wasResetAfter15MinCompliance: true,
      complianceElapsedMs: complianceResetMs,
      complianceRemainingMs: 0,
      complianceProgressPct: 100,
      statusLabelDa: 'NULSTILLET EFTER 15 MIN. OVERHOLDELSE',
    };
  }

  const remainingMs = Math.max(0, complianceResetMs - elapsedMs);
  const progressPct = Math.min(99, Math.round((elapsedMs / complianceResetMs) * 100));
  return {
    nextState: {
      ...baseState,
      lastEvaluatedAtMs: nowMs,
    },
    shouldEmitAlarmNotification: false,
    wasSuppressedFluctuation: false,
    wasResetAfter15MinCompliance: false,
    complianceElapsedMs: elapsedMs,
    complianceRemainingMs: remainingMs,
    complianceProgressPct: progressPct,
    statusLabelDa: `15-MIN. NULSTILLING (${formatDurationMmSs(remainingMs)} tilbage)`,
  };
}
