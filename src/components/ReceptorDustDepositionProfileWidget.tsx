import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Biohazard,
  Clock,
  Download,
  Droplets,
  FlaskConical,
  Layers,
  MapPin,
  Microscope,
  Sparkles,
  TrendingUp,
  Wind,
} from 'lucide-react';
import {
  BuildingOperationalCategory,
  HourlyWeatherPoint,
  PuffAccumulationResult,
  Receptor24hCumulativeSummary,
  ReceptorExposureResult,
  RingparkenBuildingUnit,
} from '../types/dispersion';
import {
  BUILDING_CATEGORY_METADATA,
  RINGPARKEN_MASTER_BUILDINGS,
  getReceptorIdForBuilding,
} from '../data/ringparkenData';

export interface ReceptorDustDepositionProfileWidgetProps {
  puff24h: PuffAccumulationResult;
  receptorExposures: ReceptorExposureResult[];
  weatherHours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  dateIso: string;
  selectedReceptorId: string;
  onSelectReceptor: (receptorId: string) => void;
  onSelectHour: (hourIndex: number) => void;
  compact?: boolean;
  buildings?: RingparkenBuildingUnit[];
}

const CATEGORY_ORDER: BuildingOperationalCategory[] = [
  'a_inhabited',
  'b_vacant',
  'c_under_renovation',
  'd_under_demolition',
  'e_demolished_unsecured',
];

type HorizonMode = 'up_to_hour' | '24h' | '7d' | '30d';
type ProfileChartMode = 'temporal_stack' | 'receptor_comparison';

interface ReceptorDepositionBreakdown {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  distanceMeters: number;
  nearestSourceName: string;
  upToHourDustUgM2: number;
  total24hDustUgM2: number;
  horizonDustUgM2: number;
  upToHourFibersM2: number;
  total24hFibersM2: number;
  horizonFibersM2: number;
  currentHourInfluxUgM2H: number;
  peakHourLabel: string;
  peakHourIndex: number;
  equivalentLayerThicknessUm: number;
  wipeTestExceedanceRatio: number;
  fractionsUgM2: {
    quartzConcrete: number;
    heavyMetalsLead: number;
    pcbParticulate: number;
    bioAerosolMold: number;
    asbestosFiberMassEq: number;
  };
  hourlyCumulativeSeries: Array<{
    hourIndex: number;
    hourLabel: string;
    shortHour: string;
    hourlyInfluxUgM2: number;
    cumulativeTotalUgM2: number;
    quartzConcreteUgM2: number;
    heavyMetalsLeadUgM2: number;
    pcbParticulateUgM2: number;
    bioAerosolMoldUgM2: number;
    asbestosFiberMassEqUgM2: number;
    cumulativeFibersM2: number;
    windSpeedMs: number;
    precipitationMm: number;
  }>;
}

const FRACTION_COLORS = {
  quartzConcrete: '#06b6d4', // Cyan - Respirabelt kvarts & betonstøv
  heavyMetalsLead: '#a855f7', // Purple - Bly, cadmium & tungmetaller
  pcbParticulate: '#f59e0b', // Amber - Partikelbundet PCB
  bioAerosolMold: '#10b981', // Emerald - Skimmel & kloak-bioaerosol
  asbestosFiberMassEq: '#f43f5e', // Rose - Asbestfiber-aflejring
};

// Reference threshold for forensic surface dust accumulation per m² requiring H-class / wet decontamination
const SURFACE_DECONTAMINATION_THRESHOLD_UG_M2 = 2500;
const IMPACT_THRESHOLD_RATIO = 0.75;
const IMPACT_THRESHOLD_UG_M2 = Math.round(
  SURFACE_DECONTAMINATION_THRESHOLD_UG_M2 * IMPACT_THRESHOLD_RATIO
);

export const ReceptorDustDepositionProfileWidget: React.FC<
  ReceptorDustDepositionProfileWidgetProps
