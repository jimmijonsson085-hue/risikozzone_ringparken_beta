/**
 * @file src/services/rollingDustHazardAlertService.ts
 * @description Overvåger det 1-times rullende gennemsnit af respirabel støvkoncentration (µg/m³)
 * mod projektets arbejdsmiljø- og miljøtærskel i Arbejdstilsynets / PSS Sag W22085 sikkerhedsplan
 * (BEK 613/2026: 100,0 µg/m³ = 0,1 mg/m³ respirabelt kvarts-/nedrivningsstøv) og udløser både
 * akustisk Web Audio-alarm og højprioritets visuel browser-advarsel.
 */

import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';
import { evaluateReceptorAtHour } from './dispersionEngine';

/** Projektets lokale miljø- og sikkerhedstærskel (PSS Sag W22085 / BEK 613/2026: 0,1 mg/m³ = 100 µg/m³) */
export const PSS_RESPIRABLE_DUST_1H_THRESHOLD_UG_M3 = 100.0;
/** Hysterese-grænse før en udløst 1-times støvalarm automatisk nulstilles */
export const PSS_RESPIRABLE_DUST_HYSTERESIS_RESET_UG_M3 = 85.0;

export interface Rolling1hDustSubSlot {
  offsetMinutesLabel: string; // e.g. '-50 min', ..., 'Nu'
  weightPrevHour: number;
  weightCurrHour: number;
  respirableDustUgM3: number;
  windGustMs: number;
  worstReceptorCode: string;
}

export interface Rolling1hDustReceptorSummary {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  rolling1hAverageUgM3: number;
  peak10mUgM3: number;
  exceedsThreshold: boolean;
}

export interface Rolling1hDustEvaluation {
  rolling1hAverageUgM3: number;
  peakInstantUgM3: number;
  thresholdUgM3: number;
  exceedanceUgM3: number;
  exceedanceRatio: number;
  deltaVsPriorHourUgM3: number;
  isThresholdExceeded: boolean;
  isWarningElevated: boolean; // >= 80% af tærsklen
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  worstReceptor: Rolling1hDustReceptorSummary;
  receptorSummaries: Rolling1hDustReceptorSummary[];
  subSlots: Rolling1hDustSubSlot[];
  hourLabel: string;
  safetyPlanReference: string;
  mitigationGuidanceDa: string;
}

/**
 * Beregner samlet respirabel støvkoncentration (µg/m³) ved et receptorpunkt ud fra
 * Gaussisk spredningsmodel (tungmetaller, PCB-støv, kvarts/mineraluld + fint nedrivningsstøv).
 */
export function computeReceptorRespirableDustUgM3(
  exp: ReceptorExposureResult
): number {
  const heavyMetalsSub = exp.substances.find((s) => s.key === 'heavyMetals');
  const pcbSub = exp.substances.find((s) => s.key === 'pcb');
  const quartzWoolSub = exp.substances.find((s) => s.key === 'quartzWool');

  const heavyMetalsUg = (heavyMetalsSub?.concentration ?? 0) * 1000;
  const pcbUg = (pcbSub?.concentration ?? 0) * 0.015;
  const quartzWoolUg = (quartzWoolSub?.concentration ?? 0) * 1000;
  const fineDemolitionDustUg = exp.sumQuotient * 115;

  return Number(
    Math.max(
      0,
      heavyMetalsUg + pcbUg + quartzWoolUg + fineDemolitionDustUg
    ).toFixed(1)
  );
}

/**
 * Evaluerer 1-times rullende gennemsnit af respirabel støvkoncentration (µg/m³)
 * over seks deterministiske 10-minutters delintervaller afsluttende på det aktuelle
 * simulerede tidspunkt.
 */
