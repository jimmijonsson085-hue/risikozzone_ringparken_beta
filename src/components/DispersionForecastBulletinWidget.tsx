import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  CloudRain,
  Compass,
  Copy,
  Crosshair,
  Download,
  FileDown,
  FileText,
  Home,
  Layers,
  Megaphone,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Table2,
  Thermometer,
  TrendingUp,
  Wind,
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
  ReceptorZone,
  RingparkenBuildingUnit,
  WeatherDataset,
} from '../types/dispersion';
import {
  BUILDING_CATEGORY_METADATA,
  RINGPARKEN_MASTER_BUILDINGS,
  getReceptorIdForBuilding,
} from '../data/ringparkenData';
import {
  Next7DayForecastDay,
  buildCalibratedNext7DaysForecast,
  degreesToCompass,
  fetchNext7DaysForecastForSlagelse,
  formatDanishShortDate,
  getDanishWeekdayName,
} from '../services/weatherService';
import { runDispersionSimulation } from '../services/dispersionEngine';

export type DispersionForecastOptionMode =
  | 'next_day_00_00_59'
  | 'five_day_forecast'
  | 'weather_broadcast_segment';

type FiveDayChartSubView =
  | 'accumulated_trend_5d'
  | 'accumulated_trend_120h'
  | 'daily_5d'
  | 'continuous_120h'
  | 'selected_day_24h';

type ResidentReportStyleMode =
  | 'resident_notice'
  | 'tv_weather_segment'
  | 'board_authority_brief';

interface DispersionForecastBulletinWidgetProps {
  baseDateIso: string;
  simulatedDateIso?: string;
  simulatedHourIndex?: number;
  todayIso: string;
  currentWeather: HourlyWeatherPoint;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  selectedReceptorId: string | null;
  mode: DispersionForecastOptionMode;
  focusTrigger?: number;
  onChangeMode: (mode: DispersionForecastOptionMode) => void;
  onSelectDateAndHour: (
    dateIso: string,
    hourIndex: number,
    customDataset?: WeatherDataset
  ) => void;
  onSelectReceptor: (receptorId: string) => void;
  onAddForecastToEvidence: (
    observationTitle: string,
    observationDetails: string,
    targetDateIso: string,
    targetHourIndex: number
  ) => void;
  onClose?: () => void;
  buildings?: RingparkenBuildingUnit[];
}

export const DispersionForecastBulletinWidget: React.FC<
  DispersionForecastBulletinWidgetProps
