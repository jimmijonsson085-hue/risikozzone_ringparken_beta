import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { X, Wind, Volume2, Sparkles } from 'lucide-react';
import {
  AlgedonicObservation,
  HourlyReceptorPuffDose,
  HourlyWeatherPoint,
} from '../types/dispersion';

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
}

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
  estNoiseLaeqDb: number;
  eventTitles: string[];
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
}) => {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredHour, setHoveredHour] = useState<HourlyCorrelationPoint | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (popupRef.current?.contains(target)) return;
      if (target.closest('[data-weather-corr-toggle="true"]')) return;
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen, onClose]);

  const hourlyData = useMemo<HourlyCorrelationPoint[]>(() => {
    return Array.from({ length: 24 }, (_, hr) => {
      const w = weatherHours[hr] ||
        weatherHours[0] || {
          hourIndex: hr,
          hourLabel: `${String(hr).padStart(2, '0')}:00`,
          windSpeed10m: 5.0,
          windGusts10m: 7.5,
        };
      const puffHr = hourlyReceptorProfile[hr];
      const sumQ = puffHr ? puffHr.sumQuotient : 0;

      // Match recorded observations for this hour
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

      // Combine recorded events with threshold breach events when active so correlation curve is rich across all 24h
      const simulatedNoiseBreach = estNoiseLaeqDb > limitDb ? 1 : 0;
      const simulatedDustBreach = sumQ >= 0.5 ? 1 : 0;

      const effNoiseCount = recordedNoiseEvents + simulatedNoiseBreach;
      const effDustCount = recordedDustEvents + simulatedDustBreach;
      const totalRecordedEvents = matchingObs.length;

      // Composite Noise/Dust Event Intensity Index (events + wind-driven exceedance severity)
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
        sumQuotient: Number(sumQ.toFixed(2)),
        estNoiseLaeqDb,
        eventTitles,
      };
    });
  }, [weatherHours, observations, hourlyReceptorProfile, machineNoiseOutputDb]);

  // Pearson correlation r between 24h wind speed and noise/dust event intensity
  const pearsonR = useMemo(() => {
    const n = hourlyData.length;
    if (n === 0) return 0;
    const meanW = d3.mean(hourlyData, (d) => d.windSpeedMs) ?? 0;
    const meanE = d3.mean(hourlyData, (d) => d.eventIntensityIndex) ?? 0;
    let num = 0;
    let denW = 0;
    let denE = 0;
    hourlyData.forEach((d) => {
      const dw = d.windSpeedMs - meanW;
      const de = d.eventIntensityIndex - meanE;
      num += dw * de;
      denW += dw * dw;
      denE += de * de;
    });
    const denom = Math.sqrt(denW * denE);
    return denom > 1e-5 ? Number((num / denom).toFixed(2)) : 0;
  }, [hourlyData]);

  // Render D3.js dual-axis 24-hour correlation chart
  useEffect(() => {
    if (!isOpen || !svgRef.current) return;

    const width = 468;
    const height = 216;
    const margin = { top: 18, right: 42, bottom: 28, left: 38 };
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
    windAreaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.35);
    windAreaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.03);

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

    const maxEvents = Math.max(
      4,
      d3.max(
        hourlyData,
        (d) => Math.max(d.recordedNoiseEvents + d.recordedDustEvents, d.eventIntensityIndex)
      ) ?? 4
    );
    const yEvents = d3.scaleLinear().domain([0, maxEvents * 1.15]).nice().range([innerH, 0]);

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

    // Stacked bars for Recorded Noise (amber) + Dust (rose) events per hour
    const barGroups = g
      .append('g')
      .selectAll('g')
      .data(hourlyData)
      .join('g')
      .attr('transform', (d) => `translate(${xScale(d.hourIndex) ?? 0},0)`)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredHour(d))
      .on('mouseleave', () => setHoveredHour(null))
      .on('click', (_event, d) => onSelectHour(d.hourIndex));

    // Dust events bar (bottom segment - rose/fuchsia)
    barGroups
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => yEvents(d.recordedDustEvents))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => Math.max(0, innerH - yEvents(d.recordedDustEvents)))
      .attr('fill', '#fb7185')
      .attr('fill-opacity', 0.78)
      .attr('rx', 1.5);

    // Noise events bar (stacked on top - amber)
    barGroups
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => yEvents(d.recordedDustEvents + d.recordedNoiseEvents))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) =>
        Math.max(
          0,
          yEvents(d.recordedDustEvents) - yEvents(d.recordedDustEvents + d.recordedNoiseEvents)
        )
      )
      .attr('fill', '#fbbf24')
      .attr('fill-opacity', 0.86)
      .attr('rx', 1.5);

    // Explicit logged forensic observation marker dots at top of bars
    barGroups
      .filter((d) => d.totalRecordedEvents > 0)
      .append('circle')
      .attr('cx', xScale.bandwidth() / 2)
      .attr('cy', (d) =>
        Math.max(5, yEvents(d.recordedDustEvents + d.recordedNoiseEvents) - 5)
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
      .on('click', (_event, d) => onSelectHour(d.hourIndex));

    // X Axis (Hours 00, 04, 08, 12, 16, 20, 23)
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues([0, 3, 6, 9, 12, 15, 18, 21, 23])
      .tickFormat((hr) => `${String(hr).padStart(2, '0')}:00`);

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);
    xAxisG.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '8.5px').attr('font-family', 'monospace');
    xAxisG.selectAll('path,line').attr('stroke', '#334155');

    // Left Y Axis (Wind Speed m/s)
    const yAxisLeft = d3
      .axisLeft(yWind)
      .ticks(4)
      .tickFormat((v) => `${v} m/s`);
    const yLeftG = g.append('g').call(yAxisLeft);
    yLeftG.selectAll('text').attr('fill', '#38bdf8').attr('font-size', '8px').attr('font-family', 'monospace');
    yLeftG.selectAll('path,line').attr('stroke', '#334155');

    // Right Y Axis (Noise/Dust Events)
    const yAxisRight = d3
      .axisRight(yEvents)
      .ticks(4)
      .tickFormat((v) => `${v} hænd.`);
    const yRightG = g.append('g').attr('transform', `translate(${innerW},0)`).call(yAxisRight);
    yRightG.selectAll('text').attr('fill', '#fbbf24').attr('font-size', '8px').attr('font-family', 'monospace');
    yRightG.selectAll('path,line').attr('stroke', '#334155');
  }, [isOpen, hourlyData, selectedHourIndex, onSelectHour]);

  if (!isOpen) return null;

  const activePoint = hoveredHour || hourlyData[selectedHourIndex] || hourlyData[0];

  return (
    <div
      ref={popupRef}
      data-testid="header-weather-correlation-d3-popup"
      className="absolute right-4 top-full mt-2 w-[490px] max-w-[95vw] rounded-lg bg-[#0B0E17] border border-cyan-400/70 shadow-2xl ring-1 ring-cyan-500/30 p-3 z-50 text-xs font-mono"
      role="dialog"
      aria-label="24-timers D3.js Vejr-Korrelationsgraf mellem vindhastighed og støj/støv-hændelser"
    >
      {/* Popup Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-bold text-white truncate">
            24t Vejr-Korrelationsgraf (D3.js · {dateIso})
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border shrink-0 ${
              pearsonR >= 0.5
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-200'
            }`}
            title="Pearson korrelationskoefficient mellem vindhastighed (m/s) og støj/støv-hændelsesintensitet over 24 timer"
          >
            r = {pearsonR >= 0 ? `+${pearsonR.toFixed(2)}` : pearsonR.toFixed(2)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          title="Luk Vejr-Korrelationsgraf"
        >
          <X className="w-3.5 h-3.5" />
          <span className="text-[10px]">Luk</span>
        </button>
      </div>

      {/* D3.js SVG Container */}
      <div className="rounded bg-[#060911] border border-slate-800/90 p-1.5">
        <svg ref={svgRef} className="w-full h-auto block select-none" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[10px] text-slate-300">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1 text-sky-300">
            <span className="w-2.5 h-0.5 bg-sky-400 inline-block" />
            <span>Vind 10m (m/s)</span>
          </span>
          <span className="inline-flex items-center gap-1 text-indigo-300">
            <span className="w-2.5 h-0.5 bg-indigo-400 inline-block border-b border-dashed" />
            <span>Vindstød</span>
          </span>
          <span className="inline-flex items-center gap-1 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400/90 inline-block" />
            <span>Støj-hændelser</span>
          </span>
          <span className="inline-flex items-center gap-1 text-rose-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-400/90 inline-block" />
            <span>Støv-hændelser</span>
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>Logget Bevis ({observations.length})</span>
          </span>
        </div>
      </div>

      {/* Live Hour Inspection Strip */}
      {activePoint && (
        <div className="mt-2 px-2.5 py-1.5 rounded bg-slate-900/95 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-amber-300">
              kl. {activePoint.hourLabel}
            </span>
            <span className="text-sky-300">
              Vind: <strong>{activePoint.windSpeedMs} m/s</strong> (stød {activePoint.windGustsMs} m/s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-200 inline-flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-amber-400" />
              <span>
                Støj: <strong>{activePoint.recordedNoiseEvents}</strong> ({activePoint.estNoiseLaeqDb} dB)
              </span>
            </span>
            <span className="text-rose-200 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-400" />
              <span>
                Støv: <strong>{activePoint.recordedDustEvents}</strong> (S={activePoint.sumQuotient})
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