export function evaluateRolling1hRespirableDust(params: {
  weatherHours: HourlyWeatherPoint[];
  selectedHourIndex: number;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  precipitationOverrideMm?: number | null;
  thresholdUgM3?: number;
  simulatedExceedanceBoostUgM3?: number;
}): Rolling1hDustEvaluation {
  const {
    weatherHours,
    selectedHourIndex,
    sources,
    receptors,
    precipitationOverrideMm = null,
    thresholdUgM3 = PSS_RESPIRABLE_DUST_1H_THRESHOLD_UG_M3,
    simulatedExceedanceBoostUgM3 = 0,
  } = params;

  const safeHours = weatherHours;
  const currIdx = Math.max(0, Math.min(safeHours.length - 1, selectedHourIndex));
  const prevIdx = currIdx > 0 ? currIdx - 1 : 0;
  const currWeatherBase = safeHours[currIdx];
  const prevWeatherBase = safeHours[prevIdx];

  const applyPrecipOverride = (w: HourlyWeatherPoint): HourlyWeatherPoint =>
    precipitationOverrideMm === null
      ? w
      : { ...w, precipitation: Math.max(0, precipitationOverrideMm) };

  const currWeather = applyPrecipOverride(currWeatherBase);
  const prevWeather = applyPrecipOverride(prevWeatherBase);

  const currReceptorExposures: ReceptorExposureResult[] = receptors.map((rec) =>
    evaluateReceptorAtHour(rec, sources, currWeather)
  );
  const prevReceptorExposures: ReceptorExposureResult[] =
    prevIdx === currIdx
      ? currReceptorExposures
      : receptors.map((rec) => evaluateReceptorAtHour(rec, sources, prevWeather));

  const activeSourcesExist = sources.some((s) => s.active);
  const boost = Math.max(0, simulatedExceedanceBoostUgM3);

  // 6 × 10-minutters delintervaller over den rullende 60-minutters horisont
  const subSlotWeights = [
    { label: '-50m', wPrev: 5 / 6, wCurr: 1 / 6, gustFactor: 0.94 },
    { label: '-40m', wPrev: 4 / 6, wCurr: 2 / 6, gustFactor: 0.98 },
    { label: '-30m', wPrev: 3 / 6, wCurr: 3 / 6, gustFactor: 1.03 },
    { label: '-20m', wPrev: 2 / 6, wCurr: 4 / 6, gustFactor: 1.06 },
    { label: '-10m', wPrev: 1 / 6, wCurr: 5 / 6, gustFactor: 0.99 },
    { label: 'Nu', wPrev: 0, wCurr: 1, gustFactor: 1.0 },
  ];

  const receptorSummaries: Rolling1hDustReceptorSummary[] = currReceptorExposures.map(
    (currRec) => {
      const prevRec =
        prevReceptorExposures.find((r) => r.receptorId === currRec.receptorId) ||
        currRec;
      const currDust = computeReceptorRespirableDustUgM3(currRec) + boost;
      const prevDust = computeReceptorRespirableDustUgM3(prevRec) + boost * 0.85;

      const slotValues = subSlotWeights.map((slot) => {
        const base = prevDust * slot.wPrev + currDust * slot.wCurr;
        // Moduler let med gust-faktor kun når kilder er aktive
        const val = activeSourcesExist || boost > 0 ? base * slot.gustFactor : 0;
        return Math.max(0, val);
      });

      const avg = slotValues.reduce((acc, v) => acc + v, 0) / slotValues.length;
      const peak = Math.max(...slotValues);

      return {
        receptorId: currRec.receptorId,
        receptorCode: currRec.receptorCode,
        receptorName: currRec.receptorName,
        rolling1hAverageUgM3: Number(avg.toFixed(1)),
        peak10mUgM3: Number(peak.toFixed(1)),
        exceedsThreshold: avg > thresholdUgM3,
      };
    }
  );

  const sortedByRolling = [...receptorSummaries].sort(
    (a, b) => b.rolling1hAverageUgM3 - a.rolling1hAverageUgM3
  );

  const worstReceptor: Rolling1hDustReceptorSummary = sortedByRolling[0] || {
    receptorId: 'none',
    receptorCode: 'N/A',
    receptorName: 'Ingen aktive receptorer',
    rolling1hAverageUgM3: 0,
    peak10mUgM3: 0,
    exceedsThreshold: false,
  };

  // Sub-slot tidsserie for den mest belastede receptor
  const currWorst =
    currReceptorExposures.find((r) => r.receptorId === worstReceptor.receptorId) ||
    currReceptorExposures[0];
  const prevWorst =
    prevReceptorExposures.find((r) => r.receptorId === worstReceptor.receptorId) ||
    currWorst;

  const currWorstDust = currWorst
    ? computeReceptorRespirableDustUgM3(currWorst) + boost
    : boost;
  const prevWorstDust = prevWorst
    ? computeReceptorRespirableDustUgM3(prevWorst) + boost * 0.85
    : boost;

  const subSlots: Rolling1hDustSubSlot[] = subSlotWeights.map((slot) => {
    const val =
      activeSourcesExist || boost > 0
        ? (prevWorstDust * slot.wPrev + currWorstDust * slot.wCurr) * slot.gustFactor
        : 0;
    const gust =
      prevWeather.windGusts10m * slot.wPrev + currWeather.windGusts10m * slot.wCurr;
    return {
      offsetMinutesLabel: slot.label,
      weightPrevHour: Number(slot.wPrev.toFixed(2)),
      weightCurrHour: Number(slot.wCurr.toFixed(2)),
      respirableDustUgM3: Number(val.toFixed(1)),
      windGustMs: Number(gust.toFixed(1)),
      worstReceptorCode: worstReceptor.receptorCode,
    };
  });

  const rolling1hAverageUgM3 = worstReceptor.rolling1hAverageUgM3;
  const peakInstantUgM3 = worstReceptor.peak10mUgM3;
  const exceedanceUgM3 = Number(
    Math.max(0, rolling1hAverageUgM3 - thresholdUgM3).toFixed(1)
  );
  const exceedanceRatio = Number((rolling1hAverageUgM3 / thresholdUgM3).toFixed(2));
  const deltaVsPriorHourUgM3 = Number((currWorstDust - prevWorstDust).toFixed(1));
  const isThresholdExceeded = rolling1hAverageUgM3 > thresholdUgM3;
  const isWarningElevated =
    !isThresholdExceeded && rolling1hAverageUgM3 >= thresholdUgM3 * 0.8;

  const severity: Rolling1hDustEvaluation['severity'] = isThresholdExceeded
    ? 'CRITICAL'
    : isWarningElevated
    ? 'WARNING'
    : 'NOMINAL';

  return {
    rolling1hAverageUgM3,
    peakInstantUgM3,
    thresholdUgM3,
    exceedanceUgM3,
    exceedanceRatio,
    deltaVsPriorHourUgM3,
    isThresholdExceeded,
    isWarningElevated,
    severity,
    worstReceptor,
    receptorSummaries,
    subSlots,
    hourLabel: currWeather.hourLabel,
    safetyPlanReference:
      'PSS Sag W22085 · BEK 613/2026 (0,1 mg/m³ = 100,0 µg/m³ respirabelt støv)',
    mitigationGuidanceDa: isThresholdExceeded
      ? `Øjeblikkelig vandforstøvning påkrævet ved ${worstReceptor.receptorName}: midlertidigt stop af tør betonknusning/mejsling & kontrol af undertrykssluser.`
      : isWarningElevated
      ? `Forhøjet støvniveau (${Math.round(
          exceedanceRatio * 100
        )}% af 1t-grænse) — forbered ekstra støvbinding ved ${worstReceptor.receptorName}.`
      : `Respirabelt støvniveau inden for PSS-sikkerhedsplanens 1-times grænse (≤ ${thresholdUgM3.toFixed(
          0
        )} µg/m³).`,
  };
}

