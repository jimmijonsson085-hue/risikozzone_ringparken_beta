/**
 * @file src/components/HighFrequencyNoiseSpikeDetectorWidget.tsx
 * @description Højfrekvent støjspids-detektor og visualisering i 'Noise Dust'-panelet,
 * som fremhæver transiente maskinoperationer over 95 dB(A) og muliggør direkte støjrapportering.
 */

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Crosshair,
  FilePlus2,
  Radio,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
} from '../types/dispersion';
import {
  DetectedNoiseSpike95Db,
  SpikeDetectionBandFilter,
  TransientOperationMode,
  detectHighFrequencyNoiseSpikes,
} from '../utils/highFrequencyNoiseSpikeDetector';
import { useAcousticWeighting } from '../context/AcousticWeightingContext';

export interface FormalNoiseReportPayload {
  hourIndex: number;
  timeLabel: string;
  locationLabel: string;
  position: LatLngPoint;
  decibelLevelDb: number;
  windGustMs?: number;
  sourceName?: string;
  dominantFrequencyHz?: number;
  notes?: string;
}

export interface HighFrequencyNoiseSpikeDetectorWidgetProps {
  sources: DemolitionSourceNode[];
  currentWeather: HourlyWeatherPoint;
  observations: AlgedonicObservation[];
  selectedReceptorName: string;
  selectedReceptorAddress: string;
  selectedReceptorPosition: LatLngPoint;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  onFileFormalNoiseReport?: (payload: FormalNoiseReportPayload) => Promise<AlgedonicObservation | null>;
}

const OPERATION_OPTIONS: Array<{ id: TransientOperationMode; label: string }> = [
  { id: 'active_site_mix', label: 'Aktive pladskilder (kombineret)' },
  { id: 'hydraulic_hammer_burst', label: 'Hydraulisk mejselhammer (slag)' },
  { id: 'steel_shear_snap', label: 'Stålsaks & metalbrud-transient' },
  { id: 'concrete_crusher_fracture', label: 'Betonknuser (frakturspids)' },
  { id: 'indoor_sanitation_low', label: 'Indvendig sanering (lavtransient)' },
];

export const HighFrequencyNoiseSpikeDetectorWidget: React.FC<
  HighFrequencyNoiseSpikeDetectorWidgetProps
