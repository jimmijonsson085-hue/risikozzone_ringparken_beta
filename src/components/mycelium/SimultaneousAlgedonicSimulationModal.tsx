import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Compass,
  Droplets,
  ExternalLink,
  FileCheck2,
  Lock,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { ALGEDONIC_SCENARIO_SPECS } from '../../services/myceliumSimulationEngine';
import {
  AlgedonicTestScenarioId,
  SimultaneousAlgedonicDispatch,
} from '../../types/myceliumAlert';

export interface SimultaneousAlgedonicSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: SimultaneousAlgedonicDispatch;
  manualScenarioOverride: AlgedonicTestScenarioId | null;
  audioMuted: boolean;
  onToggleAudioMuted: () => void;
  onTriggerScenario: (scenarioId: AlgedonicTestScenarioId) => void;
  onAcknowledgeP1: () => void;
  onClearSimulation: () => void;
  onOpenWaterMainLayer?: () => void;
  onOpenSlagelseLegalDashboard?: () => void;
  onFocusEpicenter2D?: () => void;
}

const SCENARIO_LIST: AlgedonicTestScenarioId[] = [
  'kierulffsvej_eternit_rupture',
  'asbestos_plume_cav_vacuum',
  'combined_vibration_rupture_plume',
];

/**
 * Kompakt Split-HUD oven på 2D/3D-viewporten når Algedonisk Simultan-Simulering (S1 + S3) er aktiv.
 * Overholder ANSI/ISA-101 & ISA-18.2 < 5 sekunders læsbarhed med ikon + form + tekst.
 */
export interface SimultaneousAlgedonicSplitHudProps {
  dispatch: SimultaneousAlgedonicDispatch;
  audioMuted: boolean;
  onToggleAudioMuted: () => void;
  onAcknowledgeP1: () => void;
  onOpenSplitModal: () => void;
  onClearSimulation: () => void;
}

export const SimultaneousAlgedonicSplitHud: React.FC<
  SimultaneousAlgedonicSplitHudProps
