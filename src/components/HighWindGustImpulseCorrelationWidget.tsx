/**
 * @file src/components/HighWindGustImpulseCorrelationWidget.tsx
 * @description Visualiserer den statistiske korrelation mellem kraftige vindstød (>10 m/s)
 * og spids-impulsstøj (dB(A)) fra nedrivningsmaskiner i 'Støj & Støv'-panelet
 * for at identificere højrisiko driftsscenarier og målrettede afværgeforanstaltninger.
 */

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Crosshair,
  FilePlus2,
  Flame,
  Map as MapIcon,
  ShieldCheck,
  Volume2,
  Wind,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
} from '../types/dispersion';
import {
  computeHighWindGustImpulseAnalysis,
  DEFAULT_DEMOLITION_MACHINERY_PROFILES,
  OperationalRiskTier,
} from '../utils/gustNoiseStatistics';
import { FormalNoiseReportPayload } from './HighFrequencyNoiseSpikeDetectorWidget';
import { useAcousticWeighting } from '../context/AcousticWeightingContext';

export interface HighWindGustImpulseCorrelationWidgetProps {
  weatherHours: HourlyWeatherPoint[];
  selectedHourIndex: number;
  onSelectHour: (hourIndex: number) => void;
  sources: DemolitionSourceNode[];
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  dateIso: string;
  selectedReceptorName?: string;
  selectedReceptorAddress?: string;
  selectedReceptorPosition?: LatLngPoint;
  onApplyMachineLwa?: (lwaDb: number) => void;
  onActivateAcousticHazardHeatmap?: () => void;
  onFileFormalNoiseReport?: (
    payload: FormalNoiseReportPayload
  ) => Promise<AlgedonicObservation | null>;
}

const RISK_BADGE_MAP: Record<
  OperationalRiskTier,
  { label: string; badgeClass: string; dotColor: string }
> = {
  STOP_WORK: {
    label: 'STOP-ARBEJDE',
    badgeClass: 'bg-rose-950/90 text-rose-200 border-rose-500/80',
    dotColor: '#f43f5e',
  },
  HIGH_RISK: {
    label: 'HØJ RISIKO',
    badgeClass: 'bg-amber-950/90 text-amber-200 border-amber-500/75',
    dotColor: '#f59e0b',
  },
  CAUTION: {
    label: 'SKÆRPET',
    badgeClass: 'bg-cyan-950/90 text-cyan-200 border-cyan-500/70',
    dotColor: '#22d3ee',
  },
  SAFE: {
    label: 'SIKKER DRIFT',
    badgeClass: 'bg-emerald-950/90 text-emerald-200 border-emerald-500/70',
    dotColor: '#10b981',
  },
};

export const HighWindGustImpulseCorrelationWidget: React.FC<
  HighWindGustImpulseCorrelationWidgetProps
