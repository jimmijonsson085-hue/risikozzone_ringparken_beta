import React, { useEffect, useState } from 'react';
import {
  Bot,
  Camera,
  Dna,
  FlaskConical,
  Home,
  Scale,
  Volume2,
  Wind,
} from 'lucide-react';
import { RightPanelTab } from './layoutTypes';

export type SidebarDomainWorkspaceId = 'evidence' | 'dispersion' | 'acoustics' | 'legalBioAi';

export interface SidebarWorkspaceNavProps {
  activeTab: RightPanelTab;
  onSelectTab: (tab: RightPanelTab) => void;
  observationsCount: number;
  legalViolationsCount: number;
  indoorSumQuotientSin: number;
}

const DOMAIN_FOR_TAB: Record<RightPanelTab, SidebarDomainWorkspaceId> = {
  algedonic: 'evidence',
  substances: 'dispersion',
  puff24h: 'dispersion',
  noiseDust: 'acoustics',
  indoorClimate: 'acoustics',
  compliance: 'legalBioAi',
  bioscience: 'legalBioAi',
  grounding: 'legalBioAi',
};

const SUBTABS_BY_DOMAIN: Record<
  SidebarDomainWorkspaceId,
  Array<{
    id: RightPanelTab;
    label: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
  }>
> = {
  evidence: [
    {
      id: 'algedonic',
      label: 'Beviser, ZKP & Mycelium',
      title: 'Registrerede beviser, AI Foto/Lyd/PDF & Mycelium BFT-telemetri',
      icon: Camera,
    },
  ],
  dispersion: [
    {
      id: 'substances',
      label: 'Stof, Sumformel & 29 Bygninger',
      title: 'Arbejdstilsynets Sumformel BEK 613/2026 & 29 Bygningsenheder',
      icon: FlaskConical,
    },
    {
      id: 'puff24h',
      label: '24t Puff, Vindrose & Prognose',
      title: '24-timers Gaussisk Puff-akkumulering, vindrose og prognoser',
      icon: Wind,
    },
  ],
  acoustics: [
    {
      id: 'noiseDust',
      label: 'Støj, Vindstød & DBA-Katalog',
      title: 'Korrelation mellem vejret, naboklager om støj (dB) og støv (S)',
      icon: Volume2,
    },
    {
      id: 'indoorClimate',
      label: 'Indeklima, CAV & Skorsten',
      title: 'DIN 4150-3, BR18 § 443, Termisk Opdrift & Indendørs Asbest (S_in)',
      icon: Home,
    },
  ],
  legalBioAi: [
    {
      id: 'compliance',
      label: 'Lovlog, L 69 & Slagelse',
      title: 'Lovovertrædelser, L 69 Bødeberegner & Slagelse Kommune Sagsbehandling',
      icon: Scale,
    },
    {
      id: 'bioscience',
      label: 'Bio-toks & Læge-AI',
      title: 'Molekylær Toksikologi, AlphaFold 3D, WHO-Score & Lægefaglig AI',
      icon: Dna,
    },
    {
      id: 'grounding',
      label: '5 AI Eksperter & Maps',
      title: 'Gemini Chat Bot med 5 AI Eksperter & Google Maps Grounding',
      icon: Bot,
    },
  ],
};

