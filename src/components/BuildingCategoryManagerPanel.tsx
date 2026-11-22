import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Crosshair,
  Droplets,
  FileDown,
  Filter,
  Layers,
  RotateCcw,
  Search,
  ShieldAlert,
  Sliders,
  Wind,
} from 'lucide-react';
import { generateBuildingRegistryInspectionPdfReport } from '../services/pdfExportService';
import {
  BUILDING_CATEGORY_METADATA,
  RINGPARKEN_MASTER_BUILDINGS,
  getReceptorIdForBuilding,
  getSourceIdForBuilding,
} from '../data/ringparkenData';
import {
  BuildingOperationalCategory,
  HourlyWeatherPoint,
  ReceptorExposureResult,
  RingparkenBuildingUnit,
} from '../types/dispersion';

export interface BuildingCategoryManagerPanelProps {
  buildings: RingparkenBuildingUnit[];
  activeCategoryFilters: BuildingOperationalCategory[];
  onToggleCategoryFilter: (cat: BuildingOperationalCategory) => void;
  onResetCategoryFilters: () => void;
  onChangeBuildingCategory: (
    buildingId: string,
    nextCategory: BuildingOperationalCategory
  ) => void;
  onApplyBatchScenario: (
    updater: (prev: RingparkenBuildingUnit[]) => RingparkenBuildingUnit[],
    focusBuildingId?: string
  ) => void;
  onSelectBuildingOnMap?: (building: RingparkenBuildingUnit) => void;
  selectedBuildingId?: string | null;
  receptorExposures: ReceptorExposureResult[];
  currentWeather: HourlyWeatherPoint;
  compactMode?: boolean;
}

const ORDERED_CATEGORIES: BuildingOperationalCategory[] = [
  'a_inhabited',
  'b_vacant',
  'c_under_renovation',
  'd_under_demolition',
  'e_demolished_unsecured',
];