> = ({
  weatherHours,
  selectedHourIndex,
  onSelectHour,
  sources,
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
  dateIso,
  selectedReceptorName = 'Nabo Nord',
  selectedReceptorAddress = 'Ringparken, 4200 Slagelse',
  selectedReceptorPosition = { lat: 55.41335, lng: 11.35415 },
  onApplyMachineLwa,
  onActivateAcousticHazardHeatmap,
  onFileFormalNoiseReport,
}) => {
  const { convertDb, unitLabel, labels } = useAcousticWeighting();
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    'hydraulisk_betonknusning'
  );
  const [distanceMeters, setDistanceMeters] = useState<number>(45);
  const [hoveredHourIdx, setHoveredHourIdx] = useState<number | null>(null);
  const [isFiling, setIsFiling] = useState<boolean>(false);
  const [filedCodeBanner, setFiledCodeBanner] = useState<string | null>(null);

  const activeSourcesCount = useMemo(
    () => Math.max(1, sources.filter((s) => s.active).length),
    [sources]
  );

  const activeMachinery = useMemo(() => {
    if (selectedProfileId === 'active_slider') {
      const lwa = isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114;
      return {
        modeId: 'active_slider',
        shortLabel: `Aktiv L_WA (${lwa.toFixed(0)} dB)`,
        lwaDb: lwa,
        impulsePenaltyDb: 14.5,
      };
    }
    const found =
      DEFAULT_DEMOLITION_MACHINERY_PROFILES.find((p) => p.modeId === selectedProfileId) ||
      DEFAULT_DEMOLITION_MACHINERY_PROFILES[0];
    return found;
  }, [selectedProfileId, isManualMachineNoiseOverrideActive, manualMachineNoiseOutputDb]);

  const analysis = useMemo(
    () =>
      computeHighWindGustImpulseAnalysis({
        weatherHours,
        machineLwaDb: activeMachinery.lwaDb,
        impulsePenaltyDb: activeMachinery.impulsePenaltyDb,
        distanceMeters,
        activeSourcesCount,
      }),
    [weatherHours, activeMachinery, distanceMeters, activeSourcesCount]
  );

  // Scatter chart geometry: X = windGustMs, Y = peakImpulseLafmaxDb
  const W = 420;
  const H = 192;
  const padL = 38;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const minG = 2;
  const maxG = Math.max(20, Math.ceil(analysis.peakGustMs + 2));
  const minDb = 46;
  const maxDb = Math.max(96, Math.ceil(analysis.peakImpulseHighGustDb + 4));

  const xForGust = (g: number) =>
    padL + ((Math.min(maxG, Math.max(minG, g)) - minG) / (maxG - minG)) * plotW;
  const yForDb = (db: number) =>
    padT +
    plotH -
    ((Math.min(maxDb, Math.max(minDb, db)) - minDb) / (maxDb - minDb)) * plotH;

  const gust10X = xForGust(10.0);
  const limit85Y = yForDb(85.0);

  const inspectedPoint = useMemo(() => {
    const targetIdx = hoveredHourIdx ?? selectedHourIndex;
    return analysis.points.find((p) => p.hourIndex === targetIdx) ?? analysis.points[0] ?? null;
  }, [analysis.points, hoveredHourIdx, selectedHourIndex]);

  // High-gust regression segment (x from 10.0 to maxG)
  const showSubgroupLine = analysis.highGustHoursCount >= 2;
  const lineStartX = showSubgroupLine ? 10.0 : minG;
  const lineY1 = analysis.highGustInterceptDb + analysis.highGustSlopeDbPerMs * lineStartX;
  const lineY2 = analysis.highGustInterceptDb + analysis.highGustSlopeDbPerMs * maxG;

  const displayLimit85 = convertDb(85.0, { isImpulse: true });

  return (
    <section
      data-testid="high-wind-gust-impulse-correlation-widget"
      className="rounded-lg bg-[#0F172A] border border-[#2D3B50] p-3.5 space-y-3 text-slate-100"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs font-mono uppercase tracking-wide">
            <Wind className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Høj-Vindstød (&gt;10 m/s) ↔ Spids-Impulsstøj ({unitLabel})</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Statistisk sammenhæng mellem kraftige vindstød (&gt;10 m/s) og maskin-impulsstøj ({dateIso} ·{' '}
            <span className="font-mono tabular-nums text-cyan-300">{activeSourcesCount} aktive kilder</span>) for
            identifikation af højrisiko driftsscenarier.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <select
            aria-label="Vælg nedrivningsmaskine til >10 m/s korrelation"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="bg-[#0B0E17] border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-100 focus:outline-none focus:border-amber-400"
          >
            <option value="active_slider">
              Aktiv styring ({(isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114).toFixed(0)} dB L_WA)
            </option>
            {DEFAULT_DEMOLITION_MACHINERY_PROFILES.map((m) => (
              <option key={m.modeId} value={m.modeId}>
                {m.shortLabel}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded bg-[#0B0E17] border border-slate-700 p-0.5 font-mono text-[11px]">
            {[30, 45, 65, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDistanceMeters(d)}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors whitespace-nowrap ${
                  distanceMeters === d
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {d}m
              </button>
            ))}
          </div>

          {onActivateAcousticHazardHeatmap && (
            <button
              type="button"
              onClick={onActivateAcousticHazardHeatmap}
              className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/70 text-rose-200 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              title="Vis Acoustic Hazard Heatmap overlay på 2D-kortet"
            >
              <MapIcon className="w-3 h-3 shrink-0" />
              <span>2D Heatmap</span>
            </button>
          )}
        </div>
      </div>

      {/* Top 4-KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400 uppercase">Vindstød &gt;10 m/s</div>
          <div className="text-sm font-bold text-amber-300">
            {analysis.highGustHoursCount} / {analysis.sampleCount} t
          </div>
          <div className="text-[10.5px] text-slate-400">
            Spids: <span className="text-slate-200">{analysis.peakGustMs.toFixed(1)} m/s</span>
          </div>
        </div>

        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400 uppercase">Korrelation (Gust &gt;10)</div>
          <div className="text-sm font-bold text-cyan-300">
            r ={' '}
            {(analysis.highGustHoursCount >= 3
              ? analysis.highGustSubgroupPearsonR
              : analysis.overallPearsonR
            ).toFixed(3)}
          </div>
          <div className="text-[10.5px] text-slate-400">
            24t R²: <span className="text-slate-200">{analysis.overallRSquared.toFixed(3)}</span>
          </div>
        </div>

        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400 uppercase">Gust-Forstærkning (Δ)</div>
          <div className="text-sm font-bold text-orange-300">
            +{analysis.meanAmplificationDeltaDb.toFixed(1)} {unitLabel}
          </div>
          <div className="text-[10.5px] text-slate-400">
            {convertDb(analysis.meanImpulseHighGustDb, { windGustMs: analysis.peakGustMs, isImpulse: true }).toFixed(1)} vs {convertDb(analysis.meanImpulseCalmDb, { isImpulse: true }).toFixed(1)} {unitLabel}
          </div>
        </div>

        <div className="p-2 rounded bg-[#0B0E17] border border-slate-800 space-y-0.5">
          <div className="text-[10.5px] text-slate-400 uppercase">Højrisiko-Scenarier</div>
          <div
            className={`text-sm font-bold ${
              analysis.stopWorkEventCount > 0
                ? 'text-rose-400'
                : analysis.highRiskEventCount > 0
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {analysis.highRiskEventCount} hændelser
          </div>
          <div className="text-[10.5px] text-slate-400">
            {analysis.stopWorkEventCount} ≥{displayLimit85.toFixed(0)} {unitLabel} stop
          </div>
        </div>
      </div>

      {/* Main Chart + High-Wind Events List */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* Left: Quadrant Correlation Plot */}
        <div className="xl:col-span-7 rounded bg-[#0B0E17] border border-slate-800 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
            <span className="font-bold text-slate-200">
              Kvadrant-Korrelation: Vindstød (m/s) vs. {labels.lmaxLabel} ({unitLabel})
            </span>
            <span className="text-rose-300 font-semibold">
              {analysis.significanceLabelDa}
            </span>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto select-none overflow-visible"
            role="img"
            aria-label="Scatter plot mellem vindstød over 10 m/s og maskin-impulsstøj"
          >
            {/* High-Risk Operational Quadrant (>10 m/s AND >=85 dB(A)) */}
            <rect
              x={gust10X}
              y={padT}
              width={Math.max(0, padL + plotW - gust10X)}
              height={Math.max(0, limit85Y - padT)}
              fill="rgba(225, 29, 72, 0.16)"
            />
            <text
              x={Math.min(W - 18, gust10X + 6)}
              y={padT + 12}
              className="fill-rose-300 text-[9.5px] font-mono font-bold"
            >
              HØJRISIKO-ZONE (&gt;10 m/s · ≥85 dB)
            </text>

            {/* Horizontal 85 dB limit */}
            <line
              x1={padL}
              y1={limit85Y}
              x2={padL + plotW}
              y2={limit85Y}
              stroke="#fb7185"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            <text
              x={padL + 4}
              y={limit85Y - 4}
              className="fill-rose-300 text-[9.5px] font-mono"
            >
              {displayLimit85.toFixed(0)} {unitLabel} Impuls-Grænse
            </text>

            {/* Vertical 10 m/s High-Wind Gust cutoff */}
            <line
              x1={gust10X}
              y1={padT}
              x2={gust10X}
              y2={padT + plotH}
              stroke="#fbbf24"
              strokeWidth="1.4"
              strokeDasharray="4 3"
            />
            <text
              x={gust10X + 4}
              y={padT + plotH - 5}
              className="fill-amber-300 text-[9.5px] font-mono font-bold"
            >
              10,0 m/s
            </text>

            {/* Axes */}
            <line
              x1={padL}
              y1={padT}
              x2={padL}
              y2={padT + plotH}
              stroke="#334155"
              strokeWidth="1"
            />
            <line
              x1={padL}
              y1={padT + plotH}
              x2={padL + plotW}
              y2={padT + plotH}
              stroke="#334155"
              strokeWidth="1"
            />

            {/* Y-axis ticks */}
            {[55, 70, 85, 95].map((tickDb) => {
              if (tickDb < minDb || tickDb > maxDb) return null;
              const ty = yForDb(tickDb);
              return (
                <g key={tickDb}>
                  <line
                    x1={padL - 3}
                    y1={ty}
                    x2={padL + plotW}
                    y2={ty}
                    stroke="#1e293b"
                    strokeWidth="0.7"
                  />
                  <text
                    x={padL - 5}
                    y={ty + 3}
                    textAnchor="end"
                    className="fill-slate-400 text-[9.5px] font-mono"
                  >
                    {tickDb}
                  </text>
                </g>
              );
            })}

            {/* X-axis ticks */}
            {[4, 8, 10, 14, 18].map((tickG) => {
              if (tickG < minG || tickG > maxG) return null;
              const tx = xForGust(tickG);
              return (
                <g key={tickG}>
                  <line
                    x1={tx}
                    y1={padT + plotH}
                    x2={tx}
                    y2={padT + plotH + 4}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text
                    x={tx}
                    y={padT + plotH + 14}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9.5px] font-mono"
                  >
                    {tickG}
                  </text>
                </g>
              );
            })}
            <text
              x={padL + plotW / 2}
              y={H - 2}
              textAnchor="middle"
              className="fill-slate-400 text-[9.5px] font-mono"
            >
              Vindstød (m/s)
            </text>

            {/* Regression Line for High-Gust Subgroup */}
            {analysis.points.length >= 2 && (
              <line
                x1={xForGust(lineStartX)}
                y1={yForDb(lineY1)}
                x2={xForGust(maxG)}
                y2={yForDb(lineY2)}
                stroke="#38bdf8"
                strokeWidth="1.6"
                strokeOpacity="0.85"
              />
            )}

            {/* Hourly Scatter Points */}
            {analysis.points.map((pt) => {
              const cx = xForGust(pt.windGustMs);
              const cy = yForDb(pt.peakImpulseLafmaxDb);
              const isSelected = pt.hourIndex === selectedHourIndex;
              const isHovered = pt.hourIndex === hoveredHourIdx;
              const dotColor = RISK_BADGE_MAP[pt.operationalRiskLevel].dotColor;

              return (
                <g
                  key={pt.hourIndex}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredHourIdx(pt.hourIndex)}
                  onMouseLeave={() => setHoveredHourIdx(null)}
                  onClick={() => onSelectHour(pt.hourIndex)}
                >
                  {(isSelected || isHovered) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={9}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.6}
                      strokeOpacity={0.9}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={pt.isHighWindGustEvent ? 5.2 : 3.8}
                    fill={dotColor}
                    fillOpacity={pt.isHighWindGustEvent ? 0.95 : 0.72}
                    stroke="#090d16"
                    strokeWidth={1.1}
                  />
                </g>
              );
            })}
          </svg>

          {/* Hovered / Selected Hour Inspector */}
          {inspectedPoint && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 rounded bg-[#151C28] border border-slate-700 font-mono text-[11px] tabular-nums">
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="font-bold text-white">Kl. {inspectedPoint.hourLabel}</span>
                <span className="text-slate-400">({inspectedPoint.pasquillClass})</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-amber-300">
                  Stød: <strong>{inspectedPoint.windGustMs.toFixed(1)} m/s</strong>
                </span>
                <span className="text-rose-300">
                  {labels.lmaxLabel}:{' '}
                  <strong>
                    {convertDb(inspectedPoint.peakImpulseLafmaxDb, {
                      windGustMs: inspectedPoint.windGustMs,
                      isImpulse: true,
                    }).toFixed(1)}{' '}
                    {unitLabel}
                  </strong>
                </span>
                <span className="text-cyan-300">
                  Δ Vindstød: <strong>+{inspectedPoint.gustAmplificationDb.toFixed(1)} dB</strong>
                </span>
                {onFileFormalNoiseReport && (
                  <button
                    type="button"
                    disabled={isFiling}
                    onClick={async () => {
                      setIsFiling(true);
                      try {
                        const weightedVal = convertDb(inspectedPoint.peakImpulseLafmaxDb, {
                          windGustMs: inspectedPoint.windGustMs,
                          isImpulse: true,
                        });
                        const created = await onFileFormalNoiseReport({
                          hourIndex: inspectedPoint.hourIndex,
                          timeLabel: inspectedPoint.hourLabel,
                          locationLabel: `${selectedReceptorName} (${selectedReceptorAddress})`,
                          position: selectedReceptorPosition,
                          decibelLevelDb: weightedVal,
                          windGustMs: inspectedPoint.windGustMs,
                          sourceName: activeMachinery.shortLabel,
                          notes: `Formel støjrapport fra Høj-Vindstød/Impulskorrelation: ${weightedVal.toFixed(
                            1
                          )} ${unitLabel} ved vindstød ${inspectedPoint.windGustMs.toFixed(1)} m/s.`,
                        });
                        if (created) {
                          setFiledCodeBanner(
                            `${created.code} · ${weightedVal.toFixed(1)} ${unitLabel}`
                          );
                        }
                      } finally {
                        setIsFiling(false);
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/75 text-rose-100 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                  >
                    <FilePlus2 className="w-3 h-3 shrink-0" />
                    <span>{isFiling ? 'Logger...' : 'Rapportér Støj'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
          {filedCodeBanner && (
            <div className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-500/60 text-[10.5px] font-mono text-emerald-200">
              ✓ Støjrapport oprettet i bevis-loggen: {filedCodeBanner}
            </div>
          )}
        </div>

        {/* Right: Top High-Wind Gust Events (>10 m/s) */}
        <div className="xl:col-span-5 rounded bg-[#0B0E17] border border-slate-800 p-2.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Top Høj-Vindstød (&gt;10 m/s)</span>
            </span>
            <span className="text-slate-400 tabular-nums">
              {analysis.highGustHoursCount} timer fundet
            </span>
          </div>

          {analysis.highGustPointsSorted.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-3 text-center rounded bg-[#151C28] border border-slate-800 space-y-1">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div className="text-xs font-semibold text-emerald-200">
                Ingen vindstød &gt;10 m/s i det valgte døgn
              </div>
              <p className="text-[11px] text-slate-400">
                Skift til et storm- eller skybruds-vejrscenarie i vejrpåvirkningen for at stressteste driftsgrænserne.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[218px] overflow-y-auto pr-0.5 font-mono text-[11px] tabular-nums">
              {analysis.highGustPointsSorted.slice(0, 6).map((pt) => {
                const riskSpec = RISK_BADGE_MAP[pt.operationalRiskLevel];
                const isActiveHr = pt.hourIndex === selectedHourIndex;
                return (
                  <button
                    key={pt.hourIndex}
                    type="button"
                    onClick={() => onSelectHour(pt.hourIndex)}
                    className={`w-full text-left px-2 py-1.5 rounded border transition-colors cursor-pointer space-y-1 ${
                      isActiveHr
                        ? 'bg-cyan-950/60 border-cyan-400 text-white'
                        : 'bg-[#151C28] hover:bg-[#1E293B] border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">
                        Kl. {pt.hourLabel} · {pt.windGustMs.toFixed(1)} m/s
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${riskSpec.badgeClass}`}
                      >
                        {riskSpec.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-300">
                      <span>
                        Impuls:{' '}
                        <strong className="text-rose-300">
                          {convertDb(pt.peakImpulseLafmaxDb, {
                            windGustMs: pt.windGustMs,
                            isImpulse: true,
                          }).toFixed(1)}{' '}
                          {unitLabel}
                        </strong>
                      </span>
                      <span className="text-amber-300">
                        Vindstøds-tillæg: +{pt.gustAmplificationDb.toFixed(1)} dB
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Operational Scenarios Matrix Across Demolition Machinery */}
      <div className="rounded bg-[#0B0E17] border border-slate-800 overflow-hidden">
        <div className="px-3 py-2 bg-[#151C28] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-100 uppercase">
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Driftsscenarier pr. Maskintype under Vindstød &gt;10 m/s ({distanceMeters} m)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            Grænseværdi: {displayLimit85.toFixed(1)} {unitLabel} impuls
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px] tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-[#0D131F]">
                <th className="py-1.5 px-2.5 font-semibold">Maskintype / Aktivitet</th>
                <th className="py-1.5 px-2 text-right font-semibold">{labels.lwaLabel}</th>
                <th className="py-1.5 px-2 text-right font-semibold">Spids (&gt;10 m/s)</th>
                <th className="py-1.5 px-2 text-right font-semibold">Δ Stød</th>
                <th className="py-1.5 px-2 text-right font-semibold">&gt;{displayLimit85.toFixed(0)} {unitLabel}</th>
                <th className="py-1.5 px-2 font-semibold">Risiko</th>
                <th className="py-1.5 px-2.5 text-right font-semibold">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {analysis.operationalScenarios.map((sc) => {
                const riskSpec = RISK_BADGE_MAP[sc.riskTier];
                const isCurrentSim =
                  isManualMachineNoiseOverrideActive &&
                  Math.abs(manualMachineNoiseOutputDb - sc.lwaDb) < 0.6;
                return (
                  <tr
                    key={sc.modeId}
                    className="hover:bg-[#151C28]/80 transition-colors"
                    title={sc.mitigationRecommendationDa}
                  >
                    <td className="py-1.5 px-2.5">
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <Volume2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{sc.shortLabel}</span>
                      </div>
                      <div className="text-[10px] font-sans text-slate-400 truncate max-w-[230px]">
                        {sc.mitigationRecommendationDa}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-300">
                      {convertDb(sc.lwaDb).toFixed(1)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-bold ${
                        sc.peakImpulseDuringHighGustDb >= 85
                          ? 'text-rose-300'
                          : sc.peakImpulseDuringHighGustDb >= 79
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {convertDb(sc.peakImpulseDuringHighGustDb, {
                        windGustMs: analysis.peakGustMs,
                        isImpulse: true,
                      }).toFixed(1)}{' '}
                      {unitLabel}
                    </td>
                    <td className="py-1.5 px-2 text-right text-cyan-300">
                      +{sc.gustDeltaDb.toFixed(1)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-200">
                      {sc.highGustExceedanceHours} t
                    </td>
                    <td className="py-1.5 px-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${riskSpec.badgeClass}`}
                      >
                        {riskSpec.label}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      {onApplyMachineLwa && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProfileId(sc.modeId);
                            onSelectHour(sc.worstHourIndex);
                            onApplyMachineLwa(sc.lwaDb);
                            onActivateAcousticHazardHeatmap?.();
                          }}
                          className={`px-2 py-0.5 rounded border text-[10.5px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                            isCurrentSim
                              ? 'bg-amber-400 text-slate-950 border-white'
                              : 'bg-[#151C28] hover:bg-amber-500/20 text-amber-200 border-amber-500/50'
                          }`}
                        >
                          {isCurrentSim ? 'Aktiv i 2D' : 'Simulér L_WA'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {analysis.stopWorkEventCount > 0 && (
        <div className="px-2.5 py-2 rounded bg-rose-950/40 border border-rose-500/60 flex items-start gap-2 text-[11px] text-rose-100">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>
            <strong>Operativ Advarsel:</strong> Ved den valgte maskinprofil ({convertDb(activeMachinery.lwaDb).toFixed(1)} {unitLabel} {labels.lwaLabel})
            overskrider impulsstøjen {displayLimit85.toFixed(1)} {unitLabel} i{' '}
            <strong className="font-mono tabular-nums">{analysis.stopWorkEventCount}</strong> time(r) med vindstød &gt;10 m/s
            (spids kl. {analysis.peakHighGustHourLabel}:{' '}
            {convertDb(analysis.peakImpulseHighGustDb, {
              windGustMs: analysis.peakGustMs,
              isImpulse: true,
            }).toFixed(1)}{' '}
            {unitLabel}). Skift til indvendig
            sanering (≤96 dB) eller aktiver støjreduktion før kl. {analysis.peakHighGustHourLabel}.
          </span>
        </div>
      )}
    </section>
  );
};
