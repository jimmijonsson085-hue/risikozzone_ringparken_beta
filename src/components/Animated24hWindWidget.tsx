import React, { useState, useEffect, useMemo } from 'react';
import {
  Wind,
  Navigation,
  Play,
  Pause,
  Download,
  Check,
  Flame,
  Clock,
} from 'lucide-react';
import { HourlyWeatherPoint } from '../types/dispersion';

interface Animated24hWindWidgetProps {
  hours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
  onSelectHour?: (hourIndex: number) => void;
  onExportWeatherJson?: () => void;
  jsonExportedJustNow?: boolean;
  onOpenStackEffectVisualization?: () => void;
  indoorTempC?: number;
  variant?: 'rubric-box' | 'map-hud-box';
}

function degToCompassDa(deg: number): string {
  const dirs = ['N', 'NNØ', 'NØ', 'ØNØ', 'Ø', 'ØSØ', 'SØ', 'SSØ', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
  const normalized = ((deg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 22.5) % 16];
}

export const Animated24hWindWidget: React.FC<Animated24hWindWidgetProps> = ({
  hours,
  currentWeather,
  dateIso,
  onSelectHour,
  onExportWeatherJson,
  jsonExportedJustNow = false,
  onOpenStackEffectVisualization,
  indoorTempC = 22.5,
  variant = 'rubric-box',
}) => {
  const [isAnimating24h, setIsAnimating24h] = useState<boolean>(true);
  const [animProgress, setAnimProgress] = useState<number>(currentWeather.hourIndex);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2>(1);

  // Sync when user manually changes the global hour while paused
  useEffect(() => {
    if (!isAnimating24h) {
      setAnimProgress(currentWeather.hourIndex);
    }
  }, [currentWeather.hourIndex, isAnimating24h]);

  // Smooth 24-hour wind strength & direction animation loop
  useEffect(() => {
    if (!isAnimating24h || hours.length === 0) return;
    const step = 0.12 * speedMultiplier;
    const interval = window.setInterval(() => {
      setAnimProgress((prev) => {
        const next = prev + step;
        return next >= 24 ? 0 : next;
      });
    }, 80);
    return () => window.clearInterval(interval);
  }, [isAnimating24h, hours.length, speedMultiplier]);

  const activeHourIdx = Math.min(23, Math.max(0, Math.floor(animProgress)));
  const nextHourIdx = (activeHourIdx + 1) % 24;
  const frac = animProgress - activeHourIdx;

  const h0 = hours[activeHourIdx] || currentWeather;
  const h1 = hours[nextHourIdx] || h0;

  // Interpolate wind speed, gusts, temperature, and circular wind direction
  const interpolated = useMemo(() => {
    const speed = h0.windSpeed10m + (h1.windSpeed10m - h0.windSpeed10m) * frac;
    const gust = h0.windGusts10m + (h1.windGusts10m - h0.windGusts10m) * frac;
    const temp = h0.temperature2m + (h1.temperature2m - h0.temperature2m) * frac;

    let dDeg = h1.windDirection10m - h0.windDirection10m;
    if (dDeg > 180) dDeg -= 360;
    if (dDeg < -180) dDeg += 360;
    const windFromDeg = (h0.windDirection10m + dDeg * frac + 360) % 360;
    const plumeToDeg = (windFromDeg + 180) % 360;

    // Thermal stack effect ΔP_s at H=12m (with z_NPL=12m under active CAV suction)
    const ToK = temp + 273.15;
    const TiK = indoorTempC + 273.15;
    const stackDeltaPsPa = Math.max(0, 3460 * (1 / ToK - 1 / TiK) * 12.0);

    return {
      speed: Number(speed.toFixed(1)),
      gust: Number(gust.toFixed(1)),
      temp: Number(temp.toFixed(1)),
      windFromDeg: Math.round(windFromDeg),
      plumeToDeg: Math.round(plumeToDeg),
      windFromCompass: degToCompassDa(windFromDeg),
      plumeToCompass: degToCompassDa(plumeToDeg),
      hourLabel: `${String(activeHourIdx).padStart(2, '0')}:00`,
      pasquillClass: h0.pasquillClass,
      stackDeltaPsPa: Number(stackDeltaPsPa.toFixed(1)),
    };
  }, [h0, h1, frac, activeHourIdx, indoorTempC]);

  const maxSpeed24h = useMemo(
    () => Math.max(12, ...hours.map((h) => h.windGusts10m)),
    [hours]
  );

  const isHighWind = interpolated.speed > 10;

  return (
    <div
      data-testid={`animated-24h-wind-box-${variant}`}
      className={`rounded-md border px-3 py-2 font-mono text-xs shadow-lg transition-colors ${
        isHighWind
          ? 'bg-rose-950/90 border-rose-400/90 ring-1 ring-rose-400/60'
          : 'bg-[#0B0E17]/95 border-cyan-500/50'
      } ${variant === 'map-hud-box' ? 'pointer-events-auto max-w-md' : 'w-full xl:w-[430px] shrink-0'}`}
    >
      {/* Top Header Strip */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-200 truncate">
            24t Vindstyrke &amp; Retning (Animation)
          </span>
          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-cyan-500/40 text-[11px] font-bold text-amber-300 shrink-0">
            kl. {interpolated.hourLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsAnimating24h((v) => !v)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
              isAnimating24h
                ? 'bg-amber-400 text-slate-950 border-amber-200'
                : 'bg-slate-900 text-cyan-200 border-cyan-500/50 hover:bg-slate-800'
            }`}
            title={
              isAnimating24h
                ? 'Pause 24-timers animation af vindstyrke og retning'
                : 'Start 24-timers animation af vindstyrke og retning'
            }
          >
            {isAnimating24h ? (
              <>
                <Pause className="w-2.5 h-2.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-2.5 h-2.5" />
                <span>Animér 24t</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSpeedMultiplier((s) => (s === 1 ? 2 : 1))}
            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 cursor-pointer"
            title="Skift animationshastighed (1x / 2x)"
          >
            {speedMultiplier}x
          </button>

          {onExportWeatherJson && (
            <button
              type="button"
              onClick={onExportWeatherJson}
              className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                jsonExportedJustNow
                  ? 'bg-emerald-400 text-slate-950 border-white'
                  : 'bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border-emerald-400/60'
              }`}
              title={`Eksportér alle 24 timers vejrdata for ${dateIso} som JSON-fil til eksterne analyseværktøjer`}
            >
              {jsonExportedJustNow ? (
                <>
                  <Check className="w-2.5 h-2.5" />
                  <span>JSON Gemt!</span>
                </>
              ) : (
                <>
                  <Download className="w-2.5 h-2.5 text-emerald-300" />
                  <span>JSON</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Animated Compass Dial + 24-Hour Wind Vector & Speed Spark-Timeline */}
      <div className="flex items-center gap-3">
        {/* Animated 24h Compass with Directional History Trail */}
        <div className="relative w-14 h-14 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner">
          <svg viewBox="0 0 64 64" className="w-full h-full">
            {/* Outer Ring & Cardinal Ticks */}
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#1e293b"
              strokeWidth="1.5"
            />
            {/* 24-Hour Plume Direction Ghost Vectors */}
            {hours.map((h) => {
              const pDeg = (h.windDirection10m + 180) % 360;
              const rad = ((pDeg - 90) * Math.PI) / 180;
              const len = 8 + (h.windSpeed10m / maxSpeed24h) * 17;
              const x2 = 32 + Math.cos(rad) * len;
              const y2 = 32 + Math.sin(rad) * len;
              const isCurr = h.hourIndex === activeHourIdx;
              return (
                <line
                  key={`ghost-vec-${h.hourIndex}`}
                  x1="32"
                  y1="32"
                  x2={x2}
                  y2={y2}
                  stroke={isCurr ? '#fbbf24' : h.windSpeed10m > 10 ? '#f43f5e' : '#38bdf8'}
                  strokeOpacity={isCurr ? 0.95 : 0.25}
                  strokeWidth={isCurr ? 2.2 : 1}
                  strokeLinecap="round"
                />
              );
            })}
            {/* Active Interpolated Plume Vector Arrow */}
            {(() => {
              const rad = ((interpolated.plumeToDeg - 90) * Math.PI) / 180;
              const len = 12 + (interpolated.speed / maxSpeed24h) * 15;
              const x2 = 32 + Math.cos(rad) * len;
              const y2 = 32 + Math.sin(rad) * len;
              return (
                <g>
                  <line
                    x1="32"
                    y1="32"
                    x2={x2}
                    y2={y2}
                    stroke={isHighWind ? '#f43f5e' : '#22d3ee'}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <circle
                    cx={x2}
                    cy={y2}
                    r="2.8"
                    fill={isHighWind ? '#f43f5e' : '#fbbf24'}
                    stroke="#0f172a"
                    strokeWidth="0.8"
                  />
                </g>
              );
            })()}
            <circle cx="32" cy="32" r="2.2" fill="#e2e8f0" />
            <text x="32" y="8" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontWeight="bold">
              N
            </text>
            <text x="32" y="61" textAnchor="middle" fill="#64748b" fontSize="9.5">
              S
            </text>
            <text x="58" y="34" textAnchor="middle" fill="#64748b" fontSize="9.5">
              Ø
            </text>
            <text x="6" y="34" textAnchor="middle" fill="#64748b" fontSize="9.5">
              V
            </text>
          </svg>
        </div>

        {/* Right Side: Live Interpolated Telemetry + 24-Hour Animated Bar Strip */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className={`font-extrabold ${isHighWind ? 'text-rose-300' : 'text-white'}`}>
                {interpolated.speed.toFixed(1)} m/s
              </span>
              <span className="text-amber-300 text-[11px]">
                (stød {interpolated.gust.toFixed(1)})
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-cyan-300 font-semibold">
                {interpolated.windFromDeg}° ({interpolated.windFromCompass}) → {interpolated.plumeToDeg}° ({interpolated.plumeToCompass})
              </span>
            </div>

            {onOpenStackEffectVisualization && (
              <button
                type="button"
                onClick={onOpenStackEffectVisualization}
                className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 text-amber-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Åbn visualisering af Skorstenseffekten (Termisk Opdrift ΔP_s & Neutraltryksplan z_NPL)"
              >
                <Flame className="w-2.5 h-2.5 text-amber-400" />
                <span>Skorstenseffekt: +{interpolated.stackDeltaPsPa} Pa</span>
              </button>
            )}
          </div>

          {/* 24-Hour Interactive Wind Speed & Direction Bar Chart */}
          <div
            className="grid grid-cols-24 gap-0.5 items-end h-8 pt-1 px-1 rounded bg-slate-950/90 border border-slate-800/90"
            title="Klik på en time (00–23) for at synkronisere Time-Slideren"
          >
            {hours.map((h) => {
              const isCurr = h.hourIndex === activeHourIdx;
              const heightPct = Math.max(15, Math.min(100, (h.windSpeed10m / maxSpeed24h) * 100));
              const plumeDeg = (h.windDirection10m + 180) % 360;
              return (
                <button
                  key={`anim-bar-${h.hourIndex}`}
                  type="button"
                  onClick={() => {
                    setAnimProgress(h.hourIndex);
                    onSelectHour?.(h.hourIndex);
                  }}
                  title={`Kl. ${h.hourLabel}: ${h.windSpeed10m} m/s (stød ${h.windGusts10m} m/s) · Fra ${h.windDirection10m}° → Fane ${plumeDeg}°`}
                  className="h-full flex flex-col items-center justify-end group cursor-pointer focus:outline-none"
                >
                  <span
                    className={`text-[11px] leading-none mb-0.5 transition-transform ${
                      isCurr ? 'text-amber-300 font-bold scale-125' : 'text-slate-400'
                    }`}
                    style={{ transform: `rotate(${plumeDeg}deg)` }}
                  >
                    ↑
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t transition-all ${
                      isCurr
                        ? 'bg-amber-400 ring-1 ring-amber-200'
                        : h.windSpeed10m > 10
                        ? 'bg-rose-500/85 group-hover:bg-rose-400'
                        : 'bg-cyan-500/60 group-hover:bg-cyan-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>00:00</span>
            <span className="text-cyan-300/90 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              <span>Dato: {dateIso} · PG-{interpolated.pasquillClass} · {interpolated.temp}°C</span>
            </span>
            <span>23:00</span>
          </div>
        </div>
      </div>
    </div>
  );
};
