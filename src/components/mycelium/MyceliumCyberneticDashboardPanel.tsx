import React, { useState } from 'react';
import {
  BellRing,
  Cpu,
  GitBranch,
  Network,
  Radio,
  RotateCcw,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { MyceliumNetworkSimulationSnapshot } from '../../types/myceliumAlert';
import { Cik20SankeyTransducerSvg } from './Cik20SankeyTransducerSvg';

export interface MyceliumCyberneticDashboardPanelProps {
  snapshot: MyceliumNetworkSimulationSnapshot;
  disabledNodeIds: Record<string, boolean>;
  byzantineFaultNodeIds: Record<string, boolean>;
  unacknowledgedAlertCount: number;
  onToggleNodeOffline: (receptorId: string) => void;
  onToggleByzantineFault: (receptorId: string) => void;
  onResetFaultSimulations: () => void;
  onOpenAlertDrawer: () => void;
  onSelectReceptor: (receptorId: string) => void;
}

type MyceliumTabId = 'bft_gate1' | 'lora_dijkstra' | 'cik20_sankey' | 'apoptosis';

export const MyceliumCyberneticDashboardPanel: React.FC<
  MyceliumCyberneticDashboardPanelProps
> = ({
  snapshot,
  disabledNodeIds,
  byzantineFaultNodeIds,
  unacknowledgedAlertCount,
  onToggleNodeOffline,
  onToggleByzantineFault,
  onResetFaultSimulations,
  onOpenAlertDrawer,
  onSelectReceptor,
}) => {
  const [subTab, setSubTab] = useState<MyceliumTabId>('bft_gate1');

  const hasInjectedSim =
    Object.values(disabledNodeIds).some(Boolean) ||
    Object.values(byzantineFaultNodeIds).some(Boolean);

  return (
    <div
      data-testid="mycelium-cybernetic-dashboard-panel"
      className="rounded-lg bg-[#0B0E17] border border-cyan-500/40 p-3.5 space-y-3 font-mono text-slate-100 shadow-lg"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">
              System B Mycelium-Netværk — Kybernetisk Kontrolkerne
            </h3>
          </div>
          <p className="text-[11px] text-slate-400">
            BFT Gate 1 (3f+1) · EU868 LoRa Duty-Cycle · Dijkstra P2P Selvheling · CiK 2.0 · Regulatorisk Apoptose
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasInjectedSim && (
            <button
              type="button"
              onClick={onResetFaultSimulations}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Nulstil Fejltest</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAlertDrawer}
            className="px-2.5 py-1 rounded bg-rose-600/25 hover:bg-rose-600/35 border border-rose-400/70 text-[11px] font-bold text-rose-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums"
          >
            <BellRing className="w-3.5 h-3.5 text-rose-300 shrink-0" />
            <span>ISA-18.2 Skuffe ({unacknowledgedAlertCount})</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
        <div className="p-2 rounded bg-[#07090E] border border-slate-800">
          <div className="text-slate-400">Noder Online / GW</div>
          <div className="text-sm font-bold text-cyan-300 mt-0.5">
            {snapshot.onlineNodeCount}/{snapshot.onlineNodeCount + snapshot.offlineNodeCount} ·{' '}
            {snapshot.gatewayCode}
          </div>
        </div>
        <div className="p-2 rounded bg-[#07090E] border border-slate-800">
          <div className="text-slate-400">BFT Gate 1 Kvorum</div>
          <div className="text-sm font-bold text-emerald-300 mt-0.5">
            {snapshot.bftApprovedAlertCount} godk. / {snapshot.bftRejectedByzantineCount} afvist
          </div>
        </div>
        <div className="p-2 rounded bg-[#07090E] border border-slate-800">
          <div className="text-slate-400">Dijkstra P2P Failover</div>
          <div className="text-sm font-bold text-amber-300 mt-0.5">
            {snapshot.selfHealedRouteCount} selvhelede ruter
          </div>
        </div>
        <div className="p-2 rounded bg-[#07090E] border border-slate-800">
          <div className="text-slate-400">EU868 LoRa Duty</div>
          <div className="text-sm font-bold text-fuchsia-300 mt-0.5">
            {snapshot.meanEu868DutyUtilizedPct.toFixed(3)}% snit
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#07090E] p-1 rounded border border-slate-800 text-[11px]">
        {(
          [
            { id: 'bft_gate1', label: 'BFT Gate 1 (3f+1)', icon: ShieldCheck },
            { id: 'lora_dijkstra', label: 'EU868 & P2P Ruter', icon: GitBranch },
            { id: 'cik20_sankey', label: 'CiK 2.0 Sankey', icon: Cpu },
            { id: 'apoptosis', label: 'Reg. Apoptose', icon: TimerReset },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-2 py-1.5 rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                active
                  ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BFT Gate 1 Neighbor Test & Fault Injection */}
      {subTab === 'bft_gate1' && (
        <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
          <div className="text-[11px] text-slate-400">
            Klik <strong className="text-amber-300">Afbryd Node</strong> for at teste Dijkstra P2P selvheling, eller{' '}
            <strong className="text-rose-300">Byzantinsk Fejl</strong> for at verificere at BFT Gate 1 afviser falske enkelt-sensor udsving:
          </div>
          {snapshot.bftAudits.map((audit) => (
            <div
              key={audit.receptorId}
              className="p-2.5 rounded bg-[#07090E] border border-slate-800 space-y-1.5 text-[11px] tabular-nums"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectReceptor(audit.receptorId)}
                  className="font-bold text-white hover:text-cyan-300 cursor-pointer text-left"
                >
                  {audit.receptorCode} — {audit.receptorName} (S={audit.reportedSumQuotient.toFixed(2)})
                </button>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                    audit.verdict === 'BFT_KONSENSUS_GODKENDT'
                      ? 'bg-emerald-950 border-emerald-400/60 text-emerald-200'
                      : audit.verdict === 'BFT_BYZANTINSK_AFVIST'
                      ? 'bg-rose-950 border-rose-400/70 text-rose-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {audit.verdictLabelDa}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">{audit.forensicAuditDa}</div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => onToggleNodeOffline(audit.receptorId)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-semibold cursor-pointer ${
                    audit.isDisabledOffline
                      ? 'bg-amber-400 text-slate-950 border-white font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 border-amber-500/40 text-amber-200'
                  }`}
                >
                  {audit.isDisabledOffline ? 'Node Offline (Genopret)' : 'Afbryd Node (P2P Test)'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleByzantineFault(audit.receptorId)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-semibold cursor-pointer ${
                    audit.hasInjectedByzantineFault
                      ? 'bg-rose-500 text-white border-white font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {audit.hasInjectedByzantineFault
                    ? 'Byzantinsk Fejl Aktiv (Fjern)'
                    : 'Injektér Byzantinsk Fejl'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: EU868 LoRa Duty-Cycle & Dijkstra Self-Healing Routes */}
      {subTab === 'lora_dijkstra' && (
        <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1 text-[11px] tabular-nums">
          {snapshot.dijkstraRoutes.map((route) => {
            const lora = snapshot.loraByReceptorId[route.originReceptorId];
            return (
              <div
                key={route.originReceptorId}
                className="p-2.5 rounded bg-[#07090E] border border-slate-800 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>
                      {route.originCode} → {route.gatewayCode} ({route.hopCount} hop ·{' '}
                      {route.totalDistanceMeters}m)
                    </span>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                      !route.isReachable
                        ? 'bg-slate-900 border-slate-700 text-slate-400'
                        : route.isSelfHealedReroute
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                        : 'bg-cyan-950 border-cyan-500/50 text-cyan-200'
                    }`}
                  >
                    {!route.isReachable
                      ? 'OFFLINE'
                      : route.isSelfHealedReroute
                      ? 'SELVHELET P2P RUTE'
                      : 'PRIMÆR MESH-STI'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Sti: {route.isReachable ? route.pathCodes.join(' → ') : 'Node deaktiveret'}
                  {route.bypassedFailedNodeCodes.length > 0
                    ? ` (Omgik: ${route.bypassedFailedNodeCodes.join(', ')})`
                    : ''}
                </div>
                {lora && (
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                    <span>SF{lora.spreadingFactor} / 125 kHz</span>
                    <span>ToA: {lora.timeOnAirMs} ms</span>
                    <span>
                      Duty: {lora.dutyCycleUtilizedPct}% / {lora.dutyCycleLimitPct}% (
                      {lora.subBand === 'G3_869_525MHZ_10PCT_ALGEDONIC' ? '869,525 MHz g3' : '868,1 MHz g1'})
                    </span>
                    <span>
                      RSSI {lora.rssiDbm} dBm · SNR {lora.snrDb} dB
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Calculation in Kind 2.0 (CiK 2.0) Sankey Transducer */}
      {subTab === 'cik20_sankey' && (
        <Cik20SankeyTransducerSvg
          cik20={snapshot.cik20}
          onSelectReceptor={onSelectReceptor}
        />
      )}

      {/* TAB 4: Regulatory Apoptosis */}
      {subTab === 'apoptosis' && (
        <div className="space-y-2.5 text-[11px] tabular-nums">
          <div className="p-2.5 rounded bg-[#07090E] border border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-slate-400 text-[11px]">
                Sammenhængende Homeostase-Vindue (τ_apoptose)
              </div>
              <div className="text-xs font-bold text-white mt-0.5">
                {snapshot.apoptosis.consecutiveHomeostasisHours} /{' '}
                {snapshot.apoptosis.requiredHomeostasisHours} timer uden grænseoverskridelse
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                snapshot.apoptosis.dryDemolitionPermitRevoked
                  ? 'bg-rose-950 border-rose-400 text-rose-200'
                  : 'bg-emerald-950 border-emerald-400 text-emerald-200'
              }`}
            >
              {snapshot.apoptosis.dryDemolitionPermitRevoked
                ? 'Tørnedbrydnings-Dispensation Bortfaldet'
                : 'Proportionalitets-Nedtælling Aktiv'}
            </span>
          </div>

          {snapshot.apoptosis.rules.map((rule) => (
            <div
              key={rule.ruleId}
              className="p-2.5 rounded bg-[#07090E] border border-slate-800 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-cyan-200">
                  {rule.ruleId}: {rule.titleDa}
                </span>
                <span className="text-[11px] text-amber-300">{rule.statutoryRefDa}</span>
              </div>
              <div className="text-[11px] text-slate-300">{rule.forensicNoteDa}</div>
              <div className="w-full h-1.5 rounded bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${rule.stabilityProgressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Opløsningskrav: {rule.dissolutionConditionDa}</span>
                <span>{rule.stabilityProgressPct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