> = ({
  baseDateIso,
  simulatedDateIso,
  simulatedHourIndex,
  currentWeather,
  sources,
  receptors,
  selectedReceptorId,
  mode,
  focusTrigger = 0,
  onChangeMode,
  onSelectDateAndHour,
  onSelectReceptor,
  onAddForecastToEvidence,
  onClose,
  buildings = RINGPARKEN_MASTER_BUILDINGS,
}) => {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const nextDayFocusPanelRef = useRef<HTMLDivElement | null>(null);
  const fiveDayFocusPanelRef = useRef<HTMLDivElement | null>(null);
  const broadcastFocusPanelRef = useRef<HTMLDivElement | null>(null);

  const [forecastDays, setForecastDays] = useState<Next7DayForecastDay[]>(() =>
    buildCalibratedNext7DaysForecast(baseDateIso)
  );
  const [isLoadingForecast, setIsLoadingForecast] = useState<boolean>(false);
  const [selectedFiveDayOffset, setSelectedFiveDayOffset] = useState<number>(1);
  const [fiveDayChartSubView, setFiveDayChartSubView] =
    useState<FiveDayChartSubView>('accumulated_trend_5d');
  const [showCrossIntervalComparison, setShowCrossIntervalComparison] =
    useState<boolean>(true);
  const [residentReportStyle, setResidentReportStyle] =
    useState<ResidentReportStyleMode>('resident_notice');
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState<number>(0);
  const [selectedMinuteInHour, setSelectedMinuteInHour] = useState<number>(0);
  const [isFocusPulseActive, setIsFocusPulseActive] = useState<boolean>(false);
  const [copiedBroadcastText, setCopiedBroadcastText] = useState<boolean>(false);
  const [downloadedTxtSuccess, setDownloadedTxtSuccess] = useState<boolean>(false);
  const [loggedEvidenceSuccess, setLoggedEvidenceSuccess] = useState<boolean>(false);
  const [exported5dCsvSuccess, setExported5dCsvSuccess] = useState<boolean>(false);
  const [exportedPdfSuccess, setExportedPdfSuccess] = useState<boolean>(false);

  // Wissenberg PSS pkt. 7 ID 3.3 & 3.4: 5-day advance noise/dust notification status for d_under_demolition -> c_under_renovation
  const [pss5DayNotifiedByDayOffset, setPss5DayNotifiedByDayOffset] = useState<
    Record<number, boolean>
  >({
    1: false,
    2: false,
    3: false,
    4: true,
    5: true,
  });

  // Identify which of the inhabited blocks (a_inhabited, 15 blocks) and renovation blocks (c_under_renovation, 7 blocks)
  // are hit by the dust plume in a given hour based on plume direction and source positions
  const identifyPlumeHitBlocksForHour = useMemo(() => {
    const inhabitedUnits = buildings.filter((b) => b.category === 'a_inhabited');
    const renovationUnits = buildings.filter((b) => b.category === 'c_under_renovation');
    const activeSourceUnits = buildings.filter(
      (b) =>
        b.category === 'd_under_demolition' ||
        b.category === 'e_demolished_unsecured' ||
        b.category === 'c_under_renovation'
    );

    return (
      plumeDirectionDeg: number,
      receptorExposures?: Array<{ receptorId: string; sumQuotient: number }>
    ) => {
      const expMap = new Map(
        (receptorExposures || []).map((r) => [r.receptorId, r.sumQuotient])
      );

      const isUnitHitByPlume = (target: RingparkenBuildingUnit): boolean => {
        const recId = getReceptorIdForBuilding(target.id);
        const expS = expMap.get(recId);
        if (expS !== undefined && expS >= 0.22) {
          return true;
        }
        return activeSourceUnits.some((src) => {
          if (src.id === target.id) return false;
          const dLat = (target.center.lat - src.center.lat) * 111320;
          const dLng =
            (target.center.lng - src.center.lng) *
            111320 *
            Math.cos((src.center.lat * Math.PI) / 180);
          const dist = Math.hypot(dLat, dLng);
          if (dist > 420) return false;
          const bearingDeg = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
          const angleDiff = Math.abs(
            ((bearingDeg - plumeDirectionDeg + 540) % 360) - 180
          );
          return angleDiff <= 38;
        });
      };

      const hitInhabited = inhabitedUnits.filter(isUnitHitByPlume);
      const hitRenovation = renovationUnits.filter(isUnitHitByPlume);

      return {
        totalInhabitedCount: inhabitedUnits.length,
        totalRenovationCount: renovationUnits.length,
        hitInhabitedCodes: hitInhabited.map((b) => b.code),
        hitRenovationCodes: hitRenovation.map((b) => b.code),
        hitInhabitedUnits: hitInhabited,
        hitRenovationUnits: hitRenovation,
      };
    };
  }, [buildings]);

  // Smooth sliding transition state when switching between the 3 forecast modes
  const prevModeRef = useRef<DispersionForecastOptionMode>(mode);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [isModeTransitioning, setIsModeTransitioning] = useState<boolean>(false);

  const modeOrderIndex = (m: DispersionForecastOptionMode): number => {
    if (m === 'next_day_00_00_59') return 0;
    if (m === 'five_day_forecast') return 1;
    return 2;
  };

  useEffect(() => {
    if (prevModeRef.current !== mode) {
      const prevIdx = modeOrderIndex(prevModeRef.current);
      const nextIdx = modeOrderIndex(mode);
      setSlideDirection(nextIdx >= prevIdx ? 'right' : 'left');
      setIsModeTransitioning(true);
      prevModeRef.current = mode;
      const t = window.setTimeout(() => {
        setIsModeTransitioning(false);
      }, 45);
      return () => window.clearTimeout(t);
    }
  }, [mode]);

  // Refresh 7-day forecast when baseDateIso changes (we slice first 5 days for the 5-day forecast and Day +1 for Døgnet efter)
  useEffect(() => {
    let cancelled = false;
    setForecastDays(buildCalibratedNext7DaysForecast(baseDateIso));
    setIsLoadingForecast(true);
    fetchNext7DaysForecastForSlagelse(baseDateIso)
      .then((days) => {
        if (!cancelled && days.length > 0) {
          setForecastDays(days);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingForecast(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [baseDateIso]);

  // First 5 days for the 5-day forecast ("Fem døgns prognose")
  const fiveDaysForecast = useMemo(() => {
    return forecastDays.slice(0, 5);
  }, [forecastDays]);

  // Day +1 ("Døgnet efter")
  const nextDayForecast = useMemo(() => {
    return (
      fiveDaysForecast[0] || buildCalibratedNext7DaysForecast(baseDateIso)[0]
    );
  }, [fiveDaysForecast, baseDateIso]);

  // Current hour simulation snapshot for cross-interval risk comparison
  const currentActiveSimSummary = useMemo(() => {
    const simNow = runDispersionSimulation(
      baseDateIso,
      currentWeather.hourIndex,
      [currentWeather],
      sources,
      receptors
    );
    const sorted = [...simNow.receptorExposures].sort(
      (a, b) => b.sumQuotient - a.sumQuotient
    );
    const topRec = sorted[0];
    const asb =
      topRec?.substances.find((s) => s.key === 'asbestos')?.quotient || 0;
    return {
      maxS: Number((topRec?.sumQuotient || 0).toFixed(2)),
      asbestosQuotient: Number(asb.toFixed(2)),
      worstReceptorCode: topRec?.receptorCode || 'R1',
      worstReceptorName: topRec?.receptorName || 'Rødtjørnevej 2',
      windSpeedMs: currentWeather.windSpeed10m,
      plumeDirDeg: (currentWeather.windDirection10m + 180) % 360,
    };
  }, [baseDateIso, currentWeather, sources, receptors]);

  // Detailed evaluation for Option 1: "Døgnet efter fra klokken 00.00.00 - 00.59.59"
  const nextDayMidnightAnalysis = useMemo(() => {
    const hrs = nextDayForecast.dataset.hours;
    const hr00 = hrs[0] || currentWeather;
    const hr01 = hrs[1] || hr00;

    // Run full Gaussian plume dispersion simulation for hourIndex = 0 (00.00.00 - 00.59.59)
    const sim00 = runDispersionSimulation(
      nextDayForecast.dateIso,
      0,
      hrs,
      sources,
      receptors
    );

    const sortedReceptors00 = [...sim00.receptorExposures].sort(
      (a, b) => b.sumQuotient - a.sumQuotient
    );
    const worstRec00 = sortedReceptors00[0];
    const maxS00 = worstRec00 ? worstRec00.sumQuotient : 0;
    const asbQuotient00 =
      worstRec00?.substances.find((s) => s.key === 'asbestos')?.quotient || 0;
    const plumeDir00 = (hr00.windDirection10m + 180) % 360;

    // Build 4 sub-hour 15-minute intervals covering 00.00.00 - 00.59.59
    const subHourWindows = [
      {
        quarterIndex: 0,
        windowLabel: '00.00.00 – 00.14.59',
        startMinute: 0,
        endMinute: 14,
        phaseTitle: 'Døgnskifte & Grænselags-Inversion',
        fraction: 0.125,
      },
      {
        quarterIndex: 1,
        windowLabel: '00.15.00 – 00.29.59',
        startMinute: 15,
        endMinute: 29,
        phaseTitle: 'Natlig Laminar Fane-Koncentration',
        fraction: 0.375,
      },
      {
        quarterIndex: 2,
        windowLabel: '00.30.00 – 00.44.59',
        startMinute: 30,
        endMinute: 44,
        phaseTitle: 'Passiv Resuspension fra Nedrivningsfelt',
        fraction: 0.625,
      },
      {
        quarterIndex: 3,
        windowLabel: '00.45.00 – 00.59.59',
        startMinute: 45,
        endMinute: 59,
        phaseTitle: 'Akkumuleret Midnats-Eksponering (Time 00)',
        fraction: 0.875,
      },
    ].map((slot, idx) => {
      const wSpeed = Number(
        (
          hr00.windSpeed10m +
          (hr01.windSpeed10m - hr00.windSpeed10m) * slot.fraction
        ).toFixed(1)
      );
      const wGust = Number(
        (
          hr00.windGusts10m +
          (hr01.windGusts10m - hr00.windGusts10m) * slot.fraction
        ).toFixed(1)
      );
      const rawDiff =
        ((hr01.windDirection10m - hr00.windDirection10m + 540) % 360) - 180;
      const wDir = Math.round(
        (hr00.windDirection10m + rawDiff * slot.fraction + 360) % 360
      );
      const pDir = (wDir + 180) % 360;
      const tempC = Number(
        (
          hr00.temperature2m +
          (hr01.temperature2m - hr00.temperature2m) * slot.fraction
        ).toFixed(1)
      );
      const quarterFactor = 0.94 + idx * 0.04;
      const subSumQuotient = Number((maxS00 * quarterFactor).toFixed(2));
      const asbestosSub = worstRec00?.substances.find((s) => s.key === 'asbestos');
      const asbestosConc = Number(
        ((asbestosSub?.concentration || 0) * quarterFactor).toFixed(4)
      );

      return {
        ...slot,
        windSpeedMs: wSpeed,
        windGustsMs: wGust,
        windDirectionDeg: wDir,
        plumeDirectionDeg: pDir,
        plumeCompass: degreesToCompass(pDir),
        temperature2m: tempC,
        pasquillClass: hr00.pasquillClass,
        sumQuotient: subSumQuotient,
        asbestosConcentration: asbestosConc,
        worstReceptorCode: worstRec00?.receptorCode || 'R1',
        worstReceptorName: worstRec00?.receptorName || 'Rødtjørnevej 2',
      };
    });

    const nextDay24hSeries = hrs.map((hr) => {
      const simHr = runDispersionSimulation(
        nextDayForecast.dateIso,
        hr.hourIndex,
        hrs,
        sources,
        receptors
      );
      const topRec = [...simHr.receptorExposures].sort(
        (a, b) => b.sumQuotient - a.sumQuotient
      )[0];
      const pDir = (hr.windDirection10m + 180) % 360;
      const hitBlocks = identifyPlumeHitBlocksForHour(
        pDir,
        simHr.receptorExposures
      );
      return {
        hourIndex: hr.hourIndex,
        hourLabel:
          hr.hourIndex === 0
            ? '00.00.00-00.59.59'
            : `${String(hr.hourIndex).padStart(2, '0')}:00`,
        shortHour:
          hr.hourIndex === 0
            ? '00.00-00.59'
            : `${String(hr.hourIndex).padStart(2, '0')}:00`,
        windSpeedMs: hr.windSpeed10m,
        windGustsMs: hr.windGusts10m,
        windDirectionDeg: hr.windDirection10m,
        plumeDirectionDeg: pDir,
        precipitationMm: hr.precipitation,
        temperature2m: hr.temperature2m,
        pasquillClass: hr.pasquillClass,
        maxSumQuotient: Number((topRec?.sumQuotient || 0).toFixed(2)),
        worstReceptorCode: topRec?.receptorCode || 'R1',
        worstReceptorName: topRec?.receptorName || 'Rødtjørnevej',
        hitInhabitedCodes: hitBlocks.hitInhabitedCodes,
        hitRenovationCodes: hitBlocks.hitRenovationCodes,
        totalInhabitedCount: hitBlocks.totalInhabitedCount,
        totalRenovationCount: hitBlocks.totalRenovationCount,
      };
    });

    const peakHourEntry = [...nextDay24hSeries].sort(
      (a, b) => b.maxSumQuotient - a.maxSumQuotient
    )[0];

    return {
      dateIso: nextDayForecast.dateIso,
      weekdayDa: nextDayForecast.weekdayNameDa,
      shortDateDa: formatDanishShortDate(nextDayForecast.dateIso),
      hr00,
      hr01,
      sim00,
      sortedReceptors00,
      worstRec00,
      maxS00: Number(maxS00.toFixed(2)),
      asbQuotient00: Number(asbQuotient00.toFixed(2)),
      plumeDir00,
      plumeCompass00: degreesToCompass(plumeDir00),
      windCompass00: degreesToCompass(hr00.windDirection10m),
      subHourWindows,
      nextDay24hSeries,
      peakHourEntry,
    };
  }, [
    nextDayForecast,
    currentWeather,
    sources,
    receptors,
    identifyPlumeHitBlocksForHour,
  ]);

  // Exact minute-by-minute (00.MM.00 - 00.MM.59) interpolated state inside 00.00.00 - 00.59.59
  const focusedMinuteSnapshot = useMemo(() => {
    const frac = Math.max(0, Math.min(59, selectedMinuteInHour)) / 60;
    const { hr00, hr01, maxS00, worstRec00 } = nextDayMidnightAnalysis;
    const wSpeed = Number(
      (hr00.windSpeed10m + (hr01.windSpeed10m - hr00.windSpeed10m) * frac).toFixed(1)
    );
    const wGust = Number(
      (hr00.windGusts10m + (hr01.windGusts10m - hr00.windGusts10m) * frac).toFixed(1)
    );
    const rawDiff =
      ((hr01.windDirection10m - hr00.windDirection10m + 540) % 360) - 180;
    const wDir = Math.round((hr00.windDirection10m + rawDiff * frac + 360) % 360);
    const pDir = (wDir + 180) % 360;
    const factor = 0.94 + frac * 0.12;
    const sVal = Number((maxS00 * factor).toFixed(2));
    const asbBase =
      worstRec00?.substances.find((s) => s.key === 'asbestos')?.concentration || 0;
    const asbVal = Number((asbBase * factor).toFixed(4));
    const mm = String(selectedMinuteInHour).padStart(2, '0');
    return {
      timeRangeLabel: `00.${mm}.00 – 00.${mm}.59`,
      windSpeedMs: wSpeed,
      windGustsMs: wGust,
      windDirectionDeg: wDir,
      plumeDirectionDeg: pDir,
      plumeCompass: degreesToCompass(pDir),
      sumQuotient: sVal,
      asbestosConcentration: asbVal,
    };
  }, [selectedMinuteInHour, nextDayMidnightAnalysis]);

  // Detailed evaluation for Option 2: "Fem døgns prognose" (Days +1 to +5)
  const fiveDaysDetailed = useMemo(() => {
    return fiveDaysForecast.map((day, index) => {
      const dayOffset = index + 1;
      const hrs = day.dataset.hours;
      // Evaluate 00.00.00 - 00.59.59 on this day
      const sim00 = runDispersionSimulation(day.dateIso, 0, hrs, sources, receptors);
      const top00 = [...sim00.receptorExposures].sort(
        (a, b) => b.sumQuotient - a.sumQuotient
      )[0];
      const hr00 = hrs[0];

      // Per-receptor daily tracking
      const recDailyMap = new Map<
        string,
        {
          receptorId: string;
          receptorCode: string;
          receptorName: string;
          address: string;
          peakS: number;
          peakHourIndex: number;
          sumS: number;
          exceedHours: number;
          maxAsbestos: number;
        }
      >();
      receptors.forEach((r) => {
        recDailyMap.set(r.id, {
          receptorId: r.id,
          receptorCode: r.code,
          receptorName: r.name,
          address: r.address,
          peakS: 0,
          peakHourIndex: 12,
          sumS: 0,
          exceedHours: 0,
          maxAsbestos: 0,
        });
      });

      let peakS = 0;
      let sumDailyMaxS = 0;
      let peakHourIndex = 12;
      let peakReceptorId = receptors[0]?.id || 'rec-roedtjoornevej-2';
      let peakReceptorCode = 'R1';
      let peakReceptorName = 'Rødtjørnevej 2';
      let peakReceptorAddress = 'Rødtjørnevej 2, 4200 Slagelse';
      let peakAsbestosFibreCm3 = 0;
      let peakAsbestosQuotient = 0;
      let hoursExceedingLimit = 0;
      let hoursElevatedRisk = 0;
      let hoursHighWind = 0;

      const peakSubstanceQuotients: Record<string, number> = {
        asbestos: 0,
        pcb: 0,
        heavyMetals: 0,
        quartzWool: 0,
        moldSewer: 0,
      };

      const dailyHitInhabitedSet = new Set<string>();
      const dailyHitRenovationSet = new Set<string>();

      const hourlyEval = hrs.map((hr) => {
        const simHr = runDispersionSimulation(
          day.dateIso,
          hr.hourIndex,
          hrs,
          sources,
          receptors
        );

        simHr.receptorExposures.forEach((rexp) => {
          const entry = recDailyMap.get(rexp.receptorId);
          if (entry) {
            entry.sumS += rexp.sumQuotient;
            if (rexp.sumQuotient >= 1.0) entry.exceedHours += 1;
            const asbC =
              rexp.substances.find((s) => s.key === 'asbestos')?.concentration || 0;
            if (asbC > entry.maxAsbestos) entry.maxAsbestos = asbC;
            if (rexp.sumQuotient > entry.peakS) {
              entry.peakS = rexp.sumQuotient;
              entry.peakHourIndex = hr.hourIndex;
            }
          }
          rexp.substances.forEach((sub) => {
            if (sub.quotient > (peakSubstanceQuotients[sub.key] || 0)) {
              peakSubstanceQuotients[sub.key] = sub.quotient;
            }
          });
        });

        const topRec = [...simHr.receptorExposures].sort(
          (a, b) => b.sumQuotient - a.sumQuotient
        )[0];
        const selectedRecExp =
          simHr.receptorExposures.find((r) => r.receptorId === selectedReceptorId) ||
          topRec;
        const sVal = topRec?.sumQuotient || 0;
        const selectedRecSVal = selectedRecExp?.sumQuotient || 0;
        sumDailyMaxS += sVal;
        const asbSub = topRec?.substances.find((s) => s.key === 'asbestos');
        const asb = asbSub?.concentration || 0;
        const asbQuot = asbSub?.quotient || 0;
        if (sVal >= 1.0) hoursExceedingLimit += 1;
        else if (sVal >= 0.5) hoursElevatedRisk += 1;
        if (hr.windSpeed10m > 10) hoursHighWind += 1;
        if (sVal > peakS) {
          peakS = sVal;
          peakHourIndex = hr.hourIndex;
          peakReceptorId = topRec?.receptorId || peakReceptorId;
          peakReceptorCode = topRec?.receptorCode || 'R1';
          peakReceptorName = topRec?.receptorName || 'Rødtjørnevej 2';
          peakReceptorAddress = topRec?.address || 'Rødtjørnevej 2, 4200 Slagelse';
          peakAsbestosFibreCm3 = asb;
          peakAsbestosQuotient = asbQuot;
        }

        const pDir = (hr.windDirection10m + 180) % 360;
        const hitBlocks = identifyPlumeHitBlocksForHour(
          pDir,
          simHr.receptorExposures
        );
        hitBlocks.hitInhabitedCodes.forEach((c) => dailyHitInhabitedSet.add(c));
        hitBlocks.hitRenovationCodes.forEach((c) => dailyHitRenovationSet.add(c));

        return {
          dateIso: day.dateIso,
          dayOffset,
          dayShortLabel: `D+${dayOffset} ${hr.hourLabel}`,
          hourIndex: hr.hourIndex,
          hourLabel: hr.hourLabel,
          windSpeedMs: hr.windSpeed10m,
          windGustsMs: hr.windGusts10m,
          windDirectionDeg: hr.windDirection10m,
          plumeDirectionDeg: pDir,
          precipitationMm: hr.precipitation,
          temperature2m: hr.temperature2m,
          pasquillClass: hr.pasquillClass,
          sumQuotient: Number(sVal.toFixed(2)),
          selectedReceptorSumQuotient: Number(selectedRecSVal.toFixed(2)),
          asbestosFibreCm3: Number(asb.toFixed(4)),
          worstReceptorCode: topRec?.receptorCode || 'R1',
          worstReceptorName: topRec?.receptorName || 'Rødtjørnevej 2',
          hitInhabitedCodes: hitBlocks.hitInhabitedCodes,
          hitRenovationCodes: hitBlocks.hitRenovationCodes,
          totalInhabitedCount: hitBlocks.totalInhabitedCount,
          totalRenovationCount: hitBlocks.totalRenovationCount,
        };
      });

      const temps = hrs.map((h) => h.temperature2m);
      const minTempC = Number(Math.min(...temps).toFixed(1));
      const maxTempC = Number(Math.max(...temps).toFixed(1));
      const meanDailyS = Number((sumDailyMaxS / Math.max(1, hrs.length)).toFixed(2));
      const cumulativeDailyDoseS = Number(sumDailyMaxS.toFixed(2));

      const weatherSynopsis: 'STORM_DUST' | 'RAIN_WASHOUT' | 'INVERSION_STAGNATION' | 'MODERATE_BREEZE' =
        day.maxWindSpeedMs > 10 && day.totalPrecipitationMm < 2.5
          ? 'STORM_DUST'
          : day.totalPrecipitationMm >= 4.0
          ? 'RAIN_WASHOUT'
          : hrs.some((h) => h.pasquillClass === 'F' || h.pasquillClass === 'E') &&
            day.meanWindSpeedMs < 5.0
          ? 'INVERSION_STAGNATION'
          : 'MODERATE_BREEZE';

      const perReceptorDaily = Array.from(recDailyMap.values()).map((r) => ({
        ...r,
        peakS: Number(r.peakS.toFixed(2)),
        meanS: Number((r.sumS / 24).toFixed(2)),
        cumulativeS: Number(r.sumS.toFixed(2)),
        maxAsbestos: Number(r.maxAsbestos.toFixed(4)),
      }));

      return {
        ...day,
        dayOffset,
        weekdayDa: day.weekdayNameDa,
        weekdayShortDa: day.dayLabelShort,
        maxWindGustsMs: day.maxGustsMs,
        dominantPlumeDirDeg: day.dominantPlumeToDeg,
        dominantPlumeCompass: degreesToCompass(day.dominantPlumeToDeg),
        shortDateDa: formatDanishShortDate(day.dateIso),
        minTempC,
        maxTempC,
        midnight00_59: {
          windSpeedMs: hr00.windSpeed10m,
          windGustsMs: hr00.windGusts10m,
          windDirectionDeg: hr00.windDirection10m,
          plumeDirectionDeg: (hr00.windDirection10m + 180) % 360,
          plumeCompass: degreesToCompass((hr00.windDirection10m + 180) % 360),
          pasquillClass: hr00.pasquillClass,
          sumQuotient: Number((top00?.sumQuotient || 0).toFixed(2)),
          worstReceptorCode: top00?.receptorCode || 'R1',
          worstReceptorName: top00?.receptorName || 'Rødtjørnevej 2',
        },
        peakS: Number(peakS.toFixed(2)),
        meanDailyS,
        cumulativeDailyDoseS,
        peakHourIndex,
        peakHourLabel: `${String(peakHourIndex).padStart(2, '0')}:00`,
        peakReceptorId,
        peakReceptorCode,
        peakReceptorName,
        peakReceptorAddress,
        peakAsbestosFibreCm3: Number(peakAsbestosFibreCm3.toFixed(4)),
        peakAsbestosQuotient: Number(peakAsbestosQuotient.toFixed(2)),
        hoursExceedingLimit,
        hoursElevatedRisk,
        hoursHighWind,
        peakSubstanceQuotients,
        perReceptorDaily,
        weatherSynopsis,
        hourlyEval,
        dailyHitInhabitedCodes: Array.from(dailyHitInhabitedSet),
        dailyHitRenovationCodes: Array.from(dailyHitRenovationSet),
      };
    });
  }, [
    fiveDaysForecast,
    sources,
    receptors,
    selectedReceptorId,
    identifyPlumeHitBlocksForHour,
  ]);

  // 5-Day Aggregated Weather, Accumulated Sum Quotient Trend & Cross-Interval Comparison
  const fiveDaysAggregatedSummary = useMemo(() => {
    let runningSiteCumulativeS = 0;
    let runningSelectedRecCumulativeS = 0;

    const all120Hours = fiveDaysDetailed.flatMap((d, dIdx) =>
      d.hourlyEval.map((h, hIdx) => {
        const globalHourNumber = dIdx * 24 + hIdx + 1;
        runningSiteCumulativeS += h.sumQuotient;
        runningSelectedRecCumulativeS += h.selectedReceptorSumQuotient;
        // Linear trend baseline across 120 hours
        return {
          ...h,
          globalHourNumber,
          accumulatedSiteSumQuotient: Number(runningSiteCumulativeS.toFixed(2)),
          accumulatedSelectedRecSumQuotient: Number(
            runningSelectedRecCumulativeS.toFixed(2)
          ),
          dataset: d.dataset,
        };
      })
    );

    const totalHours = all120Hours.length || 120;
    const total120hCumulativeS =
      all120Hours[all120Hours.length - 1]?.accumulatedSiteSumQuotient || 0;
    const avgHourlyAccumulationRate = total120hCumulativeS / Math.max(1, totalHours);

    const all120HoursWithTrend = all120Hours.map((item) => ({
      ...item,
      linearTrendAccumulatedS: Number(
        (avgHourlyAccumulationRate * item.globalHourNumber).toFixed(2)
      ),
    }));

    const meanWindSpeed5d = Number(
      (
        all120Hours.reduce((acc, h) => acc + h.windSpeedMs, 0) /
        Math.max(1, totalHours)
      ).toFixed(1)
    );
    const maxWindSpeed5d = Number(
      Math.max(0, ...fiveDaysDetailed.map((d) => d.maxWindSpeedMs)).toFixed(1)
    );
    const maxWindGusts5d = Number(
      Math.max(0, ...fiveDaysDetailed.map((d) => d.maxWindGustsMs)).toFixed(1)
    );
    const totalPrecipitation5d = Number(
      fiveDaysDetailed
        .reduce((acc, d) => acc + d.totalPrecipitationMm, 0)
        .toFixed(1)
    );
    const minTemp5d = Number(
      Math.min(...fiveDaysDetailed.map((d) => d.minTempC)).toFixed(1)
    );
    const maxTemp5d = Number(
      Math.max(...fiveDaysDetailed.map((d) => d.maxTempC)).toFixed(1)
    );

    // Vector-averaged dominant wind & plume direction across all 120 hours
    let sinSum = 0;
    let cosSum = 0;
    all120Hours.forEach((h) => {
      const rad = (h.windDirectionDeg * Math.PI) / 180;
      const weight = Math.max(0.5, h.windSpeedMs);
      sinSum += Math.sin(rad) * weight;
      cosSum += Math.cos(rad) * weight;
    });
    const aggWindFromDeg = Math.round(
      (((Math.atan2(sinSum, cosSum) * 180) / Math.PI) + 360) % 360
    );
    const aggPlumeToDeg = (aggWindFromDeg + 180) % 360;
    const aggPlumeCompass = degreesToCompass(aggPlumeToDeg);

    // Sum quotient aggregations across 5 days (120 hours)
    const worstDayEntry = [...fiveDaysDetailed].sort((a, b) => b.peakS - a.peakS)[0];
    const peakS5d = worstDayEntry ? worstDayEntry.peakS : 0;
    const meanS5d = Number(
      (
        all120Hours.reduce((acc, h) => acc + h.sumQuotient, 0) /
        Math.max(1, totalHours)
      ).toFixed(2)
    );
    const cumulativeDoseS120h = Number(
      all120Hours.reduce((acc, h) => acc + h.sumQuotient, 0).toFixed(1)
    );
    const totalExceedanceHours5d = fiveDaysDetailed.reduce(
      (acc, d) => acc + d.hoursExceedingLimit,
      0
    );
    const totalElevatedRiskHours5d = fiveDaysDetailed.reduce(
      (acc, d) => acc + d.hoursElevatedRisk,
      0
    );
    const totalHighWindHours5d = fiveDaysDetailed.reduce(
      (acc, d) => acc + d.hoursHighWind,
      0
    );

    // Aggregate per-receptor 5-day exposure table (R1..R6 across Day +1..Day +5)
    const receptor5dMatrix = receptors.map((rec) => {
      const dailyValues = fiveDaysDetailed.map((day) => {
        const found = day.perReceptorDaily.find((r) => r.receptorId === rec.id);
        return {
          dayOffset: day.dayOffset,
          dateIso: day.dateIso,
          weekdayShortDa: day.weekdayShortDa,
          peakS: found ? found.peakS : 0,
          meanS: found ? found.meanS : 0,
          cumulativeS: found ? found.cumulativeS : 0,
          peakHourIndex: found ? found.peakHourIndex : 12,
          exceedHours: found ? found.exceedHours : 0,
          maxAsbestos: found ? found.maxAsbestos : 0,
          dataset: day.dataset,
        };
      });

      const recPeak5d = Number(
        Math.max(0, ...dailyValues.map((v) => v.peakS)).toFixed(2)
      );
      const bestDayForPeak = [...dailyValues].sort((a, b) => b.peakS - a.peakS)[0];
      const recMean5d = Number(
        (
          dailyValues.reduce((acc, v) => acc + v.meanS, 0) /
          Math.max(1, dailyValues.length)
        ).toFixed(2)
      );
      const recCumulative5d = Number(
        dailyValues.reduce((acc, v) => acc + v.cumulativeS, 0).toFixed(1)
      );
      const recExceedHours5d = dailyValues.reduce(
        (acc, v) => acc + v.exceedHours,
        0
      );
      const recMaxAsbestos5d = Number(
        Math.max(0, ...dailyValues.map((v) => v.maxAsbestos)).toFixed(4)
      );

      return {
        receptorId: rec.id,
        receptorCode: rec.code,
        receptorName: rec.name,
        address: rec.address,
        dailyValues,
        recPeak5d,
        peakDateIso: bestDayForPeak?.dateIso || baseDateIso,
        peakHourIndex: bestDayForPeak?.peakHourIndex ?? 12,
        peakDataset: bestDayForPeak?.dataset,
        recMean5d,
        recCumulative5d,
        recExceedHours5d,
        recMaxAsbestos5d,
      };
    });

    // Daily accumulated sum quotient trend series (Day +1 to Day +5) for Recharts
    let runningDailyAccumulatedS = 0;
    let runningSelectedRecDailyAccumS = 0;
    const dailyAccumulationSlope =
      fiveDaysDetailed.reduce((acc, d) => acc + d.cumulativeDailyDoseS, 0) /
      Math.max(1, fiveDaysDetailed.length);

    const dailyComparisonChartData = fiveDaysDetailed.map((d, idx) => {
      runningDailyAccumulatedS = Number(
        (runningDailyAccumulatedS + d.cumulativeDailyDoseS).toFixed(2)
      );
      const selRecDay = d.perReceptorDaily.find(
        (r) => r.receptorId === selectedReceptorId
      );
      const selRecDailyDose = selRecDay
        ? selRecDay.cumulativeS
        : d.cumulativeDailyDoseS * 0.82;
      runningSelectedRecDailyAccumS = Number(
        (runningSelectedRecDailyAccumS + selRecDailyDose).toFixed(2)
      );

      return {
        dayLabel: `Dag +${d.dayOffset} (${d.weekdayShortDa} ${d.shortDateDa})`,
        shortDayLabel: `Dag +${d.dayOffset} (${d.weekdayShortDa})`,
        dateIso: d.dateIso,
        dayOffset: d.dayOffset,
        peakHourIndex: d.peakHourIndex,
        peakS: d.peakS,
        meanDailyS: d.meanDailyS,
        midnightS: d.midnight00_59.sumQuotient,
        dailyDoseS: d.cumulativeDailyDoseS,
        accumulatedSumQuotient5d: runningDailyAccumulatedS,
        accumulatedSelectedReceptor5d: runningSelectedRecDailyAccumS,
        linearTrendAccumulated5d: Number(
          (dailyAccumulationSlope * (idx + 1)).toFixed(2)
        ),
        maxWindSpeedMs: d.maxWindSpeedMs,
        totalPrecipitationMm: d.totalPrecipitationMm,
      };
    });

    return {
      all120Hours: all120HoursWithTrend,
      meanWindSpeed5d,
      maxWindSpeed5d,
      maxWindGusts5d,
      totalPrecipitation5d,
      minTemp5d,
      maxTemp5d,
      aggWindFromDeg,
      aggPlumeToDeg,
      aggPlumeCompass,
      worstDayEntry,
      peakS5d,
      meanS5d,
      cumulativeDoseS120h,
      dailyAccumulationSlope: Number(dailyAccumulationSlope.toFixed(1)),
      totalExceedanceHours5d,
      totalElevatedRiskHours5d,
      totalHighWindHours5d,
      receptor5dMatrix,
      dailyComparisonChartData,
    };
  }, [fiveDaysDetailed, receptors, baseDateIso, selectedReceptorId]);

  // Cross-Interval Dispersion Risk Comparison Series (Element 2)
  const crossIntervalComparisonData = useMemo(() => {
    const nd = nextDayMidnightAnalysis;
    const items = [
      {
        intervalId: 'current_now',
        intervalLabel: `Aktuel (${currentWeather.hourLabel})`,
        categoryLabel: 'Aktuelt Tidspunkt',
        targetMode: 'next_day_00_00_59' as DispersionForecastOptionMode,
        dateIso: baseDateIso,
        hourIndex: currentWeather.hourIndex,
        dataset: undefined as WeatherDataset | undefined,
        sumQuotient: currentActiveSimSummary.maxS,
        asbestosQuotient: currentActiveSimSummary.asbestosQuotient,
        windSpeedMs: currentActiveSimSummary.windSpeedMs,
        worstReceptorCode: currentActiveSimSummary.worstReceptorCode,
      },
      {
        intervalId: 'next_day_00_00_59',
        intervalLabel: `Døgnet efter 00.00–00.59`,
        categoryLabel: '1. Døgnet efter 00.00.00-00.59.59',
        targetMode: 'next_day_00_00_59' as DispersionForecastOptionMode,
        dateIso: nd.dateIso,
        hourIndex: 0,
        dataset: nextDayForecast.dataset,
        sumQuotient: nd.maxS00,
        asbestosQuotient: nd.asbQuotient00,
        windSpeedMs: nd.hr00.windSpeed10m,
        worstReceptorCode: nd.worstRec00?.receptorCode || 'R1',
      },
      ...fiveDaysDetailed.map((d) => ({
        intervalId: `day_${d.dayOffset}`,
        intervalLabel: `Dag +${d.dayOffset} (${d.weekdayShortDa} kl. ${d.peakHourLabel})`,
        categoryLabel: '2. Fem døgns prognose',
        targetMode: 'five_day_forecast' as DispersionForecastOptionMode,
        dateIso: d.dateIso,
        hourIndex: d.peakHourIndex,
        dataset: d.dataset,
        sumQuotient: d.peakS,
        asbestosQuotient: d.peakAsbestosQuotient,
        windSpeedMs: d.maxWindSpeedMs,
        worstReceptorCode: d.peakReceptorCode,
      })),
      {
        intervalId: 'five_day_mean',
        intervalLabel: `5-Døgns Middel (120t)`,
        categoryLabel: '3. Vejrudsigt-Indlæg (5d Middel)',
        targetMode: 'weather_broadcast_segment' as DispersionForecastOptionMode,
        dateIso:
          fiveDaysAggregatedSummary.worstDayEntry?.dateIso || nd.dateIso,
        hourIndex:
          fiveDaysAggregatedSummary.worstDayEntry?.peakHourIndex || 12,
        dataset: fiveDaysAggregatedSummary.worstDayEntry?.dataset,
        sumQuotient: fiveDaysAggregatedSummary.meanS5d,
        asbestosQuotient: Number(
          (fiveDaysAggregatedSummary.meanS5d * 0.54).toFixed(2)
        ),
        windSpeedMs: fiveDaysAggregatedSummary.meanWindSpeed5d,
        worstReceptorCode:
          fiveDaysAggregatedSummary.worstDayEntry?.peakReceptorCode || 'R1',
      },
    ];
    return items;
  }, [
    baseDateIso,
    currentWeather.hourIndex,
    currentWeather.hourLabel,
    currentActiveSimSummary,
    nextDayMidnightAnalysis,
    nextDayForecast.dataset,
    fiveDaysDetailed,
    fiveDaysAggregatedSummary,
  ]);

  const selectedFiveDayEntry = useMemo(() => {
    return (
      fiveDaysDetailed.find((d) => d.dayOffset === selectedFiveDayOffset) ||
      fiveDaysDetailed[0]
    );
  }, [fiveDaysDetailed, selectedFiveDayOffset]);

  const selectedReceptorMeta = useMemo(() => {
    return (
      receptors.find((r) => r.id === selectedReceptorId) ||
      receptors[0]
    );
  }, [receptors, selectedReceptorId]);

  // Automatically focus and synchronize when mode changes
  useEffect(() => {
    setIsFocusPulseActive(true);
    const timer = window.setTimeout(() => setIsFocusPulseActive(false), 1800);

    if (mode === 'next_day_00_00_59') {
      if (nextDayFocusPanelRef.current) {
        nextDayFocusPanelRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
        nextDayFocusPanelRef.current.focus({ preventScroll: true });
      } else if (widgetContainerRef.current) {
        widgetContainerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }

      onSelectDateAndHour(
        nextDayMidnightAnalysis.dateIso,
        0,
        nextDayForecast.dataset
      );

      if (nextDayMidnightAnalysis.worstRec00?.receptorId) {
        onSelectReceptor(nextDayMidnightAnalysis.worstRec00.receptorId);
      }
    } else if (mode === 'five_day_forecast') {
      if (fiveDayFocusPanelRef.current) {
        fiveDayFocusPanelRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
        fiveDayFocusPanelRef.current.focus({ preventScroll: true });
      }
      const targetDay =
        fiveDaysAggregatedSummary.worstDayEntry || fiveDaysDetailed[0];
      if (targetDay) {
        onSelectDateAndHour(
          targetDay.dateIso,
          targetDay.peakHourIndex,
          targetDay.dataset
        );
        if (targetDay.peakReceptorId) {
          onSelectReceptor(targetDay.peakReceptorId);
        }
      }
    } else if (mode === 'weather_broadcast_segment') {
      if (broadcastFocusPanelRef.current) {
        broadcastFocusPanelRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
        broadcastFocusPanelRef.current.focus({ preventScroll: true });
      }
    }

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, focusTrigger, nextDayMidnightAnalysis.dateIso]);

  // Export 5-Day Aggregated Forecast & Sum Quotients to CSV
  const handleExport5DayForecastCsv = () => {
    const headers = [
      'Dag_Offset',
      'Dato',
      'Ugedag',
      'Middel_Vind_ms',
      'Maks_Vind_ms',
      'Maks_Vindstoed_ms',
      'Dominerende_Fane_Grader',
      'Dominerende_Fane_Kompas',
      'Min_Temp_C',
      'Maks_Temp_C',
      'Total_Nedboer_mm',
      'Midnat_00_00_00_59_S',
      'Doegn_Middel_S',
      'Doegn_Spids_S_max',
      'Doegn_Kumulativ_Dosis_S',
      'Spids_Klokkeslaet',
      'Mest_Udsatte_Receptor',
      'Maks_Asbest_fibre_cm3',
      'Timer_Over_S_1_0',
      'Timer_Vind_Over_10_ms',
    ];

    const rows = fiveDaysDetailed.map((d) =>
      [
        `+${d.dayOffset}`,
        d.dateIso,
        d.weekdayDa,
        d.meanWindSpeedMs,
        d.maxWindSpeedMs,
        d.maxWindGustsMs,
        d.dominantPlumeDirDeg,
        d.dominantPlumeCompass,
        d.minTempC,
        d.maxTempC,
        d.totalPrecipitationMm,
        d.midnight00_59.sumQuotient.toFixed(2),
        d.meanDailyS.toFixed(2),
        d.peakS.toFixed(2),
        d.cumulativeDailyDoseS.toFixed(2),
        d.peakHourLabel,
        `${d.peakReceptorCode}: ${d.peakReceptorName}`,
        d.peakAsbestosFibreCm3.toFixed(4),
        d.hoursExceedingLimit,
        d.hoursHighWind,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';')
    );

    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `ringparken-fem-doegns-spredningsprognose-fra-${baseDateIso}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExported5dCsvSuccess(true);
    window.setTimeout(() => setExported5dCsvSuccess(false), 3000);
  };

  // Option 3: Resident-Friendly Textual Report & Meteorological Weather Broadcast Segment ("Som indlæg i en Vejrudsigt")
  const broadcastManuscript = useMemo(() => {
    const nd = nextDayMidnightAnalysis;
    const worstDay = fiveDaysAggregatedSummary.worstDayEntry;
    const total5dExceedanceHours =
      fiveDaysAggregatedSummary.totalExceedanceHours5d;
    const highWindDaysCount = fiveDaysDetailed.filter(
      (d) => d.maxWindSpeedMs > 10
    ).length;

    if (residentReportStyle === 'resident_notice') {
      const lines = [
        `BEBOER-INFORMATION & 5-DØGNS VEJRUDSIGT FOR STØV- OG MILJØSPREDNING`,
        `Område: Ringparken (Afd. 23), Rødtjørnevej, Kierulffsvej & Schackenborgvænget, 4200 Slagelse`,
        `Prognose-udstedelse: ${getDanishWeekdayName(baseDateIso)} d. ${baseDateIso} (Gældende for ${fiveDaysDetailed[0]?.dateIso} til ${fiveDaysDetailed[fiveDaysDetailed.length - 1]?.dateIso})`,
        `================================================================================`,
        ``,
        `KORT OVERBLIK TIL BEBOERE I OMRÅDET:`,
        `I løbet af de kommende 5 døgn vil vind- og vejrforholdene i Slagelse styre, i hvilken retning støv og mikropartikler fra nedrivningsfeltet i Ringparken bevæger sig.`,
        `• Samlet 5-døgns vurdering: Der forventes i alt ${total5dExceedanceHours} timer med overskridelse af den sundhedsmæssige grænseværdi (Sumkvotient S ≥ 1,0) fordelt over de næste 5 dage, samt ${highWindDaysCount} døgn med kraftig vind over 10 m/s.`,
        `• Mest berørte boligområde i 5-døgns perioden: ${worstDay?.peakReceptorName} (${worstDay?.peakReceptorAddress}), hvor den højeste belastning forventes ${worstDay?.weekdayDa} d. ${worstDay?.dateIso} omkring kl. ${worstDay?.peakHourLabel} (beregnet Sumkvotient S = ${worstDay?.peakS.toFixed(2)}).`,
        ``,
        `NAT- OG MIDNATSVARSEL — DØGNET EFTER FRA KLOKKEN 00.00.00 - 00.59.59 (${nd.weekdayDa} d. ${nd.dateIso}):`,
        `Allerede ved midnatsskiftet ind i det kommende døgn (kl. 00.00.00 – 00.59.59) blæser vinden ${nd.hr00.windSpeed10m} m/s fra ${nd.windCompass00} (${nd.hr00.windDirection10m}°), hvilket fører støvfanen mod ${nd.plumeCompass00} (${nd.plumeDir00}°).`,
        `På grund af natlig atmosfærisk stabilitet (Pasquill-klasse ${nd.hr00.pasquillClass} ved ${nd.hr00.temperature2m} °C) fortætter luften sig nær terræn med en beregnet Sumkvotient på S = ${nd.maxS00.toFixed(2)} ved ${nd.worstRec00?.receptorName}. Beboere i vindretningen ${nd.plumeCompass00} anbefales at lukke soveværelsesvinduer før midnat.`,
        ``,
        `DAG-FOR-DAG VEJR- OG SPREDNINGSUDSIGT (5 DAGE FREM):`,
        ...fiveDaysDetailed.map((d) => {
          const advice =
            d.peakS >= 1.0
              ? `VIGTIGT RÅD: Hold vinduer, altandøre og friskluftventiler lukkede omkring kl. ${d.peakHourLabel}, og undgå udendørs tørring af vasketøj ved ${d.peakReceptorName}.`
              : d.totalPrecipitationMm >= 3.5
              ? `VEJR-EFFEKT: Regnvejr (${d.totalPrecipitationMm} mm) dæmper støv i luften, men vær opmærksom på mudder og overfladevand ved vej og fortov.`
              : `MODERAT FORHOLD: Almindelig udluftning kan ske uden for spidstimen kl. ${d.peakHourLabel}.`;
          return [
            `• Dag +${d.dayOffset} — ${d.weekdayDa} d. ${d.dateIso}:`,
            `  Vejr: Temperatur ${d.minTempC}–${d.maxTempC} °C, middelvind ${d.meanWindSpeedMs} m/s (vindstød op til ${d.maxWindGustsMs} m/s), nedbør ${d.totalPrecipitationMm} mm.`,
            `  Spredningsretning: Vinden sender fanen mod ${d.dominantPlumeCompass} (${d.dominantPlumeDirDeg}°), primært mod ${d.peakReceptorCode} (${d.peakReceptorName}).`,
            `  Belastningsgrad: Midnat (00.00–00.59): S = ${d.midnight00_59.sumQuotient.toFixed(2)} | Døgn-gennemsnit: S̄ = ${d.meanDailyS.toFixed(2)} | Døgn-spids kl. ${d.peakHourLabel}: S_max = ${d.peakS.toFixed(2)} (${d.hoursExceedingLimit} timer ≥ 1,0).`,
            `  Beboer-anbefaling: ${advice}`,
          ].join('\n');
        }),
        ``,
        `PRAKTISKE RÅD TIL HUSSTANDE, BØRNEFAMILIER & SÅRBARE BEBOERE:`,
        `1. Luk vinduer og friskluftventiler mod nedrivningspladsen i timer med vind over 10 m/s eller varslet Sumkvotient S ≥ 0,5.`,
        `2. Aftør vindueskarme og altanborde med en fugtig klud frem for tør fejning efter blæsende perioder.`,
        `3. Oplever du synlige støvskyer eller lugtgener, kan du registrere observationen direkte under 'AI Foto-Bevis & Algedonisk' i systemet.`,
      ];
      return lines.join('\n');
    }

    if (residentReportStyle === 'tv_weather_segment') {
      const lines = [
        `🎙️ VEJRUDSIGT-INDLÆG (SPEAKER-MANUSKRIPT): SPREDNINGSPROGNOSE FOR RINGPARKEN, SLAGELSE`,
        `Udsendelses-grundlag: Prognosedata fra ${baseDateIso} (${getDanishWeekdayName(baseDateIso)})`,
        `--------------------------------------------------------------------------------`,
        `"Go'aften. Her følger sær-indlægget i lokal-vejrudsigten med 5-døgns miljø- og spredningsprognose for naboerne omkring Ringparken i Slagelse.`,
        ``,
        `Ser vi først på døgnet efter — præcis i midnatstimen fra klokken 00.00.00 til 00.59.59 natten til ${nd.weekdayDa} d. ${nd.dateIso} — ligger vinden på ${nd.hr00.windSpeed10m} m/s fra ${nd.windCompass00}. Det sender spredningsfanen i retning ${nd.plumeDir00}° (${nd.plumeCompass00}) med en midnats-sumkvotient på S = ${nd.maxS00.toFixed(2)} ved ${nd.worstRec00?.receptorName}.`,
        ``,
        `Kigger vi frem over hele fem-døgns prognosen fra ${fiveDaysDetailed[0]?.weekdayDa} til ${fiveDaysDetailed[fiveDaysDetailed.length - 1]?.weekdayDa}, får vi en middelvind på ${fiveDaysAggregatedSummary.meanWindSpeed5d} m/s med kraftigste vindstød op til ${fiveDaysAggregatedSummary.maxWindGusts5d} m/s og en samlet nedbørsmængde på ${fiveDaysAggregatedSummary.totalPrecipitation5d} mm:`,
        ...fiveDaysDetailed.map(
          (d) =>
            `• ${d.weekdayDa} (${d.shortDateDa}): Vind op til ${d.maxWindSpeedMs} m/s sender fanen mod ${d.dominantPlumeCompass} (${d.dominantPlumeDirDeg}°). Døgnets spidsbelastning rammer kl. ${d.peakHourLabel} med S_max = ${d.peakS.toFixed(2)} ved ${d.peakReceptorName}.`
        ),
        ``,
        `Samlet set akkumuleres en 5-døgns sumkvotient-dosis på ΣS = ${fiveDaysAggregatedSummary.cumulativeDoseS120h} over de 120 timer med en stigningstakt på +${fiveDaysAggregatedSummary.dailyAccumulationSlope} pr. døgn. Beboere ved ${worstDay?.peakReceptorAddress} opfordres særligt ${worstDay?.weekdayDa} omkring kl. ${worstDay?.peakHourLabel} til at holde vinduer lukkede."`,
      ];
      return lines.join('\n');
    }

    const lines = [
      `📋 FORMEL AFDELINGSBESTYRELSES- & MYNDIGHEDS-BULLETIN (5-DØGNS PROGNOSE)`,
      `Vedr.: Præventiv 120-timers sprednings- og grænseværdivurdering (BEK nr. 613 / MBL)`,
      `Prognoseperiode: ${fiveDaysDetailed[0]?.dateIso} kl. 00.00.00 til ${fiveDaysDetailed[fiveDaysDetailed.length - 1]?.dateIso} kl. 23.59.59`,
      `--------------------------------------------------------------------------------`,
      `1. MIDNATS-GRÆNSELAGSANALYSE (Døgnet efter kl. 00.00.00 - 00.59.59 · ${nd.dateIso}):`,
      `Vind ${nd.hr00.windSpeed10m} m/s (stød ${nd.hr00.windGusts10m} m/s), fanevektor ${nd.plumeDir00}° (${nd.plumeCompass00}), Pasquill ${nd.hr00.pasquillClass}, S(00:00-00:59) = ${nd.maxS00.toFixed(2)} ved ${nd.worstRec00?.receptorCode} (${nd.worstRec00?.receptorName}).`,
      ``,
      `2. 5-DØGNS AGGREGERET SUMKVOTIENT-TENDENS (120 TIMER):`,
      `• 5-døgns maksimal sumkvotient: S_max = ${fiveDaysAggregatedSummary.peakS5d.toFixed(2)} (${worstDay?.dateIso} kl. ${worstDay?.peakHourLabel} ved ${worstDay?.peakReceptorCode}).`,
      `• 5-døgns middel sumkvotient: S̄ = ${fiveDaysAggregatedSummary.meanS5d.toFixed(2)} | Akkumuleret 120t dosis: ΣS = ${fiveDaysAggregatedSummary.cumulativeDoseS120h} (+${fiveDaysAggregatedSummary.dailyAccumulationSlope}/døgn).`,
      `• Overskridelsestimer (S ≥ 1,0): ${total5dExceedanceHours} timer | Højrisiko-vind (> 10 m/s): ${fiveDaysAggregatedSummary.totalHighWindHours5d} timer.`,
      ``,
      `3. DØGN-SPECIFIKATIONSOVERSIGT:`,
      ...fiveDaysDetailed.map(
        (d) =>
          `• Dag +${d.dayOffset} (${d.dateIso}): S(00:00-00:59)=${d.midnight00_59.sumQuotient.toFixed(2)}, S̄=${d.meanDailyS.toFixed(2)}, S_max=${d.peakS.toFixed(2)} (kl. ${d.peakHourLabel} mod ${d.peakReceptorCode}), ΣS_døgn=${d.cumulativeDailyDoseS.toFixed(1)}, Vind_max=${d.maxWindSpeedMs} m/s, Nedbør=${d.totalPrecipitationMm} mm.`
      ),
    ];
    return lines.join('\n');
  }, [
    baseDateIso,
    nextDayMidnightAnalysis,
    fiveDaysDetailed,
    fiveDaysAggregatedSummary,
    residentReportStyle,
  ]);

  const handleCopyBroadcastManuscript = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(broadcastManuscript).catch(() => {});
    }
    setCopiedBroadcastText(true);
    window.setTimeout(() => setCopiedBroadcastText(false), 3000);
  };

  const handleDownloadResidentReportTxt = () => {
    const blob = new Blob([broadcastManuscript], {
      type: 'text/plain;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `ringparken-vejrudsigt-indlaeg-beboer-rapport-${baseDateIso}.txt`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadedTxtSuccess(true);
    window.setTimeout(() => setDownloadedTxtSuccess(false), 3000);
  };

  const handleLogForecastAsEvidence = () => {
    const nd = nextDayMidnightAnalysis;
    const worstDay = fiveDaysAggregatedSummary.worstDayEntry;
    const title =
      mode === 'next_day_00_00_59'
        ? `Spredningsprognose: Døgnet efter (${nd.dateIso}) kl. 00.00.00 - 00.59.59 (S = ${nd.maxS00.toFixed(2)})`
        : mode === 'five_day_forecast'
        ? `Fem døgns spredningsprognose (${fiveDaysDetailed[0]?.dateIso} – ${fiveDaysDetailed[fiveDaysDetailed.length - 1]?.dateIso}): Aggregeret S_max = ${worstDay?.peakS.toFixed(2)} (ΣS = ${fiveDaysAggregatedSummary.cumulativeDoseS120h})`
        : `Vejrudsigt-Indlæg (Beboer-Rapport): 5-døgns spredningsprognose for Ringparken (${nd.dateIso} kl. 00.00.00-00.59.59 & 5 døgn)`;

    onAddForecastToEvidence(
      title,
      broadcastManuscript,
      mode === 'five_day_forecast' && worstDay ? worstDay.dateIso : nd.dateIso,
      mode === 'five_day_forecast' && worstDay ? worstDay.peakHourIndex : 0
    );
    setLoggedEvidenceSuccess(true);
    window.setTimeout(() => setLoggedEvidenceSuccess(false), 3500);
  };

  // Export the selected forecast report directly as PDF, including vector graphical comparisons & aggregated tables
  const handleExportForecastReportPdf = (
    targetModeOverride?: DispersionForecastOptionMode
  ) => {
    const activeReportMode = targetModeOverride || mode;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 14;

    const modeTitleDa =
      activeReportMode === 'next_day_00_00_59'
        ? '1. DØGNET EFTER FRA KL. 00.00.00 - 00.59.59 (MIDNATSVINDUE)'
        : activeReportMode === 'five_day_forecast'
        ? '2. FEM DØGNS PROGNOSE (120 TIMERS AGGREGERING & SUMKVOTIENT-TABEL)'
        : '3. VEJRUDSIGT-INDLÆG (BEBOER-VENLIG 5-DØGNS SPREDNINGSRAPPORT)';

    // Header Banner
    doc.setFillColor(10, 18, 36);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setDrawColor(34, 211, 238);
    doc.setLineWidth(0.6);
    doc.line(0, 30, pageW, 30);

    doc.setTextColor(34, 211, 238);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      'RINGPARKEN (AFD. 23) SLAGELSE · RETSMEDICINSK & METEOROLOGISK SPREDNINGSPROGNOSE-RAPPORT',
      margin,
      9
    );

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`VALGT PROGNOSE-RAPPORT: ${modeTitleDa}`, margin, 16.5);

    doc.setTextColor(203, 213, 225);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const first5dIso = fiveDaysDetailed[0]?.dateIso || nextDayMidnightAnalysis.dateIso;
    const last5dIso =
      fiveDaysDetailed[fiveDaysDetailed.length - 1]?.dateIso ||
      nextDayMidnightAnalysis.dateIso;
    doc.text(
      `Udgangsdato: ${baseDateIso} | Prognosehorisont: ${first5dIso} kl. 00.00.00 -> ${last5dIso} kl. 23.59.59 | Valgt Receptor: ${selectedReceptorMeta?.code || 'R1'} (${selectedReceptorMeta?.name || 'Rødtjørnevej 2'})`,
      margin,
      22.5
    );
    doc.text(
      `5d Maks Sumkvotient: S_max = ${fiveDaysAggregatedSummary.peakS5d.toFixed(2)} | 5d Middel: S = ${fiveDaysAggregatedSummary.meanS5d.toFixed(2)} | 120t Akkumuleret Dosis: Sigma_S = ${fiveDaysAggregatedSummary.cumulativeDoseS120h} | Timer S >= 1,0: ${fiveDaysAggregatedSummary.totalExceedanceHours5d}t`,
      margin,
      27.5
    );

    y = 36;

    // =========================================================================
    // SECTION 1: GRAPHICAL COMPARISON OF DISPERSION RISK ACROSS INTERVALS
    // =========================================================================
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, pageW - margin * 2, 58, 2, 2, 'FD');

    doc.setTextColor(165, 180, 252);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      'GRAFISK SAMMENLIGNING 1: TVÆRGÅENDE SPREDNINGSRISIKO PÅ TVÆRS AF PROGNOSE-INTERVALLER',
      margin + 3,
      y + 5.5
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text(
      'Sammenligner Sumkvotient S (blå/rød søjle), Asbest-kvotient C/GV (gul søjle) og Vindhastighed m/s (lilla kurve) mod grænseværdien S = 1,0',
      margin + 3,
      y + 10
    );

    const chart1X = margin + 10;
    const chart1Y = y + 14;
    const chart1W = pageW - margin * 2 - 16;
    const chart1H = 34;

    // Background grid
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.2);
    const maxChart1Val = Math.max(
      1.8,
      ...crossIntervalComparisonData.map((d) =>
        Math.max(d.sumQuotient, d.asbestosQuotient, d.windSpeedMs / 8)
      )
    );
    for (let g = 0; g <= 4; g++) {
      const gy = chart1Y + chart1H - (g / 4) * chart1H;
      doc.line(chart1X, gy, chart1X + chart1W, gy);
      const valLbl = ((g / 4) * maxChart1Val).toFixed(1);
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(valLbl, chart1X - 7, gy + 1.5);
    }

    // Threshold line S = 1.0
    const s1Y = chart1Y + chart1H - (1.0 / maxChart1Val) * chart1H;
    if (s1Y >= chart1Y && s1Y <= chart1Y + chart1H) {
      doc.setDrawColor(244, 63, 94);
      doc.setLineWidth(0.4);
      doc.line(chart1X, s1Y, chart1X + chart1W, s1Y);
      doc.setTextColor(253, 164, 175);
      doc.setFontSize(6);
      doc.text('S = 1,0 (Grænseværdi)', chart1X + chart1W - 24, s1Y - 1);
    }

    const slotW = chart1W / Math.max(1, crossIntervalComparisonData.length);
    const windPoints: Array<{ x: number; y: number }> = [];

    crossIntervalComparisonData.forEach((item, idx) => {
      const cx = chart1X + idx * slotW + slotW * 0.5;
      const barW = Math.min(6.5, slotW * 0.34);

      const sH = Math.min(
        chart1H,
        Math.max(1, (item.sumQuotient / maxChart1Val) * chart1H)
      );
      const aH = Math.min(
        chart1H,
        Math.max(1, (item.asbestosQuotient / maxChart1Val) * chart1H)
      );

      // SumQuotient Bar
      if (item.sumQuotient >= 1.0) {
        doc.setFillColor(244, 63, 94);
      } else if (item.sumQuotient >= 0.5) {
        doc.setFillColor(56, 189, 248);
      } else {
        doc.setFillColor(16, 185, 129);
      }
      doc.rect(cx - barW - 0.5, chart1Y + chart1H - sH, barW, sH, 'F');

      // Asbestos Quotient Bar
      doc.setFillColor(245, 158, 11);
      doc.rect(cx + 0.5, chart1Y + chart1H - aH, barW, aH, 'F');

      // Value label above S bar
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.text(
        item.sumQuotient.toFixed(2),
        cx - barW,
        Math.max(chart1Y + 2, chart1Y + chart1H - sH - 1.2)
      );

      // X-axis label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(203, 213, 225);
      const shortLbl = item.intervalLabel
        .replace('Døgnet efter ', 'D+1 ')
        .replace('5-Døgns Middel (120t)', '5d Middel');
      doc.text(shortLbl.slice(0, 14), cx - slotW * 0.42, chart1Y + chart1H + 4.2);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${item.windSpeedMs}m/s · ${item.worstReceptorCode}`,
        cx - slotW * 0.42,
        chart1Y + chart1H + 7.5
      );

      const windScaled = item.windSpeedMs / 8;
      const wy =
        chart1Y +
        chart1H -
        Math.min(chart1H, Math.max(1, (windScaled / maxChart1Val) * chart1H));
      windPoints.push({ x: cx, y: wy });
    });

    // Draw wind speed line overlay
    doc.setDrawColor(192, 132, 252);
    doc.setLineWidth(0.5);
    for (let i = 0; i < windPoints.length - 1; i++) {
      doc.line(
        windPoints[i].x,
        windPoints[i].y,
        windPoints[i + 1].x,
        windPoints[i + 1].y
      );
    }
    windPoints.forEach((pt) => {
      doc.setFillColor(192, 132, 252);
      doc.circle(pt.x, pt.y, 0.9, 'F');
    });

    y += 62;

    // =========================================================================
    // SECTION 2: GRAPHICAL COMPARISON 2 — 5-DAY ACCUMULATED SUM QUOTIENT TREND
    // =========================================================================
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, pageW - margin * 2, 50, 2, 2, 'FD');

    doc.setTextColor(253, 224, 71);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      `GRAFISK SAMMENLIGNING 2: 5-DØGNS AKKUMULERET SUMKVOTIENT-TENDENS (SIGMA_S = ${fiveDaysAggregatedSummary.cumulativeDoseS120h})`,
      margin + 3,
      y + 5.5
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text(
      `Viser dagligt dosisbidrag Sigma_S_døgn (blå søjler), 5-døgns akkumuleret Sigma_S (gul kurve) og valgt receptor ${selectedReceptorMeta?.code || 'R1'} (cyan kurve)`,
      margin + 3,
      y + 10
    );

    const chart2X = margin + 12;
    const chart2Y = y + 13;
    const chart2W = pageW - margin * 2 - 18;
    const chart2H = 29;

    const maxAccum5d = Math.max(
      10,
      ...fiveDaysAggregatedSummary.dailyComparisonChartData.map(
        (d) => d.accumulatedSumQuotient5d
      )
    );

    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.2);
    for (let g = 0; g <= 3; g++) {
      const gy = chart2Y + chart2H - (g / 3) * chart2H;
      doc.line(chart2X, gy, chart2X + chart2W, gy);
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(((g / 3) * maxAccum5d).toFixed(0), chart2X - 8, gy + 1.5);
    }

    const daySlotW =
      chart2W /
      Math.max(1, fiveDaysAggregatedSummary.dailyComparisonChartData.length);
    const accumPts: Array<{ x: number; y: number; val: number }> = [];
    const selRecPts: Array<{ x: number; y: number }> = [];

    fiveDaysAggregatedSummary.dailyComparisonChartData.forEach((d, idx) => {
      const cx = chart2X + idx * daySlotW + daySlotW * 0.5;
      const bW = Math.min(10, daySlotW * 0.35);
      const dailyH = Math.min(
        chart2H,
        Math.max(1, (d.dailyDoseS / maxAccum5d) * chart2H)
      );
      doc.setFillColor(56, 189, 248);
      doc.rect(cx - bW / 2, chart2Y + chart2H - dailyH, bW, dailyH, 'F');

      const accY =
        chart2Y +
        chart2H -
        Math.min(
          chart2H,
          Math.max(1, (d.accumulatedSumQuotient5d / maxAccum5d) * chart2H)
        );
      accumPts.push({ x: cx, y: accY, val: d.accumulatedSumQuotient5d });

      const selY =
        chart2Y +
        chart2H -
        Math.min(
          chart2H,
          Math.max(1, (d.accumulatedSelectedReceptor5d / maxAccum5d) * chart2H)
        );
      selRecPts.push({ x: cx, y: selY });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(226, 232, 240);
      doc.text(
        `${d.shortDayLabel} (${d.dateIso.slice(5)})`,
        cx - daySlotW * 0.35,
        chart2Y + chart2H + 4.5
      );
    });

    // Draw accumulated 5d curve
    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.65);
    for (let i = 0; i < accumPts.length - 1; i++) {
      doc.line(accumPts[i].x, accumPts[i].y, accumPts[i + 1].x, accumPts[i + 1].y);
    }
    accumPts.forEach((pt) => {
      doc.setFillColor(251, 191, 36);
      doc.circle(pt.x, pt.y, 1.1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(253, 224, 71);
      doc.text(`Sigma_S=${pt.val.toFixed(1)}`, pt.x - 6, Math.max(chart2Y + 2, pt.y - 1.8));
    });

    // Draw selected receptor accumulated curve
    doc.setDrawColor(34, 211, 238);
    doc.setLineWidth(0.5);
    for (let i = 0; i < selRecPts.length - 1; i++) {
      doc.line(
        selRecPts[i].x,
        selRecPts[i].y,
        selRecPts[i + 1].x,
        selRecPts[i + 1].y
      );
    }

    y += 54;

    // =========================================================================
    // SECTION 3: OVERSKUELIG TABEL OVER AGGREGEREDE SUMKVOTIENTER (5 DØGN)
    // =========================================================================
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, pageW - margin * 2, 54, 2, 2, 'FD');

    doc.setTextColor(56, 189, 248);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      'OVERSKUELIG TABEL OVER AGGREGEREDE SUMKVOTIENTER (FEM DØGNS PROGNOSE · DAG +1 TIL DAG +5)',
      margin + 3,
      y + 5.5
    );

    const colX = [
      margin + 3,
      margin + 33,
      margin + 54,
      margin + 74,
      margin + 94,
      margin + 116,
      margin + 139,
      margin + 160,
    ];
    let rowY = y + 11;

    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Prognosedøgn', colX[0], rowY);
    doc.text('Midnat S(00-01)', colX[1], rowY);
    doc.text('Døgn-Middel S', colX[2], rowY);
    doc.text('Døgn-Spids S_max', colX[3], rowY);
    doc.text('Døgn-Dosis SigmaS', colX[4], rowY);
    doc.text('Akkum. 5d SigmaS', colX[5], rowY);
    doc.text('Timer S>=1,0', colX[6], rowY);
    doc.text('Udsat Receptor', colX[7], rowY);

    doc.setDrawColor(51, 65, 85);
    doc.line(margin + 2, rowY + 1.5, pageW - margin - 2, rowY + 1.5);
    rowY += 5.5;

    fiveDaysDetailed.forEach((d, idx) => {
      const acc5d =
        fiveDaysAggregatedSummary.dailyComparisonChartData[idx]
          ?.accumulatedSumQuotient5d || d.cumulativeDailyDoseS;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(241, 245, 249);
      doc.text(`Dag +${d.dayOffset} (${d.weekdayShortDa} ${d.shortDateDa})`, colX[0], rowY);
      doc.text(d.midnight00_59.sumQuotient.toFixed(2), colX[1], rowY);
      doc.text(d.meanDailyS.toFixed(2), colX[2], rowY);

      doc.setFont('helvetica', 'bold');
      if (d.peakS >= 1.0) {
        doc.setTextColor(251, 113, 133);
      } else {
        doc.setTextColor(251, 191, 36);
      }
      doc.text(`${d.peakS.toFixed(2)} (kl.${d.peakHourLabel})`, colX[3], rowY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(226, 232, 240);
      doc.text(d.cumulativeDailyDoseS.toFixed(1), colX[4], rowY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(56, 189, 248);
      doc.text(acc5d.toFixed(1), colX[5], rowY);
      doc.setTextColor(d.hoursExceedingLimit > 0 ? 251 : 52, d.hoursExceedingLimit > 0 ? 113 : 211, d.hoursExceedingLimit > 0 ? 133 : 153);
      doc.text(`${d.hoursExceedingLimit} timer`, colX[6], rowY);
      doc.setTextColor(226, 232, 240);
      doc.text(`${d.peakReceptorCode}: ${d.peakReceptorName.slice(0, 13)}`, colX[7], rowY);
      rowY += 6;
    });

    // Total / Aggregated 5-Day Summary Row
    doc.setDrawColor(251, 191, 36);
    doc.line(margin + 2, rowY - 3.5, pageW - margin - 2, rowY - 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(253, 224, 71);
    doc.text('5-DØGNS AGGREGERET (120T)', colX[0], rowY + 1);
    doc.text(nextDayMidnightAnalysis.maxS00.toFixed(2), colX[1], rowY + 1);
    doc.text(fiveDaysAggregatedSummary.meanS5d.toFixed(2), colX[2], rowY + 1);
    doc.text(`S_max = ${fiveDaysAggregatedSummary.peakS5d.toFixed(2)}`, colX[3], rowY + 1);
    doc.text(`+${fiveDaysAggregatedSummary.dailyAccumulationSlope}/d`, colX[4], rowY + 1);
    doc.text(`SigmaS = ${fiveDaysAggregatedSummary.cumulativeDoseS120h}`, colX[5], rowY + 1);
    doc.text(`${fiveDaysAggregatedSummary.totalExceedanceHours5d}t >= 1,0`, colX[6], rowY + 1);
    doc.text(
      `${fiveDaysAggregatedSummary.worstDayEntry?.peakReceptorCode || 'R1'} (Værst)`,
      colX[7],
      rowY + 1
    );

    y += 58;

    // =========================================================================
    // SECTION 4: BEBOER-VENLIG TEKSTLIG RAPPORT & DETALJER (CONTINUES ON PAGE 2 IF NEEDED)
    // =========================================================================
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.35);
    const remainingH = pageH - y - 12;
    doc.roundedRect(margin, y, pageW - margin * 2, remainingH, 2, 2, 'FD');

    doc.setTextColor(52, 211, 153);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      'BEBOER-VENLIG 5-DØGNS SPREDNINGSRAPPORT & VEJRUDSIGT-INDLÆG FOR RINGPARKEN',
      margin + 3,
      y + 5.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(241, 245, 249);

    const wrappedLines = doc.splitTextToSize(
      broadcastManuscript,
      pageW - margin * 2 - 6
    ) as string[];

    let textY = y + 10.5;
    for (let i = 0; i < wrappedLines.length; i++) {
      if (textY > pageH - 16) {
        doc.addPage();
        doc.setFillColor(10, 18, 36);
        doc.rect(0, 0, pageW, pageH, 'F');
        doc.setTextColor(52, 211, 153);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(
          'RINGPARKEN SPREDNINGSPROGNOSE-RAPPORT (FORTSAT) — BEBOER-KOMMUNIKATION & RECEPTOR-MATRIX',
          margin,
          12
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(241, 245, 249);
        textY = 20;
      }
      doc.text(wrappedLines[i], margin + 3, textY);
      textY += 3.8;
    }

    doc.save(
      `ringparken-spredningsprognose-${activeReportMode}-${baseDateIso}.pdf`
    );
    setExportedPdfSuccess(true);
    window.setTimeout(() => setExportedPdfSuccess(false), 3500);
  };

  const isSimulatingNextDayMidnight =
    simulatedDateIso === nextDayMidnightAnalysis.dateIso &&
    simulatedHourIndex === 0;

  // Helper for visual risk indicator badge on the 3 forecast mode cards
  const getRiskIndicatorSpec = (sValue: number) => {
    if (sValue >= 1.0) {
      return {
        label: 'KRITISK RISIKO (S ≥ 1,0)',
        badgeClass: 'bg-rose-600 text-white border-rose-300',
        barClass: 'bg-rose-500',
        pct: Math.min(100, Math.round((sValue / 1.8) * 100)),
      };
    }
    if (sValue >= 0.5) {
      return {
        label: 'FORHØJET RISIKO (S ≥ 0,5)',
        badgeClass: 'bg-amber-400 text-slate-950 border-amber-200',
        barClass: 'bg-amber-400',
        pct: Math.min(100, Math.round((sValue / 1.8) * 100)),
      };
    }
    return {
      label: 'MODERAT / LAV RISIKO',
      badgeClass: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50',
      barClass: 'bg-emerald-400',
      pct: Math.max(12, Math.min(100, Math.round((sValue / 1.8) * 100))),
    };
  };

  const mode1Risk = getRiskIndicatorSpec(nextDayMidnightAnalysis.maxS00);
  const mode2Risk = getRiskIndicatorSpec(fiveDaysAggregatedSummary.peakS5d);
  const mode3Risk = getRiskIndicatorSpec(fiveDaysAggregatedSummary.meanS5d);

  return (
    <div
      ref={widgetContainerRef}
      className={`p-3.5 rounded-md bg-slate-950/95 border shadow-xl space-y-3.5 font-mono text-xs transition-all ${
        isFocusPulseActive
          ? mode === 'five_day_forecast'
            ? 'border-amber-300 ring-2 ring-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.3)]'
            : mode === 'weather_broadcast_segment'
            ? 'border-emerald-300 ring-2 ring-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.3)]'
            : 'border-cyan-300 ring-2 ring-cyan-400/80 shadow-[0_0_24px_rgba(34,211,238,0.35)]'
          : 'border-cyan-500/60'
      }`}
    >
      {/* =====================================================================
          TOP HEADER BAR + QUICK ACTION CONTROLS
         ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-500 text-slate-950 text-[11px] font-extrabold uppercase tracking-wider shadow-xs">
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>DEDIKERET SPREDNINGSPROGNOSE-WIDGET (3 PROGNOSETYPER)</span>
          </span>
          <span className="text-[11px] text-slate-300">
            Udgangsdato: <strong className="text-white">{baseDateIso}</strong> · Horisont:{' '}
            <strong className="text-cyan-300">
              {nextDayMidnightAnalysis.dateIso} kl. 00.00.00
            </strong>{' '}
            →{' '}
            <strong className="text-amber-300">
              {fiveDaysDetailed[fiveDaysDetailed.length - 1]?.dateIso}
            </strong>
          </span>
          {isLoadingForecast && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Synkroniserer Open-Meteo...</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCrossIntervalComparison((v) => !v)}
            className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              showCrossIntervalComparison
                ? 'bg-indigo-500 text-white border-indigo-300 shadow-xs'
                : 'bg-slate-900 hover:bg-slate-800 text-indigo-200 border-indigo-500/50'
            }`}
            title="Vis eller skjul grafisk sammenligning af spredningsrisikoen på tværs af alle prognose-intervaller"
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span>
              {showCrossIntervalComparison
                ? 'Skjul Tværgående Risiko-Sammenligning'
                : '📊 Sammenlign Prognose-Intervaller'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleExportForecastReportPdf()}
            className={`px-2.5 py-1 rounded text-[11px] font-extrabold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              exportedPdfSuccess
                ? 'bg-emerald-400 text-slate-950 border-white'
                : 'bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 border-white/80'
            }`}
            title="Eksportér den valgte prognose-rapport direkte som PDF inklusiv grafiske sammenligninger og aggregeret sumkvotient-tabel"
          >
            <FileDown className="w-3.5 h-3.5 shrink-0" />
            <span>
              {exportedPdfSuccess
                ? '✓ Prognose-PDF Eksporteret (inkl. Grafer)!'
                : '📄 Eksportér Prognose-Rapport (PDF inkl. Grafer)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogForecastAsEvidence}
            className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
              loggedEvidenceSuccess
                ? 'bg-emerald-400 text-slate-950 border-white'
                : 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border-emerald-400/70'
            }`}
            title="Føj den valgte Spredningsprognose direkte til Beviser med kryptografisk SHA-256 signatur"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              {loggedEvidenceSuccess
                ? '✓ Prognose føjet til Beviser!'
                : '➕ Føj Prognose til Beviser (SHA-256)'}
            </span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
            >
              Skjul ✕
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          ELEMENT 1 & 2: 3 VISUALLY SEPARATED FORECAST MODE CARDS WITH RISK INDICATORS
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5" role="tablist" aria-label="Spredningsprognose tilstande">
        {/* CARD 1: Døgnet efter fra klokken 00.00.00 - 00.59.59 */}
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'next_day_00_00_59'}
          onClick={() => {
            onChangeMode('next_day_00_00_59');
            onSelectDateAndHour(
              nextDayMidnightAnalysis.dateIso,
              0,
              nextDayForecast.dataset
            );
          }}
          className={`text-left p-3 rounded-md border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            mode === 'next_day_00_00_59'
              ? 'bg-gradient-to-br from-cyan-950/90 via-slate-900 to-slate-950 border-cyan-400 ring-1 ring-cyan-300/60 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
              : 'bg-slate-900/75 border-slate-800 hover:border-cyan-500/60 hover:bg-slate-900'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                  mode === 'next_day_00_00_59'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                }`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span>PROGNOSETYPE 1 · MIDNATSVINDUE</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold border ${mode1Risk.badgeClass}`}
              >
                {mode1Risk.label}
              </span>
            </div>

            <div className="text-xs font-extrabold text-white flex items-center justify-between">
              <span>Døgnet efter fra klokken 00.00.00 - 00.59.59</span>
              {mode === 'next_day_00_00_59' && (
                <span className="text-[10px] text-cyan-300 font-bold">● AKTIV</span>
              )}
            </div>

            <p className="text-[10.5px] text-slate-300 leading-snug">
              Højopløselig 60-minutters analyse ved døgnskiftet til{' '}
              <strong className="text-cyan-300">
                {nextDayMidnightAnalysis.weekdayDa} d. {nextDayMidnightAnalysis.dateIso}
              </strong>{' '}
              (4 kvarters-trin &amp; minut-slider).
            </p>
          </div>

          <div className="space-y-1.5 pt-1.5 border-t border-slate-800/90 tabular-nums">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-400">
                Vind {nextDayMidnightAnalysis.hr00.windSpeed10m} m/s → Fane{' '}
                {nextDayMidnightAnalysis.plumeDir00}° ({nextDayMidnightAnalysis.plumeCompass00})
              </span>
              <span className="font-extrabold text-cyan-300">
                S(00–01) = {nextDayMidnightAnalysis.maxS00.toFixed(2)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${mode1Risk.barClass} transition-all`}
                style={{ width: `${mode1Risk.pct}%` }}
              />
            </div>
          </div>
        </button>

        {/* CARD 2: Fem døgns prognose */}
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'five_day_forecast'}
          onClick={() => onChangeMode('five_day_forecast')}
          className={`text-left p-3 rounded-md border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            mode === 'five_day_forecast'
              ? 'bg-gradient-to-br from-amber-950/85 via-slate-900 to-slate-950 border-amber-400 ring-1 ring-amber-300/60 shadow-[0_0_18px_rgba(251,191,36,0.25)]'
              : 'bg-slate-900/75 border-slate-800 hover:border-amber-500/60 hover:bg-slate-900'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                  mode === 'five_day_forecast'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                }`}
              >
                <Calendar className="w-3 h-3 shrink-0" />
                <span>PROGNOSETYPE 2 · 120 TIMERS HORISONT</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold border ${mode2Risk.badgeClass}`}
              >
                {mode2Risk.label}
              </span>
            </div>

            <div className="text-xs font-extrabold text-white flex items-center justify-between">
              <span>Fem døgns prognose (Dag +1 til Dag +5)</span>
              {mode === 'five_day_forecast' && (
                <span className="text-[10px] text-amber-300 font-bold">● AKTIV</span>
              )}
            </div>

            <p className="text-[10.5px] text-slate-300 leading-snug">
              Aggregerer 5 dages vejrdata, receptor-matrix og{' '}
              <strong className="text-amber-300">
                akkumuleret sumkvotient-tendens (ΣS = {fiveDaysAggregatedSummary.cumulativeDoseS120h})
              </strong>
              .
            </p>
          </div>

          <div className="space-y-1.5 pt-1.5 border-t border-slate-800/90 tabular-nums">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-400">
                {fiveDaysAggregatedSummary.totalExceedanceHours5d}t ≥ 1,0 · Maks vind{' '}
                {fiveDaysAggregatedSummary.maxWindSpeed5d} m/s
              </span>
              <span className="font-extrabold text-amber-300">
                5d S_max = {fiveDaysAggregatedSummary.peakS5d.toFixed(2)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${mode2Risk.barClass} transition-all`}
                style={{ width: `${mode2Risk.pct}%` }}
              />
            </div>
          </div>
        </button>

        {/* CARD 3: Som indlæg i en Vejrudsigt */}
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'weather_broadcast_segment'}
          onClick={() => onChangeMode('weather_broadcast_segment')}
          className={`text-left p-3 rounded-md border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
            mode === 'weather_broadcast_segment'
              ? 'bg-gradient-to-br from-emerald-950/85 via-slate-900 to-slate-950 border-emerald-400 ring-1 ring-emerald-300/60 shadow-[0_0_18px_rgba(52,211,153,0.25)]'
              : 'bg-slate-900/75 border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                  mode === 'weather_broadcast_segment'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <Radio className="w-3 h-3 shrink-0" />
                <span>PROGNOSETYPE 3 · BEBOER-KOMMUNIKATION</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold border ${mode3Risk.badgeClass}`}
              >
                5d S̄ = {fiveDaysAggregatedSummary.meanS5d.toFixed(2)}
              </span>
            </div>

            <div className="text-xs font-extrabold text-white flex items-center justify-between">
              <span>Som indlæg i en Vejrudsigt (Beboer-Rapport)</span>
              {mode === 'weather_broadcast_segment' && (
                <span className="text-[10px] text-emerald-300 font-bold">● AKTIV</span>
              )}
            </div>

            <p className="text-[10.5px] text-slate-300 leading-snug">
              Læsbar tekstlig 5-døgns rapport og vejrudsigts-bulletin med konkrete handlingsråd til beboere i Ringparken.
            </p>
          </div>

          <div className="space-y-1.5 pt-1.5 border-t border-slate-800/90 tabular-nums">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-400">
                Primær retning: {fiveDaysAggregatedSummary.aggPlumeCompass} (mod{' '}
                {fiveDaysAggregatedSummary.worstDayEntry?.peakReceptorCode})
              </span>
              <span className="font-extrabold text-emerald-300">
                3 Rapport-Formater
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${mode3Risk.barClass} transition-all`}
                style={{ width: `${mode3Risk.pct}%` }}
              />
            </div>
          </div>
        </button>
      </div>

      {/* Animated Sliding Mode Indicator Track (Glidende Overgangs-Indikator) */}
      <div className="relative h-1.5 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
        <div
          className={`h-full w-1/3 rounded-full transition-all duration-500 ease-out ${
            mode === 'next_day_00_00_59'
              ? 'translate-x-0 bg-gradient-to-r from-cyan-400 to-sky-500 shadow-[0_0_12px_rgba(34,211,238,0.8)]'
              : mode === 'five_day_forecast'
              ? 'translate-x-full bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
              : 'translate-x-[200%] bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
          }`}
        />
      </div>

      {/* =====================================================================
          ELEMENT 2: GRAPHICAL COMPARISON OF DISPERSION RISK ACROSS FORECAST INTERVALS
         ===================================================================== */}
      {showCrossIntervalComparison && (
        <div className="p-3 rounded-md bg-slate-900/95 border border-indigo-500/50 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500 text-white font-extrabold text-[10px] uppercase flex items-center gap-1">
                <BarChart3 className="w-3 h-3 shrink-0" />
                <span>TVÆRGÅENDE RISIKO-SAMMENLIGNING PÅ TVÆRS AF PROGNOSE-INTERVALLER</span>
              </span>
              <span className="text-[11px] text-slate-300">
                Sammenligner Sumkvotient <strong className="text-cyan-300">S</strong>,{' '}
                <strong className="text-amber-300">Asbest-kvotient</strong> og{' '}
                <strong className="text-indigo-200">Vindhastighed (m/s)</strong> mellem Aktuel time, Døgnet efter 00.00–00.59, Dag +1..+5 og 5-døgns middel
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Klik på en søjle eller et interval-kort for at skifte til prognose-intervallet
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            <div className="lg:col-span-7 h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={crossIntervalComparisonData}
                  onClick={(st) => {
                    if (st && typeof st.activeTooltipIndex === 'number') {
                      const item =
                        crossIntervalComparisonData[st.activeTooltipIndex];
                      if (item) {
                        onChangeMode(item.targetMode);
                        onSelectDateAndHour(
                          item.dateIso,
                          item.hourIndex,
                          item.dataset
                        );
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="intervalLabel"
                    stroke="#94a3b8"
                    tick={{ fontSize: 9.5 }}
                    interval={0}
                  />
                  <YAxis yAxisId="left" stroke="#38bdf8" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: '#6366f1',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <ReferenceLine
                    yAxisId="left"
                    y={1.0}
                    stroke="#f43f5e"
                    strokeDasharray="4 2"
                    label={{
                      value: 'Grænseværdi S = 1,0',
                      fill: '#fda4af',
                      fontSize: 9,
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="sumQuotient"
                    name="Sumkvotient S"
                    fill="#38bdf8"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="asbestosQuotient"
                    name="Asbest-kvotient (C/GV)"
                    fill="#f59e0b"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="windSpeedMs"
                    name="Vind (m/s)"
                    stroke="#c084fc"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-1.5">
              {crossIntervalComparisonData.slice(0, 6).map((item) => {
                const isCrit = item.sumQuotient >= 1.0;
                return (
                  <button
                    key={item.intervalId}
                    type="button"
                    onClick={() => {
                      onChangeMode(item.targetMode);
                      onSelectDateAndHour(
                        item.dateIso,
                        item.hourIndex,
                        item.dataset
                      );
                    }}
                    className="p-2 rounded bg-slate-950/90 hover:bg-slate-800 border border-slate-800 hover:border-indigo-400 text-left transition-all cursor-pointer tabular-nums"
                  >
                    <div className="text-[9.5px] text-indigo-300 font-bold truncate">
                      {item.intervalLabel}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span
                        className={`text-xs font-extrabold ${
                          isCrit
                            ? 'text-rose-400'
                            : item.sumQuotient >= 0.5
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        S = {item.sumQuotient.toFixed(2)}
                      </span>
                      <span className="text-[9.5px] text-slate-400">
                        {item.windSpeedMs} m/s · {item.worstReceptorCode}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SMOOTH SLIDING TRANSITION CONTAINER FOR THE 3 FORECAST MODES
         ===================================================================== */}
      <div
        className={`transition-all duration-500 ease-out transform ${
          isModeTransitioning
            ? slideDirection === 'right'
              ? 'opacity-0 translate-x-6 scale-[0.99]'
              : 'opacity-0 -translate-x-6 scale-[0.99]'
            : 'opacity-100 translate-x-0 scale-100'
        }`}
      >
      {/* =====================================================================
          MODE 1: DØGNET EFTER FRA KLOKKEN 00.00.00 - 00.59.59 (AUTO-FOCUSED)
         ===================================================================== */}
      {mode === 'next_day_00_00_59' && (
        <div
          ref={nextDayFocusPanelRef}
          tabIndex={-1}
          aria-label="Spredningsprognose: Døgnet efter fra klokken 00.00.00 - 00.59.59"
          className="space-y-3 focus:outline-none"
        >
          {/* Top Highlight Banner for Next Day 00.00.00 - 00.59.59 */}
          <div className="p-3 rounded-md bg-gradient-to-r from-cyan-950/90 via-slate-900 to-indigo-950/80 border-2 border-cyan-400/80 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-extrabold text-[10.5px] uppercase flex items-center gap-1">
                  <Crosshair className="w-3 h-3 shrink-0" />
                  <span>AKTIV VISNING: DØGNET EFTER FRA KLOKKEN 00.00.00 - 00.59.59</span>
                </span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {nextDayMidnightAnalysis.weekdayDa} d. {nextDayMidnightAnalysis.dateIso} · kl. 00.00.00 – 00.59.59
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold border tabular-nums ${
                    nextDayMidnightAnalysis.maxS00 >= 1.0
                      ? 'bg-rose-600 text-white border-rose-300'
                      : nextDayMidnightAnalysis.maxS00 >= 0.5
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                  }`}
                >
                  Sumkvotient S(00.00.00–00.59.59) = {nextDayMidnightAnalysis.maxS00.toFixed(2)}
                </span>
                {isSimulatingNextDayMidnight && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400 text-emerald-200 text-[10px] font-bold">
                    ✓ Synkroniseret med 2D/3D-simulator (kl. 00.00.00 – 00.59.59)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-200">
                Automatisk fokuseret midnats-spredningsprognose for døgnskiftet fra{' '}
                <strong className="text-white">{baseDateIso} kl. 23.59.59</strong> til{' '}
                <strong className="text-cyan-300">
                  {nextDayMidnightAnalysis.dateIso} kl. 00.00.00 – 00.59.59
                </strong>
                : Vind{' '}
                <strong className="text-white tabular-nums">
                  {nextDayMidnightAnalysis.hr00.windSpeed10m} m/s
                </strong>{' '}
                (stød {nextDayMidnightAnalysis.hr00.windGusts10m} m/s) fra{' '}
                {nextDayMidnightAnalysis.hr00.windDirection10m}° ({nextDayMidnightAnalysis.windCompass00}) →{' '}
                <strong className="text-cyan-300">
                  Spredningsfane {nextDayMidnightAnalysis.plumeDir00}° ({nextDayMidnightAnalysis.plumeCompass00})
                </strong>{' '}
                · Pasquill-klasse{' '}
                <strong className="text-emerald-300">{nextDayMidnightAnalysis.hr00.pasquillClass}</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onSelectDateAndHour(
                    nextDayMidnightAnalysis.dateIso,
                    0,
                    nextDayForecast.dataset
                  )
                }
                className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                title="Fokuser 2D-kortet og 3D-scenen på Døgnet efter kl. 00.00.00 - 00.59.59"
              >
                <Play className="w-3.5 h-3.5 shrink-0 fill-slate-950" />
                <span>
                  {isSimulatingNextDayMidnight
                    ? 'Aktiv i 2D/3D: kl. 00.00.00 - 00.59.59'
                    : 'Fokuser 2D/3D på kl. 00.00.00 - 00.59.59'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleExportForecastReportPdf('next_day_00_00_59')}
                className="px-2.5 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Eksportér Døgnet efter (kl. 00.00.00 - 00.59.59) prognose-rapporten som PDF inklusiv grafiske sammenligninger"
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" />
                <span>Eksportér Midnats-Prognose (PDF inkl. Grafer)</span>
              </button>

              {nextDayMidnightAnalysis.peakHourEntry && (
                <button
                  type="button"
                  onClick={() =>
                    onSelectDateAndHour(
                      nextDayMidnightAnalysis.dateIso,
                      nextDayMidnightAnalysis.peakHourEntry.hourIndex,
                      nextDayForecast.dataset
                    )
                  }
                  className="px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  title="Sammenlign med døgnets spidsbelastningstime på Døgnet efter"
                >
                  <span>
                    Døgn-spids: kl. {nextDayMidnightAnalysis.peakHourEntry.shortHour} (S ={' '}
                    {nextDayMidnightAnalysis.peakHourEntry.maxSumQuotient.toFixed(2)})
                  </span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Interactive Minute-by-Minute Scrubber within 00.00.00 - 00.59.59 */}
          <div className="p-2.5 rounded bg-slate-900/95 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <div className="text-[10.5px] font-bold uppercase text-cyan-300">
                  Minut- &amp; Sekund-Inspektion i Midnatsvinduet (kl. 00.00.00 – 00.59.59)
                </div>
                <div className="text-[11px] text-slate-300 tabular-nums">
                  Valgt minut-interval:{' '}
                  <strong className="text-white">
                    {nextDayMidnightAnalysis.dateIso} kl. {focusedMinuteSnapshot.timeRangeLabel}
                  </strong>{' '}
                  · Vind <strong className="text-cyan-300">{focusedMinuteSnapshot.windSpeedMs} m/s</strong> · Fane{' '}
                  <strong className="text-cyan-300">
                    {focusedMinuteSnapshot.plumeDirectionDeg}° ({focusedMinuteSnapshot.plumeCompass})
                  </strong>{' '}
                  · <strong className="text-amber-300">S = {focusedMinuteSnapshot.sumQuotient.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
              <span className="text-[10px] text-slate-400 tabular-nums">00.00.00</span>
              <input
                type="range"
                min={0}
                max={59}
                step={1}
                value={selectedMinuteInHour}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setSelectedMinuteInHour(m);
                  setSelectedQuarterIdx(Math.min(3, Math.floor(m / 15)));
                }}
                aria-label="Minut-slider for Døgnet efter fra klokken 00.00.00 til 00.59.59"
                className="flex-1 accent-cyan-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 tabular-nums">00.59.59</span>
            </div>
          </div>

          {/* 4 Sub-Hour Quarter-Intervals (00.00.00 to 00.59.59) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="font-bold uppercase tracking-wider text-cyan-300">
                Højopløseligt Midnats-Interval: {nextDayMidnightAnalysis.dateIso} kl. 00.00.00 – 00.59.59 (4 × 15 min)
              </span>
              <span className="text-slate-400">
                Mest udsatte receptor kl. 00.00.00–00.59.59:{' '}
                <strong className="text-amber-300">
                  {nextDayMidnightAnalysis.worstRec00?.receptorCode}:{' '}
                  {nextDayMidnightAnalysis.worstRec00?.receptorName}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {nextDayMidnightAnalysis.subHourWindows.map((sub) => {
                const isSelectedQuarter = selectedQuarterIdx === sub.quarterIndex;
                return (
                  <div
                    key={sub.windowLabel}
                    onClick={() => {
                      setSelectedQuarterIdx(sub.quarterIndex);
                      setSelectedMinuteInHour(sub.startMinute);
                      onSelectDateAndHour(
                        nextDayMidnightAnalysis.dateIso,
                        0,
                        nextDayForecast.dataset
                      );
                    }}
                    className={`p-2.5 rounded border transition-all cursor-pointer space-y-1.5 ${
                      isSelectedQuarter
                        ? 'bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400/60 shadow-sm'
                        : 'bg-slate-900/95 border-slate-800 hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-extrabold text-[10.5px] tabular-nums">
                        kl. {sub.windowLabel}
                      </span>
                      <span
                        className={`text-xs font-extrabold tabular-nums ${
                          sub.sumQuotient >= 1.0
                            ? 'text-rose-400'
                            : sub.sumQuotient >= 0.5
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        S = {sub.sumQuotient.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[10.5px] font-bold text-white truncate">
                      {sub.phaseTitle}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pt-1 border-t border-slate-800/80 tabular-nums">
                      <div>
                        Vind: <strong className="text-white">{sub.windSpeedMs} m/s</strong> ({sub.windGustsMs})
                      </div>
                      <div>
                        Fane: <strong className="text-cyan-300">{sub.plumeDirectionDeg}° {sub.plumeCompass}</strong>
                      </div>
                      <div>
                        Temp/Kl.: <strong className="text-white">{sub.temperature2m}°C · {sub.pasquillClass}</strong>
                      </div>
                      <div>
                        Asbest: <strong className="text-amber-300">{sub.asbestosConcentration} f/cm³</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Receptor Table at 00.00.00 - 00.59.59 + 24h Next-Day Evolution Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left 6 cols: Receptor exposure table during 00.00.00 - 00.59.59 */}
            <div className="lg:col-span-6 p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-cyan-300">
                  Receptor-Eksponering kl. 00.00.00 – 00.59.59 ({nextDayMidnightAnalysis.dateIso})
                </span>
                <span className="text-[10px] text-slate-400">Klik for at vælge receptor</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                      <th className="py-1 pr-2">Receptor</th>
                      <th className="py-1 px-2">Afstand</th>
                      <th className="py-1 px-2">Asbest (f/cm³)</th>
                      <th className="py-1 pl-2 text-right">Sumkvotient S</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {nextDayMidnightAnalysis.sortedReceptors00.map((rec) => {
                      const isSel = selectedReceptorId === rec.receptorId;
                      const asb = rec.substances.find((s) => s.key === 'asbestos');
                      return (
                        <tr
                          key={`nd00-${rec.receptorId}`}
                          onClick={() => onSelectReceptor(rec.receptorId)}
                          className={`cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-cyan-500/20 text-white font-bold'
                              : 'hover:bg-slate-800/70 text-slate-200'
                          }`}
                        >
                          <td className="py-1.5 pr-2">
                            <span className="font-bold text-cyan-300">{rec.receptorCode}</span>:{' '}
                            {rec.receptorName}
                          </td>
                          <td className="py-1.5 px-2 text-slate-300">
                            {rec.distanceFromNearestSourceMeters} m
                          </td>
                          <td className="py-1.5 px-2 text-amber-300">
                            {asb ? asb.concentration.toFixed(4) : '0.0000'}
                          </td>
                          <td className="py-1.5 pl-2 text-right font-extrabold">
                            <span
                              className={
                                rec.sumQuotient >= 1.0
                                  ? 'text-rose-400'
                                  : rec.sumQuotient >= 0.5
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                              }
                            >
                              {rec.sumQuotient.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 6 cols: Full 24h profile of Døgnet Efter starting at 00.00.00 - 00.59.59 */}
            <div className="lg:col-span-6 p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-amber-300">
                  Døgnet Efter ({nextDayMidnightAnalysis.dateIso}): Fra kl. 00.00.00–00.59.59 gennem hele døgnet
                </span>
                <span className="text-[10px] text-slate-400">
                  Klik på en time i grafen for at simulere
                </span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={nextDayMidnightAnalysis.nextDay24hSeries}
                    onClick={(st) => {
                      if (st && typeof st.activeTooltipIndex === 'number') {
                        const idx = st.activeTooltipIndex;
                        const entry = nextDayMidnightAnalysis.nextDay24hSeries[idx];
                        if (entry) {
                          onSelectDateAndHour(
                            nextDayMidnightAnalysis.dateIso,
                            entry.hourIndex,
                            nextDayForecast.dataset
                          );
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="shortHour"
                      stroke="#94a3b8"
                      tick={{ fontSize: 10 }}
                      interval={2}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#38bdf8"
                      tick={{ fontSize: 10 }}
                      label={{
                        value: 'S / m/s',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#94a3b8',
                        fontSize: 10,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#38bdf8',
                        fontSize: '11px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <ReferenceLine
                      yAxisId="left"
                      y={1.0}
                      stroke="#f43f5e"
                      strokeDasharray="4 2"
                      label={{
                        value: 'Grænse S=1,0',
                        fill: '#fda4af',
                        fontSize: 9,
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="maxSumQuotient"
                      name="Sumkvotient S"
                      fill="#22d3ee"
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="windSpeedMs"
                      name="Vind (m/s)"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Hourly Plume-Hit Identification Table for 15 Inhabited Blocks (a_inhabited) & 7 Renovation Blocks (c_under_renovation) */}
          <div className="p-2.5 rounded bg-slate-900/95 border border-cyan-500/40 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-extrabold text-[10px] uppercase">
                  TIME-FOR-TIME FANE-TRÆF: 15 BEBOEDE BLOKKE (kat. a) &amp; 7 RENOVERINGSBLOKKE (kat. c)
                </span>
                <span className="text-[10.5px] text-slate-300">
                  Automatisk identifikation af hvilke <strong className="text-emerald-300">a. Beboede blokke</strong> og{' '}
                  <strong className="text-sky-300">c. Renoveringsblokke</strong> der rammes af støvfanen hver time på{' '}
                  <strong className="text-white">{nextDayMidnightAnalysis.dateIso}</strong>
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Klik på en time for at simulere i 2D/3D</span>
            </div>

            <div className="overflow-x-auto max-h-52">
              <table className="w-full text-left border-collapse text-[10.5px] font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/90 text-slate-400 text-[9.5px] uppercase sticky top-0">
                    <th className="py-1.5 px-2">Time</th>
                    <th className="py-1.5 px-2">Vind / Fane</th>
                    <th className="py-1.5 px-2 text-right">Max S</th>
                    <th className="py-1.5 px-2 text-emerald-300">
                      Ramte a. Beboede Blokke (af {nextDayMidnightAnalysis.nextDay24hSeries[0]?.totalInhabitedCount ?? 15})
                    </th>
                    <th className="py-1.5 px-2 text-sky-300">
                      Ramte c. Renoveringsblokke (af {nextDayMidnightAnalysis.nextDay24hSeries[0]?.totalRenovationCount ?? 7})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {nextDayMidnightAnalysis.nextDay24hSeries.map((hr) => (
                    <tr
                      key={`nd-hit-${hr.hourIndex}`}
                      onClick={() =>
                        onSelectDateAndHour(
                          nextDayMidnightAnalysis.dateIso,
                          hr.hourIndex,
                          nextDayForecast.dataset
                        )
                      }
                      className="hover:bg-slate-800/70 cursor-pointer transition-colors"
                    >
                      <td className="py-1 px-2 font-bold text-cyan-300 whitespace-nowrap">
                        kl. {hr.hourLabel}
                      </td>
                      <td className="py-1 px-2 text-slate-300 whitespace-nowrap">
                        {hr.windSpeedMs} m/s → {hr.plumeDirectionDeg}° ({degreesToCompass(hr.plumeDirectionDeg)})
                      </td>
                      <td className="py-1 px-2 text-right font-extrabold">
                        <span
                          className={
                            hr.maxSumQuotient >= 1.0
                              ? 'text-rose-400'
                              : hr.maxSumQuotient >= 0.5
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }
                        >
                          {hr.maxSumQuotient.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-emerald-200">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold mr-1.5">
                          {hr.hitInhabitedCodes.length}/{hr.totalInhabitedCount}
                        </span>
                        {hr.hitInhabitedCodes.length > 0
                          ? hr.hitInhabitedCodes.join(', ')
                          : 'Ingen direkte fane-træf'}
                      </td>
                      <td className="py-1 px-2 text-sky-200">
                        <span className="px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-bold mr-1.5">
                          {hr.hitRenovationCodes.length}/{hr.totalRenovationCount}
                        </span>
                        {hr.hitRenovationCodes.length > 0
                          ? hr.hitRenovationCodes.join(', ')
                          : 'Ingen direkte fane-træf'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 2: FEM DØGNS PROGNOSE (5 DAGE FREM + INTERAKTIV RECHARTS AKKUMULERET SUMKVOTIENT-TENDENS)
         ===================================================================== */}
      {mode === 'five_day_forecast' && (
        <div
          ref={fiveDayFocusPanelRef}
          tabIndex={-1}
          aria-label="Fem døgns prognose med aggregeret vejrdata, sumkvotienter og akkumuleret sumkvotient-tendens for 5 dage frem"
          className="space-y-3 focus:outline-none"
        >
          {/* Top 5-Day Aggregated Summary Header & KPI Strip (120 Hours Aggregated) */}
          <div className="p-3 rounded-md bg-gradient-to-r from-amber-950/85 via-slate-900 to-cyan-950/80 border-2 border-amber-400/80 space-y-2.5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10.5px] uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>FEM DØGNS PROGNOSE · 5 DAGE FREM (120 TIMERS AGGREGERING &amp; AKKUMULERET ΣS-TENDENS)</span>
                  </span>
                  <span className="text-xs font-bold text-white tabular-nums">
                    {fiveDaysDetailed[0]?.dateIso} ({fiveDaysDetailed[0]?.weekdayShortDa}) →{' '}
                    {fiveDaysDetailed[fiveDaysDetailed.length - 1]?.dateIso} (
                    {fiveDaysDetailed[fiveDaysDetailed.length - 1]?.weekdayShortDa})
                  </span>
                </div>
                <p className="text-[11px] text-slate-200">
                  Aggregeret Open-Meteo vejrtelemetri, daglige sumkvotienter og akkumuleret 5-døgns sumkvotient-tendens{' '}
                  <strong className="text-amber-300">
                    ΣS(5d) = {fiveDaysAggregatedSummary.cumulativeDoseS120h} (+
                    {fiveDaysAggregatedSummary.dailyAccumulationSlope}/døgn)
                  </strong>{' '}
                  iht. BEK nr. 613.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {fiveDaysAggregatedSummary.worstDayEntry && (
                  <button
                    type="button"
                    onClick={() =>
                      onSelectDateAndHour(
                        fiveDaysAggregatedSummary.worstDayEntry.dateIso,
                        fiveDaysAggregatedSummary.worstDayEntry.peakHourIndex,
                        fiveDaysAggregatedSummary.worstDayEntry.dataset
                      )
                    }
                    className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="Indlæs det værste tidspunkt i 5-døgns prognosen direkte i 2D/3D-simulatoren"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0 fill-slate-950" />
                    <span>
                      Simulér 5-Døgns Spids ({fiveDaysAggregatedSummary.worstDayEntry.weekdayShortDa}{' '}
                      kl. {fiveDaysAggregatedSummary.worstDayEntry.peakHourLabel} · S ={' '}
                      {fiveDaysAggregatedSummary.peakS5d.toFixed(2)})
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleExportForecastReportPdf('five_day_forecast')}
                  className="px-2.5 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Eksportér 5-døgns prognosen som PDF inklusiv grafiske sammenligninger og aggregeret sumkvotient-tabel"
                >
                  <FileDown className="w-3.5 h-3.5 shrink-0" />
                  <span>Eksportér 5-Døgns PDF (inkl. Grafer)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExport5DayForecastCsv}
                  className={`px-2.5 py-1.5 rounded font-bold text-[11px] border flex items-center gap-1 transition-colors cursor-pointer ${
                    exported5dCsvSuccess
                      ? 'bg-emerald-400 text-slate-950 border-white'
                      : 'bg-slate-950 hover:bg-slate-900 text-cyan-200 border-cyan-400/60'
                  }`}
                  title="Eksportér 5-døgns aggregerede vejrdata og sumkvotienter til CSV"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {exported5dCsvSuccess
                      ? '✓ 5-Døgns CSV Downloadet!'
                      : 'Eksportér 5-Døgns CSV'}
                  </span>
                </button>
              </div>
            </div>

            {/* 4 Aggregated 5-Day Telemetry & Sum Quotient KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
              <div className="p-2.5 rounded bg-slate-950/90 border border-amber-400/50 space-y-1 tabular-nums">
                <div className="flex items-center justify-between text-[10px] text-amber-300 font-bold uppercase">
                  <span>5-Døgns Sumkvotient &amp; ΣS</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-400 text-[10.5px]">5d Spids / Middel:</span>
                  <span
                    className={`text-sm font-extrabold ${
                      fiveDaysAggregatedSummary.peakS5d >= 1.0
                        ? 'text-rose-400'
                        : 'text-amber-300'
                    }`}
                  >
                    {fiveDaysAggregatedSummary.peakS5d.toFixed(2)} /{' '}
                    {fiveDaysAggregatedSummary.meanS5d.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-300">
                  <span>Akkumuleret 5d ΣS:</span>
                  <strong className="text-cyan-300">
                    ΣS = {fiveDaysAggregatedSummary.cumulativeDoseS120h} (+
                    {fiveDaysAggregatedSummary.dailyAccumulationSlope}/d)
                  </strong>
                </div>
                <div className="text-[10px] text-rose-300">
                  Overskridelser (S ≥ 1,0):{' '}
                  <strong>{fiveDaysAggregatedSummary.totalExceedanceHours5d} timer</strong> (af 120t)
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950/90 border border-cyan-500/40 space-y-1 tabular-nums">
                <div className="flex items-center justify-between text-[10px] text-cyan-300 font-bold uppercase">
                  <span>Aggregeret Vind (5 Døgn)</span>
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-400 text-[10.5px]">Middel / Maks vind:</span>
                  <span className="text-sm font-extrabold text-white">
                    {fiveDaysAggregatedSummary.meanWindSpeed5d} /{' '}
                    {fiveDaysAggregatedSummary.maxWindSpeed5d} m/s
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-300">
                  <span>Maks vindstød / &gt;10 m/s:</span>
                  <strong className="text-amber-300">
                    {fiveDaysAggregatedSummary.maxWindGusts5d} m/s ·{' '}
                    {fiveDaysAggregatedSummary.totalHighWindHours5d}t
                  </strong>
                </div>
                <div className="text-[10px] text-cyan-200">
                  5d Vektor-fane:{' '}
                  <strong>
                    {fiveDaysAggregatedSummary.aggPlumeToDeg}° (
                    {fiveDaysAggregatedSummary.aggPlumeCompass})
                  </strong>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950/90 border border-indigo-500/40 space-y-1 tabular-nums">
                <div className="flex items-center justify-between text-[10px] text-indigo-300 font-bold uppercase">
                  <span>5-Døgns Nedbør &amp; Temperatur</span>
                  <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-400 text-[10.5px]">Akkumuleret nedbør:</span>
                  <span className="text-sm font-extrabold text-indigo-200">
                    {fiveDaysAggregatedSummary.totalPrecipitation5d} mm
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-300">
                  <span>5d Temperatur-spænd:</span>
                  <strong className="text-white">
                    {fiveDaysAggregatedSummary.minTemp5d}°C til{' '}
                    {fiveDaysAggregatedSummary.maxTemp5d}°C
                  </strong>
                </div>
                <div className="text-[10px] text-slate-400">
                  Våd-deponering &amp; udvaskning i regntimer indregnet
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950/90 border border-rose-500/50 space-y-1 tabular-nums">
                <div className="flex items-center justify-between text-[10px] text-rose-300 font-bold uppercase">
                  <span>Mest Udsatte Receptor (5d)</span>
                  <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="text-xs font-extrabold text-white truncate">
                  {fiveDaysAggregatedSummary.worstDayEntry?.peakReceptorCode}:{' '}
                  {fiveDaysAggregatedSummary.worstDayEntry?.peakReceptorName}
                </div>
                <div className="text-[10.5px] text-amber-300">
                  Kulminerer:{' '}
                  <strong>
                    {fiveDaysAggregatedSummary.worstDayEntry?.weekdayDa} d.{' '}
                    {fiveDaysAggregatedSummary.worstDayEntry?.shortDateDa} kl.{' '}
                    {fiveDaysAggregatedSummary.worstDayEntry?.peakHourLabel}
                  </strong>
                </div>
                <div className="text-[10px] text-slate-300">
                  Maks asbest:{' '}
                  <strong className="text-rose-300">
                    {fiveDaysAggregatedSummary.worstDayEntry?.peakAsbestosFibreCm3.toFixed(4)} fibre/cm³
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================
              DEDIKERET OVERSKUELIG TABEL OVER AGGREGEREDE SUMKVOTIENTER (5 DØGN)
             ================================================================= */}
          <div className="p-3 rounded-md bg-slate-900/95 border-2 border-amber-400/60 space-y-2 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10.5px] uppercase flex items-center gap-1">
                  <Table2 className="w-3.5 h-3.5 shrink-0" />
                  <span>OVERSKUELIG TABEL: AGGREGEREDE SUMKVOTIENTER FOR 5-DØGNS PROGNOSEN (DAG +1 TIL DAG +5)</span>
                </span>
                <span className="text-[11px] text-slate-300">
                  Præsenterer midnats-sumkvotient, døgn-middel <strong className="text-cyan-300">S̄</strong>, døgn-spids{' '}
                  <strong className="text-amber-300">S_max</strong>, ramte <strong className="text-emerald-300">a. Beboede</strong> / <strong className="text-sky-300">c. Renoveringsblokke</strong> samt{' '}
                  <strong className="text-rose-300">Wissenberg PSS 5-dages Støj/Støv-Varsling Status (ID 3.3 &amp; 3.4)</strong>
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Klik på en række for at synkronisere 2D/3D-simulatoren med døgnets spidsbelastning
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] tabular-nums">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-950/90 text-slate-300 text-[10px] uppercase">
                    <th className="py-2 px-2.5">Prognosedøgn</th>
                    <th className="py-2 px-2 text-right text-cyan-300">Midnat S (00.00–00.59)</th>
                    <th className="py-2 px-2 text-right">Døgn-Middel S̄</th>
                    <th className="py-2 px-2 text-right text-amber-300">Døgn-Spids S_max</th>
                    <th className="py-2 px-2 text-right">Asbest (C/GV)</th>
                    <th className="py-2 px-2 text-right text-sky-300">Døgn-Dosis ΣS_døgn</th>
                    <th className="py-2 px-2 text-right text-emerald-300">Akkumuleret 5d ΣS</th>
                    <th className="py-2 px-2 text-center">Timer S ≥ 1,0</th>
                    <th className="py-2 px-2">Ramte Blokke (kat. a / kat. c)</th>
                    <th className="py-2 px-2 text-amber-300">
                      Wissenberg PSS 5-dages Støj/Støv-Varsling Status
                    </th>
                    <th className="py-2 px-2.5 text-right">Grænseværdi-Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {fiveDaysDetailed.map((day, idx) => {
                    const isSelectedRow = day.dayOffset === selectedFiveDayOffset;
                    const runningAccumS =
                      fiveDaysAggregatedSummary.dailyComparisonChartData[idx]
                        ?.accumulatedSumQuotient5d || day.cumulativeDailyDoseS;
                    const isCritical = day.peakS >= 1.0;
                    const isPssNotified = Boolean(
                      pss5DayNotifiedByDayOffset[day.dayOffset]
                    );
                    return (
                      <tr
                        key={`agg-table-${day.dateIso}`}
                        onClick={() => {
                          setSelectedFiveDayOffset(day.dayOffset);
                          onSelectDateAndHour(
                            day.dateIso,
                            day.peakHourIndex,
                            day.dataset
                          );
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelectedRow
                            ? 'bg-amber-500/15 text-white font-semibold'
                            : 'hover:bg-slate-800/75 text-slate-200'
                        }`}
                      >
                        <td className="py-2 px-2.5 font-bold text-white whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 text-[10px] mr-1.5">
                            DAG +{day.dayOffset}
                          </span>
                          {day.weekdayDa} d. {day.shortDateDa}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-cyan-300">
                          {day.midnight00_59.sumQuotient.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-200">
                          {day.meanDailyS.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-extrabold">
                          <span
                            className={
                              isCritical
                                ? 'text-rose-400'
                                : day.peakS >= 0.5
                                ? 'text-amber-300'
                                : 'text-emerald-300'
                            }
                          >
                            {day.peakS.toFixed(2)}
                          </span>{' '}
                          <span className="text-[9.5px] text-slate-400 font-normal">
                            (kl. {day.peakHourLabel})
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-amber-200">
                          {day.peakAsbestosQuotient.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-sky-300">
                          {day.cumulativeDailyDoseS.toFixed(1)}
                        </td>
                        <td className="py-2 px-2 text-right font-extrabold text-emerald-300">
                          {runningAccumS.toFixed(1)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              day.hoursExceedingLimit > 0
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {day.hoursExceedingLimit} timer
                          </span>
                        </td>
                        <td className="py-2 px-2 text-[10px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-emerald-300 truncate max-w-[200px]" title={day.dailyHitInhabitedCodes.join(', ')}>
                              <strong>a. Beboet ({day.dailyHitInhabitedCodes.length}):</strong>{' '}
                              {day.dailyHitInhabitedCodes.slice(0, 4).join(', ')}
                              {day.dailyHitInhabitedCodes.length > 4 ? '…' : ''}
                            </span>
                            <span className="text-sky-300 truncate max-w-[200px]" title={day.dailyHitRenovationCodes.join(', ')}>
                              <strong>c. Renov. ({day.dailyHitRenovationCodes.length}):</strong>{' '}
                              {day.dailyHitRenovationCodes.slice(0, 4).join(', ')}
                              {day.dailyHitRenovationCodes.length > 4 ? '…' : ''}
                            </span>
                          </div>
                        </td>
                        <td
                          className="py-2 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPss5DayNotifiedByDayOffset((prev) => ({
                              ...prev,
                              [day.dayOffset]: !prev[day.dayOffset],
                            }));
                          }}
                          title="Klik for at skifte 5-dages varslingsstatus jf. Wissenberg PSS pkt. 7 ID 3.3 & 3.4 mellem d_under_demolition og tilstødende c_under_renovation blokke"
                        >
                          {isPssNotified ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[9.5px] font-bold inline-flex items-center gap-1">
                              ✓ VARSLET ≥5 DAGE (PSS ID 3.3/3.4 OK)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-950/90 border border-rose-500/70 text-rose-200 text-[9.5px] font-extrabold inline-flex items-center gap-1">
                              ⚠ EJ VARSLET 5 DAGE (PSS ID 3.3/3.4 BRUD)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right whitespace-nowrap">
                          {isCritical ? (
                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[9.5px] font-extrabold">
                              OVERSKRIDELSE (S ≥ 1,0)
                            </span>
                          ) : day.peakS >= 0.5 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[9.5px] font-extrabold">
                              FORHØJET (S ≥ 0,5)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[9.5px] font-bold">
                              UNDER GRÆNSEVÆRDI
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-amber-400/70 bg-slate-950 text-white font-extrabold text-[11px]">
                    <td className="py-2 px-2.5 text-amber-300">
                      5-DØGNS AGGREGERET TOTAL / SPIDS (120 TIMER)
                    </td>
                    <td className="py-2 px-2 text-right text-cyan-300">
                      {nextDayMidnightAnalysis.maxS00.toFixed(2)} (Dag +1)
                    </td>
                    <td className="py-2 px-2 text-right text-white">
                      S̄(5d) = {fiveDaysAggregatedSummary.meanS5d.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-rose-400">
                      S_max(5d) = {fiveDaysAggregatedSummary.peakS5d.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-amber-300">
                      {(fiveDaysAggregatedSummary.worstDayEntry?.peakAsbestosQuotient || 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-sky-300">
                      +{fiveDaysAggregatedSummary.dailyAccumulationSlope}/døgn
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-300">
                      ΣS(120t) = {fiveDaysAggregatedSummary.cumulativeDoseS120h}
                    </td>
                    <td className="py-2 px-2 text-center text-rose-300">
                      {fiveDaysAggregatedSummary.totalExceedanceHours5d}t / 120t
                    </td>
                    <td className="py-2 px-2 text-cyan-300">
                      {fiveDaysAggregatedSummary.worstDayEntry?.peakReceptorCode}:{' '}
                      {fiveDaysAggregatedSummary.worstDayEntry?.peakReceptorName}
                    </td>
                    <td className="py-2 px-2 text-rose-300 text-[10px]">
                      PSS pkt. 7 ID 3.3 &amp; 3.4: 5-dages varsling påkrævet
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[9.5px] font-extrabold">
                        BEK 613 AKKUMULERET
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Hourly Plume-Hit Identification Table for Selected Day in 5-Day Forecast */}
            {(() => {
              const activeDay =
                fiveDaysDetailed.find((d) => d.dayOffset === selectedFiveDayOffset) ||
                fiveDaysDetailed[0];
              if (!activeDay) return null;
              return (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-amber-300 font-bold uppercase">
                      Time-for-Time Støvfane-Træf på {activeDay.weekdayDa} d. {activeDay.dateIso} (DAG +{activeDay.dayOffset}) — 15 a. Beboede &amp; 7 c. Renoveringsblokke:
                    </span>
                    <span className="text-slate-400">
                      Klik på en time for at synkronisere 2D/3D-simulatoren
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-44">
                    <table className="w-full text-left border-collapse text-[10px] font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/90 text-slate-400 uppercase sticky top-0">
                          <th className="py-1 px-2">Time</th>
                          <th className="py-1 px-2">Vind / Fane</th>
                          <th className="py-1 px-2 text-right">Sumkvotient S</th>
                          <th className="py-1 px-2 text-emerald-300">Ramte a. Beboede Blokke</th>
                          <th className="py-1 px-2 text-sky-300">Ramte c. Renoveringsblokke (PSS ID 3.3/3.4)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {activeDay.hourlyEval.map((hr) => (
                          <tr
                            key={`5d-hr-hit-${activeDay.dateIso}-${hr.hourIndex}`}
                            onClick={() =>
                              onSelectDateAndHour(
                                activeDay.dateIso,
                                hr.hourIndex,
                                activeDay.dataset
                              )
                            }
                            className="hover:bg-slate-800/70 cursor-pointer transition-colors"
                          >
                            <td className="py-1 px-2 font-bold text-amber-300">
                              kl. {hr.hourLabel}
                            </td>
                            <td className="py-1 px-2 text-slate-300">
                              {hr.windSpeedMs} m/s → {hr.plumeDirectionDeg}° ({degreesToCompass(hr.plumeDirectionDeg)})
                            </td>
                            <td className="py-1 px-2 text-right font-bold text-white">
                              {hr.sumQuotient.toFixed(2)}
                            </td>
                            <td className="py-1 px-2 text-emerald-200">
                              <strong>{hr.hitInhabitedCodes.length}/{hr.totalInhabitedCount}:</strong>{' '}
                              {hr.hitInhabitedCodes.join(', ') || 'Ingen'}
                            </td>
                            <td className="py-1 px-2 text-sky-200">
                              <strong>{hr.hitRenovationCodes.length}/{hr.totalRenovationCount}:</strong>{' '}
                              {hr.hitRenovationCodes.join(', ') || 'Ingen'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 5-Day Cards Matrix (Day +1 to Day +5) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
            {fiveDaysDetailed.map((day, idx) => {
              const isSel = day.dayOffset === selectedFiveDayOffset;
              const isExceed = day.peakS >= 1.0;
              const accumUpToDay =
                fiveDaysAggregatedSummary.dailyComparisonChartData[idx]
                  ?.accumulatedSumQuotient5d || day.cumulativeDailyDoseS;
              return (
                <div
                  key={day.dateIso}
                  onClick={() => {
                    setSelectedFiveDayOffset(day.dayOffset);
                    onSelectDateAndHour(
                      day.dateIso,
                      day.peakHourIndex,
                      day.dataset
                    );
                  }}
                  className={`p-2.5 rounded-md border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSel
                      ? 'bg-slate-900 border-amber-400 ring-1 ring-amber-400/60 shadow-md'
                      : 'bg-slate-900/75 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-extrabold text-cyan-300">
                        DAG +{day.dayOffset} · {day.weekdayShortDa.toUpperCase()}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold tabular-nums ${
                          isExceed
                            ? 'bg-rose-600 text-white'
                            : day.peakS >= 0.5
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        S_max = {day.peakS.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {day.weekdayDa} d. {day.shortDateDa}
                      </span>
                      <span className="text-[10px] font-bold text-amber-200 tabular-nums">
                        ΣS = {accumUpToDay.toFixed(1)}
                      </span>
                    </div>

                    <div className="p-1.5 rounded bg-slate-950/90 border border-cyan-500/30 text-[10px] space-y-0.5 tabular-nums">
                      <div className="text-cyan-300 font-bold">
                        🕛 Kl. 00.00.00 – 00.59.59:
                      </div>
                      <div className="text-slate-200 flex items-center justify-between">
                        <span>Vind {day.midnight00_59.windSpeedMs} m/s</span>
                        <span className="font-bold text-amber-300">
                          S = {day.midnight00_59.sumQuotient.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Fane → {day.midnight00_59.plumeDirectionDeg}° ({day.midnight00_59.plumeCompass}) · Kl. {day.midnight00_59.pasquillClass}
                      </div>
                    </div>

                    <div className="space-y-1 text-[10.5px] text-slate-300 tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Middel / Maks vind:</span>
                        <strong
                          className={
                            day.maxWindSpeedMs > 10 ? 'text-rose-400' : 'text-white'
                          }
                        >
                          {day.meanWindSpeedMs} / {day.maxWindSpeedMs} m/s
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Dominerende fane:</span>
                        <strong className="text-cyan-300">
                          {day.dominantPlumeDirDeg}° ({day.dominantPlumeCompass})
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Temp / Nedbør:</span>
                        <strong className="text-white">
                          {day.minTempC}–{day.maxTempC}°C · {day.totalPrecipitationMm} mm
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Timer S ≥ 1,0:</span>
                        <strong
                          className={
                            day.hoursExceedingLimit > 0
                              ? 'text-rose-400'
                              : 'text-emerald-300'
                          }
                        >
                          {day.hoursExceedingLimit}t · {day.peakReceptorCode} (kl. {day.peakHourLabel})
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (day.dayOffset === 1) {
                          onChangeMode('next_day_00_00_59');
                        }
                        onSelectDateAndHour(day.dateIso, 0, day.dataset);
                      }}
                      className="px-1.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 font-bold text-[10px] text-center cursor-pointer"
                      title={`Indlæs ${day.dateIso} kl. 00.00.00 - 00.59.59 i 2D/3D simulatoren`}
                    >
                      00.00–00.59
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFiveDayOffset(day.dayOffset);
                        onSelectDateAndHour(
                          day.dateIso,
                          day.peakHourIndex,
                          day.dataset
                        );
                      }}
                      className="px-1.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10px] text-center cursor-pointer"
                      title={`Indlæs spidsbelastningstimen kl. ${day.peakHourLabel} på ${day.dateIso} i 2D/3D simulatoren`}
                    >
                      Spids {day.peakHourLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ELEMENT 4: INTERACTIVE RECHARTS ACCUMULATED SUM QUOTIENT TREND OVER 5 DAYS + RECEPTOR MATRIX */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left 6 cols: Receptor × 5-Day Sum Quotient Aggregation Table */}
            <div className="lg:col-span-6 p-3 rounded bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[11px] font-bold uppercase text-amber-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>5-Døgns Sumkvotient-Matrix &amp; Akkumuleret ΣS pr. Receptor</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Klik på en receptor for at se dens 5-døgns ΣS-tendens
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[10.5px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                      <th className="py-1 pr-2">Receptor</th>
                      {fiveDaysDetailed.map((d) => (
                        <th key={`th-${d.dateIso}`} className="py-1 px-1 text-center">
                          D+{d.dayOffset}
                        </th>
                      ))}
                      <th className="py-1 px-1 text-right text-amber-300">5d S_max</th>
                      <th className="py-1 pl-1 text-right text-cyan-300">5d ΣS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {fiveDaysAggregatedSummary.receptor5dMatrix.map((row) => {
                      const isSel = selectedReceptorId === row.receptorId;
                      return (
                        <tr
                          key={`r5d-${row.receptorId}`}
                          onClick={() => onSelectReceptor(row.receptorId)}
                          className={`cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-amber-500/15 text-white font-bold'
                              : 'hover:bg-slate-800/70 text-slate-200'
                          }`}
                        >
                          <td className="py-1.5 pr-2 truncate max-w-[135px]">
                            <span className="font-bold text-cyan-300">{row.receptorCode}</span>:{' '}
                            {row.receptorName}
                          </td>
                          {row.dailyValues.map((dv) => (
                            <td
                              key={`cell-${row.receptorId}-${dv.dateIso}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectReceptor(row.receptorId);
                                setSelectedFiveDayOffset(dv.dayOffset);
                                onSelectDateAndHour(
                                  dv.dateIso,
                                  dv.peakHourIndex,
                                  dv.dataset
                                );
                              }}
                              className="py-1.5 px-1 text-center hover:bg-slate-800 rounded"
                              title={`${row.receptorCode} d. ${dv.dateIso} kl. ${String(dv.peakHourIndex).padStart(2, '0')}:00: S_max = ${dv.peakS.toFixed(2)}, døgn-dosis ΣS = ${dv.cumulativeS.toFixed(1)}`}
                            >
                              <span
                                className={`font-bold ${
                                  dv.peakS >= 1.0
                                    ? 'text-rose-400'
                                    : dv.peakS >= 0.5
                                    ? 'text-amber-300'
                                    : 'text-emerald-300'
                                }`}
                              >
                                {dv.peakS.toFixed(2)}
                              </span>
                            </td>
                          ))}
                          <td className="py-1.5 px-1 text-right font-extrabold">
                            <span
                              className={
                                row.recPeak5d >= 1.0
                                  ? 'text-rose-400'
                                  : row.recPeak5d >= 0.5
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                              }
                            >
                              {row.recPeak5d.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-1.5 pl-1 text-right font-extrabold text-cyan-300">
                            {row.recCumulative5d.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 6 cols: Interactive Recharts Graph with Accumulated Sum Quotient Trend over 5 Days */}
            <div className="lg:col-span-6 p-3 rounded bg-slate-900/90 border border-amber-500/40 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setFiveDayChartSubView('accumulated_trend_5d')
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                      fiveDayChartSubView === 'accumulated_trend_5d'
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-slate-950 text-amber-200 border border-slate-700'
                    }`}
                    title="Vis akkumuleret sumkvotient-tendens (ΣS) over de 5 dage ved hjælp af Recharts"
                  >
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>Akkumuleret ΣS-Tendens (5 Dage)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFiveDayChartSubView('accumulated_trend_120h')
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      fiveDayChartSubView === 'accumulated_trend_120h'
                        ? 'bg-fuchsia-400 text-slate-950 shadow-xs'
                        : 'bg-slate-950 text-fuchsia-200 border border-slate-700'
                    }`}
                    title="Vis 120-timers løbende akkumuleret sumkvotient-tendens time for time"
                  >
                    120t Akkumuleret ΣS-Kurve
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiveDayChartSubView('daily_5d')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      fiveDayChartSubView === 'daily_5d'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-950 text-cyan-200 border border-slate-700'
                    }`}
                  >
                    Daglig S_max &amp; Vind
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiveDayChartSubView('selected_day_24h')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      fiveDayChartSubView === 'selected_day_24h'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-950 text-emerald-200 border border-slate-700'
                    }`}
                  >
                    Dag +{selectedFiveDayEntry?.dayOffset} (24t)
                  </button>
                </div>
                <span className="text-[10px] text-slate-400">
                  Valgt receptor: <strong className="text-cyan-300">{selectedReceptorMeta?.code}</strong>
                </span>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {fiveDayChartSubView === 'accumulated_trend_5d' ? (
                    <ComposedChart
                      data={fiveDaysAggregatedSummary.dailyComparisonChartData}
                      onClick={(st) => {
                        if (st && typeof st.activeTooltipIndex === 'number') {
                          const dayObj =
                            fiveDaysDetailed[st.activeTooltipIndex];
                          if (dayObj) {
                            setSelectedFiveDayOffset(dayObj.dayOffset);
                            onSelectDateAndHour(
                              dayObj.dateIso,
                              dayObj.peakHourIndex,
                              dayObj.dataset
                            );
                          }
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="shortDayLabel"
                        stroke="#94a3b8"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#fbbf24"
                        tick={{ fontSize: 10 }}
                        label={{
                          value: 'Akkumuleret ΣS',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#fbbf24',
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          borderColor: '#fbbf24',
                          fontSize: '11px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="accumulatedSumQuotient5d"
                        name="Akkumuleret Sumkvotient ΣS (5d)"
                        fill="#f59e0b"
                        fillOpacity={0.25}
                        stroke="#fbbf24"
                        strokeWidth={2.5}
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="accumulatedSelectedReceptor5d"
                        name={`Akkumuleret ΣS (${selectedReceptorMeta?.code || 'Valgt'})`}
                        fill="#22d3ee"
                        fillOpacity={0.18}
                        stroke="#22d3ee"
                        strokeWidth={2}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="dailyDoseS"
                        name="Dagligt ΣS-Bidrag"
                        fill="#38bdf8"
                        radius={[2, 2, 0, 0]}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="linearTrendAccumulated5d"
                        name="Lineær 5d Trendlinje"
                        stroke="#f43f5e"
                        strokeDasharray="4 2"
                        strokeWidth={1.8}
                        dot={false}
                      />
                    </ComposedChart>
                  ) : fiveDayChartSubView === 'accumulated_trend_120h' ? (
                    <ComposedChart
                      data={fiveDaysAggregatedSummary.all120Hours}
                      onClick={(st) => {
                        if (st && typeof st.activeTooltipIndex === 'number') {
                          const hrObj =
                            fiveDaysAggregatedSummary.all120Hours[
                              st.activeTooltipIndex
                            ];
                          if (hrObj) {
                            setSelectedFiveDayOffset(hrObj.dayOffset);
                            onSelectDateAndHour(
                              hrObj.dateIso,
                              hrObj.hourIndex,
                              hrObj.dataset
                            );
                          }
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="dayShortLabel"
                        stroke="#94a3b8"
                        tick={{ fontSize: 9 }}
                        interval={11}
                      />
                      <YAxis yAxisId="left" stroke="#e879f9" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          borderColor: '#e879f9',
                          fontSize: '11px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="accumulatedSiteSumQuotient"
                        name="120t Akkumuleret ΣS (Total)"
                        fill="#d946ef"
                        fillOpacity={0.25}
                        stroke="#e879f9"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="accumulatedSelectedRecSumQuotient"
                        name={`120t ΣS (${selectedReceptorMeta?.code || 'Valgt'})`}
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="linearTrendAccumulatedS"
                        name="Lineær Trend"
                        stroke="#fbbf24"
                        strokeDasharray="4 2"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </ComposedChart>
                  ) : fiveDayChartSubView === 'daily_5d' ? (
                    <ComposedChart
                      data={fiveDaysAggregatedSummary.dailyComparisonChartData}
                      onClick={(st) => {
                        if (st && typeof st.activeTooltipIndex === 'number') {
                          const dayObj =
                            fiveDaysDetailed[st.activeTooltipIndex];
                          if (dayObj) {
                            setSelectedFiveDayOffset(dayObj.dayOffset);
                            onSelectDateAndHour(
                              dayObj.dateIso,
                              dayObj.peakHourIndex,
                              dayObj.dataset
                            );
                          }
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="shortDayLabel"
                        stroke="#94a3b8"
                        tick={{ fontSize: 9.5 }}
                      />
                      <YAxis yAxisId="left" stroke="#fbbf24" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          borderColor: '#fbbf24',
                          fontSize: '11px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <ReferenceLine
                        yAxisId="left"
                        y={1.0}
                        stroke="#f43f5e"
                        strokeDasharray="4 2"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="peakS"
                        name="Døgn-Spids S_max"
                        fill="#f59e0b"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="meanDailyS"
                        name="Døgn-Middel S̄"
                        fill="#22d3ee"
                        radius={[2, 2, 0, 0]}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="maxWindSpeedMs"
                        name="Maks Vind (m/s)"
                        stroke="#38bdf8"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  ) : (
                    <ComposedChart
                      data={selectedFiveDayEntry?.hourlyEval || []}
                      onClick={(st) => {
                        if (
                          selectedFiveDayEntry &&
                          st &&
                          typeof st.activeTooltipIndex === 'number'
                        ) {
                          const hrEntry =
                            selectedFiveDayEntry.hourlyEval[
                              st.activeTooltipIndex
                            ];
                          if (hrEntry) {
                            onSelectDateAndHour(
                              selectedFiveDayEntry.dateIso,
                              hrEntry.hourIndex,
                              selectedFiveDayEntry.dataset
                            );
                          }
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="hourLabel"
                        stroke="#94a3b8"
                        tick={{ fontSize: 10 }}
                        interval={2}
                      />
                      <YAxis yAxisId="left" stroke="#fbbf24" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          borderColor: '#fbbf24',
                          fontSize: '11px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <ReferenceLine
                        yAxisId="left"
                        y={1.0}
                        stroke="#f43f5e"
                        strokeDasharray="4 2"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="sumQuotient"
                        name="Sumkvotient S"
                        fill="#f59e0b"
                        radius={[2, 2, 0, 0]}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="windSpeedMs"
                        name="Vindhastighed (m/s)"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ELEMENT 3 — MODE 3: DEDIKERET 'VEJRUDSIGT-INDLÆG' & LÆSBAR BEBOER-KOMMUNIKATIONSRAPPORT
         ===================================================================== */}
      {mode === 'weather_broadcast_segment' && (
        <div
          ref={broadcastFocusPanelRef}
          tabIndex={-1}
          aria-label="Vejrudsigt-indlæg: Læsbar 5-døgns tekstlig rapport til beboer-kommunikation"
          className="space-y-3 focus:outline-none"
        >
          {/* TV / Resident Communication Header Banner */}
          <div className="p-3.5 rounded-md bg-gradient-to-r from-emerald-950/85 via-slate-900 to-cyan-950/85 border-2 border-emerald-400/70 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/30 pb-2.5">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-emerald-400 text-slate-950 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5 shrink-0" />
                    <span>VEJRUDSIGT-INDLÆG &amp; BEBOER-KOMMUNIKATIONSRAPPORT (5 DØGN)</span>
                  </span>
                  <span className="text-xs font-bold text-white">
                    Læsbar 5-Døgns Miljø- &amp; Spredningsudsigt for Beboere omkring Ringparken, 4200 Slagelse
                  </span>
                </div>
                <p className="text-[11px] text-slate-200">
                  Formaterer 5-døgns prognosen og midnats-varslet (<strong className="text-cyan-300">kl. 00.00.00 – 00.59.59</strong>) til en letforståelig tekstlig beboer-rapport med dag-for-dag handlingsanbefalinger.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Style Selector for Resident Communication vs. TV Segment vs. Board Brief */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-emerald-500/40">
                  <button
                    type="button"
                    onClick={() => setResidentReportStyle('resident_notice')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                      residentReportStyle === 'resident_notice'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-emerald-200 hover:bg-slate-900'
                    }`}
                  >
                    <Home className="w-3 h-3 shrink-0" />
                    <span>Beboer-Rapport (Husstande)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResidentReportStyle('tv_weather_segment')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                      residentReportStyle === 'tv_weather_segment'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-cyan-200 hover:bg-slate-900'
                    }`}
                  >
                    <Radio className="w-3 h-3 shrink-0" />
                    <span>TV/Radio Vejrudsigt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setResidentReportStyle('board_authority_brief')
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                      residentReportStyle === 'board_authority_brief'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-amber-200 hover:bg-slate-900'
                    }`}
                  >
                    <BookOpen className="w-3 h-3 shrink-0" />
                    <span>Afdelingsbestyrelse</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyBroadcastManuscript}
                  className={`px-2.5 py-1 rounded font-bold text-[11px] flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    copiedBroadcastText
                      ? 'bg-emerald-400 text-slate-950 border-white'
                      : 'bg-slate-950 hover:bg-slate-900 text-emerald-200 border-emerald-400/60'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {copiedBroadcastText
                      ? '✓ Beboer-rapport kopieret!'
                      : 'Kopiér Beboer-Rapport'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadResidentReportTxt}
                  className={`px-2.5 py-1 rounded font-bold text-[11px] flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    downloadedTxtSuccess
                      ? 'bg-emerald-400 text-slate-950 border-white'
                      : 'bg-slate-950 hover:bg-slate-900 text-cyan-200 border-cyan-400/60'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {downloadedTxtSuccess
                      ? '✓ Downloadet (.txt)!'
                      : 'Download Rapport (.txt)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleExportForecastReportPdf('weather_broadcast_segment')
                  }
                  className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 border border-amber-200 transition-colors cursor-pointer"
                  title="Eksportér Vejrudsigt-Indlægget og de grafiske sammenligninger direkte som PDF"
                >
                  <FileDown className="w-3.5 h-3.5 shrink-0" />
                  <span>Eksportér Beboer-Rapport (PDF inkl. Grafer)</span>
                </button>
              </div>
            </div>

            {/* Automatisk Genereret Beboer-Venlig Spredningsrisiko-Profil pr. Boligblok i Ringparken */}
            <div className="p-2.5 rounded bg-slate-950/90 border border-emerald-500/40 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10.5px] font-extrabold uppercase text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    AUTOMATISK 5-DØGNS SPREDNINGSRISIKO-PROFIL FOR BOLIGAFSNIT OMKRING RINGPARKEN
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Beregnet ud fra 5-døgns prognosens vindretninger, nedbør og sumkvotienter (R1–R6)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {fiveDaysAggregatedSummary.receptor5dMatrix.map((recRow) => {
                  const isHighRiskRec = recRow.recPeak5d >= 1.0;
                  const isElevatedRec = recRow.recPeak5d >= 0.5 && !isHighRiskRec;
                  const residentActionSummary = isHighRiskRec
                    ? `Høj spredningsrisiko (${recRow.recExceedHours5d} timer S ≥ 1,0). Hold vinduer og altandøre lukkede omkring kl. ${String(recRow.peakHourIndex).padStart(2, '0')}:00 på ${recRow.peakDateIso}.`
                    : isElevatedRec
                    ? `Moderat/forhøjet spredningsrisiko (S_max = ${recRow.recPeak5d.toFixed(2)}). Undgå gennemtræk mod byggepladsen omkring kl. ${String(recRow.peakHourIndex).padStart(2, '0')}:00.`
                    : `Lav spredningsrisiko i 5-døgns perioden (S_max = ${recRow.recPeak5d.toFixed(2)}). Almindelig udluftning kan foretages.`;
                  return (
                    <div
                      key={`res-rec-card-${recRow.receptorId}`}
                      onClick={() => {
                        onSelectReceptor(recRow.receptorId);
                        if (recRow.peakDataset) {
                          onSelectDateAndHour(
                            recRow.peakDateIso,
                            recRow.peakHourIndex,
                            recRow.peakDataset
                          );
                        }
                      }}
                      className="p-2 rounded bg-slate-900/90 border border-slate-800 hover:border-emerald-400/60 cursor-pointer space-y-1 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10.5px] font-extrabold text-white truncate">
                          <span className="text-cyan-300">{recRow.receptorCode}</span>:{' '}
                          {recRow.receptorName}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold tabular-nums ${
                            isHighRiskRec
                              ? 'bg-rose-600 text-white'
                              : isElevatedRec
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          5d S_max = {recRow.recPeak5d.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-snug">
                        {residentActionSummary}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Broadcast Visual Synopsis Strip: Card 0 = Døgnet efter 00.00.00-00.59.59 + Cards 1..5 = Fem døgns prognose */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
              {/* Special Card 0: Døgnet efter kl. 00.00.00 - 00.59.59 */}
              <div
                onClick={() => {
                  onChangeMode('next_day_00_00_59');
                  onSelectDateAndHour(
                    nextDayMidnightAnalysis.dateIso,
                    0,
                    nextDayForecast.dataset
                  );
                }}
                className="p-2.5 rounded bg-cyan-950/70 border-2 border-cyan-400/80 cursor-pointer hover:bg-cyan-900/60 transition-all space-y-1"
                title="Klik for at fokusere på Døgnet efter fra klokken 00.00.00 - 00.59.59"
              >
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-400 text-slate-950 font-extrabold text-[9.5px]">
                    NAT-VARSEL 00.00–00.59
                  </span>
                  <Clock className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <div className="text-[11px] font-bold text-white">
                  {nextDayMidnightAnalysis.weekdayDa} kl. 00.00.00–00.59.59
                </div>
                <div className="text-[10px] text-cyan-200 tabular-nums">
                  Vind {nextDayMidnightAnalysis.hr00.windSpeed10m} m/s → Fane{' '}
                  {nextDayMidnightAnalysis.plumeDir00}° ({nextDayMidnightAnalysis.plumeCompass00})
                </div>
                <div className="pt-1 border-t border-cyan-500/30 flex items-center justify-between text-[10.5px] font-extrabold">
                  <span className="text-amber-300">
                    S = {nextDayMidnightAnalysis.maxS00.toFixed(2)}
                  </span>
                  <span className="text-cyan-200">
                    {nextDayMidnightAnalysis.worstRec00?.receptorCode}
                  </span>
                </div>
              </div>

              {/* 5-Day TV Weather Cards */}
              {fiveDaysDetailed.map((day) => {
                const badge =
                  day.weatherSynopsis === 'STORM_DUST'
                    ? {
                        label: '🌪️ KRAFTIG STØVFLUGT',
                        cls: 'bg-rose-600 text-white',
                      }
                    : day.weatherSynopsis === 'RAIN_WASHOUT'
                    ? {
                        label: '🌧️ REGN & UDVASKNING',
                        cls: 'bg-indigo-500 text-white',
                      }
                    : day.weatherSynopsis === 'INVERSION_STAGNATION'
                    ? {
                        label: '🌫️ NAT-INVERSION',
                        cls: 'bg-amber-400 text-slate-950',
                      }
                    : {
                        label: '💨 MODERAT SPREDNING',
                        cls: 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50',
                      };

                return (
                  <div
                    key={`bcast-${day.dateIso}`}
                    onClick={() => {
                      onChangeMode('five_day_forecast');
                      setSelectedFiveDayOffset(day.dayOffset);
                      onSelectDateAndHour(
                        day.dateIso,
                        day.peakHourIndex,
                        day.dataset
                      );
                    }}
                    className="p-2.5 rounded bg-slate-950/90 border border-slate-700 hover:border-emerald-400 transition-all cursor-pointer space-y-1"
                    title="Klik for at åbne dette døgn i Fem døgns prognosen og simulere i 2D/3D"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-extrabold text-emerald-300">
                        {day.weekdayShortDa.toUpperCase()} {day.shortDateDa}
                      </span>
                      <span
                        className={`px-1 py-0.2 rounded text-[9px] font-extrabold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-white font-bold tabular-nums">
                      {day.minTempC}° / {day.maxTempC}°C · {day.maxWindSpeedMs} m/s
                    </div>
                    <div className="text-[10px] text-slate-300 tabular-nums">
                      Fane → {day.dominantPlumeDirDeg}° ({day.dominantPlumeCompass}) · {day.totalPrecipitationMm} mm
                    </div>
                    <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[10px] font-bold tabular-nums">
                      <span
                        className={
                          day.peakS >= 1.0 ? 'text-rose-400' : 'text-amber-300'
                        }
                      >
                        S_max = {day.peakS.toFixed(2)}
                      </span>
                      <span className="text-slate-400">
                        S̄={day.meanDailyS.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Structured Day-by-Day Resident Communication Cards + Full Printable Manuscript */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Left 5 cols: Day-by-Day Resident Action Guide */}
              <div className="lg:col-span-5 p-3 rounded bg-slate-950/95 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-emerald-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Dag-for-Dag Beboer-Handlingsplan (5 Døgn)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Konkrete råd pr. døgn</span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {fiveDaysDetailed.map((d) => {
                    const isHigh = d.peakS >= 1.0;
                    const residentInstruction = isHigh
                      ? `Luk vinduer og friskluftventiler mod byggepladsen kl. ${d.peakHourLabel} (S_max = ${d.peakS.toFixed(2)} ved ${d.peakReceptorName}).`
                      : d.totalPrecipitationMm >= 3.5
                      ? `Regn (${d.totalPrecipitationMm} mm) binder svævestøv, men undgå kontakt med overfladevand ved udkørsler.`
                      : `Moderat spredning mod ${d.dominantPlumeCompass}. Udluftning anbefales uden for kl. ${d.peakHourLabel}.`;

                    return (
                      <div
                        key={`res-guide-${d.dateIso}`}
                        onClick={() =>
                          onSelectDateAndHour(
                            d.dateIso,
                            d.peakHourIndex,
                            d.dataset
                          )
                        }
                        className="p-2 rounded bg-slate-900/90 border border-slate-800 hover:border-emerald-400/60 cursor-pointer space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-[10.5px] font-bold">
                          <span className="text-white">
                            Dag +{d.dayOffset}: {d.weekdayDa} d. {d.shortDateDa}
                          </span>
                          <span
                            className={
                              isHigh ? 'text-rose-400' : 'text-amber-300'
                            }
                          >
                            Spids kl. {d.peakHourLabel} (S = {d.peakS.toFixed(2)})
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-snug">
                          {residentInstruction}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 7 cols: Full Readable Textual Resident Report */}
              <div className="lg:col-span-7 p-3 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-emerald-300 font-bold uppercase">
                  <span>
                    Læsbar Tekstlig 5-Døgns Rapport til Beboer-Kommunikation &amp; Vejrudsigt-Indlæg
                  </span>
                  <span className="text-slate-400">
                    Klar til beboeropslag, nyhedsbrev eller sagsakter
                  </span>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-100 bg-slate-900/85 p-3 rounded border border-slate-800 max-h-60 overflow-y-auto">
                  {broadcastManuscript}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
