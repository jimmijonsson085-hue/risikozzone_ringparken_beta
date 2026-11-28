/**
 * @file src/utils/highFrequencyNoiseSpikeDetector.ts
 * @description Højfrekvent støjspids-detektor (>95 dB(A)) til identifikation og visualisering
 * af transiente maskinoperationer (mejselhammer, stålklipning, betonsaksbrud) i 'Støj & Støv'-panelet.
 */

import {
  DemolitionSourceNode,
  ForensicAudioEvidence,
  HourlyWeatherPoint,
} from '../types/dispersion';

export type SpikeDetectionBandFilter = 'all_bands' | 'high_freq_1khz_plus';

export type TransientOperationMode =
  | 'active_site_mix'
  | 'hydraulic_hammer_burst'
  | 'steel_shear_snap'
  | 'concrete_crusher_fracture'
  | 'indoor_sanitation_low';

export interface TransientNoiseSamplePoint {
  sampleIndex: number;
  offsetSec: number;
  timeLabel: string;
  baselineRmsDb: number;
  transientPeakDb: number;
  highFreqComponentDb: number;
  dominantFreqHz: number;
  riseTimeMs: number;
  exceeds95Db: boolean;
  isHighFrequencyTransient: boolean;
  sourceCode: string;
  operationLabelDa: string;
}

export interface DetectedNoiseSpike95Db {
  id: string;
  eventIndex: number;
  startOffsetSec: number;
  endOffsetSec: number;
  timeLabel: string;
  durationMs: number;
  peakDb: number;
  baselineRmsDb: number;
  excessAbove95Db: number;
  crestFactorDb: number;
  dominantFreqHz: number;
  riseTimeMs: number;
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  operationLabelDa: string;
  severityTier: 'EXTREME' | 'CRITICAL' | 'ELEVATED';
  isFromUploadedAudio: boolean;
}

export interface OctaveBandEnergyBar {
  bandLabel: string;
  centerHz: number;
  isHighFrequencyBand: boolean;
  baselineDb: number;
  spikePeakDb: number;
}

export interface HighFrequencySpikeAnalysisResult {
  thresholdDb: number;
  sampleRateDescription: string;
  windowDurationSec: number;
  totalSamples: number;
  spikeCount: number;
  highFreqSpikeCount: number;
  maxTransientPeakDb: number;
  maxExcessAbove95Db: number;
  meanBaselineRmsDb: number;
  dominantSpikeFreqHz: number;
  fastestRiseTimeMs: number;
  totalExceedanceDurationSec: number;
  dutyCycleExceedancePct: number;
  samples: TransientNoiseSamplePoint[];
  detectedSpikes: DetectedNoiseSpike95Db[];
  octaveBandSpectrum: OctaveBandEnergyBar[];
}

export interface DetectHighFrequencyNoiseSpikesParams {
  sources: DemolitionSourceNode[];
  currentWeather: HourlyWeatherPoint;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  operationMode?: TransientOperationMode;
  bandFilter?: SpikeDetectionBandFilter;
  thresholdDb?: number;
  audioEvidenceList?: ForensicAudioEvidence[];
  distanceMeters?: number;
}

const OCTAVE_BANDS: Array<{ label: string; hz: number; highFreq: boolean }> = [
  { label: '63 Hz', hz: 63, highFreq: false },
  { label: '125 Hz', hz: 125, highFreq: false },
  { label: '250 Hz', hz: 250, highFreq: false },
  { label: '500 Hz', hz: 500, highFreq: false },
  { label: '1 kHz', hz: 1000, highFreq: true },
  { label: '2 kHz', hz: 2000, highFreq: true },
  { label: '4 kHz', hz: 4000, highFreq: true },
  { label: '8 kHz', hz: 8000, highFreq: true },
];

