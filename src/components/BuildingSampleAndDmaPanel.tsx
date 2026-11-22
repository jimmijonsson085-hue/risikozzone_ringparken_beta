import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Scale,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { BUILDING_CATEGORY_METADATA } from '../data/ringparkenData';
import {
  BuildingEnvironmentalProfile,
  getBuildingEnvironmentalProfile,
  RINGPARKEN_ENVIRONMENTAL_PROFILES,
} from '../data/ringparkenEnvironmentalSamples';
import {
  BuildingOperationalCategory,
  RingparkenBuildingUnit,
  SubstanceKey,
} from '../types/dispersion';

export interface BuildingSampleAndDmaPanelProps {
  buildings: RingparkenBuildingUnit[];
  selectedBuildingId: string | null;
  onSelectBuildingId: (buildingId: string) => void;
  onChangeBuildingCategory?: (
    buildingId: string,
    nextCategory: BuildingOperationalCategory
  ) => void;
  onAskAiAboutProfile?: (
    profile: BuildingEnvironmentalProfile,
    customPrompt: string
  ) => void;
  compactMode?: boolean;
}

const SUBSTANCE_BADGE_STYLES: Record<
  SubstanceKey,
  { badge: string; border: string; dot: string }
> = {
  asbestos: {
    badge: 'bg-rose-500/20 text-rose-200 border-rose-500/50',
    border: 'border-rose-500/40 bg-rose-950/20',
    dot: 'bg-rose-400',
  },
  pcb: {
    badge: 'bg-amber-500/20 text-amber-200 border-amber-500/50',
    border: 'border-amber-500/40 bg-amber-950/20',
    dot: 'bg-amber-400',
  },
  heavyMetals: {
    badge: 'bg-purple-500/20 text-purple-200 border-purple-500/50',
    border: 'border-purple-500/40 bg-purple-950/20',
    dot: 'bg-purple-400',
  },
  quartzWool: {
    badge: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50',
    border: 'border-cyan-500/40 bg-cyan-950/20',
    dot: 'bg-cyan-400',
  },
  moldSewer: {
    badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50',
    border: 'border-emerald-500/40 bg-emerald-950/20',
    dot: 'bg-emerald-400',
  },
};

export const BuildingSampleAndDmaPanel: React.FC<
  BuildingSampleAndDmaPanelProps