export const SidebarWorkspaceNav: React.FC<SidebarWorkspaceNavProps> = ({
  activeTab,
  onSelectTab,
  observationsCount,
  legalViolationsCount,
  indoorSumQuotientSin,
}) => {
  const activeDomain = DOMAIN_FOR_TAB[activeTab];
  const [lastTabByDomain, setLastTabByDomain] = useState<
    Record<SidebarDomainWorkspaceId, RightPanelTab>
  >({
    evidence: 'algedonic',
    dispersion: 'substances',
    acoustics: 'noiseDust',
    legalBioAi: 'compliance',
  });

  useEffect(() => {
    const dom = DOMAIN_FOR_TAB[activeTab];
    setLastTabByDomain((prev) =>
      prev[dom] === activeTab ? prev : { ...prev, [dom]: activeTab }
    );
  }, [activeTab]);

  const domains: Array<{
    id: SidebarDomainWorkspaceId;
    label: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeText?: string;
    badgeTone?: 'emerald' | 'rose' | 'cyan';
  }> = [
    {
      id: 'evidence',
      label: 'Beviser',
      title: 'Retsmedicinske beviser, Foto/Lyd/PDF, ZKP & System B Mycelium-netværk',
      icon: Camera,
      badgeText: String(observationsCount),
      badgeTone: 'emerald',
    },
    {
      id: 'dispersion',
      label: 'Spredning',
      title: 'Stof & Sumformel (BEK 613/2026), 29 Bygningsenheder, 24t Puff & Vindrose',
      icon: FlaskConical,
    },
    {
      id: 'acoustics',
      label: 'Akustik & Indeklima',
      title: 'Støj, vindstød, DBA-katalog samt Indeklima (S_in), CAV & Skorstenseffekt',
      icon: Volume2,
      badgeText:
        indoorSumQuotientSin >= 1.0
          ? `S_in ${indoorSumQuotientSin.toFixed(1)}`
          : undefined,
      badgeTone: 'rose',
    },
    {
      id: 'legalBioAi',
      label: 'Jura, Bio & AI',
      title: 'Lovovertrædelser, L 69, Bio-toks & Læge-AI samt 5 AI Eksperter',
      icon: Scale,
      badgeText: String(legalViolationsCount),
      badgeTone: legalViolationsCount > 0 ? 'rose' : 'cyan',
    },
  ];

  const currentSubTabs = SUBTABS_BY_DOMAIN[activeDomain];

  return (
    <div className="bg-[var(--surface-panel)] border-b border-[var(--border-subtle)] shrink-0 font-sans tabular-nums">
      {/* Trin A: 4 Rummelige Hovedkategorier */}
      <div
        role="tablist"
        aria-label="Primære analyse-kategorier"
        className="sidebar-tab-grid grid grid-cols-2 2xl:grid-cols-4 gap-1.5 p-2"
      >
        {domains.map((dom) => {
          const Icon = dom.icon;
          const isActive = activeDomain === dom.id;
          return (
            <button
              key={dom.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`workspace-domain-${dom.id}`}
              title={dom.title}
              onClick={() => {
                if (!isActive) {
                  onSelectTab(lastTabByDomain[dom.id]);
                }
              }}
              className={`px-2.5 py-2 rounded-md text-xs transition-colors flex items-center justify-between gap-2 border cursor-pointer min-w-0 ${
                isActive
                  ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] border-[#0284C7] font-semibold'
                  : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]/60 font-medium'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? 'text-[#38BDF8]' : 'text-[var(--text-secondary)]'
                  }`}
                />
                <span className="text-left text-xs leading-tight break-words">
                  {dom.label}
                </span>
              </span>
              {dom.badgeText && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 tabular-nums leading-none ${
                    dom.badgeTone === 'rose'
                      ? 'bg-rose-600 text-white'
                      : dom.badgeTone === 'emerald'
                      ? 'bg-[var(--surface-panel)] text-[#4ADE80] border border-[var(--border-subtle)]'
                      : 'bg-[var(--surface-panel)] text-[#38BDF8] border border-[var(--border-subtle)]'
                  }`}
                >
                  {dom.badgeText}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Trin B: Slank Sekundær Pill-Vælger til samtlige activeTab-værdier */}
      <div
        role="tablist"
        aria-label="Underfaner i valgt kategori"
        className="px-2 pb-2 pt-0.5 flex flex-wrap items-center gap-1.5"
      >
        {currentSubTabs.map((sub) => {
          const SubIcon = sub.icon;
          const isSubActive = activeTab === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              role="tab"
              aria-selected={isSubActive}
              data-testid={`workspace-subtab-${sub.id}`}
              title={sub.title}
              onClick={() => onSelectTab(sub.id)}
              className={`px-3 py-1 rounded-full text-[11px] transition-colors inline-flex items-center gap-1.5 border cursor-pointer whitespace-nowrap ${
                isSubActive
                  ? 'bg-[#0284C7]/20 text-[var(--text-primary)] border-[#38BDF8]/70 font-semibold'
                  : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] font-medium'
              }`}
            >
              <SubIcon
                className={`w-3.5 h-3.5 shrink-0 ${
                  isSubActive ? 'text-[#38BDF8]' : 'text-[var(--text-secondary)]'
                }`}
              />
              <span>{sub.label}</span>
              {sub.id === 'indoorClimate' && indoorSumQuotientSin >= 1.0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-mono font-bold shrink-0 tabular-nums leading-none">
                  S_in {indoorSumQuotientSin.toFixed(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