// Deterministic pseudo-random wave generator for reproducible transient spikes
function deterministicUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function getOperationSpec(mode: TransientOperationMode): {
  labelDa: string;
  baseLwaOffsetDb: number;
  baseCrestDb: number;
  peakFreqHz: number;
  burstPeriodSamples: number;
  riseTimeMs: number;
} {
  switch (mode) {
    case 'hydraulic_hammer_burst':
      return {
        labelDa: 'Hydraulisk mejselhammer (højfrekvent slagserie)',
        baseLwaOffsetDb: 2.5,
        baseCrestDb: 18.5,
        peakFreqHz: 3150,
        burstPeriodSamples: 13,
        riseTimeMs: 12,
      };
    case 'steel_shear_snap':
      return {
        labelDa: 'Stålsaks & armeringsklip (metalbrud-transient)',
        baseLwaOffsetDb: 3.5,
        baseCrestDb: 20.0,
        peakFreqHz: 4250,
        burstPeriodSamples: 19,
        riseTimeMs: 8,
      };
    case 'concrete_crusher_fracture':
      return {
        labelDa: 'Betonknuser (pludselig elementfraktur)',
        baseLwaOffsetDb: 2.0,
        baseCrestDb: 17.0,
        peakFreqHz: 2200,
        burstPeriodSamples: 17,
        riseTimeMs: 18,
      };
    case 'indoor_sanitation_low':
      return {
        labelDa: 'Indvendig sanering & støvsugning (lavtransient)',
        baseLwaOffsetDb: -16.5,
        baseCrestDb: 7.5,
        peakFreqHz: 720,
        burstPeriodSamples: 29,
        riseTimeMs: 65,
      };
    case 'active_site_mix':
    default:
      return {
        labelDa: 'Aktive nedrivningsmaskiner (kombineret impulscyklus)',
        baseLwaOffsetDb: 1.5,
        baseCrestDb: 17.8,
        peakFreqHz: 2850,
        burstPeriodSamples: 15,
        riseTimeMs: 14,
      };
  }
}

/**
 * Analyserer 120 højfrekvente telemetri-vinduer (2 minutter ved 1 Hz transient-envelope)
 * for at detektere maskinoperationer der overstiger 95 dB(A).
 */
