import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  FileWarning,
  Scale,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { RINGPARKEN_BUILDINGS } from '../constants/ringparkenData';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
  RINGPARKEN_MASTER_BUILDINGS,
} from '../data/ringparkenData';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  PuffAccumulationResult,
  ReceptorZone,
  RingparkenBuildingUnit,
} from '../types/dispersion';
import {
  buildWeeklyCategoryExceedanceAndTrends,
  downloadComplianceAuditWeeklyPdfReport,
} from '../services/complianceAuditWeeklyPdfService';
import { IncidentAnalyzer } from './IncidentAnalyzer';
import { WeeklyExternalAuditWidget } from './WeeklyExternalAuditWidget';
import {
  BEK_496_2024_AREA_THRESHOLD_M2,
  BEK_613_2026_LIMITS,
  checkWorkHoursCompliance,
  computeFuzzySearchScore,
  evaluateBek496SelectiveDemolition,
} from '../utils/riskEngine';

export interface PermitCaseRecord {
  caseNumber: '25-019352' | '25-019350' | '25-019157' | '25-019354';
  buildingId: string;
  addressLabel: string;
  titleDa: string;
  areaM2: number;
  permitDate: string;
  bek496Mandatory: boolean;
  shelterStatusDa: string;
  keyNotesDa: string;
}

export interface AuditDiscrepancyItem {
  id: string;
  caseNumbers: Array<PermitCaseRecord['caseNumber'] | 'ALLE'>;
  category:
    | 'Dokumentfejl (Bilag 7)'
    | 'Manglende bilag (PSS)'
    | 'Lovgivningsefterslæb'
    | 'Intern PSS-afvigelse'
    | 'BEK 496/2024 (>250 m²)'
    | 'Sikringsrum & Udviklingsplan';
  severity: 'KRITISK' | 'HØJ' | 'OBSERVATION';
  titleDa: string;
  documentSourceDa: string;
  detailDa: string;
  statutoryImpactDa: string;
}

const PERMIT_CASES: PermitCaseRecord[] = [
  {
    caseNumber: '25-019352',
    buildingId: 'byg-2-kierulffsvej-12',
    addressLabel: 'Kierulffsvej 12, 4200 Slagelse',
    titleDa: 'Bygning 2 — Supermarked / Bazar (Matr. 21z, BFE 5367475)',
    areaM2: 1115,
    permitDate: '12.12.2025',
    bek496Mandatory: true,
    shelterStatusDa: 'Ingen sikringsrum registreret; høj radon/moræneler & grundvand 0,8–2,1 m',
    keyNotesDa:
      'Hovedbyggepladsadresse for Nedrivningsfelt Vest. Bilag 7 Beredskabsplan har fejloverskrift fra Holbæk Svømmehal.',
  },
  {
    caseNumber: '25-019350',
    buildingId: 'blok-1-kierulffsvej-14-22',
    addressLabel: 'Kierulffsvej 14-22, 4200 Slagelse',
    titleDa: 'Blok 1 — Afd. 023 (Boligblok med 2 sikringsrum)',
    areaM2: 3200,
    permitDate: '12.12.2025',
    bek496Mandatory: true,
    shelterStatusDa: '2 sikringsrum (80 pers.) — kræver dispensation/nedlæggelsesgodkendelse',
    keyNotesDa:
      '49,3 m fra beboet Blok 2; delvis krybekælder (må ikke ryddes før overliggende dæk er fjernet) & mineraluld <1997.',
  },
  {
    caseNumber: '25-019157',
    buildingId: 'byg-1-kierulffsvej-2',
    addressLabel: 'Kierulffsvej 2, 4200 Slagelse',
    titleDa: 'Bygning 1 — Børnehuset Nord / Vuggestue',
    areaM2: 547,
    permitDate: '12.12.2025',
    bek496Mandatory: true,
    shelterStatusDa: 'Oversvømmet og skimmelramt kælder (brun kiselgur på rørinstallationer)',
    keyNotesDa:
      '387 m² stueplan + 160 m² kælder; overstiger 250 m²-grænsen for selektiv nedrivning jf. BEK 496/2024.',
  },
  {
    caseNumber: '25-019354',
    buildingId: 'byg-3-valbyvej-58',
    addressLabel: 'Valbyvej 58, 4200 Slagelse',
    titleDa: 'Bygning 3 — Børnehave / Fritidshjem',
    areaM2: 774,
    permitDate: '12.12.2025',
    bek496Mandatory: true,
    shelterStatusDa: 'Sikringsrum manglede i oprindelig ansøgning — efteranmeldt 02.12.2025',
    keyNotesDa:
      'Beliggende nær beskyttede træer og 48,9 m fra dagligvarebutik Valbyvej 65B.',
  },
];

