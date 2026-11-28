/**
 * @file src/components/RollingDustHazardAlertBanner.tsx
 * @description Højprioritets visuel og akustisk browser-advarsel samt monitor-kontrolkort
 * for 1-times rullende gennemsnit af respirabel støvkoncentration (µg/m³) mod projektets
 * sikkerhedsplan (PSS Sag W22085 / BEK 613/2026: 100,0 µg/m³).
 */

import React from 'react';
import {
  AlertOctagon,
  Bell,
  BellRing,
  CheckCircle2,
  FlaskConical,
  ShieldAlert,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import {
  BrowserNotificationPermissionState,
  Rolling1hDustEvaluation,
} from '../services/rollingDustHazardAlertService';

export interface RollingDustHazardAlertBannerProps {
  evaluation: Rolling1hDustEvaluation;
  isDismissed: boolean;
  isAudioMuted: boolean;
  notificationPermission: BrowserNotificationPermissionState;
  lastChimeTimestamp: string | null;
  onToggleAudioMuted: () => void;
  onRequestBrowserNotificationPermission: () => void;
  onPlayAlarmTest: () => void;
  onDismiss: () => void;
  onFocusNoiseDustAndReceptor: (receptorId: string) => void;
}

export const RollingDustHazardAlertBanner: React.FC<RollingDustHazardAlertBannerProps> = ({
  evaluation,
  isDismissed,
  isAudioMuted,
  notificationPermission,
  lastChimeTimestamp,
  onToggleAudioMuted,
  onRequestBrowserNotificationPermission,
  onPlayAlarmTest,
  onDismiss,
  onFocusNoiseDustAndReceptor,
}) => {
  if (!evaluation.isThresholdExceeded || isDismissed) {
    return null;
  }

  const pctOfLimit = Math.round(evaluation.exceedanceRatio * 100);
  const maxSlotUg = Math.max(
    evaluation.thresholdUgM3 * 1.15,
    ...evaluation.subSlots.map((s) => s.respirableDustUgM3)
  );

  return (
    <aside
      role="alert"
      aria-live="assertive"
      data-testid="rolling-1h-dust-hazard-banner"
      className="fixed top-20 left-4 z-[96] w-[420px] max-w-[calc(100vw-2rem)] rounded-lg bg-[#1A1016]/95 border border-rose-500/85 shadow-2xl backdrop-blur-md p-3.5 space-y-2.5 font-mono text-xs text-slate-100 pointer-events-auto"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-300 truncate">
              Højprioritets Støvalarm · 1-Times Rullende Gns.
            </div>
            <div className="text-[11px] text-slate-300 font-sans truncate">
              {evaluation.worstReceptor.receptorCode} ({evaluation.worstReceptor.receptorName}) · kl.{' '}
              {evaluation.hourLabel}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Kvittér 1-times støvalarm"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
          title="Kvittér denne browser-advarsel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Primary KPI row */}
      <div className="grid grid-cols-3 gap-2 tabular-nums">
        <div className="rounded bg-[#0B0F19]/90 border border-rose-500/50 px-2 py-1.5">
          <div className="text-[10px] uppercase text-slate-400">1t Rullende Gns.</div>
          <div className="text-sm font-extrabold text-rose-300">
            {evaluation.rolling1hAverageUgM3.toFixed(1)} µg/m³
          </div>
        </div>
        <div className="rounded bg-[#0B0F19]/90 border border-[#334155] px-2 py-1.5">
          <div className="text-[10px] uppercase text-slate-400">PSS-Grænse</div>
          <div className="text-sm font-bold text-slate-200">
            {evaluation.thresholdUgM3.toFixed(0)} µg/m³
          </div>
        </div>
        <div className="rounded bg-[#0B0F19]/90 border border-amber-500/50 px-2 py-1.5">
          <div className="text-[10px] uppercase text-slate-400">Overskridelse</div>
          <div className="text-sm font-extrabold text-amber-300">
            +{evaluation.exceedanceUgM3.toFixed(1)} ({pctOfLimit}%)
          </div>
        </div>
      </div>

      {/* 6 x 10-minute rolling bars */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>6 × 10-min. rullende støj-/støvindeks (µg/m³)</span>
          <span>Spids: {evaluation.peakInstantUgM3.toFixed(1)} µg/m³</span>
        </div>
        <div className="grid grid-cols-6 gap-1 items-end h-9 pt-1 px-1.5 pb-1 rounded bg-[#0B0F19]/80 border border-[#2D3B50]">
          {evaluation.subSlots.map((slot) => {
            const hPct = Math.max(
              14,
              Math.min(100, Math.round((slot.respirableDustUgM3 / maxSlotUg) * 100))
            );
            const isOver = slot.respirableDustUgM3 > evaluation.thresholdUgM3;
            return (
              <div
                key={slot.offsetMinutesLabel}
                className="flex flex-col items-center justify-end h-full gap-0.5"
                title={`${slot.offsetMinutesLabel}: ${slot.respirableDustUgM3.toFixed(
                  1
                )} µg/m³ (vindstød ${slot.windGustMs.toFixed(1)} m/s)`}
              >
                <div
                  className={`w-full rounded-xs ${
                    isOver ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{ height: `${hPct}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] font-sans text-rose-100/95 bg-[#0B0F19]/75 border border-rose-500/40 rounded px-2.5 py-1.5 leading-snug">
        <strong className="text-amber-300">Sikkerhedsplan (PSS Sag W22085):</strong>{' '}
        {evaluation.mitigationGuidanceDa}
      </p>

      {/* Interactive Controls */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleAudioMuted}
            className={`px-2 py-1 rounded border font-semibold inline-flex items-center gap-1 cursor-pointer ${
              isAudioMuted
                ? 'bg-slate-900 border-slate-700 text-slate-300'
                : 'bg-rose-500/20 border-rose-400/70 text-rose-200'
            }`}
            title={isAudioMuted ? 'Slå lydalarm til' : 'Dæmp lydalarm'}
          >
            {isAudioMuted ? (
              <VolumeX className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{isAudioMuted ? 'Lyd: Dæmpet' : 'Lyd: Aktiv'}</span>
          </button>

          <button
            type="button"
            onClick={onPlayAlarmTest}
            className="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold inline-flex items-center gap-1 cursor-pointer"
            title="Afspil akustisk 3-tonet sikkerhedsalarm nu"
          >
            <BellRing className="w-3.5 h-3.5 shrink-0" />
            <span>Alarmlyd</span>
          </button>

          {notificationPermission !== 'granted' &&
            notificationPermission !== 'unsupported' && (
              <button
                type="button"
                onClick={onRequestBrowserNotificationPermission}
                className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                title="Giv tilladelse til browserens native system-notifikationer ved overskridelse"
              >
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span>Browser-Notif.</span>
              </button>
            )}
        </div>

        <button
          type="button"
          onClick={() => onFocusNoiseDustAndReceptor(evaluation.worstReceptor.receptorId)}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-semibold cursor-pointer"
        >
          Inspicér Receptor →
        </button>
      </div>

      {lastChimeTimestamp && (
        <div className="text-[10px] text-slate-400">
          Seneste akustiske advarsel afspillet kl. {lastChimeTimestamp}
        </div>
      )}
    </aside>
  );
};

export interface RollingDust1hMonitorCardProps {
  evaluation: Rolling1hDustEvaluation;
  isAudioMuted: boolean;
  isSimulatedExceedanceActive: boolean;
  notificationPermission: BrowserNotificationPermissionState;
  lastChimeTimestamp: string | null;
  onToggleAudioMuted: () => void;
  onToggleSimulatedExceedance: () => void;
  onRequestBrowserNotificationPermission: () => void;
  onPlayAlarmTest: () => void;
  onSelectReceptor: (receptorId: string) => void;
}

export const RollingDust1hMonitorCard: React.FC<RollingDust1hMonitorCardProps> = ({
  evaluation,
  isAudioMuted,
  isSimulatedExceedanceActive,
  notificationPermission,
  lastChimeTimestamp,
  onToggleAudioMuted,
  onToggleSimulatedExceedance,
  onRequestBrowserNotificationPermission,
  onPlayAlarmTest,
  onSelectReceptor,
}) => {
  const maxSlotUg = Math.max(
    evaluation.thresholdUgM3 * 1.15,
    ...evaluation.subSlots.map((s) => s.respirableDustUgM3)
  );
  const progressPct = Math.min(
    100,
    Math.round((evaluation.rolling1hAverageUgM3 / evaluation.thresholdUgM3) * 100)
  );

  return (
    <section
      data-testid="rolling-1h-dust-monitor-card"
      className={`p-3 rounded-lg border space-y-2.5 font-mono text-xs tabular-nums ${
        evaluation.isThresholdExceeded
          ? 'bg-rose-950/35 border-rose-500/75 text-rose-100'
          : evaluation.isWarningElevated
          ? 'bg-amber-950/30 border-amber-500/60 text-amber-100'
          : 'bg-[#0F172A] border-[#2D3B50] text-slate-100'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-slate-100">
            {evaluation.isThresholdExceeded ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <span>1-Times Rullende Respirabel Støv-Overvågning</span>
          </div>
          <p className="text-[11px] font-sans text-slate-300">
            {evaluation.safetyPlanReference}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-[11px]">
          <button
            type="button"
            onClick={onToggleAudioMuted}
            className={`px-2 py-1 rounded border font-semibold inline-flex items-center gap-1 cursor-pointer ${
              isAudioMuted
                ? 'bg-slate-900 border-slate-700 text-slate-300'
                : 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
            }`}
          >
            {isAudioMuted ? (
              <VolumeX className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{isAudioMuted ? 'Alarm: Dæmpet' : 'Alarm: Til'}</span>
          </button>

          <button
            type="button"
            data-testid="test-rolling-1h-dust-alarm-sound-btn"
            onClick={onPlayAlarmTest}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Test Alarmlyd</span>
          </button>

          <button
            type="button"
            data-testid="simulate-rolling-1h-dust-alert-btn"
            onClick={onToggleSimulatedExceedance}
            className={`px-2 py-1 rounded border font-bold inline-flex items-center gap-1 cursor-pointer ${
              isSimulatedExceedanceActive
                ? 'bg-rose-600 hover:bg-rose-500 border-rose-300 text-white'
                : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/60 text-amber-200'
            }`}
            title="Simulér tør betonknusning der overskrider 100 µg/m³ i 1-times rullende gennemsnit"
          >
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isSimulatedExceedanceActive ? 'Stop Støv-Sim.' : 'Simulér 1t Støv-Alarm'}
            </span>
          </button>
        </div>
      </div>

      {/* KPI & Threshold Bar */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800">
          <div className="text-slate-400">1t Rullende Gns.</div>
          <div
            data-testid="rolling-1h-dust-avg-readout"
            className={`text-sm font-extrabold mt-0.5 ${
              evaluation.isThresholdExceeded
                ? 'text-rose-300'
                : evaluation.isWarningElevated
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {evaluation.rolling1hAverageUgM3.toFixed(1)} µg/m³
          </div>
        </div>
        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800">
          <div className="text-slate-400">Grænseværdi (PSS)</div>
          <div className="text-sm font-bold text-slate-200 mt-0.5">
            {evaluation.thresholdUgM3.toFixed(1)} µg/m³
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectReceptor(evaluation.worstReceptor.receptorId)}
          className="p-2 rounded bg-[#0B0E17] hover:bg-slate-900 border border-slate-800 text-left cursor-pointer transition-colors"
        >
          <div className="text-slate-400">Mest Udsat Receptor</div>
          <div className="text-sm font-bold text-cyan-300 mt-0.5 truncate">
            {evaluation.worstReceptor.receptorCode} ({progressPct}%)
          </div>
        </button>
      </div>

      {/* 6 x 10m Sub-Slots Strip */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>6 × 10-min. vindue mod kl. {evaluation.hourLabel}</span>
          <span>
            {evaluation.isThresholdExceeded
              ? `OVER GRÆNSE (+${evaluation.exceedanceUgM3.toFixed(1)} µg/m³)`
              : `Inden for sikkerhedsplan (${progressPct}% af grænse)`}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1.5 items-end h-10 pt-1 px-2 pb-1 rounded bg-[#0B0E17] border border-slate-800">
          {evaluation.subSlots.map((slot) => {
            const hPct = Math.max(
              14,
              Math.min(100, Math.round((slot.respirableDustUgM3 / maxSlotUg) * 100))
            );
            const isOver = slot.respirableDustUgM3 > evaluation.thresholdUgM3;
            return (
              <div
                key={slot.offsetMinutesLabel}
                className="flex flex-col items-center justify-end h-full gap-0.5"
                title={`${slot.offsetMinutesLabel}: ${slot.respirableDustUgM3.toFixed(
                  1
                )} µg/m³`}
              >
                <div
                  className={`w-full rounded-xs ${
                    isOver ? 'bg-rose-500' : evaluation.isWarningElevated ? 'bg-amber-400' : 'bg-cyan-400'
                  }`}
                  style={{ height: `${hPct}%` }}
                />
                <span className="text-[9px] text-slate-400 leading-none">
                  {slot.offsetMinutesLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Browser Notification Opt-In & Status Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-0.5">
        <span className="inline-flex items-center gap-1.5 text-slate-300 font-sans">
          {notificationPermission === 'granted' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Browser-notifikationer aktiveret</span>
            </>
          ) : notificationPermission === 'denied' ? (
            <span className="text-amber-300">
              Browser-notifikationer blokeret i browserindstillinger (visuel + lydalarm aktiv)
            </span>
          ) : notificationPermission === 'unsupported' ? (
            <span className="text-slate-400">
              In-app visuel &amp; akustisk advarsel aktiv
            </span>
          ) : (
            <button
              type="button"
              onClick={onRequestBrowserNotificationPermission}
              className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-200 font-mono font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Bell className="w-3 h-3 shrink-0" />
              <span>Aktivér Browser-Notifikationer</span>
            </button>
          )}
        </span>

        {lastChimeTimestamp && (
          <span className="text-[10px] text-slate-400">
            Seneste alarm: kl. {lastChimeTimestamp}
          </span>
        )}
      </div>
    </section>
  );
};
