import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Compass,
  Crosshair,
  Navigation,
  Wind,
} from 'lucide-react';
import { HourlyWeatherPoint } from '../types/dispersion';
import { degreesToCompass } from '../services/weatherService';

export interface InteractiveWindRoseChartProps {
  hours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
  onSelectHour: (hourIndex: number) => void;
  compact?: boolean;
}

type RoseOrientationMode = 'dispersion_to' | 'wind_from';

interface SectorMetadata {
  index: number;
  code: string;
  fullName: string;
  centerDeg: number;
  downwindZoneDescription: string;
}

const COMPASS_SECTORS_8: SectorMetadata[] = [
  {
    index: 0,
    code: 'N',
    fullName: 'Nord',
    centerDeg: 0,
    downwindZoneDescription: 'Kierulffsvej 2–12, Børnehave & Nordlige Boligblokke',
  },
  {
    index: 1,
    code: 'NØ',
    fullName: 'Nordøst',
    centerDeg: 45,
    downwindZoneDescription: 'Kierulffsvej Nordøst, Daginstitution & Bazar-område',
  },
  {
    index: 2,
    code: 'Ø',
    fullName: 'Øst',
    centerDeg: 90,
    downwindZoneDescription: 'Østlige Boligblokke & Kierulffsvej Færdselsareal',
  },
  {
    index: 3,
    code: 'SØ',
    fullName: 'Sydøst',
    centerDeg: 135,
    downwindZoneDescription: 'Sydøstlige Naboblokke & Grønne Fællesarealer',
  },
  {
    index: 4,
    code: 'S',
    fullName: 'Syd',
    centerDeg: 180,
    downwindZoneDescription: 'Rødtjørnevej 2 (C962+VV Slagelse) & Sydlige Naboboliger',
  },
  {
    index: 5,
    code: 'SV',
    fullName: 'Sydvest',
    centerDeg: 225,
    downwindZoneDescription: 'Rødtjørnevej / Valbyvej Boligkvarter',
  },
  {
    index: 6,
    code: 'V',
    fullName: 'Vest',
    centerDeg: 270,
    downwindZoneDescription: 'Vestlige Nabomatrikler & Rekreative Stier',
  },
  {
    index: 7,
    code: 'NV',
    fullName: 'Nordvest',
    centerDeg: 315,
    downwindZoneDescription: 'Nordvestlige Boligblokke (Afdeling 23)',
  },
];

interface Sector16Metadata {
  index: number;
  code: string;
  fullName: string;
  centerDeg: number;
  degreeRangeLabel: string;
  downwindReceptorHint: string;
}

const COMPASS_SECTORS_16: Sector16Metadata[] = [
  {
    index: 0,
    code: 'N',
    fullName: 'Nord',
    centerDeg: 0.0,
    degreeRangeLabel: '348.75° – 11.25°',
    downwindReceptorHint: 'Kierulffsvej 2–12, Børnehave & Nordskolen',
  },
  {
    index: 1,
    code: 'NNØ',
    fullName: 'Nord-nordøst',
    centerDeg: 22.5,
    degreeRangeLabel: '11.25° – 33.75°',
    downwindReceptorHint: 'Kierulffsvej Nordøst & Ndr. Ringgade (Lidl)',
  },
  {
    index: 2,
    code: 'NØ',
    fullName: 'Nordøst',
    centerDeg: 45.0,
    degreeRangeLabel: '33.75° – 56.25°',
    downwindReceptorHint: 'Bazar-område & Ndr. Ringgade 65 (NETTO)',
  },
  {
    index: 3,
    code: 'ØNØ',
    fullName: 'Øst-nordøst',
    centerDeg: 67.5,
    degreeRangeLabel: '56.25° – 78.75°',
    downwindReceptorHint: 'Kierulffsvej 66 ($HOME) & Østlige Boligblokke',
  },
  {
    index: 4,
    code: 'Ø',
    fullName: 'Øst',
    centerDeg: 90.0,
    degreeRangeLabel: '78.75° – 101.25°',
    downwindReceptorHint: 'Østlige Boligblokke & Kierulffsvej Færdselsareal',
  },
  {
    index: 5,
    code: 'ØSØ',
    fullName: 'Øst-sydøst',
    centerDeg: 112.5,
    degreeRangeLabel: '101.25° – 123.75°',
    downwindReceptorHint: 'Sydøstlige Altaner & Grønne Fællesarealer',
  },
  {
    index: 6,
    code: 'SØ',
    fullName: 'Sydøst',
    centerDeg: 135.0,
    degreeRangeLabel: '123.75° – 146.25°',
    downwindReceptorHint: 'Slagelse Station, Vestsjællandscentret & Rådhus',
  },
  {
    index: 7,
    code: 'SSØ',
    fullName: 'Syd-sydøst',
    centerDeg: 157.5,
    degreeRangeLabel: '146.25° – 168.75°',
    downwindReceptorHint: 'Sydlige Etageblokke & Indfaldsveje mod Centrum',
  },
  {
    index: 8,
    code: 'S',
    fullName: 'Syd',
    centerDeg: 180.0,
    degreeRangeLabel: '168.75° – 191.25°',
    downwindReceptorHint: 'Rødtjørnevej 2 (C962+VV) & Sydlige Naboboliger',
  },
  {
    index: 9,
    code: 'SSV',
    fullName: 'Syd-sydvest',
    centerDeg: 202.5,
    degreeRangeLabel: '191.25° – 213.75°',
    downwindReceptorHint: 'Rødtjørnevej / Valbyvej Boligkvarter',
  },
  {
    index: 10,
    code: 'SV',
    fullName: 'Sydvest',
    centerDeg: 225.0,
    degreeRangeLabel: '213.75° – 236.25°',
    downwindReceptorHint: 'COOP365 (Valbyvej 65B) & Sydvestlige Rækkehuse',
  },
  {
    index: 11,
    code: 'VSV',
    fullName: 'Vest-sydvest',
    centerDeg: 247.5,
    degreeRangeLabel: '236.25° – 258.75°',
    downwindReceptorHint: 'Vest-sydvestlige Haver & Valbyvej-korridor',
  },
  {
    index: 12,
    code: 'V',
    fullName: 'Vest',
    centerDeg: 270.0,
    degreeRangeLabel: '258.75° – 281.25°',
    downwindReceptorHint: 'Vestlige Nabomatrikler & Rekreative Stier',
  },
  {
    index: 13,
    code: 'VNV',
    fullName: 'Vest-nordvest',
    centerDeg: 292.5,
    degreeRangeLabel: '281.25° – 303.75°',
    downwindReceptorHint: 'Schackenborgvænget Vest & Afd. 23',
  },
  {
    index: 14,
    code: 'NV',
    fullName: 'Nordvest',
    centerDeg: 315.0,
    degreeRangeLabel: '303.75° – 326.25°',
    downwindReceptorHint: 'Nordvestlige Boligblokke (Afdeling 23)',
  },
  {
    index: 15,
    code: 'NNV',
    fullName: 'Nord-nordvest',
    centerDeg: 337.5,
    degreeRangeLabel: '326.25° – 348.75°',
    downwindReceptorHint: 'Kierulffsvej Nordvest & Nordlige Grønne Kiler',
  },
];

