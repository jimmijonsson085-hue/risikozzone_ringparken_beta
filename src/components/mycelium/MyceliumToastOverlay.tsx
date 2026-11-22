/**
 * @file src/components/mycelium/MyceliumToastOverlay.tsx
 * @description Ikke-blokerende taktisk live-toast overlay til højre kant af kortet/visningen
 * (`pointer-events-none` container med `pointer-events-auto` kort). Viser op til 3 samtidige
 * Gate 1-verificerede Mycelie-alarmer med alvorlighedsfarve, Groth16 ZKP-stempel, fysiske
 * måleværdier (`S`, `fibre/cm³`, `m/s`), CiK 2.0 sværm-support (`J`, `kg`, `m³/h`),
 * hover-pause af 8s auto-dismiss, "Fokusér Receptor"-knap og fuld understøttelse af
 * normal visning, Fuld Skærm og Kun Kort-tilstand.
 */

import React from 'react';
import {
  AlertTriangle,
  Crosshair,
  Droplets,
  ShieldCheck,
  Sparkles,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  MyceliumLiveNotification,
  MyceliumLiveNotificationSeverity,
} from '../../types/myceliumAlert';

export interface MyceliumToastOverlayProps {
  visibleToasts: MyceliumLiveNotification[];
  isLiveEnabled: boolean;
  channelBadgeLabelDa?: string;
  isFullscreen?: boolean;
  isMapOnly?: boolean;
  onFocusReceptor: (nodeId: string) => void;
  onDismissToast: (id: string) => void;
  onHoverToastChange?: (hoveredId: string | null) => void;
}

function getSeverityStyles(severity: MyceliumLiveNotificationSeverity): {
  borderClass: string;
  headerBgClass: string;
  severityLabelDa: string;
  accentTextClass: string;
} {
  if (severity === 'CRITICAL_P1') {
    return {
      borderClass: 'border-rose-500/85 bg-[#0B0E17]/95 shadow-rose-950/50',
      headerBgClass: 'bg-rose-950/75 border-b border-rose-500/40 text-rose-100',
      severityLabelDa: 'P1 AKUT ALGEDONISK',
      accentTextClass: 'text-rose-300',
    };
  }
  if (severity === 'ELEVATED_ORANGE') {
    return {
      borderClass: 'border-amber-400/80 bg-[#0B0E17]/95 shadow-amber-950/40',
      headerBgClass: 'bg-amber-950/70 border-b border-amber-500/40 text-amber-100',
      severityLabelDa: 'ORANGE FORVARSEL',
      accentTextClass: 'text-amber-300',
    };
  }
  return {
    borderClass: 'border-cyan-400/75 bg-[#0B0E17]/95 shadow-cyan-950/40',
    headerBgClass: 'bg-cyan-950/70 border-b border-cyan-500/40 text-cyan-100',
    severityLabelDa: 'GATE 1 TELEMETRI',
    accentTextClass: 'text-cyan-300',
  };
}

