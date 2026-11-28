import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CloudRain,
  Flame,
  Leaf,
  MapPin,
  ShieldCheck,
  Wind,
} from 'lucide-react';
import {
  calculateCavVentilationEnergyLossAndRecovery,
  calculateEmbodiedCarbon,
  calculateHydrologicalLarDetention,
  DemolitionScopeProfile,
  RINGPARKEN_DEMOLITION_SCOPES,
} from '../utils/climateLcaEngine';

export interface ClimateResiliencePanelProps {
  initialPrecipitationMmH?: number;
  onOpenGisMap?: () => void;
}

export const ClimateResiliencePanel: React.FC<ClimateResiliencePanelProps> = ({
  initialPrecipitationMmH = 12,
  onOpenGisMap,
}) => {
  const [scopeId, setScopeId] = useState<DemolitionScopeProfile['id']>('etape1_3_fuld');
  const [reusedMaterialPct, setReusedMaterialPct] = useState<number>(75);
  const [preservedTreesCount, setPreservedTreesCount] = useState<number>(36);
  const [hasDocumentedBek496Plan, setHasDocumentedBek496Plan] = useState<boolean>(false);
  const [heatRecoveryEfficiencyPct, setHeatRecoveryEfficiencyPct] = useState<number>(82.5);
  const [rainIntensityMmH, setRainIntensityMmH] = useState<number>(
    Math.max(12, Math.round(initialPrecipitationMmH))
  );
  const [climateFactor, setClimateFactor] = useState<number>(1.35);

  const lcaResult = useMemo(
    () =>
      calculateEmbodiedCarbon({
        scopeId,
        reusedMaterialPct,
        preservedMatureTreesCount: preservedTreesCount,
        hasDocumentedBek496Plan,
        includeReplacementNewBuild: true,
      }),
    [scopeId, reusedMaterialPct, preservedTreesCount, hasDocumentedBek496Plan]
  );

  const cavResult = useMemo(
    () =>
      calculateCavVentilationEnergyLossAndRecovery({
        apartmentCount: 732,
        heatRecoveryEfficiencyPct,
      }),
    [heatRecoveryEfficiencyPct]
  );

  const larResult = useMemo(
    () =>
      calculateHydrologicalLarDetention({
        presetId: rainIntensityMmH >= 40 ? '100_year_climate' : '10_year',
        areaHa: 4.2,
        imperviousSharePct: 58,
        rainIntensityMmPerHour: rainIntensityMmH,
        climateFactor,
      }),
    [rainIntensityMmH, climateFactor]
  );

  return (
    <div
      data-testid="climate-lca-role-dashboard"
      className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5 text-slate-100 font-sans tabular-nums"
    >
      {/* Header */}
      <div className="p-4 rounded-lg bg-[#151C28] border border-[#2D3B50] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono uppercase tracking-wider font-bold">
            <Leaf className="w-4 h-4 shrink-0" />
            <span>Ringparken LCA, Energirenovering &amp; Lokalplan 1269 LAR</span>
          </div>
          <h2 className="text-lg font-bold text-white mt-0.5">
            Klimaresiliens, Indlejret Kulstof (LCAbyg) &amp; Skybruds-LAR
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Kombineret vurdering af BEK 496/2024 selektiv nedrivning, balanceret varmegenvinding (732 boliger) og tæt LAR-forsinkelse over Slagelse moræneler.
          </p>
        </div>

        {onOpenGisMap && (
          <button
            type="button"
            onClick={onOpenGisMap}
            className="px-3 py-1.5 rounded bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold inline-flex items-center gap-1.5 border border-cyan-400/50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>Åbn GIS Risikokort</span>
          </button>
        )}
      </div>

      {/* 3-Column Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Embodied Carbon & BEK 496/2024 Circular Interlock */}
        <section className="p-4 rounded-lg bg-[#1B2433] border border-[#2D3B50] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              1. Indlejret Kulstof (LCAbyg) &amp; BEK 496/2024
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                lcaResult.isConcreteSavingsBlocked
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              }`}
            >
              {lcaResult.isConcreteSavingsBlocked ? 'SPÆRRET' : 'FRIGIVET'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <label className="block space-y-1">
              <span className="text-slate-300">Nedrivningsomfang</span>
              <select
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value as DemolitionScopeProfile['id'])}
                className="w-full px-2.5 py-1.5 rounded bg-[#111722] border border-[#2D3B50] text-slate-100"
              >
                {Object.values(RINGPARKEN_DEMOLITION_SCOPES).map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.labelDa}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-slate-300">Materialegenbrug</span>
                <span className="text-cyan-300">{reusedMaterialPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={reusedMaterialPct}
                onChange={(e) => setReusedMaterialPct(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-slate-300">Bevarede træer (30+ år)</span>
                <span className="text-emerald-300">{preservedTreesCount} / 48 stk</span>
              </div>
              <input
                type="range"
                min={0}
                max={48}
                step={2}
                value={preservedTreesCount}
                onChange={(e) => setPreservedTreesCount(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </label>

            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={hasDocumentedBek496Plan}
                onChange={(e) => setHasDocumentedBek496Plan(e.target.checked)}
                className="accent-emerald-400 mt-0.5"
              />
              <span className="text-[11px] text-slate-200">
                Dokumenteret BEK 496/2024 miljøsaneringsplan (frigiver nedknust beton)
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2D3B50] font-mono text-[11px]">
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Brutto Aftryk</div>
              <div className="text-sm font-bold text-rose-300">
                {lcaResult.totalGrossTonCo2e.toLocaleString('da-DK')} t CO₂e
              </div>
            </div>
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Netto Balance</div>
              <div className="text-sm font-bold text-amber-300">
                {lcaResult.netCarbonBalanceTonCo2e.toLocaleString('da-DK')} t CO₂e
              </div>
            </div>
          </div>

          {lcaResult.isConcreteSavingsBlocked && (
            <div className="p-2 rounded bg-rose-950/40 border border-rose-500/40 text-[11px] text-rose-200 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                {lcaResult.fullLcaResult.contaminationInterlock.blockedConcreteTonnes.toLocaleString('da-DK')} ton beton tilbageholdt uden dokumenteret PCB/bly-sanering.
              </span>
            </div>
          )}
        </section>

        {/* Card 2: CAV Ventilation & Heat Recovery */}
        <section className="p-4 rounded-lg bg-[#1B2433] border border-[#2D3B50] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 shrink-0" />
              <span>2. CAV-Udsugning &amp; Varmegenvinding</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">732 boliger</span>
          </div>

          <label className="block space-y-1 text-xs">
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-slate-300">Varmegenvinding (VGV)</span>
              <span className="text-cyan-300">{heatRecoveryEfficiencyPct.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={70}
              max={90}
              step={0.5}
              value={heatRecoveryEfficiencyPct}
              onChange={(e) => setHeatRecoveryEfficiencyPct(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Nuværende CAV Tab</div>
              <div className="text-sm font-bold text-amber-300">
                {cavResult.annualVentilationHeatLossMwh.toLocaleString('da-DK')} MWh/år
              </div>
            </div>
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Netto Energibesparelse</div>
              <div className="text-sm font-bold text-emerald-300">
                {cavResult.netEnergySavedMwhPerYear.toLocaleString('da-DK')} MWh/år
              </div>
            </div>
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">CO₂e-Reduktion</div>
              <div className="text-sm font-bold text-cyan-300">
                {cavResult.netCo2eSavedTonPerYear.toLocaleString('da-DK')} t/år
              </div>
            </div>
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Undertryk</div>
              <div className="text-sm font-bold text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                Udlignet
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-300 leading-snug">
            Konvertering fra ubalanceret mekanisk udsugning (CAV) til balanceret ventilation med VGV fjerner undertrykssug fra krybekælder og sparer{' '}
            <strong className="text-emerald-300">
              {cavResult.netCo2eSavedTonPerYear.toLocaleString('da-DK')} ton CO₂e/år
            </strong>.
          </p>
        </section>

        {/* Card 3: Lokalplan 1269 Hydrological LAR Detention */}
        <section className="p-4 rounded-lg bg-[#1B2433] border border-[#2D3B50] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 shrink-0" />
              <span>3. Lokalplan 1269 · Tæt LAR-Forsinkelse</span>
            </h3>
            <span className="text-[11px] font-mono text-cyan-300">Max 2,0 l/s/ha</span>
          </div>

          <div className="space-y-2 text-xs">
            <label className="block space-y-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-slate-300">Dimensionerende Regnintensitet</span>
                <span className="text-sky-300">{rainIntensityMmH} mm/t</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                step={2}
                value={rainIntensityMmH}
                onChange={(e) => setRainIntensityMmH(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-slate-300">Klimafaktor (DMI)</span>
                <span className="text-amber-300">{climateFactor.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={1.6}
                step={0.05}
                value={climateFactor}
                onChange={(e) => setClimateFactor(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Spidstilløb</div>
              <div className="text-sm font-bold text-rose-300">
                {larResult.peakInflowLPerSec.toFixed(1)} l/s
              </div>
            </div>
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Nødvendig LAR-Volumen</div>
              <div className="text-sm font-bold text-cyan-300">
                {larResult.requiredTotalDetentionM3.toLocaleString('da-DK')} m³
              </div>
            </div>
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Tætte Vejkassetter</div>
              <div className="text-sm font-bold text-slate-100">
                {larResult.roadCassettesRequiredM3.toLocaleString('da-DK')} m³
              </div>
            </div>
            <div className="p-2 rounded bg-[#111722] border border-[#253245]">
              <div className="text-[10px] text-slate-400">Tætte LAR-Grøfter</div>
              <div className="text-sm font-bold text-slate-100">
                {larResult.openSealedSwaleRequiredM3.toLocaleString('da-DK')} m³
              </div>
            </div>
          </div>

          <div className="p-2 rounded bg-amber-950/35 border border-amber-500/40 text-[11px] text-amber-200 flex items-start gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{larResult.complianceStatusDa}</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ClimateResiliencePanel;
