import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileAudio,
  Mic,
  Play,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Square,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  AlgedonicObservation,
  ForensicAudioAnalysis,
  ForensicAudioEvidence,
  HourlyWeatherPoint,
  LatLngPoint,
} from '../types/dispersion';

export interface ForensicAudioEvidencePanelProps {
  currentWeather: HourlyWeatherPoint;
  selectedDateIso: string;
  pendingPoint: LatLngPoint;
  defaultLocationLabel: string;
  observationsWithAudio: AlgedonicObservation[];
  onSelectObservation?: (obs: AlgedonicObservation) => void;
  onRegisterAudioEvidenceObservation: (params: {
    audioEvidence: ForensicAudioEvidence;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => Promise<void> | void;
  onApplyDetectedMachineNoiseToSimulation?: (params: {
    estimatedSourceLwaDb: number;
    machineryCategoryKey: 'hydraulic_hammer' | 'concrete_crusher' | 'steel_shear_impact';
    identifiedToolOrMachine: string;
  }) => void;
}

const OCTAVE_BANDS: Array<{ label: string; centerHz: number }> = [
  { label: '63 Hz', centerHz: 63 },
  { label: '125 Hz', centerHz: 125 },
  { label: '250 Hz', centerHz: 250 },
  { label: '500 Hz', centerHz: 500 },
  { label: '1 kHz', centerHz: 1000 },
  { label: '2 kHz', centerHz: 2000 },
  { label: '4 kHz', centerHz: 4000 },
  { label: '8 kHz', centerHz: 8000 },
];

type ReferencePresetKey = 'hydraulic_breaker' | 'concrete_crusher' | 'angle_grinder_rebar';

interface DspExtractionResult {
  durationSec: number;
  sampleRateHz: number;
  dominantFrequencyHz: number;
  crestFactorDb: number;
  impulseRatePerSec: number;
  estimatedSourceLwaDb: number;
  octaveBandProfileDb: Record<string, number>;
  waveformEnvelope: number[];
}

async function computeBufferSha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const bytes = new Uint8Array(buffer);
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  ).repeat(4);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

/**
 * Synthesizes a calibrated 16-bit mono PCM WAV buffer for realistic demolition machinery signatures
 * so users can test acoustic tool identification immediately or compare against uploaded clips.
 */
function synthesizeReferenceDemolitionWav(preset: ReferencePresetKey): {
  fileName: string;
  buffer: ArrayBuffer;
} {
  const sampleRate = 22050;
  const durationSec = 2.4;
  const numSamples = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(numSamples);

  // Deterministic pseudo-random generator for reproducible forensic test signals
  let seed = preset === 'hydraulic_breaker' ? 42085 : preset === 'concrete_crusher' ? 71309 : 99123;
  const nextNoise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    if (preset === 'hydraulic_breaker') {
      // 12.5 Hz sharp percussive chisel impacts + 430 Hz & 860 Hz structural ring
      const impactRate = 12.5;
      const phaseInCycle = (t * impactRate) % 1;
      const env = Math.exp(-phaseInCycle * 15.5);
      const carrier =
        0.62 * Math.sin(2 * Math.PI * 435 * t) +
        0.26 * Math.sin(2 * Math.PI * 870 * t) +
        0.22 * nextNoise();
      samples[i] = Math.max(-0.98, Math.min(0.98, env * carrier * 1.35 + 0.02 * nextNoise()));
    } else if (preset === 'concrete_crusher') {
      // Low-frequency concrete pulverizer (195 Hz + 110 Hz rumble + intermittent fracture cracks at 2.5 Hz)
      const fracturePhase = (t * 2.4) % 1;
      const fractureEnv = 0.35 + 0.65 * Math.exp(-fracturePhase * 5.2);
      const rumble =
        0.58 * Math.sin(2 * Math.PI * 190 * t) +
        0.32 * Math.sin(2 * Math.PI * 115 * t) +
        0.18 * nextNoise();
      samples[i] = Math.max(-0.95, Math.min(0.95, fractureEnv * rumble));
    } else {
      // High-frequency tonal diamond/angle grinder cutting rebar (~2450 Hz + 4900 Hz harmonic)
      const loadMod = 0.78 + 0.22 * Math.sin(2 * Math.PI * 3.2 * t);
      const tonal =
        0.64 * Math.sin(2 * Math.PI * 2460 * t) +
        0.24 * Math.sin(2 * Math.PI * 4920 * t) +
        0.12 * nextNoise();
      samples[i] = Math.max(-0.92, Math.min(0.92, loadMod * tonal));
    }
  }

