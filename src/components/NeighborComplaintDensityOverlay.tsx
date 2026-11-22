import React, { useEffect, useMemo, useState } from 'react';
import { Flame, ChevronDown, ChevronUp, Crosshair, Filter } from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  LatLngPoint,
  ReceptorZone,
  RingparkenBuildingUnit,
} from '../types/dispersion';

export type ComplaintDensityFilterMode = 'all' | 'noise' | 'dust';

export interface BlockComplaintDensityItem {
  id: string;
  code: string;
  name: string;
  address: string;
  kind: 'demolition_sector' | 'residential_receptor' | 'building_block';
  center: LatLngPoint;
  polygon: LatLngPoint[];
  directComplaintCount: number;
  weightedDensityScore: number; // raw kernel-weighted score
  normalizedDensity: number; // 0..1 relative to peak disputed block/sector
  noiseComplaintCount: number;
  dustComplaintCount: number;
  inPlumeCorroboratedCount: number;
  heatFillHex: string;
  heatStrokeHex: string;
  heatLabelDa: string;
  linkedSourceId?: string;
  linkedReceptorId?: string;
}

export interface NeighborComplaintDensitySummary {
  items: BlockComplaintDensityItem[];
  topDisputedItems: BlockComplaintDensityItem[];
  totalFilteredComplaints: number;
  maxWeightedScore: number;
}

function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isNoiseObservation(obs: AlgedonicObservation): boolean {
  const txt = `${obs.observationType} ${obs.description}`.toLowerCase();
  return (
    Boolean(obs.audioEvidence) ||
    txt.includes('støj') ||
    txt.includes('impuls') ||
    txt.includes('db') ||
    txt.includes('vibration') ||
    txt.includes('trykbølge') ||
    txt.includes('hammer') ||
    txt.includes('knus')
  );
}

export function isDustObservation(obs: AlgedonicObservation): boolean {
  const txt = `${obs.observationType} ${obs.description}`.toLowerCase();
  return (
    txt.includes('støv') ||
    txt.includes('asbest') ||
    txt.includes('fane') ||
    txt.includes('fiber') ||
    txt.includes('partikel') ||
    txt.includes('bly') ||
    txt.includes('pcb') ||
    obs.plumeCorroboration.calculatedSumQuotient >= 0.45
  );
}

function heatColorForNormalizedDensity(norm: number): {
  fillHex: string;
  strokeHex: string;
  labelDa: string;
} {
  if (norm >= 0.78) {
    return {
      fillHex: '#e11d48',
      strokeHex: '#fda4af',
      labelDa: 'Kritisk Tæthed',
    };
  }
  if (norm >= 0.5) {
    return {
      fillHex: '#f97316',
      strokeHex: '#fdba74',
      labelDa: 'Høj Tæthed',
    };
  }
  if (norm >= 0.22) {
    return {
      fillHex: '#eab308',
      strokeHex: '#fde047',
      labelDa: 'Moderat Tæthed',
    };
  }
  return {
    fillHex: '#06b6d4',
    strokeHex: '#67e8f9',
    labelDa: 'Lav Tæthed',
  };
}

/**
 * Computes a spatial Gaussian kernel density of Registered Neighbor Complaints
 * across all Ringparken demolition sectors, residential receptor blocks, and master building footprints.
 */
