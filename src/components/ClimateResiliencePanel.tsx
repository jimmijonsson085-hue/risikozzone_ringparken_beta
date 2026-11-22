import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Download,
  Fan,
  Lock,
  MapPin,
  ShieldAlert,
  Sprout,
  Trees,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CONTAMINATION_MAXIMA_RINGPARKEN,
  COWI_2021_VENTILATION_BASELINE,
  DemolitionScopeProfile,
  LCABYG_REFERENCE_FACTORS,
  RINGPARKEN_DEMOLITION_SCOPES,
  RINGPARKEN_LAR_CONSTANTS,
  RainEventPresetId,
  calculateCavVentilationEnergyLossAndRecovery,
  calculateEmbodiedCarbon,
  calculateEmbodiedCarbonAndCircularLca,
  calculateHydrologicalLarDetention,
  calculateLarDetentionVolume,
} from '../utils/climateLcaEngine';

export interface ClimateResiliencePanelProps {
  initialPrecipitationMmH?: number;
  onOpenGisMap?: () => void;
}

const LAR_CATCHMENT_PRESETS = [
  { id: 'vest', labelDa: 'Nedrivningsfelt Vest (1,8 ha)', areaHa: 1.8, imperviousPct: 68 },
  {
    id: 'south-blocks',
    labelDa: 'Sydlige boligblokke — nedsivningsforbud (4,2 ha)',
    areaHa: 4.2,
    imperviousPct: 58,
  },
  { id: 'full-estate', labelDa: 'Hele Ringparken (11,4 ha)', areaHa: 11.4, imperviousPct: 54 },
] as const;