const AUDIT_DISCREPANCIES: AuditDiscrepancyItem[] = [
  {
    id: 'audit-holbaek-emergency-header',
    caseNumbers: ['25-019352', 'ALLE'],
    category: 'Dokumentfejl (Bilag 7)',
    severity: 'KRITISK',
    titleDa:
      'Fejloverskrift i Beredskabsplan (Bilag 7): "BEREDSKABSPLAN, HOLBÆK SVØMMEHAL - NEDRIVNING"',
    documentSourceDa: 'Beredskabsplan, rev. 19.05.2026, Bilag 7 (Wissenberg / Titan Nedbrydning)',
    detailDa:
      'Den udleverede beredskabsplan for byggepladsen Kierulffsvej 12 bærer hovedoverskriften "BEREDSKABSPLAN, HOLBÆK SVØMMEHAL - NEDRIVNING". Copy-paste fra en anden sag skaber risiko for forkerte mødesteder, forkerte lokale beredskabsinstanser og ugyldig pladsinstruktion.',
    statutoryImpactDa:
      'Overtræder kravet om projekt- og adressespecifik beredskabsplan i PSS (BEK om bygherres pligter & AT-krav).',
  },
  {
    id: 'audit-missing-pss-annexes',
    caseNumbers: ['25-019352', '25-019350', '25-019157', '25-019354'],
    category: 'Manglende bilag (PSS)',
    severity: 'KRITISK',
    titleDa:
      'Manglende bilag i PSS (rev. 19.05.2026): Bilag 1 (Byggepladstegninger), Bilag 3 (Adresseliste) & Bilag 4 (Tidsplan)',
    documentSourceDa: 'Plan for Sikkerhed og Sundhed (PSS W22085), rev. 19.05.2026',
    detailDa:
      'I det udleverede aktindsigtsmateriale mangler Bilag 1 (Byggepladstegninger med afspærring, sluser og hegn), Bilag 3 (Komplet telefon-/adresseliste) og Bilag 4 (Opdateret etape- og tidsplan) i PDF-dokumentet.',
    statutoryImpactDa:
      'Bygherre og AMK-P skal sikre komplet, tilgængelig PSS før og under udførelsen af særligt farligt arbejde (asbest, PCB, bly og nedrivning).',
  },
  {
    id: 'audit-legislation-lag-1792-lead',
    caseNumbers: ['25-019352', '25-019350', '25-019157', '25-019354'],
    category: 'Lovgivningsefterslæb',
    severity: 'KRITISK',
    titleDa:
      'Nedrivningstilladelse af 12.12.2025 henviser til ophævet BEK 1792/2015 og mangler blyskærpelse pr. 01.07.2026',
    documentSourceDa: 'Slagelse Kommune Nedrivningstilladelse af 12.12.2025 (alle 4 sager)',
    detailDa: `Tilladelsen henviser til den ophævede BEK nr. 1792/2015 frem for BEK nr. 1328 af 19.11.2025 (i kraft 21.12.2025 med autorisations- og 4-dages kursuskrav, skærpet yderligere pr. 01.07.2026 med forbud mod højtryksspuling) og afspejler ikke blyskærpelsen pr. 01.07.2026 på ${BEK_613_2026_LIMITS.leadMgPerM3.toFixed(2).replace('.', ',')} mg Pb/m³ (BEK nr. 613).`,
    statutoryImpactDa:
      'Udøvende entreprenør er lovmæssigt bundet af BEK 1328/2025 og BEK 613/2026 uanset at kommunens tilladelsestekst af 12.12.2025 ikke er opdateret.',
  },
  {
    id: 'audit-pss-internal-bek807-vs-1328',
    caseNumbers: ['ALLE'],
    category: 'Intern PSS-afvigelse',
    severity: 'HØJ',
    titleDa:
      'Intern bekendtgørelses-uoverensstemmelse i PSS (rev. 19.05.2026): Side 6 (BEK 807/2023) vs. Side 9 (BEK 1328/2025)',
    documentSourceDa: 'Wissenberg PSS W22085, rev. 19.05.2026, side 6 og side 9',
    detailDa:
      'Side 6 i selve PSS-dokumentet henviser fortsat til den ophævede asbestbekendtgørelse BEK nr. 807 af 15. juni 2023, mens side 9 i samme dokument korrekt henviser til den gældende BEK nr. 1328 af 19. november 2025.',
    statutoryImpactDa:
      'Skaber juridisk og instruktionsmæssig uklarhed på pladsen; skal ensrettes til BEK 1328/2025 på alle sider.',
  },
  {
    id: 'audit-bek496-selective-demolition',
    caseNumbers: ['25-019352', '25-019350', '25-019157', '25-019354'],
    category: 'BEK 496/2024 (>250 m²)',
    severity: 'HØJ',
    titleDa:
      'Selektiv nedrivning & standardiseret nedrivningsplan (BEK nr. 496 af 21/05/2024) for nedrivninger > 250 m² efter 01.07.2025',
    documentSourceDa: 'Nedrivningstilladelsens side 1 (12.12.2025) & BEK nr. 496/2024 §§ 7–11',
    detailDa: `Samtlige 4 tilladte nedrivninger (547 m², 774 m², 1.115 m² og 3.200 m²) overstiger tærsklen på ${BEK_496_2024_AREA_THRESHOLD_M2} m² efter 01.07.2025. Nedrivningstilladelsens side 1 stiller krav om standardiseret nedrivningsplan med fuld ressourcekortlægning samt navngiven ressource- og miljøkoordinator og navngiven ressourceansvarlig fra autoriseret/certificeret nedrivningsvirksomhed.`,
    statutoryImpactDa:
      'Manglende navngivelse eller mangelfuld udsortering før mekanisk nedbrydning udgør direkte overtrædelse af BEK nr. 496/2024.',
  },
  {
    id: 'audit-shelter-and-2021-devplan',
    caseNumbers: ['25-019354', '25-019350', 'ALLE'],
    category: 'Sikringsrum & Udviklingsplan',
    severity: 'HØJ',
    titleDa:
      'Efteranmeldt sikringsrum (Valbyvej 58, 02.12.2025) & 2021-udviklingsplan under omskrivning pr. september 2026',
    documentSourceDa: 'Sag 25-019354 (02.12.2025), Sag 25-019350 & FOB/Slagelse Kommune (sep. 2026)',
    detailDa:
      'Sikringsrum på Valbyvej 58 manglede i den oprindelige ansøgning og blev først efteranmeldt den 02.12.2025 (10 dage før tilladelsen; Blok 1 rummer yderligere 2 sikringsrum til 80 pers.). Parallelt er 2021-udviklingsplanen for Ringparken under omskrivning pr. september 2026 pga. udeblevne private investorer.',
    statutoryImpactDa:
      'Sikringsrum kræver formel beredskabsgodkendelse før nedrivning, og omdannelsesplanen påvirker tidsplan og etapeafgrænsning for Etape 2/3.',
  },
];