export function computeNeighborComplaintBlockDensity(params: {
  observations: AlgedonicObservation[];
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  buildings: RingparkenBuildingUnit[];
  filterMode?: ComplaintDensityFilterMode;
}): NeighborComplaintDensitySummary {
  const {
    observations,
    sources,
    receptors,
    buildings,
    filterMode = 'all',
  } = params;

  const filteredObs = observations.filter((obs) => {
    if (filterMode === 'noise') return isNoiseObservation(obs);
    if (filterMode === 'dust') return isDustObservation(obs);
    return true;
  });

  // Build candidate map blocks covering both Demolition Sectors (sources) and Neighbor Receptor Blocks
  const rawBlocks: Array<{
    id: string;
    code: string;
    name: string;
    address: string;
    kind: BlockComplaintDensityItem['kind'];
    center: LatLngPoint;
    polygon: LatLngPoint[];
    linkedSourceId?: string;
    linkedReceptorId?: string;
  }> = [];

  const coveredBuildingIds: Record<string, boolean> = {};

  sources.forEach((src) => {
    if (src.buildingUnitId) coveredBuildingIds[src.buildingUnitId] = true;
    rawBlocks.push({
      id: `sector-${src.id}`,
      code: src.code,
      name: src.name,
      address: src.address,
      kind: 'demolition_sector',
      center: src.position,
      polygon: src.footprint,
      linkedSourceId: src.id,
    });
  });

  receptors.forEach((rec) => {
    if (rec.buildingUnitId) coveredBuildingIds[rec.buildingUnitId] = true;
    rawBlocks.push({
      id: `recblock-${rec.id}`,
      code: rec.code,
      name: rec.name,
      address: rec.address,
      kind: 'residential_receptor',
      center: rec.center,
      polygon: rec.polygon,
      linkedReceptorId: rec.id,
    });
  });

  buildings.forEach((bldg) => {
    if (coveredBuildingIds[bldg.id]) return;
    rawBlocks.push({
      id: `bldgblock-${bldg.id}`,
      code: bldg.code,
      name: bldg.name,
      address: bldg.address,
      kind: 'building_block',
      center: bldg.center,
      polygon: bldg.footprint,
    });
  });

  const sigmaMeters = 68; // Spatial smoothing bandwidth across Ringparken blocks

  const scored = rawBlocks.map((blk) => {
    let directComplaintCount = 0;
    let weightedDensityScore = 0;
    let noiseComplaintCount = 0;
    let dustComplaintCount = 0;
    let inPlumeCorroboratedCount = 0;

    filteredObs.forEach((obs) => {
      const dist = haversineMeters(blk.center, obs.position);
      const isAttributedSource =
        Boolean(blk.linkedSourceId) &&
        obs.plumeCorroboration.nearestSourceId === blk.linkedSourceId;

      // Direct hit if within 55m of block center or explicitly attributed as nearest demolition source
      if (dist <= 58 || isAttributedSource) {
        directComplaintCount += 1;
        if (isNoiseObservation(obs)) noiseComplaintCount += 1;
        if (isDustObservation(obs)) dustComplaintCount += 1;
        if (obs.plumeCorroboration.isInsideMathematicalPlume) {
          inPlumeCorroboratedCount += 1;
        }
      }

      const spatialKernel = Math.exp(-(dist * dist) / (2 * sigmaMeters * sigmaMeters));
      const sourceAttributionBoost = isAttributedSource ? 0.85 : 0;
      const severityMultiplier =
        1 +
        Math.min(1.2, obs.plumeCorroboration.calculatedSumQuotient * 0.45) +
        (obs.audioEvidence ? 0.35 : 0) +
        (obs.photoEvidence ? 0.25 : 0);

      weightedDensityScore +=
        (spatialKernel + sourceAttributionBoost) * severityMultiplier;
    });

    return {
      ...blk,
      directComplaintCount,
      weightedDensityScore,
      noiseComplaintCount,
      dustComplaintCount,
      inPlumeCorroboratedCount,
    };
  });

  const maxWeightedScore = Math.max(
    0.001,
    ...scored.map((s) => s.weightedDensityScore)
  );

  const items: BlockComplaintDensityItem[] = scored
    .map((s) => {
      const normalizedDensity =
        filteredObs.length === 0
          ? 0
          : Math.min(1, s.weightedDensityScore / maxWeightedScore);
      const color = heatColorForNormalizedDensity(normalizedDensity);
      return {
        ...s,
        normalizedDensity,
        heatFillHex: color.fillHex,
        heatStrokeHex: color.strokeHex,
        heatLabelDa: color.labelDa,
      };
    })
    .sort((a, b) => b.weightedDensityScore - a.weightedDensityScore);

  return {
    items,
    topDisputedItems: items.filter((i) => i.weightedDensityScore > 0.08).slice(0, 6),
    totalFilteredComplaints: filteredObs.length,
    maxWeightedScore,
  };
}

export interface NeighborComplaintDensityOverlayProps {
  summary: NeighborComplaintDensitySummary;
  filterMode: ComplaintDensityFilterMode;
  onChangeFilterMode: (mode: ComplaintDensityFilterMode) => void;
  opacityPct: number;
  onChangeOpacityPct: (nextPct: number) => void;
  onFocusItem: (item: BlockComplaintDensityItem) => void;
  onCloseOverlay: () => void;
}

export const NeighborComplaintDensityOverlay: React.FC<
  NeighborComplaintDensityOverlayProps
