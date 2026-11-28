import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  AcousticWeightingContextParams,
  AcousticWeightingMode,
  WeightedNoiseLabels,
  applyAcousticWeighting,
  getWeightedNoiseLabels,
  getWeightingUnitLabel,
} from '../utils/acousticWeighting';

const STORAGE_KEY = 'ringparken_acoustic_weighting_mode_v1';

interface AcousticWeightingContextValue {
  weighting: AcousticWeightingMode;
  setWeighting: (mode: AcousticWeightingMode) => void;
  toggleWeighting: () => void;
  unitLabel: 'dB(A)' | 'dB(C)';
  labels: WeightedNoiseLabels;
  convertDb: (
    canonicalDbA: number,
    context?: AcousticWeightingContextParams
  ) => number;
  formatDb: (
    canonicalDbA: number,
    context?: AcousticWeightingContextParams,
    decimals?: number
  ) => string;
}

const DEFAULT_LABELS = getWeightedNoiseLabels('A');

const AcousticWeightingContext = createContext<AcousticWeightingContextValue>({
  weighting: 'A',
  setWeighting: () => undefined,
  toggleWeighting: () => undefined,
  unitLabel: 'dB(A)',
  labels: DEFAULT_LABELS,
  convertDb: (canonicalDbA) => Number((Number.isFinite(canonicalDbA) ? canonicalDbA : 0).toFixed(1)),
  formatDb: (canonicalDbA, _ctx, decimals = 1) =>
    `${(Number.isFinite(canonicalDbA) ? canonicalDbA : 0).toFixed(decimals)} dB(A)`,
});

function readInitialWeightingMode(): AcousticWeightingMode {
  if (typeof window === 'undefined') return 'A';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'C' ? 'C' : 'A';
  } catch {
    return 'A';
  }
}

export const AcousticWeightingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [weighting, setWeightingState] = useState<AcousticWeightingMode>(
    readInitialWeightingMode
  );

  const setWeighting = useCallback((mode: AcousticWeightingMode) => {
    setWeightingState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors in private/sandbox contexts
    }
  }, []);

  const toggleWeighting = useCallback(() => {
    setWeightingState((prev) => {
      const next: AcousticWeightingMode = prev === 'A' ? 'C' : 'A';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const value = useMemo<AcousticWeightingContextValue>(() => {
    const unitLabel = getWeightingUnitLabel(weighting);
    const labels = getWeightedNoiseLabels(weighting);
    const convertDb = (
      canonicalDbA: number,
      context?: AcousticWeightingContextParams
    ) => applyAcousticWeighting(canonicalDbA, weighting, context);
    const formatDb = (
      canonicalDbA: number,
      context?: AcousticWeightingContextParams,
      decimals = 1
    ) => `${convertDb(canonicalDbA, context).toFixed(decimals)} ${unitLabel}`;

    return {
      weighting,
      setWeighting,
      toggleWeighting,
      unitLabel,
      labels,
      convertDb,
      formatDb,
    };
  }, [weighting, setWeighting, toggleWeighting]);

  return (
    <AcousticWeightingContext.Provider value={value}>
      {children}
    </AcousticWeightingContext.Provider>
  );
};

export function useAcousticWeighting(): AcousticWeightingContextValue {
  return useContext(AcousticWeightingContext);
}