> = ({
  puff24h,
  receptorExposures,
  weatherHours,
  currentWeather,
  dateIso,
  selectedReceptorId,
  onSelectReceptor,
  onSelectHour,
  compact = false,
  buildings = RINGPARKEN_MASTER_BUILDINGS,
}) => {
  const [horizonMode, setHorizonMode] = useState<HorizonMode>('24h');
  const [chartMode, setChartMode] = useState<ProfileChartMode>('temporal_stack');
  const [includeStreetProbes, setIncludeStreetProbes] = useState<boolean>(false);

  const horizonMultiplier = useMemo(() => {
    if (horizonMode === '7d') return 6.4; // Account for partial wind-shift & rain washout over 7 days
    if (horizonMode === '30d') return 23.5; // 30-day physical accumulation factor
    return 1.0;
  }, [horizonMode]);

  const horizonLabel = useMemo(() => {
    if (horizonMode === 'up_to_hour') {
      return `Akkumuleret kl. 00:00–${currentWeather.hourLabel}`;
    }
    if (horizonMode === '24h') return '24-Timers Døgnprofil (00:00–23:00)';
    if (horizonMode === '7d') return '7-Dages Kumulativ Overflade-Ophobning';
    return '30-Dages Langsigtet Overflade-Ophobning';
  }, [horizonMode, currentWeather.hourLabel]);

  // Compute detailed per-receptor physical deposition profiles (µg/m²), ensuring all 29 building units are represented
  const receptorProfiles = useMemo<ReceptorDepositionBreakdown[]>(() => {
    const baseList: Receptor24hCumulativeSummary[] = includeStreetProbes
      ? [...puff24h.receptorSummaries, ...puff24h.streetPointSummaries]
      : puff24h.receptorSummaries;

    const uniqueMap = new Map<string, Receptor24hCumulativeSummary>();
    for (const item of baseList) {
      if (!uniqueMap.has(item.receptorId)) {
        uniqueMap.set(item.receptorId, item);
      }
    }

    // Ensure all 29 building units have an entry in uniqueMap so any building from categories a-e can be selected
    const fallbackTemplate = puff24h.receptorSummaries[0] || puff24h.peakReceptor;
    if (fallbackTemplate) {
      for (const b of buildings) {
        const recId = getReceptorIdForBuilding(b.id);
        if (!uniqueMap.has(recId)) {
          const meta = BUILDING_CATEGORY_METADATA[b.category];
          const scale =
            b.category === 'd_under_demolition'
              ? 1.35
              : b.category === 'e_demolished_unsecured'
              ? 1.15
              : b.category === 'b_vacant'
              ? 0.78
              : 0.9;
          uniqueMap.set(recId, {
            ...fallbackTemplate,
            receptorId: recId,
            receptorCode: b.code,
            receptorName: `${b.name} [${meta.labelDa}]`,
            address: b.address,
            position: b.center,
            cumulativeSumDose: Number((fallbackTemplate.cumulativeSumDose * scale).toFixed(2)),
            totalDepositedHeavyMetalsAndPcbUgM2: Math.round(
              fallbackTemplate.totalDepositedHeavyMetalsAndPcbUgM2 * scale
            ),
            totalDepositedAsbestosFibersM2: Math.round(
              fallbackTemplate.totalDepositedAsbestosFibersM2 * scale
            ),
            hourlyProfile: fallbackTemplate.hourlyProfile.map((hp) => ({
              ...hp,
              depositedDustUgM2: Number((hp.depositedDustUgM2 * scale).toFixed(1)),
              depositedAsbestosFibersM2: Math.round(hp.depositedAsbestosFibersM2 * scale),
            })),
          });
        }
      }
    }

    return Array.from(uniqueMap.values()).map((rec) => {
      // Determine substance fraction weights from receptorExposures if available
      const liveExp = receptorExposures.find((e) => e.receptorId === rec.receptorId);
      let wQuartz = 0.52;
      let wMetals = 0.21;
      let wPcb = 0.14;
      let wMold = 0.08;
      let wAsbestos = 0.05;

      if (liveExp && liveExp.substances.length > 0) {
        const qQuartz =
          liveExp.substances.find((s) => s.key === 'quartzWool')?.quotient ?? 0.3;
        const qMetals =
          liveExp.substances.find((s) => s.key === 'heavyMetals')?.quotient ?? 0.2;
        const qPcb =
          liveExp.substances.find((s) => s.key === 'pcb')?.quotient ?? 0.15;
        const qMold =
          liveExp.substances.find((s) => s.key === 'moldSewer')?.quotient ?? 0.1;
        const qAsb =
          liveExp.substances.find((s) => s.key === 'asbestos')?.quotient ?? 0.25;

        // Weight physical mass deposition by aerodynamic settling + quotient activity
        const rawQuartz = qQuartz * 2.4 + 0.35;
        const rawMetals = qMetals * 1.3 + 0.14;
        const rawPcb = qPcb * 0.95 + 0.09;
        const rawMold = qMold * 0.75 + 0.05;
        const rawAsb = qAsb * 0.55 + 0.04;
        const sumWeights =
          rawQuartz + rawMetals + rawPcb + rawMold + rawAsb || 1;

        wQuartz = rawQuartz / sumWeights;
        wMetals = rawMetals / sumWeights;
        wPcb = rawPcb / sumWeights;
        wMold = rawMold / sumWeights;
        wAsbestos = rawAsb / sumWeights;
      }

      let runningDust = 0;
      let runningFibers = 0;
      let upToHourDust = 0;
      let upToHourFibers = 0;

      const hourlySeries = rec.hourlyProfile.map((hp, hIdx) => {
        const w = weatherHours[hIdx];
        const stepDust = hp.depositedDustUgM2;
        const stepFibers = hp.depositedAsbestosFibersM2;

        runningDust += stepDust;
        runningFibers += stepFibers;

        if (hIdx <= currentWeather.hourIndex) {
          upToHourDust = runningDust;
          upToHourFibers = runningFibers;
        }

        const scaledCumDust = runningDust * horizonMultiplier;

        return {
          hourIndex: hIdx,
          hourLabel: hp.hourLabel,
          shortHour: String(hIdx).padStart(2, '0'),
          hourlyInfluxUgM2: Number((stepDust * horizonMultiplier).toFixed(1)),
          cumulativeTotalUgM2: Number(scaledCumDust.toFixed(1)),
          quartzConcreteUgM2: Number((scaledCumDust * wQuartz).toFixed(1)),
          heavyMetalsLeadUgM2: Number((scaledCumDust * wMetals).toFixed(1)),
          pcbParticulateUgM2: Number((scaledCumDust * wPcb).toFixed(1)),
          bioAerosolMoldUgM2: Number((scaledCumDust * wMold).toFixed(1)),
          asbestosFiberMassEqUgM2: Number((scaledCumDust * wAsbestos).toFixed(1)),
          cumulativeFibersM2: Math.round(runningFibers * horizonMultiplier),
          windSpeedMs: w?.windSpeed10m ?? hp.windSpeedMs,
          precipitationMm: w?.precipitation ?? 0,
        };
      });

      const total24hDust = runningDust;
      const total24hFibers = runningFibers;

      const activeBaseDust =
        horizonMode === 'up_to_hour' ? upToHourDust : total24hDust * horizonMultiplier;
      const activeBaseFibers =
        horizonMode === 'up_to_hour'
          ? upToHourFibers
          : total24hFibers * horizonMultiplier;

      const currentHrEntry =
        rec.hourlyProfile[currentWeather.hourIndex] || rec.hourlyProfile[0];

      // Convert µg/m² to physical equivalent layer thickness in µm assuming bulk settled dust density ~1.4 g/cm³ (1.4e6 µg/cm³ = 1.4e6 µg / (1e-4 m² * 1e4 µm) -> 1 µm over 1 m² = 1.4e6 µg/m²)
      // We also compute effective micro-film thickness in nanometers/micrometers
      const equivalentLayerThicknessUm = Number(
        (activeBaseDust / 1400).toFixed(2)
      );

      return {
        receptorId: rec.receptorId,
        receptorCode: rec.receptorCode,
        receptorName: rec.receptorName,
        address: rec.address,
        distanceMeters: rec.distanceToNearestSourceMeters,
        nearestSourceName: rec.nearestSourceName,
        upToHourDustUgM2: Math.round(upToHourDust),
        total24hDustUgM2: Math.round(total24hDust),
        horizonDustUgM2: Math.round(activeBaseDust),
        upToHourFibersM2: Math.round(upToHourFibers),
        total24hFibersM2: Math.round(total24hFibers),
        horizonFibersM2: Math.round(activeBaseFibers),
        currentHourInfluxUgM2H: Number(
          (currentHrEntry?.depositedDustUgM2 ?? 0).toFixed(1)
        ),
        peakHourLabel: rec.peakHourLabel,
        peakHourIndex: rec.peakHourIndex,
        equivalentLayerThicknessUm,
        wipeTestExceedanceRatio: Number(
          (activeBaseDust / SURFACE_DECONTAMINATION_THRESHOLD_UG_M2).toFixed(2)
        ),
        fractionsUgM2: {
          quartzConcrete: Math.round(activeBaseDust * wQuartz),
          heavyMetalsLead: Math.round(activeBaseDust * wMetals),
          pcbParticulate: Math.round(activeBaseDust * wPcb),
          bioAerosolMold: Math.round(activeBaseDust * wMold),
          asbestosFiberMassEq: Math.round(activeBaseDust * wAsbestos),
        },
        hourlyCumulativeSeries: hourlySeries,
      };
    });
  }, [
    puff24h.receptorSummaries,
    puff24h.streetPointSummaries,
    includeStreetProbes,
    receptorExposures,
    weatherHours,
    currentWeather.hourIndex,
    horizonMultiplier,
    horizonMode,
    buildings,
  ]);

  const sortedProfiles = useMemo(
    () =>
      [...receptorProfiles].sort((a, b) => b.horizonDustUgM2 - a.horizonDustUgM2),
    [receptorProfiles]
  );

  const selectedProfile = useMemo(
    () =>
      receptorProfiles.find((p) => p.receptorId === selectedReceptorId) ||
      sortedProfiles[0] ||
      receptorProfiles[0],
    [receptorProfiles, selectedReceptorId, sortedProfiles]
  );

  const maxReceptorDustUgM2 = useMemo(
    () => Math.max(100, ...sortedProfiles.map((p) => p.horizonDustUgM2)),
    [sortedProfiles]
  );

  // Group all 29 building units by their current operational category (a–e)
  const buildingsGroupedByCategory = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      meta: BUILDING_CATEGORY_METADATA[cat],
      units: buildings.filter((b) => b.category === cat),
    }));
  }, [buildings]);

  // Compute cumulative 24h asbestos dose (fibre/cm³·t vs. 2026-GV = 0,003 f/cm³) and heavy metal + PCB deposition (µg/m²)
  // broken down by primary demolition sources (d), renovation blocks (c), and wind-driven resuspension from unsealed fields (e)
  const selectedReceptorCategoryAttribution = useMemo(() => {
    if (!selectedProfile) return null;

    const buildingUnit =
      buildings.find((b) => getReceptorIdForBuilding(b.id) === selectedProfile.receptorId) ||
      buildings[0] ||
      null;

    // Derive cumulative 24h asbestos dose in fibre/cm³·t from deposited asbestos fibers/m²
    const cumulative24hAsbestosDoseFibersCm3H = Number(
      Math.max(0.0045, selectedProfile.total24hFibersM2 / 640000).toFixed(4)
    );
    const gv2026Limit = 0.003;
    const daily24hLimitFibersCm3H = 0.024;
    const dailyAsbestosDoseQuotient = Number(
      (cumulative24hAsbestosDoseFibersCm3H / daily24hLimitFibersCm3H).toFixed(2)
    );

    const totalHeavyMetalsAndPcbUgM2 =
      selectedProfile.fractionsUgM2.heavyMetalsLead +
      selectedProfile.fractionsUgM2.pcbParticulate;

    let dWeight = 0;
    let cWeight = 0;
    let eWeight = 0;
    let bWeight = 0;
    let resuspensionHours = 0;

    weatherHours.forEach((hr) => {
      if (hr.windSpeed10m > 5.0 || hr.windGusts10m > 5.0) {
        resuspensionHours += 1;
      }
    });

    const targetLat = buildingUnit?.center.lat ?? 55.4128;
    const targetLng = buildingUnit?.center.lng ?? 11.3533;

    buildings.forEach((srcB) => {
      const meta = BUILDING_CATEGORY_METADATA[srcB.category];
      if (!meta.actsAsSource) return;

      const dLat = (targetLat - srcB.center.lat) * 111320;
      const dLng =
        (targetLng - srcB.center.lng) *
        111320 *
        Math.cos((srcB.center.lat * Math.PI) / 180);
      const distMeters = Math.max(18, Math.hypot(dLat, dLng));
      const invDist = 1000 / Math.pow(distMeters + 25, 1.35);

      if (srcB.category === 'd_under_demolition') {
        dWeight += invDist * 1.0 * (srcB.fiberReleaseIndex || 0.85);
      } else if (srcB.category === 'c_under_renovation') {
        cWeight += invDist * 0.45 * (srcB.fiberReleaseIndex || 0.55);
      } else if (srcB.category === 'e_demolished_unsecured') {
        const avgWind =
          weatherHours.reduce((acc, h) => acc + h.windSpeed10m, 0) /
          Math.max(1, weatherHours.length);
        const resuspFactor =
          avgWind > 5.0
            ? 0.65 * Math.pow(avgWind / 5.0, 1.35)
            : resuspensionHours > 0
            ? 0.65 * (resuspensionHours / 24)
            : 0.18;
        eWeight += invDist * resuspFactor * (srcB.fiberReleaseIndex || 0.7);
      } else if (srcB.category === 'b_vacant') {
        bWeight += invDist * 0.05;
      }
    });

    const sumW = Math.max(0.0001, dWeight + cWeight + eWeight + bWeight);
    const fromDUgM2 = Math.round(totalHeavyMetalsAndPcbUgM2 * (dWeight / sumW));
    const fromCUgM2 = Math.round(totalHeavyMetalsAndPcbUgM2 * (cWeight / sumW));
    const fromEUgM2 = Math.round(totalHeavyMetalsAndPcbUgM2 * (eWeight / sumW));

    return {
      buildingUnit,
      cumulative24hAsbestosDoseFibersCm3H,
      gv2026Limit,
      daily24hLimitFibersCm3H,
      dailyAsbestosDoseQuotient,
      totalHeavyMetalsAndPcbUgM2,
      fromDUgM2,
      fromCUgM2,
      fromEUgM2,
      shareDPct: Math.round((fromDUgM2 / Math.max(1, totalHeavyMetalsAndPcbUgM2)) * 100),
      shareCPct: Math.round((fromCUgM2 / Math.max(1, totalHeavyMetalsAndPcbUgM2)) * 100),
      shareEPct: Math.round((fromEUgM2 / Math.max(1, totalHeavyMetalsAndPcbUgM2)) * 100),
      resuspensionHours,
    };
  }, [selectedProfile, buildings, weatherHours]);

  // Deterministic particle dots for the 1 m² surface visualizer
  const surfaceParticles = useMemo(() => {
    if (!selectedProfile) return [];
    const densityCount = Math.min(
      140,
      Math.max(18, Math.round(selectedProfile.horizonDustUgM2 / 45))
    );
    const items: Array<{
      id: number;
      x: number;
      y: number;
      r: number;
      color: string;
      isFiber: boolean;
      angle: number;
    }> = [];

    for (let i = 0; i < densityCount; i++) {
      const seed1 = ((i * 73 + 19) % 97) / 97;
      const seed2 = ((i * 41 + 53) % 89) / 89;
      const mod = i % 20;
      let color = FRACTION_COLORS.quartzConcrete;
      let isFiber = false;
      if (mod < 2) {
        color = FRACTION_COLORS.asbestosFiberMassEq;
        isFiber = true;
      } else if (mod < 6) {
        color = FRACTION_COLORS.heavyMetalsLead;
      } else if (mod < 9) {
        color = FRACTION_COLORS.pcbParticulate;
      } else if (mod < 11) {
        color = FRACTION_COLORS.bioAerosolMold;
      }

      items.push({
        id: i,
        x: 6 + seed1 * 88,
        y: 8 + seed2 * 84,
        r: isFiber ? 3.2 : 1.3 + (i % 3) * 0.65,
        color,
        isFiber,
        angle: (i * 37) % 180,
      });
    }
    return items;
  }, [selectedProfile]);

  const handleExportDepositionCsv = () => {
    const headers = [
      'Receptor_Kode',
      'Receptor_Navn',
      'Adresse',
      'Afstand_m',
      'Dominerende_Kilde',
      'Akkumuleret_Kl_00_til_Nu_ug_m2',
      'Total_24t_Deponering_ug_m2',
      'Valgt_Horisont_Deponering_ug_m2',
      'Kvarts_Betonstoev_ug_m2',
      'Tungmetaller_Bly_ug_m2',
      'PCB_Partikler_ug_m2',
      'Bioaerosol_Skimmel_ug_m2',
      'Asbest_FiberMasseEq_ug_m2',
      'Deponerede_Asbestfibre_pr_m2',
      'Spids_Time',
    ];

    const rows = sortedProfiles.map((p) => [
      p.receptorCode,
      `"${p.receptorName}"`,
      `"${p.address}"`,
      p.distanceMeters,
      `"${p.nearestSourceName}"`,
      p.upToHourDustUgM2,
      p.total24hDustUgM2,
      p.horizonDustUgM2,
      p.fractionsUgM2.quartzConcrete,
      p.fractionsUgM2.heavyMetalsLead,
      p.fractionsUgM2.pcbParticulate,
      p.fractionsUgM2.bioAerosolMold,
      p.fractionsUgM2.asbestosFiberMassEq,
      p.horizonFibersM2,
      p.peakHourLabel,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Akkumuleret_Stoev_Deponeringsprofil_Ringparken_${dateIso}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedProfile) return null;

  const dust24hRatioToLimit =
    selectedProfile.total24hDustUgM2 / SURFACE_DECONTAMINATION_THRESHOLD_UG_M2;
  const asbestos24hRatioToLimit =
    selectedReceptorCategoryAttribution?.dailyAsbestosDoseQuotient ?? 0;
  const cumulative24hLimitRatio = Math.max(dust24hRatioToLimit, asbestos24hRatioToLimit);
  const cumulative24hLimitPct = Math.round(cumulative24hLimitRatio * 100);
  const isImpactThresholdExceeded = cumulative24hLimitRatio > IMPACT_THRESHOLD_RATIO;

  return (
    <div
      className={`border rounded-lg overflow-hidden text-[var(--text-primary)] transition-colors ${
        isImpactThresholdExceeded
          ? 'bg-gradient-to-br from-orange-950/35 via-[var(--surface-panel)] to-[var(--surface-panel)] border-orange-500/70'
          : 'bg-[var(--surface-panel)] border-[var(--border-subtle)]'
      }`}
    >
      {/* Top Header */}
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
          isImpactThresholdExceeded
            ? 'bg-gradient-to-r from-orange-950/75 via-amber-950/40 to-[var(--surface-card)] border-orange-500/50 border-l-4 border-l-orange-400'
            : 'bg-[var(--surface-card)] border-[var(--border-subtle)] border-l-4 border-l-sky-400'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold tracking-wide uppercase text-cyan-100">
                Akkumuleret Støv-Deponeringsprofil (µg/m²) pr. Kvadratmeter
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                Fysisk Overflade-Ophobning · 1 m² Prøvefelt
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Visualiserer den fysiske aflejring og lag-på-lag ophobning af nedrivningsstøv (µg/m²) på overflader ved hver enkelt receptor over tid
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Horizon Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setHorizonMode('up_to_hour')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                horizonMode === 'up_to_hour'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vis fysisk ophobet støv fra kl. 00:00 frem til valgt klokkeslæt på Time-Slideren"
            >
              00:00→{currentWeather.hourLabel}
            </button>
            <button
              type="button"
              onClick={() => setHorizonMode('24h')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                horizonMode === '24h'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24 Timer
            </button>
            <button
              type="button"
              onClick={() => setHorizonMode('7d')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                horizonMode === '7d'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 Dage
            </button>
            <button
              type="button"
              onClick={() => setHorizonMode('30d')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                horizonMode === '30d'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              30 Dage
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportDepositionCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer"
            title="Eksportér akkumuleret støv-deponeringsprofil (µg/m²) for alle receptorer som CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV (µg/m²)</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className={`p-4 space-y-4 ${compact ? 'max-h-[560px] overflow-y-auto' : ''}`}>
        {/* 29-Bygnings Dropdown grupperet efter aktuel kategori (a–e) + Kumulativ 24t Asbestdosis & Tungmetal/PCB Kilde-Opdeling */}
        <div className="bg-slate-950/95 border border-cyan-500/40 rounded-lg p-3 space-y-2.5 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="deposition-29-building-select"
              className="text-[11px] font-bold uppercase text-cyan-300 flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vælg Bygningsenhed / Naboblok (29 Enheder grupperet i kat. a–e):</span>
            </label>
            <select
              id="deposition-29-building-select"
              value={selectedProfile.receptorId}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectReceptor(e.target.value);
                }
              }}
              className="bg-slate-900 border border-cyan-500/50 hover:border-cyan-400 text-white rounded px-2.5 py-1 text-[11px] font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-400 max-w-full sm:max-w-md cursor-pointer"
            >
              {buildingsGroupedByCategory.map((grp) => (
                <optgroup
                  key={grp.category}
                  label={`${grp.meta.labelDa} (${grp.units.length} enheder — faktor ${grp.meta.sourceEmissionFactor.toFixed(2)})`}
                >
                  {grp.units.map((b) => {
                    const recId = getReceptorIdForBuilding(b.id);
                    const prof = receptorProfiles.find((p) => p.receptorId === recId);
                    const dustStr = prof
                      ? `${prof.horizonDustUgM2.toLocaleString('da-DK')} µg/m²`
                      : '—';
                    return (
                      <option key={b.id} value={recId}>
                        {b.code}: {b.name} — {b.address} [{grp.meta.labelDa}] ({dustStr})
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          {selectedReceptorCategoryAttribution && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800 text-[11px]">
              {/* Cumulative 24-hour Asbestos Dose vs 2026-GV = 0.003 f/cm³ */}
              <div
                data-testid="impact-threshold-dose-card"
                className={`p-2.5 rounded border space-y-1 transition-all ${
                  isImpactThresholdExceeded
                    ? 'bg-gradient-to-r from-orange-500/25 via-amber-500/15 to-slate-900/95 border-orange-400/80'
                    : 'bg-slate-900/90 border-rose-500/40'
                }`}
              >
                <div
                  className={`flex items-center justify-between font-bold uppercase text-[11px] ${
                    isImpactThresholdExceeded ? 'text-orange-200' : 'text-rose-300'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {isImpactThresholdExceeded ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    ) : (
                      <Biohazard className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>Kumulativ 24t Asbestdosis (mod 2026-GV = 0,003 f/cm³)</span>
                  </span>
                  <span className="tabular-nums">
                    {(selectedReceptorCategoryAttribution.dailyAsbestosDoseQuotient * 100).toFixed(
                      0
                    )}
                    % af 24t-GV
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-extrabold text-white tabular-nums">
                    {selectedReceptorCategoryAttribution.cumulative24hAsbestosDoseFibersCm3H.toFixed(
                      4
                    )}{' '}
                    fibre/cm³·t
                  </span>
                  <span className={isImpactThresholdExceeded ? 'text-orange-200' : 'text-rose-200'}>
                    Deponeret:{' '}
                    <strong className="tabular-nums">
                      {selectedProfile.horizonFibersM2.toLocaleString('da-DK')} fibre/m²
                    </strong>
                  </span>
                </div>
                {isImpactThresholdExceeded && (
                  <motion.div
                    data-testid="dust-impact-threshold-alert-banner"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: [0.82, 1, 0.82], x: 0 }}
                    transition={{
                      x: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                      opacity: { duration: 2.0, repeat: Infinity, ease: 'easeInOut' },
                    }}
                    className="mt-1 px-2 py-1 rounded bg-gradient-to-r from-orange-500/35 via-amber-500/25 to-orange-600/25 border border-orange-400/70 text-[11px] text-orange-100 font-bold flex items-center justify-between gap-2 tabular-nums"
                  >
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-orange-300 shrink-0" />
                      <span>Impact Threshold (&gt;75% sundhedsgrænse)</span>
                    </span>
                    <span>
                      24t Dosis: {cumulative24hLimitPct}% · {selectedProfile.total24hDustUgM2.toLocaleString('da-DK')} µg/m²
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Accumulated Heavy Metal & PCB Dust Deposition (µg/m²) from d, c, and e */}
              <div className="p-2.5 rounded bg-slate-900/90 border border-purple-500/40 space-y-1">
                <div className="flex items-center justify-between text-purple-300 font-bold uppercase text-[11px]">
                  <span className="inline-flex items-center gap-1">
                    <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                    <span>Tungmetal- &amp; PCB-Støvdeponering fra Kat. d, c &amp; e</span>
                  </span>
                  <span className="text-amber-300">
                    ∑ {selectedReceptorCategoryAttribution.totalHeavyMetalsAndPcbUgM2.toLocaleString(
                      'da-DK'
                    )}{' '}
                    µg/m²
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-0.5 text-[11px]">
                  <div className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-200">
                    <strong>Kat. d (Nedriv.):</strong>{' '}
                    {selectedReceptorCategoryAttribution.fromDUgM2} µg/m² (
                    {selectedReceptorCategoryAttribution.shareDPct}%)
                  </div>
                  <div className="px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-500/40 text-sky-200">
                    <strong>Kat. c (Renov.):</strong>{' '}
                    {selectedReceptorCategoryAttribution.fromCUgM2} µg/m² (
                    {selectedReceptorCategoryAttribution.shareCPct}%)
                  </div>
                  <div className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-200">
                    <strong>Kat. e (Resusp.):</strong>{' '}
                    {selectedReceptorCategoryAttribution.fromEUgM2} µg/m² (
                    {selectedReceptorCategoryAttribution.shareEPct}%)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top Section: All Individual Receptors Bar Matrix (µg/m² per m²) */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Receptor-Specifik Overflade-Deponering ({horizonLabel})
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setIncludeStreetProbes((prev) => !prev)}
                className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  includeStreetProbes
                    ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200 font-bold'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {includeStreetProbes
                  ? '✓ Inkl. Gade-Målepunkter'
                  : '+ Vis Gade-Målepunkter'}
              </button>
              <span className="text-slate-400">
                Aftørrings-grænse:{' '}
                <strong className="text-amber-300">
                  {SURFACE_DECONTAMINATION_THRESHOLD_UG_M2.toLocaleString('da-DK')} µg/m²
                </strong>
              </span>
            </div>
          </div>

          {/* Grid of Individual Receptor Cards with Stacked Horizontal Progress Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {sortedProfiles.map((prof, idx) => {
              const isSelected = prof.receptorId === selectedProfile.receptorId;
              const pctOfMax = Math.min(
                100,
                Math.max(4, (prof.horizonDustUgM2 / maxReceptorDustUgM2) * 100)
              );
              const exceedsWipeLimit =
                prof.horizonDustUgM2 >= SURFACE_DECONTAMINATION_THRESHOLD_UG_M2;

              const totalFrac = Math.max(1, prof.horizonDustUgM2);
              const pQuartz = (prof.fractionsUgM2.quartzConcrete / totalFrac) * 100;
              const pMetals = (prof.fractionsUgM2.heavyMetalsLead / totalFrac) * 100;
              const pPcb = (prof.fractionsUgM2.pcbParticulate / totalFrac) * 100;
              const pMold = (prof.fractionsUgM2.bioAerosolMold / totalFrac) * 100;
              const pAsb = (prof.fractionsUgM2.asbestosFiberMassEq / totalFrac) * 100;

              return (
                <button
                  key={prof.receptorId}
                  type="button"
                  onClick={() => onSelectReceptor(prof.receptorId)}
                  className={`text-left p-2.5 rounded-md border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400/50 shadow-md'
                      : exceedsWipeLimit
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 font-mono">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[11px] font-bold ${
                            idx === 0
                              ? 'bg-rose-600 text-white'
                              : idx === 1
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {prof.receptorCode}: {prof.receptorName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {prof.address} · {prof.distanceMeters} m fra{' '}
                        {prof.nearestSourceName.split(':')[0]}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-extrabold ${
                          exceedsWipeLimit ? 'text-rose-300' : 'text-cyan-300'
                        }`}
                      >
                        {prof.horizonDustUgM2.toLocaleString('da-DK')} µg/m²
                      </div>
                      <div className="text-[11px] text-slate-400">
                        +{prof.currentHourInfluxUgM2H} µg/m²·t
                      </div>
                    </div>
                  </div>

                  {/* Multi-segment bar representing physical dust fractions on 1 m² */}
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full flex"
                      style={{ width: `${pctOfMax}%` }}
                    >
                      <div
                        style={{
                          width: `${pQuartz}%`,
                          backgroundColor: FRACTION_COLORS.quartzConcrete,
                        }}
                        title={`Kvarts & Betonstøv: ${prof.fractionsUgM2.quartzConcrete} µg/m²`}
                      />
                      <div
                        style={{
                          width: `${pMetals}%`,
                          backgroundColor: FRACTION_COLORS.heavyMetalsLead,
                        }}
                        title={`Bly & Tungmetaller: ${prof.fractionsUgM2.heavyMetalsLead} µg/m²`}
                      />
                      <div
                        style={{
                          width: `${pPcb}%`,
                          backgroundColor: FRACTION_COLORS.pcbParticulate,
                        }}
                        title={`Partikelbundet PCB: ${prof.fractionsUgM2.pcbParticulate} µg/m²`}
                      />
                      <div
                        style={{
                          width: `${pMold}%`,
                          backgroundColor: FRACTION_COLORS.bioAerosolMold,
                        }}
                        title={`Bioaerosol & Skimmel: ${prof.fractionsUgM2.bioAerosolMold} µg/m²`}
                      />
                      <div
                        style={{
                          width: `${pAsb}%`,
                          backgroundColor: FRACTION_COLORS.asbestosFiberMassEq,
                        }}
                        title={`Asbestfibre: ${prof.horizonFibersM2} fibre/m²`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      Kl. {currentWeather.hourLabel}:{' '}
                      <strong className="text-slate-200">
                        {prof.upToHourDustUgM2.toLocaleString('da-DK')} µg/m²
                      </strong>
                    </span>
                    <span className="text-rose-300">
                      {prof.horizonFibersM2.toLocaleString('da-DK')} fibre/m²
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle Section: 1 m² Physical Surface Visualizer + Stratified Dust Layer Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Left 5 cols: Interactive 1.0 m × 1.0 m (1 m²) Physical Wipe-Test Surface Simulation */}
          <div className="lg:col-span-5 bg-slate-950/95 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono uppercase text-cyan-400 font-bold flex items-center gap-1.5">
                  <Microscope className="w-3.5 h-3.5 text-cyan-400" />
                  <span>1,0 m × 1,0 m (1 m²) Fysisk Overflade-Prøvefelt</span>
                </div>
                <h4 className="text-xs font-bold text-white mt-0.5">
                  {selectedProfile.receptorCode}: {selectedProfile.receptorName}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Simuleret støvbelægning på 1 m² vandret referenceflade (altan / vindueskarm / legeplads)
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                  selectedProfile.wipeTestExceedanceRatio >= 1.0
                    ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                    : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                }`}
              >
                {selectedProfile.wipeTestExceedanceRatio >= 1.0
                  ? `⚠ ${selectedProfile.wipeTestExceedanceRatio.toFixed(1)}× Over Aftørrings-Grænse`
                  : `${(selectedProfile.wipeTestExceedanceRatio * 100).toFixed(0)}% af Aftørrings-Grænse`}
              </span>
            </div>

            {/* 1 m² SVG Surface Plate + Stratified Cross-Section */}
            <div className="grid grid-cols-2 gap-2.5 items-center">
              {/* Top-down 1 m² Wipe Quadrat */}
              <div className="bg-slate-900/90 border border-slate-700 rounded p-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                  <span>1 m² Top-View</span>
                  <span className="text-cyan-300 font-bold">
                    {selectedProfile.horizonDustUgM2.toLocaleString('da-DK')} µg/m²
                  </span>
                </div>
                <svg
                  viewBox="0 0 100 100"
                  className="w-full aspect-square rounded bg-[#070b14] border border-slate-700"
                >
                  <defs>
                    <linearGradient id="surfacePlateImpactAlertGrad" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ea580c" stopOpacity="0.34">
                        {isImpactThresholdExceeded && (
                          <animate
                            attributeName="stop-opacity"
                            values="0.22;0.48;0.22"
                            dur="2.2s"
                            repeatCount="indefinite"
                          />
                        )}
                      </stop>
                      <stop offset="55%" stopColor="#f97316" stopOpacity="0.22">
                        {isImpactThresholdExceeded && (
                          <animate
                            attributeName="stop-opacity"
                            values="0.14;0.34;0.14"
                            dur="2.2s"
                            repeatCount="indefinite"
                          />
                        )}
                      </stop>
                      <stop offset="100%" stopColor="#fb923c" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines every 25 cm */}
                  <line x1="25" y1="0" x2="25" y2="100" stroke="#1e293b" strokeWidth="0.6" />
                  <line x1="50" y1="0" x2="50" y2="100" stroke="#1e293b" strokeWidth="0.6" />
                  <line x1="75" y1="0" x2="75" y2="100" stroke="#1e293b" strokeWidth="0.6" />
                  <line x1="0" y1="25" x2="100" y2="25" stroke="#1e293b" strokeWidth="0.6" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeWidth="0.6" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="#1e293b" strokeWidth="0.6" />

                  {/* Settled Dust Haze (shifts to orange alert gradient when 24h cumulative dose > 75% of local limit) */}
                  <rect
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    className={isImpactThresholdExceeded ? 'dust-impact-alert-gradient-pulse' : undefined}
                    fill={isImpactThresholdExceeded ? 'url(#surfacePlateImpactAlertGrad)' : '#06b6d4'}
                    fillOpacity={
                      isImpactThresholdExceeded
                        ? 1
                        : Math.min(0.28, selectedProfile.horizonDustUgM2 / 18000)
                    }
                  />

                  {/* Settled Particles & Fibers */}
                  {surfaceParticles.map((pt) =>
                    pt.isFiber ? (
                      <line
                        key={pt.id}
                        x1={pt.x - 2.6}
                        y1={pt.y - 1.2}
                        x2={pt.x + 2.6}
                        y2={pt.y + 1.2}
                        stroke={pt.color}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    ) : (
                      <circle
                        key={pt.id}
                        cx={pt.x}
                        cy={pt.y}
                        r={pt.r}
                        fill={pt.color}
                        fillOpacity="0.88"
                      />
                    )
                  )}

                  {/* 1.0 m scale label */}
                  <text
                    x="4"
                    y="96"
                    fill="#94a3b8"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    1,0 m × 1,0 m (1 m²)
                  </text>
                </svg>
              </div>

              {/* Stratified Vertical Cross-Section of the Dust Layer */}
              <div className="bg-slate-900/90 border border-slate-700 rounded p-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                  <span>Lag-Tværsnit</span>
                  <span className="text-amber-300 font-bold">
                    ≈ {selectedProfile.equivalentLayerThicknessUm} µm
                  </span>
                </div>

                <div className="h-32 flex flex-col justify-end bg-[#070b14] border border-slate-800 rounded p-1.5 relative overflow-hidden">
                  <div className="text-[11px] font-mono text-slate-400 absolute top-1 left-1.5">
                    Fysisk Støvsøjle pr. m²
                  </div>

                  {/* Stacked visual layers */}
                  <div className="w-full flex flex-col rounded-t overflow-hidden border border-white/15">
                    <div
                      style={{
                        height: '10px',
                        backgroundColor: FRACTION_COLORS.asbestosFiberMassEq,
                      }}
                      title="Asbestfibre"
                    />
                    <div
                      style={{
                        height: '12px',
                        backgroundColor: FRACTION_COLORS.bioAerosolMold,
                      }}
                      title="Bioaerosol / Skimmel"
                    />
                    <div
                      style={{
                        height: '16px',
                        backgroundColor: FRACTION_COLORS.pcbParticulate,
                      }}
                      title="Partikelbundet PCB"
                    />
                    <div
                      style={{
                        height: '22px',
                        backgroundColor: FRACTION_COLORS.heavyMetalsLead,
                      }}
                      title="Bly & Tungmetaller"
                    />
                    <div
                      style={{
                        height: '34px',
                        backgroundColor: FRACTION_COLORS.quartzConcrete,
                      }}
                      title="Respirabelt Kvarts & Betonstøv"
                    />
                  </div>
                  <div className="w-full h-3 bg-slate-700 text-[11px] font-mono text-center text-slate-200 leading-3">
                    UNDERLAG (1 m²)
                  </div>
                </div>
              </div>
            </div>

            {/* Fractional Mass Breakdown Table for Selected Receptor */}
            <div className="space-y-1 pt-1 border-t border-slate-800 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FRACTION_COLORS.quartzConcrete }}
                  />
                  Respirabelt Kvarts &amp; Betonstøv:
                </span>
                <strong className="text-cyan-300">
                  {selectedProfile.fractionsUgM2.quartzConcrete.toLocaleString('da-DK')} µg/m²
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FRACTION_COLORS.heavyMetalsLead }}
                  />
                  Bly (Pb), Cadmium &amp; Tungmetaller:
                </span>
                <strong className="text-purple-300">
                  {selectedProfile.fractionsUgM2.heavyMetalsLead.toLocaleString('da-DK')} µg/m²
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FRACTION_COLORS.pcbParticulate }}
                  />
                  Partikelbundet PCB-Belægning:
                </span>
                <strong className="text-amber-300">
                  {selectedProfile.fractionsUgM2.pcbParticulate.toLocaleString('da-DK')} µg/m²
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FRACTION_COLORS.bioAerosolMold }}
                  />
                  Skimmelsporer &amp; Kloak-Tørstof:
                </span>
                <strong className="text-emerald-300">
                  {selectedProfile.fractionsUgM2.bioAerosolMold.toLocaleString('da-DK')} µg/m²
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FRACTION_COLORS.asbestosFiberMassEq }}
                  />
                  Asbestfibre Deponeret pr. m²:
                </span>
                <strong className="text-rose-300">
                  {selectedProfile.horizonFibersM2.toLocaleString('da-DK')} fibre/m² (
                  {selectedProfile.fractionsUgM2.asbestosFiberMassEq} µg/m²)
                </strong>
              </div>
            </div>
          </div>

          {/* Right 7 cols: Interactive Recharts Deposition Profile (Stacked Time Accumulation or All-Receptors Comparison) */}
          <div
            data-testid="dust-deposition-chart-card"
            data-impact-alert={isImpactThresholdExceeded ? 'true' : 'false'}
            className={`relative overflow-hidden lg:col-span-7 border rounded-lg p-3.5 flex flex-col justify-between space-y-3 transition-all ${
              isImpactThresholdExceeded
                ? 'bg-gradient-to-br from-orange-950/60 via-amber-950/30 to-slate-950/95 border-orange-500/80'
                : 'bg-slate-950/95 border-slate-800'
            }`}
          >
            {isImpactThresholdExceeded && (
              <motion.div
                aria-hidden="true"
                data-testid="impact-alert-gradient-pulse-overlay"
                animate={{ opacity: [0.2, 0.52, 0.2] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-transparent"
              />
            )}

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div
                  className={`text-[11px] font-mono uppercase font-bold flex items-center gap-1.5 ${
                    isImpactThresholdExceeded ? 'text-orange-300' : 'text-cyan-400'
                  }`}
                >
                  <TrendingUp
                    className={`w-3.5 h-3.5 ${
                      isImpactThresholdExceeded ? 'text-orange-400' : 'text-cyan-400'
                    }`}
                  />
                  <span>
                    {chartMode === 'temporal_stack'
                      ? `Lagdelt Ophobningsprofil Over Tid (${selectedProfile.receptorCode})`
                      : 'Sammenligning af Alle Receptorer (µg/m² pr. m²)'}
                  </span>
                  {isImpactThresholdExceeded && (
                    <span className="dust-impact-alert-gradient-pulse px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-500/35 to-amber-500/25 border border-orange-400/80 text-orange-100 text-[11px] font-bold tabular-nums">
                      ⚠ &gt;75% IMPACT ({cumulative24hLimitPct}%)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {chartMode === 'temporal_stack'
                    ? 'Klik på en time på kurven for at inspicere den fysiske støvophobning · Orange stiplet linje = 75% Impact Threshold'
                    : 'Klik på en søjle for at vælge receptoren · Orange stiplet linje = 75% Impact Threshold (1.875 µg/m²)'}
                </p>
              </div>

              <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setChartMode('temporal_stack')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    chartMode === 'temporal_stack'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tidslig Ophobning (00–23)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('receptor_comparison')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    chartMode === 'receptor_comparison'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Alle Receptorer (µg/m²)
                </button>
              </div>
            </div>

            {/* Animated Slide-In Impact Threshold Indicator Bar */}
            <motion.div
              key={`impact-threshold-bar-${chartMode}`}
              data-testid="impact-threshold-line-animated-bar"
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className={`relative z-10 flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 rounded border text-[11px] font-mono tabular-nums ${
                isImpactThresholdExceeded
                  ? 'bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-transparent border-orange-400/60 text-orange-200'
                  : 'bg-slate-900/70 border-orange-500/35 text-orange-300'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="w-6 border-t-2 border-dashed border-orange-400 inline-block shrink-0" />
                <span className="font-bold">
                  Impact Threshold Linje: 75% af grænseværdi ({IMPACT_THRESHOLD_UG_M2.toLocaleString('da-DK')} µg/m²)
                </span>
              </span>
              <span className="text-slate-300">
                Aktuel 24t dosis: <strong className={isImpactThresholdExceeded ? 'text-orange-200' : 'text-cyan-200'}>{cumulative24hLimitPct}%</strong>
              </span>
            </motion.div>

            <div key={`chart-wrap-${chartMode}`} className="relative z-10 w-full h-64 dust-impact-threshold-chart">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'temporal_stack' ? (
                  <AreaChart
                    data={selectedProfile.hourlyCumulativeSeries}
                    margin={{ top: 14, right: 10, left: 0, bottom: 0 }}
                    onClick={(state) => {
                      if (state && typeof state.activeTooltipIndex === 'number') {
                        const idx = state.activeTooltipIndex;
                        if (idx >= 0 && idx < 24) {
                          onSelectHour(idx);
                        }
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="dustImpactAlertGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" stopOpacity={0.55}>
                          {isImpactThresholdExceeded && (
                            <animate
                              attributeName="stop-opacity"
                              values="0.38;0.74;0.38"
                              dur="2.1s"
                              repeatCount="indefinite"
                            />
                          )}
                        </stop>
                        <stop offset="55%" stopColor="#f97316" stopOpacity={0.32}>
                          {isImpactThresholdExceeded && (
                            <animate
                              attributeName="stop-opacity"
                              values="0.20;0.48;0.20"
                              dur="2.1s"
                              repeatCount="indefinite"
                            />
                          )}
                        </stop>
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="shortHour"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <YAxis
                      stroke="#cbd5e1"
                      tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}
                      unit=" µg"
                    />
                    <ReferenceLine
                      x={String(currentWeather.hourIndex).padStart(2, '0')}
                      stroke="#ffffff"
                      strokeWidth={1.6}
                      strokeDasharray="3 2"
                    />
                    <ReferenceLine
                      y={IMPACT_THRESHOLD_UG_M2}
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      label={{
                        value: 'Impact Threshold · 75% GV (1.875 µg/m²)',
                        fill: '#fb923c',
                        fontSize: 11,
                        fontWeight: 700,
                        position: 'insideBottomLeft',
                      }}
                    />
                    <ReferenceLine
                      y={SURFACE_DECONTAMINATION_THRESHOLD_UG_M2}
                      stroke="#f43f5e"
                      strokeDasharray="4 2"
                      label={{
                        value: 'Aftørrings-grænse (2.500 µg/m²)',
                        fill: '#fda4af',
                        fontSize: 11,
                        position: 'insideTopLeft',
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: isImpactThresholdExceeded ? '#f97316' : '#334155',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                    {isImpactThresholdExceeded && (
                      <Area
                        type="monotone"
                        dataKey="cumulativeTotalUgM2"
                        name="24t Kumulativ Dosis (>75% Alert)"
                        stroke="#fb923c"
                        strokeWidth={2}
                        fill="url(#dustImpactAlertGradient)"
                        fillOpacity={1}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="quartzConcreteUgM2"
                      name="Kvarts & Beton (µg/m²)"
                      stackId="1"
                      stroke={FRACTION_COLORS.quartzConcrete}
                      fill={FRACTION_COLORS.quartzConcrete}
                      fillOpacity={0.55}
                    />
                    <Area
                      type="monotone"
                      dataKey="heavyMetalsLeadUgM2"
                      name="Bly & Tungmetaller (µg/m²)"
                      stackId="1"
                      stroke={FRACTION_COLORS.heavyMetalsLead}
                      fill={FRACTION_COLORS.heavyMetalsLead}
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="pcbParticulateUgM2"
                      name="PCB-Partikler (µg/m²)"
                      stackId="1"
                      stroke={FRACTION_COLORS.pcbParticulate}
                      fill={FRACTION_COLORS.pcbParticulate}
                      fillOpacity={0.65}
                    />
                    <Area
                      type="monotone"
                      dataKey="bioAerosolMoldUgM2"
                      name="Bioaerosol/Skimmel (µg/m²)"
                      stackId="1"
                      stroke={FRACTION_COLORS.bioAerosolMold}
                      fill={FRACTION_COLORS.bioAerosolMold}
                      fillOpacity={0.65}
                    />
                    <Area
                      type="monotone"
                      dataKey="asbestosFiberMassEqUgM2"
                      name="Asbest-Masseækv. (µg/m²)"
                      stackId="1"
                      stroke={FRACTION_COLORS.asbestosFiberMassEq}
                      fill={FRACTION_COLORS.asbestosFiberMassEq}
                      fillOpacity={0.8}
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={sortedProfiles}
                    margin={{ top: 14, right: 10, left: 0, bottom: 0 }}
                    onClick={(state) => {
                      if (state && typeof state.activeTooltipIndex === 'number') {
                        const target = sortedProfiles[state.activeTooltipIndex];
                        if (target) {
                          onSelectReceptor(target.receptorId);
                        }
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="dustImpactAlertBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" stopOpacity={0.95}>
                          {isImpactThresholdExceeded && (
                            <animate
                              attributeName="stop-opacity"
                              values="0.70;1;0.70"
                              dur="2.1s"
                              repeatCount="indefinite"
                            />
                          )}
                        </stop>
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.75}>
                          {isImpactThresholdExceeded && (
                            <animate
                              attributeName="stop-opacity"
                              values="0.50;0.88;0.50"
                              dur="2.1s"
                              repeatCount="indefinite"
                            />
                          )}
                        </stop>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="receptorCode"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <YAxis
                      stroke="#cbd5e1"
                      tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}
                      unit=" µg"
                    />
                    <ReferenceLine
                      y={IMPACT_THRESHOLD_UG_M2}
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      label={{
                        value: 'Impact Threshold (75% · 1.875 µg/m²)',
                        fill: '#fb923c',
                        fontSize: 11,
                        fontWeight: 700,
                        position: 'insideBottomLeft',
                      }}
                    />
                    <ReferenceLine
                      y={SURFACE_DECONTAMINATION_THRESHOLD_UG_M2}
                      stroke="#f43f5e"
                      strokeDasharray="4 2"
                      label={{
                        value: 'Grænseværdi (2.500 µg/m²)',
                        fill: '#fda4af',
                        fontSize: 11,
                        position: 'insideTopLeft',
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: isImpactThresholdExceeded ? '#f97316' : '#334155',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <Bar
                      dataKey="horizonDustUgM2"
                      name="Akkumuleret Støv (µg/m²)"
                      radius={[4, 4, 0, 0]}
                    >
                      {sortedProfiles.map((entry) => (
                        <Cell
                          key={entry.receptorId}
                          fill={
                            entry.receptorId === selectedProfile.receptorId
                              ? entry.horizonDustUgM2 > IMPACT_THRESHOLD_UG_M2
                                ? 'url(#dustImpactAlertBarGradient)'
                                : '#22d3ee'
                              : entry.horizonDustUgM2 >=
                                SURFACE_DECONTAMINATION_THRESHOLD_UG_M2
                              ? '#f43f5e'
                              : entry.horizonDustUgM2 > IMPACT_THRESHOLD_UG_M2
                              ? 'url(#dustImpactAlertBarGradient)'
                              : '#f59e0b'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Spids-deponering ved <strong>{selectedProfile.receptorCode}</strong>: kl.{' '}
                  <strong className="text-amber-300">{selectedProfile.peakHourLabel}</strong>
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  Aktuel nedbørs-udvaskning: <strong>{currentWeather.precipitation} mm/t</strong>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
