import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Biohazard,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  Flame,
  Layers,
  Map,
  MapPin,
  Maximize2,
  Navigation,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wind,
  X,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  ReceptorZone,
  WeatherDataset,
} from '../types/dispersion';
import { RINGPARKEN_CENTER } from '../data/ringparkenData';
import {
  computePasquillGiffordClass,
  degreesToCompass,
  formatDanishShortDate,
  getDanishWeekdayName,
  shiftDateIsoByDays,
} from '../services/weatherService';
import {
  evaluatePointInDispersionPlume,
  runDispersionSimulation,
} from '../services/dispersionEngine';

export interface Stored30DaySimulationEntry {
  dateIso: string;
  dayLabelShort: string;
  weekdayDa: string;
  isUserSaved: boolean;
  savedAtIso: string;
  meanWindSpeedMs: number;
  maxWindSpeedMs: number;
  maxGustsMs: number;
  dominantWindFromDeg: number;
  dominantPlumeToDeg: number;
  dominantPlumeSector: string;
  totalPrecipitationMm: number;
  peakSumQuotient: number;
  cumulativeSumDose24h: number;
  violationHoursCount: number;
  peakReceptorId: string;
  peakReceptorCode: string;
  peakReceptorName: string;
  peakReceptorAddress: string;
  representativePeakWeather: HourlyWeatherPoint;
  activeSourceIds: string[];
}

type AggregatedHeatmapMetric =
  | 'cumulative_dose'
  | 'exceedance_days'
  | 'mean_sum_quotient'
  | 'trend_delta_15d';

type TimeWindowSlice = 'all_30d' | 'first_15d' | 'latest_15d';

interface SpatialGridCell30D {
  id: string;
  row: number;
  col: number;
  center: LatLngPoint;
  cumulativeDose30d: number;
  meanPeakS: number;
  exceedanceDaysCount: number;
  first15dMeanS: number;
  latest15dMeanS: number;
  trendDeltaS: number;
  trendPct: number;
  dominantSourceName: string;
}

interface ThirtyDayAggregatedHeatmapWidgetProps {
  todayIso: string;
  selectedDateIso: string;
  currentWeather: HourlyWeatherPoint;
  weatherDataset: WeatherDataset;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  selectedReceptorId: string | null;
  onSelectDateIso: (dateIso: string) => void;
  onSelectReceptor: (receptorId: string) => void;
  compact?: boolean;
}

const STORAGE_KEY_30D_ARCHIVE = 'ringparken_saved_30d_simulations_v1';

const GRID_LAT_MIN = 55.4113;
const GRID_LAT_MAX = 55.4144;
const GRID_LNG_MIN = 11.3506;
const GRID_LNG_MAX = 11.3564;
const GRID_ROWS = 10;
const GRID_COLS = 14;

/**
 * Generates a realistic 30-day archive of daily demolition dispersion simulations
 * in Ringparken, 4200 Slagelse (today - 29 days through today) so long-term spatial
 * trends and aggregated heatmaps are immediately populated on startup.
 */
