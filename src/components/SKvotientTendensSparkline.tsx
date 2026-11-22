import React, { useState } from 'react';

export interface SparklineHourPoint {
  hourIndex: number;
  hourLabel: string;
  sumQuotient: number;
}

export interface SKvotientTendensSparklineProps {
  points: SparklineHourPoint[];
  onSelectHour?: (hourIndex: number) => void;
  label?: string;
  svgWidth?: number;
  svgHeight?: number;
  exceedanceColorHex?: string;
  normalColorHex?: string;
  className?: string;
}

export const SKvotientTendensSparkline: React.FC<SKvotientTendensSparklineProps> = ({
  points,
  onSelectHour,
  label = 'S-kvotient tendens',
  svgWidth = 64,
  svgHeight = 18,
  exceedanceColorHex = '#f43f5e',
  normalColorHex = '#38bdf8',
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!points || points.length === 0) return null;

  const padX = 3;
  const padY = 2.5;
  const innerW = svgWidth - padX * 2;
  const innerH = svgHeight - padY * 2;
  const maxDomainS = Math.max(2.0, ...points.map((p) => p.sumQuotient * 1.1));

  const mapX = (idx: number) =>
    padX + (idx / Math.max(1, points.length - 1)) * innerW;
  const mapY = (sVal: number) => {
    const clamped = Math.max(0, Math.min(maxDomainS, sVal));
    return padY + innerH - (clamped / maxDomainS) * innerH;
  };

  const thresholdY = mapY(1.0);

  // Build piecewise line segments so any portion where S > 1.0 is colored distinctly (#f43f5e)
  // including exact linear interpolation when a segment crosses S = 1.0!
  interface ColoredSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    exceedsOne: boolean;
  }

  const segments: ColoredSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const x1 = mapX(i);
    const y1 = mapY(p1.sumQuotient);
    const x2 = mapX(i + 1);
    const y2 = mapY(p2.sumQuotient);

    const s1 = p1.sumQuotient;
    const s2 = p2.sumQuotient;

    if (s1 > 1.0 && s2 > 1.0) {
      segments.push({ x1, y1, x2, y2, exceedsOne: true });
    } else if (s1 <= 1.0 && s2 <= 1.0) {
      segments.push({ x1, y1, x2, y2, exceedsOne: false });
    } else {
      // Crosses S = 1.0 between i and i + 1: split at exact crossing fraction t
      const denom = s2 - s1;
      const t = Math.abs(denom) > 1e-6 ? Math.max(0, Math.min(1, (1.0 - s1) / denom)) : 0.5;
      const xCross = x1 + t * (x2 - x1);
      const yCross = thresholdY;
      segments.push({
        x1,
        y1,
        x2: xCross,
        y2: yCross,
        exceedsOne: s1 > 1.0,
      });
      segments.push({
        x1: xCross,
        y1: yCross,
        x2,
        y2,
        exceedsOne: s2 > 1.0,
      });
    }
  }

  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const anyExceeds = points.some((p) => p.sumQuotient > 1.0);

  return (
    <div
      data-s-kvotient-sparkline="true"
      className={`relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1B2433] border ${
        anyExceeds ? 'border-rose-500/60' : 'border-[#2D3B50]'
      } font-mono tabular-nums select-none ${className}`}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <span className="text-[11px] text-slate-300 whitespace-nowrap">{label}</span>

      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="overflow-visible block shrink-0"
        role="img"
        aria-label={`${label}: ${points
          .map((p) => `kl. ${p.hourLabel} S=${p.sumQuotient.toFixed(2)}`)
          .join(', ')}`}
      >
        {/* S = 1.0 statutory limit reference line */}
        <line
          x1={0}
          y1={thresholdY}
          x2={svgWidth}
          y2={thresholdY}
          stroke="#f43f5e"
          strokeWidth="0.65"
          strokeDasharray="2 1.5"
          strokeOpacity={0.75}
        />

        {/* Piecewise segments with #f43f5e highlighting wherever S > 1.0 */}
        {segments.map((seg, idx) => (
          <line
            key={`seg-${idx}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={seg.exceedsOne ? exceedanceColorHex : normalColorHex}
            strokeWidth={seg.exceedsOne ? 2.15 : 1.55}
            strokeLinecap="round"
          />
        ))}

        {/* Interactive data points + hover hit targets */}
        {points.map((pt, idx) => {
          const cx = mapX(idx);
          const cy = mapY(pt.sumQuotient);
          const isOverOne = pt.sumQuotient > 1.0;
          const isHovered = hoveredIdx === idx;
          return (
            <g key={`pt-${pt.hourIndex}-${idx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 3.2 : isOverOne ? 2.1 : 1.6}
                fill={
                  isHovered
                    ? '#fde047'
                    : isOverOne
                    ? exceedanceColorHex
                    : normalColorHex
                }
                stroke="#0F141D"
                strokeWidth="0.8"
              />
              <circle
                cx={cx}
                cy={cy}
                r={6}
                fill="transparent"
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                aria-label={`Kl. ${pt.hourLabel}: S-kvotient ${pt.sumQuotient.toFixed(2)}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectHour?.(pt.hourIndex);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectHour?.(pt.hourIndex);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Interactive Hover Tooltip showing specific S-quotient and hour label */}
      {hoveredPoint && (
        <div
          role="tooltip"
          data-testid="s-kvotient-sparkline-tooltip"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 px-2.5 py-1.5 rounded bg-[#212C3E] border border-[#36465E] shadow-xl whitespace-nowrap text-[11px] font-mono tabular-nums"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-200 font-semibold">
              kl. {hoveredPoint.hourLabel}
            </span>
            <span className="text-slate-500">·</span>
            <span
              className="font-bold"
              style={{
                color:
                  hoveredPoint.sumQuotient > 1.0
                    ? exceedanceColorHex
                    : normalColorHex,
              }}
            >
              S = {hoveredPoint.sumQuotient.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {hoveredPoint.sumQuotient > 1.0
              ? 'Overskrider grænseværdi (S > 1,0)'
              : 'Under grænseværdi (S ≤ 1,0)'}
          </div>
        </div>
      )}
    </div>
  );
};