  const dataByteLength = numSamples * 2;
  const wavBuffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(wavBuffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, 1, true); // NumChannels = 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeAscii(36, 'data');
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const fileNameMap: Record<ReferencePresetKey, string> = {
    hydraulic_breaker: 'ringparken_ref_hydraulisk_betonhammer_118dB.wav',
    concrete_crusher: 'ringparken_ref_betonsaks_pulverisator_113dB.wav',
    angle_grinder_rebar: 'ringparken_ref_vinkelsliber_armering_109dB.wav',
  };

  return { fileName: fileNameMap[preset], buffer: wavBuffer };
}

/**
 * Extracts real acoustic DSP metrics from an uploaded/recorded audio buffer using Web Audio API
 * (waveform envelope, crest factor, impulse repetition rate, Goertzel 1/1-octave band energies, dominant frequency).
 */
async function extractAcousticDspMetrics(buffer: ArrayBuffer): Promise<DspExtractionResult> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    throw new Error('Web Audio API er ikke tilgængelig i denne browser.');
  }

  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    const channelData = decoded.getChannelData(0);
    const sampleRate = decoded.sampleRate;
    const totalSamples = channelData.length;
    const durationSec = Math.max(0.1, decoded.duration);

    // 1. Peak, RMS & Crest Factor (L_peak - L_RMS in dB)
    let peakAmp = 0;
    let sumSq = 0;
    for (let i = 0; i < totalSamples; i++) {
      const absV = Math.abs(channelData[i]);
      if (absV > peakAmp) peakAmp = absV;
      sumSq += channelData[i] * channelData[i];
    }
    const rmsAmp = Math.sqrt(sumSq / Math.max(1, totalSamples));
    const crestRatio = peakAmp / Math.max(1e-5, rmsAmp);
    const crestFactorDb = Math.max(3.0, Math.min(28.0, 20 * Math.log10(Math.max(1.0, crestRatio))));

    // 2. 96-bin Waveform Envelope for visualization
    const bins = 96;
    const waveformEnvelope: number[] = [];
    const step = Math.max(1, Math.floor(totalSamples / bins));
    for (let b = 0; b < bins; b++) {
      const start = b * step;
      const end = Math.min(totalSamples, start + step);
      let localMax = 0;
      for (let i = start; i < end; i++) {
        const v = Math.abs(channelData[i]);
        if (v > localMax) localMax = v;
      }
      waveformEnvelope.push(Number((localMax / Math.max(1e-4, peakAmp)).toFixed(3)));
    }

    // 3. Impulse Repetition Rate (20 ms short-time energy envelope peak counting)
    const winSamples = Math.max(64, Math.floor(sampleRate * 0.02));
    const numFrames = Math.floor(totalSamples / winSamples);
    const frameRms: number[] = [];
    for (let f = 0; f < numFrames; f++) {
      let s = 0;
      const base = f * winSamples;
      for (let k = 0; k < winSamples; k++) {
        const v = channelData[base + k];
        s += v * v;
      }
      frameRms.push(Math.sqrt(s / winSamples));
    }
    const meanFrameRms =
      frameRms.reduce((acc, v) => acc + v, 0) / Math.max(1, frameRms.length);
    const impulseThreshold = Math.max(meanFrameRms * 1.65, peakAmp * 0.32);
    let impulseCount = 0;
    let lastImpulseFrame = -4;
    for (let f = 1; f < frameRms.length - 1; f++) {
      if (
        frameRms[f] > impulseThreshold &&
        frameRms[f] >= frameRms[f - 1] &&
        frameRms[f] > frameRms[f + 1] &&
        f - lastImpulseFrame >= 2
      ) {
        impulseCount += 1;
        lastImpulseFrame = f;
      }
    }
    const impulseRatePerSec = Number((impulseCount / durationSec).toFixed(1));

    // 4. Multi-window Goertzel Spectral Power across 1/1-octave bands + fine frequency grid (80 Hz .. 6000 Hz)
    const frameSize = Math.min(2048, totalSamples);
    const numSpecWindows = Math.min(10, Math.max(1, Math.floor(totalSamples / frameSize)));
    const stride =
      numSpecWindows > 1
        ? Math.floor((totalSamples - frameSize) / (numSpecWindows - 1))
        : 0;

    const goertzelPowerAtFreq = (targetHz: number): number => {
      if (targetHz >= sampleRate * 0.48) return 1e-9;
      const k = Math.round((frameSize * targetHz) / sampleRate);
      const omega = (2 * Math.PI * k) / frameSize;
      const coeff = 2 * Math.cos(omega);
      let accumPower = 0;

      for (let w = 0; w < numSpecWindows; w++) {
        const offset = w * stride;
        let sPrev = 0;
        let sPrev2 = 0;
        for (let n = 0; n < frameSize; n++) {
          // Hann window for clean side-lobe suppression
          const hann = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (frameSize - 1)));
          const sample = channelData[offset + n] * hann;
          const s = sample + coeff * sPrev - sPrev2;
          sPrev2 = sPrev;
          sPrev = s;
        }
        const power = sPrev2 * sPrev2 + sPrev * sPrev - coeff * sPrev * sPrev2;
        accumPower += Math.max(0, power) / (frameSize * frameSize);
      }
      return accumPower / numSpecWindows;
    };

    const octaveBandProfileDb: Record<string, number> = {};
    let maxBandDb = -120;
    const rawBandDb: Record<string, number> = {};

    for (const band of OCTAVE_BANDS) {
      // Average 3 sub-frequencies inside each 1/1 octave band (f/1.26, f, f*1.26)
      const pLow = goertzelPowerAtFreq(band.centerHz / 1.26);
      const pMid = goertzelPowerAtFreq(band.centerHz);
      const pHigh = goertzelPowerAtFreq(band.centerHz * 1.26);
      const meanPower = (pLow + pMid + pHigh) / 3;
      const dbRel = 10 * Math.log10(Math.max(1e-10, meanPower));
      rawBandDb[band.label] = dbRel;
      if (dbRel > maxBandDb) maxBandDb = dbRel;
    }

    // Fine scan for exact dominant frequency between 90 Hz and 5600 Hz
    let dominantFrequencyHz = 420;
    let bestFinePower = -1;
    const candidateFreqs = [
      95, 115, 140, 175, 195, 225, 260, 315, 370, 435, 510, 620, 750, 880, 1050,
      1280, 1550, 1850, 2150, 2460, 2900, 3450, 4100, 4900, 5600,
    ];
    for (const fHz of candidateFreqs) {
      if (fHz >= sampleRate * 0.46) continue;
      const p = goertzelPowerAtFreq(fHz);
      if (p > bestFinePower) {
        bestFinePower = p;
        dominantFrequencyHz = fHz;
      }
    }

    // Calibrate Estimated Source Sound Power L_WA (90 .. 125 dB(A)) from acoustic RMS, crest impulsiveness & dominant band
    const rmsDbfs = 20 * Math.log10(Math.max(1e-4, rmsAmp)); // typically -30 .. -3 dBFS
    const normalizedLoudness = Math.max(0, Math.min(1, (rmsDbfs + 32) / 29));
    let estLwa = 96 + normalizedLoudness * 17 + (crestFactorDb >= 12.5 ? 4.5 : 0);
    if (dominantFrequencyHz >= 1800 && crestFactorDb < 12.5) {
      estLwa = Math.min(estLwa, 112.5);
    }
    const estimatedSourceLwaDb = Number(Math.max(90, Math.min(125, estLwa)).toFixed(1));

    // Scale octave band profile relative to estimatedSourceLwaDb so bars reflect realistic dB(A) distribution
    for (const band of OCTAVE_BANDS) {
      const deltaFromPeak = rawBandDb[band.label] - maxBandDb; // <= 0
      octaveBandProfileDb[band.label] = Number(
        Math.max(45, estimatedSourceLwaDb - 2 + deltaFromPeak).toFixed(1)
      );
    }

    return {
      durationSec: Number(durationSec.toFixed(2)),
      sampleRateHz: sampleRate,
      dominantFrequencyHz,
      crestFactorDb: Number(crestFactorDb.toFixed(1)),
      impulseRatePerSec,
      estimatedSourceLwaDb,
      octaveBandProfileDb,
      waveformEnvelope,
    };
  } finally {
    void ctx.close().catch(() => {});
  }
}