> = ({
  dispatch,
  audioMuted,
  onToggleAudioMuted,
  onAcknowledgeP1,
  onOpenSplitModal,
  onClearSimulation,
}) => {
  if (!dispatch.active) return null;

  const isBlinking = dispatch.isBlinkingP1;

  return (
    <div
      data-testid="simultaneous-algedonic-split-hud"
      role="alert"
      aria-live="assertive"
      className={`pointer-events-auto rounded-md border-2 bg-[#0B0E17]/95 shadow-2xl font-mono text-[11px] tabular-nums overflow-hidden transition-colors ${
        isBlinking
          ? 'border-rose-500 ring-2 ring-rose-500/60 animate-pulse'
          : 'border-rose-700/90'
      }`}
    >
      {/* Atomic T0 -> T1 Header Strip */}
      <div className="px-2.5 py-1.5 bg-rose-950/90 border-b border-rose-500/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white border border-rose-200 font-extrabold shrink-0">
            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isBlinking ? 'P1 ALGEDONISK NØDBREMSE (UKVITTERET)' : 'P1 ALGEDONISK NØDBREMSE (KVITTERET)'}
            </span>
          </span>
          <span className="text-amber-200 font-bold whitespace-nowrap">
            T0 → T1: {dispatch.latencyMs} ms (Δt = 0 ms bureaukratisk bypass)
          </span>
          <span className="hidden md:inline text-emerald-300 font-semibold whitespace-nowrap">
            Tr: 18,5 t → {dispatch.relaxationTimeAfterHours.toFixed(3)} t (Tr ≪ Δt)
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleAudioMuted}
            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            title={audioMuted ? 'Slå P1-lyd til' : 'Dæmp WebAudio P1-lyd'}
          >
            {audioMuted ? (
              <VolumeX className="w-3 h-3 text-rose-400" />
            ) : (
              <Volume2 className="w-3 h-3 text-emerald-400" />
            )}
          </button>
          {!dispatch.acknowledged && (
            <button
              type="button"
              data-testid="hud-acknowledge-p1-btn"
              onClick={onAcknowledgeP1}
              className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold inline-flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Kvittér P1 (ISA-18.2)</span>
            </button>
          )}
          <button
            type="button"
            data-testid="hud-open-split-modal-btn"
            onClick={onOpenSplitModal}
            className="px-2 py-0.5 rounded bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/70 text-cyan-100 font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Split-Skærm (S1 + S3)</span>
          </button>
          <button
            type="button"
            onClick={onClearSimulation}
            className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Afslut simulering / nulstil manuelt scenarie"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Side-by-Side System 1 + System 3 < 5s Action Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* SYSTEM 1 */}
        <div className="p-2 bg-rose-950/35 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-rose-200 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>SYSTEM 1 · BEBOERE &amp; ARBEJDERE (&lt; 5 SEK.)</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold">
              MODVIND {dispatch.system1State.upwindEscapeBearingDeg}° · Ø-DRIFT ({dispatch.system1State.islandModeBlockIds.length})
            </span>
          </div>
          <div className="text-white font-semibold leading-snug">
            {dispatch.system1State.workerOrderDa}
          </div>
          <div className="text-amber-200 leading-snug">
            Beboere (Island Mode): {dispatch.system1State.residentOrdersDa.join(' ')}
          </div>
        </div>

        {/* SYSTEM 3 */}
        <div className="p-2 bg-slate-950/85 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-cyan-200 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>SYSTEM 3 · BEREDSKAB, SK VAND &amp; TILSYN (T1 ATOMAR)</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-rose-900/70 border border-rose-400/60 text-rose-100 font-bold">
              {dispatch.system3State.lockedValveCodes.join(' + ')} LUKKET
            </span>
          </div>
          <div className="text-slate-100 leading-snug">
            <strong className="text-cyan-300">PSS W22085 Stop:</strong>{' '}
            {dispatch.system3State.haltedMachines.map((m) => m.nameDa.split('(')[0].trim()).join(', ')} ·{' '}
            <strong className="text-emerald-300">CAV → H14-HEPA Overtryk (+10 Pa)</strong>
          </div>
          <div className="text-slate-300 leading-snug">
            Indrykning: Valbyvej &amp; Rosenkildevej ÅBEN (Ndr. Ringgade LUKKET) · SHA-256:{' '}
            <strong className="text-amber-300">
              {dispatch.system3State.linkedSha256ObservationCode || 'AUTO-SIGNERET'}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Dedikeret Split-Screen Sammenligningsmodal for Algedonisk Simultan-Simulering (System 1 + System 3).
 */
export const SimultaneousAlgedonicSimulationModal: React.FC<
  SimultaneousAlgedonicSimulationModalProps