function buildBaseline30DaySimulationArchive(
  todayIso: string,
  sources: DemolitionSourceNode[],
  receptors: ReceptorZone[]
): Stored30DaySimulationEntry[] {
  const entries: Stored30DaySimulationEntry[] = [];

  for (let d = -29; d <= 0; d++) {
    const dateIso = shiftDateIsoByDays(todayIso, d);
    const dayIdx = d + 29; // 0 to 29

    // Progressive demolition intensity over the 30-day period (slight upward trend in the latest 15 days due to Block 1 facade & concrete crushing)
    const phaseTrendBoost = dayIdx >= 15 ? 1.18 : 0.94;
    const dateSeed = dateIso
      .split('')
      .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 0);

    // Realistic Slagelse synoptic wind corridors: predominantly SW/W (225°-265°) with NW frontal passages (285°-315°) and occasional SE/S flow (165°-195°)
    const corridorPattern = dayIdx % 7;
    const baseDir =
      corridorPattern === 0 || corridorPattern === 1 || corridorPattern === 3
        ? 238 + (dateSeed % 24) // SW -> NE (towards Kierulffsvej & Børnehave)
        : corridorPattern === 2 || corridorPattern === 5
        ? 282 + (dateSeed % 28) // WNW/NW -> ESE/SE (towards Rødtjørnevej 2)
        : corridorPattern === 4
        ? 258 + (dateSeed % 18) // W -> E (along Kierulffsvej)
        : 182 + (dateSeed % 22); // S -> N (across Blok 1 towards Afd. 23 & Børnehave)

    const baseWindSpeed = Number(
      (
        (4.8 + (dateSeed % 48) * 0.11 + (dayIdx % 5 === 2 ? 2.1 : 0)) *
        phaseTrendBoost
      ).toFixed(1)
    );
    const maxWindSpeed = Number((baseWindSpeed * 1.34).toFixed(1));
    const maxGusts = Number((maxWindSpeed * 1.46).toFixed(1));
    const isRainyDay = dayIdx % 6 === 4;
    const totalPrecip = isRainyDay ? Number((3.4 + (dayIdx % 4) * 1.6).toFixed(1)) : 0;
    const temp = Number((9.5 + Math.sin(dayIdx * 0.3) * 3.8).toFixed(1));
    const clouds = isRainyDay ? 88 : 42;
    const rad = isRainyDay ? 120 : 340;

    const peakWeather: HourlyWeatherPoint = {
      isoTime: `${dateIso}T13:00`,
      hourIndex: 13,
      hourLabel: '13:00',
      temperature2m: temp,
      relativeHumidity2m: isRainyDay ? 86 : 66,
      precipitation: isRainyDay ? Number((totalPrecip / 3).toFixed(1)) : 0,
      cloudCover: clouds,
      windSpeed10m: maxWindSpeed,
      windDirection10m: baseDir % 360,
      windGusts10m: maxGusts,
      soilMoisture0To7cm: isRainyDay ? 0.32 : 0.21,
      directRadiation: rad,
      weatherCode: isRainyDay ? 61 : 2,
      pasquillClass: computePasquillGiffordClass(maxWindSpeed, rad, clouds, 13),
      hadRecentFreezeThaw: false,
    };

    // Synthesize 24h hours around peakWeather to run dispersion simulation
    const synthetic24h: HourlyWeatherPoint[] = Array.from({ length: 24 }, (_, h) => {
      const diurnal = Math.max(0, Math.sin(((h - 6) / 14) * Math.PI));
      const hrWind = Number(
        Math.max(1.6, baseWindSpeed * 0.72 + diurnal * (maxWindSpeed - baseWindSpeed * 0.72)).toFixed(
          1
        )
      );
      const hrDir = (baseDir + Math.round(Math.sin((h + dayIdx) * 0.4) * 14) + 360) % 360;
      const hrRain = isRainyDay && h >= 14 && h <= 16 ? peakWeather.precipitation : 0;
      return {
        ...peakWeather,
        isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
        hourIndex: h,
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        windSpeed10m: hrWind,
        windDirection10m: hrDir,
        windGusts10m: Number((hrWind * 1.45).toFixed(1)),
        precipitation: hrRain,
      };
    });

    const sim = runDispersionSimulation(dateIso, 13, synthetic24h, sources, receptors);
    const plumeToDeg = (baseDir + 180) % 360;
    const violationHrs = sim.puff24h.peakReceptor.hourlyProfile.filter(
      (hp) => hp.sumQuotient >= 1.0
    ).length;

    entries.push({
      dateIso,
      dayLabelShort: formatDanishShortDate(dateIso),
      weekdayDa: getDanishWeekdayName(dateIso),
      isUserSaved: false,
      savedAtIso: `${dateIso}T16:00:00Z`,
      meanWindSpeedMs: baseWindSpeed,
      maxWindSpeedMs: maxWindSpeed,
      maxGustsMs: maxGusts,
      dominantWindFromDeg: baseDir % 360,
      dominantPlumeToDeg: plumeToDeg,
      dominantPlumeSector: degreesToCompass(plumeToDeg),
      totalPrecipitationMm: totalPrecip,
      peakSumQuotient: Number(sim.puff24h.peakReceptor.peakSumQuotient.toFixed(2)),
      cumulativeSumDose24h: Number(sim.puff24h.peakReceptor.cumulativeSumDose.toFixed(2)),
      violationHoursCount: violationHrs,
      peakReceptorId: sim.puff24h.peakReceptor.receptorId,
      peakReceptorCode: sim.puff24h.peakReceptor.receptorCode,
      peakReceptorName: sim.puff24h.peakReceptor.receptorName,
      peakReceptorAddress: sim.puff24h.peakReceptor.address,
      representativePeakWeather: peakWeather,
      activeSourceIds: sources.filter((s) => s.active).map((s) => s.id),
    });
  }

  return entries;
}

export const ThirtyDayAggregatedHeatmapWidget: React.FC<
  ThirtyDayAggregatedHeatmapWidgetProps
