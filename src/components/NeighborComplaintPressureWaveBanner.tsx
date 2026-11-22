import React, { useMemo, useState } from 'react';
import { Radio, Volume2, Wind } from 'lucide-react';
import { AlgedonicObservation, HourlyWeatherPoint } from '../types/dispersion';

export interface NeighborComplaintPressureWaveBannerProps {
  currentWeather: HourlyWeatherPoint;
  weatherHours: HourlyWeatherPoint[];
  selectedHourIndex: number;
  onSelectHour: (hourIdx: number) => void;
  observations: AlgedonicObservation[];
  activeSourceLabel: string;
  effectiveMachineDb: number;
  onSelectReceptor?: (receptorId: string) => void;
}

interface NeighborBlockWaveSpec {
  id: string;
  receptorId: string;
  blockName: string;
  shortAddress: string;
  distanceMeters: number;
  bearingFromSiteDeg: number;
  baseComplaintCount: number;
  latestComplaintCode: string;
  basePeakLafmaxDb: number;
}

const NEIGHBOR_COMPLAINT_BLOCKS: NeighborBlockWaveSpec[] = [
  {
    id: 'ringparken_blok_3_4',
    receptorId: 'rec-blok-3-4',
    blockName: 'Ringparken Blok 3–4',
    shortAddress: 'Nabo Nord · 29 m',
    distanceMeters: 29,
    bearingFromSiteDeg: 18,
    baseComplaintCount: 4,
    latestComplaintCode: 'KLAGE-DBA-109',
    basePeakLafmaxDb: 89.4,
  },
  {
    id: 'schackenborg_6b',
    receptorId: 'rec-schackenborg-6b',
    blockName: 'Schackenborgvænget 6B',
    shortAddress: 'Blok B Øst · 34 m',
    distanceMeters: 34,
    bearingFromSiteDeg: 92,
    baseComplaintCount: 5,
    latestComplaintCode: 'KLAGE-DBA-114',
    basePeakLafmaxDb: 88.2,
  },
  {
    id: 'roedtjoernevej_2',
    receptorId: 'rec-roedtjoernevej',
    blockName: 'Rødtjørnevej 2',
    shortAddress: 'Blok Syd · 42 m',
    distanceMeters: 42,
    bearingFromSiteDeg: 186,
    baseComplaintCount: 3,
    latestComplaintCode: 'KLAGE-DBA-118',
    basePeakLafmaxDb: 86.7,
  },
  {
    id: 'kierulffsvej_4',
    receptorId: 'rec-kierulffsvej-inst',
    blockName: 'Kierulffsvej 4',
    shortAddress: 'Institution Vest · 65 m',
    distanceMeters: 65,
    bearingFromSiteDeg: 268,
    baseComplaintCount: 2,
    latestComplaintCode: 'KLAGE-DBA-121',
    basePeakLafmaxDb: 84.1,
  },
];

export const NeighborComplaintPressureWaveBanner: React.FC<
  NeighborComplaintPressureWaveBannerProps
