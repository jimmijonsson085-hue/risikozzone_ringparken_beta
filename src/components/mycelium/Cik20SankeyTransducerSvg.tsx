import React, { useState } from 'react';
import { Cik20AllocationState } from '../../types/myceliumAlert';

export interface Cik20SankeyTransducerSvgProps {
  cik20: Cik20AllocationState;
  onSelectReceptor?: (receptorId: string) => void;
}

/**
 * Vector Sankey SVG Transducer visualizing Calculation in Kind 2.0 (CiK 2.0):
 * Non-monetary physical resource pools -> BFT Gate 1 Cybernetic Transducer -> Exposed Receptor Sectors.
 */
export const Cik20SankeyTransducerSvg: React.FC<Cik20SankeyTransducerSvgProps> = ({
  cik20,
  onSelectReceptor,
}) => {
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  const pools = cik20.pools;
  if (pools.length === 0) {
    return (
      <div className="p-3 rounded bg-[#07090E] border border-slate-800 text-xs font-mono text-slate-400">
        Ingen CiK 2.0 ressourcepuljer aktive i øjeblikket.
      </div>
    );
  }

  // Unique receptor targets in stable order
  const receptorTargets: Array<{
    receptorId: string;
    code: string;
    name: string;
    urgencyWeight: number;
  }> = [];
  const seenTargets: Record<string, boolean> = {};
  for (const link of cik20.links) {
    if (!seenTargets[link.targetReceptorId]) {
      seenTargets[link.targetReceptorId] = true;
      receptorTargets.push({
        receptorId: link.targetReceptorId,
        code: link.targetCode,
        name: link.targetName,
        urgencyWeight: link.urgencyWeight,
      });
    }
  }

  const svgW = 540;
  const svgH = 216;
  const leftX = 14;
  const leftW = 128;
  const midX = 226;
  const midW = 84;
  const rightX = 396;
  const rightW = 130;

  const poolRowH = 38;
  const poolGap = 11;
  const targetRowH = Math.min(44, Math.floor((svgH - 24) / Math.max(1, receptorTargets.length)) - 8);
  const targetGap = 10;

  const poolY = (idx: number) => 16 + idx * (poolRowH + poolGap);
  const targetY = (idx: number) => 18 + idx * (targetRowH + targetGap);
  const midBoxY = 38;
  const midBoxH = svgH - 76;

  return (
    <div
      data-testid="cik20-sankey-transducer"
      className="rounded-md bg-[#07090E] border border-slate-800 p-2.5 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
        <span className="font-semibold text-cyan-200">
          Calculation in Kind 2.0 (CiK 2.0) — Fysisk Ressource-Transducer
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-300">
          Allokeret: {cik20.systemEfficiencyPct}% in-kind
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto min-w-[440px] select-none"
          role="img"
          aria-label="Calculation in Kind 2.0 Sankey Transducer"
        >
          {/* Left -> Center Sankey ribbons (Physical Pools to BFT Transducer) */}
          {pools.map((pool, pIdx) => {
            const y0 = poolY(pIdx) + poolRowH / 2;
            const yMid =
              midBoxY +
              ((pIdx + 0.5) / Math.max(1, pools.length)) * midBoxH;
            const strokeW = Math.max(
              3,
              (pool.allocatedAmount / Math.max(1, pool.totalAvailableCapacity)) * 12
            );
            const pathD = `M ${leftX + leftW} ${y0} C ${leftX + leftW + 42} ${y0}, ${
              midX - 42
            } ${yMid}, ${midX} ${yMid}`;
            return (
              <path
                key={`in-${pool.key}`}
                d={pathD}
                fill="none"
                stroke={pool.colorHex}
                strokeOpacity={0.48}
                strokeWidth={strokeW}
              />
            );
          })}

          {/* Center -> Right Sankey ribbons (BFT Transducer to Receptor Sectors) */}
          {cik20.links.map((link) => {
            const pIdx = pools.findIndex((p) => p.key === link.resourceKey);
            const tIdx = receptorTargets.findIndex(
              (t) => t.receptorId === link.targetReceptorId
            );
            if (pIdx < 0 || tIdx < 0) return null;
            const yStart =
              midBoxY +
              ((pIdx + 0.5) / Math.max(1, pools.length)) * midBoxH;
            const yEnd =
              targetY(tIdx) +
              ((pIdx + 0.5) / Math.max(1, pools.length)) * targetRowH;
            const isHovered = hoveredLinkId === link.linkId;
            const strokeW = Math.max(2, (link.shareOfPoolPct / 100) * 9);
            const d = `M ${midX + midW} ${yStart} C ${midX + midW + 46} ${yStart}, ${
              rightX - 46
            } ${yEnd}, ${rightX} ${yEnd}`;

            return (
              <path
                key={link.linkId}
                d={d}
                fill="none"
                stroke={link.colorHex}
                strokeOpacity={isHovered ? 0.95 : 0.42}
                strokeWidth={isHovered ? strokeW + 2 : strokeW}
                onMouseEnter={() => setHoveredLinkId(link.linkId)}
                onMouseLeave={() => setHoveredLinkId(null)}
                className="cursor-pointer transition-opacity"
              >
                <title>
                  {`${link.resourceLabelDa} → ${link.targetCode}: ${link.allocatedPhysicalUnits} ${link.unit} (${link.shareOfPoolPct}%)`}
                </title>
              </path>
            );
          })}

          {/* Left Column: Physical Mitigation Pools */}
          {pools.map((pool, idx) => {
            const y = poolY(idx);
            return (
              <g key={pool.key} transform={`translate(${leftX}, ${y})`}>
                <rect
                  width={leftW}
                  height={poolRowH}
                  rx={4}
                  fill="#0B0E17"
                  stroke={pool.colorHex}
                  strokeWidth={1.2}
                />
                <text
                  x={7}
                  y={14}
                  className="fill-slate-100 text-[11px] font-mono font-bold"
                >
                  {pool.labelDa.slice(0, 20)}
                </text>
                <text
                  x={7}
                  y={28}
                  className="fill-cyan-300 text-[11px] font-mono"
                >
                  {pool.allocatedAmount}/{pool.totalAvailableCapacity} {pool.unit}
                </text>
              </g>
            );
          })}

          {/* Center Node: VSM System 3* / BFT Gate 1 Cybernetic Transducer */}
          <g transform={`translate(${midX}, ${midBoxY})`}>
            <rect
              width={midW}
              height={midBoxH}
              rx={5}
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth={1.5}
            />
            <text
              x={midW / 2}
              y={midBoxH / 2 - 14}
              textAnchor="middle"
              className="fill-cyan-300 text-[11px] font-mono font-bold"
            >
              SYSTEM B
            </text>
            <text
              x={midW / 2}
              y={midBoxH / 2}
              textAnchor="middle"
              className="fill-white text-[11px] font-mono font-semibold"
            >
              BFT GATE 1
            </text>
            <text
              x={midW / 2}
              y={midBoxH / 2 + 13}
              textAnchor="middle"
              className="fill-emerald-300 text-[11px] font-mono"
            >
              CiK 2.0 Ruter
            </text>
            <text
              x={midW / 2}
              y={midBoxH / 2 + 25}
              textAnchor="middle"
              className="fill-slate-400 text-[9.5px] font-mono"
            >
              0 DKK Prisstøj
            </text>
          </g>

          {/* Right Column: Disputed Receptor Sectors */}
          {receptorTargets.map((target, idx) => {
            const y = targetY(idx);
            const recLinks = cik20.links.filter(
              (l) => l.targetReceptorId === target.receptorId
            );
            const water = recLinks.find((l) => l.resourceKey === 'water_mist_l_min');
            const hepa = recLinks.find((l) => l.resourceKey === 'hepa_h14_m3_h');
            return (
              <g
                key={target.receptorId}
                transform={`translate(${rightX}, ${y})`}
                onClick={() => onSelectReceptor?.(target.receptorId)}
                className="cursor-pointer"
              >
                <rect
                  width={rightW}
                  height={targetRowH}
                  rx={4}
                  fill="#0B0E17"
                  stroke="#fb7185"
                  strokeWidth={1.2}
                />
                <text
                  x={7}
                  y={14}
                  className="fill-white text-[11px] font-mono font-bold"
                >
                  {target.code} · Vægt {target.urgencyWeight.toFixed(1)}
                </text>
                <text
                  x={7}
                  y={27}
                  className="fill-emerald-300 text-[11px] font-mono"
                >
                  {water ? `${water.allocatedPhysicalUnits} L/m` : ''} ·{' '}
                  {hepa ? `${hepa.allocatedPhysicalUnits} m³/h` : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
        {cik20.summaryDa}
      </p>
    </div>
  );
};