export interface ComplianceAuditPanelProps {
  onOpenBuildingOnGis?: (buildingId: string) => void;
  buildings?: RingparkenBuildingUnit[];
  sources?: DemolitionSourceNode[];
  receptors?: ReceptorZone[];
  observations?: AlgedonicObservation[];
  puff24h?: PuffAccumulationResult | null;
  dateIso?: string;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  merkleRootSignature?: string;
}

export const ComplianceAuditPanel: React.FC<ComplianceAuditPanelProps> = ({
  onOpenBuildingOnGis,
  buildings = RINGPARKEN_MASTER_BUILDINGS,
  sources,
  receptors,
  observations = [],
  puff24h = null,
  dateIso,
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
  merkleRootSignature,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'register' | 'incident'>(
    'register'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCaseFilter, setSelectedCaseFilter] = useState<
    'ALLE' | PermitCaseRecord['caseNumber']
  >('ALLE');
  const [nowDate, setNowDate] = useState<Date>(() => new Date());
  const [customTestTime, setCustomTestTime] = useState<string>('');
  const [lastWeeklyPdfExport, setLastWeeklyPdfExport] = useState<{
    fileName: string;
    sha256: string;
  } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowDate(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const evaluatedDate = useMemo(() => {
    if (!customTestTime) return nowDate;
    const parsed = new Date(customTestTime);
    return Number.isNaN(parsed.getTime()) ? nowDate : parsed;
  }, [customTestTime, nowDate]);

  const workHoursCompliance = useMemo(
    () =>
      checkWorkHoursCompliance(evaluatedDate, {
        timeZone: customTestTime ? undefined : 'Europe/Copenhagen',
      }),
    [evaluatedDate, customTestTime]
  );

  // Deterministisk BEK 496/2024 verifikation af alle 4 sager via riskEngine.ts
  const caseEvaluations = useMemo(() => {
    return PERMIT_CASES.map((c) => {
      const building = RINGPARKEN_BUILDINGS.find((b) => b.id === c.buildingId);
      const eval496 = evaluateBek496SelectiveDemolition({
        affectedFloorAreaM2: building?.areaM2 ?? c.areaM2,
        hasStandardizedDemolitionPlan: true,
        hasPreDemolitionResourceMapping: true,
        hasCertifiedDemolitionManager: false, // Flagges fordi navngiven koordinator/bilag mangler i aktindsigt
        hasAuthorizedAsbestosContractor: true,
        hasSeparatePre1997MineralWoolPlan: true,
        municipalityNotifiedTwoWeeksPrior: true,
      });
      return { record: c, eval496 };
    });
  }, []);

  const filteredDiscrepancies = useMemo(() => {
    const q = searchQuery.trim();
    return AUDIT_DISCREPANCIES.filter((item) => {
      if (
        selectedCaseFilter !== 'ALLE' &&
        !item.caseNumbers.includes(selectedCaseFilter)
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${item.titleDa} ${item.category} ${item.documentSourceDa} ${item.detailDa} ${item.statutoryImpactDa} ${item.caseNumbers.join(' ')}`;
      return computeFuzzySearchScore(q, hay) >= 30;
    });
  }, [searchQuery, selectedCaseFilter]);

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim();
    return caseEvaluations.filter(({ record }) => {
      if (selectedCaseFilter !== 'ALLE' && record.caseNumber !== selectedCaseFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${record.caseNumber} ${record.addressLabel} ${record.titleDa} ${record.shelterStatusDa} ${record.keyNotesDa}`;
      return computeFuzzySearchScore(q, hay) >= 30;
    });
  }, [caseEvaluations, searchQuery, selectedCaseFilter]);

  const effectiveDateIso = useMemo(
    () => dateIso ?? nowDate.toISOString().slice(0, 10),
    [dateIso, nowDate]
  );

  const weeklyAuditDataset = useMemo(
    () =>
      buildWeeklyCategoryExceedanceAndTrends({
        dateIso: effectiveDateIso,
        buildings,
        sources,
        receptors,
        puff24h,
      }),
    [effectiveDateIso, buildings, sources, receptors, puff24h]
  );

  const handleExportWeeklyCategoryPdf = () => {
    const res = downloadComplianceAuditWeeklyPdfReport({
      dateIso: effectiveDateIso,
      buildings,
      sources,
      receptors,
      puff24h,
      permitCases: filteredCases.map(({ record, eval496 }) => ({
        caseNumber: record.caseNumber,
        addressLabel: record.addressLabel,
        titleDa: record.titleDa,
        areaM2: record.areaM2,
        bek496StatusDa: eval496.statusLabelDa,
      })),
      discrepancies: filteredDiscrepancies.map((d) => ({
        category: d.category,
        severity: d.severity,
        titleDa: d.titleDa,
        statutoryImpactDa: d.statutoryImpactDa,
      })),
      workHoursStatusDa: workHoursCompliance.statusLabelDa,
    });
    setLastWeeklyPdfExport({
      fileName: res.fileName,
      sha256: res.dataset.reportSha256,
    });
  };

  const handleExportAuditJson = () => {
    const payload = {
      exportedAtIso: new Date().toISOString(),
      location: 'Ringparken, 4200 Slagelse',
      workHoursCompliance,
      permitCases: caseEvaluations,
      discrepancies: filteredDiscrepancies,
      weeklyCategorySummary: weeklyAuditDataset,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ringparken_aktindsigt_audit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="3. Borgertilsyn og Dokument-Audit for Ringparken"
      className="w-full h-full overflow-y-auto bg-[#0B0F19] text-slate-100 p-4 lg:p-6 space-y-6 font-sans"
    >
      {/* TOPHEADER + REALTIDS ARBEJDSTIDS- & STØJINDIKATOR */}
      <div className="max-w-[1360px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>3. Borgertilsyn &amp; Dokument-Audit</span>
            <span aria-hidden="true">·</span>
            <span>Sager: 25-019352, 25-019350, 25-019157, 25-019354</span>
            <span aria-hidden="true">·</span>
            <span>BEK 496/2024, BEK 1328/2025, BEK 613/2026</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-50 flex items-center gap-2">
            <Scale className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>Lovgivnings- og Aktindsigtsregister (Slagelse Kommune)</span>
          </h1>
        </div>

        {/* Realtids-indikator for lovlig arbejdstid & støjgrænse */}
        <div
          data-testid="audit-realtime-workhours-indicator"
          className={`px-4 py-2.5 rounded-lg border flex flex-wrap items-center gap-3 text-xs ${
            workHoursCompliance.isAllowed
              ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-100'
              : 'bg-rose-950/45 border-rose-500/70 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {workHoursCompliance.isAllowed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="font-mono font-bold tabular-nums">
                {workHoursCompliance.statusLabelDa}
              </div>
              <div className="text-[11px] opacity-90 font-mono tabular-nums">
                Tid: {String(workHoursCompliance.localHour).padStart(2, '0')}:
                {String(workHoursCompliance.localMinute).padStart(2, '0')} · Regler: Ma–Fr 07–18 (70 dB(A)) · Lø 07–14 (64 dB(A))
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
            <Clock className="w-3.5 h-3.5 opacity-80 shrink-0" />
            <input
              type="datetime-local"
              aria-label="Test andet tidspunkt for arbejdstid og støjgrænse"
              value={customTestTime}
              onChange={(e) => setCustomTestTime(e.target.value)}
              className="bg-[#0B0F19]/80 border border-[#334155] rounded px-2 py-1 text-[11px] font-mono text-slate-100 [color-scheme:dark]"
            />
            {customTestTime && (
              <button
                type="button"
                onClick={() => setCustomTestTime('')}
                className="px-2 py-1 rounded bg-[#0B0F19] border border-[#334155] text-[11px] font-mono hover:text-white cursor-pointer"
              >
                Nu
              </button>
            )}
          </div>
        </div>
      </div>

      {/* UNDER-NAVIGATION: AKTINDSIGTSREGISTER VS. PLADS-OBSERVATION & FOTOANALYSE */}
      <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Underfaner for Borgertilsyn og Dokument-Audit"
          className="inline-flex flex-wrap items-center gap-1.5 bg-[#111827] border border-[#334155] rounded-lg p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'register'}
            onClick={() => setActiveSubTab('register')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              activeSubTab === 'register'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span>Lovgivnings- &amp; Aktindsigtsregister</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'incident'}
            onClick={() => setActiveSubTab('incident')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              activeSubTab === 'incident'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5 shrink-0" />
            <span>Plads-observation &amp; Fotoanalyse (AI)</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          {activeSubTab === 'register'
            ? '4 aktive sager · PSS W22085 (19.05.2026)'
            : 'Multimodal hændelsesanalyse (Gemini 3.8 Flash · JSON-schema)'}
        </span>
      </div>

      {activeSubTab === 'incident' ? (
        <IncidentAnalyzer onOpenBuildingOnGis={onOpenBuildingOnGis} />
      ) : (
        <>
      {/* SØGEBOKS & SAGSNUMMER-FILTRE */}
      <div className="max-w-[1360px] mx-auto bg-[#111827] border border-[#334155] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søg i sagsnumre, BEK-numre, Holbæk Svømmehal, bilag, bly 0,03 mg/m³, sikringsrum..."
            aria-label="Søg i lovgivnings- og aktindsigtsregister"
            className="w-full pl-9 pr-3 py-2 rounded-md bg-[#0B0F19] border border-[#334155] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALLE', label: 'Alle 4 sager' },
              { id: '25-019352', label: '25-019352 (Kierulffsvej 12)' },
              { id: '25-019350', label: '25-019350 (Blok 1)' },
              { id: '25-019157', label: '25-019157 (Kierulffsvej 2)' },
              { id: '25-019354', label: '25-019354 (Valbyvej 58)' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedCaseFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono cursor-pointer transition-colors whitespace-nowrap ${
                selectedCaseFilter === f.id
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-[#0B0F19] border border-[#334155] text-slate-300 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}

          <button
            type="button"
            data-testid="export-compliance-audit-weekly-pdf-btn"
            onClick={handleExportWeeklyCategoryPdf}
            className="px-3 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
            title="Generér PDF-rapport med uge-overskridelser pr. bygningskategori og grafer over S-kvotient tendenser for de mest belastede receptorer"
          >
            <FileDown className="w-3.5 h-3.5 shrink-0" />
            <span>Eksportér Uge-Overskridelser &amp; S-Tendens PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportAuditJson}
            className="px-3 py-1.5 rounded-md bg-[#1E293B] hover:bg-[#293548] border border-[#334155] text-xs font-mono text-cyan-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Eksporter Audit JSON</span>
          </button>
        </div>
      </div>

      {/* AUTOMATISK UGERAPPORT TIL EKSTERN REVISION (STØJ, STØV & VEJR - 168 TIMER) */}
      <div className="max-w-[1360px] mx-auto">
        <WeeklyExternalAuditWidget
          dateIso={dateIso ?? new Date().toISOString().slice(0, 10)}
          sources={sources && sources.length > 0 ? sources : INITIAL_DEMOLITION_SOURCES}
          receptors={receptors && receptors.length > 0 ? receptors : INITIAL_RECEPTOR_ZONES}
          observations={observations}
          manualMachineNoiseOutputDb={manualMachineNoiseOutputDb}
          isManualMachineNoiseOverrideActive={isManualMachineNoiseOverrideActive}
          merkleRootSignature={merkleRootSignature}
        />
      </div>

      {/* UGE-OVERSKRIDELSER PR. BYGNINGSKATEGORI & S-KVOTIENT TENDENSER (PDF-FORHÅNDSVISNING) */}
      <div
        data-testid="compliance-audit-weekly-summary-card"
        className="max-w-[1360px] mx-auto bg-[#111827] border border-cyan-500/40 rounded-lg p-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1E293B]">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Uge-Overskridelser pr. Bygningskategori &amp; S-Kvotient Tendenser ({weeklyAuditDataset.periodLabel})
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Samlet opgørelse på tværs af alle 5 bygningskategorier inkl. 7-døgns tendensgrafer for de {weeklyAuditDataset.topReceptorTrends.length} mest belastede receptorer til PDF-rapportskabelon.
            </p>
          </div>
          {lastWeeklyPdfExport && (
            <div
              data-testid="compliance-audit-weekly-pdf-toast"
              className="px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-[11px] font-mono tabular-nums"
            >
              ✓ PDF gemt · SHA-256: {lastWeeklyPdfExport.sha256.slice(0, 14)}…
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {weeklyAuditDataset.categorySummaries.map((cat) => (
            <div
              key={cat.category}
              className="p-2.5 rounded-md bg-[#0B0F19] border border-[#1E293B] space-y-1.5 text-xs"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: cat.colorHex }}
                  />
                  <span className="truncate">{cat.labelDa}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                  {cat.buildingCount} enh.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 font-mono text-[11px] tabular-nums">
                <div>
                  <span className="text-slate-500">S≥1: </span>
                  <span
                    className={
                      cat.weeklyExceedanceHoursS1 > 0
                        ? 'text-rose-300 font-bold'
                        : 'text-emerald-300 font-bold'
                    }
                  >
                    {cat.weeklyExceedanceHoursS1} t ({cat.daysWithSOver1}/7d)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Maks: </span>
                  <span
                    className={
                      cat.peakSumQuotientS >= 1.0
                        ? 'text-rose-300 font-bold'
                        : cat.peakSumQuotientS >= 0.8
                        ? 'text-amber-300 font-bold'
                        : 'text-cyan-300 font-bold'
                    }
                  >
                    S={cat.peakSumQuotientS.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 truncate font-mono">
                Spids: {cat.worstBuildingLabel}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {weeklyAuditDataset.topReceptorTrends.map((trend) => {
            const pts = trend.daily7DayPeakS;
            const maxS = Math.max(1.4, ...pts.map((p) => p.maxS));
            const polyPoints = pts
              .map((p, idx) => {
                const x = (idx / Math.max(1, pts.length - 1)) * 136 + 4;
                const y = 34 - (Math.min(maxS, p.maxS) / maxS) * 28;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');
            const limitY = 34 - (1.0 / maxS) * 28;
            return (
              <div
                key={`audit-trend-${trend.receptorId}`}
                className="p-2.5 rounded-md bg-[#0B0F19] border border-[#1E293B] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-cyan-300 truncate">
                    {trend.receptorCode} · {trend.receptorName}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                      trend.peakSumQuotientS >= 1.0
                        ? 'text-rose-300'
                        : trend.peakSumQuotientS >= 0.8
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    S={trend.peakSumQuotientS.toFixed(2)}
                  </span>
                </div>
                <svg
                  viewBox="0 0 144 38"
                  className="w-full h-9 overflow-visible"
                  role="img"
                  aria-label={`7-døgns S-kvotient tendens for ${trend.receptorCode}`}
                >
                  <line
                    x1="4"
                    y1={limitY}
                    x2="140"
                    y2={limitY}
                    stroke="#f43f5e"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                    strokeOpacity="0.7"
                  />
                  <polyline
                    fill="none"
                    stroke={trend.peakSumQuotientS >= 1.0 ? '#fb7185' : '#38bdf8'}
                    strokeWidth="1.8"
                    points={polyPoints}
                  />
                </svg>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                  <span>{trend.buildingCategoryLabelDa}</span>
                  <span>
                    {trend.weeklyDaysOver1}/7 d S≥1 · {trend.cumulative24hDoseSt.toFixed(1)} S·t
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OVERSIGT OVER DE 4 SAGER & BEK 496/2024 (>250 m²) */}
      <div className="max-w-[1360px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {filteredCases.map(({ record, eval496 }) => (
          <div
            key={record.caseNumber}
            className="bg-[#111827] border border-[#334155] rounded-lg p-4 flex flex-col justify-between gap-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 font-mono text-xs">
                <span className="font-bold text-cyan-300">Sag {record.caseNumber}</span>
                <span className="text-slate-400 tabular-nums">
                  {record.areaM2.toLocaleString('da-DK')} m² &gt; 250 m²
                </span>
              </div>
              <h2 className="text-sm font-semibold text-slate-100 leading-snug">
                {record.titleDa}
              </h2>
              <p className="text-xs text-slate-400">{record.addressLabel}</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                {record.keyNotesDa}
              </p>
            </div>

            <div className="pt-2.5 border-t border-[#1E293B] space-y-1.5 text-[11px]">
              <div className="text-amber-300 font-mono">
                {eval496.statusLabelDa}
              </div>
              <div className="text-slate-400">{record.shelterStatusDa}</div>
              {onOpenBuildingOnGis && (
                <button
                  type="button"
                  onClick={() => onOpenBuildingOnGis(record.buildingId)}
                  className="text-cyan-300 hover:text-cyan-200 font-medium underline cursor-pointer"
                >
                  Åbn matrikel i GIS Risikokort
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* DOKUMENTEREDE UOVERENSSTEMMELSER & AKTINDSIGTSFUND */}
      <div className="max-w-[1360px] mx-auto bg-[#111827] border border-[#334155] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Dokumenterede fejl, mangler og lovgivningsuoverensstemmelser ({filteredDiscrepancies.length})
            </span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Aktindsigt &amp; PSS W22085 (rev. 19.05.2026) · Tilladelse (12.12.2025)
          </span>
        </div>

        {filteredDiscrepancies.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Ingen registrerede audit-punkter matchede din søgning eller sagsfilteret.
          </div>
        ) : (
          <div className="divide-y divide-[#1E293B]">
            {filteredDiscrepancies.map((item) => (
              <article key={item.id} className="p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        item.severity === 'KRITISK'
                          ? 'text-rose-300'
                          : 'text-amber-300'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.severity}</span>
                    </span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="text-cyan-300">{item.category}</span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="text-slate-400">
                      Sager: {item.caseNumbers.join(', ')}
                    </span>
                  </div>
                  <span className="text-slate-400">{item.documentSourceDa}</span>
                </div>

                <h3 className="text-sm font-semibold text-slate-50">
                  {item.titleDa}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed max-w-5xl">
                  {item.detailDa}
                </p>

                <p className="text-xs text-cyan-200/90">
                  <strong>Juridisk / tilsynsmæssig betydning:</strong>{' '}
                  {item.statutoryImpactDa}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </section>
  );
};

export default ComplianceAuditPanel;
