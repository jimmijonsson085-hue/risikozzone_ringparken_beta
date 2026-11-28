import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Calendar,
  CloudLightning,
  CloudRain,
  Compass,
  Droplets,
  Flame,
  Play,
  Wind,
} from 'lucide-react';
import { DemolitionSourceNode, ReceptorZone } from '../types/dispersion';
import {
  evaluateHistoricalExtremeScenarioRisk,
  HISTORICAL_EXTREME_WEATHER_SCENARIOS,
  HistoricalExtremeWeatherCategory,
  HistoricalExtremeWeatherScenario,
} from '../utils/historicalExtremeWeatherScenarios';

export interface HistoricalExtremeWeatherModuleProps {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  activeScenarioId?: string | null;
  onApplyScenario: (
    scenario: HistoricalExtremeWeatherScenario,
    targetViewport?: 'keep' | 'underground_3d' | '2d'
  ) => void;
}

type CategoryFilter = 'all' | HistoricalExtremeWeatherCategory;

export const HistoricalExtremeWeatherModule: React.FC<HistoricalExtremeWeatherModuleProps> = ({
  sources,
  receptors,
  activeScenarioId = null,
  onApplyScenario,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const evaluatedScenarios = useMemo(() => {
    return HISTORICAL_EXTREME_WEATHER_SCENARIOS.map((sc) => ({
      scenario: sc,
      risk: evaluateHistoricalExtremeScenarioRisk(sc, sources, receptors),
      hours: sc.generate24Hours(sc.dateIso),
    }));
  }, [sources, receptors]);

  const filteredScenarios = useMemo(() => {
    if (categoryFilter === 'all') return evaluatedScenarios;
    return evaluatedScenarios.filter((item) => item.scenario.category === categoryFilter);
  }, [evaluatedScenarios, categoryFilter]);

  const summaryStats = useMemo(() => {
    const peakWind = Math.max(...evaluatedScenarios.map((e) => e.scenario.peakWindMs));
    const peakGust = Math.max(...evaluatedScenarios.map((e) => e.scenario.peakGustMs));
    const peakRain = Math.max(...evaluatedScenarios.map((e) => e.scenario.peakPrecipMmH));
    const peakS = Math.max(...evaluatedScenarios.map((e) => e.risk.maxSumQuotient));
    return { peakWind, peakGust, peakRain, peakS };
  }, [evaluatedScenarios]);

  const renderCategoryIcon = (cat: HistoricalExtremeWeatherCategory) => {
    if (cat === 'skybrud') return <CloudRain className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    if (cat === 'storm') return <Wind className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    if (cat === 'dry_gale') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    return <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
  };

  return (
    <div
      data-testid="historical-extreme-weather-module"
      className="p-2.5 rounded-md bg-[#151C28] border border-[#2D3B50] space-y-2.5 text-[11px] font-sans tabular-nums"
    >
      {/* Top Header + Live Site Risk Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2D3B50]">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CloudLightning className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Historiske Ekstreme Vejrscenarier · Ringparken Spredningsrisiko
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Kalibrerede Slagelse-hændelser med dokumenteret støvfane- eller udvaskningsrisiko · Spids: vind{' '}
            <strong className="text-rose-300">{summaryStats.peakWind.toFixed(1)} m/s</strong> (stød{' '}
            {summaryStats.peakGust.toFixed(1)}) · nedbør{' '}
            <strong className="text-cyan-300">{summaryStats.peakRain.toFixed(1)} mm/t</strong> · S_max{' '}
            <strong className="text-amber-300">{summaryStats.peakS.toFixed(2)}</strong>
          </p>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1 shrink-0" role="group" aria-label="Filtrér historiske vejrhændelser">
          {(
            [
              { id: 'all', label: `Alle (${evaluatedScenarios.length})` },
              { id: 'storm', label: 'Storm' },
              { id: 'skybrud', label: 'Skybrud' },
              { id: 'dry_gale', label: 'Tør Blæst' },
              { id: 'heat_inversion', label: 'Varme / Inversion' },
            ] as const
          ).map((tab) => {
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`hist-extreme-filter-${tab.id}`}
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-2 py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                    : 'bg-[#1B2433] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scenario Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {filteredScenarios.map(({ scenario, risk, hours }) => {
          const isApplied = activeScenarioId === scenario.id;
          const isHydroDominant =
            scenario.category === 'skybrud' || risk.primaryRiskDomain === 'HYDRO_PERCOLATION';

          return (
            <div
              key={scenario.id}
              data-testid={`hist-extreme-card-${scenario.id}`}
              className={`p-2.5 rounded border transition-colors flex flex-col justify-between gap-2 ${
                isApplied
                  ? 'bg-[#1B2A3B] border-cyan-400'
                  : 'bg-[#1B2433] border-[#2D3B50] hover:border-[#475D7D]'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {renderCategoryIcon(scenario.category)}
                      <span className="font-bold text-xs text-white truncate">
                        {scenario.title}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span>{scenario.dateIso}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{scenario.categoryLabelDa}</span>
                      <span aria-hidden="true">·</span>
                      <span>Spids kl. {risk.peakHourLabel}</span>
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <div
                      className={`text-xs font-bold ${
                        risk.maxSumQuotient >= 1.0
                          ? 'text-rose-300'
                          : risk.maxSumQuotient >= 0.5
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                      }`}
                    >
                      S = {risk.maxSumQuotient.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {risk.worstReceptorCode}
                    </div>
                  </div>
                </div>

                {/* Dense Tabular Telemetry Row */}
                <div className="grid grid-cols-4 gap-1.5 py-1.5 px-2 rounded bg-[#111722] border border-[#253245] font-mono text-[11px]">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Vind / Stød</div>
                    <div className="font-semibold text-slate-100">
                      {scenario.peakWindMs.toFixed(1)} / {scenario.peakGustMs.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Nedbør / Døgn</div>
                    <div className="font-semibold text-cyan-300">
                      {scenario.peakPrecipMmH.toFixed(1)} / {scenario.totalPrecipMm.toFixed(0)}mm
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Faneretning</div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1">
                      <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>
                        {risk.plumeDirectionDeg}° {risk.plumeCompassLabel}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Perkolat Pb</div>
                    <div
                      className={`font-semibold ${
                        risk.hydroSim.leadConcentrationSecondaryUgL >= 1.0
                          ? 'text-rose-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {risk.hydroSim.leadConcentrationSecondaryUgL.toFixed(2)} µg/L
                    </div>
                  </div>
                </div>

                {/* 24-Hour Wind & Rain Spark Bar Strip */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>24t Forløb (Vind m/s &amp; Skybrud mm/t)</span>
                    <span className="text-slate-300">
                      Dybde -{risk.hydroSim.plumeMaxDepthMeters.toFixed(1)} m · Berørt:{' '}
                      {scenario.affectedBlocks.slice(0, 2).join(', ')}
                    </span>
                  </div>
                  <div className="h-5 flex items-end gap-[2px] px-1 py-0.5 rounded bg-[#0E141F] border border-[#243043]">
                    {hours.map((hr) => {
                      const windH = Math.min(100, Math.round((hr.windSpeed10m / 18) * 100));
                      const rainH = Math.min(100, Math.round((hr.precipitation / 35) * 100));
                      const isPeak = hr.hourIndex === scenario.focusHourIndex;
                      return (
                        <div
                          key={`${scenario.id}-hr-${hr.hourIndex}`}
                          className="flex-1 h-full flex items-end justify-center gap-[1px]"
                          title={`${hr.hourLabel}: Vind ${hr.windSpeed10m} m/s, Nedbør ${hr.precipitation} mm/t`}
                        >
                          <div
                            className={`w-full rounded-t-[1px] ${
                              hr.precipitation > 5
                                ? 'bg-cyan-400'
                                : hr.windSpeed10m > 10
                                ? 'bg-rose-400'
                                : isPeak
                                ? 'bg-amber-400'
                                : 'bg-slate-500/70'
                            }`}
                            style={{ height: `${Math.max(12, Math.max(windH, rainH))}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dispersion Mechanism & Mitigation Note */}
                <p className="text-[11px] text-slate-200 leading-snug">
                  {scenario.dispersionRiskMechanismDa}
                </p>
                <p className="text-[11px] text-slate-400 font-mono leading-snug">
                  Erfaring: {scenario.mitigationLessonDa}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-[#2D3B50]/70">
                <button
                  type="button"
                  data-testid={`apply-hist-extreme-${scenario.id}`}
                  onClick={() => onApplyScenario(scenario, 'keep')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1.5 border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    isApplied
                      ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
                      : 'bg-[#151C28] hover:bg-[#212C3E] text-cyan-200 border-[#36465E]'
                  }`}
                >
                  <Play className="w-3 h-3 shrink-0" />
                  <span>{isApplied ? 'Aktiv i simulering' : 'Indlæs i simulering'}</span>
                </button>

                <button
                  type="button"
                  data-testid={`inspect-hist-extreme-3d-${scenario.id}`}
                  onClick={() =>
                    onApplyScenario(scenario, isHydroDominant ? 'underground_3d' : '2d')
                  }
                  className="px-2.5 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#36465E] text-slate-200 text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  {isHydroDominant ? (
                    <>
                      <Droplets className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>Se 3D Perkolation</span>
                    </>
                  ) : (
                    <>
                      <Box className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Inspicér Spredningskort</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
