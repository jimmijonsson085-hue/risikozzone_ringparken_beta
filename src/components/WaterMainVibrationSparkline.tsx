import React, { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { WaterMain6HourVibrationPoint } from '../services/waterMainPhysicsService';

export interface WaterMainVibrationSparklineProps {
  points: WaterMain6HourVibrationPoint[];
  currentPpvMmPerSec: number;
  className?: string;
}

export const WaterMainVibrationSparkline: React.FC<WaterMainVibrationSparklineProps> = ({
  points,
  currentPpvMmPerSec,
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartModel = useMemo(() => {
    const safePoints = points.length > 0 ? points : [];
    const width = 320;
    const height = 52;
    const padX = 10;
    const padY = 6;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const maxVal = Math.max(
      30,
      ...safePoints.map((p) => p.pipePpvMmPerSec),
      currentPpvMmPerSec
    );
    const yCeiling = maxVal > 44 ? Math.max(58, maxVal * 1.1) : Math.max(32, maxVal * 1.15);

    const coords = safePoints.map((p, idx) => {
      const x =
        safePoints.length <= 1
          ? padX + innerW / 2
          : padX + (idx / (safePoints.length - 1)) * innerW;
      const clampedVal = Math.max(0, p.pipePpvMmPerSec);
      const y = padY + innerH - (clampedVal / yCeiling) * innerH;
      return { ...p, x, y };
    });

    const linePath = coords
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');
    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`
        : '';

    const y25 = padY + innerH - (25 / yCeiling) * innerH;
    const y50 = padY + innerH - (50 / yCeiling) * innerH;
    const show50Line = yCeiling >= 48;

    const firstVal = safePoints[0]?.pipePpvMmPerSec ?? currentPpvMmPerSec;
    const delta = Number((currentPpvMmPerSec - firstVal).toFixed(1));

    return {
      width,
      height,
      padX,
      padY,
      innerH,
      yCeiling,
      coords,
      linePath,
      areaPath,
      y25,
      y50,
      show50Line,
      delta,
    };
  }, [points, currentPpvMmPerSec]);

  if (chartModel.coords.length === 0) {
    return null;
  }

  const strokeColor =
    currentPpvMmPerSec > 50
      ? '#f43f5e'
      : currentPpvMmPerSec >= 25
      ? '#f59e0b'
      : '#38bdf8';

  const activePoint =
    hoveredIdx !== null && chartModel.coords[hoveredIdx]
      ? chartModel.coords[hoveredIdx]
      : chartModel.coords[chartModel.coords.length - 1];

  return (
    <div
      data-testid="water-main-6h-vibration-sparkline"
      className={`p-1.5 rounded bg-black/35 border border-white/10 font-mono text-[11px] tabular-nums space-y-1 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-slate-300 font-semibold">
          <Activity className="w-3 h-3 text-cyan-400 shrink-0" aria-hidden="true" />
          <span>6t rørvibration (PPV mm/s)</span>
        </span>
        <span
          className={`font-bold ${
            currentPpvMmPerSec > 50
              ? 'text-rose-300'
              : currentPpvMmPerSec >= 25
              ? 'text-amber-300'
              : 'text-cyan-300'
          }`}
        >
          {chartModel.delta >= 0 ? `+${chartModel.delta.toFixed(1)}` : chartModel.delta.toFixed(1)} mm/s (6t)
        </span>
      </div>

      <svg
        viewBox={`0 0 ${chartModel.width} ${chartModel.height}`}
        className="w-full h-[52px] overflow-visible select-none"
        role="img"
        aria-label={`Sparkline for de seneste 6 timers rørvibrationer: aktuel ${currentPpvMmPerSec.toFixed(1)} mm/s`}
      >
        <defs>
          <linearGradient id="wmSparkFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.34} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line
          x1={chartModel.padX}
          y1={chartModel.padY + chartModel.innerH}
          x2={chartModel.width - chartModel.padX}
          y2={chartModel.padY + chartModel.innerH}
          stroke="rgba(148,163,184,0.22)"
          strokeWidth={1}
        />

        {/* DIN 4150-3 Eternit 25 mm/s warning line */}
        <line
          x1={chartModel.padX}
          y1={chartModel.y25}
          x2={chartModel.width - chartModel.padX}
          y2={chartModel.y25}
          stroke="rgba(245,158,11,0.55)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* DIN 4150-3 50 mm/s critical line when within range */}
        {chartModel.show50Line && (
          <line
            x1={chartModel.padX}
            y1={chartModel.y50}
            x2={chartModel.width - chartModel.padX}
            y2={chartModel.y50}
            stroke="rgba(244,63,94,0.65)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        <path d={chartModel.areaPath} fill="url(#wmSparkFillGrad)" />
        <path
          d={chartModel.linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {chartModel.coords.map((pt, idx) => {
          const isCurrent = pt.isCurrentHour;
          const isHovered = hoveredIdx === idx;
          const ptColor =
            pt.pipePpvMmPerSec > 50
              ? '#f43f5e'
              : pt.pipePpvMmPerSec >= 25
              ? '#f59e0b'
              : '#38bdf8';
          return (
            <g
              key={`wm-spk-${pt.offsetHours}-${pt.hourIndex}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-crosshair"
            >
              <circle cx={pt.x} cy={pt.y} r={9} fill="transparent" />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isCurrent || isHovered ? 3.5 : 2.3}
                fill={ptColor}
                stroke={isCurrent || isHovered ? '#ffffff' : '#090d16'}
                strokeWidth={1.2}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>
          {chartModel.coords[0]?.hourLabel} → {chartModel.coords[chartModel.coords.length - 1]?.hourLabel}
        </span>
        <span className="text-slate-200 truncate">
          {activePoint.isCurrentHour ? 'Nu' : activePoint.hourLabel}:{' '}
          <strong className="text-white">{activePoint.pipePpvMmPerSec.toFixed(1)} mm/s</strong> (
          {activePoint.precipitationMm.toFixed(1)} mm)
        </span>
      </div>
    </div>
  );
};
