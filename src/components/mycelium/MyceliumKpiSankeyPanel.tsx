/**
 * @file src/components/mycelium/MyceliumKpiSankeyPanel.tsx
 * @description Modulært kybernetisk KPI- og CiK 2.0 Sankey-visningspanel til
 * `MyceliumControlAndSankeyPanel.tsx`. Visualiserer Autonomi-indekset (α),
 * Systemisk Entropi (Σ), Tvangs-indekset (γ) og Stabilitetsfaktoren (φ) med
 * tabulære tal (`tabular-nums`) samt 3-kolonners flow-konserverende Sankey.
 */

import React, { useMemo, useState } from 'react';
import { Radio, ShieldCheck, Zap } from 'lucide-react';
import { MyceliumNetworkSimulationState } from '../../types/myceliumAlert';

export interface MyceliumKpiSankeyPanelProps {
  state: MyceliumNetworkSimulationState;
}

interface KpiMetricSpec {
  id: string;
  symbol: string;
  titleDa: string;
  formulaNote: string;
  value: number;
  statusTextDa: string;
  valueColorClass: string;
  barColorClass: string;
}

export const MyceliumKpiSankeyPanel: React.FC<MyceliumKpiSankeyPanelProps> = ({ state }) => {
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  const { kpis, sankeyFlow, aiHistory } = state;

  const kpiMetrics: KpiMetricSpec[] = useMemo(() => {
    const alpha = kpis.autonomyIndexAi;
    const sigma = kpis.systemicEntropySigma;
    const gamma = kpis.coercionIndexGamma;
    const phi = kpis.stabilityFactorPhi;

    return [
      {
        id: 'alpha',
        symbol: 'α',
        titleDa: 'Autonomi-indeks (α)',
        formulaNote: 'A_i ∈ [0, 1]',
        value: alpha,
        statusTextDa: alpha >= 0.75 ? 'Suveræn' : alpha >= 0.5 ? 'Moderat' : 'Presset',
        valueColorClass: 'text-emerald-300',
        barColorClass: 'bg-emerald-400',
      },
      {
        id: 'sigma',
        symbol: 'Σ',
        titleDa: 'Systemisk Entropi (Σ)',
        formulaNote: sigma < 0.1 ? 'Apoptose-tærskel' : 'Miljøvarians',
        value: sigma,
        statusTextDa: sigma >= 0.55 ? 'Høj belastning' : sigma < 0.1 ? 'Lav (<0,10)' : 'Nominel',
        valueColorClass: 'text-amber-300',
        barColorClass: 'bg-amber-400',
      },
      {
        id: 'gamma',
        symbol: 'γ',
        titleDa: 'Tvangs-indeks (γ)',
        formulaNote: 'γ = 1 − α',
        value: gamma,
        statusTextDa: gamma <= 0.25 ? 'Lav friktion' : gamma <= 0.5 ? 'Forhøjet' : 'Kritisk tvang',
        valueColorClass: 'text-rose-300',
        barColorClass: 'bg-rose-400',
      },
      {
        id: 'phi',
        symbol: 'φ',
        titleDa: 'Stabilitetsfaktor (φ)',
        formulaNote: 'T_r << ΔT',
        value: phi,
        statusTextDa: phi >= 0.8 ? 'Homeostatisk' : phi >= 0.55 ? 'Adaptiv' : 'Ustabil',
        valueColorClass: 'text-cyan-300',
        barColorClass: 'bg-cyan-400',
      },
    ];
  }, [kpis]);

  // Lukkede kubiske Bézier-bånd (M ... C ... L ... C ... Z) til 3-kolonners CiK 2.0 Sankey
  const sankeyGeometry = useMemo(() => {
    const W = 456;
    const H = 152;
    const padT = 18;
    const availH = H - padT - 10;
    const nodeW = 12;
    const colX: Record<0 | 1 | 2, number> = {
      0: 8,
      1: Math.round(W / 2 - nodeW / 2),
      2: W - 8 - nodeW,
    };
    const nodeBox: Record<
      string,
      { x: number; y: number; h: number; label: string; color: string; col: 0 | 1 | 2; val: number }
    > = {};

    ([0, 1, 2] as const).forEach((col) => {
      const colNodes = sankeyFlow.nodes.filter((n) => n.column === col);
      const gap = 8;
      const usable = availH - gap * Math.max(0, colNodes.length - 1);
      let yCursor = padT;
      colNodes.forEach((n) => {
        const h = Math.max(10, (n.valueNormalized / 100) * usable);
        nodeBox[n.id] = {
          x: colX[col],
          y: yCursor,
          h,
          label: n.labelDa,
          color: n.colorHex,
          col,
          val: n.valueNormalized,
        };
        yCursor += h + gap;
      });
    });

    const outOff: Record<string, number> = {};
    const inOff: Record<string, number> = {};
    const ribbons = sankeyFlow.links
      .map((lk) => {
        const s = nodeBox[lk.sourceId];
        const t = nodeBox[lk.targetId];
        if (!s || !t) return null;
        const sh = (lk.valueNormalized / Math.max(1, s.val)) * s.h;
        const th = (lk.valueNormalized / Math.max(1, t.val)) * t.h;
        const sy0 = s.y + (outOff[lk.sourceId] ?? 0);
        const sy1 = sy0 + sh;
        const ty0 = t.y + (inOff[lk.targetId] ?? 0);
        const ty1 = ty0 + th;
        outOff[lk.sourceId] = (outOff[lk.sourceId] ?? 0) + sh;
        inOff[lk.targetId] = (inOff[lk.targetId] ?? 0) + th;
        const x0 = s.x + nodeW;
        const x1 = t.x;
        const cx = (x0 + x1) / 2;
        const d = `M ${x0.toFixed(1)},${sy0.toFixed(1)} C ${cx.toFixed(1)},${sy0.toFixed(1)} ${cx.toFixed(1)},${ty0.toFixed(1)} ${x1.toFixed(1)},${ty0.toFixed(1)} L ${x1.toFixed(1)},${ty1.toFixed(1)} C ${cx.toFixed(1)},${ty1.toFixed(1)} ${cx.toFixed(1)},${sy1.toFixed(1)} ${x0.toFixed(1)},${sy1.toFixed(1)} Z`;
        return {
          id: lk.id,
          d,
          color: lk.colorHex,
          label: `${s.label} → ${t.label}: ${lk.valueNormalized}%`,
        };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    return { W, H, nodeW, nodes: Object.entries(nodeBox), ribbons };
  }, [sankeyFlow]);

  const hoveredRibbon = sankeyGeometry.ribbons.find((r) => r.id === hoveredLinkId);

  return (
    <div data-testid="mycelium-kpi-sankey-panel" className="space-y-2 font-mono tabular-nums">
      {/* 4 Kybernetiske System B Indekser: α, Σ, γ, φ med tabulære tal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {kpiMetrics.map((m) => {
          const pct = Math.max(2, Math.min(100, Math.round(m.value * 100)));
          return (
            <div
              key={m.id}
              data-testid={`mycelium-kpi-card-${m.id}`}
              className="p-2 rounded bg-slate-900/90 border border-slate-800 space-y-1"
            >
              <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                <span className="truncate font-semibold text-slate-300">{m.titleDa}</span>
                <span className="shrink-0 text-slate-500">{m.symbol}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className={`text-sm font-bold tracking-tight tabular-nums ${m.valueColorClass}`}>
                  {m.value.toFixed(3)}
                </span>
                <span className="text-[11px] text-slate-400 truncate">{m.statusTextDa}</span>
              </div>
              <div className="w-full h-1 rounded bg-slate-950 overflow-hidden">
                <div className={`h-full ${m.barColorClass} transition-all duration-150`} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>{m.formulaNote}</span>
                <span>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* EU868 Duty-Cycle, α-historik & Regulatory Apoptosis Status */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-300 tabular-nums pt-0.5">
        <span className="inline-flex items-center gap-1">
          <Radio className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>
            EU868 g3 (27 dBm): <strong>{kpis.eu868DutyCyclePct.toFixed(2)}% / 10,00%</strong>
          </span>
        </span>
        <span className="text-slate-400">
          α-historik: <strong className="text-emerald-300">{aiHistory.slice(-4).map((v) => v.toFixed(2)).join(' → ')}</strong>
        </span>
        <span>
          {kpis.regulatoryApoptosisTriggered ? (
            <strong className="text-emerald-300">
              Apoptose: 80% Filter Lukket ({kpis.activeKillChainsPct}% Aktiv) · Amnesti P_s=1,00
            </strong>
          ) : (
            <>
              Aktive Kill-Chains: <strong className="text-slate-200">{kpis.activeKillChainsPct}%</strong>
            </>
          )}
        </span>
      </div>

      {/* White Box / Black Box ZKP + SBT Membran */}
      <div className="px-2 py-1 rounded bg-slate-950 border border-emerald-500/40 text-[11px] text-emerald-200 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="truncate">
          White Box (100 % Åben J/kg/s Ledger) · Black Box (0 KB Persondata · ZKP + SBT ERC-5192)
        </span>
      </div>

      {/* 3-Kolonners Kubisk Bézier CiK 2.0 Sankey-Diagram */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 tabular-nums">
          <span className="font-bold text-cyan-200 flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>Økonomiens Røntgenbillede (CiK 2.0 Sankey)</span>
          </span>
          <span className="text-slate-300 truncate">
            {hoveredRibbon
              ? hoveredRibbon.label
              : `${sankeyFlow.totalAllocatedJoules} J · ${sankeyFlow.totalAllocatedWaterMistKg} kg H₂O · ${sankeyFlow.totalAllocatedHepaM3h} m³/h`}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${sankeyGeometry.W} ${sankeyGeometry.H}`}
          className="w-full h-auto rounded bg-[#05070B] border border-slate-800/90"
        >
          <text x={8} y={11} className="fill-slate-400 text-[9.5px] font-mono">
            S1 Lokale Reserver
          </text>
          <text x={sankeyGeometry.W / 2} y={11} textAnchor="middle" className="fill-slate-400 text-[9.5px] font-mono">
            Gate 1 &amp; S2 Filter
          </text>
          <text x={sankeyGeometry.W - 8} y={11} textAnchor="end" className="fill-slate-400 text-[9.5px] font-mono">
            S3 CiK Sværm
          </text>
          {sankeyGeometry.ribbons.map((r) => (
            <path
              key={r.id}
              d={r.d}
              fill={r.color}
              stroke={r.color}
              fillOpacity={hoveredLinkId === r.id ? 0.68 : hoveredLinkId !== null ? 0.14 : 0.36}
              strokeWidth={hoveredLinkId === r.id ? 1.1 : 0.4}
              onMouseEnter={() => setHoveredLinkId(r.id)}
              onMouseLeave={() => setHoveredLinkId(null)}
              className="cursor-pointer transition-opacity"
            />
          ))}
          {sankeyGeometry.nodes.map(([id, n]) => (
            <g key={id}>
              <rect x={n.x} y={n.y} width={sankeyGeometry.nodeW} height={n.h} rx={2} fill={n.color} />
              <text
                x={
                  n.col === 0
                    ? n.x + sankeyGeometry.nodeW + 4
                    : n.col === 2
                    ? n.x - 4
                    : n.x + sankeyGeometry.nodeW / 2
                }
                y={n.y + Math.min(n.h / 2 + 3, n.h - 1)}
                textAnchor={n.col === 0 ? 'start' : n.col === 2 ? 'end' : 'middle'}
                className="fill-slate-100 text-[11px] font-mono font-bold"
              >
                {`${n.label} (${n.val}%)`}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
