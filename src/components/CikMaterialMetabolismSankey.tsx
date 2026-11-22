import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Layers,
  Leaf,
  Recycle,
  Scale,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { RingparkenBuildingUnit } from '../types/dispersion';
import {
  computeDemolitionCo2eKg,
  evaluateBek496SelectiveDemolition,
  evaluateWasteAndHp14Classification,
} from '../utils/riskEngine';

export interface CikMaterialMetabolismSankeyProps {
  buildings: RingparkenBuildingUnit[];
}

export interface CikSubFractionItem {
  id: string;
  labelDa: string;
  streamCategory: 'clean_reuse' | 'hazardous_sorted' | 'cross_contaminated_risk';
  massTonnes: number;
  massGrams: number;
  embodiedEnergyGj: number;
  specificContaminantNoteDa: string;
}

export const RINGPARKEN_TOTAL_FLOOR_AREA_M2 = 73420;

export const CikMaterialMetabolismSankey: React.FC<
  CikMaterialMetabolismSankeyProps
> = ({ buildings }) => {
  // Interactive physical separation / PCB-interface stripping discipline (0% to 100%)
  // At 100% DMA compliance (IN-9-3 + Den gule PCB-vejledning): 0% concrete is cross-contaminated.
  // When on-site crushing happens without full PCB/lead stripping, a fraction of the clean concrete is contaminated into the Risk Stream.
  const [pcbLeadStrippingCompliancePct, setPcbLeadStrippingCompliancePct] =
    useState<number>(68);
  const [unitDisplayMode, setUnitDisplayMode] = useState<'ton_gj' | 'gram_gj'>(
    'ton_gj'
  );
  const [scopeMode, setScopeMode] = useState<'full_73420m2' | 'active_etape'>(
    'full_73420m2'
  );
  const [hasStandardizedPlan, setHasStandardizedPlan] = useState<boolean>(false);

  const activeCategoryCounts = useMemo(() => {
    const dCount = buildings.filter(
      (b) => b.category === 'd_under_demolition' || b.category === 'e_demolished_unsecured'
    ).length;
    const cCount = buildings.filter((b) => b.category === 'c_under_renovation').length;
    return { dCount, cCount };
  }, [buildings]);

  const metabolism = useMemo(() => {
    // Baseline for Ringparken's 73.420 m² (1962–1972 montagebeton + tegl/letbeton + tag/instal):
    // Active demolition + renovation mass mobilization across the 73,420 m² masterplan:
    // Full masterplan mobilized mass (Etape 1 stripping + Etape 2 full demolition of Blok 1, 9, 10 & Byg 1, 2, 3):
    const scaleFactor =
      scopeMode === 'full_73420m2'
        ? 1.0
        : Math.max(
            0.22,
            (activeCategoryCounts.dCount * 1.0 + activeCategoryCounts.cCount * 0.25) / 14
          );

    const activeAreaM2 = Math.round(RINGPARKEN_TOTAL_FLOOR_AREA_M2 * scaleFactor);

    // Total gross mineral concrete & stone mass mobilized (tonnes)
    const grossMineralConcreteTonnes = 28400 * scaleFactor;
    // Embodied energy density of structural concrete/stone + processing: ~1.15 GJ / tonne
    const concreteEnergyGjPerTonne = 1.15;

    // Hazardous fractions (report-verified in Blok 1, Bygning 1-3, Blok 2-20):
    // 1. Asbest (brystningsplader, rørbøjninger, vægfliser, kældermembran, vindspærreplader, linoleum/klæb)
    const asbestosTonnes = 142.5 * scaleFactor;
    // 2. PCB-fuger, primær maling & bortrenset grænsefladebeton
    const pcbPrimaryTonnes = 198.0 * scaleFactor;
    // 3. Bly- og tungmetalholdige malede overflader (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As)
    const heavyMetalPaintTonnes = 94.5 * scaleFactor;
    // 4. <1997 Mineraluld (tagrum og tekniske installationer jf. BEK 1399/2021)
    const mineralWool1997Tonnes = 215.0 * scaleFactor;

    const totalHazardousSortedTonnes =
      asbestosTonnes + pcbPrimaryTonnes + heavyMetalPaintTonnes + mineralWool1997Tonnes;
    // High embodied energy in insulation, polymers, sealants & metals (~14.8 GJ/tonne)
    const totalHazardousEnergyGj = totalHazardousSortedTonnes * 14.8;

    // Cross-contamination physics:
    // Even small amounts of unstripped PCB sealant/paint (e.g., > 50 mg/kg source diffusing > 0.1–2.0 mg/kg into crushed pile)
    // or lead paint / asbestos basement membrane mixed during crushing contaminates disproportionate concrete batches.
    const unstrippedRatio = (100 - pcbLeadStrippingCompliancePct) / 100;
    // Amplification factor: 1% failure in selective PCB/lead interface stripping spoils ~1.35% of the crushed concrete batch
    const crossContaminatedShare = Math.min(0.85, unstrippedRatio * 1.25);

    const riskCrossContaminatedTonnes =
      grossMineralConcreteTonnes * crossContaminatedShare;
    const cleanReuseConcreteTonnes =
      grossMineralConcreteTonnes - riskCrossContaminatedTonnes;

    const cleanReuseEnergyGj = cleanReuseConcreteTonnes * concreteEnergyGjPerTonne;
    const riskCrossContaminatedEnergyGj =
      riskCrossContaminatedTonnes * concreteEnergyGjPerTonne;

    const totalMassTonnes =
      cleanReuseConcreteTonnes +
      totalHazardousSortedTonnes +
      riskCrossContaminatedTonnes;
    const totalEnergyGj =
      cleanReuseEnergyGj + totalHazardousEnergyGj + riskCrossContaminatedEnergyGj;

    // Source breakdown inputs (Left side of Sankey)
    const sourceDemolitionTonnes = totalMassTonnes * 0.64; // Etape 2 Nedrivning (Blok 1, 9, 10 + Byg 1, 2, 3)
    const sourceRenovationTonnes = totalMassTonnes * 0.36; // Etape 1 Renovering (Blok 2-8, 11-20 gavludskæring, bad, skakte, tag)

    const subFractions: CikSubFractionItem[] = [
      {
        id: 'clean_concrete_stone',
        labelDa: 'Ren beton & natursten (lokalt bærelag/landskab)',
        streamCategory: 'clean_reuse',
        massTonnes: cleanReuseConcreteTonnes,
        massGrams: cleanReuseConcreteTonnes * 1_000_000,
        embodiedEnergyGj: cleanReuseEnergyGj,
        specificContaminantNoteDa:
          'Godkendt til nyttiggørelse efter fuld PCB/bly-grænsefladerensning (AT IN-9-3)',
      },
      {
        id: 'haz_asbestos',
        labelDa: 'Farligt affald: Asbest (brystning, rør, fliser, membran, vindspærre)',
        streamCategory: 'hazardous_sorted',
        massTonnes: asbestosTonnes,
        massGrams: asbestosTonnes * 1_000_000,
        embodiedEnergyGj: asbestosTonnes * 12.4,
        specificContaminantNoteDa:
          'Blok 1, Bygning 1–3 & Blok 2–20 · Deponi i støvtæt emballage (BEK 1328/2025)',
      },
      {
        id: 'haz_pcb',
        labelDa: 'Farligt affald: PCB-fuger, maling & primær grænsefladebeton',
        streamCategory: 'hazardous_sorted',
        massTonnes: pcbPrimaryTonnes,
        massGrams: pcbPrimaryTonnes * 1_000_000,
        embodiedEnergyGj: pcbPrimaryTonnes * 18.2,
        specificContaminantNoteDa:
          'Den gule PCB-vejledning (2019) · Termisk destruktion / specialdeponi',
      },
      {
        id: 'haz_heavy_metals',
        labelDa: 'Farligt affald: Tungmetalholdig maling (Pb, Cd, Cr, Cu, Ni, Zn, Hg, As)',
        streamCategory: 'hazardous_sorted',
        massTonnes: heavyMetalPaintTonnes,
        massGrams: heavyMetalPaintTonnes * 1_000_000,
        embodiedEnergyGj: heavyMetalPaintTonnes * 11.5,
        specificContaminantNoteDa:
          'Den blå Blyvejledning (2019) & AT C.0.8 · Udsorteret fra alle malede flader',
      },
      {
        id: 'haz_mineral_wool',
        labelDa: 'Farligt affald: <1997 Mineraluld (tagrum & tekniske installationer)',
        streamCategory: 'hazardous_sorted',
        massTonnes: mineralWool1997Tonnes,
        massGrams: mineralWool1997Tonnes * 1_000_000,
        embodiedEnergyGj: mineralWool1997Tonnes * 16.0,
        specificContaminantNoteDa:
          'Klassificeret som farligt affald jf. BEK nr. 1399 af 25.06.2021',
      },
      {
        id: 'risk_crushed_concrete',
        labelDa: 'Risiko-fraktion: Krydskontamineret knust beton (PCB/Bly/Asbest-spredning)',
        streamCategory: 'cross_contaminated_risk',
        massTonnes: riskCrossContaminatedTonnes,
        massGrams: riskCrossContaminatedTonnes * 1_000_000,
        embodiedEnergyGj: riskCrossContaminatedEnergyGj,
        specificContaminantNoteDa:
          'Opstår når PCB-fuger/grænsefladebeton eller blymaling knuses på matriklen uden forudgående bortrensning',
      },
    ];

    const bek496Compliance = evaluateBek496SelectiveDemolition({
      affectedFloorAreaM2: activeAreaM2,
      hasStandardizedDemolitionPlan: hasStandardizedPlan,
      hasPreDemolitionResourceMapping: true,
      hasCertifiedDemolitionManager: hasStandardizedPlan,
      hasAuthorizedAsbestosContractor: true,
      hasSeparatePre1997MineralWoolPlan: true,
      municipalityNotifiedTwoWeeksPrior: hasStandardizedPlan,
    });

    const hp14WasteSummary = evaluateWasteAndHp14Classification({
      constructionYear: 1968,
      asbestosDetected: asbestosTonnes > 0,
      asbestosTonnes,
      mineralWoolPre1997Tonnes: mineralWool1997Tonnes,
      pcbMgPerKg: Math.round(52 + unstrippedRatio * 340),
      leadMgPerKg: Math.round(480 + unstrippedRatio * 920),
      pahMgPerKg: Math.round(28 + unstrippedRatio * 85),
      cadmiumMgPerKg: 14,
      zincMgPerKg: 620,
      grossConcreteTonnes: grossMineralConcreteTonnes,
    });

    const lcaCo2e = computeDemolitionCo2eKg({
      cleanReuseConcreteTonnes,
      crossContaminatedConcreteTonnes: riskCrossContaminatedTonnes,
      asbestosTonnes,
      pcbTonnes: pcbPrimaryTonnes,
      heavyMetalPaintTonnes,
      mineralWoolPre1997Tonnes: mineralWool1997Tonnes,
      affectedFloorAreaM2: activeAreaM2,
    });

    return {
      activeAreaM2,
      totalMassTonnes,
      totalEnergyGj,
      sourceDemolitionTonnes,
      sourceRenovationTonnes,
      cleanReuseConcreteTonnes,
      cleanReuseEnergyGj,
      totalHazardousSortedTonnes,
      totalHazardousEnergyGj,
      riskCrossContaminatedTonnes,
      riskCrossContaminatedEnergyGj,
      subFractions,
      bek496Compliance,
      hp14WasteSummary,
      lcaCo2e,
    };
  }, [scopeMode, activeCategoryCounts, pcbLeadStrippingCompliancePct, hasStandardizedPlan]);

  const formatMass = (tonnes: number) => {
    if (unitDisplayMode === 'gram_gj') {
      const grams = tonnes * 1_000_000;
      return `${grams.toExponential(2)} g`;
    }
    return `${tonnes.toLocaleString('da-DK', { maximumFractionDigits: 1 })} ton`;
  };

  const formatGj = (gj: number) =>
    `${gj.toLocaleString('da-DK', { maximumFractionDigits: 0 })} GJ`;

  // Compute SVG Sankey geometry (width 760, height 270)
  const sankeyGeometry = useMemo(() => {
    const total = Math.max(1, metabolism.totalMassTonnes);
    const totalHeight = 190;

    // Left nodes:
    // L1: Etape 2 Nedrivning (64%)
    // L2: Etape 1 Renovering (36%)
    const hL1 = Math.max(28, (metabolism.sourceDemolitionTonnes / total) * totalHeight);
    const hL2 = Math.max(24, (metabolism.sourceRenovationTonnes / total) * totalHeight);
    const yL1 = 28;
    const yL2 = yL1 + hL1 + 24;

    // Center node:
    // C1: Samlet Mobiliseret Bygningsmasse (73.420 m²)
    const hC1 = hL1 + hL2;
    const yC1 = 36;

    // Right nodes (3 output streams):
    // R1: Ren beton & natursten (Emerald)
    // R2: Udsorteret farligt affald (Rose)
    // R3: Risiko-fraktion krydskontaminering (Amber)
    const rawR1 = (metabolism.cleanReuseConcreteTonnes / total) * totalHeight;
    const rawR2 = (metabolism.totalHazardousSortedTonnes / total) * totalHeight;
    const rawR3 = (metabolism.riskCrossContaminatedTonnes / total) * totalHeight;

    const hR1 = Math.max(22, rawR1);
    const hR2 = Math.max(22, rawR2);
    const hR3 = Math.max(22, rawR3);

    const yR1 = 20;
    const yR2 = yR1 + hR1 + 18;
    const yR3 = yR2 + hR2 + 18;

    return {
      yL1,
      hL1,
      yL2,
      hL2,
      yC1,
      hC1,
      yR1,
      hR1,
      yR2,
      hR2,
      yR3,
      hR3,
    };
  }, [metabolism]);

  return (
    <div className="p-4 rounded-md bg-[var(--surface-panel)] border border-[var(--border-subtle)] border-l-4 border-l-sky-400 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-extrabold text-white">
              Calculation in Kind 2.0 (CiK 2.0) · Fysisk Materiale- &amp; Energi-Sankey (73.420 m²)
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Realfysisk stofskifteregnskab (Otto Neurath <em>Naturalrechnung</em>) for Ringparkens{' '}
            <strong className="text-white">
              {metabolism.activeAreaM2.toLocaleString('da-DK')} m²
            </strong>{' '}
            bygningsmasse i fysiske enheder (<strong className="text-cyan-300">Ton / Gram masse</strong>{' '}
            og <strong className="text-amber-300">GJ indlejret energi</strong>) fordelt på lokal
            genanvendelse, udsorteret farligt affald og krydskontamineret risiko-fraktion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setUnitDisplayMode('ton_gj')}
            className={`px-2.5 py-1 rounded border cursor-pointer ${
              unitDisplayMode === 'ton_gj'
                ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                : 'bg-slate-900 text-slate-300 border-slate-700'
            }`}
          >
            Enhed: Ton (t) + GJ
          </button>
          <button
            type="button"
            onClick={() => setUnitDisplayMode('gram_gj')}
            className={`px-2.5 py-1 rounded border cursor-pointer ${
              unitDisplayMode === 'gram_gj'
                ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                : 'bg-slate-900 text-slate-300 border-slate-700'
            }`}
          >
            Enhed: Gram (g) + GJ
          </button>
          <button
            type="button"
            onClick={() =>
              setScopeMode((prev) =>
                prev === 'full_73420m2' ? 'active_etape' : 'full_73420m2'
              )
            }
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 cursor-pointer"
          >
            {scopeMode === 'full_73420m2'
              ? 'Visning: Fuld Helhedsplan (73.420 m²)'
              : 'Visning: Skaleret til Aktive d/c Enheder'}
          </button>
        </div>
      </div>

      {/* Interactive PCB/Lead Interface Stripping Control Slider */}
      <div className="p-3 rounded bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5 flex-1 min-w-[260px]">
          <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Kildesorterings- &amp; PCB/Bly-Grænsefladerensning før Betonknusning:{' '}
              <span className="text-amber-300">{pcbLeadStrippingCompliancePct}%</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            Simulér effekten af mangelfuld bortrensning af PCB-fuger/grænsefladebeton og blymaling
            før mekanisk betonknusning (jf. Den gule PCB-vejledning 2019 &amp; AT-instruks IN-9-3):
            Selv små mængder uoprenset PCB/bly kontaminerer tusindvis af ton knust beton.
          </p>
        </div>

        <div className="flex items-center gap-3 min-w-[260px]">
          <input
            type="range"
            min={20}
            max={100}
            step={1}
            value={pcbLeadStrippingCompliancePct}
            onChange={(e) => setPcbLeadStrippingCompliancePct(Number(e.target.value))}
            className="w-44 accent-cyan-400 cursor-pointer"
          />
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setPcbLeadStrippingCompliancePct(100)}
              className="px-2 py-1 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 cursor-pointer"
            >
              100% DMA-Krav
            </button>
            <button
              type="button"
              onClick={() => setPcbLeadStrippingCompliancePct(45)}
              className="px-2 py-1 rounded bg-amber-950 border border-amber-500/50 text-amber-300 cursor-pointer"
            >
              45% Sjusk
            </button>
          </div>
        </div>
      </div>

      {/* SVG Sankey Diagram */}
      <div className="p-3 rounded bg-slate-900/70 border border-slate-800 overflow-x-auto">
        <svg
          viewBox="0 0 820 265"
          className="w-full min-w-[680px] h-auto select-none"
          role="img"
          aria-label="Calculation in Kind 2.0 Materiale-Sankey for Ringparken 73.420 m²"
        >
          <defs>
            <linearGradient id="sankeyToClean" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="sankeyToHaz" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="sankeyToRisk" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Left -> Center Flow Ribbons */}
          <path
            d={`M 185 ${sankeyGeometry.yL1 + sankeyGeometry.hL1 / 2} C 260 ${
              sankeyGeometry.yL1 + sankeyGeometry.hL1 / 2
            }, 260 ${sankeyGeometry.yC1 + sankeyGeometry.hL1 / 2}, 330 ${
              sankeyGeometry.yC1 + sankeyGeometry.hL1 / 2
            }`}
            fill="none"
            stroke="#ef4444"
            strokeOpacity="0.35"
            strokeWidth={sankeyGeometry.hL1}
          />
          <path
            d={`M 185 ${sankeyGeometry.yL2 + sankeyGeometry.hL2 / 2} C 260 ${
              sankeyGeometry.yL2 + sankeyGeometry.hL2 / 2
            }, 260 ${
              sankeyGeometry.yC1 + sankeyGeometry.hL1 + sankeyGeometry.hL2 / 2
            }, 330 ${
              sankeyGeometry.yC1 + sankeyGeometry.hL1 + sankeyGeometry.hL2 / 2
            }`}
            fill="none"
            stroke="#0284c7"
            strokeOpacity="0.35"
            strokeWidth={sankeyGeometry.hL2}
          />

          {/* Center -> Right Flow Ribbons */}
          <path
            d={`M 450 ${sankeyGeometry.yC1 + sankeyGeometry.hR1 / 2} C 525 ${
              sankeyGeometry.yC1 + sankeyGeometry.hR1 / 2
            }, 525 ${sankeyGeometry.yR1 + sankeyGeometry.hR1 / 2}, 595 ${
              sankeyGeometry.yR1 + sankeyGeometry.hR1 / 2
            }`}
            fill="none"
            stroke="url(#sankeyToClean)"
            strokeWidth={sankeyGeometry.hR1}
          />
          <path
            d={`M 450 ${
              sankeyGeometry.yC1 + sankeyGeometry.hR1 + sankeyGeometry.hR2 / 2
            } C 525 ${
              sankeyGeometry.yC1 + sankeyGeometry.hR1 + sankeyGeometry.hR2 / 2
            }, 525 ${sankeyGeometry.yR2 + sankeyGeometry.hR2 / 2}, 595 ${
              sankeyGeometry.yR2 + sankeyGeometry.hR2 / 2
            }`}
            fill="none"
            stroke="url(#sankeyToHaz)"
            strokeWidth={sankeyGeometry.hR2}
          />
          <path
            d={`M 450 ${
              sankeyGeometry.yC1 +
              sankeyGeometry.hR1 +
              sankeyGeometry.hR2 +
              sankeyGeometry.hR3 / 2
            } C 525 ${
              sankeyGeometry.yC1 +
              sankeyGeometry.hR1 +
              sankeyGeometry.hR2 +
              sankeyGeometry.hR3 / 2
            }, 525 ${sankeyGeometry.yR3 + sankeyGeometry.hR3 / 2}, 595 ${
              sankeyGeometry.yR3 + sankeyGeometry.hR3 / 2
            }`}
            fill="none"
            stroke="url(#sankeyToRisk)"
            strokeWidth={sankeyGeometry.hR3}
          />

          {/* Left Nodes: Input Sources */}
          <rect
            x="16"
            y={sankeyGeometry.yL1}
            width="169"
            height={sankeyGeometry.hL1}
            rx="4"
            fill="#450a0a"
            stroke="#ef4444"
            strokeWidth="1.5"
          />
          <text x="24" y={sankeyGeometry.yL1 + 18} fill="#fecaca" fontSize="11" fontWeight="bold">
            Etape 2: Nedrivning (d/e)
          </text>
          <text x="24" y={sankeyGeometry.yL1 + 34} fill="#fca5a5" fontSize="10" fontFamily="monospace">
            {formatMass(metabolism.sourceDemolitionTonnes)}
          </text>

          <rect
            x="16"
            y={sankeyGeometry.yL2}
            width="169"
            height={sankeyGeometry.hL2}
            rx="4"
            fill="#082f49"
            stroke="#0284c7"
            strokeWidth="1.5"
          />
          <text x="24" y={sankeyGeometry.yL2 + 16} fill="#bae6fd" fontSize="11" fontWeight="bold">
            Etape 1: Renovering (c)
          </text>
          <text x="24" y={sankeyGeometry.yL2 + 30} fill="#7dd3fc" fontSize="10" fontFamily="monospace">
            {formatMass(metabolism.sourceRenovationTonnes)}
          </text>

          {/* Center Node: Total Ringparken Building Mass */}
          <rect
            x="330"
            y={sankeyGeometry.yC1}
            width="120"
            height={sankeyGeometry.hC1}
            rx="4"
            fill="#0f172a"
            stroke="#22d3ee"
            strokeWidth="2"
          />
          <text x="340" y={sankeyGeometry.yC1 + 22} fill="#ffffff" fontSize="11" fontWeight="bold">
            Ringparken
          </text>
          <text x="340" y={sankeyGeometry.yC1 + 37} fill="#67e8f9" fontSize="10" fontFamily="monospace">
            {metabolism.activeAreaM2.toLocaleString('da-DK')} m²
          </text>
          <text x="340" y={sankeyGeometry.yC1 + 54} fill="#e2e8f0" fontSize="10" fontFamily="monospace">
            {formatMass(metabolism.totalMassTonnes)}
          </text>
          <text x="340" y={sankeyGeometry.yC1 + 70} fill="#fcd34d" fontSize="10" fontFamily="monospace">
            {formatGj(metabolism.totalEnergyGj)}
          </text>

          {/* Right Node 1: Ren beton og natursten */}
          <rect
            x="595"
            y={sankeyGeometry.yR1}
            width="210"
            height={sankeyGeometry.hR1}
            rx="4"
            fill="#022c22"
            stroke="#10b981"
            strokeWidth="1.5"
          />
          <text x="603" y={sankeyGeometry.yR1 + 15} fill="#a7f3d0" fontSize="10.5" fontWeight="bold">
            1. Ren Beton &amp; Natursten (Genbrug)
          </text>
          <text x="603" y={sankeyGeometry.yR1 + 29} fill="#6ee7b7" fontSize="9.5" fontFamily="monospace">
            {formatMass(metabolism.cleanReuseConcreteTonnes)} · {formatGj(metabolism.cleanReuseEnergyGj)}
          </text>

          {/* Right Node 2: Udsorteret farligt affald */}
          <rect
            x="595"
            y={sankeyGeometry.yR2}
            width="210"
            height={sankeyGeometry.hR2}
            rx="4"
            fill="#4c0519"
            stroke="#f43f5e"
            strokeWidth="1.5"
          />
          <text x="603" y={sankeyGeometry.yR2 + 14} fill="#fecdd3" fontSize="10.5" fontWeight="bold">
            2. Udsorteret Farligt Affald (Deponi)
          </text>
          <text x="603" y={sankeyGeometry.yR2 + 27} fill="#fda4af" fontSize="9.5" fontFamily="monospace">
            {formatMass(metabolism.totalHazardousSortedTonnes)} · {formatGj(metabolism.totalHazardousEnergyGj)}
          </text>

          {/* Right Node 3: Risiko-fraktion (Krydskontaminering) */}
          <rect
            x="595"
            y={sankeyGeometry.yR3}
            width="210"
            height={sankeyGeometry.hR3}
            rx="4"
            fill="#451a03"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
          <text x="603" y={sankeyGeometry.yR3 + 14} fill="#fde68a" fontSize="10.5" fontWeight="bold">
            3. Risiko-Fraktion (Krydskontamineret)
          </text>
          <text x="603" y={sankeyGeometry.yR3 + 27} fill="#fcd34d" fontSize="9.5" fontFamily="monospace">
            {formatMass(metabolism.riskCrossContaminatedTonnes)} ·{' '}
            {formatGj(metabolism.riskCrossContaminatedEnergyGj)}
          </text>
        </svg>
      </div>

      {/* 3 Summary Cards for the 3 CiK 2.0 Streams */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded bg-emerald-950/30 border border-emerald-500/50 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-300">
            <span className="flex items-center gap-1.5">
              <Recycle className="w-3.5 h-3.5" />
              <span>1. Ren Beton &amp; Natursten</span>
            </span>
            <span>
              {Math.round(
                (metabolism.cleanReuseConcreteTonnes / metabolism.totalMassTonnes) * 100
              )}
              %
            </span>
          </div>
          <div className="text-sm font-mono font-extrabold text-white tabular-nums">
            {formatMass(metabolism.cleanReuseConcreteTonnes)} ·{' '}
            <span className="text-emerald-300">{formatGj(metabolism.cleanReuseEnergyGj)}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Godkendt til lokal genanvendelse som bærelag og landskabsopbygning efter dokumenteret
            bortrensning af PCB-grænsefladebeton og blymaling.
          </p>
        </div>

        <div className="p-3 rounded bg-rose-950/30 border border-rose-500/50 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-rose-300">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>2. Udsorteret Farligt Affald</span>
            </span>
            <span>
              {(
                (metabolism.totalHazardousSortedTonnes / metabolism.totalMassTonnes) *
                100
              ).toFixed(1)}
              %
            </span>
          </div>
          <div className="text-sm font-mono font-extrabold text-white tabular-nums">
            {formatMass(metabolism.totalHazardousSortedTonnes)} ·{' '}
            <span className="text-rose-300">{formatGj(metabolism.totalHazardousEnergyGj)}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Asbest (brystning, rør, fliser, membran, vindspærre), PCB-fuger/beton, blymaling og
            &lt;1997 mineraluld (BEK 1399/2021) til lukket deponi.
          </p>
        </div>

        <div className="p-3 rounded bg-amber-950/35 border border-amber-500/60 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-300">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>3. Risiko-Fraktion (Krydskontaminering)</span>
            </span>
            <span>
              {Math.round(
                (metabolism.riskCrossContaminatedTonnes / metabolism.totalMassTonnes) * 100
              )}
              %
            </span>
          </div>
          <div className="text-sm font-mono font-extrabold text-white tabular-nums">
            {formatMass(metabolism.riskCrossContaminatedTonnes)} ·{' '}
            <span className="text-amber-300">
              {formatGj(metabolism.riskCrossContaminatedEnergyGj)}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Potentiel sekundær kontaminering af knust beton og tab af indlejret energi, hvis PCB-
            eller blyholdig beton knuses på matriklen uden fuld IN-9-3 sanering.
          </p>
        </div>
      </div>

      {/* Deterministisk BEK 496/2024 (>250 m²), HP14 & CO2e Klimaregnskab */}
      <div
        data-testid="bek496-hp14-lca-panel"
        className="grid grid-cols-1 md:grid-cols-3 gap-3 tabular-nums"
      >
        <div className="p-3 rounded bg-slate-900/90 border border-slate-700/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
              <span>BEK 496/2024 (&gt; 250 m²)</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${
                metabolism.bek496Compliance.status === 'OVERHOLDT'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                  : 'bg-rose-950 text-rose-300 border border-rose-500/50'
              }`}
            >
              {metabolism.bek496Compliance.status === 'OVERHOLDT' ? 'OVERHOLDT' : 'MANGLER PLAN'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-200">
            Areal: <strong>{metabolism.activeAreaM2.toLocaleString('da-DK')} m²</strong> · Obligatorisk selektiv nedrivning
          </div>
          <button
            type="button"
            onClick={() => setHasStandardizedPlan((prev) => !prev)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-mono font-semibold text-slate-200 whitespace-nowrap cursor-pointer"
          >
            {hasStandardizedPlan
              ? 'Markér Nedrivningsplan som Mangelfuld'
              : 'Verificér Standardiseret Nedrivningsplan'}
          </button>
          {metabolism.bek496Compliance.missingRequirementsDa.length > 0 && (
            <div className="text-[11px] text-rose-300 leading-snug">
              {metabolism.bek496Compliance.missingRequirementsDa[0]}
            </div>
          )}
        </div>

        <div className="p-3 rounded bg-slate-900/90 border border-slate-700/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Scale className="w-3.5 h-3.5 shrink-0" />
              <span>HP14 Økotoksicitet &amp; Affald</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-500/50 whitespace-nowrap">
              {metabolism.hp14WasteSummary.classification === 'FARLIGT_AFFALD'
                ? 'FARLIGT AFFALD'
                : 'FORURENET'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-200">
            HP14 Sum: <strong>{metabolism.hp14WasteSummary.hp14WeightedSumPercent.toFixed(2)} %</strong> (kvotient{' '}
            <strong>{metabolism.hp14WasteSummary.hp14ThresholdQuotient.toFixed(2)}</strong>)
          </div>
          <div className="text-[11px] text-slate-300 leading-snug">
            BEK 1328/2025 (Asbest) &amp; BEK 1399/2021 (&lt;1997 mineraluld: Farligt affald).
          </div>
        </div>

        <div className="p-3 rounded bg-slate-900/90 border border-slate-700/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <Leaf className="w-3.5 h-3.5 shrink-0" />
              <span>Deterministisk LCA (CO₂e)</span>
            </span>
            <span className="text-[11px] font-mono text-emerald-300 whitespace-nowrap">
              {metabolism.lcaCo2e.recyclingRatePercent.toFixed(1)} % genbrug
            </span>
          </div>
          <div className="text-sm font-mono font-extrabold text-white">
            {metabolism.lcaCo2e.netEmissionsTonnesCo2e.toLocaleString('da-DK', {
              maximumFractionDigits: 1,
            })}{' '}
            ton CO₂e netto
          </div>
          <div className="text-[11px] text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>
              Besparelse v/ selektiv sortering:{' '}
              {Math.round(metabolism.lcaCo2e.avoidedBySelectiveDemolitionKgCo2e / 1000).toLocaleString('da-DK')} t CO₂e
            </span>
          </div>
        </div>
      </div>

      {/* Physical Accounting Sub-Fraction Table */}
      <div className="overflow-x-auto rounded border border-slate-800">
        <table className="w-full text-left border-collapse text-[11px] font-mono">
          <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
            <tr>
              <th className="py-1.5 px-2.5">Materialefraktion (CiK 2.0 Naturalrechnung)</th>
              <th className="py-1.5 px-2.5 text-right">Fysisk Masse (Ton)</th>
              <th className="py-1.5 px-2.5 text-right">Fysisk Masse (Gram)</th>
              <th className="py-1.5 px-2.5 text-right">Indlejret Energi (GJ)</th>
              <th className="py-1.5 px-2.5">Retsmedicinsk &amp; Miljøteknisk Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {metabolism.subFractions.map((sub) => (
              <tr key={sub.id} className="hover:bg-slate-900/60">
                <td className="py-1.5 px-2.5 font-semibold text-white">{sub.labelDa}</td>
                <td className="py-1.5 px-2.5 text-right text-cyan-300 tabular-nums">
                  {sub.massTonnes.toLocaleString('da-DK', { maximumFractionDigits: 1 })} t
                </td>
                <td className="py-1.5 px-2.5 text-right text-slate-300 tabular-nums">
                  {sub.massGrams.toExponential(2)} g
                </td>
                <td className="py-1.5 px-2.5 text-right text-amber-300 font-bold tabular-nums">
                  {sub.embodiedEnergyGj.toLocaleString('da-DK', { maximumFractionDigits: 0 })} GJ
                </td>
                <td className="py-1.5 px-2.5 text-slate-300 text-[11px]">
                  {sub.specificContaminantNoteDa}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
