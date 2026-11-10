import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Building2,
  Clock,
  Flame,
  Layers,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  BuildingOperationalCategory,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
  RingparkenBuildingUnit,
} from '../types/dispersion';
import {
  BUILDING_CATEGORY_METADATA,
  RINGPARKEN_MASTER_BUILDINGS,
  getReceptorIdForBuilding,
} from '../data/ringparkenData';
import {
  compute24hNeighborAsbestosExposureDose,
  SourceActivityScheduleMode,
} from '../services/dispersionEngine';

export interface Neighbor24hAsbestosExposureDoseWidgetProps {
  receptors: ReceptorZone[];
  sources: DemolitionSourceNode[];
  weatherHours: HourlyWeatherPoint[];
  currentWeather: HourlyWeatherPoint;
  selectedSourceId: string | null;
  selectedReceptorId: string | null;
  asbestosSourceScope: 'all_active' | 'selected_source';
  onChangeAsbestosSourceScope: (scope: 'all_active' | 'selected_source') => void;
  onSelectSource: (sourceId: string) => void;
  onToggleSourceActive: (sourceId: string) => void;
  onSelectReceptor: (receptorId: string) => void;
  onSelectHour: (hourIndex: number) => void;
  onActivate3DTemporalAsbestosHeatmap?: () => void;
  buildings?: RingparkenBuildingUnit[];
}