export const MyceliumToastOverlay: React.FC<MyceliumToastOverlayProps> = ({
  visibleToasts,
  isLiveEnabled,
  channelBadgeLabelDa,
  isFullscreen = false,
  isMapOnly = false,
  onFocusReceptor,
  onDismissToast,
  onHoverToastChange,
}) => {
  if (!isLiveEnabled || visibleToasts.length === 0) {
    return null;
  }

  // Sikrer synlighed i både standard-workspace, Fuld Skærm og Kun Kort-tilstand uden at blokere kortinteraktion
  const containerPositionClass =
    isFullscreen || isMapOnly
      ? 'fixed top-16 right-4 z-[1300]'
      : 'fixed top-20 right-4 z-[1150]';

  return (
    <aside
      aria-live="polite"
      aria-label="System B Mycelium Live Varslinger"
      data-testid="mycelium-toast-overlay"
      className={`${containerPositionClass} w-[340px] max-w-[calc(100vw-1.5rem)] flex flex-col gap-2.5 pointer-events-none font-mono`}
    >
      {channelBadgeLabelDa && (
        <div className="self-end px-2 py-0.5 rounded bg-[#07090E]/90 border border-slate-800 text-[11px] text-slate-300 tracking-tight">
          {channelBadgeLabelDa}
        </div>
      )}

      {visibleToasts.slice(0, 3).map((toast) => {
        const style = getSeverityStyles(toast.severity);
        const shortZkp =
          toast.zkpProofHash.length > 18
            ? `${toast.zkpProofHash.slice(0, 10)}…${toast.zkpProofHash.slice(-6)}`
            : toast.zkpProofHash;
        const canFocusNode = toast.nodeId !== 'SYSTEM_B';
        const hasSwarmSupport =
          toast.allocatedEnergyJoules > 0 ||
          toast.allocatedWaterMistKg > 0 ||
          toast.allocatedHepaM3h > 0;

        return (
          <div
            key={toast.id}
            data-testid={`mycelium-live-toast-${toast.nodeCode}`}
            onMouseEnter={() => onHoverToastChange?.(toast.id)}
            onMouseLeave={() => onHoverToastChange?.(null)}
            className={`pointer-events-auto rounded-lg border shadow-2xl backdrop-blur-md overflow-hidden transition-all ${style.borderClass}`}
          >
            {/* Øverste statuslinje med alvorlighed & luk-knap */}
            <div className={`px-3 py-1.5 flex items-center justify-between gap-2 ${style.headerBgClass}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] font-bold tracking-wide truncate">
                  {style.severityLabelDa} · {toast.nodeCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDismissToast(toast.id)}
                aria-label="Luk varsling"
                className="p-1 rounded hover:bg-black/35 text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hovedindhold */}
            <div className="p-3 space-y-2.5 text-slate-100">
              <div className="space-y-1">
                <div className="text-xs font-bold leading-snug text-white">
                  {toast.titleDa}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  {toast.messageDa}
                </p>
              </div>

              {/* Måleværdier: S, fibre/cm³, m/s */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#07090E] border border-slate-800/90 rounded p-2 text-[11px] tabular-nums">
                <div>
                  <div className="text-[11px] text-slate-400">Sumkvotient</div>
                  <div className={`font-bold ${style.accentTextClass}`}>
                    S = {toast.measuredSumQuotientS.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Asbest</div>
                  <div className="font-bold text-slate-100">
                    {toast.measuredAsbestosFibersCm3.toFixed(4)} f/cm³
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Wind className="w-2.5 h-2.5 text-cyan-400" />
                    <span>Vind</span>
                  </div>
                  <div className="font-bold text-cyan-200">
                    {toast.measuredWindSpeedMs.toFixed(1)} m/s
                  </div>
                </div>
              </div>

              {/* Allokeret CiK 2.0 sværm-support (J / kg / m³/h) */}
              {hasSwarmSupport && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-2 py-1.5 rounded bg-emerald-950/35 border border-emerald-500/35 text-[11px] text-emerald-200 tabular-nums">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    {toast.allocatedEnergyJoules} J
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Droplets className="w-3 h-3 text-cyan-300" />
                    {toast.allocatedWaterMistKg.toFixed(1)} kg tåge
                  </span>
                  {toast.allocatedHepaM3h > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 text-teal-300" />
                        {toast.allocatedHepaM3h} m³/h HEPA
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* ZKP-verifikationsstempel & Fokusér Receptor handling */}
              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div
                  className="flex items-center gap-1 text-[11px] text-emerald-300/95 tabular-nums truncate"
                  title={`Groth16 ZKP: ${toast.zkpProofHash} · ${toast.sbtTokenId}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span className="truncate">
                    {toast.gate1Passed ? 'ZKP Verificeret' : 'Gate 1 Afvist'} · {shortZkp}
                  </span>
                </div>

                {canFocusNode && (
                  <button
                    type="button"
                    data-testid={`focus-receptor-btn-${toast.nodeCode}`}
                    onClick={() => onFocusReceptor(toast.nodeId)}
                    className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/60 text-cyan-100 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Crosshair className="w-3 h-3 text-cyan-300" />
                    <span>Fokusér Receptor</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </aside>
  );
};
