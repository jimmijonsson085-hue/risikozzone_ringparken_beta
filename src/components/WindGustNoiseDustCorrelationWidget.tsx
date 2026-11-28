import React, { useMemo, useState } from 'react';
import { Wind, Volume2, AlertTriangle, FilePlus2, CheckCircle2 } from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyReceptorPuffDose,
  HourlyWeatherPoint,
  LatLngPoint,
} from '../types/dispersion';
import {
  isDustObservation,
  isNoiseObservation,
} from './NeighborComplaintDensityOverlay';
import { FormalNoiseReportPayload } from './HighFrequencyNoiseSpikeDetectorWidget';
import { useAcousticWeighting } from '../context/AcousticWeightingContext';

export type GustCorrelationLayerFilter = 'all' | 'gust_dust' | 'gust_noise';

export interface WindGustNoiseDustCorrelationWidgetProps {
  dateIso: string;
  weatherHours: HourlyWeatherPoint[];
  hourlyReceptorProfile: HourlyReceptorPuffDose[];
  receptorName: string;
  receptorAddress?: string;
  receptorPosition?: LatLngPoint;
  observations: AlgedonicObservation[];
  sources: DemolitionSourceNode[];
  selectedHourIndex: number;
  machineNoiseOutputDb: number;
  onSelectHour: (hourIndex: number) => void;
  onSelectObservation?: (obs: AlgedonicObservation) => void;
  onFileFormalNoiseReport?: (
    payload: FormalNoiseReportPayload
  ) => Promise<AlgedonicObservation | null>;
}

interface HourlyGustCorrelationRow {
  hourIndex: number;
  hourLabel: string;
  windSpeedMs: number;
  windGustMs: number;
  gustSurgeDeltaMs: number;
  gustFactor: number;
  windDirDeg: number;
  dustSumQuotient: number;
  dustDepositionUgM2: number;
  estimatedLaeqDb: number;
  isSevereGust: boolean; // gust >= 12 m/s or mean > 10 m/s
  isDustEvent: boolean; // S >= 0.5
  isNoiseEvent: boolean; // L_Aeq,korr > 70 dB day or > 40 dB night
  hourComplaints: AlgedonicObservation[];
  noiseComplaintsCount: number;
  dustComplaintsCount: number;
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den > 1e-9 ? num / den : 0;
}

export const WindGustNoiseDustCorrelationWidget: React.FC<
  WindGustNoiseDustCorrelationWidgetProps