> = ({
  sources,
  currentWeather,
  observations,
  selectedReceptorName,
  selectedReceptorAddress,
  selectedReceptorPosition,
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
  onFileFormalNoiseReport,
}) => {
  const { convertDb, unitLabel } = useAcousticWeighting();
  const [operationMode, setOperationMode] =
    useState<TransientOperationMode>('active_site_mix');
  const [bandFilter, setBandFilter] =
    useState<SpikeDetectionBandFilter>('all_bands');
  const [distanceMeters, setDistanceMeters] = useState<number>(18);
  const [hoveredSampleIdx, setHoveredSampleIdx] = useState<number | null>(null);
  const [reportingSpikeId, setReportingSpikeId] = useState<string | null>(null);
  const [lastReportedInfo, setLastReportedInfo] = useState<string | null>(null);

  const audioEvidenceList = useMemo(
    () =>
      observations
        .map((o) => o.audioEvidence)
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [observations]
  );

  const analysis = useMemo(
    () =>
      detectHighFrequencyNoiseSpikes({
        sources,
        currentWeather,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
        operationMode,
        bandFilter,
        thresholdDb: 95.0,
        audioEvidenceList,
        distanceMeters,
      }),
    [
      sources,
      currentWeather,
      manualMachineNoiseOutputDb,
      isManualMachineNoiseOverrideActive,
      operationMode,
      bandFilter,
      audioEvidenceList,
      distanceMeters,
    ]
  );

  const inspectedSample = useMemo(() => {
    if (analysis.samples.length === 0) return null;
    if (hoveredSampleIdx !== null) {
      return analysis.samples[hoveredSampleIdx] ?? analysis.samples[0];
    }
    if (analysis.detectedSpikes[0]) {
      return (
        analysis.samples[analysis.detectedSpikes[0].startOffsetSec] ??
        analysis.samples[0]
      );
    }
    return analysis.samples[0];
  }, [analysis, hoveredSampleIdx]);

  const handleReportSpike = async (spike: DetectedNoiseSpike95Db) => {
    if (!onFileFormalNoiseReport) return;
    setReportingSpikeId(spike.id);
    try {
      const spikeWeightVal = convertDb(spike.peakDb, {
        dominantFreqHz: spike.dominantFreqHz,
        isImpulse: true,
        windGustMs: currentWeather.windGusts10m,
      });
      const created = await onFileFormalNoiseReport({
        hourIndex: currentWeather.hourIndex,
        timeLabel: spike.timeLabel,
        locationLabel: `${selectedReceptorName} (${selectedReceptorAddress})`,
        position: selectedReceptorPosition,
        decibelLevelDb: spikeWeightVal,
        windGustMs: currentWeather.windGusts10m,
        sourceName: `${spike.sourceCode} · ${spike.sourceName}`,
        dominantFrequencyHz: spike.dominantFreqHz,
        notes: `Højfrekvent transient (>95 dB(A)): ${spike.operationLabelDa} · Spids ${spikeWeightVal.toFixed(
          1
        )} ${unitLabel} ved ${spike.dominantFreqHz} Hz (varighed ${spike.durationMs} ms).`,
      });
      if (created) {
        setLastReportedInfo(
          `Logget som ${created.code} (${spikeWeightVal.toFixed(1)} ${unitLabel} · SHA-256: ${created.sha256Signature.slice(
            0,
            10
          )}…)`
        );
      }
    } finally {
      setReportingSpikeId(null);
    }
  };

  // Waveform SVG Dimensions
  const W = 640;
  const H = 196;
  const padL = 38;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const minDb = 55;
  const maxDb = Math.max(108, Math.ceil(analysis.maxTransientPeakDb + 4));

  const xForSample = (idx: number) =>
    padL + (idx / Math.max(1, analysis.samples.length - 1)) * plotW;
  const yForDb = (db: number) =>
    padT +
    plotH -
    ((Math.min(maxDb, Math.max(minDb, db)) - minDb) / Math.max(1, maxDb - minDb)) * plotH;

  const rmsPath = analysis.samples
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xForSample(i).toFixed(1)} ${yForDb(pt.baselineRmsDb).toFixed(1)}`)
    .join(' ');
  const peakPath = analysis.samples
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xForSample(i).toFixed(1)} ${yForDb(pt.transientPeakDb).toFixed(1)}`)
    .join(' ');

  const y95 = yForDb(95.0);

  const thresholdWeighted = convertDb(95.0, {
    dominantFreqHz: analysis.dominantSpikeFreqHz,
    isImpulse: true,
    windGustMs: currentWeather.windGusts10m,
  });
  const maxPeakWeighted = convertDb(analysis.maxTransientPeakDb, {
    dominantFreqHz: analysis.dominantSpikeFreqHz,
    isImpulse: true,
    windGustMs: currentWeather.windGusts10m,
  });
  const baselineRmsWeighted = convertDb(analysis.meanBaselineRmsDb, {
    windGustMs: currentWeather.windGusts10m,
  });

  return (
    <section
      data-testid="high-frequency-noise-spike-detector-widget"
      className="rounded-lg bg-[#0F172A] border border-[#2D3B50] p-4 space-y-3.5 text-slate-100"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2.5 pb-3 border-b border-slate-800">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
            <Radio className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Højfrekvent Støjspids-Detektor (&gt;{thresholdWeighted.toFixed(0)} {unitLabel} Transiente Maskinoperationer)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            {analysis.sampleRateDescription}
            <span aria-hidden="true"> · </span>
            <span>Nærfeltsmåling {distanceMeters} m</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums text-slate-300">
              Kl. {currentWeather.hourLabel} ({selectedReceptorName})
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 font-mono text-[11px]">
          <select
            aria-label="Vælg maskinoperation for transient støjspids-detektor"
            value={operationMode}
            onChange={(e) => setOperationMode(e.target.value as TransientOperationMode)}
            className="bg-[#0B0E17] border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-rose-400"
          >
            {OPERATION_OPTIONS.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>

          <div
            role="group"
            aria-label="Filtrér frekvensbånd"
            className="flex items-center rounded bg-[#0B0E17] border border-slate-700 p-0.5"
          >
            <button
              type="button"
              onClick={() => setBandFilter('all_bands')}
              className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                bandFilter === 'all_bands'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Alle bånd
            </button>
            <button
              type="button"
              onClick={() => setBandFilter('high_freq_1khz_plus')}
              className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                bandFilter === 'high_freq_1khz_plus'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Højfrekvent ≥1 kHz
            </button>
          </div>

          <div
            role="group"
            aria-label="Vælg måleafstand"
            className="flex items-center rounded bg-[#0B0E17] border border-slate-700 p-0.5"
          >
            {[15, 18, 25, 35].map((dist) => (
              <button
                key={dist}
                type="button"
                onClick={() => setDistanceMeters(dist)}
                className={`px-1.5 py-0.5 rounded cursor-pointer whitespace-nowrap shrink-0 ${
                  distanceMeters === dist
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {dist}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
        <div className="p-2.5 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400">
            Spidser &gt;{thresholdWeighted.toFixed(0)} {unitLabel}
          </div>
          <div
            className={`text-sm font-bold ${
              analysis.spikeCount > 0 ? 'text-rose-400' : 'text-emerald-300'
            }`}
          >
            {analysis.spikeCount} transienter
          </div>
          <div className="text-[10.5px] text-slate-400">
            Højfrekvent (≥1 kHz): {analysis.highFreqSpikeCount}
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400">Maks Transient Spids</div>
          <div
            className={`text-sm font-bold ${
              analysis.maxTransientPeakDb > 95 ? 'text-rose-300' : 'text-amber-300'
            }`}
          >
            {maxPeakWeighted.toFixed(1)} {unitLabel}
          </div>
          <div className="text-[10.5px] text-slate-400">
            Overskridelse: +{analysis.maxExcessAbove95Db.toFixed(1)} dB
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400">Spids-Frekvens &amp; Angreb</div>
          <div className="text-sm font-bold text-cyan-300">
            {analysis.dominantSpikeFreqHz >= 1000
              ? `${(analysis.dominantSpikeFreqHz / 1000).toFixed(2)} kHz`
              : `${analysis.dominantSpikeFreqHz} Hz`}
          </div>
          <div className="text-[10.5px] text-slate-400">
            Stigtid: {analysis.fastestRiseTimeMs} ms
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400">Varighed &gt;{thresholdWeighted.toFixed(0)} {unitLabel}</div>
          <div className="text-sm font-bold text-amber-300">
            {analysis.totalExceedanceDurationSec} s ({analysis.dutyCycleExceedancePct.toFixed(1)}%)
          </div>
          <div className="text-[10.5px] text-slate-400">
            Basis RMS: {baselineRmsWeighted.toFixed(1)} {unitLabel}
          </div>
        </div>
      </div>

      {/* Main High-Frequency Waveform + Octave Spectrum */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* Waveform Envelope SVG */}
        <div className="xl:col-span-8 rounded bg-[#0B0E17] border border-slate-800 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Transient Impulskurve (L_AFpeak vs. Basis-RMS)</span>
            </span>
            <span className="text-rose-300 tabular-nums">
              Grænse: {thresholdWeighted.toFixed(1)} {unitLabel} transient
            </span>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto select-none overflow-visible"
            role="img"
            aria-label="Højfrekvent transient støjspids-visualisering med 95 dB tærskel"
          >
            {/* Exceedance zone above 95 dB */}
            <rect
              x={padL}
              y={padT}
              width={plotW}
              height={Math.max(0, y95 - padT)}
              fill="rgba(225, 29, 72, 0.14)"
            />

            {/* Grid horizontal dB ticks */}
            {[65, 75, 85, 95, 105].map((tick) => {
              if (tick < minDb || tick > maxDb) return null;
              const ty = yForDb(tick);
              const is95 = tick === 95;
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    y1={ty}
                    x2={padL + plotW}
                    y2={ty}
                    stroke={is95 ? '#fb7185' : '#1e293b'}
                    strokeWidth={is95 ? 1.4 : 0.7}
                    strokeDasharray={is95 ? '5 3' : undefined}
                  />
                  <text
                    x={padL - 5}
                    y={ty + 3}
                    textAnchor="end"
                    className={`text-[9.5px] font-mono tabular-nums ${
                      is95 ? 'fill-rose-300 font-bold' : 'fill-slate-400'
                    }`}
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#334155" strokeWidth="1" />
            <line
              x1={padL}
              y1={padT + plotH}
              x2={padL + plotW}
              y2={padT + plotH}
              stroke="#334155"
              strokeWidth="1"
            />

            {/* X-axis second markers */}
            {[0, 30, 60, 90, 119].map((sec) => {
              const tx = xForSample(sec);
              return (
                <text
                  key={sec}
                  x={tx}
                  y={padT + plotH + 15}
                  textAnchor="middle"
                  className="fill-slate-400 text-[9.5px] font-mono tabular-nums"
                >
                  +{sec}s
                </text>
              );
            })}

            {/* Baseline RMS Curve */}
            <path d={rmsPath} fill="none" stroke="#38bdf8" strokeWidth="1.4" strokeOpacity="0.65" />

            {/* Transient Peak Envelope Curve */}
            <path d={peakPath} fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeOpacity="0.9" />

            {/* Highlighted >95 dB Spikes */}
            {analysis.samples.map((pt, idx) => {
              const cx = xForSample(idx);
              const cy = yForDb(pt.transientPeakDb);
              const isHovered = hoveredSampleIdx === idx;
              return (
                <g key={pt.sampleIndex}>
                  {pt.exceeds95Db && (
                    <>
                      <line
                        x1={cx}
                        y1={y95}
                        x2={cx}
                        y2={cy}
                        stroke="#f43f5e"
                        strokeWidth="2.2"
                        strokeOpacity="0.85"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHovered ? 5.5 : 3.8}
                        fill="#fb7185"
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 1.5 : 0.9}
                      />
                    </>
                  )}
                  <rect
                    x={cx - plotW / (analysis.samples.length * 2)}
                    y={padT}
                    width={Math.max(4, plotW / analysis.samples.length)}
                    height={plotH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoveredSampleIdx(idx)}
                    onMouseLeave={() => setHoveredSampleIdx(null)}
                  />
                </g>
              );
            })}
          </svg>

          {inspectedSample && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#151C28] border border-slate-700 font-mono text-[11px] tabular-nums">
              <div className="flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                <span className="font-bold text-white">{inspectedSample.timeLabel}</span>
                <span className="text-slate-400">
                  ({inspectedSample.sourceCode} · +{inspectedSample.offsetSec}s)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={
                    inspectedSample.exceeds95Db
                      ? 'text-rose-300 font-bold'
                      : 'text-amber-300'
                  }
                >
                  Spids:{' '}
                  {convertDb(inspectedSample.transientPeakDb, {
                    dominantFreqHz: inspectedSample.dominantFreqHz,
                    isImpulse: true,
                    windGustMs: currentWeather.windGusts10m,
                  }).toFixed(1)}{' '}
                  {unitLabel}
                </span>
                <span className="text-cyan-300">
                  Frekvens: {inspectedSample.dominantFreqHz} Hz
                </span>
                <span className="text-slate-300">
                  Stigtid: {inspectedSample.riseTimeMs} ms
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Octave-Band Spectral Distribution (63 Hz - 8 kHz) */}
        <div className="xl:col-span-4 rounded bg-[#0B0E17] border border-slate-800 p-2.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
            <span className="font-semibold text-cyan-200">Oktavbånd (63 Hz – 8 kHz)</span>
            <span className="text-rose-300">≥1 kHz fremhævet</span>
          </div>

          <div className="space-y-1.5 font-mono text-[10.5px] tabular-nums flex-1 flex flex-col justify-center">
            {analysis.octaveBandSpectrum.map((band) => {
              const pct = Math.max(
                10,
                Math.min(100, ((band.spikePeakDb - 45) / 65) * 100)
              );
              return (
                <div key={band.bandLabel} className="flex items-center gap-2">
                  <span
                    className={`w-12 shrink-0 text-right ${
                      band.isHighFrequencyBand ? 'text-rose-300 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {band.bandLabel}
                  </span>
                  <div className="flex-1 h-3 rounded bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        band.spikePeakDb > 95
                          ? 'bg-rose-500'
                          : band.isHighFrequencyBand
                          ? 'bg-amber-400'
                          : 'bg-cyan-500/70'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-slate-200">
                    {band.spikePeakDb.toFixed(1)} dB
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detected >95 dB Transient Spike Events Table + Direct Formal Report Trigger */}
      <div className="rounded bg-[#0B0E17] border border-slate-800 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-200">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Detekterede Transiente Maskinoperationer (&gt;{thresholdWeighted.toFixed(1)} {unitLabel})</span>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-slate-400">
            {analysis.detectedSpikes.length} spidser detekteret
          </span>
        </div>

        {lastReportedInfo && (
          <div className="px-2.5 py-1.5 rounded bg-emerald-950/60 border border-emerald-500/60 text-[11px] font-mono text-emerald-200">
            ✓ Formel støjrapport gemt i bevis-loggen: {lastReportedInfo}
          </div>
        )}

        {analysis.detectedSpikes.length === 0 ? (
          <div className="px-2.5 py-2.5 rounded bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Ingen transiente støjspidser over {thresholdWeighted.toFixed(1)} {unitLabel} detekteret i dette vindue. Vælg en
              højimpuls-operation (fx mejselhammer eller stålsaks) for at inspicere spidser.
            </span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 max-h-[184px] overflow-y-auto">
            {analysis.detectedSpikes.slice(0, 6).map((spike) => (
              <div
                key={spike.id}
                onMouseEnter={() => setHoveredSampleIdx(spike.startOffsetSec)}
                className="px-2 py-2 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-900/75 transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
                    <span
                      className={`font-bold ${
                        spike.severityTier === 'EXTREME'
                          ? 'text-rose-400'
                          : spike.severityTier === 'CRITICAL'
                          ? 'text-amber-300'
                          : 'text-orange-300'
                      }`}
                    >
                      {convertDb(spike.peakDb, {
                        dominantFreqHz: spike.dominantFreqHz,
                        isImpulse: true,
                        windGustMs: currentWeather.windGusts10m,
                      }).toFixed(1)}{' '}
                      {unitLabel}
                    </span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-white font-semibold">{spike.timeLabel}</span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-cyan-300">{spike.dominantFreqHz} Hz</span>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-300">{spike.durationMs} ms</span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">
                    <Volume2 className="w-3 h-3 inline mr-1 text-slate-400" />
                    {spike.sourceCode} ({spike.sourceName}) · {spike.operationLabelDa}
                  </p>
                </div>

                {onFileFormalNoiseReport && (
                  <button
                    type="button"
                    disabled={reportingSpikeId === spike.id}
                    onClick={() => handleReportSpike(spike)}
                    className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/70 text-rose-100 text-[11px] font-mono font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                  >
                    <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {reportingSpikeId === spike.id ? 'Logger...' : 'Rapportér >95 dB'}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