> = ({
  buildings,
  selectedBuildingId,
  onSelectBuildingId,
  onChangeBuildingCategory,
  onAskAiAboutProfile,
  compactMode = false,
}) => {
  const effectiveBuildingId = selectedBuildingId || 'BLOK-1';
  const activeProfile = useMemo(
    () => getBuildingEnvironmentalProfile(effectiveBuildingId),
    [effectiveBuildingId]
  );

  const activeBuildingUnit = useMemo(
    () =>
      buildings.find((b) => b.id === activeProfile.buildingId) || buildings[0],
    [buildings, activeProfile.buildingId]
  );

  const categoryMeta = activeBuildingUnit
    ? BUILDING_CATEGORY_METADATA[activeBuildingUnit.category]
    : BUILDING_CATEGORY_METADATA.d_under_demolition;

  // Interactive DMA checklist state keyed by checklist item ID
  const [checkedDmaItems, setCheckedDmaItems] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {};
    RINGPARKEN_ENVIRONMENTAL_PROFILES.forEach((prof) => {
      prof.dmaChecklist.forEach((item) => {
        initial[item.id] = item.defaultVerified;
      });
    });
    return initial;
  });

  const [activeSubView, setActiveSubView] = useState<
    'samples' | 'dma_checklist' | 'statutes'
  >('samples');

  const toggleDmaItem = (itemId: string) => {
    setCheckedDmaItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const completedChecklistCount = activeProfile.dmaChecklist.filter(
    (item) => checkedDmaItems[item.id]
  ).length;
  const totalChecklistCount = activeProfile.dmaChecklist.length;

  const quickFocusButtons: Array<{
    id: string;
    shortLabel: string;
    subtitle: string;
  }> = [
    {
      id: 'BLOK-1',
      shortLabel: '1. Blok 1 (Kierulffsvej 14-22)',
      subtitle: 'Krybekælder, brystning & altanfuger',
    },
    {
      id: 'BYG-1-BOERNEHAVE',
      shortLabel: '2. Bygning 1 – Børnehave',
      subtitle: 'Asbestvægfliser & kælderskimmel',
    },
    {
      id: 'BYG-2-BAZAR',
      shortLabel: '3. Bygning 2 – Bazar',
      subtitle: 'Kældermembran, vent. & skimmel',
    },
    {
      id: 'BYG-3-FRITIDSHJEM',
      shortLabel: '4. Bygning 3 – Fritidshjem',
      subtitle: 'Vindspærreplade & linoleum/klæb',
    },
    {
      id: 'BLOK-2',
      shortLabel: '5. Blok 2–20 (Afd. 23-32)',
      subtitle: 'Sanering vs. indkapsling (Etape 1)',
    },
    {
      id: 'BLOK-9',
      shortLabel: 'Blok 9–10 (Etape 2 del 2)',
      subtitle: 'Planlagt nedrivning (33,68 mio.)',
    },
  ];

  return (
    <div className="p-3.5 rounded-md bg-slate-900/95 border border-amber-500/45 space-y-3 shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold">
            <ClipboardCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              WISSENBERG PSS W22085 · MILJØRAPPORTER 2021-2791 &amp; RING_K18_C08.7 · DMA ANBEFALINGER
            </span>
          </div>
          <h3 className="text-xs sm:text-sm font-extrabold text-white mt-0.5">
            Specifikke Prøveresultater, Bygningsdele &amp; Dansk MiljøAnalyse (DMA) Prøvekort
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold">
            29 Bygninger Kortlagt
          </span>
          <span
            className="px-2 py-0.5 rounded border font-bold text-slate-950"
            style={{
              backgroundColor: categoryMeta.colorHex,
              borderColor: categoryMeta.colorHex,
            }}
          >
            {categoryMeta.labelDa}
          </span>
        </div>
      </div>

      {/* Quick-Select Buttons for the 5 Core Report Groups */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold">
          Hurtigvalg af Rapport-Verificerede Bygningsgrupper (1–5):
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {quickFocusButtons.map((btn) => {
            const isSelected =
              activeProfile.buildingId === btn.id ||
              (btn.id === 'BLOK-2' &&
                activeProfile.profileGroupKey === 'BLOK_2_20_SYSTEMIC' &&
                activeProfile.buildingId !== 'BLOK-9' &&
                activeProfile.buildingId !== 'BLOK-10');
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => onSelectBuildingId(btn.id)}
                className={`px-2.5 py-1.5 rounded text-left font-mono transition-all border ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-xs'
                    : 'bg-slate-950/85 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold truncate">
                  {btn.shortLabel}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {btn.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Full 29-Building Selector Dropdown + Operational Category Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-950/90 p-2.5 rounded border border-slate-800">
        <div className="sm:col-span-7">
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            Vælg blandt samtlige 29 bygninger/blokke i Ringparken:
          </label>
          <select
            aria-label="Vælg bygning til miljøprøvekort"
            value={activeProfile.buildingId}
            onChange={(e) => onSelectBuildingId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
          >
            {buildings.map((b) => {
              const cat = BUILDING_CATEGORY_METADATA[b.category];
              return (
                <option key={b.id} value={b.id}>
                  {b.code}: {b.name} ({b.address}) — [{cat.labelDa}]
                </option>
              );
            })}
          </select>
        </div>

        <div className="sm:col-span-5">
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
            Operationel Kategori (a–e):
          </label>
          {onChangeBuildingCategory && activeBuildingUnit ? (
            <select
              aria-label="Skift operationel kategori for valgt bygning"
              value={activeBuildingUnit.category}
              onChange={(e) =>
                onChangeBuildingCategory(
                  activeBuildingUnit.id,
                  e.target.value as BuildingOperationalCategory
                )
              }
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-amber-200 font-bold focus:outline-none focus:border-cyan-400"
            >
              {(
                Object.values(BUILDING_CATEGORY_METADATA) as Array<
                  (typeof BUILDING_CATEGORY_METADATA)[BuildingOperationalCategory]
                >
              ).map((meta) => (
                <option key={meta.code} value={meta.code}>
                  {meta.labelDa} (Faktor {meta.sourceEmissionFactor.toFixed(2)}x · H=
                  {meta.defaultReleaseHeightMeters}m)
                </option>
              ))}
            </select>
          ) : (
            <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200">
              {categoryMeta.labelDa}
            </div>
          )}
        </div>
      </div>

      {/* Active Building Card Header & Report IDs */}
      <div className="p-2.5 rounded bg-slate-950/95 border border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono text-cyan-300 font-bold">
              {activeProfile.profileGroupLabelDa}
            </div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {activeProfile.buildingName} — {activeProfile.address} (
                {activeProfile.department})
              </span>
            </div>
          </div>

          {activeBuildingUnit && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
              {activeBuildingUnit.helhedsplanEtape}
            </span>
          )}
        </div>

        {/* Report IDs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-mono uppercase text-slate-400">
            Verificerede Miljørapporter:
          </span>
          {activeProfile.reportIds.map((repId) => (
            <span
              key={repId}
              className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-[11px] font-mono text-cyan-200 font-semibold flex items-center gap-1"
            >
              <FileText className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              <span>{repId}</span>
            </span>
          ))}
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed">
          {activeProfile.executiveSummaryDa}
        </p>

        {/* DMA & PSS Primary Recommendation Callout */}
        <div className="p-2.5 rounded bg-amber-950/40 border border-amber-400/60 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-bold uppercase text-amber-300">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>DMA &amp; Wissenberg PSS W22085 Kerne-Anbefaling:</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-slate-950 text-amber-200 border border-amber-500/40 text-[11px]">
              Bindende Sikkerhedskrav
            </span>
          </div>
          <p className="text-[11px] text-amber-100/95 leading-relaxed">
            {activeProfile.dmaAndPssHeadlineRecommendationDa}
          </p>
          {activeProfile.encapsulationVsRemediationPolicyDa && (
            <div className="text-[11px] font-mono text-cyan-200 pt-1 border-t border-amber-500/30">
              <strong>Sanering vs. Indkapsling:</strong>{' '}
              {activeProfile.encapsulationVsRemediationPolicyDa}
            </div>
          )}
          <div className="text-[11px] font-mono text-rose-200 pt-1 border-t border-amber-500/30 flex items-center gap-1.5">
            <Wrench className="w-3 h-3 text-rose-400 shrink-0" />
            <span>{activeProfile.mandatoryCourseRequirement2025Da}</span>
          </div>
        </div>
      </div>

      {/* Sub-navigation tabs: Eksakte Bygningsdele & Prøver | Interaktiv DMA-Tjekliste | Lovhjemler */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded">
        <button
          type="button"
          onClick={() => setActiveSubView('samples')}
          className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeSubView === 'samples'
              ? 'bg-amber-400 text-slate-950 shadow-xs'
              : 'text-slate-300 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>Bygningsdele ({activeProfile.substanceSamples.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView('dma_checklist')}
          className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeSubView === 'dma_checklist'
              ? 'bg-emerald-400 text-slate-950 shadow-xs'
              : 'text-slate-300 hover:bg-slate-900'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>
            DMA-Tjekliste ({completedChecklistCount}/{totalChecklistCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView('statutes')}
          className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeSubView === 'statutes'
              ? 'bg-cyan-400 text-slate-950 shadow-xs'
              : 'text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Scale className="w-3.5 h-3.5 shrink-0" />
          <span>Lovhjemler ({activeProfile.statutoryReferences.length})</span>
        </button>
      </div>

      {/* TAB 1: EXACT BUILDING COMPONENTS PER SUBSTANCE */}
      {activeSubView === 'samples' && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {activeProfile.substanceSamples.map((sample) => {
            const style =
              SUBSTANCE_BADGE_STYLES[sample.substanceKey] ||
              SUBSTANCE_BADGE_STYLES.asbestos;
            return (
              <div
                key={`${activeProfile.buildingId}-${sample.substanceKey}`}
                className={`p-2.5 rounded border space-y-1.5 ${style.border}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`}
                    />
                    <span className="text-xs font-bold text-white">
                      {sample.substanceLabelDa}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${style.badge}`}
                  >
                    {sample.confirmedStatus === 'KONSTATERET_PRØVE'
                      ? '✓ KONSTATERET I PRØVE'
                      : sample.confirmedStatus === 'FORUDSAT_FØR_1997'
                      ? '⚠ FORUDSAT <1997 (FARLIGT AFFALD)'
                      : '◎ RECEPTOR-EKSPONERING'}
                  </span>
                </div>

                {/* Exact Building Components List */}
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-slate-300 font-semibold">
                    Eksakte Bygningsdele i {activeProfile.buildingCode}:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sample.exactBuildingComponents.map((comp, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[11px] font-mono text-white font-semibold"
                      >
                        • {comp}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-slate-200 leading-snug">
                  {sample.concentrationOrClassificationNote}
                </p>

                {!compactMode && (
                  <p className="text-[11px] text-slate-300 leading-snug">
                    <strong className="text-amber-300">Sprednings- &amp; Arbejdsmiljørisiko:</strong>{' '}
                    {sample.toxicologicalAndPhysicalRiskDa}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-800/80">
                  {sample.statutoryReferences.map((ref, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 text-[11px] font-mono border border-slate-800"
                    >
                      ⚖ {ref}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: INTERACTIVE DMA & PSS CHECKLIST */}
      {activeSubView === 'dma_checklist' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
            <span className="text-slate-300">
              DMA &amp; PSS Kontrolstatus for{' '}
              <strong className="text-white">{activeProfile.buildingCode}</strong>:
            </span>
            <span
              className={`font-bold ${
                completedChecklistCount === totalChecklistCount
                  ? 'text-emerald-300'
                  : 'text-amber-300'
              }`}
            >
              {completedChecklistCount} af {totalChecklistCount} krav verificeret
            </span>
          </div>

          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {activeProfile.dmaChecklist.map((item) => {
              const isChecked = Boolean(checkedDmaItems[item.id]);
              return (
                <label
                  key={item.id}
                  className={`p-2.5 rounded border flex items-start gap-2.5 cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-emerald-950/25 border-emerald-500/50'
                      : 'bg-rose-950/25 border-rose-500/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleDmaItem(item.id)}
                    className="mt-1 accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white">
                        [{item.code}] {item.titleDa}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-bold border ${
                          isChecked
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                            : 'bg-rose-500/25 text-rose-200 border-rose-400/50'
                        }`}
                      >
                        {isChecked ? '✓ VERIFICERET' : '⚠ MANGLER KONTROL'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">
                      {item.requirementDetailDa}
                    </p>
                    <div className="text-[11px] font-mono text-cyan-300">
                      Kilde: {item.sourceReference} · Fase: {item.mandatoryBeforePhase}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: STATUTORY REFERENCES & KRYBEKÆLDER/KÆLDER DETAILS */}
      {activeSubView === 'statutes' && (
        <div className="space-y-2">
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] font-mono uppercase text-cyan-300 font-bold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Krybekælder, Kælder &amp; Terrænforhold:</span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed">
              {activeProfile.crawlspaceOrBasementNoteDa}
            </p>
          </div>

          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="text-[11px] font-mono uppercase text-amber-300 font-bold">
              Gældende Lovhjemler, Bekendtgørelser &amp; Vejledninger:
            </div>
            <ul className="space-y-1 text-[11px] font-mono text-slate-200 list-disc list-inside">
              {activeProfile.statutoryReferences.map((law, idx) => (
                <li key={idx}>{law}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action Footer: Send Building Sample Profile to AI Expert */}
      {onAskAiAboutProfile && (
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-slate-400">
            Citerer eksakte bygningsdele fra {activeProfile.reportIds[0]}
          </span>
          <button
            type="button"
            onClick={() => {
              const componentsSummary = activeProfile.substanceSamples
                .map(
                  (s) =>
                    `${s.substanceLabelDa}: ${s.exactBuildingComponents.join(', ')}`
                )
                .join(' | ');
              const prompt = `Giv en konkret faglig, juridisk og sikkerhedsmæssig vurdering af ${activeProfile.buildingName} (${activeProfile.address}, Rapport: ${activeProfile.reportIds.join(', ')}), herunder de eksakte konstaterede bygningsdele (${componentsSummary}) samt DMA og Wissenberg PSS W22085 anbefalingen: "${activeProfile.dmaAndPssHeadlineRecommendationDa}".`;
              onAskAiAboutProfile(activeProfile, prompt);
            }}
            className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>
              Analyser {activeProfile.buildingCode} Prøvekort &amp; DMA-Krav med AI Ekspert
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