> = ({
  dateIso,
  weatherHours,
  hourlyReceptorProfile,
  receptorName,
  receptorAddress = 'Ringparken, 4200 Slagelse',
  receptorPosition = { lat: 55.41335, lng: 11.35415 },
  observations,
  sources,
  selectedHourIndex,
  machineNoiseOutputDb,
  onSelectHour,
  onSelectObservation,
  onFileFormalNoiseReport,
}) => {
  const { convertDb, unitLabel, labels } = useAcousticWeighting();
  const [layerFilter, setLayerFilter] =
    useState<GustCorrelationLayerFilter>('all');
  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null);
  const [isFilingReport, setIsFilingReport] = useState<boolean>(false);
  const [isDraftOpen, setIsDraftOpen] = useState<boolean>(false);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [filedObservationFeedback, setFiledObservationFeedback] =
    useState<AlgedonicObservation | null>(null);

  const activeSourceCount = useMemo(
    () => Math.max(1, sources.filter((s) => s.active).length),
    [sources]
  );

  const rows = useMemo<HourlyGustCorrelationRow[]>(() => {
    return Array.from({ length: 24 }, (_, hr) => {
      const w = weatherHours[hr] || weatherHours[0];
      const p = hourlyReceptorProfile[hr];
      const windSpeedMs = w?.windSpeed10m ?? 0;
      const windGustMs = Math.max(windSpeedMs, w?.windGusts10m ?? windSpeedMs);
      const gustSurgeDeltaMs = Number((windGustMs - windSpeedMs).toFixed(1));
      const gustFactor =
        windSpeedMs > 0.2 ? Number((windGustMs / windSpeedMs).toFixed(2)) : 1.0;

      // Turbulence-driven resuspension factor amplifies dust quotient during strong gusts
      const gustTurbulenceBoost =
        windGustMs >= 12
          ? 1 + (windGustMs - 12) * 0.045
          : 1.0;
      const dustSumQuotient = Number(
        ((p?.sumQuotient ?? 0) * gustTurbulenceBoost).toFixed(3)
      );
      const dustDepositionUgM2 = Number(
        (p?.depositedDustUgM2 ?? dustSumQuotient * 18.5).toFixed(1)
      );

      // Hourly acoustic propagation including wind-gust refraction & work window
      const isWorkWindow = hr >= 7 && hr < 18;
      const baseSourceDb = isWorkWindow
        ? machineNoiseOutputDb
        : Math.max(76, machineNoiseOutputDb - 28);
      const refractionDb =
        windGustMs >= 14
          ? 5.2
          : windGustMs >= 10
          ? 3.4
          : windSpeedMs >= 6
          ? 1.8
          : 0.5;
      const impulseSurcharge = isWorkWindow ? 5.0 : 0.0;
      const multiSourceGain = 10 * Math.log10(Math.min(3, activeSourceCount));
      const estimatedLaeqDb = Number(
        (
          baseSourceDb -
          42.5 +
          refractionDb +
          impulseSurcharge +
          multiSourceGain
        ).toFixed(1)
      );

      const noiseLimit = isWorkWindow ? 70 : 40;
      const hourComplaints = observations.filter(
        (o) =>
          o.observedHourIndex === hr &&
          (!o.observedDateIso || o.observedDateIso === dateIso)
      );
      // If observations come from other dates (e.g. demo/archive), still group by hourIndex when same-day is empty
      const effectiveComplaints =
        hourComplaints.length > 0
          ? hourComplaints
          : observations.filter((o) => o.observedHourIndex === hr);

      const noiseComplaintsCount = effectiveComplaints.filter((o) =>
        isNoiseObservation(o)
      ).length;
      const dustComplaintsCount = effectiveComplaints.filter((o) =>
        isDustObservation(o)
      ).length;

      return {
        hourIndex: hr,
        hourLabel: w?.hourLabel || `${String(hr).padStart(2, '0')}:00`,
        windSpeedMs,
        windGustMs,
        gustSurgeDeltaMs,
        gustFactor,
        windDirDeg: w?.windDirection10m ?? 240,
        dustSumQuotient,
        dustDepositionUgM2,
        estimatedLaeqDb,
        isSevereGust: windGustMs >= 12 || windSpeedMs > 10,
        isDustEvent: dustSumQuotient >= 0.5 || dustComplaintsCount > 0,
        isNoiseEvent:
          estimatedLaeqDb > noiseLimit || noiseComplaintsCount > 0,
        hourComplaints: effectiveComplaints,
        noiseComplaintsCount,
        dustComplaintsCount,
      };
    });
  }, [
    weatherHours,
    hourlyReceptorProfile,
    observations,
    dateIso,
    machineNoiseOutputDb,
    activeSourceCount,
  ]);

  const stats = useMemo(() => {
    const gusts = rows.map((r) => r.windGustMs);
    const dusts = rows.map((r) => r.dustSumQuotient);
    const noises = rows.map((r) => r.estimatedLaeqDb);

    const rGustDust = pearsonCorrelation(gusts, dusts);
    const rGustNoise = pearsonCorrelation(gusts, noises);

    const peakGustRow = [...rows].sort((a, b) => b.windGustMs - a.windGustMs)[0];
    const totalComplaints = rows.reduce(
      (acc, r) => acc + r.hourComplaints.length,
      0
    );
    const complaintsDuringHighGusts = rows
      .filter((r) => r.windGustMs >= 10)
      .reduce((acc, r) => acc + r.hourComplaints.length, 0);
    const highGustComplaintSharePct =
      totalComplaints > 0
        ? Math.round((complaintsDuringHighGusts / totalComplaints) * 100)
        : 0;

    return {
      rGustDust,
      rGustNoise,
      peakGustRow,
      totalComplaints,
      complaintsDuringHighGusts,
      highGustComplaintSharePct,
      severeGustHoursCount: rows.filter((r) => r.isSevereGust).length,
    };
  }, [rows]);

  const activeInspectRow =
    rows[hoveredHourIndex ?? selectedHourIndex] || rows[0];

  const handleSubmitFormalNoiseReport = async () => {
    if (!onFileFormalNoiseReport || !activeInspectRow) return;
    setIsFilingReport(true);
    try {
      const nowTime = new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const weightedNoiseDb = convertDb(activeInspectRow.estimatedLaeqDb, {
        windSpeedMs: activeInspectRow.windSpeedMs,
        windGustMs: activeInspectRow.windGustMs,
      });
      const created = await onFileFormalNoiseReport({
        hourIndex: activeInspectRow.hourIndex,
        timeLabel: `${activeInspectRow.hourLabel} (indberettet ${nowTime})`,
        locationLabel: `${receptorName} (${receptorAddress})`,
        position: receptorPosition,
        decibelLevelDb: weightedNoiseDb,
        windGustMs: activeInspectRow.windGustMs,
        sourceName: sources.find((s) => s.active)?.name || 'Aktiv nedrivningsmaskine',
        notes:
          customNotes.trim() ||
          `Formel støjrapport fra Støj-Støv korrelationsgraf: ${weightedNoiseDb.toFixed(
            1
          )} ${unitLabel} ved vindstød ${activeInspectRow.windGustMs.toFixed(
            1
          )} m/s og støv-kvotient S=${activeInspectRow.dustSumQuotient.toFixed(2)}.`,
      });
      if (created) {
        setFiledObservationFeedback(created);
        setIsDraftOpen(false);
        setCustomNotes('');
      }
    } finally {
      setIsFilingReport(false);
    }
  };

  // SVG Chart Geometry
  const svgW = 760;
  const svgH = 250;
  const padL = 46;
  const padR = 48;
  const padT = 22;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const maxWindScale = Math.max(
    18,
    Math.ceil(Math.max(...rows.map((r) => r.windGustMs)) + 2)
  );
  const maxDustScale = Math.max(
    1.5,
    Number((Math.max(...rows.map((r) => r.dustSumQuotient)) * 1.18).toFixed(2))
  );
  const minDbScale = 35;
  const maxDbScale = 95;

  const xForHour = (hr: number) => padL + (hr / 23) * plotW;
  const yForWind = (ms: number) =>
    padT + plotH - Math.min(1, Math.max(0, ms / maxWindScale)) * plotH;
  const yForDust = (sVal: number) =>
    padT + plotH - Math.min(1, Math.max(0, sVal / maxDustScale)) * plotH;
  const yForNoise = (db: number) =>
    padT +
    plotH -
    Math.min(1, Math.max(0, (db - minDbScale) / (maxDbScale - minDbScale))) *
      plotH;

  // Build SVG Paths
  const gustBandPolygonPoints = useMemo(() => {
    const upper = rows.map(
      (r) => `${xForHour(r.hourIndex).toFixed(1)},${yForWind(r.windGustMs).toFixed(1)}`
    );
    const lower = [...rows]
      .reverse()
      .map(
        (r) =>
          `${xForHour(r.hourIndex).toFixed(1)},${yForWind(r.windSpeedMs).toFixed(1)}`
      );
    return [...upper, ...lower].join(' ');
  }, [rows, maxWindScale]);

  const gustLinePath = useMemo(
    () =>
      rows
        .map(
          (r, i) =>
            `${i === 0 ? 'M' : 'L'} ${xForHour(r.hourIndex).toFixed(
              1
            )} ${yForWind(r.windGustMs).toFixed(1)}`
        )
        .join(' '),
    [rows, maxWindScale]
  );

  const meanWindLinePath = useMemo(
    () =>
      rows
        .map(
          (r, i) =>
            `${i === 0 ? 'M' : 'L'} ${xForHour(r.hourIndex).toFixed(
              1
            )} ${yForWind(r.windSpeedMs).toFixed(1)}`
        )
        .join(' '),
    [rows, maxWindScale]
  );

  const dustLinePath = useMemo(
    () =>
      rows
        .map(
          (r, i) =>
            `${i === 0 ? 'M' : 'L'} ${xForHour(r.hourIndex).toFixed(
              1
            )} ${yForDust(r.dustSumQuotient).toFixed(1)}`
        )
        .join(' '),
    [rows, maxDustScale]
  );

  const noiseLinePath = useMemo(
    () =>
      rows
        .map(
          (r, i) =>
            `${i === 0 ? 'M' : 'L'} ${xForHour(r.hourIndex).toFixed(
              1
            )} ${yForNoise(r.estimatedLaeqDb).toFixed(1)}`
        )
        .join(' '),
    [rows]
  );

  return (
    <section
      data-testid="wind-gust-noise-dust-correlation-widget"
      className="p-4 rounded-lg bg-slate-900/95 border border-slate-800 space-y-3 text-slate-100"
    >
      {/* Header & Layer Filter */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              24-Timers Vindstødsmønstre vs. Støv-, Støj-Hændelser &amp; Naboklager
            </span>
          </h3>
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
            <span>Receptor: {receptorName}</span>
            <span aria-hidden="true">·</span>
            <span>Dato: {dateIso}</span>
            <span aria-hidden="true">·</span>
            <span>
              Spids-vindstød: {stats.peakGustRow.windGustMs.toFixed(1)} m/s kl.{' '}
              {stats.peakGustRow.hourLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded bg-slate-950 border border-slate-800">
          {(
            [
              { id: 'all', label: 'Alle lag' },
              { id: 'gust_dust', label: 'Vindstød × Støv' },
              { id: 'gust_noise', label: 'Vindstød × Støj' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLayerFilter(tab.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                layerFilter === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistical Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">
            Korrelation r(Vindstød, Støv S)
          </div>
          <div className="text-lg font-mono font-bold tabular-nums text-rose-300 mt-0.5">
            {stats.rGustDust >= 0 ? '+' : ''}
            {stats.rGustDust.toFixed(2)}
            <span className="text-[11px] font-normal text-slate-400 ml-1.5">
              ({stats.severeGustHoursCount}t ≥12 m/s)
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">
            Korrelation r(Vindstød, Støj dB)
          </div>
          <div className="text-lg font-mono font-bold tabular-nums text-amber-300 mt-0.5">
            {stats.rGustNoise >= 0 ? '+' : ''}
            {stats.rGustNoise.toFixed(2)}
            <span className="text-[11px] font-normal text-slate-400 ml-1.5">
              (L_WA {machineNoiseOutputDb.toFixed(0)} dB)
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">
            Naboklager under vindstød ≥10 m/s
          </div>
          <div className="text-lg font-mono font-bold tabular-nums text-cyan-300 mt-0.5">
            {stats.highGustComplaintSharePct}%
            <span className="text-[11px] font-normal text-slate-400 ml-1.5">
              ({stats.complaintsDuringHighGusts}/{stats.totalComplaints} klager)
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Dual-Axis 24-Hour SVG Chart */}
      <div className="rounded bg-slate-950 border border-slate-800 p-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto min-w-[540px] select-none"
          role="img"
          aria-label="Interaktiv 24-timers korrelationsgraf for vindstød, støv, støj og naboklager"
        >
          {/* Horizontal Gridlines & Left Wind Axis (m/s) */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padT + plotH * (1 - frac);
            const windVal = (frac * maxWindScale).toFixed(0);
            const rightLabel =
              layerFilter === 'gust_noise'
                ? `${Math.round(minDbScale + frac * (maxDbScale - minDbScale))} dB`
                : `S=${(frac * maxDustScale).toFixed(1)}`;
            return (
              <g key={`grid-${frac}`}>
                <line
                  x1={padL}
                  y1={y}
                  x2={svgW - padR}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth={1}
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-cyan-300 text-[11px] font-mono tabular-nums"
                >
                  {windVal} m/s
                </text>
                <text
                  x={svgW - padR + 6}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-amber-300 text-[11px] font-mono tabular-nums"
                >
                  {rightLabel}
                </text>
              </g>
            );
          })}

          {/* 10 m/s Critical High-Wind Threshold Line */}
          {10 <= maxWindScale && (
            <g>
              <line
                x1={padL}
                y1={yForWind(10)}
                x2={svgW - padR}
                y2={yForWind(10)}
                stroke="#38bdf8"
                strokeWidth={1}
                strokeDasharray="4 3"
                strokeOpacity={0.65}
              />
              <text
                x={padL + 4}
                y={yForWind(10) - 4}
                className="fill-cyan-300 text-[11px] font-mono"
              >
                Kritisk vindstød/middelvind 10 m/s
              </text>
            </g>
          )}

          {/* Shaded Wind-Gust Surge Envelope (v_10m -> v_gust) */}
          <polygon
            points={gustBandPolygonPoints}
            fill="rgba(34, 211, 238, 0.18)"
            stroke="none"
          />

          {/* Mean Wind Speed Curve */}
          <path
            d={meanWindLinePath}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={1.5}
            strokeOpacity={0.85}
          />

          {/* Peak Wind Gust Curve */}
          <path
            d={gustLinePath}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2.2}
            strokeDasharray="5 2.5"
          />

          {/* Dust Sum Quotient S Curve */}
          {(layerFilter === 'all' || layerFilter === 'gust_dust') && (
            <path
              d={dustLinePath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth={2.2}
            />
          )}

          {/* Impulse-Adjusted Noise Curve (dB(A)) */}
          {(layerFilter === 'all' || layerFilter === 'gust_noise') && (
            <path
              d={noiseLinePath}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2.0}
            />
          )}

          {/* Active Selected / Hovered Vertical Crosshair */}
          {activeInspectRow && (
            <line
              x1={xForHour(activeInspectRow.hourIndex)}
              y1={padT}
              x2={xForHour(activeInspectRow.hourIndex)}
              y2={padT + plotH}
              stroke="#e2e8f0"
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
          )}

          {/* Hourly Interactive Columns, Severe-Gust Markers & Neighbor Complaint Pins */}
          {rows.map((r) => {
            const cx = xForHour(r.hourIndex);
            const colW = plotW / 24;
            const isSelected = r.hourIndex === selectedHourIndex;
            const hasComplaints = r.hourComplaints.length > 0;

            return (
              <g key={`hr-col-${r.hourIndex}`}>
                {/* X-axis Hour Tick Label every 2 hours */}
                {r.hourIndex % 2 === 0 && (
                  <text
                    x={cx}
                    y={svgH - 10}
                    textAnchor="middle"
                    className={`text-[11px] font-mono tabular-nums ${
                      isSelected ? 'fill-white font-bold' : 'fill-slate-400'
                    }`}
                  >
                    {r.hourLabel}
                  </text>
                )}

                {/* Gust Peak Node when >= 12 m/s */}
                {r.isSevereGust && (
                  <circle
                    cx={cx}
                    cy={yForWind(r.windGustMs)}
                    r={3.5}
                    fill="#22d3ee"
                    stroke="#0f172a"
                    strokeWidth={1.2}
                  />
                )}

                {/* Registered Neighbor Complaint Event Pin */}
                {hasComplaints && (
                  <g
                    transform={`translate(${cx}, ${padT + 9})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectHour(r.hourIndex);
                      if (onSelectObservation && r.hourComplaints[0]) {
                        onSelectObservation(r.hourComplaints[0]);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      x={-13}
                      y={-8}
                      width={26}
                      height={15}
                      rx={3}
                      fill={
                        r.noiseComplaintsCount > 0 && r.dustComplaintsCount > 0
                          ? '#e11d48'
                          : r.noiseComplaintsCount > 0
                          ? '#d97706'
                          : '#c026d3'
                      }
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      className="fill-white text-[11px] font-mono font-bold tabular-nums"
                    >
                      {r.hourComplaints.length} KL
                    </text>
                  </g>
                )}

                {/* Full-height hit target for smooth scrubbing */}
                <rect
                  x={cx - colW / 2}
                  y={padT}
                  width={colW}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredHourIndex(r.hourIndex)}
                  onMouseLeave={() => setHoveredHourIndex(null)}
                  onClick={() => onSelectHour(r.hourIndex)}
                />
              </g>
            );
          })}
        </svg>

        {/* Legend Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1.5 border-t border-slate-900 text-[11px] font-mono text-slate-300">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-cyan-300">
              --- Vindstød v_gust (m/s) + stødbånd
            </span>
            {(layerFilter === 'all' || layerFilter === 'gust_dust') && (
              <span className="text-rose-400">─── Støv S-kvotient</span>
            )}
            {(layerFilter === 'all' || layerFilter === 'gust_noise') && (
              <span className="text-amber-300">
                ─── Impulsstøj {labels.leqKorrLabel} ({unitLabel})
              </span>
            )}
            <span className="text-fuchsia-300">■ KL = Naboklager pr. time</span>
          </div>
          <span className="text-slate-400">Klik på time for synkronisering</span>
        </div>
      </div>

      {/* Live Inspected Hour Readout & Linked Neighbor Complaints */}
      <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums">
          <span className="font-semibold text-white">
            Kl. {activeInspectRow.hourLabel} · Vind{' '}
            {activeInspectRow.windSpeedMs.toFixed(1)} m/s → Vindstød{' '}
            <strong className="text-cyan-300">
              {activeInspectRow.windGustMs.toFixed(1)} m/s
            </strong>{' '}
            (+{activeInspectRow.gustSurgeDeltaMs.toFixed(1)} m/s · G=
            {activeInspectRow.gustFactor.toFixed(2)})
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={
                activeInspectRow.dustSumQuotient >= 1.0
                  ? 'text-rose-400 font-bold'
                  : 'text-rose-200'
              }
            >
              Støv S = {activeInspectRow.dustSumQuotient.toFixed(2)} (
              {activeInspectRow.dustDepositionUgM2.toFixed(1)} µg/m²)
            </span>
            <span
              className={
                activeInspectRow.isNoiseEvent
                  ? 'text-amber-300 font-bold'
                  : 'text-slate-300'
              }
            >
              Støj ={' '}
              {convertDb(activeInspectRow.estimatedLaeqDb, {
                windSpeedMs: activeInspectRow.windSpeedMs,
                windGustMs: activeInspectRow.windGustMs,
              }).toFixed(1)}{' '}
              {unitLabel}
            </span>
            {onFileFormalNoiseReport && (
              <button
                type="button"
                data-testid="open-formal-noise-report-btn"
                onClick={() => setIsDraftOpen((v) => !v)}
                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/75 text-rose-100 font-semibold text-[11px] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
                <span>Indgiv Formel Støjrapport</span>
              </button>
            )}
          </div>
        </div>

        {isDraftOpen && onFileFormalNoiseReport && (
          <div
            data-testid="formal-noise-report-draft-panel"
            className="p-2.5 rounded bg-slate-900 border border-rose-500/50 space-y-2 text-[11px]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums text-slate-200">
              <span className="font-semibold text-rose-200">
                Automatisk Udfyldt Retsmedicinsk Støjrapport
              </span>
              <span className="text-slate-400">Kl. {activeInspectRow.hourLabel} ({dateIso})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono tabular-nums">
              <div className="px-2 py-1.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Tidspunkt</div>
                <div className="text-slate-100 font-semibold">{dateIso} · {activeInspectRow.hourLabel}</div>
              </div>
              <div className="px-2 py-1.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Lokation</div>
                <div className="text-slate-100 font-semibold truncate" title={`${receptorName} (${receptorAddress})`}>
                  {receptorName}
                </div>
              </div>
              <div className="px-2 py-1.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Decibelniveau</div>
                <div className="text-amber-300 font-bold">
                  {convertDb(activeInspectRow.estimatedLaeqDb, {
                    windSpeedMs: activeInspectRow.windSpeedMs,
                    windGustMs: activeInspectRow.windGustMs,
                  }).toFixed(1)}{' '}
                  {unitLabel}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Valgfri bemærkning (fx maskintype eller oplevet støjgene)..."
                className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 text-[11px] focus:outline-none focus:border-rose-400"
              />
              <button
                type="button"
                data-testid="submit-formal-noise-report-btn"
                disabled={isFilingReport}
                onClick={handleSubmitFormalNoiseReport}
                className="px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-400 text-white font-mono font-bold text-[11px] cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                {isFilingReport ? 'Signerer SHA-256...' : 'Gem i Bevis-Log (SHA-256)'}
              </button>
            </div>
          </div>
        )}

        {filedObservationFeedback && (
          <div
            data-testid="formal-noise-report-confirmation"
            className="px-2.5 py-1.5 rounded bg-emerald-950/60 border border-emerald-500/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-emerald-200"
          >
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Støjrapport <strong>{filedObservationFeedback.code}</strong> oprettet i bevis-log (
                {filedObservationFeedback.locationLabel} ·{' '}
                {convertDb(activeInspectRow.estimatedLaeqDb, {
                  windSpeedMs: activeInspectRow.windSpeedMs,
                  windGustMs: activeInspectRow.windGustMs,
                }).toFixed(1)}{' '}
                {unitLabel})
              </span>
            </span>
            <button
              type="button"
              onClick={() => onSelectObservation?.(filedObservationFeedback)}
              className="underline text-emerald-100 hover:text-white cursor-pointer whitespace-nowrap"
            >
              Vis post ({filedObservationFeedback.sha256Signature.slice(0, 8)}…)
            </button>
          </div>
        )}

        {activeInspectRow.hourComplaints.length > 0 ? (
          <div className="space-y-1 pt-1 border-t border-slate-800/80">
            <div className="text-[11px] text-slate-400">
              Registrerede naboklager &amp; hændelser kl.{' '}
              {activeInspectRow.hourLabel}:
            </div>
            {activeInspectRow.hourComplaints.slice(0, 3).map((obs) => (
              <button
                key={obs.id}
                type="button"
                onClick={() => onSelectObservation?.(obs)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-mono font-semibold text-fuchsia-300 mr-1.5">
                    {obs.code}
                  </span>
                  <span className="text-slate-200">{obs.observationType}</span>
                  <span className="text-slate-400 ml-1.5">
                    — {obs.locationLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-slate-300">
                  {isNoiseObservation(obs) && (
                    <Volume2 className="w-3 h-3 text-amber-400" />
                  )}
                  {isDustObservation(obs) && (
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                  )}
                  <span>SHA-256: {obs.sha256Signature.slice(0, 8)}…</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-slate-400">
            Ingen registrerede naboklager kl. {activeInspectRow.hourLabel} —{' '}
            {activeInspectRow.isSevereGust
              ? 'kraftige vindstød øger dog risikoen for støvresuspension og medvindsstøj.'
              : 'moderate vindstødsforhold i denne time.'}
          </div>
        )}
      </div>
    </section>
  );
};