const NEIGHBOR_CURVE_PALETTE = [
  { stroke: '#f43f5e', fill: '#f43f5e', labelClass: 'text-rose-300 border-rose-500/50 bg-rose-950/60' },
  { stroke: '#fbbf24', fill: '#fbbf24', labelClass: 'text-amber-300 border-amber-500/50 bg-amber-950/60' },
  { stroke: '#22d3ee', fill: '#22d3ee', labelClass: 'text-cyan-300 border-cyan-500/50 bg-cyan-950/60' },
  { stroke: '#a855f7', fill: '#a855f7', labelClass: 'text-purple-300 border-purple-500/50 bg-purple-950/60' },
  { stroke: '#34d399', fill: '#34d399', labelClass: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60' },
];

const SOURCE_BAR_COLORS: Record<string, string> = {
  'src-blok-1': '#f43f5e',
  'src-bygning-1': '#fbbf24',
  'src-bygning-2': '#22d3ee',
  'src-bygning-3': '#a855f7',
};

const CATEGORY_ORDER: BuildingOperationalCategory[] = [
  'a_inhabited',
  'b_vacant',
  'c_under_renovation',
  'd_under_demolition',
  'e_demolished_unsecured',
];

export const Neighbor24hAsbestosExposureDoseWidget: React.FC<
  Neighbor24hAsbestosExposureDoseWidgetProps
> = ({
  receptors,
  sources,
  weatherHours,
  currentWeather,
  selectedSourceId,
  selectedReceptorId,
  asbestosSourceScope,
  onChangeAsbestosSourceScope,
  onSelectSource,
  onToggleSourceActive,
  onSelectReceptor,
  onSelectHour,
  onActivate3DTemporalAsbestosHeatmap,
  buildings = RINGPARKEN_MASTER_BUILDINGS,
}) => {
  const [activityScheduleMode, setActivityScheduleMode] =
    useState<SourceActivityScheduleMode>('full_24h_unmitigated');
  const [onlyResidentialBlocks, setOnlyResidentialBlocks] = useState<boolean>(true);
  const [chartDisplayUnit, setChartDisplayUnit] = useState<'fibers_cm3_h' | 'inhaled_fibers'>(
    'fibers_cm3_h'
  );

  // Ensure all 29 building units have a corresponding ReceptorZone so any building (a–e) can be evaluated as a receptor
  const all29BuildingReceptors = useMemo<ReceptorZone[]>(() => {
    const existingById = new Map(receptors.map((r) => [r.id, r]));
    const buildingRecs: ReceptorZone[] = buildings.map((b) => {
      const recId = getReceptorIdForBuilding(b.id);
      const found = existingById.get(recId);
      if (found) return found;
      const meta = BUILDING_CATEGORY_METADATA[b.category];
      return {
        id: recId,
        code: b.code,
        name: `${b.name} (${b.department})`,
        category: 'residential_block',
        department: b.department,
        address: b.address,
        center: b.center,
        polygon: b.footprint,
        residentCountEstimate:
          b.dwellingsCount > 0 ? Math.max(10, Math.round(b.dwellingsCount * 2.2)) : 35,
        vulnerableGroupNote: `${meta.labelDa} — ${b.helhedsplanEtape}`,
        buildingUnitId: b.id,
        buildingCategory: b.category,
        buildingHeight3DMeters: meta.buildingHeight3DMeters,
        isCustom: false,
      };
    });

    const buildingRecIds = new Set(buildingRecs.map((r) => r.id));
    const extraReceptors = receptors.filter((r) => !buildingRecIds.has(r.id));
    return [...buildingRecs, ...extraReceptors];
  }, [buildings, receptors]);

  const report = useMemo(
    () =>
      compute24hNeighborAsbestosExposureDose({
        receptors: all29BuildingReceptors,
        sources,
        weatherHours,
        sourceScope: asbestosSourceScope,
        selectedSourceId,
        activityScheduleMode,
        onlyResidentialBlocks,
      }),
    [
      all29BuildingReceptors,
      sources,
      weatherHours,
      asbestosSourceScope,
      selectedSourceId,
      activityScheduleMode,
      onlyResidentialBlocks,
    ]
  );

  // Group all 29 building units by their current operational category (a-e)
  const buildingsGroupedByCategory = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      meta: BUILDING_CATEGORY_METADATA[cat],
      units: buildings.filter((b) => b.category === cat),
    }));
  }, [buildings]);

  // Determine the active neighbor summary for the selected receptor (or fallback to mostExposed)
  const selectedNeighborSummary = useMemo(() => {
    if (selectedReceptorId) {
      const found = report.neighborSummaries.find((n) => n.receptorId === selectedReceptorId);
      if (found) return found;
    }
    return report.mostExposedNeighbor || report.neighborSummaries[0] || null;
  }, [report, selectedReceptorId]);

  // Compute accumulated 24-hour Heavy Metal & PCB dust deposition (µg/m²) for the selected receptor
  // broken down by source category: d (under demolition), c (under renovation), and e (wind-driven resuspension from unsealed fields)
  const selectedReceptorCategoryDeposition = useMemo(() => {
    const targetRec =
      all29BuildingReceptors.find((r) => r.id === selectedNeighborSummary?.receptorId) ||
      all29BuildingReceptors[0];
    if (!targetRec) {
      return {
        buildingUnit: null as RingparkenBuildingUnit | null,
        totalHeavyMetalPcbUgM2: 0,
        heavyMetalsUgM2: 0,
        pcbUgM2: 0,
        fromCategoryDUgM2: 0,
        fromCategoryCUgM2: 0,
        fromCategoryEUgM2: 0,
        fromCategoryBUgM2: 0,
        shareDPct: 0,
        shareCPct: 0,
        shareEPct: 0,
        resuspensionActiveHours: 0,
      };
    }

    const buildingUnit =
      buildings.find(
        (b) => b.id === targetRec.buildingUnitId || getReceptorIdForBuilding(b.id) === targetRec.id
      ) || null;

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

    // Evaluate distance and category-weighted emission from all 29 building units acting as sources
    buildings.forEach((srcBuilding) => {
      const cat = srcBuilding.category;
      const meta = BUILDING_CATEGORY_METADATA[cat];
      if (!meta.actsAsSource) return;

      const dLat = (targetRec.center.lat - srcBuilding.center.lat) * 111320;
      const dLng =
        (targetRec.center.lng - srcBuilding.center.lng) *
        111320 *
        Math.cos((srcBuilding.center.lat * Math.PI) / 180);
      const distMeters = Math.max(18, Math.hypot(dLat, dLng));
      const invDistFactor = 1200 / Math.pow(distMeters + 25, 1.35);

      if (cat === 'd_under_demolition') {
        dWeight += invDistFactor * 1.0 * (srcBuilding.fiberReleaseIndex || 0.85);
      } else if (cat === 'c_under_renovation') {
        cWeight += invDistFactor * 0.45 * (srcBuilding.fiberReleaseIndex || 0.55);
      } else if (cat === 'e_demolished_unsecured') {
        // Wind-driven resuspension when u > 5 m/s: factor 0.65 * (u/5)^1.35
        const avgWind =
          weatherHours.reduce((acc, h) => acc + h.windSpeed10m, 0) /
          Math.max(1, weatherHours.length);
        const resuspFactor =
          avgWind > 5.0
            ? 0.65 * Math.pow(avgWind / 5.0, 1.35)
            : resuspensionHours > 0
            ? 0.65 * (resuspensionHours / 24)
            : 0.18;
        eWeight += invDistFactor * resuspFactor * (srcBuilding.fiberReleaseIndex || 0.7);
      } else if (cat === 'b_vacant') {
        bWeight += invDistFactor * 0.05;
      }
    });

    // Ensure non-zero baseline if category c or e has no active units right now so formula attribution is transparent, or scale to physical deposition
    const baseAsbDose = selectedNeighborSummary?.total24hDoseFibersCm3H ?? 0.018;
    const totalHeavyMetalPcbUgM2 = Math.round(
      Math.max(85, baseAsbDose * 42500 + (dWeight + cWeight + eWeight) * 18)
    );
    const heavyMetalsUgM2 = Math.round(totalHeavyMetalPcbUgM2 * 0.64);
    const pcbUgM2 = Math.max(0, totalHeavyMetalPcbUgM2 - heavyMetalsUgM2);

    const sumWeights = Math.max(0.0001, dWeight + cWeight + eWeight + bWeight);
    const fromCategoryDUgM2 = Math.round(totalHeavyMetalPcbUgM2 * (dWeight / sumWeights));
    const fromCategoryCUgM2 = Math.round(totalHeavyMetalPcbUgM2 * (cWeight / sumWeights));
    const fromCategoryEUgM2 = Math.round(totalHeavyMetalPcbUgM2 * (eWeight / sumWeights));
    const fromCategoryBUgM2 = Math.max(
      0,
      totalHeavyMetalPcbUgM2 - fromCategoryDUgM2 - fromCategoryCUgM2 - fromCategoryEUgM2
    );

    return {
      buildingUnit,
      totalHeavyMetalPcbUgM2,
      heavyMetalsUgM2,
      pcbUgM2,
      fromCategoryDUgM2,
      fromCategoryCUgM2,
      fromCategoryEUgM2,
      fromCategoryBUgM2,
      shareDPct: Math.round((fromCategoryDUgM2 / Math.max(1, totalHeavyMetalPcbUgM2)) * 100),
      shareCPct: Math.round((fromCategoryCUgM2 / Math.max(1, totalHeavyMetalPcbUgM2)) * 100),
      shareEPct: Math.round((fromCategoryEUgM2 / Math.max(1, totalHeavyMetalPcbUgM2)) * 100),
      resuspensionActiveHours: resuspensionHours,
    };
  }, [all29BuildingReceptors, buildings, selectedNeighborSummary, weatherHours]);

  const top5Neighbors = useMemo(
    () => report.neighborSummaries.slice(0, 5),
    [report.neighborSummaries]
  );

  const chartData = useMemo(() => {
    const rows: Array<Record<string, number | string>> = [];
    for (let h = 0; h < 24; h++) {
      const hrLabel = `${String(h).padStart(2, '0')}:00`;
      const row: Record<string, number | string> = {
        hourIndex: h,
        hourLabel: hrLabel,
        shortHour: String(h).padStart(2, '0'),
      };

      let maxHourlyConc = 0;
      let maxHourlyInhaled = 0;
      let runningInhaledMap: Record<string, number> = {};

      top5Neighbors.forEach((n) => {
        const pt = n.hourlySeries[h];
        if (!pt) return;
        const prevInhaled =
          h > 0
            ? Number(rows[h - 1]?.[`cum_inhaled_${n.receptorId}`] ?? 0)
            : 0;
        const nextCumInhaled = prevInhaled + pt.inhaledFibersPerResidentHour;
        runningInhaledMap[n.receptorId] = nextCumInhaled;

        row[`cum_dose_${n.receptorId}`] = pt.cumulativeDoseFibersCm3H;
        row[`cum_inhaled_${n.receptorId}`] = nextCumInhaled;
        row[`conc_${n.receptorId}`] = pt.concentrationFibersCm3;
        row[`rate_inhaled_${n.receptorId}`] = pt.inhaledFibersPerResidentHour;

        if (pt.concentrationFibersCm3 > maxHourlyConc) {
          maxHourlyConc = pt.concentrationFibersCm3;
        }
        if (pt.inhaledFibersPerResidentHour > maxHourlyInhaled) {
          maxHourlyInhaled = pt.inhaledFibersPerResidentHour;
        }
      });

      row.peakHourlyConc = Number(maxHourlyConc.toFixed(5));
      row.peakHourlyInhaled = maxHourlyInhaled;
      rows.push(row);
    }
    return rows;
  }, [top5Neighbors]);

  const mostExposed = report.mostExposedNeighbor;

  return (
    <div className="p-3.5 bg-slate-900/95 border-2 border-rose-500/50 rounded-md space-y-3.5 shadow-xl">
      {/* Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-[10px] font-mono font-extrabold uppercase text-rose-200 flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-400 shrink-0" />
              <span>24-TIMERS SAMLET ASBEST-EKSPONERINGS-DOSIS (NABOBLOKKE)</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-300">
              BEK 613/2026 GV: 0,003 fibre/cm³ • Døgn-tærskel: 0,0240 f/cm³·t
            </span>
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-white">
            Beregnet 24-Timers Asbest-Dosis &amp; Kilde-Bidrag for Mest Udsatte Naboblokke
          </h4>
          <p className="text-[11px] text-slate-300 leading-snug">
            Integrerer time-for-time asbest-fiberkoncentrationen (∑ C_asbest(t) · Δt) over hele døgnet for omkringliggende boligblokke ud fra valgt kilde-aktivitet, frigivelseshøjde (H) og &lt;1997 fiber-indeks.
          </p>
        </div>

        {onActivate3DTemporalAsbestosHeatmap && (
          <button
            type="button"
            onClick={onActivate3DTemporalAsbestosHeatmap}
            className="px-2.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-[10.5px] font-extrabold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer shrink-0"
            title="Vis 24-timers Tidsmæssig Asbest-Akkumulering direkte på 3D Digital Tvilling-scenen"
          >
            <Layers className="w-3.5 h-3.5 text-slate-950 shrink-0" />
            <span>Vis 24t Døgn-Risiko i 3D →</span>
          </button>
        )}
      </div>

      {/* Interactive Source Activity Control Panel */}
      <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono">
          <span className="text-cyan-300 font-bold uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>1. Vælg Kilde-Aktivitet (Aktive Nedrivningskilder &amp; Driftstid):</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChangeAsbestosSourceScope('all_active')}
              className={`px-2 py-0.5 rounded border text-[10px] transition-colors cursor-pointer ${
                asbestosSourceScope === 'all_active'
                  ? 'bg-rose-600 text-white font-bold border-rose-300'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Alle aktive ({sources.filter((s) => s.active).length})
            </button>
            <button
              type="button"
              onClick={() => onChangeAsbestosSourceScope('selected_source')}
              className={`px-2 py-0.5 rounded border text-[10px] transition-colors cursor-pointer ${
                asbestosSourceScope === 'selected_source'
                  ? 'bg-rose-600 text-white font-bold border-rose-300'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Kun valgt kilde
            </button>
          </div>
        </div>

        {/* Direct Source Activity Toggles (BYG-1, BYG-2, BYG-3, BLOK-1) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px]">
          {sources.map((src) => {
            const isSel = selectedSourceId === src.id;
            const fiberPct = Math.round((src.fiberReleaseIndex ?? 0.75) * 100);
            const dotColor = SOURCE_BAR_COLORS[src.id] || '#f43f5e';
            return (
              <div
                key={src.id}
                onClick={() => onSelectSource(src.id)}
                className={`p-1.5 rounded border transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                  !src.active
                    ? 'bg-slate-950/50 border-slate-800/70 opacity-55'
                    : isSel
                    ? 'bg-slate-900 border-cyan-400 ring-1 ring-cyan-400/40'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-white flex items-center gap-1 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span>{src.code}</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSourceActive(src.id);
                    }}
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold cursor-pointer ${
                      src.active
                        ? 'bg-rose-500/25 text-rose-200 border border-rose-500/50'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {src.active ? 'AKTIV' : 'FRA'}
                  </button>
                </div>
                <div className="text-[9px] text-slate-400 flex items-center justify-between">
                  <span>H={src.releaseHeightMeters}m</span>
                  <span className="text-emerald-300 font-semibold">Fiber {fiberPct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 24-Hour Demolition Activity Schedule Profile Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-400 mr-1">Driftsprofil:</span>
            <button
              type="button"
              onClick={() => setActivityScheduleMode('full_24h_unmitigated')}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                activityScheduleMode === 'full_24h_unmitigated'
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              24t Kontinuerlig (Blottet felt)
            </button>
            <button
              type="button"
              onClick={() => setActivityScheduleMode('workday_07_18_resuspension')}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                activityScheduleMode === 'workday_07_18_resuspension'
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              Hverdag kl. 07–18 (+Nat-resuspension)
            </button>
            <button
              type="button"
              onClick={() => setActivityScheduleMode('intensive_dry_08_16')}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                activityScheduleMode === 'intensive_dry_08_16'
                  ? 'bg-rose-500 text-white font-bold border-rose-300'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              Intensiv Tørnedbrydning kl. 08–16 (135%)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOnlyResidentialBlocks((v) => !v)}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 cursor-pointer"
          >
            {onlyResidentialBlocks
              ? `Viser: Naboblokke / Bygninger (${buildings.length})`
              : `Viser: Alle Receptorer (${all29BuildingReceptors.length})`}
          </button>
        </div>

        {/* 29-Bygnings Dropdown grupperet efter aktuel kategori (a–e) */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
          <label
            htmlFor="neighbor-29-building-select"
            className="text-amber-300 font-bold uppercase flex items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>2. Vælg Bygningsenhed / Naboblok (29 Enheder grupperet i kat. a–e):</span>
          </label>
          <select
            id="neighbor-29-building-select"
            value={selectedNeighborSummary?.receptorId || ''}
            onChange={(e) => {
              if (e.target.value) {
                onSelectReceptor(e.target.value);
              }
            }}
            className="bg-slate-900 border border-amber-500/50 hover:border-amber-400 text-white rounded px-2.5 py-1 text-[10.5px] font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-full sm:max-w-md cursor-pointer"
          >
            {buildingsGroupedByCategory.map((grp) => (
              <optgroup
                key={grp.category}
                label={`${grp.meta.labelDa} (${grp.units.length} enheder — faktor ${grp.meta.sourceEmissionFactor.toFixed(2)})`}
              >
                {grp.units.map((b) => {
                  const recId = getReceptorIdForBuilding(b.id);
                  const sumEntry = report.neighborSummaries.find((n) => n.receptorId === recId);
                  const doseStr = sumEntry
                    ? `${sumEntry.total24hDoseFibersCm3H.toFixed(4)} f/cm³·t`
                    : '0.0000 f/cm³·t';
                  return (
                    <option key={b.id} value={recId}>
                      {b.code}: {b.name} — {b.address} [{grp.meta.labelDa}] (24t: {doseStr})
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Building / Receptor 24h Asbestos Dose + Heavy Metal & PCB Dust Deposition (d, c, e) Breakdown */}
      {selectedNeighborSummary && (
        <div className="p-3 rounded-md bg-gradient-to-r from-slate-950 via-rose-950/25 to-slate-950 border border-amber-500/50 space-y-2.5 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[9.5px] font-extrabold uppercase">
                VALGT BYGNING / RECEPTOR-PROFIL
              </span>
              <span className="text-xs font-extrabold text-white">
                {selectedNeighborSummary.receptorCode}: {selectedNeighborSummary.receptorName}
              </span>
              {selectedReceptorCategoryDeposition.buildingUnit && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9.5px] font-bold border"
                  style={{
                    borderColor:
                      BUILDING_CATEGORY_METADATA[
                        selectedReceptorCategoryDeposition.buildingUnit.category
                      ].colorHex,
                    color:
                      BUILDING_CATEGORY_METADATA[
                        selectedReceptorCategoryDeposition.buildingUnit.category
                      ].colorHex,
                  }}
                >
                  {
                    BUILDING_CATEGORY_METADATA[
                      selectedReceptorCategoryDeposition.buildingUnit.category
                    ].labelDa
                  }
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-300">
              2026-GV Asbest: <strong className="text-rose-300">0,003 fibre/cm³</strong> • 24t GV-dosis:{' '}
              <strong className="text-amber-300">0,0240 fibre/cm³·t</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[10px]">
            {/* Left Box: Cumulative 24h Asbestos Dose vs 2026-GV */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-rose-500/40 space-y-1">
              <div className="flex items-center justify-between text-rose-300 font-bold uppercase text-[9.5px]">
                <span>☣ Kumulativ 24-Timers Asbestdosis (mod 2026-GV = 0,003 f/cm³)</span>
                <span>{(selectedNeighborSummary.dailyDoseQuotient * 100).toFixed(0)}% af 24t-GV</span>
              </div>
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="text-sm font-extrabold text-white">
                  ∑ 24t = {selectedNeighborSummary.total24hDoseFibersCm3H.toFixed(4)} fibre/cm³·t
                </span>
                <span className="text-cyan-300 font-bold">
                  Spids: {selectedNeighborSummary.peakConcentrationFibersCm3.toFixed(4)} f/cm³ (kl.{' '}
                  {selectedNeighborSummary.peakHourLabel})
                </span>
              </div>
              <div className="text-[9.5px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800">
                <span>
                  Timer ≥ 0,003 f/cm³:{' '}
                  <strong className="text-rose-300">
                    {selectedNeighborSummary.hoursExceedingGv2026}t
                  </strong>
                </span>
                <span>
                  Inhaleret:{' '}
                  <strong className="text-white">
                    {selectedNeighborSummary.totalInhaledFibersPerResident24h.toLocaleString(
                      'da-DK'
                    )}{' '}
                    fibre/døgn
                  </strong>
                </span>
              </div>
            </div>

            {/* Right Box: Accumulated Heavy Metal & PCB Dust Deposition (µg/m²) from d, c, e */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-cyan-500/40 space-y-1">
              <div className="flex items-center justify-between text-cyan-300 font-bold uppercase text-[9.5px]">
                <span>🧪 Akkumuleret Tungmetal- &amp; PCB-Støvdeponering (24t)</span>
                <span className="text-amber-300">
                  Pb/Cd/Zn: {selectedReceptorCategoryDeposition.heavyMetalsUgM2} + PCB:{' '}
                  {selectedReceptorCategoryDeposition.pcbUgM2} µg/m²
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="text-sm font-extrabold text-white">
                  ∑ D_24t ={' '}
                  {selectedReceptorCategoryDeposition.totalHeavyMetalPcbUgM2.toLocaleString(
                    'da-DK'
                  )}{' '}
                  µg/m²
                </span>
                <span className="text-[9.5px] text-slate-300">
                  Vind &gt; 5 m/s i{' '}
                  <strong className="text-amber-300">
                    {selectedReceptorCategoryDeposition.resuspensionActiveHours}t
                  </strong>{' '}
                  (kat. e resusp.)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800 text-[9px]">
                <div className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-200">
                  <strong>Kat. d (Nedriv.):</strong>{' '}
                  {selectedReceptorCategoryDeposition.fromCategoryDUgM2} µg/m² (
                  {selectedReceptorCategoryDeposition.shareDPct}%)
                </div>
                <div className="px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-500/40 text-sky-200">
                  <strong>Kat. c (Renov.):</strong>{' '}
                  {selectedReceptorCategoryDeposition.fromCategoryCUgM2} µg/m² (
                  {selectedReceptorCategoryDeposition.shareCPct}%)
                </div>
                <div className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-200">
                  <strong>Kat. e (Resusp.):</strong>{' '}
                  {selectedReceptorCategoryDeposition.fromCategoryEUgM2} µg/m² (
                  {selectedReceptorCategoryDeposition.shareEPct}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Summary Cards for Most Exposed Neighbor Blocks */}
      {mostExposed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
          <div className="p-2.5 rounded bg-slate-950/90 border border-rose-500/40">
            <div className="text-[9.5px] text-slate-400 uppercase">Mest Udsatte Naboblok</div>
            <div className="text-xs font-extrabold text-white truncate mt-0.5">
              {mostExposed.receptorCode}: {mostExposed.receptorName}
            </div>
            <div className="text-[10px] text-rose-300 mt-0.5">
              Spids kl. {mostExposed.peakHourLabel} ({mostExposed.peakConcentrationFibersCm3.toFixed(4)} f/cm³)
            </div>
          </div>

          <div className="p-2.5 rounded bg-slate-950/90 border border-amber-500/40">
            <div className="text-[9.5px] text-slate-400 uppercase">Samlet 24t Asbest-Dosis</div>
            <div
              className={`text-sm font-extrabold mt-0.5 ${
                mostExposed.dailyDoseQuotient >= 1.0 ? 'text-rose-400' : 'text-amber-300'
              }`}
            >
              {mostExposed.total24hDoseFibersCm3H.toFixed(4)} f/cm³·t
            </div>
            <div className="text-[10px] text-slate-300">
              Døgn-kvotient:{' '}
              <strong className="text-white">
                {(mostExposed.dailyDoseQuotient * 100).toFixed(0)}%
              </strong>{' '}
              af 24t-grænse
            </div>
          </div>

          <div className="p-2.5 rounded bg-slate-950/90 border border-cyan-500/40">
            <div className="text-[9.5px] text-slate-400 uppercase">Inhalerede Fibre / Beboer</div>
            <div className="text-sm font-extrabold text-cyan-300 mt-0.5">
              {mostExposed.totalInhaledFibersPerResident24h.toLocaleString('da-DK')} fibre/døgn
            </div>
            <div className="text-[10px] text-slate-400">
              Ved 0,75 m³/t åndingsvolumen
            </div>
          </div>

          <div className="p-2.5 rounded bg-slate-950/90 border border-purple-500/40">
            <div className="text-[9.5px] text-slate-400 uppercase">Timer Over 2026-GV</div>
            <div
              className={`text-sm font-extrabold mt-0.5 ${
                mostExposed.hoursExceedingGv2026 > 0 ? 'text-rose-400' : 'text-emerald-300'
              }`}
            >
              {mostExposed.hoursExceedingGv2026} / 24 timer
            </div>
            <div className="text-[10px] text-slate-400">
              {mostExposed.hoursExceedingActionValue}t over aktionsværdi
            </div>
          </div>
        </div>
      )}

      {/* 24-Hour Cumulative Asbestos Dose Chart */}
      <div className="p-2.5 rounded bg-slate-950/95 border border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-bold text-slate-200">
              24-Timers Akkumuleret Asbest-Eksponerings-Dosis Kurve (Top {top5Neighbors.length} Naboblokke)
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
            <button
              type="button"
              onClick={() => setChartDisplayUnit('fibers_cm3_h')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                chartDisplayUnit === 'fibers_cm3_h'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ∑ f/cm³·timer (BEK 613/2026)
            </button>
            <button
              type="button"
              onClick={() => setChartDisplayUnit('inhaled_fibers')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                chartDisplayUnit === 'inhaled_fibers'
                  ? 'bg-cyan-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ∑ Inhalerede fibre/beboer
            </button>
          </div>
        </div>

        <div className="w-full h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 0, left: -6 }}
              onClick={(state) => {
                if (state && typeof state.activeTooltipIndex === 'number') {
                  const idx = state.activeTooltipIndex;
                  if (idx >= 0 && idx < 24) {
                    onSelectHour(idx);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="shortHour"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                interval={2}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#f8fafc"
                tick={{ fill: '#cbd5e1', fontSize: 9.5, fontFamily: 'monospace' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#fb7185"
                tick={{ fill: '#fda4af', fontSize: 9.5, fontFamily: 'monospace' }}
                tickLine={false}
              />

              {chartDisplayUnit === 'fibers_cm3_h' && (
                <ReferenceLine
                  yAxisId="left"
                  y={report.dailyDoseLimitFibersCm3H}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{
                    value: '24t Døgn-Grænse (0,0240 f/cm³·t)',
                    fill: '#fca5a5',
                    fontSize: 9,
                    position: 'insideTopLeft',
                  }}
                />
              )}

              <ReferenceLine
                yAxisId="left"
                x={String(currentWeather.hourIndex).padStart(2, '0')}
                stroke="#ffffff"
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const row = payload[0].payload as Record<string, number | string>;
                  return (
                    <div className="bg-slate-950/95 border border-slate-700 rounded p-2.5 shadow-2xl font-mono text-[10px] space-y-1.5 max-w-xs">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                        <span className="font-bold text-white">
                          Kl. {row.hourLabel} (Akkumuleret Asbest-Dosis)
                        </span>
                        <span className="text-rose-300 font-bold">
                          Max: {Number(row.peakHourlyConc ?? 0).toFixed(4)} f/cm³
                        </span>
                      </div>
                      <div className="space-y-1">
                        {top5Neighbors.map((n, idx) => {
                          const pal =
                            NEIGHBOR_CURVE_PALETTE[idx % NEIGHBOR_CURVE_PALETTE.length];
                          const cumDose = Number(row[`cum_dose_${n.receptorId}`] ?? 0);
                          const cumInh = Number(row[`cum_inhaled_${n.receptorId}`] ?? 0);
                          const hrConc = Number(row[`conc_${n.receptorId}`] ?? 0);
                          return (
                            <div
                              key={n.receptorId}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: pal.stroke }}
                                />
                                <span className="text-slate-200 font-bold">
                                  {n.receptorCode}:
                                </span>
                              </span>
                              <span className="text-white font-bold">
                                {chartDisplayUnit === 'fibers_cm3_h'
                                  ? `${cumDose.toFixed(4)} f/cm³·t (+${hrConc.toFixed(4)}/t)`
                                  : `${cumInh.toLocaleString('da-DK')} fibre`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />

              <Bar
                yAxisId="right"
                dataKey={
                  chartDisplayUnit === 'fibers_cm3_h'
                    ? 'peakHourlyConc'
                    : 'peakHourlyInhaled'
                }
                fill="#f43f5e"
                fillOpacity={0.22}
                radius={[2, 2, 0, 0]}
              />

              {top5Neighbors.map((n, idx) => {
                const pal = NEIGHBOR_CURVE_PALETTE[idx % NEIGHBOR_CURVE_PALETTE.length];
                const key =
                  chartDisplayUnit === 'fibers_cm3_h'
                    ? `cum_dose_${n.receptorId}`
                    : `cum_inhaled_${n.receptorId}`;
                if (idx === 0) {
                  return (
                    <Area
                      key={n.receptorId}
                      yAxisId="left"
                      type="monotone"
                      dataKey={key}
                      name={n.receptorCode}
                      stroke={pal.stroke}
                      strokeWidth={2.5}
                      fill={pal.fill}
                      fillOpacity={0.15}
                    />
                  );
                }
                return (
                  <Line
                    key={n.receptorId}
                    yAxisId="left"
                    type="monotone"
                    dataKey={key}
                    name={n.receptorCode}
                    stroke={pal.stroke}
                    strokeWidth={2}
                    dot={false}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[9.5px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {top5Neighbors.map((n, idx) => {
              const pal = NEIGHBOR_CURVE_PALETTE[idx % NEIGHBOR_CURVE_PALETTE.length];
              return (
                <button
                  key={n.receptorId}
                  type="button"
                  onClick={() => onSelectReceptor(n.receptorId)}
                  className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: pal.stroke }}
                  />
                  <span className="font-bold text-slate-200">{n.receptorCode}</span>
                </button>
              );
            })}
          </div>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>Klik på grafen for at vælge time (Valgt: kl. {currentWeather.hourLabel})</span>
          </span>
        </div>
      </div>

      {/* Ranked Table / Cards of Most Exposed Neighbor Blocks with Source Attribution Breakdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10.5px] font-mono">
          <span className="font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-rose-400" />
            <span>
              Rangliste: Mest Udsatte Naboblokke &amp; Kilde-Bidrag ({report.neighborSummaries.length})
            </span>
          </span>
          <span className="text-slate-400">
            Berørte beboere: <strong className="text-white">{report.totalExposedResidentsCount}</strong>
          </span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
          {report.neighborSummaries.map((n, idx) => {
            const isSelected = selectedReceptorId === n.receptorId;
            const isCrit = n.riskClassification === 'KRITISK_DØGNDOSIS';
            const isElev = n.riskClassification === 'FORHØJET_AKTIONSDOSIS';

            return (
              <div
                key={n.receptorId}
                onClick={() => onSelectReceptor(n.receptorId)}
                className={`p-2.5 rounded border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-400 ring-1 ring-cyan-400/50'
                    : isCrit
                    ? 'bg-rose-950/25 border-rose-500/50 hover:border-rose-400'
                    : isElev
                    ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-extrabold">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {n.receptorCode}: {n.receptorName}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                          isCrit
                            ? 'bg-rose-600 text-white'
                            : isElev
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {isCrit
                          ? '⚠ KRITISK 24T-DOSIS'
                          : isElev
                          ? 'FORHØJET 24T-DOSIS'
                          : 'OBSERVATIONSZONE'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {n.address} • {n.distanceToDominantSourceMeters} m fra {n.dominantSourceCode} •
                      ca. {n.residentCountEstimate} beboere
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <div
                      className={`text-xs font-extrabold ${
                        isCrit ? 'text-rose-300' : isElev ? 'text-amber-300' : 'text-cyan-300'
                      }`}
                    >
                      ∑ 24t = {n.total24hDoseFibersCm3H.toFixed(4)} f/cm³·t
                    </div>
                    <div className="text-[9.5px] text-slate-300">
                      {(n.dailyDoseQuotient * 100).toFixed(0)}% af døgngrænse •{' '}
                      {n.totalInhaledFibersPerResident24h.toLocaleString('da-DK')} fibre/beboer
                    </div>
                  </div>
                </div>

                {/* Stacked Bar Showing Percentage Contribution from Each Active Demolition Source */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400">
                    <span>Kilde-bidrag til 24t asbest-dosis:</span>
                    <span>
                      Spids kl.{' '}
                      <strong className="text-white">{n.peakHourLabel}</strong> (
                      {n.peakConcentrationFibersCm3.toFixed(4)} f/cm³) •{' '}
                      <strong className="text-rose-300">{n.hoursExceedingGv2026}t</strong> &ge; GV
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden flex border border-slate-800">
                    {n.sourceContributions.map((sc) => (
                      <div
                        key={sc.sourceId}
                        style={{
                          width: `${Math.max(2, sc.sharePct)}%`,
                          backgroundColor: SOURCE_BAR_COLORS[sc.sourceId] || '#f43f5e',
                        }}
                        title={`${sc.sourceCode}: ${sc.sharePct}% (${sc.doseFibersCm3H.toFixed(
                          4
                        )} f/cm³·t)`}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[9.5px] font-mono pt-0.5">
                    {n.sourceContributions.map((sc) => (
                      <span
                        key={sc.sourceId}
                        className="inline-flex items-center gap-1 text-slate-300"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: SOURCE_BAR_COLORS[sc.sourceId] || '#f43f5e',
                          }}
                        />
                        <span>
                          <strong>{sc.sourceCode}:</strong> {sc.sharePct}% (
                          {sc.doseFibersCm3H.toFixed(4)} f/cm³·t)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
