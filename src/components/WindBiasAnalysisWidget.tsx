/**
 * @file src/components/WindBiasAnalysisWidget.tsx
 * @description 'Wind-Bias Analysis' Widget (Item 7):
 * Plotter statistisk vindretnings-bias over de seneste 24 timer mod den modellerede
 * spredningsfanes hovedbane (plume path) pr. kompas-sektor, så brugeren visuelt kan se,
 * om den aktuelle spredningsmodel overestimerer eller underestimerer eksponeringen i bestemte sektorer.
 */

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Compass, Navigation, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import {
  HourlyWeatherPoint,
  PuffAccumulationResult,
} from '../types/dispersion';
import {
  WindBiasSectorStat,
  computeWindBias24hAnalysis,
} from '../utils/windBiasSectorAnalysis';

export interface WindBiasAnalysisWidgetProps {
  hours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
  puff24h: PuffAccumulationResult;
  selectedReceptorId?: string | null;
  onSelectHour?: (hourIndex: number) => void;
  compact?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildSectorWedgePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
): string {
  const p1 = polarToCartesian(cx, cy, outerR, startDeg);
  const p2 = polarToCartesian(cx, cy, outerR, endDeg);
  const p3 = polarToCartesian(cx, cy, innerR, endDeg);
  const p4 = polarToCartesian(cx, cy, innerR, startDeg);
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${outerR} ${outerR} 0 0 1 ${p2.x.toFixed(
    1
  )} ${p2.y.toFixed(1)} L ${p3.x.toFixed(1)} ${p3.y.toFixed(1)} A ${innerR} ${innerR} 0 0 0 ${p4.x.toFixed(
    1
  )} ${p4.y.toFixed(1)} Z`;
}

export const WindBiasAnalysisWidget: React.FC<WindBiasAnalysisWidgetProps> = ({
  hours,
  currentWeather,
  dateIso,
  puff24h,
  selectedReceptorId,
  onSelectHour,
  compact = false,
}) => {
  const [selectedSectorIdx, setSelectedSectorIdx] = useState<number | null>(null);

  const analysis = useMemo(
    () =>
      computeWindBias24hAnalysis({
        hours,
        currentWeather,
        dateIso,
        puff24h,
        selectedReceptorId,
      }),
    [hours, currentWeather, dateIso, puff24h, selectedReceptorId]
  );

  const activeSector: WindBiasSectorStat = useMemo(() => {
    if (selectedSectorIdx !== null && analysis.sectors[selectedSectorIdx]) {
      return analysis.sectors[selectedSectorIdx];
    }
    return analysis.sectors[analysis.currentSectorIndex] || analysis.dominant24hSector;
  }, [analysis, selectedSectorIdx]);

  const barChartData = useMemo(
    () =>
      analysis.sectors.map((s) => ({
        sectorLabel: s.sectorLabel,
        exposureDeltaS: s.exposureDeltaS,
        meanSignedDirBiasDeg: s.meanSignedDirBiasDeg,
        hoursCount: s.hoursCount,
        verdict: s.verdict,
        isCurrentPlumeSector: s.isCurrentPlumeSector,
      })),
    [analysis.sectors]
  );

  const cx = 120;
  const cy = 120;
  const maxR = 88;
  const plumeTip = polarToCartesian(cx, cy, maxR + 6, analysis.currentPlumePathToDeg);
  const observedTipDeg =
    analysis.hourlyTrajectory[currentWeather.hourIndex]?.observedPlumeToDeg ??
    analysis.currentPlumePathToDeg;
  const observedTip = polarToCartesian(cx, cy, maxR - 6, observedTipDeg);

  return (
    <div
      data-testid="wind-bias-analysis-widget"
      className="p-3.5 bg-[#0F1623] border border-cyan-500/45 rounded-lg space-y-3 font-mono text-xs shadow-lg"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500 text-slate-950 text-[11px] font-extrabold uppercase tracking-wide">
              <Compass className="w-3 h-3 shrink-0" />
              <span>Wind-Bias Analysis (24t Sektor-Afvigelse)</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                analysis.overallVerdict === 'OVERESTIMATES'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : analysis.overallVerdict === 'UNDERESTIMATES'
                  ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                  : 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
              }`}
            >
              {analysis.overallVerdict === 'OVERESTIMATES'
                ? `Model Overestimerer (+${analysis.overallExposureBiasS.toFixed(2)} S)`
                : analysis.overallVerdict === 'UNDERESTIMATES'
                ? `Model Underestimerer (${analysis.overallExposureBiasS.toFixed(2)} S)`
                : 'Model Afstemt (ΔS ≈ 0)'}
            </span>
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-white pt-0.5">
            Statistisk Vindretnings-Bias (24t) vs. Modelleret Fanevej ({analysis.currentPlumePathToDeg}°)
          </h4>
        </div>

        <div className="text-[11px] text-slate-300 text-right tabular-nums">
          <div>
            Snit Retnings-Bias:{' '}
            <strong className="text-amber-300">
              {analysis.overallMeanSignedDirBiasDeg >= 0 ? '+' : ''}
              {analysis.overallMeanSignedDirBiasDeg.toFixed(1)}°
            </strong>
          </div>
          <div className="text-slate-400">
            Kl. {currentWeather.hourLabel} · Mod{' '}
            <strong className="text-cyan-300">{analysis.currentPlumePathToDeg}°</strong>
          </div>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
        <div className="p-2 rounded bg-[#080C14] border border-slate-800">
          <div className="text-slate-400 flex items-center justify-between">
            <span>DOMINERENDE SEKTOR</span>
            <Navigation className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-sm font-extrabold text-cyan-200 mt-0.5">
            Mod {analysis.dominant24hSector.sectorLabel} ({analysis.dominant24hSector.hoursCount}t ·{' '}
            {analysis.dominant24hSector.frequencyPct}%)
          </div>
        </div>

        <div className="p-2 rounded bg-[#080C14] border border-sky-500/35">
          <div className="text-slate-400 flex items-center justify-between">
            <span>MEST OVERESTIMERET</span>
            <TrendingUp className="w-3 h-3 text-sky-400" />
          </div>
          <div className="text-sm font-extrabold text-sky-300 mt-0.5">
            {analysis.mostOverestimatedSector
              ? `${analysis.mostOverestimatedSector.sectorLabel} (+${analysis.mostOverestimatedSector.exposureDeltaS.toFixed(
                  2
                )} S)`
              : 'Ingen (+0.00)'}
          </div>
        </div>

        <div className="p-2 rounded bg-[#080C14] border border-rose-500/35">
          <div className="text-slate-400 flex items-center justify-between">
            <span>MEST UNDERESTIMERET</span>
            <TrendingDown className="w-3 h-3 text-rose-400" />
          </div>
          <div className="text-sm font-extrabold text-rose-300 mt-0.5">
            {analysis.mostUnderestimatedSector
              ? `${analysis.mostUnderestimatedSector.sectorLabel} (${analysis.mostUnderestimatedSector.exposureDeltaS.toFixed(
                  2
                )} S)`
              : 'Ingen (0.00)'}
          </div>
        </div>
      </div>

      {/* Dual Visual Plot: Polar Sector Bias Rose vs Plume Path + Diverging Sector Exposure Delta */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        {/* Left: Polar 8-Sector Statistical Wind Bias vs Modeled Plume Path SVG */}
        <div className="lg:col-span-5 p-2 rounded bg-[#080C14] border border-slate-800 flex flex-col items-center">
          <div className="text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
            <Scale className="w-3 h-3 text-cyan-400" />
            <span>Sektor-Bias vs. Fanevej (Klik Sektor)</span>
          </div>
          <svg
            viewBox="0 0 240 240"
            className={compact ? 'w-48 h-48 select-none' : 'w-56 h-56 select-none'}
            aria-label="Polar vind-bias diagram mod modelleret spredningsfane"
          >
            {/* Concentric Reference Circles */}
            {[28, 56, 88].map((r) => (
              <circle
                key={`ring-${r}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="#1E293B"
                strokeWidth={1}
                strokeDasharray={r === 56 ? '3 3' : undefined}
              />
            ))}
            {/* Compass Crosshairs */}
            {[0, 45, 90, 135].map((deg) => {
              const pA = polarToCartesian(cx, cy, maxR + 4, deg);
              const pB = polarToCartesian(cx, cy, maxR + 4, deg + 180);
              return (
                <line
                  key={`axis-${deg}`}
                  x1={pA.x}
                  y1={pA.y}
                  x2={pB.x}
                  y2={pB.y}
                  stroke="#1E293B"
                  strokeWidth={0.9}
                />
              );
            })}

            {/* 8 Directional Sectors */}
            {analysis.sectors.map((sec) => {
              const startDeg = sec.plumeTargetCenterDeg - 21;
              const endDeg = sec.plumeTargetCenterDeg + 21;
              const radiusScale = Math.max(
                18,
                Math.min(maxR, 18 + (sec.frequencyPct / 65) * (maxR - 18))
              );
              const isSelected = activeSector.sectorIndex === sec.sectorIndex;
              const fill =
                sec.hoursCount === 0
                  ? 'rgba(51, 65, 85, 0.22)'
                  : sec.verdict === 'OVERESTIMATES'
                  ? 'rgba(56, 189, 248, 0.42)'
                  : sec.verdict === 'UNDERESTIMATES'
                  ? 'rgba(244, 63, 94, 0.48)'
                  : 'rgba(16, 185, 129, 0.36)';
              const stroke = isSelected
                ? '#FACC15'
                : sec.hoursCount === 0
                ? '#334155'
                : sec.verdict === 'OVERESTIMATES'
                ? '#38BDF8'
                : sec.verdict === 'UNDERESTIMATES'
                ? '#FB7185'
                : '#34D399';
              const lblPos = polarToCartesian(cx, cy, maxR + 14, sec.plumeTargetCenterDeg);

              return (
                <g
                  key={`sec-wedge-${sec.sectorLabel}`}
                  onClick={() => setSelectedSectorIdx(sec.sectorIndex)}
                  className="cursor-pointer"
                >
                  <path
                    d={buildSectorWedgePath(cx, cy, 12, radiusScale, startDeg, endDeg)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected || sec.isCurrentPlumeSector ? 2.2 : 1.1}
                  />
                  <text
                    x={lblPos.x}
                    y={lblPos.y + 3}
                    textAnchor="middle"
                    className={`text-[10px] font-mono font-bold ${
                      sec.isCurrentPlumeSector ? 'fill-cyan-300' : 'fill-slate-400'
                    }`}
                  >
                    {sec.sectorLabel}
                  </text>
                </g>
              );
            })}

            {/* Modeled Plume Path Vector (Solid Cyan Arrow) */}
            <line
              x1={cx}
              y1={cy}
              x2={plumeTip.x}
              y2={plumeTip.y}
              stroke="#22D3EE"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={plumeTip.x} cy={plumeTip.y} r={4} fill="#22D3EE" />

            {/* Station Observed Wind Plume Vector (Dashed Amber Line) */}
            <line
              x1={cx}
              y1={cy}
              x2={observedTip.x}
              y2={observedTip.y}
              stroke="#FBBF24"
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={5} fill="#0F1623" stroke="#FFFFFF" strokeWidth={1.6} />
          </svg>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] mt-1">
            <span className="inline-flex items-center gap-1 text-cyan-300">
              <span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Modelleret Fanevej
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" />{' '}
              Station Vektor
            </span>
            <span className="inline-flex items-center gap-1 text-sky-300">
              <span className="w-2.5 h-2.5 bg-sky-400/50 border border-sky-400 inline-block" />{' '}
              Overestimerer
            </span>
            <span className="inline-flex items-center gap-1 text-rose-300">
              <span className="w-2.5 h-2.5 bg-rose-500/50 border border-rose-400 inline-block" />{' '}
              Underestimerer
            </span>
          </div>
        </div>

        {/* Right: Diverging Sector Exposure Bias Chart + Active Sector Breakdown */}
        <div className="lg:col-span-7 space-y-2">
          <div className="p-2 rounded bg-[#080C14] border border-slate-800">
            <div className="text-[11px] font-bold text-slate-300 mb-1">
              Eksponerings-Afvigelse ΔS pr. Sektor (+ Overestimerer · − Underestimerer)
            </div>
            <div className={compact ? 'h-40 w-full' : 'h-44 w-full'}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 6, right: 10, left: -16, bottom: 2 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="sectorLabel"
                    tick={{ fill: '#CBD5E1', fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090D16',
                      borderColor: '#06B6D4',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#F8FAFC',
                    }}
                    formatter={(val: unknown) => {
                      const num = Number(val);
                      return [
                        `${num >= 0 ? '+' : ''}${num.toFixed(2)} S (${
                          num > 0.02
                            ? 'Model Overestimerer'
                            : num < -0.02
                            ? 'Model Underestimerer'
                            : 'Afstemt'
                        })`,
                        'Bias ΔS',
                      ];
                    }}
                  />
                  <ReferenceLine y={0} stroke="#64748B" strokeWidth={1.2} />
                  <Bar dataKey="exposureDeltaS" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                    {barChartData.map((entry, idx) => (
                      <Cell
                        key={`cell-${entry.sectorLabel}-${idx}`}
                        fill={
                          entry.verdict === 'OVERESTIMATES'
                            ? '#38BDF8'
                            : entry.verdict === 'UNDERESTIMATES'
                            ? '#F43F5E'
                            : '#10B981'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Selected Sector Detail Card */}
          <div className="p-2.5 rounded bg-[#080C14] border border-cyan-500/35 text-[11px] space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-white">
                Valgt Sektor: Mod {activeSector.sectorLabel} ({activeSector.plumeTargetCenterDeg}°)
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-bold ${
                  activeSector.verdict === 'OVERESTIMATES'
                    ? 'bg-sky-500/20 text-sky-300'
                    : activeSector.verdict === 'UNDERESTIMATES'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {activeSector.verdict === 'OVERESTIMATES'
                  ? `OVERESTIMERER (+${activeSector.exposureDeltaPct}%)`
                  : activeSector.verdict === 'UNDERESTIMATES'
                  ? `UNDERESTIMERER (${activeSector.exposureDeltaPct}%)`
                  : 'AFSTEMT (±0%)'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-slate-300 tabular-nums pt-0.5">
              <div>
                Timer: <strong className="text-white">{activeSector.hoursCount}/24t</strong> (
                {activeSector.frequencyPct}%)
              </div>
              <div>
                Retn.-Bias:{' '}
                <strong className="text-amber-300">
                  {activeSector.meanSignedDirBiasDeg >= 0 ? '+' : ''}
                  {activeSector.meanSignedDirBiasDeg}°
                </strong>
              </div>
              <div>
                S Model / Obs:{' '}
                <strong className="text-cyan-300">
                  {activeSector.modeledMeanSumQuotient.toFixed(2)} /{' '}
                  {activeSector.stationAdjustedMeanSumQuotient.toFixed(2)}
                </strong>
              </div>
            </div>
            {onSelectHour && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const peakBiasHour = [...analysis.hourlyTrajectory].sort(
                      (a, b) => Math.abs(b.exposureDeltaS) - Math.abs(a.exposureDeltaS)
                    )[0];
                    if (peakBiasHour) onSelectHour(peakBiasHour.hourIndex);
                  }}
                  className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/60 text-cyan-200 text-[10.5px] font-bold cursor-pointer"
                >
                  Hop til time med størst retnings-bias →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
