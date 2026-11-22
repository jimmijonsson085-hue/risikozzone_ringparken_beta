import React from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Radio,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  MyceliumAlarmPriority,
  MyceliumLiveAlertItem,
  MyceliumNotificationChannelStatus,
  SimultaneousAlgedonicDispatch,
} from '../../types/myceliumAlert';

export interface TacticalAlgedonicToastDrawerProps {
  alerts: MyceliumLiveAlertItem[];
  activeToastAlerts: MyceliumLiveAlertItem[];
  unacknowledgedCount: number;
  channelStatus: MyceliumNotificationChannelStatus;
  isDrawerOpen: boolean;
  onSetDrawerOpen: (open: boolean) => void;
  onAcknowledgeAlert: (id: string) => void;
  onAcknowledgeAll: () => void;
  onClearResolved: () => void;
  onToggleAudioMuted: () => void;
  onRequestBrowserNotification: () => void;
  onTriggerTestSignal: () => void;
  onSelectReceptor?: (receptorId: string) => void;
  simultaneousDispatch?: SimultaneousAlgedonicDispatch | null;
  onOpenSimultaneousModal?: () => void;
  onAcknowledgeSimultaneousP1?: () => void;
}

function priorityStyle(priority: MyceliumAlarmPriority): {
  badgeText: string;
  cardBorder: string;
  badgeBg: string;
} {
  if (priority === 'P1_KRITISK_ALGEDONISK') {
    return {
      badgeText: 'P1 KRITISK',
      cardBorder: 'border-rose-500/80 bg-rose-950/90',
      badgeBg: 'bg-rose-600 text-white border-rose-300',
    };
  }
  if (priority === 'P2_FORHØJET_VARSEL') {
    return {
      badgeText: 'P2 VARSEL',
      cardBorder: 'border-amber-500/80 bg-slate-950/95',
      badgeBg: 'bg-amber-500 text-slate-950 border-amber-200',
    };
  }
  return {
    badgeText: 'P3 BFT-FILTER',
    cardBorder: 'border-cyan-500/70 bg-slate-950/95',
    badgeBg: 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60',
  };
}

export const TacticalAlgedonicToastDrawer: React.FC<
  TacticalAlgedonicToastDrawerProps