export const ClimateResiliencePanel: React.FC<ClimateResiliencePanelProps> = ({
  initialPrecipitationMmH,
  onOpenGisMap,
}) => {
  // 1. LCA & Cirkulær genanvendelse state
  const [scopeId, setScopeId] =
    useState<DemolitionScopeProfile['id']>('etape1_3_fuld');
  const [reusedMaterialPct, setReusedMaterialPct] = useState<number>(75);
  const [preservedMatureTreesCount, setPreservedMatureTreesCount] =
    useState<number>(36);
  const [hasDocumentedBek496Plan, setHasDocumentedBek496Plan] =
    useState<boolean>(false);
  const [includeReplacementNewBuild, setIncludeReplacementNewBuild] =
    useState<boolean>(true);

  // 2. COWI (2021) CAV -> Balanceret ventilation state
  const [heatRecoveryEfficiencyPct, setHeatRecoveryEfficiencyPct] =
    useState<number>(82.5);

  // 3. Hydrologisk skybruds- & LAR-beregner (Lokalplan 1269) state
  const [rainPresetId, setRainPresetId] = useState<RainEventPresetId>('100_year_climate');
  const [rainIntensityMmPerHour, setRainIntensityMmPerHour] = useState<number>(() =>
    initialPrecipitationMmH && initialPrecipitationMmH > 10
      ? Math.round(initialPrecipitationMmH)
      : 74
  );
  const [areaHa, setAreaHa] = useState<number>(4.2);
  const [imperviousSharePct, setImperviousSharePct] = useState<number>(58);
  const [activeGrassGridSpaces, setActiveGrassGridSpaces] = useState<number>(
    RINGPARKEN_LAR_CONSTANTS.totalGrassGridParkingSpaces
  );

  const lcaResult = useMemo(
    () =>
      calculateEmbodiedCarbonAndCircularLca({
        scopeId,
        reusedMaterialPct,
        preservedMatureTreesCount,
        hasDocumentedBek496Plan,
        includeReplacementNewBuild,
      }),
    [
      scopeId,
      reusedMaterialPct,
      preservedMatureTreesCount,
      hasDocumentedBek496Plan,
      includeReplacementNewBuild,
    ]
  );

  const embodiedCarbonResult = useMemo(
    () =>
      calculateEmbodiedCarbon({
        scopeId,
        reusedMaterialPct,
        preservedMatureTreesCount,
        hasDocumentedBek496Plan,
        includeReplacementNewBuild,
      }),
    [
      scopeId,
      reusedMaterialPct,
      preservedMatureTreesCount,
      hasDocumentedBek496Plan,
      includeReplacementNewBuild,
    ]
  );

  const cavResult = useMemo(
    () =>
      calculateCavVentilationEnergyLossAndRecovery({
        heatRecoveryEfficiencyPct,
      }),
    [heatRecoveryEfficiencyPct]
  );

  const larResult = useMemo(
    () =>
      calculateHydrologicalLarDetention({
        presetId: rainPresetId,
        areaHa,
        imperviousSharePct,
        rainIntensityMmPerHour,
        climateFactor: rainPresetId === '100_year_climate' ? 1.35 : 1.0,
        activeGrassGridSpaces,
      }),
    [
      rainPresetId,
      areaHa,
      imperviousSharePct,
      rainIntensityMmPerHour,
      activeGrassGridSpaces,
    ]
  );

  const larVolumeSummary = useMemo(
    () =>
      calculateLarDetentionVolume({
        areaHa,
        rainIntensityMmPerHour,
        imperviousSharePct,
        activeGrassGridSpaces,
      }),
    [areaHa, rainIntensityMmPerHour, imperviousSharePct, activeGrassGridSpaces]
  );

  const handleSelectRainPreset = (preset: RainEventPresetId) => {
    setRainPresetId(preset);
    if (preset === '10_year') {
      setRainIntensityMmPerHour(28);
    } else if (preset === '100_year_climate') {
      setRainIntensityMmPerHour(74);
    }
  };

  const handleExportClimateJson = () => {
    const payload = {
      exportedAtIso: new Date().toISOString(),
      location: 'Ringparken, 4200 Slagelse',
      statutoryContext: [
        'BEK nr. 496 af 21/05/2024 (Selektiv nedrivning > 250 m²)',
        'Lokalplan 1269 (Maks. 2,0 l/s/ha regnvandsafledning)',
        'STED Dispositionsforslag s. 16–17 & COWI (2021) Energigennemgang',
      ],
      inputs: {
        scopeId,
        reusedMaterialPct,
        preservedMatureTreesCount,
        hasDocumentedBek496Plan,
        includeReplacementNewBuild,
        heatRecoveryEfficiencyPct,
        rainPresetId,
        rainIntensityMmPerHour,
        areaHa,
        imperviousSharePct,
        activeGrassGridSpaces,
      },
      lcaResult,
      cavResult,
      larResult,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ringparken_klima_lca_lar_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isInterlockBlocked = lcaResult.contaminationInterlock.isBlocked;

  return (
    <section
      aria-label="4. Klima, LCA og LAR-klimatilpasning for Ringparken"
      className="w-full h-full overflow-y-auto bg-[#0B0F19] text-slate-100 p-4 lg:p-6 space-y-6 font-sans"
    >
      {/* TOPHEADER */}
      <header className="max-w-[1360px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>4. Klima, LCA &amp; LAR</span>
            <span aria-hidden="true">·</span>
            <span>LCAbyg &amp; STED Dispositionsforslag (s. 16–17)</span>
            <span aria-hidden="true">·</span>
            <span>COWI (2021) CAV-ventilation</span>
            <span aria-hidden="true">·</span>
            <span>Lokalplan 1269 (2,0 l/s/ha)</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-50 flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Klima-, LCA- og Skybrudstilpasning — Ringparken, Slagelse</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenGisMap && (
            <button
              type="button"
              onClick={onOpenGisMap}
              className="px-3.5 py-2 rounded-md bg-[#111827] hover:bg-[#1E293B] border border-[#334155] text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Åbn GIS Risikokort</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportClimateJson}
            className="px-3.5 py-2 rounded-md bg-[#111827] hover:bg-[#1E293B] border border-[#334155] text-xs font-mono text-emerald-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Eksporter Klima &amp; LCA (.json)</span>
          </button>
        </div>
      </header>

      {/* 4-KOLONNE NØGLETALSKORT (ton CO2e & m³ tilbageholdt regnvand) */}
      <div
        data-testid="climate-kpi-strip"
        className="max-w-[1360px] mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-1.5">
          <div className="text-xs text-slate-400">
            Brutto / Netto indlejret kulstof (LCA)
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-50">
            {lcaResult.netCarbonBalanceTonCo2e.toLocaleString('da-DK')}{' '}
            <span className="text-sm font-normal text-slate-400">ton CO₂e</span>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            Brutto: {lcaResult.totalLinearCarbonImpactTonCo2e.toLocaleString('da-DK')} t · Sparet:{' '}
            <span className="text-emerald-300">
              {lcaResult.totalCircularSavingsTonCo2e.toLocaleString('da-DK')} t
            </span>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-1.5">
          <div className="text-xs text-slate-400">
            Årlig drifts-CO₂e sparet (CAV → VGV + træer)
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-300">
            {(
              cavResult.netCo2eSavedTonPerYear +
              lcaResult.treeAnnualSequestrationTonCo2ePerYear
            ).toFixed(1)}{' '}
            <span className="text-sm font-normal text-slate-400">ton CO₂e/år</span>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            Ventilation: {cavResult.netEnergySavedMwhPerYear.toLocaleString('da-DK')} MWh/år · Træer:{' '}
            {lcaResult.treeAnnualSequestrationTonCo2ePerYear.toFixed(2)} t/år
          </div>
        </div>

        <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-1.5">
          <div className="text-xs text-slate-400">
            Nødvendigt LAR-tilbageholdt regnvand
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-cyan-300">
            {larResult.requiredTotalDetentionM3.toLocaleString('da-DK')}{' '}
            <span className="text-sm font-normal text-slate-400">m³</span>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            Maks. afløb {larResult.maxAllowedTotalOutflowLPerSec.toFixed(1)} l/s ({larResult.areaHa.toFixed(1)} ha × 2,0 l/s/ha)
          </div>
        </div>

        <div className="bg-[#111827] border border-[#334155] rounded-lg p-4 space-y-1.5">
          <div className="text-xs text-slate-400">
            Mikroklima &amp; lokal varmeø-dæmpning (UHI)
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-50">
            -{lcaResult.estimatedLocalUhiCoolingDegC.toFixed(2)}{' '}
            <span className="text-sm font-normal text-slate-400">°C</span>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            {preservedMatureTreesCount} træer (30+ år) · {lcaResult.treeAnnualEvapotranspirationMwh.toFixed(1)} MWh/sommer køling
          </div>
        </div>
      </div>

      {/* KRITISK KRYDSKONTROL: CIRKULÆR KONTAMINERINGS-SPÆRRE (RØD MILJØADVARSEL) */}
      <div
        role="alert"
        data-testid="circular-contamination-interlock"
        className={`max-w-[1360px] mx-auto rounded-lg border p-5 space-y-3 ${
          isInterlockBlocked
            ? 'bg-rose-950/45 border-rose-500/80 text-rose-50'
            : 'bg-amber-950/35 border-amber-500/70 text-amber-50'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {isInterlockBlocked ? (
              <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wide opacity-90">
                Kritisk Miljøkrydskontrol · BEK nr. 496 af 21/05/2024 &amp; STED side 16–17
              </div>
              <h2 className="text-base font-bold leading-snug">
                {lcaResult.contaminationInterlock.titleDa}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHasDocumentedBek496Plan((prev) => !prev)}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              hasDocumentedBek496Plan
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-rose-500 text-white hover:bg-rose-400'
            }`}
          >
            {hasDocumentedBek496Plan ? (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>BEK 496/2024 Sanering: Dokumenteret</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>BEK 496/2024 Sanering: Ikke dokumenteret (Spærret)</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs leading-relaxed max-w-5xl opacity-95">
          {lcaResult.contaminationInterlock.warningMessageDa}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/15 text-xs">
          {lcaResult.contaminationInterlock.contaminantEvidence.map((item) => (
            <div key={item.substance} className="space-y-0.5">
              <div className="font-semibold">{item.substance}</div>
              <div className="font-mono tabular-nums text-rose-200">
                Målt maks.: {item.measuredPeakDa}
              </div>
              <div className="text-[11px] opacity-80">{item.statutoryLimitDa}</div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-white/15 text-xs space-y-1">
          <div className="font-semibold">
            Obligatoriske betingelser før nedknusning under veje og stier (
            {lcaResult.contaminationInterlock.affectedHighRiskBuildings.join(', ')}):
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] opacity-90">
            {lcaResult.contaminationInterlock.mandatoryChecklistDa.map((req, idx) => (
              <li key={idx}>{req}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* HOVEDSEKTIONS-GRID: 1. INDLEJRET KULSTOF (LCA) + 2. DRIFTSENERGI (CAV -> VGV) */}
      <div className="max-w-[1360px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* VENSTRE 7/12: INDLEJRET KULSTOF (LCA) & CIRKULÆRE STED-BESPARELSER */}
        <div className="xl:col-span-7 bg-[#111827] border border-[#334155] rounded-lg p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#1E293B]">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-50 flex items-center gap-2">
                <Trees className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  1. Indlejret Kulstof (LCAbyg) &amp; STED Cirkulær Infrastruktur
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Erhverv (387 + 798 + 774 = 1.959 m²) samt almene boliger i Blok 1, 9 og 10 (~9.600 m²).
              </p>
            </div>
          </div>

          {/* ETAPEVÆLGER */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-300">
              Vælg nedrivningsetape / bygningsomfang
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(
                Object.values(
                  RINGPARKEN_DEMOLITION_SCOPES
                ) as DemolitionScopeProfile[]
              ).map((scope) => (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setScopeId(scope.id)}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer space-y-1 ${
                    scopeId === scope.id
                      ? 'bg-emerald-950/40 border-emerald-400 text-slate-50'
                      : 'bg-[#0B0F19] border-[#334155] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-semibold">{scope.labelDa}</div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    {scope.descriptionDa}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* INTERAKTIVE SLIDERE FOR GENBRUG, TRÆER & NYBYG */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="bg-[#0B0F19] p-3.5 rounded-md space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="slider-reused-material"
                  className="font-medium text-slate-200"
                >
                  Andel genbrugt / nedknust materiale
                </label>
                <span className="font-mono tabular-nums font-bold text-emerald-300">
                  {reusedMaterialPct} %
                </span>
              </div>
              <input
                id="slider-reused-material"
                type="range"
                min={0}
                max={100}
                step={5}
                value={reusedMaterialPct}
                onChange={(e) => setReusedMaterialPct(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="text-[11px] text-slate-400">
                1990&apos;er betonfliser (&gt;20 års restlevetid), granitkantsten samt renset beton under veje/stier.
              </div>
            </div>

            <div className="bg-[#0B0F19] p-3.5 rounded-md space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="slider-preserved-trees"
                  className="font-medium text-slate-200"
                >
                  Bevarede / flyttede træer (30+ år)
                </label>
                <span className="font-mono tabular-nums font-bold text-emerald-300">
                  {preservedMatureTreesCount} / {LCABYG_REFERENCE_FACTORS.matureTreeMaxCount} stk
                </span>
              </div>
              <input
                id="slider-preserved-trees"
                type="range"
                min={0}
                max={LCABYG_REFERENCE_FACTORS.matureTreeMaxCount}
                step={1}
                value={preservedMatureTreesCount}
                onChange={(e) => setPreservedMatureTreesCount(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="text-[11px] text-slate-400">
                Netto-positiv kulstofsekvestrering + evapotranspiration og skygge/albedo-køling.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeReplacementNewBuild}
                onChange={(e) => setIncludeReplacementNewBuild(e.target.checked)}
                className="accent-emerald-400"
              />
              <span>
                Inkludér erstatningsnybyggeri (LCAbyg A1–A5: 420 kg CO₂e/m²)
              </span>
            </label>
            <span className="font-mono tabular-nums text-slate-400">
              Totalareal: {lcaResult.scope.totalAreaM2.toLocaleString('da-DK')} m²
            </span>
          </div>

          {/* LCA REGNSKABSTABEL */}
          <div className="border-t border-[#1E293B] pt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-[#1E293B] text-left">
                  <th className="py-2 font-medium">Klimakomponent (LCAbyg / STED)</th>
                  <th className="py-2 font-medium text-right">Mængde / Grundlag</th>
                  <th className="py-2 font-medium text-right">Påvirkning (ton CO₂e)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B] font-mono tabular-nums">
                <tr>
                  <td className="py-2 font-sans text-slate-200">
                    Tabt indlejret kulstof i eksisterende konstruktion
                  </td>
                  <td className="py-2 text-right text-slate-400">
                    {lcaResult.scope.totalAreaM2.toLocaleString('da-DK')} m² × 310 kg
                  </td>
                  <td className="py-2 text-right text-rose-300">
                    +{lcaResult.lostEmbodiedCarbonTonCo2e.toLocaleString('da-DK')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-200">
                    Nedrivningsproces &amp; bortskaffelse (C1–C4)
                  </td>
                  <td className="py-2 text-right text-slate-400">
                    {lcaResult.scope.totalAreaM2.toLocaleString('da-DK')} m² × 48 kg
                  </td>
                  <td className="py-2 text-right text-rose-300">
                    +{lcaResult.demolitionProcessTonCo2e.toLocaleString('da-DK')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-slate-200">
                    Erstatningsnybyggeri (moduler A1–A5)
                  </td>
                  <td className="py-2 text-right text-slate-400">
                    {includeReplacementNewBuild
                      ? `${lcaResult.scope.totalAreaM2.toLocaleString('da-DK')} m² × 420 kg`
                      : 'Fravalgt'}
                  </td>
                  <td className="py-2 text-right text-rose-300">
                    +{lcaResult.replacementNewBuildTonCo2e.toLocaleString('da-DK')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-emerald-200">
                    Direkte genbrug: 1990&apos;er betonfliser &amp; granitkantsten
                  </td>
                  <td className="py-2 text-right text-slate-400">
                    {reusedMaterialPct} % af 750 t
                  </td>
                  <td className="py-2 text-right text-emerald-300">
                    -{lcaResult.pavingAndGraniteReuseSavingsTonCo2e.toLocaleString('da-DK')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-emerald-200">
                    Nedknust beton som bundopbygning (erstatning for stabilgrus)
                  </td>
                  <td className="py-2 text-right text-slate-400">
                    {lcaResult.crushedConcreteTonnesUsed.toLocaleString('da-DK')} t
                    {isInterlockBlocked ? ' (SPÆRRET)' : ' (Frigivet)'}
                  </td>
                  <td
                    className={`py-2 text-right ${
                      isInterlockBlocked ? 'text-rose-400 line-through' : 'text-emerald-300'
                    }`}
                  >
                    -{lcaResult.crushedConcreteTheoreticalSavingsTonCo2e.toLocaleString('da-DK')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-sans text-emerald-200">
                    Bevarede/flyttede 30+ år gamle træer (lagret biogent kulstof)
                  </td>
                  <td className="py-2 text-right text-slate-400">
                    {preservedMatureTreesCount} stk
                  </td>
                  <td className="py-2 text-right text-emerald-300">
                    -{lcaResult.treeStoredCarbonProtectedTonCo2e.toLocaleString('da-DK')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SØJLEDIAGRAM OVER INDLEJRET KULSTOF (ton CO2e) */}
          <div
            data-testid="climate-embodied-carbon-barchart"
            className="bg-[#0B0F19] border border-[#1E293B] rounded-lg p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-100">
                  Søjlediagram: Indlejret Kulstof &amp; Cirkulær Modregning (ton CO₂e)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Erhverv ({embodiedCarbonResult.commercialAreaM2.toLocaleString('da-DK')} m²:{' '}
                  {embodiedCarbonResult.commercialEmbodiedTonCo2e.toLocaleString('da-DK')} t) + Bolig (
                  {embodiedCarbonResult.residentialAreaM2.toLocaleString('da-DK')} m²:{' '}
                  {embodiedCarbonResult.residentialEmbodiedTonCo2e.toLocaleString('da-DK')} t) · Netto:{' '}
                  <strong className="text-amber-300 font-mono tabular-nums">
                    {embodiedCarbonResult.netCarbonBalanceTonCo2e.toLocaleString('da-DK')} ton CO₂e
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="inline-flex items-center gap-1.5 text-rose-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                  Tab / Udledning
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                  Cirkulær besparelse
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" />
                  Netto balance
                </span>
              </div>
            </div>

            <div className="w-full h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={embodiedCarbonResult.chartBreakdown}
                  margin={{ top: 10, right: 12, left: 4, bottom: 18 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="labelDa"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={{ stroke: '#334155' }}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={42}
                  />
                  <YAxis
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={{ stroke: '#334155' }}
                    unit=" t"
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.2} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '11px',
                      color: '#F8FAFC',
                    }}
                    formatter={(val: unknown) => [
                      `${Number(val).toLocaleString('da-DK')} ton CO₂e`,
                      'Kulstofpåvirkning',
                    ]}
                  />
                  <Bar dataKey="tonCo2e" radius={[4, 4, 0, 0]}>
                    {embodiedCarbonResult.chartBreakdown.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={
                          entry.category === 'saving'
                            ? '#10B981'
                            : entry.category === 'net'
                            ? '#F59E0B'
                            : '#F43F5E'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* HØJRE 5/12: DRIFTSENERGI & STRÅLINGSPÅVIRKNING (COWI 2021 CAV-VENTILATION) */}
        <div className="xl:col-span-5 bg-[#111827] border border-[#334155] rounded-lg p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="pb-3 border-b border-[#1E293B] space-y-1">
              <h2 className="text-base font-semibold text-slate-50 flex items-center gap-2">
                <Fan className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  2. Driftsenergi &amp; Strålingspåvirkning (COWI 2021 CAV)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Alle {COWI_2021_VENTILATION_BASELINE.totalBlocks} boligblokke (
                {COWI_2021_VENTILATION_BASELINE.totalApartments} boliger) har central loft-CAV uden varmegenvinding, der blæser opvarmet rumluft direkte over tag.
              </p>
            </div>

            <div className="bg-[#0B0F19] p-3.5 rounded-md space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="slider-vgv-efficiency"
                  className="font-medium text-slate-200"
                >
                  Varmegenvinding ved eftermontering (80–85 %)
                </label>
                <span className="font-mono tabular-nums font-bold text-cyan-300">
                  {heatRecoveryEfficiencyPct.toFixed(1).replace('.', ',')} %
                </span>
              </div>
              <input
                id="slider-vgv-efficiency"
                type="range"
                min={75}
                max={88}
                step={0.5}
                value={heatRecoveryEfficiencyPct}
                onChange={(e) => setHeatRecoveryEfficiencyPct(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                Samlet luftmængde: {cavResult.totalAirflowM3PerSec.toFixed(2)} m³/s ·{' '}
                {COWI_2021_VENTILATION_BASELINE.heatingHoursPerYear.toLocaleString('da-DK')}{' '}
                fyringstimer/år
              </div>
            </div>

            <div className="divide-y divide-[#1E293B] text-xs font-mono tabular-nums">
              <div className="py-2.5 flex items-center justify-between">
                <span className="font-sans text-slate-300">
                  Nuværende direkte varmetab over tag (CAV)
                </span>
                <span className="text-rose-300 font-bold">
                  {cavResult.annualVentilationHeatLossMwh.toLocaleString('da-DK')} MWh/år (
                  {cavResult.annualDirectHeatLossGj.toLocaleString('da-DK')} GJ)
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="font-sans text-slate-300">
                  Genvundet varmeenergi ved balanceret anlæg
                </span>
                <span className="text-emerald-300 font-bold">
                  {cavResult.recoveredHeatMwhPerYear.toLocaleString('da-DK')} MWh/år
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="font-sans text-slate-300">
                  Supplerende el-forbrug til tilluftsventilator
                </span>
                <span className="text-slate-400">
                  -{cavResult.addedSupplyFanElectricityMwhPerYear.toLocaleString('da-DK')} MWh/år
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="font-sans text-slate-100 font-semibold">
                  Netto energibesparelse &amp; CO₂e-reduktion
                </span>
                <span className="text-emerald-300 font-bold">
                  {cavResult.netEnergySavedMwhPerYear.toLocaleString('da-DK')} MWh/år ·{' '}
                  {cavResult.netCo2eSavedTonPerYear.toLocaleString('da-DK')} t CO₂e/år
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#0B0F19] p-3.5 rounded-md text-xs text-slate-300 leading-relaxed space-y-1">
            <div className="font-semibold text-cyan-300">
              Dobbelt gevinst: Reduceret termisk spild &amp; ophør af farligt undertryk
            </div>
            <p>{cavResult.indoorHealthAndClimateNoteDa}</p>
          </div>
        </div>
      </div>

      {/* SEKTION 3: HYDROLOGISK SKYBRUDS- & LAR-BEREGNER (LOKALPLAN 1269) */}
      <div className="max-w-[1360px] mx-auto bg-[#111827] border border-[#334155] rounded-lg p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#1E293B]">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-50 flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                3. Hydrologisk Skybruds- &amp; LAR-beregner (Lokalplan 1269 — Maks. 2,0 l/s/ha)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Simuler 10-års regn vs. 100-års skybrud med klimafaktor over 60 min på lavpermeabelt moræneler.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: '10_year', label: '10-års regn (28 mm/t)' },
                { id: '100_year_climate', label: '100-års skybrud + klimafaktor (74 mm/t)' },
                { id: 'custom', label: 'Tilpasset regn' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleSelectRainPreset(btn.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  rainPresetId === btn.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-[#0B0F19] border border-[#334155] text-slate-300 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* DELAREAL HURTIGVALG + SLIDERE */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Delareal-presets:</span>
          {LAR_CATCHMENT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setAreaHa(p.areaHa);
                setImperviousSharePct(p.imperviousPct);
              }}
              className={`px-2.5 py-1 rounded border text-xs cursor-pointer transition-colors ${
                Math.abs(areaHa - p.areaHa) < 0.05
                  ? 'bg-[#1E293B] border-cyan-400 text-cyan-200'
                  : 'bg-[#0B0F19] border-[#334155] text-slate-300 hover:text-white'
              }`}
            >
              {p.labelDa}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-[#0B0F19] p-3.5 rounded-md space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="slider-rain-mm" className="text-slate-200 font-medium">
                Regnintensitet
              </label>
              <span className="font-mono tabular-nums font-bold text-cyan-300">
                {rainIntensityMmPerHour} mm/time
              </span>
            </div>
            <input
              id="slider-rain-mm"
              type="range"
              min={10}
              max={120}
              step={2}
              value={rainIntensityMmPerHour}
              onChange={(e) => {
                setRainPresetId('custom');
                setRainIntensityMmPerHour(Number(e.target.value));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="bg-[#0B0F19] p-3.5 rounded-md space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="slider-area-ha" className="text-slate-200 font-medium">
                Valgt delareal
              </label>
              <span className="font-mono tabular-nums font-bold text-cyan-300">
                {areaHa.toFixed(1)} ha
              </span>
            </div>
            <input
              id="slider-area-ha"
              type="range"
              min={0.5}
              max={11.4}
              step={0.1}
              value={areaHa}
              onChange={(e) => setAreaHa(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="bg-[#0B0F19] p-3.5 rounded-md space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="slider-impervious-pct" className="text-slate-200 font-medium">
                Befæstelsesgrad
              </label>
              <span className="font-mono tabular-nums font-bold text-cyan-300">
                {imperviousSharePct} %
              </span>
            </div>
            <input
              id="slider-impervious-pct"
              type="range"
              min={25}
              max={90}
              step={1}
              value={imperviousSharePct}
              onChange={(e) => setImperviousSharePct(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="bg-[#0B0F19] p-3.5 rounded-md space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="slider-grass-spaces" className="text-slate-200 font-medium">
                Græsarmerede P-pladser
              </label>
              <span className="font-mono tabular-nums font-bold text-emerald-300">
                {activeGrassGridSpaces} / 969
              </span>
            </div>
            <input
              id="slider-grass-spaces"
              type="range"
              min={0}
              max={RINGPARKEN_LAR_CONSTANTS.totalGrassGridParkingSpaces}
              step={10}
              value={activeGrassGridSpaces}
              onChange={(e) => setActiveGrassGridSpaces(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="text-[10px] text-slate-400 font-mono">
              760 anlagte + 209 udlagte P-pladser
            </div>
          </div>
        </div>

        {/* FORDELING AF FORSINKELSESVOLUMEN + NEDSIVNINGSFORBUD */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 pt-1 font-mono tabular-nums text-xs">
          <div className="bg-[#0B0F19] p-4 rounded-md space-y-1">
            <div className="font-sans text-slate-400">
              1. Permeabel græsarmering (760+209 P-pladser)
            </div>
            <div className="text-xl font-bold text-emerald-300">
              {larResult.grassGridRetentionM3.toLocaleString('da-DK')} m³
            </div>
            <div className="font-sans text-[11px] text-slate-400">
              Tæt drænet bærelagsbuffer over moræneler
            </div>
          </div>

          <div className="bg-[#0B0F19] p-4 rounded-md space-y-1">
            <div className="font-sans text-slate-400">
              2. Nedgravede tætte vejkassetter
            </div>
            <div className="text-xl font-bold text-cyan-300">
              {larResult.roadCassettesRequiredM3.toLocaleString('da-DK')} m³
            </div>
            <div className="font-sans text-[11px] text-slate-400">
              Membranomsluttet under køreveje &amp; stier
            </div>
          </div>

          <div className="bg-[#0B0F19] p-4 rounded-md space-y-1">
            <div className="font-sans text-slate-400">
              3. Åbne tætte LAR-grøfter → separatkloak
            </div>
            <div className="text-xl font-bold text-cyan-300">
              {larResult.openSealedSwaleRequiredM3.toLocaleString('da-DK')} m³
            </div>
            <div className="font-sans text-[11px] text-slate-400">
              Drosslet overløb maks. {larResult.overflowToSeparateSewerLPerSec.toFixed(1)} l/s (2,0 l/s/ha)
            </div>
          </div>

          <div className="bg-[#0B0F19] p-4 rounded-md space-y-1">
            <div className="font-sans text-slate-400">
              Samlet skybruds-tilløb vs. spidsdrossling
            </div>
            <div className="text-xl font-bold text-amber-300">
              {larVolumeSummary.peakInflowLPerSec.toFixed(1)} →{' '}
              {larVolumeSummary.maxAllowedOutflowLPerSec.toFixed(1)} l/s
            </div>
            <div className="font-sans text-[11px] text-slate-400">
              Forsinkelse: {larVolumeSummary.requiredDetentionM3.toLocaleString('da-DK')} m³ ({larResult.complianceStatusDa})
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-md bg-amber-950/35 border border-amber-500/60 text-xs text-amber-100 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{larResult.infiltrationProhibitedWarningDa}</span>
        </div>
      </div>
    </section>
  );
};

export default ClimateResiliencePanel;
