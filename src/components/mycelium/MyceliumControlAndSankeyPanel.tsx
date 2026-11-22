/**
 * @file src/components/mycelium/MyceliumControlAndSankeyPanel.tsx
 * @description Samlet kontrol-, simulerings- og visualiseringsvindue til kortet:
 * - Sektion A: Live Notifications On/Off, Calmer Defaults vs. Strict Forensic, Lyd & Test
 * - Sektion B: 5 Biokybernetiske Scenarier + Reality Summit + Krater/Spoof Toggle
 * - Sektion C: Modulært `MyceliumKpiSankeyPanel` (α, Σ, γ, φ + CiK 2.0 Sankey) samt
 *   verificerbar `MyceliumZkpAuditLog` (Chain-of-Custody SHA-256) & hændelseslog.
 */

import React, { useState } from 'react';
import { Bell, BellOff, Calculator, ChevronDown, ChevronRight, Crosshair, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { AlgedonicObservation } from '../../types/dispersion';
import {
  MyceliumAlertProfile, MyceliumLiveNotification, MyceliumNetworkSimulationState,
  MyceliumSimulationScenario, MyceliumSuppressedStats,
} from '../../types/myceliumAlert';
import { MyceliumKpiSankeyPanel } from './MyceliumKpiSankeyPanel';
import { MyceliumZkpAuditLog } from './MyceliumZkpAuditLog';

export interface MyceliumControlAndSankeyPanelProps {
  state: MyceliumNetworkSimulationState;
  observations?: AlgedonicObservation[];
  scenario: MyceliumSimulationScenario;
  onChangeScenario: (next: MyceliumSimulationScenario) => void;
  realitySummitOverride: boolean;
  onToggleRealitySummit: () => void;
  selectedReceptorId: string;
  manualCraterNodeIds: string[];
  manualSpoofNodeIds: string[];
  onToggleSelectedCrater: () => void;
  onToggleSelectedSpoof: () => void;
  onResetManualOverrides: () => void;
  isLiveEnabled: boolean;
  onToggleLiveEnabled: () => void;
  alertProfile: MyceliumAlertProfile;
  onChangeAlertProfile: (p: MyceliumAlertProfile) => void;
  isAudioChimeEnabled: boolean;
  onToggleAudioChime: () => void;
  onTriggerTestAlert: () => void;
  onEnableOsNotification: () => void;
  channelBadgeLabelDa: string;
  suppressedStats: MyceliumSuppressedStats;
  eventLog: MyceliumLiveNotification[];
  onFocusReceptor: (nodeId: string) => void;
  onOpenFormulaSimulator?: () => void;
}

const SCENARIO_BUTTONS: Array<{ id: MyceliumSimulationScenario; shortLabel: string; descDa: string }> = [
  { id: 'live_telemetry', shortLabel: '1. Live Miljø-Telemetri', descDa: 'Realtids sprednings- & receptor-telemetri' },
  { id: 'alpha_kinetic_crater', shortLabel: '2. Scenarie Alpha: Krater + Ø-Drift', descDa: 'Kinetisk udfald + suveræn Island Mode & P2P' },
  { id: 'byzantine_cry_wolf', shortLabel: '3. Byzantinsk Cry-Wolf (Gate 1 Test)', descDa: 'S=2,85 / 40J spoof destrueres lokalt (0,0 J)' },
  { id: 'acute_asbestos_plume', shortLabel: '4. Akut <1997 Asbestfane (CiK Sværm)', descDa: 'Fler-node fane udløser spinal CiK 2.0 sværm' },
  { id: 'autoimmune_overfilter', shortLabel: '5. Autoimmun Over-Filtrering (Apoptose)', descDa: 'Lav entropi Σ<0,10 udløser 20% kill-chains & amnesti' },
];

export const MyceliumControlAndSankeyPanel: React.FC<MyceliumControlAndSankeyPanelProps> = ({
  state, observations = [], scenario, onChangeScenario, realitySummitOverride, onToggleRealitySummit,
  selectedReceptorId, manualCraterNodeIds, manualSpoofNodeIds, onToggleSelectedCrater, onToggleSelectedSpoof, onResetManualOverrides,
  isLiveEnabled, onToggleLiveEnabled, alertProfile, onChangeAlertProfile, isAudioChimeEnabled, onToggleAudioChime,
  onTriggerTestAlert, onEnableOsNotification, channelBadgeLabelDa, suppressedStats, eventLog, onFocusReceptor, onOpenFormulaSimulator,
}) => {
  const [sectionCView, setSectionCView] = useState<'kpi_sankey' | 'zkp_audit'>('kpi_sankey');
  const [isLogExpanded, setIsLogExpanded] = useState(false);

  const selectedNode = state.nodesById[selectedReceptorId] ?? state.nodes[0];
  const isSelCrater = Boolean(selectedNode && manualCraterNodeIds.includes(selectedNode.nodeId));
  const isSelSpoof = Boolean(selectedNode && manualSpoofNodeIds.includes(selectedNode.nodeId));

  return (
    <div data-testid="mycelium-control-sankey-panel" className="space-y-2.5 font-mono text-slate-100 text-[11px] max-h-[72vh] overflow-y-auto pr-0.5">
      {/* SEKTION A: Live Notifications On/Off & Calmer Defaults Bar */}
      <section className="rounded bg-[#07090E] border border-slate-800 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <button
            type="button" data-testid="mycelium-panel-live-toggle-btn" onClick={onToggleLiveEnabled}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer ${isLiveEnabled ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
          >
            {isLiveEnabled ? <Bell className="w-3.5 h-3.5 text-emerald-300" /> : <BellOff className="w-3.5 h-3.5" />}
            <span>Live Varsling: {isLiveEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center rounded bg-slate-900 border border-slate-800 p-0.5">
            {(['calmer_defaults', 'strict_forensic'] as const).map((prof) => (
              <button
                key={prof} type="button" onClick={() => onChangeAlertProfile(prof)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${alertProfile === prof ? (prof === 'calmer_defaults' ? 'bg-cyan-500 text-slate-950' : 'bg-amber-400 text-slate-950') : 'text-slate-400 hover:text-slate-200'}`}
              >
                {prof === 'calmer_defaults' ? 'Calmer Defaults' : 'Strict Forensic'}
              </button>
            ))}
          </div>

          <button
            type="button" onClick={onToggleAudioChime} title="Skift 528->660 Hz biokybernetisk lydpuls"
            className={`px-2 py-1 rounded border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${isAudioChimeEnabled ? 'bg-cyan-950 border-cyan-400/70 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
          >
            {isAudioChimeEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            <span>{isAudioChimeEnabled ? 'Lyd ON' : 'Lyd OFF'}</span>
          </button>

          <button type="button" data-testid="mycelium-test-alert-btn" onClick={onTriggerTestAlert} className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/60 text-cyan-100 text-[11px] font-bold cursor-pointer">
            Test Varsling
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 pt-1 border-t border-slate-800/80 tabular-nums">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-emerald-300">Sendte Alarmer: <strong>{suppressedStats.emittedCount}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-300">Gate 1 Støj Destrueret: <strong>{suppressedStats.destroyedByGate1Count}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-300">Hysterese Dæmpet: <strong>{suppressedStats.suppressedByHysteresisCount + suppressedStats.suppressedByScrubbingCount}</strong></span>
          </div>
          <button type="button" onClick={onEnableOsNotification} className="text-[11px] text-cyan-300 hover:underline cursor-pointer">
            {channelBadgeLabelDa}
          </button>
        </div>
      </section>

      {/* SEKTION B: Interaktiv Simulerings-Vælger */}
      <section className="rounded bg-[#07090E] border border-slate-800 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] tracking-wide font-bold text-cyan-300">I. Simuler Biokybernetisk Scenarie</span>
          <div className="flex items-center gap-1.5">
            {onOpenFormulaSimulator && (
              <button type="button" data-testid="open-system-b-formula-simulator-btn" onClick={onOpenFormulaSimulator} className="px-2 py-0.5 rounded text-[11px] font-bold border bg-cyan-950/90 hover:bg-cyan-900 border-cyan-400/70 text-cyan-100 flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <Calculator className="w-3 h-3 text-cyan-300" />
                <span>Formelsamling &amp; System A</span>
              </button>
            )}
            <button type="button" onClick={onToggleRealitySummit} className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer whitespace-nowrap ${realitySummitOverride ? 'bg-amber-400 text-slate-950 border-amber-200' : 'bg-slate-900 border-amber-500/50 text-amber-200 hover:bg-slate-800'}`}>
              Reality Summit: {realitySummitOverride ? 'AKTIV' : 'STANDBY'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {SCENARIO_BUTTONS.map((btn) => (
            <button
              key={btn.id} type="button" data-testid={`mycelium-scenario-${btn.id}`} onClick={() => onChangeScenario(btn.id)}
              className={`p-1.5 rounded border text-left transition-colors cursor-pointer ${scenario === btn.id ? 'bg-cyan-950/85 border-cyan-400 text-white' : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'}`}
            >
              <div className="text-[11px] font-bold truncate">{btn.shortLabel}</div>
              <div className="text-[11px] text-slate-400 truncate">{btn.descDa}</div>
            </button>
          ))}
        </div>

        {selectedNode && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80 text-[11px]">
            <span className="text-slate-300 truncate">Valgt Node: <strong className="text-cyan-200">{selectedNode.code}</strong> ({selectedNode.status})</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={onToggleSelectedCrater} className={`px-2 py-0.5 rounded border font-bold cursor-pointer ${isSelCrater ? 'bg-rose-600 text-white border-rose-300' : 'bg-slate-900 border-rose-500/50 text-rose-200'}`}>
                {isSelCrater ? '✓ Krater Aktiv' : 'Sæt Krater'}
              </button>
              <button type="button" onClick={onToggleSelectedSpoof} className={`px-2 py-0.5 rounded border font-bold cursor-pointer ${isSelSpoof ? 'bg-purple-600 text-white border-purple-300' : 'bg-slate-900 border-purple-500/50 text-purple-200'}`}>
                {isSelSpoof ? '✓ Spoof Aktiv' : 'Sæt Cry-Wolf'}
              </button>
              {(manualCraterNodeIds.length > 0 || manualSpoofNodeIds.length > 0) && (
                <button type="button" onClick={onResetManualOverrides} title="Nulstil manuelle node-fejl" className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer">
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* SEKTION C: Modulært KPI & Sankey Panel (α, Σ, γ, φ) + Chain-of-Custody SHA-256 ZKP Log */}
      <section className="rounded bg-[#07090E] border border-slate-800 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
          <span className="text-[11px] font-bold text-cyan-300">III. Telemetri, CiK 2.0 &amp; SHA-256 Beviskæde</span>
          <div className="flex items-center rounded bg-slate-900 border border-slate-800 p-0.5 text-[11px]">
            <button type="button" onClick={() => setSectionCView('kpi_sankey')} className={`px-2 py-0.5 rounded font-bold cursor-pointer whitespace-nowrap ${sectionCView === 'kpi_sankey' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}>
              KPI (α·Σ·γ·φ) &amp; Sankey
            </button>
            <button type="button" data-testid="mycelium-open-zkp-audit-tab-btn" onClick={() => setSectionCView('zkp_audit')} className={`px-2 py-0.5 rounded font-bold cursor-pointer whitespace-nowrap ${sectionCView === 'zkp_audit' ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}>
              SHA-256 ZKP Log
            </button>
          </div>
        </div>

        {sectionCView === 'kpi_sankey' ? (
          <MyceliumKpiSankeyPanel state={state} />
        ) : (
          <MyceliumZkpAuditLog observations={observations} myceliumState={state} liveEventLog={eventLog} onFocusSignal={onFocusReceptor} compact />
        )}

        <div className="pt-1 border-t border-slate-800/80">
          <button type="button" onClick={() => setIsLogExpanded((v) => !v)} className="w-full flex items-center justify-between text-[11px] text-slate-300 hover:text-white cursor-pointer py-0.5">
            <span className="flex items-center gap-1 font-bold">{isLogExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}Seneste Algedoniske Hændelser ({eventLog.length})</span>
            <span className="text-[11px] text-cyan-300">Klik for kortfokus</span>
          </button>
          {isLogExpanded && (
            <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
              {eventLog.length === 0 ? (
                <div className="text-[11px] text-slate-500 py-1">Ingen aktive alarmer i hændelsesloggen.</div>
              ) : (
                eventLog.slice(0, 8).map((ev) => (
                  <button key={ev.id} type="button" onClick={() => onFocusReceptor(ev.nodeId)} className="w-full px-2 py-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-800 flex items-center justify-between gap-2 text-left cursor-pointer">
                    <span className="text-[11px] text-slate-200 truncate">{ev.titleDa}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300 shrink-0 tabular-nums"><Crosshair className="w-3 h-3" />{ev.nodeCode}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