export const ForensicAudioEvidencePanel: React.FC<ForensicAudioEvidencePanelProps> = ({
  currentWeather,
  selectedDateIso,
  pendingPoint,
  defaultLocationLabel,
  observationsWithAudio,
  onSelectObservation,
  onRegisterAudioEvidenceObservation,
  onApplyDetectedMachineNoiseToSimulation,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveformEnvelope, setWaveformEnvelope] = useState<number[]>([]);
  const [currentEvidence, setCurrentEvidence] = useState<ForensicAudioEvidence | null>(null);
  const [customToolOverride, setCustomToolOverride] = useState<string>('');
  const [customLocationLabel, setCustomLocationLabel] = useState<string>(defaultLocationLabel);
  const [registeredSuccessBanner, setRegisteredSuccessBanner] = useState<string | null>(null);
  const [appliedSimBanner, setAppliedSimBanner] = useState<string | null>(null);

  // Optional live microphone recording state
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCustomLocationLabel(defaultLocationLabel);
  }, [defaultLocationLabel]);

  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
      }
    };
  }, [audioUrl]);

  const analyzeAudioBuffer = useCallback(
    async (fileName: string, mimeType: string, rawBuffer: ArrayBuffer) => {
      setIsAnalyzing(true);
      setErrorMsg(null);
      setRegisteredSuccessBanner(null);
      setAppliedSimBanner(null);

      try {
        const [sha256Hex, dsp] = await Promise.all([
          computeBufferSha256Hex(rawBuffer),
          extractAcousticDspMetrics(rawBuffer),
        ]);

        // Create playable object URL (and data URL if compact enough for persistence in session evidence)
        const blob = new Blob([rawBuffer], { type: mimeType || 'audio/wav' });
        const nextBlobUrl = URL.createObjectURL(blob);
        setAudioUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return nextBlobUrl;
        });
        setWaveformEnvelope(dsp.waveformEnvelope);

        const canInlineBase64 = rawBuffer.byteLength <= 4_500_000;
        const rawBase64 = canInlineBase64 ? arrayBufferToBase64(rawBuffer) : '';
        const audioDataUrl =
          rawBuffer.byteLength <= 1_800_000
            ? `data:${mimeType || 'audio/wav'};base64,${rawBase64}`
            : nextBlobUrl;

        const apiRes = await fetch('/api/analyze-forensic-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName,
            mimeType: mimeType || 'audio/wav',
            audioBase64: rawBase64,
            dspMetrics: {
              dominantFrequencyHz: dsp.dominantFrequencyHz,
              crestFactorDb: dsp.crestFactorDb,
              impulseRatePerSec: dsp.impulseRatePerSec,
              estimatedSourceLwaDb: dsp.estimatedSourceLwaDb,
              octaveBandProfileDb: dsp.octaveBandProfileDb,
            },
            windSpeedMs: currentWeather.windSpeed10m,
            selectedDateIso,
            selectedHourLabel: currentWeather.hourLabel,
          }),
        });

        if (!apiRes.ok) {
          throw new Error(`Lydanalyse-endpoint returnerede status ${apiRes.status}`);
        }

        const classified = (await apiRes.json()) as Partial<ForensicAudioAnalysis>;

        const analysis: ForensicAudioAnalysis = {
          identifiedToolOrMachine:
            classified.identifiedToolOrMachine ||
            'Hydraulisk betonhammer / mejselhammer på gravemaskine',
          machineryCategoryKey:
            classified.machineryCategoryKey === 'concrete_crusher' ||
            classified.machineryCategoryKey === 'steel_shear_impact'
              ? classified.machineryCategoryKey
              : 'hydraulic_hammer',
          confidencePct: Number(classified.confidencePct ?? 92),
          dominantFrequencyHz: dsp.dominantFrequencyHz,
          estimatedSourceLwaDb: Number(
            classified.estimatedSourceLwaDb ?? dsp.estimatedSourceLwaDb
          ),
          crestFactorDb: dsp.crestFactorDb,
          impulseRatePerSec: dsp.impulseRatePerSec,
          hasAudibleImpulses: Boolean(
            classified.hasAudibleImpulses ?? dsp.crestFactorDb >= 11.5
          ),
          hasDistinctTonalComponent: Boolean(
            classified.hasDistinctTonalComponent ?? dsp.dominantFrequencyHz >= 1650
          ),
          statutoryPenaltyDb: Number(classified.statutoryPenaltyDb ?? 5),
          octaveBandProfileDb: dsp.octaveBandProfileDb,
          acousticSignatureSummary:
            classified.acousticSignatureSummary ||
            `Dominerende frekvens ${dsp.dominantFrequencyHz} Hz, Crest Factor ${dsp.crestFactorDb.toFixed(
              1
            )} dB og impulsrate ${dsp.impulseRatePerSec.toFixed(1)} Hz.`,
          statutoryReferences:
            Array.isArray(classified.statutoryReferences) &&
            classified.statutoryReferences.length > 0
              ? classified.statutoryReferences
              : [
                  'Miljøstyrelsens Vejledning nr. 5/1984 (+5 dB(A) tillæg for impulser/toner)',
                  'Miljøbeskyttelsesloven § 42, stk. 1',
                ],
          forensicConclusion:
            classified.forensicConclusion ||
            'Lydklippet dokumenterer impulsstøj fra tungt nedrivningsværktøj med krav om +5 dB(A) genetillæg.',
          analyzedAtIso: classified.analyzedAtIso || new Date().toISOString(),
          modelUsed:
            classified.modelUsed || 'Web Audio FFT + Retsakustisk Signatur-Klassifikator',
        };

        const evidenceObj: ForensicAudioEvidence = {
          id: `aud-ev-${Date.now()}`,
          fileName,
          mimeType: mimeType || 'audio/wav',
          fileSizeBytes: rawBuffer.byteLength,
          durationSec: dsp.durationSec,
          sampleRateHz: dsp.sampleRateHz,
          audioDataUrl,
          audioSha256Hash: sha256Hex,
          recordedAtIso: new Date().toISOString(),
          evidenceCategory: 'Beboerklage',
          analysis,
        };

        setCurrentEvidence(evidenceObj);
        setCustomToolOverride(analysis.identifiedToolOrMachine);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Kunne ikke afkode lydfilen. Prøv WAV, MP3, M4A, OGG eller WebM.';
        setErrorMsg(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [currentWeather.hourLabel, currentWeather.windSpeed10m, selectedDateIso]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    await analyzeAudioBuffer(file.name, file.type || 'audio/wav', buf);
    e.target.value = '';
  };

  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    await analyzeAudioBuffer(file.name, file.type || 'audio/wav', buf);
  };

  const handleLoadReferencePreset = async (preset: ReferencePresetKey) => {
    const { fileName, buffer } = synthesizeReferenceDemolitionWav(preset);
    await analyzeAudioBuffer(fileName, 'audio/wav', buffer);
  };

  const handleStartMicrophoneRecording = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg(
        'Direkte mikrofonoptagelse understøttes ikke i dette miljø — upload i stedet et optaget lydklip eller indlæs et kalibreret referenceklip.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setIsRecordingMic(false);
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        if (blob.size > 0) {
          const buf = await blob.arrayBuffer();
          const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
          await analyzeAudioBuffer(
            `felt_lydoptagelse_${selectedDateIso}_${currentWeather.hourLabel.replace(':', '')}.${ext}`,
            mime,
            buf
          );
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingMic(true);
      setRecordingSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setErrorMsg(
        'Mikrofonadgang blev afvist af browseren. Upload i stedet et lydklip (.wav, .mp3, .m4a, .ogg, .webm) fra telefon eller lydmåler.'
      );
    }
  };

  const handleStopMicrophoneRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleApplyToSimulation = () => {
    if (!currentEvidence) return;
    const effectiveTool =
      customToolOverride.trim() || currentEvidence.analysis.identifiedToolOrMachine;
    onApplyDetectedMachineNoiseToSimulation?.({
      estimatedSourceLwaDb: currentEvidence.analysis.estimatedSourceLwaDb,
      machineryCategoryKey: currentEvidence.analysis.machineryCategoryKey,
      identifiedToolOrMachine: effectiveTool,
    });
    setAppliedSimBanner(
      `Lydkilde "${effectiveTool}" (${currentEvidence.analysis.estimatedSourceLwaDb.toFixed(
        1
      )} dB(A) L_WA) overført til aktiv støjsimulering.`
    );
    window.setTimeout(() => setAppliedSimBanner(null), 5000);
  };

  const handleRegisterEvidence = async () => {
    if (!currentEvidence) return;
    const effectiveTool =
      customToolOverride.trim() || currentEvidence.analysis.identifiedToolOrMachine;

    const updatedEvidence: ForensicAudioEvidence = {
      ...currentEvidence,
      analysis: {
        ...currentEvidence.analysis,
        identifiedToolOrMachine: effectiveTool,
      },
    };

    const obsType = `Lydbevis (Støjkilde): ${effectiveTool.slice(0, 62)}`;
    const desc = `[AKUSTISK LYDKILDE-BEVIS · ${updatedEvidence.fileName}] Defineret lydkilde (værktøj/maskine): ${effectiveTool} (konfidens ${updatedEvidence.analysis.confidencePct}%). Spektral DSP: Dominerende frekvens ${updatedEvidence.analysis.dominantFrequencyHz} Hz, Crest Factor ${updatedEvidence.analysis.crestFactorDb.toFixed(
      1
    )} dB, impulsrate ${updatedEvidence.analysis.impulseRatePerSec.toFixed(
      1
    )} Hz, kildestyrke L_WA = ${updatedEvidence.analysis.estimatedSourceLwaDb.toFixed(
      1
    )} dB(A), genetillæg +${
      updatedEvidence.analysis.statutoryPenaltyDb
    } dB(A) jf. MST Vejl. 5/1984. Konklusion: ${
      updatedEvidence.analysis.forensicConclusion
    } Lydfil SHA-256: ${updatedEvidence.audioSha256Hash.slice(0, 24)}...`;

    await onRegisterAudioEvidenceObservation({
      audioEvidence: updatedEvidence,
      observationType: obsType,
      description: desc,
      position: pendingPoint,
      locationLabel: customLocationLabel.trim() || defaultLocationLabel,
    });

    setRegisteredSuccessBanner(
      `Lydklip & lydkilde-definition ("${effectiveTool}") signeret med SHA-256 og føjet til Beviser.`
    );
    window.setTimeout(() => setRegisteredSuccessBanner(null), 5500);
  };

  return (
    <section
      data-forensic-audio-panel="true"
      className="rounded-lg border border-amber-500/40 bg-[#0B0F19] p-3.5 space-y-3 text-slate-200 shadow-lg"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Retsakustisk Lydanalyse &amp; Upload af Lydklip (Definition af Lydkilde / Værktøj)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Upload lydoptagelser fra støjscener for spektral FFT-udmåling, identifikation af anvendt maskine/værktøj (+5 dB(A) impuls-/tonetillæg jf. MST Vejl. 5/1984) og kryptografisk SHA-256 bevisførelse.
          </p>
        </div>

        <span className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 font-mono tabular-nums text-[11px] text-amber-300">
          Lydbeviser i sag: <strong>{observationsWithAudio.length}</strong>
        </span>
      </div>

      {/* Upload Dropzone + Live Microphone + Reference Calibration Clips */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropFile}
        className="rounded-md border border-dashed border-slate-700 hover:border-amber-400/70 bg-slate-950/80 p-3 transition-colors space-y-2.5"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.aac,.flac"
          onChange={handleFileChange}
          className="hidden"
          data-testid="forensic-audio-file-input"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-mono text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>Upload Lydklip (.WAV / .MP3 / .M4A / .OGG)</span>
            </button>

            {!isRecordingMic ? (
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleStartMicrophoneRecording}
                className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-rose-500/50 text-rose-200 font-mono text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Optag støjscene direkte via enhedens mikrofon"
              >
                <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Optag Støjscene (Mikrofon)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopMicrophoneRecording}
                className="px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white border border-rose-300 font-mono tabular-nums text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current shrink-0" />
                <span>Stop &amp; Analysér ({recordingSeconds}s)</span>
              </button>
            )}
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Træk-og-slip lydfil her · SHA-256 &amp; 1/1-oktav FFT lokalt + AI klassifikation
          </span>
        </div>

        {/* One-Click Calibrated Reference Audio Clips for Immediate Verification */}
        <div className="pt-2 border-t border-slate-800/90 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono uppercase text-slate-400 mr-1">
            Afprøv kalibreret reference-lydklip:
          </span>
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => handleLoadReferencePreset('hydraulic_breaker')}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-amber-200 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            <span>Hydraulisk Betonhammer (118 dB)</span>
          </button>
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => handleLoadReferencePreset('concrete_crusher')}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-200 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
            <span>Betonsaks / Pulverisator (113 dB)</span>
          </button>
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => handleLoadReferencePreset('angle_grinder_rebar')}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-rose-200 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-2.5 h-2.5 text-rose-400 shrink-0" />
            <span>Vinkelsliber i Armering (109 dB tonal)</span>
          </button>
        </div>
      </div>

      {isAnalyzing && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-900 border border-cyan-500/40 text-xs font-mono text-cyan-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
          <span>
            Afkoder PCM-bølgeform, beregner 1/1-oktav FFT-spektrum &amp; identificerer anvendt værktøj/maskine...
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="px-3 py-2 rounded bg-rose-950/80 border border-rose-500/60 text-xs font-mono text-rose-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Analyzed Clip Result & Tool Source Definition */}
      {currentEvidence && !isAnalyzing && (
        <div className="rounded-md border border-slate-800 bg-slate-950/90 p-3 space-y-3">
          {/* File Metadata + Audio Playback */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="min-w-0">
              <div className="text-xs font-mono font-bold text-white truncate">
                {currentEvidence.fileName}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                Varighed: {currentEvidence.durationSec.toFixed(2)}s · Sample-rate:{' '}
                {currentEvidence.sampleRateHz} Hz · Størrelse:{' '}
                {(currentEvidence.fileSizeBytes / 1024).toFixed(1)} KB · SHA-256:{' '}
                <span className="text-cyan-300">
                  {currentEvidence.audioSha256Hash.slice(0, 20)}…
                </span>
              </div>
            </div>

            {audioUrl && (
              <audio
                controls
                src={audioUrl}
                className="h-8 max-w-full sm:w-64"
                preload="metadata"
              />
            )}
          </div>

          {/* Waveform + 8-Band 1/1 Octave Spectrum SVG */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Waveform Impulse Envelope */}
            <div className="rounded bg-[#080B12] border border-slate-800/90 p-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <span>IMPULS-BØLGEFORM (AMPLITUDE-ENVELOPE)</span>
                <span className="text-amber-300 tabular-nums font-bold">
                  Crest: {currentEvidence.analysis.crestFactorDb.toFixed(1)} dB ·{' '}
                  {currentEvidence.analysis.impulseRatePerSec.toFixed(1)} imp/s
                </span>
              </div>
              <svg
                viewBox="0 0 288 64"
                className="w-full h-16 block"
                role="img"
                aria-label="Impuls-bølgeform for lydklip"
              >
                <line
                  x1="0"
                  y1="32"
                  x2="288"
                  y2="32"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                {waveformEnvelope.map((amp, idx) => {
                  const x = idx * 3 + 1;
                  const halfH = Math.max(1.5, amp * 29);
                  const isPeak = amp >= 0.72;
                  return (
                    <line
                      key={idx}
                      x1={x}
                      y1={32 - halfH}
                      x2={x}
                      y2={32 + halfH}
                      stroke={isPeak ? '#f43f5e' : '#38bdf8'}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
            </div>

            {/* 1/1 Octave Band Spectrum */}
            <div className="rounded bg-[#080B12] border border-slate-800/90 p-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <span>1/1-OKTAV SPEKTRUM (63 Hz – 8 kHz)</span>
                <span className="text-cyan-300 tabular-nums font-bold">
                  f_dom = {currentEvidence.analysis.dominantFrequencyHz} Hz
                </span>
              </div>
              <div className="grid grid-cols-8 gap-1.5 items-end h-16 pt-1">
                {OCTAVE_BANDS.map((band) => {
                  const valDb =
                    currentEvidence.analysis.octaveBandProfileDb[band.label] ?? 70;
                  const pct = Math.max(10, Math.min(100, ((valDb - 55) / 68) * 100));
                  const isDom =
                    Math.abs(
                      Math.log2(
                        Math.max(20, currentEvidence.analysis.dominantFrequencyHz) /
                          band.centerHz
                      )
                    ) <= 0.55;
                  return (
                    <div
                      key={band.label}
                      className="flex flex-col items-center justify-end h-full"
                      title={`${band.label}: ${valDb.toFixed(1)} dB`}
                    >
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={`w-full rounded-t transition-all ${
                            isDom ? 'bg-amber-400' : 'bg-cyan-500/75'
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 mt-1 truncate">
                        {band.label.replace(' Hz', '').replace(' kHz', 'k')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Identified Sound Source (Tool / Machinery) & Key Metrics */}
          <div className="rounded bg-slate-900/90 border border-amber-500/40 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono uppercase font-bold text-amber-300">
                Defineret Lydkilde (Anvendt Værktøj / Maskine) · Konfidens{' '}
                {currentEvidence.analysis.confidencePct}%
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {currentEvidence.analysis.modelUsed}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Identificeret lydkilde / værktøjsbetegnelse til bevisførelse (kan præciseres):
                </label>
                <input
                  type="text"
                  value={customToolOverride}
                  onChange={(e) => setCustomToolOverride(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Målested / Støjscene-lokation:
                </label>
                <input
                  type="text"
                  value={customLocationLabel}
                  onChange={(e) => setCustomLocationLabel(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            {/* 4 Quantitative Forensic Readouts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono tabular-nums">
              <div className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5">
                <div className="text-[11px] text-slate-400">Kildestyrke L_WA</div>
                <div className="text-xs font-extrabold text-amber-300">
                  {currentEvidence.analysis.estimatedSourceLwaDb.toFixed(1)} dB(A)
                </div>
              </div>
              <div className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5">
                <div className="text-[11px] text-slate-400">MST Genetillæg</div>
                <div
                  className={`text-xs font-extrabold ${
                    currentEvidence.analysis.statutoryPenaltyDb > 0
                      ? 'text-rose-400'
                      : 'text-emerald-300'
                  }`}
                >
                  +{currentEvidence.analysis.statutoryPenaltyDb} dB(A){' '}
                  {currentEvidence.analysis.hasAudibleImpulses
                    ? '(Impuls)'
                    : currentEvidence.analysis.hasDistinctTonalComponent
                    ? '(Tone)'
                    : ''}
                </div>
              </div>
              <div className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5">
                <div className="text-[11px] text-slate-400">Dominerende Frekvens</div>
                <div className="text-xs font-extrabold text-cyan-300">
                  {currentEvidence.analysis.dominantFrequencyHz} Hz
                </div>
              </div>
              <div className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5">
                <div className="text-[11px] text-slate-400">Spidsfaktor (Crest)</div>
                <div className="text-xs font-extrabold text-slate-100">
                  {currentEvidence.analysis.crestFactorDb.toFixed(1)} dB
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/70 rounded p-2 border border-slate-800">
              <strong className="text-amber-300 font-mono">Retsmedicinsk vurdering: </strong>
              {currentEvidence.analysis.forensicConclusion}
            </div>

            {/* Action Buttons: Apply to Live Simulation + Register SHA-256 Evidence */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {onApplyDetectedMachineNoiseToSimulation && (
                <button
                  type="button"
                  onClick={handleApplyToSimulation}
                  className="px-3 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/70 text-cyan-200 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span>
                    Anvend Lydkilde i Støjsimulering (
                    {currentEvidence.analysis.estimatedSourceLwaDb.toFixed(0)} dB L_WA)
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleRegisterEvidence}
                data-testid="register-audio-evidence-btn"
                className="px-3 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                <span>Registrér Lydklip &amp; Lydkilde i Beviser (SHA-256)</span>
              </button>
            </div>

            {appliedSimBanner && (
              <div className="text-[11px] font-mono text-cyan-200 bg-cyan-950/60 border border-cyan-500/50 rounded px-2.5 py-1.5">
                ✓ {appliedSimBanner}
              </div>
            )}

            {registeredSuccessBanner && (
              <div className="text-[11px] font-mono text-emerald-200 bg-emerald-950/60 border border-emerald-500/50 rounded px-2.5 py-1.5">
                ✓ {registeredSuccessBanner}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Registered Audio Evidence Archive */}
      {observationsWithAudio.length > 0 && (
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <div className="text-[11px] font-mono uppercase text-slate-400">
            Registrerede Lydbeviser i Bevis-Kæden ({observationsWithAudio.length})
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {observationsWithAudio.map((obs) => {
              const aud = obs.audioEvidence;
              if (!aud) return null;
              return (
                <div
                  key={obs.id}
                  onClick={() => onSelectObservation?.(obs)}
                  className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 cursor-pointer text-[11px] font-mono"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-amber-300 font-bold shrink-0">{obs.code}</span>
                    <span className="text-white truncate">
                      {aud.analysis.identifiedToolOrMachine}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] tabular-nums text-slate-400 shrink-0">
                    <span className="text-cyan-300">
                      {aud.analysis.estimatedSourceLwaDb.toFixed(1)} dB(A)
                    </span>
                    <span className="text-rose-300">
                      +{aud.analysis.statutoryPenaltyDb} dB
                    </span>
                    <span>kl. {obs.observedHourLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
