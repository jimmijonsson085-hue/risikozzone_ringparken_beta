import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  X,
  Wind,
  Volume2,
  Sparkles,
  Database,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  FileDown,
} from 'lucide-react';
import {
  AlgedonicObservation,
  HourlyReceptorPuffDose,
  HourlyWeatherPoint,
} from '../types/dispersion';
import { generateWindNoiseTechnicalAnnexPdfReport } from '../services/weatherCorrelationPdfService';

export interface HeaderWeatherCorrelationD3PopupProps {
  isOpen: boolean;
  onClose: () => void;
  dateIso: string;
  weatherHours: HourlyWeatherPoint[];
  observations: AlgedonicObservation[];
  hourlyReceptorProfile: HourlyReceptorPuffDose[];
  selectedHourIndex: number;
  machineNoiseOutputDb: number;
  onSelectHour: (hourIndex: number) => void;
  onExportForensicPdf?: () => void;
}

export type DustAxisScaleMode = 'linear' | 'logarithmic';
export type DustDepositionUnitMode = 'ug_m2' | 'mg_m2';

interface HourlyCorrelationPoint {
  hourIndex: number;
  hourLabel: string;
  windSpeedMs: number;
  windGustsMs: number;
  recordedNoiseEvents: number;
  recordedDustEvents: number;
  totalRecordedEvents: number;
  eventIntensityIndex: number;
  sumQuotient: number;
  depositedDustUgM2: number;
  dustDepositionQuotient: number;
  estNoiseLaeqDb: number;
  eventTitles: string[];
}

interface CachedWeatherCorrelationEntry {
  cacheKey: string;
  dateIso: string;
  machineNoiseOutputDb: number;
  cachedAtMs: number;
  hourlyData: HourlyCorrelationPoint[];
  pearsonR: number;
  pearsonDustQuotientR: number;
}

const CORRELATION_CACHE_STORAGE_KEY = 'ringparken_weather_corr_d3_cache_v1';
const SCALE_MODE_STORAGE_KEY = 'ringparken_weather_corr_scale_mode_v1';
const UNIT_MODE_STORAGE_KEY = 'ringparken_weather_corr_unit_mode_v1';
const MAX_CACHED_DATASETS = 32;

// Statutory action/reference deposition equivalent for S = 1.00 (100 µg/m² = 0.100 mg/m²)
const STATUTORY_DEPOSITION_UG_M2_AT_S1 = 100.0;

// Module-level persistent LRU cache hydrated from localStorage so toggling dates/datasets is O(1)
const MEMORY_CORRELATION_CACHE = new Map<string, CachedWeatherCorrelationEntry>();
let isCacheHydratedFromStorage = false;

