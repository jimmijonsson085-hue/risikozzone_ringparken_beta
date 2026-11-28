/**
 * @file src/utils/acousticWeighting.ts
 * @description Frekvensvægtnings-hjælpefunktioner til skift mellem dB(A) (Miljøstyrelsens
 * vejledning nr. 5/1984) og dB(C) (IEC 61672-1 / lavfrekvent støj Vejl. 9/1997 &
 * Arbejdstilsynets spidsværdi) for al realtids støjovervågning på Ringparken.
 */

export type AcousticWeightingMode = 'A' | 'C';

export interface AcousticWeightingContextParams {
  windSpeedMs?: number;
  windGustMs?: number;
  isImpulse?: boolean;
  dominantFreqHz?: number;
}

export interface WeightedNoiseLabels {
  mode: AcousticWeightingMode;
  unit: 'dB(A)' | 'dB(C)';
  leqLabel: 'L_Aeq' | 'L_Ceq';
  leqKorrLabel: 'L_Aeq,korr' | 'L_Ceq,korr';
  lmaxLabel: 'L_AFmax' | 'L_CFmax';
  lpeakLabel: 'L_AFpeak' | 'L_CFpeak';
  lwaLabel: 'L_WA' | 'L_WC';
  standardShortLabel: string;
  standardDescriptionDa: string;
}

/**
 * Beregner fysisk Δ(C − A) frekvenskorrektion i dB jf. IEC 61672-1 for tungt
 * nedrivningsmateriel (hydraulisk hammer, betonknuser, stålsaks).
 *
 * Nedrivningsmaskiner har markant energi i 31,5–250 Hz oktavbåndene, hvor A-kurven
 * dæmper -26 dB til -8,6 dB mens C-kurven er tæt på 0 dB. Ved højfrekvente
 * klinger/skæreskiver (>= 1 kHz) er Δ(C − A) mindre.
 */
export function computeCMinusAOffsetDb(
  context: AcousticWeightingContextParams = {}
): number {
  const freq = context.dominantFreqHz;
  let baseDeltaDb = 5.8;

  if (typeof freq === 'number' && Number.isFinite(freq)) {
    if (freq >= 2000) {
      baseDeltaDb = 1.8;
    } else if (freq >= 1000) {
      baseDeltaDb = 2.6;
    } else if (freq >= 500) {
      baseDeltaDb = 4.2;
    } else {
      baseDeltaDb = 6.4;
    }
  } else if (context.isImpulse) {
    baseDeltaDb = 6.4;
  }

  const gustMs = context.windGustMs ?? context.windSpeedMs ?? 0;
  const lowFreqWindPropagationDb =
    Number.isFinite(gustMs) && gustMs > 5
      ? Math.min(1.8, Math.max(0, (gustMs - 5) * 0.16))
      : 0;

  return Number(
    Math.max(1.5, Math.min(8.6, baseDeltaDb + lowFreqWindPropagationDb)).toFixed(1)
  );
}

/**
 * Konverterer en kanonisk dB(A)-værdi til enten dB(A) eller dB(C).
 */
export function applyAcousticWeighting(
  canonicalDbA: number,
  mode: AcousticWeightingMode,
  context: AcousticWeightingContextParams = {}
): number {
  const safeVal = Number.isFinite(canonicalDbA) ? canonicalDbA : 0;
  if (mode === 'A') {
    return Number(safeVal.toFixed(1));
  }
  const offset = computeCMinusAOffsetDb(context);
  return Number((safeVal + offset).toFixed(1));
}

export function getWeightingUnitLabel(mode: AcousticWeightingMode): 'dB(A)' | 'dB(C)' {
  return mode === 'C' ? 'dB(C)' : 'dB(A)';
}

export function getWeightedNoiseLabels(mode: AcousticWeightingMode): WeightedNoiseLabels {
  if (mode === 'C') {
    return {
      mode: 'C',
      unit: 'dB(C)',
      leqLabel: 'L_Ceq',
      leqKorrLabel: 'L_Ceq,korr',
      lmaxLabel: 'L_CFmax',
      lpeakLabel: 'L_CFpeak',
      lwaLabel: 'L_WC',
      standardShortLabel: 'IEC 61672-1 / Vejl. 9/1997 · dB(C)',
      standardDescriptionDa:
        'C-vægtet måling inkl. lavfrekvent energi (31,5–250 Hz) & spidsværdi jf. IEC 61672-1 / MST Vejl. 9/1997',
    };
  }
  return {
    mode: 'A',
    unit: 'dB(A)',
    leqLabel: 'L_Aeq',
    leqKorrLabel: 'L_Aeq,korr',
    lmaxLabel: 'L_AFmax',
    lpeakLabel: 'L_AFpeak',
    lwaLabel: 'L_WA',
    standardShortLabel: 'MST Vejl. 5/1984 · dB(A)',
    standardDescriptionDa:
      'A-vægtet ekstern miljøstøj (human ørefølsomhed) jf. Miljøstyrelsens Vejledning nr. 5/1984',
  };
}
