/**
 * @file src/components/GustMachineImpulseStatisticalWidget.tsx
 * @description Interaktiv statistisk korrelations-widget i 'Støj & Støv'-panelet,
 * der beregner Pearson r, R², lineær regression og t-værdi mellem vindstød (gusts)
 * og maskinstøj (impulsstøj), så brugere hurtigt kan identificere støj-farlige vejrscenarier.
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Crosshair,
  Sliders,
  TrendingUp,
  Volume2,
  Wind,
} from 'lucide-react';
import { HourlyWeatherPoint } from '../types/dispersion';
import {
  DEMOLITION_ACTIVITY_MODES,
  DemolitionActivityModeId,
} from './WeatherNoiseDustCorrelationPanel';
import { computeGustMachineImpulseStatistics } from '../utils/gustNoiseStatistics';

export interface GustMachineImpulseStatisticalWidgetProps {
  weatherHours: HourlyWeatherPoint[];
  selectedHourIndex: number;
  onSelectHour: (hourIndex: number) => void;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  dateIso: string;
}

export const GustMachineImpulseStatisticalWidget: React.FC<
  GustMachineImpulseStatisticalWidgetProps
> = ({
  weatherHours,
  selectedHourIndex,
  onSelectHour,
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
  dateIso,
}) => {
  const [selectedModeId, setSelectedModeId] = useState<'active_slider' | DemolitionActivityModeId>(
    'hydraulisk_betonknusning'
  );
  const [gustThresholdMs, setGustThresholdMs] = useState<number>(12.0);
  const [impulseThresholdDb, setImpulseThresholdDb] = useState<number>(80.0);

  const activeSpec = useMemo(() => {
    if (selectedModeId === 'active_slider') {
      return {
        label: `Aktiv L_WA-styring (${
          isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb.toFixed(0) : '114'
        } dB)`,
        lwaDb: isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114,
        impulsePenaltyDb: 14.5,
      };
    }
    const m = DEMOLITION_ACTIVITY_MODES[selectedModeId];
    return {
      label: m.shortLabel,
      lwaDb: m.baseSoundPowerLwaDb,
      impulsePenaltyDb: m.impulsePenaltyDb,
    };
  }, [selectedModeId, isManualMachineNoiseOverrideActive, manualMachineNoiseOutputDb]);

  const stats = useMemo(
    () =>
      computeGustMachineImpulseStatistics({
        weatherHours,
        machineLwaDb: activeSpec.lwaDb,
        impulsePenaltyDb: activeSpec.impulsePenaltyDb,
        gustHazardThresholdMs: gustThresholdMs,
        impulseHazardThresholdDb: impulseThresholdDb,
      }),
    [weatherHours, activeSpec, gustThresholdMs, impulseThresholdDb]
  );

  // Scatter SVG geometry (X = windGustMs, Y = impulseLafmaxDb)
  const W = 440,
    H = 172,
    padL = 36,
    padR = 16,
    padT = 14,
    padB = 26;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;

  const minG = 3,
    maxG = Math.max(22, Math.ceil(stats.maxGustMs + 2));
  const minDb = 42,
    maxDb = Math.max(96, Math.ceil(stats.maxImpulseDb + 4));

  const xForG = (g: number) =>
    padL + ((Math.min(maxG, Math.max(minG, g)) - minG) / (maxG - minG)) * plotW;
  const yForDb = (db: number) =>
    padT +
    plotH -
    ((Math.min(maxDb, Math.max(minDb, db)) - minDb) / (maxDb - minDb)) * plotH;

  // Regression line endpoints across [minG, maxG]
  const regY1 = stats.interceptDb + stats.slopeDbPerMs * minG;
  const regY2 = stats.interceptDb + stats.slopeDbPerMs * maxG;

  return (
    <section
      data-testid="gust-machine-impulse-statistical-widget"
      className="rounded-md bg-[#0B0E17] border border-cyan-500/45 p-3.5 space-y-3 font-mono text-xs text-slate-100 tabular-nums"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs">
            <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Statistisk Korrelation: Vindstød (Gusts) vs. Maskin-Impulsstøj ({dateIso})
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans">
            Beregner Pearsons korrelationskoefficient <strong className="text-white">r</strong>,
            forklaringsgrad <strong className="text-white">R²</strong> og lineær regression til hurtig
            identifikation af støj-farlige vejrscenarier.
          </p>
        </div>

        <label className="flex items-center gap-1.5 bg-[#07090E] border border-slate-800 rounded px-2 py-1 text-[11px]">
          <span className="text-slate-400">Maskintype:</span>
          <select
            aria-label="Vælg maskintype til statistisk vindstød-korrelation"
            value={selectedModeId}
            onChange={(e) =>
              setSelectedModeId(e.target.value as 'active_slider' | DemolitionActivityModeId)
            }
            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-cyan-200 font-semibold text-[11px] focus:outline-none"
          >
            <option value="active_slider">Aktiv L_WA-styring</option>
            {Object.values(DEMOLITION_ACTIVITY_MODES).map((m) => (
              <option key={m.id} value={m.id}>
                {m.shortLabel}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Interactive Threshold Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 rounded bg-[#07090E] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 inline-flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              Vindstøds-grænse (støj-farligt vejr)
            </span>
            <strong className="text-cyan-300">{gustThresholdMs.toFixed(1)} m/s</strong>
          </div>
          <input
            type="range"
            min={7}
            max={20}
            step={0.5}
            value={gustThresholdMs}
            onChange={(e) => setGustThresholdMs(Number(e.target.value))}
            aria-label="Juster vindstøds-grænse i m/s"
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        <div className="p-2 rounded bg-[#07090E] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 inline-flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              Impulsstøj-tærskel L_AFmax
            </span>
            <strong className="text-rose-300">{impulseThresholdDb.toFixed(0)} dB(A)</strong>
          </div>
          <input
            type="range"
            min={70}
            max={95}
            step={1}
            value={impulseThresholdDb}
            onChange={(e) => setImpulseThresholdDb(Number(e.target.value))}
            aria-label="Juster impulsstøj-tærskel i dB(A)"
            className="w-full accent-rose-400 cursor-pointer"
          />
        </div>
      </div>

      {/* 4 Statistical KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <div className="p-2 rounded bg-[#07090E] border border-slate-800">
          <div className="text-slate-400">Pearson r (Stød ↔ dB)</div>
          <div
            className={`text-base font-extrabold mt-0.5 ${
              stats.pearsonR >= 0.65
                ? 'text-rose-300'
                : stats.pearsonR >= 0.35
                ? 'text-amber-300'
                : 'text-cyan-300'
            }`}
          >
            r = {stats.pearsonR >= 0 ? `+${stats.pearsonR.toFixed(2)}` : stats.pearsonR.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">t = {stats.tStatistic.toFixed(2)}</div>
        </div>

        <div className="p-2 rounded bg-[#07090E] border border-slate-800">
          <div className="text-slate-400">Forklaringsgrad (R²)</div>
          <div className="text-base font-extrabold text-cyan-300 mt-0.5">
            {(stats.rSquared * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 truncate" title={stats.significanceLabelDa}>
            {stats.significanceLabelDa}
          </div>
        </div>

        <div className="p-2 rounded bg-[#07090E] border border-slate-800">
          <div className="text-slate-400">Hældning (Vindfølsomhed)</div>
          <div className="text-base font-extrabold text-amber-300 mt-0.5">
            {stats.slopeDbPerMs >= 0 ? '+' : ''}
            {stats.slopeDbPerMs.toFixed(2)} dB/(m/s)
          </div>
          <div className="text-[11px] text-slate-400">Max stød: {stats.maxGustMs.toFixed(1)} m/s</div>
        </div>

        <div
          className={`p-2 rounded border ${
            stats.criticalScenarioCount > 0
              ? 'bg-rose-950/45 border-rose-500/60'
              : stats.hazardousScenarioCount > 0
              ? 'bg-amber-950/40 border-amber-500/60'
              : 'bg-[#07090E] border-emerald-500/40'
          }`}
        >
          <div className="text-slate-300">Støj-Farlige Scenarier</div>
          <div
            className={`text-base font-extrabold mt-0.5 ${
              stats.criticalScenarioCount > 0
                ? 'text-rose-300'
                : stats.hazardousScenarioCount > 0
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {stats.hazardousScenarioCount} / 24 timer
          </div>
          <div className="text-[11px] text-slate-300">
            {stats.criticalScenarioCount} kritiske · Max {stats.maxImpulseDb.toFixed(1)} dB
          </div>
        </div>
      </div>

      {/* Interactive Regression Scatter Plot (Wind Gust m/s vs Impulse Noise dB(A)) */}
      <div className="rounded bg-[#07090E] border border-slate-800 p-2 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Spredningsplot: X = Vindstød (m/s) · Y = Maskin-Impulsstøj L_AFmax (dB) · Stiplet rød =
            farezone
          </span>
          <span className="text-slate-200">{activeSpec.label}</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none">
          {/* Hazardous quadrant shading (windGust >= gustThresholdMs AND impulse >= impulseThresholdDb) */}
          <rect
            x={xForG(gustThresholdMs)}
            y={padT}
            width={Math.max(0, padL + plotW - xForG(gustThresholdMs))}
            height={Math.max(0, yForDb(impulseThresholdDb) - padT)}
            fill="#f43f5e"
            fillOpacity={0.14}
          />
          <line
            x1={xForG(gustThresholdMs)}
            y1={padT}
            x2={xForG(gustThresholdMs)}
            y2={padT + plotH}
            stroke="#22d3ee"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <line
            x1={padL}
            y1={yForDb(impulseThresholdDb)}
            x2={padL + plotW}
            y2={yForDb(impulseThresholdDb)}
            stroke="#f43f5e"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* Linear regression line */}
          <line
            x1={xForG(minG)}
            y1={yForDb(regY1)}
            x2={xForG(maxG)}
            y2={yForDb(regY2)}
            stroke="#fbbf24"
            strokeWidth={1.6}
            strokeOpacity={0.85}
          />

          {/* Axis Labels */}
          <text x={4} y={yForDb(impulseThresholdDb) + 3} className="fill-rose-300 text-[9.5px]">
            {impulseThresholdDb}dB
          </text>
          <text x={4} y={padT + 8} className="fill-slate-400 text-[9px]">
            {maxDb}dB
          </text>
          <text x={4} y={padT + plotH} className="fill-slate-400 text-[9px]">
            {minDb}dB
          </text>
          <text
            x={xForG(gustThresholdMs)}
            y={H - 6}
            textAnchor="middle"
            className="fill-cyan-300 text-[9.5px] font-bold"
          >
            {gustThresholdMs.toFixed(0)} m/s
          </text>
          <text x={padL} y={H - 6} className="fill-slate-500 text-[9px]">
            {minG} m/s
          </text>
          <text x={padL + plotW - 22} y={H - 6} className="fill-slate-500 text-[9px]">
            {maxG} m/s
          </text>

          {/* Data Points (click to focus hour) */}
          {stats.points.map((pt) => {
            const cx = xForG(pt.windGustMs);
            const cy = yForDb(pt.impulseLafmaxDb);
            const isSel = pt.hourIndex === selectedHourIndex;
            const fill =
              pt.hazardLevel === 'KRITISK'
                ? '#f43f5e'
                : pt.hazardLevel === 'HØJ RISIKO'
                ? '#f59e0b'
                : pt.hazardLevel === 'MODERAT'
                ? '#eab308'
                : '#38bdf8';

            return (
              <g
                key={`scatter-${pt.hourIndex}`}
                className="cursor-pointer"
                onClick={() => onSelectHour(pt.hourIndex)}
              >
                <title>
                  {`Kl. ${pt.hourLabel}: Vindstød ${pt.windGustMs.toFixed(1)} m/s · Impulsstøj ${pt.impulseLafmaxDb.toFixed(1)} dB (${pt.hazardLevel})`}
                </title>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSel ? 5.6 : pt.isHazardousScenario ? 4.3 : 3.2}
                  fill={fill}
                  stroke={isSel ? '#ffffff' : '#0f172a'}
                  strokeWidth={isSel ? 1.8 : 1}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detected Noise-Hazardous Weather Scenarios */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Identificerede Støj-Farlige Vejrscenarier ({stats.hazardousScenarioCount})</span>
          </span>
          <span className="text-slate-400 font-normal">Klik for at inspicere time</span>
        </div>

        {stats.hazardousScenariosSorted.length === 0 ? (
          <div className="p-2.5 rounded bg-[#07090E] border border-emerald-500/35 text-emerald-200 text-[11px]">
            Ingen støj-farlige vejrscenarier overskrider de aktuelle tærskler (
            {gustThresholdMs.toFixed(1)} m/s &amp; {impulseThresholdDb.toFixed(0)} dB). Sænk evt.
            grænseværdierne ovenfor for sensitivitetstest.
          </div>
        ) : (
          <div className="max-h-32 overflow-y-auto rounded border border-slate-800 divide-y divide-slate-800/80 bg-[#07090E]">
            {stats.hazardousScenariosSorted.map((sc) => (
              <button
                key={`haz-sc-${sc.hourIndex}`}
                type="button"
                onClick={() => onSelectHour(sc.hourIndex)}
                className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left text-[11px] cursor-pointer transition-colors ${
                  sc.hourIndex === selectedHourIndex
                    ? 'bg-rose-950/55 text-white'
                    : 'hover:bg-slate-900 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold shrink-0 ${
                      sc.hazardLevel === 'KRITISK'
                        ? 'bg-rose-500/25 text-rose-200 border border-rose-400/60'
                        : 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                    }`}
                  >
                    {sc.hazardLevel}
                  </span>
                  <span className="font-bold shrink-0">Kl. {sc.hourLabel}</span>
                  <span className="truncate text-slate-300">{sc.scenarioDescriptionDa}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-cyan-300 shrink-0 font-semibold">
                  <Volume2 className="w-3 h-3" />
                  <span>{sc.impulseLafmaxDb.toFixed(1)} dB</span>
                  <Crosshair className="w-3 h-3 ml-1" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
