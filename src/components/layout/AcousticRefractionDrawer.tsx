import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Pause,
  Play,
  Volume2,
  X,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorExposureResult,
  ReceptorZone,
  WeatherDataset,
} from '../../types/dispersion';
import { degreesToCompass } from '../../services/weatherService';
import { generateAcousticRefractionDiagramPdfReport } from '../../services/pdfExportService';
import { computeForensicSha256Hash } from '../../services/dispersionEngine';
import {
  computeHourlyRefractionSeries,
  computeInterpolatedRefractionFrame,
  computeReceptorRefractions,
} from '../../services/acousticRefractionMath';
import { MachineImpulseWindSensitivityWidget } from '../MachineImpulseWindSensitivityWidget';
import { WindCompensatedDbaCatalogSection } from '../WindCompensatedDbaCatalogSection';
import { useAcousticWeighting } from '../../context/AcousticWeightingContext';

export interface AcousticRefractionDrawerProps {
  weatherDataset: WeatherDataset;
  currentWeather: HourlyWeatherPoint;
  selectedHourIndex: number;
  onSelectHour: (hourIndex: number) => void;
  simulationSpeedMultiplier: number;
  sources: DemolitionSourceNode[];
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string) => void;
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  selectedReceptorExposure: ReceptorExposureResult;
  worstExposedReceptor: ReceptorExposureResult | undefined;
  maxSiteSumQuotient: number;
  onSelectReceptor: (receptorId: string) => void;
  observations: AlgedonicObservation[];
  manualMachineNoiseOutputDb: number;
  isManualMachineNoiseOverrideActive: boolean;
  onChangeMachineNoiseOutputDb: (nextDb: number) => void;
  onApplyMatchedMachineProfile: (params: {
    lwaDb: number;
    machineryCategoryKey: 'hydraulic_hammer' | 'concrete_crusher' | 'steel_shear_impact';
  }) => void;
  showWindNoiseSensitivityAnalysis: boolean;
  onToggleWindNoiseSensitivityAnalysis: () => void;
  showWindCompensatedImpulseCatalog: boolean;
  onToggleWindCompensatedImpulseCatalog: () => void;
  acousticDustWarningEnabled: boolean;
  onToggleAcousticDustWarning: () => void;
  forceHighWindDustWarningSim: boolean;
  onToggleForceHighWindDustWarningSim: () => void;
  lastAcousticChimeLabel: string | null;
  onPlayAcousticDustWarningTone: (
    sumQuotient: number,
    windSpeedMs: number,
    receptorName: string
  ) => void;
  onNotifyTimelineScrub?: () => void;
  onOpenNoiseDustTab: () => void;
  onTrigger3DImpulseWaves: () => void;
  onQuickLogNoiseDustComplaint: (payload: {
    point: { lat: number; lng: number };
    locationLabel: string;
    observationType: string;
    description: string;
  }) => Promise<void> | void;
  onExportMachineWindNoiseJson: () => void;
  onClose: () => void;
}