> = ({
  currentWeather,
  weatherHours,
  selectedHourIndex,
  onSelectHour,
  observations,
  activeSourceLabel,
  effectiveMachineDb,
  onSelectReceptor,
}) => {
  const [previewHighWindWhenCalm, setPreviewHighWindWhenCalm] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const liveWindExceeds10ms = currentWeather.windSpeed10m > 10.0;
  const isWaveAnimationActive = liveWindExceeds10ms || previewHighWindWhenCalm;

  const effectiveWindForWave = liveWindExceeds10ms
    ? currentWeather.windSpeed10m
    : previewHighWindWhenCalm
    ? Math.max(11.8, currentWeather.windSpeed10m)
    : currentWeather.windSpeed10m;

  const plumeDownwindDeg = (currentWeather.windDirection10m + 180) % 360;

  // Find peak >10 m/s hour in current 24h dataset so user can jump directly to a real storm hour
  const peakHighWindHour = useMemo(() => {
    let best: HourlyWeatherPoint | null = null;
    for (const h of weatherHours) {
      if (h.windSpeed10m > 10.0 && (!best || h.windSpeed10m > best.windSpeed10m)) {
        best = h;
      }
    }
    return best;
  }, [weatherHours]);

  const blockWaveItems = useMemo(() => {
    const machineDeltaDb = effectiveMachineDb - 114;
    return NEIGHBOR_COMPLAINT_BLOCKS.map((blk) => {
      // Match any user-logged observations mentioning this neighbor block/street
      const streetToken = blk.blockName.split(' ')[0].toLowerCase();
      const matchedObs = observations.filter((obs) =>
        obs.locationLabel.toLowerCase().includes(streetToken)
      );
      const totalComplaints = blk.baseComplaintCount + matchedObs.length;
      const latestCode = matchedObs[0]?.code || blk.latestComplaintCode;

      // Downwind alignment factor cos(theta) in [-1, 1]
      const angleDiffRad =
        (((plumeDownwindDeg - blk.bearingFromSiteDeg + 540) % 360) - 180) * (Math.PI / 180);
      const downwindCos = Math.cos(angleDiffRad);
      const downwindBoostDb = Math.max(-1.8, downwindCos * Math.min(5.2, effectiveWindForWave * 0.38));

      const estimatedPeakDb = Number(
        (blk.basePeakLafmaxDb + machineDeltaDb * 0.65 + downwindBoostDb).toFixed(1)
      );

      // Acoustic travel time tau = d / (343 + v_parallel) in milliseconds
      const vParallel = downwindCos * effectiveWindForWave;
      const travelTimeMs = Math.round((blk.distanceMeters / (343 + vParallel)) * 1000);

      // Faster CSS pressure wave cycle when wind is stronger and block is downwind
      const waveCycleSec = Number(
        Math.max(1.15, Math.min(2.6, 2.35 - (effectiveWindForWave - 10) * 0.11 - downwindCos * 0.28)).toFixed(2)
      );

      const isPrimaryDownwind = downwindCos > 0.25;

      return {
        ...blk,
        totalComplaints,
        latestCode,
        downwindCos,
        downwindBoostDb,
        estimatedPeakDb,
        travelTimeMs,
        waveCycleSec,
        isPrimaryDownwind,
      };
    });
  }, [observations, plumeDownwindDeg, effectiveWindForWave, effectiveMachineDb]);

  return (
    <section
      aria-label="Naboklage-støjimpuls trykbølge-udbredelse pr. naboblok"
      data-neighbor-pressure-wave-active={isWaveAnimationActive ? 'true' : 'false'}
      className="px-3 py-2 bg-[#080B13] border-b border-slate-800/90 w-full max-w-full min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
              liveWindExceeds10ms
                ? 'bg-rose-950/90 border-rose-500/80 text-rose-200'
                : previewHighWindWhenCalm
                ? 'bg-amber-950/80 border-amber-400/80 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span>
              Naboklage-Trykbølger pr. Blok (v &gt; 10 m/s):{' '}
              {liveWindExceeds10ms
                ? `AKTIV LIVE (${currentWeather.windSpeed10m.toFixed(1)} m/s)`
                : previewHighWindWhenCalm
                ? `SIMULERET TEST (${effectiveWindForWave.toFixed(1)} m/s)`
                : `STANDBY (${currentWeather.windSpeed10m.toFixed(1)} m/s ≤ 10 m/s)`}
            </span>
          </span>

          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            Kilde: <strong className="text-slate-200">{activeSourceLabel}</strong> · Medvind mod{' '}
            <strong className="text-cyan-300">{plumeDownwindDeg}°</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!liveWindExceeds10ms && peakHighWindHour && (
            <button
              type="button"
              onClick={() => onSelectHour(peakHighWindHour.hourIndex)}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/60 text-rose-200 text-[11px] font-mono font-bold transition-colors cursor-pointer"
              title={`Hop direkte til døgnets kraftigste vindtime over 10 m/s (kl. ${peakHighWindHour.hourLabel} · ${peakHighWindHour.windSpeed10m.toFixed(1)} m/s)`}
            >
              Hop til v&gt;10 m/s (kl. {peakHighWindHour.hourLabel} ·{' '}
              {peakHighWindHour.windSpeed10m.toFixed(1)} m/s)
            </button>
          )}

          {!liveWindExceeds10ms && (
            <button
              type="button"
              onClick={() => setPreviewHighWindWhenCalm((v) => !v)}
              className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                previewHighWindWhenCalm
                  ? 'bg-amber-400 text-slate-950 border-amber-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-200 border-amber-500/50'
              }`}
              title="Forhåndsvis CSS-trykbølge-animationen pr. naboblok som ved vindhastighed > 10 m/s, selvom valgt time (kl. current) er under 10 m/s"
            >
              {previewHighWindWhenCalm
                ? 'Stop >10 m/s Trykbølge-Preview'
                : 'Simulér >10 m/s Trykbølge'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono cursor-pointer"
          >
            {isCollapsed ? 'Vis Blok-Trykbølger' : 'Skjul'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {blockWaveItems.map((blk) => {
            const waveStyle = {
              '--neighbor-wave-duration': `${blk.waveCycleSec}s`,
            } as React.CSSProperties;

            return (
              <div
                key={blk.id}
                style={waveStyle}
                onClick={() => onSelectReceptor?.(blk.receptorId)}
                role={onSelectReceptor ? 'button' : undefined}
                tabIndex={onSelectReceptor ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onSelectReceptor && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelectReceptor(blk.receptorId);
                  }
                }}
                className={`neighbor-impulse-block-card relative overflow-hidden rounded border p-2 transition-colors ${
                  onSelectReceptor ? 'cursor-pointer' : ''
                } ${
                  isWaveAnimationActive
                    ? blk.isPrimaryDownwind
                      ? 'bg-rose-950/30 border-rose-500/70 hover:border-rose-400'
                      : 'bg-slate-900/90 border-amber-500/55 hover:border-amber-400'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
                title={`${blk.blockName} (${blk.distanceMeters} m) — ${blk.totalComplaints} registrerede naboklager (${blk.latestCode}). Beregnet spids-impuls: ${blk.estimatedPeakDb} dB(A) L_AFmax · Akustisk gangtid: ${blk.travelTimeMs} ms · Kl. ${String(selectedHourIndex).padStart(2, '0')}:00`}
              >
                {/* CSS Pressure-Wave Propagation Track (active when v > 10 m/s or preview active) */}
                {isWaveAnimationActive && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                  >
                    <span
                      className={`neighbor-pressure-wavefront ${
                        blk.estimatedPeakDb >= 80 || blk.isPrimaryDownwind
                          ? 'neighbor-pressure-wavefront--critical'
                          : 'neighbor-pressure-wavefront--elevated'
                      }`}
                    />
                    <span className="neighbor-pressure-ring neighbor-pressure-ring--1" />
                    <span className="neighbor-pressure-ring neighbor-pressure-ring--2" />
                    <span className="neighbor-pressure-ring neighbor-pressure-ring--3" />
                  </div>
                )}

                <div className="relative z-10 flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-100 truncate flex items-center gap-1">
                      <Radio
                        className={`w-3 h-3 shrink-0 ${
                          isWaveAnimationActive
                            ? blk.isPrimaryDownwind
                              ? 'text-rose-400'
                              : 'text-amber-300'
                            : 'text-slate-500'
                        }`}
                      />
                      <span className="truncate">{blk.blockName}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {blk.shortAddress} · {blk.latestCode} ({blk.totalComplaints} klager)
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div
                      className={`text-[11px] font-extrabold ${
                        blk.estimatedPeakDb >= 85
                          ? 'text-rose-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {blk.estimatedPeakDb.toFixed(1)} dB
                    </div>
                    <div className="text-[11px] text-slate-400">
                      τ = {blk.travelTimeMs} ms
                    </div>
                  </div>
                </div>

                {/* Acoustic Source -> Neighbor Block Corridor Bar */}
                <div className="relative z-10 mt-1.5 pt-1 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Wind className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                    <span>
                      Refraktion:{' '}
                      <strong
                        className={
                          blk.downwindBoostDb >= 0 ? 'text-rose-300' : 'text-emerald-300'
                        }
                      >
                        {blk.downwindBoostDb >= 0 ? '+' : ''}
                        {blk.downwindBoostDb.toFixed(1)} dB
                      </strong>
                    </span>
                  </span>

                  <span
                    className={
                      isWaveAnimationActive
                        ? blk.isPrimaryDownwind
                          ? 'text-rose-200 font-bold'
                          : 'text-amber-200 font-semibold'
                        : 'text-slate-500'
                    }
                  >
                    {isWaveAnimationActive
                      ? blk.isPrimaryDownwind
                        ? 'Trykbølge i medvind'
                        : 'Trykbølge aktiv'
                      : 'Ingen >10 m/s bølge'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