interface Sector16DetailedStats {
  sector: Sector16Metadata;
  hoursInActiveMode: HourlyWeatherPoint[];
  activeCount: number;
  activeExactPct: number;
  windFromCount: number;
  windFromExactPct: number;
  dispersionToCount: number;
  dispersionToExactPct: number;
  tierLowCount: number;
  tierModerateCount: number;
  tierStrongCount: number;
  tierHighRiskCount: number;
  meanWindSpeed: number;
  maxWindSpeed: number;
  maxGustSpeed: number;
  peakHour: HourlyWeatherPoint | null;
}

interface SectorStats {
  sector: SectorMetadata;
  hoursInSector: HourlyWeatherPoint[];
  totalCount: number;
  percentageOf24h: number;
  tierLowCount: number; // < 4 m/s
  tierModerateCount: number; // 4 - 7 m/s
  tierStrongCount: number; // 7 - 10 m/s
  tierHighRiskCount: number; // > 10 m/s
  meanWindSpeed: number;
  maxWindSpeed: number;
  maxGustSpeed: number;
  peakHour: HourlyWeatherPoint | null;
}

/**
 * Helper to create an SVG annular sector (donut wedge) path in polar coordinates
 * where 0 deg = North (up) and angles increase clockwise.
 */
function createPolarWedgePath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const startRad = toRad(startAngleDeg);
  const endRad = toRad(endAngleDeg);

  const x1Outer = cx + outerRadius * Math.cos(startRad);
  const y1Outer = cy + outerRadius * Math.sin(startRad);
  const x2Outer = cx + outerRadius * Math.cos(endRad);
  const y2Outer = cy + outerRadius * Math.sin(endRad);

  if (innerRadius <= 0.5) {
    return [
      `M ${cx.toFixed(2)} ${cy.toFixed(2)}`,
      `L ${x1Outer.toFixed(2)} ${y1Outer.toFixed(2)}`,
      `A ${outerRadius.toFixed(2)} ${outerRadius.toFixed(2)} 0 0 1 ${x2Outer.toFixed(2)} ${y2Outer.toFixed(2)}`,
      'Z',
    ].join(' ');
  }

  const x1Inner = cx + innerRadius * Math.cos(endRad);
  const y1Inner = cy + innerRadius * Math.sin(endRad);
  const x2Inner = cx + innerRadius * Math.cos(startRad);
  const y2Inner = cy + innerRadius * Math.sin(startRad);

  return [
    `M ${x1Outer.toFixed(2)} ${y1Outer.toFixed(2)}`,
    `A ${outerRadius.toFixed(2)} ${outerRadius.toFixed(2)} 0 0 1 ${x2Outer.toFixed(2)} ${y2Outer.toFixed(2)}`,
    `L ${x1Inner.toFixed(2)} ${y1Inner.toFixed(2)}`,
    `A ${innerRadius.toFixed(2)} ${innerRadius.toFixed(2)} 0 0 0 ${x2Inner.toFixed(2)} ${y2Inner.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function getSectorIndex8(deg: number): number {
  const normalized = ((deg % 360) + 360) % 360;
  return Math.floor(((normalized + 22.5) % 360) / 45);
}

function getSectorIndex16(deg: number): number {
  const normalized = ((deg % 360) + 360) % 360;
  return Math.floor(((normalized + 11.25) % 360) / 22.5);
}

export const InteractiveWindRoseChart: React.FC<InteractiveWindRoseChartProps> = ({
  hours,
  currentWeather,
  dateIso,
  onSelectHour,
  compact = false,
}) => {
  // Default to showing prevailing dispersion direction (where the plume blows TOWARDS)
  const [orientationMode, setOrientationMode] = useState<RoseOrientationMode>('dispersion_to');
  const [selectedSectorIdx, setSelectedSectorIdx] = useState<number | null>(null);
  const [hoveredSectorIdx, setHoveredSectorIdx] = useState<number | null>(null);
  const [showDetailed16CompassTable, setShowDetailed16CompassTable] = useState<boolean>(false);

  const totalHoursCount = Math.max(1, hours.length);

  // Compute 16-sector detailed frequency table for all 16 compass directions
  const detailed16SectorStats = useMemo<Sector16DetailedStats[]>(() => {
    const activeBuckets: HourlyWeatherPoint[][] = Array.from({ length: 16 }, () => []);
    const windFromBuckets: HourlyWeatherPoint[][] = Array.from({ length: 16 }, () => []);
    const dispersionToBuckets: HourlyWeatherPoint[][] = Array.from({ length: 16 }, () => []);

    for (const h of hours) {
      const fromDeg = ((h.windDirection10m % 360) + 360) % 360;
      const toDeg = (fromDeg + 180) % 360;
      const activeDeg = orientationMode === 'dispersion_to' ? toDeg : fromDeg;

      windFromBuckets[getSectorIndex16(fromDeg)].push(h);
      dispersionToBuckets[getSectorIndex16(toDeg)].push(h);
      activeBuckets[getSectorIndex16(activeDeg)].push(h);
    }

    return COMPASS_SECTORS_16.map((sector, idx) => {
      const list = activeBuckets[idx];
      const count = list.length;
      const fromCount = windFromBuckets[idx].length;
      const toCount = dispersionToBuckets[idx].length;

      const tierLow = list.filter((h) => h.windSpeed10m < 4).length;
      const tierMod = list.filter((h) => h.windSpeed10m >= 4 && h.windSpeed10m < 7).length;
      const tierStrong = list.filter((h) => h.windSpeed10m >= 7 && h.windSpeed10m <= 10).length;
      const tierHighRisk = list.filter((h) => h.windSpeed10m > 10).length;

      const meanWind =
        count > 0
          ? Number((list.reduce((acc, h) => acc + h.windSpeed10m, 0) / count).toFixed(1))
          : 0;
      const maxWind =
        count > 0 ? Number(Math.max(...list.map((h) => h.windSpeed10m)).toFixed(1)) : 0;
      const maxGust =
        count > 0 ? Number(Math.max(...list.map((h) => h.windGusts10m)).toFixed(1)) : 0;

      const peakHour =
        count > 0
          ? list.reduce((best, cur) => (cur.windSpeed10m > best.windSpeed10m ? cur : best), list[0])
          : null;

      return {
        sector,
        hoursInActiveMode: list,
        activeCount: count,
        activeExactPct: Number(((count / totalHoursCount) * 100).toFixed(1)),
        windFromCount: fromCount,
        windFromExactPct: Number(((fromCount / totalHoursCount) * 100).toFixed(1)),
        dispersionToCount: toCount,
        dispersionToExactPct: Number(((toCount / totalHoursCount) * 100).toFixed(1)),
        tierLowCount: tierLow,
        tierModerateCount: tierMod,
        tierStrongCount: tierStrong,
        tierHighRiskCount: tierHighRisk,
        meanWindSpeed: meanWind,
        maxWindSpeed: maxWind,
        maxGustSpeed: maxGust,
        peakHour,
      };
    });
  }, [hours, orientationMode, totalHoursCount]);

  // Compute 8-sector distribution for the 24 hours
  const {
    sectorStats,
    dominantSector,
    maxSectorHours,
    vectorMeanAngleDeg,
    highRiskHoursTotal,
  } = useMemo(() => {
    const buckets: HourlyWeatherPoint[][] = Array.from({ length: 8 }, () => []);
    let sumSin = 0;
    let sumCos = 0;
    let highRiskTotal = 0;

    for (const h of hours) {
      const targetDeg =
        orientationMode === 'dispersion_to'
          ? (h.windDirection10m + 180) % 360
          : h.windDirection10m;
      const idx = getSectorIndex8(targetDeg);
      buckets[idx].push(h);

      const rad = (targetDeg * Math.PI) / 180;
      const weight = Math.max(0.5, h.windSpeed10m);
      sumSin += Math.sin(rad) * weight;
      sumCos += Math.cos(rad) * weight;

      if (h.windSpeed10m > 10) {
        highRiskTotal += 1;
      }
    }

    const stats: SectorStats[] = COMPASS_SECTORS_8.map((sector, idx) => {
      const list = buckets[idx];
      const count = list.length;
      const tierLow = list.filter((h) => h.windSpeed10m < 4).length;
      const tierMod = list.filter((h) => h.windSpeed10m >= 4 && h.windSpeed10m < 7).length;
      const tierStrong = list.filter((h) => h.windSpeed10m >= 7 && h.windSpeed10m <= 10).length;
      const tierHighRisk = list.filter((h) => h.windSpeed10m > 10).length;

      const meanWind =
        count > 0
          ? Number((list.reduce((acc, h) => acc + h.windSpeed10m, 0) / count).toFixed(1))
          : 0;
      const maxWind =
        count > 0 ? Number(Math.max(...list.map((h) => h.windSpeed10m)).toFixed(1)) : 0;
      const maxGust =
        count > 0 ? Number(Math.max(...list.map((h) => h.windGusts10m)).toFixed(1)) : 0;

      const peakHour =
        count > 0
          ? list.reduce((best, cur) => (cur.windSpeed10m > best.windSpeed10m ? cur : best), list[0])
          : null;

      return {
        sector,
        hoursInSector: list,
        totalCount: count,
        percentageOf24h: Math.round((count / totalHoursCount) * 100),
        tierLowCount: tierLow,
        tierModerateCount: tierMod,
        tierStrongCount: tierStrong,
        tierHighRiskCount: tierHighRisk,
        meanWindSpeed: meanWind,
        maxWindSpeed: maxWind,
        maxGustSpeed: maxGust,
        peakHour,
      };
    });

    const dom = stats.reduce(
      (best, cur) =>
        cur.totalCount > best.totalCount ||
        (cur.totalCount === best.totalCount && cur.maxWindSpeed > best.maxWindSpeed)
          ? cur
          : best,
      stats[0]
    );

    const maxHrs = Math.max(4, ...stats.map((s) => s.totalCount));
    const meanRad = Math.atan2(sumSin, sumCos);
    const meanDeg = Math.round((((meanRad * 180) / Math.PI) + 360) % 360);

    return {
      sectorStats: stats,
      dominantSector: dom,
      maxSectorHours: maxHrs,
      vectorMeanAngleDeg: meanDeg,
      highRiskHoursTotal: highRiskTotal,
    };
  }, [hours, orientationMode, totalHoursCount]);

  // Currently active hour's angle in the chosen mode
  const activeHourAngleDeg =
    orientationMode === 'dispersion_to'
      ? (currentWeather.windDirection10m + 180) % 360
      : currentWeather.windDirection10m;
  const activeHourSectorIdx = getSectorIndex8(activeHourAngleDeg);
  const activeHourSector16Idx = getSectorIndex16(activeHourAngleDeg);

  // Determine which sector is currently inspected in the details panel
  const inspectedSectorIdx =
    hoveredSectorIdx !== null
      ? hoveredSectorIdx
      : selectedSectorIdx !== null
      ? selectedSectorIdx
      : dominantSector.sector.index;

  const inspectedStats = sectorStats[inspectedSectorIdx] || dominantSector;

  // Polar SVG geometry
  const svgSize = compact ? 236 : 268;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxRadius = compact ? 84 : 96;
  const innerHubRadius = 11;
  const usableRadius = maxRadius - innerHubRadius;
  const wedgeHalfSpanDeg = 18.5; // 37 deg total wedge width per 45 deg sector for crisp separation

  const toCartesian = (angleDeg: number, radius: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const activeNeedleTip = toCartesian(activeHourAngleDeg, maxRadius + 6);
  const meanVectorTip = toCartesian(vectorMeanAngleDeg, maxRadius - 4);

  return (
    <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-md space-y-3">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>INTERAKTIV 24-TIMERS VIND-ROSE ({dateIso})</span>
          </div>
          <h4 className="text-xs font-bold text-white mt-0.5">
            {orientationMode === 'dispersion_to'
              ? 'Fremherskende Spredningsretninger (Fane driver MOD)'
              : 'Meteorologisk Vindfordeling (Vind blæser FRA)'}
          </h4>
        </div>

        {/* Controls: Toggle between Plume TO / Wind FROM + 'Detaljeret' 16-compass table button */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setOrientationMode('dispersion_to')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                orientationMode === 'dispersion_to'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vis hvilke kompasretninger støv- og asbestfanen spredes MOD over 24 timer"
            >
              <Navigation className="w-3 h-3" />
              <span>Spredningsretning (MOD)</span>
            </button>
            <button
              type="button"
              onClick={() => setOrientationMode('wind_from')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                orientationMode === 'wind_from'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vis meteorologisk vindretning (hvor vinden kommer FRA) over 24 timer"
            >
              <Wind className="w-3 h-3" />
              <span>Vindretning (FRA)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDetailed16CompassTable((prev) => !prev)}
            className={`px-2.5 py-1 rounded border text-[10px] font-mono font-bold transition-colors flex items-center gap-1 cursor-pointer ${
              showDetailed16CompassTable
                ? 'bg-indigo-500 text-white border-indigo-300 shadow-xs'
                : 'bg-slate-950 hover:bg-slate-800 text-indigo-300 border-indigo-500/50'
            }`}
            title="Vis eller skjul detaljeret tabel med den præcise frekvens af vindretninger opdelt i alle 16 kompasretninger (N, NNØ, NØ, ØNØ, Ø, ØSØ, SØ, SSØ, S, SSV, SV, VSV, V, VNV, NV, NNV)"
          >
            <Compass className="w-3 h-3 shrink-0" />
            <span>{showDetailed16CompassTable ? 'Detaljeret (16-Kompas) ▲' : 'Detaljeret'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Polar Wind-Rose SVG (Left) + Prevailing Direction & Interactive Sector Inspector (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* LEFT: Interactive Polar Wind-Rose Diagram */}
        <div className="md:col-span-6 flex flex-col items-center justify-center bg-slate-950/90 border border-slate-800/90 rounded p-2 relative">
          <svg
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className="w-full max-w-[268px] h-auto select-none overflow-visible"
            role="img"
            aria-label="Interaktiv 24-timers vind-rose og sprednings-rose"
          >
            {/* Concentric Frequency Rings (25%, 50%, 75%, 100% of max sector hours) */}
            {[0.25, 0.5, 0.75, 1.0].map((fraction) => {
              const r = innerHubRadius + usableRadius * fraction;
              const ringHours = Math.round(maxSectorHours * fraction);
              const ringPct = Math.round((ringHours / totalHoursCount) * 100);
              return (
                <g key={fraction}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={fraction === 1.0 ? '#334155' : '#1e293b'}
                    strokeWidth={fraction === 1.0 ? '1.2' : '0.9'}
                    strokeDasharray={fraction === 1.0 ? undefined : '2 2'}
                  />
                  {fraction === 0.5 || fraction === 1.0 ? (
                    <text
                      x={cx + 3}
                      y={cy - r + 8}
                      fill="#64748b"
                      fontSize="7.5"
                      fontFamily="monospace"
                    >
                      {ringHours}t ({ringPct}%)
                    </text>
                  ) : null}
                </g>
              );
            })}

            {/* 8 Compass Spokes & Cardinal Labels */}
            {COMPASS_SECTORS_8.map((sec) => {
              const outerPt = toCartesian(sec.centerDeg, maxRadius);
              const labelPt = toCartesian(sec.centerDeg, maxRadius + 18);
              const isDominant = sec.index === dominantSector.sector.index;
              const isInspected = sec.index === inspectedSectorIdx;
              const isActiveHrSector = sec.index === activeHourSectorIdx;

              return (
                <g key={sec.code}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={outerPt.x}
                    y2={outerPt.y}
                    stroke={isInspected ? '#22d3ee' : '#1e293b'}
                    strokeWidth={isInspected ? '1.3' : '0.9'}
                  />
                  <g
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedSectorIdx(sec.index);
                      const target = sectorStats[sec.index];
                      if (target?.peakHour) {
                        onSelectHour(target.peakHour.hourIndex);
                      }
                    }}
                    onMouseEnter={() => setHoveredSectorIdx(sec.index)}
                    onMouseLeave={() => setHoveredSectorIdx(null)}
                  >
                    <circle
                      cx={labelPt.x}
                      cy={labelPt.y}
                      r={11.5}
                      fill={
                        isInspected
                          ? '#083344'
                          : isDominant
                          ? '#451a03'
                          : isActiveHrSector
                          ? '#1e293b'
                          : '#090d16'
                      }
                      stroke={
                        isInspected
                          ? '#22d3ee'
                          : isDominant
                          ? '#fbbf24'
                          : isActiveHrSector
                          ? '#94a3b8'
                          : '#1e293b'
                      }
                      strokeWidth={isInspected || isDominant ? '1.4' : '1'}
                    />
                    <text
                      x={labelPt.x}
                      y={labelPt.y + 3}
                      textAnchor="middle"
                      fill={
                        isInspected
                          ? '#67e8f9'
                          : isDominant
                          ? '#fde68a'
                          : '#cbd5e1'
                      }
                      fontSize="8.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {sec.code}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Stacked Wind-Rose Petals for Each of the 8 Compass Sectors */}
            {sectorStats.map((st) => {
              const { sector, totalCount } = st;
              const startAngle = sector.centerDeg - wedgeHalfSpanDeg;
              const endAngle = sector.centerDeg + wedgeHalfSpanDeg;
              const isInspected = sector.index === inspectedSectorIdx;

              // Invisible hit-target wedge so even empty or small sectors can be hovered/clicked
              const hitWedgePath = createPolarWedgePath(
                cx,
                cy,
                innerHubRadius,
                maxRadius,
                sector.centerDeg - 22,
                sector.centerDeg + 22
              );

              if (totalCount === 0) {
                return (
                  <path
                    key={sector.code}
                    d={hitWedgePath}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredSectorIdx(sector.index)}
                    onMouseLeave={() => setHoveredSectorIdx(null)}
                    onClick={() => setSelectedSectorIdx(sector.index)}
                  />
                );
              }

              // Build stacked radial segments from innerHubRadius outwards
              const tiers = [
                { count: st.tierLowCount, color: '#22d3ee', label: '<4 m/s' },
                { count: st.tierModerateCount, color: '#10b981', label: '4–7 m/s' },
                { count: st.tierStrongCount, color: '#f59e0b', label: '7–10 m/s' },
                { count: st.tierHighRiskCount, color: '#e11d48', label: '>10 m/s' },
              ];

              let cumulativeHours = 0;

              return (
                <g
                  key={sector.code}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoveredSectorIdx(sector.index)}
                  onMouseLeave={() => setHoveredSectorIdx(null)}
                  onClick={() => {
                    setSelectedSectorIdx(sector.index);
                    if (st.peakHour) {
                      onSelectHour(st.peakHour.hourIndex);
                    }
                  }}
                >
                  {tiers.map((tier, tIdx) => {
                    if (tier.count <= 0) return null;
                    const rInner =
                      innerHubRadius + (cumulativeHours / maxSectorHours) * usableRadius;
                    cumulativeHours += tier.count;
                    const rOuter =
                      innerHubRadius + (cumulativeHours / maxSectorHours) * usableRadius;

                    const pathD = createPolarWedgePath(
                      cx,
                      cy,
                      rInner,
                      rOuter,
                      startAngle,
                      endAngle
                    );

                    return (
                      <path
                        key={`${sector.code}-tier-${tIdx}`}
                        d={pathD}
                        fill={tier.color}
                        fillOpacity={isInspected ? 0.95 : 0.78}
                        stroke={isInspected ? '#ffffff' : '#090d16'}
                        strokeWidth={isInspected ? '1.2' : '0.8'}
                      >
                        <title>
                          {`${sector.code} (${sector.fullName}): ${st.totalCount} timer (${st.percentageOf24h}%) · Interval ${tier.label}: ${tier.count} t · Klik for at inspicere spids-time`}
                        </title>
                      </path>
                    );
                  })}

                  {/* Outer highlight outline when sector is selected/hovered */}
                  {isInspected && (
                    <path
                      d={createPolarWedgePath(
                        cx,
                        cy,
                        innerHubRadius,
                        innerHubRadius + (totalCount / maxSectorHours) * usableRadius,
                        startAngle,
                        endAngle
                      )}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      pointerEvents="none"
                    />
                  )}

                  {/* Full sector hit target */}
                  <path d={hitWedgePath} fill="transparent" />
                </g>
              );
            })}

            {/* 24h Vector-Mean Prevailing Direction Dashed Vector */}
            <g pointerEvents="none">
              <line
                x1={cx}
                y1={cy}
                x2={meanVectorTip.x}
                y2={meanVectorTip.y}
                stroke="#fbbf24"
                strokeWidth="1.8"
                strokeDasharray="3 2"
              />
              <circle
                cx={meanVectorTip.x}
                cy={meanVectorTip.y}
                r="3.2"
                fill="#fbbf24"
                stroke="#090d16"
                strokeWidth="1"
              />
            </g>

            {/* Active Selected Hour Needle (Current Time-Slider Hour) */}
            <g pointerEvents="none">
              <line
                x1={cx}
                y1={cy}
                x2={activeNeedleTip.x}
                y2={activeNeedleTip.y}
                stroke={currentWeather.windSpeed10m > 10 ? '#f43f5e' : '#38bdf8'}
                strokeWidth="2.2"
              />
              <circle
                cx={activeNeedleTip.x}
                cy={activeNeedleTip.y}
                r="4"
                fill={currentWeather.windSpeed10m > 10 ? '#e11d48' : '#22d3ee'}
                stroke="#ffffff"
                strokeWidth="1.3"
              />
            </g>

            {/* Center Hub showing Current Hour Speed */}
            <circle
              cx={cx}
              cy={cy}
              r={innerHubRadius}
              fill="#090d16"
              stroke="#334155"
              strokeWidth="1.4"
            />
            <text
              x={cx}
              y={cy + 3}
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="7.5"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {currentWeather.windSpeed10m.toFixed(0)}m/s
            </text>
          </svg>

          {/* Wind Speed Tier Legend */}
          <div className="w-full pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[9px] font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-cyan-400 inline-block" />
              <span>&lt;4 m/s</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
              <span>4–7 m/s</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" />
              <span>7–10 m/s</span>
            </span>
            <span className="flex items-center gap-1 text-rose-300 font-bold">
              <span className="w-2 h-2 rounded-xs bg-rose-600 inline-block animate-pulse" />
              <span>&gt;10 m/s (Højrisiko)</span>
            </span>
          </div>

          {/* Pointer Legend */}
          <div className="w-full pt-1 flex items-center justify-between text-[9px] font-mono text-slate-400 px-1">
            <span className="flex items-center gap-1 text-cyan-300">
              <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
              <span>
                Nu (kl. {currentWeather.hourLabel}: {activeHourAngleDeg}°{' '}
                {degreesToCompass(activeHourAngleDeg)})
              </span>
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
              <span>
                24t Vektor ({vectorMeanAngleDeg}° {degreesToCompass(vectorMeanAngleDeg)})
              </span>
            </span>
          </div>
        </div>

        {/* RIGHT: 24h Prevailing Summary & Interactive Sector Inspector */}
        <div className="md:col-span-6 flex flex-col justify-between space-y-2.5">
          {/* Dominant 24h Direction Callout Box */}
          <div className="p-2.5 bg-amber-950/25 border border-amber-500/50 rounded space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-amber-400 font-bold uppercase">
                ★ FREMHERSKENDE 24T{' '}
                {orientationMode === 'dispersion_to' ? 'SPREDNINGSRETNING' : 'VINDRETNING'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 font-bold">
                {dominantSector.totalCount} af {totalHoursCount} timer (
                {dominantSector.percentageOf24h}%)
              </span>
            </div>
            <div className="text-xs font-bold text-white flex items-center justify-between">
              <span>
                {orientationMode === 'dispersion_to'
                  ? `Fane mod ${dominantSector.sector.code} (${dominantSector.sector.fullName} · ${dominantSector.sector.centerDeg}°)`
                  : `Vind fra ${dominantSector.sector.code} (${dominantSector.sector.fullName} · ${dominantSector.sector.centerDeg}°)`}
              </span>
              <span className="font-mono text-amber-300 text-[11px]">
                Maks {dominantSector.maxWindSpeed} m/s
              </span>
            </div>
            <div className="text-[11px] text-slate-300 leading-snug">
              Primær nedstrøms eksponeringszone:{' '}
              <strong className="text-cyan-200">
                {dominantSector.sector.downwindZoneDescription}
              </strong>
            </div>
            {highRiskHoursTotal > 0 && (
              <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono text-rose-300 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                <span>
                  {highRiskHoursTotal} timer med højrisiko-vind (&gt; 10 m/s) registreret det
                  seneste døgn
                </span>
              </div>
            )}
          </div>

          {/* 8-Sector Quick Selector Pills */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Vælg kompas-sektor for at inspicere klokkeslæt:</span>
              {selectedSectorIdx !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedSectorIdx(null)}
                  className="text-cyan-400 hover:underline"
                >
                  Nulstil til fremherskende
                </button>
              )}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {sectorStats.map((st) => {
                const isInspected = st.sector.index === inspectedSectorIdx;
                const isDom = st.sector.index === dominantSector.sector.index;
                return (
                  <button
                    key={st.sector.code}
                    type="button"
                    onClick={() => {
                      setSelectedSectorIdx(st.sector.index);
                      if (st.peakHour) {
                        onSelectHour(st.peakHour.hourIndex);
                      }
                    }}
                    onMouseEnter={() => setHoveredSectorIdx(st.sector.index)}
                    onMouseLeave={() => setHoveredSectorIdx(null)}
                    className={`py-1 px-1 rounded font-mono text-[10px] flex flex-col items-center border transition-all ${
                      isInspected
                        ? 'bg-cyan-500/25 border-cyan-400 text-white font-bold shadow-xs'
                        : isDom
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold'
                        : st.totalCount > 0
                        ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-900 text-slate-600'
                    }`}
                  >
                    <span>{st.sector.code}</span>
                    <span className="text-[9px] opacity-85">{st.totalCount}t</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Inspector for Selected/Hovered Compass Sector */}
          <div className="p-2.5 bg-slate-950/95 border border-slate-800 rounded space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold text-white font-mono">
                  Sektor {inspectedStats.sector.code} ({inspectedStats.sector.fullName} ·{' '}
                  {inspectedStats.sector.centerDeg}°)
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold text-cyan-300">
                {inspectedStats.totalCount} timer ({inspectedStats.percentageOf24h}%)
              </span>
            </div>

            {inspectedStats.totalCount === 0 ? (
              <div className="text-[11px] font-mono text-slate-400 py-2 text-center">
                Ingen timer i de seneste 24 timer havde{' '}
                {orientationMode === 'dispersion_to' ? 'spredningsretning mod' : 'vind fra'}{' '}
                {inspectedStats.sector.fullName} ({inspectedStats.sector.code}).
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                  <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                    <div className="text-slate-400">Gns. Vind</div>
                    <div className="text-xs font-bold text-cyan-300">
                      {inspectedStats.meanWindSpeed} m/s
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                    <div className="text-slate-400">Maks Vind</div>
                    <div
                      className={`text-xs font-bold ${
                        inspectedStats.maxWindSpeed > 10 ? 'text-rose-400' : 'text-white'
                      }`}
                    >
                      {inspectedStats.maxWindSpeed} m/s
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                    <div className="text-slate-400">Maks Stød</div>
                    <div className="text-xs font-bold text-amber-300">
                      {inspectedStats.maxGustSpeed} m/s
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 font-mono">
                  <span className="text-slate-400">Berørt Ringparken-zone: </span>
                  <span className="text-slate-100">
                    {inspectedStats.sector.downwindZoneDescription}
                  </span>
                </div>

                {/* Clickable Hour Badges in this Sector to Jump Time-Slider */}
                <div className="space-y-1 pt-0.5">
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>Klik på et klokkeslæt i sektoren for at synkronisere kortet:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {inspectedStats.hoursInSector.map((hr) => {
                      const isCurrent = hr.hourIndex === currentWeather.hourIndex;
                      const isHighRisk = hr.windSpeed10m > 10;
                      return (
                        <button
                          key={hr.hourIndex}
                          type="button"
                          onClick={() => onSelectHour(hr.hourIndex)}
                          className={`px-2 py-0.5 rounded font-mono text-[10px] transition-colors flex items-center gap-1 border ${
                            isCurrent
                              ? 'bg-cyan-400 text-slate-950 border-white font-bold'
                              : isHighRisk
                              ? 'bg-rose-950/80 text-rose-200 border-rose-500/60 hover:bg-rose-900'
                              : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-cyan-400'
                          }`}
                          title={`Hop til kl. ${hr.hourLabel} (${hr.windSpeed10m} m/s, vind fra ${hr.windDirection10m}°)`}
                        >
                          <span>kl. {hr.hourLabel}</span>
                          <span className="opacity-80">({hr.windSpeed10m}m/s)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible 16-Compass-Direction Detailed Frequency Table */}
      {showDetailed16CompassTable && (
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-950/30 border border-indigo-500/40 rounded px-3 py-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 font-bold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  DETALJERET 24T FREKVENS-TABEL · OPDELT I ALLE 16 KOMPASRETNINGER (22,5° SEKTORER)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Præcis time- og procentfrekvens for både{' '}
                <strong className="text-amber-300">Meteorologisk Vindretning (FRA)</strong> og{' '}
                <strong className="text-cyan-300">Spredningsretning (MOD)</strong> over døgnet ({dateIso}).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDetailed16CompassTable(false)}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 cursor-pointer"
            >
              Skjul tabel ▲
            </button>
          </div>

          <div className="rounded border border-slate-800 bg-slate-950 overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-[10px]">
              <thead>
                <tr className="bg-slate-900/95 text-slate-300 border-b border-slate-800">
                  <th className="py-2 px-2">Kompas (16)</th>
                  <th className="py-2 px-2">Vinkel-Interval</th>
                  <th className="py-2 px-2">
                    Vind FRA (Frekvens)
                  </th>
                  <th className="py-2 px-2">
                    Spredning MOD (Frekvens)
                  </th>
                  <th className="py-2 px-2">
                    Aktiv Frekvens ({orientationMode === 'dispersion_to' ? 'MOD' : 'FRA'})
                  </th>
                  <th className="py-2 px-2">Gns / Maks Vind</th>
                  <th className="py-2 px-2">Hastigheds-Trin (t)</th>
                  <th className="py-2 px-2">Klokkeslæt &amp; Nedstrøms Receptorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {detailed16SectorStats.map((row) => {
                  const isCurrent16 = row.sector.index === activeHourSector16Idx;
                  const hasActiveHours = row.activeCount > 0;
                  return (
                    <tr
                      key={row.sector.code}
                      className={`transition-colors ${
                        isCurrent16
                          ? 'bg-cyan-950/35'
                          : hasActiveHours
                          ? 'hover:bg-slate-900/70'
                          : 'opacity-60 hover:opacity-90'
                      }`}
                    >
                      {/* Compass Code & Full Danish Name */}
                      <td className="py-1.5 px-2 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] border ${
                              isCurrent16
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                                : hasActiveHours
                                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            {row.sector.code}
                          </span>
                          <span className="text-slate-200 font-semibold">{row.sector.fullName}</span>
                        </div>
                      </td>

                      {/* Center Degree & 22.5° Interval */}
                      <td className="py-1.5 px-2 align-top whitespace-nowrap text-slate-400">
                        <div className="text-slate-200 font-bold">{row.sector.centerDeg.toFixed(1)}°</div>
                        <div className="text-[9px] text-slate-500">{row.sector.degreeRangeLabel}</div>
                      </td>

                      {/* Meteorological Wind Origin (FRA) Frequency */}
                      <td className="py-1.5 px-2 align-top whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            row.windFromCount > 0 ? 'text-amber-300' : 'text-slate-500'
                          }`}
                        >
                          {row.windFromCount} t
                        </span>{' '}
                        <span className="text-slate-400">
                          ({row.windFromExactPct.toFixed(1)}%)
                        </span>
                      </td>

                      {/* Plume Dispersion (MOD) Frequency */}
                      <td className="py-1.5 px-2 align-top whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            row.dispersionToCount > 0 ? 'text-cyan-300' : 'text-slate-500'
                          }`}
                        >
                          {row.dispersionToCount} t
                        </span>{' '}
                        <span className="text-slate-400">
                          ({row.dispersionToExactPct.toFixed(1)}%)
                        </span>
                      </td>

                      {/* Visual Frequency Bar for Active Mode */}
                      <td className="py-1.5 px-2 align-top min-w-[130px]">
                        <div className="flex items-center justify-between text-[9px] mb-0.5">
                          <span className="font-bold text-white">
                            {row.activeCount} af {totalHoursCount} timer
                          </span>
                          <span className="font-bold text-indigo-300">
                            {row.activeExactPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all ${
                              row.tierHighRiskCount > 0
                                ? 'bg-rose-500'
                                : orientationMode === 'dispersion_to'
                                ? 'bg-cyan-400'
                                : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min(100, row.activeExactPct)}%` }}
                          />
                        </div>
                      </td>

                      {/* Mean & Max Wind Speed */}
                      <td className="py-1.5 px-2 align-top whitespace-nowrap">
                        {row.activeCount > 0 ? (
                          <div>
                            <span className="text-cyan-200 font-bold">{row.meanWindSpeed}</span>
                            <span className="text-slate-500"> / </span>
                            <span
                              className={`font-bold ${
                                row.maxWindSpeed > 10 ? 'text-rose-400' : 'text-amber-300'
                              }`}
                            >
                              {row.maxWindSpeed} m/s
                            </span>
                            <div className="text-[8px] text-slate-500">
                              Stød: {row.maxGustSpeed} m/s
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Wind Speed Tier Breakdown */}
                      <td className="py-1.5 px-2 align-top whitespace-nowrap">
                        {row.activeCount > 0 ? (
                          <div className="flex items-center gap-1 text-[9px]">
                            {row.tierLowCount > 0 && (
                              <span
                                className="px-1 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                                title="< 4 m/s"
                              >
                                &lt;4m/s: {row.tierLowCount}t
                              </span>
                            )}
                            {row.tierModerateCount > 0 && (
                              <span
                                className="px-1 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                                title="4–7 m/s"
                              >
                                4-7: {row.tierModerateCount}t
                              </span>
                            )}
                            {row.tierStrongCount > 0 && (
                              <span
                                className="px-1 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40"
                                title="7–10 m/s"
                              >
                                7-10: {row.tierStrongCount}t
                              </span>
                            )}
                            {row.tierHighRiskCount > 0 && (
                              <span
                                className="px-1 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/60 font-bold"
                                title="> 10 m/s (Højrisiko)"
                              >
                                &gt;10: {row.tierHighRiskCount}t
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">0 t</span>
                        )}
                      </td>

                      {/* Clickable Hour Chips & Downwind Receptor Hint */}
                      <td className="py-1.5 px-2 align-top">
                        <div className="text-[9px] text-slate-400 mb-1">
                          {row.sector.downwindReceptorHint}
                        </div>
                        {row.hoursInActiveMode.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {row.hoursInActiveMode.map((hr) => {
                              const isCurrentHr = hr.hourIndex === currentWeather.hourIndex;
                              return (
                                <button
                                  key={hr.hourIndex}
                                  type="button"
                                  onClick={() => onSelectHour(hr.hourIndex)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] border cursor-pointer transition-colors ${
                                    isCurrentHr
                                      ? 'bg-cyan-400 text-slate-950 border-white font-bold'
                                      : hr.windSpeed10m > 10
                                      ? 'bg-rose-950/90 text-rose-200 border-rose-500/50 hover:bg-rose-900'
                                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-cyan-400'
                                  }`}
                                  title={`Hop til kl. ${hr.hourLabel} (${hr.windSpeed10m} m/s · vind fra ${hr.windDirection10m}°)`}
                                >
                                  {hr.hourLabel}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