export const AcousticRefractionDrawer: React.FC<AcousticRefractionDrawerProps> = ({
  weatherDataset,
  currentWeather,
  selectedHourIndex,
  onSelectHour,
  simulationSpeedMultiplier,
  sources,
  selectedSourceId,
  onSelectSource,
  receptors,
  receptorExposures,
  selectedReceptorExposure,
  worstExposedReceptor,
  maxSiteSumQuotient,
  onSelectReceptor,
  observations,
  manualMachineNoiseOutputDb,
  isManualMachineNoiseOverrideActive,
  onChangeMachineNoiseOutputDb,
  onApplyMatchedMachineProfile,
  showWindNoiseSensitivityAnalysis,
  onToggleWindNoiseSensitivityAnalysis,
  showWindCompensatedImpulseCatalog,
  onToggleWindCompensatedImpulseCatalog,
  acousticDustWarningEnabled,
  onToggleAcousticDustWarning,
  forceHighWindDustWarningSim,
  onToggleForceHighWindDustWarningSim,
  lastAcousticChimeLabel,
  onPlayAcousticDustWarningTone,
  onNotifyTimelineScrub,
  onOpenNoiseDustTab,
  onTrigger3DImpulseWaves,
  onQuickLogNoiseDustComplaint,
  onExportMachineWindNoiseJson,
  onClose,
}) => {
  // ISOLATED 60FPS ANIMATION STATE: Strictly local to AcousticRefractionDrawer!
  // Parent App.tsx is ONLY notified when Math.floor(progress) crosses an integer hour boundary.
  const [isPlayingRefractionLoop, setIsPlayingRefractionLoop] = useState<boolean>(false);
  const [refractionLoopProgress, setRefractionLoopProgress] = useState<number>(selectedHourIndex);
  const [refractionLoopSpeed, setRefractionLoopSpeed] = useState<'0.5x' | '1x' | '2x'>('1x');
  const [refractionWavePhase, setRefractionWavePhase] = useState<number>(0);
  const [acousticRefractionPdfBanner, setAcousticRefractionPdfBanner] = useState<string | null>(
    null
  );
  const { convertDb, unitLabel, labels } = useAcousticWeighting();

  const progressRef = useRef<number>(selectedHourIndex);
  const lastSyncedHourRef = useRef<number>(selectedHourIndex);
  const onSelectHourRef = useRef(onSelectHour);
  onSelectHourRef.current = onSelectHour;

  // Sync local scrubber when selectedHourIndex changes externally while paused
  useEffect(() => {
    if (!isPlayingRefractionLoop) {
      progressRef.current = selectedHourIndex;
      lastSyncedHourRef.current = selectedHourIndex;
      setRefractionLoopProgress(selectedHourIndex);
    }
  }, [selectedHourIndex, isPlayingRefractionLoop]);

  // Local 60fps continuous 24h acoustic refraction & wavefront loop
  useEffect(() => {
    if (!isPlayingRefractionLoop) return;
    let rafId: number | null = null;
    let lastTs = performance.now();
    const hoursPerSecond =
      (refractionLoopSpeed === '2x' ? 2.4 : refractionLoopSpeed === '0.5x' ? 0.65 : 1.25) *
      simulationSpeedMultiplier;

    const stepLoop = (now: number) => {
      const dtSec = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;

      setRefractionWavePhase(
        (prevWave) => (prevWave + dtSec * 2.8 * simulationSpeedMultiplier) % 1
      );

      const prevProg = progressRef.current;
      const nextProg = (prevProg + dtSec * hoursPerSecond) % 24;
      progressRef.current = nextProg;
      setRefractionLoopProgress(nextProg);

      const prevHourInt = Math.floor(prevProg) % 24;
      const nextHourInt = Math.floor(nextProg) % 24;
      if (nextHourInt !== prevHourInt && nextHourInt !== lastSyncedHourRef.current) {
        lastSyncedHourRef.current = nextHourInt;
        onSelectHourRef.current(nextHourInt);
      }

      rafId = window.requestAnimationFrame(stepLoop);
    };

    rafId = window.requestAnimationFrame(stepLoop);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isPlayingRefractionLoop, refractionLoopSpeed, simulationSpeedMultiplier]);

  const frame = useMemo(
    () =>
      computeInterpolatedRefractionFrame({
        hours: weatherDataset.hours,
        fallbackWeather: currentWeather,
        loopProgress: refractionLoopProgress,
        isPlayingLoop: isPlayingRefractionLoop,
      }),
    [weatherDataset.hours, currentWeather, refractionLoopProgress, isPlayingRefractionLoop]
  );

  const primaryActiveSource = useMemo(
    () =>
      sources.find((s) => s.active && s.code === 'BLOK-1') ||
      sources.find((s) => s.active) ||
      sources[0],
    [sources]
  );

  const receptorRefractions = useMemo(
    () =>
      computeReceptorRefractions({
        receptors,
        primaryActiveSource,
        receptorExposures,
        frame,
      }),
    [receptors, primaryActiveSource, receptorExposures, frame]
  );

  const selectedRecRefraction =
    receptorRefractions.find((r) => r.receptorId === selectedReceptorExposure.receptorId) ||
    receptorRefractions[0];

  const hourlyRefractionSeries = useMemo(
    () => computeHourlyRefractionSeries(weatherDataset.hours),
    [weatherDataset.hours]
  );

  const hoursExceeding3dBCount = useMemo(
    () => hourlyRefractionSeries.filter((h) => h.exceeds3dB).length,
    [hourlyRefractionSeries]
  );

  const handleExportAcousticRefractionPdfReport = async () => {
    const rows = receptorRefractions.map((rr) => ({
      receptorId: rr.receptorId,
      receptorCode: rr.receptorCode,
      receptorName: rr.receptorName,
      distanceMeters: rr.distanceMeters,
      bearingDeg: rr.bearingDeg,
      angleOffWindDeg: rr.angleOffWindDeg,
      cosAlign: rr.cosAlign,
      windRefrDb: rr.windCompDb,
      tempRefrDb: rr.tempRefrDb,
      totalRefrDb: rr.totalRefrDb,
      correctedLaeqDb: rr.correctedLaeqDb,
      impulsePeakLafmaxDb: rr.impulsePeakLafmaxDb,
      sumQuotient: rr.sumQuotient,
      exceedsNoiseLimit: rr.exceedsNoiseLimit,
    }));

    const selectedRow =
      rows.find((r) => r.receptorId === selectedRecRefraction.receptorId) || rows[0];
    const sigHash = await computeForensicSha256Hash(
      `ACOUSTIC-REFR-${weatherDataset.dateIso}-${frame.animTimeLabel}-${primaryActiveSource.code}-${selectedRow.receptorCode}-${frame.maxDownwindRefractionDb}`
    );

    generateAcousticRefractionDiagramPdfReport({
      dateIso: weatherDataset.dateIso,
      hourLabel: frame.animTimeLabel,
      windSpeedMs: frame.animWindSpeed10m,
      windGustsMs: frame.animWindGusts10m,
      windDirectionDeg: frame.animWindDirection10m,
      plumeDirectionDeg: frame.animPlumeDirectionDeg,
      temperatureC: frame.animTemp2m,
      pasquillClass: frame.animPasquillClass,
      windGradientDuDz: frame.windGradientDuDz,
      tempGradientDtDz: frame.thermalSpec.dTdz,
      thermalRegimeLabel: frame.thermalSpec.regimeLabel,
      speedOfSoundMs: frame.speedOfSoundMs,
      rayCurvatureRadiusKm: frame.rayCurvatureRadiusKm ?? 99.9,
      maxDownwindRefractionDb: frame.maxDownwindRefractionDb,
      upwindShadowRefractionDb: frame.upwindShadowRefractionDb,
      selectedSourceCode: primaryActiveSource.code,
      selectedSourceName: primaryActiveSource.name,
      selectedReceptorRow: selectedRow,
      receptorRows: rows,
      sha256Hash: sigHash,
    });

    setAcousticRefractionPdfBanner(
      `Retsmedicinsk PDF-rapport ('Lydbølgebøjnings-Diagram & dB-værdier pr. receptor') eksporteret kl. ${new Date().toLocaleTimeString(
        'da-DK'
      )} (SHA-256: ${sigHash.slice(0, 16)}...)`
    );
    window.setTimeout(() => setAcousticRefractionPdfBanner(null), 7000);
  };

  // High-wind + S > 0.8 dust dispersion acoustic alert status
  const highWindActive =
    frame.animWindSpeed10m >= 8.0 ||
    frame.animWindGusts10m >= 10.0 ||
    currentWeather.windSpeed10m >= 8.0 ||
    currentWeather.windGusts10m >= 10.0 ||
    forceHighWindDustWarningSim;
  const receptorsOver08 = receptorExposures.filter((r) => r.sumQuotient > 0.8);
  const peakReceptor = worstExposedReceptor || receptorExposures[0];
  const effectiveMaxS = forceHighWindDustWarningSim
    ? Math.max(0.94, maxSiteSumQuotient)
    : maxSiteSumQuotient;
  const isDustAcousticWarningTriggered =
    highWindActive && (effectiveMaxS > 0.8 || receptorsOver08.length > 0);

  return (
    <div
      data-testid="acoustic-refraction-drawer"
      className={`p-3 rounded-md border space-y-2.5 font-mono text-xs tabular-nums transition-colors ${
        frame.isNoiseAmplificationRisk
          ? 'bg-[#1B2433] border-rose-500/80'
          : 'bg-[#1B2433] border-[#2D3B50]'
      }`}
    >
      {/* Header Row with 'Støjforstærknings-risiko' (> 3 dB) & Loop Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {frame.isNoiseAmplificationRisk ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-600 text-white border border-amber-300 text-[11px] font-extrabold uppercase tracking-wider shadow-sm"
              role="status"
            >
              <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
              <span>
                ⚠ Støjforstærknings-risiko (&gt; 3 dB Medvindsrefraktion: +
                {frame.maxDownwindRefractionDb.toFixed(1)} dB)
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Moderat Refraktion ({frame.maxDownwindRefractionDb >= 0 ? '+' : ''}
                {frame.maxDownwindRefractionDb.toFixed(1)} dB ≤ 3,0 dB tærskel)
              </span>
            </span>
          )}

          <span className="font-bold text-white uppercase tracking-wider">
            Akustisk Refraktions Mini-Dashboard (Vind- &amp; Temperaturgradienter · ISO 9613-2 / Nord2000)
          </span>

          <span className="text-[11px] text-slate-300">
            Medvind mod {frame.animPlumeDirectionDeg}° (
            {degreesToCompass(frame.animPlumeDirectionDeg)}) ·{' '}
            <strong className="text-cyan-300">
              ∂u/∂z = +{frame.windGradientDuDz.toFixed(2)} s⁻¹
            </strong>{' '}
            ·{' '}
            <strong className="text-amber-300">
              ∂T/∂z = {frame.thermalSpec.dTdz >= 0 ? '+' : ''}
              {frame.thermalSpec.dTdz.toFixed(3)} °C/m
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Isolated 60fps 24-Hour Animated Sound Wave Bending Loop */}
          <div className="flex items-center gap-1 bg-slate-900/95 border border-amber-500/50 rounded p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setIsPlayingRefractionLoop((prev) => !prev)}
              className={`px-2.5 py-1 rounded text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                isPlayingRefractionLoop
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/50'
              }`}
              title="Simulér og animér lydbølgers refraktion (nedbøjning og opadbøjning) kontinuerligt over 24 timer"
            >
              {isPlayingRefractionLoop ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>Pause Refraktions-Loop (kl. {frame.animTimeLabel})</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>Afspil Refraktions-Loop</span>
                </>
              )}
            </button>

            {(['0.5x', '1x', '2x'] as const).map((spd) => (
              <button
                key={`refr-spd-${spd}`}
                type="button"
                onClick={() => setRefractionLoopSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  refractionLoopSpeed === spd
                    ? 'bg-amber-500/30 text-amber-200 border border-amber-400/60'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Sæt 24-timers refraktions-loop hastighed til ${spd}`}
              >
                {spd}
              </button>
            ))}
          </div>

          {!frame.isNoiseAmplificationRisk && (
            <button
              type="button"
              onClick={() => {
                const peakHr = hourlyRefractionSeries.reduce(
                  (best, cur) => (cur.totalDownwindDb > best.totalDownwindDb ? cur : best),
                  hourlyRefractionSeries[0]
                );
                if (peakHr) {
                  setIsPlayingRefractionLoop(false);
                  progressRef.current = peakHr.hourIndex;
                  lastSyncedHourRef.current = peakHr.hourIndex;
                  setRefractionLoopProgress(peakHr.hourIndex);
                  onSelectHour(peakHr.hourIndex);
                }
              }}
              className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-amber-200 border border-rose-500/60 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Skift til time med medvindsrefraktion > 3,0 dB for at inspicere 'Støjforstærknings-risiko'"
            >
              <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
              <span>Hop til &gt; 3 dB Støjforstærknings-Time</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleWindNoiseSensitivityAnalysis}
            className={`px-2.5 py-1 rounded text-[11px] font-extrabold flex items-center gap-1 border transition-colors cursor-pointer ${
              showWindNoiseSensitivityAnalysis
                ? 'bg-rose-600 text-white border-amber-300 shadow-xs'
                : 'bg-slate-900 hover:bg-slate-800 text-rose-300 border-rose-500/50'
            }`}
            title="Vis/skjul 'Vindstøj-sensitivitets-analyse' (> 10 m/s)"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              {showWindNoiseSensitivityAnalysis
                ? 'Vindstøj-Sensitivitet (>10 m/s): AKTIV'
                : 'Åbn Vindstøj-Sensitivitet (>10 m/s)'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleWindCompensatedImpulseCatalog}
            className={`px-2.5 py-1 rounded text-[11px] font-extrabold flex items-center gap-1 border transition-colors cursor-pointer ${
              showWindCompensatedImpulseCatalog
                ? 'bg-fuchsia-600 text-white border-amber-200 shadow-xs'
                : 'bg-slate-900 hover:bg-slate-800 text-fuchsia-300 border-fuchsia-500/50'
            }`}
            title="Vis/skjul Vind-Kompenseret Impuls-Katalog (.DBA upload, maskinkorrelation & 168t PDF)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>
              {showWindCompensatedImpulseCatalog
                ? 'Impuls-Katalog (DBA): AKTIV'
                : 'Impuls-Katalog (DBA)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportAcousticRefractionPdfReport}
            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-200 text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            title="Eksportér Lydbølgebøjnings-Diagram & dB-værdier pr. receptor som PDF-rapport"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Eksportér Diagram &amp; dB pr. Receptor (PDF)</span>
          </button>

          <button
            type="button"
            onClick={onOpenNoiseDustTab}
            className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Støj &amp; Støv Panel →
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Luk</span>
          </button>
        </div>
      </div>

      {acousticRefractionPdfBanner && (
        <div className="px-3 py-1.5 rounded bg-emerald-950/90 border border-emerald-400/70 text-emerald-200 text-[11px] flex items-center justify-between gap-2">
          <span className="font-bold">✓ {acousticRefractionPdfBanner}</span>
          <button
            type="button"
            onClick={() => setAcousticRefractionPdfBanner(null)}
            className="text-[11px] text-emerald-300 hover:text-white underline cursor-pointer"
          >
            Luk
          </button>
        </div>
      )}

      {/* Akustisk varsling for støvspredning (S > 0,8 i højvindsscenarier) */}
      <div
        role={isDustAcousticWarningTriggered ? 'alert' : 'region'}
        aria-label="Akustisk varsling for støvspredning ved S over 0,8 i højvindsscenarier"
        className={`px-3 py-2 rounded border flex flex-wrap items-center justify-between gap-2.5 transition-all ${
          isDustAcousticWarningTriggered
            ? 'bg-amber-950/85 border-amber-400'
            : 'bg-[#151C28] border-[#2D3B50]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider border ${
              isDustAcousticWarningTriggered
                ? 'bg-amber-400 text-slate-950 border-amber-200'
                : 'bg-[#1B2433] text-amber-300 border-amber-500/40'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isDustAcousticWarningTriggered
                ? 'AKUSTISK VARSLING AKTIV: STØVSPREDNING S > 0,8 I HØJVIND'
                : 'Akustisk varsling for støvspredning (Tærskel: S > 0,8 i højvind)'}
            </span>
          </span>

          <span className="text-[11px] text-slate-200">
            Maks. Sumkvotient:{' '}
            <strong
              className={
                effectiveMaxS > 0.8 ? 'text-amber-300 font-extrabold' : 'text-emerald-300'
              }
            >
              S = {effectiveMaxS.toFixed(2)}
            </strong>{' '}
            (grænse 0,80) · Vind:{' '}
            <strong className="text-cyan-300">
              {Math.max(frame.animWindSpeed10m, forceHighWindDustWarningSim ? 11.4 : 0).toFixed(1)}{' '}
              m/s
            </strong>{' '}
            (stød{' '}
            {Math.max(frame.animWindGusts10m, forceHighWindDustWarningSim ? 14.8 : 0).toFixed(1)}{' '}
            m/s)
            {peakReceptor ? ` · Kritisk receptor: ${peakReceptor.receptorName}` : ''}
          </span>

          {lastAcousticChimeLabel && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-950/90 border border-amber-500/40 text-amber-200">
              Sidste advarselstone: {lastAcousticChimeLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleAcousticDustWarning}
            className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
              acousticDustWarningEnabled
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Slå automatisk diskret Web Audio advarselstone til/fra ved S > 0,8 i højvindsscenarier"
          >
            {acousticDustWarningEnabled
              ? 'Auto-Advarselstone: TIL'
              : 'Auto-Advarselstone: FRA'}
          </button>

          <button
            type="button"
            onClick={() => {
              const targetRec = worstExposedReceptor || receptorExposures[0];
              onPlayAcousticDustWarningTone(
                Math.max(0.88, maxSiteSumQuotient),
                Math.max(frame.animWindSpeed10m, 10.8),
                targetRec ? targetRec.receptorName : 'Afd. 23 · Kierulffsvej'
              );
            }}
            className="px-2.5 py-1 rounded bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 border border-amber-400/60 text-[11px] font-extrabold transition-colors cursor-pointer"
            title="Afspil den diskrete akustiske advarselstone (to-tonet harmonisk Web Audio signal) nu"
          >
            Afspil Advarselstone Nu
          </button>

          <button
            type="button"
            onClick={onToggleForceHighWindDustWarningSim}
            className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
              forceHighWindDustWarningSim
                ? 'bg-rose-600 text-white border-amber-200'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
            }`}
            title="Simulér højvindsscenarie med sumkvotient S > 0,8 ved receptor"
          >
            {forceHighWindDustWarningSim
              ? 'Højvind S > 0,8 Simulering: AKTIV'
              : 'Simulér S > 0,8 i Højvind'}
          </button>
        </div>
      </div>

      {/* Interactive 24-Hour Refraction Loop Scrubber */}
      <div className="px-2.5 py-1.5 rounded bg-slate-900/90 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
          <span
            className={`px-2 py-0.5 rounded font-extrabold flex items-center gap-1 ${
              isPlayingRefractionLoop
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-cyan-300 border border-slate-700'
            }`}
          >
            <span>{isPlayingRefractionLoop ? '▶ 24T LOOP AKTIV' : '⏸ 24T TIDSLINJE'}</span>
            <span>kl. {frame.animTimeLabel}</span>
          </span>
          <span className="text-slate-300">
            Vind: <strong className="text-white">{frame.animWindSpeed10m.toFixed(1)} m/s</strong>{' '}
            <span className="text-amber-300">
              (stød {frame.animWindGusts10m.toFixed(1)} m/s)
            </span>{' '}
            fra <strong className="text-cyan-300">{frame.animWindDirection10m}°</strong>
          </span>
          <span className="text-slate-300">
            Temp: <strong className="text-amber-300">{frame.animTemp2m.toFixed(1)} °C</strong>{' '}
            <span className="text-emerald-300">
              (Kl. {frame.animPasquillClass}: {frame.thermalSpec.regimeLabel})
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
          <span className="text-[11px] text-slate-400 shrink-0">00:00</span>
          <input
            type="range"
            min={0}
            max={23.95}
            step={0.05}
            value={refractionLoopProgress}
            onChange={(e) => {
              onNotifyTimelineScrub?.();
              const val = Number(e.target.value);
              progressRef.current = val;
              setRefractionLoopProgress(val);
              const hrInt = Math.floor(val) % 24;
              if (hrInt !== lastSyncedHourRef.current) {
                lastSyncedHourRef.current = hrInt;
                onSelectHour(hrInt);
              }
            }}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            aria-label="24-timers akustisk refraktions-loop tidslinje"
          />
          <span className="text-[11px] text-slate-400 shrink-0">23:59</span>
        </div>
      </div>

      {/* 3-Column Graphical Mini-Dashboard: (1) Ray-Tracing, (2) Wind & Temp Gradient + Støjskærms-effektivitets-meter, (3) 24h vs 3 dB */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
        {/* COLUMN 1 (6 cols): Graphical Sound Wave Refraction Cross-Section SVG */}
        <div className="lg:col-span-6 rounded bg-slate-900/95 border border-slate-800 p-2.5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase text-cyan-300">
              1. Grafisk Lydbølge-Refraktion (Nedbøjning over 2,5 m Støjskærm)
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold ${
                  frame.isNoiseAmplificationRisk ? 'text-rose-300' : 'text-amber-300'
                }`}
              >
                R_c ≈ {frame.rayCurvatureRadiusKm ?? '∞'} km · c₀ = {frame.speedOfSoundMs} m/s
              </span>
              <button
                type="button"
                onClick={handleExportAcousticRefractionPdfReport}
                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/70 text-emerald-200 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                title="Eksportér det aktuelle lydbølgebøjnings-diagram og dB-refraktionsdata som PDF-rapport"
              >
                <Download className="w-3 h-3 shrink-0" />
                <span>Eksportér Diagram &amp; dB (PDF)</span>
              </button>
            </div>
          </div>

          {(() => {
            const bendNorm = Math.max(
              -0.6,
              Math.min(1.25, frame.maxDownwindRefractionDb / 4.8)
            );
            const raySpecs = [
              {
                id: 'r1',
                label: '8°',
                peakY: 96 - bendNorm * 14,
                endX: 468,
                endY: bendNorm >= 0 ? 130 : 68,
              },
              {
                id: 'r2',
                label: '16°',
                peakY: 74 - bendNorm * 18,
                endX: 472,
                endY: bendNorm >= 0 ? 122 : 48,
              },
              {
                id: 'r3',
                label: '24°',
                peakY: 52 - bendNorm * 20,
                endX: 476,
                endY: bendNorm >= 0 ? 112 : 30,
              },
              {
                id: 'r4',
                label: '32°',
                peakY: 32 - bendNorm * 18,
                endX: 480,
                endY: bendNorm >= 0 ? 98 : 16,
              },
            ];

            return (
              <svg
                viewBox="0 0 520 156"
                className="w-full h-36 rounded bg-[#070A12] border border-slate-800/90"
                role="img"
                aria-label="Grafisk tværsnit af lydbølgers refraktion (nedbøjning) i medvind og modvind"
              >
                <defs>
                  <linearGradient id="downwindFocusGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.04" />
                    <stop
                      offset="60%"
                      stopColor="#f43f5e"
                      stopOpacity={frame.isNoiseAmplificationRisk ? '0.22' : '0.1'}
                    />
                    <stop
                      offset="100%"
                      stopColor="#e11d48"
                      stopOpacity={frame.isNoiseAmplificationRisk ? '0.36' : '0.16'}
                    />
                  </linearGradient>
                  <linearGradient id="upwindShadowGrad" x1="1" y1="0" x2="0" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.16" />
                  </linearGradient>
                </defs>

                {[34, 68, 102].map((gy, idx) => (
                  <g key={`grid-z-${gy}`}>
                    <line
                      x1="8"
                      y1={gy}
                      x2="512"
                      y2={gy}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                      strokeWidth="0.8"
                    />
                    <text x="12" y={gy - 3} fill="#64748b" fontSize="9.5">
                      z={30 - idx * 10}m
                    </text>
                  </g>
                ))}

                <rect x="8" y="14" width="132" height="122" fill="url(#upwindShadowGrad)" />
                <text x="14" y="25" fill="#34d399" fontSize="9.5" fontWeight="bold">
                  ↶ MODVIND (Akustisk Skygge: {frame.upwindShadowRefractionDb.toFixed(1)} dB)
                </text>

                <rect x="284" y="14" width="228" height="122" fill="url(#downwindFocusGrad)" />
                <text
                  x="290"
                  y="25"
                  fill={frame.isNoiseAmplificationRisk ? '#fda4af' : '#fcd34d'}
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  ↷ MEDVIND ({frame.animPlumeDirectionDeg}°{' '}
                  {degreesToCompass(frame.animPlumeDirectionDeg)}: +
                  {frame.maxDownwindRefractionDb.toFixed(1)} dB · kl. {frame.animTimeLabel})
                </text>

                <line x1="8" y1="136" x2="512" y2="136" stroke="#475569" strokeWidth="2" />

                <path
                  d={`M 155 126 Q 95 ${(112 + bendNorm * 8).toFixed(1)} 22 ${(
                    44 -
                    bendNorm * 12
                  ).toFixed(1)}`}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.4"
                  strokeDasharray="3 2"
                />
                <path
                  d={`M 155 126 Q 102 ${(92 + bendNorm * 6).toFixed(1)} 34 ${(
                    22 -
                    bendNorm * 8
                  ).toFixed(1)}`}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1.4"
                  strokeDasharray="3 2"
                />

                <line
                  x1="155"
                  y1="126"
                  x2="485"
                  y2="62"
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <text x="315" y="76" fill="#94a3b8" fontSize="9.5">
                  Uden refraktion (skærmet)
                </text>

                <rect x="279" y="102" width="6" height="34" fill="#f59e0b" rx="1" />
                <text x="254" y="98" fill="#fbbf24" fontSize="9.5" fontWeight="bold">
                  Støjskærm (2,5m)
                </text>

                {raySpecs.map((r, rIdx) => {
                  const strokeCol = frame.isNoiseAmplificationRisk
                    ? rIdx <= 1
                      ? '#f43f5e'
                      : '#fbbf24'
                    : '#38bdf8';
                  return (
                    <g key={r.id}>
                      <path
                        d={`M 155 126 Q 310 ${r.peakY.toFixed(1)} ${r.endX} ${r.endY.toFixed(1)}`}
                        fill="none"
                        stroke={strokeCol}
                        strokeWidth={rIdx === 1 ? '2.2' : '1.5'}
                        strokeOpacity={0.92 - rIdx * 0.1}
                      />
                      <circle cx={r.endX} cy={r.endY} r="2.4" fill={strokeCol} />
                    </g>
                  );
                })}

                {[0, 1, 2, 3].map((wIdx) => {
                  const phaseShift = isPlayingRefractionLoop ? refractionWavePhase : 0.25;
                  const tNorm = ((wIdx + phaseShift) / 4) % 1;
                  const wx = 175 + tNorm * 285;
                  const wyTop = 104 - Math.sin(tNorm * Math.PI) * (24 + bendNorm * 14);
                  const wyMid = wyTop + 16;
                  const wyBot = wyTop + 32;
                  return (
                    <path
                      key={`wf-anim-${wIdx}`}
                      d={`M ${wx.toFixed(1)} ${wyTop.toFixed(1)} Q ${(wx + 10).toFixed(
                        1
                      )} ${wyMid.toFixed(1)} ${(wx - 2).toFixed(1)} ${wyBot.toFixed(1)}`}
                      fill="none"
                      stroke={frame.isNoiseAmplificationRisk ? '#fda4af' : '#bae6fd'}
                      strokeWidth="1.5"
                      strokeOpacity={Number((0.88 - tNorm * 0.45).toFixed(2))}
                    />
                  );
                })}

                <rect
                  x="143"
                  y="114"
                  width="24"
                  height="22"
                  fill="#e11d48"
                  stroke="#fecdd3"
                  strokeWidth="1.2"
                  rx="2"
                />
                <text x="146" y="128" fill="#ffffff" fontSize="9.5" fontWeight="bold">
                  K1
                </text>
                <text x="126" y="148" fill="#fda4af" fontSize="9.5" fontWeight="bold">
                  Støjkilde {convertDb(108, { windSpeedMs: frame.animWindSpeed10m, windGustMs: frame.animWindGusts10m }).toFixed(0)} {unitLabel}
                </text>

                <rect
                  x="472"
                  y="94"
                  width="30"
                  height="42"
                  fill={frame.isNoiseAmplificationRisk ? '#881337' : '#1e293b'}
                  stroke={frame.isNoiseAmplificationRisk ? '#fb7185' : '#38bdf8'}
                  strokeWidth="1.5"
                  rx="2"
                />
                <text x="477" y="110" fill="#ffffff" fontSize="9.5" fontWeight="bold">
                  {selectedRecRefraction.receptorCode}
                </text>
                <text x="475" y="122" fill="#fde047" fontSize="9.5" fontWeight="bold">
                  {selectedRecRefraction.totalRefrDb >= 0 ? '+' : ''}
                  {selectedRecRefraction.totalRefrDb.toFixed(1)}dB
                </text>
                <text x="438" y="148" fill="#bae6fd" fontSize="9.5" fontWeight="bold">
                  Receptor ({selectedRecRefraction.receptorCode})
                </text>

                {frame.isNoiseAmplificationRisk && (
                  <g transform="translate(306, 32)">
                    <rect
                      x="0"
                      y="0"
                      width="196"
                      height="22"
                      rx="3"
                      fill="#9f1239"
                      stroke="#fde047"
                      strokeWidth="1.2"
                    />
                    <polygon points="11,5 17,17 5,17" fill="#fde047" />
                    <text x="10" y="15.5" fill="#0f172a" fontSize="9.5" fontWeight="bold">
                      !
                    </text>
                    <text x="22" y="14" fill="#ffffff" fontSize="9.5" fontWeight="bold">
                      STØJFORSTÆRKNINGS-RISIKO (&gt; 3,0 dB)
                    </text>
                  </g>
                )}
              </svg>
            );
          })()}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 mt-1">
            <span>
              <strong className="text-amber-300">Fysik:</strong> Positiv lydhastighedsgradient (
              <code className="text-cyan-300">
                ∂c_eff/∂z = {frame.soundSpeedGradientPerSec >= 0 ? '+' : ''}
                {frame.soundSpeedGradientPerSec.toFixed(3)} s⁻¹
              </code>
              ) afbøjer lydbølger nedad over støjskærme.
            </span>
            <span className="text-rose-300 font-bold">
              Effekt ved {selectedRecRefraction.receptorCode}:{' '}
              {selectedRecRefraction.totalRefrDb >= 0 ? '+' : ''}
              {selectedRecRefraction.totalRefrDb.toFixed(1)} dB
            </span>
          </div>
        </div>

        {/* COLUMN 2 (3 cols): Wind & Temperature Gradient Profile + Støjskærms-effektivitets-meter */}
        <div className="lg:col-span-3 rounded bg-slate-900/95 border border-slate-800 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-bold uppercase text-amber-300">
              2. Vind- &amp; Temp-Gradient (z)
            </span>
            <span className="text-[11px] text-emerald-300 font-semibold">
              Pasquill {currentWeather.pasquillClass}
            </span>
          </div>

          {(() => {
            const levels = [2, 8, 16, 24, 30];
            const u10 = Math.max(0.8, frame.effectiveWindSpeedMs);
            return (
              <svg
                viewBox="0 0 230 156"
                className="w-full h-36 rounded bg-[#070A12] border border-slate-800/90"
                role="img"
                aria-label="Vertikal profil af vindgradient og temperaturgradient"
              >
                <line x1="34" y1="14" x2="34" y2="136" stroke="#475569" strokeWidth="1.2" />
                <line x1="24" y1="136" x2="218" y2="136" stroke="#475569" strokeWidth="1.2" />

                {levels.map((zM) => {
                  const py = 136 - (zM / 30) * 116;
                  const uAtZ = u10 * (Math.log(zM / 0.4) / Math.log(10 / 0.4));
                  const barLen = Math.min(110, Math.max(10, uAtZ * 6.2));
                  return (
                    <g key={`prof-z-${zM}`}>
                      <line
                        x1="34"
                        y1={py}
                        x2="215"
                        y2={py}
                        stroke="#1e293b"
                        strokeDasharray="2 2"
                        strokeWidth="0.8"
                      />
                      <text x="6" y={py + 3} fill="#94a3b8" fontSize="9.5">
                        {zM}m
                      </text>
                      <line
                        x1="36"
                        y1={py}
                        x2={36 + barLen}
                        y2={py}
                        stroke="#38bdf8"
                        strokeWidth="2.2"
                      />
                      <polygon
                        points={`${36 + barLen},${py - 2.5} ${41 + barLen},${py} ${
                          36 + barLen
                        },${py + 2.5}`}
                        fill="#38bdf8"
                      />
                      <text x={44 + barLen} y={py + 2.5} fill="#bae6fd" fontSize="9.5">
                        {uAtZ.toFixed(1)}m/s
                      </text>
                    </g>
                  );
                })}

                <path
                  d={
                    frame.thermalSpec.dTdz >= 0
                      ? 'M 155 134 L 195 22'
                      : 'M 192 134 L 152 22'
                  }
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <text x="135" y="16" fill="#fcd34d" fontSize="9.5" fontWeight="bold">
                  ∂T/∂z={frame.thermalSpec.dTdz >= 0 ? '+' : ''}
                  {frame.thermalSpec.dTdz}°C/m
                </text>
              </svg>
            );
          })()}

          <div className="grid grid-cols-2 gap-1.5 text-[11px] mt-1">
            <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block">Vind-Refraktion:</span>
              <strong className="text-cyan-300">
                +{frame.downwindWindRefractionDb.toFixed(1)} dB (∂u/∂z=+{frame.windGradientDuDz})
              </strong>
            </div>
            <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block">Termisk Bidrag:</span>
              <strong className="text-amber-300">
                {frame.thermalSpec.thermalRefractionDb >= 0 ? '+' : ''}
                {frame.thermalSpec.thermalRefractionDb.toFixed(1)} dB (
                {currentWeather.pasquillClass})
              </strong>
            </div>
          </div>

          {(() => {
            const maxBarrierDb = 6.8;
            const currentLossDb = Math.min(
              maxBarrierDb,
              Math.max(
                0,
                frame.downwindWindRefractionDb * 0.85 +
                  Math.max(0, frame.thermalSpec.thermalRefractionDb) * 0.5
              )
            );
            const effectiveBarrierDb = Math.max(
              0,
              Number((maxBarrierDb - currentLossDb).toFixed(1))
            );
            const effPct = Math.round((effectiveBarrierDb / maxBarrierDb) * 100);
            return (
              <div className="mt-1.5 p-2 rounded bg-slate-950 border border-cyan-500/35 space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-cyan-300 font-bold uppercase">
                    Støjskærms-effektivitets-meter (2,5m Skærm):
                  </span>
                  <span
                    className={
                      effectiveBarrierDb < 3.5
                        ? 'text-rose-300 font-extrabold'
                        : 'text-emerald-300 font-extrabold'
                    }
                  >
                    {effectiveBarrierDb.toFixed(1)} dB / {maxBarrierDb.toFixed(1)} dB maks. (
                    {effPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${
                      effectiveBarrierDb < 3.0
                        ? 'bg-rose-500'
                        : effectiveBarrierDb < 5.0
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${effPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Refraktions-tab over skærm: -{currentLossDb.toFixed(1)} dB</span>
                  <span>Teoretisk maks. skærmeffekt: 6,8 dB</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* COLUMN 3 (3 cols): 24-Hour Refraction Timeline vs. 3.0 dB Threshold */}
        <div className="lg:col-span-3 rounded bg-slate-900/95 border border-slate-800 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-bold uppercase text-rose-300">
              3. 24t Refraktion vs. 3,0 dB Grænse
            </span>
            <span className="text-[11px] text-amber-300 font-bold">
              {hoursExceeding3dBCount}/24t &gt; 3 dB
            </span>
          </div>

          <svg
            viewBox="0 0 240 120"
            className="w-full h-28 rounded bg-[#070A12] border border-slate-800/90"
            role="img"
            aria-label="24-timers medvindsrefraktion i dB mod 3 dB støjforstærknings-risiko grænse"
          >
            {(() => {
              const maxScaleDb = 7.0;
              const y3dB = 104 - (3.0 / maxScaleDb) * 84;
              const playheadX = 8 + refractionLoopProgress * 9.3 + 3.4;
              const playheadY =
                104 -
                Math.min(
                  86,
                  (Math.max(0.2, frame.maxDownwindRefractionDb) / maxScaleDb) * 84
                );
              return (
                <>
                  <line
                    x1="6"
                    y1={y3dB}
                    x2="234"
                    y2={y3dB}
                    stroke="#f43f5e"
                    strokeWidth="1.2"
                    strokeDasharray="3 2"
                  />
                  <text x="10" y={y3dB - 3} fill="#fda4af" fontSize="9.5" fontWeight="bold">
                    ⚠ 3,0 dB Støjforstærknings-grænse
                  </text>

                  {hourlyRefractionSeries.map((item, idx) => {
                    const bx = 8 + idx * 9.3;
                    const posDb = Math.max(0.2, item.totalDownwindDb);
                    const bh = Math.min(86, (posDb / maxScaleDb) * 84);
                    const by = 104 - bh;
                    const isCur = item.hourIndex === currentWeather.hourIndex;
                    const barFill = item.exceeds3dB
                      ? isCur
                        ? '#fde047'
                        : '#f43f5e'
                      : isCur
                      ? '#38bdf8'
                      : '#0284c7';
                    return (
                      <g
                        key={`refr-bar-${item.hourIndex}`}
                        className="cursor-pointer"
                        onClick={() => {
                          setIsPlayingRefractionLoop(false);
                          progressRef.current = item.hourIndex;
                          lastSyncedHourRef.current = item.hourIndex;
                          setRefractionLoopProgress(item.hourIndex);
                          onSelectHour(item.hourIndex);
                        }}
                      >
                        <rect
                          x={bx}
                          y={by}
                          width="6.8"
                          height={bh}
                          rx="1"
                          fill={barFill}
                          stroke={isCur ? '#ffffff' : 'none'}
                          strokeWidth={isCur ? '1' : '0'}
                        />
                        {idx % 6 === 0 && (
                          <text x={bx - 1} y="115" fill="#94a3b8" fontSize="9.5">
                            {item.hourLabel.slice(0, 2)}t
                          </text>
                        )}
                      </g>
                    );
                  })}

                  <g pointerEvents="none">
                    <line
                      x1={playheadX}
                      y1="8"
                      x2={playheadX}
                      y2="105"
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={playheadX}
                      cy={playheadY}
                      r="3.2"
                      fill="#fde047"
                      stroke="#0f172a"
                      strokeWidth="1.2"
                    />
                  </g>
                </>
              );
            })()}
          </svg>

          <div className="px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between gap-2 mt-1">
            <span className="text-slate-300">
              Klik søjle el. afspil 24t loop · Tid:{' '}
              <strong className="text-white">kl. {frame.animTimeLabel}</strong>
            </span>
            <span
              className={`font-extrabold ${
                frame.isNoiseAmplificationRisk ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {frame.isNoiseAmplificationRisk ? '⚠ > 3,0 dB RISIKO' : '● ≤ 3,0 dB OK'}
            </span>
          </div>
        </div>
      </div>

      {/* Receptor-Specific Sound Wave Refraction Cards & Forensic dB Table */}
      <div className="p-2.5 rounded bg-slate-900/95 border border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase text-amber-300">
              Beregnede Akustiske dB-Værdier pr. Receptor (ΔL_refr, {labels.leqKorrLabel} &amp; Impuls-Peak {labels.lmaxLabel} · {unitLabel})
            </span>
            <span className="text-[11px] text-slate-400">
              Kilde: <strong className="text-white">{primaryActiveSource.code}</strong> · Klik på en receptor for at opdatere lydbølgebøjnings-diagrammet
            </span>
          </div>
          <button
            type="button"
            onClick={handleExportAcousticRefractionPdfReport}
            className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Eksportér de beregnede dB-værdier pr. receptor og lydbølgebøjnings-diagrammet som PDF-rapport"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Eksportér Lydbølgebøjnings-Diagram &amp; Receptor dB-Rapport (PDF)</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {receptorRefractions.map((recRef) => {
            const isSelected = recRef.receptorId === selectedReceptorExposure.receptorId;
            const recExceeds3dB = recRef.totalRefrDb > 3.0;
            const refrCtx = {
              windSpeedMs: frame.animWindSpeed10m,
              windGustMs: frame.animWindGusts10m,
            };
            const dispCorrectedEq = convertDb(recRef.correctedLaeqDb, refrCtx);
            const dispPeakMax = convertDb(recRef.impulsePeakLafmaxDb, {
              ...refrCtx,
              isImpulse: true,
            });
            return (
              <button
                key={`ribbon-ac-rec-${recRef.receptorId}`}
                type="button"
                onClick={() => onSelectReceptor(recRef.receptorId)}
                className={`text-left p-1.5 rounded border transition-all cursor-pointer tabular-nums ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-300 text-white'
                    : recExceeds3dB
                    ? 'bg-rose-950/40 border-rose-500/60 hover:border-rose-400 text-slate-200'
                    : 'bg-slate-950/90 border-slate-800 hover:border-slate-600 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                    {recExceeds3dB && (
                      <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
                    )}
                    <span>{recRef.receptorCode}</span>
                  </span>
                  <span
                    className={`text-[11px] font-extrabold ${
                      recExceeds3dB
                        ? 'text-rose-400'
                        : recRef.totalRefrDb > 0
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {recRef.totalRefrDb >= 0 ? '+' : ''}
                    {recRef.totalRefrDb.toFixed(1)} dB
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  {recRef.address.split(',')[0]} ({recRef.distanceMeters}m)
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5 pt-0.5 border-t border-slate-800/80">
                  <span>
                    {labels.leqLabel}: <strong className="text-white">{dispCorrectedEq.toFixed(1)}</strong>{' '}
                    {unitLabel}
                  </span>
                  <span>
                    Peak:{' '}
                    <strong className="text-amber-300">
                      {dispPeakMax.toFixed(0)}
                    </strong>{' '}
                    {unitLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 4 & 5 (MODULAR REPLACEMENTS — ZERO INLINE IIFE): Wind-Noise Sensitivity (> 10 m/s) & Wind-Compensated Impulse Catalog (.DBA) */}
      {(showWindNoiseSensitivityAnalysis || showWindCompensatedImpulseCatalog) && (
        <div className="space-y-2.5 pt-1">
          {showWindNoiseSensitivityAnalysis && (
            <MachineImpulseWindSensitivityWidget
              sources={sources}
              receptors={receptors}
              selectedSourceId={selectedSourceId}
              selectedReceptorId={selectedReceptorExposure.receptorId}
              onSelectSource={onSelectSource}
              onSelectReceptor={onSelectReceptor}
              weatherHours={weatherDataset.hours}
              selectedHourIndex={selectedHourIndex}
              onSelectHour={(hr) => {
                onNotifyTimelineScrub?.();
                setIsPlayingRefractionLoop(false);
                progressRef.current = hr;
                lastSyncedHourRef.current = hr;
                setRefractionLoopProgress(hr);
                onSelectHour(hr);
              }}
              selectedDateIso={weatherDataset.dateIso}
              machineNoiseOutputDb={manualMachineNoiseOutputDb}
              isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
              onChangeMachineNoiseOutputDb={onChangeMachineNoiseOutputDb}
              onTrigger3DImpulseWaves={onTrigger3DImpulseWaves}
              onExportCorrelationJson={onExportMachineWindNoiseJson}
              onLogSensitivityFindingToEvidence={async (s) => {
                await onQuickLogNoiseDustComplaint({
                  point: selectedReceptorExposure.position,
                  locationLabel: `${s.receptorCode}: ${s.receptorName}`,
                  observationType: `Vindstøj-Sensitivitets-Analyse (>10 m/s & Impulsstøj): ${s.machineLabel}`,
                  description: `[VINDSTØJ-SENSITIVITETS-ANALYSE · kl. ${s.hourLabel}] Maskine: ${
                    s.machineLabel
                  } (L_WA = ${manualMachineNoiseOutputDb.toFixed(1)} dB). Vind = ${s.windSpeedMs.toFixed(
                    1
                  )} m/s. Impuls-korrigeret støj ved ${s.receptorCode}: L_Aeq,korr = ${s.laeqKorrDb.toFixed(
                    1
                  )} dB(A) (Grænse ${s.statutoryLimitDb} dB(A), afvigelse ${
                    s.exceedanceDb >= 0 ? '+' : ''
                  }${s.exceedanceDb.toFixed(1)} dB inkl. +5 dB K_I) samt L_AFmax = ${s.lafMaxPeakDb.toFixed(
                    1
                  )} dB(A). Korrelation r = +${s.pearsonR.toFixed(2)} (R² = ${s.rSquared.toFixed(2)}).`,
                });
              }}
            />
          )}

          {showWindCompensatedImpulseCatalog && (
            <WindCompensatedDbaCatalogSection
              sources={sources}
              receptors={receptors}
              weatherDataset={weatherDataset}
              currentWeather={currentWeather}
              selectedHourIndex={selectedHourIndex}
              onSelectHour={(hr) => {
                onNotifyTimelineScrub?.();
                setIsPlayingRefractionLoop(false);
                progressRef.current = hr;
                lastSyncedHourRef.current = hr;
                setRefractionLoopProgress(hr);
                onSelectHour(hr);
              }}
              observations={observations}
              manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
              isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
              onApplyMatchedMachineProfile={({ lwaDb, machineryCategoryKey }) =>
                onApplyMatchedMachineProfile({ lwaDb, machineryCategoryKey })
              }
              onLogDbaCatalogToEvidence={async (p) => {
                await onQuickLogNoiseDustComplaint({
                  point: selectedReceptorExposure.position,
                  locationLabel: `${p.blockLabel} (${p.fileName})`,
                  observationType: `Vind-Kompenseret Impuls-Katalog (DBA vs. Naboklage-Log): ${p.fileName}`,
                  description: `[VIND-KOMPENSERET IMPULS-KATALOG · ${p.fileName} · kl. ${p.hourLabel}] Måleudstyr: ${p.soundMeterModel}. Realtids-simulering (${p.machineLabel}): L_Aeq,sim = ${p.simLaeqDb} dB(A) vs. historisk DBA-fil (vind-kompenseret): L_Aeq,DBA = ${p.dbaWindCompLaeqDb} dB(A) (rå måling ${p.dbaRawUncompensatedDb} dB(A), fratrukket mikrofon-vindstøj -${p.micWindNoiseCompDb} dB(A)) og L_AFmax,DBA = ${p.dbaLafmaxPeakDb} dB(A). Model-overensstemmelse = ${p.concordancePct}% (RMSE = ${p.rmseDb} dB).`,
                });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
