/**
 * @file src/services/acousticDustWarningService.ts
 * @description Dedikeret Web Audio API-tjeneste, der overvåger akut spredningsrisiko
 * (sumkvotient S > 0,8 kombineret med vindhastighed > 10 m/s) og afspiller et diskret,
 * klik-frit advarselssignal i browseren for at advare AMR'er og arbejdere på pladsen.
 */

export const ACUTE_SUM_QUOTIENT_THRESHOLD = 0.8;
export const ACUTE_WIND_SPEED_THRESHOLD_MS = 10.0;
export const HYSTERESIS_RESET_SUM_QUOTIENT = 0.72;
export const HYSTERESIS_RESET_WIND_SPEED_MS = 9.0;

export interface AcuteWindDustRiskInput {
  sumQuotientS: number;
  windSpeedMs: number;
  thresholdS?: number;
  thresholdWindMs?: number;
}

export interface AcuteWindDustRiskEvaluation {
  isAcuteRisk: boolean;
  severityLevel: 'CRITICAL_OVER_1' | 'ACUTE_OVER_08' | 'NOMINAL';
  toneFrequenciesHz: [number, number];
  summaryDa: string;
}

export interface AcousticWarningPlaybackInput {
  sumQuotientS: number;
  windSpeedMs: number;
  receptorLabel: string;
  forcePlay?: boolean;
  muted?: boolean;
}

export interface AcousticWarningPlaybackResult {
  played: boolean;
  reason: 'played' | 'muted' | 'awaiting_user_gesture' | 'below_threshold' | 'audio_unavailable';
  timestampLabel: string;
  alertMessageDa: string;
  risk: AcuteWindDustRiskEvaluation;
}

/**
 * Evaluerer deterministisk om S > 0,8 kombineret med v > 10 m/s udløser akut
 * spredningsrisiko for arbejdsmiljørepræsentanter (AMR) og feltarbejdere.
 */
export function evaluateAcuteWindDustRisk(
  input: AcuteWindDustRiskInput
): AcuteWindDustRiskEvaluation {
  const thresholdS = input.thresholdS ?? ACUTE_SUM_QUOTIENT_THRESHOLD;
  const thresholdWindMs = input.thresholdWindMs ?? ACUTE_WIND_SPEED_THRESHOLD_MS;
  const s = Number.isFinite(input.sumQuotientS) ? input.sumQuotientS : 0;
  const v = Number.isFinite(input.windSpeedMs) ? input.windSpeedMs : 0;

  const isAcuteRisk = s > thresholdS && v > thresholdWindMs;

  if (!isAcuteRisk) {
    return {
      isAcuteRisk: false,
      severityLevel: 'NOMINAL',
      toneFrequenciesHz: [587.33, 880.0],
      summaryDa: `Nominal eksponering (S = ${s.toFixed(2)}, v = ${v.toFixed(1)} m/s)`,
    };
  }

  const isCritical = s >= 1.0;
  return {
    isAcuteRisk: true,
    severityLevel: isCritical ? 'CRITICAL_OVER_1' : 'ACUTE_OVER_08',
    // E5 -> B5 ved lovbrud (S >= 1,0), diskret D5 -> A5 ved skærpet AMR-advarsel (S > 0,8)
    toneFrequenciesHz: isCritical ? [659.25, 987.77] : [587.33, 880.0],
    summaryDa: isCritical
      ? `KRITISK SPREDNINGSRISIKO (S = ${s.toFixed(2)} >= 1,00 & v = ${v.toFixed(1)} m/s > 10 m/s) · AMR & arbejdere advaret`
      : `AKUT AMR-ADVARSEL (S = ${s.toFixed(2)} > 0,80 & v = ${v.toFixed(1)} m/s > 10 m/s)`,
  };
}

/**
 * Returnerer true når både vindhastighed og sumkvotient er faldet tydeligt under
 * hysterese-tærsklen, så næste overskridelse igen udløser signal.
 */
