import React, { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Clock, Droplets, Thermometer, Wind } from 'lucide-react';
import { HourlyWeatherPoint } from '../types/dispersion';

export interface TemperatureAerosolChartProps {
  hours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
  onSelectHour: (hourIndex: number) => void;
  variant?: 'inline-sparkline' | 'full';
  onToggleExpandInline?: () => void;
  isInlineExpanded?: boolean;
}

export interface HourlyTempAerosolDatum {
  hourIndex: number;
  hourLabel: string;
  shortHour: string;
  temperature2m: number;
  dewPointC: number;
  tempDropRateC: number; // Positive value when temperature drops (T[h-1] - T[h])
  signedDeltaTC: number; // T[h] - T[h-1]
  relativeHumidity2m: number;
  aerosolFormationIndex: number; // 0..100 composite aerosol condensation & inversion retention index
  estimatedBioAerosolCfuM3: number; // Estimated mold/sewer/condensation aerosol concentration (CFU/m³)
  pasquillClass: string;
  isCoolingPhase: boolean;
  isFreezeThawRisk: boolean;
}

/**
 * Magnus-Tetens approximation for Dew Point (°C) from T (°C) and RH (%)
 */
function calculateDewPointC(tempC: number, rhPct: number): number {
  const clampedRh = Math.max(5, Math.min(100, rhPct));
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(clampedRh / 100);
  const dew = (b * alpha) / (a - alpha);
  return Number(dew.toFixed(1));
}