> = ({
  alerts,
  activeToastAlerts,
  unacknowledgedCount,
  channelStatus,
  isDrawerOpen,
  onSetDrawerOpen,
  onAcknowledgeAlert,
  onAcknowledgeAll,
  onClearResolved,
  onToggleAudioMuted,
  onRequestBrowserNotification,
  onTriggerTestSignal,
  onSelectReceptor,
  simultaneousDispatch,
  onOpenSimultaneousModal,
  onAcknowledgeSimultaneousP1,
}) => {
  return (
    <>
      {/* Guaranteed Primary In-App Tactical Algedonic Toast Stack */}
      {activeToastAlerts.length > 0 && !isDrawerOpen && (
        <div
          data-testid="mycelium-tactical-toast-stack"
          className="fixed bottom-4 right-4 z-[95] w-[340px] max-w-[calc(100vw-24px)] space-y-2 pointer-events-auto font-mono"
        >
          {activeToastAlerts.map((alert) => {
            const st = priorityStyle(alert.priority);
            return (
              <div
                key={alert.id}
                className={`rounded-md border p-3 shadow-2xl space-y-1.5 ${st.cardBorder}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[11px] font-bold whitespace-nowrap shrink-0 ${st.badgeBg}`}
                    >
                      {st.badgeText}
                    </span>
                    <span className="text-[11px] text-slate-300 tabular-nums truncate">
                      kl. {alert.hourLabel} ·{' '}
                      {alert.loraSubBand === 'G3_869_525MHZ_10PCT_ALGEDONIC'
                        ? 'EU868 g3 (10%)'
                        : 'EU868 g1 (1%)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAcknowledgeAlert(alert.id)}
                    className="p-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                    title="Kvittér alarm (ISA-18.2)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-xs font-bold text-white leading-snug">
                  {alert.headlineDa}
                </div>
                <div className="text-[11px] text-slate-200 leading-relaxed">
                  {alert.detailDa}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectReceptor?.(alert.receptorId);
                      onSetDrawerOpen(true);
                    }}
                    className="text-cyan-300 hover:text-cyan-200 font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Åbn Algedonisk Log ({unacknowledgedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => onAcknowledgeAlert(alert.id)}
                    className="px-2 py-0.5 rounded bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/60 text-emerald-200 font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3 h-3" />
                    <span>Kvittér</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expandable Tactical Algedonic Log Drawer */}
      {isDrawerOpen && (
        <div
          data-testid="mycelium-algedonic-log-drawer"
          className="fixed inset-y-0 right-0 z-[110] w-full max-w-[460px] bg-[#07090E]/98 border-l border-cyan-500/50 shadow-2xl flex flex-col font-mono text-slate-100"
        >
          <div className="p-3.5 bg-[#0B0E17] border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  System B — Taktisk Algedonisk Alarm-Skuffe (ISA-18.2)
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  Ukvitterede: {unacknowledgedCount} · Total log: {alerts.length}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSetDrawerOpen(false)}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Luk</span>
            </button>
          </div>

          {/* Sandbox & Telemetry Channel Strip */}
          <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-semibold">
                {channelStatus.isCrossOriginIframe
                  ? 'iFrame-Sikker Primærkanal Aktiv'
                  : 'Direkte Browserkanal Aktiv'}
              </span>
              {channelStatus.isScrubbingSuppressed && (
                <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300">
                  Tidslinje-Scrub Dæmpet
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleAudioMuted}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="Slå Web Audio API algedonisk syntese til/fra"
              >
                {channelStatus.audioMuted ? (
                  <>
                    <VolumeX className="w-3 h-3 text-rose-400" />
                    <span>Lyd Fra</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    <span>WebAudio Til</span>
                  </>
                )}
              </button>

              {!channelStatus.isCrossOriginIframe &&
                channelStatus.browserPermission === 'default' && (
                  <button
                    type="button"
                    onClick={onRequestBrowserNotification}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-500/50 text-cyan-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Bell className="w-3 h-3" />
                    <span>Tillad Notifikation</span>
                  </button>
                )}

              <button
                type="button"
                onClick={onTriggerTestSignal}
                className="px-2 py-1 rounded bg-rose-600/25 hover:bg-rose-600/35 border border-rose-400/70 text-rose-200 font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Radio className="w-3 h-3" />
                <span>Test P1</span>
              </button>
            </div>
          </div>

          {/* Action Strip */}
          <div className="px-3.5 py-2 bg-[#0B0E17] border-b border-slate-800 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-400 tabular-nums">
              ISA-18.2 Dødbånd: P1 S≥1,00 (Ryd≤0,82) · P2 S≥0,50 (Ryd≤0,38)
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onAcknowledgeAll}
                className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Kvittér alle</span>
              </button>
              <button
                type="button"
                onClick={onClearResolved}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3 h-3" />
                <span>Ryd</span>
              </button>
            </div>
          </div>

          {simultaneousDispatch?.active && (
            <div
              className={`mx-3 mt-3 p-2.5 rounded border-2 space-y-1.5 ${
                simultaneousDispatch.isBlinkingP1
                  ? 'bg-rose-950/85 border-rose-500 animate-pulse'
                  : 'bg-rose-950/50 border-rose-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-extrabold">
                  S1+S3 ATOMAR ({simultaneousDispatch.latencyMs} ms)
                </span>
                <span className="text-amber-200 font-bold">
                  Tr: 18,5t → {simultaneousDispatch.relaxationTimeAfterHours.toFixed(3)}t
                </span>
              </div>
              <div className="text-xs font-bold text-white">
                {simultaneousDispatch.scenarioTitleDa}
              </div>
              <div className="text-[11px] text-slate-200">
                S1 Modvind: {simultaneousDispatch.system1State.upwindEscapeBearingDeg}° · S3:{' '}
                {simultaneousDispatch.system3State.lockedValveCodes.join('+')} LUKKET + H14-HEPA Overtryk
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                {onOpenSimultaneousModal && (
                  <button
                    type="button"
                    onClick={onOpenSimultaneousModal}
                    className="px-2 py-0.5 rounded bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400 text-cyan-100 font-bold cursor-pointer"
                  >
                    Åbn Split-Screen (S1 + S3)
                  </button>
                )}
                {!simultaneousDispatch.acknowledged && onAcknowledgeSimultaneousP1 && (
                  <button
                    type="button"
                    onClick={onAcknowledgeSimultaneousP1}
                    className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Kvittér P1
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Alert History List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {alerts.length === 0 ? (
              <div className="p-4 rounded bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center space-y-1">
                <AlertTriangle className="w-5 h-5 text-cyan-400 mx-auto" />
                <div>Ingen aktive ISA-18.2 algedoniske alarmer registreret.</div>
                <div className="text-[11px] text-slate-500">
                  Klik på &quot;Test P1&quot; ovenfor for at teste WebAudio og BFT-logning.
                </div>
              </div>
            ) : (
              alerts.map((item) => {
                const st = priorityStyle(item.priority);
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded border space-y-1.5 ${
                      item.acknowledged
                        ? 'bg-slate-950/70 border-slate-800 opacity-80'
                        : st.cardBorder
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded border font-bold ${st.badgeBg}`}
                        >
                          {st.badgeText}
                        </span>
                        <span className="text-slate-300 tabular-nums">
                          kl. {item.hourLabel} · {item.hopCount} hop
                        </span>
                        {item.resolvedByHysteresis && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                            Afklaret (Dødbånd)
                          </span>
                        )}
                      </div>
                      {!item.acknowledged && (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeAlert(item.id)}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 font-bold cursor-pointer"
                        >
                          Kvittér
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectReceptor?.(item.receptorId)}
                      className="text-left text-xs font-bold text-white hover:text-cyan-300 cursor-pointer block w-full"
                    >
                      {item.headlineDa}
                    </button>
                    <div className="text-[11px] text-slate-300 leading-relaxed">
                      {item.detailDa}
                    </div>
                    <div className="text-[11px] text-amber-300/90">
                      Hjemmel: {item.statutoryRefDa}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
};