> = ({
  isOpen,
  onClose,
  dispatch,
  manualScenarioOverride,
  audioMuted,
  onToggleAudioMuted,
  onTriggerScenario,
  onAcknowledgeP1,
  onClearSimulation,
  onOpenWaterMainLayer,
  onOpenSlagelseLegalDashboard,
  onFocusEpicenter2D,
}) => {
  const [selectedNoticeIdx, setSelectedNoticeIdx] = useState<number>(0);

  if (!isOpen) return null;

  const activeNotice =
    dispatch.system3State.statutoryNotices[selectedNoticeIdx] ||
    dispatch.system3State.statutoryNotices[0];

  return (
    <div
      data-testid="simultaneous-algedonic-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Algedonisk Simultan-Simulering (System 1 + System 3)"
      className="fixed inset-0 z-[140] bg-black/75 flex items-center justify-center p-2 sm:p-4 font-sans"
    >
      <div
        className={`w-full max-w-[1320px] max-h-[94vh] flex flex-col rounded-lg bg-[#0B0E17] border-2 shadow-2xl overflow-hidden ${
          dispatch.isBlinkingP1
            ? 'border-rose-500 ring-2 ring-rose-500/50'
            : dispatch.active
            ? 'border-rose-700'
            : 'border-cyan-500/60'
        }`}
      >
        {/* TOP MODAL HEADER: ISA-18.2 Status + T0->T1 Synchronized Timeline */}
        <div className="px-4 py-3 bg-[#111827] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center border shrink-0 ${
                dispatch.isBlinkingP1
                  ? 'bg-rose-600 border-rose-200 text-white animate-pulse'
                  : dispatch.active
                  ? 'bg-rose-900 border-rose-400 text-rose-100'
                  : 'bg-[#151C28] border-cyan-500/50 text-cyan-400'
              }`}
            >
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  Algedonisk Simultan-Simulering (System 1 + System 3)
                </h2>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-extrabold border ${
                    dispatch.isBlinkingP1
                      ? 'bg-rose-600 text-white border-rose-200 animate-pulse'
                      : dispatch.active
                      ? 'bg-rose-900/90 text-rose-100 border-rose-400'
                      : 'bg-[#151C28] text-cyan-300 border-cyan-500/45'
                  }`}
                >
                  {dispatch.isBlinkingP1
                    ? 'P1 AKUT (UKVITTERET)'
                    : dispatch.active
                    ? 'P1 KVITTERET (SOLID RØD)'
                    : 'NORMALISERET · STÅL-CYAN STANDBY'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono truncate">
                {dispatch.scenarioTitleDa} · Stafford Beer VSM System B + ANSI/ISA-101 &amp; ISA-18.2
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 font-mono text-[11px]">
            <button
              type="button"
              onClick={onToggleAudioMuted}
              className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              {audioMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span>WebAudio Dæmpet</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WebAudio 528→660 Hz Aktiv</span>
                </>
              )}
            </button>

            {dispatch.active && !dispatch.acknowledged && (
              <button
                type="button"
                data-testid="modal-acknowledge-p1-btn"
                onClick={onAcknowledgeP1}
                className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Kvittér P1 Alarm</span>
              </button>
            )}

            {manualScenarioOverride !== null && (
              <button
                type="button"
                onClick={onClearSimulation}
                className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-amber-500/50 text-amber-200 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nulstil Test</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Luk</span>
            </button>
          </div>
        </div>

        {/* SCENARIO SELECTOR BAR + SYNCHRONIZED T0 -> T1 TIMELINE + GATE 1 BFT */}
        <div className="px-4 py-2.5 bg-[#0F172A] border-b border-slate-800 space-y-2.5">
          {/* 3 Test Scenarios */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono font-bold uppercase text-cyan-300 mr-1">
                Vælg Testscenarie:
              </span>
              {SCENARIO_LIST.map((scId) => {
                const spec = ALGEDONIC_SCENARIO_SPECS[scId];
                const isSelected = manualScenarioOverride === scId;
                return (
                  <button
                    key={scId}
                    type="button"
                    data-testid={`algedonic-scenario-btn-${scId}`}
                    onClick={() => onTriggerScenario(scId)}
                    className={`px-2.5 py-1 rounded border font-mono text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-200 shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-cyan-400/60'
                    }`}
                    title={spec.subtitleDa}
                  >
                    <Zap
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-amber-200' : 'text-amber-400'
                      }`}
                    />
                    <span>{spec.shortTitleDa}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              {onFocusEpicenter2D && (
                <button
                  type="button"
                  onClick={() => {
                    onFocusEpicenter2D();
                    onClose();
                  }}
                  className="px-2 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 font-semibold cursor-pointer"
                >
                  Vis på 2D/3D Kort
                </button>
              )}
              {onOpenWaterMainLayer && (
                <button
                  type="button"
                  onClick={onOpenWaterMainLayer}
                  className="px-2 py-1 rounded bg-sky-950/70 hover:bg-sky-900 border border-sky-500/50 text-sky-200 font-semibold cursor-pointer"
                >
                  Aktivér DN200 Rørlag
                </button>
              )}
            </div>
          </div>

          {/* Synchronized Millisecond Timeline T0 -> T1 & Relaxation Compression Tr */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 font-mono text-[11px] tabular-nums">
            <div className="p-2 rounded bg-[#090D16] border border-slate-800">
              <div className="text-slate-400 uppercase">T0 Detektion → T1 Simultan Spaltning</div>
              <div className="text-xs font-extrabold text-amber-300 mt-0.5">
                T1 Simultan Spaltning (Δt = 0 ms)
              </div>
              <div className="text-slate-300">
                Elektronisk latenstid: <strong className="text-emerald-300">{dispatch.latencyMs} ms</strong> (0 ms bureaukrati)
              </div>
            </div>

            <div className="p-2 rounded bg-[#090D16] border border-emerald-500/40">
              <div className="text-slate-400 uppercase">Afslapningstid Tr (Systemisk Tetanus)</div>
              <div className="text-xs font-extrabold text-emerald-300 mt-0.5">
                Tr: 18,5 t → {dispatch.relaxationTimeAfterHours.toFixed(3)} t (&lt; 0,01 t)
              </div>
              <div className="text-slate-300">
                <strong className="text-emerald-300">
                  Eliminerer Systemisk Tetanus (Tr &gt; Δt) · Tr ≪ {dispatch.crisisIntervalDtHours} t
                </strong>
              </div>
            </div>

            <div className="p-2 rounded bg-[#090D16] border border-cyan-500/40">
              <div className="text-slate-400 uppercase">System 2 Gate 1 Nabotest (BFT)</div>
              <div className="text-xs font-extrabold text-cyan-300 mt-0.5">
                {dispatch.gate1Validation.corroboratingNodes}/{dispatch.gate1Validation.totalNodes} Noder ({dispatch.gate1Validation.corroborationPct}% · {dispatch.gate1Validation.byzantineFaultToleranceFormula})
              </div>
              <div className="text-slate-300 truncate" title={dispatch.gate1Validation.zkpRightToOpacityHash}>
                ZKP Right-to-Opacity: {dispatch.gate1Validation.zkpRightToOpacityHash.slice(0, 14)}…
              </div>
            </div>

            <div className="p-2 rounded bg-[#090D16] border border-rose-500/40">
              <div className="text-slate-400 uppercase">Aktive T0 Grænseoverskridelser</div>
              <div className="text-xs font-extrabold text-rose-300 mt-0.5">
                {dispatch.triggers.triggerCount} af 4 Kritiske Betingelser
              </div>
              <div className="text-slate-300 truncate">
                S_out {dispatch.triggers.outdoorSumQuotientValue.toFixed(2)} · S_in{' '}
                {dispatch.triggers.indoorSumQuotientValue.toFixed(2)} · {dispatch.triggers.waterMainPressureBar.toFixed(2)} bar
              </div>
            </div>
          </div>

          {dispatch.triggers.activeTriggerReasonsDa.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              {dispatch.triggers.activeTriggerReasonsDa.map((reason, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-100 font-semibold inline-flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
                  <span>{reason}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* SPLIT-SCREEN COMPARISON: LEFT = SYSTEM 1 | RIGHT = SYSTEM 3 */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 xl:grid-cols-2 gap-4 bg-[#070A12]">
          {/* LEFT PANEL: SYSTEM 1 (RESIDENTS & WORKERS < 5s) */}
          <section
            data-testid="split-modal-system1-panel"
            className={`rounded-lg border-2 p-3.5 space-y-3 bg-[#10141F] ${
              dispatch.isBlinkingP1
                ? 'border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.22)]'
                : 'border-rose-700/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[11px] font-extrabold">
                  SYSTEM 1
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Beboere &amp; Arbejdere — Akut Lokal Sikkerhed (&lt; 5 sek.)
                  </h3>
                  <div className="text-[11px] font-mono text-rose-300">
                    Epicenter: {dispatch.system1State.epicenterLabelDa} · Farezone R ={' '}
                    {dispatch.system1State.dangerRadiusMeters} m
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-rose-500/60 font-mono text-[11px] font-bold text-rose-200">
                T1: {dispatch.t1DispatchedIso.slice(11, 23)} UTC
              </span>
            </div>

            {/* Worker Direct Evacuation Order */}
            <div className="p-3 rounded-md bg-rose-950/75 border border-rose-500/80 space-y-1.5">
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-amber-200 font-bold uppercase">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
                  <span>Instruks til Arbejdere på Pladsen (ISA-101 P1)</span>
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-950 border border-amber-400/50 text-amber-200">
                  <Compass className="w-3 h-3" />
                  <span>Modvind {dispatch.system1State.upwindEscapeBearingDeg}°</span>
                </span>
              </div>
              <p className="text-xs font-mono font-bold text-white leading-relaxed">
                {dispatch.system1State.workerOrderDa}
              </p>
              <div className="text-[11px] font-mono text-rose-200">
                Aktuel støvfane-retning: <strong>{dispatch.system1State.plumeDirectionDeg}°</strong> → Flugtvektorer peger automatisk i{' '}
                <strong className="text-emerald-300">{dispatch.system1State.upwindEscapeBearingDeg}° (modvind / opbakke)</strong> væk fra 2 m rørgravskant.
              </div>
            </div>

            {/* Dynamic Escape Vectors to Valbyvej & Rosenkildevej */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono font-bold uppercase text-cyan-300 flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Dynamiske Flugtveje (Modvind &amp; Højere Terræn)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dispatch.system1State.escapeVectors.map((vec) => (
                  <div
                    key={vec.id}
                    className="p-2 rounded bg-[#090D16] border border-emerald-500/45 font-mono text-[11px] space-y-0.5"
                  >
                    <div className="font-bold text-emerald-300">{vec.streetName} Samlingspunkt</div>
                    <div className="text-slate-200">{vec.labelDa}</div>
                    <div className="text-slate-400 tabular-nums">
                      Kurs: <strong className="text-white">{vec.bearingDeg}°</strong> · Afstand:{' '}
                      <strong className="text-white">{vec.distanceMeters} m</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resident Island Mode Orders */}
            <div className="p-3 rounded-md bg-[#090D16] border border-amber-500/60 space-y-2">
              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="font-bold text-amber-300 uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Instruks til Beboere (Ringparken Island Mode / Ø-Drift)</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                  {dispatch.system1State.islandModeBlockIds.length} Blokke Beskyttet
                </span>
              </div>
              <ul className="space-y-1 text-xs font-mono text-white">
                {dispatch.system1State.residentOrdersDa.map((step, i) => (
                  <li
                    key={i}
                    className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1 pt-1">
                {dispatch.system1State.islandModeBlockLabels.map((lbl, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/50 font-mono text-[11px] text-emerald-200"
                  >
                    Ø-Drift: {lbl}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT PANEL: SYSTEM 3 (EMERGENCY, SK VAND, PSS W22085 & AUTHORITIES) */}
          <section
            data-testid="split-modal-system3-panel"
            className="rounded-lg border-2 border-cyan-500/65 p-3.5 space-y-3 bg-[#0E1525]"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-mono text-[11px] font-extrabold">
                  SYSTEM 3
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Beredskab, SK Vand / Envafors &amp; Myndighedstilsyn
                  </h3>
                  <div className="text-[11px] font-mono text-cyan-300">
                    Simultan Nødbremsning &amp; Lovpligtig Straksanmeldelse
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/60 font-mono text-[11px] font-bold text-cyan-200">
                T1: {dispatch.t1DispatchedIso.slice(11, 23)} UTC
              </span>
            </div>

            {/* SK Vand A/S Valve Sectioning */}
            <div className="p-3 rounded-md bg-sky-950/50 border border-sky-400/60 space-y-1.5">
              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="font-bold text-sky-200 uppercase flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>SK Vand A/S / Envafors Sektionering (Uden Varsel)</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-extrabold">
                  V-VEST + V-MIDT LUKKET
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-200 leading-relaxed">
                {dispatch.system3State.sectioningStatuteDa}
              </p>
              <div className="text-[11px] font-mono text-emerald-300 font-bold">
                Forhindret vandtab: {dispatch.system3State.waterLossPreventedM3} m³ · Tilbagesugningsstop DS/EN 1717 aktivt.
              </div>
            </div>

            {/* Wissenberg PSS W22085 Machine Lockout & CAV Switch */}
            <div className="p-3 rounded-md bg-[#090D16] border border-amber-500/50 space-y-2">
              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="font-bold text-amber-300 uppercase flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Wissenberg PSS W22085 Lockout &amp; CAV-Skift</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-400/60 text-emerald-200 font-bold">
                  H14-HEPA OVERTRYK (+10 Pa)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1 font-mono text-[11px]">
                {dispatch.system3State.haltedMachines.map((m) => (
                  <div
                    key={m.id}
                    className="px-2 py-1 rounded bg-slate-900 border border-rose-500/40 flex items-center justify-between gap-2"
                  >
                    <span className="text-white font-semibold">{m.nameDa}</span>
                    <span className="text-rose-300 font-bold shrink-0">STOPPET ({m.status})</span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] font-mono text-emerald-200">
                Ventilations-Interlock: Automatisk tvangsskift fra{' '}
                <span className="text-amber-200">{dispatch.system3State.cavPreviousModeLabelDa}</span> →{' '}
                <strong className="text-emerald-300">Balanceret H14-HEPA Overtryk (+10 Pa)</strong>.
              </div>
            </div>

            {/* CiK 2.0 Tanker Ingress Corridors */}
            <div className="p-2.5 rounded-md bg-[#090D16] border border-cyan-500/45 space-y-1.5 font-mono text-[11px]">
              <div className="font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span>Nød-vandforstøvning &amp; Beredskab ad Valbyvej / Rosenkildevej</span>
              </div>
              {dispatch.system3State.tankerIngressCorridors.map((corr) => (
                <div
                  key={corr.id}
                  className={`px-2 py-1 rounded border flex items-center justify-between gap-2 ${
                    corr.status === 'OPEN_INGRESS'
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100'
                      : 'bg-rose-950/60 border-rose-500/70 text-rose-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold">{corr.streetName}</div>
                    <div className="text-[11px] opacity-90">{corr.noteDa}</div>
                  </div>
                  <span className="font-extrabold shrink-0">
                    {corr.status === 'OPEN_INGRESS' ? 'FRI VEJ' : 'LUKKET'}
                  </span>
                </div>
              ))}
            </div>

            {/* Statutory Filings & SHA-256 Chain-of-Custody */}
            <div className="p-3 rounded-md bg-[#090D16] border border-indigo-400/50 space-y-2 font-mono text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-indigo-200 uppercase flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-indigo-300 shrink-0" />
                  <span>Automatisk Myndighedsanmeldelse &amp; SHA-256 Bevis</span>
                </span>
                {onOpenSlagelseLegalDashboard && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSlagelseLegalDashboard();
                      onClose();
                    }}
                    className="px-2 py-0.5 rounded bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400 text-indigo-100 font-bold cursor-pointer"
                  >
                    Åbn Slagelse Dashboard
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {dispatch.system3State.statutoryNotices.map((nt, idx) => (
                  <button
                    key={nt.id}
                    type="button"
                    onClick={() => setSelectedNoticeIdx(idx)}
                    className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                      selectedNoticeIdx === idx
                        ? 'bg-indigo-500 text-white border-indigo-200 font-bold'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    {nt.statuteRef}
                  </button>
                ))}
              </div>

              {activeNotice && (
                <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-amber-200 font-bold">
                    <span>{activeNotice.authorityDa}</span>
                    <span>{activeNotice.deadlineDa}</span>
                  </div>
                  <div className="text-white font-bold">{activeNotice.titleDa}</div>
                  <div className="text-slate-300 leading-relaxed">{activeNotice.summaryDa}</div>
                </div>
              )}

              <div className="px-2 py-1.5 rounded bg-emerald-950/60 border border-emerald-500/50 flex flex-wrap items-center justify-between gap-2 text-emerald-200">
                <span className="flex items-center gap-1.5 font-bold">
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Chain-of-Custody Log:{' '}
                    {dispatch.system3State.linkedSha256ObservationCode || 'Afventer signering'}
                  </span>
                </span>
                <span className="text-[11px] truncate max-w-[260px]">
                  SHA-256:{' '}
                  {dispatch.system3State.linkedSha256Signature
                    ? `${dispatch.system3State.linkedSha256Signature.slice(0, 18)}…`
                    : 'Auto-logges ved T1'}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