> = ({
  summary,
  filterMode,
  onChangeFilterMode,
  opacityPct,
  onChangeOpacityPct,
  onFocusItem,
  onCloseOverlay,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const onMin = () => setIsCollapsed(true);
    const onRes = () => setIsCollapsed(false);
    window.addEventListener('ringparken-minimize-map-hud-overlays', onMin);
    window.addEventListener('ringparken-restore-map-hud-overlays', onRes);
    return () => {
      window.removeEventListener('ringparken-minimize-map-hud-overlays', onMin);
      window.removeEventListener('ringparken-restore-map-hud-overlays', onRes);
    };
  }, []);

  const disputedSectorsCount = useMemo(
    () =>
      summary.items.filter(
        (i) => i.kind === 'demolition_sector' && i.normalizedDensity >= 0.35
      ).length,
    [summary.items]
  );

  return (
    <div
      data-testid="neighbor-complaint-density-overlay-card"
      onClick={(e) => e.stopPropagation()}
      className="w-[310px] sm:w-[340px] rounded-md bg-slate-950/92 border border-slate-700/90 text-slate-100 shadow-xl backdrop-blur-xs select-none"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="text-xs font-semibold text-white truncate">
            Naboklage-Tæthed pr. Kortblok
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-0.5 cursor-pointer whitespace-nowrap shrink-0"
            title={isCollapsed ? 'Udvid tætheds-oversigt' : 'Komprimer tætheds-oversigt'}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Udvid</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Minimer</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCloseOverlay}
            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-rose-900/70 border border-slate-700 text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
            title="Skjul Naboklage-Tæthedslag på kortet"
          >
            Skjul
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 space-y-2.5 text-xs">
          {/* Clean unboxed metadata summary */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300 font-mono tabular-nums">
            <span>{summary.totalFilteredComplaints} registrerede klager</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-rose-300 font-semibold">
              {disputedSectorsCount} omstridte nedrivningssektorer
            </span>
          </div>

          {/* Segmented Filter Control */}
          <div className="flex items-center gap-1 p-1 rounded bg-slate-900 border border-slate-800">
            <Filter className="w-3 h-3 text-slate-400 ml-1 shrink-0" />
            {(
              [
                { id: 'all', label: 'Alle klager' },
                { id: 'noise', label: 'Støj' },
                { id: 'dust', label: 'Støv & Asbest' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeFilterMode(opt.id)}
                className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  filterMode === opt.id
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Calibrated Heatmap Density Ramp */}
          <div className="space-y-1">
            <div className="h-2 w-full rounded-xs bg-gradient-to-r from-cyan-500 via-yellow-400 via-orange-500 to-rose-600 border border-slate-800" />
            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
              <span>0% Lav</span>
              <span>35% Moderat</span>
              <span>65% Høj</span>
              <span className="text-rose-300 font-semibold">100% Brændpunkt</span>
            </div>
          </div>

          {/* Ranked Most Disputed Demolition Sectors & Map Blocks */}
          {summary.topDisputedItems.length === 0 ? (
            <div className="py-3 text-center text-[11px] text-slate-400 border border-slate-800/80 rounded bg-slate-900/50">
              Ingen registrerede naboklager matcher det valgte filter endnu.
            </div>
          ) : (
            <div className="space-y-1 max-h-[168px] overflow-y-auto pr-0.5">
              <div className="text-[11px] font-medium text-slate-400">
                Mest omstridte nedrivningssektorer &amp; blokke (klik for fokus):
              </div>
              {summary.topDisputedItems.map((item, idx) => {
                const pct = Math.round(item.normalizedDensity * 100);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onFocusItem(item)}
                    className="w-full px-2 py-1.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white truncate">
                        <span className="font-mono tabular-nums text-slate-400">
                          {idx + 1}.
                        </span>
                        <span className="truncate">
                          {item.code}: {item.name.replace(/^Bygning \d:\s*|^Blok \d:\s*/, '')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                        {item.kind === 'demolition_sector'
                          ? 'Nedrivningssektor'
                          : 'Naboblok'}{' '}
                        · {item.directComplaintCount} kl. ({item.noiseComplaintCount} støj /{' '}
                        {item.dustComplaintCount} støv)
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                      <span
                        className={`text-[11px] font-bold ${
                          pct >= 78
                            ? 'text-rose-400'
                            : pct >= 50
                            ? 'text-orange-300'
                            : pct >= 22
                            ? 'text-yellow-300'
                            : 'text-cyan-300'
                        }`}
                      >
                        {pct}%
                      </span>
                      <Crosshair className="w-3 h-3 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Layer Opacity Scrubber */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/90 text-[11px] font-mono tabular-nums text-slate-400">
            <span>Lag-dækning: {opacityPct}%</span>
            <input
              type="range"
              min={25}
              max={95}
              step={5}
              value={opacityPct}
              onChange={(e) => onChangeOpacityPct(Number(e.target.value))}
              aria-label="Juster gennemsigtighed for naboklage-heatmap"
              className="w-28 accent-rose-500 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