export function shouldResetAcousticWarningHysteresis(params: {
  sumQuotientS: number;
  windSpeedMs: number;
  forceSimulated?: boolean;
}): boolean {
  if (params.forceSimulated) return false;
  return (
    params.windSpeedMs <= HYSTERESIS_RESET_WIND_SPEED_MS ||
    params.sumQuotientS <= HYSTERESIS_RESET_SUM_QUOTIENT
  );
}

/**
 * Web Audio API-tjeneste med indbygget browser autoplay-sikring, deduplikeret
 * hysterese-nøgle og blød to-tonet harmonisk syntese uden akustiske klik.
 */
export class AcousticDustWarningService {
  private audioCtx: AudioContext | null = null;
  private hasUserGesture = false;
  private lastChimedStateKey = '';
  private lastPlayedEpochMs = 0;
  private readonly minCooldownMs: number;

  constructor(minCooldownMs = 4500) {
    this.minCooldownMs = minCooldownMs;
  }

  markUserGestureUnlocked(): void {
    this.hasUserGesture = true;
  }

  isUserGestureUnlocked(): boolean {
    return this.hasUserGesture;
  }

  resetHysteresis(): void {
    this.lastChimedStateKey = '';
  }

  attachUserGestureUnlockListeners(): () => void {
    if (typeof window === 'undefined') {
      return () => undefined;
    }
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

  shouldTriggerForStateKey(stateKey: string, nowMs = Date.now()): boolean {
    if (this.lastChimedStateKey === stateKey) {
      return false;
    }
    if (nowMs - this.lastPlayedEpochMs < this.minCooldownMs) {
      return false;
    }
    this.lastChimedStateKey = stateKey;
    return true;
  }

  playDiscreteWarningSignal(
    input: AcousticWarningPlaybackInput
  ): AcousticWarningPlaybackResult {
    const risk = evaluateAcuteWindDustRisk({
      sumQuotientS: input.sumQuotientS,
      windSpeedMs: input.windSpeedMs,
    });
    const timestampLabel = new Date().toLocaleTimeString('da-DK');
    const alertMessageDa = `${timestampLabel} · ${input.receptorLabel} (S = ${input.sumQuotientS.toFixed(
      2
    )}, v = ${input.windSpeedMs.toFixed(1)} m/s)`;

    if (input.muted && !input.forcePlay) {
      return {
        played: false,
        reason: 'muted',
        timestampLabel,
        alertMessageDa,
        risk,
      };
    }

    if (!input.forcePlay && !risk.isAcuteRisk) {
      return {
        played: false,
        reason: 'below_threshold',
        timestampLabel,
        alertMessageDa,
        risk,
      };
    }

    if (!input.forcePlay && !this.hasUserGesture) {
      return {
        played: false,
        reason: 'awaiting_user_gesture',
        timestampLabel,
        alertMessageDa,
        risk,
      };
    }

    if (typeof window === 'undefined') {
      return {
        played: false,
        reason: 'audio_unavailable',
        timestampLabel,
        alertMessageDa,
        risk,
      };
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        return {
          played: false,
          reason: 'audio_unavailable',
          timestampLabel,
          alertMessageDa,
          risk,
        };
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }

      const now = ctx.currentTime;
      // To-tonet harmonisk advarselspuls med blød attack/release (alle gain-værdier > 0)
      risk.toneFrequenciesHz.forEach((freq, idx) => {
        const startAt = now + idx * 0.16;
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startAt);

        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(freq * 0.5, startAt);

        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.065, startAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);

        osc.connect(gain);
        subOsc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startAt);
        subOsc.start(startAt);
        osc.stop(startAt + 0.26);
        subOsc.stop(startAt + 0.26);
      });

      this.lastPlayedEpochMs = Date.now();
      return {
        played: true,
        reason: 'played',
        timestampLabel,
        alertMessageDa,
        risk,
      };
    } catch {
      return {
        played: false,
        reason: 'audio_unavailable',
        timestampLabel,
        alertMessageDa,
        risk,
      };
    }
  }
}

export const acousticDustWarningService = new AcousticDustWarningService();
