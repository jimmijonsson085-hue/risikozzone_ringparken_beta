import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  GripHorizontal,
  Magnet,
  MapPin,
  MoveHorizontal,
  SlidersHorizontal,
  Wind,
} from 'lucide-react';
import {
  AlgedonicObservation,
  ForensicEvidenceCategoryTag,
  HourlyWeatherPoint,
  PuffAccumulationResult,
} from '../types/dispersion';
import { interpolateWeatherAtFractionalHour } from '../services/dispersionEngine';

export type EvidenceCategoryFilter = 'ALL' | 'PHYSICAL' | 'PHOTO' | 'PDF';
export type MarkerDragMode = 'SCRUB_PLUME' | 'MOVE_EVIDENCE';

export interface ForensicEvidenceTimelineWidgetProps {
  observations: AlgedonicObservation[];
  weatherHours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  puff24h: PuffAccumulationResult;
  selectedDateIso: string;
  selectedHourIndex: number;
  plumeRouteProgress?: number;
  maxSiteSumQuotient?: number;
  selectedObservationId: string | null;
  onSelectHour: (hourIndex: number) => void;
  onScrubProgress?: (fractionalHour: number) => void;
  onSelectObservation: (obs: AlgedonicObservation) => void;
  onMoveObservationHour?: (obsId: string, newHourIndex: number) => void;
  comparisonHourAIndex?: number;
  showHeatmapComparison?: boolean;
  onChangeComparisonHourA?: (hourIndex: number) => void;
  onToggleHeatmapComparison?: () => void;
  variant?: 'slider_bar' | 'full_widget';
}

export function classifyObservationKind(
  obs: AlgedonicObservation
): 'PHOTO' | 'PDF' | 'PHYSICAL' {
  if (obs.photoEvidence) return 'PHOTO';
  if (obs.pdfEvidence) return 'PDF';
  return 'PHYSICAL';
}

export function resolveObservationEvidenceCategory(
  obs: AlgedonicObservation
): ForensicEvidenceCategoryTag {
  if (obs.evidenceCategory) return obs.evidenceCategory;
  if (obs.photoEvidence?.evidenceCategory) return obs.photoEvidence.evidenceCategory;
  if (obs.pdfEvidence?.evidenceCategory) return obs.pdfEvidence.evidenceCategory;
  if (obs.pdfEvidence) return 'Myndighedskorrespondance';
  if (obs.reporterRole.includes('AMR')) return 'AMR-Observation';
  if (obs.reporterRole.includes('Tilsyn') || obs.reporterRole.includes('Byggerådgiver')) {
    return 'Tilsynsrapport';
  }
  return 'Beboerklage';
}