> = ({
  todayIso,
  selectedDateIso,
  currentWeather,
  weatherDataset,
  sources,
  receptors,
  selectedReceptorId,
  onSelectDateIso,
  onSelectReceptor,
  compact = false,
}) => {
  const [metricMode, setMetricMode] =
    useState<AggregatedHeatmapMetric>('cumulative_dose');
  const [timeWindowSlice, setTimeWindowSlice] =
    useState<TimeWindowSlice>('all_30d');
  const [savedCustomEntries, setSavedCustomEntries] = useState<
    Record<string, Stored30DaySimulationEntry>
  >(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_30D_ARCHIVE);
      if (raw) {
        return JSON.parse(raw) as Record<string, Stored30DaySimulationEntry>;
      }
    } catch {
      // ignore storage error
    }
    return {};
  });
  const [justSavedToast, setJustSavedToast] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_30D_ARCHIVE,
        JSON.stringify(savedCustomEntries)
      );
    } catch {
      // ignore storage error
    }
  }, [savedCustomEntries]);

  // Baseline 30-day archive merged with any user-saved daily simulations
  const archive30Days = useMemo(() => {
    const baseline = buildBaseline30DaySimulationArchive(
      todayIso,
      sources,
      receptors
    );
    return baseline.map((entry) => {
      if (savedCustomEntries[entry.dateIso]) {
        return savedCustomEntries[entry.dateIso];
      }
      return entry;
    });
  }, [todayIso, sources, receptors, savedCustomEntries]);

  // Save current active simulation into the 30-day archive
  const handleSaveCurrentSimulationToArchive = () => {
    const sim = runDispersionSimulation(
      weatherDataset.dateIso,
      currentWeather.hourIndex,
      weatherDataset.hours,
      sources,
      receptors
    );
    const hrs = weatherDataset.hours;
    const meanWind = Number(
      (hrs.reduce((a, h) => a + h.windSpeed10m, 0) / Math.max(1, hrs.length)).toFixed(1)
    );
    const maxWind = Number(
      Math.max(...hrs.map((h) => h.windSpeed10m)).toFixed(1)
    );
    const maxGusts = Number(
      Math.max(...hrs.map((h) => h.windGusts10m)).toFixed(1)
    );
    const totalRain = Number(
      hrs.reduce((a, h) => a + h.precipitation, 0).toFixed(1)
    );
    const plumeTo = (currentWeather.windDirection10m + 180) % 360;
    const violationHrs = sim.puff24h.peakReceptor.hourlyProfile.filter(
      (hp) => hp.sumQuotient >= 1.0
    ).length;

    const newEntry: Stored30DaySimulationEntry = {
      dateIso: weatherDataset.dateIso,
      dayLabelShort: formatDanishShortDate(weatherDataset.dateIso),
      weekdayDa: getDanishWeekdayName(weatherDataset.dateIso),
      isUserSaved: true,
      savedAtIso: new Date().toISOString(),
      meanWindSpeedMs: meanWind,
      maxWindSpeedMs: maxWind,
      maxGustsMs: maxGusts,
      dominantWindFromDeg: currentWeather.windDirection10m,
      dominantPlumeToDeg: plumeTo,
      dominantPlumeSector: degreesToCompass(plumeTo),
      totalPrecipitationMm: totalRain,
      peakSumQuotient: Number(
        Math.max(
          sim.maxSiteSumQuotient,
          sim.puff24h.peakReceptor.peakSumQuotient
        ).toFixed(2)
      ),
      cumulativeSumDose24h: Number(
        sim.puff24h.peakReceptor.cumulativeSumDose.toFixed(2)
      ),
      violationHoursCount: violationHrs,
      peakReceptorId: sim.puff24h.peakReceptor.receptorId,
      peakReceptorCode: sim.puff24h.peakReceptor.receptorCode,
      peakReceptorName: sim.puff24h.peakReceptor.receptorName,
      peakReceptorAddress: sim.puff24h.peakReceptor.address,
      representativePeakWeather: currentWeather,
      activeSourceIds: sources.filter((s) => s.active).map((s) => s.id),
    };

    setSavedCustomEntries((prev) => ({
      ...prev,
      [weatherDataset.dateIso]: newEntry,
    }));
    setJustSavedToast(weatherDataset.dateIso);
    window.setTimeout(() => setJustSavedToast(null), 3000);
  };

  // Filtered slice of the 30 days
  const activeSliceDays = useMemo(() => {
    if (timeWindowSlice === 'first_15d') {
      return archive30Days.slice(0, 15);
    }
    if (timeWindowSlice === 'latest_15d') {
      return archive30Days.slice(15, 30);
    }
    return archive30Days;
  }, [archive30Days, timeWindowSlice]);

  // Compute 30-day moving average for the Recharts trend graph
  const trendChartData = useMemo(() => {
    return archive30Days.map((day, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const slice7 = archive30Days.slice(windowStart, idx + 1);
      const movingAvg7dS = Number(
        (
          slice7.reduce((acc, x) => acc + x.peakSumQuotient, 0) /
          Math.max(1, slice7.length)
        ).toFixed(2)
      );
      const movingAvg7dDose = Number(
        (
          slice7.reduce((acc, x) => acc + x.cumulativeSumDose24h, 0) /
          Math.max(1, slice7.length)
        ).toFixed(2)
      );
      return {
        ...day,
        movingAvg7dS,
        movingAvg7dDose,
      };
    });
  }, [archive30Days]);

  // Compute Spatial 30-Day Aggregated Heatmap Grid (14 cols x 10 rows) over Ringparken
  const spatialGridData = useMemo(() => {
    const cells: SpatialGridCell30D[] = [];
    const first15 = archive30Days.slice(0, 15);
    const latest15 = archive30Days.slice(15, 30);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        // Row 0 is North (GRID_LAT_MAX), Row GRID_ROWS-1 is South (GRID_LAT_MIN)
        const latFrac = (r + 0.5) / GRID_ROWS;
        const lngFrac = (c + 0.5) / GRID_COLS;
        const lat = Number(
          (GRID_LAT_MAX - latFrac * (GRID_LAT_MAX - GRID_LAT_MIN)).toFixed(5)
        );
        const lng = Number(
          (GRID_LNG_MIN + lngFrac * (GRID_LNG_MAX - GRID_LNG_MIN)).toFixed(5)
        );
        const center: LatLngPoint = { lat, lng };

        let sumSActiveSlice = 0;
        let exceedanceDays = 0;
        let dominantSrcName = 'Blok 1';
        let maxSingleS = -1;

        for (const dayEntry of activeSliceDays) {
          const evalRes = evaluatePointInDispersionPlume(
            center,
            sources,
            dayEntry.representativePeakWeather,
            '30-Dages Aggregeret Sprednings-Simulering'
          );
          const sVal = evalRes.calculatedSumQuotient;
          sumSActiveSlice += sVal;
          if (sVal >= 1.0) {
            exceedanceDays += 1;
          }
          if (sVal > maxSingleS) {
            maxSingleS = sVal;
            dominantSrcName = evalRes.nearestSourceName.split(':')[0];
          }
        }

        // Also compute First 15d vs Latest 15d for long-term trend delta
        let sumFirst15 = 0;
        for (const d1 of first15) {
          sumFirst15 += evaluatePointInDispersionPlume(
            center,
            sources,
            d1.representativePeakWeather,
            'Første 15d'
          ).calculatedSumQuotient;
        }
        let sumLatest15 = 0;
        for (const d2 of latest15) {
          sumLatest15 += evaluatePointInDispersionPlume(
            center,
            sources,
            d2.representativePeakWeather,
            'Seneste 15d'
          ).calculatedSumQuotient;
        }

        const first15Mean = sumFirst15 / Math.max(1, first15.length);
        const latest15Mean = sumLatest15 / Math.max(1, latest15.length);
        const trendDelta = Number((latest15Mean - first15Mean).toFixed(2));
        const trendPct =
          first15Mean > 0.05
            ? Math.round(((latest15Mean - first15Mean) / first15Mean) * 100)
            : 0;

        // 24h cumulative dose factor (~7.5 effective demolition exposure hours per day)
        const cumulativeDose = Number((sumSActiveSlice * 7.2).toFixed(1));
        const meanS = Number(
          (sumSActiveSlice / Math.max(1, activeSliceDays.length)).toFixed(2)
        );

        cells.push({
          id: `cell30d-${r}-${c}`,
          row: r,
          col: c,
          center,
          cumulativeDose30d: cumulativeDose,
          meanPeakS: meanS,
          exceedanceDaysCount: exceedanceDays,
          first15dMeanS: Number(first15Mean.toFixed(2)),
          latest15dMeanS: Number(latest15Mean.toFixed(2)),
          trendDeltaS: trendDelta,
          trendPct,
          dominantSourceName: dominantSrcName,
        });
      }
    }

    const maxDose = Math.max(1, ...cells.map((x) => x.cumulativeDose30d));
    const maxMeanS = Math.max(0.5, ...cells.map((x) => x.meanPeakS));
    const maxExceedDays = Math.max(1, ...cells.map((x) => x.exceedanceDaysCount));
    const maxAbsDelta = Math.max(
      0.15,
      ...cells.map((x) => Math.abs(x.trendDeltaS))
    );

    return {
      cells,
      maxDose,
      maxMeanS,
      maxExceedDays,
      maxAbsDelta,
    };
  }, [archive30Days, activeSliceDays, sources]);

  // Compute 30-day long-term statistics per Receptor Zone
  const receptor30DayRanking = useMemo(() => {
    const first15 = archive30Days.slice(0, 15);
    const latest15 = archive30Days.slice(15, 30);

    return receptors
      .map((rec) => {
        let totalS = 0;
        let exceedDays = 0;
        let peakS = 0;
        let peakDateIso = todayIso;

        for (const dayEntry of activeSliceDays) {
          const evalRes = evaluatePointInDispersionPlume(
            rec.center,
            sources,
            dayEntry.representativePeakWeather,
            rec.name
          );
          const s = evalRes.calculatedSumQuotient;
          totalS += s;
          if (s >= 1.0) exceedDays += 1;
          if (s > peakS) {
            peakS = s;
            peakDateIso = dayEntry.dateIso;
          }
        }

        const first15S =
          first15.reduce(
            (a, d) =>
              a +
              evaluatePointInDispersionPlume(
                rec.center,
                sources,
                d.representativePeakWeather,
                rec.name
              ).calculatedSumQuotient,
            0
          ) / Math.max(1, first15.length);

        const latest15S =
          latest15.reduce(
            (a, d) =>
              a +
              evaluatePointInDispersionPlume(
                rec.center,
                sources,
                d.representativePeakWeather,
                rec.name
              ).calculatedSumQuotient,
            0
          ) / Math.max(1, latest15.length);

        const trendPct =
          first15S > 0.05
            ? Math.round(((latest15S - first15S) / first15S) * 100)
            : 0;

        return {
          receptor: rec,
          cumulativeDose30d: Number((totalS * 7.2).toFixed(1)),
          meanS: Number((totalS / Math.max(1, activeSliceDays.length)).toFixed(2)),
          peakS: Number(peakS.toFixed(2)),
          peakDateIso,
          exceedanceDays: exceedDays,
          trendPct,
        };
      })
      .sort((a, b) => b.cumulativeDose30d - a.cumulativeDose30d);
  }, [receptors, activeSliceDays, archive30Days, sources, todayIso]);

  // Dominant 30-day dispersion vector across all 30 days
  const dominant30DayCorridor = useMemo(() => {
    let sumSin = 0;
    let sumCos = 0;
    for (const d of activeSliceDays) {
      const rad = (d.dominantPlumeToDeg * Math.PI) / 180;
      sumSin += Math.sin(rad) * d.maxWindSpeedMs;
      sumCos += Math.cos(rad) * d.maxWindSpeedMs;
    }
    const meanPlumeDeg = Math.round(
      (((Math.atan2(sumSin, sumCos) * 180) / Math.PI) + 360) % 360
    );
    const meanWindFromDeg = (meanPlumeDeg + 180) % 360;
    const totalViolationDays = activeSliceDays.filter(
      (d) => d.peakSumQuotient >= 1.0
    ).length;
    const first15MeanDose =
      archive30Days
        .slice(0, 15)
        .reduce((a, d) => a + d.cumulativeSumDose24h, 0) / 15;
    const latest15MeanDose =
      archive30Days
        .slice(15, 30)
        .reduce((a, d) => a + d.cumulativeSumDose24h, 0) / 15;
    const overallTrendPct =
      first15MeanDose > 0
        ? Math.round(
            ((latest15MeanDose - first15MeanDose) / first15MeanDose) * 100
          )
        : 0;

    return {
      meanPlumeDeg,
      meanPlumeCompass: degreesToCompass(meanPlumeDeg),
      meanWindFromDeg,
      meanWindFromCompass: degreesToCompass(meanPlumeDeg + 180),
      totalViolationDays,
      overallTrendPct,
    };
  }, [activeSliceDays, archive30Days]);

  const activeCell = useMemo(() => {
    if (selectedCellId) {
      const found = spatialGridData.cells.find((c) => c.id === selectedCellId);
      if (found) return found;
    }
    return [...spatialGridData.cells].sort(
      (a, b) => b.cumulativeDose30d - a.cumulativeDose30d
    )[0];
  }, [selectedCellId, spatialGridData.cells]);

  // Helper to project Lat/Lng onto the 560x340 tactical SVG heatmap canvas
  const SVG_W = 560;
  const SVG_H = 340;
  const projectToSvg = (pt: LatLngPoint) => {
    const x =
      ((pt.lng - GRID_LNG_MIN) / (GRID_LNG_MAX - GRID_LNG_MIN)) * SVG_W;
    const y =
      ((GRID_LAT_MAX - pt.lat) / (GRID_LAT_MAX - GRID_LAT_MIN)) * SVG_H;
    return { x, y };
  };

  // Color ramp for each heatmap cell based on selected metricMode
  const getCellFillColor = (cell: SpatialGridCell30D): { fill: string; stroke: string; label: string } => {
    if (metricMode === 'trend_delta_15d') {
      const norm = Math.min(
        1,
        Math.abs(cell.trendDeltaS) / spatialGridData.maxAbsDelta
      );
      if (cell.trendDeltaS >= 0.04) {
        return {
          fill: `rgba(244, 63, 94, ${(0.22 + norm * 0.58).toFixed(2)})`,
          stroke: 'rgba(253, 164, 175, 0.5)',
          label: `${cell.trendDeltaS >= 0 ? '+' : ''}${cell.trendDeltaS.toFixed(2)} S (${cell.trendPct >= 0 ? '+' : ''}${cell.trendPct}%)`,
        };
      }
      if (cell.trendDeltaS <= -0.04) {
        return {
          fill: `rgba(6, 182, 212, ${(0.22 + norm * 0.55).toFixed(2)})`,
          stroke: 'rgba(103, 232, 249, 0.45)',
          label: `${cell.trendDeltaS.toFixed(2)} S (${cell.trendPct}%)`,
        };
      }
      return {
        fill: 'rgba(51, 65, 85, 0.25)',
        stroke: 'rgba(71, 85, 105, 0.25)',
        label: `Stabil (${cell.trendDeltaS.toFixed(2)} S)`,
      };
    }

    let ratio = 0;
    let label = '';
    if (metricMode === 'cumulative_dose') {
      ratio = Math.min(1, cell.cumulativeDose30d / spatialGridData.maxDose);
      label = `${cell.cumulativeDose30d} S·t`;
    } else if (metricMode === 'exceedance_days') {
      ratio = Math.min(
        1,
        cell.exceedanceDaysCount / spatialGridData.maxExceedDays
      );
      label = `${cell.exceedanceDaysCount} dage ≥1,0`;
    } else {
      ratio = Math.min(1, cell.meanPeakS / spatialGridData.maxMeanS);
      label = `Gns. S=${cell.meanPeakS.toFixed(2)}`;
    }

    if (ratio >= 0.72) {
      return {
        fill: `rgba(225, 29, 72, ${(0.45 + (ratio - 0.72) * 1.2).toFixed(2)})`,
        stroke: 'rgba(253, 164, 175, 0.65)',
        label,
      };
    }
    if (ratio >= 0.45) {
      return {
        fill: `rgba(249, 115, 22, ${(0.35 + (ratio - 0.45) * 0.9).toFixed(2)})`,
        stroke: 'rgba(253, 186, 116, 0.5)',
        label,
      };
    }
    if (ratio >= 0.22) {
      return {
        fill: `rgba(234, 179, 8, ${(0.22 + (ratio - 0.22) * 0.7).toFixed(2)})`,
        stroke: 'rgba(253, 224, 71, 0.35)',
        label,
      };
    }
    return {
      fill: `rgba(14, 165, 233, ${(0.08 + ratio * 0.45).toFixed(2)})`,
      stroke: 'rgba(56, 189, 248, 0.18)',
      label,
    };
  };

  const userSavedCount = Object.keys(savedCustomEntries).length;
  const [isMapOnly, setIsMapOnly] = useState<boolean>(false);

  useEffect(() => {
    if (!isMapOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMapOnly(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMapOnly]);

  return (
    <div
      className={
        isMapOnly
          ? 'fixed inset-0 z-[120] w-screen h-screen bg-[#07090E] p-3 flex flex-col gap-2 overflow-y-auto text-xs'
          : 'p-3 bg-slate-900/90 border border-slate-800 rounded-md space-y-3 text-xs'
      }
    >
      {/* Top Header (hidden in Kun Kort mode) */}
      {!isMapOnly && (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-rose-400 font-bold">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              30-DAGES AGGREGERET STØVSPREDNINGS-HEATMAP &amp; LANGSIGTET TREND-ANALYSE (720 TIMER)
            </span>
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Langsigtede Spredningstendenser i Ringparken ({archive30Days[0]?.dateIso} → {todayIso})
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={handleSaveCurrentSimulationToArchive}
            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            title={`Gem den aktuelle dags simulering (${weatherDataset.dateIso}) i 30-dages arkivet og opdatér det aggregerede heatmap`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {justSavedToast
                ? `✓ Gemt (${justSavedToast})`
                : `Gem Aktuel Simulering (${weatherDataset.dateIso})`}
            </span>
          </button>

          {userSavedCount > 0 && (
            <button
              type="button"
              onClick={() => setSavedCustomEntries({})}
              className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1"
              title="Nulstil bruger-gemte simuleringer til 30-dages reanalyse-baseline"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Nulstil ({userSavedCount} gemte)</span>
            </button>
          )}
        </div>
      </div>
      )}

      {/* 4 Long-Term Trend KPI Summary Cards */}
      {!isMapOnly && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 font-mono">
        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
          <div className="text-[11px] text-slate-400 uppercase">
            Primær 30-Dages Korridor
          </div>
          <div className="text-sm font-extrabold text-cyan-300 flex items-center gap-1.5">
            <Navigation
              className="w-3.5 h-3.5 text-amber-400 shrink-0"
              style={{ transform: `rotate(${dominant30DayCorridor.meanPlumeDeg}deg)` }}
            />
            <span>
              Mod {dominant30DayCorridor.meanPlumeCompass} ({dominant30DayCorridor.meanPlumeDeg}°)
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Fremherskende vind fra {dominant30DayCorridor.meanWindFromCompass} (
            {dominant30DayCorridor.meanWindFromDeg}°)
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
          <div className="text-[11px] text-slate-400 uppercase">
            30-Dages Hotspot Receptor
          </div>
          <div className="text-sm font-extrabold text-rose-400 truncate">
            {receptor30DayRanking[0]?.receptor.code}:{' '}
            {receptor30DayRanking[0]?.receptor.address.split(',')[0]}
          </div>
          <div className="text-[11px] text-amber-300 font-semibold">
            Akkumuleret: {receptor30DayRanking[0]?.cumulativeDose30d} S·t (
            {receptor30DayRanking[0]?.exceedanceDays} dage ≥1,0)
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
          <div className="text-[11px] text-slate-400 uppercase">
            Dage m. Lovbrud (S ≥ 1,0)
          </div>
          <div className="text-sm font-extrabold text-white">
            <span className="text-rose-400">
              {dominant30DayCorridor.totalViolationDays}
            </span>{' '}
            ud af {activeSliceDays.length} dage
          </div>
          <div className="text-[11px] text-slate-300">
            {Math.round(
              (dominant30DayCorridor.totalViolationDays /
                Math.max(1, activeSliceDays.length)) *
                100
            )}
            % af dagene overskred BEK 613/2026
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-0.5">
          <div className="text-[11px] text-slate-400 uppercase">
            15d → 15d Langsigtet Trend
          </div>
          <div
            className={`text-sm font-extrabold flex items-center gap-1 ${
              dominant30DayCorridor.overallTrendPct > 0
                ? 'text-rose-400'
                : 'text-emerald-400'
            }`}
          >
            {dominant30DayCorridor.overallTrendPct >= 0 ? (
              <TrendingUp className="w-4 h-4 shrink-0" />
            ) : (
              <TrendingDown className="w-4 h-4 shrink-0" />
            )}
            <span>
              {dominant30DayCorridor.overallTrendPct >= 0 ? '+' : ''}
              {dominant30DayCorridor.overallTrendPct}% støvbelastning
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Seneste 15 dage vs. første 15 dage
          </div>
        </div>
      </div>
      )}

      {/* Controls Bar: Metric Selector + Time Window Filter + 'Kun Kort' / 'Afslut' Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] shrink-0">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-slate-400 mr-1">Heatmap-Visning:</span>
          <button
            type="button"
            onClick={() => setMetricMode('cumulative_dose')}
            className={`px-2 py-1 rounded font-semibold transition-colors ${
              metricMode === 'cumulative_dose'
                ? 'bg-rose-500 text-white font-bold shadow-xs'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            30d Kumulativ Dosis (ΣS·t)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('exceedance_days')}
            className={`px-2 py-1 rounded font-semibold transition-colors ${
              metricMode === 'exceedance_days'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            Overskridelses-Dage (S ≥ 1,0)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('mean_sum_quotient')}
            className={`px-2 py-1 rounded font-semibold transition-colors ${
              metricMode === 'mean_sum_quotient'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            30d Middel-S
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('trend_delta_15d')}
            className={`px-2 py-1 rounded font-semibold transition-colors ${
              metricMode === 'trend_delta_15d'
                ? 'bg-fuchsia-400 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            Δ Trend (Seneste 15d − Første 15d)
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-slate-400 mr-1">Periode:</span>
          <button
            type="button"
            onClick={() => setTimeWindowSlice('all_30d')}
            className={`px-2 py-1 rounded font-semibold ${
              timeWindowSlice === 'all_30d'
                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Alle 30d
          </button>
          <button
            type="button"
            onClick={() => setTimeWindowSlice('first_15d')}
            className={`px-2 py-1 rounded font-semibold ${
              timeWindowSlice === 'first_15d'
                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Dag 1–15
          </button>
          <button
            type="button"
            onClick={() => setTimeWindowSlice('latest_15d')}
            className={`px-2 py-1 rounded font-semibold ${
              timeWindowSlice === 'latest_15d'
                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Dag 16–30 (Seneste)
          </button>

          {isMapOnly && (
            <span className="ml-1 px-2.5 py-1 rounded bg-[#0B0E17] border border-cyan-400/80 text-white font-mono font-bold flex items-center gap-1.5 shadow-md tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-cyan-300 shrink-0" />
                <span>{weatherDataset.dateIso}</span>
              </span>
              <span className="text-cyan-400">·</span>
              <span className="text-amber-300 font-extrabold inline-flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                <span>kl. {currentWeather.hourLabel}</span>
              </span>
            </span>
          )}
          {!isMapOnly ? (
            <button
              type="button"
              onClick={() => setIsMapOnly(true)}
              className="ml-1 px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 border border-emerald-200 text-slate-950 font-extrabold flex items-center gap-1 shadow-sm cursor-pointer"
              title="Kun Kort — Vis kun 30-dages spredningskortet med filtre"
            >
              <Map className="w-3.5 h-3.5 text-slate-950" />
              <span>Kun Kort</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsMapOnly(false)}
              className="ml-1 px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 border border-rose-300 text-white font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
              title="Afslut 'Kun Kort' visning (Esc)"
            >
              <X className="w-4 h-4 text-white" />
              <span>Afslut</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Grid: LEFT = 2D Spatial 30-Day Aggregated Heatmap Canvas | RIGHT = Selected Hotspot & Receptor Ranking */}
      <div className={`grid grid-cols-1 xl:grid-cols-12 gap-3 ${isMapOnly ? 'flex-1 min-h-0' : ''}`}>
        {/* LEFT 7 COLS (or 12 COLS in Kun Kort mode): Interactive 2D Spatial Aggregated Heatmap over Ringparken */}
        <div
          className={`${
            isMapOnly ? 'xl:col-span-12 flex flex-col justify-between' : 'xl:col-span-7'
          } bg-slate-950 border border-slate-800 rounded-md p-2.5 space-y-2`}
        >
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              <span>
                Rumligt 30-Dages Støvsprednings-Heatmap — Ringparken, 4200 Slagelse (14×10 Celler)
              </span>
            </span>
            <div className="flex items-center gap-2">
              {isMapOnly && (
                <span className="px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/70 text-cyan-100 font-bold inline-flex items-center gap-1.5 tabular-nums">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{weatherDataset.dateIso}</span>
                  <span>·</span>
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>kl. {currentWeather.hourLabel}</span>
                </span>
              )}
              <span className="text-slate-400">Klik på felt eller receptor</span>
              {!isMapOnly ? (
                <button
                  type="button"
                  onClick={() => setIsMapOnly(true)}
                  className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
                  title="Kun Kort — Vis kun 30-dages kortet med filtre"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Kun Kort</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMapOnly(false)}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 border border-rose-200 text-white font-extrabold flex items-center gap-1 cursor-pointer shadow-lg"
                  title="Afslut 'Kun Kort' visning (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Afslut</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative w-full overflow-hidden rounded border border-slate-800 bg-[#060911]">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full h-auto block select-none"
            >
              {/* Subtle GIS Reference Grid */}
              <defs>
                <radialGradient id="hotspotGlow30d" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                  <stop offset="65%" stopColor="#f97316" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Spatial 14x10 Aggregated Heatmap Cells */}
              {spatialGridData.cells.map((cell) => {
                const cellW = SVG_W / GRID_COLS;
                const cellH = SVG_H / GRID_ROWS;
                const x = cell.col * cellW;
                const y = cell.row * cellH;
                const style = getCellFillColor(cell);
                const isSel = activeCell?.id === cell.id;

                return (
                  <g
                    key={cell.id}
                    onClick={() => setSelectedCellId(cell.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x}
                      y={y}
                      width={cellW}
                      height={cellH}
                      fill={style.fill}
                      stroke={isSel ? '#ffffff' : style.stroke}
                      strokeWidth={isSel ? 1.8 : 0.6}
                    />
                    {/* Show value label inside high-exposure hotspot cells */}
                    {(cell.exceedanceDaysCount >= 8 || isSel) && (
                      <text
                        x={x + cellW / 2}
                        y={y + cellH / 2 + 3}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {metricMode === 'exceedance_days'
                          ? `${cell.exceedanceDaysCount}d`
                          : metricMode === 'trend_delta_15d'
                          ? `${cell.trendPct >= 0 ? '+' : ''}${cell.trendPct}%`
                          : `${cell.meanPeakS.toFixed(1)}`}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Ringparken Street Network Overlay for Spatial Orientation */}
              <g stroke="#334155" strokeWidth="2.2" fill="none" opacity="0.75">
                {/* Kierulffsvej */}
                <polyline
                  points={`${projectToSvg({ lat: 55.41285, lng: 11.351 }).x},${
                    projectToSvg({ lat: 55.41285, lng: 11.351 }).y
                  } ${projectToSvg({ lat: 55.41285, lng: 11.3536 }).x},${
                    projectToSvg({ lat: 55.41285, lng: 11.3536 }).y
                  } ${projectToSvg({ lat: 55.4131, lng: 11.3558 }).x},${
                    projectToSvg({ lat: 55.4131, lng: 11.3558 }).y
                  }`}
                />
                {/* Valbyvej */}
                <polyline
                  points={`${projectToSvg({ lat: 55.4114, lng: 11.3508 }).x},${
                    projectToSvg({ lat: 55.4114, lng: 11.3508 }).y
                  } ${projectToSvg({ lat: 55.41195, lng: 11.3562 }).x},${
                    projectToSvg({ lat: 55.41195, lng: 11.3562 }).y
                  }`}
                />
                {/* Rødtjørnevej */}
                <polyline
                  points={`${projectToSvg({ lat: 55.4125, lng: 11.3512 }).x},${
                    projectToSvg({ lat: 55.4125, lng: 11.3512 }).y
                  } ${projectToSvg({ lat: 55.4122, lng: 11.3522 }).x},${
                    projectToSvg({ lat: 55.4122, lng: 11.3522 }).y
                  } ${projectToSvg({ lat: 55.4118, lng: 11.3532 }).x},${
                    projectToSvg({ lat: 55.4118, lng: 11.3532 }).y
                  }`}
                />
              </g>

              {/* Street Labels */}
              <text
                x={projectToSvg({ lat: 55.41292, lng: 11.3547 }).x}
                y={projectToSvg({ lat: 55.41292, lng: 11.3547 }).y - 4}
                fill="#cbd5e1"
                fontSize="9.5"
                fontFamily="monospace"
              >
                Kierulffsvej
              </text>
              <text
                x={projectToSvg({ lat: 55.4121, lng: 11.3518 }).x}
                y={projectToSvg({ lat: 55.4121, lng: 11.3518 }).y + 10}
                fill="#cbd5e1"
                fontSize="9.5"
                fontFamily="monospace"
              >
                Rødtjørnevej 2
              </text>

              {/* Dominant 30-Day Plume Corridor Vector from Ringparken Center */}
              {(() => {
                const origin = projectToSvg(RINGPARKEN_CENTER);
                const rad =
                  ((dominant30DayCorridor.meanPlumeDeg - 90) * Math.PI) / 180;
                const endX = origin.x + Math.cos(rad) * 115;
                const endY = origin.y + Math.sin(rad) * 115;
                return (
                  <g>
                    <line
                      x1={origin.x}
                      y1={origin.y}
                      x2={endX}
                      y2={endY}
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                      strokeDasharray="5 3"
                    />
                    <circle cx={endX} cy={endY} r="4" fill="#22d3ee" />
                    <text
                      x={endX + 6}
                      y={endY + 3}
                      fill="#67e8f9"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      30d Fane ({dominant30DayCorridor.meanPlumeCompass})
                    </text>
                  </g>
                );
              })()}

              {/* Demolition Sources (Kildenoder) */}
              {sources.map((src) => {
                const pt = projectToSvg(src.position);
                return (
                  <g key={src.id}>
                    <rect
                      x={pt.x - 8}
                      y={pt.y - 8}
                      width={16}
                      height={16}
                      rx={3}
                      fill={src.active ? '#e11d48' : '#475569'}
                      stroke="#ffffff"
                      strokeWidth="1.4"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 11}
                      textAnchor="middle"
                      fill="#fda4af"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {src.code}
                    </text>
                  </g>
                );
              })}

              {/* Receptor Nodes with 30-Day Exposure Badges */}
              {receptor30DayRanking.map((rItem, idx) => {
                const pt = projectToSvg(rItem.receptor.center);
                const isSelectedRec =
                  selectedReceptorId === rItem.receptor.id;
                const isHotspot = idx === 0;
                return (
                  <g
                    key={rItem.receptor.id}
                    onClick={() => onSelectReceptor(rItem.receptor.id)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelectedRec ? 8 : isHotspot ? 7 : 5.5}
                      fill={
                        rItem.exceedanceDays >= 10
                          ? '#f59e0b'
                          : '#38bdf8'
                      }
                      stroke="#020617"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.x}
                      y={pt.y + 15}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {rItem.receptor.code} ({rItem.exceedanceDays}d)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Color Scale Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300 pt-0.5">
            {metricMode === 'trend_delta_15d' ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Stigende
                  Støvtrend (+ΔS)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-600 inline-block" /> Stabil
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500 inline-block" /> Faldende
                  Støvtrend (−ΔS)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" /> Kronisk
                  Hotspot (Høj 30d Dosis)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-orange-500 inline-block" /> Forhøjet
                  30d Aftryk
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-yellow-400 inline-block" /> Sekundær
                  Fane
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-sky-500/50 inline-block" /> Randzone
                </span>
              </div>
            )}
            <span className="text-slate-400 inline-flex items-center gap-1">
              <Biohazard className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Kildenoder · ● Receptorer (antal dage m. S≥1,0)</span>
            </span>
          </div>
        </div>

        {/* RIGHT 5 COLS: Selected Cell / Receptor Inspector & 30-Day Receptor Ranking */}
        {!isMapOnly && (
        <div className="xl:col-span-5 flex flex-col justify-between gap-2.5">
          {/* Selected Grid Cell Inspector */}
          {activeCell && (
            <div className="p-2.5 rounded bg-slate-950 border border-rose-500/40 space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-rose-300 inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Inspiceret 30-Dages Felt ({activeCell.center.lat.toFixed(4)}°N,{' '}
                    {activeCell.center.lng.toFixed(4)}°E)
                  </span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40 text-[11px] font-bold">
                  Kilde: {activeCell.dominantSourceName}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">30D KUMULATIV DOSIS</div>
                  <div className="font-extrabold text-white">
                    {activeCell.cumulativeDose30d} S·t
                  </div>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">DAGE MED S ≥ 1,0</div>
                  <div className="font-extrabold text-amber-300">
                    {activeCell.exceedanceDaysCount} / {activeSliceDays.length} dage
                  </div>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">15D → 15D TREND</div>
                  <div
                    className={`font-extrabold ${
                      activeCell.trendPct > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {activeCell.trendPct >= 0 ? '+' : ''}
                    {activeCell.trendPct}% ({activeCell.trendDeltaS >= 0 ? '+' : ''}
                    {activeCell.trendDeltaS} S)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 30-Day Receptor Chronic Exposure Ranking */}
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1.5 flex-1">
            <div className="text-[11px] font-mono font-bold text-amber-300 uppercase">
              Rangliste: Mest Udsatte Receptorer over 30 Dage
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5 font-mono text-[11px]">
              {receptor30DayRanking.map((item, idx) => {
                const isSel = selectedReceptorId === item.receptor.id;
                return (
                  <button
                    key={item.receptor.id}
                    type="button"
                    onClick={() => {
                      onSelectReceptor(item.receptor.id);
                      onSelectDateIso(item.peakDateIso);
                    }}
                    className={`w-full text-left p-2 rounded border transition-colors flex items-center justify-between gap-2 ${
                      isSel
                        ? 'bg-rose-950/60 border-amber-300 text-white'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[11px] font-extrabold ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="font-bold truncate">
                          {item.receptor.code}: {item.receptor.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.receptor.address} · Spids d. {item.peakDateIso} (S=
                        {item.peakS.toFixed(2)})
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-rose-300">
                        {item.cumulativeDose30d} S·t
                      </div>
                      <div className="text-[11px] text-amber-300">
                        {item.exceedanceDays}d ≥1,0 ·{' '}
                        <span
                          className={
                            item.trendPct >= 0 ? 'text-rose-400' : 'text-emerald-400'
                          }
                        >
                          {item.trendPct >= 0 ? '+' : ''}
                          {item.trendPct}%
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Bottom: 30-Day Historical Simulation Trend Line & Daily Dose Chart (Recharts) */}
      {!isMapOnly && (
      <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
          <span className="font-bold text-white">
            30-Dages Tidsserie &amp; 7-Dages Glidende Gennemsnit (Klik på en dag for at indlæse simuleringen på kortet)
          </span>
          <span className="text-cyan-300 text-[11px]">
            Valgt dato: {selectedDateIso}
          </span>
        </div>

        <div className={compact ? 'h-44 w-full' : 'h-52 w-full'}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={trendChartData}
              margin={{ top: 8, right: 12, left: -14, bottom: 2 }}
              onClick={(st) => {
                if (st && typeof st.activeTooltipIndex === 'number') {
                  const clicked = trendChartData[st.activeTooltipIndex];
                  if (clicked) {
                    onSelectDateIso(clicked.dateIso);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="dayLabelShort"
                stroke="#94a3b8"
                tick={{ fontSize: 9.5, fontFamily: 'monospace' }}
                interval={2}
              />
              <YAxis
                yAxisId="left"
                stroke="#94a3b8"
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#38bdf8"
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  borderColor: '#334155',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
                formatter={(value: unknown, name: unknown) => [
                  `${Number(value ?? 0).toFixed(2)}`,
                  String(name ?? ''),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
              <ReferenceLine
                yAxisId="left"
                y={1.0}
                stroke="#f43f5e"
                strokeDasharray="4 4"
              />
              <Bar
                yAxisId="left"
                dataKey="peakSumQuotient"
                name="Døgnets Spids-Sumkvotient (S_max)"
                fill="#f43f5e"
                fillOpacity={0.65}
                barSize={10}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="movingAvg7dS"
                name="7-Dages Glidende Gennemsnit (Langsigtet Trend)"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={false}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeSumDose24h"
                name="24t Kumulativ Dosis (ΣS·t)"
                fill="#22d3ee"
                fillOpacity={0.14}
                stroke="#22d3ee"
                strokeWidth={1.6}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}
    </div>
  );
};