export const BuildingCategoryManagerPanel: React.FC<BuildingCategoryManagerPanelProps> = ({
  buildings,
  activeCategoryFilters,
  onToggleCategoryFilter,
  onResetCategoryFilters,
  onChangeBuildingCategory,
  onApplyBatchScenario,
  onSelectBuildingOnMap,
  selectedBuildingId,
  receptorExposures,
  currentWeather,
  compactMode = false,
}) => {
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const countsByCategory = useMemo(() => {
    const map: Record<BuildingOperationalCategory, number> = {
      a_inhabited: 0,
      b_vacant: 0,
      c_under_renovation: 0,
      d_under_demolition: 0,
      e_demolished_unsecured: 0,
    };
    for (const b of buildings) {
      map[b.category] = (map[b.category] || 0) + 1;
    }
    return map;
  }, [buildings]);

  const exposureByReceptorId = useMemo(() => {
    const map = new Map<string, ReceptorExposureResult>();
    for (const exp of receptorExposures) {
      map.set(exp.receptorId, exp);
    }
    return map;
  }, [receptorExposures]);

  const filteredBuildings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return buildings.filter((b) => {
      if (!activeCategoryFilters.includes(b.category)) return false;
      if (departmentFilter !== 'ALL' && b.department !== departmentFilter) return false;
      if (
        q &&
        !b.name.toLowerCase().includes(q) &&
        !b.code.toLowerCase().includes(q) &&
        !b.address.toLowerCase().includes(q) &&
        !b.department.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [buildings, activeCategoryFilters, departmentFilter, searchQuery]);

  const windResuspensionMult =
    currentWeather.windSpeed10m > 5.0
      ? Math.pow(currentWeather.windSpeed10m / 5.0, 1.35)
      : 1.0;

  const receptorFundBuildings = useMemo(() => {
    return buildings.filter((b) => {
      const meta = BUILDING_CATEGORY_METADATA[b.category];
      if (!meta.actsAsReceptor) return false;
      const exp = exposureByReceptorId.get(getReceptorIdForBuilding(b.id));
      return exp && exp.sumQuotient >= 0.45;
    });
  }, [buildings, exposureByReceptorId]);

  return (
    <div className="p-3.5 rounded-md bg-slate-900/95 border border-cyan-500/40 space-y-3 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-bold flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>INTERAKTIV BYGNINGSKATEGORI-STYRING (A–E) · 29 ENHEDER</span>
          </div>
          <h4 className="text-xs font-bold text-white mt-0.5">
            Dynamisk Kilde-/Receptorkobling &amp; &quot;Hvad-hvis&quot; Scenariesimulering
          </h4>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-300">
          <span>
            Aktive kilder:{' '}
            <strong className="text-rose-300">
              {buildings.filter((b) => BUILDING_CATEGORY_METADATA[b.category].actsAsSource).length}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Receptor-bygninger:{' '}
            <strong className="text-emerald-300">
              {buildings.filter((b) => BUILDING_CATEGORY_METADATA[b.category].actsAsReceptor).length}
            </strong>
          </span>
          <button
            type="button"
            onClick={() =>
              generateBuildingRegistryInspectionPdfReport({
                buildings,
                dateIso: currentWeather.isoTime.slice(0, 10),
                hourLabel: currentWeather.hourLabel,
                sha256Hash: '8F4E2C9A1B7D6E3F5A0C8B2D4E6F1A9C3B5D7E9F0A2C4E6B8D0F2A4C6E8B0D2F',
                receptorExposures,
              })
            }
            className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="Eksportér PDF-oversigtstabel over alle 29 bygningsenheder med statuskoder (a–e) til hurtig fysisk inspektion"
          >
            <FileDown className="w-3 h-3 text-cyan-300" />
            <span>PDF-Inspektionstabel (29 Enheder a–e)</span>
          </button>
        </div>
      </div>

      {/* Digital Twin Master-KPI Strip (150.000 m² · Skema B 721.618.000 kr.) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 rounded bg-slate-950/85 border border-cyan-500/25 font-mono text-[11px]">
        <div className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase">Matrikelareal (Slagelse)</div>
          <div className="text-cyan-300 font-bold">150.000 m² Digital Tvilling</div>
        </div>
        <div className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase">Helhedsplan Skema B</div>
          <div className="text-emerald-300 font-bold">721.618.000 kr.</div>
        </div>
        <div className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase">Bygningsregister</div>
          <div className="text-amber-200 font-bold">24 Blokke + 5 Erhverv/Inst.</div>
        </div>
        <div className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase">Afd. 23 · 24 · 26 · 32 · SAB</div>
          <div className="text-slate-200 font-bold">
            {buildings.reduce((acc, b) => acc + b.dwellingsCount, 0)} boliger + 5 inst.
          </div>
        </div>
      </div>

      {/* What-If Scenario Quick Presets */}
      <div className="p-2.5 rounded bg-slate-950/90 border border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1">
            <Sliders className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Simulér &quot;Hvad-hvis&quot; Fase- &amp; Nedrivningsscenarier:</span>
          </span>
          <button
            type="button"
            onClick={() =>
              onApplyBatchScenario(
                () => RINGPARKEN_MASTER_BUILDINGS.map((b) => ({ ...b })),
                'BLOK-1'
              )
            }
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono flex items-center gap-1 transition-colors"
            title="Nulstil alle 29 bygninger til standard Helhedsplan-status"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Nulstil Standard</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={() =>
              onApplyBatchScenario(
                (prev) =>
                  prev.map((b) =>
                    b.id === 'BLOK-1' ? { ...b, category: 'e_demolished_unsecured' } : b
                  ),
                'BLOK-1'
              )
            }
            className="p-2 rounded bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/50 text-left text-amber-100 transition-colors"
          >
            <div className="font-bold text-amber-300">
              1. Blok 1 → e. Nedrevet, ikke sikret
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Blotlagt krybekælder (H=1m), vindresuspension ({windResuspensionMult.toFixed(2)}x), +250% perkolation &amp; fjernet læ-effekt
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onApplyBatchScenario(
                (prev) =>
                  prev.map((b) =>
                    b.id === 'BLOK-9' || b.id === 'BLOK-10'
                      ? { ...b, category: 'd_under_demolition' }
                      : b
                  ),
                'BLOK-9'
              )
            }
            className="p-2 rounded bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/50 text-left text-rose-100 transition-colors"
          >
            <div className="font-bold text-rose-300">
              2. Blok 9 &amp; 10 → d. Under nedrivning
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Etape 2 del 2 aktiveres (Kierulffsvej 90-104 skifter fra b. Tom til fuld nedrivning 1,00x)
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onApplyBatchScenario(
                (prev) =>
                  prev.map((b) =>
                    b.id === 'BYG-1-BOERNEHAVE' || b.id === 'BYG-2-BAZAR'
                      ? { ...b, category: 'e_demolished_unsecured' }
                      : b
                  ),
                'BYG-1-BOERNEHAVE'
              )
            }
            className="p-2 rounded bg-amber-950/30 hover:bg-amber-900/45 border border-amber-500/40 text-left text-amber-100 transition-colors"
          >
            <div className="font-bold text-amber-200">
              3. Bygning 1 &amp; 2 → e. Uforseglet kældergrube
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Åben kældergrube ved Kierulffsvej 2 &amp; Ndr. Ringgade 67B (+250% regnperkolation)
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onApplyBatchScenario(
                (prev) =>
                  prev.map((b) =>
                    b.id === 'BLOK-3' || b.id === 'BLOK-4'
                      ? { ...b, category: 'c_under_renovation' }
                      : b
                  ),
                'BLOK-3'
              )
            }
            className="p-2 rounded bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/50 text-left text-sky-100 transition-colors"
          >
            <div className="font-bold text-sky-300">
              4. Blok 3 &amp; 4 → c. Under Renovering (0,45x)
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Parallel gavludskæring, faldstammer &amp; arbejdsmiljø-/naboreceptor (H=8m)
            </div>
          </button>
        </div>
      </div>

      {/* Category Filter Buttons (a to e) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-cyan-400" />
            <span>Filtrér synlige bygningskategorier (2D, 3D &amp; Liste):</span>
          </span>
          {activeCategoryFilters.length < ORDERED_CATEGORIES.length && (
            <button
              type="button"
              onClick={onResetCategoryFilters}
              className="text-cyan-300 hover:underline"
            >
              Vis alle 5 kategorier
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {ORDERED_CATEGORIES.map((catCode) => {
            const meta = BUILDING_CATEGORY_METADATA[catCode];
            const isActive = activeCategoryFilters.includes(catCode);
            const count = countsByCategory[catCode];
            return (
              <button
                key={catCode}
                type="button"
                onClick={() => onToggleCategoryFilter(catCode)}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-800 text-white border-slate-500 font-bold shadow-sm'
                    : 'bg-slate-950/60 text-slate-500 border-slate-800/80 opacity-60 hover:opacity-90'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: meta.colorHex }}
                />
                <span>{meta.labelDa}</span>
                <span className="text-slate-400">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Physical & Legal Rule Indicators for Categories a-e */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono">
        {countsByCategory.e_demolished_unsecured > 0 && (
          <div className="p-2 rounded bg-amber-950/45 border border-amber-500/50 text-amber-200 space-y-0.5">
            <div className="font-bold flex items-center gap-1 text-amber-300">
              <Wind className="w-3 h-3 shrink-0" />
              <span>
                Kategori e Aktiv ({countsByCategory.e_demolished_unsecured} enhed): Jordnær Kilde (H=1,0m)
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              {currentWeather.windSpeed10m > 5.0
                ? `Vind > 5 m/s (${currentWeather.windSpeed10m} m/s): Resuspension ×${windResuspensionMult.toFixed(2)} ((v/5)^1.35)`
                : `Vind ≤ 5 m/s (${currentWeather.windSpeed10m} m/s): Basal støvfrigivelse (0,65x)`}
              {currentWeather.precipitation > 0.2
                ? ` · Regn (${currentWeather.precipitation} mm/t): +250% perkolation aktiv!`
                : ' · Læ-effekt & støjafskærmning fjernet'}
            </div>
          </div>
        )}

        {receptorFundBuildings.length > 0 && (
          <div className="p-2 rounded bg-rose-950/45 border border-rose-500/50 text-rose-200 space-y-0.5">
            <div className="font-bold flex items-center gap-1 text-rose-300">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>
                [RECEPTOR-FUND] S ≥ 0,45 ({receptorFundBuildings.length} bygninger)
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              Kontrol af 4-ugers lejerunderretningspligt jf. Jordforureningslovens § 12 og § 70, stk. 4 ({receptorFundBuildings.map((b) => b.code).join(', ')})
            </div>
          </div>
        )}
      </div>

      {/* Department Filter + Search */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800">
        <div className="flex flex-wrap gap-1">
          {[
            { id: 'ALL', label: `Alle (${buildings.length})` },
            { id: 'FOB Afd. 23', label: 'Afd. 23 (6)' },
            { id: 'FOB Afd. 24', label: 'Afd. 24 (4)' },
            { id: 'FOB Afd. 26', label: 'Afd. 26 (4)' },
            { id: 'FOB Afd. 32', label: 'Afd. 32 (6)' },
            { id: 'SAB Schackenborgvænge', label: 'SAB (4)' },
            { id: 'Erhverv & Institutioner', label: 'Erhverv (5)' },
          ].map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => setDepartmentFilter(dept.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                departmentFilter === dept.id
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              {dept.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[150px]">
          <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søg blok, vej eller afd..."
            className="w-full bg-slate-950 border border-slate-800 rounded pl-6 pr-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Scrollable Building List */}
      <div
        className={`${
          compactMode ? 'max-h-72' : 'max-h-96'
        } overflow-y-auto space-y-1.5 pr-1`}
      >
        {filteredBuildings.map((b) => {
          const meta = BUILDING_CATEGORY_METADATA[b.category];
          const recExp = meta.actsAsReceptor
            ? exposureByReceptorId.get(getReceptorIdForBuilding(b.id))
            : undefined;
          const isReceptorFund = recExp !== undefined && recExp.sumQuotient >= 0.45;
          const isSelected = selectedBuildingId === b.id;

          return (
            <div
              key={b.id}
              onClick={() => onSelectBuildingOnMap?.(b)}
              className={`p-2.5 rounded border transition-colors cursor-pointer flex flex-col gap-1.5 ${
                isSelected
                  ? 'bg-slate-900 border-cyan-400 shadow-sm'
                  : isReceptorFund
                  ? 'bg-rose-950/25 border-rose-500/50 hover:border-rose-400'
                  : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: meta.colorHex }}
                    />
                    <span className="text-xs font-mono font-bold text-white">
                      {b.code}: {b.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      · {b.department}
                    </span>
                    {isReceptorFund && (
                      <span className="text-[11px] font-mono font-extrabold text-rose-300">
                        · [RECEPTOR-FUND: S={recExp.sumQuotient.toFixed(2)}]
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {b.address}
                    {b.dwellingsCount > 0 ? ` · ${b.dwellingsCount} bol.` : ''} · {b.floors} etg. (
                    {b.constructionYear}) · 3D-Højde: {meta.buildingHeight3DMeters}m
                  </div>

                  <div className="text-[11px] font-mono text-cyan-300/80 truncate">
                    {b.helhedsplanEtape}
                  </div>
                </div>

                <div
                  className="flex flex-col items-end gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <select
                    aria-label={`Skift bygningskategori for ${b.name}`}
                    value={b.category}
                    onChange={(e) =>
                      onChangeBuildingCategory(
                        b.id,
                        e.target.value as BuildingOperationalCategory
                      )
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                  >
                    {ORDERED_CATEGORIES.map((catCode) => {
                      const cMeta = BUILDING_CATEGORY_METADATA[catCode];
                      return (
                        <option key={catCode} value={catCode}>
                          {cMeta.labelDa}
                        </option>
                      );
                    })}
                  </select>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    {meta.actsAsSource && (
                      <span className="text-rose-300">
                        Kilde ({meta.sourceEmissionFactor.toFixed(2)}x · H=
                        {meta.defaultReleaseHeightMeters}m)
                      </span>
                    )}
                    {meta.actsAsSource && meta.actsAsReceptor && <span>·</span>}
                    {meta.actsAsReceptor && (
                      <span className="text-emerald-300">
                        Receptor{recExp ? ` (S=${recExp.sumQuotient.toFixed(2)})` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