function hydrateCorrelationCacheOnce(): void {
  if (isCacheHydratedFromStorage || typeof window === 'undefined') return;
  isCacheHydratedFromStorage = true;
  try {
    const raw = window.localStorage.getItem(CORRELATION_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as CachedWeatherCorrelationEntry[];
    if (!Array.isArray(parsed)) return;
    parsed.slice(0, MAX_CACHED_DATASETS).forEach((entry) => {
      if (entry && typeof entry.cacheKey === 'string' && Array.isArray(entry.hourlyData)) {
        MEMORY_CORRELATION_CACHE.set(entry.cacheKey, entry);
      }
    });
  } catch {
    // Ignore malformed storage entries
  }
}

function persistCorrelationCacheToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(MEMORY_CORRELATION_CACHE.values())
      .sort((a, b) => b.cachedAtMs - a.cachedAtMs)
      .slice(0, MAX_CACHED_DATASETS);
    window.localStorage.setItem(CORRELATION_CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

function buildDatasetFingerprint(
  dateIso: string,
  weatherHours: HourlyWeatherPoint[],
  observations: AlgedonicObservation[],
  hourlyReceptorProfile: HourlyReceptorPuffDose[],
  machineNoiseOutputDb: number
): string {
  const wSig = weatherHours
    .map((w) => `${w.windSpeed10m.toFixed(1)}_${w.windGusts10m.toFixed(1)}`)
    .join('|');
  const rSig = hourlyReceptorProfile
    .map((r) => `${r.sumQuotient.toFixed(3)}_${(r.depositedDustUgM2 ?? 0).toFixed(1)}`)
    .join('|');
  const oSig = observations
    .map(
      (o) =>
        `${o.id}:${o.observedHourIndex}:${o.plumeCorroboration.calculatedSumQuotient.toFixed(2)}`
    )
    .join('|');

  const fullStr = `${dateIso}::${machineNoiseOutputDb}::${wSig}::${rSig}::${oSig}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < fullStr.length; i++) {
    hash ^= fullStr.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${dateIso}_db${machineNoiseOutputDb}_${(hash >>> 0).toString(16)}`;
}

function computePearson(
  items: HourlyCorrelationPoint[],
  xAccessor: (d: HourlyCorrelationPoint) => number,
  yAccessor: (d: HourlyCorrelationPoint) => number
): number {
  const n = items.length;
  if (n === 0) return 0;
  const meanX = d3.mean(items, xAccessor) ?? 0;
  const meanY = d3.mean(items, yAccessor) ?? 0;
  let num = 0;
  let denX = 0;
  let denY = 0;
  items.forEach((d) => {
    const dx = xAccessor(d) - meanX;
    const dy = yAccessor(d) - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  });
  const denom = Math.sqrt(denX * denY);
  return denom > 1e-5 ? Number((num / denom).toFixed(2)) : 0;
}

export const HeaderWeatherCorrelationD3Popup: React.FC<HeaderWeatherCorrelationD3PopupProps> = ({
  isOpen,
  onClose,
  dateIso,
  weatherHours,
  observations,
  hourlyReceptorProfile,
  selectedHourIndex,
  machineNoiseOutputDb,
  onSelectHour,
  onExportForensicPdf,
}) => {
  hydrateCorrelationCacheOnce();

  const popupRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredHour, setHoveredHour] = useState<HourlyCorrelationPoint | null>(null);
  const [cacheRevision, setCacheRevision] = useState<number>(0);

  const [dustScaleMode, setDustScaleMode] = useState<DustAxisScaleMode>(() => {
    if (typeof window === 'undefined') return 'linear';
    try {
      const saved = window.localStorage.getItem(SCALE_MODE_STORAGE_KEY);
      return saved === 'logarithmic' ? 'logarithmic' : 'linear';
    } catch {
      return 'linear';
    }
  });

  const [dustUnitMode, setDustUnitMode] = useState<DustDepositionUnitMode>(() => {
    if (typeof window === 'undefined') return 'ug_m2';
    try {
      const saved = window.localStorage.getItem(UNIT_MODE_STORAGE_KEY);
      return saved === 'mg_m2' ? 'mg_m2' : 'ug_m2';
    } catch {
      return 'ug_m2';
    }
  });

  const handleChangeScaleMode = (nextMode: DustAxisScaleMode) => {
    setDustScaleMode(nextMode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SCALE_MODE_STORAGE_KEY, nextMode);
      } catch {
        // Ignore storage error
      }
    }
  };

  const handleChangeUnitMode = (nextUnit: DustDepositionUnitMode) => {
    setDustUnitMode(nextUnit);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(UNIT_MODE_STORAGE_KEY, nextUnit);
      } catch {
        // Ignore storage error
      }
    }
  };

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSelectHourRef = useRef(onSelectHour);
  onSelectHourRef.current = onSelectHour;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (popupRef.current?.contains(target)) return;
      if (target.closest('[data-weather-corr-toggle="true"]')) return;
      onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen]);

  const { hourlyData, pearsonR, pearsonDustQuotientR, wasCacheHit, cachedDatasetCount } =
    useMemo(() => {
      void cacheRevision;
      hydrateCorrelationCacheOnce();

      const cacheKey = buildDatasetFingerprint(
        dateIso,
        weatherHours,
        observations,
        hourlyReceptorProfile,
        machineNoiseOutputDb
      );

      const existing = MEMORY_CORRELATION_CACHE.get(cacheKey);
      if (existing) {
        existing.cachedAtMs = Date.now();
        return {
          hourlyData: existing.hourlyData,
          pearsonR: existing.pearsonR,
          pearsonDustQuotientR: existing.pearsonDustQuotientR,
          wasCacheHit: true,
          cachedDatasetCount: MEMORY_CORRELATION_CACHE.size,
        };
      }

      const computedHourly: HourlyCorrelationPoint[] = Array.from({ length: 24 }, (_, hr) => {
        const w = weatherHours[hr] ||
          weatherHours[0] || {
            hourIndex: hr,
            hourLabel: `${String(hr).padStart(2, '0')}:00`,
            windSpeed10m: 5.0,
            windGusts10m: 7.5,
          };
        const puffHr = hourlyReceptorProfile[hr];
        const sumQ = puffHr ? puffHr.sumQuotient : 0;
        const rawDepositedUg = puffHr ? puffHr.depositedDustUgM2 ?? 0 : 0;

        const matchingObs = observations.filter((obs) => obs.observedHourIndex === hr);

        let recordedNoiseEvents = 0;
        let recordedDustEvents = 0;
        const eventTitles: string[] = [];

        matchingObs.forEach((obs) => {
          const textCombined = `${obs.observationType} ${obs.description}`.toLowerCase();
          const isNoise =
            textCombined.includes('støj') ||
            textCombined.includes('impuls') ||
            textCombined.includes('db') ||
            textCombined.includes('hammer') ||
            textCombined.includes('lyd') ||
            textCombined.includes('vibration');
          const isDust =
            textCombined.includes('støv') ||
            textCombined.includes('asbest') ||
            textCombined.includes('fane') ||
            textCombined.includes('fiber') ||
            obs.plumeCorroboration.calculatedSumQuotient >= 0.25;

          if (isNoise) recordedNoiseEvents += 1;
          if (isDust || !isNoise) recordedDustEvents += 1;
          eventTitles.push(`${obs.code}: ${obs.observationType}`);
        });

        const limitDb = hr >= 7 && hr < 18 ? 70.0 : 40.0;
        const estNoiseLaeqDb = Number(
          (
            machineNoiseOutputDb -
            39.5 +
            Math.min(6.2, w.windSpeed10m * 0.52) +
            5.0
          ).toFixed(1)
        );

        const simulatedNoiseBreach = estNoiseLaeqDb > limitDb ? 1 : 0;
        const simulatedDustBreach = sumQ >= 0.5 ? 1 : 0;

        const effNoiseCount = recordedNoiseEvents + simulatedNoiseBreach;
        const effDustCount = recordedDustEvents + simulatedDustBreach;
        const totalRecordedEvents = matchingObs.length;

        const rawDustDepositionQuotient =
          sumQ + rawDepositedUg / 100 + recordedDustEvents * 0.18;
        const dustDepositionQuotient = Number(
          Math.max(0.01, rawDustDepositionQuotient).toFixed(3)
        );
        // Ensure coherent positive physical deposition in µg/m² tied to S-quotient + puff deposition
        const effectiveDepositedUgM2 = Number(
          Math.max(1.0, rawDepositedUg > 0 ? rawDepositedUg : dustDepositionQuotient * 100).toFixed(1)
        );

        const eventIntensityIndex = Number(
          (
            matchingObs.length * 1.4 +
            effNoiseCount * 0.65 +
            effDustCount * 0.75 +
            Math.max(0, (estNoiseLaeqDb - limitDb) * 0.08) +
            sumQ * 0.9
          ).toFixed(2)
        );

        return {
          hourIndex: hr,
          hourLabel: `${String(hr).padStart(2, '0')}:00`,
          windSpeedMs: Number(w.windSpeed10m.toFixed(1)),
          windGustsMs: Number(w.windGusts10m.toFixed(1)),
          recordedNoiseEvents: effNoiseCount,
          recordedDustEvents: effDustCount,
          totalRecordedEvents,
          eventIntensityIndex,
          sumQuotient: Number(sumQ.toFixed(3)),
          depositedDustUgM2: effectiveDepositedUgM2,
          dustDepositionQuotient,
          estNoiseLaeqDb,
          eventTitles,
        };
      });

      const computedR = computePearson(
        computedHourly,
        (d) => d.windSpeedMs,
        (d) => d.eventIntensityIndex
      );
      const computedDustR = computePearson(
        computedHourly,
        (d) => d.windSpeedMs,
        (d) => d.depositedDustUgM2
      );

      const entry: CachedWeatherCorrelationEntry = {
        cacheKey,
        dateIso,
        machineNoiseOutputDb,
        cachedAtMs: Date.now(),
        hourlyData: computedHourly,
        pearsonR: computedR,
        pearsonDustQuotientR: computedDustR,
      };

      if (MEMORY_CORRELATION_CACHE.size >= MAX_CACHED_DATASETS) {
        let oldestKey: string | null = null;
        let oldestTs = Infinity;
        MEMORY_CORRELATION_CACHE.forEach((val, key) => {
          if (val.cachedAtMs < oldestTs) {
            oldestTs = val.cachedAtMs;
            oldestKey = key;
          }
        });
        if (oldestKey) MEMORY_CORRELATION_CACHE.delete(oldestKey);
      }

      MEMORY_CORRELATION_CACHE.set(cacheKey, entry);
      persistCorrelationCacheToStorage();

      return {
        hourlyData: computedHourly,
        pearsonR: computedR,
        pearsonDustQuotientR: computedDustR,
        wasCacheHit: false,
        cachedDatasetCount: MEMORY_CORRELATION_CACHE.size,
      };
    }, [
      dateIso,
      weatherHours,
      observations,
      hourlyReceptorProfile,
      machineNoiseOutputDb,
      cacheRevision,
    ]);

  const handleClearCorrelationCache = () => {
    MEMORY_CORRELATION_CACHE.clear();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(CORRELATION_CACHE_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    setCacheRevision((v) => v + 1);
  };

  // Unit conversion helper: µg/m² vs mg/m² (1 mg/m² = 1000 µg/m²)
  const unitFactor = dustUnitMode === 'mg_m2' ? 0.001 : 1.0;
  const unitLabel = dustUnitMode === 'mg_m2' ? 'mg/m²' : 'µg/m²';

  const activePoint = hoveredHour || hourlyData[selectedHourIndex] || hourlyData[0];

  // Dynamic percentage-change trend indicator vs. previous hour
  const dustExposureTrend = useMemo(() => {
    if (!activePoint || hourlyData.length === 0) {
      return {
        pctChange: 0,
        prevHourLabel: '00:00',
        prevValInUnit: 0,
        currValInUnit: 0,
        direction: 'flat' as 'up' | 'down' | 'flat',
      };
    }
    const currIdx = activePoint.hourIndex;
    const prevIdx = currIdx > 0 ? currIdx - 1 : 23;
    const prevPt = hourlyData[prevIdx] || activePoint;
    const prevUg = Math.max(0.1, prevPt.depositedDustUgM2);
    const currUg = activePoint.depositedDustUgM2;
    const rawPct = ((currUg - prevUg) / prevUg) * 100;
    const pctChange = Number(rawPct.toFixed(1));
    const direction: 'up' | 'down' | 'flat' =
      pctChange > 0.5 ? 'up' : pctChange < -0.5 ? 'down' : 'flat';

    return {
      pctChange,
      prevHourLabel: prevPt.hourLabel,
      prevValInUnit: prevUg * unitFactor,
      currValInUnit: currUg * unitFactor,
      direction,
    };
  }, [activePoint, hourlyData, unitFactor]);

  // Render D3.js dual-axis 24-hour correlation chart with Linear/Logarithmic & µg/m² / mg/m² Dust Deposition Axes
  useEffect(() => {
    if (!isOpen || !svgRef.current) return;

    const width = 508;
    const height = 232;
    const margin = { top: 22, right: 64, bottom: 28, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');
    const windAreaGrad = defs
      .append('linearGradient')
      .attr('id', 'd3-wind-corr-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    windAreaGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#38bdf8')
      .attr('stop-opacity', 0.32);
    windAreaGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#38bdf8')
      .attr('stop-opacity', 0.02);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand<number>()
      .domain(hourlyData.map((d) => d.hourIndex))
      .range([0, innerW])
      .padding(0.22);

    const xLinear = d3
      .scaleLinear()
      .domain([0, 23])
      .range([xScale.bandwidth() / 2, innerW - xScale.bandwidth() / 2]);

    const maxWind = Math.max(14, d3.max(hourlyData, (d) => d.windGustsMs) ?? 14);
    const yWind = d3.scaleLinear().domain([0, maxWind * 1.1]).nice().range([innerH, 0]);

    const dustInUnit = (d: HourlyCorrelationPoint) => d.depositedDustUgM2 * unitFactor;
    const noiseCapInUnit = (d: HourlyCorrelationPoint) =>
      d.recordedNoiseEvents * 28.0 * unitFactor;

    const thresholdS1InUnit = STATUTORY_DEPOSITION_UG_M2_AT_S1 * unitFactor;
    const maxDustValInUnit = Math.max(
      thresholdS1InUnit * 1.6,
      d3.max(hourlyData, (d) => dustInUnit(d) + noiseCapInUnit(d)) ?? thresholdS1InUnit * 1.6
    );

    const logMinVal = dustUnitMode === 'mg_m2' ? 0.001 : 1.0;
    const logUpperBound = Math.max(
      thresholdS1InUnit * 10,
      Math.pow(10, Math.ceil(Math.log10(Math.max(logMinVal * 10, maxDustValInUnit * 1.25))))
    );

    const yDustAxis: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number> =
      dustScaleMode === 'logarithmic'
        ? d3
            .scaleLog()
            .base(10)
            .domain([logMinVal, logUpperBound])
            .clamp(true)
            .range([innerH, 0])
        : d3
            .scaleLinear()
            .domain([0, maxDustValInUnit * 1.18])
            .nice()
            .range([innerH, 0]);

    const mapValToRightY = (valInUnit: number): number => {
      if (dustScaleMode === 'logarithmic') {
        return yDustAxis(Math.max(logMinVal, valInUnit));
      }
      return yDustAxis(Math.max(0, valInUnit));
    };

    // Horizontal grid lines
    g.append('g')
      .selectAll('line')
      .data(yWind.ticks(4))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => yWind(d))
      .attr('y2', (d) => yWind(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-width', 0.8);

    // Highlight active selected hour column
    const selBandX = xScale(selectedHourIndex) ?? 0;
    g.append('rect')
      .attr('x', selBandX - 2)
      .attr('y', 0)
      .attr('width', xScale.bandwidth() + 4)
      .attr('height', innerH)
      .attr('fill', '#fde047')
      .attr('fill-opacity', 0.12)
      .attr('rx', 2);

    // Statutory BEK 613/2026 S = 1.0 Equivalent Dust Deposition Threshold Line
    const yThresholdS1 = mapValToRightY(thresholdS1InUnit);
    if (yThresholdS1 >= 0 && yThresholdS1 <= innerH) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yThresholdS1)
        .attr('y2', yThresholdS1)
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 1.15)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-opacity', 0.85);

      g.append('text')
        .attr('x', innerW - 3)
        .attr('y', Math.max(9, yThresholdS1 - 3))
        .attr('text-anchor', 'end')
        .attr('fill', '#fda4af')
        .attr('font-size', '7.5px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text(
          dustUnitMode === 'mg_m2'
            ? 'Grænse S=1,0 (0,10 mg/m²)'
            : 'Grænse S=1,0 (100 µg/m²)'
        );
    }

    // Interactive hourly column groups
    const barGroups = g
      .append('g')
      .selectAll('g')
      .data(hourlyData)
      .join('g')
      .attr('transform', (d) => `translate(${xScale(d.hourIndex) ?? 0},0)`)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredHour(d))
      .on('mouseleave', () => setHoveredHour(null))
      .on('click', (_event, d) => onSelectHourRef.current(d.hourIndex));

    // Dust Deposition bar (rose/crimson) mapped to Right Axis in µg/m² or mg/m²
    barGroups
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => mapValToRightY(dustInUnit(d)))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => Math.max(1.5, innerH - mapValToRightY(dustInUnit(d))))
      .attr('fill', (d) =>
        d.depositedDustUgM2 >= STATUTORY_DEPOSITION_UG_M2_AT_S1 ? '#f43f5e' : '#fb7185'
      )
      .attr('fill-opacity', (d) =>
        d.depositedDustUgM2 >= STATUTORY_DEPOSITION_UG_M2_AT_S1 ? 0.82 : 0.56
      )
      .attr('rx', 1.5);

    // Stacked Noise Event cap (amber)
    barGroups
      .filter((d) => d.recordedNoiseEvents > 0)
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => mapValToRightY(dustInUnit(d) + noiseCapInUnit(d)))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) =>
        Math.max(
          2,
          mapValToRightY(dustInUnit(d)) - mapValToRightY(dustInUnit(d) + noiseCapInUnit(d))
        )
      )
      .attr('fill', '#fbbf24')
      .attr('fill-opacity', 0.86)
      .attr('rx', 1.5);

    // Explicit logged forensic observation marker dots
    barGroups
      .filter((d) => d.totalRecordedEvents > 0)
      .append('circle')
      .attr('cx', xScale.bandwidth() / 2)
      .attr('cy', (d) =>
        Math.max(5, mapValToRightY(dustInUnit(d) + noiseCapInUnit(d)) - 5)
      )
      .attr('r', 3)
      .attr('fill', '#34d399')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1);

    // Wind Speed Area (D3 area)
    const windArea = d3
      .area<HourlyCorrelationPoint>()
      .x((d) => xLinear(d.hourIndex))
      .y0(innerH)
      .y1((d) => yWind(d.windSpeedMs))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(hourlyData).attr('fill', 'url(#d3-wind-corr-grad)').attr('d', windArea);

    // Wind Gusts Dashed Line
    const gustLine = d3
      .line<HourlyCorrelationPoint>()
      .x((d) => xLinear(d.hourIndex))
      .y((d) => yWind(d.windGustsMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(hourlyData)
      .attr('fill', 'none')
      .attr('stroke', '#818cf8')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,2')
      .attr('d', gustLine);

    // Dust Deposition Curve (Fuchsia-Rose) on Right Axis
    const dustDepositionLine = d3
      .line<HourlyCorrelationPoint>()
      .x((d) => xLinear(d.hourIndex))
      .y((d) => mapValToRightY(dustInUnit(d)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(hourlyData)
      .attr('fill', 'none')
      .attr('stroke', '#f472b6')
      .attr('stroke-width', 1.7)
      .attr('d', dustDepositionLine);

    // Wind Speed 10m Primary Line (Cyan)
    const windLine = d3
      .line<HourlyCorrelationPoint>()
      .x((d) => xLinear(d.hourIndex))
      .y((d) => yWind(d.windSpeedMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(hourlyData)
      .attr('fill', 'none')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 2.2)
      .attr('d', windLine);

    // Wind Speed Data Points
    g.append('g')
      .selectAll('circle')
      .data(hourlyData)
      .join('circle')
      .attr('cx', (d) => xLinear(d.hourIndex))
      .attr('cy', (d) => yWind(d.windSpeedMs))
      .attr('r', (d) => (d.hourIndex === selectedHourIndex ? 4.2 : 2.3))
      .attr('fill', (d) => (d.hourIndex === selectedHourIndex ? '#fde047' : '#38bdf8'))
      .attr('stroke', '#090d16')
      .attr('stroke-width', 1.1)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredHour(d))
      .on('mouseleave', () => setHoveredHour(null))
      .on('click', (_event, d) => onSelectHourRef.current(d.hourIndex));

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues([0, 3, 6, 9, 12, 15, 18, 21, 23])
      .tickFormat((hr) => `${String(hr).padStart(2, '0')}:00`);

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);
    xAxisG
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '8.5px')
      .attr('font-family', 'monospace');
    xAxisG.selectAll('path,line').attr('stroke', '#334155');

    // Left Y Axis (Wind Speed m/s)
    const yAxisLeft = d3
      .axisLeft(yWind)
      .ticks(4)
      .tickFormat((v) => `${v} m/s`);
    const yLeftG = g.append('g').call(yAxisLeft);
    yLeftG
      .selectAll('text')
      .attr('fill', '#38bdf8')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace');
    yLeftG.selectAll('path,line').attr('stroke', '#334155');

    // Right Y Axis (Dust Deposition in µg/m² or mg/m² — Linear or Logarithmic)
    const formatDustTick = (val: d3.NumberValue): string => {
      const n = Number(val);
      if (dustUnitMode === 'mg_m2') {
        if (n >= 1) return `${n.toFixed(1)} mg/m²`;
        if (n >= 0.01) return `${n.toFixed(2)} mg/m²`;
        return `${n.toFixed(3)} mg/m²`;
      }
      if (n >= 100) return `${Math.round(n)} µg/m²`;
      return `${n.toFixed(0)} µg/m²`;
    };

    let yAxisRight: d3.Axis<d3.NumberValue>;
    if (dustScaleMode === 'logarithmic') {
      const candidateTicks =
        dustUnitMode === 'mg_m2'
          ? [0.001, 0.01, 0.1, 1, 10]
          : [1, 10, 100, 1000, 10000];
      const logTicks = candidateTicks.filter((t) => t <= logUpperBound + 1e-9);
      yAxisRight = d3
        .axisRight(yDustAxis as d3.ScaleLogarithmic<number, number>)
        .tickValues(logTicks)
        .tickFormat(formatDustTick);
    } else {
      yAxisRight = d3
        .axisRight(yDustAxis as d3.ScaleLinear<number, number>)
        .ticks(4)
        .tickFormat(formatDustTick);
    }

    const yRightG = g.append('g').attr('transform', `translate(${innerW},0)`).call(yAxisRight);
    yRightG
      .selectAll('text')
      .attr('fill', '#f472b6')
      .attr('font-size', '7.6px')
      .attr('font-family', 'monospace');
    yRightG.selectAll('path,line').attr('stroke', '#334155');

    // Right Axis Header Label + Dynamic Percentage-Change Trend Indicator right above the Dust Deposition Axis
    const trendSign = dustExposureTrend.pctChange > 0 ? '+' : '';
    const trendArrow =
      dustExposureTrend.direction === 'up'
        ? '▲'
        : dustExposureTrend.direction === 'down'
        ? '▼'
        : '•';
    const trendColor =
      dustExposureTrend.direction === 'up'
        ? '#fb7185'
        : dustExposureTrend.direction === 'down'
        ? '#34d399'
        : '#94a3b8';

    g.append('text')
      .attr('x', innerW + margin.right - 2)
      .attr('y', -9)
      .attr('text-anchor', 'end')
      .attr('fill', trendColor)
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(
        `Støv (${unitLabel}): ${trendArrow} ${trendSign}${dustExposureTrend.pctChange.toFixed(
          1
        )}% vs. ${dustExposureTrend.prevHourLabel}`
      );
  }, [
    isOpen,
    hourlyData,
    selectedHourIndex,
    dustScaleMode,
    dustUnitMode,
    unitFactor,
    unitLabel,
    dustExposureTrend,
  ]);

  if (!isOpen) return null;

  const formatActiveDeposition = (ugM2: number): string => {
    if (dustUnitMode === 'mg_m2') {
      return `${(ugM2 * 0.001).toFixed(3).replace('.', ',')} mg/m²`;
    }
    return `${ugM2.toFixed(1).replace('.', ',')} µg/m²`;
  };

  return (
    <div
      ref={popupRef}
      data-testid="header-weather-correlation-d3-popup"
      className="absolute right-4 top-full mt-2 w-[640px] max-w-[96vw] rounded-lg bg-[#0B0E17] border border-cyan-400/70 shadow-2xl ring-1 ring-cyan-500/30 p-3 z-50 text-xs font-mono tabular-nums"
      role="dialog"
      aria-label="24-timers D3.js Vejr-Korrelationsgraf mellem vindhastighed og støvdeponering"
    >
      {/* Popup Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-bold text-white truncate">
            24t Vejr-Korrelationsgraf ({dateIso})
          </span>
          <span className="text-[11px] text-cyan-300 shrink-0">
            · r = {pearsonR >= 0 ? `+${pearsonR.toFixed(2)}` : pearsonR.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="d3-popup-export-wind-noise-annex-pdf-btn"
            onClick={() => {
              const rWindToNoise = computePearson(
                hourlyData,
                (d) => d.windSpeedMs,
                (d) => d.estNoiseLaeqDb
              );
              const rGustToNoise = computePearson(
                hourlyData,
                (d) => d.windGustsMs,
                (d) => d.estNoiseLaeqDb
              );
              const selectedRow =
                hourlyData.find((r) => r.hourIndex === selectedHourIndex) ?? hourlyData[0];
              generateWindNoiseTechnicalAnnexPdfReport({
                dateIso,
                selectedHourLabel: selectedRow?.hourLabel ?? '12:00',
                machineNoiseOutputDb,
                pearsonWindToNoiseR: rWindToNoise,
                pearsonGustToNoiseR: rGustToNoise,
                rows: hourlyData.map((r) => {
                  const wh = weatherHours.find((w) => w.hourIndex === r.hourIndex);
                  return {
                    hourIndex: r.hourIndex,
                    hourLabel: r.hourLabel,
                    windSpeedMs: r.windSpeedMs,
                    windGustsMs: r.windGustsMs,
                    windDirectionDeg: Math.round(wh?.windDirection10m ?? 245),
                    pasquillClass: wh?.pasquillClass ?? 'D',
                    estNoiseLaeqDb: r.estNoiseLaeqDb,
                    estMachineLafmaxDb: Number(
                      (
                        r.estNoiseLaeqDb +
                        5.0 +
                        Math.max(0, (machineNoiseOutputDb - 108) * 0.65)
                      ).toFixed(1)
                    ),
                    refractionDeltaDb: Number(
                      ((r.windSpeedMs - 4.0) * 0.45).toFixed(1)
                    ),
                  };
                }),
              });
            }}
            className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
            title="Generér og download teknisk bilag til miljøtilsyn (PDF) med korrelation mellem vinddata og maskinstøj"
          >
            <FileDown className="w-3.5 h-3.5 shrink-0" />
            <span>Teknisk Bilag PDF (Vind × Støj)</span>
          </button>
          {onExportForensicPdf && (
            <button
              type="button"
              data-testid="d3-popup-export-forensic-pdf-btn"
              onClick={onExportForensicPdf}
              className="px-2 py-0.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Generér retsmedicinsk PDF-rapport med seneste 24t vindstød, støvkoncentration og SHA-256"
            >
              <FileDown className="w-3.5 h-3.5 shrink-0" />
              <span>Retsmedicinsk PDF (24t)</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            title="Luk Vejr-Korrelationsgraf"
          >
            <X className="w-3.5 h-3.5" />
            <span className="text-[11px]">Luk</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Scale Mode ('Linear' vs 'Logarithmic') + Dust Deposition Axis Unit Toggle ('µg/m²' vs 'mg/m²') + Cache */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-2 py-1.5 rounded bg-slate-900/90 border border-slate-800 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">Skala:</span>
            <div
              className="inline-flex rounded bg-slate-950 border border-slate-700 p-0.5"
              role="group"
              aria-label="Vælg Lineær eller Logaritmisk akse for støvdeponering"
            >
              <button
                type="button"
                data-scale-mode="linear"
                onClick={() => handleChangeScaleMode('linear')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  dustScaleMode === 'linear'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Linear
              </button>
              <button
                type="button"
                data-scale-mode="logarithmic"
                onClick={() => handleChangeScaleMode('logarithmic')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  dustScaleMode === 'logarithmic'
                    ? 'bg-fuchsia-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Log10
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">Enhed:</span>
            <div
              className="inline-flex rounded bg-slate-950 border border-slate-700 p-0.5"
              role="group"
              aria-label="Skift enhed på støvdeponerings-aksen mellem µg/m² og mg/m²"
            >
              <button
                type="button"
                data-dust-unit="ug_m2"
                onClick={() => handleChangeUnitMode('ug_m2')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  dustUnitMode === 'ug_m2'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Vis støvdeponering i mikrogram pr. kvadratmeter (µg/m²)"
              >
                µg/m²
              </button>
              <button
                type="button"
                data-dust-unit="mg_m2"
                onClick={() => handleChangeUnitMode('mg_m2')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  dustUnitMode === 'mg_m2'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Vis støvdeponering i milligram pr. kvadratmeter (mg/m²) for høj-eksponeringshændelser"
              >
                mg/m²
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Percentage-Change Trend Indicator next to Dust Deposition Axis Controls */}
        <div className="flex items-center gap-1.5">
          <div
            data-testid="dust-deposition-pct-trend"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-bold ${
              dustExposureTrend.direction === 'up'
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                : dustExposureTrend.direction === 'down'
                ? 'bg-emerald-950/75 border-emerald-500/50 text-emerald-200'
                : 'bg-slate-950 border-slate-700 text-slate-300'
            }`}
            title={`Procentvis ændring i støvdeponering kl. ${activePoint?.hourLabel} sammenlignet med forrige time (kl. ${dustExposureTrend.prevHourLabel})`}
          >
            {dustExposureTrend.direction === 'up' ? (
              <TrendingUp className="w-3 h-3 text-rose-400 shrink-0" />
            ) : dustExposureTrend.direction === 'down' ? (
              <TrendingDown className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <Minus className="w-3 h-3 text-slate-400 shrink-0" />
            )}
            <span>
              {dustExposureTrend.pctChange > 0 ? '+' : ''}
              {dustExposureTrend.pctChange.toFixed(1).replace('.', ',')}% vs.{' '}
              {dustExposureTrend.prevHourLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearCorrelationCache}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title={`Persistent korrelations-cache (${wasCacheHit ? 'Cache-Hit' : 'Gemt'} · ${cachedDatasetCount} datasæt). Klik for at genberegne.`}
          >
            <Database className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
            <span>{cachedDatasetCount}</span>
            <RotateCcw className="w-2.5 h-2.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* D3.js SVG Container */}
      <div className="rounded bg-[#060911] border border-slate-800/90 p-1.5">
        <svg ref={svgRef} className="w-full h-auto block select-none" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-slate-300">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1 text-sky-300">
            <span className="w-2.5 h-0.5 bg-sky-400 inline-block" />
            <span>Vind 10m (m/s)</span>
          </span>
          <span className="inline-flex items-center gap-1 text-indigo-300">
            <span className="w-2.5 h-0.5 bg-indigo-400 inline-block border-b border-dashed" />
            <span>Vindstød</span>
          </span>
          <span className="inline-flex items-center gap-1 text-pink-300">
            <span className="w-2.5 h-0.5 bg-pink-400 inline-block" />
            <span>
              Støvdeponering ({unitLabel} · {dustScaleMode === 'logarithmic' ? 'Log10' : 'Lineær'})
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400/90 inline-block" />
            <span>Støj-impuls</span>
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>Bevis ({observations.length})</span>
          </span>
        </div>
      </div>

      {/* Live Hour Inspection Strip */}
      {activePoint && (
        <div className="mt-2 px-2.5 py-1.5 rounded bg-slate-900/95 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-amber-300">kl. {activePoint.hourLabel}</span>
            <span className="text-sky-300">
              Vind: <strong>{activePoint.windSpeedMs} m/s</strong> (stød {activePoint.windGustsMs}{' '}
              m/s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-200 inline-flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-amber-400" />
              <span>
                Støj: <strong>{activePoint.recordedNoiseEvents}</strong> (
                {activePoint.estNoiseLaeqDb} dB)
              </span>
            </span>
            <span className="text-rose-200 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-400" />
              <span>
                Støv: <strong>{formatActiveDeposition(activePoint.depositedDustUgM2)}</strong> (S=
                {activePoint.dustDepositionQuotient.toFixed(2)})
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