export function detectHighFrequencyNoiseSpikes(
  params: DetectHighFrequencyNoiseSpikesParams
): HighFrequencySpikeAnalysisResult {
  const {
    sources,
    currentWeather,
    manualMachineNoiseOutputDb = 114.0,
    isManualMachineNoiseOverrideActive = false,
    operationMode = 'active_site_mix',
    bandFilter = 'all_bands',
    thresholdDb = 95.0,
    audioEvidenceList = [],
    distanceMeters = 18,
  } = params;

  const activeSources = sources.filter((s) => s.active);
  const effectiveSources = activeSources.length > 0 ? activeSources : sources.slice(0, 1);
  const spec = getOperationSpec(operationMode);

  const rawSiteLwa =
    activeSources.length === 0 && operationMode === 'active_site_mix'
      ? 72.0
      : isManualMachineNoiseOverrideActive
      ? manualMachineNoiseOutputDb
      : Math.max(
          110.0,
          ...effectiveSources.map((s) => s.baseSoundPowerLwaDb ?? 114.0)
        );

  const windSpeedMs = currentWeather.windSpeed10m ?? 4.5;
  const windGustMs = Math.max(windSpeedMs, currentWeather.windGusts10m || windSpeedMs * 1.3);
  const gustBoostDb = windGustMs > 10 ? Math.min(4.8, (windGustMs - 10) * 0.65) : 0;

  // Close-range / near-field machine monitoring distance (e.g. 15–20 m perimeter mic)
  const aDivNearDb = 20 * Math.log10(Math.max(8, distanceMeters)) + 8.0;
  const baseContinuousRms = Math.max(
    46.0,
    rawSiteLwa + spec.baseLwaOffsetDb - aDivNearDb + gustBoostDb * 0.4
  );

  const totalSamples = 120; // 120 seconds (2 min high-resolution window)
  const hourSeed = (currentWeather.hourIndex ?? 12) + 1;
  const baseHourStr = (currentWeather.hourLabel || '12:00').slice(0, 2);

  const samples: TransientNoiseSamplePoint[] = [];

  for (let i = 0; i < totalSamples; i++) {
    const mm = Math.floor(i / 60);
    const ss = i % 60;
    const timeLabel = `${baseHourStr}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

    const microJitter = (deterministicUnit(i * 3.1 + hourSeed) - 0.5) * 2.8;
    const baselineRmsDb = Number((baseContinuousRms + microJitter).toFixed(1));

    // Transient spike envelope driven by hammer impact / shear snap phase
    const phaseMod = (i + hourSeed * 3) % spec.burstPeriodSamples;
    const isPrimaryHit = phaseMod === 2 || phaseMod === 3;
    const isSecondaryEcho = phaseMod === 8 && deterministicUnit(i + hourSeed * 7) > 0.42;

    const src = effectiveSources[i % effectiveSources.length];
    const srcCode = src?.code || 'K1';

    let impulseJumpDb = 2.2 + deterministicUnit(i * 1.9 + hourSeed) * 3.5;
    let freqHz = Math.round(
      spec.peakFreqHz * (0.45 + deterministicUnit(i * 2.3 + hourSeed) * 0.25)
    );
    let riseMs = spec.riseTimeMs + 32;

    if (isPrimaryHit && (activeSources.length > 0 || operationMode !== 'active_site_mix')) {
      const surgeFactor = 0.88 + deterministicUnit(i * 5.7 + hourSeed) * 0.32;
      impulseJumpDb = spec.baseCrestDb * surgeFactor + gustBoostDb * 0.65;
      freqHz = Math.round(
        spec.peakFreqHz * (0.85 + deterministicUnit(i * 7.1 + hourSeed) * 0.42)
      );
      riseMs = Math.max(5, Math.round(spec.riseTimeMs * (0.7 + deterministicUnit(i) * 0.5)));
    } else if (isSecondaryEcho && (activeSources.length > 0 || operationMode !== 'active_site_mix')) {
      impulseJumpDb = spec.baseCrestDb * 0.74 + gustBoostDb * 0.45;
      freqHz = Math.round(
        spec.peakFreqHz * (0.72 + deterministicUnit(i * 4.3 + hourSeed) * 0.32)
      );
      riseMs = Math.max(9, Math.round(spec.riseTimeMs * 1.25));
    }

    const transientPeakDb = Number(
      Math.max(baselineRmsDb + 1.5, baselineRmsDb + impulseJumpDb).toFixed(1)
    );
    const highFreqComponentDb = Number(
      (transientPeakDb - (freqHz >= 1000 ? 1.8 : 9.5)).toFixed(1)
    );
    const isHighFrequencyTransient = freqHz >= 1000;
    const passesBandFilter =
      bandFilter === 'all_bands' || isHighFrequencyTransient;
    const exceeds95Db = transientPeakDb > thresholdDb && passesBandFilter;

    samples.push({
      sampleIndex: i,
      offsetSec: i,
      timeLabel,
      baselineRmsDb,
      transientPeakDb,
      highFreqComponentDb,
      dominantFreqHz: freqHz,
      riseTimeMs: riseMs,
      exceeds95Db,
      isHighFrequencyTransient,
      sourceCode: srcCode,
      operationLabelDa: spec.labelDa,
    });
  }

  // Group contiguous samples exceeding 95 dB into distinct transient spike events
  const detectedSpikes: DetectedNoiseSpike95Db[] = [];
  let cursor = 0;
  while (cursor < samples.length) {
    if (!samples[cursor].exceeds95Db) {
      cursor++;
      continue;
    }
    const startIdx = cursor;
    let endIdx = cursor;
    let bestSample = samples[cursor];
    while (endIdx + 1 < samples.length && samples[endIdx + 1].exceeds95Db) {
      endIdx++;
      if (samples[endIdx].transientPeakDb > bestSample.transientPeakDb) {
        bestSample = samples[endIdx];
      }
    }

    const src =
      effectiveSources.find((s) => s.code === bestSample.sourceCode) || effectiveSources[0];
    const durationMs = Math.max(
      125,
      (endIdx - startIdx + 1) * 1000 - bestSample.riseTimeMs * 4
    );
    const excessAbove95Db = Number((bestSample.transientPeakDb - thresholdDb).toFixed(1));
    const crestFactorDb = Number(
      (bestSample.transientPeakDb - bestSample.baselineRmsDb).toFixed(1)
    );

    const severityTier: DetectedNoiseSpike95Db['severityTier'] =
      bestSample.transientPeakDb >= 105.0
        ? 'EXTREME'
        : bestSample.transientPeakDb >= 100.0
        ? 'CRITICAL'
        : 'ELEVATED';

    detectedSpikes.push({
      id: `spike-95db-${startIdx}-${bestSample.sourceCode}`,
      eventIndex: detectedSpikes.length + 1,
      startOffsetSec: startIdx,
      endOffsetSec: endIdx,
      timeLabel: bestSample.timeLabel,
      durationMs,
      peakDb: bestSample.transientPeakDb,
      baselineRmsDb: bestSample.baselineRmsDb,
      excessAbove95Db,
      crestFactorDb,
      dominantFreqHz: bestSample.dominantFreqHz,
      riseTimeMs: bestSample.riseTimeMs,
      sourceId: src?.id || 'src-1',
      sourceCode: bestSample.sourceCode,
      sourceName: src?.name || 'Nedrivningsmaskine',
      operationLabelDa: bestSample.operationLabelDa,
      severityTier,
      isFromUploadedAudio: false,
    });

    cursor = endIdx + 1;
  }

  // Merge any real uploaded ForensicAudioEvidence exceeding 95 dB
  audioEvidenceList.forEach((audio, idx) => {
    const peakEst = audio.analysis.estimatedSourceLwaDb - aDivNearDb + audio.analysis.crestFactorDb * 0.55;
    if (peakEst > thresholdDb) {
      detectedSpikes.unshift({
        id: `spike-audio-${audio.id}`,
        eventIndex: idx + 1,
        startOffsetSec: 10 + idx * 5,
        endOffsetSec: 11 + idx * 5,
        timeLabel: audio.recordedAtIso.slice(11, 19) || `${baseHourStr}:00:15`,
        durationMs: Math.round(Math.min(1800, Math.max(180, audio.durationSec * 85))),
        peakDb: Number(peakEst.toFixed(1)),
        baselineRmsDb: Number((peakEst - audio.analysis.crestFactorDb).toFixed(1)),
        excessAbove95Db: Number((peakEst - thresholdDb).toFixed(1)),
        crestFactorDb: Number(audio.analysis.crestFactorDb.toFixed(1)),
        dominantFreqHz: Math.round(audio.analysis.dominantFrequencyHz || 2800),
        riseTimeMs: 11,
        sourceId: effectiveSources[0]?.id || 'src-audio',
        sourceCode: 'WAV',
        sourceName: audio.analysis.identifiedToolOrMachine,
        operationLabelDa: `Målt lydoptagelse: ${audio.fileName}`,
        severityTier: peakEst >= 105 ? 'EXTREME' : peakEst >= 100 ? 'CRITICAL' : 'ELEVATED',
        isFromUploadedAudio: true,
      });
    }
  });

  const sortedSpikes = [...detectedSpikes].sort((a, b) => b.peakDb - a.peakDb);
  const maxTransientPeakDb =
    samples.length > 0 ? Math.max(...samples.map((s) => s.transientPeakDb)) : 0;
  const maxExcessAbove95Db = Number(Math.max(0, maxTransientPeakDb - thresholdDb).toFixed(1));
  const meanBaselineRmsDb =
    samples.length > 0
      ? Number(
          (samples.reduce((s, p) => s + p.baselineRmsDb, 0) / samples.length).toFixed(1)
        )
      : 0;

  const exceedanceSamples = samples.filter((s) => s.exceeds95Db);
  const totalExceedanceDurationSec = exceedanceSamples.length;
  const dutyCycleExceedancePct = Number(
    ((totalExceedanceDurationSec / Math.max(1, totalSamples)) * 100).toFixed(1)
  );

  const dominantSpikeFreqHz =
    sortedSpikes[0]?.dominantFreqHz ??
    (samples.length > 0
      ? [...samples].sort((a, b) => b.transientPeakDb - a.transientPeakDb)[0].dominantFreqHz
      : spec.peakFreqHz);
  const fastestRiseTimeMs =
    sortedSpikes.length > 0
      ? Math.min(...sortedSpikes.map((s) => s.riseTimeMs))
      : spec.riseTimeMs;

  // Compute Octave-Band Spectral Distribution (highlighting 1 kHz – 8 kHz during spikes)
  const octaveBandSpectrum: OctaveBandEnergyBar[] = OCTAVE_BANDS.map((band) => {
    const distRatio = Math.abs(Math.log2(band.hz / Math.max(125, dominantSpikeFreqHz)));
    const resonanceShape = Math.max(-14, 4.5 - distRatio * 3.8);
    const baselineDb = Number(
      Math.max(42, meanBaselineRmsDb - 6.0 - Math.abs(Math.log2(band.hz / 500)) * 2.2).toFixed(1)
    );
    const spikePeakDb = Number(
      Math.max(
        baselineDb + 1.5,
        maxTransientPeakDb - 4.5 + resonanceShape + (band.highFreq && sortedSpikes.length > 0 ? 2.5 : -2.0)
      ).toFixed(1)
    );
    return {
      bandLabel: band.label,
      centerHz: band.hz,
      isHighFrequencyBand: band.highFreq,
      baselineDb,
      spikePeakDb,
    };
  });

  return {
    thresholdDb,
    sampleRateDescription: '1 Hz transient-envelope (125 ms L_AFpeak)',
    windowDurationSec: totalSamples,
    totalSamples,
    spikeCount: sortedSpikes.length,
    highFreqSpikeCount: sortedSpikes.filter((s) => s.dominantFreqHz >= 1000).length,
    maxTransientPeakDb,
    maxExcessAbove95Db,
    meanBaselineRmsDb,
    dominantSpikeFreqHz,
    fastestRiseTimeMs,
    totalExceedanceDurationSec,
    dutyCycleExceedancePct,
    samples,
    detectedSpikes: sortedSpikes,
    octaveBandSpectrum,
  };
}