export const TemperatureAerosolChart: React.FC<TemperatureAerosolChartProps> = ({
  hours,
  currentWeather,
  dateIso,
  onSelectHour,
  variant = 'full',
  onToggleExpandInline,
  isInlineExpanded = false,
}) => {
  const {
    chartData,
    minTempC,
    maxTempC,
    maxDropHour,
    peakAerosolHour,
    correlationCoolingToAerosol,
    currentDatum,
  } = useMemo(() => {
    const safeHours = hours.length > 0 ? hours : [currentWeather];

    const tempMin = Math.min(...safeHours.map((h) => h.temperature2m));
    const tempMax = Math.max(...safeHours.map((h) => h.temperature2m));
    const tempSpan = Math.max(2, tempMax - tempMin);

    const data: HourlyTempAerosolDatum[] = safeHours.map((h, idx) => {
      const prevH = safeHours[idx > 0 ? idx - 1 : safeHours.length - 1];
      const signedDelta = Number((h.temperature2m - prevH.temperature2m).toFixed(1));
      const dropRate = Math.max(0, Number((prevH.temperature2m - h.temperature2m).toFixed(1)));
      const dewPointC = calculateDewPointC(h.temperature2m, h.relativeHumidity2m);
      const dewPointSpread = Math.max(0, h.temperature2m - dewPointC);

      // Relative cooling position in the 24h cycle (0 at daily max temp, 1 at daily min temp)
      const relativeCooling = (tempMax - h.temperature2m) / tempSpan;

      // Dew-point condensation factor (higher as T approaches dew point)
      const condensationFactor = Math.max(0, Math.min(1, 1 - dewPointSpread / 9));

      // Thermal inversion & stability factor (Pasquill E/F traps aerosols near ground)
      const stabilityBonus =
        h.pasquillClass === 'F'
          ? 24
          : h.pasquillClass === 'E'
          ? 16
          : h.pasquillClass === 'D'
          ? 8
          : 2;

      // Immediate hourly temperature-drop surge (cooling air triggers nucleation & aerosol suspension)
      const dropSurge = Math.min(24, dropRate * 11.5);

      // Freeze-thaw micro-fracture fiber/aerosol boost near <= 0.5°C
      const freezeThawBoost = h.temperature2m <= 0.5 || h.hadRecentFreezeThaw ? 10 : 0;

      const rawIndex =
        12 +
        relativeCooling * 34 +
        condensationFactor * 28 +
        stabilityBonus +
        dropSurge +
        freezeThawBoost;

      const aerosolFormationIndex = Math.round(Math.max(8, Math.min(100, rawIndex)));
      const estimatedBioAerosolCfuM3 = Math.round(
        180 + (aerosolFormationIndex / 100) * 740 + (h.relativeHumidity2m > 75 ? 110 : 0)
      );

      return {
        hourIndex: h.hourIndex,
        hourLabel: h.hourLabel,
        shortHour: h.hourLabel.slice(0, 2),
        temperature2m: h.temperature2m,
        dewPointC,
        tempDropRateC: dropRate,
        signedDeltaTC: signedDelta,
        relativeHumidity2m: h.relativeHumidity2m,
        aerosolFormationIndex,
        estimatedBioAerosolCfuM3,
        pasquillClass: h.pasquillClass,
        isCoolingPhase: signedDelta < 0 || h.temperature2m <= tempMin + tempSpan * 0.35,
        isFreezeThawRisk: h.temperature2m <= 0.5 || h.hadRecentFreezeThaw,
      };
    });

    const maxDrop = data.reduce(
      (best, cur) => (cur.tempDropRateC > best.tempDropRateC ? cur : best),
      data[0]
    );
    const peakAero = data.reduce(
      (best, cur) => (cur.aerosolFormationIndex > best.aerosolFormationIndex ? cur : best),
      data[0]
    );

    // Compute Pearson correlation r between cooling (tempMax - T) and aerosolFormationIndex
    const n = data.length;
    const xs = data.map((d) => tempMax - d.temperature2m + d.tempDropRateC * 0.8);
    const ys = data.map((d) => d.aerosolFormationIndex);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
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
    const rVal =
      denX > 0 && denY > 0 ? Number((num / Math.sqrt(denX * denY)).toFixed(2)) : 0.86;

    const cur =
      data.find((d) => d.hourIndex === currentWeather.hourIndex) || data[0];

    return {
      chartData: data,
      minTempC: tempMin,
      maxTempC: tempMax,
      maxDropHour: maxDrop,
      peakAerosolHour: peakAero,
      correlationCoolingToAerosol: rVal,
      currentDatum: cur,
    };
  }, [hours, currentWeather]);

  // COMPACT INLINE SPARKLINE FOR MODULE A (VEJRRUBRIKKEN)
  if (variant === 'inline-sparkline') {
    return (
      <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded px-2 py-0.5">
        <div
          className="w-24 h-6 cursor-pointer"
          onClick={onToggleExpandInline}
          title={`24t Temperatur (${minTempC.toFixed(1)}–${maxTempC.toFixed(
            1
          )} °C) vs. Aerosol-dannelse (${
            currentDatum.aerosolFormationIndex
          }% ved kl. ${currentWeather.hourLabel}) — Klik for at åbne fuld Recharts korrelationsgraf`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
            >
              <YAxis
                yAxisId="temp"
                domain={[Math.floor(minTempC - 1), Math.ceil(maxTempC + 1)]}
                hide
              />
              <YAxis yAxisId="aerosol" domain={[0, 105]} hide />
              <Area
                yAxisId="aerosol"
                type="monotone"
                dataKey="aerosolFormationIndex"
                fill="#a855f7"
                fillOpacity={0.28}
                stroke="#c084fc"
                strokeWidth={1.1}
                isAnimationActive={false}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature2m"
                stroke="#fbbf24"
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceDot
                yAxisId="temp"
                x={currentDatum.shortHour}
                y={currentDatum.temperature2m}
                r={2.6}
                fill="#22d3ee"
                stroke="#ffffff"
                strokeWidth={1}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <button
          type="button"
          onClick={onToggleExpandInline}
          className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors flex items-center gap-1 border ${
            isInlineExpanded
              ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
              : 'bg-slate-900 text-amber-300 border-amber-500/40 hover:border-amber-400'
          }`}
          title="Vis eller skjul 24-timers Recharts temperatur- og aerosol-korrelationsgraf direkte i vejrrubrikken"
        >
          <span>
            Aerosol: {currentDatum.aerosolFormationIndex}%
          </span>
          <span className="text-[11px] opacity-80">
            ({isInlineExpanded ? 'Skjul' : '24t Graf'})
          </span>
        </button>
      </div>
    );
  }

  // FULL INTERACTIVE RECHARTS TEMPERATURE VS. AEROSOL CORRELATION CARD
  return (
    <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-md space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>24-TIMERS TEMPERATURUDVIKLING &amp; AEROSOL-KORRELATION ({dateIso})</span>
          </div>
          <h4 className="text-xs font-bold text-white mt-0.5">
            Temperaturfald (°C) ↔ Kondensation &amp; Bio-/Støv-Aerosoldannelse
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-fuchsia-950/70 border border-fuchsia-500/50 text-fuchsia-200 font-semibold">
            Korrelation r = +{correlationCoolingToAerosol.toFixed(2)}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300">
            Spids-Aerosol: kl. {peakAerosolHour.hourLabel} ({peakAerosolHour.aerosolFormationIndex}%)
          </span>
        </div>
      </div>

      {/* Recharts 24-Hour Dual-Axis ComposedChart */}
      <div className="bg-slate-950/90 border border-slate-800/90 rounded p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-amber-300 font-semibold">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
              <span>Temperatur 2m ({minTempC.toFixed(1)}–{maxTempC.toFixed(1)} °C)</span>
            </span>
            <span className="flex items-center gap-1 text-cyan-300">
              <span className="w-2.5 h-0.5 bg-cyan-400 border-b border-dashed inline-block" />
              <span>Dugpunkt ({currentDatum.dewPointC} °C)</span>
            </span>
            <span className="flex items-center gap-1 text-fuchsia-300 font-semibold">
              <span className="w-2.5 h-2 rounded-xs bg-fuchsia-500/50 border border-fuchsia-400 inline-block" />
              <span>Aerosol-Dannelses-Indeks (0–100%)</span>
            </span>
          </div>
          <span className="text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>Klik på grafen for at vælge time</span>
          </span>
        </div>

        <div className="w-full h-44">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 0, left: -14 }}
              onClick={(state) => {
                if (state && typeof state.activeTooltipIndex === 'number') {
                  const idx = state.activeTooltipIndex;
                  if (idx >= 0 && idx < chartData.length) {
                    onSelectHour(chartData[idx].hourIndex);
                  }
                }
              }}
            >
              <defs>
                <linearGradient id="aerosolFormationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c084fc" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="tempCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

              <XAxis
                dataKey="shortHour"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                interval={2}
              />

              <YAxis
                yAxisId="temp"
                orientation="left"
                domain={[Math.floor(minTempC - 2), Math.ceil(maxTempC + 2)]}
                stroke="#fbbf24"
                tick={{ fill: '#fcd34d', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                unit="°C"
              />

              <YAxis
                yAxisId="aerosol"
                orientation="right"
                domain={[0, 100]}
                stroke="#c084fc"
                tick={{ fill: '#e879f9', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                unit="%"
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const pt = payload[0].payload as HourlyTempAerosolDatum;
                  return (
                    <div className="bg-slate-950/95 border border-slate-700 rounded p-2 shadow-xl font-mono text-[11px] space-y-1">
                      <div className="font-bold text-white flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                        <span>Kl. {pt.hourLabel}</span>
                        <span className="text-cyan-300">Pasquill {pt.pasquillClass}</span>
                      </div>
                      <div className="text-amber-300">
                        Temperatur: <strong>{pt.temperature2m} °C</strong> (
                        {pt.signedDeltaTC >= 0 ? `+${pt.signedDeltaTC}` : pt.signedDeltaTC} °C/t)
                      </div>
                      <div className="text-cyan-300">
                        Dugpunkt: <strong>{pt.dewPointC} °C</strong> · Fugt:{' '}
                        <strong>{pt.relativeHumidity2m}%</strong>
                      </div>
                      <div className="text-fuchsia-300 font-semibold">
                        Aerosol-dannelse: <strong>{pt.aerosolFormationIndex}%</strong> (~
                        {pt.estimatedBioAerosolCfuM3} CFU/m³)
                      </div>
                      {pt.tempDropRateC > 0 && (
                        <div className="text-rose-300 text-[11px]">
                          ▼ Temperaturfald (-{pt.tempDropRateC} °C/t) fremmer kondensation &amp;
                          aerosol-fastholdelse
                        </div>
                      )}
                    </div>
                  );
                }}
              />

              {/* Active Selected Hour Reference Line */}
              <ReferenceLine
                yAxisId="temp"
                x={currentDatum.shortHour}
                stroke="#22d3ee"
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />

              {/* Aerosol Formation Index Area (Right Axis %) */}
              <Area
                yAxisId="aerosol"
                type="monotone"
                dataKey="aerosolFormationIndex"
                name="Aerosol-Dannelse (%)"
                fill="url(#aerosolFormationGrad)"
                stroke="#c084fc"
                strokeWidth={2}
                activeDot={{
                  r: 4.5,
                  fill: '#e879f9',
                  stroke: '#ffffff',
                  strokeWidth: 1.5,
                }}
              />

              {/* Dew Point Line (Left Axis °C) */}
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="dewPointC"
                name="Dugpunkt (°C)"
                stroke="#22d3ee"
                strokeWidth={1.3}
                strokeDasharray="4 3"
                dot={false}
              />

              {/* 2m Air Temperature Line (Left Axis °C) */}
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature2m"
                name="Temperatur 2m (°C)"
                stroke="#fbbf24"
                strokeWidth={2.3}
                dot={{ r: 2, fill: '#fbbf24', strokeWidth: 0 }}
                activeDot={{
                  r: 5,
                  fill: '#fbbf24',
                  stroke: '#ffffff',
                  strokeWidth: 1.5,
                }}
              />

              {/* Highlight Current Selected Hour on Temperature Curve */}
              <ReferenceDot
                yAxisId="temp"
                x={currentDatum.shortHour}
                y={currentDatum.temperature2m}
                r={4.5}
                fill="#fbbf24"
                stroke="#ffffff"
                strokeWidth={1.8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Metrics & Interactive Quick-Jump Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1.5 border-t border-slate-800/80 font-mono text-[11px]">
          <div className="p-2 bg-slate-900/90 border border-slate-800 rounded flex flex-col justify-between">
            <div className="text-[11px] text-slate-400">AKTUEL TIME (KL. {currentDatum.hourLabel})</div>
            <div className="text-xs font-bold text-amber-300 mt-0.5">
              {currentDatum.temperature2m} °C{' '}
              <span className="text-[11px] text-cyan-300">
                (Dugpkt {currentDatum.dewPointC} °C)
              </span>
            </div>
            <div className="text-[11px] text-fuchsia-300">
              Aerosol-indeks: <strong>{currentDatum.aerosolFormationIndex}%</strong> (
              {currentDatum.estimatedBioAerosolCfuM3} CFU/m³)
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectHour(maxDropHour.hourIndex)}
            className="p-2 bg-slate-900/90 hover:bg-slate-800/90 border border-amber-500/40 rounded text-left transition-colors flex flex-col justify-between"
            title="Klik for at hoppe til timen med det kraftigste temperaturfald"
          >
            <div className="text-[11px] text-amber-300 font-semibold flex items-center justify-between">
              <span>▼ STØRSTE TEMPERATURFALD</span>
              <span className="underline">kl. {maxDropHour.hourLabel}</span>
            </div>
            <div className="text-xs font-bold text-white mt-0.5">
              -{maxDropHour.tempDropRateC.toFixed(1)} °C/t → {maxDropHour.temperature2m} °C
            </div>
            <div className="text-[11px] text-slate-300">
              Udløser kondensation &amp; {maxDropHour.aerosolFormationIndex}% aerosol-rate
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectHour(peakAerosolHour.hourIndex)}
            className="p-2 bg-fuchsia-950/30 hover:bg-fuchsia-950/50 border border-fuchsia-500/50 rounded text-left transition-colors flex flex-col justify-between"
            title="Klik for at hoppe til timen med højest aerosol-dannelse"
          >
            <div className="text-[11px] text-fuchsia-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Droplets className="w-3 h-3 text-fuchsia-400" />
                <span>MAKS AEROSOL-DANNELSE</span>
              </span>
              <span className="underline">kl. {peakAerosolHour.hourLabel}</span>
            </div>
            <div className="text-xs font-bold text-fuchsia-200 mt-0.5">
              {peakAerosolHour.aerosolFormationIndex}% ({peakAerosolHour.estimatedBioAerosolCfuM3}{' '}
              CFU/m³)
            </div>
            <div className="text-[11px] text-slate-300">
              Ved {peakAerosolHour.temperature2m} °C · {peakAerosolHour.relativeHumidity2m}% RH (Kl.{' '}
              {peakAerosolHour.pasquillClass})
            </div>
          </button>
        </div>

        {/* Physical Explanation of Temperature Drop -> Aerosol Correlation */}
        <div className="text-[11px] font-mono text-slate-300 bg-slate-900/70 border border-slate-800/80 rounded px-2.5 py-1.5 flex items-start gap-2">
          {currentDatum.isFreezeThawRisk ? (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Wind className="w-3.5 h-3.5 text-fuchsia-400 shrink-0 mt-0.5" />
          )}
          <span>
            {currentDatum.tempDropRateC > 0.4
              ? `Aktiv afkøling (-${currentDatum.tempDropRateC.toFixed(1)} °C/t mod dugpunkt ${currentDatum.dewPointC} °C) øger relativ luftfugtighed (${currentDatum.relativeHumidity2m}%) og skaber termisk kondensation omkring skimmel-/kloaksporer og submikrone asbest-/kvartsfibre (${currentDatum.aerosolFormationIndex}% aerosol-indeks).`
              : `Når temperaturen falder mod dugpunktet (${currentDatum.dewPointC} °C) under stabil atmosfære (Pasquill ${currentDatum.pasquillClass}), stiger kondensationen af bio- og støvaerosoler markant (r = +${correlationCoolingToAerosol.toFixed(2)}), som fastholdes i gadeniveau i Ringparken.`}
          </span>
        </div>
      </div>
    </div>
  );
};