export function formatFractionalHourLabel(fractionalHour: number): string {
  const clamped = Math.max(0, Math.min(23.99, fractionalHour));
  const totalMinutes = Math.round(clamped * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const ForensicEvidenceTimelineWidget: React.FC<
  ForensicEvidenceTimelineWidgetProps
> = ({
  observations,
  weatherHours,
  currentWeather,
  puff24h,
  selectedDateIso,
  selectedHourIndex,
  plumeRouteProgress,
  maxSiteSumQuotient,
  selectedObservationId,
  onSelectHour,
  onScrubProgress,
  onSelectObservation,
  onMoveObservationHour,
  comparisonHourAIndex = 8,
  showHeatmapComparison = false,
  onChangeComparisonHourA,
  onToggleHeatmapComparison,
  variant = 'slider_bar',
}) => {
  const [filterKind, setFilterKind] = useState<EvidenceCategoryFilter>('ALL');
  const [showExpandedDetailsInBar, setShowExpandedDetailsInBar] =
    useState<boolean>(true);
  const [magneticSnap, setMagneticSnap] = useState<boolean>(false);
  const [markerDragMode, setMarkerDragMode] =
    useState<MarkerDragMode>('SCRUB_PLUME');
  const [activeDragTarget, setActiveDragTarget] = useState<
    null | { type: 'PLAYHEAD' | 'COMPARE_A' | 'EVIDENCE'; obsId?: string }
  >(null);
  const [isNavigatingTransition, setIsNavigatingTransition] = useState<boolean>(false);

  useEffect(() => {
    setIsNavigatingTransition(true);
    const timer = window.setTimeout(() => {
      setIsNavigatingTransition(false);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [selectedDateIso, selectedHourIndex, selectedObservationId]);

  const trackRef = useRef<HTMLDivElement | null>(null);

  const effectiveProgress =
    typeof plumeRouteProgress === 'number' &&
    Number.isFinite(plumeRouteProgress) &&
    Math.abs(plumeRouteProgress - selectedHourIndex) <= 1.05
      ? Math.max(0, Math.min(23, plumeRouteProgress))
      : Math.max(0, Math.min(23, selectedHourIndex));

  const peakHourIndex = puff24h.peakReceptor.peakHourIndex;
  const peakHourLabel = puff24h.peakReceptor.peakHourLabel;
  const peakSumQuotient = puff24h.peakReceptor.peakSumQuotient;

  const countsByKind = useMemo(() => {
    let physical = 0;
    let photo = 0;
    let pdf = 0;
    for (const obs of observations) {
      const kind = classifyObservationKind(obs);
      if (kind === 'PHOTO') photo++;
      else if (kind === 'PDF') pdf++;
      else physical++;
    }
    return {
      total: observations.length,
      physical,
      photo,
      pdf,
    };
  }, [observations]);

  const filteredObservations = useMemo(() => {
    if (filterKind === 'ALL') return observations;
    return observations.filter((o) => classifyObservationKind(o) === filterKind);
  }, [observations, filterKind]);

  // Group observations by hour index (0..23)
  const observationsByHour = useMemo(() => {
    const map: Record<number, AlgedonicObservation[]> = {};
    for (let h = 0; h < 24; h++) {
      map[h] = [];
    }
    for (const obs of filteredObservations) {
      const hr = Math.max(0, Math.min(23, Number(obs.observedHourIndex ?? 0)));
      map[hr].push(obs);
    }
    return map;
  }, [filteredObservations]);

  // Hourly meteorological & toxicological profile (0..23)
  const hourlyMetrics = useMemo(() => {
    const profileMap = new Map(
      puff24h.peakReceptor.hourlyProfile.map((hp) => [hp.hourIndex, hp])
    );
    const maxS = Math.max(
      1.2,
      ...puff24h.peakReceptor.hourlyProfile.map((hp) => hp.sumQuotient)
    );

    return weatherHours.map((wh) => {
      const hp = profileMap.get(wh.hourIndex);
      const sumQ = hp ? hp.sumQuotient : 0;
      const obsList = observationsByHour[wh.hourIndex] || [];
      const hasPhysical = obsList.some(
        (o) => classifyObservationKind(o) === 'PHYSICAL'
      );
      const hasPhoto = obsList.some(
        (o) => classifyObservationKind(o) === 'PHOTO'
      );
      const hasPdf = obsList.some((o) => classifyObservationKind(o) === 'PDF');
      const isMeteoPeak = wh.hourIndex === peakHourIndex;
      const isCriticalLoad = sumQ >= 1.0 || wh.windSpeed10m > 10;

      return {
        hourIndex: wh.hourIndex,
        hourLabel: wh.hourLabel,
        windSpeedMs: wh.windSpeed10m,
        windGustsMs: wh.windGusts10m,
        windDirectionDeg: wh.windDirection10m,
        precipitationMm: wh.precipitation,
        sumQuotient: sumQ,
        loadRatio: Math.min(1, Math.max(0.08, sumQ / maxS)),
        obsList,
        hasPhysical,
        hasPhoto,
        hasPdf,
        isMeteoPeak,
        isCriticalLoad,
      };
    });
  }, [weatherHours, puff24h, observationsByHour, peakHourIndex]);

  // Interpolated weather & S-quotient at the current fractional scrubbing position
  const scrubbedTelemetry = useMemo(() => {
    const interpW =
      weatherHours.length > 0
        ? interpolateWeatherAtFractionalHour(weatherHours, effectiveProgress)
        : currentWeather;

    const idx0 = Math.floor(effectiveProgress);
    const idx1 = Math.min(23, idx0 + 1);
    const frac = effectiveProgress - idx0;
    const s0 = hourlyMetrics[idx0]?.sumQuotient ?? 0;
    const s1 = hourlyMetrics[idx1]?.sumQuotient ?? s0;
    const interpS =
      typeof maxSiteSumQuotient === 'number'
        ? maxSiteSumQuotient
        : s0 + (s1 - s0) * frac;

    const plumeDirDeg = (interpW.windDirection10m + 180) % 360;

    return {
      timeLabel: formatFractionalHourLabel(effectiveProgress),
      windSpeedMs: interpW.windSpeed10m,
      windGustsMs: interpW.windGusts10m,
      windDirDeg: interpW.windDirection10m,
      plumeDirDeg,
      sumQuotient: interpS,
    };
  }, [
    weatherHours,
    effectiveProgress,
    currentWeather,
    hourlyMetrics,
    maxSiteSumQuotient,
  ]);

  const activeHourBucket =
    hourlyMetrics[selectedHourIndex] || hourlyMetrics[0] || null;

  const selectedObs = useMemo(
    () =>
      observations.find((o) => o.id === selectedObservationId) ||
      (activeHourBucket && activeHourBucket.obsList[0]) ||
      observations[0] ||
      null,
    [observations, selectedObservationId, activeHourBucket]
  );

  // Coincidence metric: how many observations fall within ±2 hours of meteorological peak or during S >= 0.85
  const peakCoincidenceStats = useMemo(() => {
    if (observations.length === 0) {
      return { coincidedCount: 0, pct: 0 };
    }
    const coincided = observations.filter((obs) => {
      const dt = Math.abs(obs.observedHourIndex - peakHourIndex);
      const bucket = hourlyMetrics[obs.observedHourIndex];
      const highS = (bucket?.sumQuotient ?? 0) >= 0.85;
      return dt <= 2 || highS || obs.plumeCorroboration.isInsideMathematicalPlume;
    });
    return {
      coincidedCount: coincided.length,
      pct: Math.round((coincided.length / observations.length) * 100),
    };
  }, [observations, peakHourIndex, hourlyMetrics]);

  // 24-Hour Weather-Trend Line for Peak Wind Gusts (m/s)
  const [showPeakGustTrendLine, setShowPeakGustTrendLine] = useState<boolean>(true);

  const weatherTrendGustStats = useMemo(() => {
    if (hourlyMetrics.length === 0) {
      return {
        maxGustMs: 12.0,
        minGustMs: 2.0,
        peakGustHourIndex: 12,
        peakGustHourLabel: '12:00',
        avgGustMs: 6.5,
        hoursAbove10Ms: 0,
        gustPolylinePoints: '',
        gustAreaPolygonPoints: '',
        runningPeakGustPolylinePoints: '',
        meanWindPolylinePoints: '',
        threshold10MsY: 35,
        nodes: [] as Array<{
          hourIndex: number;
          hourLabel: string;
          x: number;
          gustY: number;
          runningMaxGustY: number;
          windY: number;
          gustMs: number;
          runningMaxGustMs: number;
          windMs: number;
        }>,
      };
    }

    let maxGustMs = 0;
    let minGustMs = Infinity;
    let peakGustHourIndex = 0;
    let peakGustHourLabel = '00:00';
    let sumGust = 0;
    let hoursAbove10Ms = 0;

    hourlyMetrics.forEach((hm) => {
      const g = Number(hm.windGustsMs ?? hm.windSpeedMs * 1.45);
      sumGust += g;
      if (g > 10) hoursAbove10Ms += 1;
      if (g > maxGustMs) {
        maxGustMs = g;
        peakGustHourIndex = hm.hourIndex;
        peakGustHourLabel = hm.hourLabel;
      }
      if (g < minGustMs) {
        minGustMs = g;
      }
    });

    const scaleMax = Math.max(15, Math.ceil(maxGustMs * 1.12));
    const svgW = 2400;
    const svgH = 100;
    const topPad = 14;
    const botPad = 16;
    const usableH = svgH - topPad - botPad;

    const valToY = (ms: number) => {
      const clamped = Math.max(0, Math.min(scaleMax, ms));
      return topPad + (1 - clamped / scaleMax) * usableH;
    };

    let runningMax = 0;
    const nodes = hourlyMetrics.map((hm) => {
      const x = ((hm.hourIndex + 0.5) / 24) * svgW;
      const gustMs = Number(hm.windGustsMs ?? hm.windSpeedMs * 1.45);
      const windMs = Number(hm.windSpeedMs ?? 0);
      if (gustMs > runningMax) {
        runningMax = gustMs;
      }
      return {
        hourIndex: hm.hourIndex,
        hourLabel: hm.hourLabel,
        x,
        gustY: valToY(gustMs),
        runningMaxGustY: valToY(runningMax),
        windY: valToY(windMs),
        gustMs,
        runningMaxGustMs: runningMax,
        windMs,
      };
    });

    const gustPolylinePoints = nodes
      .map((n) => `${n.x.toFixed(1)},${n.gustY.toFixed(1)}`)
      .join(' ');
    const baselineY = (svgH - botPad).toFixed(1);
    const gustAreaPolygonPoints =
      nodes.length > 0
        ? `${nodes[0].x.toFixed(1)},${baselineY} ${gustPolylinePoints} ${nodes[nodes.length - 1].x.toFixed(1)},${baselineY}`
        : '';
    const runningPeakGustPolylinePoints = nodes
      .map((n) => `${n.x.toFixed(1)},${n.runningMaxGustY.toFixed(1)}`)
      .join(' ');
    const meanWindPolylinePoints = nodes
      .map((n) => `${n.x.toFixed(1)},${n.windY.toFixed(1)}`)
      .join(' ');

    return {
      maxGustMs,
      minGustMs: Number.isFinite(minGustMs) ? minGustMs : 0,
      peakGustHourIndex,
      peakGustHourLabel,
      avgGustMs: Number((sumGust / hourlyMetrics.length).toFixed(1)),
      hoursAbove10Ms,
      gustPolylinePoints,
      gustAreaPolygonPoints,
      runningPeakGustPolylinePoints,
      meanWindPolylinePoints,
      threshold10MsY: valToY(10),
      nodes,
    };
  }, [hourlyMetrics]);

  // Convert pointer clientX to fractional hour (0.00..23.00)
  const clientXToFractionalHour = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return selectedHourIndex;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return selectedHourIndex;

    // Each of the 24 columns is centered at (h + 0.5) / 24 of the width
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawHour = Math.max(0, Math.min(23, relX * 24 - 0.5));

    if (magneticSnap) {
      // Snap to nearest evidence hour or peak hour if within ±0.32h, otherwise snap to 0.25h (15 min)
      const snapTargets = new Set<number>([
        peakHourIndex,
        ...filteredObservations.map((o) => o.observedHourIndex),
      ]);
      for (const targetHr of snapTargets) {
        if (Math.abs(rawHour - targetHr) <= 0.32) {
          return targetHr;
        }
      }
      return Math.round(rawHour * 4) / 4;
    }

    // Continuous 5-minute resolution (1/12 hour) for smooth plume morphing
    return Number((Math.round(rawHour * 12) / 12).toFixed(2));
  };

  const applyScrubPosition = (
    fractionalHr: number,
    targetOverride?: { type: 'PLAYHEAD' | 'COMPARE_A' | 'EVIDENCE'; obsId?: string }
  ) => {
    const target = targetOverride || activeDragTarget || { type: 'PLAYHEAD' };
    const clampedFrac = Math.max(0, Math.min(23, fractionalHr));
    const roundedHr = Math.max(0, Math.min(23, Math.round(clampedFrac)));

    if (target.type === 'COMPARE_A') {
      if (onChangeComparisonHourA) {
        onChangeComparisonHourA(roundedHr);
      }
      return;
    }

    if (
      target.type === 'EVIDENCE' &&
      markerDragMode === 'MOVE_EVIDENCE' &&
      target.obsId &&
      onMoveObservationHour
    ) {
      onMoveObservationHour(target.obsId, roundedHr);
    }

    if (onScrubProgress) {
      onScrubProgress(clampedFrac);
    } else {
      onSelectHour(roundedHr);
    }

    // If an observation exists at this exact rounded hour while scrubbing, highlight it
    const obsAtHour = observationsByHour[roundedHr];
    if (obsAtHour && obsAtHour.length > 0 && Math.abs(clampedFrac - roundedHr) < 0.2) {
      onSelectObservation(obsAtHour[0]);
    }
  };

  const handleTrackPointerDown = (
    e: React.PointerEvent<HTMLElement>,
    dragTarget: { type: 'PLAYHEAD' | 'COMPARE_A' | 'EVIDENCE'; obsId?: string } = {
      type: 'PLAYHEAD',
    }
  ) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture error
    }
    setActiveDragTarget(dragTarget);
    const fracHr = clientXToFractionalHour(e.clientX);
    applyScrubPosition(fracHr, dragTarget);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!activeDragTarget) return;
    e.stopPropagation();
    const fracHr = clientXToFractionalHour(e.clientX);
    applyScrubPosition(fracHr, activeDragTarget);
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!activeDragTarget) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore pointer release error
    }
    setActiveDragTarget(null);
  };

  const stepScrubByHours = (deltaHours: number) => {
    const nextFrac = Number(
      Math.max(0, Math.min(23, effectiveProgress + deltaHours)).toFixed(2)
    );
    if (onScrubProgress) {
      onScrubProgress(nextFrac);
    } else {
      onSelectHour(Math.round(nextFrac));
    }
  };

  // Percentage left position for a fractional hour (0..23) aligned with center of each of the 24 slots
  const hourToLeftPct = (fracHour: number): number => {
    const clamped = Math.max(0, Math.min(23, fracHour));
    return ((clamped + 0.5) / 24) * 100;
  };

  const playheadLeftPct = hourToLeftPct(effectiveProgress);
  const compareALeftPct = hourToLeftPct(comparisonHourAIndex);

  if (variant === 'slider_bar') {
    return (
      <div
        className={`bg-slate-950/95 border border-slate-800 rounded-md px-3 py-2 space-y-2 select-none transition-all duration-300 ease-out ${
          isNavigatingTransition ? 'ring-1 ring-cyan-400/50 bg-slate-900/95' : ''
        }`}
      >
        {/* Top Header Row: Title, Live Scrubbing Plume Readout & Interactive Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Weather-Trend (24t) &amp; Interaktiv Plume-Scrubber</span>
            </span>

            {/* Live Dynamic Plume Scrubbing Readout Badge */}
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1.5 border transition-colors ${
                activeDragTarget
                  ? 'bg-cyan-500/25 border-cyan-300 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}
            >
              <span className="text-cyan-300 font-bold">
                ◆ kl. {scrubbedTelemetry.timeLabel}
              </span>
              <span className="text-slate-500">|</span>
              <span>
                Vind {scrubbedTelemetry.windSpeedMs} m/s ·{' '}
                <strong className="text-amber-300">
                  Stød {scrubbedTelemetry.windGustsMs} m/s
                </strong>{' '}
                ({scrubbedTelemetry.windDirDeg}° → Fane {scrubbedTelemetry.plumeDirDeg}°)
              </span>
              <span className="text-slate-500">|</span>
              <span
                className={
                  scrubbedTelemetry.sumQuotient >= 1.0
                    ? 'text-rose-400 font-bold'
                    : 'text-amber-300 font-bold'
                }
              >
                S = {scrubbedTelemetry.sumQuotient.toFixed(2)}
              </span>
            </div>

            {/* 24h Peak Wind Gust Readout Pill */}
            <button
              type="button"
              onClick={() => {
                if (onScrubProgress) {
                  onScrubProgress(weatherTrendGustStats.peakGustHourIndex);
                } else {
                  onSelectHour(weatherTrendGustStats.peakGustHourIndex);
                }
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 flex items-center gap-1 cursor-pointer transition-colors"
              title="Klik for at hoppe direkte til døgnets højeste vindstød (Peak Wind Gust m/s)"
            >
              <Wind className="w-3 h-3 text-amber-400 shrink-0" />
              <span>
                24t Peak Vindstød:{' '}
                <strong>{weatherTrendGustStats.maxGustMs.toFixed(1)} m/s</strong> (kl.{' '}
                {weatherTrendGustStats.peakGustHourLabel})
              </span>
            </button>
          </div>

          {/* Right Toolbar: Peak Wind Gust Trend Line Toggle, Fine Scrub (-15m/+15m), Magnetic Snap, Drag Mode & Category Filters */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setShowPeakGustTrendLine((v) => !v)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                showPeakGustTrendLine
                  ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold shadow-xs'
                  : 'bg-slate-900 text-amber-300 border-amber-500/40 hover:bg-slate-800'
              }`}
              title="Vis/skjul Weather-Trend linje for Peak Vindstød (m/s) hen over det valgte 24-timers vindue"
            >
              <Wind className="w-3 h-3 shrink-0" />
              <span>
                {showPeakGustTrendLine
                  ? '✓ Peak Vindstød Trend (m/s)'
                  : 'Vis Peak Vindstød Trend (m/s)'}
              </span>
            </button>

            {/* Sub-hour fine scrubbing buttons */}
            <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded p-0.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => stepScrubByHours(-0.25)}
                className="px-1.5 py-0.5 rounded text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                title="Spol 15 minutter tilbage i dispersion-simuleringen"
              >
                -15m
              </button>
              <button
                type="button"
                onClick={() => stepScrubByHours(0.25)}
                className="px-1.5 py-0.5 rounded text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                title="Spol 15 minutter frem i dispersion-simuleringen"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => setMagneticSnap((v) => !v)}
                className={`px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors ${
                  magneticSnap
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Slå magnetisk snap til bevis-markører og meteorologisk spidsbelastning til/fra under spoling"
              >
                <Magnet className="w-3 h-3" />
                <span>Snap</span>
              </button>
              {onMoveObservationHour && (
                <button
                  type="button"
                  onClick={() =>
                    setMarkerDragMode((m) =>
                      m === 'SCRUB_PLUME' ? 'MOVE_EVIDENCE' : 'SCRUB_PLUME'
                    )
                  }
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors ${
                    markerDragMode === 'MOVE_EVIDENCE'
                      ? 'bg-fuchsia-500 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={
                    markerDragMode === 'MOVE_EVIDENCE'
                      ? 'Aktiv tilstand: Træk i en bevis-markør (⚡/📸/📄) for at flytte dens tidspunkt og se plume-korrelationen'
                      : 'Skift mellem at spole med markører eller flytte et bevis-tidspunkt på tidslinjen'
                  }
                >
                  <MoveHorizontal className="w-3 h-3" />
                  <span>
                    {markerDragMode === 'MOVE_EVIDENCE'
                      ? 'Flyt Bevis'
                      : 'Spol Plume'}
                  </span>
                </button>
              )}
            </div>

            {/* Interactive Filter Controls for Evidence Types */}
            <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded p-0.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setFilterKind('ALL')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  filterKind === 'ALL'
                    ? 'bg-slate-200 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Alle ({countsByKind.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('PHYSICAL')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  filterKind === 'PHYSICAL'
                    ? 'bg-fuchsia-500 text-slate-950 font-bold'
                    : 'text-fuchsia-300 hover:text-white'
                }`}
                title="Vis fysiske observationer / algedoniske signaler"
              >
                <span>⚡ ({countsByKind.physical})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('PHOTO')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  filterKind === 'PHOTO'
                    ? 'bg-cyan-400 text-slate-950 font-bold'
                    : 'text-cyan-300 hover:text-white'
                }`}
                title="Vis AI-analyserede foto-beviser"
              >
                <span>📸 ({countsByKind.photo})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('PDF')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  filterKind === 'PDF'
                    ? 'bg-indigo-500 text-white font-bold'
                    : 'text-indigo-300 hover:text-white'
                }`}
                title="Vis PDF-beviser (aktindsigt, mailkorrespondance & myndighedssvar)"
              >
                <span>📄 ({countsByKind.pdf})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExpandedDetailsInBar((prev) => !prev)}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] font-mono text-slate-300 cursor-pointer"
            >
              {showExpandedDetailsInBar ? 'Skjul detalje' : 'Vis detalje'}
            </button>
          </div>
        </div>

        {/* INTERACTIVE DRAGGABLE 24-HOUR SCRUBBING TRACK WITH PLAYHEAD, EVIDENCE MARKERS & PEAK WIND GUST WEATHER-TREND LINE */}
        <div
          ref={trackRef}
          onPointerDown={(e) => handleTrackPointerDown(e, { type: 'PLAYHEAD' })}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
          className="relative pt-5 pb-1 cursor-ew-resize touch-none"
          title="Træk i markøren eller langs sporet for at spole i dispersion-simuleringen og se plume-udbredelsen samt 24t Peak Vindstød (m/s) trenden"
        >
          {/* Top Scrubbing Handle Rail */}
          <div className="pointer-events-none absolute inset-x-0 top-1.5 h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500/40 via-indigo-500/50 to-rose-500/60"
              style={{ width: `${playheadLeftPct}%` }}
            />
          </div>

          {/* Secondary Draggable Marker: T_A Reference Comparison Marker (if comparison mode active) */}
          {showHeatmapComparison && (
            <div
              onPointerDown={(e) => handleTrackPointerDown(e, { type: 'COMPARE_A' })}
              style={{ left: `${compareALeftPct}%` }}
              className="absolute top-0 bottom-0 -translate-x-1/2 z-20 flex flex-col items-center cursor-grab active:cursor-grabbing group"
              title={`Træk i T_A reference-markøren (kl. ${String(comparisonHourAIndex).padStart(
                2,
                '0'
              )}:00) for at opdatere sammenlignings-heatmappet på kortet`}
            >
              <div className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[9px] font-bold shadow-md border border-white whitespace-nowrap flex items-center gap-0.5">
                <GripHorizontal className="w-2.5 h-2.5" />
                <span>T_A {String(comparisonHourAIndex).padStart(2, '0')}:00</span>
              </div>
              <div className="w-0.5 flex-1 bg-amber-400/90 border-r border-dashed border-amber-200" />
            </div>
          )}

          {/* Primary Draggable Playhead Marker (T_Nu / Plume Scrubber) */}
          <div
            onPointerDown={(e) => handleTrackPointerDown(e, { type: 'PLAYHEAD' })}
            style={{ left: `${playheadLeftPct}%` }}
            className="absolute top-0 bottom-0 -translate-x-1/2 z-30 flex flex-col items-center cursor-grab active:cursor-grabbing"
            title={`Træk her for at spole i dispersion-simuleringen (aktuelt kl. ${
              scrubbedTelemetry.timeLabel
            } · S=${scrubbedTelemetry.sumQuotient.toFixed(2)} · Vindstød ${
              scrubbedTelemetry.windGustsMs
            } m/s)`}
          >
            <div
              className={`px-2 py-0.5 rounded-full font-mono text-[9.5px] font-bold shadow-lg border whitespace-nowrap flex items-center gap-1 transition-transform ${
                activeDragTarget?.type === 'PLAYHEAD'
                  ? 'bg-cyan-300 text-slate-950 border-white scale-105'
                  : 'bg-cyan-400 text-slate-950 border-cyan-100 hover:scale-105'
              }`}
            >
              <GripHorizontal className="w-3 h-3 stroke-[2.5]" />
              <span>
                {showHeatmapComparison ? 'T_B ' : ''}
                {scrubbedTelemetry.timeLabel}
              </span>
            </div>
            <div className="w-0.5 flex-1 bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-300 border-2 border-slate-950 -mt-1" />
          </div>

          {/* 24-Hour Synchronized Track Aligned with 00:00–23:00 Time-Slider + SVG Peak Wind Gust Trend Line */}
          <div className="relative">
            {showPeakGustTrendLine && weatherTrendGustStats.nodes.length > 0 && (
              <svg
                viewBox="0 0 2400 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 w-full h-14 z-20 overflow-visible"
              >
                <defs>
                  <linearGradient id="footerPeakGustGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(251, 191, 36, 0.34)" />
                    <stop offset="100%" stopColor="rgba(251, 191, 36, 0.02)" />
                  </linearGradient>
                </defs>

                {/* Shaded Area under Peak Wind Gust (m/s) Trend Line */}
                {weatherTrendGustStats.gustAreaPolygonPoints && (
                  <polygon
                    points={weatherTrendGustStats.gustAreaPolygonPoints}
                    fill="url(#footerPeakGustGrad)"
                  />
                )}

                {/* 10 m/s High-Wind / Eddy Threshold Reference Line */}
                <line
                  x1="0"
                  y1={weatherTrendGustStats.threshold10MsY}
                  x2="2400"
                  y2={weatherTrendGustStats.threshold10MsY}
                  stroke="rgba(244, 63, 94, 0.55)"
                  strokeWidth="2"
                  strokeDasharray="14 10"
                />

                {/* Sustained Mean Wind Speed (10m) Reference Polyline */}
                <polyline
                  fill="none"
                  stroke="rgba(56, 189, 248, 0.65)"
                  strokeWidth="3.5"
                  strokeDasharray="10 6"
                  points={weatherTrendGustStats.meanWindPolylinePoints}
                />

                {/* 24-Hour Running Peak Wind Gust Envelope Line (m/s) */}
                <polyline
                  fill="none"
                  stroke="rgba(232, 121, 249, 0.85)"
                  strokeWidth="3"
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={weatherTrendGustStats.runningPeakGustPolylinePoints}
                />

                {/* Peak Wind Gust (m/s) Weather-Trend Line */}
                <polyline
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.98)"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={weatherTrendGustStats.gustPolylinePoints}
                />

                {/* Hourly Peak Wind Gust Data Points */}
                {weatherTrendGustStats.nodes.map((node) => {
                  const isPeakGustHour =
                    node.hourIndex === weatherTrendGustStats.peakGustHourIndex;
                  const isHighGust = node.gustMs > 10;
                  return (
                    <circle
                      key={`gust-pt-${node.hourIndex}`}
                      cx={node.x}
                      cy={node.gustY}
                      r={isPeakGustHour ? 11 : isHighGust ? 8 : 6}
                      fill={
                        isPeakGustHour
                          ? '#f43f5e'
                          : isHighGust
                          ? '#fbbf24'
                          : '#fde047'
                      }
                      stroke="#020617"
                      strokeWidth="2.5"
                    />
                  );
                })}
              </svg>
            )}

            <div className="grid grid-cols-24 gap-0.5">
              {hourlyMetrics.map((hm) => {
                const isSelectedHour = hm.hourIndex === selectedHourIndex;
                const hasAnyEvidence = hm.obsList.length > 0;
                const barHeightPct = Math.round(hm.loadRatio * 100);
                const firstObs = hm.obsList[0];

                return (
                  <div
                    key={`ev-tl-slot-${hm.hourIndex}`}
                    onPointerDown={(e) => {
                      if (firstObs) {
                        onSelectObservation(firstObs);
                        handleTrackPointerDown(e, {
                          type:
                            markerDragMode === 'MOVE_EVIDENCE'
                              ? 'EVIDENCE'
                              : 'PLAYHEAD',
                          obsId: firstObs.id,
                        });
                      } else {
                        handleTrackPointerDown(e, { type: 'PLAYHEAD' });
                      }
                    }}
                    title={`Kl. ${hm.hourLabel} — S=${hm.sumQuotient.toFixed(2)} · Vind ${hm.windSpeedMs} m/s · Peak Vindstød ${hm.windGustsMs} m/s${
                      hm.isMeteoPeak ? ' · ★ METEOROLOGISK SPIDSBELASTNING' : ''
                    }${
                      hasAnyEvidence
                        ? ` · Træk i markøren for at spole (${hm.obsList.length} bevis: ${hm.obsList
                            .map((o) => `${o.code}`)
                            .join(', ')})`
                        : ' · Træk for at spole plume til dette tidspunkt'
                    }`}
                    className={`group relative flex flex-col items-center justify-between h-14 rounded px-0.5 py-1 transition-all border ${
                      isSelectedHour
                        ? 'bg-cyan-950/80 border-cyan-400 ring-1 ring-cyan-400/60'
                        : hm.isMeteoPeak
                        ? 'bg-amber-950/50 border-amber-400/80'
                        : hasAnyEvidence
                        ? 'bg-slate-900 border-fuchsia-500/60 hover:border-fuchsia-400 cursor-grab active:cursor-grabbing'
                        : 'bg-slate-900/45 border-slate-800/70 hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Top Row: Draggable Evidence Pin Badges (Physical / Photo / PDF) or Peak Star */}
                    <div className="flex items-center justify-center gap-0.5 min-h-[14px] z-10">
                      {hm.isMeteoPeak && (
                        <span
                          className="text-[10px] leading-none text-amber-300 font-bold cursor-grab active:cursor-grabbing"
                          title="Meteorologisk Spidsbelastning — Træk for at spole fra spidsen"
                        >
                          ★
                        </span>
                      )}
                      {hm.hasPhysical && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 ring-1 ring-slate-950 cursor-grab active:cursor-grabbing group-hover:scale-125 transition-transform"
                          title="Fysisk Observation — Træk for at spole i simuleringen"
                        />
                      )}
                      {hm.hasPhoto && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-1 ring-slate-950 cursor-grab active:cursor-grabbing group-hover:scale-125 transition-transform"
                          title="Foto-Bevis — Træk for at spole i simuleringen"
                        />
                      )}
                      {hm.hasPdf && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-indigo-400 ring-1 ring-slate-950 cursor-grab active:cursor-grabbing group-hover:scale-125 transition-transform"
                          title="PDF-Dokumentbevis — Træk for at spole i simuleringen"
                        />
                      )}
                    </div>

                    {/* Middle Background Bar: Meteorological Dispersion Intensity (Sumformel S) */}
                    <div className="w-full flex-1 flex items-end px-0.5 my-0.5">
                      <div
                        className={`w-full rounded-t transition-all ${
                          hm.sumQuotient >= 1.0
                            ? 'bg-rose-500/70'
                            : hm.sumQuotient >= 0.5
                            ? 'bg-amber-400/60'
                            : 'bg-slate-700/65'
                        }`}
                        style={{ height: `${barHeightPct}%` }}
                      />
                    </div>

                    {/* Bottom Row: Hour Label & Gust Readout on Selected/Peak */}
                    <div className="w-full flex flex-col items-center justify-center text-[8px] font-mono leading-none z-10">
                      {showPeakGustTrendLine && (
                        <span
                          className={`text-[7.5px] leading-tight ${
                            hm.windGustsMs > 10
                              ? 'text-rose-300 font-bold'
                              : isSelectedHour
                              ? 'text-amber-200 font-semibold'
                              : 'text-amber-300/80'
                          }`}
                        >
                          {hm.windGustsMs.toFixed(0)}
                        </span>
                      )}
                      <span
                        className={
                          isSelectedHour
                            ? 'text-cyan-200 font-bold'
                            : hm.isMeteoPeak
                            ? 'text-amber-300 font-bold'
                            : hasAnyEvidence
                            ? 'text-white font-semibold'
                            : 'text-slate-500'
                        }
                      >
                        {String(hm.hourIndex).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Weather-Trend Legend Strip */}
          {showPeakGustTrendLine && (
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[9.5px] font-mono text-slate-300 bg-slate-900/80 border border-slate-800/90 rounded px-2.5 py-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <span className="inline-block w-3.5 h-1 rounded bg-amber-400" />
                  <span>Peak Vindstød (m/s) Trendlinje</span>
                </span>
                <span className="flex items-center gap-1.5 text-fuchsia-300">
                  <span className="inline-block w-3.5 h-0.5 border-b-2 border-dashed border-fuchsia-400" />
                  <span>24t Kumulativ Peak-Gust Kurve</span>
                </span>
                <span className="flex items-center gap-1.5 text-sky-300">
                  <span className="inline-block w-3.5 h-0.5 border-b-2 border-dashed border-sky-400" />
                  <span>Middelvind (10m)</span>
                </span>
                <span className="flex items-center gap-1.5 text-rose-300">
                  <span className="inline-block w-3.5 h-0.5 border-b-2 border-dashed border-rose-400" />
                  <span>10 m/s Storm-/Eddy-tærskel ({weatherTrendGustStats.hoursAbove10Ms}t &gt; 10 m/s)</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span>
                  Gns. stød: <strong className="text-amber-200">{weatherTrendGustStats.avgGustMs} m/s</strong>
                </span>
                <span>·</span>
                <span>
                  24t Max: <strong className="text-rose-300">{weatherTrendGustStats.maxGustMs.toFixed(1)} m/s (kl. {weatherTrendGustStats.peakGustHourLabel})</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Quick-Jump & Draggable Evidence Marker Pills */}
        {showExpandedDetailsInBar && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400">
                Bevis-markører ({peakCoincidenceStats.pct}% i spids-fane):
              </span>
              {filteredObservations.map((obs) => {
                const kind = classifyObservationKind(obs);
                const catTag = resolveObservationEvidenceCategory(obs);
                const isSel =
                  obs.id === selectedObservationId ||
                  obs.observedHourIndex === selectedHourIndex;
                const dtFromPeak = obs.observedHourIndex - peakHourIndex;
                const dtLabel =
                  dtFromPeak === 0
                    ? 'SAMMENFALD MED SPIDS'
                    : `${dtFromPeak > 0 ? `+${dtFromPeak}` : dtFromPeak}t fra spids`;

                return (
                  <button
                    key={`bar-chip-${obs.id}`}
                    type="button"
                    onClick={() => {
                      if (onScrubProgress) {
                        onScrubProgress(obs.observedHourIndex);
                      } else {
                        onSelectHour(obs.observedHourIndex);
                      }
                      onSelectObservation(obs);
                    }}
                    title={`${obs.code} [${catTag}] (kl. ${obs.observedHourLabel}): ${obs.observationType} — S=${obs.plumeCorroboration.calculatedSumQuotient.toFixed(2)} (${dtLabel}) · Klik for at spole plume hertil`}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all duration-300 ease-out cursor-pointer flex items-center gap-1 border ${
                      isSel
                        ? 'bg-slate-100 text-slate-950 border-white font-bold scale-[1.03] shadow-sm'
                        : kind === 'PHOTO'
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 hover:border-cyan-400'
                        : kind === 'PDF'
                        ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40 hover:border-indigo-400'
                        : 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-500/40 hover:border-fuchsia-400'
                    }`}
                  >
                    <span>
                      {kind === 'PHOTO' ? '📸' : kind === 'PDF' ? '📄' : '⚡'}
                    </span>
                    <span>
                      kl. {obs.observedHourLabel} ({obs.code})
                    </span>
                    <span
                      className={`px-1 py-0.2 rounded text-[8.5px] ${
                        isSel
                          ? 'bg-slate-900 text-cyan-300'
                          : 'bg-slate-900/80 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {catTag}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  if (onScrubProgress) {
                    onScrubProgress(peakHourIndex);
                  } else {
                    onSelectHour(peakHourIndex);
                  }
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 font-semibold cursor-pointer"
                title="Spol direkte til døgnets meteorologiske spidsbelastning"
              >
                ★ Spids kl. {peakHourLabel} (S={peakSumQuotient.toFixed(2)})
              </button>

              {onToggleHeatmapComparison && (
                <button
                  type="button"
                  onClick={onToggleHeatmapComparison}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                    showHeatmapComparison
                      ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/60'
                  }`}
                  title="Vis en ekstra trækbar T_A reference-markør på tidslinjen for at sammenligne to tidspunkters plume-udbredelse på kortet"
                >
                  {showHeatmapComparison ? '✓ 2 Markører (T_A & T_B)' : '+ T_A Sammenlignings-Markør'}
                </button>
              )}
            </div>

            {activeHourBucket && (
              <div className="text-slate-300 flex items-center gap-2">
                <span>
                  Plume kl. <strong className="text-cyan-300">{scrubbedTelemetry.timeLabel}</strong>: S=
                  <strong
                    className={
                      scrubbedTelemetry.sumQuotient >= 1.0
                        ? 'text-rose-400'
                        : 'text-amber-300'
                    }
                  >
                    {scrubbedTelemetry.sumQuotient.toFixed(2)}
                  </strong>{' '}
                  · Vind {scrubbedTelemetry.windSpeedMs} m/s (stød {scrubbedTelemetry.windGustsMs} m/s)
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // FULL WIDGET VARIANT (for Sidebar & Floating Window)
  return (
    <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-lg space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Interaktiv 24-Timers Plume-Scrubber &amp; Bevis-Tidslinje ({selectedDateIso})</span>
          </div>
          <h3 className="text-sm font-bold text-white">
            Træk i Markørerne for at Spole i Dispersion-Simuleringen &amp; Se Plume-Udbredelsen Live på Kortet
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Træk i den primære <strong>Plume-Markør (kl. {scrubbedTelemetry.timeLabel})</strong>, i{' '}
            <strong>T_A Sammenlignings-Markøren</strong> eller direkte i de enkelte{' '}
            <strong>bevis-markører (⚡, 📸, 📄, ★)</strong> for at spole kontinuerligt frem og tilbage i
            dispersion-simuleringen og observere støvfanens rotation, udstrækning og koncentration opdatere
            sig dynamisk på 2D- og 3D-kortet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
          <span>⚡ Fysiske: {countsByKind.physical}</span>
          <span aria-hidden="true">·</span>
          <span>📸 Foto: {countsByKind.photo}</span>
          <span aria-hidden="true">·</span>
          <span>📄 PDF: {countsByKind.pdf}</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300 font-bold">
            ★ Spids kl. {peakHourLabel} (S={peakSumQuotient.toFixed(2)})
          </span>
        </div>
      </div>

      {/* Embedded Interactive 24h Slider Track with Draggable Markers */}
      <ForensicEvidenceTimelineWidget
        observations={observations}
        weatherHours={weatherHours}
        currentWeather={currentWeather}
        puff24h={puff24h}
        selectedDateIso={selectedDateIso}
        selectedHourIndex={selectedHourIndex}
        plumeRouteProgress={plumeRouteProgress}
        maxSiteSumQuotient={maxSiteSumQuotient}
        selectedObservationId={selectedObservationId}
        onSelectHour={onSelectHour}
        onScrubProgress={onScrubProgress}
        onSelectObservation={onSelectObservation}
        onMoveObservationHour={onMoveObservationHour}
        comparisonHourAIndex={comparisonHourAIndex}
        showHeatmapComparison={showHeatmapComparison}
        onChangeComparisonHourA={onChangeComparisonHourA}
        onToggleHeatmapComparison={onToggleHeatmapComparison}
        variant="slider_bar"
      />

      {/* Chronological Evidence vs. Meteorological Peak Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>KRONOLOGISK BEVIS-OVERSIGT MED AFSTAND TIL METEOROLOGISK SPIDSBELASTNING:</span>
          <span>{filteredObservations.length} registrerede beviser</span>
        </div>

        <div
          className={`space-y-2 max-h-80 overflow-y-auto pr-1 transition-all duration-300 ease-out ${
            isNavigatingTransition ? 'opacity-90 translate-y-[1px]' : 'opacity-100 translate-y-0'
          }`}
        >
          {[...filteredObservations]
            .sort((a, b) => a.observedHourIndex - b.observedHourIndex)
            .map((obs) => {
              const kind = classifyObservationKind(obs);
              const catTag = resolveObservationEvidenceCategory(obs);
              const isSelected = obs.id === selectedObs?.id;
              const hourDelta = obs.observedHourIndex - peakHourIndex;
              const absDelta = Math.abs(hourDelta);

              return (
                <div
                  key={`full-tl-${obs.id}`}
                  onClick={() => {
                    if (onScrubProgress) {
                      onScrubProgress(obs.observedHourIndex);
                    } else {
                      onSelectHour(obs.observedHourIndex);
                    }
                    onSelectObservation(obs);
                  }}
                  className={`p-3 rounded-lg border transition-all duration-300 ease-out cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-slate-950 border-cyan-400 ring-1 ring-cyan-400/50 scale-[1.01] shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">
                        kl. {obs.observedHourLabel}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span
                        className={
                          kind === 'PHOTO'
                            ? 'text-cyan-300 font-semibold'
                            : kind === 'PDF'
                            ? 'text-indigo-300 font-semibold'
                            : 'text-fuchsia-300 font-semibold'
                        }
                      >
                        {kind === 'PHOTO'
                          ? '📸 Foto-Bevis'
                          : kind === 'PDF'
                          ? '📄 PDF-Dokumentbevis'
                          : '⚡ Fysisk Observation'}{' '}
                        ({obs.code})
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                        {catTag}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span
                        className={
                          absDelta <= 1
                            ? 'text-amber-300 font-bold'
                            : 'text-slate-400'
                        }
                      >
                        {hourDelta === 0
                          ? '★ Præcis på spidsbelastning'
                          : `${hourDelta > 0 ? `+${hourDelta}` : hourDelta}t fra spids (kl. ${peakHourLabel})`}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="text-rose-300 font-bold">
                        S = {obs.plumeCorroboration.calculatedSumQuotient.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-100">
                    {obs.observationType}
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {obs.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {obs.locationLabel}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wind className="w-3 h-3 text-cyan-400" />
                      Vind {obs.weatherSnapshot.windSpeed10m} m/s (stød{' '}
                      {obs.weatherSnapshot.windGusts10m} m/s) fra{' '}
                      {obs.weatherSnapshot.windDirection10m}°
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