export interface DustAlarmPlaybackResult {
  played: boolean;
  reason: 'played' | 'muted' | 'awaiting_user_gesture' | 'audio_unavailable';
  timestampLabel: string;
}

/**
 * Web Audio API-tjeneste der afspiller et markant, klik-frit 3-tonet alarmmønster
 * ved overskridelse af 1-times rullende respirabel støvkoncentration.
 */
export class RollingDustHazardAudioService {
  private audioCtx: AudioContext | null = null;
  private hasUserGesture = false;
  private lastTriggeredKey = '';
  private lastPlayedEpochMs = 0;
  private readonly minCooldownMs: number;

  constructor(minCooldownMs = 6000) {
    this.minCooldownMs = minCooldownMs;
  }

  markUserGestureUnlocked(): void {
    this.hasUserGesture = true;
  }

  attachUserGestureUnlockListeners(): () => void {
    if (typeof window === 'undefined') return () => undefined;
    const unlock = () => {
      this.hasUserGesture = true;
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }

  resetHysteresis(): void {
    this.lastTriggeredKey = '';
  }

  shouldTriggerForStateKey(stateKey: string, nowMs = Date.now()): boolean {
    if (this.lastTriggeredKey === stateKey) return false;
    if (nowMs - this.lastPlayedEpochMs < this.minCooldownMs) return false;
    this.lastTriggeredKey = stateKey;
    return true;
  }

  playHazardChime(params: {
    forcePlay?: boolean;
    muted?: boolean;
  }): DustAlarmPlaybackResult {
    const timestampLabel = new Date().toLocaleTimeString('da-DK');
    if (params.muted && !params.forcePlay) {
      return { played: false, reason: 'muted', timestampLabel };
    }
    if (!params.forcePlay && !this.hasUserGesture) {
      return { played: false, reason: 'awaiting_user_gesture', timestampLabel };
    }
    if (typeof window === 'undefined') {
      return { played: false, reason: 'audio_unavailable', timestampLabel };
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        return { played: false, reason: 'audio_unavailable', timestampLabel };
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }

      const now = ctx.currentTime;
      // 3-puls højprioritets sikkerhedsalarm (F5 -> A5 -> D6)
      const freqs = [698.46, 880.0, 1174.66];
      freqs.forEach((freq, idx) => {
        const startAt = now + idx * 0.14;
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startAt);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq * 0.5, startAt);

        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);

        osc.connect(gain);
        subOsc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startAt);
        subOsc.start(startAt);
        osc.stop(startAt + 0.24);
        subOsc.stop(startAt + 0.24);
      });

      this.lastPlayedEpochMs = Date.now();
      return { played: true, reason: 'played', timestampLabel };
    } catch {
      return { played: false, reason: 'audio_unavailable', timestampLabel };
    }
  }
}

export const rollingDustHazardAudioService = new RollingDustHazardAudioService();

export type BrowserNotificationPermissionState =
  | NotificationPermission
  | 'unsupported';

export function getBrowserNotificationPermissionState(): BrowserNotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestDustNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return window.Notification.permission;
  }
}

export function dispatchBrowserDustHazardNotification(params: {
  evaluation: Rolling1hDustEvaluation;
  dateIso: string;
  tag: string;
}): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }
  try {
    const { evaluation, dateIso, tag } = params;
    new window.Notification(
      `Ringparken STØVALARM · ${evaluation.rolling1hAverageUgM3.toFixed(1)} µg/m³ (>100 µg/m³)`,
      {
        body: `1-times rullende respirabel støvkoncentration ved ${
          evaluation.worstReceptor.receptorName
        } kl. ${evaluation.hourLabel} (${dateIso}): ${evaluation.rolling1hAverageUgM3.toFixed(
          1
        )} µg/m³ vs. grænse ${evaluation.thresholdUgM3.toFixed(0)} µg/m³. ${
          evaluation.mitigationGuidanceDa
        }`,
        tag,
        requireInteraction: true,
      }
    );
    return true;
  } catch {
    return false;
  }
}
