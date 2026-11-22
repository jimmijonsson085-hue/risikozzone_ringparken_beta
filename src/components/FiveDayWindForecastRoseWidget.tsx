/**
 * @file src/components/FiveDayWindForecastRoseWidget.tsx
 * @description 5-døgnsprognose for vindretning og -styrke (Open-Meteo) samt
 * et 7-dages Vindrose-overblik for den kommende uge i 'Spredning & Vejr'.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CloudRain, Compass, RefreshCw, Wind } from 'lucide-react';
import {
  Next7DayForecastDay,
  buildCalibratedNext7DaysForecast,
  degreesToCompass,
  fetchNext7DaysForecastForSlagelse,
} from '../services/weatherService';
import { WeatherDataset } from '../types/dispersion';

export interface FiveDayWindForecastRoseWidgetProps {
  todayIso: string;
  onSelectForecastDay?: (dateIso: string, dataset: WeatherDataset) => void;
}

interface CompassSectorBin {
  label: string;
  centerDeg: number;
  hoursCount: number;
  pct: number;
  lowSpeedPct: number; // < 5 m/s
  medSpeedPct: number; // 5..10 m/s
  highSpeedPct: number; // > 10 m/s
  avgSpeedMs: number;
  maxGustMs: number;
}

const COMPASS_SECTORS: Array<{ label: string; centerDeg: number }> = [
  { label: 'N', centerDeg: 0 },
  { label: 'NØ', centerDeg: 45 },
  { label: 'Ø', centerDeg: 90 },
  { label: 'SØ', centerDeg: 135 },
  { label: 'S', centerDeg: 180 },
  { label: 'SV', centerDeg: 225 },
  { label: 'V', centerDeg: 270 },
  { label: 'NV', centerDeg: 315 },
];

function computeWeeklyWindRoseBins(days: Next7DayForecastDay[]): {
  bins: CompassSectorBin[];
  totalHours: number;
  maxSectorPct: number;
  dominantSector: CompassSectorBin;
  highWindHours: number;
} {
  const allHours = days.flatMap((d) => d.dataset.hours);
  const totalHours = Math.max(1, allHours.length);

  const rawCounts = COMPASS_SECTORS.map((s) => ({
    ...s,
    low: 0,
    med: 0,
    high: 0,
    speedSum: 0,
    maxGust: 0,
  }));

  let highWindHours = 0;

  for (const hr of allHours) {
    const normDeg = ((hr.windDirection10m % 360) + 360) % 360;
    const idx = Math.floor(((normDeg + 22.5) % 360) / 45);
    const bin = rawCounts[idx] || rawCounts[0];
    bin.speedSum += hr.windSpeed10m;
    if (hr.windGusts10m > bin.maxGust) bin.maxGust = hr.windGusts10m;
    if (hr.windSpeed10m > 10) {
      bin.high += 1;
      highWindHours += 1;
    } else if (hr.windSpeed10m >= 5) {
      bin.med += 1;
    } else {
      bin.low += 1;
    }
  }

  const bins: CompassSectorBin[] = rawCounts.map((b) => {
    const count = b.low + b.med + b.high;
    return {
      label: b.label,
      centerDeg: b.centerDeg,
      hoursCount: count,
      pct: Number(((count / totalHours) * 100).toFixed(1)),
      lowSpeedPct: Number(((b.low / totalHours) * 100).toFixed(1)),
      medSpeedPct: Number(((b.med / totalHours) * 100).toFixed(1)),
      highSpeedPct: Number(((b.high / totalHours) * 100).toFixed(1)),
      avgSpeedMs: count > 0 ? Number((b.speedSum / count).toFixed(1)) : 0,
      maxGustMs: Number(b.maxGust.toFixed(1)),
    };
  });

  const maxSectorPct = Math.max(12, ...bins.map((b) => b.pct));
  const dominantSector = [...bins].sort((a, b) => b.hoursCount - a.hoursCount)[0] || bins[0];

  return { bins, totalHours: allHours.length, maxSectorPct, dominantSector, highWindHours };
}

export const FiveDayWindForecastRoseWidget: React.FC<FiveDayWindForecastRoseWidgetProps> = ({
  todayIso,
  onSelectForecastDay,
}) => {
  const [forecastDays, setForecastDays] = useState<Next7DayForecastDay[]>(() =>
    buildCalibratedNext7DaysForecast(todayIso)
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveOpenMeteo, setIsLiveOpenMeteo] = useState<boolean>(false);

  const loadForecast = async () => {
    setIsLoading(true);
    try {
      const days = await fetchNext7DaysForecastForSlagelse(todayIso);
      setForecastDays(days);
      setIsLiveOpenMeteo(
        days.some((d) => d.dataset.sourceApi.toLowerCase().includes('open-meteo'))
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchNext7DaysForecastForSlagelse(todayIso)
      .then((days) => {
        if (!active) return;
        setForecastDays(days);
        setIsLiveOpenMeteo(
          days.some((d) => d.dataset.sourceApi.toLowerCase().includes('open-meteo'))
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [todayIso]);

  const fiveDays = useMemo(() => forecastDays.slice(0, 5), [forecastDays]);
  const weeklyRose = useMemo(() => computeWeeklyWindRoseBins(forecastDays), [forecastDays]);

  const svgSize = 188;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxR = 66;

  return (
    <div
      data-testid="five-day-wind-forecast-rose-widget"
      className="p-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3 font-mono text-xs"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] uppercase tracking-wide">
            <Wind className="w-4 h-4 text-sky-400 shrink-0" />
            <span>5-Døgns Vindprognose &amp; Uge-Vindrose (Open-Meteo)</span>
          </div>
          <p className="text-[11px] font-sans text-[var(--text-secondary)]">
            Kommende 5 døgns vindretning og -styrke for Slagelse inkl. 7-dages vindrose-overblik
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded text-[11px] border ${
              isLiveOpenMeteo
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                : 'bg-[var(--surface-panel)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
            }`}
          >
            {isLiveOpenMeteo ? 'Open-Meteo Prognose' : 'Kalibreret Prognose'}
          </span>
          <button
            type="button"
            onClick={() => void loadForecast()}
            disabled={isLoading}
            className="p-1.5 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
            title="Opdater Open-Meteo 5-/7-døgnsprognose"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 5-Day Forecast Table */}
      <div className="space-y-1.5">
        {fiveDays.map((day) => {
          const isHighWind = day.maxWindSpeedMs > 10;
          const windCompass = degreesToCompass(day.dominantWindFromDeg);
          return (
            <button
              key={day.dateIso}
              type="button"
              onClick={() => onSelectForecastDay?.(day.dateIso, day.dataset)}
              className={`w-full text-left p-2 rounded border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                isHighWind
                  ? 'bg-rose-950/35 border-[var(--status-critical-border)]/60 hover:bg-rose-950/50'
                  : 'bg-[var(--surface-panel)] border-[var(--border-subtle)] hover:bg-[var(--surface-overlay)]'
              }`}
              title={`Klik for at indlæse ${day.weekdayNameDa} (${day.dateIso}) i kortet`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <Calendar className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>
                    {day.weekdayNameDa.slice(0, 3)} {day.dayLabelShort}
                  </span>
                  {day.totalPrecipitationMm > 0.5 && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-sky-300 font-normal">
                      <CloudRain className="w-3 h-3" />
                      {day.totalPrecipitationMm.toFixed(1)}mm
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-sans text-[var(--text-secondary)] truncate mt-0.5">
                  Fane → {day.dominantPlumeSector} ({day.dominantPlumeToDeg}°) · {day.minTempC}–
                  {day.maxTempC}°C
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 tabular-nums text-right">
                <div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Fra</div>
                  <div className="font-bold text-sky-300 flex items-center justify-end gap-1">
                    <Compass className="w-3 h-3" />
                    <span>
                      {windCompass} ({day.dominantWindFromDeg}°)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Middel / Maks</div>
                  <div
                    className={`font-bold ${
                      isHighWind
                        ? 'text-[var(--status-critical-text)]'
                        : day.maxWindSpeedMs >= 8
                        ? 'text-[var(--status-warning-text)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {day.meanWindSpeedMs.toFixed(1)} / {day.maxWindSpeedMs.toFixed(1)} m/s
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Weekly Wind Rose Overview (Upcoming 7 Days / 168h) */}
      <div className="p-2.5 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
            Vindrose-Overblik · Kommende Uge ({weeklyRose.totalHours} timer)
          </span>
          <span className="text-[11px] text-[var(--text-secondary)] tabular-nums">
            Højvind (&gt;10 m/s):{' '}
            <strong
              className={
                weeklyRose.highWindHours > 0
                  ? 'text-[var(--status-critical-text)]'
                  : 'text-[var(--text-primary)]'
              }
            >
              {weeklyRose.highWindHours}t
            </strong>
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <svg
            width={svgSize}
            height={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className="shrink-0"
            role="img"
            aria-label="Kommende uges vindrose for Slagelse"
          >
            {/* Concentric Reference Circles */}
            {[0.33, 0.66, 1.0].map((ratio, idx) => (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={maxR * ratio}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray={idx < 2 ? '2 2' : undefined}
              />
            ))}
            {/* Crosshair Axes */}
            <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#334155" strokeWidth="1" />
            <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#334155" strokeWidth="1" />

            {/* 8 Directional Wedges */}
            {weeklyRose.bins.map((bin) => {
              if (bin.pct <= 0) return null;
              const startAngle = ((bin.centerDeg - 18 - 90) * Math.PI) / 180;
              const endAngle = ((bin.centerDeg + 18 - 90) * Math.PI) / 180;

              const drawSectorWedge = (rVal: number, color: string, keySuffix: string) => {
                if (rVal <= 1) return null;
                const x1 = cx + rVal * Math.cos(startAngle);
                const y1 = cy + rVal * Math.sin(startAngle);
                const x2 = cx + rVal * Math.cos(endAngle);
                const y2 = cy + rVal * Math.sin(endAngle);
                const d = `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(
                  1
                )} A ${rVal.toFixed(1)} ${rVal.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(
                  1
                )} Z`;
                return (
                  <path
                    key={`${bin.label}-${keySuffix}`}
                    d={d}
                    fill={color}
                    stroke="#0B0F19"
                    strokeWidth="0.7"
                  />
                );
              };

              const rTotal = (bin.pct / weeklyRose.maxSectorPct) * maxR;
              const rMedAndLow =
                ((bin.lowSpeedPct + bin.medSpeedPct) / weeklyRose.maxSectorPct) * maxR;
              const rLow = (bin.lowSpeedPct / weeklyRose.maxSectorPct) * maxR;

              return (
                <g key={bin.label}>
                  {drawSectorWedge(rTotal, '#EF4444', 'high')}
                  {drawSectorWedge(rMedAndLow, '#38BDF8', 'med')}
                  {drawSectorWedge(rLow, '#64748B', 'low')}
                </g>
              );
            })}

            {/* Sector Labels */}
            {COMPASS_SECTORS.map((sec) => {
              const rad = ((sec.centerDeg - 90) * Math.PI) / 180;
              const lx = cx + (maxR + 14) * Math.cos(rad);
              const ly = cy + (maxR + 14) * Math.sin(rad) + 3.5;
              const isDom = sec.label === weeklyRose.dominantSector.label;
              return (
                <text
                  key={sec.label}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  className={`text-[10px] font-mono ${
                    isDom ? 'fill-amber-300 font-bold' : 'fill-slate-400'
                  }`}
                >
                  {sec.label}
                </text>
              );
            })}
          </svg>

          <div className="flex-1 space-y-2 text-[11px] min-w-0 w-full">
            <div className="p-2 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)]">
              <div className="text-[var(--text-secondary)]">Dominerende Vindretning (7d)</div>
              <div className="font-bold text-[var(--text-primary)] mt-0.5 tabular-nums">
                Fra {weeklyRose.dominantSector.label} ({weeklyRose.dominantSector.pct.toFixed(0)}%) ·
                Gns {weeklyRose.dominantSector.avgSpeedMs.toFixed(1)} m/s
              </div>
              <div className="text-[var(--text-secondary)] mt-0.5">
                Primær fane mod {degreesToCompass((weeklyRose.dominantSector.centerDeg + 180) % 360)}
              </div>
            </div>

            {/* Compact Legend */}
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-500 inline-block shrink-0" />
                <span className="text-[var(--text-secondary)]">Svag vind (&lt; 5 m/s)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block shrink-0" />
                <span className="text-[var(--text-secondary)]">Frisk vind (5 – 10 m/s)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-red-500 inline-block shrink-0" />
                <span className="text-[var(--text-secondary)]">Højvind (&gt; 10 m/s)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
